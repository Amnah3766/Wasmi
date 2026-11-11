// Turns a Playwright JSON report into a plain-text evidence file.
//   node scripts/e2e-summary.mjs test-results/e2e-results.json evidence/e2e-local-atlas.txt "title line"
import { readFileSync, writeFileSync } from 'node:fs';

const [src, dest, ...titleParts] = process.argv.slice(2);
const j = JSON.parse(readFileSync(src, 'utf8'));
const rows = [];
let pass = 0, fail = 0, skip = 0, retried = 0;
function walk(s, file) {
  for (const x of s.suites || []) walk(x, s.file || file);
  for (const sp of s.specs || []) {
    for (const t of sp.tests) {
      const last = t.results[t.results.length - 1] || {};
      let st = 'FAIL';
      if (t.status === 'skipped') { st = 'SKIP'; skip++; }
      else if (t.status === 'expected') { st = 'PASS'; pass++; }
      else if (t.status === 'flaky') { st = 'PASS(retry)'; pass++; retried++; }
      else fail++;
      rows.push(`${st.padEnd(12)} [${t.projectName}] ${sp.file || file} > ${sp.title}  (${last.duration || 0} ms)`);
    }
  }
}
walk(j, '');
const head = [
  titleParts.join(' ') || 'Playwright results',
  `Run: ${new Date(j.stats.startTime).toISOString()} | duration ${Math.round(j.stats.duration / 1000)} s`,
  '',
  `TOTAL: ${pass} passed, ${fail} failed, ${skip} skipped, ${retried} passed on retry`,
  '',
];
writeFileSync(dest, head.concat(rows).join('\n') + '\n');
console.log(head[3]);
