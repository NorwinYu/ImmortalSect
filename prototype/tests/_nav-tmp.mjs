import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, hasTouch:true, isMobile:true, deviceScaleFactor:2 });
const page = await ctx.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto('http://127.0.0.1:4322/?demo=1&story=0&intro=0&fresh=1&auto=0', { waitUntil:'load', timeout:150000 });
await page.waitForFunction(() => document.getElementById('loading')?.classList.contains('is-hidden'), null, { timeout:150000 });
await page.waitForTimeout(700);
await page.evaluate(() => window.__sect.gameUi.openPanel(true));
await page.waitForTimeout(2500);
const roster = await page.evaluate(() => ({
  sheetClass: document.querySelector('.sect-sheet')?.className,
  listDisplay: getComputedStyle(document.querySelector('.disciple-list')).display,
  detailDisplay: getComputedStyle(document.querySelector('.disciple-detail')).display,
  cards: document.querySelectorAll('.disciple-card').length,
}));
await page.screenshot({ path:'/tmp/nav-roster.png' });
await page.evaluate(() => document.querySelector('.disciple-card')?.dispatchEvent(new MouseEvent('click',{bubbles:true})));
await page.waitForTimeout(900);
const detail = await page.evaluate(() => ({
  sheetClass: document.querySelector('.sect-sheet')?.className,
  listDisplay: getComputedStyle(document.querySelector('.disciple-list')).display,
  detailDisplay: getComputedStyle(document.querySelector('.disciple-detail')).display,
  backVisible: getComputedStyle(document.querySelector('.detail-back')).display,
  detailScrolls: (()=>{const d=document.querySelector('.disciple-detail'); return d.scrollHeight>d.clientHeight;})(),
}));
await page.screenshot({ path:'/tmp/nav-detail.png' });
await page.evaluate(() => document.querySelector('[data-back]')?.dispatchEvent(new MouseEvent('click',{bubbles:true})));
await page.waitForTimeout(500);
const back = await page.evaluate(() => ({ sheetClass: document.querySelector('.sect-sheet')?.className }));
console.log(JSON.stringify({ roster, detail, back, errs }, null, 1));
await b.close();
