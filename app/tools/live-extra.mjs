// 接着已有对话再聊 30 轮（凑满验收第 1 条的 50 轮），中途埋一个事实，最后回问。
// 用法：真模型服务已启动，且已跑过 live-20.mjs → node app/tools/live-extra.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  '刚躺下，但还是不太困。',
  '你说人为什么会失眠？',
  '我最近老想一些以前的事。',
  '小时候夏天晚上会搬竹床到院子里。',
  '记一下：我下周三要去医院复查。',
  '有点怕查出来不好。',
  '嗯，你这么说我踏实一点。',
  '医院离我家挺远的。',
  '早上要空腹，不能吃东西。',
  '那我得几点起？',
  '你觉得我该几点出门？',
  '地铁还是打车好？',
  '行，那就打车。',
  '复查完想吃点好的。',
  '有什么推荐的？',
  '别太油腻。',
  '好，就粥和鸡蛋。',
  '对了，豆豆最近掉毛厉害。',
  '是不是换季都这样？',
  '那要不要给它梳毛？',
  '它不太让梳。',
  '有什么办法？',
  '我试试看。',
  '今天跟你聊了挺多。',
  '其实我平时不太跟人说这些。',
  '谢谢你没嫌我啰嗦。',
  '你会有觉得累的时候吗？',
  '那你累的时候怎么办？',
  '好，我也去睡了。',
  '晚安。',
];
const CHECK_Q = '我下周三要做什么？只回答这一件事。';

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
  return { text: done ? done.text : partial, budget, ms: Date.now() - t0 };
}

let prevSpent = (await fetch(`${BASE}/api/health`).then((r) => r.json())).budget.spentYuan;
let failed = 0;
for (const [i, text] of prompts.entries()) {
  try {
    const r = await round(text);
    const spent = r.budget ? r.budget.spentYuan : prevSpent;
    console.log(`${String(i + 21).padStart(2)}. ${r.ms}ms  ${String(r.text.length).padStart(3)}字  ¥${(spent - prevSpent).toFixed(5)}  ${r.text.slice(0, 24).replace(/\n/g, ' ')}`);
    prevSpent = spent;
    if (!r.text.trim()) { console.log('   !! 空回复'); failed++; }
  } catch (e) {
    failed++;
    console.log(`${String(i + 21).padStart(2)}. FAILED: ${e.message}`);
  }
}

const m = await round(CHECK_Q);
const ok = m.text.includes('医院') && m.text.includes('复查');
console.log(`\n第 50 轮后的记忆检查: ${ok ? 'PASS' : 'FAIL'}  回复：${m.text.slice(0, 60)}`);
const h = await fetch(`${BASE}/api/health`).then((r) => r.json());
console.log(`消息总数 ${h.messages}，今天累计 ¥${h.budget.spentYuan}`);
process.exit(failed || !ok ? 1 : 0);
