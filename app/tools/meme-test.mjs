// V2 Phase 1 表情包库回归：上传校验、尺寸/判重、审核、目录计数、取图、删除引用、备份恢复。
// 用法：node app/tools/meme-test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { selectCatalog, verifyMemeBackup } from '../lib/memes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8931;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(os.tmpdir(), `companion-meme-${Date.now()}`);
const BACKUP = path.join(os.tmpdir(), `companion-meme-backup-${Date.now()}`);
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(BACKUP, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

function start() {
  return spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
    env: {
      ...process.env, DATA_DIR: DATA, BACKUP_DIR: BACKUP, PORT: String(PORT), HOST: '127.0.0.1',
      MOCK_MODEL: '', DEEPSEEK_API_KEY: '', DEEPSEEK_BASE: '', MODEL: '',
    },
    stdio: 'ignore',
  });
}

async function stop(server) {
  server.kill();
  await new Promise((resolve) => server.once('exit', resolve));
}

async function up() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch { /* 还没起来 */ }
    await sleep(150);
  }
  return false;
}

let server = start();
if (!(await up())) {
  console.log('FAIL  服务未起来');
  process.exit(1);
}

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const GIF_1X1 = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64');

function craftedPng(w, h, extra = 0) {
  const buffer = Buffer.alloc(33 + extra);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(w, 16);
  buffer.writeUInt32BE(h, 20);
  return buffer;
}

async function upload(buffer, mime = 'image/png', label = '') {
  const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
  const r = await fetch(`${BASE}/api/memes`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dataUrl, label, tags: [] }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// A 上传与数据
const bad = await upload(Buffer.from('not an image'), 'image/png');
check('伪造格式被拒', bad.status === 400);
const big = await upload(craftedPng(2000, 1000));
check('静态图 >768 被拒', big.status === 400);
const tooBig = await upload(craftedPng(1, 1, 2 * 1024 * 1024));
check('>1.5MB 被拒', tooBig.status === 413, `status=${tooBig.status}`);
const ok1x1 = await upload(PNG_1X1, 'image/png', '');
check('合法 PNG 上传', ok1x1.status === 201, JSON.stringify(ok1x1.body).slice(0, 120));
const duplicate = await upload(PNG_1X1, 'image/png');
check('重复图判重', duplicate.status === 200 && duplicate.body.duplicate === true && duplicate.body.meme.id === ok1x1.body.meme.id);
const gif = await upload(GIF_1X1, 'image/gif');
check('GIF 原图上传', gif.status === 201 && gif.body.meme.w === 1 && gif.body.meme.h === 1);
const static768 = await upload(craftedPng(768, 384));
check('768 静态图通过', static768.status === 201 && static768.body.meme.w === 768);

const firstId = ok1x1.body.meme.id;
const emptyReview = await fetch(`${BASE}/api/memes/${firstId}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ reviewed: true }),
});
check('label 为空不能审核', emptyReview.status === 400);
const reviewed = await fetch(`${BASE}/api/memes/${firstId}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ label: '开心', tags: ['开心', '日常'], reviewed: true, pinned: true }),
});
const reviewedBody = await reviewed.json();
check('填名称后可审核', reviewed.status === 200 && reviewedBody.meme.reviewed === true && reviewedBody.meme.label === '开心');

const settingsOff = await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: false }),
});
const settingsOffBody = await settingsOff.json();
check('总开关可关闭', settingsOff.status === 200 && settingsOffBody.enabled === false);
check('列表反映总开关', (await (await fetch(`${BASE}/api/memes`)).json()).enabled === false);
await fetch(`${BASE}/api/memes/settings`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled: true }),
});

// 100 张上限 + 31 张目录
const beforeBatch = await (await fetch(`${BASE}/api/memes`)).json();
for (let i = beforeBatch.counts.total; i < 100; i++) {
  const result = await upload(craftedPng(1, 1, i + 1));
  if (result.status !== 201) { check(`批量上传第 ${i + 1} 张`, false, `status=${result.status}`); break; }
}
const listAfter100 = await (await fetch(`${BASE}/api/memes`)).json();
check('全库上限 100', listAfter100.counts.total === 100, `total=${listAfter100.counts.total}`);
const overLimit = await upload(craftedPng(1, 1, 999));
check('超过 100 张被拒', overLimit.status === 409);

const candidates = listAfter100.memes.filter((meme) => meme.id !== firstId).slice(0, 30);
for (const [index, meme] of candidates.entries()) {
  await fetch(`${BASE}/api/memes/${meme.id}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ label: meme.label || `图${index + 1}`, reviewed: true }),
  });
}
const afterReview = await (await fetch(`${BASE}/api/memes`)).json();
check('目录上限 50 下全部合格项入目录', afterReview.counts.catalog === 31, JSON.stringify(afterReview.counts));
check('目录未超 50 时等待数为 0', afterReview.counts.waiting === 0, JSON.stringify(afterReview.counts));
const selected = selectCatalog(afterReview.memes).selected;
check('目录顺序稳定（置顶优先）', selected[0]?.pinned === true && selected.length === 31);

const file = await fetch(`${BASE}/api/memes/${firstId}/file`);
check('取图 MIME/缓存/安全头', file.status === 200 && file.headers.get('content-type') === 'image/png'
  && /immutable/u.test(file.headers.get('cache-control') || '') && file.headers.get('x-content-type-options') === 'nosniff');

const previewSave = await fetch(`${BASE}/api/memes/${firstId}/preview`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ dataUrl: `data:image/png;base64,${PNG_1X1.toString('base64')}` }),
});
const previewSaveBody = await previewSave.json();
check('派生预览可保存', previewSave.status === 200 && previewSaveBody.meme?.hasPreview === true);
const previewGet = await fetch(`${BASE}/api/memes/${firstId}/preview`);
check('派生预览可读取', previewGet.status === 200 && previewGet.headers.get('content-type') === 'image/png'
  && /immutable/u.test(previewGet.headers.get('cache-control') || ''));

// 种子：一条 sticker 历史消息引用第一张
await stop(server);
fs.appendFileSync(path.join(DATA, 'messages.jsonl'), JSON.stringify({
  v: 1, seq: 1, id: 'sticker-msg-1', role: 'assistant', text: '[表情] 开心',
  at: new Date().toISOString(), type: 'sticker',
  media: { ref: `meme:${firstId}`, w: 1, h: 1, alt: '开心' },
}) + '\n', 'utf8');
server = start();
if (!(await up())) { console.log('FAIL  重启失败'); process.exit(1); }

// C 备份恢复：删除前验证，保证 sticker 引用可达
const today = new Date().toLocaleDateString('sv-SE');
const dayDir = path.join(BACKUP, today);
if (fs.existsSync(path.join(dayDir, '.done'))) fs.rmSync(path.join(dayDir, '.done'));
await stop(server);
server = start();
if (!(await up())) { console.log('FAIL  备份重启失败'); process.exit(1); }
const backup = verifyMemeBackup(dayDir);
check('备份恢复校验全绿', backup.ok === true, JSON.stringify(backup));
const RESTORE = path.join(os.tmpdir(), `companion-meme-restore-${Date.now()}`);
fs.cpSync(dayDir, RESTORE, { recursive: true });
const restored = verifyMemeBackup(RESTORE);
check('备份能恢复到空目录', restored.ok === true, JSON.stringify(restored));
fs.rmSync(RESTORE, { recursive: true, force: true });

const usageBeforeToggle = await (await fetch(`${BASE}/api/memes/${firstId}/usage`)).json();
await fetch(`${BASE}/api/memes/${firstId}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ enabled: false }),
});
check('停用不影响历史引用', (await (await fetch(`${BASE}/api/memes/${firstId}/usage`)).json()).references === usageBeforeToggle.references);
await fetch(`${BASE}/api/memes/${firstId}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ reviewed: false }),
});
check('取消审核不影响历史引用', (await (await fetch(`${BASE}/api/memes/${firstId}/usage`)).json()).references === usageBeforeToggle.references);
await fetch(`${BASE}/api/memes/${firstId}`, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ reviewed: true }),
});

const usage = await (await fetch(`${BASE}/api/memes/${firstId}/usage`)).json();
check('历史引用计数', usage.references === 1, JSON.stringify(usage));
const migratedMessages = (await (await fetch(`${BASE}/api/messages?limit=200`)).json()).messages;
const migratedStickers = migratedMessages.filter((message) => message.type === 'sticker');
check('旧 sticker text 迁移移除', migratedStickers.length === 1 && migratedStickers.every((message) => !('text' in message)), JSON.stringify(migratedStickers[0]));
const noConfirm = await fetch(`${BASE}/api/memes/${firstId}`, { method: 'DELETE' });
const noConfirmBody = await noConfirm.json();
check('删除需要确认', noConfirm.status === 409 && noConfirmBody.references === 1);
const confirm = await fetch(`${BASE}/api/memes/${firstId}?confirm=1`, { method: 'DELETE' });
check('确认后删除', confirm.status === 200);
check('删除后取图 404', (await fetch(`${BASE}/api/memes/${firstId}/file`)).status === 404);

const victim = afterReview.memes.find((meme) => meme.file && meme.id !== firstId);
if (victim) {
  const victimFile = path.join(dayDir, 'memes', victim.file);
  if (fs.existsSync(victimFile)) fs.rmSync(victimFile);
  const broken = verifyMemeBackup(dayDir);
  check('备份缺图能报 id', broken.missing.includes(victim.id), JSON.stringify(broken));
}

const corruptTarget = afterReview.memes.find((meme) => meme.file && meme.id !== firstId && meme.id !== victim?.id);
if (corruptTarget) {
  await stop(server);
  fs.rmSync(path.join(DATA, 'memes', corruptTarget.file), { force: true });
  server = start();
  if (!(await up())) { console.log('FAIL  损坏检测重启失败'); process.exit(1); }
  const list = await (await fetch(`${BASE}/api/memes`)).json();
  const found = list.memes.find((meme) => meme.id === corruptTarget.id);
  check('缺文件标记损坏', found?.corrupted === true);
  check('损坏图取图 404', (await fetch(`${BASE}/api/memes/${corruptTarget.id}/file`)).status === 404);
}

await stop(server);
fs.rmSync(DATA, { recursive: true, force: true });
fs.rmSync(BACKUP, { recursive: true, force: true });

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);

