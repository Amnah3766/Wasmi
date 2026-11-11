// Order. SKILL.md fields: user (ref User), items (product, quantity, price), total, status (pending / paid), createdAt.
// - `user` always comes from the verified login token on the server — never from the browser.
// - Every item's unit `price`, `lineTotal`, and subtotal / discount / shipping / total are computed on the server from
//   the Product documents (lib/orderPricing.ts). Items also keep a display snapshot (name, detail, colors) so past
//   orders still read correctly if a product changes later.
import mongoose, { type Model, type Types } from 'mongoose';
import type { PaymentMethod } from '../lib/shop/types';

const { Schema, model, models } = mongoose;

export const ORDER_NO_RE = /^WSM-\d{6}$/;

export interface OrderItemFields {
  kind: 'product' | 'box';
  product?: Types.ObjectId | null;
  products: Types.ObjectId[];
  slug: string;
  slugs: string[];
  name: string;
  detail: string;
  sizeLabel: string;
  sizeIndex: number | null;
  note: string;
  quantity: number;
  price: number;
  lineTotal: number;
  colors: { c1: string; c2: string; c3: string };
}

export interface OrderFields {
  user: Types.ObjectId;
  orderNo: string;
  items: OrderItemFields[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  promoCode: string | null;
  delivery: { name: string; phone: string; area: string; address: string; slot: string };
  paymentMethod: PaymentMethod;
  status: 'pending' | 'paid';
  /** Card orders only (Day 5): the Stripe Checkout Session that paid this order. Unique, so a payment saves ONE order. */
  stripeSessionId?: string;
  paymentIntentId?: string | null;
  /** Stripe charge currency (usd or kwd), the amount Stripe charged in its minor units, and the KWD rate used. */
  currency?: string;
  amountCharged?: number;
  exchangeRate?: number;
  paidAt?: Date | null;
  createdAt?: Date;
}

export type OrderDoc = OrderFields & { _id: Types.ObjectId };

const OrderItemSchema = new Schema<OrderItemFields>(
  {
    kind: { type: String, required: true, enum: ['product', 'box'] },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
      required: [
        function (this: { kind?: string }) {
          return this.kind === 'product';
        },
        'A product line needs its product.',
      ],
    },
    products: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
    slug: { type: String, required: true },
    slugs: { type: [String], default: [] },
    name: { type: String, required: true },
    detail: { type: String, default: '' },
    sizeLabel: { type: String, default: '' },
    sizeIndex: { type: Number, default: null },
    note: { type: String, default: '', maxlength: 80 },
    quantity: { type: Number, required: true, min: 1, max: 99 },
    price: { type: Number, required: true, min: 0 }, // unit price at order time (server-computed)
    lineTotal: { type: Number, required: true, min: 0 },
    colors: {
      c1: { type: String, default: '' },
      c2: { type: String, default: '' },
      c3: { type: String, default: '' },
    },
  },
  { _id: false },
);

const OrderSchema = new Schema<OrderFields>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderNo: { type: String, required: true, unique: true, match: ORDER_NO_RE },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: { validator: (v: unknown[]) => Array.isArray(v) && v.length > 0, message: 'An order needs at least one item.' },
    },
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    shipping: { type: Number, required: true, min: 0, default: 0 },
    total: { type: Number, required: true, min: 0 },
    promoCode: { type: String, default: null },
    delivery: {
      name: { type: String, required: true, maxlength: 80 },
      phone: { type: String, required: true, maxlength: 16 },
      area: { type: String, required: true, maxlength: 60 },
      address: { type: String, required: true, maxlength: 300 },
      slot: { type: String, required: true },
    },
    paymentMethod: { type: String, required: true, enum: ['cod', 'link', 'stripe'], default: 'cod' },
    status: { type: String, required: true, enum: ['pending', 'paid'], default: 'pending' },
    stripeSessionId: { type: String, default: undefined },
    paymentIntentId: { type: String, default: null },
    currency: { type: String, default: undefined },
    amountCharged: { type: Number, min: 0, default: undefined },
    exchangeRate: { type: Number, min: 0, default: undefined },
    paidAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

OrderSchema.index({ user: 1, createdAt: -1 });
// One order per Stripe Checkout Session (the success page and the webhook may both try to save it).
OrderSchema.index({ stripeSessionId: 1 }, { unique: true, partialFilterExpression: { stripeSessionId: { $type: 'string' } } });

export const Order: Model<OrderFields> = (models.Order as Model<OrderFields> | undefined) ?? model<OrderFields>('Order', OrderSchema);
