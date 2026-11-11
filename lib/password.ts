// Password hashing (bcryptjs, cost 12 → hashes start with "$2b$12$"). Plain passwords are never stored or logged.
// No 'server-only' so vitest can check the hash format.
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 12;
/** A full bcrypt hash at cost 12 (60 chars). */
export const BCRYPT_HASH_RE = /^\$2b\$12\$[./A-Za-z0-9]{53}$/;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST); // bcryptjs 3 emits the "$2b$" prefix
}

let dummyHash: Promise<string> | null = null;

/**
 * Compares a password with a stored hash. When there is no account (`hash` null) it still runs one comparison against
 * a hash of a random value, so the response time does not reveal which emails have accounts. Always false then.
 */
export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) {
    dummyHash ??= hashPassword(randomUUID());
    await bcrypt.compare(plain, await dummyHash);
    return false;
  }
  return bcrypt.compare(plain, hash);
}
