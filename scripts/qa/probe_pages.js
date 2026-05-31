// P9.1 — Main page-probe.
//
// Loads every main route + 5 sampled /universities/<sk> profiles at 4 viewport
// sizes (mobile/tablet/desktop/wide), captures:
//   - pageerror events
//   - console error messages
//   - failed network requests (4xx/5xx, ignoring favicon)
//   - horizontal-scroll overflow (documentElement.scrollWidth > innerWidth + 1)
//
// Writes per-(route × viewport) fullPage screenshots to qa-screens/
// and a JSON report to qa-probe-report.json. Exits non-zero if any failure.
//
// Pre-requisite: a local server serving the static export at $PORT
// (default 3000). E.g.  python3 -m http.server -d apps/web/out 3000 &

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const CHROME =
  process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const STATIC_ROUTES = [
  '/',
  '/universities/',
  '/national/',
  '/compare/',
  '/methodology/',
  '/downloads/',
];

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
// Spread sample across the index space.
const SAMPLE_IDX = [0, 100, 300, 500, 700].map((i) => Math.min(i, last));
const SAMPLE = SAMPLE_IDX.map((i) => institutions[i]).filter(
  (v, i, a) => a.findIndex((x) => x.sk === v.sk) === i,
);

const ROUTES = [
  ...STATIC_ROUTES,
  ...SAMPLE.map((i) => `/universities/${encodeURIComponent(i.sk)}/`),
];

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'wide', width: 1920, height: 1080 },
];

const IGNORE_URL_RE = /\/favicon\.ico$|\/apple-touch-icon.*\.png$/;

function safeName(route) {
  const stripped = route.replace(/^\/|\/$/g, '');
  return stripped.replace(/\//g, '_') || 'root';
}

(async () => {
  const outDir = path.resolve(__dirname, '..', '..', 'qa-screens');
  fs.mkdirSync(outDir, { recursive: true });

  console.log(
    `Probing ${ROUTES.length} routes × ${VIEWPORTS.length} viewports = ${
      ROUTES.length * VIEWPORTS.length
    } combinations at ${BASE} ...`,
  );

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
  });

  const allFailures = [];
  let okCount = 0;

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });
      const failures = [];

      page.on('pageerror', (err) =>
        failures.push(`PAGEERROR ${err.message}`),
      );
      page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        const loc = msg.location && msg.location();
        if (loc && loc.url && IGNORE_URL_RE.test(loc.url)) return;
        const text = msg.text();
        if (/favicon\.ico/.test(text)) return;
        failures.push(`CONSOLE ${text}`);
      });
      page.on('requestfailed', (req) => {
        if (IGNORE_URL_RE.test(req.url())) return;
        failures.push(
          `REQ-FAIL ${req.url()} ${req.failure()?.errorText || ''}`,
        );
      });
      page.on('response', (res) => {
        const s = res.status();
        if (s >= 400 && !IGNORE_URL_RE.test(res.url())) {
          failures.push(`HTTP ${s} ${res.url()}`);
        }
      });

      try {
        await page.goto(`${BASE}${route}`, {
          waitUntil: 'networkidle0',
          timeout: 45000,
        });
        // Wait for chart hydration.
        await new Promise((r) => setTimeout(r, 2500));

        // Horizontal-overflow check.
        const overflow = await page.evaluate(() => {
          const sw = document.documentElement.scrollWidth;
          const iw = window.innerWidth;
          return sw > iw + 1 ? { sw, iw } : null;
        });
        if (overflow) {
          failures.push(
            `OVERFLOW scrollWidth=${overflow.sw} > innerWidth=${overflow.iw} at ${vp.name} (${vp.width}px)`,
          );
        }

        const file = path.join(outDir, `${safeName(route)}__${vp.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
      } catch (e) {
        failures.push(`NAV ${e.message}`);
      }

      if (failures.length) {
        allFailures.push({ route, viewport: vp.name, failures });
      } else {
        okCount += 1;
      }
      await page.close();
    }
  }

  await browser.close();

  const reportPath = path.resolve(__dirname, '..', '..', 'qa-probe-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        runAt: new Date().toISOString(),
        baseUrl: BASE,
        routes: ROUTES,
        viewports: VIEWPORTS.map((v) => v.name),
        sampleInstitutions: SAMPLE.map((i) => ({ sk: i.sk, name: i.name })),
        ok: okCount,
        fail: allFailures.length,
        failures: allFailures,
      },
      null,
      2,
    ),
  );

  console.log(`OK: ${okCount} / ${ROUTES.length * VIEWPORTS.length} clean`);
  if (allFailures.length) {
    console.error(`FAIL: ${allFailures.length} groups — see ${reportPath}`);
    process.exit(1);
  }
  console.log(`Report: ${reportPath}`);
})();
