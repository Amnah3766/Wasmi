import 'server-only';
// Minimal server-side Stripe client (REST API over fetch, no `stripe` npm dependency).
// STRIPE_SECRET_KEY is read from the server environment only (.env.local locally, Vercel environment variables in
// production: the class brief's "Supabase Secrets"). It is never logged, returned in a response, or bundled for the
// browser (this file imports 'server-only', so a client import fails the build).
import { MissingSecretError } from './errors';
import { checkTestSecretKey, encodeForm, isCheckoutSessionId, normalizeSecretKey, type FormValue } from './stripeCore';

const STRIPE_API = 'https://api.stripe.com/v1';

/** Stripe answered with an error, or could not be reached. Only safe fields are kept (never the key). */
export class StripeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly type: string,
    public readonly code: string | null,
    public readonly param: string | null = null,
  ) {
    super(`Stripe API error ${status} (${type}${code ? `/${code}` : ''}${param ? ` param=${param}` : ''})`);
    this.name = 'StripeApiError';
  }
}

/** The configured key is a LIVE key (or not a Stripe secret key at all). Payments stay disabled. */
export class StripeKeyError extends Error {
  constructor(public readonly reason: 'live' | 'malformed') {
    super(reason === 'live' ? 'STRIPE_SECRET_KEY is a live key; this classwork store only accepts test keys.' : 'STRIPE_SECRET_KEY is not a valid Stripe test secret key.');
    this.name = 'StripeKeyError';
  }
}

function secretKey(): string {
  const key = normalizeSecretKey(process.env.STRIPE_SECRET_KEY);
  const check = checkTestSecretKey(key);
  if (!check.ok) {
    if (check.reason === 'missing') throw new MissingSecretError('STRIPE_SECRET_KEY');
    throw new StripeKeyError(check.reason);
  }
  return key!;
}

/** 'ready' | 'missing' | 'malformed' | 'live' (for /api/health and the checkout page; never the key itself). */
export function paymentsStatus(): 'ready' | 'missing' | 'malformed' | 'live' {
  const check = checkTestSecretKey(normalizeSecretKey(process.env.STRIPE_SECRET_KEY));
  return check.ok ? 'ready' : check.reason;
}

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

async function stripeRequest<T>(method: 'GET' | 'POST', path: string, params?: Record<string, FormValue>, fetchImpl: FetchLike = fetch): Promise<T> {
  const key = secretKey();
  const body = params ? encodeForm(params) : '';
  const url = method === 'GET' && body ? `${STRIPE_API}${path}?${body}` : `${STRIPE_API}${path}`;
  let res: Response | undefined;
  // Retry network failures (this PC's DNS is flaky); never retry an answer from Stripe.
  for (let attempt = 1; attempt <= 3 && !res; attempt++) {
    try {
      res = await fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        },
        body: method === 'POST' ? body : undefined,
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      if (attempt === 3) throw new StripeApiError(0, 'network_error', null);
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  let data: unknown = null;
  try {
    data = await res!.json();
  } catch {
    // handled below
  }
  if (!res!.ok) {
    const err = (data as { error?: { type?: string; code?: string; param?: string } } | null)?.error;
    throw new StripeApiError(res!.status, err?.type ?? 'api_error', err?.code ?? null, err?.param ?? null);
  }
  if (!data || typeof data !== 'object') throw new StripeApiError(res!.status, 'invalid_response', null);
  return data as T;
}

/** The Checkout Session fields Wasmi reads. */
export interface CheckoutSession {
  id: string;
  object: 'checkout.session';
  url: string | null;
  mode: string;
  status: 'open' | 'complete' | 'expired' | null;
  payment_status: 'paid' | 'unpaid' | 'no_payment_required';
  amount_subtotal: number | null;
  amount_total: number | null;
  currency: string | null;
  client_reference_id: string | null;
  payment_intent: string | { id: string } | null;
  livemode: boolean;
  metadata: Record<string, string> | null;
}

export function createCheckoutSession(params: Record<string, FormValue>, fetchImpl?: FetchLike): Promise<CheckoutSession> {
  return stripeRequest<CheckoutSession>('POST', '/checkout/sessions', params, fetchImpl);
}

export function retrieveCheckoutSession(id: string, fetchImpl?: FetchLike): Promise<CheckoutSession> {
  if (!isCheckoutSessionId(id)) throw new StripeApiError(400, 'invalid_request_error', 'invalid_session_id');
  return stripeRequest<CheckoutSession>('GET', `/checkout/sessions/${id}`, undefined, fetchImpl);
}

/** A one-use coupon for the promo discount (WASMI10), as a fixed amount in the order currency. */
export function createOnceCoupon(params: { amountOff: number; currency: string; name: string }, fetchImpl?: FetchLike): Promise<{ id: string }> {
  return stripeRequest<{ id: string }>(
    'POST',
    '/coupons',
    { amount_off: params.amountOff, currency: params.currency, duration: 'once', max_redemptions: 1, name: params.name },
    fetchImpl,
  );
}
