// Pure Stripe helpers: keys, form encoding, webhook signatures, fils rounding, paid-cart metadata.
import { describe, expect, it } from 'vitest';
import {
  cartSubtotalFils,
  checkTestSecretKey,
  decodeCartMetadata,
  encodeCartMetadata,
  encodeForm,
  expectedTotalFils,
  fakeKey,
  filsToKwd,
  isCheckoutSessionId,
  isStripeCheckoutUrl,
  normalizeSecretKey,
  parseFils,
  redactStripe,
  signatureHeader,
  toFils,
  verifyStripeSignature,
  type PaidLine,
} from './stripeCore';

const TEST_KEY = fakeKey('sk', 'test', '51AbCdEfGhIjKlMnOpQrStUv');
const LIVE_KEY = fakeKey('sk', 'live', '51AbCdEfGhIjKlMnOpQrStUv');
const SECRET = fakeKey('whsec', '', 'unitTestSigningSecret0123456789');

describe('test keys only', () => {
  it('accepts sk_test_/rk_test_ and refuses live, missing and malformed keys', () => {
    expect(checkTestSecretKey(TEST_KEY)).toEqual({ ok: true });
    expect(checkTestSecretKey(fakeKey('rk', 'test', '51AbCdEfGhIjKlMnOpQr'))).toEqual({ ok: true });
    expect(checkTestSecretKey(LIVE_KEY)).toEqual({ ok: false, reason: 'live' });
    expect(checkTestSecretKey(fakeKey('rk', 'live', '51AbCdEfGhIjKlMnOpQr'))).toEqual({ ok: false, reason: 'live' });
    expect(checkTestSecretKey(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(checkTestSecretKey('pk_test_123')).toEqual({ ok: false, reason: 'malformed' });
    expect(checkTestSecretKey(fakeKey('sk', 'test', 'short'))).toEqual({ ok: false, reason: 'malformed' });
  });

  it('normalizeSecretKey pulls the key out of quotes, spaces, line breaks or a NAME= prefix', () => {
    expect(normalizeSecretKey(`  ${TEST_KEY}\n`)).toBe(TEST_KEY);
    expect(normalizeSecretKey(`"${TEST_KEY}"`)).toBe(TEST_KEY);
    expect(normalizeSecretKey(`STRIPE_SECRET_KEY=${TEST_KEY}`)).toBe(TEST_KEY);
    expect(normalizeSecretKey(`STRIPE_SECRET_KEY = '${TEST_KEY}' `)).toBe(TEST_KEY);
    expect(normalizeSecretKey('   ')).toBeUndefined();
    expect(normalizeSecretKey(undefined)).toBeUndefined();
  });

  it('redactStripe hides keys and webhook secrets in log lines', () => {
    const line = `failed with ${TEST_KEY} and ${SECRET}`;
    const out = redactStripe(line);
    expect(out).not.toContain(TEST_KEY);
    expect(out).not.toContain(SECRET);
    expect(out).toContain('sk_test_[hidden]');
    expect(out).toContain('whsec_[hidden]');
  });
});

describe('encodeForm (Stripe bracket syntax)', () => {
  it('encodes nested objects and arrays, skips null/undefined, URL-encodes Arabic', () => {
    const body = encodeForm({
      mode: 'payment',
      line_items: [{ quantity: 2, price_data: { currency: 'kwd', unit_amount: 9500, product_data: { name: 'تراب الوسمي' } } }],
      discounts: undefined,
      metadata: { a: 'x y', b: null },
    });
    expect(body).toContain('mode=payment');
    expect(body).toContain(`${encodeURIComponent('line_items[0][quantity]')}=2`);
    expect(body).toContain(`${encodeURIComponent('line_items[0][price_data][unit_amount]')}=9500`);
    expect(body).toContain(`${encodeURIComponent('line_items[0][price_data][product_data][name]')}=${encodeURIComponent('تراب الوسمي')}`);
    expect(body).toContain(`${encodeURIComponent('metadata[a]')}=x%20y`);
    expect(body).not.toContain('discounts');
    expect(body).not.toContain(encodeURIComponent('metadata[b]'));
  });
});

describe('webhook signatures (HMAC-SHA256, 300 s tolerance)', () => {
  const payload = JSON.stringify({ id: 'evt_test_1', type: 'checkout.session.completed' });
  const now = 1_800_000_000;

  it('accepts a correct signature', () => {
    expect(verifyStripeSignature(payload, signatureHeader(payload, SECRET, now), SECRET, now)).toEqual({ ok: true, timestamp: now });
  });
  it('accepts when one of several v1 signatures matches (secret rotation)', () => {
    const good = signatureHeader(payload, SECRET, now).split(',')[1];
    expect(verifyStripeSignature(payload, `t=${now},v1=${'0'.repeat(64)},${good}`, SECRET, now).ok).toBe(true);
  });
  it('rejects a forged signature (wrong secret)', () => {
    expect(verifyStripeSignature(payload, signatureHeader(payload, fakeKey('whsec', '', 'otherSecret0123456789'), now), SECRET, now)).toEqual({ ok: false, reason: 'mismatch' });
  });
  it('rejects a modified body', () => {
    expect(verifyStripeSignature(payload.replace('completed', 'expired'), signatureHeader(payload, SECRET, now), SECRET, now)).toEqual({ ok: false, reason: 'mismatch' });
  });
  it('rejects an old (replayed) signature', () => {
    expect(verifyStripeSignature(payload, signatureHeader(payload, SECRET, now - 301), SECRET, now)).toEqual({ ok: false, reason: 'expired' });
    expect(verifyStripeSignature(payload, signatureHeader(payload, SECRET, now - 299), SECRET, now).ok).toBe(true);
  });
  it('rejects a missing or malformed header', () => {
    expect(verifyStripeSignature(payload, null, SECRET, now)).toEqual({ ok: false, reason: 'missing' });
    expect(verifyStripeSignature(payload, 'v1=abc', SECRET, now)).toEqual({ ok: false, reason: 'malformed' });
    expect(verifyStripeSignature(payload, `t=${now}`, SECRET, now)).toEqual({ ok: false, reason: 'malformed' });
  });
});

describe('fils (KWD has 3 decimals; Stripe needs the last digit 0)', () => {
  it('converts KWD to fils rounded to the nearest 10', () => {
    expect(toFils(9.5)).toBe(9500);
    expect(toFils(6.25)).toBe(6250);
    expect(toFils(35.25)).toBe(35250);
    expect(toFils(3.525)).toBe(3530);
    expect(toFils(1.5)).toBe(1500);
    expect(toFils(0.004)).toBe(0);
    expect(toFils(31.72)).toBe(31720);
    for (const v of [0.1, 0.2, 7.75, 12.345, 99.999]) expect(toFils(v) % 10).toBe(0);
    expect(filsToKwd(35250)).toBe(35.25);
  });
  it('parseFils only accepts non-negative multiples of 10 written by the server', () => {
    expect(parseFils('1500')).toBe(1500);
    expect(parseFils('0')).toBe(0);
    expect(parseFils('1505')).toBeNull();
    expect(parseFils('-10')).toBeNull();
    expect(parseFils('1e3')).toBeNull();
    expect(parseFils(1500)).toBeNull();
  });
});

describe('paid-cart metadata (slug:size:qty:unitFils)', () => {
  const lines: PaidLine[] = [
    { t: 'p', slug: 'awal', size: 1, quantity: 2, unitFils: 9500 },
    { t: 'b', slugs: ['awal', 'ghubar', 'ghaim'], quantity: 1, unitFils: 35250 },
  ];
  it('round-trips product lines and gift boxes', () => {
    const encoded = encodeCartMetadata(lines);
    expect(encoded).toBe('awal:1:2:9500,awal+ghubar+ghaim:b:1:35250');
    expect(decodeCartMetadata(encoded)).toEqual(lines);
  });
  it('sums subtotal and the expected Stripe total', () => {
    expect(cartSubtotalFils(lines)).toBe(54250);
    expect(expectedTotalFils(lines, 5430, 0)).toBe(48820);
    expect(expectedTotalFils([lines[0]], 0, 1500)).toBe(20500);
  });
  it('rejects anything the server would not have written', () => {
    for (const bad of [
      '',
      'awal:1:2:9505', // not a multiple of 10 fils
      'awal:1:0:9500', // quantity 0
      'awal:1:100:9500', // quantity > 99
      'AWAL:1:2:9500', // bad slug
      'awal:x:2:9500', // bad size
      'awal+ghubar:b:1:9500', // box of 2
      'awal+awal+ghaim:b:1:9500', // duplicate scent
      'awal+ghubar+ghaim:1:1:9500', // box with a size index
      'awal:1:2:9500;rm',
      'a'.repeat(501),
    ]) {
      expect(decodeCartMetadata(bad), bad).toBeNull();
    }
    expect(decodeCartMetadata(undefined)).toBeNull();
  });
});

describe('ids and URLs', () => {
  it('accepts Checkout Session ids only', () => {
    expect(isCheckoutSessionId('cs_test_a1B2c3D4e5F6g7H8i9')).toBe(true);
    expect(isCheckoutSessionId('cs_test_../../charges')).toBe(false);
    expect(isCheckoutSessionId('pi_test_123')).toBe(false);
    expect(isCheckoutSessionId(42)).toBe(false);
  });
  it('only Stripe-hosted checkout URLs are followed', () => {
    expect(isStripeCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_abc')).toBe(true);
    expect(isStripeCheckoutUrl('http://checkout.stripe.com/c/pay/cs_test_abc')).toBe(false);
    expect(isStripeCheckoutUrl('https://checkout.stripe.com.evil.example/x')).toBe(false);
    expect(isStripeCheckoutUrl('https://evil.example/?https://checkout.stripe.com')).toBe(false);
    expect(isStripeCheckoutUrl(null)).toBe(false);
  });
});

describe('charge currency (USD at a fixed rate when the Stripe account has no KWD)', () => {
  it('defaults to USD; KWD only when asked', async () => {
    const { chargeCurrencyFrom, rateFor } = await import('./stripeCore');
    expect(chargeCurrencyFrom(undefined)).toBe('usd');
    expect(chargeCurrencyFrom('KWD ')).toBe('kwd');
    expect(chargeCurrencyFrom('eur')).toBe('usd');
    expect(rateFor('kwd')).toBe(1);
    expect(rateFor('usd')).toBe(3.25);
  });
  it('converts fils to cents per component, and the expected charge adds up the same way', async () => {
    const { toChargeAmount, expectedChargeAmount } = await import('./stripeCore');
    expect(toChargeAmount(9500, 'usd', 3.25)).toBe(3088); // 30.875 USD → 3087.5 → 3088 cents
    expect(toChargeAmount(1500, 'usd', 3.25)).toBe(488);
    expect(toChargeAmount(9500, 'kwd', 1)).toBe(9500);
    const lines: PaidLine[] = [{ t: 'p', slug: 'awal', size: 1, quantity: 1, unitFils: 9500 }];
    expect(expectedChargeAmount(lines, 0, 1500, 'usd', 3.25)).toBe(3088 + 488);
    expect(expectedChargeAmount(lines, 0, 1500, 'kwd', 1)).toBe(11000);
  });
  it('parseRate only accepts what the server writes', async () => {
    const { parseRate } = await import('./stripeCore');
    expect(parseRate('3.25', 'usd')).toBe(3.25);
    expect(parseRate('1', 'kwd')).toBe(1);
    expect(parseRate('1', 'usd')).toBeNull();
    expect(parseRate('3.25', 'kwd')).toBeNull();
    expect(parseRate('9', 'usd')).toBeNull();
    expect(parseRate('3.25e0', 'usd')).toBeNull();
  });
});
