'use client';
// /products/[slug] — ported from PAGES.product + AFTER.product: story, facts, scent layers, meters, "تناسبك إذا",
// season bar, usage/care tabs, "تكمّلها بـ", reviews (now stored in MongoDB), product rail, "شفتها قبل", sticky buy bar,
// pointer tilt and ←/→ keyboard navigation.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CATEGORY_LABEL, MONTHS } from '@/lib/shop/labels';
import { FREE_SHIPPING_FROM, MAX_PDP_QTY, defaultPrice, sizePrice } from '@/lib/shop/pricing';
import type { CatalogProduct, PublicReview } from '@/lib/shop/types';
import { Icon } from '../Icon';
import { ProductArt } from '../ProductArt';
import { useStore } from '../store/StoreProvider';
import { Cards, FlashButton, Price, Stars, colorVars } from '../ui';

function factsOf(p: CatalogProduct): Array<[string, string]> {
  const s = p.meters[0] ?? 0;
  if (p.category === 'candle')
    return [
      ['مدة الاحتراق', '20 إلى 45 ساعة'],
      ['قوة الانتشار', s > 60 ? 'قوية تملأ غرفة كبيرة' : 'متوسطة تناسب الغرف الصغيرة'],
      ['الشمع', 'صويا طبيعي'],
      ['الفتيلة', 'قطن'],
    ];
  if (p.category === 'perfume')
    return [
      ['الثبات', s > 60 ? '8-10 ساعات' : '5-7 ساعات'],
      ['الفوحان', s > 60 ? 'قوي' : 'خفيف إلى متوسط'],
      ['الأحجام', p.sizes.map((z) => z.label.replace(/\s*مل$/, '')).join(' · ') + ' مل'],
      ['التركيز', 'زيوت عطرية'],
    ];
  return [
    ['مدة القطعة', '30-40 دقيقة'],
    ['الدخان', s > 70 ? 'كثيف' : 'متوسط'],
    ['الأحجام', p.sizes.map((z) => z.label.replace(/\s*غ$/, '')).join(' · ') + ' غ'],
    ['الاستخدام', 'مبخرة وفحم'],
  ];
}

function sizeScale(n: number, vi: number) {
  return n === 3 ? [0.84, 0.96, 1.08][vi] ?? 1 : [0.9, 1.04][vi] ?? 1;
}

const METER_LABELS: Array<[string, string]> = [
  ['خفيفة', 'قوية'],
  ['منعشة', 'دافئة'],
  ['جافة', 'حلوة'],
  ['نهارية', 'ليلية'],
];

type RvSort = 'new' | 'hi' | 'lo' | 'help';

function Reviews({ product, initial, loadFailed }: { product: CatalogProduct; initial: PublicReview[]; loadFailed: boolean }) {
  const { user, helpful, toggleHelpful, toast } = useStore();
  const [reviews, setReviews] = useState(initial);
  const [filter, setFilter] = useState(0);
  const [sort, setSort] = useState<RvSort>('new');
  const [rate, setRate] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState('');
  const [errs, setErrs] = useState<{ rate?: string; text?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  const helpN = (r: PublicReview) => r.helpful + (helpful.has(r.id) ? 1 : 0);
  const n = reviews.length;
  const avg = n ? reviews.reduce((a, r) => a + r.rating, 0) / n : 0;
  const counts = [0, 0, 0, 0, 0, 0];
  reviews.forEach((r) => counts[r.rating]++);

  let list = filter ? reviews.filter((r) => r.rating === filter) : reviews.slice();
  if (sort === 'hi') list = list.sort((a, b) => b.rating - a.rating || b.ts - a.ts);
  else if (sort === 'lo') list = list.sort((a, b) => a.rating - b.rating || b.ts - a.ts);
  else if (sort === 'help') list = list.sort((a, b) => helpN(b) - helpN(a));
  else list = list.sort((a, b) => b.ts - a.ts);

  const lit = hover || rate;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    const next: typeof errs = {};
    if (!rate) next.rate = 'اختر عدد النجوم';
    if (t.length < 10) next.text = 'اكتب مراجعتك (10 أحرف على الأقل)';
    setErrs(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const res = await fetch('/api/products/' + product.slug + '/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ rating: rate, text: t.slice(0, 400) }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && Array.isArray(data.reviews)) {
        setReviews(data.reviews);
        setText('');
        setRate(0);
        setFilter(0);
        toast('وصلت مراجعتك، شكرًا');
      } else if (res.status === 401) {
        setErrs({ form: 'انتهت جلستك، سجّل دخولك مرة ثانية.' });
      } else {
        setErrs({ form: data.error || 'ما قدرنا ننشر مراجعتك الحين، جرّب بعد شوي.' });
      }
    } catch {
      setErrs({ form: 'تأكد من الاتصال وجرّب مرة ثانية.' });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch('/api/reviews/' + id, { method: 'DELETE', credentials: 'same-origin' });
      if (res.ok) {
        setReviews((rs) => rs.filter((r) => r.id !== id));
        toast('انحذفت مراجعتك');
      } else toast('ما قدرنا نحذفها الحين');
    } catch {
      toast('تأكد من الاتصال وجرّب مرة ثانية');
    }
  }

  return (
    <section className="psec" id="reviews">
      <h2>تقييمات الناس</h2>
      <p className="rvnote">التقييمات المعلّمة «مثال تجريبي» أمثلة لغرض التصميم. المراجعة اللي تكتبها وأنت مسجّل تنحفظ بقاعدة البيانات وتظهر للكل.</p>
      <div className="rvtop" style={{ marginTop: 20 }}>
        <div className="rvsum" id="revsum">
          <div className="avg">
            <div className="big">{avg.toFixed(1)}</div>
            <Stars value={avg} />
            <span className="muted" style={{ fontSize: '.85rem' }}>
              {n} تقييم
            </span>
          </div>
          <div className="dist">
            {[5, 4, 3, 2, 1].map((s) => {
              const pct = n ? Math.round((counts[s] / n) * 100) : 0;
              return (
                <button
                  key={s}
                  type="button"
                  className={'dbar' + (filter === s ? ' on' : '')}
                  aria-pressed={filter === s}
                  aria-label={'عرض تقييمات ' + s + ' نجوم'}
                  onClick={() => setFilter(filter === s ? 0 : s)}
                >
                  <span>{s} ★</span>
                  <i>
                    <b style={{ width: pct + '%' }} />
                  </i>
                  <em>{counts[s]}</em>
                </button>
              );
            })}
          </div>
        </div>
        {user ? (
          <form className="rvform" id="rvForm" noValidate onSubmit={submit}>
            <h3>اكتب مراجعتك</h3>
            <div>
              <span className="lbl">تقييمك</span>
              <div className="pstars" role="radiogroup" aria-label="تقييمك بالنجوم" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={rate === v}
                    aria-label={v + ' من 5'}
                    className={v <= lit ? 'on' : undefined}
                    onMouseEnter={() => setHover(v)}
                    onClick={() => {
                      setRate(v);
                      setErrs((x) => ({ ...x, rate: undefined }));
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <span className="err" id="rrerr">
                {errs.rate}
              </span>
            </div>
            <div className="fld">
              <label>اسمك</label>
              <div className="field rv-as" aria-readonly="true">
                {user.name}
              </div>
            </div>
            <div className="fld">
              <label htmlFor="rt">مراجعتك</label>
              <textarea
                className={'field' + (errs.text ? ' bad' : '')}
                id="rt"
                rows={3}
                maxLength={400}
                placeholder="شنو حسيت لما جربتها؟"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <span className="err" data-for="rt">
                {errs.text}
              </span>
            </div>
            <div>
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? 'جاري النشر…' : 'انشر المراجعة'}
              </button>
            </div>
            {errs.form ? (
              <p className="err" role="alert" style={{ margin: 0 }}>
                {errs.form}
              </p>
            ) : null}
          </form>
        ) : (
          <div className="rvform" id="rvForm">
            <h3>اكتب مراجعتك</h3>
            <p className="muted" style={{ margin: 0 }}>
              سجّل دخولك عشان تنشر مراجعتك باسمك، وتنحفظ بقاعدة البيانات.
            </p>
            <div className="cta-row">
              <Link className="btn primary" href={'/login?next=' + encodeURIComponent('/products/' + product.slug)}>
                سجّل دخولك
              </Link>
              <Link className="btn line" href={'/signup?next=' + encodeURIComponent('/products/' + product.slug)}>
                حساب جديد
              </Link>
            </div>
          </div>
        )}
      </div>
      <div className="rvbar">
        <h3 style={{ fontSize: '1.25rem' }}>كل المراجعات</h3>
        <label className="muted" style={{ fontSize: '.9rem' }}>
          الترتيب{' '}
          <select id="rsort" value={sort} onChange={(e) => setSort(e.target.value as RvSort)}>
            <option value="new">الأحدث</option>
            <option value="hi">الأعلى تقييمًا</option>
            <option value="lo">الأقل تقييمًا</option>
            <option value="help">الأكثر فائدة</option>
          </select>
        </label>
      </div>
      <div id="revlist">
        {loadFailed ? <p className="muted">ما قدرنا نحمّل المراجعات الحين.</p> : null}
        {filter ? (
          <p className="muted" style={{ margin: '10px 0 0' }}>
            تعرض تقييمات {filter} نجوم ·{' '}
            <button className="link" type="button" onClick={() => setFilter(0)}>
              عرض الكل
            </button>
          </p>
        ) : null}
        {!list.length && !loadFailed ? <p className="muted">ما فيه مراجعات بهالتقييم.</p> : null}
        {list.map((r) => (
          <article className="rvi" key={r.id}>
            <div className="rvh">
              <b>{r.name}</b>
              <Stars value={r.rating} />
              <span className="d">{r.when}</span>
              {r.mine ? <span className="rvtag me">مراجعتك</span> : r.sample ? <span className="rvtag">مثال تجريبي</span> : <span className="rvtag">زبون</span>}
            </div>
            <p>{r.text}</p>
            <div className="rvf">
              <button className="hp" type="button" aria-pressed={helpful.has(r.id)} onClick={() => toggleHelpful(r.id)}>
                مفيد ({helpN(r)})
              </button>
              {r.mine ? (
                <button className="link" type="button" onClick={() => remove(r.id)}>
                  حذف مراجعتي
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProductView({ product: p, initialReviews, reviewsFailed }: { product: CatalogProduct; initialReviews: PublicReview[]; reviewsFailed: boolean }) {
  const router = useRouter();
  const { products, bySlug, now, favs, toggleFav, addLine, toast, fly, recent, pushRecent, reduceMotion, setHasBar, drawerOpen, ready } = useStore();
  const [vi, setVi] = useState(p.defaultSize);
  const [q, setQ] = useState(1);
  const [tab, setTab] = useState<'use' | 'care'>('use');
  const [openLayer, setOpenLayer] = useState(-1);
  const [metersOn, setMetersOn] = useState(false);
  const [barOn, setBarOn] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const buyRowRef = useRef<HTMLDivElement>(null);

  const list = products.length ? products : [p];
  const i = Math.max(0, list.findIndex((x) => x.slug === p.slug));
  const prev = list[(i + list.length - 1) % list.length];
  const next = list[(i + 1) % list.length];
  const pair = p.pairSlug ? bySlug(p.pairSlug) : undefined;
  const fav = favs.has(p.slug);
  const unitPrice = sizePrice(p, vi);
  const seen = useMemo(() => recent.filter((x) => x !== p.slug).slice(0, 4).map(bySlug).filter((x): x is CatalogProduct => Boolean(x)), [recent, p.slug, bySlug]);

  // Record the visit only after the store has loaded the saved history (on a fresh page load this child effect
  // runs before the provider's load effect, which would otherwise overwrite it).
  useEffect(() => {
    if (ready) pushRecent(p.slug);
  }, [ready, p.slug, pushRecent]);

  // Meters animate from the middle to their value after first paint (original rAF×2).
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setMetersOn(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);

  // Pointer tilt on the stage.
  useEffect(() => {
    const st = stageRef.current;
    const svg = st?.querySelector('svg');
    if (!st || !svg || reduceMotion) return;
    const move = (e: PointerEvent) => {
      const r = st.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      svg.style.setProperty('--ry', (x * 16).toFixed(1) + 'deg');
      svg.style.setProperty('--rx', (-y * 12).toFixed(1) + 'deg');
    };
    const leave = () => {
      svg.style.setProperty('--ry', '0deg');
      svg.style.setProperty('--rx', '0deg');
    };
    st.addEventListener('pointermove', move);
    st.addEventListener('pointerleave', leave);
    return () => {
      st.removeEventListener('pointermove', move);
      st.removeEventListener('pointerleave', leave);
    };
  }, [reduceMotion, p.slug]);

  useEffect(() => {
    const svg = stageRef.current?.querySelector('svg');
    if (svg) svg.style.setProperty('--sz', String(sizeScale(p.sizes.length, vi)));
  }, [vi, p.sizes.length, p.slug]);

  // Centre the current product in the rail.
  useEffect(() => {
    const rail = railRef.current;
    const cur = rail?.querySelector('[aria-current="true"]');
    if (rail && cur) {
      const rr = rail.getBoundingClientRect();
      const cc = cur.getBoundingClientRect();
      rail.scrollLeft += cc.left + cc.width / 2 - (rr.left + rr.width / 2);
    }
  }, [p.slug, products.length]);

  // Sticky buy bar once the buy row has scrolled above the viewport.
  useEffect(() => {
    const br = buyRowRef.current;
    if (!br || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((en) => {
      const e = en[0];
      const show = !e.isIntersecting && e.boundingClientRect.top < 0;
      setBarOn(show);
      setHasBar(show);
    });
    io.observe(br);
    return () => {
      io.disconnect();
      setHasBar(false);
    };
  }, [setHasBar, p.slug]);

  // ←/→ move between products (← = next in RTL), like the original.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.ctrlKey || e.metaKey || e.altKey || drawerOpen) return;
      if (/INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName || '')) return;
      const d = e.key === 'ArrowLeft' ? 1 : -1;
      const target = list[(i + d + list.length) % list.length];
      if (target) router.push('/products/' + target.slug);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [list, i, router, drawerOpen]);

  const add = (el: HTMLElement) => {
    addLine({ t: 'p', id: p.slug, vi, q });
    toast(p.name + ' صارت بالسلة (' + q + ')');
    fly(el, p);
  };

  const layers: Array<[string, string, string, string]> = [
    ['القمة', '52%', 'أول انطباع. يظهر مباشرة ويخف بعد ربع ساعة تقريبًا.', p.notes.top],
    ['القلب', '76%', 'قلب الريحة. يظهر بعد دقائق ويستمر عدة ساعات.', p.notes.heart],
    ['القاعدة', '100%', 'آخر ما يبقى. يثبّت الريحة ويبقى بعد ما يختفي الباقي.', p.notes.base],
  ];
  const ratingAvg = initialReviews.length ? initialReviews.reduce((a, r) => a + r.rating, 0) / initialReviews.length : p.rating.avg;
  const ratingN = initialReviews.length || p.rating.n;
  const seasonLabel = p.allYear ? 'طول السنة' : p.seasons.map((m) => MONTHS[m - 1]).join('، ');

  return (
    <>
      <div className="wrap" style={colorVars(p)}>
        <div className="page-head pnav">
          <nav className="crumbs" aria-label="مسار الصفحة">
            <Link href="/">الرئيسية</Link>
            <span>/</span>
            <Link href="/products">المتجر</Link>
            <span>/</span>
            <span>{p.name}</span>
          </nav>
          <div className="pn">
            <Link href={'/products/' + prev.slug} aria-label={'المنتج السابق: ' + prev.name}>
              <Icon name="arrowr" />
              <span>{prev.name}</span>
            </Link>
            <span className="pcount">
              {i + 1} / {list.length}
            </span>
            <Link href={'/products/' + next.slug} aria-label={'المنتج التالي: ' + next.name}>
              <span>{next.name}</span>
              <Icon name="arrow" />
            </Link>
          </div>
        </div>
        <div className="pdp" data-id={p.slug}>
          <div className="stage" id="stage" ref={stageRef}>
            <ProductArt p={p} />
          </div>
          <div className="pinfo">
            <div>
              <span className="en" dir="ltr">
                {p.nameEn} · {CATEGORY_LABEL[p.category]}
              </span>
              <h1>{p.name}</h1>
            </div>
            <button
              className="rate-line"
              type="button"
              aria-label="الانتقال للتقييمات"
              onClick={() => document.getElementById('reviews')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })}
            >
              <span id="topstars">
                <Stars value={ratingAvg} />
              </span>
              <span id="toptxt">
                {ratingAvg.toFixed(1)} · {ratingN} تقييم
              </span>
            </button>
            <p className="moment">{p.moment}</p>
            <p className="desc">{p.description}</p>
            <div className="price-big" id="pprice" data-testid="pdp-price">
              <Price value={unitPrice * q} />
            </div>
            <div>
              <span className="lbl">الحجم</span>
              <div className="opts" id="vopts">
                {p.sizes.map((v, k) => (
                  <button key={k} className="opt" type="button" aria-pressed={k === vi} onClick={() => setVi(k)}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="buyrow" ref={buyRowRef}>
              <div className="qty">
                <button type="button" aria-label="نقّص" onClick={() => setQ((x) => Math.max(x - 1, 1))}>
                  −
                </button>
                <span id="pq">{q}</span>
                <button type="button" aria-label="زد" onClick={() => setQ((x) => Math.min(x + 1, MAX_PDP_QTY))}>
                  +
                </button>
              </div>
              <FlashButton className="btn primary" style={{ flex: '1 1 180px' }} onClick={add}>
                أضف للسلة
              </FlashButton>
              <button className="ib" type="button" aria-pressed={fav} aria-label="المفضلة" style={{ width: 48, height: 48 }} onClick={() => toggleFav(p.slug)}>
                <Icon name="heart" />
              </button>
            </div>
            <button
              className="btn line"
              type="button"
              onClick={() => {
                addLine({ t: 'p', id: p.slug, vi, q });
                router.push('/checkout');
              }}
            >
              اشتر الحين
            </button>
            <div className="trust">
              <div>
                <Icon name="truck" />
                توصيل مجاني فوق <Price value={FREE_SHIPPING_FROM} />
              </div>
              <div>
                <Icon name="leaf" />
                مكونات طبيعية
              </div>
              <div>
                <Icon name="gift" />
                تغليف هدية متوفر
              </div>
            </div>
          </div>
        </div>

        <section className="psec">
          <h2>قصة الريحة</h2>
          <p className="pstory">{p.story}</p>
          <div className="facts4">
            {factsOf(p).map(([k, v]) => (
              <div key={k}>
                <small>{k}</small>
                <b>{v}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="psec">
          <div className="p2">
            <div>
              <h2 className="sh">طبقات الريحة</h2>
              <div className="pyr">
                {layers.map((l, k) => (
                  <button
                    key={l[0]}
                    className={'py' + (openLayer === k ? ' open' : '')}
                    type="button"
                    aria-expanded={openLayer === k}
                    style={{ ['--w' as string]: l[1] } as CSSProperties}
                    onClick={() => setOpenLayer(openLayer === k ? -1 : k)}
                  >
                    <b>{l[0]}</b>
                    {l[3]}
                    <span className="pyx">{l[2]}</span>
                  </button>
                ))}
              </div>
              <p className="muted" style={{ fontSize: '.82rem', margin: '10px 0 0', textAlign: 'center' }}>
                اضغط على أي طبقة تعرف أكثر.
              </p>
              <div className="mts">
                {p.meters.slice(0, 4).map((v, k) => (
                  <div className="mt" key={k}>
                    <span>{METER_LABELS[k][0]}</span>
                    <div className="mtr" data-v={v} style={{ ['--v' as string]: (metersOn ? v : 50) + '%' } as CSSProperties}>
                      <b />
                      <i />
                    </div>
                    <span>{METER_LABELS[k][1]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="sh">تناسبك إذا</h2>
              <ul className="suits">
                {p.suits.map((s) => (
                  <li key={s}>
                    <Icon name="check" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <span className="lbl">موسمها: {seasonLabel}</span>
              <div className="seasonbar" style={{ ['--c1' as string]: p.colors.c1 } as CSSProperties}>
                {Array.from({ length: 12 }, (_, k) => k + 1).map((m) => (
                  <div key={m} className={(p.seasons.includes(m) ? 'on' : '') + (m === now ? ' nowm' : '')}>
                    <i />
                    {MONTHS[m - 1].slice(0, 3)}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22 }}>
                <div className="tabs" role="tablist">
                  <button className="tab" role="tab" type="button" aria-selected={tab === 'use'} onClick={() => setTab('use')}>
                    الاستخدام
                  </button>
                  <button className="tab" role="tab" type="button" aria-selected={tab === 'care'} onClick={() => setTab('care')}>
                    المكونات والعناية
                  </button>
                </div>
                <div className="tabp" id="tp-use" hidden={tab !== 'use'}>
                  {p.usage}
                </div>
                <div className="tabp" id="tp-care" hidden={tab !== 'care'}>
                  {p.care}
                </div>
              </div>
            </div>
          </div>
        </section>

        {pair ? (
          <section className="psec">
            <h2>تكمّلها بـ</h2>
            <div className="pair" style={colorVars(pair)}>
              <div className="pa">
                <ProductArt p={pair} />
              </div>
              <div>
                <span className="en" dir="ltr">
                  {pair.nameEn}
                </span>
                <h3>
                  <Link href={'/products/' + pair.slug} style={{ textDecoration: 'none' }}>
                    {pair.name}
                  </Link>
                </h3>
                <p>
                  {pair.moment}. <Price value={defaultPrice(pair)} />
                </p>
                <FlashButton
                  className="btn line sm"
                  onClick={(el) => {
                    addLine({ t: 'p', id: p.slug, vi, q });
                    addLine({ t: 'p', id: pair.slug, vi: pair.defaultSize, q: 1 });
                    toast(p.name + ' و' + pair.name + ' صاروا بالسلة');
                    fly(el, pair);
                  }}
                >
                  أضف الاثنين للسلة
                </FlashButton>
              </div>
            </div>
          </section>
        ) : null}

        <Reviews key={p.slug} product={p} initial={initialReviews} loadFailed={reviewsFailed} />

        <section className="psec">
          <div className="row-head">
            <div>
              <h2>تنقل بين الروائح</h2>
              <p>اضغط على أي منتج تفتح صفحته، أو استخدم أسهم الكيبورد.</p>
            </div>
          </div>
          <div className="rail" id="rail" ref={railRef}>
            {list.map((x) => (
              <Link key={x.slug} className="rl" href={'/products/' + x.slug} style={colorVars(x)} aria-current={x.slug === p.slug ? 'true' : undefined}>
                <span className="rlart">
                  <ProductArt p={x} />
                </span>
                <b>{x.name}</b>
                <small>{CATEGORY_LABEL[x.category]}</small>
              </Link>
            ))}
          </div>
        </section>
        {seen.length ? (
          <section className="psec">
            <div className="row-head">
              <h2>شفتها قبل</h2>
            </div>
            <Cards list={seen} />
          </section>
        ) : null}
        <div style={{ height: 24 }} />
      </div>
      <div className={'buybar' + (barOn ? ' show' : '')} id="buybar" data-id={p.slug} aria-hidden={!barOn}>
        <div>
          <b>{p.name}</b>
          <span id="bbp">
            <Price value={unitPrice * q} />
          </span>
        </div>
        <FlashButton className="btn primary sm" tabIndex={barOn ? 0 : -1} onClick={add}>
          أضف للسلة
        </FlashButton>
      </div>
    </>
  );
}
