import 'server-only';
import { cookies } from 'next/headers';
import type { SessionUser } from './shop/types';
import { MissingSecretError } from './errors';
import { SESSION_COOKIE, SESSION_MAX_AGE, verifySession, type SessionCheck } from './session';

// Server-side session helpers for pages and API routes. The user id ALWAYS comes from the verified token,
// never from anything the browser sends in a body or query string.

export type { SessionCheck };

/** Session of the current request (server components / route handlers). Throws MissingSecretError without JWT_SECRET. */
export async function getSession(): Promise<SessionCheck> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/**
 * The signed-in user's id + name from the verified token, or null (no cookie, invalid/expired token, or JWT_SECRET not
 * configured — nobody can be signed in then). Never throws, so layouts/navigation can always call it.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const session = await getSession();
    return session.ok ? { id: session.userId, name: session.name } : null;
  } catch (error) {
    if (error instanceof MissingSecretError) {
      console.error('[auth] JWT_SECRET is not set; treating every visitor as signed out.');
      return null;
    }
    throw error;
  }
}

/** True when the request arrived over HTTPS (always on Netlify, where TLS ends at the proxy → x-forwarded-proto). */
export function isHttps(request: Request): boolean {
  const forwarded = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  if (forwarded) return forwarded === 'https';
  try {
    return new URL(request.url).protocol === 'https:';
  } catch {
    return false;
  }
}

export interface SessionCookie {
  name: string;
  value: string;
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  path: '/';
  maxAge: number;
}

/** HttpOnly + SameSite=Lax session cookie, Secure over HTTPS, 7-day Max-Age (same as the JWT expiry). */
export function sessionCookie(token: string, secure: boolean): SessionCookie {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: SESSION_MAX_AGE };
}

/** Expired, empty cookie that removes the session in the browser. */
export function clearedSessionCookie(secure: boolean): SessionCookie {
  return { ...sessionCookie('', secure), maxAge: 0 };
}
