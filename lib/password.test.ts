import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';
import { BCRYPT_COST, BCRYPT_HASH_RE, hashPassword, verifyPassword } from './password';

describe('password hashing (bcryptjs, cost 12)', () => {
  it('produces "$2b$12$" hashes (60 chars), never the plain password', async () => {
    const hash = await hashPassword('correct horse 8');
    expect(BCRYPT_COST).toBe(12);
    expect(hash.startsWith('$2b$12$')).toBe(true);
    expect(hash).toHaveLength(60);
    expect(hash).toMatch(BCRYPT_HASH_RE);
    expect(hash).not.toContain('correct horse 8');
    expect(bcrypt.getRounds(hash)).toBe(12);
  }, 20_000);

  it('salts every hash and verifies only the right password', async () => {
    const [a, b] = await Promise.all([hashPassword('كلمة سر قوية'), hashPassword('كلمة سر قوية')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('كلمة سر قوية', a)).toBe(true);
    expect(await verifyPassword('كلمة سر غلط', a)).toBe(false);
  }, 20_000);

  it('returns false for a missing account (after a dummy comparison)', async () => {
    expect(await verifyPassword('anything123', null)).toBe(false);
    expect(await verifyPassword('anything123', undefined)).toBe(false);
  }, 20_000);
});
