// P4：embedding 按需策略。
import { shouldUseSemanticMemory } from '../lib/memory.mjs';

const checks = [];
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });
const base = { configured: true, memoryCount: 10 };

check('未配置不调用', shouldUseSemanticMemory('今天吃什么', { ...base, configured: false, keywordHits: 0 }) === false);
check('无记忆不调用', shouldUseSemanticMemory('今天吃什么', { ...base, memoryCount: 0, keywordHits: 0 }) === false);
check('关键词命中且无回忆意图不调用', shouldUseSemanticMemory('豆豆今天怎么样', { ...base, keywordHits: 2 }) === false);
check('关键词无命中调用', shouldUseSemanticMemory('今天吃什么', { ...base, keywordHits: 0 }) === true);
check('明确回忆即使命中关键词也调用', shouldUseSemanticMemory('你还记得豆豆吗', { ...base, keywordHits: 2 }) === true);
check('空消息不调用', shouldUseSemanticMemory('   ', { ...base, keywordHits: 0 }) === false);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
