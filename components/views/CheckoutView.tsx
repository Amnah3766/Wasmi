'use client';
// /checkout (original PAGES.checkout + submit handler) and /cart. Day 4: a signed-in visitor's order is saved with
// POST /api/orders and the confirmation appears ONLY after the server has saved it. Prices and totals shown here are
// a preview; the server recomputes everything from MongoDB.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DELIVERY_SLOTS } from '@/lib/shop/labels';
import { lineKey } from '@/lib/shop/pricing';
import type { CartLine, DeliveryInfo, PaymentMethod } from '@/lib/shop/types';
import { PromoBox } from '../Chrome';
import { Icon } from '../Icon';
import { useStore } from '../store/StoreProvider';
import { DbNotice, Price } from '../ui';

function Summary() {
  const { cart, lineInfo, unit, totals } = useStore();
  const rows = cart.map((l) => ({ l, n: lineInfo(l) })).filter((r) => r.n);
  return (
    <>
      <h3>ملخصك</h3>
      {rows.map(({ l, n }, i) => (
        <div className="sl" key={i}>
          <span>
            {n!.name} <em>× {l.q}</em>
          </span>
          <span>
            <Price value={unit(l) * l.q} />
          </span>
        </div>
      ))}
      <PromoBox />
      <div className="ln">
        <span>المجموع</span>
        <span>
          <Price value={totals.sub} />
        </span>
      </div>
      {totals.disc ? (
        <div className="ln sv">
          <span>خصم</span>
          <span>
            <Price value={totals.disc} minus />
          </span>
        </div>
      ) : null}
      <div className="ln">
        <span>التوصيل</span>
        <span>{totals.ship ? <Price value={totals.ship} /> : 'مجاني'}</span>
      </div>
      <div className="ln tot">
        <span>الإجمالي</span>
        <span data-testid="checkout-total">
          <Price value={totals.total} />
        </span>
      </div>
    </>
  );
}

type Draft = { fn: string; fp: string; fa: string; fd: string; fad: string; pay: PaymentMethod };
const EMPTY: Draft = { fn: '', fp: '', fa: '', fd: DELIVERY_SLOTS[0], fad: '', pay: 'stripe' };
/** Cart line keys sent to Stripe, so /checkout/success removes exactly the paid lines from the cart. */
export const PAYING_KEY = 'wasmi5.paying';
const DRAFT_KEY = 'wasmi4.checkout';

const SERVER_FIELD: Record<string, keyof Draft> = { name: 'fn', phone: 'fp', area: 'fa', address: 'fad', payment: 'pay' };

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {};
  if (d.fn.trim().length < 3) e.fn = 'اكتب اسمك الكامل';
  if (!/^\+?\d{8,12}$/.test(d.fp.replace(/\s/g, ''))) e.fp = 'اكتب رقم جوال صحيح';
  if (!d.fa.trim()) e.fa = 'اكتب منطقتك';
  if (d.fad.trim().length < 5) e.fad = 'اكتب عنوانك بالتفصيل';
  return e;
}

const FIELD_MSG: Record<string, string> = { fn: 'اكتب اسمك الكامل', fp: 'اكتب رقم جوال صحيح', fa: 'اكتب منطقتك', fad: 'اكتب عنوانك بالتفصيل', pay: 'اختر طريقة الدفع' };

export function CheckoutView() {
  const router = useRouter();
  const { cart, lineInfo, ready, user, promo, clearCart, dbDown } = useStore();
  const [d, setD] = useState<Draft>(EMPTY);
  const [errs, setErrs] = useState<Partial<Record<keyof Draft, string>>>({});
  const [formMsg, setFormMsg] = useState('');
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  const loginRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Keep what the visitor typed if they leave to sign in and come back (this tab only).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) setD({ ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) });
    } catch {
      /* ignore */
    }
  }, []);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const next = { ...d, [k]: e.target.value } as Draft;
    setD(next);
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const lines: CartLine[] = cart.filter((l) => lineInfo(l));
  const next = encodeURIComponent('/checkout');

  if (!ready) return <div className="wrap" style={{ minHeight: '60vh' }} aria-busy="true" />;
  if (dbDown)
    return (
      <div className="wrap">
        <div className="okbox">
          <DbNotice />
        </div>
      </div>
    );
  if (!lines.length)
    return (
      <div className="wrap">
        <div className="okbox">
          <h2>سلتك فاضية</h2>
          <p className="muted">أضف روائح أول، وبعدين ارجع للطلب.</p>
          <Link className="btn primary" href="/products">
            تسوّق الروائح
          </Link>
        </div>
      </div>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg('');
    const v = validate(d);
    setErrs(v);
    if (Object.keys(v).length) {
      const first = formRef.current?.querySelector<HTMLElement>('.field.bad');
      setTimeout(() => (formRef.current?.querySelector<HTMLElement>('.field.bad') ?? first)?.focus(), 0);
      return;
    }
    if (!user) {
      setNeedLogin(true);
      loginRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setBusy(true);
    const delivery: DeliveryInfo = { name: d.fn.trim(), phone: d.fp.replace(/\s/g, ''), area: d.fa.trim(), address: d.fad.trim(), slot: d.fd };
    if (d.pay === 'stripe') {
      await payByCard(delivery);
      return;
    }
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        // Only slugs, sizes, quantities and the delivery details. No prices: the server reads them from MongoDB.
        body: JSON.stringify({ lines, promo, delivery, payment: d.pay }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && data.order?.id) {
        clearCart();
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
        router.push('/orders/' + data.order.id + '?placed=1');
        return;
      }
      if (res.status === 401) {
        setNeedLogin(true);
        setFormMsg('انتهت جلستك. سجّل دخولك عشان ينحفظ طلبك.');
      } else if (res.status === 400 && data.fields) {
        const mapped: Partial<Record<keyof Draft, string>> = {};
        for (const k of Object.keys(data.fields)) {
          const f = SERVER_FIELD[k];
          if (f) mapped[f] = FIELD_MSG[f];
        }
        setErrs(mapped);
        setFormMsg(data.fields.lines ? 'فيه منتج بسلتك ما صار متوفر، حدّث الصفحة وجرّب مرة ثانية.' : data.error || 'راجع البيانات وجرّب مرة ثانية.');
      } else {
        setFormMsg(data.error || 'ما قدرنا نحفظ طلبك الحين، جرّب بعد شوي.');
      }
    } catch {
      setFormMsg('تأكد من الاتصال وجرّب مرة ثانية. سلتك محفوظة.');
    } finally {
      setBusy(false);
    }
  }

  // Card payment (Day 5): the server prices the cart from MongoDB and creates a Stripe Checkout Session; the browser
  // only sends slugs, sizes, quantities, the promo code and the delivery details, then goes to Stripe's own page.
  // Nothing is saved and the cart stays as it is until Stripe confirms the payment.
  async function payByCard(delivery: DeliveryInfo) {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ lines, promo, delivery }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201 && typeof data.url === 'string' && /^https:\/\/([a-z0-9-]+\.)*stripe\.com\//.test(data.url)) {
        try {
          sessionStorage.setItem(PAYING_KEY, JSON.stringify(lines.map(lineKey)));
        } catch {
          /* ignore */
        }
        window.location.assign(data.url);
        return; // keep the button busy while the browser leaves for Stripe
      }
      if (res.status === 401) {
        setNeedLogin(true);
        setFormMsg('سجّل دخولك عشان تدفع وينحفظ طلبك.');
      } else if (res.status === 400 && data.fields) {
        const mapped: Partial<Record<keyof Draft, string>> = {};
        for (const k of Object.keys(data.fields)) {
          const f = SERVER_FIELD[k];
          if (f) mapped[f] = FIELD_MSG[f];
        }
        setErrs(mapped);
        setFormMsg(data.fields.lines ? 'فيه منتج بسلتك ما صار متوفر، حدّث الصفحة وجرّب مرة ثانية.' : data.error || 'راجع البيانات وجرّب مرة ثانية.');
      } else {
        setFormMsg(data.error || 'ما قدرنا نفتح صفحة الدفع الحين، جرّب بعد شوي.');
      }
    } catch {
      setFormMsg('تأكد من الاتصال وجرّب مرة ثانية. ما انخصم شي وسلتك محفوظة.');
    }
    setBusy(false);
  }

  const card = d.pay === 'stripe';

  return (
    <div className="wrap">
      <div className="page-head">
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>إتمام الطلب</h1>
        <p>هذا طلب تجريبي، ما فيه دفع حقيقي. طلبك ينحفظ بحسابك وتلقاه بصفحة «طلباتي».</p>
      </div>
      {!user ? (
        <div className={'authnote' + (needLogin ? ' on' : '')} ref={loginRef} role={needLogin ? 'alert' : undefined} data-testid="login-required">
          <Icon name="user" />
          <div>
            <b>سجّل دخولك عشان ينحفظ طلبك</b>
            <span>سلتك وبياناتك تبقى مثل ما هي، وترجع لهالصفحة بعد الدخول.</span>
          </div>
          <div className="cta-row">
            <Link className="btn primary sm" href={'/login?next=' + next}>
              تسجيل الدخول
            </Link>
            <Link className="btn line sm" href={'/signup?next=' + next}>
              حساب جديد
            </Link>
          </div>
        </div>
      ) : null}
      <div className="co">
        <form className="form" id="coForm" noValidate onSubmit={submit} ref={formRef}>
          <div className="two">
            <div className="fld">
              <label htmlFor="fn">الاسم الكامل</label>
              <input className={'field' + (errs.fn ? ' bad' : '')} id="fn" autoComplete="name" value={d.fn} onChange={set('fn')} />
              <span className="err" data-for="fn">
                {errs.fn}
              </span>
            </div>
            <div className="fld">
              <label htmlFor="fp">رقم الجوال</label>
              <input className={'field' + (errs.fp ? ' bad' : '')} id="fp" type="tel" autoComplete="tel" dir="ltr" inputMode="numeric" value={d.fp} onChange={set('fp')} />
              <span className="err" data-for="fp">
                {errs.fp}
              </span>
            </div>
          </div>
          <div className="two">
            <div className="fld">
              <label htmlFor="fa">المنطقة</label>
              <input className={'field' + (errs.fa ? ' bad' : '')} id="fa" value={d.fa} onChange={set('fa')} />
              <span className="err" data-for="fa">
                {errs.fa}
              </span>
            </div>
            <div className="fld">
              <label htmlFor="fd">وقت التوصيل</label>
              <select className="field" id="fd" value={d.fd} onChange={set('fd')}>
                {DELIVERY_SLOTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="fld">
            <label htmlFor="fad">العنوان</label>
            <textarea className={'field' + (errs.fad ? ' bad' : '')} id="fad" rows={2} placeholder="القطعة، الشارع، رقم البيت" value={d.fad} onChange={set('fad')} />
            <span className="err" data-for="fad">
              {errs.fad}
            </span>
          </div>
          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            <legend style={{ fontSize: '.88rem', fontWeight: 500, marginBottom: 6 }}>طريقة الدفع</legend>
            <label className="radio" data-testid="pay-card">
              <input type="radio" name="pay" value="stripe" checked={d.pay === 'stripe'} onChange={set('pay')} />
              <div>
                <b>
                  بطاقة بنكية عبر Stripe <span className="testbadge">وضع Stripe التجريبي</span>
                </b>
                <span>تنتقل لصفحة الدفع الآمنة من Stripe، وطلبك ينحفظ بعد ما ينجح الدفع بس.</span>
              </div>
            </label>
            <label className="radio">
              <input type="radio" name="pay" value="cod" checked={d.pay === 'cod'} onChange={set('pay')} />
              <div>
                <b>الدفع عند الاستلام</b>
                <span>ادفع للمندوب لما توصلك الطلبية.</span>
              </div>
            </label>
            <label className="radio">
              <input type="radio" name="pay" value="link" checked={d.pay === 'link'} onChange={set('pay')} />
              <div>
                <b>رابط دفع إلكتروني</b>
                <span>نرسل لك رابط دفع آمن على جوالك بعد التأكيد.</span>
              </div>
            </label>
          </fieldset>
          <div className="paybar">
            <button className="btn primary" type="submit" disabled={busy} data-testid="checkout-submit">
              {card ? (busy ? 'ننقلك لصفحة الدفع…' : 'ادفع بالبطاقة') : busy ? 'جاري حفظ طلبك…' : 'تأكيد الطلب'}
            </button>
            {card ? (
              <div className="testcard" data-testid="test-card">
                <span className="testbadge">وضع Stripe التجريبي</span>
                <span>
                  بطاقة التجربة: <bdi dir="ltr">4242 4242 4242 4242</bdi> · أي تاريخ مستقبلي · أي CVC
                </span>
                <span className="muted">ما ينخصم أي مبلغ حقيقي. Stripe يعرض المبلغ بالدولار بسعر ثابت 1 د.ك = 3.25 $.</span>
              </div>
            ) : null}
          </div>
          {formMsg ? (
            <p className="err" role="alert" style={{ margin: 0 }}>
              {formMsg}
            </p>
          ) : null}
        </form>
        <aside className="sumbox" id="sumbox">
          <Summary />
        </aside>
      </div>
    </div>
  );
}

export function CartView() {
  const { cart, lineInfo, unit, changeQty, removeLine, ready, dbDown } = useStore();
  const rows = cart.map((l, i) => ({ l, i, n: lineInfo(l) })).filter((r) => r.n);
  return (
    <div className="wrap">
      <div className="page-head">
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>سلتك</h1>
        <p>راجع روائحك وكمياتها قبل إتمام الطلب.</p>
      </div>
      {dbDown ? (
        <DbNotice />
      ) : !ready ? (
        <div style={{ minHeight: '40vh' }} aria-busy="true" />
      ) : !rows.length ? (
        <div className="okbox">
          <h2>سلتك فاضية</h2>
          <p className="muted">اختر ريحة تبدأ فيها.</p>
          <Link className="btn primary" href="/products">
            تصفح الروائح
          </Link>
        </div>
      ) : (
        <div className="co">
          <ul className="dlist cartpage">
            {rows.map(({ l, i, n }) => (
              <li className="row" key={i + ':' + l.t} style={{ ['--c1' as string]: n!.c1, ['--c2' as string]: n!.c2, ['--c3' as string]: n!.c3 }}>
                <span className={'thumb' + (n!.box ? ' box' : '')} />
                <div className="rt">
                  <b>{n!.name}</b>
                  <small>{n!.sub}</small>
                  <div className="qty">
                    <button type="button" aria-label="نقّص الكمية" onClick={() => changeQty(i, -1)}>
                      −
                    </button>
                    <span>{l.q}</span>
                    <button type="button" aria-label="زد الكمية" onClick={() => changeQty(i, 1)}>
                      +
                    </button>
                  </div>
                </div>
                <div className="rp">
                  <span>
                    <Price value={unit(l) * l.q} />
                  </span>
                  <button type="button" aria-label={'احذف ' + n!.name} onClick={() => removeLine(i)}>
                    <Icon name="trash" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <aside className="sumbox">
            <Summary />
            <Link className="btn primary" href="/checkout">
              أكمل الطلب
            </Link>
          </aside>
        </div>
      )}
      <div style={{ height: 'clamp(40px,6vw,72px)' }} />
    </div>
  );
}
