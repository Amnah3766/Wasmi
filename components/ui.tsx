'use client';
// Small shared UI pieces ported from the original helpers (fmt, stars, card, cards, flash).
import Link from 'next/link';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CATEGORY_LABEL } from '@/lib/shop/labels';
import { defaultPrice, fmt } from '@/lib/shop/pricing';
import type { CatalogProduct } from '@/lib/shop/types';
import { Icon } from './Icon';
import { ProductArt } from './ProductArt';
import { useStore } from './store/StoreProvider';

/** A price that never flips in RTL: "9.500 د.ك" isolated from the surrounding text direction. */
export function Price({ value, minus }: { value: number; minus?: boolean }) {
  return <bdi className="pv">{(minus ? '−' : '') + fmt(value)}</bdi>;
}

export function Stars({ value }: { value: number }) {
  const pct = Math.round((value / 5) * 100);
  return (
    <span className="stars" role="img" aria-label={value.toFixed(1) + ' من 5'}>
      <span aria-hidden="true">★★★★★</span>
      <span className="st-f" aria-hidden="true" style={{ width: pct + '%' }}>
        ★★★★★
      </span>
    </span>
  );
}

export function colorVars(p: { colors: { c1: string; c2: string } }): CSSProperties {
  return { ['--c1' as string]: p.colors.c1, ['--c2' as string]: p.colors.c2 } as CSSProperties;
}

/** Button that briefly shows "تمت الإضافة" after a click (original `flash`). */
export function FlashButton({
  className,
  onClick,
  children,
  okText = 'تمت الإضافة',
  style,
  disabled,
  tabIndex,
}: {
  className: string;
  onClick: (el: HTMLButtonElement) => void;
  children: ReactNode;
  okText?: string;
  style?: CSSProperties;
  disabled?: boolean;
  tabIndex?: number;
}) {
  const [ok, setOk] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button
      className={className + (ok ? ' ok' : '')}
      type="button"
      style={style}
      disabled={disabled}
      tabIndex={tabIndex}
      onClick={(e) => {
        onClick(e.currentTarget);
        setOk(true);
        clearTimeout(t.current);
        t.current = setTimeout(() => setOk(false), 1300);
      }}
    >
      {ok ? okText : children}
    </button>
  );
}

const NOTES_EVENT = 'wasmi:notes';

export function ProductCard({ p }: { p: CatalogProduct }) {
  const { favs, toggleFav, addLine, toast, fly, inSeason } = useStore();
  const id = useId();
  const [show, setShow] = useState(false);
  const fav = favs.has(p.slug);

  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== id) setShow(false);
    };
    window.addEventListener(NOTES_EVENT, onOther);
    return () => window.removeEventListener(NOTES_EVENT, onOther);
  }, [id]);

  return (
    <article className="card" data-id={p.slug} style={colorVars(p)}>
      <div className={'art-wrap' + (show ? ' show' : '')}>
        <button
          className="art"
          type="button"
          aria-expanded={show}
          aria-label={'طبقات ريحة ' + p.name}
          onClick={() => {
            window.dispatchEvent(new CustomEvent(NOTES_EVENT, { detail: id }));
            setShow((s) => !s);
          }}
        >
          <ProductArt p={p} />
        </button>
        <div className="notes">
          <div>
            <b>القمة</b>
            {p.notes.top}
          </div>
          <div>
            <b>القلب</b>
            {p.notes.heart}
          </div>
          <div>
            <b>القاعدة</b>
            {p.notes.base}
          </div>
        </div>
        <span className="tag">{CATEGORY_LABEL[p.category]}</span>
        {inSeason(p) ? (
          <span className="tag now">
            <i className="dot" />
            بموسمها الحين
          </span>
        ) : null}
        <button
          className="fav"
          type="button"
          aria-pressed={fav}
          aria-label={fav ? 'إزالة ' + p.name + ' من المفضلة' : 'حفظ ' + p.name + ' بالمفضلة'}
          onClick={() => toggleFav(p.slug)}
        >
          <Icon name="heart" />
        </button>
      </div>
      <div className="info">
        <div className="nm">
          <h3>
            <Link href={'/products/' + p.slug}>{p.name}</Link>
          </h3>
          <span className="en" dir="ltr">
            {p.nameEn}
          </span>
        </div>
        <p className="mo">{p.moment}</p>
        <div className="cr">
          <Stars value={p.rating.avg} />
          <span>
            {p.rating.avg.toFixed(1)} ({p.rating.n})
          </span>
        </div>
        <div className="pr">
          <span>{p.sizes[p.defaultSize]?.label}</span>
          <b>
            <Price value={defaultPrice(p)} />
          </b>
        </div>
        <FlashButton
          className="buy"
          onClick={(el) => {
            addLine({ t: 'p', id: p.slug, vi: p.defaultSize, q: 1 });
            toast(p.name + ' صارت بالسلة');
            fly(el, p);
          }}
        >
          أضف للسلة
        </FlashButton>
      </div>
    </article>
  );
}

export function Cards({ list, cls }: { list: CatalogProduct[]; cls?: string }) {
  return (
    <div className={'grid' + (cls ? ' ' + cls : '')}>
      {list.map((p) => (
        <ProductCard key={p.slug} p={p} />
      ))}
    </div>
  );
}

/** Shown wherever products should appear but MongoDB could not be reached (instead of crashing). */
export function DbNotice({ compact }: { compact?: boolean }) {
  return (
    <div className={'dbnote' + (compact ? ' sm' : '')} role="status">
      <b>ما قدرنا نوصل لقاعدة البيانات الحين.</b>
      <span>المنتجات تنقرا من MongoDB مباشرة. حدّث الصفحة بعد شوي.</span>
    </div>
  );
}

export function EmptyFavs() {
  return (
    <div className="grid">
      <div className="empty">
        <p>ما حفظت شي بعد. اضغط القلب على أي ريحة تعجبك.</p>
        <Link className="btn sm" href="/products">
          تصفح الروائح
        </Link>
      </div>
    </div>
  );
}
