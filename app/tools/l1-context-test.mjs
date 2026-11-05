// P1 验收：L1 token 预算、保底最新一轮、短历史逐字节不变、30 轮上限。
import { buildL1Context, L1_TURNS, L1_TOKEN_BUDGET } from '../lib/context.mjs';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
const tokenize = (text) => Array.from(String(text)).length;
const timeLabel = () => '10:00';
const textOf = (message) => message.text;

// 60 条长消息：每条约 500 汉字
const longMessages = [];
for (let i = 0; i < 30; i++) {
  longMessages.push({ role: 'user', text: `U${String(i).padStart(2, '0')}-` + '字'.repeat(500) });
  longMessages.push({ role: 'assistant', text: `A${String(i).padStart(2, '0')}-` + '回'.repeat(500) });
}
longMessages[58].text = 'LATEST-USER-' + '字'.repeat(500);
longMessages[59].text = 'LATEST-ASSISTANT-' + '回'.repeat(500);

const longContext = buildL1Context(longMessages, { tokenize, timeLabel, textOf });
const longTokens = longContext.reduce((sum, message) => sum + tokenize(message.content), 0);
check('60 条长历史被预算截断', longContext.length < 60, `kept=${longContext.length}`);
check('L1 估算 token ≤ 约 3100', longTokens <= L1_TOKEN_BUDGET + 100, `tokens=${longTokens}`);
check('最新用户消息保留', longContext.some((message) => message.content.includes('LATEST-USER-')));
check('最新助手回复保留', longContext.some((message) => message.content.includes('LATEST-ASSISTANT-')));

// 短历史：与旧版 slice+map 完全一致
const short = [
  { role: 'user', text: '你好。' },
  { role: 'assistant', text: '在。' },
  { role: 'user', text: '今天如何？' },
  { role: 'assistant', text: '还行。' },
];
const expected = short.map((message) => ({ role: message.role, content: `[10:00] ${message.text}` }));
const actual = buildL1Context(short, { tokenize, timeLabel, textOf });
check('短历史逐字节不变', JSON.stringify(actual) === JSON.stringify(expected), JSON.stringify(actual));

// 保底：最新一轮即使超预算也不丢
const huge = [
  { role: 'user', text: 'HUGE-USER-' + '字'.repeat(4000) },
  { role: 'assistant', text: 'HUGE-ASSISTANT-' + '回'.repeat(4000) },
];
const hugeContext = buildL1Context(huge, { tokenize, timeLabel, textOf });
check('最新一轮超预算仍保留', hugeContext.length === 2
  && hugeContext.some((message) => message.content.includes('HUGE-USER-'))
  && hugeContext.some((message) => message.content.includes('HUGE-ASSISTANT-')));

// 30 轮第二上限
const many = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: `m${i}` }));
const manyContext = buildL1Context(many, { tokenize, timeLabel, textOf, budget: 1e9 });
check('最多 30 轮/60 条', manyContext.length === L1_TURNS * 2, `kept=${manyContext.length}`);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
