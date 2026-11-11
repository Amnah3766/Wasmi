// Delivery screenshots: each page is captured with Playwright, then placed inside a simple browser frame whose
// address bar shows the exact URL (so every screenshot proves where it was taken).
//   node scripts/shots.mjs --base https://<site>.netlify.app --out ../Wasmi-Day4-Submission/screenshots/live --plan live
//   node scripts/shots.mjs --base http://localhost:4300 --out …/screenshots/local --plan local   (creates 2 demo accounts)
// The local plan writes the demo logins to demo-accounts.local.txt (git-ignored, never shipped).
import { chromium, devices } from '@playwright/test';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const BASE = (args.base || 'http://localhost:4300').replace(/\/$/, '');
const OUT = path.resolve(args.out || 'shots');
const PLAN = args.plan || 'live';
const PIN = process.env.LIVE_IP ? [`--host-resolver-rules=MAP ${new URL(BASE).hostname} ${process.env.LIVE_IP}`] : [];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function frame(browser, png, url, file, mobile) {
  const width = mobile ? 430 : 1440;
  const page = await browser.newPage({ viewport: { width: width + 40, height: 900 }, deviceScaleFactor: 1 });
  const b64 = png.toString('base64');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:20px;background:#d9d2c8;font-family:Segoe UI,Arial,sans-serif}
    .win{width:${width}px;border-radius:12px;overflow:hidden;box-shadow:0 18px 50px rgba(0,0,0,.35);background:#fff}
    .bar{display:flex;align-items:center;gap:12px;height:46px;padding:0 14px;background:#ece7e1;border-bottom:1px solid #cfc6bb}
    .dots{display:flex;gap:7px}.dots i{width:12px;height:12px;border-radius:50%;display:block}
    .url{flex:1;height:30px;border-radius:15px;background:#fff;border:1px solid #cfc6bb;display:flex;align-items:center;gap:8px;padding:0 14px;
      font-size:${mobile ? 12 : 14}px;color:#222;direction:ltr;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .lock{color:#1a7f37;font-size:13px}
    img{display:block;width:${width}px}
  </style></head><body><div class="win" id="w"><div class="bar"><div class="dots"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></div>
  <div class="url"><span class="lock">${url.startsWith('https') ? '&#128274;' : '&#9432;'}</span>${esc(url)}</div></div>
  <img src="data:image/png;base64,${b64}"></div></body></html>`;
  await page.setContent(html, { waitUntil: 'load' });
  await page.locator('#w').screenshot({ path: file });
  await page.close();
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(900); // page entrance animation (.45 s) + fonts
}

async function shoot(browser, ctx, name, route, { mobile = false, full = false, before } = {}) {
  const page = await ctx.newPage();
  const res = await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
  await settle(page);
  if (before) await before(page);
  const png = await page.screenshot({ fullPage: full });
  const file = path.join(OUT, name + '.png');
  await frame(browser, png, page.url(), file, mobile);
  console.log(`${name}.png  ${res?.status()}  ${page.url()}`);
  await page.close();
}

const DEMO_PASS = 'Wasmi-demo-2026!';

async function signup(ctx, name, email) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/signup');
  await page.fill('#an', name);
  await page.fill('#ae', email);
  await page.fill('#ap', DEMO_PASS);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/signup')), page.locator('[data-testid=signup-form] button[type=submit]').click()]);
  await page.close();
}

async function placeOrder(ctx, lines, delivery) {
  const page = await ctx.newPage();
  await page.goto(BASE + '/');
  const r = await page.request.post(BASE + '/api/orders', { data: { lines, delivery, payment: 'cod', promo: '' } });
  const { order } = await r.json();
  await page.close();
  return order;
}

const browser = await chromium.launch({ args: PIN });
await mkdir(OUT, { recursive: true });
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-KW', colorScheme: 'light' });
const phone = await browser.newContext({ ...devices['Pixel 7'], locale: 'ar-KW', colorScheme: 'light' });

const PUBLIC = [
  ['01-home', '/'],
  ['02-products-from-db', '/products'],
  ['03-product-awal', '/products/awal'],
  ['04-finder', '/finder'],
  ['05-gift', '/gift'],
  ['06-story', '/story'],
  ['07-contact', '/contact'],
  ['08-login', '/login'],
  ['09-signup', '/signup'],
  ['10-orders-protected-redirect', '/orders'],
  ['11-product-404', '/products/no-such-scent'],
];

if (PLAN === 'live' || PLAN === 'public') {
  for (const [n, r] of PUBLIC) await shoot(browser, desk, n, r);
  await shoot(browser, desk, '12-home-full', '/', { full: true });
  for (const [n, r] of [['m01-home', '/'], ['m02-products', '/products'], ['m03-product', '/products/awal']]) await shoot(browser, phone, n, r, { mobile: true });
  await shoot(browser, desk, '13-checkout-guest-must-login', '/checkout', {
    before: async (page) => {
      await page.goto(BASE + '/products/awal');
      await settle(page);
      await page.locator('.buyrow .btn.primary').click();
      await page.goto(BASE + '/checkout');
      await settle(page);
    },
  });
}

if (PLAN === 'local') {
  const stamp = Date.now();
  const A = { name: 'سارة', email: `sara.demo.${stamp}@example.test` };
  const B = { name: 'فهد', email: `fahad.demo.${stamp}@example.test` };
  const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-KW', colorScheme: 'light' });
  const ctxB = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ar-KW', colorScheme: 'light' });
  await signup(ctxA, A.name, A.email);
  await signup(ctxB, B.name, B.email);
  await appendFile('demo-accounts.local.txt', `${new Date().toISOString()}  ${A.email} / ${B.email}  password: ${DEMO_PASS}\n`);

  await shoot(browser, ctxA, 'L01-signed-in-name-in-nav', '/');
  // Checkout through the real UI → confirmation after the server saved the order.
  await shoot(browser, ctxA, 'L02-checkout-signed-in', '/checkout', {
    before: async (page) => {
      for (const s of ['awal', 'ghubar']) {
        await page.goto(BASE + '/products/' + s);
        await settle(page);
        await page.locator('.buyrow .btn.primary').click();
      }
      await page.goto(BASE + '/checkout');
      await settle(page);
      await page.fill('#fn', 'سارة العلي');
      await page.fill('#fp', '99887766');
      await page.fill('#fa', 'السالمية');
      await page.fill('#fad', 'قطعة 2، شارع 10، منزل 5');
    },
  });
  await shoot(browser, ctxA, 'L03-order-confirmed-after-save', '/checkout', {
    before: async (page) => {
      await page.fill('#fn', 'سارة العلي');
      await page.fill('#fp', '99887766');
      await page.fill('#fa', 'السالمية');
      await page.fill('#fad', 'قطعة 2، شارع 10، منزل 5');
      await Promise.all([page.waitForURL(/\/orders\/[a-f0-9]{24}\?placed=1/), page.locator('#coForm button[type=submit]').click()]);
      await settle(page);
    },
  });
  const orderB = await placeOrder(ctxB, [{ t: 'b', ids: ['awal', 'ghubar', 'ghaim'], note: 'مبروك', q: 1 }], { name: 'فهد', phone: '99001122', area: 'حولي', address: 'قطعة 1، شارع 3' });
  await shoot(browser, ctxA, 'L04-my-orders-user-A', '/orders');
  await shoot(browser, ctxB, 'L05-my-orders-user-B', '/orders');
  await shoot(browser, ctxA, 'L06-user-A-opens-B-order-404', '/orders/' + orderB.id);
  await shoot(browser, ctxA, 'L07-review-form-signed-in', '/products/ghaim', {
    before: async (page) => page.locator('#reviews').scrollIntoViewIfNeeded(),
  });
  await writeFile(path.join(OUT, 'accounts-used.txt'), `User A: ${A.email}\nUser B: ${B.email}\n(throwaway demo accounts on @example.test; password not included)\n`);
  await ctxA.close();
  await ctxB.close();
}

await browser.close();
