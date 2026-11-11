'use client';
// Client-side store state, ported from the original script: cart, favourites, promo code, recently viewed, helpful
// votes, toast, cart drawer and the "fly to cart" animation. Product data is NOT here: it arrives from MongoDB through
// the root layout (server) as the `products` prop.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { CATEGORY_LABEL, BOX_NAME } from '@/lib/shop/labels';
import { BOX_SIZE, MAX_LINE_QTY, computeTotals, isValidSize, lineKey, lineUnit, normalizePromo, promoRate, type Totals } from '@/lib/shop/pricing';
import type { CartLine, CatalogProduct, SessionUser } from '@/lib/shop/types';

export const KEYS = {
  cart: 'wasmi2.cart',
  favs: 'wasmi2.favs',
  promo: 'wasmi2.promo',
  recent: 'wasmi2.recent',
  theme: 'wasmi2.theme',
  helpful: 'wasmi3.help',
  checkoutDraft: 'wasmi4.checkout',
} as const;

export const storage = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode / quota */
    }
  },
};

export interface LineInfo {
  name: string;
  sub: string;
  c1: string;
  c2: string;
  c3: string;
  box: boolean;
}

export type PromoResult = 'applied' | 'cleared' | 'invalid';

interface StoreValue {
  products: CatalogProduct[];
  bySlug: (slug: string) => CatalogProduct | undefined;
  now: number;
  dbDown: boolean;
  user: SessionUser | null;
  ready: boolean;
  reduceMotion: boolean;
  cart: CartLine[];
  cartCount: number;
  totals: Totals;
  unit: (l: CartLine) => number;
  lineInfo: (l: CartLine) => LineInfo | null;
  addLine: (l: CartLine) => void;
  changeQty: (index: number, delta: number) => void;
  removeLine: (index: number) => void;
  clearCart: () => void;
  /** Removes the cart lines with these keys (the lines Stripe was paid for) and clears the promo code. */
  removeLinesByKey: (keys: string[]) => void;
  promo: string;
  applyPromo: (code: string) => PromoResult;
  favs: Set<string>;
  toggleFav: (slug: string) => void;
  recent: string[];
  pushRecent: (slug: string) => void;
  helpful: Set<string>;
  toggleHelpful: (key: string) => void;
  toast: (msg: string) => void;
  toastState: { msg: string; on: boolean };
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: (quiet?: boolean) => void;
  cartBtnRef: RefObject<HTMLButtonElement | null>;
  favBtnRef: RefObject<HTMLAnchorElement | null>;
  fly: (from: Element | null, p: Pick<CatalogProduct, 'colors'>) => void;
  hasBar: boolean;
  setHasBar: (v: boolean) => void;
  inSeason: (p: CatalogProduct) => boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}

function bump(el: Element | null) {
  if (!el) return;
  el.classList.remove('bump');
  void (el as HTMLElement).offsetWidth;
  el.classList.add('bump');
}

export function StoreProvider({
  products,
  now,
  dbDown,
  user,
  children,
}: {
  products: CatalogProduct[];
  now: number;
  dbDown: boolean;
  user: SessionUser | null;
  children: ReactNode;
}) {
  const map = useMemo(() => new Map(products.map((p) => [p.slug, p])), [products]);
  const bySlug = useCallback((slug: string) => map.get(slug), [map]);

  const [ready, setReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favs, setFavs] = useState<Set<string>>(() => new Set());
  const [promo, setPromo] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [helpful, setHelpful] = useState<Set<string>>(() => new Set());
  const [toastState, setToastState] = useState({ msg: '', on: false });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hasBar, setHasBar] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cartBtnRef = useRef<HTMLButtonElement | null>(null);
  const favBtnRef = useRef<HTMLAnchorElement | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const validLine = useCallback(
    (l: CartLine | null | undefined): l is CartLine => {
      if (!l || typeof l !== 'object' || !Number.isInteger(l.q) || l.q <= 0) return false;
      if (l.t === 'p') {
        const p = map.get(l.id);
        return Boolean(p && isValidSize(p, l.vi));
      }
      return l.t === 'b' && Array.isArray(l.ids) && l.ids.length === BOX_SIZE && l.ids.every((id) => map.has(id));
    },
    [map],
  );

  // Load the visitor's saved state once (after hydration, so server and client first render match).
  useEffect(() => {
    const canCheck = map.size > 0; // when the DB is down, keep saved lines instead of dropping them
    const rawCart = storage.get<CartLine[]>(KEYS.cart, []);
    setCart(Array.isArray(rawCart) ? (canCheck ? rawCart.filter(validLine) : rawCart) : []);
    const rawFavs = storage.get<string[]>(KEYS.favs, []);
    setFavs(new Set(Array.isArray(rawFavs) ? rawFavs.filter((s) => !canCheck || map.has(s)) : []));
    const p = normalizePromo(storage.get(KEYS.promo, ''));
    setPromo(promoRate(p) ? p : '');
    const rawRecent = storage.get<string[]>(KEYS.recent, []);
    setRecent(Array.isArray(rawRecent) ? rawRecent.filter((s) => !canCheck || map.has(s)) : []);
    const rawHelp = storage.get<string[]>(KEYS.helpful, []);
    setHelpful(new Set(Array.isArray(rawHelp) ? rawHelp : []));
    setReduceMotion(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist (only after the initial load, so we never overwrite saved data with the empty first state).
  useEffect(() => {
    if (ready) storage.set(KEYS.cart, cart);
  }, [cart, ready]);
  useEffect(() => {
    if (ready) storage.set(KEYS.favs, Array.from(favs));
  }, [favs, ready]);
  useEffect(() => {
    if (ready) storage.set(KEYS.promo, promo);
  }, [promo, ready]);
  useEffect(() => {
    if (ready) storage.set(KEYS.recent, recent);
  }, [recent, ready]);
  useEffect(() => {
    if (ready) storage.set(KEYS.helpful, Array.from(helpful));
  }, [helpful, ready]);

  const toast = useCallback((msg: string) => {
    setToastState({ msg, on: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState((t) => ({ ...t, on: false })), 2300);
  }, []);

  const unit = useCallback((l: CartLine) => lineUnit(l, (s) => map.get(s)) ?? 0, [map]);

  const lineInfo = useCallback(
    (l: CartLine): LineInfo | null => {
      if (!validLine(l)) return null;
      if (l.t === 'p') {
        const p = map.get(l.id)!;
        return { name: p.name, sub: `${CATEGORY_LABEL[p.category]} · ${p.sizes[l.vi].label}`, c1: p.colors.c1, c2: p.colors.c2, c3: p.colors.c2, box: false };
      }
      const ps = l.ids.map((id) => map.get(id)!);
      return {
        name: BOX_NAME,
        sub: ps.map((p) => p.name).join(' + ') + (l.note ? ` · «${l.note}»` : ''),
        c1: ps[0].colors.c1,
        c2: ps[1].colors.c1,
        c3: ps[2].colors.c1,
        box: true,
      };
    },
    [map, validLine],
  );

  const visibleCart = useMemo(() => cart.filter(validLine), [cart, validLine]);
  const cartCount = useMemo(() => visibleCart.reduce((a, l) => a + l.q, 0), [visibleCart]);
  const totals = useMemo(() => {
    const sub = visibleCart.reduce((a, l) => a + unit(l) * l.q, 0);
    return computeTotals(sub, promo, visibleCart.length > 0);
  }, [visibleCart, unit, promo]);

  const addLine = useCallback(
    (l: CartLine) => {
      setCart((prev) => {
        const k = lineKey(l);
        const i = prev.findIndex((x) => lineKey(x) === k);
        if (i > -1) return prev.map((x, j) => (j === i ? { ...x, q: Math.min(x.q + l.q, MAX_LINE_QTY) } : x));
        return [...prev, l];
      });
      bump(cartBtnRef.current);
    },
    [],
  );

  const changeQty = useCallback((index: number, delta: number) => {
    setCart((prev) => {
      const next = prev.map((x, j) => (j === index ? { ...x, q: Math.min(x.q + delta, MAX_LINE_QTY) } : x));
      return next.filter((x) => x.q > 0);
    });
  }, []);
  const removeLine = useCallback((index: number) => setCart((prev) => prev.filter((_, j) => j !== index)), []);
  const clearCart = useCallback(() => {
    setCart([]);
    setPromo('');
  }, []);
  const removeLinesByKey = useCallback((keys: string[]) => {
    const drop = new Set(keys);
    setCart((prev) => prev.filter((l) => !drop.has(lineKey(l))));
    setPromo('');
  }, []);

  const applyPromo = useCallback(
    (code: string): PromoResult => {
      const c = normalizePromo(code);
      if (!c) {
        setPromo('');
        return 'cleared';
      }
      if (promoRate(c)) {
        setPromo(c);
        toast('تم تطبيق خصم ' + Math.round(promoRate(c) * 100) + '%');
        return 'applied';
      }
      return 'invalid';
    },
    [toast],
  );

  const toggleFav = useCallback(
    (slug: string) => {
      const p = map.get(slug);
      if (!p) return;
      const on = !favs.has(slug);
      setFavs((prev) => {
        const next = new Set(prev);
        if (on) next.add(slug);
        else next.delete(slug);
        return next;
      });
      bump(favBtnRef.current);
      toast(on ? 'حفظنا ' + p.name + ' بالمفضلة' : 'شلنا ' + p.name + ' من المفضلة');
    },
    [map, favs, toast],
  );

  const pushRecent = useCallback((slug: string) => {
    setRecent((prev) => [slug, ...prev.filter((x) => x !== slug)].slice(0, 6));
  }, []);

  const toggleHelpful = useCallback((key: string) => {
    setHelpful((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const openDrawer = useCallback(() => {
    lastFocus.current = document.activeElement as HTMLElement | null;
    setDrawerOpen(true);
  }, []);
  const closeDrawer = useCallback((quiet?: boolean) => {
    setDrawerOpen((open) => {
      if (open && !quiet) {
        const el = lastFocus.current;
        setTimeout(() => el?.focus?.(), 0);
      }
      return false;
    });
  }, []);

  const fly = useCallback(
    (from: Element | null, p: Pick<CatalogProduct, 'colors'>) => {
      const cb = cartBtnRef.current;
      if (reduceMotion || !from || !cb || !(from as HTMLElement).animate) return;
      const a = from.getBoundingClientRect();
      const b = cb.getBoundingClientRect();
      const d = document.createElement('div');
      d.className = 'fly';
      d.style.left = a.left + a.width / 2 - 18 + 'px';
      d.style.top = a.top + a.height / 2 - 18 + 'px';
      d.style.background = `linear-gradient(165deg,${p.colors.c1},${p.colors.c2})`;
      (document.getElementById('app') ?? document.body).appendChild(d);
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const an = d.animate(
        [
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0.4 },
        ],
        { duration: 650, easing: 'cubic-bezier(.5,0,.2,1)' },
      );
      an.onfinish = () => {
        d.remove();
        bump(cb);
      };
    },
    [reduceMotion],
  );

  const inSeason = useCallback((p: CatalogProduct) => !p.allYear && p.seasons.includes(now), [now]);

  const value = useMemo<StoreValue>(
    () => ({
      products,
      bySlug,
      now,
      dbDown,
      user,
      ready,
      reduceMotion,
      cart,
      cartCount,
      totals,
      unit,
      lineInfo,
      addLine,
      changeQty,
      removeLine,
      clearCart,
      removeLinesByKey,
      promo,
      applyPromo,
      favs,
      toggleFav,
      recent,
      pushRecent,
      helpful,
      toggleHelpful,
      toast,
      toastState,
      drawerOpen,
      openDrawer,
      closeDrawer,
      cartBtnRef,
      favBtnRef,
      fly,
      hasBar,
      setHasBar,
      inSeason,
    }),
    [products, bySlug, now, dbDown, user, ready, reduceMotion, cart, cartCount, totals, unit, lineInfo, addLine, changeQty, removeLine, clearCart, removeLinesByKey, promo, applyPromo, favs, toggleFav, recent, pushRecent, helpful, toggleHelpful, toast, toastState, drawerOpen, openDrawer, closeDrawer, fly, hasBar, inSeason],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
