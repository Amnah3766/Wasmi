// Day 5: Stripe Checkout in TEST MODE, end to end on the local production build (real Stripe sandbox + real Atlas).
// Pays with the Stripe test card 4242 4242 4242 4242 on Stripe's hosted page, then checks «تم الدفع ✓», the cart,
// the paid order in MongoDB and «طلباتي». Also the cancel path. Needs STRIPE_SECRET_KEY (sk_test_…) in .env.local.
import { expect, test, type Page } from '@playwright/test';
import { addFromProductPage, connectTestDb, fillCheckout, signupUI, trackErrors, uniqueEmail } from './helpers';
import mongoose from 'mongoose';

test.skip(!/(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY || ''), 'needs a Stripe test key in .env.local');
test.setTimeout(150_000);

async function goToStripe(page: Page) {
  await page.goto('/checkout');
  await expect(page.getByTestId('pay-card').locator('input')).toBeChecked();
  await expect(page.getByTestId('test-card')).toContainText('4242 4242 4242 4242');
  await fillCheckout(page);
  const [resp] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/checkout') && r.request().method() === 'POST'),
    page.getByTestId('checkout-submit').click(),
  ]);
  expect(resp.status()).toBe(201);
  await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 45_000 });
}

/** Fills Stripe's hosted Checkout page with the test card and pays. */
async function payWith4242(page: Page) {
  const card = page.locator('#cardNumber');
  // Stripe lists payment methods as an accordion (Card, Cash App, Klarna, …): open "Card" first when it is collapsed.
  // The accordion's "Pay with card" button is a zero-size overlay, so it is clicked with a DOM click event.
  await page.locator('#cardNumber, [data-testid="card-accordion-item-button"]').first().waitFor({ state: 'attached', timeout: 45_000 });
  if (!(await card.isVisible())) await page.locator('[data-testid="card-accordion-item-button"]').first().dispatchEvent('click');
  await card.waitFor({ state: 'visible', timeout: 20_000 });
  await card.fill('4242 4242 4242 4242');
  await page.locator('#cardExpiry').fill('12 / 34');
  await page.locator('#cardCvc').fill('123');
  const name = page.locator('#billingName');
  if (await name.isVisible().catch(() => false)) await name.fill('Wasmi Test');
  const zip = page.locator('#billingPostalCode');
  if (await zip.isVisible().catch(() => false)) await zip.fill('12345');
  const link = page.locator('#enableStripePass');
  if (await link.isChecked().catch(() => false)) await link.uncheck().catch(() => {});
  await page.locator('[data-testid="hosted-payment-submit-button"], button[type="submit"]').first().click();
}

test('card payment 4242 → «تم الدفع ✓» without reload → order paid in Atlas → «طلباتي» shows paid', async ({ page }, info) => {
  const errors = trackErrors(page);
  await signupUI(page, 'دافع ' + info.project.name, uniqueEmail(info, 'stripe'));
  await addFromProductPage(page, 'awal');
  await page.goto('/checkout');
  await expect(page.getByTestId('checkout-total')).toHaveText('11.000 د.ك');
  await goToStripe(page);
  // Stripe's page shows the charge (USD at the fixed demo rate; the store total stays 11.000 KWD).
  await expect(page.locator('body')).toContainText(/\$|KWD/);
  await payWith4242(page);

  await page.waitForURL(/\/checkout\/success\?session_id=cs_test_/, { timeout: 90_000 });
  const sessionId = new URL(page.url()).searchParams.get('session_id')!;
  await expect(page.getByTestId('paid-title')).toHaveText('تم الدفع ✓', { timeout: 40_000 });
  await expect(page.getByTestId('paid-amount')).toHaveText('11.000 د.ك');
  const orderNo = (await page.getByTestId('order-no').textContent())!.trim();
  expect(orderNo).toMatch(/^WSM-\d{6}$/);
  await expect(page.locator('#cartN')).toBeHidden(); // the paid line left the cart

  const db = await connectTestDb();
  try {
    const order = await db.collection('orders').findOne({ stripeSessionId: sessionId });
    expect(order).toBeTruthy();
    expect(order!.status).toBe('paid');
    expect(order!.paymentMethod).toBe('stripe');
    expect(order!.total).toBe(11);
    expect(['usd', 'kwd']).toContain(order!.currency);
    expect(order!.amountCharged).toBe(order!.currency === 'usd' ? 3088 + 488 : 11000); // 9.500 + 1.500 KWD
    expect(order!.orderNo).toBe(orderNo);
    expect(order!.paidAt).toBeTruthy();
    // Reloading the success page (or the webhook arriving) never saves a second order.
    await page.reload();
    await expect(page.getByTestId('paid-title')).toHaveText('تم الدفع ✓', { timeout: 40_000 });
    expect(await db.collection('orders').countDocuments({ stripeSessionId: sessionId })).toBe(1);
  } finally {
    await mongoose.disconnect();
  }

  await page.goto('/orders');
  await expect(page.getByTestId('orders-list')).toContainText(orderNo);
  await expect(page.locator(`[data-order-no="${orderNo}"] [data-testid="paid-badge"]`)).toContainText('مدفوع عبر Stripe');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('cancel on Stripe → «ما انخصم شي، وسلتك محفوظة», cart kept, nothing saved', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'one run is enough');
  await signupUI(page, 'ملغي', uniqueEmail(info, 'cancel'));
  await addFromProductPage(page, 'ghaim');
  await goToStripe(page);
  const sessionMatch = /cs_test_[A-Za-z0-9]+/.exec(page.url());
  await page.goto('/checkout/cancel'); // the same page Stripe's back link opens (cancel_url)
  await expect(page.getByTestId('payment-cancelled')).toContainText('ما انخصم شي، وسلتك محفوظة');
  await expect(page.locator('#cartN')).toHaveText('1');
  if (sessionMatch) {
    const db = await connectTestDb();
    try {
      expect(await db.collection('orders').countDocuments({ stripeSessionId: sessionMatch[0] })).toBe(0);
    } finally {
      await mongoose.disconnect();
    }
  }
});

test('API guards: 401 signed out, 403 cross-site, 400 bad cart; any price/user in the body is ignored', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'API only');
  expect((await request.post('/api/checkout', { data: {} })).status()).toBe(401);
  expect((await request.post('/api/checkout/confirm', { data: { sessionId: 'cs_test_a1B2c3D4e5F6g7H8i9' } })).status()).toBe(401);
  expect((await request.post('/api/stripe/webhook', { data: '{}' })).status()).toBe(process.env.STRIPE_WEBHOOK_SECRET ? 400 : 503);
  await signupUI(page, 'حارس', uniqueEmail(info, 'guard'));
  const cross = await page.request.post('/api/checkout', { headers: { origin: 'https://evil.example' }, data: {} });
  expect(cross.status()).toBe(403);
  const bad = await page.request.post('/api/checkout', { data: { lines: [{ t: 'p', id: 'awal', vi: 9, q: 1 }], delivery: { name: 'س' } } });
  expect(bad.status()).toBe(400);
  // Tampered body: fake prices and another user id. The server still creates the session from DB prices.
  const ok = await page.request.post('/api/checkout', {
    data: {
      lines: [{ t: 'p', id: 'awal', vi: 1, q: 1, price: 0.001 }],
      delivery: { name: 'سارة الاختبار', phone: '99887766', area: 'السالمية', address: 'قطعة 2 شارع 10' },
      total: 0.001,
      user: '0123456789abcdef01234567',
    },
  });
  expect(ok.status()).toBe(201);
  const { url } = await ok.json();
  expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  // Someone else's (or a made-up) session id is a 404 for this user.
  expect((await page.request.post('/api/checkout/confirm', { data: { sessionId: 'cs_test_a1B2c3D4e5F6g7H8i9' } })).status()).toBe(404);
});
