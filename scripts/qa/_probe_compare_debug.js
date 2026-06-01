// Diagnostic: load /compare, type a query, screenshot what's there.
const puppeteer = require('puppeteer-core');

const PORT = process.env.PORT || 3737;
const CHROME =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  const log = (...args) => console.log(...args);

  page.on('pageerror', (e) => log('PAGEERROR', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') log('CONSOLE-ERR', m.text());
    else if (m.type() === 'log') log('CONSOLE-LOG', m.text().slice(0, 200));
  });

  await page.goto(`http://localhost:${PORT}/compare/`, {
    waitUntil: 'networkidle0',
    timeout: 45000,
  });
  await new Promise((r) => setTimeout(r, 4000));

  const inputs = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('input'));
    return all.map((i) => ({
      type: i.type,
      ariaLabel: i.getAttribute('aria-label'),
      placeholder: i.placeholder,
      disabled: i.disabled,
    }));
  });
  log('inputs:', JSON.stringify(inputs, null, 2));

  const input = await page.$('input[aria-label="Search universities to add"]');
  if (!input) {
    log('No search input found');
    await page.screenshot({ path: '/tmp/p6-debug-1.png', fullPage: true });
    await browser.close();
    return;
  }
  await input.focus();
  await page.keyboard.type('Hopkins', { delay: 100 });
  await new Promise((r) => setTimeout(r, 3000));

  const state = await page.evaluate(() => {
    const lb = document.querySelector('ul[role="listbox"]');
    return {
      listboxPresent: !!lb,
      listboxItems: lb ? lb.querySelectorAll('li').length : 0,
      noMatchPara: !!Array.from(document.querySelectorAll('p')).find(
        (p) => /No matches/.test(p.textContent || ''),
      ),
      bodyTextSample: document.body.innerText.slice(0, 1200),
    };
  });
  log('state after type:', JSON.stringify(state, null, 2));

  await page.screenshot({ path: '/tmp/p6-debug-2.png', fullPage: true });
  await browser.close();
})();
