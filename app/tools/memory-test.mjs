// V0 L2 integration test: backfill a fact outside the recent context window
// and verify that it reaches the model prompt with its original message source.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { extractFacts } from '../lib/memory.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const node = process.execPath;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anam-memory-'));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let captured = null;
let failBalance = false;
let provider;
let app;

const fact = extractFacts('我养了一只猫，叫豆豆。');
assert.equal(fact.length, 1, 'explicit pet statement should create one fact');
assert.equal(fact[0].key, 'pet:猫');
assert.deepEqual(extractFacts('你记得豆豆吗？'), [], 'questions must not become facts');
assert.deepEqual(extractFacts('这件事今天怎么样？'), [], 'unrelated text must not become facts');

try {
  provider = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    if (req.method === 'GET' && req.url === '/user/balance') {
      if (failBalance) {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end('{"error":"temporarily unavailable"}');
      } else {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '12.50', granted_balance: '2.50', topped_up_balance: '10.00' }] }));
      }
      return;
    }
    const request = JSON.parse(body);
    if (request.stream === false) {
      const system = request.messages?.[0]?.content || '';
      res.writeHead(200, { 'content-type': 'application/json' });
      const content = system.includes('长期记忆整理器')
        ? JSON.stringify({ claims: [{ text: '我养了一只猫，叫豆豆。', sourceId: 'seed_00000001', evidence: '我养了一只猫，叫豆豆。' }], importance: 4, topics: ['宠物'], entities: [], relations: [] })
        : 'OK';
      res.end(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 8, completion_tokens: 1 } }));
      return;
    }
    captured = request;
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const reply = '记得豆豆。\n<anam-meta>{"emotion":{"pleasure":0.2,"energy":0.6},"signature":"猫的名字我记住了。","spacePost":""}</anam-meta>';
    res.end([
      `data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 100, completion_tokens: 4 } })}\n\n`,
      'data: [DONE]\n\n',
    ].join(''));
  });
  await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
  const providerPort = provider.address().port;

  const history = [];
  for (let seq = 1; seq <= 81; seq++) {
    history.push({
      v: 1, seq, id: `seed_${String(seq).padStart(8, '0')}`,
      role: seq % 2 ? 'user' : 'assistant',
      text: seq === 1 ? '我养了一只猫，叫豆豆。' : `近处的测试历史 ${seq}`,
      at: new Date(Date.UTC(2026, 9, 29, 12, 0, seq - 1)).toISOString(),
      type: 'text', media: null,
    });
  }
  fs.writeFileSync(path.join(dataDir, 'messages.jsonl'), history.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
  fs.writeFileSync(path.join(dataDir, 'usage.jsonl'), '', 'utf8');
  fs.writeFileSync(path.join(dataDir, 'secret.json'), JSON.stringify({ apiKey: 'test-key-not-real', baseUrl: `http://127.0.0.1:${providerPort}` }), 'utf8');

  // Pick an available app port before launch.
  const probe = http.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const appPort = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const appOptions = {
    env: { ...process.env, DATA_DIR: dataDir, HOST: '127.0.0.1', PORT: String(appPort), MOCK_MODEL: '0', TYPING_FIRST_MS: '0', DEEPSEEK_API_KEY: '', DEEPSEEK_BASE: '', MODEL: '' },
    stdio: 'ignore',
  };
  const launchApp = () => spawn(node, [path.join(__dirname, '..', 'server.mjs')], appOptions);
  app = launchApp();
  const base = `http://127.0.0.1:${appPort}`;
  let ready = false;
  for (let i = 0; i < 50 && !ready; i++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* wait for listen */ }
    if (!ready) await pause(100);
  }
  assert.ok(ready, 'test server should start');
  const health = await (await fetch(`${base}/api/health`)).json();
  assert.equal(health.memoryFacts, 1, 'old explicit fact should be backfilled on startup');
  const balanceFirst = await (await fetch(`${base}/api/provider/balance`)).json();
  assert.equal(balanceFirst.ok, true);
  assert.equal(balanceFirst.balanceInfos[0].totalBalance, '12.50');
  failBalance = true;
  const balanceStale = await (await fetch(`${base}/api/provider/balance`)).json();
  assert.equal(balanceStale.ok, false);
  assert.equal(balanceStale.stale, true);
  assert.equal(balanceStale.balanceInfos[0].totalBalance, '12.50', 'last good provider balance must be preserved');
  console.log('PASS  provider balance cache retains the last good result when refresh fails');

  const response = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'memory_check_0001', text: '你还记得我以前提过的猫吗？' }),
  });
  assert.equal(response.status, 200);
  const rawStream = await response.text();
  assert.equal(rawStream.includes('<anam-meta>'), false, 'hidden AI metadata is stripped from the streamed chat');
  assert.ok(captured, 'fake provider should receive one model request');
  const system = captured.messages.find((message) => message.role === 'system')?.content || '';
  assert.match(system, /我养了一只猫，叫豆豆/u, 'prompt must include the original user fact');
  assert.match(system, /消息序号 1/u, 'prompt must retain the source sequence');
  assert.equal(captured.messages.slice(1).some((message) => message.content.includes('我养了一只猫，叫豆豆。')), false,
    'original fact must have left the L1 window while remaining in the system memory block');
  const persisted = await (await fetch(`${base}/api/messages?limit=500`)).json();
  assert.equal(persisted.messages.some((message) => message.text.includes('<anam-meta>')), false, 'hidden metadata is not written as a chat message');
  const profile = await (await fetch(`${base}/api/profile`)).json();
  assert.equal(profile.profile.signature, '猫的名字我记住了。', 'signature is stored as profile metadata');
  const emotion = await (await fetch(`${base}/api/emotion?days=30`)).json();
  assert.equal(emotion.points.length, 1, 'AI emotion is stored separately from the chat');
  console.log('PASS  L2 explicitly extracts and backfills old user facts');
  console.log('PASS  old fact is injected into the model system prompt with source sequence');
  console.log('PASS  live provider metadata stays out of chat and updates signature/emotion');

  let v1Memory;
  for (let i = 0; i < 60; i++) {
    v1Memory = await (await fetch(`${base}/api/memory`)).json();
    if (v1Memory.counts.summaries) break;
    await pause(100);
  }
  assert.equal(v1Memory.counts.summaries, 1, '20-turn L3 summary runs through the non-streaming provider path');
  assert.ok(v1Memory.records.find((row) => row.kind === 'summary')?.sourceIds?.length >= 20, 'live summary retains source ids');
  console.log('PASS  live provider summary includes source references');

  const testResponse = await fetch(`${base}/api/settings/test`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const testResult = await testResponse.json();
  assert.equal(testResponse.status, 200);
  assert.equal(testResult.ok, true);
  const settingsAfterTest = await (await fetch(`${base}/api/settings`)).json();
  assert.equal(settingsAfterTest.connectionStatus, 'connected', 'successful provider test should update connection status');
  const usage = fs.readFileSync(path.join(dataDir, 'usage.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(usage.some((row) => row.kind === 'connection_test'), 'connection test must be recorded in local usage');
  console.log('PASS  model connection test is recorded in usage.jsonl');

  await new Promise((resolve) => { app.once('exit', resolve); app.kill(); });
  app = launchApp();
  ready = false;
  for (let i = 0; i < 50 && !ready; i++) {
    try { ready = (await fetch(`${base}/api/health`)).ok; } catch { /* wait for listen */ }
    if (!ready) await pause(100);
  }
  assert.ok(ready, 'server should restart with the same data');
  const factRows = fs.readFileSync(path.join(dataDir, 'facts.jsonl'), 'utf8').split('\n').filter(Boolean);
  assert.equal(factRows.length, 1, 'backfill must not duplicate the same source fact on every restart');
  console.log('PASS  L2 backfill does not duplicate source facts after restart');
} finally {
  app?.kill();
  if (provider?.listening) await new Promise((resolve) => provider.close(resolve));
  fs.rmSync(dataDir, { recursive: true, force: true });
}
