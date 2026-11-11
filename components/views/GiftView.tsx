'use client';
// /gift — صندوق المواسم (original PAGES.gift + renderGift): pick 3 scents, 15 % off, optional card message.
import { useState } from 'react';
import { BOX_DISCOUNT, BOX_SIZE, boxPrice, boxSum, defaultPrice } from '@/lib/shop/pricing';
import type { CatalogProduct } from '@/lib/shop/types';
import { Icon } from '../Icon';
import { ProductArt } from '../ProductArt';
import { useStore } from '../store/StoreProvider';
import { DbNotice, FlashButton, Price, colorVars } from '../ui';

export function GiftView() {
  const { products, bySlug, addLine, toast, dbDown } = useStore();
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const items = picked.map(bySlug).filter((p): p is CatalogProduct => Boolean(p));
  const sum = boxSum(items);
  const price = boxPrice(items);
  const full = items.length === BOX_SIZE;

  const pick = (slug: string) => {
    setPicked((g) => {
      if (g.includes(slug)) return g.filter((x) => x !== slug);
      if (g.length < BOX_SIZE) return [...g, slug];
      toast('الصندوق يشيل 3 روائح بس');
      return g;
    });
  };

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>صندوق المواسم</h1>
        <p>اختر 3 روائح بصندوق هدية واحد وخذ خصم {Math.round(BOX_DISCOUNT * 100)}% على المجموع.</p>
      </div>
      {dbDown ? (
        <div style={{ paddingBottom: 'clamp(40px,6vw,72px)' }}>
          <DbNotice />
        </div>
      ) : (
        <div className="gift" id="gbox">
          <div>
            <div className="slots" style={{ marginBottom: 22 }}>
              {[0, 1, 2].map((i) => {
                const p = items[i];
                return p ? (
                  <div key={i} className="slot f" style={colorVars(p)}>
                    <ProductArt p={p} className="art-s" />
                    <small>{p.name}</small>
                    <button type="button" aria-label={'شيل ' + p.name} onClick={() => pick(p.slug)}>
                      <Icon name="close" />
                    </button>
                  </div>
                ) : (
                  <div key={i} className="slot">
                    <Icon name="plus" />
                    <span style={{ position: 'absolute', bottom: 8 }}>اختر ريحة</span>
                  </div>
                );
              })}
            </div>
            <div className="pick">
              {products.map((p) => (
                <button
                  key={p.slug}
                  className="pk"
                  type="button"
                  aria-pressed={picked.includes(p.slug)}
                  style={{ ['--c1' as string]: p.colors.c1 }}
                  onClick={() => pick(p.slug)}
                >
                  <ProductArt p={p} />
                  <b>{p.name}</b>
                  <small>
                    <Price value={defaultPrice(p)} />
                  </small>
                </button>
              ))}
            </div>
          </div>
          <div className="gbox">
            <h3 style={{ fontSize: '1.4rem' }}>ملخص الصندوق</h3>
            <div className="ln">
              <span>المجموع</span>
              <span>
                <Price value={sum} />
              </span>
            </div>
            <div className="ln sv">
              <span>خصم الصندوق</span>
              <span>
                <Price value={sum - price} minus />
              </span>
            </div>
            <div className="ln tot">
              <span>السعر</span>
              <span>
                <Price value={price} />
              </span>
            </div>
            <div className="fld">
              <label htmlFor="gnote">رسالة على الصندوق (اختياري)</label>
              <textarea className="field" id="gnote" rows={2} maxLength={80} placeholder="مثال: مبروك النجاح" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <FlashButton
              className="btn primary"
              disabled={!full}
              onClick={() => {
                if (!full) return;
                addLine({ t: 'b', ids: picked.slice(), note: note.trim().slice(0, 80), q: 1 });
                toast('صندوق المواسم صار بالسلة');
                setTimeout(() => {
                  setPicked([]);
                  setNote('');
                }, 900);
              }}
            >
              {full ? 'أضف الصندوق للسلة' : 'اختر ' + (BOX_SIZE - items.length) + ' بعد'}
            </FlashButton>
            <p className="muted" style={{ margin: 0, fontSize: '.82rem' }}>
              الصندوق يجي بتغليف هدية وبطاقة مكتوبة.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
