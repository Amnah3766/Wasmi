import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Product } from '../../models/Product';
import { Review } from '../../models/Review';
import { CARE_BY_CATEGORY, DEFAULT_SIZE_BY_CATEGORY, PRODUCTS, SIZES_BY_CATEGORY, USAGE_BY_CATEGORY } from './products-data';
import { SEED_REVIEWS } from './reviews-data';

const slugs = PRODUCTS.map((p) => p.slug);

describe('seed products — integrity', () => {
  it('has the 12 original products in order, with unique slugs and sortOrder 0..11', () => {
    expect(PRODUCTS).toHaveLength(12);
    expect(new Set(slugs).size).toBe(12);
    expect(slugs).toEqual(['awal', 'fajr', 'suhail', 'dala', 'bar', 'ghubar', 'rutab', 'shat', 'werd', 'jadda', 'ghaim', 'jumaa']);
    expect(PRODUCTS.map((p) => p.sortOrder)).toEqual([...Array(12).keys()]);
    for (const p of PRODUCTS) expect(p.slug).toMatch(/^[a-z0-9-]{2,40}$/);
  });

  it('every pairSlug points to another existing product', () => {
    for (const p of PRODUCTS) {
      expect(p.pairSlug, p.slug).not.toBeNull();
      expect(slugs, p.slug).toContain(p.pairSlug);
      expect(p.pairSlug).not.toBe(p.slug);
    }
  });

  it('seasons are months 1..12, and allYear ⇔ all 12 months', () => {
    for (const p of PRODUCTS) {
      expect(p.seasons.length, p.slug).toBeGreaterThan(0);
      for (const m of p.seasons) expect(Number.isInteger(m) && m >= 1 && m <= 12, `${p.slug}: ${m}`).toBe(true);
      expect(new Set(p.seasons).size, p.slug).toBe(p.seasons.length);
      expect(p.allYear, p.slug).toBe(new Set(p.seasons).size === 12);
    }
    expect(PRODUCTS.filter((p) => p.allYear).map((p) => p.slug)).toEqual(['jadda', 'jumaa']);
  });

  it('sizes, default size, usage and care match the category', () => {
    for (const p of PRODUCTS) {
      expect(p.sizes, p.slug).toEqual(SIZES_BY_CATEGORY[p.category]);
      expect(p.defaultSize).toBe(DEFAULT_SIZE_BY_CATEGORY[p.category]);
      expect(p.sizes[p.defaultSize].factor, `${p.slug} default factor`).toBe(1);
      expect(p.usage).toBe(USAGE_BY_CATEGORY[p.category]);
      expect(p.care).toBe(CARE_BY_CATEGORY[p.category]);
      expect(p.kind).toBe({ candle: 'jar', perfume: 'bottle', incense: 'incense' }[p.category]);
    }
    expect(SIZES_BY_CATEGORY.candle).toHaveLength(2);
    expect(SIZES_BY_CATEGORY.perfume).toHaveLength(3);
    expect(SIZES_BY_CATEGORY.incense).toHaveLength(2);
  });

  it('prices, meters, colors and images are well formed', () => {
    for (const p of PRODUCTS) {
      expect(p.price, p.slug).toBeGreaterThan(0);
      expect(Math.round(p.price * 4) / 4).toBe(p.price);
      expect(p.meters, p.slug).toHaveLength(4);
      for (const m of p.meters) expect(m >= 0 && m <= 100).toBe(true);
      expect(p.colors.c1).toMatch(/^#[0-9A-F]{6}$/i);
      expect(p.colors.c2).toMatch(/^#[0-9A-F]{6}$/i);
      expect(p.image).toBe(`/images/products/${p.slug}.svg`);
      expect(p.suits.length).toBeGreaterThan(0);
      expect(p.moods.length).toBeGreaterThan(0);
      expect(p.times.length).toBeGreaterThan(0);
    }
  });

  it('every product passes the Mongoose Product schema', async () => {
    for (const p of PRODUCTS) await expect(new Product(p).validate(), p.slug).resolves.toBeUndefined();
  });

  it('the Product schema rejects broken data (bad month, 3 meters, unknown category)', async () => {
    const p = PRODUCTS[0];
    await expect(new Product({ ...p, seasons: [13] }).validate()).rejects.toThrow();
    await expect(new Product({ ...p, meters: [1, 2, 3] }).validate()).rejects.toThrow();
    await expect(new Product({ ...p, category: 'soap' }).validate()).rejects.toThrow();
    await expect(new Product({ ...p, price: -1 }).validate()).rejects.toThrow();
  });
});

describe('seed reviews — integrity', () => {
  it('24 samples (2 per product) with unique keys that reference existing slugs', () => {
    expect(SEED_REVIEWS).toHaveLength(24);
    expect(new Set(SEED_REVIEWS.map((r) => r.sampleKey)).size).toBe(24);
    for (const r of SEED_REVIEWS) {
      expect(slugs, r.sampleKey).toContain(r.productSlug);
      expect(r.sampleKey).toMatch(new RegExp(`^${r.productSlug}-\\d+$`));
      expect(Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5).toBe(true);
      expect(r.text.length).toBeGreaterThan(0);
      expect(r.whenLabel.startsWith('قبل')).toBe(true);
      expect(r.helpfulBase).toBeGreaterThanOrEqual(0);
    }
    for (const s of slugs) expect(SEED_REVIEWS.filter((r) => r.productSlug === s)).toHaveLength(2);
  });

  it('every sample passes the Mongoose Review schema', async () => {
    for (const r of SEED_REVIEWS) {
      const doc = new Review({ ...r, product: new mongoose.Types.ObjectId(), user: null, sample: true });
      await expect(doc.validate(), r.sampleKey).resolves.toBeUndefined();
    }
  });
});

describe('seed data is copied exactly from original/index.html', () => {
  // Evaluate the original data literals (VAR / DEFV / USE / CARE / P / EXTRA / SEED) in a sandbox and compare.
  const html = readFileSync(fileURLToPath(new URL('../../original/index.html', import.meta.url)), 'utf8');
  const grab = (start: string, end: string) => {
    const i = html.indexOf(start);
    const j = html.indexOf(end, i);
    if (i < 0 || j < 0) throw new Error(`cannot find ${start}`);
    return html.slice(i, j);
  };
  const code = [
    grab('var VAR=', 'var P=['),
    grab('var P=[', 'function byId'),
    grab('var EXTRA=', 'P.forEach(function(p){var x=EXTRA'),
    grab('var SEED=', 'var myRv='),
  ].join('\n');
  const O = vm.runInNewContext(`${code}\n({ VAR, DEFV, USE, CARE, P, EXTRA, SEED })`) as {
    VAR: Record<string, Array<{ l: string; m: number }>>;
    DEFV: Record<string, number>;
    USE: Record<string, string>;
    CARE: Record<string, string>;
    P: Array<Record<string, unknown>>;
    EXTRA: Record<string, { story: string; m: number[]; pair: string; suits: string[] }>;
    SEED: Record<string, Array<[string, number, string, string, number]>>;
  };
  const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));

  it('products (P + EXTRA, original order)', () => {
    const expected = O.P.map((p, i) => {
      const x = O.EXTRA[p.id as string];
      const cat = p.cat as string;
      return {
        slug: p.id,
        name: p.name,
        nameEn: p.en,
        category: cat,
        kind: p.kind,
        price: p.price,
        notes: { top: p.top, heart: p.heart, base: p.base },
        moment: p.moment,
        description: p.desc,
        story: x.story,
        colors: { c1: p.c1, c2: p.c2 },
        seasons: p.seasons,
        allYear: !!p.all,
        moods: p.moods,
        times: p.times,
        meters: x.m,
        pairSlug: x.pair,
        suits: x.suits,
        sizes: O.VAR[cat].map((s) => ({ label: s.l, factor: s.m })),
        defaultSize: O.DEFV[cat],
        usage: O.USE[cat],
        care: O.CARE[cat],
        image: `/images/products/${p.id}.svg`,
        sortOrder: i,
      };
    });
    expect(plain(PRODUCTS)).toEqual(plain(expected));
  });

  it('sample reviews (SEED)', () => {
    const expected = Object.entries(O.SEED).flatMap(([slug, list]) =>
      list.map((s, i) => ({ sampleKey: `${slug}-${i}`, productSlug: slug, name: s[0], rating: s[1], text: s[2], whenLabel: s[3], helpfulBase: s[4] ?? 0 })),
    );
    expect(plain(SEED_REVIEWS)).toEqual(plain(expected));
  });
});
