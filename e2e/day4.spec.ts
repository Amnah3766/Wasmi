// Day 4 requirements, end to end, on the REAL Atlas database (local production build).
import { expect, test } from '@playwright/test';
import mongoose from 'mongoose';
import { addFromProductPage, connectTestDb, expectSignedInName, fillCheckout, loginUI, logoutUI, PASSWORD, signupUI, trackErrors, uniqueEmail } from './helpers';

const AWAL_TOTAL = '11.000 د.ك'; // 9.500 (220 g candle) + 1.500 delivery under 25 KWD

test.describe('accounts', () => {
  test('sign up → name in the menu → log out → log in', async ({ page }, info) => {
    const errors = trackErrors(page);
    const email = uniqueEmail(info, 'auth');
    const name = 'نورة ' + info.project.name;
    await signupUI(page, name, email);
    await expect(page).toHaveURL(/\/orders$/);
    await expect(page.getByTestId('orders-empty')).toBeVisible();
    await expectSignedInName(page, info, name);

    await logoutUI(page, info);
    await page.goto('/');
    await expect(page.getByTestId('nav-user')).toHaveCount(0);
    if (info.project.name === 'desktop') await expect(page.locator('.acct-in')).toBeVisible();

    await loginUI(page, email, '/products');
    await expect(page).toHaveURL(/\/products$/);
    await expectSignedInName(page, info, name);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('passwords are stored as bcrypt hashes ($2b$12$), never returned', async ({ page, request }, info) => {
    const email = uniqueEmail(info, 'hash');
    const res = await request.post('/api/auth/signup', { data: { name: 'هاش', email, password: PASSWORD } });
    expect(res.status()).toBe(201);
    const body = await res.text();
    expect(body).not.toContain('passwordHash');
    expect(body).not.toContain('$2');
    const cookie = res.headers()['set-cookie'] ?? '';
    expect(cookie).toMatch(/wasmi_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    const db = await connectTestDb();
    try {
      const doc = await db.collection('users').findOne({ email });
      expect(doc?.passwordHash).toMatch(/^\$2b\$12\$/);
      expect(doc?.passwordHash).not.toContain(PASSWORD);
    } finally {
      await mongoose.disconnect();
    }
    void page;
  });

  test('API validation codes: 400 / 409 / 401', async ({ request }, info) => {
    const bad = await request.post('/api/auth/signup', { data: { name: '', email: 'nope', password: '123' } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).fields).toMatchObject({ name: 'required', email: 'invalid', password: 'tooShort' });
    const email = uniqueEmail(info, 'dup');
    expect((await request.post('/api/auth/signup', { data: { name: 'أول', email, password: PASSWORD } })).status()).toBe(201);
    const dup = await request.post('/api/auth/signup', { data: { name: 'ثاني', email: email.toUpperCase(), password: PASSWORD } });
    expect(dup.status()).toBe(409);
    const wrong = await request.post('/api/auth/login', { data: { email, password: 'wrong-password' } });
    expect(wrong.status()).toBe(401);
    const unknown = await request.post('/api/auth/login', { data: { email: 'nobody.' + email, password: PASSWORD } });
    expect(unknown.status()).toBe(401);
  });
});

test.describe('protection', () => {
  test('signed out: pages 307 → /login, API 401', async ({ request }) => {
    const page = await request.get('/orders', { maxRedirects: 0 });
    expect(page.status()).toBe(307);
    expect(page.headers()['location']).toContain('/login?next=%2Forders');
    const detail = await request.get('/orders/0123456789abcdef01234567', { maxRedirects: 0 });
    expect(detail.status()).toBe(307);
    expect((await request.get('/api/orders')).status()).toBe(401);
    expect((await request.get('/api/orders/0123456789abcdef01234567')).status()).toBe(401);
    expect((await request.post('/api/orders', { data: { lines: [{ t: 'p', id: 'awal', vi: 1, q: 1 }] } })).status()).toBe(401);
    expect((await request.get('/api/auth/me')).status()).toBe(401);
  });

  test('next= only redirects inside the site', async ({ page }, info) => {
    const email = uniqueEmail(info, 'next');
    await signupUI(page, 'تحويل', email);
    await logoutUI(page, info);
    await page.goto('/login?next=' + encodeURIComponent('//evil.example/x'));
    await page.fill('#ae', email);
    await page.fill('#ap', PASSWORD);
    await page.getByTestId('login-form').locator('button[type=submit]').click();
    await expect(page).toHaveURL(/localhost:\d+\/orders$/);
  });
});

test.describe('checkout', () => {
  test('guest checkout asks to sign in and saves nothing', async ({ page }) => {
    await addFromProductPage(page, 'awal');
    await page.goto('/checkout');
    await expect(page.getByTestId('login-required')).toContainText('سجّل دخولك عشان ينحفظ طلبك');
    await fillCheckout(page);
    let posted = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/orders') && r.method() === 'POST') posted = true;
    });
    await page.locator('#coForm button[type=submit]').click();
    await expect(page.locator('.authnote.on')).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    expect(posted).toBe(false);
  });

  test('signed in: order is saved first, then confirmed; the server sets prices and the user', async ({ page }, info) => {
    const errors = trackErrors(page);
    await signupUI(page, 'سارة ' + info.project.name, uniqueEmail(info, 'order'));
    await addFromProductPage(page, 'awal');
    await page.goto('/checkout');
    await expect(page.getByTestId('checkout-total')).toHaveText(AWAL_TOTAL);
    await fillCheckout(page);
    await page.check('input[name=pay][value=cod]'); // Day 4 path: cash on delivery → POST /api/orders (pending)

    // Tamper with the request like a malicious browser would: fake prices, totals and someone else's user id.
    await page.route('**/api/orders', async (route) => {
      const req = route.request();
      if (req.method() !== 'POST') return route.continue();
      const body = req.postDataJSON();
      body.total = 0.001;
      body.subtotal = 0.001;
      body.user = '0123456789abcdef01234567';
      body.userId = '0123456789abcdef01234567';
      body.lines = body.lines.map((l: Record<string, unknown>) => ({ ...l, price: 0.001, unit: 0.001 }));
      await route.continue({ postData: JSON.stringify(body) });
    });
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST'),
      page.locator('#coForm button[type=submit]').click(),
    ]);
    expect(resp.status()).toBe(201);
    const { order } = await resp.json();
    expect(order.total).toBe(11);
    expect(order.items[0].price).toBe(9.5);

    await expect(page).toHaveURL(new RegExp('/orders/' + order.id + '\\?placed=1$'));
    await expect(page.getByTestId('order-no')).toHaveText(order.orderNo);
    await expect(page.getByTestId('order-total')).toHaveText(AWAL_TOTAL);
    await expect(page.locator('#cartN')).toBeHidden(); // cart cleared only after the save

    const api = await page.request.get('/api/orders/' + order.id);
    expect(api.status()).toBe(200);
    expect((await api.json()).order.total).toBe(11);
    await page.goto('/orders');
    await expect(page.getByTestId('orders-list')).toContainText(order.orderNo);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('gift box + promo are priced by the server', async ({ page }, info) => {
    await signupUI(page, 'هدية', uniqueEmail(info, 'box'));
    const res = await page.request.post('/api/orders', {
      data: {
        lines: [{ t: 'b', ids: ['awal', 'ghubar', 'ghaim'], note: 'مبروك', q: 1, price: 0 }],
        promo: 'wasmi10',
        delivery: { name: 'سارة الاختبار', phone: '99887766', area: 'السالمية', address: 'قطعة 2 شارع 10' },
        payment: 'link',
        total: 0,
      },
    });
    expect(res.status()).toBe(201);
    const { order } = await res.json();
    // (9.500 + 18.000 + 14.000) × 0.85 = 35.275 → 35.25 ; −10 % = 3.525 → 3.530 (10-fils step) ; total 31.720 ; ≥ 25 → free delivery
    expect(order.items[0].price).toBe(35.25);
    expect(order.discount).toBe(3.53);
    expect(order.shipping).toBe(0);
    expect(order.total).toBe(31.72);
    expect(order.promoCode).toBe('WASMI10');
  });

  test('bad order input → 400', async ({ page }, info) => {
    await signupUI(page, 'مدخلات', uniqueEmail(info, 'bad'));
    const r1 = await page.request.post('/api/orders', { data: { lines: [{ t: 'p', id: 'not-a-product', vi: 0, q: 1 }], delivery: { name: 'سارة', phone: '99887766', area: 'x', address: 'عنوان طويل' } } });
    expect(r1.status()).toBe(400);
    const r2 = await page.request.post('/api/orders', { data: { lines: [{ t: 'p', id: 'awal', vi: 1, q: 1 }], delivery: { name: 'س', phone: '12', area: '', address: '' } } });
    expect(r2.status()).toBe(400);
    expect(Object.keys((await r2.json()).fields)).toEqual(expect.arrayContaining(['name', 'phone', 'area', 'address']));
    const r3 = await page.request.post('/api/orders', { headers: { 'content-type': 'application/json' }, data: '{not json' });
    expect(r3.status()).toBe(400);
  });
});

test.describe('two accounts', () => {
  test('each user sees only their own orders; another user’s order is 404', async ({ browser }, info) => {
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pa = await a.newPage();
    const pb = await b.newPage();
    try {
      await signupUI(pa, 'حساب أ', uniqueEmail(info, 'a'));
      const created = await pa.request.post('/api/orders', {
        data: { lines: [{ t: 'p', id: 'fajr', vi: 0, q: 2 }], delivery: { name: 'حساب أ', phone: '99001122', area: 'حولي', address: 'قطعة 1 شارع 1' }, payment: 'cod' },
      });
      expect(created.status()).toBe(201);
      const orderA = (await created.json()).order;

      await signupUI(pb, 'حساب ب', uniqueEmail(info, 'b'));
      await pb.goto('/orders');
      await expect(pb.getByTestId('orders-empty')).toBeVisible();
      await expect(pb.locator('body')).not.toContainText(orderA.orderNo);
      const listB = await pb.request.get('/api/orders');
      expect((await listB.json()).orders).toEqual([]);

      const pageResp = await pb.goto('/orders/' + orderA.id);
      expect(pageResp?.status()).toBe(404);
      expect((await pb.request.get('/api/orders/' + orderA.id)).status()).toBe(404);

      // …and A still sees it.
      await pa.goto('/orders');
      await expect(pa.getByTestId('orders-list')).toContainText(orderA.orderNo);
      expect((await pa.request.get('/api/orders/' + orderA.id)).status()).toBe(200);
    } finally {
      await a.close();
      await b.close();
    }
  });
});

test.describe('catalog from MongoDB', () => {
  test('a price edited directly in Atlas shows after a refresh', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one run is enough (shared DB document)');
    const products = (await connectTestDb()).collection('products');
    const before = await products.findOne({ slug: 'jumaa' });
    expect(before?.price).toBeGreaterThan(0);
    try {
      await page.goto('/products/jumaa');
      await expect(page.getByTestId('pdp-price')).toHaveText(before!.price.toFixed(3) + ' د.ك');
      await products.updateOne({ slug: 'jumaa' }, { $set: { price: 7.75 } });
      await page.reload();
      await expect(page.getByTestId('pdp-price')).toHaveText('7.750 د.ك');
      const api = await page.request.get('/api/products/jumaa');
      expect((await api.json()).product.price).toBe(7.75);
    } finally {
      await products.updateOne({ slug: 'jumaa' }, { $set: { price: before!.price } });
      await mongoose.disconnect();
    }
  });

  test('reviews: signed-in user posts to the DB and can delete it', async ({ page }, info) => {
    await signupUI(page, 'مراجع ' + info.project.name, uniqueEmail(info, 'rv'), '/products/ghaim');
    await expect(page).toHaveURL(/\/products\/ghaim$/);
    const before = await page.locator('#revlist .rvi').count();
    await page.locator('.pstars button').nth(4).click();
    await page.fill('#rt', 'ريحة هادية وعميقة، تناسب الشتاء مرة.');
    await page.locator('#rvForm button[type=submit]').click();
    await expect(page.locator('.rvtag.me')).toBeVisible();
    await expect(page.locator('#revlist .rvi')).toHaveCount(before + 1);
    await page.reload();
    await expect(page.locator('.rvtag.me')).toBeVisible();
    await page.locator('#revlist .link', { hasText: 'حذف مراجعتي' }).click();
    await expect(page.locator('.rvtag.me')).toHaveCount(0);
  });
});
