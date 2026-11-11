'use client';
// /checkout/success and /checkout/cancel (Day 5, Stripe test mode).
// Success: Stripe sends the visitor back here after paying. Without reloading the page, the view asks the server
// (POST /api/checkout/confirm) to re-check the session WITH STRIPE; once Stripe says "paid", the server saves the
// order in MongoDB with status "paid" and the view shows «تم الدفع ✓», then removes the paid lines from the cart.
// If Stripe is still confirming, it checks again by itself every 2.5 s (8 times at most).
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicOrder } from '@/lib/shop/types';
import { Icon } from '../Icon';
import { useStore } from '../store/StoreProvider';
import { Price } from '../ui';
import { PAYING_KEY } from './CheckoutView';

type View =
  | { kind: 'checking' }
  | { kind: 'paid'; order: PublicOrder }
  | { kind: 'processing' }
  | { kind: 'open' }
  | { kind: 'expired' }
  | { kind: 'invalid' }
  | { kind: 'login' }
  | { kind: 'error'; reason: string };

const MAX_AUTO_CHECKS = 8;
const RECHECK_MS = 2500;

export function CheckoutSuccessView({ sessionId }: { sessionId: string | null }) {
  const { removeLinesByKey, ready } = useStore();
  const [view, setView] = useState<View>(sessionId ? { kind: 'checking' } : { kind: 'invalid' });
  const attempts = useRef(0);
  const cleared = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const confirm = useCallback(
    async (signal?: AbortSignal) => {
      if (!sessionId) return;
      attempts.current += 1;
      try {
        const res = await fetch('/api/checkout/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
          body: JSON.stringify({ sessionId }),
          signal,
        });
        const data = (await res.json().catch(() => ({}))) as { status?: string; order?: PublicOrder; error?: string };
        if (signal?.aborted) return;
        if (res.status === 401) return setView({ kind: 'login' });
        if (res.status === 404 || res.status === 400) return setView({ kind: 'invalid' });
        if (!res.ok) return setView({ kind: 'error', reason: data.error ?? 'ما قدرنا نتأكد من الدفع الحين.' });
        if (data.status === 'paid' && data.order) return setView({ kind: 'paid', order: data.order });
        if (data.status === 'expired') return setView({ kind: 'expired' });
        if (data.status === 'open') return setView({ kind: 'open' });
        setView({ kind: 'processing' });
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') return;
        setView({ kind: 'error', reason: 'تأكد من الاتصال وجرّب مرة ثانية.' });
      }
    },
    [sessionId],
  );

  // First check on load (no reload needed), then automatic re-checks while Stripe is still confirming.
  useEffect(() => {
    const ctrl = new AbortController();
    void confirm(ctrl.signal);
    return () => ctrl.abort();
  }, [confirm]);

  useEffect(() => {
    if (view.kind !== 'processing' || attempts.current >= MAX_AUTO_CHECKS) return;
    const timer = window.setTimeout(() => void confirm(), RECHECK_MS);
    return () => window.clearTimeout(timer);
  }, [view, confirm]);

  // Paid: remove exactly the lines that were sent to Stripe (anything added later stays in the cart).
  useEffect(() => {
    if (view.kind !== 'paid' || cleared.current || !ready) return;
    cleared.current = true;
    try {
      const keys = JSON.parse(sessionStorage.getItem(PAYING_KEY) || '[]') as unknown;
      if (Array.isArray(keys) && keys.length) removeLinesByKey(keys.filter((k): k is string => typeof k === 'string'));
      sessionStorage.removeItem(PAYING_KEY);
      sessionStorage.removeItem('wasmi4.checkout');
    } catch {
      /* ignore */
    }
  }, [view, ready, removeLinesByKey]);

  useEffect(() => {
    if (view.kind !== 'checking') heading.current?.focus();
  }, [view.kind]);

  const retry = () => {
    attempts.current = 0;
    setView({ kind: 'checking' });
    void confirm();
  };

  if (view.kind === 'paid') {
    const o = view.order;
    return (
      <div className="wrap">
        <div className="okbox payres" data-state="paid" data-testid="payment-result">
          <div className="okc">
            <Icon name="check" />
          </div>
          <div aria-live="polite" aria-atomic="true">
            <h1 ref={heading} tabIndex={-1} style={{ fontSize: 'clamp(2rem,5vw,3rem)' }} data-testid="paid-title">
              تم الدفع ✓
            </h1>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            رقم الطلب
          </p>
          <div className="ono" data-testid="order-no">
            {o.orderNo}
          </div>
          <p className="paid-amount">
            المبلغ المدفوع:{' '}
            <b data-testid="paid-amount">
              <Price value={o.total} />
            </b>
          </p>
          <span className="testbadge">وضع تجريبي · ما انخصم مبلغ حقيقي</span>
          {o.charged && o.charged.currency === 'usd' ? (
            <p className="muted charge-note" data-testid="charged-note">
              Stripe سجّل الدفعة بالدولار (وضع تجريبي): <bdi dir="ltr">${(o.charged.amount / 100).toFixed(2)}</bdi> · بسعر ثابت 1 د.ك = 3.25 $
            </p>
          ) : null}
          <div className="stepper">
            <div className="on">انحفظ ومدفوع</div>
            <div>نجهّز ريحتك</div>
            <div>بالطريق</div>
            <div>وصلت</div>
          </div>
          <div className="sumbox" style={{ width: '100%', position: 'static', textAlign: 'start', marginTop: 12 }}>
            <h3>ملخص الطلب</h3>
            {o.items.map((it, i) => (
              <div className="sl" key={i}>
                <span>
                  {it.name} <em>× {it.quantity}</em>
                  <small className="odet">{it.detail}</small>
                </span>
                <span>
                  <Price value={it.lineTotal} />
                </span>
              </div>
            ))}
            {o.discount ? (
              <div className="ln sv">
                <span>خصم {o.promoCode ? <bdi dir="ltr">({o.promoCode})</bdi> : null}</span>
                <span>
                  <Price value={o.discount} minus />
                </span>
              </div>
            ) : null}
            <div className="ln">
              <span>التوصيل</span>
              <span>{o.shipping ? <Price value={o.shipping} /> : 'مجاني'}</span>
            </div>
            <div className="ln tot">
              <span>الإجمالي</span>
              <span>
                <Price value={o.total} />
              </span>
            </div>
          </div>
          <div className="cta-row" style={{ justifyContent: 'center', marginTop: 12 }}>
            <Link className="btn primary" href={'/orders/' + o.id}>
              تفاصيل الطلب
            </Link>
            <Link className="btn line" href="/orders">
              طلباتي
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const copy: Record<Exclude<View['kind'], 'paid'>, [string, string]> = {
    checking: ['نتأكد من الدفع…', 'لحظة، نسأل Stripe عن حالة الدفع.'],
    processing: ['الدفع قيد المعالجة', 'Stripe للحين يأكد الدفعة. بنتأكد مرة ثانية بعد ثواني بدون ما تحدّث الصفحة.'],
    open: ['الدفع ما اكتمل', 'ما انخصم شي. ترجع لإتمام الطلب وتكمل الدفع.'],
    expired: ['انتهت جلسة الدفع', 'ما انخصم شي. سلتك محفوظة، وتقدر تبدأ دفعة جديدة.'],
    invalid: ['ما لقينا جلسة الدفع', 'الرابط مو صحيح أو الجلسة مو لحسابك.'],
    login: ['سجّل دخولك', 'انتهت جلستك. سجّل دخولك عشان نتأكد من الدفع.'],
    error: ['ما قدرنا نتأكد من الدفع', view.kind === 'error' ? view.reason : ''],
  };
  const [title, body] = copy[view.kind];
  const busy = view.kind === 'checking' || (view.kind === 'processing' && attempts.current < MAX_AUTO_CHECKS);
  return (
    <div className="wrap">
      <div className="okbox payres" data-state={view.kind} data-testid="payment-result">
        <div className={'okc' + (busy ? ' wait' : ' warn')} aria-hidden="true">
          {busy ? <span className="spin" /> : '!'}
        </div>
        <div aria-live="polite" aria-atomic="true">
          <h1 ref={heading} tabIndex={-1} style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>
            {title}
          </h1>
          <p className="muted" style={{ margin: '10px 0 0', maxWidth: '46ch' }}>
            {body}
          </p>
        </div>
        <span className="testbadge">وضع Stripe التجريبي</span>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          {view.kind === 'login' ? (
            <Link className="btn primary" href={'/login?next=' + encodeURIComponent('/checkout/success' + (sessionId ? '?session_id=' + sessionId : ''))}>
              تسجيل الدخول
            </Link>
          ) : view.kind === 'error' || (view.kind === 'processing' && !busy) ? (
            <button className="btn primary" type="button" onClick={retry}>
              تأكد مرة ثانية
            </button>
          ) : view.kind !== 'checking' && view.kind !== 'processing' ? (
            <Link className="btn primary" href="/checkout">
              ارجع لإتمام الطلب
            </Link>
          ) : null}
          <Link className="btn line" href="/orders">
            طلباتي
          </Link>
        </div>
      </div>
    </div>
  );
}

export function CheckoutCancelView() {
  return (
    <div className="wrap">
      <div className="okbox payres" data-state="cancelled" data-testid="payment-cancelled">
        <div className="okc warn" aria-hidden="true">
          ←
        </div>
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>ما انخصم شي، وسلتك محفوظة</h1>
        <p className="muted" style={{ margin: 0, maxWidth: '46ch' }}>
          رجعت من صفحة Stripe قبل الدفع. ما انحفظ أي طلب، وتقدر تكمل الدفع أو تختار الدفع عند الاستلام.
        </p>
        <span className="testbadge">وضع Stripe التجريبي</span>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link className="btn primary" href="/checkout">
            ارجع لإتمام الطلب
          </Link>
          <Link className="btn line" href="/cart">
            السلة
          </Link>
        </div>
      </div>
    </div>
  );
}
