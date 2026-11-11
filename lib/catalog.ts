import 'server-only';
import { cache } from 'react';
import { connectDB } from './db';
import type { CatalogProduct, Category, Kind, Mood, TimeOfDay } from './shop/types';
import { Product, type ProductFields } from '../models/Product';
import { Review } from '../models/Review';

// Server-side product loading for every page and API route: products come from MongoDB Atlas (models/Product), sorted
// by the stored display order, with ratings aggregated from the Review collection. There is no hardcoded fallback —
// if the database is unreachable the caller gets the error (API → 503; pages: check isDatabaseUnavailable(error)).

export type Rating = CatalogProduct['rating'];

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

/** Maps a Product document (lean or hydrated) to the plain, serialisable CatalogProduct — no ObjectIds, no Dates. */
export function toCatalogProduct(doc: ProductFields, rating: Rating = { avg: 0, n: 0 }): CatalogProduct {
  return {
    slug: doc.slug,
    name: doc.name,
    nameEn: doc.nameEn,
    category: doc.category as Category,
    kind: doc.kind as Kind,
    price: Number(doc.price),
    sizes: (doc.sizes ?? []).map((s) => ({ label: s.label, factor: Number(s.factor) })),
    defaultSize: Number(doc.defaultSize ?? 0),
    notes: { top: doc.notes?.top ?? '', heart: doc.notes?.heart ?? '', base: doc.notes?.base ?? '' },
    moment: doc.moment ?? '',
    description: doc.description ?? '',
    story: doc.story ?? '',
    colors: { c1: doc.colors?.c1 ?? '#8C4B3A', c2: doc.colors?.c2 ?? '#2D1613' },
    seasons: [...(doc.seasons ?? [])].map(Number),
    allYear: Boolean(doc.allYear),
    moods: [...(doc.moods ?? [])] as Mood[],
    times: [...(doc.times ?? [])] as TimeOfDay[],
    meters: [...(doc.meters ?? [])].map(Number),
    pairSlug: doc.pairSlug ?? null,
    suits: [...(doc.suits ?? [])],
    usage: doc.usage ?? '',
    care: doc.care ?? '',
    image: doc.image ?? '',
    sortOrder: Number(doc.sortOrder ?? 0),
    rating: { avg: Number(rating.avg) || 0, n: Number(rating.n) || 0 },
  };
}

/** { slug → { avg, n } } over every review (samples + real) — one aggregation for the whole catalog. */
async function loadRatings(): Promise<Map<string, Rating>> {
  const rows = await Review.aggregate<{ _id: string; avg: number; n: number }>([
    { $group: { _id: '$productSlug', avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, { avg: Math.round(r.avg * 100) / 100, n: r.n }]));
}

/** The whole catalog (12 products), memoised per request with React `cache`. */
export const getCatalog = cache(async (): Promise<CatalogProduct[]> => {
  await connectDB();
  const [docs, ratings] = await Promise.all([
    Product.find({}).sort({ sortOrder: 1, createdAt: 1 }).lean<ProductFields[]>(),
    loadRatings(),
  ]);
  return docs.map((d) => toCatalogProduct(d, ratings.get(d.slug)));
});

/** One product by slug, or null (invalid slug or not in the database). Shares getCatalog's per-request cache. */
export const getProduct = cache(async (slug: string): Promise<CatalogProduct | null> => {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return null;
  return (await getCatalog()).find((p) => p.slug === slug) ?? null;
});
