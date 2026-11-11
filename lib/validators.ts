// Server-side input validation for the auth, order and review API routes. The browser validates too, but the server
// never trusts it. Errors are codes the UI translates: required | invalid | tooShort | tooLong | taken.
// Pure module (no 'server-only'): unit-tested with vitest.
import { DELIVERY_SLOTS } from './shop/labels';
import { BOX_SIZE, MAX_LINE_QTY } from './shop/pricing';
import type { CartLine, CheckoutRequest, DeliveryInfo, OrderRequest, PaymentMethod } from './shop/types';

export type FieldError = 'required' | 'invalid' | 'tooShort' | 'tooLong' | 'taken';
export type FieldErrors<K extends string> = Partial<Record<K, FieldError>>;
export type Result<T, K extends string> = { ok: true; data: T } | { ok: false; errors: FieldErrors<K> };

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
/** bcrypt only uses the first 72 bytes of a password, so longer ones are rejected instead of silently cut. */
export const PASSWORD_MAX_BYTES = 72;
export const MAX_ORDER_LINES = 30;
export const BOX_NOTE_MAX = 80;
export const DELIVERY_NAME_MIN = 3;
export const DELIVERY_NAME_MAX = 80;
export const AREA_MAX = 60;
export const ADDRESS_MIN = 5;
export const ADDRESS_MAX = 300;
export const PROMO_MAX = 20;
export const REVIEW_TEXT_MIN = 10;
export const REVIEW_TEXT_MAX = 400;
export const SLUG_RE = /^[a-z0-9-]{2,40}$/;
export const PHONE_RE = /^\+?\d{8,12}$/;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const done = <T, K extends string>(errors: FieldErrors<K>, data: T): Result<T, K> =>
  Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };

export function normalizeEmail(raw: unknown): string {
  return str(raw).trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  if (!email || email.length > EMAIL_MAX) return false;
  const at = email.lastIndexOf('@');
  if (at < 1 || at > 64 || email.indexOf('@') !== at) return false;
  return /^[^\s@]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(email);
}

/** Collapses runs of whitespace and trims (names). */
function cleanName(raw: unknown): string {
  return str(raw).trim().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------- auth

export type SignupField = 'name' | 'email' | 'password';
export type SignupInput = { name: string; email: string; password: string };

export function validateSignup(body: unknown): Result<SignupInput, SignupField> {
  const b = obj(body);
  const name = cleanName(b.name);
  const email = normalizeEmail(b.email);
  const password = str(b.password);
  const errors: FieldErrors<SignupField> = {};
  if (!name) errors.name = 'required';
  else if (name.length > NAME_MAX) errors.name = 'tooLong';
  if (!email) errors.email = 'required';
  else if (!isValidEmail(email)) errors.email = 'invalid';
  if (!password) errors.password = 'required';
  else if ([...password].length < PASSWORD_MIN) errors.password = 'tooShort';
  else if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) errors.password = 'tooLong';
  return done(errors, { name, email, password });
}

export type LoginField = 'email' | 'password';
export type LoginInput = { email: string; password: string };

export function validateLogin(body: unknown): Result<LoginInput, LoginField> {
  const b = obj(body);
  const email = normalizeEmail(b.email);
  const password = str(b.password);
  const errors: FieldErrors<LoginField> = {};
  if (!email) errors.email = 'required';
  else if (!isValidEmail(email)) errors.email = 'invalid';
  if (!password) errors.password = 'required';
  else if (new TextEncoder().encode(password).length > 1024) errors.password = 'tooLong';
  return done(errors, { email, password });
}

// ---------------------------------------------------------------- orders

export type OrderField = 'lines' | 'name' | 'phone' | 'area' | 'address' | 'payment' | 'promo';

/** Latin digits for Arabic-Indic (٠-٩) and Persian (۰-۹) digits, so "٩٩٩٩ ٨٨٨٨" is accepted as a phone number. */
export function latinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const isQty = (q: unknown): q is number => typeof q === 'number' && Number.isInteger(q) && q >= 1 && q <= MAX_LINE_QTY;

/** One cart line from the body, or null if it is malformed. Size index validity is checked later against the DB. */
function parseLine(raw: unknown): CartLine | null {
  const r = obj(raw);
  if (r.t === 'p') {
    const id = str(r.id);
    if (!SLUG_RE.test(id) || typeof r.vi !== 'number' || !Number.isInteger(r.vi) || !isQty(r.q)) return null;
    return { t: 'p', id, vi: r.vi, q: r.q };
  }
  if (r.t === 'b') {
    if (!Array.isArray(r.ids) || r.ids.length !== BOX_SIZE) return null;
    const ids = r.ids.map(str);
    if (!ids.every((id) => SLUG_RE.test(id)) || new Set(ids).size !== BOX_SIZE) return null;
    if (r.note !== undefined && r.note !== null && typeof r.note !== 'string') return null;
    const note = str(r.note).trim().replace(/\s+/g, ' ');
    if (note.length > BOX_NOTE_MAX || !isQty(r.q)) return null;
    return { t: 'b', ids, note, q: r.q };
  }
  return null;
}

/**
 * POST /api/orders body → OrderRequest. Only slugs, size indexes, quantities, the box note, the promo code and the
 * delivery details are read. Any price, total or user field in the body is ignored (prices come from MongoDB).
 */
export function validateOrder(body: unknown): Result<OrderRequest, OrderField> {
  const b = obj(body);
  const errors: FieldErrors<OrderField> = {};

  const lines: CartLine[] = [];
  if (!Array.isArray(b.lines) || b.lines.length === 0) errors.lines = 'required';
  else if (b.lines.length > MAX_ORDER_LINES) errors.lines = 'tooLong';
  else {
    for (const raw of b.lines) {
      const line = parseLine(raw);
      if (!line) {
        errors.lines = 'invalid';
        break;
      }
      lines.push(line);
    }
  }

  const d = obj(b.delivery);
  const name = cleanName(d.name);
  if (!name) errors.name = 'required';
  else if (name.length < DELIVERY_NAME_MIN) errors.name = 'tooShort';
  else if (name.length > DELIVERY_NAME_MAX) errors.name = 'tooLong';

  const phone = latinDigits(str(d.phone)).replace(/\s+/g, '');
  if (!phone) errors.phone = 'required';
  else if (!PHONE_RE.test(phone)) errors.phone = 'invalid';

  const area = cleanName(d.area);
  if (!area) errors.area = 'required';
  else if (area.length > AREA_MAX) errors.area = 'tooLong';

  const address = str(d.address).trim();
  if (!address) errors.address = 'required';
  else if (address.length < ADDRESS_MIN) errors.address = 'tooShort';
  else if (address.length > ADDRESS_MAX) errors.address = 'tooLong';

  const slots: readonly string[] = DELIVERY_SLOTS;
  const slot = slots.includes(str(d.slot)) ? str(d.slot) : DELIVERY_SLOTS[0];

  let payment: PaymentMethod = 'cod';
  if (b.payment === 'link' || b.payment === 'cod') payment = b.payment;
  else if (b.payment !== undefined && b.payment !== null && b.payment !== '') errors.payment = 'invalid';

  const promo = str(b.promo).trim();
  if (promo.length > PROMO_MAX) errors.promo = 'tooLong';

  const delivery: DeliveryInfo = { name, phone, area, address, slot };
  return done(errors, { lines, promo, delivery, payment });
}

// ---------------------------------------------------------------- reviews

export type ReviewField = 'rating' | 'text';
export type ReviewInput = { rating: number; text: string };

export function validateReview(body: unknown): Result<ReviewInput, ReviewField> {
  const b = obj(body);
  const errors: FieldErrors<ReviewField> = {};
  const rating = b.rating;
  const okRating = typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5;
  if (!okRating) errors.rating = 'required';
  const text = str(b.text).replace(/\r\n?/g, '\n').trim();
  if (text.length < REVIEW_TEXT_MIN) errors.text = 'tooShort';
  else if (text.length > REVIEW_TEXT_MAX) errors.text = 'tooLong';
  return done(errors, { rating: okRating ? rating : 0, text });
}

// ---------------------------------------------------------------- checkout (Stripe, Day 5)

export type CheckoutField = Exclude<OrderField, 'payment'>;

/**
 * Body of POST /api/checkout: the same cart lines, promo and delivery rules as an order. Only those three fields are
 * read; any price, total, user id or payment field the browser adds is ignored (prices come from MongoDB).
 */
export function validateCheckoutInput(body: unknown): Result<CheckoutRequest, CheckoutField> {
  const b = obj(body);
  const r = validateOrder({ lines: b.lines, promo: b.promo, delivery: b.delivery });
  if (!r.ok) return r as { ok: false; errors: FieldErrors<CheckoutField> };
  const { lines, promo, delivery } = r.data;
  return { ok: true, data: { lines, promo, delivery } };
}
