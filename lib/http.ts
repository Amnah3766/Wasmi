import 'server-only';
import { NextResponse } from 'next/server';
import {
  DB_UNAVAILABLE_MESSAGE,
  HttpError,
  MissingSecretError,
  NOT_CONFIGURED_MESSAGE,
  isDatabaseUnavailable,
  redactUri,
} from './errors';
import { StripeApiError, StripeKeyError } from './stripe';
import { redactStripe } from './stripeCore';

// Consistent JSON responses and error handling for every API route (200/201/400/401/404/409/500/503).
// Error bodies hold a short Arabic message (+ optional `fields` codes) — never a stack trace, connection string,
// secret or password hash. Every response is Cache-Control: no-store.

export { HttpError, isDatabaseUnavailable };

export const MESSAGES = {
  badJson: 'البيانات المرسلة مو صحيحة',
  invalid: 'بعض البيانات مو صحيحة',
  server: 'صار خطأ عندنا، جرّب مرة ثانية',
  dbDown: DB_UNAVAILABLE_MESSAGE,
  notConfigured: NOT_CONFIGURED_MESSAGE,
} as const;

export function json(data: unknown, status = 200, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return NextResponse.json(data, { ...init, status, headers });
}

/** `{ error, fields? }` with the given status. */
export function apiError(status: number, error: string, fields?: Record<string, string>): NextResponse {
  return json(fields && Object.keys(fields).length ? { error, fields } : { error }, status);
}

/** Parses a JSON body; anything that is not JSON → HttpError 400. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, MESSAGES.badJson);
  }
}

function safeLog(error: unknown) {
  const e = error as { name?: string; message?: string } | null;
  console.error(`[api] ${e?.name ?? 'Error'}: ${redactStripe(redactUri(String(e?.message ?? error)))}`);
}

export const PAYMENTS_UNAVAILABLE = 'الدفع بالبطاقة مو جاهز الحين، جرّب بعد شوي أو اختر الدفع عند الاستلام';
export const PAYMENT_PROVIDER_ERROR = 'ما قدرنا نوصل لـ Stripe الحين، ما انخصم شي. جرّب مرة ثانية';

/**
 * Defence in depth for cookie-authenticated POSTs (the session cookie is already SameSite=Lax): when the browser sends
 * an Origin header it must be this site.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = new Set<string>();
  try {
    hosts.add(new URL(request.url).host);
  } catch {
    // ignore
  }
  for (const h of [request.headers.get('host'), request.headers.get('x-forwarded-host')]) if (h) hosts.add(h.split(',')[0].trim());
  return hosts.has(originHost);
}

/** Public origin for Stripe's success/cancel URLs: SITE_URL if set (https or localhost), otherwise this request's origin. */
export function siteOrigin(request: Request): string {
  const configured = process.env.SITE_URL?.trim();
  if (configured) {
    try {
      const u = new URL(configured);
      if (u.protocol === 'https:' || u.hostname === 'localhost') return u.origin;
    } catch {
      // fall back to the request origin
    }
  }
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim();
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || url.host;
  return `${proto === 'https' || proto === 'http' ? proto : url.protocol.replace(':', '')}://${host}`;
}

/** Maps any thrown error to a safe JSON response (503 when the DB/secrets are unavailable, never a stack trace). */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) return json({ error: error.message, ...(error.details ?? {}) }, error.status);
  if (error instanceof StripeKeyError || (error instanceof MissingSecretError && error.key.startsWith('STRIPE_'))) {
    console.error(`[api] payments unavailable: ${error instanceof StripeKeyError ? error.reason : 'missing'} STRIPE_SECRET_KEY`);
    return json({ error: PAYMENTS_UNAVAILABLE, code: 'payments_unavailable' }, 503);
  }
  if (error instanceof StripeApiError) {
    safeLog(error);
    return json({ error: PAYMENT_PROVIDER_ERROR, code: 'payment_provider_error' }, 502);
  }
  if (error instanceof MissingSecretError) {
    console.error(`[api] missing server secret: ${error.key}`);
    return json({ error: MESSAGES.notConfigured }, 503);
  }
  if (isDatabaseUnavailable(error)) {
    safeLog(error);
    return json({ error: MESSAGES.dbDown }, 503);
  }
  const name = (error as { name?: string } | null)?.name;
  if (name === 'ValidationError' || name === 'CastError') return json({ error: MESSAGES.invalid }, 400);
  safeLog(error);
  return json({ error: MESSAGES.server }, 500);
}
