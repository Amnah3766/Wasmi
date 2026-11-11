# وسمي Wasmi — اليوم الخامس: Git + النشر + الدفع (Stripe Test Mode)

متجر شموع وعطور وبخور من أجواء الخليج. عربي من اليمين لليسار، والأسعار بالدينار الكويتي (مثال: «9.500 د.ك»).

- **Vercel (التسليم):** https://wasmi.vercel.app
- **GitHub:** https://github.com/Amnah3766/Wasmi
- **Netlify (اليوم الرابع):** https://wasmi-store.netlify.app
- **قاعدة البيانات:** MongoDB Atlas M0، الكلستر `Cluster0`، اسم القاعدة `wasmi`
- **بطاقة التجربة:** `4242 4242 4242 4242`، أي تاريخ مستقبلي، أي CVC (وضع Stripe التجريبي، ما ينخصم مبلغ حقيقي)

## ورقة الواجب ← وسمي

| الورقة | وسمي |
|---|---|
| Replit | Git محلي ← GitHub (`Amnah3766/Wasmi`) ← Vercel (Import من GitHub، وكل push ينشر من جديد) |
| Supabase Edge Function | `POST /api/checkout`، route على السيرفر في Next.js |
| Supabase Secrets | `STRIPE_SECRET_KEY` في متغيرات السيرفر بس (`.env.local` + Vercel)، وما ينرسل للمتصفح أبدًا |
| جدول orders | مجموعة `orders` في Atlas (موديل `Order`): `paymentMethod: stripe`، و`status: paid`، و`stripeSessionId` (unique)، و`paidAt` |
| Supabase URL / anon key | `MONGODB_URI` + `JWT_SECRET` + `STRIPE_SECRET_KEY` |
| زر دفع | «ادفع بالبطاقة» في `/checkout`، مع شارة «وضع Stripe التجريبي» وبطاقة 4242 |
| تحدي: احفظ الطلب واعرض «تم الدفع ✓» بدون reload | `/checkout/success` تنادي `POST /api/checkout/confirm`، والطلب ينحفظ paid بعد ما Stripe يأكد بس |

## مسار الدفع

1. **في `/checkout`:**
   - المستخدم المسجّل يختار «بطاقة بنكية عبر Stripe».
   - المتصفح يرسل **بس** السطور (`slug` + الحجم + الكمية، أو صندوق 3 روائح) وكود الخصم وبيانات التوصيل.
2. **`POST /api/checkout`** (يحتاج دخول وإلا 401، ومن نفس الموقع وإلا 403):
   - يحسب الأسعار من **القاعدة**: السعر الأساسي × معامل الحجم، والصندوق -15%، وWASMI10، والتوصيل.
   - ينشئ Stripe Checkout Session بـ `fetch` (بدون مكتبة stripe)، وفيها:
     - `client_reference_id` = المستخدم.
     - `metadata` = السطور بصيغة `slug:size:qty:unitFils` + الخصم + التوصيل + بيانات التوصيل.
   - يرجع رابط `checkout.stripe.com` بس.
3. **المستخدم يدفع على صفحة Stripe** ببطاقة 4242.
4. **Stripe يرجعه لـ `/checkout/success?session_id=…`** (محمية):
   - الصفحة تنادي `POST /api/checkout/confirm` بدون reload.
   - السيرفر يقرأ الجلسة **من Stripe**، ويتأكد إنها لنفس المستخدم (جلسة غيره ← 404).
   - يتأكد من: `paid`، و`livemode=false`، والعملة، و`amount_total` = السطور − الخصم + التوصيل.
   - بعدها يحفظ `Order` بحالة **paid** (مرة وحدة بس بفضل الفهرس unique على `stripeSessionId`).
   - الصفحة تعرض **«تم الدفع ✓»** + رقم الطلب + المبلغ، وتشيل المدفوع من السلة. إذا الدفع للحين قيد المعالجة، تعيد المحاولة كل 2.5 ثانية (8 مرات بالكثير).
5. **الإلغاء** ← `/checkout/cancel`: «ما انخصم شي، وسلتك محفوظة»، وما ينحفظ أي طلب.
6. **Webhook (بونص)** `POST /api/stripe/webhook`:
   - يتحقق من HMAC حق `Stripe-Signature` على الجسم الخام بسماحية 300 ثانية.
   - التوقيع غلط ← 400. السر ناقص ← 503.
   - إذا الدفع paid ← نفس الحفظ (idempotent).
7. **الدفع عند الاستلام** يبقى مثل اليوم الرابع: `POST /api/orders` بحالة pending.

### ليش الدفع بالدولار؟
حساب Stripe التجريبي رفض الدينار الكويتي: «Invalid currency: kwd. You can change your account to process transactions in kwd by adding a bank account for this currency». يعني الحساب لازم يكون فيه حساب بنكي بالدينار.

عشان كذا:
- Stripe يخصم **بالدولار** بسعر ثابت للتجربة: **1 د.ك = 3.25 $**. السعر هذا ينكتب داخل كل جلسة دفع.
- الأسعار والمجموع والطلب المحفوظ تبقى **بالدينار**.
- الطلب يحفظ كمان المبلغ اللي خصمه Stripe (`amountCharged` + `currency`).
- إذا صار الحساب يقبل KWD: حط `STRIPE_CHARGE_CURRENCY=kwd`. المبالغ بالفلس، وآخر رقم دايمًا صفر (Stripe يطلب هذا للعملات اللي فيها 3 منازل)، والخصم يتقرّب لأقرب 10 فلس.

## المتغيرات (بدون قيم)

| المتغير | وين | ملاحظة |
|---|---|---|
| `MONGODB_URI` | `.env.local` + Vercel | فيه `/wasmi` بعد `.net` |
| `JWT_SECRET` | `.env` + Vercel | نص عشوائي طويل |
| `STRIPE_SECRET_KEY` | `.env.local` + Vercel | `sk_test_…` أو `rk_test_…` بس، وأي مفتاح live ينرفض |
| `STRIPE_WEBHOOK_SECRET` | اختياري | للـ webhook (`whsec_…`) |
| `STRIPE_CHARGE_CURRENCY` | اختياري | `kwd` إذا الحساب يقبله، والافتراضي `usd` |

- `GET /api/health` يرجع نعم/لا بس: `db`، و`database`، و`sessions`، و`webhook`، و`payments: ready|missing|malformed|live`.
- `.env.example` فيه الأسماء بس، وكل ملفات `.env*` مستبعدة في `.gitignore`.

## التشغيل والاختبارات

```bash
npm install
npm run seed          # 12 منتج + 24 مراجعة تجريبية (بدون تكرار)
npm run dev           # http://localhost:3300
npm run typecheck && npm test && npm run build
npm run test:e2e      # desktop + mobile على Atlas الحقيقي + دفعة 4242 حقيقية على Stripe التجريبي
node scripts/secret-scan.mjs   # فحص أسرار للملفات وتاريخ git كامل (يطبع الملف والسطر بس)
```

## اليوم الرابع (ملخص)

- **الانتقال:** نقلنا `index.html` لـ Next.js App Router + TypeScript + Tailwind بنفس الشكل، وصارت كل الأقسام مسارات حقيقية.
- **المنتجات:** من MongoDB Atlas بس.
- **الحسابات:** دخول بـ bcrypt + JWT في كوكي HttpOnly.
- **الطلبات:** محفوظة لكل مستخدم.
- **«طلباتي»:** صفحة محمية (307/401، وطلب غيرك 404).
- **الأدلة:** في `DAY4-CHECKLIST.md`.

> **بعد التقييم:**
> - سوِّ Roll لمفتاح Stripe، لأنه انكتب في المحادثة.
> - غيّر كلمة سر مستخدم القاعدة.
> - خلِّ `0.0.0.0/0` في Atlas دائم.
