import { describe, expect, it } from 'vitest';
import { safeNext } from './safeNext';

describe('safeNext (post-login redirect guard)', () => {
  it('keeps same-origin paths, including query and hash', () => {
    expect(safeNext('/orders')).toBe('/orders');
    expect(safeNext('/')).toBe('/');
    expect(safeNext('/checkout')).toBe('/checkout');
    expect(safeNext('/products/awal#reviews')).toBe('/products/awal#reviews');
    expect(safeNext('/orders/64b7f0c2a1b2c3d4e5f60718?x=1')).toBe('/orders/64b7f0c2a1b2c3d4e5f60718?x=1');
  });

  it('uses the fallback (default /orders) for empty and non-relative values', () => {
    expect(safeNext(undefined)).toBe('/orders');
    expect(safeNext(null)).toBe('/orders');
    expect(safeNext('')).toBe('/orders');
    expect(safeNext('orders')).toBe('/orders');
    expect(safeNext('https://evil.com')).toBe('/orders');
    expect(safeNext('http://evil.com/orders')).toBe('/orders');
    expect(safeNext('javascript:alert(1)')).toBe('/orders');
    expect(safeNext('data:text/html,<script>alert(1)</script>')).toBe('/orders');
    expect(safeNext('https://evil.com', '/')).toBe('/');
  });

  it('blocks protocol-relative and backslash tricks', () => {
    expect(safeNext('//evil.com')).toBe('/orders');
    expect(safeNext('///evil.com')).toBe('/orders');
    expect(safeNext('\\\\evil.com')).toBe('/orders');
    expect(safeNext('\\evil.com')).toBe('/orders');
    expect(safeNext('/\\evil.com')).toBe('/orders');
    expect(safeNext('/\\/evil.com')).toBe('/orders');
  });

  it('blocks control / whitespace characters that browsers strip (tab, newline, CR, space, U+2028)', () => {
    expect(safeNext('/\t/evil.com')).toBe('/orders');
    expect(safeNext('/\n/evil.com')).toBe('/orders');
    expect(safeNext('/\r/evil.com')).toBe('/orders');
    expect(safeNext('/ /evil.com')).toBe('/orders');
    expect(safeNext(`/${String.fromCharCode(0x2028)}/evil.com`)).toBe('/orders');
    expect(safeNext(`/${String.fromCharCode(0)}/evil.com`)).toBe('/orders');
  });

  it('keeps a decoded path on the same origin (no encoded //evil escape)', () => {
    const out = safeNext('/%2F%2Fevil.com');
    expect(out.startsWith('//')).toBe(false);
    expect(new URL(out, 'https://wasmi.example').origin).toBe('https://wasmi.example');
  });
});
