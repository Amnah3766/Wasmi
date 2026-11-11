// Server error types + "is the database unavailable?" classification, shared by lib/*, the API routes, server pages
// and the tsx scripts. Pure module: no 'server-only', no mongoose import (safe for vitest and tsx).

/** A required server secret (MONGODB_URI, JWT_SECRET) is not configured. Only the key name is ever reported. */
export class MissingSecretError extends Error {
  constructor(public readonly key: string) {
    super(`Missing required server secret: ${key}`);
    this.name = 'MissingSecretError';
  }
}

/** An expected failure with an HTTP status and a safe, user-facing (Arabic) message. `details` is merged into the body. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Safe Arabic messages for the "store cannot serve right now" cases (used by API routes and server pages). */
export const DB_UNAVAILABLE_MESSAGE = 'ما قدرنا نوصل للمتجر الحين، جرّب بعد شوي';
export const NOT_CONFIGURED_MESSAGE = 'المتجر مو جاهز الحين، جرّب بعد شوي';

// Driver/network errors that mean "MongoDB cannot be reached right now" (classified by name/code, not message text).
const DB_DOWN_NAMES = new Set([
  'MongooseServerSelectionError',
  'MongoServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoTopologyClosedError',
  'MongoNotConnectedError',
  'MongoServerClosedError',
  'MongoPoolClosedError',
  'MongoParseError', // malformed MONGODB_URI = not configured correctly
  'MongoAPIError',
]);
const DB_DOWN_CODES = new Set([
  'ENOTFOUND',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ETIMEOUT',
  'EAI_AGAIN',
  'ESERVFAIL',
  'EREFUSED',
  'ECONNABORTED',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);
// Atlas auth failures (bad user/password in the URI): 18 AuthenticationFailed, 8000 AtlasError.
const DB_AUTH_CODES = new Set([18, 8000]);

/**
 * True when `error` means the store cannot reach (or is not configured for) MongoDB / its secrets right now:
 * a missing MONGODB_URI / JWT_SECRET, DNS/SRV failures, server selection timeouts, network resets, Atlas auth errors.
 * API routes turn these into 503; server pages can show a friendly message instead of crashing.
 */
export function isDatabaseUnavailable(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 5) return false;
  if (error instanceof MissingSecretError) return true;
  const e = error as { name?: unknown; code?: unknown; codeName?: unknown; cause?: unknown };
  const name = typeof e.name === 'string' ? e.name : '';
  if (name === 'MissingSecretError' || DB_DOWN_NAMES.has(name)) return true;
  if (DB_DOWN_CODES.has(String(e.code ?? ''))) return true;
  if (name === 'MongoServerError' && (DB_AUTH_CODES.has(Number(e.code)) || e.codeName === 'AtlasError')) return true;
  return e.cause ? isDatabaseUnavailable(e.cause, depth + 1) : false;
}

/** Removes any MongoDB connection string from a message before it is logged. */
export function redactUri(message: string): string {
  return message.replace(/mongodb(\+srv)?:\/\/\S+/gi, '[hidden URI]');
}
