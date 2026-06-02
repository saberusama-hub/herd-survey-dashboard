// Lighthouse-in-CI runner with hard thresholds. Runs against the static
// export served on $PORT (default 3000). Fails the job if any score on any
// audited route drops below threshold.
//
// Dynamically imports lighthouse (ESM) and chrome-launcher.
//
// Usage:
//   node scripts/qa/lighthouse_ci.js
//   PORT=4000 node scripts/qa/lighthouse_ci.js
//   THRESH_PERFORMANCE=0.8 ... overrides per category

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;

// Per-category minimum scores (0-1). Tune as the app matures.
// Lighthouse uses simulated mobile throttling — these need to be realistic
// for a parquet-bundle dashboard on slow-4G.
const THRESHOLDS = {
  performance: Number(process.env.THRESH_PERFORMANCE ?? 0.5),
  accessibility: Number(process.env.THRESH_ACCESSIBILITY ?? 0.9),
  'best-practices': Number(process.env.THRESH_BEST_PRACTICES ?? 0.9),
  seo: Number(process.env.THRESH_SEO ?? 0.9),
};

// Routes that get audited. Profile route is sampled via dim_institution.json.
const ROUTES = ['/', '/national/', '/methodology/', '/downloads/'];

(async () => {
  // Allow NODE_PATH-style resolution when installed to a sidecar dir.
  const requireFrom = (specifier) => {
    if (process.env.NODE_PATH) {
      const path = require('path');
      const Module = require('module');
      const local = path.resolve(process.env.NODE_PATH, specifier);
      try {
        return import(Module.createRequire(local + '/').resolve(specifier));
      } catch (_) {
        // fall through
      }
    }
    return import(specifier);
  };

  const lhMod = await requireFrom('lighthouse');
  const chromeLauncher = await requireFrom('chrome-launcher');
  const lighthouse = lhMod.default || lhMod;

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const opts = {
    logLevel: 'error',
    output: 'json',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
    formFactor: 'mobile',
    throttlingMethod: 'simulate',
  };

  const failures = [];

  for (const route of ROUTES) {
    const url = `${BASE}${route}`;
    process.stdout.write(`Lighthouse: ${route} ... `);
    try {
      const runnerResult = await lighthouse(url, opts);
      const cats = runnerResult.lhr.categories;
      const scores = Object.fromEntries(
        Object.entries(cats).map(([key, v]) => [key, v.score == null ? null : v.score]),
      );
      const failedHere = [];
      for (const [cat, threshold] of Object.entries(THRESHOLDS)) {
        const got = scores[cat];
        if (got == null) continue;
        if (got < threshold) failedHere.push(`${cat}=${(got * 100).toFixed(0)}<${(threshold * 100).toFixed(0)}`);
      }
      const summary = Object.entries(scores)
        .map(([cat, s]) => `${cat[0].toUpperCase()}=${s == null ? '—' : (s * 100).toFixed(0)}`)
        .join(' ');
      if (failedHere.length) {
        console.log(`FAIL ${summary} (below: ${failedHere.join(', ')})`);
        failures.push({ route, scores, failedHere });
      } else {
        console.log(`PASS ${summary}`);
      }
    } catch (e) {
      console.log(`ERR ${e.message}`);
      failures.push({ route, error: e.message });
    }
  }

  await chrome.kill();

  if (failures.length) {
    console.error(`\nFAIL: ${failures.length} route(s) below threshold`);
    for (const f of failures) {
      console.error(`  ${f.route}: ${f.error || f.failedHere.join(', ')}`);
    }
    process.exit(1);
  }
  console.log(`\nOK: ${ROUTES.length} routes above thresholds`);
})();
