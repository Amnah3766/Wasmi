'use client';
// /products — ported from PAGES.shop + renderShop (search, category chips with counts, sort, max price, season).
import { useMemo, useState } from 'react';
import { CATEGORY_LABEL } from '@/lib/shop/labels';
import type { CatalogProduct, Category } from '@/lib/shop/types';
import { Icon } from '../Icon';
import { useStore } from '../store/StoreProvider';
import { Cards, DbNotice, Price } from '../ui';

type Sort = 'def' | 'asc' | 'desc' | 'name';
interface ShopState {
  cat: 'all' | Category;
  q: string;
  sort: Sort;
  max: number | null; // null = no limit (the slider's top)
  season: boolean;
}

const INITIAL: ShopState = { cat: 'all', q: '', sort: 'def', max: null, season: false };
// Like the original `var shop`, filters survive moving between pages during the visit.
let remembered: ShopState = INITIAL;

/** Arabic-insensitive search normalisation (original `norm`). */
export function norm(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function hay(p: CatalogProduct) {
  return norm([p.name, p.nameEn, CATEGORY_LABEL[p.category], p.notes.top, p.notes.heart, p.notes.base, p.moment].join(' '));
}

const CHIPS: Array<['all' | Category, string]> = [
  ['all', 'الكل'],
  ['candle', 'شموع'],
  ['perfume', 'عطور'],
  ['incense', 'بخور'],
];

export function ShopView() {
  const { products, inSeason, dbDown } = useStore();
  const [s, setS] = useState<ShopState>(remembered);
  const update = (patch: Partial<ShopState>) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      remembered = next;
      return next;
    });

  // The price slider adapts to the prices in the database (original: 8 → 18).
  const lo = products.length ? Math.floor(Math.min(...products.map((p) => p.price))) : 0;
  const hi = products.length ? Math.ceil(Math.max(...products.map((p) => p.price))) : 0;
  const max = s.max == null ? hi : Math.min(Math.max(s.max, lo), hi);

  const hays = useMemo(() => new Map(products.map((p) => [p.slug, hay(p)])), [products]);
  const toks = norm(s.q).split(/\s+/).filter(Boolean);
  const passBase = (p: CatalogProduct) => p.price <= max && (!s.season || inSeason(p)) && toks.every((t) => (hays.get(p.slug) ?? '').includes(t));

  const list = products.filter((p) => (s.cat === 'all' || p.category === s.cat) && passBase(p));
  if (s.sort === 'asc') list.sort((a, b) => a.price - b.price);
  else if (s.sort === 'desc') list.sort((a, b) => b.price - a.price);
  else if (s.sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  const counts: Record<string, number> = { all: 0, candle: 0, perfume: 0, incense: 0 };
  for (const p of products) {
    if (passBase(p)) {
      counts.all++;
      counts[p.category]++;
    }
  }

  const reset = () => update({ ...INITIAL });

  return (
    <>
      <div className="wrap">
        <div className="page-head">
          <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>المتجر</h1>
          <p>اضغط على صورة أي منتج تشوف طبقات ريحته، وعلى الاسم تفتح صفحته.</p>
        </div>
        <div className="toolbar">
          <label className="search">
            <span className="sr">دوّر على ريحة</span>
            <Icon name="search" />
            <input
              className="field"
              id="q"
              type="search"
              placeholder="دوّر على ريحة… عود، مطر، بحر"
              autoComplete="off"
              value={s.q}
              onChange={(e) => update({ q: e.target.value })}
            />
          </label>
          <div className="chips" role="group" aria-label="التصنيف">
            {CHIPS.map(([k, label]) => (
              <button key={k} className="chip" type="button" data-cat={k} aria-pressed={s.cat === k} onClick={() => update({ cat: k })}>
                {label}
                <small>{counts[k]}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="tb2">
          <label>
            الترتيب
            <select id="sort" value={s.sort} onChange={(e) => update({ sort: e.target.value as Sort })}>
              <option value="def">المميزة</option>
              <option value="asc">السعر: الأقل أول</option>
              <option value="desc">السعر: الأعلى أول</option>
              <option value="name">الاسم</option>
            </select>
          </label>
          <label>
            السعر لين
            <input type="range" id="max" min={lo} max={hi} step={0.5} value={max} onChange={(e) => update({ max: Number(e.target.value) })} />
            <output id="maxv">
              <Price value={max} />
            </output>
          </label>
          <button className="chip" type="button" id="seasonChip" aria-pressed={s.season} onClick={() => update({ season: !s.season })}>
            بموسمها الحين
          </button>
          <button className="link" type="button" onClick={reset}>
            مسح الفلاتر
          </button>
        </div>
        <div className="count" id="count" aria-live="polite">
          {list.length ? list.length + ' من ' + products.length + ' ريحة' : ''}
        </div>
        <div id="shopgrid">
          {dbDown ? (
            <DbNotice />
          ) : list.length ? (
            <Cards list={list} />
          ) : (
            <div className="grid">
              <div className="empty">
                <p>ما لقينا ريحة بهالمواصفات. جرّب «عود» أو «مطر» أو «بحر».</p>
                <button className="btn sm" type="button" onClick={reset}>
                  امسح الفلاتر
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="sec" style={{ paddingTop: 20 }} />
    </>
  );
}
