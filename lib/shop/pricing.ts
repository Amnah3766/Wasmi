// Store pricing rules, shared by the browser (display) and the server (the only source of truth for saved orders).
// They are business rules, not product data: every product price comes from MongoDB.
import type { CartLine, CatalogProduct } from './types';

export const CURRENCY = 'د.ك';
export const DECIMALS = 3;
export const FREE_SHIPPING_FROM = 25;
export const SHIPPING_FEE = 1.5;
export const BOX_DISCOUNT = 0.15;
export const BOX_SIZE = 3;
export const MAX_LINE_QTY = 99;
export const MAX_PDP_QTY = 20;
export const PROMOS: Readonly<Record<string, number>> = { WASMI10: 0.1 };

/** 9.5 → "9.500 د.ك" (always 3 decimals, Latin digits, currency after the number). */
export function fmt(n: number): string {
  return (Number.isFinite(n) ? n : 0).toFixed(DECIMALS) + ' ' + CURRENCY;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Nearest 10 fils (0.010 KWD) — the smallest step Stripe accepts for three-decimal currencies. */
export function roundFils10(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Quarter-dinar rounding used by the original store for sizes and boxes. */
export function roundQuarter(n: number): number {
  return Math.round(n * 4) / 4;
}

type Priced = Pick<CatalogProduct, 'price' | 'sizes' | 'defaultSize'>;

export function isValidSize(p: Pick<CatalogProduct, 'sizes'>, vi: number): boolean {
  return Number.isInteger(vi) && vi >= 0 && vi < p.sizes.length;
}

/** Unit price of size `vi` (falls back to the default size). */
export function sizePrice(p: Priced, vi: number): number {
  const size = p.sizes[vi] ?? p.sizes[p.defaultSize];
  return roundQuarter(p.price * (size ? size.factor : 1));
}

export function defaultPrice(p: Priced): number {
  return sizePrice(p, p.defaultSize);
}

export function boxSum(items: Priced[]): number {
  return items.reduce((a, p) => a + defaultPrice(p), 0);
}

/** A 3-scent gift box: sum of default sizes minus 15 %, rounded to a quarter dinar. */
export function boxPrice(items: Priced[]): number {
  return roundQuarter(boxSum(items) * (1 - BOX_DISCOUNT));
}

export function normalizePromo(code: unknown): string {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

export function promoRate(code: string): number {
  return PROMOS[normalizePromo(code)] ?? 0;
}

export interface Totals {
  sub: number;
  disc: number;
  after: number;
  ship: number;
  total: number;
}

/** Same arithmetic as the original store: discount on the subtotal, free delivery from 25 KWD after discount. */
export function computeTotals(subtotal: number, promo: string, hasLines: boolean): Totals {
  const sub = round3(subtotal);
  // Rounded to 10 fils: Stripe only accepts KWD amounts whose last digit is 0, so the page, the server and Stripe agree.
  const disc = roundFils10(sub * promoRate(promo));
  const after = round3(sub - disc);
  const ship = hasLines ? (after >= FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE) : 0;
  return { sub, disc, after, ship, total: round3(after + ship) };
}

export function lineKey(l: CartLine): string {
  return l.t === 'p' ? `p|${l.id}|${l.vi}` : `b|${l.ids.slice().sort().join(',')}|${l.note || ''}`;
}

/** Unit price of a cart line using the given catalog lookup; null if a product is missing. */
export function lineUnit(l: CartLine, bySlug: (slug: string) => Priced | undefined): number | null {
  if (l.t === 'p') {
    const p = bySlug(l.id);
    return p ? sizePrice(p, l.vi) : null;
  }
  const items = l.ids.map(bySlug);
  if (items.length !== BOX_SIZE || items.some((x) => !x)) return null;
  return boxPrice(items as Priced[]);
}
