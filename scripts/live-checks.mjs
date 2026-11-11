// Live checks against the deployed site, without creating any account or order:
//   1) HTTP status codes (pages 200, products from DB, /_next/static 200, 401 / 307 / 400 / 404)
//   2) secret scan of every HTML page, every /_next/static JS/CSS file and the public API responses
// Secrets to look for are read from the local .env / .env.local and are NEVER printed (only "found / not found").
//   node scripts/live-checks.mjs https://wasmi-store.netlify.app evidence/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const BASE = (process.argv[2] || 'https://wasmi-store.netlify.app').replace(/\/$/, '');
const OUTDIR = process.argv[3] || 'evidence';

async function get(url, init = {}) {
  let last;
  for (let i = 0; i < 6; i++) {
    try {
      const t0 = Date.now();
      const res = await fetch(url, { redirect: 'manual', ...init, headers: { 'user-agent': 'wasmi-live-checks', ...(init.headers || {}) } });
      const body = await res.text();
      return { status: res.status, headers: res.headers, body, ms: Date.now() - t0 };
    } catch (e) {
      last = e; // flaky local DNS → retry
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw last;
}

const rows = [];
let fails = 0;
function check(id, what, ok, expected, actual) {
  if (!ok) fails++;
  rows.push(`[${ok ? 'PASS' : 'FAIL'}] ${id.padEnd(5)} ${what} | expected: ${expected} | actual: ${actual}`);
}

const started = new Date().toISOString();
const pages = ['/', '/products', '/products/awal', '/products/ghaim', '/finder', '/gift', '/favorites', '/story', '/brand', '/contact', '/cart', '/checkout', '/login', '/signup'];
const htmlByPath = new Map();
let n = 0;
for (const p of pages) {
  const r = await get(BASE + p);
  htmlByPath.set(p, r.body);
  const title = (r.body.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  check(`1.${++n}`, `GET ${p}`, r.status === 200, '200', `${r.status} · <title> ${title} · ${r.ms} ms`);
}

const api = await get(BASE + '/api/products');
let products = [];
try {
  products = JSON.parse(api.body).products || [];
} catch {}
check('2.1', 'GET /api/products (from MongoDB)', api.status === 200 && products.length === 12, '200 + 12 products', `${api.status} · ${products.length} products · e.g. ${products[0]?.slug} = ${products[0]?.name} ${products[0]?.price?.toFixed?.(3)} د.ك`);
const shopHtml = htmlByPath.get('/products') || '';
const named = products.filter((p) => shopHtml.includes(p.name)).length;
check('2.2', '/products page renders the DB products', named === 12, '12/12 names from /api/products in the page', `${named}/12`);
const health = await get(BASE + '/api/health');
check('2.3', 'GET /api/health (database reachable)', health.status === 200 && /"db":"up"/.test(health.body), '200 {db:"up"}', `${health.status} ${health.body.slice(0, 60)}`);

const assets = new Set();
for (const html of htmlByPath.values()) for (const m of html.matchAll(/\/_next\/static\/[^"'\s)]+?\.(?:js|css)/g)) assets.add(m[0]);
let assetOk = 0;
const assetBodies = new Map();
for (const a of assets) {
  const r = await get(BASE + a);
  if (r.status === 200) assetOk++;
  assetBodies.set(a, r.body);
}
check('3.1', '/_next/static JS + CSS files', assets.size > 0 && assetOk === assets.size, 'all 200', `${assetOk}/${assets.size} returned 200`);
for (const f of ['/favicon.svg', '/images/products/awal.svg']) {
  const r = await get(BASE + f);
  check('3.2', `GET ${f}`, r.status === 200, '200', String(r.status));
}

const codes = [
  ['4.1', 'GET /api/orders (signed out)', () => get(BASE + '/api/orders'), 401],
  ['4.2', 'GET /api/auth/me (signed out)', () => get(BASE + '/api/auth/me'), 401],
  ['4.3', 'POST /api/orders (signed out)', () => get(BASE + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"lines":[{"t":"p","id":"awal","vi":1,"q":1}]}' }), 401],
  ['4.4', 'GET /api/orders/<id> (signed out)', () => get(BASE + '/api/orders/0123456789abcdef01234567'), 401],
  ['4.5', 'GET /orders (protected page, signed out)', () => get(BASE + '/orders'), 307],
  ['4.6', 'GET /orders/<id> (protected page, signed out)', () => get(BASE + '/orders/0123456789abcdef01234567'), 307],
  ['4.7', 'POST /api/auth/signup with invalid fields (nothing created)', () => get(BASE + '/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"name":"","email":"x","password":"1"}' }), 400],
  ['4.8', 'POST /api/auth/login with empty body', () => get(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), 400],
  ['4.9', 'POST /api/auth/login with malformed JSON', () => get(BASE + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' }), 400],
  ['4.10', 'GET /products/no-such-scent', () => get(BASE + '/products/no-such-scent'), 404],
  ['4.11', 'GET /api/products/no-such-scent', () => get(BASE + '/api/products/no-such-scent'), 404],
  ['4.12', 'GET /api/products/no-such-scent/reviews', () => get(BASE + '/api/products/no-such-scent/reviews'), 404],
];
for (const [id, what, fn, want] of codes) {
  const r = await fn();
  let extra = '';
  if (want === 307) extra = ` → ${r.headers.get('location')}`;
  else {
    try {
      const j = JSON.parse(r.body);
      extra = ` ${JSON.stringify(j.fields || j.error || '').slice(0, 90)}`;
    } catch {}
  }
  check(id, what, r.status === want, String(want), `${r.status}${extra}`);
}

const h = (await get(BASE + '/')).headers;
const hdr = ['strict-transport-security', 'x-content-type-options', 'referrer-policy', 'x-frame-options'].map((k) => `${k}: ${h.get(k) ?? '(none)'}`).join(' · ');
check('5.1', 'Security headers on pages', /nosniff/.test(hdr) && /strict-origin/.test(hdr), 'nosniff + referrer-policy', hdr);
const signupCookie = await get(BASE + '/api/auth/logout', { method: 'POST' });
const sc = signupCookie.headers.get('set-cookie') || '';
check('5.2', 'Session cookie attributes (logout response, no account needed)', /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc) && /Secure/i.test(sc), 'HttpOnly; SameSite=Lax; Secure', sc.replace(/wasmi_session=[^;]*/, 'wasmi_session=<empty>'));

writeFileSync(
  path.join(OUTDIR, 'live-http-checks.txt'),
  [`Wasmi - live Netlify HTTP checks`, `URL: ${BASE}`, `Run (UTC): ${started}`, `Method: plain HTTPS requests from Node ${process.version}; redirects not followed; no account created, no order placed, no password typed.`, '', ...rows, '', `RESULT: ${rows.length - fails}/${rows.length} PASS`].join('\n') + '\n',
);

// ---- secret scan ----
const secrets = [];
for (const f of ['.env', '.env.local']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (!m) continue;
    const v = m[2].trim();
    secrets.push({ name: m[1] + ' (full value)', value: v });
    const pw = v.match(/^mongodb(?:\+srv)?:\/\/[^:]+:([^@]+)@/);
    if (pw) {
      secrets.push({ name: 'MongoDB password (encoded)', value: pw[1] });
      secrets.push({ name: 'MongoDB password (decoded)', value: decodeURIComponent(pw[1]) });
      secrets.push({ name: 'MongoDB host+user string', value: v.split('@')[0] });
    }
  }
}
const patterns = [
  ['connection string', /mongodb(\+srv)?:\/\/[^\s"'<]+/i],
  ['bcrypt hash', /\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/],
  ['passwordHash field', /passwordHash/],
  ['env name MONGODB_URI with value', /MONGODB_URI\s*[=:]\s*\S/],
  ['env name JWT_SECRET with value', /JWT_SECRET\s*[=:]\s*\S/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
];
const corpus = [
  ...[...htmlByPath].map(([p, b]) => ['page ' + p, b]),
  ...[...assetBodies].map(([p, b]) => ['asset ' + p, b]),
  ['api /api/products', api.body],
  ['api /api/products/awal', (await get(BASE + '/api/products/awal')).body],
  ['api /api/products/awal/reviews', (await get(BASE + '/api/products/awal/reviews')).body],
  ['api /api/health', health.body],
];
for (const f of ['/.env', '/.env.local', '/.netlify/state.json', '/package.json', '/next.config.ts', '/.next/required-server-files.json', '/required-server-files.json', '/BUILD_ID']) {
  const r = await get(BASE + f);
  corpus.push(['probe ' + f + ' (' + r.status + ')', r.status === 200 ? r.body : '']);
}
let hits = 0;
const lines = [];
for (const [where, body] of corpus) {
  const found = [];
  for (const s of secrets) if (s.value.length >= 8 && body.includes(s.value)) found.push(s.name);
  for (const [name, re] of patterns) if (re.test(body)) found.push(name);
  hits += found.length;
  lines.push(`${found.length ? 'HIT ' : 'ok  '} ${where} (${body.length} bytes)${found.length ? ' → ' + found.join(', ') : ''}`);
}
writeFileSync(
  path.join(OUTDIR, 'live-secret-scan.txt'),
  [
    'Wasmi - live secret scan',
    `URL: ${BASE} | Run (UTC): ${new Date().toISOString()}`,
    `Scanned: ${corpus.length} responses (${htmlByPath.size} pages, ${assetBodies.size} /_next/static files, public API responses, probes for config files).`,
    `Looked for: the real values of ${secrets.length} secret strings taken from the local .env/.env.local (values never printed) + ${patterns.length} generic patterns.`,
    '',
    ...lines,
    '',
    `SECRET HITS: ${hits}`,
  ].join('\n') + '\n',
);
console.log(`http checks: ${rows.length - fails}/${rows.length} PASS · secret hits: ${hits}`);
process.exit(fails || hits ? 1 : 0);
