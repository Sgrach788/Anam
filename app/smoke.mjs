// V0 冒烟测试：对着已经运行的服务跑，只走 HTTP，不碰文件。
// 用法：node smoke.mjs   （服务默认 http://127.0.0.1:8787，可用 BASE 覆盖）
// 若设置了 DATA_DIR，会额外检查 usage.jsonl 的落盘形状。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 服务端开了访问口令后，测试请求也要带上；优先 TOKEN 环境变量，其次 data/secret.json。
let TOKEN = process.env.TOKEN || '';
if (!TOKEN) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'secret.json'), 'utf8').replace(/^\uFEFF/, ''));
    TOKEN = s.accessPassword || '';
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

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 解析一段 SSE 文本为 [{ event, data, id }]
function parseSse(raw) {
  const out = [];
  for (const block of raw.split('\n\n')) {
    if (!block.trim()) continue;
    let event = 'message';
    let id = null;
    const data = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
      else if (line.startsWith('id:')) id = Number(line.slice(3).trim());
    }
    if (!data.length) continue;
    let payload = null;
    try { payload = JSON.parse(data.join('\n')); } catch { continue; }
    out.push({ event, data: payload, id });
  }
  return out;
}

const chat = (text, id = crypto.randomUUID()) =>
  fetch(`${BASE}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, text }),
  });

const historyOf = (limit = 500) => fetch(`${BASE}/api/messages?limit=${limit}`).then((r) => r.json());

// 读一条 SSE 流，按帧回调；stop(frames) 返回 true 时主动断开。
async function readStream(res, { stop = () => false, onFrame = () => {} } = {}) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const frames = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        for (const f of parseSse(block)) {
          frames.push(f);
          onFrame(f);
        }
        if (stop(frames)) {
          await reader.cancel().catch(() => {});
          return frames;
        }
      }
    }
  } catch {
    /* 断线就当读到一半 */
  }
  return frames;
}

// 1) health
const health = await fetch(`${BASE}/api/health`).then((r) => r.json());
check('health ok', health.ok === true);
check('health 带 schema 版本号', health.v === 1, `v=${health.v}`);
check('health 带 boot id', typeof health.boot === 'string' && health.boot.length > 8);
check('health 带事件序号', Number.isInteger(health.eventSeq) && health.eventSeq >= 0, `eventSeq=${health.eventSeq}`);
check(
  'health 带今日预算',
  Boolean(health.budget) && health.budget.limitYuan > 0 && /^\d{4}-\d{2}-\d{2}$/.test(health.budget.day),
  health.budget ? `¥${health.budget.spentYuan}/${health.budget.limitYuan}` : 'missing',
);

// 2) 一轮对话（POST 直连流）
const text = '你好，今天有点累';
const res1 = await chat(text);
check('chat HTTP 200', res1.status === 200, `status=${res1.status}`);
const events1 = await readStream(res1);

const userEvt = events1.find((e) => e.event === 'user');
const startEvt = events1.find((e) => e.event === 'start');
const parts = events1.filter((e) => e.event === 'message').map((e) => e.data);
const doneEvt = events1.find((e) => e.event === 'done');
const replyText = parts.map((p) => p.text).join('');

check('SSE 有 user/start/message/done', Boolean(userEvt && startEvt && parts.length && doneEvt));
check('分条回复拼回全文且含原话', replyText.length > 0 && replyText.includes(text));
check('分条数 = done.count', Boolean(doneEvt) && doneEvt.data.count === parts.length, `${parts.length}`);
check(
  'done.ids 与分条 id 一致',
  Boolean(doneEvt) && JSON.stringify(doneEvt.data.ids) === JSON.stringify(parts.map((p) => p.id)),
);
check('每条都挂同一条用户消息', parts.every((p) => p.replyTo === userEvt.data.id));
check('每条都是独立 id', new Set(parts.map((p) => p.id)).size === parts.length);
check('单条不超过 60 字', parts.every((p) => p.text.length <= 60), Math.max(...parts.map((p) => p.text.length)) + '字');
check('jobId 一致', Boolean(doneEvt) && doneEvt.data.jobId === userEvt.data.id);

const frameIds = events1.filter((e) => e.id).map((e) => e.id);
check('每帧都有递增 id', frameIds.length > 0 && frameIds.every((v, i) => i === 0 || v > frameIds[i - 1]));

// 3) 消息记录形状（D13）
const history = await historyOf(20);
const msgs = history.messages;
check('history 有记录', msgs.length >= 2, `n=${msgs.length}`);
check('每条都有 v=1', msgs.every((m) => m.v === 1));
check('每条都有整数 seq', msgs.every((m) => Number.isInteger(m.seq) && m.seq > 0));
check('每条 at 都是 UTC ISO-8601', msgs.every((m) => ISO_UTC.test(m.at)), msgs.at(-1)?.at);
check('seq 连续递增', msgs.every((m, i) => i === 0 || m.seq === msgs[i - 1].seq + 1));
check('lastSeq 与最后一条一致', history.lastSeq === msgs[msgs.length - 1].seq);

// 4) 预算记账（D14）
const budgetEvt = events1.find((e) => e.event === 'budget');
check('本轮返回 budget 事件', Boolean(budgetEvt));
check(
  '本轮已记账',
  Boolean(budgetEvt) && budgetEvt.data.calls >= 1 && budgetEvt.data.spentYuan > 0,
  budgetEvt ? `calls=${budgetEvt.data.calls} spent=¥${budgetEvt.data.spentYuan}` : 'missing',
);
const health2 = await fetch(`${BASE}/api/health`).then((r) => r.json());
check('记账后 health 里的花费增加', health2.budget.spentYuan >= health.budget.spentYuan);

if (process.env.DATA_DIR) {
  const usageFile = path.join(process.env.DATA_DIR, 'usage.jsonl');
  const lines = fs.existsSync(usageFile)
    ? fs.readFileSync(usageFile, 'utf8').split('\n').filter((l) => l.trim())
    : [];
  let last = null;
  try { last = JSON.parse(lines[lines.length - 1]); } catch { /* ignore */ }
  check('usage.jsonl 能直接读且是 v1', Boolean(last) && last.v === 1 && ISO_UTC.test(last.at));
  check('usage 记录带金额', Boolean(last) && typeof last.costYuan === 'number' && last.costYuan > 0);
}

// 5) 幂等：连点两次只产生一条（验收第 3 条）
const dupId = crypto.randomUUID();
const before = (await historyOf()).messages.length;
const [a, b] = await Promise.all([chat('重复提交测试', dupId), chat('重复提交测试', dupId)]);
check('两次重复请求都 200', a.status === 200 && b.status === 200, `${a.status}/${b.status}`);
const doneA = (await readStream(a)).find((e) => e.event === 'done');
const doneB = (await readStream(b)).find((e) => e.event === 'done');
check(
  '两次回放同一组分条',
  Boolean(doneA && doneB) && JSON.stringify(doneA.data.ids) === JSON.stringify(doneB.data.ids),
);

const afterDup = (await historyOf()).messages;
const dupReplies = afterDup.filter((m) => m.replyTo === dupId);
check('历史只多了一问一答（含分条）', afterDup.length === before + 1 + dupReplies.length, `${before} -> ${afterDup.length}`);
check('同一 id 的用户消息只有一条', afterDup.filter((m) => m.id === dupId).length === 1);
check('分条数 = done.count', Boolean(doneA) && dupReplies.length === doneA.data.count, `${dupReplies.length}`);

const again = await chat('重复提交测试', dupId);
const againDone = (await readStream(again)).find((e) => e.event === 'done');
check(
  '完成后再重发仍是回放',
  again.status === 200 && JSON.stringify(againDone?.data.ids) === JSON.stringify(doneA?.data.ids),
);
check('重发没有新增消息', (await historyOf()).messages.length === afterDup.length);

const noId = await fetch(`${BASE}/api/chat`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ text: '没有 id 的消息' }),
});
check('缺 id 会被拒绝', noId.status === 400, `status=${noId.status}`);

// 6) 断线续传：中途掐断 POST，用 lastEventId 把剩下的补回来（验收第 4 条）
const rid = crypto.randomUUID();
const live = await chat('断线测试', rid);
let lastId = 0;
let partial = '';
const seenIds = new Set();
const opened = await readStream(live, {
  stop: (frames) => frames.filter((f) => f.event === 'message').length >= 2,
  onFrame: (f) => {
    if (f.id) lastId = Math.max(lastId, f.id);
    if (f.event === 'message') {
      partial += f.data.text;
      seenIds.add(f.data.id);
    }
  },
});
check('掐断前收到了至少一条完整分条', opened.length > 0 && partial.length > 0, `${partial.length} 字`);

await sleep(1500); // 服务端在“断网”期间应把回复生成完并落盘

const resumedRes = await fetch(
  `${BASE}/api/events?lastEventId=${lastId}&boot=${encodeURIComponent(health.boot)}`,
);
const resumed = await readStream(resumedRes, {
  stop: (frames) => frames.some((f) => f.event === 'done' && f.data.jobId === rid),
});
const resumedParts = resumed
  .filter((f) => f.event === 'message' && f.data.jobId === rid)
  .map((f) => f.data);
const resumedDone = resumed.find((f) => f.event === 'done' && f.data.jobId === rid);

const histRid = (await historyOf()).messages.filter((m) => m.id === rid || m.replyTo === rid);
const finalParts = histRid
  .filter((m) => m.role === 'assistant')
  .sort((x, y) => x.seq - y.seq)
  .map((m) => m.text)
  .join('');

check('续传收到了 done', Boolean(resumedDone));
check(
  '续传没有重复/缺口',
  Boolean(resumedDone) && partial + resumedParts.map((p) => p.text).join('') === finalParts,
);
check(
  '续传没有重复消息 id',
  new Set([...seenIds, ...resumedParts.map((p) => p.id)]).size === seenIds.size + resumedParts.length,
);
check('断线那轮一问一答都已落盘', histRid.length === 1 + histRid.filter((m) => m.role === 'assistant').length, `n=${histRid.length}`);
check('断线没有产生重复消息', histRid.filter((m) => m.role === 'user').length === 1);

// 7) 服务重启 / 缓冲丢失 → resync 快照
const resyncRes = await fetch(`${BASE}/api/events?lastEventId=1&boot=definitely-not-the-boot`);
const resyncFrames = await readStream(resyncRes, {
  stop: (frames) => frames.some((f) => f.event === 'resync'),
});
const resync = resyncFrames.find((f) => f.event === 'resync');
check('对不上 boot 时给快照', Boolean(resync) && Array.isArray(resync.data.messages));
check('快照里带着最近的消息', Boolean(resync) && resync.data.messages.length >= 2);
check('快照带 eventSeq', Boolean(resync) && Number.isInteger(resync.data.eventSeq));

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
