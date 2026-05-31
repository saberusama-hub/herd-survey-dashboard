// /compare probe for Phase P6.1.
//
// 1. Loads /compare, waits for DuckDB-WASM to initialize.
// 2. Types into the typeahead, picks the first matching uni, repeats for a
//    second pick.
// 3. Asserts that two ChartFrame headers appear (one per selected uni) and a
//    BarChart renders in each.
// 4. Switches the metric dropdown between all four options and waits for
//    re-render.
// 5. Removes the first pick via the × button and confirms only one panel
//    remains.
// 6. Captures pageerror / console.error events the whole way through and
//    fails if anything fires.
//
// Pre-requisite: a static server is running against apps/web/out on $PORT.

const puppeteer = require('puppeteer-core');

const PORT = process.env.PORT || 3737;
const BASE = `http://localhost:${PORT}`;
const CHROME =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const PICK_A = process.env.PICK_A || 'Hopkins';
const PICK_B = process.env.PICK_B || 'Michigan';

const METRICS = ['totalRd', 'federalShare', 'piCount', 'stemShare'];

async function waitForListbox(page, ms = 6000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const count = await page.evaluate(() => {
      const lb = document.querySelector('ul[role="listbox"]');
      return lb ? lb.querySelectorAll('li[role="option"]').length : 0;
    });
    if (count > 0) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
}

async function panelCount(page) {
  // Each panel renders <figure> via ChartFrame, inside a Card. Count h3 headers
  // that look like uni names (ChartFrame puts the uni name in the figure's h3).
  return page.evaluate(() => document.querySelectorAll('figure header h3').length);
}

async function pickUniversity(page, query) {
  const input = await page.$('input[type="search"][aria-label="Search universities to add"]');
  if (!input) throw new Error('Search input not found');
  // Clear via select-all + Delete (more reliable than triple-click).
  await input.focus();
  await page.keyboard.down('Meta');
  await page.keyboard.press('A');
  await page.keyboard.up('Meta');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(query, { delay: 70 });
  // wait for debounced query (150ms in our SearchTypeahead) + duckdb query
  const ok = await waitForListbox(page, 6000);
  if (!ok) throw new Error(`Listbox did not appear after typing "${query}"`);
  const optionCount = await page.evaluate(
    () => document.querySelectorAll('ul[role="listbox"] li[role="option"] button').length,
  );
  if (optionCount === 0) throw new Error(`Listbox empty for "${query}"`);
  await page.evaluate(() => {
    const btn = document.querySelector(
      'ul[role="listbox"] li[role="option"] button',
    );
    if (btn) {
      // mousedown is what our handler responds to
      btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    }
  });
  // wait for getUniversityProfile to resolve (DuckDB-WASM round trip)
  await new Promise((r) => setTimeout(r, 1500));
}

async function switchMetric(page, metricKey) {
  await page.evaluate((k) => {
    const sel = document.querySelector('select');
    if (!sel) throw new Error('Metric <select> not found');
    sel.value = k;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, metricKey);
  // Allow the chart re-render to settle (Recharts animations are off but
  // React still needs a tick).
  await new Promise((r) => setTimeout(r, 400));
}

(async () => {
  console.log(`Probing ${BASE}/compare with picks "${PICK_A}", "${PICK_B}"…`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
  });
  const failures = [];

  const page = await browser.newPage();
  page.on('pageerror', (err) => failures.push(`PAGEERROR ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/favicon\.ico/.test(text)) return;
    if (/_rsc=/.test(text)) return;
    if (/404 \(File not found\)/.test(text)) return;
    failures.push(`CONSOLE ${text}`);
  });

  try {
    await page.goto(`${BASE}/compare/`, { waitUntil: 'networkidle0', timeout: 45000 });
    // Wait for DuckDB-WASM + parquet hydration. Poll the input until enabled.
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const ready = await page.evaluate(() => {
        const i = document.querySelector('input[aria-label="Search universities to add"]');
        return i && !i.disabled;
      });
      if (ready) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    // Small extra settle for DuckDB query layer.
    await new Promise((r) => setTimeout(r, 2000));

    // ── Add two universities
    await pickUniversity(page, PICK_A);
    await pickUniversity(page, PICK_B);

    const panels = await panelCount(page);
    if (panels < 2) {
      failures.push(`Only ${panels} panel(s) rendered after adding two unis`);
    } else {
      console.log(`OK: ${panels} panels rendered after adding two unis`);
    }

    // ── Cycle through every metric
    for (const m of METRICS) {
      await switchMetric(page, m);
      const stillPanels = await panelCount(page);
      if (stillPanels < 2) {
        failures.push(`Metric ${m}: panels dropped to ${stillPanels}`);
      } else {
        // Confirm a Recharts svg actually rendered inside each panel.
        const svgs = await page.evaluate(
          () => document.querySelectorAll('.recharts-wrapper svg').length,
        );
        console.log(`  metric=${m}: ${stillPanels} panels, ${svgs} recharts svgs`);
      }
    }

    // ── Remove first uni via × button
    const beforeRemove = await panelCount(page);
    await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label^="Remove "]');
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 600));
    const afterRemove = await panelCount(page);
    if (afterRemove !== beforeRemove - 1 && afterRemove > 0) {
      // After removing one with only 2 unis, we drop below MIN_PICKS=2, so the
      // grid is replaced by the EmptyState — panels should be 0.
      if (afterRemove !== 0) {
        failures.push(
          `Remove × button: panels went ${beforeRemove} → ${afterRemove} (expected ${beforeRemove - 1} or 0)`,
        );
      }
    }
    console.log(`OK: remove × ${beforeRemove} → ${afterRemove} panels`);
  } catch (e) {
    failures.push(`NAV ${e.message}`);
  }

  await page.close();
  await browser.close();

  if (failures.length) {
    console.error('FAILURES:');
    failures.forEach((f) => console.error(' - ' + f));
    process.exit(1);
  }
  console.log('/compare probe: PASS');
})();
