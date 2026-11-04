// 预算护栏专项测试。需要一台「额度极小 + 全新数据目录」的实例：
//   DAILY_BUDGET_YUAN=0.0002 DATA_DIR=... PORT=8788 node server.mjs
// 然后：BASE=http://127.0.0.1:8788 node smoke-budget.mjs
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:8788';

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const chat = (text) =>
  fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: crypto.randomUUID(), text }),
  });

const h0 = await fetch(`${BASE}/api/health`).then((r) => r.json());
check('起始时未超预算', h0.budget && h0.budget.blocked === false, `spent=¥${h0.budget?.spentYuan}`);
check('额度确实很小', h0.budget && h0.budget.limitYuan < 0.01, `limit=¥${h0.budget?.limitYuan}`);

const r1 = await chat('第一条消息');
check('额度内第一轮正常', r1.status === 200, `status=${r1.status}`);
await r1.text();

const h1 = await fetch(`${BASE}/api/health`).then((r) => r.json());
check('一轮之后已超额', h1.budget.spentYuan > h1.budget.limitYuan, `spent=¥${h1.budget.spentYuan}`);
check('health 标记为 blocked', h1.budget.blocked === true);

const before = (await fetch(`${BASE}/api/messages?limit=100`).then((r) => r.json())).messages.length;

const r2 = await chat('第二条消息（应被拦下）');
check('超额后返回 402', r2.status === 402, `status=${r2.status}`);
const body = await r2.json().catch(() => ({}));
check('错误码是 budget_exceeded', body.error === 'budget_exceeded');
check('提示里说清了原因', typeof body.message === 'string' && body.message.includes('额度'));
check('被拦的消息没有写进历史', (await fetch(`${BASE}/api/messages?limit=100`).then((r) => r.json())).messages.length === before);

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
