import { describe, expect, it } from 'vitest';
import { PRODUCTS } from '../scripts/seed/products-data';
import { HttpError } from './errors';
import { ORDER_LINES_INVALID_MESSAGE, priceOrder } from './orderPricing';
import { BOX_NAME } from './shop/labels';
import { validateOrder } from './validators';

// Product "documents" as they come from MongoDB (seed data + a fake _id each).
const DOCS = PRODUCTS.map((p, i) => ({ ...p, _id: `id-${p.slug}-${i}` }));
const id = (slug: string) => DOCS.find((d) => d.slug === slug)!._id;
const priced = (lines: unknown[], promo = '') => priceOrder({ lines: lines as never, promo }, DOCS);

function expectInvalid(fn: () => unknown) {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).message).toBe(ORDER_LINES_INVALID_MESSAGE);
    expect((error as HttpError).details).toEqual({ fields: { lines: 'invalid' } });
    return;
  }
  throw new Error('expected priceOrder to throw');
}

describe('priceOrder — product lines', () => {
  it('prices from the DB product, with a snapshot (name, detail, colors, size)', () => {
    const r = priced([{ t: 'p', id: 'awal', vi: 0, q: 2 }]);
    expect(r.items).toEqual([
      {
        kind: 'product',
        product: id('awal'),
        products: [],
        slug: 'awal',
        slugs: [],
        name: 'تراب الوسمي',
        detail: 'شمعة · 90 غ · 20 ساعة',
        sizeLabel: '90 غ · 20 ساعة',
        sizeIndex: 0,
        note: '',
        quantity: 2,
        price: 6.25,
        lineTotal: 12.5,
        colors: { c1: '#B07A4F', c2: '#4A2E1E', c3: '#4A2E1E' },
      },
    ]);
    expect(r).toMatchObject({ subtotal: 12.5, discount: 0, shipping: 1.5, total: 14, promoCode: null });
  });

  it('uses each category size table (perfume 100 مل = 18 × 1.7 → 30.5, incense 120 غ = 12 × 1.8 → 21.5)', () => {
    const r = priced([
      { t: 'p', id: 'ghubar', vi: 2, q: 1 },
      { t: 'p', id: 'jadda', vi: 1, q: 1 },
    ]);
    expect(r.items.map((i) => [i.price, i.detail])).toEqual([
      [30.5, 'عطر · 100 مل'],
      [21.5, 'بخور · 120 غ'],
    ]);
    expect(r).toMatchObject({ subtotal: 52, shipping: 0, total: 52 });
  });

  it('ignores any price / total / user injected into the request', () => {
    const r = priceOrder(
      {
        lines: [{ t: 'p', id: 'awal', vi: 1, q: 1, price: 0.001, lineTotal: 0, unit: 0 } as never],
        promo: '',
        ...({ total: 0, subtotal: 0, discount: 999, shipping: 0, user: 'someone-else' } as object),
      } as never,
      DOCS,
    );
    expect(r.items[0].price).toBe(9.5);
    expect(r).toEqual(expect.objectContaining({ subtotal: 9.5, discount: 0, shipping: 1.5, total: 11 }));
    expect(r).not.toHaveProperty('user');
  });

  it('end to end with the validator: a tampered body still gets server prices', () => {
    const v = validateOrder({
      lines: [{ t: 'p', id: 'bar', vi: 1, q: 3, price: 1 }],
      promo: '',
      total: 1,
      user: '000000000000000000000000',
      delivery: { name: 'سعود', phone: '99998888', area: 'حولي', address: 'قطعة 1 شارع 2' },
    });
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect(priceOrder(v.data, DOCS)).toMatchObject({ subtotal: 36, discount: 0, shipping: 0, total: 36 });
  });

  it('rejects unknown slugs and size indexes the product does not have', () => {
    expectInvalid(() => priced([{ t: 'p', id: 'nope', vi: 0, q: 1 }]));
    expectInvalid(() => priced([{ t: 'p', id: 'awal', vi: 2, q: 1 }])); // candles have 2 sizes
    expectInvalid(() => priced([{ t: 'p', id: 'jadda', vi: -1, q: 1 }]));
    expectInvalid(() => priced([{ t: 'p', id: 'ghubar', vi: 1.5, q: 1 }]));
    expectInvalid(() => priced([]));
    expectInvalid(() => priceOrder({ lines: [{ t: 'p', id: 'awal', vi: 1, q: 1 }], promo: '' }, []));
  });
});

describe('priceOrder — gift box', () => {
  it('3 distinct scents, default sizes, −15 %, quarter rounding, name + note detail, colors from each scent', () => {
    const r = priced([{ t: 'b', ids: ['awal', 'fajr', 'suhail'], note: 'مبروك النجاح', q: 2 }]);
    expect(r.items[0]).toEqual({
      kind: 'box',
      product: null,
      products: [id('awal'), id('fajr'), id('suhail')],
      slug: 'box',
      slugs: ['awal', 'fajr', 'suhail'],
      name: BOX_NAME,
      detail: 'تراب الوسمي + ملح وعنبر + عرعر الليل · «مبروك النجاح»',
      sizeLabel: '',
      sizeIndex: null,
      note: 'مبروك النجاح',
      quantity: 2,
      price: 25.5,
      lineTotal: 51,
      colors: { c1: '#B07A4F', c2: '#D9A27A', c3: '#8C4B3A' },
    });
    expect(r).toMatchObject({ subtotal: 51, shipping: 0, total: 51 });
  });

  it('no note → names only; mixed categories use each default size', () => {
    const r = priced([{ t: 'b', ids: ['jumaa', 'dala', 'werd'], note: '', q: 1 }]);
    expect(r.items[0].detail).toBe('لبان ومستكة + قهوة وهيل + ياسمين ومسك');
    expect(r.items[0].price).toBe(28); // (8.5 + 9 + 15.5) × 0.85 = 28.05 → 28
  });

  it('rejects duplicates, wrong counts and unknown scents', () => {
    expectInvalid(() => priced([{ t: 'b', ids: ['awal', 'awal', 'fajr'], note: '', q: 1 }]));
    expectInvalid(() => priced([{ t: 'b', ids: ['awal', 'fajr'], note: '', q: 1 }]));
    expectInvalid(() => priced([{ t: 'b', ids: ['awal', 'fajr', 'nope'], note: '', q: 1 }]));
  });
});

describe('priceOrder — promo and delivery', () => {
  it('WASMI10 (any case) takes 10 % off and is stored normalised', () => {
    expect(priced([{ t: 'p', id: 'awal', vi: 1, q: 1 }], ' wasmi10 ')).toMatchObject({
      subtotal: 9.5,
      discount: 0.95,
      shipping: 1.5,
      total: 10.05,
      promoCode: 'WASMI10',
    });
  });
  it('unknown codes give no discount and promoCode null', () => {
    expect(priced([{ t: 'p', id: 'awal', vi: 1, q: 1 }], 'FREE50')).toMatchObject({ discount: 0, total: 11, promoCode: null });
    expect(priced([{ t: 'p', id: 'awal', vi: 1, q: 1 }], '')).toMatchObject({ promoCode: null });
  });
  it('free delivery from 25 KWD after the discount', () => {
    // 3 × 9 = 27 → −2.7 = 24.3 < 25 → 1.5 delivery
    expect(priced([{ t: 'p', id: 'dala', vi: 1, q: 3 }], 'WASMI10')).toMatchObject({ subtotal: 27, discount: 2.7, shipping: 1.5, total: 25.8 });
    // 25.5 box → free
    expect(priced([{ t: 'b', ids: ['awal', 'fajr', 'suhail'], note: '', q: 1 }])).toMatchObject({ subtotal: 25.5, shipping: 0, total: 25.5 });
  });
  it('sums several lines with 3-decimal precision', () => {
    const r = priced([
      { t: 'p', id: 'awal', vi: 0, q: 3 }, // 6.25 × 3
      { t: 'p', id: 'werd', vi: 0, q: 1 }, // 15.5 × 0.65 = 10.075 → 10
      { t: 'p', id: 'jumaa', vi: 1, q: 2 }, // 8.5 × 1.8 = 15.3 → 15.25
    ]);
    expect(r.items.map((i) => i.lineTotal)).toEqual([18.75, 10, 30.5]);
    expect(r).toMatchObject({ subtotal: 59.25, total: 59.25 });
  });
});
