// v44 推送接口回归：生成公钥、订阅去重/开关、私钥不回传。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', '.tmp-push-api');
const PORT = 8953;
const BASE = `http://127.0.0.1:${PORT}`;
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', MOCK_MODEL: '1', TYPING_FIRST_MS: '0' },
  stdio: 'ignore',
});
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* wait */ }
  await sleep(150);
}
const vapid = await (await fetch(`${BASE}/api/push/vapid`, { method: 'POST' })).json();
check('生成 VAPID 公钥', Boolean(vapid.publicKey) && !JSON.stringify(vapid).includes('vapidPrivateKey'));
const pub = await (await fetch(`${BASE}/api/push/vapid-public-key`)).json();
check('读取 VAPID 公钥', pub.publicKey === vapid.publicKey);
const receiver = crypto.createECDH('prime256v1');
receiver.generateKeys();
const endpoint = 'https://web.push.apple.com/fake-endpoint';
const sub = { endpoint, keys: { p256dh: receiver.getPublicKey(null, 'uncompressed').toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } };
await fetch(`${BASE}/api/push/subscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
await fetch(`${BASE}/api/push/subscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
const status = await (await fetch(`${BASE}/api/push/status`)).json();
check('订阅去重且默认开启', status.configured === true && status.enabled === true && status.subscriptions === 1, JSON.stringify(status));
const secret = JSON.parse(fs.readFileSync(path.join(DATA, 'secret.json'), 'utf8'));
check('私钥只落 secret', Boolean(secret.vapidPrivateKey) && !JSON.stringify(status).includes('vapidPrivateKey'));
await fetch(`${BASE}/api/push/unsubscribe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint }) });
const after = await (await fetch(`${BASE}/api/push/status`)).json();
check('取消订阅后关闭', after.enabled === false && after.subscriptions === 0, JSON.stringify(after));
const weather = await (await fetch(`${BASE}/api/weather/status`)).json();
check('无城市天气为空', weather.configured === false && weather.city === '');
child.kill();
await new Promise((resolve) => child.once('exit', resolve));
fs.rmSync(DATA, { recursive: true, force: true });

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
