import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MissingSecretError } from './errors';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, verifySession } from './session';

const USER = { id: '64b7f0c2a1b2c3d4e5f60718', name: 'سعود' };
const SECRET = 'unit-test-secret-that-is-long-enough-for-hs256-signing';

describe('session token (JWT, HS256)', () => {
  const original = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = SECRET;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  });

  it('uses the wasmi_session cookie with a 7-day lifetime', () => {
    expect(SESSION_COOKIE).toBe('wasmi_session');
    expect(SESSION_MAX_AGE).toBe(604800);
  });

  it('signs sub = user id, name claim, HS256, 7-day expiry', () => {
    const token = signSession(USER);
    const decoded = jwt.decode(token, { complete: true })!;
    expect(decoded.header.alg).toBe('HS256');
    const payload = decoded.payload as jwt.JwtPayload;
    expect(payload.sub).toBe(USER.id);
    expect(payload.name).toBe(USER.name);
    expect(payload.exp! - payload.iat!).toBe(SESSION_MAX_AGE);
    expect(verifySession(token)).toEqual({ ok: true, userId: USER.id, name: USER.name });
  });

  it('reports expired tokens', () => {
    const token = jwt.sign({ name: USER.name }, SECRET, { subject: USER.id, expiresIn: -10, algorithm: 'HS256' });
    expect(verifySession(token)).toEqual({ ok: false, reason: 'expired' });
    expect(verifySession(signSession(USER, -1))).toEqual({ ok: false, reason: 'expired' });
  });

  it('reports a missing token', () => {
    expect(verifySession(undefined)).toEqual({ ok: false, reason: 'missing' });
    expect(verifySession(null)).toEqual({ ok: false, reason: 'missing' });
    expect(verifySession('')).toEqual({ ok: false, reason: 'missing' });
  });

  it('rejects tampered payloads, other secrets and malformed tokens', () => {
    const token = signSession(USER);
    const [h, p, s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: '000000000000000000000000', name: 'x', exp: 9999999999 })).toString('base64url');
    expect(verifySession(`${h}.${forged}.${s}`)).toEqual({ ok: false, reason: 'invalid' });
    expect(verifySession(`${h}.${p}.${s.slice(0, -2)}xx`)).toEqual({ ok: false, reason: 'invalid' });
    expect(verifySession(jwt.sign({ name: 'x' }, 'a-different-secret', { subject: USER.id }))).toEqual({ ok: false, reason: 'invalid' });
    expect(verifySession('not.a.token')).toEqual({ ok: false, reason: 'invalid' });
    expect(verifySession(`${h}.${p}`)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects other algorithms (alg "none" and HS512 with the same secret)', () => {
    const unsigned = jwt.sign({ name: 'x', sub: USER.id }, '', { algorithm: 'none' });
    expect(verifySession(unsigned)).toEqual({ ok: false, reason: 'invalid' });
    const hs512 = jwt.sign({ name: 'x' }, SECRET, { subject: USER.id, algorithm: 'HS512' });
    expect(verifySession(hs512)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a subject that is not a user id', () => {
    expect(verifySession(jwt.sign({ name: 'x' }, SECRET, { subject: 'admin' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(verifySession(jwt.sign({ name: 'x' }, SECRET))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('throws MissingSecretError (→ 503) when JWT_SECRET is missing', () => {
    const token = signSession(USER);
    delete process.env.JWT_SECRET;
    try {
      expect(() => signSession(USER)).toThrow(MissingSecretError);
      expect(() => verifySession(token)).toThrow(MissingSecretError);
      expect(verifySession(undefined)).toEqual({ ok: false, reason: 'missing' });
    } finally {
      process.env.JWT_SECRET = SECRET;
    }
  });
});
