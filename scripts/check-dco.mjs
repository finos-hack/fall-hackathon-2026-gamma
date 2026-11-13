// Lists commits since hackathon/main (or all, if that ref is missing) without a Signed-off-by trailer.
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' });
let range = [];
try { git('rev-parse', '--verify', 'hackathon/main'); range = ['hackathon/main..HEAD']; } catch {}
const out = git('log', ...range, '--format=%H%x1f%s%x1f%(trailers:key=Signed-off-by,valueonly)%x1e');
const bad = out.split('\x1e').map((s) => s.trim()).filter(Boolean).map((r) => r.split('\x1f'))
  .filter(([, , t]) => !t || !t.trim());
for (const [h, s] of bad) console.log(`${h.slice(0, 7)} ${s}`);
process.exit(bad.length ? 1 : 0);
