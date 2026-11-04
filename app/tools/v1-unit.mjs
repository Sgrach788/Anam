import assert from 'node:assert/strict';
import {
  cleanSelfPost, cleanSignature, cosineSimilarity, parseAssistantMetadata,
  retrieveMemories, smoothEmotion, validateSummaryClaims, validateSummaryRelations,
} from '../lib/v1.mjs';

const now = Date.now();
const records = [
  { id: 'old', kind: 'fact', quote: '我养了一只猫叫豆豆', importance: 5, at: new Date(now - 86400000).toISOString() },
  { id: 'new', kind: 'summary', summary: '最近聊到天气和散步', importance: 3, at: new Date(now).toISOString() },
];
assert.equal(retrieveMemories(records, '猫豆豆', { now })[0].record.id, 'old', 'keyword recall ranks the matching fact');
assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
assert.equal(retrieveMemories(records, '完全不相关的检索词', { now }).length, 0, 'irrelevant memories are not returned');

const first = smoothEmotion({ pleasure: 0, energy: 0.5, at: new Date(now - 86400000).toISOString() }, { pleasure: 1, energy: 1 }, new Date(now).toISOString());
assert.equal(first.pleasure, 0.28, 'emotion changes gradually instead of jumping');
assert.equal(first.energy, 0.64);
const decayed = smoothEmotion({ pleasure: 1, energy: 1, at: new Date(now - 2 * 86400000).toISOString() }, { pleasure: 0, energy: 0.5 }, new Date(now).toISOString());
assert.ok(decayed.pleasure < 0.5 && decayed.energy < 0.8, 'emotion returns toward baseline over time');

assert.equal(cleanSignature('今天想慢一点。\n'), '今天想慢一点。');
assert.equal(cleanSelfPost('你今天要早点休息'), '', 'AI posts that mention the user are rejected');
assert.equal(cleanSelfPost('我喜欢今天的天气', {}, [], '我今天说喜欢天气，也想去散步'), '', 'AI posts that echo the user topic are rejected');
assert.equal(cleanSelfPost('夜里安静下来，我想听一会儿雨声。'), '夜里安静下来，我想听一会儿雨声。');

const parsed = parseAssistantMetadata('正文回复。\n<anam-meta>{"emotion":{"pleasure":0.2,"energy":0.5},"signature":"在听","spacePost":""}</anam-meta>');
assert.equal(parsed.text, '正文回复。');
assert.equal(parsed.metadata.signature, '在听');
assert.equal(parsed.found, true);

const sourceMessages = [{ id: 'm1', text: '我养了一只猫，名字叫豆豆。' }];
const grounded = validateSummaryRelations({
  entities: [{ name: '豆豆', sourceId: 'm1' }, { name: '小明', sourceId: 'm1' }],
  relations: [{ from: '豆豆', to: '小明', label: '朋友', sourceId: 'm1', evidence: '豆豆是小明的朋友' }],
}, sourceMessages);
assert.deepEqual(grounded.entities.map((entity) => entity.name), ['豆豆']);
assert.deepEqual(grounded.relations, [], 'unsupported relations are discarded');
const claims = validateSummaryClaims({ claims: [
  { text: '豆豆是一只猫。', sourceId: 'm1', evidence: '我养了一只猫，名字叫豆豆。' },
  { text: '用户住在北京。', sourceId: 'm1', evidence: '用户住在北京。' },
] }, sourceMessages);
assert.deepEqual(claims.map((claim) => claim.text), ['豆豆是一只猫。'], 'summary claims without exact source evidence are discarded');

console.log('PASS  V1 memory retrieval, emotion smoothing, metadata privacy, and source grounding');
