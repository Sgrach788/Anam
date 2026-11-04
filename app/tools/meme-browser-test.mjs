// V2 Phase 1 浏览器测试：客户端 2000px 静态图缩到 768、透明通道保留；GIF 原样。
// 用法：node app/tools/meme-browser-test.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8932;
const EXTERNAL_DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 0);
const DEBUG_PORT = EXTERNAL_DEBUG_PORT || 9233;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.join(__dirname, '..', '..', '.tmp-meme-browser');
const DATA = path.join(ROOT, `data-${Date.now()}`);
const PROFILE = path.join(ROOT, `profile-${Date.now()}`);
fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(DATA, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(chromePath)) {
  console.log(`FAIL  找不到 Chrome：${chromePath}`);
  process.exit(1);
}

const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', MOCK_MODEL: '', DEEPSEEK_API_KEY: '' },
  stdio: 'ignore',
});

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* retry */ }
    await sleep(150);
  }
  return false;
}

let chrome;
try {
  if (!(await waitFor(`${BASE}/api/health`))) throw new Error('app server did not start');
  if (EXTERNAL_DEBUG_PORT) {
    if (!(await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/list`))) {
      throw new Error(`外部 Chrome 调试端口 ${DEBUG_PORT} 不可达`);
    }
  } else {
    chrome = spawn(chromePath, [
      '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${PROFILE}`,
      '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-crash-reporter', 'about:blank',
    ], { stdio: 'ignore' });
    if (!(await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/list`))) throw new Error('chrome debug port did not start');
  }

  const targets = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: BASE });
  await sleep(1500);

  const expression = `(async () => {
    const mod = await import('/meme-image.js');
    const canvas = document.createElement('canvas');
    canvas.width = 2000; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 2000, 1000);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 2000, 1000);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'big.png', { type: 'image/png' });
    const out = await mod.prepareMemeImage(file);
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = out.dataUrl; });
    const check = document.createElement('canvas');
    check.width = image.width; check.height = image.height;
    const checkCtx = check.getContext('2d');
    checkCtx.drawImage(image, 0, 0);
    const alpha = checkCtx.getImageData(0, 0, 1, 1).data[3];
    const gifBytes = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='), (c) => c.charCodeAt(0));
    const gif = await mod.prepareMemeImage(new File([gifBytes], 'x.gif', { type: 'image/gif' }));
    return JSON.stringify({ w: out.w, h: out.h, mime: out.mime, alpha, previewW: out.previewW, previewH: out.previewH, previewPrefix: out.previewDataUrl.slice(0, 22), gifMime: gif.mime, gifW: gif.w, gifH: gif.h });
  })()`;
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  const value = result.result?.result?.value;
  if (!value) throw new Error(result.result?.exceptionDetails?.exception?.description || 'no browser result');
  const data = JSON.parse(value);
  const checks = [
    ['2000px 长边缩到 768', data.w === 768 && data.h === 384],
    ['同时生成 240px 预览', data.previewW === 240 && data.previewH === 120 && data.previewPrefix.startsWith('data:image/png')],
    ['透明通道保留', data.mime === 'image/png' && data.alpha > 0 && data.alpha < 255],
    ['GIF 原样不缩放', data.gifMime === 'image/gif' && data.gifW === 1 && data.gifH === 1],
  ];
  let failed = 0;
  for (const [name, ok] of checks) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) failed++;
  }
  console.log(`\n${checks.length - failed}/${checks.length} 通过`);
  ws.close();
  process.exitCode = failed ? 1 : 0;
} catch (err) {
  console.log(`FAIL  浏览器测试无法完成：${err.message}`);
  process.exitCode = 1;
} finally {
  try { chrome?.kill(); } catch { /* ignore */ }
  try { server.kill(); } catch { /* ignore */ }
  await sleep(500);
  try { fs.rmSync(DATA, { recursive: true, force: true }); } catch { /* ignore */ }
  try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}
