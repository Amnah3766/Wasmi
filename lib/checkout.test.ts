// Server-side payment rules that must hold without a database or a real Stripe account:
// the Stripe client refuses live keys and never leaks the key, the success check is owner-only, and fulfilment
// refuses anything that does not match what the server itself wrote into the Checkout Session.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeCartMetadata, encodeCartMetadata, expectedChargeAmount, fakeKey } from './stripeCore';

vi.mock('./db', () => ({
  connectDB: vi.fn(async () => {
    throw new Error('the database must not be reached in these tests');
  }),
}));

const USER = '6650f0c2a1b2c3d4e5f60718';
const OTHER = '6650f0c2a1b2c3d4e5f60719';
const TEST_KEY = fakeKey('sk', 'test', '51AbCdEfGhIjKlMnOpQr');

const ITEMS = encodeCartMetadata([
  { t: 'p', slug: 'awal', size: 1, quantity: 2, unitFils: 9500 },
  { t: 'b', slugs: ['awal', 'ghubar', 'ghaim'], quantity: 1, unitFils: 35250 },
]);
// subtotal 54.250 − WASMI10 5.430 + free delivery = 48.820 KWD, charged in USD at the fixed 3.25 rate
const CHARGE = expectedChargeAmount(decodeCartMetadata(ITEMS)!, 5430, 0, 'usd', 3.25);
function paidSession(over: Record<string, unknown> = {}, meta: Record<string, string> = {}) {
  return {
    id: 'cs_test_a1B2c3D4e5F6g7H8i9',
    object: 'checkout.session',
    url: null,
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_subtotal: 54250,
    amount_total: CHARGE,
    currency: 'usd',
    client_reference_id: USER,
    payment_intent: 'pi_test_123',
    livemode: false,
    metadata: {
      wasmi_user: USER,
      wasmi_items: ITEMS,
      wasmi_promo: 'WASMI10',
      wasmi_discount_fils: '5430',
      wasmi_shipping_fils: '0',
      wasmi_charge_currency: 'usd',
      wasmi_kwd_rate: '3.25',
      wasmi_box_notes: '["مبروك"]',
      d_name: 'سارة العلي',
      d_phone: '99887766',
      d_area: 'السالمية',
      d_address: 'قطعة 2، شارع 10',
      d_slot: 'صباحًا (9-12)',
      ...meta,
    },
    ...over,
  } as never;
}

describe('lib/stripe: key handling', () => {
  const original = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = original;
  });

  it('refuses to call Stripe without a key, or with a live key', async () => {
    const { createCheckoutSession, StripeKeyError } = await import('./stripe');
    const { MissingSecretError } = await import('./errors');
    const fetchImpl = vi.fn();
    delete process.env.STRIPE_SECRET_KEY;
    await expect(createCheckoutSession({}, fetchImpl)).rejects.toBeInstanceOf(MissingSecretError);
    process.env.STRIPE_SECRET_KEY = fakeKey('sk', 'live', '51AbCdEfGhIjKlMnOpQr');
    await expect(createCheckoutSession({}, fetchImpl)).rejects.toBeInstanceOf(StripeKeyError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports payments status without revealing the key', async () => {
    const { paymentsStatus } = await import('./stripe');
    delete process.env.STRIPE_SECRET_KEY;
    expect(paymentsStatus()).toBe('missing');
    process.env.STRIPE_SECRET_KEY = `STRIPE_SECRET_KEY="${TEST_KEY}"`;
    expect(paymentsStatus()).toBe('ready');
    process.env.STRIPE_SECRET_KEY = fakeKey('sk', 'live', '51AbCdEfGhIjKlMnOpQr');
    expect(paymentsStatus()).toBe('live');
    process.env.STRIPE_SECRET_KEY = 'not-a-key';
    expect(paymentsStatus()).toBe('malformed');
  });

  it('sends the key only in the Authorization header and maps errors without exposing it', async () => {
    const { createCheckoutSession, StripeApiError } = await import('./stripe');
    process.env.STRIPE_SECRET_KEY = TEST_KEY;
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: { type: 'invalid_request_error', code: 'parameter_missing', message: 'Invalid API Key provided' } }), { status: 400 }));
    const err = (await createCheckoutSession({ mode: 'payment' }, fetchImpl).catch((e: unknown) => e)) as InstanceType<typeof StripeApiError>;
    expect(err).toBeInstanceOf(StripeApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('parameter_missing');
    expect(String(err.message)).not.toContain(TEST_KEY);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TEST_KEY}`);
    expect(String(init.body)).toBe('mode=payment');
  });

  it('rejects a session id that is not a Checkout Session id before any request', async () => {
    const { retrieveCheckoutSession, StripeApiError } = await import('./stripe');
    process.env.STRIPE_SECRET_KEY = TEST_KEY;
    const fetchImpl = vi.fn();
    expect(() => retrieveCheckoutSession('cs_test_../../charges', fetchImpl)).toThrow(StripeApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('fulfillCheckoutSession: only exactly what the server created is saved', () => {
  it('refuses unpaid, live-mode, foreign and tampered sessions before touching the database', async () => {
    const { fulfillCheckoutSession } = await import('./checkout');
    expect(await fulfillCheckoutSession(paidSession({ payment_status: 'unpaid' }))).toEqual({ ok: false, reason: 'not_paid' });
    expect(await fulfillCheckoutSession(paidSession({ livemode: true }))).toEqual({ ok: false, reason: 'livemode' });
    expect(await fulfillCheckoutSession(paidSession({ mode: 'subscription' }))).toEqual({ ok: false, reason: 'mismatch' });
    // amount charged ≠ lines − discount + delivery (e.g. someone changed the price on the way)
    expect(await fulfillCheckoutSession(paidSession({ amount_total: 10 }))).toEqual({ ok: false, reason: 'mismatch' });
    expect(await fulfillCheckoutSession(paidSession({ amount_total: CHARGE + 1 }))).toEqual({ ok: false, reason: 'mismatch' });
    // charged in a currency/rate the server did not write
    expect(await fulfillCheckoutSession(paidSession({}, { wasmi_kwd_rate: '1' }))).toEqual({ ok: false, reason: 'mismatch' });
    expect(await fulfillCheckoutSession(paidSession({}, { wasmi_charge_currency: 'kwd' }))).toEqual({ ok: false, reason: 'mismatch' });
    // another user / a missing user
    expect(await fulfillCheckoutSession(paidSession({ client_reference_id: OTHER }))).toEqual({ ok: false, reason: 'mismatch' });
    expect(await fulfillCheckoutSession(paidSession({}, { wasmi_user: 'nope' }))).toEqual({ ok: false, reason: 'mismatch' });
    // other currency, broken lines, odd fils, missing delivery
    expect(await fulfillCheckoutSession(paidSession({ currency: 'eur' }))).toEqual({ ok: false, reason: 'mismatch' });
    expect(await fulfillCheckoutSession(paidSession({}, { wasmi_items: 'awal:1:2:9505' }))).toEqual({ ok: false, reason: 'mismatch' });
    expect(await fulfillCheckoutSession(paidSession({}, { wasmi_discount_fils: '5435' }))).toEqual({ ok: false, reason: 'mismatch' });
    expect(await fulfillCheckoutSession(paidSession({}, { d_address: '' }))).toEqual({ ok: false, reason: 'mismatch' });
  });

  it('a session that matches reaches the database step (mocked here to throw)', async () => {
    const { fulfillCheckoutSession } = await import('./checkout');
    await expect(fulfillCheckoutSession(paidSession())).rejects.toThrow('the database must not be reached');
  });
});

describe('confirmCheckoutForUser: owner-only', () => {
  const original = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    process.env.STRIPE_SECRET_KEY = original;
    vi.unstubAllGlobals();
  });

  it("another account's session id → 404, exactly like an unknown one", async () => {
    process.env.STRIPE_SECRET_KEY = TEST_KEY;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(paidSession()), { status: 200 })));
    const { confirmCheckoutForUser } = await import('./checkout');
    const { HttpError } = await import('./errors');
    const err = await confirmCheckoutForUser(OTHER, 'cs_test_a1B2c3D4e5F6g7H8i9').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as InstanceType<typeof HttpError>).status).toBe(404);
  });

  it('unknown session at Stripe → 404', async () => {
    process.env.STRIPE_SECRET_KEY = TEST_KEY;
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { type: 'invalid_request_error', code: 'resource_missing' } }), { status: 404 })));
    const { confirmCheckoutForUser } = await import('./checkout');
    const err = await confirmCheckoutForUser(USER, 'cs_test_a1B2c3D4e5F6g7H8i9').catch((e: unknown) => e as { status?: number });
    expect(err.status).toBe(404);
  });

  it('open / expired sessions are reported without saving anything', async () => {
    process.env.STRIPE_SECRET_KEY = TEST_KEY;
    const { confirmCheckoutForUser } = await import('./checkout');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(paidSession({ payment_status: 'unpaid', status: 'open' })), { status: 200 })));
    expect(await confirmCheckoutForUser(USER, 'cs_test_a1B2c3D4e5F6g7H8i9')).toEqual({ status: 'open' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(paidSession({ payment_status: 'unpaid', status: 'expired' })), { status: 200 })));
    expect(await confirmCheckoutForUser(USER, 'cs_test_a1B2c3D4e5F6g7H8i9')).toEqual({ status: 'expired' });
  });
});
