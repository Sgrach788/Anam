import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anam-v1-'));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let child;
let port;
let base;

async function freePort() {
  const server = (await import('node:net')).createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}

function launch() {
  child = spawn(process.execPath, [path.join(root, 'server.mjs')], {
    env: { ...process.env, DATA_DIR: dataDir, HOST: '127.0.0.1', PORT: String(port), MOCK_MODEL: '1', TYPING_FIRST_MS: '0', DEEPSEEK_API_KEY: '', DEEPSEEK_BASE: '', MODEL: '' },
    stdio: 'ignore',
  });
}

async function ready() {
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* startup */ }
    await wait(100);
  }
  throw new Error('isolated V1 server did not start');
}

const post = (route, body, method = 'POST') => fetch(`${base}${route}`, {
  method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});

try {
  const messages = [];
  for (let turn = 0; turn < 20; turn++) {
    const userId = `seed-user-${turn}`;
    const assistantId = `seed-ai-${turn}`;
    messages.push({ v: 1, seq: turn * 2 + 1, id: userId, role: 'user', text: turn === 0 ? '我养了一只猫，叫豆豆。' : `这是一条历史聊天记录，第 ${turn + 1} 轮。`, at: new Date(Date.UTC(2026, 0, 1, 0, turn)).toISOString() });
    messages.push({ v: 1, seq: turn * 2 + 2, id: assistantId, role: 'assistant', text: `收到第 ${turn + 1} 轮。`, at: new Date(Date.UTC(2026, 0, 1, 0, turn, 20)).toISOString(), replyTo: userId });
  }
  fs.writeFileSync(path.join(dataDir, 'messages.jsonl'), `${messages.map((row) => JSON.stringify(row)).join('\n')}\n`);
  fs.writeFileSync(path.join(dataDir, 'usage.jsonl'), '');
  port = await freePort(); base = `http://127.0.0.1:${port}`; launch(); await ready();

  const embeddingSave = await post('/api/settings', { embedding: { baseUrl: 'http://127.0.0.1:9/v1', model: 'mock-embedding', apiKey: 'secret-test-key', priceYuanPerMTok: 0 } });
  assert.equal(embeddingSave.status, 200);
  const publicSettings = await (await fetch(`${base}/api/settings`)).json();
  assert.equal(publicSettings.embedding.configured, true);
  assert.equal(JSON.stringify(publicSettings).includes('secret-test-key'), false, 'embedding key never returns to the browser');
  assert.equal((await post('/api/settings/embedding/test', {})).status, 200, 'mock embedding test performs no network call');
  const mockIndex = await (await post('/api/memory/index', {})).json();
  assert.equal(mockIndex.indexed, 0, 'mock mode never creates fake vectors');

  const factResponse = await fetch(`${base}/api/memory?q=${encodeURIComponent('猫豆豆')}`);
  let memory = await factResponse.json();
  const fact = memory.records.find((row) => row.kind === 'fact');
  assert.ok(fact && fact.sources.some((source) => source.seq === 1), 'fact exposes its source message');
  assert.equal((await post(`/api/memory/${fact.id}`, { text: '家里有一只猫叫豆豆。' }, 'PATCH')).status, 200);

  const userPost = await (await post('/api/space/posts', { text: '今天在空间留一条记录。' })).json();
  const comment = await (await post(`/api/space/posts/${userPost.post.id}/comments`, { text: '这里可以评论吗？' })).json();
  assert.ok(comment.aiComment, 'mock mode returns an AI comment');

  const chatBodies = [];
  const chats = Array.from({ length: 6 }, (_, i) => post('/api/chat', { id: `v1-auto-post-${i}`, text: `模拟自动动态第${i + 1}轮` }).then(async (response) => {
    assert.equal(response.status, 200); const body = await response.text();
    assert.equal(body.includes('<anam-meta>'), false, 'private metadata never appears in the streamed transcript');
    chatBodies.push(body);
  }));
  await Promise.all(chats);
  assert.ok(chatBodies.some((body) => body.includes('event: signature')), 'the active chat stream receives the updated signature');

  for (let i = 0; i < 60; i++) {
    memory = await (await fetch(`${base}/api/memory`)).json();
    if (memory.counts.summaries > 0) break;
    await wait(100);
  }
  assert.equal(memory.counts.summaries, 1, 'the 20-turn summary is generated once');
  const summary = memory.records.find((row) => row.kind === 'summary');
  assert.ok(summary?.sourceIds?.length >= 20 && summary.sourceEndSeq >= 40, `summary retains its original message references (${summary?.sourceIds?.length}/${summary?.sourceEndSeq})`);
  assert.ok(summary.claims?.length && summary.claims.every((claim) => summary.sourceIds.includes(claim.sourceId) && claim.evidence), 'each summary claim retains exact source evidence');

  let space = await (await fetch(`${base}/api/space`)).json();
  const aiPosts = space.posts.filter((row) => row.author === 'ai');
  assert.equal(aiPosts.length, 5, 'automatic AI space posts stop at five per local day');
  assert.ok(aiPosts.every((row) => row.sourceSeqs?.length && row.sourceIds?.length), 'every AI post points to real chat messages');
  const postComments = space.posts.find((row) => row.id === userPost.post.id).comments;
  assert.ok(postComments.length >= 2 && postComments.some((row) => row.author === 'user') && postComments.some((row) => row.author === 'ai'), 'user and AI comments are both stored');
  assert.ok((await (await fetch(`${base}/api/emotion?days=30`)).json()).points.length >= 6, 'AI emotion history is recorded');
  assert.ok(space.signature, 'the current AI signature persists');

  assert.equal((await post(`/api/memory/${fact.id}`, {}, 'DELETE')).status, 200);
  child.kill(); await new Promise((resolve) => child.once('exit', resolve));
  launch(); await ready();
  memory = await (await fetch(`${base}/api/memory?q=${encodeURIComponent('猫豆豆')}`)).json();
  assert.equal(memory.records.some((row) => row.id === fact.id), false, 'deleted facts stay deleted after restart');
  assert.equal(memory.counts.summaries, 1, 'summary survives restart without duplication');
  console.log('PASS  V1 mock integration: embedding privacy/fallback, source memory lifecycle, 20-turn summaries, space/comments, five-post cap, emotion/signature, restart persistence');
} finally {
  if (child && child.exitCode === null) { child.kill(); await new Promise((resolve) => child.once('exit', resolve)); }
  try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch { /* isolated temp data */ }
}
