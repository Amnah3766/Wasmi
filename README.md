# وسمي Wasmi — اليوم الرابع: «ذاكرة وحماية لمتجرك»

متجر شموع وعطور وبخور من أجواء الخليج. عربي من اليمين لليسار، والأسعار بالدينار الكويتي (مثال: «9.500 د.ك»).

- **الموقع المنشور:** https://wasmi-store.netlify.app (Netlify، فريق `us12u-an`، حساب annem3766@gmail.com)
- **قاعدة البيانات:** MongoDB Atlas M0، الكلستر `Cluster0`، المشروع `wasmi_app`، اسم القاعدة `wasmi`
- **النسخة الأصلية:** `original/index.html`، صفحة وحدة فيها HTML وCSS وJS وتتنقل بالـ hash. نسخة Replit ما انلمست.

## شنو تغيّر عن النسخة الأصلية

| | قبل (index.html) | بعد (اليوم الرابع) |
|---|---|---|
| الإطار | ملف HTML واحد يتنقل بالـ hash | **Next.js App Router + TypeScript + Tailwind** |
| الروابط | `#shop` و`#p-awal` و`#checkout` | `/products` و`/products/awal` و`/checkout` (الروابط القديمة تتحول تلقائيًا) |
| المنتجات | مصفوفة داخل الكود | **MongoDB Atlas فقط**، بدون نسخة احتياطية في الواجهة |
| الحسابات | ما فيه | تسجيل ودخول وخروج: bcrypt + JWT في كوكي HttpOnly + SameSite=Lax + Secure |
| الطلب | تأكيد شكلي ورقم عشوائي | `POST /api/orders` ينحفظ في القاعدة، والتأكيد يطلع **بعد** الحفظ بس |
| الأسعار | تنحسب في المتصفح | **السيرفر يحسبها من القاعدة**، وأي سعر أو `user` يجي من المتصفح ينهمل |
| «طلباتي» | ما فيه | صفحة محمية: 307 للدخول و401 للـ API، وطلب غيرك يرجع 404 |
| التقييمات | localStorage | نموذج `Review` في القاعدة (تنشر وتحذف مراجعتك)، و«مفيد» يبقى على الجهاز |

الشكل نفسه بالضبط: الـ CSS الأصلي منقول حرفيًا في `app/wasmi.css`، والخطوط IBM Plex Sans Arabic و Reem Kufi، والحركة (المطر، والشريط، والميلان، والطيران للسلة)، والوضع الليلي، والجوال.

## الأقسام

- **الرئيسية:** المطر، و«بموسمها الحين»، وتقويم الروائح (12 ريحة × 12 شهر)، واختبار «أي ريحة تناسبك؟»، والإعلان، والهدية.
- **`/products`:** بحث، وتصنيفات مع عدد كل تصنيف، وترتيب، وحد للسعر يتعدّل حسب أسعار القاعدة، و«بموسمها الحين».
- **`/products/[slug]`:** قصة الريحة، وطبقاتها، والمقاييس، و«تناسبك إذا»، والموسم، والاستخدام والعناية، و«تكمّلها بـ»، والتقييمات، وشريط الروائح، و«شفتها قبل»، وشريط الشراء الثابت، وأسهم الكيبورد.
- **صفحات ثانية:** `/finder` و`/gift` و`/favorites` و`/story` و`/brand` و`/contact` و`/cart`، والسلة الجانبية، و`/checkout`.
- **الحسابات والطلبات:** `/signup` و`/login` و`/orders` و`/orders/[id]`.

## التشغيل محليًا

```bash
npm install
# .env.local  ← MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxx.mongodb.net/wasmi?retryWrites=true&w=majority
# .env        ← JWT_SECRET=<نص عشوائي طويل>
npm run seed        # يعبّي 12 منتج و24 مراجعة تجريبية (تقدر تعيده بدون تكرار)
npm run dev         # http://localhost:3300
```

| الأمر | شنو يسوي |
|---|---|
| `npm run typecheck` | فحص TypeScript |
| `npm test` | اختبارات الوحدة (vitest) |
| `npm run build` | بناء الإنتاج |
| `npm run test:e2e` | اختبارات E2E على desktop وmobile، على Atlas الحقيقي (بعد `npm run build`) |
| `npm run test:live` | فحص سريع للموقع المنشور، قراءة بس وبدون إنشاء حسابات |
| `npm run db:check` | يتأكد من الاتصال ويعرض عدد كل مجموعة |
| `npm run db:report` | يسوي `db-report.html`، جداول products وusers وorders (الإيميلات مخفية) |
| `node scripts/setup-db.mjs` | مساعد يكتب `MONGODB_URI` في `.env.local` |

## الملفات المهمة

- **`lib/db.ts`:** اتصال واحد محفوظ globally. يعيد المحاولة عبر DNS عام (1.1.1.1 و8.8.8.8) إذا فشل الـ DNS المحلي.
- **`models/`:** `Product` و`User` (`passwordHash` عليه `select:false`) و`Order` و`Review`.
- **`scripts/seed/products-data.ts`:** المكان الوحيد اللي فيه بيانات المنتجات. فيه اختبار يقارنها بالـ `index.html` الأصلي حرف بحرف.
- **`lib/orderPricing.ts`:** حساب الطلب على السيرفر من القاعدة (المقاسات، وصندوق المواسم -15%، وWASMI10، والتوصيل).
- **`lib/session.ts` و`lib/auth.ts`:**
  - توقيع JWT من نوع HS256.
  - كوكي `wasmi_session` بخيارات HttpOnly وSameSite=Lax، وSecure إذا الاتصال HTTPS.
- **`lib/safeNext.ts`:** التحويل بعد الدخول يكون داخل نفس الموقع بس.
- **`app/api/**`:**
  - يرجع 400 و401 و404 و409 حسب الحالة.
  - يرجع 503 إذا القاعدة واقفة، والصفحات تعرض رسالة بدل ما تطيح.
- **ما فيه `loading.tsx`** على المسارات المحمية أو الديناميكية، عشان 404 و307 يرجعون status حقيقي.

## الأسرار

`MONGODB_URI` و`JWT_SECRET` موجودة بس في:
- ملفي `.env.local` و`.env` (وما ينرفعون).
- متغيرات بيئة موقع Netlify.

ما فيه أي سر في الكود ولا في الـ ZIP، وفحص الأسرار على الموقع المنشور طلع **0**.

> بعد التصحيح يُنصح بتغيير كلمة سر مستخدم القاعدة مستخدم القاعدة من Atlas (Database Access ← Edit ← Edit Password)، وبعدها تحديث `.env.local` ومتغيرات Netlify.
