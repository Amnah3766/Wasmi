import { afterEach, describe, expect, it } from 'vitest';
import { connectDB, isDnsLookupFailure, isTransientConnectError } from './db';
import { HttpError, MissingSecretError, isDatabaseUnavailable, redactUri } from './errors';

const err = (name: string, extra: Record<string, unknown> = {}) => Object.assign(new Error('x'), { name }, extra);

describe('isDatabaseUnavailable (→ 503)', () => {
  it('treats missing secrets and driver/network failures as unavailable', () => {
    expect(isDatabaseUnavailable(new MissingSecretError('MONGODB_URI'))).toBe(true);
    expect(isDatabaseUnavailable(new MissingSecretError('JWT_SECRET'))).toBe(true);
    expect(isDatabaseUnavailable(err('MongooseServerSelectionError'))).toBe(true);
    expect(isDatabaseUnavailable(err('MongoNetworkError'))).toBe(true);
    expect(isDatabaseUnavailable(err('MongoNotConnectedError'))).toBe(true);
    expect(isDatabaseUnavailable(err('MongoParseError'))).toBe(true);
    expect(isDatabaseUnavailable(err('Error', { code: 'ECONNRESET' }))).toBe(true);
    expect(isDatabaseUnavailable(err('Error', { code: 'ETIMEOUT' }))).toBe(true);
    expect(isDatabaseUnavailable(err('MongoServerError', { code: 8000, codeName: 'AtlasError' }))).toBe(true);
    expect(isDatabaseUnavailable(err('Error', { cause: err('Error', { code: 'ENOTFOUND' }) }))).toBe(true);
  });
  it('does not hide real bugs or expected errors', () => {
    expect(isDatabaseUnavailable(new Error('boom'))).toBe(false);
    expect(isDatabaseUnavailable(new TypeError('x is undefined'))).toBe(false);
    expect(isDatabaseUnavailable(new HttpError(400, 'bad'))).toBe(false);
    expect(isDatabaseUnavailable(err('MongoServerError', { code: 11000 }))).toBe(false);
    expect(isDatabaseUnavailable(err('ValidationError'))).toBe(false);
    expect(isDatabaseUnavailable(null)).toBe(false);
    expect(isDatabaseUnavailable('ECONNRESET')).toBe(false);
  });
  it('never loops on circular causes', () => {
    const a = err('Error') as Error & { cause?: unknown };
    a.cause = a;
    expect(isDatabaseUnavailable(a)).toBe(false);
  });
});

describe('connection retry classification (lib/db.ts)', () => {
  it('recognises SRV/DNS lookup failures', () => {
    expect(isDnsLookupFailure(err('Error', { code: 'ECONNREFUSED', syscall: 'querySrv', message: 'querySrv ECONNREFUSED _mongodb._tcp.c.mongodb.net' }))).toBe(true);
    expect(isDnsLookupFailure(err('Error', { code: 'ETIMEOUT', message: 'queryTxt ETIMEOUT c.mongodb.net' }))).toBe(true);
    expect(isDnsLookupFailure(err('MongoServerSelectionError', { cause: err('Error', { code: 'EAI_AGAIN', syscall: 'getaddrinfo', message: 'getaddrinfo EAI_AGAIN x' }) }))).toBe(true);
    expect(isDnsLookupFailure(new Error('bad auth'))).toBe(false);
  });
  it('retries transient failures only (not bad URIs or bad credentials)', () => {
    expect(isTransientConnectError(err('MongooseServerSelectionError'))).toBe(true);
    expect(isTransientConnectError(err('Error', { code: 'ECONNRESET' }))).toBe(true);
    expect(isTransientConnectError(err('MongoParseError'))).toBe(false);
    expect(isTransientConnectError(err('MongoServerError', { code: 8000 }))).toBe(false);
    expect(isTransientConnectError(new MissingSecretError('MONGODB_URI'))).toBe(false);
    expect(isTransientConnectError(new Error('boom'))).toBe(false);
  });
});

describe('connectDB without MONGODB_URI', () => {
  const saved = process.env.MONGODB_URI;
  afterEach(() => {
    if (saved === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = saved;
  });
  it('throws MissingSecretError naming only the key', async () => {
    delete process.env.MONGODB_URI;
    await expect(connectDB()).rejects.toBeInstanceOf(MissingSecretError);
    await expect(connectDB()).rejects.toMatchObject({ key: 'MONGODB_URI' });
  });
});

describe('redactUri', () => {
  it('hides connection strings in log messages', () => {
    expect(redactUri('failed mongodb+srv://u:p@c.mongodb.net/wasmi?x=1 now')).toBe('failed [hidden URI] now');
    expect(redactUri('MONGODB://u:p@localhost:27017')).toBe('[hidden URI]');
  });
});
