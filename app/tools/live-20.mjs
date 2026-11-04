// 真模型 20 轮实测（会花钱，约几分钱）。用法：
//   1) 以真模型启动服务（start-live.cmd 或 MOCK_MODEL=0 node server.mjs）
//   2) node app/tools/live-20.mjs
// 检查：每轮有回复、消息成对落盘、usage 来自 API（estimated=false）、上下文没断片。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USAGE = path.join(__dirname, '..', 'data', 'usage.jsonl');

// 自动带上访问口令（TOKEN 环境变量优先，其次 data/secret.json）
let TOKEN = process.env.TOKEN || '';
if (!TOKEN) {
  try {
    TOKEN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'secret.json'), 'utf8').replace(/^\uFEFF/, '')).accessPassword || '';
  } catch { /* 没配口令 */ }
}
if (TOKEN) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, opts = {}) => {
    if (String(url).includes('/api/')) {
      opts = { ...opts, headers: { ...(opts.headers || {}), 'x-access-token': TOKEN } };
    }
    return realFetch(url, opts);
  };
}

const prompts = [
  '记住：我最喜欢的颜色是墨绿色。',
  '今天上班有点累。',
  '你猜我现在在干什么？',
  '晚饭吃什么好？',
  '我养了一只猫，叫豆豆。',
  '豆豆今天把杯子打碎了。',
  '你觉得猫会记仇吗？',
  '周末想去爬山。',
  '但是天气预报说下雨。',
  '那改看电影吧。',
  '最近有什么好看的片子？',
  '我不太喜欢恐怖片。',
  '明天要早起。',
  '你有什么办法能让人早起？',
  '我手机闹钟总是按掉继续睡。',
  '那你呢，你会睡觉吗？',
  '哈哈，问了个傻问题。',
  '其实我有点失眠。',
  '有什么不花钱的助眠办法？',
  '谢谢你陪我聊这些。',
];
const MEMORY_Q = '我最喜欢的颜色是什么？只回答颜色。';

function parseBlock(block) {
  let event = 'message';
  const data = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  try { return { event, data: JSON.parse(data.join('\n')) }; } catch { return null; }
}

async function round(text) {
  const id = crypto.randomUUID();
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, text }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let done = null;
  let budget = null;
  let partial = '';
  let error = null;

  while (true) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const f = parseBlock(buf.slice(0, i));
      buf = buf.slice(i + 2);
      if (!f) continue;
      if (f.event === 'delta') partial += f.data.text;
      else if (f.event === 'done') done = f.data;
      else if (f.event === 'budget') budget = f.data;
      else if (f.event === 'error') error = f.data;
    }
    if (done || error) break;
  }
  if (error) throw new Error(`模型报错：${error.message}`);
  return { text: done ? done.text : partial, done, budget, ms: Date.now() - t0 };
}

const results = [];
let prevSpent = 0;
let failed = 0;

for (const [i, text] of prompts.entries()) {
  try {
    const r = await round(text);
    const spent = r.budget ? r.budget.spentYuan : prevSpent;
    const cost = Math.max(0, spent - prevSpent);
    results.push({ i: i + 1, chars: r.text.length, ms: r.ms, cost, spent });
    prevSpent = spent;
    console.log(`${String(i + 1).padStart(2)}. ${r.ms}ms  ${String(r.text.length).padStart(3)}字  ¥${cost.toFixed(5)}  ${r.text.slice(0, 28).replace(/\n/g, ' ')}`);
    if (!r.text.trim()) { console.log('   !! 空回复'); failed++; }
  } catch (e) {
    failed++;
    console.log(`${String(i + 1).padStart(2)}. FAILED: ${e.message}`);
  }
}

// 上下文检查：第 1 轮埋的颜色
let memoryOk = false;
try {
  const m = await round(MEMORY_Q);
  memoryOk = m.text.includes('墨绿');
  console.log(`\n记忆检查: ${memoryOk ? 'PASS' : 'FAIL'}  回复：${m.text.slice(0, 40)}`);
} catch (e) {
  console.log(`\n记忆检查: FAIL ${e.message}`);
}

// 落盘检查
const lines = fs.existsSync(USAGE) ? fs.readFileSync(USAGE, 'utf8').split('\n').filter((l) => l.trim()) : [];
const entries = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
const apiEntries = entries.filter((e) => e.mode === 'live');
const allFromApi = apiEntries.length > 0 && apiEntries.every((e) => e.estimated === false);
const totalCost = apiEntries.reduce((s, e) => s + (Number(e.costYuan) || 0), 0);
const totalIn = apiEntries.reduce((s, e) => s + (Number(e.tokensIn) || 0), 0);
const totalOut = apiEntries.reduce((s, e) => s + (Number(e.tokensOut) || 0), 0);

const history = await fetch(`${BASE}/api/messages?limit=200`).then((r) => r.json());
const msgs = history.messages;
const users = msgs.filter((m) => m.role === 'user');
const assistants = msgs.filter((m) => m.role === 'assistant');
const paired = users.length >= prompts.length
  && users.length === assistants.length
  && users.every((u) => assistants.some((a) => a.replyTo === u.id));

const checks = [
  ['20 轮都有非空回复', results.length === 20 && results.every((r) => r.chars > 0) && failed === 0],
  ['上下文没断片（记住颜色）', memoryOk],
  ['每轮一问一答、成对落盘', paired],
  ['usage 全部来自 API', allFromApi],
  ['模型名是 deepseek-flash', apiEntries.every((e) => e.model === 'deepseek-flash')],
  ['没有重复消息 id', new Set(msgs.map((m) => m.id)).size === msgs.length],
  ['seq 连续', msgs.every((m, i) => i === 0 || m.seq === msgs[i - 1].seq + 1)],
];

console.log(`\n合计：${apiEntries.length} 次调用，输入 ${totalIn} tok / 输出 ${totalOut} tok，花费 ¥${totalCost.toFixed(4)}`);
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}
process.exit(failed ? 1 : 0);
