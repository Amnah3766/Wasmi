// Interactive helper (run by the site owner in their own terminal): builds MONGODB_URI from the Atlas
// "Connect → Drivers" string and the database user's password, writes it to .env.local, and tests the connection.
// The password is typed hidden, URL-encoded automatically, and never printed or logged.
//   node scripts/setup-db.mjs
import dns from 'node:dns';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env.local');
const DB_NAME = 'wasmi';

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (s) => {
      if (!muted || s === '\r\n' || s === '\n') rl.output.write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = hidden;
  });
}

const RE = /^(mongodb(?:\+srv)?:\/\/)([^:@/]+)(?::([^@]*))?@([^/?]+)(\/[^?]*)?(\?.*)?$/;

console.log('\n=== Wasmi: connect the database / ربط قاعدة البيانات ===\n');
console.log('1) من Atlas: Clusters ← Connect ← Drivers، انسخ الرابط اللي يبدأ بـ mongodb+srv://');
let raw = '';
for (;;) {
  raw = (await ask('   STEP 1 - paste the Atlas link (mongodb+srv://...) then Enter: ')).replace(/^["']|["']$/g, '');
  if (RE.test(raw)) break;
  console.log('   ✗ هذا مو رابط Atlas. لازم يبدأ بـ mongodb+srv:// وفيه @');
}
const [, scheme, user, pwInLink = '', host, , query = ''] = raw.match(RE);
const placeholder = !pwInLink || /^<.*>$/.test(pwInLink);

let password = '';
if (placeholder) {
  console.log(`\n2) كلمة سر مستخدم القاعدة "${decodeURIComponent(user)}" (ما تنعرض وأنت تكتب):`);
  while (!password) password = await ask('   STEP 2 - paste the database user PASSWORD (hidden) then Enter: ', true);
} else {
  console.log('\n2) الرابط فيه كلمة السر أصلًا، بستخدمها.');
  try {
    password = decodeURIComponent(pwInLink);
  } catch {
    password = pwInLink;
  }
}

const params = new URLSearchParams(query.replace(/^\?/, ''));
if (!params.has('retryWrites')) params.set('retryWrites', 'true');
if (!params.has('w')) params.set('w', 'majority');
const uri = `${scheme}${user}:${encodeURIComponent(password)}@${host}/${DB_NAME}?${params.toString()}`;

const header = [
  '# وسمي Wasmi — server secret (never commit, never share).',
  '# Written by scripts/setup-db.mjs. Database name: wasmi.',
].join('\n');
let content = existsSync(ENV) ? readFileSync(ENV, 'utf8') : header + '\n';
if (/^MONGODB_URI=.*$/m.test(content)) content = content.replace(/^MONGODB_URI=.*$/m, () => 'MONGODB_URI=' + uri);
else content = content.trimEnd() + '\nMONGODB_URI=' + uri + '\n';
writeFileSync(ENV, content);
console.log(`\n3) انحفظ في .env.local (القاعدة: ${DB_NAME}، المستخدم: ${decodeURIComponent(user)}، الخادم: ${host})`);

console.log('\n4) أجرب الاتصال…');
const { default: mongoose } = await import('mongoose');
const tryConnect = () => mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
try {
  try {
    await tryConnect();
  } catch (e) {
    if (!/querySrv|ENOTFOUND|ECONNREFUSED|ETIMEOUT|ESERVFAIL/i.test(String(e?.message) + String(e?.code))) throw e;
    dns.setServers(['1.1.1.1', '8.8.8.8']); // this PC's local DNS filter sometimes refuses Atlas SRV lookups
    await tryConnect();
  }
  await mongoose.connection.db.admin().ping();
  console.log('   OK - CONNECTED / الاتصال شغال. Tell Claude: done (خلصت).\n');
  await mongoose.disconnect();
  process.exit(0);
} catch (e) {
  const msg = String(e?.message || e);
  if (/auth|bad auth|Authentication failed/i.test(msg)) console.log('   ✗ اسم المستخدم أو كلمة السر غلط. شغّل السكربت مرة ثانية وتأكد من كلمة السر (Database Access ← Edit ← Edit Password).');
  else if (/whitelist|not authorized|Server selection timed out|ReplicaSetNoPrimary/i.test(msg))
    console.log('   ✗ Atlas رافض الاتصال. تأكد إن Network Access فيه 0.0.0.0/0 وحالته Active، وانتظر دقيقة وجرب مرة ثانية.');
  else console.log('   ✗ ما قدرت أتصل: ' + msg.replace(/mongodb(\+srv)?:\/\/[^\s]+/g, '[hidden]').slice(0, 200));
  console.log('   (الملف .env.local انحفظ، تقدر تعيد السكربت بأي وقت.)\n');
  process.exit(1);
}
