// V2 Phase 2A 表情发送回归：目录快照、mock 触发、无效 id 剥除、频率门、文字先后顺序、总开关。
// 用法：node app/tools/meme-chat-test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { memePromptBlock } from '../lib/memes.mjs';
import { STICKER_BAN } from '../lib/prompt.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8934;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(os.tmpdir(), `companion-meme-chat-${Date.now()}`);
fs.mkdirSync(DATA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

function start(extra = {}) {
  return spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
    env: {
      ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1',
      MOCK_MODEL: '', DEEPSEEK_API_KEY: '', DEEPSEEK_BASE: '', MODEL: '', TYPING_FIRST_MS: '0',
      ...extra,
    },
    stdio: 'ignore',
  });
}

async function stop(server) {
  server.kill();
  await new Promise((resolve) => server.once('exit', resolve));
}

async function up() {
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return true; } catch { /* wait */ }
    await sleep(120);
  }
  return false;
}

let uploadSeq = 0;
async function upload(label) {
  uploadSeq++;
  const data = Buffer.concat([PNG, Buffer.from([uploadSeq])]);
  const r = await fetch(`${BASE}/api/memes`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dataUrl: `data:image/png;base64,${data.toString('base64')}`, label, tags: [] }),
  });
  return r.json();
}

async function chat(id, text) {
  const r = await fetch(`${BASE}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, text }),
  });
  return { status: r.status, body: await r.text() };
}

async function allMessages() {
  return (await (await fetch(`${BASE}/api/messages?limit=100`)).json()).messages;
}

function stickers(messages) {
  return messages.filter((m) => m.role === 'assistant' && m.type === 'sticker');
}

let server = start();
if (!(await up())) { console.log('FAIL  服务未起来'); process.exit(1); }

const a = await upload('开心');
const b = await upload('安慰');
const c = await upload('晚安');
for (const meme of [a.meme, b.meme, c.meme]) {
  await fetch(`${BASE}/api/memes/${meme.id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reviewed: true, enabled: true }),
  });
}
const list = await (await fetch(`${BASE}/api/memes`)).json();
check('目录有 3 张合格表情', list.counts.qualified === 3 && list.counts.catalog === 3, JSON.stringify(list.counts));

const promptBlock = memePromptBlock(list.memes);
check('目录 prompt 含 id/label', promptBlock.includes(a.meme.id) && promptBlock.includes('开心') && promptBlock.includes('meme'));
check('正文禁令在稳定前缀', STICKER_BAN.includes('正文禁止书写 [表情]'));
const softBlock = memePromptBlock(list.memes, { softFrequency: true });
check('软频率提示包含确认文案', softBlock.includes('每约 4 条')
  && softBlock.includes('用户明确要求时不受软频率参考约束')
  && softBlock.includes('不要向用户解释频率判断'));
check('空目录 prompt 为零', memePromptBlock([]) === '');

const first = await chat('meme-chat-1', '今天有点累，发个表情');
check('触发第一次表情', first.status === 200, `status=${first.status}`);
let msgs = await allMessages();
let firstStickers = stickers(msgs);
check('第一条 AI 表情已落盘', firstStickers.length === 1, `stickers=${firstStickers.length}`);
const sticker1 = firstStickers[0];
check('表情引用正确', sticker1?.media?.ref === `meme:${a.meme.id}` && sticker1?.media?.alt === '开心', JSON.stringify(sticker1?.media));
check('sticker 记录不再保存 text 字段', sticker1 && !Object.prototype.hasOwnProperty.call(sticker1, 'text'), JSON.stringify(sticker1));
check('文字在表情之前', msgs.some((m) => m.seq === sticker1.seq - 1 && m.role === 'assistant' && m.type === 'text'));

const seqAfterFirst = msgs.at(-1).seq;
await chat('meme-chat-2', '再来一个，发个表情');
msgs = await allMessages();
check('频率门挡掉连续第二张', stickers(msgs).length === 1 && msgs.at(-1).seq > seqAfterFirst);
const textAfterSecond = msgs.filter((m) => m.seq > seqAfterFirst && m.role === 'assistant' && m.type === 'text').length;
check('第二回合文字仍保留', textAfterSecond >= 1);

await chat('meme-chat-3', '今天天气不错');
await chat('meme-chat-4', '晚上准备早点睡');
const seqBeforeThird = (await allMessages()).at(-1).seq;
await chat('meme-chat-5', '晚安，发个表情');
msgs = await allMessages();
check('隔两条文字后可再发', stickers(msgs).length === 2 && msgs.at(-1).seq > seqBeforeThird);

const beforeOff = stickers(msgs).length;
await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: false }),
});
await chat('meme-chat-6', '发个表情');
msgs = await allMessages();
check('总开关关闭后不再发', stickers(msgs).length === beforeOff);
await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }),
});

const beforeP0 = stickers(await allMessages()).length;
await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ probability: 0 }),
});
await chat('meme-chat-p0', '发个表情');
msgs = await allMessages();
check('概率 0% 不注入/不发表情', stickers(msgs).length === beforeP0);
await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ probability: 100 }),
});
const invalidSettings = await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ probability: 101 }),
});
check('概率越界被拒', invalidSettings.status === 400);

await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minGapReplies: 0 }),
});
const beforeGap0 = stickers(await allMessages()).length;
await chat('meme-chat-gap0-1', '发个表情');
await chat('meme-chat-gap0-2', '再发个表情');
msgs = await allMessages();
check('间隔 0 允许连续表情', stickers(msgs).length === beforeGap0 + 2);
await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minGapReplies: 2 }),
});

await stop(server);

// 无效 id：独立实例，mock 固定返回不存在的 id
const INVALID_DATA = path.join(os.tmpdir(), `companion-meme-invalid-${Date.now()}`);
fs.mkdirSync(INVALID_DATA, { recursive: true });
const invalid = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: {
    ...process.env, DATA_DIR: INVALID_DATA, PORT: String(PORT), HOST: '127.0.0.1',
    MOCK_MODEL: '', DEEPSEEK_API_KEY: '', TYPING_FIRST_MS: '0', MOCK_MEME_ID: 'not_a_real_id',
  },
  stdio: 'ignore',
});
if (!(await up())) { console.log('FAIL  无效 id 实例未起来'); process.exit(1); }
const invalidMeme = await (await fetch(`${BASE}/api/memes`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ dataUrl: `data:image/png;base64,${PNG.toString('base64')}`, label: '测试', tags: [] }),
})).json();
await fetch(`${BASE}/api/memes/${invalidMeme.meme.id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewed: true }),
});
await chat('meme-chat-bad', '发个表情');
const badMessages = await allMessages();
check('无效 id 被剥除', stickers(badMessages).length === 0);
check('无效 id 时文字完好', badMessages.some((m) => m.role === 'assistant' && m.type === 'text' && !m.text.includes('<anam-meta>')));
await stop(invalid);
fs.rmSync(INVALID_DATA, { recursive: true, force: true });

// 文字为空但表情有效：独立实例，mock 只返回 meta
const ONLY_DATA = path.join(os.tmpdir(), `companion-meme-only-${Date.now()}`);
fs.mkdirSync(ONLY_DATA, { recursive: true });
const only = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: {
    ...process.env, DATA_DIR: ONLY_DATA, PORT: String(PORT), HOST: '127.0.0.1',
    MOCK_MODEL: '', DEEPSEEK_API_KEY: '', TYPING_FIRST_MS: '0', MOCK_MEME_ONLY: '1',
  },
  stdio: 'ignore',
});
if (!(await up())) { console.log('FAIL  只发表情实例未起来'); process.exit(1); }
const onlyMeme = await upload('只发表情');
await fetch(`${BASE}/api/memes/${onlyMeme.meme.id}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reviewed: true }),
});
await chat('meme-chat-only', '发个表情');
const onlyMessages = await allMessages();
check('文字为空时只发表情', stickers(onlyMessages).length === 1
  && onlyMessages.filter((m) => m.role === 'assistant' && m.type === 'text').length === 0);
await stop(only);
fs.rmSync(ONLY_DATA, { recursive: true, force: true });

fs.rmSync(DATA, { recursive: true, force: true });

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
