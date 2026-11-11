// One shared MongoDB Atlas connection for the whole server (API routes, server pages, seed/report scripts).
// The connection is cached on globalThis, so hot reloads in development and warm serverless invocations on Netlify
// reuse it instead of opening a new connection per request.
// MONGODB_URI is read from the server environment only (.env.local locally, Netlify environment variables in
// production). It is never logged, returned in a response, or sent to the browser.
// No 'server-only' here: the tsx scripts import this file too.
import dns from 'node:dns';
import mongoose from 'mongoose';
import { MissingSecretError, isDatabaseUnavailable, redactUri } from './errors';

export { MissingSecretError, isDatabaseUnavailable };

const MAX_ATTEMPTS = 3;
/** Stop retrying once this much time has passed (keeps a serverless request inside its time limit). */
const RETRY_BUDGET_MS = 15_000;
const PUBLIC_DNS = ['1.1.1.1', '8.8.8.8'];

/** A DNS failure on the SRV/TXT lookup that "mongodb+srv://" needs (e.g. a flaky local resolver on 127.0.0.1). */
export function isDnsLookupFailure(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 5) return false;
  const e = error as { message?: unknown; code?: unknown; syscall?: unknown; cause?: unknown };
  const text = `${String(e.code ?? '')} ${String(e.syscall ?? '')} ${String(e.message ?? '')}`;
  if (/querySrv|queryTxt|getaddrinfo/i.test(text) && /ECONNREFUSED|ESERVFAIL|ETIMEOUT|ETIMEDOUT|ENOTFOUND|EREFUSED|EAI_AGAIN|ENODATA/i.test(text)) {
    return true;
  }
  return e.cause ? isDnsLookupFailure(e.cause, depth + 1) : false;
}

/** Failures worth another attempt: DNS hiccups, server selection timeouts, resets, refused/aborted sockets. */
export function isTransientConnectError(error: unknown): boolean {
  if (isDnsLookupFailure(error)) return true;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'MongoParseError' || name === 'MongoAPIError' || name === 'MissingSecretError') return false; // config, not luck
  if (name === 'MongoServerError') return false; // e.g. bad credentials: retrying will not help
  return isDatabaseUnavailable(error);
}

function connectOnce(uri: string) {
  return mongoose.connect(uri, {
    bufferCommands: false, // fail fast instead of queueing queries while disconnected
    serverSelectionTimeoutMS: 8_000,
    connectTimeoutMS: 8_000,
    maxPoolSize: 10,
  });
}

let switchedDns = false;

function usePublicDns() {
  if (switchedDns) return false;
  switchedDns = true;
  // Only affects this server process (c-ares resolver used for the SRV lookup); never needed on Netlify.
  dns.setServers(PUBLIC_DNS);
  try {
    dns.promises.setServers(PUBLIC_DNS);
  } catch {
    /* same resolver on most Node versions */
  }
  return true;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry(uri: string): Promise<typeof mongoose> {
  const started = Date.now();
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await connectOnce(uri);
    } catch (error) {
      lastError = error;
      const e = error as Error;
      console.warn(`[db] connect attempt ${attempt}/${MAX_ATTEMPTS} failed: ${e?.name ?? 'Error'}: ${redactUri(String(e?.message ?? ''))}`);
      if (attempt === MAX_ATTEMPTS || !isTransientConnectError(error) || Date.now() - started > RETRY_BUDGET_MS) break;
      // A DNS failure switches to public resolvers once and retries straight away; anything else backs off briefly.
      if (!(isDnsLookupFailure(error) && usePublicDns())) await sleep(250 * attempt);
      await mongoose.disconnect().catch(() => undefined);
    }
  }
  throw lastError;
}

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

const globalForMongoose = globalThis as typeof globalThis & { __wasmiMongoose?: MongooseCache };
const cache: MongooseCache = globalForMongoose.__wasmiMongoose ?? (globalForMongoose.__wasmiMongoose = { conn: null, promise: null });

/** Connects (once) and returns the shared mongoose instance. Throws MissingSecretError when MONGODB_URI is not set. */
export async function connectDB(): Promise<typeof mongoose> {
  // Once connected, the driver itself reconnects after network blips (queries fail fast meanwhile → 503).
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new MissingSecretError('MONGODB_URI');
  if (!cache.promise) {
    cache.promise = connectWithRetry(uri).catch((error: unknown) => {
      cache.promise = null; // the next request tries again
      throw error;
    });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

/** Closes the shared connection (scripts call this at the end so the process can exit). */
export async function disconnectDB(): Promise<void> {
  cache.conn = null;
  cache.promise = null;
  await mongoose.disconnect();
}
