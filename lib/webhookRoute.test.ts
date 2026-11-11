// POST /api/stripe/webhook: signature first, then only paid Checkout Sessions reach fulfilment.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeKey, signatureHeader } from './stripeCore';

const fulfill = vi.fn();
vi.mock('@/lib/checkout', () => ({ fulfillCheckoutSession: (...args: unknown[]) => fulfill(...args) }));

const SECRET = fakeKey('whsec', '', 'routeTestSecret0123456789abcdef');

function post(body: string, signature?: string | null) {
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: signature ? { 'stripe-signature': signature, 'content-type': 'application/json' } : { 'content-type': 'application/json' },
  });
}
const now = () => Math.floor(Date.now() / 1000);
const event = (type: string, object: Record<string, unknown>) => JSON.stringify({ id: 'evt_test_1', type, data: { object } });
const session = { id: 'cs_test_a1B2c3D4e5F6g7H8i9', object: 'checkout.session', payment_status: 'paid' };

describe('POST /api/stripe/webhook', () => {
  const original = process.env.STRIPE_WEBHOOK_SECRET;
  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
    fulfill.mockReset();
  });
  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = original;
  });

  it('503 when the signing secret is not configured (Stripe retries later)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const body = event('checkout.session.completed', session);
    expect((await POST(post(body, signatureHeader(body, SECRET, now())))).status).toBe(503);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('400 for a missing, forged or stale signature, or a modified body; nothing is saved', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route');
    const body = event('checkout.session.completed', session);
    expect((await POST(post(body, null))).status).toBe(400);
    expect((await POST(post(body, signatureHeader(body, fakeKey('whsec', '', 'wrongSecretValue123456'), now())))).status).toBe(400);
    expect((await POST(post(body, signatureHeader(body, SECRET, now() - 3600)))).status).toBe(400);
    expect((await POST(post(body.replace('paid', 'PAID'), signatureHeader(body, SECRET, now())))).status).toBe(400);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('paid checkout.session.completed → fulfilled (idempotent result passed through)', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route');
    fulfill.mockResolvedValueOnce({ ok: true, order: { id: 'x' }, created: true }).mockResolvedValueOnce({ ok: true, order: { id: 'x' }, created: false });
    const body = event('checkout.session.completed', session);
    const r1 = await POST(post(body, signatureHeader(body, SECRET, now())));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toMatchObject({ received: true, fulfilled: true, created: true });
    const r2 = await POST(post(body, signatureHeader(body, SECRET, now())));
    expect(await r2.json()).toMatchObject({ fulfilled: true, created: false });
    expect(fulfill).toHaveBeenCalledTimes(2);
  });

  it('async_payment_succeeded is handled too; other events and unpaid sessions are acknowledged and ignored', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route');
    fulfill.mockResolvedValue({ ok: true, order: { id: 'x' }, created: true });
    const asyncBody = event('checkout.session.async_payment_succeeded', session);
    expect((await (await POST(post(asyncBody, signatureHeader(asyncBody, SECRET, now())))).json()).fulfilled).toBe(true);
    const other = event('payment_intent.created', { id: 'pi_test_1', object: 'payment_intent' });
    expect(await (await POST(post(other, signatureHeader(other, SECRET, now())))).json()).toMatchObject({ received: true, ignored: true });
    const unpaid = event('checkout.session.completed', { ...session, payment_status: 'unpaid' });
    expect(await (await POST(post(unpaid, signatureHeader(unpaid, SECRET, now())))).json()).toMatchObject({ received: true, pending: true });
    expect(fulfill).toHaveBeenCalledTimes(1);
  });

  it('a session that does not match what the server created is acknowledged (no retry storm) but not saved', async () => {
    const { POST } = await import('@/app/api/stripe/webhook/route');
    fulfill.mockResolvedValueOnce({ ok: false, reason: 'mismatch' });
    const body = event('checkout.session.completed', session);
    const res = await POST(post(body, signatureHeader(body, SECRET, now())));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ received: true, fulfilled: false });
  });
});
