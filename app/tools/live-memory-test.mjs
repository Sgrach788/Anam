// REAL API TEST — incurs a small model charge. Run only with --confirm-cost.
// It copies the current usage ledger into a temporary data directory so the
// normal daily budget guard still applies, and removes all temporary data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

if (!process.argv.includes('--confirm-cost')) {
  console.error('This test calls the live model and may incur a small charge. Add --confirm-cost to run it.');
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dataSource = path.join(root, 'app', 'data');
const secretPath = path.join(dataSource, 'secret.json');
const sourceUsagePath = path.join(dataSource, 'usage.jsonl');
let saved = {};
try { saved = JSON.parse(fs.readFileSync(secretPath, 'utf8').replace(/^\uFEFF/, '')); } catch { /* no local key */ }
const apiKey = process.env.DEEPSEEK_API_KEY || saved.apiKey || '';
if (!apiKey) {
  console.log('SKIP  no DeepSeek API key is configured');
  process.exit(0);
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anam-live-memory-'));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const appPortProbe = http.createServer();
await new Promise((resolve) => appPortProbe.listen(0, '127.0.0.1', resolve));
const port = appPortProbe.address().port;
await new Promise((resolve) => appPortProbe.close(resolve));

const history = [];
for (let seq = 1; seq <= 81; seq++) {
  history.push({
    v: 1, seq, id: `seed_${String(seq).padStart(8, '0')}`,
    role: seq % 2 ? 'user' : 'assistant',
    text: seq === 1 ? '我养了一只猫，叫豆豆。' : `隔离测试历史 ${seq}`,
    at: new Date(Date.UTC(2026, 9, 29, 12, 0, seq - 1)).toISOString(),
    type: 'text', media: null,
  });
}
fs.writeFileSync(path.join(dataDir, 'messages.jsonl'), history.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
if (fs.existsSync(sourceUsagePath)) fs.copyFileSync(sourceUsagePath, path.join(dataDir, 'usage.jsonl'));
else fs.writeFileSync(path.join(dataDir, 'usage.jsonl'), '', 'utf8');
fs.writeFileSync(path.join(dataDir, 'secret.json'), JSON.stringify({
  apiKey,
  baseUrl: process.env.DEEPSEEK_BASE || saved.baseUrl || 'https://api.deepseek.com',
  model: process.env.MODEL || saved.model || 'deepseek-flash',
}), 'utf8');

const child = spawn(process.execPath, [path.join(root, 'app', 'server.mjs')], {
  env: {
    ...process.env,
    DATA_DIR: dataDir,
    HOST: '127.0.0.1',
    PORT: String(port),
    MOCK_MODEL: '0',
    DEEPSEEK_API_KEY: '',
    DEEPSEEK_BASE: '',
    MODEL: '',
    TYPING_FIRST_MS: '0',
  },
  stdio: 'ignore',
});
const base = `http://127.0.0.1:${port}`;
const requestId = `live_mem_${crypto.randomUUID().replaceAll('-', '')}`;

try {
  let ready = false;
  for (let i = 0; i < 80 && !ready; i++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* wait for listen */ }
    if (!ready) await wait(100);
  }
  assert.ok(ready, 'isolated test server should start');
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.mode, 'live');
  assert.equal(health.memoryFacts, 1, 'the old fact should be backfilled');

  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: requestId, text: '我以前告诉过你我的猫叫什么？请简短回答；没有依据就说不确定。' }),
  });
  if (response.status === 402) {
    console.log('SKIP  daily app budget is already exhausted; no model request was sent');
    process.exitCode = 0;
  } else {
    assert.equal(response.status, 200, `model request failed with HTTP ${response.status}`);
    const raw = await response.text();
    const parts = [];
    for (const block of raw.split('\n\n')) {
      let event = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (event === 'message' && line.startsWith('data:')) {
          try { parts.push(JSON.parse(line.slice(5).trim()).text || ''); } catch { /* ignore non-JSON */ }
        }
      }
    }
    const answer = parts.join('');
    const ledger = fs.readFileSync(path.join(dataDir, 'usage.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
    const entry = ledger.find((row) => row.userMsgId === requestId);
    assert.ok(entry, 'the live request must be recorded in usage.jsonl');
    const sourceRows = fs.existsSync(sourceUsagePath)
      ? fs.readFileSync(sourceUsagePath, 'utf8').split('\n').filter(Boolean)
      : [];
    const alreadyRecorded = sourceRows.some((line) => {
      try { return JSON.parse(line).userMsgId === requestId; } catch { return false; }
    });
    if (!alreadyRecorded) fs.appendFileSync(sourceUsagePath, JSON.stringify({ ...entry, kind: 'live_memory_test' }) + '\n', 'utf8');
    assert.match(answer, /豆豆/u, 'live model should recall the fact outside L1');
    console.log(`PASS  live model recalled the old fact: ${answer.slice(0, 100)}`);
    console.log(`PASS  live usage was added to app/data/usage.jsonl (¥${Number(entry.costYuan).toFixed(6)}; ${entry.estimated ? 'estimated' : 'provider usage'})`);
  }
} finally {
  child.kill();
  await wait(150);
  fs.rmSync(dataDir, { recursive: true, force: true });
}
