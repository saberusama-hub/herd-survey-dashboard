// Measure homepage time-to-first-data: clears cache, loads /, records when
// the first KPI tile gains a non-placeholder value.
//
// Usage:
//   CHROME_PATH=/path/to/chrome node scripts/qa/measure_home_ttfd.js [URL]
//
// Default URL is the live production deploy. Pass a local URL (e.g.
// http://localhost:3000/) to measure local builds.

const URL_ARG = process.argv[2] || 'https://herd-survey-dashboard.saber-usama.workers.dev/';

(async () => {
  const path = require('path');
  process.env.NODE_PATH = path.resolve(__dirname, '../../node_modules');
  require('module').Module._initPaths();
  const puppeteer = require('puppeteer-core');

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1440, height: 900 },
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--host-resolver-rules=MAP herd-survey-dashboard.saber-usama.workers.dev 104.21.35.142',
    ],
  });

  const samples = [];
  const N = Number(process.env.SAMPLES || 3);

  for (let i = 0; i < N; i++) {
    const page = await browser.newPage();
    // Disable any prior cache for cold-start measurement.
    await page.setCacheEnabled(false);

    const start = Date.now();

    // Inject a marker that flips when the first real KPI number appears.
    // The hero marquee renders "$X.XB" once kpis state is set. We watch for
    // any element matching `.t-num-display` whose textContent matches /\d/.
    await page.evaluateOnNewDocument(() => {
      window.__ttfd_started = Date.now();
      window.__ttfd_first_number = null;
      const check = () => {
        if (window.__ttfd_first_number) return;
        for (const el of document.querySelectorAll('.t-num-display, .t-num-tile')) {
          const t = (el.textContent || '').trim();
          if (/\d/.test(t) && !/^[—-]+$/.test(t)) {
            window.__ttfd_first_number = Date.now() - window.__ttfd_started;
            return;
          }
        }
      };
      const observer = new MutationObserver(() => check());
      window.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
        });
        check();
      });
    });

    await page.goto(URL_ARG, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait up to 30s for the marker to flip.
    const ttfd = await page
      .waitForFunction(() => window.__ttfd_first_number !== null, { timeout: 30000, polling: 100 })
      .then(() => page.evaluate(() => window.__ttfd_first_number))
      .catch(() => null);

    const navTiming = await page.evaluate(() => {
      const t = performance.getEntriesByType('navigation')[0];
      const lcp = performance.getEntriesByType('largest-contentful-paint').slice(-1)[0];
      return {
        domContentLoaded: t ? Math.round(t.domContentLoadedEventEnd) : null,
        load: t ? Math.round(t.loadEventEnd) : null,
        firstPaint: performance.getEntriesByName('first-paint')[0]
          ? Math.round(performance.getEntriesByName('first-paint')[0].startTime)
          : null,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]
          ? Math.round(performance.getEntriesByName('first-contentful-paint')[0].startTime)
          : null,
        lcp: lcp ? Math.round(lcp.startTime) : null,
      };
    });

    const totalBytes = await page.evaluate(() => {
      let sum = 0;
      for (const r of performance.getEntriesByType('resource')) {
        sum += r.transferSize || 0;
      }
      return sum;
    });

    samples.push({ ttfd_ms: ttfd, total_bytes: totalBytes, ...navTiming });
    await page.close();
  }

  await browser.close();

  // Summary
  const median = (arr) => {
    const xs = arr.filter((x) => x != null).sort((a, b) => a - b);
    return xs.length ? xs[Math.floor(xs.length / 2)] : null;
  };
  console.log(`\nURL: ${URL_ARG}`);
  console.log(`Samples: ${N}\n`);
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    console.log(
      `  run ${i + 1}: ttfd=${s.ttfd_ms}ms · fcp=${s.firstContentfulPaint}ms · lcp=${s.lcp}ms · bytes=${(s.total_bytes / 1024).toFixed(0)} KB`,
    );
  }
  console.log('\n  MEDIAN ttfd  :', median(samples.map((s) => s.ttfd_ms)) + 'ms');
  console.log('  MEDIAN fcp   :', median(samples.map((s) => s.firstContentfulPaint)) + 'ms');
  console.log('  MEDIAN lcp   :', median(samples.map((s) => s.lcp)) + 'ms');
  console.log('  MEDIAN bytes :', (median(samples.map((s) => s.total_bytes)) / 1024).toFixed(0) + ' KB');

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
