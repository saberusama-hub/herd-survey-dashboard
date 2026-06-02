// Minimal axe runner with hard 20s timeout per route. Used when the full
// axe_audit.js orchestrator wrapper hangs (it sometimes does on this
// filesystem due to DuckDB-WASM worker interaction with axe-core's deep
// DOM walk).
const path = require('path');
const puppeteer = require('puppeteer-core');
const { AxePuppeteer } = require(
  path.resolve(__dirname, '..', '..', 'apps', 'web', 'node_modules', '@axe-core', 'puppeteer'),
);

const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const ROUTES = ['/', '/universities/', '/national/', '/compare/', '/methodology/', '/downloads/'];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-setuid-sandbox'],
  });
  const results = [];
  for (const r of ROUTES) {
    const page = await browser.newPage();
    try {
      await page.goto(`${BASE}${r}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await new Promise((res) => setTimeout(res, 1500));
      const analysis = await Promise.race([
        new AxePuppeteer(page).analyze(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('axe timeout 20s')), 20000)),
      ]);
      const serious = analysis.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
      const mark = serious.length === 0 ? 'PASS' : 'FAIL';
      console.log(`${mark} ${r}: ${serious.length} serious/critical`);
      for (const v of serious) {
        console.log(`   · [${v.impact}] ${v.id} (${v.nodes.length} nodes) — ${v.help}`);
      }
      results.push({ route: r, serious: serious.length, ok: serious.length === 0 });
    } catch (e) {
      console.log(`ERR  ${r}: ${e.message}`);
      results.push({ route: r, error: e.message });
    }
    await page.close().catch(() => {});
  }

  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((r) => setTimeout(r, 3000)),
  ]);

  const failed = results.filter((o) => o.error || (o.serious && o.serious > 0)).length;
  console.log(`\nSummary: ${results.length - failed}/${results.length} clean`);
  process.exit(failed ? 1 : 0);
})();
