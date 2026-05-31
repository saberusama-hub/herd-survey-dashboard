const puppeteer = require('puppeteer-core');

// NOTE: institution SKs are strings like INST0000001 (not numeric).
// The plan's example used `/universities/1` — adjusted to a real SK.
const ROUTES = [
  '/',
  '/universities',
  '/universities/INST0000001',
  '/national',
  '/compare',
  '/methodology',
  '/downloads',
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
  });
  const failures = [];
  for (const route of ROUTES) {
    const page = await browser.newPage();
    page.on('pageerror', (err) => failures.push(`${route}: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') failures.push(`${route}: ${msg.text()}`);
    });
    // Ignore harmless browser auto-fetches that are independent of page logic.
    const IGNORE_URL_RE = /\/favicon\.ico$|\/apple-touch-icon.*\.png$/;
    page.on('requestfailed', (req) => {
      if (IGNORE_URL_RE.test(req.url())) return;
      failures.push(`${route}: REQ-FAIL ${req.url()} ${req.failure()?.errorText || ''}`);
    });
    page.on('response', (res) => {
      const s = res.status();
      if (s >= 400 && !IGNORE_URL_RE.test(res.url())) {
        failures.push(`${route}: HTTP ${s} ${res.url()}`);
      }
    });
    // Filter pageerror/console messages that are just the favicon-404 surfacing.
    const consoleHandler = (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      const loc = msg.location?.() || {};
      if (loc.url && IGNORE_URL_RE.test(loc.url)) return;
      if (/favicon\.ico/.test(text)) return;
      failures.push(`${route}: ${text}`);
    };
    page.removeAllListeners('console');
    page.on('console', consoleHandler);
    try {
      await page.goto(`http://localhost:3000${route}`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
    } catch (e) {
      failures.push(`${route}: ${e.message}`);
    }
    await page.close();
  }
  await browser.close();
  if (failures.length) {
    console.error('FAILURES:');
    failures.forEach((f) => console.error(' - ' + f));
    process.exit(1);
  }
  console.log(`OK: ${ROUTES.length} routes clean`);
})();
