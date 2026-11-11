import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="wrap">
      <div className="okbox">
        <span className="en" dir="ltr">
          404
        </span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>ما لقينا هالصفحة</h1>
        <p className="muted" style={{ margin: 0 }}>
          يمكن الرابط قديم أو الريحة خلص موسمها. جرّب المتجر.
        </p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link className="btn primary" href="/products">
            تسوّق الروائح
          </Link>
          <Link className="btn line" href="/">
            الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
