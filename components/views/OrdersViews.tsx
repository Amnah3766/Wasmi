// "طلباتي" list and one order (server components: data comes straight from MongoDB for the signed-in user only).
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ORDER_STATUS_LABEL, PAYMENT_LABEL } from '@/lib/shop/labels';
import type { PublicOrder } from '@/lib/shop/types';
import { Icon } from '../Icon';
import { Price } from '../ui';

function thumbStyle(o: PublicOrder['items'][number]): CSSProperties {
  return { ['--c1' as string]: o.colors.c1, ['--c2' as string]: o.colors.c2, ['--c3' as string]: o.colors.c3 } as CSSProperties;
}

export function OrdersList({ name, orders, dates, paidDates = {} }: { name: string; orders: PublicOrder[]; dates: Record<string, string>; paidDates?: Record<string, string> }) {
  return (
    <div className="wrap">
      <div className="page-head">
        <span className="en">My orders</span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>طلباتي</h1>
        <p>
          أهلًا {name}، هذي طلباتك المحفوظة بحسابك. محد غيرك يقدر يشوفها.
        </p>
      </div>
      {!orders.length ? (
        <div className="okbox" data-testid="orders-empty">
          <h2>ما عندك طلبات بعد</h2>
          <p className="muted" style={{ margin: 0 }}>
            أول ما تأكد طلب، بيظهر هنا برقمه وتفاصيله.
          </p>
          <Link className="btn primary" href="/products">
            تسوّق الروائح
          </Link>
        </div>
      ) : (
        <ul className="olist" data-testid="orders-list">
          {orders.map((o) => (
            <li key={o.id} className="ocard" data-order-no={o.orderNo}>
              <div className="ohead">
                <div>
                  <span className="ono">{o.orderNo}</span>
                  <small className="muted">{dates[o.id]}</small>
                </div>
                <span className="ostat">{ORDER_STATUS_LABEL[o.status]}</span>
              </div>
              {o.payment === 'stripe' && o.status === 'paid' ? (
                <p className="paybadge" data-testid="paid-badge">
                  <Icon name="check" />
                  مدفوع عبر Stripe{paidDates[o.id] ? ' · ' + paidDates[o.id] : ''}
                </p>
              ) : null}
              <div className="othumbs" aria-hidden="true">
                {o.items.slice(0, 5).map((it, i) => (
                  <span key={i} className={'thumb' + (it.kind === 'box' ? ' box' : '')} style={thumbStyle(it)} />
                ))}
              </div>
              <p className="muted" style={{ margin: 0 }}>
                {o.items.map((it) => it.name + ' × ' + it.quantity).join('، ')}
              </p>
              <div className="ofoot">
                <b>
                  <Price value={o.total} />
                </b>
                <Link className="arrow" href={'/orders/' + o.id}>
                  التفاصيل
                  <Icon name="arrow" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div style={{ height: 'clamp(40px,6vw,72px)' }} />
    </div>
  );
}

export function OrderDetail({ order: o, placed, date, paidDate = '' }: { order: PublicOrder; placed: boolean; date: string; paidDate?: string }) {
  const first = o.delivery.name.split(/\s+/)[0] || o.delivery.name;
  return (
    <div className="wrap">
      <div className="okbox" data-testid="order-detail">
        <div className="okc">
          <Icon name="check" />
        </div>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>{placed ? 'وصل طلبك يا ' + first : 'تفاصيل طلبك'}</h1>
        <p className="muted" style={{ margin: 0 }}>
          رقم الطلب
        </p>
        <div className="ono" data-testid="order-no">
          {o.orderNo}
        </div>
        <p className="muted" style={{ margin: 0, maxWidth: '44ch' }}>
          {placed ? 'انحفظ طلبك بحسابك في قاعدة البيانات. ' : ''}هذي نسخة تجريبية من الطلب. بالمتجر الحقيقي كنا بدأنا نجهّز ريحتك ويوصلك خلال 2-3 أيام عمل.
        </p>
        <div className="stepper">
          <div className="on">استلمنا طلبك</div>
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
          <div className="ln">
            <span>المجموع</span>
            <span>
              <Price value={o.subtotal} />
            </span>
          </div>
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
            <span data-testid="order-total">
              <Price value={o.total} />
            </span>
          </div>
          <div className="odeliv">
            <div>
              <small>التوصيل إلى</small>
              <b>{o.delivery.name}</b>
              <span>
                {o.delivery.area}، {o.delivery.address}
              </span>
              <span dir="ltr" style={{ textAlign: 'end' }}>
                {o.delivery.phone}
              </span>
            </div>
            <div>
              <small>الوقت والدفع</small>
              <span>{o.delivery.slot}</span>
              <span>{PAYMENT_LABEL[o.payment]}</span>
              {o.payment === 'stripe' && o.status === 'paid' ? <span className="paybadge sm">مدفوع{paidDate ? ' · ' + paidDate : ''}</span> : null}
              <span className="muted">{date}</span>
            </div>
          </div>
        </div>
        <div className="cta-row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <Link className="btn primary" href="/products">
            كمّل تسوق
          </Link>
          <Link className="btn line" href="/orders">
            كل طلباتي
          </Link>
        </div>
      </div>
    </div>
  );
}
