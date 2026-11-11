'use client';
// Home page — ported from PAGES.home + AFTER.home (rain canvas, ad video upload). Products come from MongoDB.
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { MONTHS } from '@/lib/shop/labels';
import { sizePrice } from '@/lib/shop/pricing';
import type { CatalogProduct } from '@/lib/shop/types';
import { Icon } from '../Icon';
import { ProductArt } from '../ProductArt';
import { useStore } from '../store/StoreProvider';
import { Cards, DbNotice, Price } from '../ui';

const AD_SRC = process.env.NEXT_PUBLIC_WASMI_AD_URL || '';

function useRain(ref: React.RefObject<HTMLCanvasElement | null>, reduce: boolean) {
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    let W = 0;
    let H = 0;
    let rip: Array<{ x: number; y: number; r: number; max: number }> = [];
    let last = 0;
    let raf = 0;
    let lastPtr = 0;
    let dead = false;
    const size = () => {
      const r = cv.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      cv.width = Math.max(1, W * d);
      cv.height = Math.max(1, H * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    const add = (x: number, y: number, prog?: number) => {
      const max = 60 + Math.random() * 90;
      rip.push({ x, y, r: (prog || 0) * max, max });
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of rip) {
        const a = 0.45 * (1 - p.r / p.max);
        if (a <= 0) continue;
        ctx.strokeStyle = 'rgba(247,235,218,' + a.toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.32, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    const tick = (t: number) => {
      if (dead) return;
      if (t - last > 360) {
        add(Math.random() * W, H * (0.3 + Math.random() * 0.68));
        last = t;
      }
      for (const p of rip) p.r += 0.8;
      rip = rip.filter((p) => p.r < p.max);
      draw();
      raf = requestAnimationFrame(tick);
    };
    size();
    for (let i = 0; i < 9; i++) add(Math.random() * W, H * (0.3 + Math.random() * 0.68), Math.random() * 0.9);
    draw();
    const onResize = () => {
      size();
      draw();
    };
    window.addEventListener('resize', onResize);
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastPtr < 110) return;
      lastPtr = now;
      const r = cv.getBoundingClientRect();
      add(e.clientX - r.left, e.clientY - r.top);
    };
    const host = cv.parentElement;
    if (!reduce && host) {
      host.addEventListener('pointermove', onMove);
      raf = requestAnimationFrame(tick);
    }
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      host?.removeEventListener('pointermove', onMove);
    };
  }, [ref, reduce]);
}

function Calendar({ products, now }: { products: CatalogProduct[]; now: number }) {
  const sorted = products.slice().sort((a, b) => (a.allYear ? 1 : 0) - (b.allYear ? 1 : 0) || (a.seasons[0] ?? 0) - (b.seasons[0] ?? 0));
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className="cal" role="img" aria-label="تقويم مواسم الروائح على اثني عشر شهرًا">
      <div className="calg">
        <div className="h" />
        {months.map((m) => (
          <div key={m} className={'h' + (m === now ? ' now' : '')}>
            {MONTHS[m - 1]}
          </div>
        ))}
        {sorted.map((p) => (
          <Fragment key={p.slug}>
            <div className="nmc">
              <Link href={'/products/' + p.slug}>{p.name}</Link>
            </div>
            {months.map((m) => {
              const on = p.seasons.includes(m);
              const s = on && !p.seasons.includes(m - 1);
              const e = on && !p.seasons.includes(m + 1);
              return (
                <div key={m} className={'c' + (m === now ? ' now' : '') + (s ? ' s' : '') + (e ? ' e' : '')} style={{ ['--c1' as string]: p.colors.c1 }}>
                  {on ? <i /> : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function AdVideo() {
  const { toast } = useStore();
  const vref = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState(AD_SRC);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const v = vref.current;
    if (!v || !url) return;
    v.src = url;
    v.load();
  }, [url]);
  useEffect(() => () => {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <div className="vwrap">
      <div className="vframe">
        <video
          id="adv"
          ref={vref}
          controls
          playsInline
          preload="metadata"
          hidden={!shown}
          onLoadedData={() => setShown(true)}
          onError={() => setShown(false)}
        />
        <div className="vph" id="vph" hidden={shown}>
          <Icon name="play" />
          <span>هنا يظهر إعلان وسمي بعد ما تسويه بـ Google Flow</span>
        </div>
      </div>
      <label className="btn line sm upl">
        <input
          type="file"
          id="advf"
          accept="video/*"
          onChange={(e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            try {
              setUrl(URL.createObjectURL(f));
              toast('تم تحميل الفيديو');
            } catch {
              toast('ما قدرت أشغل الفيديو');
            }
          }}
        />
        ارفع فيديو الإعلان
      </label>
    </div>
  );
}

export function HomeView() {
  const { products, bySlug, now, inSeason, reduceMotion, dbDown } = useStore();
  const rainRef = useRef<HTMLCanvasElement>(null);
  useRain(rainRef, reduceMotion);
  const nowList = products.filter(inSeason);
  const hero = bySlug('awal') ?? products[0];
  const finderArt = bySlug('rutab') ?? products[1];
  const giftArt = ['awal', 'ghubar', 'ghaim'].map(bySlug).filter((p): p is CatalogProduct => Boolean(p));
  const moments = products.map((p) => <span key={p.slug}>{p.moment}</span>);
  const moments2 = products.map((p) => <span key={p.slug + '-2'}>{p.moment}</span>);

  return (
    <>
      <section className="hero" aria-label="وسمي">
        <canvas id="rain" ref={rainRef} aria-hidden="true" />
        <div className="wrap">
          <div>
            <p className="eyebrow">شموع · عطور · بخور من أجواء الخليج</p>
            <h1>وسمي</h1>
            <div className="latin">WASMI</div>
            <p className="lead">خذ أول مطر معك.</p>
            <p className="sub">
              كل شمعة وعطر وبخور عندنا يحكي لحظة من الخليج، مثل التراب بعد أول مطر أو الشط قبل الفجر. نصبّها بدفعات صغيرة، وإذا خلصت تنتظر الموسم الجاي.
            </p>
            <div className="cta-row">
              <Link className="btn primary" href="/products">
                تسوّق الروائح
              </Link>
              <Link className="btn ghost" href="/finder">
                اكتشف ريحتك
              </Link>
            </div>
            {nowList.length ? (
              <p className="nowline">
                <i className="dot" />
                بموسمها الحين: <b>{nowList.slice(0, 3).map((p) => p.name).join(' · ')}</b>
              </p>
            ) : null}
            <ul className="facts">
              <li>دفعات من 120 قطعة بس</li>
              <li>شمع صويا مصبوب يدويًا</li>
              <li>ريحة لكل لحظة من الخليج</li>
            </ul>
          </div>
          <div className="hero-art">
            {hero ? (
              <>
                <ProductArt p={hero} />
                <Link className="hero-tag" href={'/products/' + hero.slug}>
                  {hero.name}
                  <b>
                    <Price value={sizePrice(hero, 1)} />
                  </b>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </section>
      <div className="marq" aria-hidden="true">
        <div className="track">
          {moments}
          {moments2}
        </div>
      </div>
      <section className="wrap sec">
        <div className="row-head">
          <div>
            <h2>بموسمها الحين</h2>
            <p>الروائح اللي موسمها {MONTHS[now - 1]}، لأن كل ريحة لها وقتها.</p>
          </div>
          <Link className="arrow" href="/products">
            كل المنتجات
            <Icon name="arrow" />
          </Link>
        </div>
        {dbDown ? <DbNotice /> : nowList.length ? <Cards list={nowList.slice(0, 4)} /> : <p className="muted">ما فيه ريحة موسمية هالشهر، شوف كل المنتجات.</p>}
      </section>
      <section className="why">
        <div className="wrap sec">
          <h2>نبيع اللحظة اللي ما أحد باعها</h2>
          <div className="why-list">
            <div>
              <h3>ريحة من الطبيعة نفسها</h3>
              <p>نبدأ من لحظة حقيقية، مثل التراب بعد أول مطر أو هوا البحر قبل الفجر، وبعدين نركّب ريحتها.</p>
            </div>
            <div>
              <h3>دفعات صغيرة وتخلص</h3>
              <p>كل دفعة 120 قطعة بس. إذا خلصت، تنتظر الموسم الجاي.</p>
            </div>
            <div>
              <h3>صبّ يدوي بشمع صويا</h3>
              <p>شمع نظيف يحترق ببطء، وجرّة زجاج تقدر تعيد استخدامها بعد ما تخلص.</p>
            </div>
          </div>
        </div>
      </section>
      <section className="wrap sec">
        <div className="row-head">
          <div>
            <h2>تقويم الروائح</h2>
            <p>كل ريحة لها موسمها بالسنة. العمود المظلل هو الشهر الحالي.</p>
          </div>
        </div>
        {dbDown ? <DbNotice compact /> : <Calendar products={products} now={now} />}
      </section>
      <section className="band">
        <div className="wrap">
          <div>
            <h2>ما تدري أي ريحة تناسبك؟</h2>
            <p>جاوب 3 أسئلة قصيرة وبنرشح لك ريحتك.</p>
            <div style={{ marginTop: 20 }}>
              <Link className="btn primary" href="/finder">
                ابدأ الاختبار
              </Link>
            </div>
          </div>
          <div className="art-mini">{finderArt ? <ProductArt p={finderArt} /> : null}</div>
        </div>
      </section>
      <section className="wrap sec" id="adsec">
        <div className="adsec">
          <div>
            <h2>إعلان وسمي</h2>
            <p className="muted" style={{ margin: '6px 0 0', maxWidth: '52ch' }}>
              إعلان 12 ثانية يمشي على خمس لقطات: يوقف السكرول، يوضح المنتج، يقول ليش يهتم، يثبّت البراند، ويطلب خطوة.
            </p>
            <ol className="beats">
              <li>
                <span className="sec-t">0-2 ث</span>
                <div>
                  <h3>Hook</h3>
                  <p>قطرة مطر على رمل ناشف وحلقة ماء بوهج عنبري.</p>
                </div>
              </li>
              <li>
                <span className="sec-t">2-5 ث</span>
                <div>
                  <h3>Product</h3>
                  <p>شمعة «تراب الوسمي» تتشعل وبخار خفيف يطلع.</p>
                </div>
              </li>
              <li>
                <span className="sec-t">5-8 ث</span>
                <div>
                  <h3>Benefit</h3>
                  <p>«ريحة التراب بعد أول مطر. وقت ما تبيها.»</p>
                </div>
              </li>
              <li>
                <span className="sec-t">8-10.5 ث</span>
                <div>
                  <h3>Brand</h3>
                  <p>شعار القطرة والحلقات مع اسم وسمي.</p>
                </div>
              </li>
              <li>
                <span className="sec-t">10.5-12 ث</span>
                <div>
                  <h3>CTA</h3>
                  <p>«خذ أول مطر معك. اطلبها قبل ما تخلص الدفعة.»</p>
                </div>
              </li>
            </ol>
          </div>
          <AdVideo />
        </div>
      </section>
      <section className="band">
        <div className="wrap">
          <div>
            <h2>هدية ما تنساها</h2>
            <p>اختر 3 روائح بصندوق واحد ويجيك خصم 15%.</p>
            <div style={{ marginTop: 20 }}>
              <Link className="btn primary" href="/gift">
                صمّم صندوقك
              </Link>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, direction: 'ltr' }}>
            {giftArt.map((p) => (
              <div key={p.slug} style={{ width: 90 }}>
                <ProductArt p={p} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
