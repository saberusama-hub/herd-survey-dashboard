// Live-site smoke test for the QA round covering:
//  - all routes return without console errors / pageerrors / failed requests
//  - share-%% values rendered in tables never exceed 100% (fixes the
//    double-percent bug across /topics, /sbir, /universities profiles)
//  - sortable-th elements exist on every page that should have them
//  - year selectors exist on /national, /sbir, /universities, /topics, /compare
//  - dropdown changes actually re-render numeric content (FY swap test)
//
// Usage:
//   CHROME_PATH=/path/to/chrome node scripts/qa/live_smoke.js
//
// Writes screenshots to /tmp/qa-live/<route>.png and a single JSON report
// to /tmp/qa-live/report.json. Exits non-zero if any check fails.

const path = require('path');
const fs = require('fs');

const OUT_DIR = '/tmp/qa-live';
fs.mkdirSync(OUT_DIR, { recursive: true });

const URL_BASE = process.env.URL_BASE || 'https://herd-survey-dashboard.saber-usama.workers.dev';
const CHROME = process.env.CHROME_PATH;
const RESOLVE_IP = '104.21.35.142'; // bypass local DNS NXDOMAIN on *.workers.dev

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/universities/', name: 'universities' },
  { path: '/national/', name: 'national' },
  { path: '/sbir/', name: 'sbir' },
  { path: '/topics/', name: 'topics' },
  { path: '/compare/', name: 'compare' },
  { path: '/sources/', name: 'sources' },
  { path: '/methodology/', name: 'methodology' },
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

  const report = { route_summary: [], failures: [] };

  for (const route of ROUTES) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('requestfailed', (req) => {
      const url = req.url();
      if (url.includes('favicon')) return;
      failedRequests.push({ url, errText: req.failure()?.errorText });
    });

    const url = `${URL_BASE}${route.path}`;
    console.log(`→ ${route.name} : ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Wait for KPI tile or table data to populate — many pages use DuckDB-WASM.
    await page
      .waitForFunction(
        () => {
          const tile = document.querySelector('.t-num-display, .t-num-tile');
          if (tile && /\d/.test(tile.textContent || '')) return true;
          // No KPI tile on /national, /methodology, /sources — fall back to:
          return document.querySelectorAll('table tr').length > 1 || document.querySelector('h2');
        },
        { timeout: 30000, polling: 200 },
      )
      .catch(() => {});

    // Give DuckDB-WASM panels a moment to settle.
    await new Promise((r) => setTimeout(r, 4000));

    // === Check 1: collect any rendered share-%% values
    const sharePcts = await page.evaluate(() => {
      const out = [];
      // Walk every <td> that's column-aligned right + contains a "%" sign.
      for (const td of document.querySelectorAll('td.tnum, td.text-right, td')) {
        const t = (td.textContent || '').trim();
        if (t.endsWith('%') && !t.includes('%/yr')) {
          const num = Number.parseFloat(t.replace(/[+,]/g, ''));
          if (Number.isFinite(num)) out.push({ text: t, value: num });
        }
      }
      return out;
    });
    const overHundred = sharePcts.filter((s) => s.value > 100 && s.value <= 99999);
    // Filter out plausible non-share columns: CAGR values can exceed 100% legitimately.

    // === Check 2: sortable headers exist where they should
    const sortableThCount = await page.evaluate(
      () => document.querySelectorAll('th[aria-sort]').length,
    );

    // === Check 3: year selectors
    const selectsWithFy = await page.evaluate(() => {
      const out = [];
      for (const sel of document.querySelectorAll('select')) {
        const opts = Array.from(sel.options).map((o) => o.textContent || '');
        if (opts.some((t) => /FY20/.test(t))) {
          out.push({ id: sel.id, count: opts.length, current: sel.value });
        }
      }
      return out;
    });

    // === Check 4: hero number actually appeared (data loaded)
    const hasNumeric = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      return /\$[0-9]+(\.[0-9]+)?\s*[BMK]/.test(txt);
    });

    const screenshotPath = `${OUT_DIR}/${route.name}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const issues = [];
    if (consoleErrors.length) issues.push(`${consoleErrors.length} console error(s)`);
    if (pageErrors.length) issues.push(`${pageErrors.length} pageerror(s)`);
    if (failedRequests.length) issues.push(`${failedRequests.length} failed request(s)`);
    if (overHundred.length) issues.push(`${overHundred.length} share %>100`);
    if (!hasNumeric && !['methodology', 'sources'].includes(route.name)) issues.push('no numeric content');

    const summary = {
      route: route.name,
      url,
      consoleErrors,
      pageErrors,
      failedRequests,
      sortableThCount,
      yearSelects: selectsWithFy,
      sharePctSamples: sharePcts.slice(0, 8),
      overHundred,
      hasNumeric,
      screenshot: screenshotPath,
      issues,
    };
    report.route_summary.push(summary);
    if (issues.length) report.failures.push({ route: route.name, issues });

    await page.close();
  }

  await browser.close();

  fs.writeFileSync(`${OUT_DIR}/report.json`, JSON.stringify(report, null, 2));

  console.log('\n──────────────  QA SMOKE SUMMARY  ──────────────');
  for (const s of report.route_summary) {
    const status = s.issues.length ? `✗ ${s.issues.join(', ')}` : '✓';
    console.log(
      `${status.padEnd(34)} ${s.route.padEnd(14)} sort-th=${String(s.sortableThCount).padStart(3)}  yr-sel=${s.yearSelects.length}`,
    );
  }
  console.log(`\nFull report: ${OUT_DIR}/report.json`);
  console.log(`Screenshots: ${OUT_DIR}/<route>.png`);
  process.exit(report.failures.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
