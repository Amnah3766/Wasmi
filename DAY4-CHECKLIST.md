# قائمة متطلبات اليوم الرابع: وسمي Wasmi

الرابط: https://wasmi-store.netlify.app · القاعدة: MongoDB Atlas `wasmi` (Cluster0) · الدليل: مجلد `evidence/` و`screenshots/`

| # | المطلوب | الحالة | وين / الدليل |
|---|---|---|---|
| 1 | نقل `index.html` إلى Next.js App Router + TypeScript + Tailwind بنفس الشكل | ✅ | `app/`، `components/`، `app/wasmi.css` (الـ CSS الأصلي حرفيًا)، `app/tailwind.css` (بدون preflight) · `screenshots/live/` |
| 1a | الرئيسية: «بموسمها الحين»، التقويم، الاختبار، الإعلان، الهدية | ✅ | `components/views/HomeView.tsx` · e2e «home: hero…» |
| 1b | `/products` و`/products/[slug]` (القصة، الطبقات، «تناسبك إذا»، «تكمّلها بـ»، التقييمات، «شفتها قبل») | ✅ | `ShopView.tsx`، `ProductView.tsx` · e2e «shop…»، «product page sections…» |
| 1c | صندوق المواسم، المفضلة، «من الوسمي بدأنا»، التواصل، السلة، الـ checkout | ✅ | `/gift` `/favorites` `/story` `/contact` `/cart` `/checkout` + السلة الجانبية |
| 1d | روابط الـ hash صارت مسارات حقيقية | ✅ | `/#p-ghaim` ← `/products/ghaim` (`HashRedirect` في `components/Chrome.tsx`) · e2e |
| 1e | RTL، الخطوط، الحركة، الجوال | ✅ | e2e على Pixel 7: كل الصفحات 200 بدون تمرير أفقي، والكونسول نظيف |
| 2 | `lib/db.ts` اتصال واحد محفوظ globally | ✅ | `lib/db.ts` (`globalThis.__wasmiMongoose`، مع إعادة محاولة عبر DNS عام) |
| 2a | `Product` بحقول SKILL.md + حقول وسمي | ✅ | `models/Product.ts`: slug، الاسم عربي وإنجليزي، category، kind، price، notes، moment، description، colors، seasons، moods، image… |
| 2b | `User` (passwordHash `select:false`، الإيميل unique) | ✅ | `models/User.ts` |
| 2c | `Order` (user، items بسعر وقت الطلب، المجموع، التوصيل، الدفع، الحالة) | ✅ | `models/Order.ts` |
| 3 | المنتجات من القاعدة فقط، والمصفوفة في `scripts/seed/products-data.ts` | ✅ | ما فيه منتج بكود الواجهة، وما فيه fallback · اختبار يقارنها بالأصل |
| 3a | `npm run seed` مرتين بدون تكرار | ✅ | `evidence/seed-twice.txt` (المرة الأولى: 12 جديد، الثانية: 12 تحديث، المجموع 12) |
| 3b | التقويم والاختبار و«تكمّلها بـ» تشتغل من القاعدة | ✅ | تقرا `seasons` و`moods` و`times` و`pairSlug` من Atlas |
| 3c | تعديل سعر في Atlas يظهر بعد التحديث | ✅ | e2e «a price edited directly in Atlas…» + `evidence/atlas-price-edit.txt` |
| 4 | Sign Up / Log In / Log Out (bcryptjs + JWT في كوكي HttpOnly + SameSite=Lax + Secure) | ✅ | `app/api/auth/*`، `lib/session.ts`، `lib/auth.ts` |
| 4a | اسم المستخدم يطلع في القائمة | ✅ | بالشريط على الديسكتوب، وبالقائمة على الجوال · `screenshots/local/L01…` |
| 4b | كلمات السر تبدأ بـ `$2b$12$` | ✅ | e2e «passwords are stored as bcrypt…» + `evidence/database-report.txt` |
| 5 | Checkout: `POST /api/orders` والتأكيد بعد الحفظ بس | ✅ | `CheckoutView.tsx` (السلة تنمسح بعد 201) · `screenshots/local/L03…` |
| 5a | السيرفر يحسب الأسعار، وسعر و`user` المتصفح ينهمل | ✅ | `lib/orderPricing.ts` · e2e يغيّر الطلب (total 0.001 و user غريب)، والنتيجة total 11.000 · اختبارات وحدة |
| 5b | الدفع اختيار شكلي (الدفع عند الاستلام أو رابط) | ✅ | `paymentMethod` محفوظ بالطلب، وStripe خارج النطاق |
| 5c | غير مسجّل: «سجّل دخولك عشان ينحفظ طلبك» | ✅ | e2e «guest checkout…» · `screenshots/live/13…` |
| 6 | Bonus: «طلباتي» محمية (307 و401)، وكل واحد يشوف طلباته بس، وطلب غيره 404 | ✅ | `app/orders/*` · e2e «two accounts…» · `screenshots/local/L04–L06` |
| 7 | المفضلة على الجهاز، والتقييمات (bonus: نموذج `Review` بالقاعدة) | ✅ | `models/Review.ts`، `app/api/products/[slug]/reviews` · e2e «reviews…» |
| — | القاعدة واقفة: الـ API يرجع 503 والصفحة تعرض رسالة | ✅ | `lib/http.ts`، `components/DbDown.tsx`، `DbNotice` |
| — | `next=` بعد الدخول same-origin بس | ✅ | `lib/safeNext.ts` · e2e «next= only redirects inside the site» |
| — | السعر «9.500 د.ك» وما ينقلب في الـ RTL | ✅ | `<bdi class="pv">` · e2e «price text never flips» |
| — | Netlify: `next build --webpack`، `publish=".next"`، نشر بخطوة وحدة، الهيدرات في `next.config.ts` | ✅ | `netlify.toml`، `next.config.ts` |
| — | ما فيه `<script>` inline في `<head>` | ✅ | `app/layout.tsx` (السكربت أول الـ body) |
| — | على Netlify: الصفحات 200، والمنتجات من القاعدة، و`/_next/static` 200، والأكواد صحيحة | ✅ | `evidence/live-http-checks.txt`، `evidence/live-e2e-smoke.txt` |
| — | فحص أسرار (0)، وكونسول نظيف | ✅ | `evidence/live-secret-scan.txt`، `evidence/live-e2e-smoke.txt` |

**الأرقام:**
- typecheck نظيف.
- اختبارات الوحدة: 101/101.
- البناء نجح.
- E2E محلي على Atlas: 43/43 (desktop + mobile).

التفاصيل في `evidence/`.
