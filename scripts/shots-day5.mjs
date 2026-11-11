// Day 5 delivery screenshots, each framed with an address bar showing the exact URL:
//   node scripts/shots-day5.mjs --base http://localhost:4300 --out <dir> --plan pay     (local: real 4242 test payment)
//   node scripts/shots-day5.mjs --base https://<app>.vercel.app --out <dir> --plan public (no account, no payment)
//   node scripts/shots-day5.mjs --out <dir> --plan page --url https://github.com/<owner>/<repo> --name repo
import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []));
const BASE = (args.base || 'http://localhost:4300').replace(/\/$/, '');
const OUT = path.resolve(args.out || 'shots-day5');
const PLAN = args.plan || 'pay';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function frame(browser, png, url, file, width) {
  const page = await browser.newPage({ viewport: { width: width + 40, height: 900 } });
  const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:20px;background:#d9d2c8;font-family:Segoe UI,Arial,sans-serif}.win{width:${width}px;border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.35);background:#fff}
  .bar{display:flex;align-items:center;gap:12px;height:46px;padding:0 14px;background:#ece7e1;border-bottom:1px solid #cfc6bb}.dots{display:flex;gap:7px}.dots i{width:12px;height:12px;border-radius:50%;display:block}
  .url{flex:1;height:30px;border-radius:15px;background:#fff;border:1px solid #cfc6bb;display:flex;align-items:center;gap:8px;padding:0 14px;font-size:${width < 600 ? 12 : 14}px;color:#222;direction:ltr;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  img{display:block;width:${width}px}</style><div class="win" id="w"><div class="bar"><div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
  <div class="url">${url.startsWith('https') ? '&#128274;' : '&#9432;'} ${esc(url)}</div></div><img src="data:image/png;base64,${png.toString('base64')}"></div>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('#w').screenshot({ path: file });
  await page.close();
}

async function snap(browser, page, name, { width = 1440, full = false } = {}) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(900);
  const png = await page.screenshot({ fullPage: full });
  await frame(browser, png, page.url(), path.join(OUT, name + '.png'), width);
  console.log(`${name}.png  ${page.url()}`);
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

if (PLAN === 'page') {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  await page.goto(args.url, { waitUntil: 'domcontentloaded' });
  await snap(browser, page, args.name || 'page', { full: args.full === '1' });
}

if (PLAN === 'public') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-KW' });
  const page = await ctx.newPage();
  for (const [n, r] of [['V01-home', '/'], ['V02-products-from-db', '/products'], ['V03-product', '/products/awal']]) {
    await page.goto(BASE + r);
    await snap(browser, page, n);
  }
  await page.goto(BASE + '/products/awal');
  await page.waitForLoadState('networkidle');
  await page.locator('.buyrow .btn.primary').click();
  await page.goto(BASE + '/checkout');
  await snap(browser, page, 'V04-checkout-card-test-mode-guest');
  await page.goto(BASE + '/api/health');
  await snap(browser, page, 'V05-health-payments-ready');
  const phone = await browser.newContext({ ...devices['Pixel 7'], locale: 'ar-KW' });
  const m = await phone.newPage();
  await m.goto(BASE + '/');
  await snap(browser, m, 'V06-phone-home', { width: 430 });
  await m.goto(BASE + '/products/awal');
  await snap(browser, m, 'V07-phone-product', { width: 430 });
}

if (PLAN === 'pay') {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-KW' });
  const page = await ctx.newPage();
  const email = `sara.pay.${Date.now()}@example.test`;
  await page.goto(BASE + '/signup');
  await page.fill('#an', 'سارة');
  await page.fill('#ae', email);
  await page.fill('#ap', 'Wasmi-demo-2026!');
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/signup')), page.locator('[data-testid=signup-form] button[type=submit]').click()]);
  for (const slug of ['awal', 'ghubar']) {
    await page.goto(BASE + '/products/' + slug);
    await page.waitForLoadState('networkidle');
    await page.locator('.buyrow .btn.primary').click();
  }
  await page.goto(BASE + '/cart');
  await snap(browser, page, 'S01-cart');
  await page.goto(BASE + '/checkout');
  await page.fill('#fn', 'سارة العلي');
  await page.fill('#fp', '99887766');
  await page.fill('#fa', 'السالمية');
  await page.fill('#fad', 'قطعة 2، شارع 10، منزل 5');
  await snap(browser, page, 'S02-checkout-pay-by-card-test-mode');
  await Promise.all([page.waitForURL(/checkout\.stripe\.com/, { timeout: 60000 }), page.getByTestId('checkout-submit').click()]);
  await page.locator('#cardNumber, [data-testid="card-accordion-item-button"]').first().waitFor({ state: 'attached', timeout: 45000 });
  if (!(await page.locator('#cardNumber').isVisible())) await page.locator('[data-testid="card-accordion-item-button"]').first().dispatchEvent('click');
  await page.locator('#cardNumber').fill('4242 4242 4242 4242');
  await page.locator('#cardExpiry').fill('12 / 34');
  await page.locator('#cardCvc').fill('123');
  if (await page.locator('#billingName').isVisible().catch(() => false)) await page.fill('#billingName', 'Sara Test');
  await snap(browser, page, 'S03-stripe-sandbox-checkout-4242');
  await page.locator('[data-testid="hosted-payment-submit-button"]').click();
  await page.waitForURL(/\/checkout\/success\?session_id=/, { timeout: 90000 });
  await page.getByTestId('paid-title').waitFor({ timeout: 40000 });
  await snap(browser, page, 'S04-payment-success-paid');
  await page.goto(BASE + '/orders');
  await snap(browser, page, 'S05-my-orders-paid-via-stripe');
  await page.goto(BASE + '/checkout/cancel');
  await snap(browser, page, 'S06-cancel-page');
}

await browser.close();
