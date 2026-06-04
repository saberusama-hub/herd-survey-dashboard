// Verifies that changing the year dropdown actually re-renders numeric
// content on each affected route. Compares two snapshots of the table /
// chart data (FY2024 default vs FY2010) and asserts at least one numeric
// value changed.
//
// Usage: CHROME_PATH=/path/to/chrome node scripts/qa/live_year_swap.js

const path = require('path');
const fs = require('fs');

const URL_BASE = process.env.URL_BASE || 'https://herd-survey-dashboard.saber-usama.workers.dev';
const CHROME = process.env.CHROME_PATH;
const RESOLVE_IP = '104.21.35.142';
const OUT_DIR = '/tmp/qa-live';
fs.mkdirSync(OUT_DIR, { recursive: true });

const TARGETS = [
  { name: 'universities', path: '/universities/', selectIndex: 0 },
  { name: 'topics', path: '/topics/', selectIndex: 0 }, // summary year
  { name: 'national', path: '/national/', selectIndex: 0 },
  { name: 'sbir-state', path: '/sbir/', selectIndex: 2 }, // state-view year
];

(async () => {
  process.env.NODE_PATH = path.resolve(__dirname, '../../node_modules');
  require('module').Module._initPaths();
  const puppeteer = require('puppeteer-core');
  const host = new URL(URL_BASE).host;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    defaultViewport: { width: 1440, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--host-resolver-rules=MAP ${host} ${RESOLVE_IP}`,
    ],
  });

  const results = [];

  for (const t of TARGETS) {
    const page = await browser.newPage();
    await page.goto(`${URL_BASE}${t.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page
      .waitForFunction(() => document.querySelectorAll('select').length > 0, { timeout: 20000 })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 5000));

    // Grab options + before snapshot
    const before = await page.evaluate((i) => {
      const sels = document.querySelectorAll('select');
      const sel = sels[i];
      if (!sel) return null;
      const opts = Array.from(sel.options)
        .filter((o) => /FY20/.test(o.textContent || ''))
        .map((o) => o.value);
      const tableSnap = (() => {
        const cells = Array.from(document.querySelectorAll('table tbody td')).slice(0, 30);
        return cells.map((c) => (c.textContent || '').trim()).join('|');
      })();
      return { opts, current: sel.value, tableSnap };
    }, t.selectIndex);
    if (!before) {
      results.push({ route: t.name, ok: false, reason: 'select not found' });
      await page.close();
      continue;
    }

    // Pick a year far from the current one. Prefer FY2010.
    const targetYear = before.opts.includes('2010') ? '2010' : before.opts[before.opts.length - 1];
    await page.evaluate(
      (i, year) => {
        const sels = document.querySelectorAll('select');
        const sel = sels[i];
        if (!sel) return;
        sel.value = year;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      },
      t.selectIndex,
      targetYear,
    );
    await new Promise((r) => setTimeout(r, 5000));

    const after = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('table tbody td')).slice(0, 30);
      return cells.map((c) => (c.textContent || '').trim()).join('|');
    });

    const changed = before.tableSnap !== after;
    await page.screenshot({ path: `${OUT_DIR}/${t.name}-after-fy${targetYear}.png`, fullPage: false });
    results.push({
      route: t.name,
      fromFy: before.current,
      toFy: targetYear,
      contentChanged: changed,
      ok: changed,
    });

    await page.close();
  }

  await browser.close();

  console.log('\n──────────────  YEAR SWAP CHECK  ──────────────');
  for (const r of results) {
    console.log(`${r.ok ? '✓' : '✗'} ${r.route.padEnd(16)} ${r.fromFy} → ${r.toFy}  changed=${r.contentChanged}`);
  }
  fs.writeFileSync(`${OUT_DIR}/year-swap.json`, JSON.stringify(results, null, 2));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
