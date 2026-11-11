'use client';
// Favourites, story ("من الوسمي بدأنا"), brand and contact pages — ported from PAGES.favorites/story/brand/contact.
import Link from 'next/link';
import { useState } from 'react';
import { FREE_SHIPPING_FROM, SHIPPING_FEE, fmt } from '@/lib/shop/pricing';
import { LogoMark, LogoSwatch } from '../Icon';
import { useStore } from '../store/StoreProvider';
import { Cards, DbNotice, EmptyFavs } from '../ui';

export function FavoritesView() {
  const { products, favs, ready, dbDown } = useStore();
  const list = products.filter((p) => favs.has(p.slug));
  return (
    <div className="wrap">
      <div className="page-head">
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>مفضلتك</h1>
        <p>الروائح اللي حفظتها تظهر هنا.</p>
      </div>
      <div id="favgrid" style={{ paddingBottom: 'clamp(40px,6vw,72px)' }}>
        {dbDown ? <DbNotice /> : !ready ? <div className="grid" aria-busy="true" /> : list.length ? <Cards list={list} /> : <EmptyFavs />}
      </div>
    </div>
  );
}

export function StoryView() {
  return (
    <div className="wrap">
      <div className="page-head">
        <span className="en">قصتنا</span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>من الوسمي بدأنا</h1>
      </div>
      <section className="sec" style={{ paddingTop: 20 }}>
        <p className="lede">الوسمي هو أول مطر الموسم بالخليج، واللي يجي بعده أحلى ريحة: التراب وهو يتنفس. حاولنا نمسكها بشمعة.</p>
        <p className="muted" style={{ maxWidth: '60ch' }}>
          من هنا بدأت وسمي. بدل ما نبيع روائح عامة، نختار لحظة من الخليج ونركّب ريحتها: هوا الشط قبل الفجر، قهوة الصباح، جلسة البر، بخور يوم الجمعة. كل ريحة لها موسمها، وكل دفعة محدودة.
        </p>
      </section>
      <section className="sec" style={{ paddingTop: 0 }}>
        <h2>كيف نصنعها</h2>
        <ol className="steps">
          <li>
            <span className="n">01</span>
            <h3>نختار اللحظة</h3>
            <p>نبدأ من موقف حقيقي نعرفه كلنا.</p>
          </li>
          <li>
            <span className="n">02</span>
            <h3>نركّب الريحة</h3>
            <p>قمة وقلب وقاعدة، ونجرب لين تطلع الصورة.</p>
          </li>
          <li>
            <span className="n">03</span>
            <h3>نصبّها يدويًا</h3>
            <p>شمع صويا بدفعات من 120 قطعة.</p>
          </li>
          <li>
            <span className="n">04</span>
            <h3>نخليها ترتاح</h3>
            <p>أسبوعين عشان تثبت الريحة.</p>
          </li>
          <li>
            <span className="n">05</span>
            <h3>نغلّفها</h3>
            <p>تغليف بسيط وجاهز للهدية.</p>
          </li>
        </ol>
      </section>
      <section className="sec" style={{ paddingTop: 0 }}>
        <div className="why-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 28 }}>
          <div style={{ border: 0, padding: 0 }}>
            <h3>موسمية</h3>
            <p>كل ريحة تظهر بوقتها وتغيب، مثل الطبيعة.</p>
          </div>
          <div style={{ border: 0, padding: 0 }}>
            <h3>محدودة</h3>
            <p>دفعات صغيرة، وإذا خلصت ما نعيدها قبل الموسم.</p>
          </div>
          <div style={{ border: 0, padding: 0 }}>
            <h3>نظيفة</h3>
            <p>شمع صويا، فتيلة قطن، وزجاج يعاد استخدامه.</p>
          </div>
        </div>
      </section>
      <div style={{ paddingBottom: 'clamp(40px,6vw,72px)' }}>
        <Link className="btn primary" href="/products">
          تسوّق الروائح
        </Link>
      </div>
    </div>
  );
}

export function BrandView() {
  return (
    <div className="wrap">
      <div className="page-head">
        <span className="en">Brand</span>
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>هوية وسمي</h1>
      </div>
      <div className="board">
        <div className="tile dark s3">
          <span className="k">الاسم والشعار</span>
          <div className="mark">
            <LogoMark />
            <div>
              <b>وسمي</b>
              <small>WASMI</small>
            </div>
          </div>
          <p>الوسمي هو أول مطر الموسم بالخليج، وأول ريحة ترتفع من التراب بعده. الشعار قطرة وحلقات ماء تنتشر حولها.</p>
        </div>
        <div className="tile s3">
          <span className="k">الألوان</span>
          <div className="sws">
            <div className="sw" style={{ background: '#1E120B', color: '#F7EBDA' }}>
              <b>قهوة داكنة</b>
              <span>#1E120B</span>
            </div>
            <div className="sw" style={{ background: '#F7EBDA', color: '#2A1A10' }}>
              <b>رمل</b>
              <span>#F7EBDA</span>
            </div>
            <div className="sw" style={{ background: '#E58A2B', color: '#2A1406' }}>
              <b>عنبر (الأساسي)</b>
              <span>#E58A2B</span>
            </div>
          </div>
        </div>
        <div className="tile">
          <span className="k">الخطوط</span>
          <div className="fsample">Reem Kufi</div>
          <div className="bsample">IBM Plex Sans Arabic</div>
          <p>الكوفي للعناوين والأسماء، والخط الهادي للنص.</p>
        </div>
        <div className="tile">
          <span className="k">الشخصية</span>
          <div className="words">
            هادئ <i>·</i> نادر <i>·</i> أصيل
          </div>
        </div>
        <div className="tile">
          <span className="k">الجملة المميزة</span>
          <div className="slogan">خذ أول مطر معك.</div>
        </div>
        <div className="tile s3">
          <span className="k">استخدام الشعار</span>
          <div className="logos">
            <div style={{ background: '#1E120B', color: '#F7EBDA' }}>
              <LogoSwatch />
            </div>
            <div style={{ background: '#FBF4EA', color: '#2A1A10' }}>
              <LogoSwatch />
            </div>
          </div>
        </div>
        <div className="tile s3">
          <span className="k">الأسلوب البصري</span>
          <p>
            ضوء فانوس على زجاج مبلول: دفء القهوة والرمل مع لون أساسي واحد، عنبر. خلفيات داكنة، حلقات ماء تنتشر، وتفاصيل صغيرة بلون العنبر تلمع. صور المنتجات مرسومة بشكل بسيط، وكل منتج له لونه من لحظته الطبيعية.
          </p>
        </div>
      </div>
      <section className="sec" style={{ paddingBottom: 0 }}>
        <h2>رحلة الزبون</h2>
        <ol className="steps">
          <li>
            <span className="n">01</span>
            <h3>يدخل</h3>
            <p>مطر متحرك وجملة وحدة: خذ أول مطر معك.</p>
          </li>
          <li>
            <span className="n">02</span>
            <h3>يستكشف</h3>
            <p>متجر بفلاتر، وتقويم يوضح موسم كل ريحة.</p>
          </li>
          <li>
            <span className="n">03</span>
            <h3>يختار</h3>
            <p>صفحة منتج بقصة وطبقات وتقييمات، أو اختبار يرشح له.</p>
          </li>
          <li>
            <span className="n">04</span>
            <h3>يتفاعل</h3>
            <p>مفضلة وسلة وصندوق هدية يصممه بنفسه.</p>
          </li>
          <li>
            <span className="n">05</span>
            <h3>يحصل على تجاوب</h3>
            <p>إشعارات، عداد، وتأكيد طلب برقم.</p>
          </li>
        </ol>
      </section>
      <section className="sec">
        <h2>التفاعلات</h2>
        <div className="ints">
          {[
            ['بحث وفلترة فورية', 'تصنيف وترتيب وسعر وموسم، والنتائج تتغير وأنت تكتب.'],
            ['طبقات الريحة', 'ضغطة على الصورة تفتح القمة والقلب والقاعدة.'],
            ['مفضلة وسلة', 'قلب يتعبّا، وعداد يتحرك، وشريط للتوصيل المجاني.'],
            ['اختبار الريحة', '3 أسئلة وتطلع لك النتيجة بنسبة توافق.'],
            ['صندوق المواسم', 'تختار 3 روائح وتشوف الخصم قدامك.'],
            ['صفحة منتج حية', 'المنتج يميل مع حركة المؤشر، والسعر يتغير مع الحجم.'],
            ['تقييمات الناس', 'تقييم بالنجوم، فلترة حسب النجوم، وتقدر تكتب مراجعتك.'],
            ['تنقل بين المنتجات', 'السابق والتالي، شريط الروائح، وأسهم الكيبورد.'],
          ].map(([h, p]) => (
            <div key={h}>
              <h3>{h}</h3>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const FAQ: Array<[string, string]> = [
  ['كم يستغرق التوصيل؟', 'من 2 إلى 3 أيام عمل داخل المدن. الطلبات فوق ' + fmt(FREE_SHIPPING_FROM) + ' توصيلها مجاني، وغيرها ' + fmt(SHIPPING_FEE) + '.'],
  ['كم تحترق الشمعة؟', 'العادية 220 غ تحترق قرابة 45 ساعة، والصغيرة 90 غ قرابة 20 ساعة.'],
  ['أقدر أرجّع المنتج؟', 'نعم، خلال 7 أيام إذا ما انفتح أو انشعل.'],
  ['فيه تغليف للهدايا؟', 'صندوق المواسم يجي بتغليف هدية وبطاقة مكتوبة، وتقدر تكتب الرسالة بنفسك.'],
  ['هل الروائح طبيعية؟', 'الشموع بشمع صويا وفتيلة قطن، والروائح بزيوت عطرية. المكونات مكتوبة بصفحة كل منتج.'],
];

export function ContactView() {
  const [f, setF] = useState({ cn: '', ce: '', ct: 'سؤال عن منتج', cm: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <div className="wrap">
      <div className="page-head">
        <h1 style={{ fontSize: 'clamp(2rem,5vw,3rem)' }}>تواصل معنا</h1>
        <p>عندك سؤال عن ريحة أو طلب؟ اكتب لنا.</p>
      </div>
      <div className="cgrid">
        <div>
          <form
            className="form"
            id="cForm"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              const next: Record<string, string> = {};
              if (!f.cn.trim()) next.cn = 'اكتب اسمك';
              if (!/^\S+@\S+\.\S+$/.test(f.ce.trim())) next.ce = 'اكتب بريد صحيح';
              if (f.cm.trim().length < 5) next.cm = 'اكتب رسالتك';
              setErrs(next);
              if (Object.keys(next).length) return;
              setNote('وصلتنا رسالتك. هذا نموذج تجريبي، ما انرسل شي فعليًا.');
              setF({ cn: '', ce: '', ct: 'سؤال عن منتج', cm: '' });
            }}
          >
            <div className="two">
              <div className="fld">
                <label htmlFor="cn">الاسم</label>
                <input className={'field' + (errs.cn ? ' bad' : '')} id="cn" autoComplete="name" value={f.cn} onChange={set('cn')} />
                <span className="err">{errs.cn}</span>
              </div>
              <div className="fld">
                <label htmlFor="ce">البريد الإلكتروني</label>
                <input className={'field' + (errs.ce ? ' bad' : '')} id="ce" type="email" autoComplete="email" dir="ltr" value={f.ce} onChange={set('ce')} />
                <span className="err">{errs.ce}</span>
              </div>
            </div>
            <div className="fld">
              <label htmlFor="ct">الموضوع</label>
              <select className="field" id="ct" value={f.ct} onChange={set('ct')}>
                <option>سؤال عن منتج</option>
                <option>طلب هدية</option>
                <option>متابعة طلب</option>
                <option>أخرى</option>
              </select>
            </div>
            <div className="fld">
              <label htmlFor="cm">رسالتك</label>
              <textarea className={'field' + (errs.cm ? ' bad' : '')} id="cm" rows={5} value={f.cm} onChange={set('cm')} />
              <span className="err">{errs.cm}</span>
            </div>
            <div>
              <button className="btn primary" type="submit">
                أرسل الرسالة
              </button>
            </div>
            <p className="note" id="cnote" role="status">
              {note}
            </p>
          </form>
          <p className="muted" style={{ fontSize: '.85rem' }}>
            النموذج تجريبي ولا يرسل أي شي. البريد: <span dir="ltr">hello@wasmi.example</span>
          </p>
        </div>
        <div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: 12 }}>أسئلة تتكرر</h2>
          {FAQ.map(([q, a], i) => (
            <details key={q} open={i === 0}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
