// Home-page search probe for Phase P7.
// 1. Loads /, waits for DuckDB-WASM to initialize.
// 2. Types "Hopkins" into the UniversitySearchBox input.
// 3. Asserts the results listbox appears with at least one option
//    whose label contains "Hopkins".
//
// Pre-requisite: a local static server (e.g.
//   python3 -m http.server -d apps/web/out 3000
// ) must be running on http://localhost:<PORT>.

const puppeteer = require('puppeteer-core');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const CHROME =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const QUERY = process.env.QUERY || 'Hopkins';

(async () => {
  console.log(`Probing home-page search at ${BASE} with query "${QUERY}"…`);
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
    // Harmless in static export: next/link prefetches RSC payloads
    // (/<route>/index.txt?_rsc=...) which the static host doesn't serve.
    // Page itself navigates fine on click.
    if (/_rsc=/.test(text)) return;
    if (/404 \(File not found\)/.test(text)) return;
    failures.push(`CONSOLE ${text}`);
  });

  try {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 45000 });
    // DuckDB-WASM + parquet hydration.
    await new Promise((r) => setTimeout(r, 2500));

    // Find the search input.
    const input = await page.$('input[type="search"][aria-label="Search universities"]');
    if (!input) throw new Error('Search input not found on home page');

    // Type, then wait for the debounced query to land.
    await input.focus();
    await page.keyboard.type(QUERY, { delay: 60 });
    await new Promise((r) => setTimeout(r, 1500));

    // The dropdown is a <ul role="listbox">. Check it exists and has options.
    const results = await page.evaluate(() => {
      const lb = document.querySelector('ul[role="listbox"]');
      if (!lb) return { found: false };
      const items = Array.from(lb.querySelectorAll('li[role="option"]')).map(
        (li) => li.textContent?.trim() ?? '',
      );
      return { found: true, count: items.length, items };
    });

    if (!results.found) {
      failures.push('Listbox dropdown never rendered after typing');
    } else if (results.count === 0) {
      failures.push('Listbox rendered but contains 0 options');
    } else {
      const hasMatch = results.items.some((t) =>
        t.toLowerCase().includes(QUERY.toLowerCase()),
      );
      if (!hasMatch) {
        failures.push(
          `Listbox has ${results.count} options but none match "${QUERY}": ${results.items.slice(0, 3).join(' | ')}`,
        );
      } else {
        console.log(`OK: ${results.count} matches for "${QUERY}"`);
        results.items.slice(0, 5).forEach((t) => console.log(`  · ${t}`));
      }
    }
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
  console.log('Home-page search probe: PASS');
})();
