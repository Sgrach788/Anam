// D1/D2 服务端回归：schema 迁移（type/media、replyTo 保留）、profile 读写、试说三句。
// 用法：node app/tools/profile-test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8908;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(os.tmpdir(), `companion-profile-${Date.now()}`);
fs.mkdirSync(DATA, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

// 旧格式：没有 type/media，助手消息带 replyTo
const u1 = crypto.randomUUID();
const a1 = crypto.randomUUID();
const oldLines = [
  { v: 1, seq: 1, id: u1, role: 'user', text: '旧消息', at: '2026-10-30T10:00:00.000Z' },
  { v: 1, seq: 2, id: a1, role: 'assistant', text: '旧回复', at: '2026-10-30T10:01:00.000Z', replyTo: u1, mode: 'mock' },
];
fs.writeFileSync(path.join(DATA, 'messages.jsonl'), oldLines.map((x) => JSON.stringify(x)).join('\n') + '\n', 'utf8');

function start() {
  return spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
    env: { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', MOCK_MODEL: '', DEEPSEEK_API_KEY: '', DEEPSEEK_BASE: '', MODEL: '' },
    stdio: 'ignore',
  });
}

async function waitUp() {
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
const up = await waitUp();

const [indexResponse, cssResponse, uiResponse] = await Promise.all([
  fetch(`${BASE}/`), fetch(`${BASE}/style.css`), fetch(`${BASE}/ui.js`),
]);
check('首页下发 SW 更新后自动刷新脚本', (await indexResponse.text()).includes("addEventListener('controllerchange'"));
check('CSS 与脚本要求重新校验缓存', [cssResponse, uiResponse].every((r) => /no-cache/u.test(r.headers.get('cache-control') || '')));
const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
check('首页导航是四栏而非旧胶囊', /grid-template-columns:\s*repeat\(4,\s*1fr\)/u.test(cssSource) && /#tabs\s*\{[^}]*border-radius:\s*0/u.test(cssSource));
check('对话行使用统一横向排版', /\.conversation-card\s*\{[^}]*display:\s*flex/u.test(cssSource));
check('隐藏全屏面板的规则优先于 mobile-page 显示规则', cssSource.lastIndexOf('#consolePanel[hidden], #personaPanel[hidden]') > cssSource.lastIndexOf('#consolePanel.mobile-page') && /#consolePanel\[hidden\], #personaPanel\[hidden\]\s*\{\s*display:\s*none\s*!important/u.test(cssSource));
check('聊天输入栏有明确的可见布局规则', /\.chat-page #composer\s*\{\s*display:\s*flex;\s*flex:0 0 auto/u.test(cssSource));

// 1) 迁移
const msgs = (await (await fetch(`${BASE}/api/messages?limit=50`)).json()).messages;
check('旧数据可读取', msgs.length === 2, `n=${msgs.length}`);
check('补齐 type=text', msgs.every((m) => m.type === 'text'));
check('补齐 media=null', msgs.every((m) => m.media === null));
check('replyTo 没有丢', msgs.find((m) => m.role === 'assistant')?.replyTo === u1);
check('mode 没有丢', msgs.find((m) => m.role === 'assistant')?.mode === 'mock');
check('旧消息补充 anam 身份', msgs.every((m) => m.assistantId === 'anam'));
check('迁移保留 id 与 seq', msgs[0].id === u1 && msgs[0].seq === 1 && msgs[1].id === a1 && msgs[1].seq === 2);

const disk = fs.readFileSync(path.join(DATA, 'messages.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
check('迁移写回了文件', disk.every((m) => m.type === 'text' && m.media === null && m.assistantId === 'anam'));
check('迁移前有备份', fs.existsSync(path.join(DATA, 'messages.jsonl.pre-assistant-id.bak')));

// 2) profile 默认值
const p0 = await (await fetch(`${BASE}/api/profile`)).json();
check('profile 有默认字段', ['name', 'callUser', 'tone', 'initiative', 'boundaries', 'persona'].every((k) => typeof p0.profile[k] === 'string'));

// 3) 保存（名称 / 称呼 / 头像）
const save = await fetch(`${BASE}/api/profile`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    profile: {
      name: '小夜',
      callUser: '阿哲',
      tone: '温柔，少用感叹号',
      avatar: 'data:image/jpeg;base64,AAAA',
    },
  }),
});
check('保存 profile 返回 200', save.status === 200, `status=${save.status}`);
const p1 = await (await fetch(`${BASE}/api/profile`)).json();
check('profile 已持久化', p1.profile.name === '小夜' && p1.profile.callUser === '阿哲' && p1.profile.tone === '温柔，少用感叹号');
check('头像已保存', String(p1.profile.avatar).startsWith('data:image/'), String(p1.profile.avatar).slice(0, 20));
const cfg = JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8'));
check('config.json 结构正确', cfg.v === 1 && cfg.profile.name === '小夜' && cfg.profile.callUser === '阿哲');

const userSave = await fetch(`${BASE}/api/user-profile`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profile: { name: '本机昵称', avatar: 'data:image/jpeg;base64,BBBB' } }) });
check('本机资料独立保存', userSave.status === 200);
const userProfile = await (await fetch(`${BASE}/api/user-profile`)).json();
check('本机资料持久化且不覆盖 AI 资料', userProfile.profile.name === '本机昵称' && (await (await fetch(`${BASE}/api/profile`)).json()).profile.name === '小夜');

// 3b) 非法头像被丢弃，合法字段不受影响
const bad = await fetch(`${BASE}/api/profile`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ profile: { avatar: 'javascript:alert(1)' } }),
});
const p2 = await bad.json();
check('非法头像被拒绝', p2.profile.avatar === '', String(p2.profile.avatar).slice(0, 20));
check('拒绝头像不影响其他字段', p2.profile.name === '小夜' && p2.profile.callUser === '阿哲');

// 4) 试说三句（mock）
const pv = await fetch(`${BASE}/api/profile/preview`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ profile: { tone: '极简' } }),
});
const pvBody = await pv.json();
check('试说三句返回 200', pv.status === 200, `status=${pv.status}`);
check('试说三句返回 3 条', Array.isArray(pvBody.lines) && pvBody.lines.length === 3, `n=${pvBody.lines?.length}`);

// 5) 重启后 replyTo 仍在（迁移 + 归一化）
server.kill();
await sleep(600);
server = start();
const up2 = await waitUp();
const msgs2 = (await (await fetch(`${BASE}/api/messages?limit=50`)).json()).messages;
check('重启后历史仍在', up2 && msgs2.length === 2, `n=${msgs2.length}`);
check('重启后 replyTo 仍在', msgs2.find((m) => m.role === 'assistant')?.replyTo === u1);
check('重启后 AI 身份仍在', msgs2.every((m) => m.assistantId === 'anam'));
const userProfileAfterRestart = await (await fetch(`${BASE}/api/user-profile`)).json();
check('重启后本机资料仍与 AI 资料独立', userProfileAfterRestart.profile.name === '本机昵称' && (await (await fetch(`${BASE}/api/profile`)).json()).profile.name === '小夜');

server.kill();
try { fs.rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过${up && up2 ? '' : '（服务未起来）'}`);
process.exit(failed || !up || !up2 ? 1 : 0);
