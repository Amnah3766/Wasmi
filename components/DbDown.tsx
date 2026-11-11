import Link from 'next/link';

/** Full-page message when MongoDB cannot be reached (the page renders instead of crashing). */
export function DbDown({ title = 'المتجر يرتاح شوي' }: { title?: string }) {
  return (
    <div className="wrap">
      <div className="okbox" role="status">
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{title}</h1>
        <p className="muted" style={{ margin: 0, maxWidth: '46ch' }}>
          ما قدرنا نوصل لقاعدة البيانات الحين، فما نقدر نعرض هالصفحة. حدّث الصفحة بعد شوي، وسلتك محفوظة على جهازك.
        </p>
        <div className="cta-row" style={{ justifyContent: 'center' }}>
          <Link className="btn primary" href="/">
            الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
