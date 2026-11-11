// Product review. Two sources share this collection:
// - sample reviews from the original store (sample: true, user: null, unique sampleKey "<slug>-<index>", fixed
//   whenLabel like "قبل أسبوعين", helpfulBase votes) — seeded by `npm run seed`, never deletable from the site;
// - real reviews written by signed-in customers (sample: false, user = the token's user id, name = account name).
// Product ratings (avg, n) are aggregated from this collection.
import mongoose, { type Model, type Types } from 'mongoose';

const { Schema, model, models } = mongoose;

export interface ReviewFields {
  product: Types.ObjectId;
  productSlug: string;
  user: Types.ObjectId | null;
  name: string;
  rating: number;
  text: string;
  sample: boolean;
  sampleKey?: string | null;
  whenLabel: string;
  helpfulBase: number;
  createdAt?: Date;
}

export type ReviewDoc = ReviewFields & { _id: Types.ObjectId };

const ReviewSchema = new Schema<ReviewFields>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productSlug: { type: String, required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    rating: { type: Number, required: true, min: 1, max: 5, validate: { validator: Number.isInteger, message: 'rating must be 1-5' } },
    text: { type: String, required: true, trim: true, maxlength: 400 },
    sample: { type: Boolean, default: false },
    // No default: real reviews leave it unset so the sparse unique index ignores them.
    sampleKey: { type: String, unique: true, sparse: true },
    whenLabel: { type: String, default: '' },
    helpfulBase: { type: Number, default: 0, min: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

ReviewSchema.index({ productSlug: 1, createdAt: -1 });

export const Review: Model<ReviewFields> =
  (models.Review as Model<ReviewFields> | undefined) ?? model<ReviewFields>('Review', ReviewSchema);
