// Profile-route probe for Phase P3 (P3.10).
// Picks 5 representative institutions from dim_institution.json
// (first, 250th, 500th, 750th, last) and loads each /universities/<sk>
// page against a local static server. Fails on any client-side error,
// pageerror, or HTTP >= 400 (other than the harmless favicon fetches).
//
// Pre-requisite: a local server (e.g. python3 -m http.server -d apps/web/out)
// must be running on http://localhost:<PORT> with the static export served.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const CHROME =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const dimPath = path.resolve(
  __dirname,
  '..',
  '..',
  'apps',
  'web',
  'public',
  'data',
  'dim_institution.json',
);
const institutions = JSON.parse(fs.readFileSync(dimPath, 'utf8'));
if (institutions.length === 0) {
  console.error('dim_institution.json is empty');
  process.exit(1);
}

const last = institutions.length - 1;
const SAMPLE_INDEXES = [0, 250, 500, 750, last];
const SAMPLE = SAMPLE_INDEXES.map((i) => institutions[Math.min(i, last)]).filter(
  (v, i, a) => a.findIndex((x) => x.sk === v.sk) === i,
);

const ROUTES = SAMPLE.map((i) => ({
  url: `/universities/${encodeURIComponent(i.sk)}/`,
  label: `${i.name} (${i.sk})`,
}));

const IGNORE_URL_RE = /\/favicon\.ico$|\/apple-touch-icon.*\.png$/;

(async () => {
  console.log(`Probing ${ROUTES.length} profile routes at ${BASE} ...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
  });
  const failures = [];

  for (const r of ROUTES) {
    const page = await browser.newPage();

    page.on('pageerror', (err) => failures.push(`${r.label}: PAGEERROR ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const loc = msg.location && msg.location();
      if (loc && loc.url && IGNORE_URL_RE.test(loc.url)) return;
      const text = msg.text();
      if (/favicon\.ico/.test(text)) return;
      failures.push(`${r.label}: CONSOLE ${text}`);
    });
    page.on('requestfailed', (req) => {
      if (IGNORE_URL_RE.test(req.url())) return;
      failures.push(
        `${r.label}: REQ-FAIL ${req.url()} ${req.failure()?.errorText || ''}`,
      );
    });
    page.on('response', (res) => {
      const s = res.status();
      if (s >= 400 && !IGNORE_URL_RE.test(res.url())) {
        failures.push(`${r.label}: HTTP ${s} ${res.url()}`);
      }
    });

    try {
      await page.goto(`${BASE}${r.url}`, {
        waitUntil: 'networkidle0',
        timeout: 45000,
      });
      // Give DuckDB-WASM + parquet hydration a beat to render sections.
      await new Promise((r) => setTimeout(r, 2500));
    } catch (e) {
      failures.push(`${r.label}: NAV ${e.message}`);
    }
    await page.close();
  }
  await browser.close();

  if (failures.length) {
    console.error('FAILURES:');
    failures.forEach((f) => console.error(' - ' + f));
    process.exit(1);
  }
  console.log(`OK: ${ROUTES.length}/${ROUTES.length} profiles clean`);
  ROUTES.forEach((r) => console.log(`  · ${r.label} → ${r.url}`));
})();
