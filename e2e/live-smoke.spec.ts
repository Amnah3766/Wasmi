// Read-only checks against the deployed Netlify site (no accounts, no orders are created).
import { expect, test } from '@playwright/test';
import { trackErrors } from './helpers';

const PAGES = ['/', '/products', '/products/awal', '/finder', '/gift', '/favorites', '/story', '/brand', '/contact', '/cart', '/checkout', '/login', '/signup'];

test('pages 200, products from the database, clean console', async ({ page, request }) => {
  const errors = trackErrors(page);
  for (const r of PAGES) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    await page.waitForLoadState('networkidle');
  }
  const { products } = await (await request.get('/api/products')).json();
  expect(products).toHaveLength(12);
  await page.goto('/products');
  await expect(page.locator('#shopgrid .card')).toHaveCount(12);
  await expect(page.locator('.dbnote')).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('static assets are served (/_next/static 200)', async ({ page, request }) => {
  await page.goto('/');
  const srcs = await page.locator('script[src*="/_next/static/"], link[href*="/_next/static/"]').evaluateAll((els) =>
    els.map((e) => (e as HTMLScriptElement).src || (e as HTMLLinkElement).href),
  );
  expect(srcs.length).toBeGreaterThan(2);
  for (const u of srcs.slice(0, 8)) expect((await request.get(u)).status(), u).toBe(200);
});

test('status codes: 401 / 307 / 400 / 404', async ({ request }) => {
  expect((await request.get('/api/orders')).status()).toBe(401);
  expect((await request.get('/api/auth/me')).status()).toBe(401);
  expect((await request.post('/api/orders', { data: {} })).status()).toBe(401);
  const prot = await request.get('/orders', { maxRedirects: 0 });
  expect(prot.status()).toBe(307);
  expect(prot.headers()['location']).toContain('/login');
  // Invalid input is rejected before anything is written (no account is created).
  expect((await request.post('/api/auth/signup', { data: { name: '', email: 'x', password: '1' } })).status()).toBe(400);
  expect((await request.post('/api/auth/login', { data: {} })).status()).toBe(400);
  expect((await request.get('/products/no-such-scent')).status()).toBe(404);
  expect((await request.get('/api/products/no-such-scent')).status()).toBe(404);
  expect((await request.get('/api/health')).status()).toBe(200);
});

test('guest checkout asks to sign in', async ({ page }) => {
  await page.goto('/products/awal');
  await page.locator('.buyrow .btn.primary').click();
  await page.goto('/checkout');
  await expect(page.getByTestId('login-required')).toContainText('سجّل دخولك عشان ينحفظ طلبك');
});
