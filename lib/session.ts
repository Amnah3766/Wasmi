// Login session token (JWT, HS256). Signed with JWT_SECRET (server environment only), sent to the browser only
// inside the HttpOnly `wasmi_session` cookie, and verified on the server for every protected page and API route.
// No 'server-only' here so vitest can import it; nothing in this file is ever bundled for the browser.
import jwt from 'jsonwebtoken';
import { MissingSecretError } from './errors';

export const SESSION_COOKIE = 'wasmi_session';
/** Session lifetime: 7 days (cookie Max-Age and JWT expiry match). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type SessionCheck =
  | { ok: true; userId: string; name: string }
  | { ok: false; reason: 'missing' | 'invalid' | 'expired' };

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (!value) throw new MissingSecretError('JWT_SECRET');
  return value;
}

/** Creates an expiring token: sub = user id, `name` claim = account name. `expiresIn` (seconds) is only overridden by tests. */
export function signSession(user: { id: string; name: string }, expiresIn: number = SESSION_MAX_AGE): string {
  return jwt.sign({ name: user.name }, secret(), { subject: user.id, expiresIn, algorithm: 'HS256' });
}

/** Checks a token: missing, invalid (bad signature / malformed / wrong algorithm / bad subject) or expired. */
export function verifySession(token: string | null | undefined): SessionCheck {
  if (!token) return { ok: false, reason: 'missing' };
  const key = secret(); // throws MissingSecretError (→ 503), never swallowed below
  try {
    const payload = jwt.verify(token, key, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || typeof payload.sub !== 'string' || !/^[a-f0-9]{24}$/i.test(payload.sub)) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, userId: payload.sub, name: typeof payload.name === 'string' ? payload.name : '' };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) return { ok: false, reason: 'expired' };
    return { ok: false, reason: 'invalid' };
  }
}
