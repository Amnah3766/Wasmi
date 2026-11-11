// Pure Stripe helpers (no network, no database), unit-tested in lib/stripeCore.test.ts.
// Wasmi talks to Stripe's REST API directly with fetch (lib/stripe.ts) instead of adding the `stripe` npm package, so
// these helpers do what that package would: form-encode bodies, verify webhook signatures, and pack the paid cart
// into the Checkout Session metadata. Amounts are in FILS (1 KWD = 1000 fils); Stripe requires the last digit of a
// three-decimal currency amount to be 0, so every amount sent to Stripe is a multiple of 10 fils.
import crypto from 'node:crypto';

// ---------------------------------------------------------------------------------------------------------------
// Keys: TEST MODE ONLY. This is classwork, so a live key is refused.
// ---------------------------------------------------------------------------------------------------------------

export type KeyCheck = { ok: true } | { ok: false; reason: 'missing' | 'live' | 'malformed' };

/**
 * Dashboards sometimes keep a pasted value with extra text around the key (quotes, spaces, a line break, or
 * "STRIPE_SECRET_KEY=" in front). Pull out the Stripe secret/restricted key itself; otherwise return the trimmed value.
 */
export function normalizeSecretKey(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const found = /(?:^|[^A-Za-z0-9])((?:sk|rk)_(?:test|live)_[A-Za-z0-9]{10,})(?![A-Za-z0-9])/.exec(raw);
  return found ? found[1] : raw.trim() || undefined;
}

/** Accepts only Stripe *test* secret / restricted keys (sk_test_… / rk_test_…). */
export function checkTestSecretKey(key: string | undefined | null): KeyCheck {
  if (!key) return { ok: false, reason: 'missing' };
  if (/^(sk|rk)_live_/.test(key)) return { ok: false, reason: 'live' };
  if (!/^(sk|rk)_test_[A-Za-z0-9]{10,}$/.test(key)) return { ok: false, reason: 'malformed' };
  return { ok: true };
}

/** Builds key-shaped strings at runtime for tests, so no literal key ever sits in the repository. */
export function fakeKey(prefix: 'sk' | 'rk' | 'whsec', mode: 'test' | 'live' | '', body: string): string {
  return [prefix, mode, body].filter(Boolean).join('_');
}

/** Removes anything key-shaped from a log line. */
export function redactStripe(text: string): string {
  return text.replace(/\b(sk|rk)_(test|live)_[A-Za-z0-9]+/g, '$1_$2_[hidden]').replace(/\bwhsec_[A-Za-z0-9]+/g, 'whsec_[hidden]');
}

// ---------------------------------------------------------------------------------------------------------------
// application/x-www-form-urlencoded with Stripe's bracket syntax: line_items[0][price_data][currency]=kwd
// ---------------------------------------------------------------------------------------------------------------

export type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

export function encodeForm(params: Record<string, FormValue>): string {
  const out: string[] = [];
  const walk = (key: string, value: FormValue) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) value.forEach((v, i) => walk(`${key}[${i}]`, v));
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(`${key}[${k}]`, v);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };
  for (const [k, v] of Object.entries(params)) walk(k, v);
  return out.join('&');
}

// ---------------------------------------------------------------------------------------------------------------
// Webhook signatures: "Stripe-Signature: t=<unix>,v1=<hex hmac>[,v1=…]", signed payload "<t>.<raw body>",
// HMAC-SHA256 with the endpoint's signing secret. Same rules as stripe.webhooks.constructEvent (300 s tolerance).
// ---------------------------------------------------------------------------------------------------------------

export const SIGNATURE_TOLERANCE_SECONDS = 300;

export type SignatureCheck = { ok: true; timestamp: number } | { ok: false; reason: 'missing' | 'malformed' | 'mismatch' | 'expired' };

export function signPayload(payload: string, secret: string, timestamp: number): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
}

/** Builds a valid Stripe-Signature header (tests and the local webhook script). */
export function signatureHeader(payload: string, secret: string, timestamp: number): string {
  return `t=${timestamp},v1=${signPayload(payload, secret, timestamp)}`;
}

export function verifyStripeSignature(
  payload: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds: number,
  toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS,
): SignatureCheck {
  if (!header) return { ok: false, reason: 'missing' };
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't' && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    else if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) signatures.push(value.toLowerCase());
  }
  if (timestamp === null || signatures.length === 0) return { ok: false, reason: 'malformed' };
  const expected = Buffer.from(signPayload(payload, secret, timestamp), 'hex');
  const matched = signatures.some((s) => crypto.timingSafeEqual(Buffer.from(s, 'hex'), expected));
  if (!matched) return { ok: false, reason: 'mismatch' };
  if (toleranceSeconds > 0 && Math.abs(nowSeconds - timestamp) > toleranceSeconds) return { ok: false, reason: 'expired' };
  return { ok: true, timestamp };
}

// ---------------------------------------------------------------------------------------------------------------
// Money: KWD has 3 decimals. Stripe wants integer fils with the last digit 0.
// ---------------------------------------------------------------------------------------------------------------

/** 9.5 KWD → 9500 fils, rounded to the nearest 10 fils (Stripe's rule for three-decimal currencies). */
export function toFils(amountKwd: number): number {
  return Math.round(Math.round(amountKwd * 1000) / 10) * 10;
}

export function filsToKwd(fils: number): number {
  return Math.round(fils) / 1000;
}

/** Stripe's minimum charge is about 0.50 USD; 0.200 KWD is comfortably above it. */
export const MIN_CHARGE_FILS = 200;

// ---------------------------------------------------------------------------------------------------------------
// Charge currency. The store prices, shows and saves everything in KWD. Stripe charges in KWD when the account
// supports it; this test account does not ("Invalid currency: kwd"), so the charge is made in USD at a FIXED demo
// rate that is written into each Checkout Session (so later rate changes never break an open session).
// ---------------------------------------------------------------------------------------------------------------

export type ChargeCurrency = 'kwd' | 'usd';
/** 1 KWD = 3.25 USD (fixed, for the test-mode demo). */
export const KWD_TO_USD = 3.25;

export function chargeCurrencyFrom(value: string | undefined | null): ChargeCurrency {
  return value?.trim().toLowerCase() === 'kwd' ? 'kwd' : 'usd';
}

/** Rate used for a currency: 1 for KWD (amounts stay in fils), KWD_TO_USD for USD. */
export function rateFor(currency: ChargeCurrency): number {
  return currency === 'kwd' ? 1 : KWD_TO_USD;
}

/** Fils → Stripe minor units: fils for KWD; US cents for USD (fils × rate ÷ 10, rounded). */
export function toChargeAmount(fils: number, currency: ChargeCurrency, rate: number): number {
  return currency === 'kwd' ? fils : Math.round((fils * rate) / 10);
}

/** What Stripe must have charged (minor units): each line, the delivery fee and the discount converted the same way. */
export function expectedChargeAmount(lines: PaidLine[], discountFils: number, shippingFils: number, currency: ChargeCurrency, rate: number): number {
  const lineSum = lines.reduce((sum, l) => sum + toChargeAmount(l.unitFils, currency, rate) * l.quantity, 0);
  return lineSum - toChargeAmount(discountFils, currency, rate) + toChargeAmount(shippingFils, currency, rate);
}

/** A rate the server could have written: 1 for KWD, 2.5–4.5 for USD, at most 4 decimals. */
export function parseRate(value: unknown, currency: ChargeCurrency): number | null {
  if (typeof value !== 'string' || !/^\d{1,2}(\.\d{1,4})?$/.test(value)) return null;
  const n = Number(value);
  if (currency === 'kwd') return n === 1 ? 1 : null;
  return n >= 2.5 && n <= 4.5 ? n : null;
}

/** 1100 cents USD → "$11.00"; 11000 fils KWD → "11.000 KWD" (for Stripe product descriptions and notes). */
export function formatCharge(amount: number, currency: ChargeCurrency): string {
  return currency === 'kwd' ? `${(amount / 1000).toFixed(3)} KWD` : `$${(amount / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// The paid cart, written by the SERVER into the Checkout Session metadata. Only the server (secret key) can write
// session metadata, so after payment it is the trusted record of what was bought and at which unit price.
//   product line: <slug>:<sizeIndex>:<qty>:<unitFils>          e.g. awal:1:2:9500
//   gift box    : <slug>+<slug>+<slug>:b:<qty>:<unitFils>      e.g. awal+ghubar+ghaim:b:1:35250
// ---------------------------------------------------------------------------------------------------------------

export type PaidLine =
  | { t: 'p'; slug: string; size: number; quantity: number; unitFils: number }
  | { t: 'b'; slugs: string[]; quantity: number; unitFils: number };

/** Stripe metadata values are limited to 500 characters (and 40-character keys, 50 keys). */
export const METADATA_VALUE_MAX = 500;
const SLUG = '[a-z0-9-]{2,40}';
const LINE_RE = new RegExp(`^(${SLUG}(?:\\+${SLUG}){2}|${SLUG}):(b|\\d{1,2}):([1-9]\\d?):(\\d{1,8})$`);

export function encodeCartMetadata(lines: PaidLine[]): string {
  return lines.map((l) => (l.t === 'p' ? `${l.slug}:${l.size}:${l.quantity}:${l.unitFils}` : `${l.slugs.join('+')}:b:${l.quantity}:${l.unitFils}`)).join(',');
}

export function decodeCartMetadata(value: unknown): PaidLine[] | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > METADATA_VALUE_MAX) return null;
  const lines: PaidLine[] = [];
  for (const part of value.split(',')) {
    const m = LINE_RE.exec(part);
    if (!m) return null;
    const [, who, size, q, f] = m;
    const quantity = Number(q);
    const unitFils = Number(f);
    if (unitFils < 10 || unitFils % 10 !== 0) return null;
    if (size === 'b') {
      const slugs = who.split('+');
      if (slugs.length !== 3 || new Set(slugs).size !== 3) return null;
      lines.push({ t: 'b', slugs, quantity, unitFils });
    } else {
      if (who.includes('+')) return null;
      lines.push({ t: 'p', slug: who, size: Number(size), quantity, unitFils });
    }
  }
  return lines.length ? lines : null;
}

export function cartSubtotalFils(lines: PaidLine[]): number {
  return lines.reduce((sum, l) => sum + l.unitFils * l.quantity, 0);
}

/** The order total in KWD fils: subtotal − discount + delivery. */
export function expectedTotalFils(lines: PaidLine[], discountFils: number, shippingFils: number): number {
  return cartSubtotalFils(lines) - discountFils + shippingFils;
}

/** Non-negative integer amount from metadata, a multiple of 10 fils. */
export function parseFils(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{1,8}$/.test(value)) return null;
  const n = Number(value);
  return n % 10 === 0 ? n : null;
}

/** Checkout Session ids look like cs_test_a1B2…; anything else is rejected before it reaches a URL path. */
export function isCheckoutSessionId(value: unknown): value is string {
  return typeof value === 'string' && /^cs_(test|live)_[A-Za-z0-9]{10,200}$/.test(value);
}

/** Only ever send the browser to Stripe's own hosted checkout. */
export function isStripeCheckoutUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'checkout.stripe.com' || u.hostname.endsWith('.stripe.com'));
  } catch {
    return false;
  }
}
