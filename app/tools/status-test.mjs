// v40 验收：/api/status 三版本号、脱敏字段、预算/表情计数。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PRODUCT_VERSION } from '../lib/version.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8943;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = path.join(os.tmpdir(), `companion-status-${Date.now()}`);
fs.mkdirSync(DATA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: Boolean(ok), detail });

const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: { ...process.env, DATA_DIR: DATA, PORT: String(PORT), HOST: '127.0.0.1', MOCK_MODEL: '1', TYPING_FIRST_MS: '0', DAILY_BUDGET_YUAN: '' },
  stdio: 'ignore',
});
for (let i = 0; i < 40; i++) {
  try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch { /* wait */ }
  await sleep(150);
}
const statusResponse = await fetch(`${BASE}/api/status`);
const status = await statusResponse.json();
const swSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8');
const expectedSw = swSource.match(/const VERSION = ['"]([^'"]+)['"]/u)?.[1];
check('status 200', statusResponse.status === 200);
check('产品版本正确', status.productVersion === PRODUCT_VERSION, status.productVersion);
check('SW 版本与 sw.js 一致', status.swVersion === expectedSw, `${status.swVersion} / ${expectedSw}`);
check('schema 版本正确', status.schemaVersion === 1);
check('模型与主机存在', typeof status.model === 'string' && typeof status.baseUrlHost === 'string');
check('baseUrl 只给 host', !String(status.baseUrlHost).includes('/') && !String(status.baseUrlHost).includes('http'));
check('不含 API key', !Object.hasOwn(status, 'apiKey') && !JSON.stringify(status).includes('sk-'));
check('预算字段存在', Number.isFinite(status.budget?.spentYuan) && Number.isFinite(status.budget?.limitYuan));
check('默认预算 ¥2', status.budget?.limitYuan === 2, status.budget?.limitYuan);
check('运行时长/启动时间存在', Number.isFinite(status.uptimeSeconds) && typeof status.startedAt === 'string');
check('表情计数存在', Number.isFinite(status.memes?.total) && Number.isFinite(status.memes?.catalog));
const breakdownResponse = await fetch(`${BASE}/api/usage/breakdown`);
const breakdown = await breakdownResponse.json();
check('breakdown 接口可读', breakdownResponse.ok && breakdown.latest === null && breakdown.today?.breakdown?.total === 0);
server.kill();
await new Promise((r) => server.once('exit', r));
fs.rmSync(DATA, { recursive: true, force: true });

let failed = 0;
for (const c of checks) {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
  if (!c.ok) failed++;
}
console.log(`\n${checks.length - failed}/${checks.length} 通过`);
process.exit(failed ? 1 : 0);
