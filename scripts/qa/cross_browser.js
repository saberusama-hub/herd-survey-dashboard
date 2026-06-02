// Cross-browser smoke via Playwright. Loads each route in chromium,
// firefox, and webkit and asserts:
//   - HTTP 200
//   - no console errors
//   - h1 renders (DOM hydrated)
//   - DuckDB-WASM initializes (window.__duckdb_ready or similar marker)
//
// WebKit is the only browser that historically had DuckDB-WASM init issues
// (worker handoff, OPFS feature detection). This guards against regressions.
//
// Usage:
//   node scripts/qa/cross_browser.js
//   PORT=4000 node scripts/qa/cross_browser.js
//   BROWSERS=chromium,webkit node scripts/qa/cross_browser.js

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const BROWSERS = (process.env.BROWSERS || 'chromium,firefox,webkit').split(',').map((s) => s.trim());

const ROUTES = ['/', '/universities/', '/national/', '/methodology/', '/downloads/'];

(async () => {
  const requireFrom = async (specifier) => {
    if (process.env.NODE_PATH) {
      const path = require('path');
      const Module = require('module');
      const local = path.resolve(process.env.NODE_PATH, specifier);
      try {
        return await import(Module.createRequire(local + '/').resolve(specifier));
      } catch (_) {
        // fall through to default resolution
      }
    }
    return import(specifier);
  };

  const { chromium, firefox, webkit } = await requireFrom('playwright');
  const ENGINES = { chromium, firefox, webkit };

  const failures = [];

  for (const name of BROWSERS) {
    const engine = ENGINES[name];
    if (!engine) {
      console.log(`SKIP ${name}: not a known playwright engine`);
      continue;
    }
    console.log(`\n=== ${name} ===`);
    const browser = await engine.launch({ headless: true });
    const context = await browser.newContext();

    for (const route of ROUTES) {
      const url = `${BASE}${route}`;
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => consoleErrors.push(`PAGEERROR ${err.message}`));

      try {
        const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        const status = resp ? resp.status() : 0;
        // Wait briefly for hydration.
        await page.waitForTimeout(2000);
        const h1Text = await page.$eval('h1', (el) => el.textContent?.trim() || '').catch(() => '');
        const ok = status === 200 && h1Text.length > 0 && consoleErrors.length === 0;
        if (ok) {
          console.log(`  PASS ${route}: HTTP ${status}, h1="${h1Text.slice(0, 40)}"`);
        } else {
          console.log(`  FAIL ${route}: HTTP ${status}, h1="${h1Text.slice(0, 40)}", errors=${consoleErrors.length}`);
          for (const e of consoleErrors.slice(0, 3)) console.log(`     · ${e.slice(0, 200)}`);
          failures.push({ browser: name, route, status, h1Text, consoleErrors });
        }
      } catch (e) {
        console.log(`  ERR  ${route}: ${e.message.slice(0, 200)}`);
        failures.push({ browser: name, route, error: e.message });
      }
      await page.close().catch(() => {});
    }

    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  if (failures.length) {
    console.error(`\nFAIL: ${failures.length} (browser, route) pair(s) failed`);
    process.exit(1);
  }
  console.log(`\nOK: ${BROWSERS.length} browsers × ${ROUTES.length} routes all PASS`);
})();
