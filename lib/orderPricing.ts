// Server-side order pricing — PURE (no DB, no 'server-only'), unit-tested.
// Every price, line total, discount, shipping fee and total is computed here from the products loaded from MongoDB.
// The browser only sends slugs, size indexes, quantities, a box note and a promo code; any price / total / user field
// in the request is never read.
import { HttpError } from './errors';
import { CATEGORY_LABEL, BOX_NAME } from './shop/labels';
import { BOX_SIZE, boxPrice, computeTotals, isValidSize, normalizePromo, promoRate, round3, sizePrice } from './shop/pricing';
import type { CatalogProduct, OrderRequest } from './shop/types';

/** The product fields pricing needs (a lean Product document or a CatalogProduct). `_id` becomes the order's ref. */
export type PricingProduct = Pick<CatalogProduct, 'slug' | 'name' | 'category' | 'price' | 'sizes' | 'defaultSize' | 'colors'> & {
  _id?: unknown;
};

export interface PricedItem<Id = unknown> {
  kind: 'product' | 'box';
  product: Id | null;
  products: Id[];
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

export interface PricedOrder<Id = unknown> {
  items: PricedItem<Id>[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  promoCode: string | null;
}

export const ORDER_LINES_INVALID_MESSAGE = 'في منتج بالسلة مو متوفر، حدّث السلة وجرّب مرة ثانية';

function invalidLines(): HttpError {
  return new HttpError(400, ORDER_LINES_INVALID_MESSAGE, { fields: { lines: 'invalid' } });
}

/**
 * Prices a validated order request against the given products.
 * Throws HttpError 400 `{ fields: { lines: 'invalid' } }` for an unknown slug, a size index the product does not have,
 * or a box that is not 3 distinct known products. Unknown promo codes give no discount and promoCode null.
 */
export function priceOrder<P extends PricingProduct>(
  input: Pick<OrderRequest, 'lines' | 'promo'>,
  products: readonly P[],
): PricedOrder<NonNullable<P['_id']>> {
  type Id = NonNullable<P['_id']>;
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  if (!input.lines.length) throw invalidLines();

  const items: PricedItem<Id>[] = input.lines.map((line) => {
    if (line.t === 'p') {
      const p = bySlug.get(line.id);
      if (!p || !isValidSize(p, line.vi)) throw invalidLines();
      const size = p.sizes[line.vi];
      const price = sizePrice(p, line.vi);
      return {
        kind: 'product',
        product: (p._id ?? null) as Id | null,
        products: [],
        slug: p.slug,
        slugs: [],
        name: p.name,
        detail: `${CATEGORY_LABEL[p.category]} · ${size.label}`,
        sizeLabel: size.label,
        sizeIndex: line.vi,
        note: '',
        quantity: line.q,
        price,
        lineTotal: round3(price * line.q),
        colors: { c1: p.colors.c1, c2: p.colors.c2, c3: p.colors.c2 },
      };
    }
    if (line.ids.length !== BOX_SIZE || new Set(line.ids).size !== BOX_SIZE) throw invalidLines();
    const ps = line.ids.map((id) => bySlug.get(id));
    if (ps.some((p) => !p)) throw invalidLines();
    const box = ps as P[];
    const price = boxPrice(box);
    const note = line.note.trim();
    return {
      kind: 'box',
      product: null,
      products: box.map((p) => p._id).filter((id): id is Id => id != null),
      slug: 'box',
      slugs: box.map((p) => p.slug),
      name: BOX_NAME,
      detail: box.map((p) => p.name).join(' + ') + (note ? ` · «${note}»` : ''),
      sizeLabel: '',
      sizeIndex: null,
      note,
      quantity: line.q,
      price,
      lineTotal: round3(price * line.q),
      colors: { c1: box[0].colors.c1, c2: box[1].colors.c1, c3: box[2].colors.c1 },
    };
  });

  const code = normalizePromo(input.promo);
  const promoCode = code && promoRate(code) > 0 ? code : null;
  const subtotal = round3(items.reduce((sum, i) => sum + i.lineTotal, 0));
  const t = computeTotals(subtotal, promoCode ?? '', items.length > 0);
  return { items, subtotal: t.sub, discount: t.disc, shipping: t.ship, total: t.total, promoCode };
}
