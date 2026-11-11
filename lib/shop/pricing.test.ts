import { describe, expect, it } from 'vitest';
import {
  FREE_SHIPPING_FROM,
  SHIPPING_FEE,
  boxPrice,
  boxSum,
  computeTotals,
  defaultPrice,
  fmt,
  isValidSize,
  lineKey,
  lineUnit,
  normalizePromo,
  promoRate,
  round3,
  roundQuarter,
  sizePrice,
} from './pricing';

const candle = (price: number) => ({
  price,
  defaultSize: 1,
  sizes: [
    { label: '90 غ · 20 ساعة', factor: 0.65 },
    { label: '220 غ · 45 ساعة', factor: 1 },
  ],
});
const perfume = (price: number) => ({
  price,
  defaultSize: 1,
  sizes: [
    { label: '30 مل', factor: 0.65 },
    { label: '50 مل', factor: 1 },
    { label: '100 مل', factor: 1.7 },
  ],
});
const incense = (price: number) => ({
  price,
  defaultSize: 0,
  sizes: [
    { label: '60 غ', factor: 1 },
    { label: '120 غ', factor: 1.8 },
  ],
});

describe('fmt (KWD, 3 decimals, currency after the number)', () => {
  it('formats like the original store', () => {
    expect(fmt(9.5)).toBe('9.500 د.ك');
    expect(fmt(0)).toBe('0.000 د.ك');
    expect(fmt(25.8)).toBe('25.800 د.ك');
    expect(fmt(10.05)).toBe('10.050 د.ك');
  });
  it('never prints NaN / Infinity', () => {
    expect(fmt(Number.NaN)).toBe('0.000 د.ك');
    expect(fmt(Infinity)).toBe('0.000 د.ك');
  });
});

describe('rounding', () => {
  it('round3 removes float noise', () => {
    expect(round3(0.1 + 0.2)).toBe(0.3);
    expect(round3(9.5 * 0.1)).toBe(0.95);
  });
  it('roundQuarter rounds to the nearest quarter dinar', () => {
    expect(roundQuarter(6.175)).toBe(6.25);
    expect(roundQuarter(11.7)).toBe(11.75);
    expect(roundQuarter(30.6)).toBe(30.5);
    expect(roundQuarter(21.6)).toBe(21.5);
    expect(roundQuarter(28.05)).toBe(28);
  });
});

describe('size prices', () => {
  it('default size = base price', () => {
    expect(defaultPrice(candle(9.5))).toBe(9.5);
    expect(defaultPrice(perfume(18))).toBe(18);
    expect(defaultPrice(incense(12))).toBe(12);
  });
  it('other sizes are price × factor rounded to a quarter', () => {
    expect(sizePrice(candle(9.5), 0)).toBe(6.25);
    expect(sizePrice(perfume(18), 0)).toBe(11.75);
    expect(sizePrice(perfume(18), 2)).toBe(30.5);
    expect(sizePrice(incense(12), 1)).toBe(21.5);
  });
  it('an unknown size index falls back to the default size (display only — orders reject it)', () => {
    expect(sizePrice(candle(9.5), 7)).toBe(9.5);
    expect(isValidSize(candle(9.5), 7)).toBe(false);
    expect(isValidSize(candle(9.5), -1)).toBe(false);
    expect(isValidSize(candle(9.5), 0.5)).toBe(false);
    expect(isValidSize(candle(9.5), 1)).toBe(true);
  });
});

describe('gift box (3 scents, default sizes, −15 %, quarter rounding)', () => {
  it('awal + fajr + suhail = (9.5 + 9.5 + 11) × 0.85 = 25.5', () => {
    const items = [candle(9.5), candle(9.5), candle(11)];
    expect(boxSum(items)).toBe(30);
    expect(boxPrice(items)).toBe(25.5);
  });
  it('mixed categories use each default size: 8.5 + 9 + 15.5 = 33 → 28.05 → 28', () => {
    expect(boxPrice([incense(8.5), candle(9), perfume(15.5)])).toBe(28);
  });
});

describe('promo codes', () => {
  it('normalises case and spaces', () => {
    expect(normalizePromo(' wasmi10 ')).toBe('WASMI10');
    expect(normalizePromo(42)).toBe('');
    expect(promoRate('wasmi10')).toBe(0.1);
    expect(promoRate('FREE50')).toBe(0);
    expect(promoRate('')).toBe(0);
  });
});

describe('computeTotals', () => {
  it('adds 1.5 delivery under 25 KWD', () => {
    expect(computeTotals(9.5, '', true)).toEqual({ sub: 9.5, disc: 0, after: 9.5, ship: SHIPPING_FEE, total: 11 });
  });
  it('free delivery from exactly 25 KWD', () => {
    expect(computeTotals(FREE_SHIPPING_FROM, '', true)).toEqual({ sub: 25, disc: 0, after: 25, ship: 0, total: 25 });
    expect(computeTotals(24.999, '', true).ship).toBe(1.5);
  });
  it('WASMI10 takes 10 % off the subtotal, and the free-delivery threshold applies after the discount', () => {
    expect(computeTotals(9.5, 'WASMI10', true)).toEqual({ sub: 9.5, disc: 0.95, after: 8.55, ship: 1.5, total: 10.05 });
    expect(computeTotals(27, 'wasmi10', true)).toEqual({ sub: 27, disc: 2.7, after: 24.3, ship: 1.5, total: 25.8 });
    expect(computeTotals(30, 'WASMI10', true)).toEqual({ sub: 30, disc: 3, after: 27, ship: 0, total: 27 });
  });
  it('unknown codes give no discount; an empty cart has no delivery fee', () => {
    expect(computeTotals(9.5, 'NOPE', true).disc).toBe(0);
    expect(computeTotals(0, '', false)).toEqual({ sub: 0, disc: 0, after: 0, ship: 0, total: 0 });
  });
});

describe('cart lines', () => {
  it('lineKey merges identical lines (box order does not matter)', () => {
    expect(lineKey({ t: 'p', id: 'awal', vi: 1, q: 2 })).toBe('p|awal|1');
    expect(lineKey({ t: 'b', ids: ['fajr', 'awal', 'bar'], note: 'x', q: 1 })).toBe(lineKey({ t: 'b', ids: ['awal', 'bar', 'fajr'], note: 'x', q: 3 }));
  });
  it('lineUnit prices from the catalog lookup and returns null for missing products', () => {
    const cat: Record<string, ReturnType<typeof candle>> = { awal: candle(9.5), fajr: candle(9.5), suhail: candle(11) };
    const by = (s: string) => cat[s];
    expect(lineUnit({ t: 'p', id: 'awal', vi: 0, q: 1 }, by)).toBe(6.25);
    expect(lineUnit({ t: 'b', ids: ['awal', 'fajr', 'suhail'], note: '', q: 1 }, by)).toBe(25.5);
    expect(lineUnit({ t: 'p', id: 'gone', vi: 0, q: 1 }, by)).toBeNull();
    expect(lineUnit({ t: 'b', ids: ['awal', 'fajr'], note: '', q: 1 }, by)).toBeNull();
  });
});

describe('discount rounding to 10 fils (Stripe KWD rule)', () => {
  it('WASMI10 on 35.250 → 3.530 (not 3.525), so the page, the server and Stripe show the same total', () => {
    const t = computeTotals(35.25, 'WASMI10', true);
    expect(t.disc).toBe(3.53);
    expect(t.total).toBe(31.72);
    expect(Math.round(t.disc * 1000) % 10).toBe(0);
    expect(Math.round(t.total * 1000) % 10).toBe(0);
  });
  it('every reachable total is a whole number of 10 fils', () => {
    for (let quarters = 1; quarters < 400; quarters++) {
      const sub = quarters / 4;
      for (const promo of ['', 'WASMI10']) {
        const t = computeTotals(sub, promo, true);
        expect(Math.round(t.total * 1000) % 10, `${sub} ${promo}`).toBe(0);
      }
    }
  });
});
