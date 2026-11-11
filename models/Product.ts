// Store product (one candle / perfume / incense). SKILL.md fields: name, description, price, image, category, createdAt
// — plus everything the storefront shows (slug, sizes, notes, seasons, meters, pairing…). The rating is NOT stored here:
// it is aggregated from the Review collection when the catalog is loaded.
// PRICE: `price` is the base price in KWD (= the default size, factor 1). Size prices are price × factor, rounded to a
// quarter dinar by lib/shop/pricing.ts — on the server for orders, in the browser only for display.
import mongoose, { type Model, type Types } from 'mongoose';
import type { Category, Kind, Mood, TimeOfDay } from '../lib/shop/types';

const { Schema, model, models } = mongoose;

export const CATEGORIES: readonly Category[] = ['candle', 'perfume', 'incense'];
export const KINDS: readonly Kind[] = ['jar', 'bottle', 'incense'];
export const MOODS: readonly Mood[] = ['calm', 'fresh', 'warm', 'bold'];
export const TIMES: readonly TimeOfDay[] = ['morning', 'evening', 'night'];

export interface ProductFields {
  slug: string;
  name: string;
  nameEn: string;
  category: Category;
  kind: Kind;
  price: number;
  sizes: Array<{ label: string; factor: number }>;
  defaultSize: number;
  notes: { top: string; heart: string; base: string };
  moment: string;
  description: string;
  story: string;
  colors: { c1: string; c2: string };
  seasons: number[];
  allYear: boolean;
  moods: Mood[];
  times: TimeOfDay[];
  meters: number[];
  pairSlug: string | null;
  suits: string[];
  usage: string;
  care: string;
  image: string;
  sortOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ProductDoc = ProductFields & { _id: Types.ObjectId };

const HEX = /^#[0-9a-f]{6}$/i;

const SizeSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    factor: { type: Number, required: true, min: 0.01 },
  },
  { _id: false },
);

const ProductSchema = new Schema<ProductFields>(
  {
    // unique ⇒ indexed (no separate `index: true`, which would declare the same index twice)
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]{2,40}$/ },
    name: { type: String, required: true, trim: true },
    nameEn: { type: String, required: true, trim: true },
    category: { type: String, required: true, enum: CATEGORIES, index: true },
    kind: { type: String, required: true, enum: KINDS },
    price: { type: Number, required: true, min: 0 },
    sizes: {
      type: [SizeSchema],
      required: true,
      validate: { validator: (v: unknown[]) => Array.isArray(v) && v.length > 0, message: 'A product needs at least one size.' },
    },
    defaultSize: { type: Number, required: true, min: 0 },
    notes: {
      top: { type: String, required: true },
      heart: { type: String, required: true },
      base: { type: String, required: true },
    },
    moment: { type: String, required: true },
    description: { type: String, required: true },
    story: { type: String, default: '' },
    colors: {
      c1: { type: String, required: true, match: HEX },
      c2: { type: String, required: true, match: HEX },
    },
    seasons: { type: [{ type: Number, min: 1, max: 12 }], default: [] },
    allYear: { type: Boolean, default: false },
    moods: { type: [{ type: String, enum: MOODS }], default: [] },
    times: { type: [{ type: String, enum: TIMES }], default: [] },
    meters: {
      type: [{ type: Number, min: 0, max: 100 }],
      validate: { validator: (v: unknown[]) => Array.isArray(v) && v.length === 4, message: 'meters needs exactly 4 values.' },
    },
    pairSlug: { type: String, default: null },
    suits: { type: [String], default: [] },
    usage: { type: String, default: '' },
    care: { type: String, default: '' },
    image: { type: String, required: true },
    sortOrder: { type: Number, default: 0, index: true },
  },
  { timestamps: true },
);

export const Product: Model<ProductFields> =
  (models.Product as Model<ProductFields> | undefined) ?? model<ProductFields>('Product', ProductSchema);
