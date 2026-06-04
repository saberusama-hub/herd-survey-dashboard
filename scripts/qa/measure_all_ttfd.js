// Cold-load TTFD across every page on the live deploy. Mirrors
// measure_home_ttfd.js but loops every route and writes a summary JSON
// suitable for before/after comparison.
//
// Usage:
//   CHROME_PATH=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
//   node scripts/qa/measure_all_ttfd.js
//
// Output: /tmp/perf-baseline.json (or /tmp/perf-after.json when LABEL=after)

const fs = require('fs');
const path = require('path');

const URL_BASE = process.env.URL_BASE || 'https://herd-survey-dashboard.saber-usama.workers.dev';
const LABEL = process.env.LABEL || 'baseline';
const OUT_PATH = `/tmp/perf-${LABEL}.json`;
const CHROME = process.env.CHROME_PATH;
const RESOLVE_IP = '104.21.35.142'; // bypass *.workers.dev NXDOMAIN
const SAMPLES = Number(process.env.SAMPLES || 3);

// Per route: a CSS selector or arbitrary check that, when satisfied, means
// the page has rendered its first real datum (not a skeleton/placeholder).
const ROUTES = [
  {
    path: '/',
    name: 'home',
    readyCheck: () => {
      for (const el of document.querySelectorAll('.t-num-display, .t-num-tile')) {
        const t = (el.textContent || '').trim();
        if (/\d/.test(t) && !/^[—-]+$/.test(t)) return true;
      }
      return false;
    },
  },
  {
    path: '/universities/',
    name: 'universities',
    // Wait for at least 5 institution rows (the table renders empty header first)
    readyCheck: () => document.querySelectorAll('table tbody tr').length >= 5,
  },
  {
    path: '/national/',
    name: 'national',
    // Wait for first numeric content in any chart-frame area
    readyCheck: () =>
      /\$[0-9.]+\s*[BMK]/.test(document.body.innerText || '') ||
      document.querySelectorAll('svg rect').length > 5,
  },
  {
    path: '/sbir/',
    name: 'sbir',
    readyCheck: () => document.querySelectorAll('table tbody tr').length >= 5,
  },
  {
    path: '/topics/',
    name: 'topics',
    readyCheck: () => document.querySelectorAll('table tbody tr').length >= 5,
  },
  {
    path: '/compare/',
    name: 'compare',
    // No data until user picks; just measure when the picker UI appears
    readyCheck: () =>
      document.querySelectorAll('input[type="search"], select').length > 0 ||
      (document.body.innerText || '').includes('Compare'),
  },
  {
    path: '/universities/INST0000001/',
    name: 'profile-jhu',
    readyCheck: () =>
      /\$[0-9.]+\s*[BMK]/.test(document.body.innerText || '') ||
      document.querySelectorAll('svg').length > 0,
  },
  {
    path: '/sources/',
    name: 'sources',
    readyCheck: () => document.querySelectorAll('h2').length >= 2,
  },
  {
    path: '/methodology/',
    name: 'methodology',
    readyCheck: () => document.querySelectorAll('h2').length >= 2,
  },
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

  const median = (arr) => {
    const xs = arr.filter((x) => x != null).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length / 2)] : null;
  };

  const all = [];

  for (const route of ROUTES) {
    const samples = [];
    for (let i = 0; i < SAMPLES; i++) {
      const page = await browser.newPage();
      await page.setCacheEnabled(false);

      // Marker: window.__ttfd_first_paint flips when route's readyCheck fires.
      await page.evaluateOnNewDocument((checkFnSrc) => {
        window.__ttfd_started = Date.now();
        window.__ttfd_first_data = null;
        // biome-ignore lint/security/noGlobalEval: trusted developer-supplied check
        const fn = new Function(`return (${checkFnSrc})()`);
        const probe = () => {
          if (window.__ttfd_first_data) return;
          try {
            if (fn()) window.__ttfd_first_data = Date.now() - window.__ttfd_started;
          } catch (_) {}
        };
        const obs = new MutationObserver(probe);
        window.addEventListener('DOMContentLoaded', () => {
          obs.observe(document.body, { subtree: true, childList: true, characterData: true });
          probe();
        });
      }, route.readyCheck.toString());

      const url = `${URL_BASE}${route.path}`;
      const tStart = Date.now();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const ttfd = await page
        .waitForFunction(() => window.__ttfd_first_data !== null, { timeout: 30000, polling: 100 })
        .then(() => page.evaluate(() => window.__ttfd_first_data))
        .catch(() => null);

      const totalBytes = await page.evaluate(() => {
        let sum = 0;
        for (const r of performance.getEntriesByType('resource')) sum += r.transferSize || 0;
        return sum;
      });

      const nav = await page.evaluate(() => {
        const t = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        const lcp = performance.getEntriesByType('largest-contentful-paint').slice(-1)[0];
        return {
          dcl: t ? Math.round(t.domContentLoadedEventEnd) : null,
          load: t ? Math.round(t.loadEventEnd) : null,
          fcp: fcp ? Math.round(fcp.startTime) : null,
          lcp: lcp ? Math.round(lcp.startTime) : null,
        };
      });

      samples.push({
        ttfd_ms: ttfd ?? Date.now() - tStart,
        ttfd_timed_out: ttfd === null,
        total_bytes: totalBytes,
        ...nav,
      });
      await page.close();
    }

    const summary = {
      route: route.name,
      path: route.path,
      samples,
      median_ttfd_ms: median(samples.map((s) => s.ttfd_ms)),
      median_fcp_ms: median(samples.map((s) => s.fcp)),
      median_lcp_ms: median(samples.map((s) => s.lcp)),
      median_bytes: median(samples.map((s) => s.total_bytes)),
      any_timeout: samples.some((s) => s.ttfd_timed_out),
    };
    all.push(summary);
    console.log(
      `${route.name.padEnd(14)} ttfd=${String(summary.median_ttfd_ms).padStart(6)}ms  fcp=${String(summary.median_fcp_ms).padStart(5)}ms  bytes=${((summary.median_bytes || 0) / 1024).toFixed(0).padStart(5)}KB${summary.any_timeout ? '  ⚠TIMEOUT' : ''}`,
    );
  }

  await browser.close();
  fs.writeFileSync(OUT_PATH, JSON.stringify({ label: LABEL, url_base: URL_BASE, results: all }, null, 2));
  console.log(`\nWrote ${OUT_PATH}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
