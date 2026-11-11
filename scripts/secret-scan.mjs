// Secret scan for the files about to be committed AND the whole git history.
// It reads the real values from .env / .env.local (MONGODB_URI and its password, user and cluster host, JWT_SECRET,
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET) and also looks for generic patterns (a mongodb+srv connection string with a password, sk_, rk_,
// whsec_). It prints ONLY "file:line (what)", never a value. Exit code 1 when anything is found.
//   node scripts/secret-scan.mjs            → staged/tracked files + every commit in history
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const needles = [];
for (const f of ['.env', '.env.local', '.env.vercel']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/);
    if (!m) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, '');
    if (value.length < 8) continue;
    needles.push([`${m[1]} value`, value]);
    const key = /((?:sk|rk)_(?:test|live)_[A-Za-z0-9]{10,})/.exec(value);
    if (key && key[1] !== value) needles.push([`${m[1]} key`, key[1]]);
    const uri = /^mongodb(?:\+srv)?:\/\/([^:]+):([^@]+)@([^/?]+)/.exec(value);
    if (uri) {
      needles.push(['database user name', decodeURIComponent(uri[1])]);
      needles.push(['database password', decodeURIComponent(uri[2])]);
      if (uri[2] !== decodeURIComponent(uri[2])) needles.push(['database password (encoded)', uri[2]]);
      needles.push(['cluster host', uri[3]]);
    }
  }
}
const patterns = [
  ['connection string with password', /mongodb(?:\+srv)?:\/\/(?!USER:PASS@|wasmi_app:<|<)[^\s:@/"'`]+:(?!<)[^\s@/"'`]{4,}@/],
  ['Stripe secret key sk_', /\bsk_(?:test|live)_[A-Za-z0-9]{10,}/],
  ['Stripe restricted key rk_', /\brk_(?:test|live)_[A-Za-z0-9]{10,}/],
  ['webhook secret whsec_', /\bwhsec_[A-Za-z0-9]{16,}/],
];

function scanText(label, text, hits) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const [what, value] of needles) if (line.includes(value)) hits.push(`${label}:${i + 1} (${what})`);
    for (const [what, re] of patterns) if (re.test(line)) hits.push(`${label}:${i + 1} (${what})`);
  });
}

const hits = [];
// 1) Every file git tracks or has staged (the content that would be pushed).
const files = git('ls-files', '--cached').split('\n').filter(Boolean);
for (const f of files) {
  let text;
  try {
    text = git('show', `:${f}`);
  } catch {
    continue;
  }
  if (text.includes('\u0000')) continue; // binary
  scanText(f, text, hits);
}
// 2) The whole history (every added line in every commit).
let commits = [];
try {
  commits = git('rev-list', '--all').split('\n').filter(Boolean);
} catch {
  commits = [];
}
for (const c of commits) {
  const patch = git('show', '--format=', '--unified=0', '--no-color', c);
  let file = '';
  let lineNo = 0;
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++ b/')) file = line.slice(6);
    else if (line.startsWith('@@')) lineNo = Number((/\+(\d+)/.exec(line) || [0, 0])[1]) - 1;
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      lineNo++;
      const before = hits.length;
      scanText(`${c.slice(0, 8)}:${file}`, line.slice(1), hits);
      for (let i = before; i < hits.length; i++) hits[i] = hits[i].replace(/:1 \(/, `:${lineNo} (`);
    }
  }
}

console.log(`secret scan: ${files.length} tracked/staged files, ${commits.length} commits, ${needles.length} real values + ${patterns.length} patterns`);
for (const h of [...new Set(hits)]) console.log('HIT ' + h);
console.log(`SECRET HITS: ${new Set(hits).size}`);
process.exit(hits.length ? 1 : 0);
