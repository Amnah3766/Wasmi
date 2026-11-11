import 'server-only';
import { randomInt } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB } from './db';
import { HttpError } from './errors';
import { priceOrder } from './orderPricing';
import type { OrderRequest, PaymentMethod, PublicOrder } from './shop/types';
import { Order, type OrderDoc } from '../models/Order';
import { Product, type ProductDoc } from '../models/Product';
import { User } from '../models/User';

// Orders are created and read ONLY for the user id taken from the verified session token. Prices and totals are
// computed on the server from MongoDB products (lib/orderPricing.ts); the request body never sets them.

export const ORDER_NOT_FOUND = 'الطلب مو موجود';
export const SIGNED_OUT_ORDER = 'سجّل دخولك عشان ينحفظ طلبك';
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const ORDER_NO_ATTEMPTS = 6;

/** Plain, serialisable order for the browser (no ObjectIds, no user id, ISO date). */
export function publicOrder(doc: OrderDoc): PublicOrder {
  return {
    id: String(doc._id),
    orderNo: doc.orderNo,
    status: doc.status === 'paid' ? 'paid' : 'pending',
    items: (doc.items ?? []).map((i) => ({
      kind: i.kind === 'box' ? 'box' : 'product',
      slug: i.slug,
      slugs: [...(i.slugs ?? [])],
      name: i.name,
      detail: i.detail ?? '',
      quantity: i.quantity,
      price: i.price,
      lineTotal: i.lineTotal,
      colors: { c1: i.colors?.c1 ?? '', c2: i.colors?.c2 ?? '', c3: i.colors?.c3 ?? '' },
    })),
    subtotal: doc.subtotal,
    discount: doc.discount ?? 0,
    shipping: doc.shipping ?? 0,
    total: doc.total,
    promoCode: doc.promoCode ?? null,
    delivery: {
      name: doc.delivery?.name ?? '',
      phone: doc.delivery?.phone ?? '',
      area: doc.delivery?.area ?? '',
      address: doc.delivery?.address ?? '',
      slot: doc.delivery?.slot ?? '',
    },
    payment: (doc.paymentMethod as PaymentMethod) ?? 'cod',
    paidAt: doc.paidAt ? new Date(doc.paidAt).toISOString() : null,
    charged: typeof doc.amountCharged === 'number' && doc.currency ? { amount: doc.amountCharged, currency: doc.currency } : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

/** "WSM-" + 6 random digits (100000-999999), like the original store. */
export function newOrderNo(): string {
  return `WSM-${randomInt(100000, 1000000)}`;
}

const isDuplicateOrderNo = (error: unknown) => {
  const e = error as { code?: number; keyPattern?: Record<string, unknown>; message?: string } | null;
  return e?.code === 11000 && (e.keyPattern ? 'orderNo' in e.keyPattern : /orderNo/.test(e.message ?? ''));
};

/**
 * Creates a pending order for `userId` from a validated request. Throws HttpError 401 when the account no longer
 * exists and 400 `{ fields: { lines: 'invalid' } }` for unknown products / sizes. Retries on an orderNo collision.
 */
export async function createOrderForUser(userId: string, input: OrderRequest): Promise<PublicOrder> {
  if (!OBJECT_ID_RE.test(userId)) throw new HttpError(401, SIGNED_OUT_ORDER);
  await connectDB();
  if (!(await User.exists({ _id: userId }))) throw new HttpError(401, SIGNED_OUT_ORDER);

  const slugs = [...new Set(input.lines.flatMap((l) => (l.t === 'p' ? [l.id] : l.ids)))];
  const products = await Product.find({ slug: { $in: slugs } })
    .select('slug name category price sizes defaultSize colors')
    .lean<ProductDoc[]>();
  const priced = priceOrder(input, products);

  for (let attempt = 1; ; attempt += 1) {
    try {
      const order = await Order.create({
        user: new mongoose.Types.ObjectId(userId),
        orderNo: newOrderNo(),
        items: priced.items,
        subtotal: priced.subtotal,
        discount: priced.discount,
        shipping: priced.shipping,
        total: priced.total,
        promoCode: priced.promoCode,
        delivery: input.delivery,
        paymentMethod: input.payment,
        status: 'pending',
      });
      return publicOrder(order.toObject() as OrderDoc);
    } catch (error) {
      if (!isDuplicateOrderNo(error) || attempt >= ORDER_NO_ATTEMPTS) throw error;
    }
  }
}

/** All orders of one user, newest first. */
export async function listOrdersForUser(userId: string): Promise<PublicOrder[]> {
  if (!OBJECT_ID_RE.test(userId)) return [];
  await connectDB();
  const docs = await Order.find({ user: userId }).sort({ createdAt: -1 }).limit(100).lean<OrderDoc[]>();
  return docs.map(publicOrder);
}

/** One order — matched by BOTH its id and its owner, so another user's (or an invalid) id returns null (→ 404). */
export async function getOrderForUser(userId: string, orderId: string): Promise<PublicOrder | null> {
  if (!OBJECT_ID_RE.test(String(orderId)) || !OBJECT_ID_RE.test(userId)) return null;
  await connectDB();
  const doc = await Order.findOne({ _id: orderId, user: userId }).lean<OrderDoc>();
  return doc ? publicOrder(doc) : null;
}
