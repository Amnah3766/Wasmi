import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from './db';
import { HttpError } from './errors';
import type { PublicReview, SessionUser } from './shop/types';
import { relativeArabic } from './time';
import type { ReviewInput } from './validators';
import { Product } from '../models/Product';
import { Review, type ReviewDoc } from '../models/Review';

// Reviews for a product page: seeded samples + real reviews by signed-in customers. The author of a real review is
// ALWAYS the user from the verified token (id + account name); `mine` is computed on the server.

export const REVIEW_PRODUCT_NOT_FOUND = 'المنتج مو موجود';
const SLUG_RE = /^[a-z0-9-]{2,40}$/;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

/** Original sample index from "<slug>-<i>" (samples sort after real reviews, in their original order). */
function sampleIndex(key: string | null | undefined): number {
  const m = /-(\d+)$/.exec(key ?? '');
  return m ? Number(m[1]) : 0;
}

/** Plain, serialisable review for the browser (no ObjectIds, no user id). */
export function publicReview(doc: ReviewDoc, viewerUserId: string | null, now: number = Date.now()): PublicReview {
  const created = doc.createdAt ? new Date(doc.createdAt).getTime() : 0;
  const sample = Boolean(doc.sample);
  return {
    id: String(doc._id),
    name: doc.name,
    rating: doc.rating,
    text: doc.text,
    when: sample ? doc.whenLabel || '' : relativeArabic(created || now, now),
    ts: sample ? -sampleIndex(doc.sampleKey) : created,
    sample,
    mine: !sample && viewerUserId != null && doc.user != null && String(doc.user) === viewerUserId,
    helpful: Number(doc.helpfulBase) || 0,
  };
}

/** Newest first: real reviews by time, then the samples in their original order (ts 0, -1, …). */
function sortReviews(list: PublicReview[]): PublicReview[] {
  return list.sort((a, b) => b.ts - a.ts);
}

async function productExists(slug: string): Promise<{ _id: mongoose.Types.ObjectId } | null> {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) return null;
  await connectDB();
  return Product.findOne({ slug }).select('_id').lean<{ _id: mongoose.Types.ObjectId }>();
}

/** All reviews of a product (null when the product does not exist → 404). */
export async function listReviewsForProduct(slug: string, viewerUserId: string | null): Promise<PublicReview[] | null> {
  if (!(await productExists(slug))) return null;
  const docs = await Review.find({ productSlug: slug }).sort({ createdAt: -1 }).limit(500).lean<ReviewDoc[]>();
  const now = Date.now();
  return sortReviews(docs.map((d) => publicReview(d, viewerUserId, now)));
}

/**
 * Adds a review by the signed-in user (name = account name from the token). Returns the new review and the
 * product's updated list. Throws HttpError 404 when the product does not exist.
 */
export async function createReviewForUser(
  user: SessionUser,
  slug: string,
  input: ReviewInput,
): Promise<{ review: PublicReview; reviews: PublicReview[] }> {
  const product = await productExists(slug);
  if (!product) throw new HttpError(404, REVIEW_PRODUCT_NOT_FOUND);
  const doc = await Review.create({
    product: product._id,
    productSlug: slug,
    user: new mongoose.Types.ObjectId(user.id),
    name: (user.name || 'عميل وسمي').slice(0, 80),
    rating: input.rating,
    text: input.text,
    sample: false,
    whenLabel: '',
    helpfulBase: 0,
  });
  const review = publicReview(doc.toObject() as ReviewDoc, user.id);
  const reviews = (await listReviewsForProduct(slug, user.id)) ?? [review];
  return { review, reviews };
}

/** Deletes one of the user's own (non-sample) reviews. False when not found, not theirs, or a sample (→ 404). */
export async function deleteOwnReview(userId: string, reviewId: string): Promise<boolean> {
  if (!OBJECT_ID_RE.test(String(reviewId)) || !OBJECT_ID_RE.test(String(userId))) return false;
  await connectDB();
  const res = await Review.deleteOne({ _id: reviewId, user: userId, sample: { $ne: true } });
  return res.deletedCount === 1;
}
