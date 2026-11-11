# قائمة متطلبات اليوم الخامس: وسمي Wasmi

**الروابط:**
- Vercel: https://wasmi.vercel.app
- GitHub: https://github.com/Amnah3766/Wasmi

**الأدلة:** `evidence/day5/` و`screenshots/`

| # | المطلوب | الحالة | الدليل |
|---|---|---|---|
| 1 | GitHub: commits واضحة وpush بدون أسرار | ✅ | 8 commits مقسّمة (Next.js، المنتجات، الدخول، الطلبات، اختبارات اليوم 4، Stripe، اختبارات اليوم 5، .gitignore)، و`node scripts/secret-scan.mjs` على الملفات والتاريخ كامل = **0** |
| 1a | `.gitignore` يستبعد `.env*` (مع `!.env.example`) و`node_modules` و`.next` و`.netlify` و`.vercel` و`test-results` | ✅ | `.gitignore`، و`.env.example` فيه الأسماء بس |
| 2 | Vercel: Import من GitHub + Environment Variables + تجربة على التلفون | ✅ | `screenshots/vercel/`، و`/api/health` يرجع `payments: "ready"` |
| 3 | Stripe Test Mode: زر دفع، والجلسة تنعمل على السيرفر، والمفتاح على السيرفر بس | ✅ | `app/api/checkout/route.ts`، `lib/checkout.ts`، `lib/stripe.ts` (fetch بدون مكتبة، و`server-only`) |
| 3a | بطاقة 4242 | ✅ | دفعة كاملة محليًا (desktop + mobile) وتنتهي بـ «تم الدفع ✓»، `evidence/day5/e2e-local-full.txt`، `screenshots/local-payment/S03…S04` |
| 3b | المفتاح السري ما يوصل المتصفح، ومفاتيح live مرفوضة | ✅ | `checkTestSecretKey` + فحص أسرار الموقع المنشور = 0 |
| 4 | تحدي: الطلب ينحفظ في `orders` بعد الدفع، و«تم الدفع ✓» بدون reload | ✅ | `POST /api/checkout/confirm` و`fulfillCheckoutSession`؛ طلب paid في Atlas مع `stripeSessionId` unique؛ وبعد reload ما ينحفظ مرتين (اختبار) |
| 4a | السعر من القاعدة، وأي سعر أو userId من المتصفح ينهمل | ✅ | `validateCheckoutInput` + اختبار e2e يرسل جسم متلاعب فيه |
| 4b | `amount_total` لازم يطابق السطور − الخصم + التوصيل، وlivemode=false، والمستخدم مطابق | ✅ | `lib/checkout.test.ts` |
| 4c | جلسة شخص ثاني ترجع 404 | ✅ | `lib/checkout.test.ts` + e2e |
| 5 | Webhook (بونص): HMAC على الجسم الخام بسماحية 300 ثانية، والتوقيع الغلط 400، والسر الناقص 503 | ✅ | `app/api/stripe/webhook/route.ts`، `lib/webhookRoute.test.ts` (الـ endpoint في Stripe اختياري) |
| 6 | `/checkout/cancel`: «ما انخصم شي، وسلتك محفوظة» | ✅ | e2e + `screenshots/local-payment/S06` |
| 7 | «طلباتي»: شارة «مدفوع عبر Stripe» + تاريخ الدفع | ✅ | `screenshots/local-payment/S05` |
| 8 | KWD: المبالغ بالفلس وآخر رقم صفر، وإذا Stripe رفض KWD نستخدم USD مع توضيح السبب | ✅ | الحساب رفض KWD، فالخصم بالدولار بسعر 1 د.ك = 3.25 $ (السبب في README)، والأسعار والطلب بالدينار |
| 9 | الاختبارات | ✅ | tsc نظيف، اختبارات الوحدة 140/140، build نظيف، E2E محلي 47/47 |

**ما انختبر بالكامل:**
- **دفعة الإنتاج من التلفون** (على رابط Vercel) تسويها أنت. أنا ما أدفع على رابط الإنتاج.
- **الـ Webhook انختبر بـ unit tests بس.** على الموقع المنشور يحتاج endpoint في Stripe و`STRIPE_WEBHOOK_SECRET` (اختياري)، والحفظ يصير أصلًا عن طريق `/api/checkout/confirm`.
