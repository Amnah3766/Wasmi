// Shared shapes between the server (MongoDB → API/pages) and the browser (React UI).
// Product data itself lives ONLY in MongoDB (seeded from scripts/seed/products-data.ts); nothing here is product data.

export type Category = 'candle' | 'perfume' | 'incense';
export type Kind = 'jar' | 'bottle' | 'incense';
export type Mood = 'calm' | 'fresh' | 'warm' | 'bold';
export type TimeOfDay = 'morning' | 'evening' | 'night';

export interface ProductSize {
  /** e.g. "220 غ · 45 ساعة" or "50 مل" */
  label: string;
  /** Multiplier on the base price (the default size has factor 1). */
  factor: number;
}

/** One product as the UI receives it (serialised from the Product document). */
export interface CatalogProduct {
  slug: string;
  name: string; // Arabic name
  nameEn: string;
  category: Category;
  kind: Kind;
  /** Base price in KWD (= price of the default size). */
  price: number;
  sizes: ProductSize[];
  defaultSize: number;
  notes: { top: string; heart: string; base: string };
  moment: string;
  description: string;
  story: string;
  colors: { c1: string; c2: string };
  seasons: number[]; // months 1-12
  allYear: boolean;
  moods: Mood[];
  times: TimeOfDay[];
  /** Meter values 0-100: [light→strong, fresh→warm, dry→sweet, day→night] */
  meters: number[];
  pairSlug: string | null;
  suits: string[];
  usage: string;
  care: string;
  image: string;
  sortOrder: number;
  rating: { avg: number; n: number };
}

/** Cart line kept in the browser (localStorage). Only slugs, size index, quantity and note — never prices. */
export type CartLine =
  | { t: 'p'; id: string; vi: number; q: number }
  | { t: 'b'; ids: string[]; note: string; q: number };

export type PaymentMethod = 'cod' | 'link' | 'stripe';

export interface DeliveryInfo {
  name: string;
  phone: string;
  area: string;
  address: string;
  slot: string;
}

/** Body of POST /api/checkout (card payment through Stripe). Prices, totals and user ids are never read from it. */
export type CheckoutRequest = Omit<OrderRequest, 'payment'>;

/** Body of POST /api/orders. Any price, total or user field the browser adds is ignored by the server. */
export interface OrderRequest {
  lines: CartLine[];
  promo: string;
  delivery: DeliveryInfo;
  payment: PaymentMethod;
}

export interface PublicOrderItem {
  kind: 'product' | 'box';
  slug: string; // product slug, or "box"
  slugs: string[]; // box contents (empty for a product line)
  name: string;
  detail: string;
  quantity: number;
  price: number; // unit price at order time (server-computed)
  lineTotal: number;
  colors: { c1: string; c2: string; c3: string };
}

export interface PublicOrder {
  id: string;
  orderNo: string;
  status: 'pending' | 'paid';
  items: PublicOrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  promoCode: string | null;
  delivery: DeliveryInfo;
  payment: PaymentMethod;
  /** When Stripe confirmed the payment (card orders only). */
  paidAt: string | null;
  /** What Stripe actually charged (card orders): minor units + currency, e.g. { amount: 3575, currency: 'usd' }. */
  charged: { amount: number; currency: string } | null;
  createdAt: string | null;
}

export interface PublicReview {
  id: string;
  name: string;
  rating: number;
  text: string;
  /** Display label: "قبل أسبوعين" for samples, relative time for real reviews. */
  when: string;
  /** Sort key: createdAt ms for real reviews, -index for samples. */
  ts: number;
  sample: boolean;
  mine: boolean;
  helpful: number;
}

export interface SessionUser {
  id: string;
  name: string;
}

/** API error body. `fields` maps a field name to a validation code. */
export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}
