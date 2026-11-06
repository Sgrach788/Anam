// P0 验收：稳定前缀不随时间/记忆/动态/目录变化。
import {
  buildStableSystemPrefix, buildSystemContent, stablePrefixOf,
  TIME_RULES, META_FORMAT, STICKER_BAN, EMOTION_RULES,
} from '../lib/prompt.mjs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const stable = buildStableSystemPrefix({ persona: 'PERSONA', profileText: 'PROFILE' });
const a = buildSystemContent({
  stablePrefix: stable,
  memoryText: 'MEMORY-A',
  recentPostsText: 'POSTS-A',
  memeText: 'CATALOG-A',
  nowLine: 'NOW-A',
});
const b = buildSystemContent({
  stablePrefix: stable,
  memoryText: 'MEMORY-B',
  recentPostsText: 'POSTS-B',
  memeText: 'CATALOG-B',
  nowLine: 'NOW-B',
});
check('两次构建稳定前缀逐字节相同', stablePrefixOf(a, stable) === stable && stablePrefixOf(b, stable) === stable);
check('稳定前缀不含时间行', !stable.includes('NOW-'));
check('稳定前缀不含记忆/动态/目录', !stable.includes('MEMORY-') && !stable.includes('POSTS-') && !stable.includes('CATALOG-'));
check('稳定前缀含时间约束/元数据/禁表情/情绪指令',
  stable.includes(TIME_RULES) && stable.includes(META_FORMAT) && stable.includes(STICKER_BAN) && stable.includes(EMOTION_RULES));

const stable2 = buildStableSystemPrefix({ persona: 'PERSONA', profileText: 'PROFILE' });
check('相同人设重复构建稳定前缀相同', stable2 === stable);

check('尾巴顺序 memory < posts < catalog < now',
  a.indexOf('MEMORY-A') < a.indexOf('POSTS-A')
  && a.indexOf('POSTS-A') < a.indexOf('CATALOG-A')
  && a.indexOf('CATALOG-A') < a.indexOf('NOW-A'));
check('稳定前缀在尾巴之前', a.indexOf(stable) === 0);
check('不同尾巴不改变稳定前缀', a.slice(0, stable.length) === b.slice(0, stable.length));
const fullTail = buildSystemContent({
  stablePrefix: stable,
  memoryText: 'MEMORY',
  recentPostsText: 'POSTS',
  memeText: 'CATALOG',
  signatureText: 'SIGNATURE',
  weatherText: 'WEATHER',
  dateText: 'DATE',
  nowLine: 'NOW',
});
check('天气/日期在签名之后、现在之前',
  fullTail.indexOf('SIGNATURE') < fullTail.indexOf('WEATHER')
  && fullTail.indexOf('WEATHER') < fullTail.indexOf('DATE')
  && fullTail.indexOf('DATE') < fullTail.indexOf('NOW'));

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
