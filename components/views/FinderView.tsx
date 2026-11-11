'use client';
// /finder — "أي ريحة تناسبك؟" quiz (original PAGES.finder + renderFinder), scored on the products from MongoDB.
import Link from 'next/link';
import { useState } from 'react';
import { defaultPrice } from '@/lib/shop/pricing';
import type { CatalogProduct } from '@/lib/shop/types';
import { ProductArt } from '../ProductArt';
import { useStore } from '../store/StoreProvider';
import { Cards, DbNotice, FlashButton, Price, colorVars } from '../ui';

const FQ: Array<{ k: 'mood' | 'time' | 'cat'; q: string; o: Array<[string, string, string]> }> = [
  {
    k: 'mood',
    q: 'شنو الجو اللي تبيه؟',
    o: [
      ['calm', 'هادئ ومريح', 'مثل بعد المطر'],
      ['fresh', 'منعش وخفيف', 'هوا بحر وليمون'],
      ['warm', 'دافئ وعميق', 'قهوة وخشب'],
      ['bold', 'جريء وأصيل', 'عود وجمر'],
    ],
  },
  {
    k: 'time',
    q: 'متى بتستخدمها غالبًا؟',
    o: [
      ['morning', 'الصبح', 'مع القهوة'],
      ['evening', 'العصر والمغرب', 'وقت الجلسة'],
      ['night', 'الليل', 'قبل النوم'],
      ['any', 'أي وقت', 'ما يفرق'],
    ],
  },
  {
    k: 'cat',
    q: 'شنو تفضل؟',
    o: [
      ['candle', 'شمعة', 'تضيء البيت'],
      ['perfume', 'عطر', 'يلبسك'],
      ['incense', 'بخور', 'يملأ المكان'],
      ['any', 'أي شي', 'فاجئني'],
    ],
  },
];

export type FinderAnswers = { mood?: string; time?: string; cat?: string };

/** Same scoring as the original: mood 3, time 2 (any = 1), category 3 (any = 1). */
export function scoreProducts(products: CatalogProduct[], a: FinderAnswers) {
  const maxS = 3 + (a.time === 'any' ? 1 : 2) + (a.cat === 'any' ? 1 : 3);
  return products
    .map((p) => {
      const s =
        (p.moods.includes(a.mood as CatalogProduct['moods'][number]) ? 3 : 0) +
        (a.time === 'any' ? 1 : p.times.includes(a.time as CatalogProduct['times'][number]) ? 2 : 0) +
        (a.cat === 'any' ? 1 : p.category === a.cat ? 3 : 0);
      return { p, s, pct: Math.round((s / maxS) * 100) };
    })
    .sort((x, y) => y.s - x.s)
    .slice(0, 3);
}

export function FinderView() {
  const { products, addLine, toast, fly, dbDown } = useStore();
  const [step, setStep] = useState(0);
  const [a, setA] = useState<FinderAnswers>({});

  let body: React.ReactNode;
  if (dbDown || !products.length) {
    body = <DbNotice />;
  } else if (step < FQ.length) {
    const q = FQ[step];
    body = (
      <>
        <div className="dots">
          {FQ.map((_, i) => (
            <i key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <div className="fq">
          <span className="muted" style={{ fontSize: '.85rem' }}>
            سؤال {step + 1} من {FQ.length}
          </span>
          <h2>{q.q}</h2>
          <div className="fopts">
            {q.o.map((o) => (
              <button
                key={o[0]}
                className="fo"
                type="button"
                data-v={o[0]}
                onClick={() => {
                  setA((x) => ({ ...x, [q.k]: o[0] }));
                  setStep((s) => s + 1);
                }}
              >
                <b>{o[1]}</b>
                <span>{o[2]}</span>
              </button>
            ))}
          </div>
          {step > 0 ? (
            <div className="back">
              <button className="link" type="button" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                رجوع
              </button>
            </div>
          ) : null}
        </div>
      </>
    );
  } else {
    const scored = scoreProducts(products, a);
    const top = scored[0];
    const p = top.p;
    body = (
      <>
        <div className="dots">
          {FQ.map((_, i) => (
            <i key={i} className="on" />
          ))}
        </div>
        <span className="muted" style={{ fontSize: '.85rem' }}>
          ريحتك
        </span>
        <h2>تناسبك «{p.name}»</h2>
        <div className="res" data-id={p.slug} style={colorVars(p)}>
          <div className="art-wrap">
            <div className="art" style={{ cursor: 'default' }}>
              <ProductArt p={p} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="pct">{top.pct}%</div>
            <span className="muted">نسبة التوافق مع إجاباتك</span>
            <p style={{ margin: 0 }}>{p.description}</p>
            <div className="pr">
              <span>{p.sizes[p.defaultSize]?.label}</span>
              <b>
                <Price value={defaultPrice(p)} />
              </b>
            </div>
            <div className="cta-row">
              <FlashButton
                className="btn primary"
                onClick={(el) => {
                  addLine({ t: 'p', id: p.slug, vi: p.defaultSize, q: 1 });
                  toast(p.name + ' صارت بالسلة');
                  fly(el, p);
                }}
              >
                أضف للسلة
              </FlashButton>
              <Link className="btn line" href={'/products/' + p.slug}>
                التفاصيل
              </Link>
            </div>
          </div>
        </div>
        <h3 style={{ fontSize: '1.3rem', margin: '28px 0 14px' }}>بدائل قريبة</h3>
        <Cards list={scored.slice(1).map((x) => x.p)} cls="g3" />
        <div className="back">
          <button
            className="link"
            type="button"
            onClick={() => {
              setA({});
              setStep(0);
            }}
          >
            ابدأ من جديد
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="wrap">
      <div className="fwrap" id="fbox">
        {body}
      </div>
    </div>
  );
}
