/**
 * Post-login destination guard (prevents open redirects). Accepts only same-origin relative paths:
 *  - must start with a single "/" (not "//"),
 *  - no control characters, whitespace or backslashes (browsers strip tab/newline and treat "\" as "/", so
 *    "/\t/evil.com" or "/\evil.com" would become "//evil.com"),
 *  - and it must still resolve to the same origin when parsed as a URL.
 * Anything else returns `fallback` (default "/orders").
 */
const BASE = 'http://same-origin.invalid';

/** Control chars + space (0x00-0x20), DEL + C1 controls (0x7F-0x9F), line/paragraph separators, backslash. */
function hasUnsafeChar(value: string): boolean {
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    if (c <= 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 || c === 0x5c) return true;
  }
  return false;
}

export function safeNext(value: string | null | undefined, fallback = '/orders'): string {
  if (!value || typeof value !== 'string' || value.length > 2048) return fallback;
  if (hasUnsafeChar(value) || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
