import 'server-only';
// Day 5: Stripe Checkout (TEST MODE) for the cart, on top of the Day 4 store (MongoDB Atlas + session cookie).
// Class brief → this project:  "Supabase Edge Function" → the Next.js server route POST /api/checkout
//                              "Supabase Secrets"       → STRIPE_SECRET_KEY in the server environment
//                              "orders table"           → the MongoDB `orders` collection (models/Order.ts)
//
// Flow: the checkout page sends cart lines (slug + size, or a 3-scent box) + promo + delivery details → the server
// prices them FROM THE DATABASE (lib/orderPricing.ts) and creates a Stripe Checkout Session in KWD; every amount, the
// user id, the paid lines and the delivery details are written by the server into the session → the visitor pays on
// Stripe's page → Stripe redirects to /checkout/success, which calls POST /api/checkout/confirm; the server re-reads
// the session FROM STRIPE and, once it is paid and matches what the server wrote, saves the order as "paid". The
// webhook (bonus) does the same from Stripe's side. stripeSessionId is unique, so the order is saved exactly once.
// Nothing is saved for a payment that was cancelled or never completed.
import mongoose from 'mongoose';
import { connectDB } from './db';
import { HttpError } from './errors';
import { priceOrder, type PricingProduct } from './orderPricing';
import { newOrderNo, publicOrder } from './orders';
import { DELIVERY_SLOTS } from './shop/labels';
import type { CartLine, CheckoutRequest, DeliveryInfo, PublicOrder } from './shop/types';
import { createCheckoutSession, createOnceCoupon, retrieveCheckoutSession, StripeApiError, type CheckoutSession } from './stripe';
import {
  cartSubtotalFils,
  chargeCurrencyFrom,
  decodeCartMetadata,
  encodeCartMetadata,
  expectedChargeAmount,
  expectedTotalFils,
  filsToKwd,
  isStripeCheckoutUrl,
  METADATA_VALUE_MAX,
  MIN_CHARGE_FILS,
  parseFils,
  parseRate,
  rateFor,
  toChargeAmount,
  toFils,
  type ChargeCurrency,
  type PaidLine,
} from './stripeCore';
import { fmt } from './shop/pricing';
import { Order, type OrderDoc, type OrderFields } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';

/**
 * Stripe charge currency: STRIPE_CHARGE_CURRENCY=kwd when the Stripe account supports KWD; otherwise USD at the fixed
 * demo rate (this test account answers "Invalid currency: kwd"). Prices, totals and saved orders are always KWD.
 */
export function chargeCurrency(): ChargeCurrency {
  return chargeCurrencyFrom(process.env.STRIPE_CHARGE_CURRENCY);
}
/** Smallest charge: 0.50 USD (Stripe minimum) or 0.200 KWD. */
const MIN_CHARGE: Record<ChargeCurrency, number> = { usd: 50, kwd: MIN_CHARGE_FILS };
/** Checkout Session metadata keys (written by this server only). */
export const META = {
  user: 'wasmi_user',
  items: 'wasmi_items',
  promo: 'wasmi_promo',
  discount: 'wasmi_discount_fils',
  shipping: 'wasmi_shipping_fils',
  currency: 'wasmi_charge_currency',
  rate: 'wasmi_kwd_rate',
  notes: 'wasmi_box_notes',
  name: 'd_name',
  phone: 'd_phone',
  area: 'd_area',
  address: 'd_address',
  slot: 'd_slot',
} as const;
/** How long a Checkout Session stays payable (Stripe allows 30 minutes to 24 hours). */
const SESSION_LIFETIME_SECONDS = 60 * 60;
const SHIPPING_LINE_NAME = 'التوصيل داخل الكويت (2-3 أيام عمل)';

type ProductDoc = PricingProduct & { _id: mongoose.Types.ObjectId };

const NOT_FOUND = 'جلسة الدفع مو موجودة';

function loadProducts(slugs: string[]) {
  return Product.find({ slug: { $in: [...new Set(slugs)] } })
    .select('slug name category price sizes defaultSize colors')
    .lean<ProductDoc[]>();
}

function lineSlugs(lines: CartLine[]): string[] {
  return lines.flatMap((l) => (l.t === 'p' ? [l.id] : l.ids));
}

/** Creates the Stripe Checkout Session for the signed-in user's cart. Returns Stripe's hosted URL. */
export async function startCheckout(userId: string, input: CheckoutRequest, origin: string): Promise<{ url: string; sessionId: string }> {
  await connectDB();
  const [user, products] = await Promise.all([User.findById(userId).select('email').lean<{ email: string } | null>(), loadProducts(lineSlugs(input.lines))]);
  if (!user) throw new HttpError(401, 'انتهت جلستك، سجّل دخولك مرة ثانية', { reason: 'invalid' });

  // Unit prices, discount and delivery come from MongoDB + the store rules, never from the browser.
  const priced = priceOrder(input, products);
  const paid: PaidLine[] = input.lines.map((line, i) => {
    const unitFils = toFils(priced.items[i].price);
    return line.t === 'p'
      ? { t: 'p', slug: line.id, size: line.vi, quantity: line.q, unitFils }
      : { t: 'b', slugs: [...line.ids], quantity: line.q, unitFils };
  });
  const discountFils = toFils(priced.discount);
  const shippingFils = toFils(priced.shipping);
  const totalFils = expectedTotalFils(paid, discountFils, shippingFils);
  if (totalFils !== toFils(priced.total)) throw new HttpError(500, 'صار خطأ بحساب المبلغ، جرّب مرة ثانية');
  const currency = chargeCurrency();
  const rate = rateFor(currency);
  const chargeTotal = expectedChargeAmount(paid, discountFils, shippingFils, currency, rate);
  if (totalFils < MIN_CHARGE_FILS || chargeTotal < MIN_CHARGE[currency]) throw new HttpError(400, 'المبلغ أقل من الحد الأدنى للدفع بالبطاقة');

  const itemsMeta = encodeCartMetadata(paid);
  const notes = input.lines.filter((l): l is Extract<CartLine, { t: 'b' }> => l.t === 'b').map((l) => l.note.trim());
  const notesMeta = notes.some(Boolean) ? JSON.stringify(notes) : '';
  if (itemsMeta.length > METADATA_VALUE_MAX || notesMeta.length > METADATA_VALUE_MAX) {
    throw new HttpError(400, 'السلة فيها منتجات وايد لدفعة وحدة، قسّمها على طلبين', { fields: { lines: 'tooLong' } });
  }

  const lineItems = priced.items.map((item, i) => ({
    quantity: paid[i].quantity,
    price_data: {
      currency,
      unit_amount: toChargeAmount(paid[i].unitFils, currency, rate),
      product_data: { name: `${item.name} — وسمي`, description: `${item.detail} · ${fmt(item.price)}`.slice(0, 300) },
    },
  }));
  if (shippingFils > 0) {
    lineItems.push({ quantity: 1, price_data: { currency, unit_amount: toChargeAmount(shippingFils, currency, rate), product_data: { name: SHIPPING_LINE_NAME, description: fmt(priced.shipping) } } });
  }

  // The promo discount is a one-use, fixed-amount coupon, so Stripe's total equals the store's total exactly.
  const discounts =
    discountFils > 0 ? [{ coupon: (await createOnceCoupon({ amountOff: toChargeAmount(discountFils, currency, rate), currency, name: `${priced.promoCode} (${fmt(priced.discount)})` })).id }] : undefined;

  const d = input.delivery;
  const session = await createCheckoutSession({
    mode: 'payment',
    submit_type: 'pay',
    locale: 'auto',
    client_reference_id: userId,
    customer_email: user.email,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancel`,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    line_items: lineItems,
    discounts,
    metadata: {
      [META.user]: userId,
      [META.items]: itemsMeta,
      [META.promo]: priced.promoCode ?? '',
      [META.discount]: String(discountFils),
      [META.shipping]: String(shippingFils),
      [META.currency]: currency,
      [META.rate]: String(rate),
      [META.notes]: notesMeta,
      [META.name]: d.name,
      [META.phone]: d.phone,
      [META.area]: d.area,
      [META.address]: d.address,
      [META.slot]: d.slot,
    },
    payment_intent_data: { metadata: { [META.user]: userId } },
  });

  if (!isStripeCheckoutUrl(session.url)) throw new StripeApiError(502, 'invalid_response', 'unexpected_checkout_url');
  return { url: session.url, sessionId: session.id };
}

export type FulfilResult =
  | { ok: true; order: PublicOrder; created: boolean }
  | { ok: false; reason: 'not_paid' | 'livemode' | 'mismatch' | 'unknown_product' };

function deliveryFrom(meta: Record<string, string>): DeliveryInfo | null {
  const delivery = { name: meta[META.name] ?? '', phone: meta[META.phone] ?? '', area: meta[META.area] ?? '', address: meta[META.address] ?? '', slot: meta[META.slot] ?? '' };
  if (!delivery.name || !delivery.phone || !delivery.area || !delivery.address) return null;
  if (!(DELIVERY_SLOTS as readonly string[]).includes(delivery.slot)) delivery.slot = DELIVERY_SLOTS[0];
  return delivery;
}

function boxNotes(meta: Record<string, string>): string[] {
  try {
    const v = meta[META.notes] ? JSON.parse(meta[META.notes]) : [];
    return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.slice(0, 80) : '')) : [];
  } catch {
    return [];
  }
}

let indexesReady: Promise<unknown> | null = null;

const isDuplicate = (error: unknown, field: string) => {
  const e = error as { code?: number; keyPattern?: Record<string, unknown>; message?: string } | null;
  return e?.code === 11000 && (e.keyPattern ? field in e.keyPattern : new RegExp(field).test(e.message ?? ''));
};

/**
 * Saves the paid order for a Checkout Session (idempotent: one order per session id). Called by the success-page
 * check and by the webhook. Everything is checked against what the SERVER wrote into the session: the user id, the
 * paid lines, the discount and delivery fee, the currency, and that Stripe's amount_total equals their sum.
 */
export async function fulfillCheckoutSession(session: CheckoutSession): Promise<FulfilResult> {
  if (session.object !== 'checkout.session' || session.mode !== 'payment') return { ok: false, reason: 'mismatch' };
  if (session.livemode) return { ok: false, reason: 'livemode' };
  if (session.payment_status !== 'paid') return { ok: false, reason: 'not_paid' };
  const meta = session.metadata ?? {};
  const userId = meta[META.user];
  const lines = decodeCartMetadata(meta[META.items]);
  const discountFils = parseFils(meta[META.discount]);
  const shippingFils = parseFils(meta[META.shipping]);
  const delivery = deliveryFrom(meta);
  if (!userId || !mongoose.isValidObjectId(userId) || session.client_reference_id !== userId || !lines || discountFils === null || shippingFils === null || !delivery) {
    return { ok: false, reason: 'mismatch' };
  }
  const currency = (session.currency ?? '').toLowerCase();
  if ((currency !== 'usd' && currency !== 'kwd') || meta[META.currency] !== currency) return { ok: false, reason: 'mismatch' };
  const rate = parseRate(meta[META.rate], currency);
  if (rate === null || session.amount_total !== expectedChargeAmount(lines, discountFils, shippingFils, currency, rate)) {
    return { ok: false, reason: 'mismatch' };
  }

  await connectDB();
  // Make sure the unique stripeSessionId index exists before relying on it (built once per server process).
  indexesReady ??= Order.init().catch((e: Error) => {
    indexesReady = null;
    console.error(`[checkout] index init failed: ${e?.name ?? 'Error'}`);
  });
  await indexesReady;

  const existing = await Order.findOne({ stripeSessionId: session.id }).lean<OrderDoc>();
  if (existing) return { ok: true, order: publicOrder(existing), created: false };

  // Names, details and colours come from the products; the unit prices are exactly what Stripe charged.
  const notes = boxNotes(meta);
  let b = 0;
  const cartLines: CartLine[] = lines.map((l) => (l.t === 'p' ? { t: 'p', id: l.slug, vi: l.size, q: l.quantity } : { t: 'b', ids: l.slugs, note: notes[b++] ?? '', q: l.quantity }));
  const products = await loadProducts(lineSlugs(cartLines));
  let priced;
  try {
    priced = priceOrder({ lines: cartLines, promo: '' }, products);
  } catch {
    return { ok: false, reason: 'unknown_product' };
  }
  const items = priced.items.map((item, i) => {
    const price = filsToKwd(lines[i].unitFils);
    return { ...item, price, lineTotal: filsToKwd(lines[i].unitFils * lines[i].quantity) };
  }) as unknown as OrderFields['items'];
  const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);

  for (let attempt = 1; ; attempt++) {
    try {
      const doc = await Order.create({
        user: new mongoose.Types.ObjectId(userId),
        orderNo: newOrderNo(),
        items,
        subtotal: filsToKwd(cartSubtotalFils(lines)),
        discount: filsToKwd(discountFils),
        shipping: filsToKwd(shippingFils),
        total: filsToKwd(expectedTotalFils(lines, discountFils, shippingFils)),
        promoCode: meta[META.promo] || null,
        delivery,
        paymentMethod: 'stripe',
        status: 'paid',
        stripeSessionId: session.id,
        paymentIntentId,
        currency,
        amountCharged: session.amount_total,
        exchangeRate: rate,
        paidAt: new Date(),
      });
      return { ok: true, order: publicOrder(doc.toObject() as OrderDoc), created: true };
    } catch (error) {
      // The webhook and the success page arrived at the same moment: the other one already saved it.
      if (isDuplicate(error, 'stripeSessionId')) {
        const again = await Order.findOne({ stripeSessionId: session.id }).lean<OrderDoc>();
        if (again) return { ok: true, order: publicOrder(again), created: false };
      }
      if (isDuplicate(error, 'orderNo') && attempt < 6) continue;
      throw error;
    }
  }
}

export type ConfirmResult = { status: 'paid'; order: PublicOrder } | { status: 'processing' | 'open' | 'expired' };

/** Success page check: the session must belong to the signed-in user; once paid, the order is saved and returned. */
export async function confirmCheckoutForUser(userId: string, sessionId: string): Promise<ConfirmResult> {
  let session: CheckoutSession;
  try {
    session = await retrieveCheckoutSession(sessionId);
  } catch (error) {
    if (error instanceof StripeApiError && (error.status === 404 || error.status === 400)) throw new HttpError(404, NOT_FOUND);
    throw error;
  }
  // Another account's session id is answered exactly like an unknown one.
  if (session.client_reference_id !== userId || session.metadata?.[META.user] !== userId) throw new HttpError(404, NOT_FOUND);
  if (session.payment_status === 'paid') {
    const result = await fulfillCheckoutSession(session);
    if (result.ok) return { status: 'paid', order: result.order };
    console.error(`[checkout] paid session could not be fulfilled: ${result.reason}`);
    throw new HttpError(409, 'ما قدرنا نربط الدفعة بطلب. تواصل معنا، وما راح ينخصم منك مرتين');
  }
  if (session.status === 'expired') return { status: 'expired' };
  if (session.status === 'complete') return { status: 'processing' };
  return { status: 'open' };
}
