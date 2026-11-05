// P2 验收：breakdown 六项求和、空目录为 0、今日汇总与缓存命中率。
import { BREAKDOWN_KEYS, emptyBreakdown, normalizeBreakdown, sumBreakdown, cacheRate } from '../lib/usage.mjs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const fixed = { stable: 100, memory: 20, posts: 0, catalog: 0, time: 10, l1: 70 };
const normalized = normalizeBreakdown(fixed);
check('六项求和等于 total', normalized.total === 200, JSON.stringify(normalized));
check('空 catalog 为 0', normalized.catalog === 0);
check('空块记 0 不记 null', Object.entries(emptyBreakdown()).every(([, value]) => value === 0));
check('keys 固定六项', BREAKDOWN_KEYS.join(',') === 'stable,memory,posts,catalog,time,l1');

const summed = sumBreakdown([
  { breakdown: { stable: 100, memory: 20, posts: 0, catalog: 0, time: 10, l1: 70 } },
  { breakdown: { stable: 200, memory: 30, posts: 5, catalog: 15, time: 10, l1: 80 } },
]);
check('今日汇总逐块相加', summed.stable === 300 && summed.memory === 50 && summed.posts === 5
  && summed.catalog === 15 && summed.time === 20 && summed.l1 === 150 && summed.total === 540, JSON.stringify(summed));
check('缓存命中率', cacheRate(75, 25) === 0.75 && cacheRate(0, 0) === null);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
