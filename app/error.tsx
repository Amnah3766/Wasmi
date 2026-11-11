'use client';

import Link from 'next/link';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="wrap">
      <div className="okbox" role="alert">
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>صار خطأ بسيط</h1>
        <p className="muted" style={{ margin: 0 }}>
          ما قدرنا نعرض هالصفحة الحين. جرّب مرة ثانية.
        </p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" type="button" onClick={() => reset()}>
            جرّب مرة ثانية
          </button>
          <Link className="btn line" href="/">
            الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
