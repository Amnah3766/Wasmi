// Pure HTML builder for `npm run db:report` (kept separate so it can be unit-tested without a database).
// It never receives a password, a token or the connection string; password hashes arrive already shortened.
import { CATEGORY_LABEL, MONTHS, ORDER_STATUS_LABEL } from '../lib/shop/labels';
import { fmt } from '../lib/shop/pricing';
import type { Category } from '../lib/shop/types';

export interface ReportProduct {
  slug: string;
  name: string;
  category: string;
  price: number;
  seasons: number[];
  allYear: boolean;
}
export interface ReportUser {
  name: string;
  email: string;
  passwordHash: string;
  createdAt?: Date | null;
}
export interface ReportOrder {
  orderNo: string;
  userName: string;
  itemsCount: number;
  total: number;
  status: string;
  createdAt?: Date | null;
}
export interface ReportData {
  database: string;
  atlas: boolean;
  generatedAt: Date;
  products: ReportProduct[];
  users: ReportUser[];
  orders: ReportOrder[];
  reviews: { total: number; samples: number };
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "soud@gmail.com" → "s***@gmail.com". */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

/** First 7 characters of a bcrypt hash ("$2b$12$") + "…" — proves the format without exposing the hash. */
export function hashPreview(hash: string): string {
  return hash ? `${hash.slice(0, 7)}…` : '(none)';
}

/** "2026-11-08 14:05" in Kuwait time. */
export function kuwaitDateTime(date: Date | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kuwait',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

function seasonsLabel(p: ReportProduct): string {
  if (p.allYear) return 'طول السنة';
  return p.seasons.map((m) => MONTHS[m - 1] ?? String(m)).join('، ');
}

const statusLabel = (s: string) => ORDER_STATUS_LABEL[s as keyof typeof ORDER_STATUS_LABEL] ?? s;

export function renderDbReport(d: ReportData): string {
  const table = (head: string[], rows: unknown[][], ltr: number[] = []) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
      rows.length
        ? rows.map((r) => `<tr>${r.map((c, i) => `<td${ltr.includes(i) ? ' dir="ltr"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${head.length}" class="empty">لا توجد مستندات بعد</td></tr>`
    }</tbody></table>`;

  const products = table(
    ['slug', 'الاسم', 'الفئة', 'السعر', 'المواسم'],
    d.products.map((p) => [p.slug, p.name, CATEGORY_LABEL[p.category as Category] ?? p.category, fmt(p.price), seasonsLabel(p)]),
    [0],
  );
  const users = table(
    ['الاسم', 'الإيميل', 'passwordHash', 'createdAt'],
    d.users.map((u) => [u.name, maskEmail(u.email), hashPreview(u.passwordHash), kuwaitDateTime(u.createdAt)]),
    [1, 2, 3],
  );
  const orders = table(
    ['رقم الطلب', 'العميل', 'عدد المنتجات', 'الإجمالي', 'الحالة', 'createdAt'],
    d.orders.map((o) => [o.orderNo, o.userName, o.itemsCount, fmt(o.total), statusLabel(o.status), kuwaitDateTime(o.createdAt)]),
    [0, 5],
  );

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>وسمي · تقرير قاعدة البيانات</title>
<style>
:root{--bg:#f7f1e8;--card:#fffaf3;--ink:#2d1613;--muted:#7a5a48;--line:#e6d7c3;--accent:#b07a4f;--ok:#2f6b3f}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 "Segoe UI",Tahoma,system-ui,sans-serif}
header{padding:22px 28px;border-bottom:1px solid var(--line);background:var(--card);display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center}
header h1{margin:0;font-size:20px}
.chip{padding:3px 12px;border:1px solid var(--line);border-radius:99px;color:var(--muted);font-size:13px;background:#fff}
.chip.ok{color:var(--ok);border-color:#b9d8c1}
main{padding:22px 28px;display:grid;gap:26px;max-width:1200px}
h2{margin:0 0 10px;font-size:17px;display:flex;gap:10px;align-items:baseline}
h2 code{font-size:13px;color:var(--accent);font-family:Consolas,monospace}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:start;vertical-align:top}
th{background:#f1e5d4;font-weight:600;font-size:13px;color:var(--muted)}
td[dir=ltr]{font-family:Consolas,monospace;font-size:13px;text-align:right}
tr:last-child td{border-bottom:0}
.empty{color:var(--muted);text-align:center}
.note{margin:8px 0 0;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<header>
<h1>وسمي · تقرير قاعدة البيانات</h1>
<span class="chip ok">${d.atlas ? 'MongoDB Atlas' : 'MongoDB'}</span>
<span class="chip" dir="ltr">database: ${esc(d.database)}</span>
<span class="chip">${esc(kuwaitDateTime(d.generatedAt))} (توقيت الكويت)</span>
<span class="chip" dir="ltr">npm run db:report</span>
</header>
<main>
<section><h2>المنتجات <code>products · ${d.products.length}</code></h2>${products}
<p class="note">الأسعار محفوظة بالدينار الكويتي في قاعدة البيانات، والموقع يقرأها من هناك فقط.</p></section>
<section><h2>المستخدمين <code>users · ${d.users.length}</code></h2>${users}
<p class="note">كلمات السر ما تنحفظ أبدًا — فقط تشفير bcrypt (cost 12). يظهر هنا أول 7 أحرف من التشفير فقط، والإيميلات مخفية جزئيًا.</p></section>
<section><h2>الطلبات <code>orders · ${d.orders.length}</code></h2>${orders}
<p class="note">كل طلب مربوط بصاحبه في users، والأسعار والإجمالي محسوبة في السيرفر من قاعدة البيانات.</p></section>
<section><h2>المراجعات <code>reviews · ${d.reviews.total}</code></h2>
<p class="note">${d.reviews.samples} مراجعة نموذجية من المتجر الأصلي + ${d.reviews.total - d.reviews.samples} مراجعة من العملاء.</p></section>
</main>
</body>
</html>
`;
}
