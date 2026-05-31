// P9.4 — Link integrity crawler.
//
// Loads each main route + 1 sampled profile, scrapes every internal
// `<a href="/...">` link, and visits it once to verify it does NOT
// return a 4xx/5xx status. Internal-only — external links are skipped
// to avoid network flakiness.
//
// Exits non-zero if any internal link returns >= 400.
//
// Pre-requisite: a local server serving the static export at $PORT.

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const CHROME =
  process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Pull one real institution sk for sampling.
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
const sampleSk = institutions[0]?.sk;

const ROOT_ROUTES = [
  '/',
  '/universities/',
  '/national/',
  '/compare/',
  '/methodology/',
  '/downloads/',
];
if (sampleSk) ROOT_ROUTES.push(`/universities/${encodeURIComponent(sampleSk)}/`);

const IGNORE_URL_RE = /\/favicon\.ico$|\/apple-touch-icon.*\.png$/;

(async () => {
  console.log(`Crawling internal links from ${ROOT_ROUTES.length} root routes at ${BASE} ...`);
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
  });

  const visited = new Set();
  const failures = [];

  for (const r of ROOT_ROUTES) {
    const page = await browser.newPage();
    try {
      await page.goto(`${BASE}${r}`, { waitUntil: 'networkidle0', timeout: 30000 });
    } catch (e) {
      failures.push(`${r}: NAV ${e.message}`);
      await page.close();
      continue;
    }

    const links = await page.$$eval('a[href^="/"]', (as) =>
      as.map((a) => a.getAttribute('href')).filter(Boolean),
    );
    // Dedup + filter internals + ignore hash-only.
    for (const raw of links) {
      const l = raw.split('#')[0];
      if (!l || visited.has(l)) continue;
      visited.add(l);
    }
    await page.close();
  }

  // Visit each unique internal link, record the status.
  console.log(`Visiting ${visited.size} unique internal links ...`);
  for (const l of visited) {
    if (IGNORE_URL_RE.test(l)) continue;
    const page = await browser.newPage();
    try {
      const resp = await page.goto(`${BASE}${l}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      const s = resp ? resp.status() : 0;
      if (!resp) failures.push(`${l}: no response`);
      else if (s >= 400) failures.push(`${l}: HTTP ${s}`);
    } catch (e) {
      failures.push(`${l}: ${e.message}`);
    }
    await page.close();
  }

  await browser.close();

  if (failures.length) {
    console.error(`FAIL: ${failures.length} link(s) broken`);
    failures.forEach((f) => console.error(' - ' + f));
    process.exit(1);
  }
  console.log(`OK: ${visited.size} internal links resolve (no 4xx/5xx)`);
})();
