// P9.7 — Accessibility audit via @axe-core/puppeteer.
//
// Runs axe-core against each main route, surfaces serious + critical
// violations only. Logs each violation's id + nodes count. Exits non-zero
// if any serious/critical issues exist.

const path = require('path');
const puppeteer = require('puppeteer-core');
const { AxePuppeteer } = require(
  path.resolve(__dirname, '..', '..', 'apps', 'web', 'node_modules', '@axe-core', 'puppeteer'),
);

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const CHROME =
  process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const ROUTES = [
  '/',
  '/universities/',
  '/national/',
  '/compare/',
  '/methodology/',
  '/downloads/',
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
  });
  const failures = [];

  for (const r of ROUTES) {
    const page = await browser.newPage();
    try {
      await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle0', timeout: 30000 });
      await new Promise((res) => setTimeout(res, 1500));
      const results = await new AxePuppeteer(page).analyze();
      const serious = results.violations.filter((v) =>
        ['serious', 'critical'].includes(v.impact),
      );
      if (serious.length) {
        failures.push({
          route: r,
          count: serious.length,
          violations: serious.map((s) => ({
            id: s.id,
            impact: s.impact,
            nodes: s.nodes.length,
            help: s.help,
          })),
        });
        console.log(`  FAIL ${r}: ${serious.length} serious/critical`);
        for (const v of serious) {
          console.log(`    · [${v.impact}] ${v.id} (${v.nodes.length} nodes) — ${v.help}`);
        }
      } else {
        console.log(`  PASS ${r}: 0 serious/critical`);
      }
    } catch (e) {
      console.log(`  ERR  ${r}: ${e.message}`);
      failures.push({ route: r, error: e.message });
    }
    await page.close();
  }

  await browser.close();

  if (failures.length) {
    console.error(`\nFAIL: ${failures.length} route(s) with violations or errors.`);
    process.exit(1);
  }
  console.log(`\nOK: 0 serious/critical a11y violations across ${ROUTES.length} routes`);
})();
