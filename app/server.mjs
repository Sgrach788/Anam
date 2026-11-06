import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MAX_PART, findSentenceCut, findCommaCut, partDelay, sanitizeReply, normalizeReplySpeed, replySpeedMultiplier } from './lib/reply.mjs';
import { extractFacts, shouldUseSemanticMemory } from './lib/memory.mjs';
import { cleanSelfPost, cleanSignature, parseAssistantMetadata, retrieveMemories, smoothEmotion, validateSummaryClaims, validateSummaryRelations } from './lib/v1.mjs';
import { buildStableSystemPrefix, buildSystemContent } from './lib/prompt.mjs';
import { buildL1Context, L1_TOKEN_BUDGET } from './lib/context.mjs';
import { PRODUCT_VERSION } from './lib/version.mjs';
import { emptyBreakdown, normalizeBreakdown, sumBreakdown, cacheRate } from './lib/usage.mjs';
import { dateContextLine } from './lib/calendar.mjs';
import { buildWeatherLine, weatherFresh, weatherText } from './lib/weather.mjs';
import { generateVapidKeys, sendPush } from './lib/push.mjs';
import {
  MEME_MAX_BYTES, MEME_MAX_COUNT, MEME_STATIC_EDGE,
  isSafeMemeId, newMemeId, sanitizeLabel, sanitizeTags,
  sniffMime, imageDimensions, sha256, memeRef, mediaRefId, selectCatalog, memePromptBlock,
  memeStrategyFromConfig, memeStrategyPatch, rollMemeGate,
} from './lib/memes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(__dirname, 'public');
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const LOG = path.join(DATA, 'messages.jsonl');
const USAGE_LOG = path.join(DATA, 'usage.jsonl');
const FACT_LOG = path.join(DATA, 'facts.jsonl');
const BALANCE_CACHE = path.join(DATA, 'provider-balance.json');
const SUMMARY_LOG = path.join(DATA, 'summaries.jsonl');
const MEMORY_OVERRIDE_LOG = path.join(DATA, 'memory-overrides.jsonl');
const MEMORY_VECTOR_LOG = path.join(DATA, 'memory-vectors.jsonl');
const SPACE_LOG = path.join(DATA, 'space.jsonl');
const EMOTION_LOG = path.join(DATA, 'emotion.jsonl');
const MEME_LOG = path.join(DATA, 'memes.jsonl');
const MEME_DIR = path.join(DATA, 'memes');
const MEME_PREVIEW_DIR = path.join(MEME_DIR, 'previews');
const WEATHER_CACHE_FILE = path.join(DATA, 'weather.json');
const PUSH_LOG = path.join(DATA, 'push-subscriptions.jsonl');
const MEME_PREVIEW_MAX_BYTES = 300 * 1024;
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';

// D14：每日预算护栏。默认 1 元/天；mock 阶段按字数估算 token，同样记账。
const BUDGET_YUAN = Number(process.env.DAILY_BUDGET_YUAN || 2);
const BUDGET_TOKENS = Number(process.env.DAILY_TOKEN_LIMIT || 200000);
const PRICE_IN = Number(process.env.PRICE_IN_YUAN_PER_MTOK || 2);   // 元 / 百万输入 token
const PRICE_OUT = Number(process.env.PRICE_OUT_YUAN_PER_MTOK || 8); // 元 / 百万输出 token
const L1_TURNS = 30; // L1 工作记忆：最近 30 轮原文进上下文
// 拟人化：从收到消息到第一句至少"思考/打字"这么久（模型更慢则不再额外等）
const TYPING_FIRST_MS = Number(process.env.TYPING_FIRST_MS || 1800);

// D13：app/data/*.jsonl 一行一条，带 schema 版本号。这里只认 v1。
const SCHEMA = 1;
const BOOT_ID = crypto.randomUUID();

// 所有时间都从这里取。FAKE_NOW 只给测试用（验证按本地 0 点切天），正常不设。
const now = () => (process.env.FAKE_NOW ? new Date(process.env.FAKE_NOW) : new Date());
const nowIso = () => now().toISOString();
const STARTED_AT = nowIso();

fs.mkdirSync(DATA, { recursive: true });

// ---------- 消息存储（JSONL） ----------
// 记录形状：{ v, seq, id, role, text, at, type, media[, replyTo, mode] }
//   v     schema 版本
//   seq   全局单调递增序号（第 5 步断线重连靠它定位）
//   at    UTC ISO-8601 时间戳
//   type  text | image | sticker | system（V0 只产生 text）
//   media { ref, w, h, alt } 或 null（V0 只留位置）
const messages = [];
let nextSeq = 1;
const factsByKey = new Map();
const factSourceKeys = new Set();
const deletedFactSources = new Set();
const summariesById = new Map();
const summaryCursorById = new Map();
const memoryVectors = new Map();
const spaceRows = [];
const emotionRows = [];
const memes = [];
const memesById = new Map();
const corruptedMemes = new Set();
let memeWriteChain = Promise.resolve();
let summaryInFlight = false;
let embeddingInFlight = false;

const MESSAGE_TYPES = new Set(['text', 'image', 'sticker', 'system']);

function isoUtc(value) {
  const t = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

function normalizeMedia(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    ref: typeof value.ref === 'string' ? value.ref : '',
    w: Number.isFinite(Number(value.w)) ? Number(value.w) : 0,
    h: Number.isFinite(Number(value.h)) ? Number(value.h) : 0,
    alt: typeof value.alt === 'string' ? value.alt : '',
  };
}

// 老格式（只有 at 毫秒数、没有 v/seq/type/media）也能读，读进来统一成当前形状。
function normalize(stored) {
  if (!stored || typeof stored !== 'object') return null;
  const type = MESSAGE_TYPES.has(stored.type) ? stored.type : 'text';
  if (type !== 'sticker' && typeof stored.text !== 'string') return null;
  const role = stored.role === 'assistant' ? 'assistant' : stored.role === 'user' ? 'user' : null;
  if (!role) return null;
  const msg = {
    v: SCHEMA,
    seq: Number.isInteger(stored.seq) && stored.seq > 0 ? stored.seq : 0,
    id: typeof stored.id === 'string' && stored.id ? stored.id : crypto.randomUUID(),
    role,
    at: isoUtc(stored.at),
    type,
    media: normalizeMedia(stored.media),
    assistantId: typeof stored.assistantId === 'string' && stored.assistantId ? stored.assistantId : 'anam',
  };
  // sticker 的展示文本由 media.alt 派生，不落冗余 text 字段。
  if (type !== 'sticker') msg.text = stored.text;
  // 回复与用户消息的关联必须保留，否则重启后幂等回放会失效
  if (typeof stored.replyTo === 'string' && stored.replyTo) msg.replyTo = stored.replyTo;
  if (stored.mode === 'mock' || stored.mode === 'live') msg.mode = stored.mode;
  return msg;
}

const rawLines = [];
if (fs.existsSync(LOG)) {
  for (const line of fs.readFileSync(LOG, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let raw;
    try { raw = JSON.parse(line); } catch { continue; /* 跳过坏行 */ }
    rawLines.push(raw);
    const msg = normalize(raw);
    if (msg) messages.push(msg);
  }
}
for (const m of messages) if (m.seq) nextSeq = Math.max(nextSeq, m.seq + 1);
for (const m of messages) if (!m.seq) m.seq = nextSeq++;
messages.sort((a, b) => a.seq - b.seq);

// 一次性迁移：sticker 的展示文本由 media.alt 派生，去掉旧记录里的冗余 text。
if (rawLines.some((r) => r?.type === 'sticker' && 'text' in r)) {
  try {
    const backup = `${LOG}.pre-sticker-text.bak`;
    if (!fs.existsSync(backup)) fs.copyFileSync(LOG, backup);
    const tmp = `${LOG}.tmp`;
    fs.writeFileSync(tmp, messages.map((m) => JSON.stringify(m)).join('\n') + (messages.length ? '\n' : ''), 'utf8');
    fs.renameSync(tmp, LOG);
    console.log('[migrate] stripped sticker text (backup: pre-sticker-text.bak)');
  } catch (err) {
    console.error('[migrate] sticker text failed:', err.message);
  }
}

// 一次性迁移：补齐 type/media（备份原文件，原子写回）
if (rawLines.some((r) => !('type' in r) || !('media' in r) || !('assistantId' in r))) {
  try {
    const backup = `${LOG}.pre-assistant-id.bak`;
    if (!fs.existsSync(backup)) fs.copyFileSync(LOG, backup);
    const tmp = `${LOG}.tmp`;
    fs.writeFileSync(tmp, messages.map((m) => JSON.stringify(m)).join('\n') + (messages.length ? '\n' : ''), 'utf8');
    fs.renameSync(tmp, LOG);
    console.log(`[migrate] message fields normalized (backup: ${path.basename(backup)})`);
  } catch (err) {
    console.error('[migrate] failed:', err.message);
  }
}

function append(msg) {
  const stored = { type: 'text', media: null, assistantId: 'anam', ...msg, v: SCHEMA, seq: nextSeq++ };
  messages.push(stored);
  fs.appendFileSync(LOG, JSON.stringify(stored) + '\n', 'utf8');
  return stored;
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* tolerate damaged rows */ }
  }
  return rows;
}

function appendJsonl(file, row) {
  fs.appendFileSync(file, JSON.stringify(row) + '\n', 'utf8');
}

// ---------- 表情包存储（V2 Phase 1） ----------
function normalizeMemeRecord(raw) {
  if (!raw || typeof raw !== 'object' || !isSafeMemeId(raw.id)) return null;
  const file = path.basename(String(raw.file || ''));
  if (!file || file !== String(raw.file || '')) return null;
  const previewFile = raw.previewFile ? path.basename(String(raw.previewFile)) : '';
  return {
    id: raw.id,
    file,
    mime: String(raw.mime || ''),
    w: Number(raw.w) || 0,
    h: Number(raw.h) || 0,
    bytes: Number(raw.bytes) || 0,
    hash: String(raw.hash || ''),
    label: sanitizeLabel(raw.label),
    tags: sanitizeTags(raw.tags),
    reviewed: raw.reviewed === true,
    reviewed_at: raw.reviewed ? (raw.reviewed_at || nowIso()) : null,
    enabled: raw.enabled !== false,
    pinned: raw.pinned === true,
    created_at: raw.created_at || nowIso(),
    updated_at: raw.updated_at || raw.created_at || nowIso(),
    previewFile: previewFile && previewFile === String(raw.previewFile) ? previewFile : '',
    previewMime: String(raw.previewMime || ''),
    previewW: Number(raw.previewW) || 0,
    previewH: Number(raw.previewH) || 0,
    previewBytes: Number(raw.previewBytes) || 0,
  };
}

function loadMemes() {
  fs.mkdirSync(MEME_DIR, { recursive: true });
  fs.mkdirSync(MEME_PREVIEW_DIR, { recursive: true });
  memes.length = 0;
  memesById.clear();
  corruptedMemes.clear();
  for (const raw of readJsonl(MEME_LOG)) {
    const record = normalizeMemeRecord(raw);
    if (record) { memes.push(record); memesById.set(record.id, record); }
  }
  // 崩溃残留的临时文件 / 无记录孤儿文件；previews/ 子目录单独清理
  const known = new Set(memes.map((record) => record.file));
  for (const name of fs.readdirSync(MEME_DIR)) {
    const target = path.join(MEME_DIR, name);
    let stat;
    try { stat = fs.statSync(target); } catch { continue; }
    if (stat.isDirectory()) continue;
    if (name.startsWith('.tmp-') || !known.has(name)) {
      try { fs.rmSync(target, { force: true }); } catch { /* ignore */ }
    }
  }
  const knownPreviews = new Set(memes.map((record) => record.previewFile).filter(Boolean));
  for (const name of fs.readdirSync(MEME_PREVIEW_DIR)) {
    if (name.startsWith('.tmp-') || !knownPreviews.has(name)) {
      try { fs.rmSync(path.join(MEME_PREVIEW_DIR, name), { force: true }); } catch { /* ignore */ }
    }
  }
  for (const record of memes) {
    if (!fs.existsSync(path.join(MEME_DIR, record.file))) corruptedMemes.add(record.id);
    if (record.previewFile && !fs.existsSync(path.join(MEME_PREVIEW_DIR, record.previewFile))) {
      record.previewFile = '';
      record.previewMime = '';
      record.previewW = 0;
      record.previewH = 0;
      record.previewBytes = 0;
    }
  }
}

function writeMemesFile() {
  const tmp = `${MEME_LOG}.tmp`;
  const body = memes.map((record) => JSON.stringify(record)).join('\n') + (memes.length ? '\n' : '');
  fs.writeFileSync(tmp, body, 'utf8');
  fs.renameSync(tmp, MEME_LOG);
}

function withMemeWrite(fn) {
  const run = memeWriteChain.then(fn, fn);
  memeWriteChain = run.then(() => undefined, () => undefined);
  return run;
}

function memeView(record) {
  return {
    ...record,
    hasPreview: Boolean(record.previewFile && fs.existsSync(path.join(MEME_PREVIEW_DIR, record.previewFile))),
    corrupted: corruptedMemes.has(record.id),
  };
}

function memeCounts() {
  const all = memes.map(memeView);
  const selected = selectCatalog(all);
  return {
    total: all.length,
    enabled: all.filter((record) => record.enabled).length,
    pending: all.filter((record) => !record.reviewed).length,
    qualified: selected.qualified.length,
    catalog: selected.selected.length,
    waiting: selected.waiting,
  };
}

function memeStats() {
  const groups = [];
  const seen = new Set();
  for (let i = messages.length - 1; i >= 0 && groups.length < 20; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    const key = message.replyTo || message.id;
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(messages.filter((row) => row.role === 'assistant' && (row.replyTo || row.id) === key));
  }
  const withSticker = groups.filter((group) => group.some((message) => message.type === 'sticker')).length;
  return { recentAiReplies: groups.length, recentWithSticker: withSticker };
}

function readSwVersion() {
  try {
    const source = fs.readFileSync(path.join(PUB, 'sw.js'), 'utf8');
    return source.match(/const VERSION = ['"]([^'"]+)['"]/u)?.[1] || 'unknown';
  } catch {
    return 'unknown';
  }
}

function baseUrlHost() {
  try { return new URL(loadConfig().baseUrl).host; } catch { return ''; }
}

function statusPayload() {
  const budget = budgetState();
  return {
    productVersion: PRODUCT_VERSION,
    swVersion: readSwVersion(),
    schemaVersion: SCHEMA,
    mode: isMockMode() ? 'mock' : 'live',
    model: loadConfig().model,
    baseUrlHost: baseUrlHost(),
    startedAt: STARTED_AT,
    uptimeSeconds: Math.round(process.uptime()),
    budget: {
      spentYuan: budget.spentYuan,
      limitYuan: budget.limitYuan,
      tokens: budget.tokens,
      tokenLimit: budget.tokenLimit,
    },
    memes: {
      total: memes.length,
      catalog: memeCounts().catalog,
    },
  };
}

function usageBreakdownState() {
  const day = localDay();
  const todayRows = usage.filter((row) => row.day === day);
  const latest = [...usage].reverse().find((row) => row.breakdown && typeof row.breakdown === 'object');
  let cacheHit = 0;
  let cacheMiss = 0;
  for (const row of todayRows) {
    cacheHit += Number(row.promptCacheHit) || 0;
    cacheMiss += Number(row.promptCacheMiss) || 0;
  }
  return {
    latest: latest ? {
      at: latest.at,
      model: latest.model,
      tokensIn: latest.tokensIn,
      breakdown: latest.breakdown,
    } : null,
    today: {
      breakdown: sumBreakdown(todayRows),
      cacheHit,
      cacheMiss,
      cacheRate: cacheRate(cacheHit, cacheMiss),
    },
  };
}

function memeFilePath(record) {
  return path.join(MEME_DIR, record.file);
}

function saveMemePreview(id, dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]+)$/u.exec(String(dataUrl || ''));
  if (!match || !match[2]) {
    const err = new Error('preview_format');
    err.httpStatus = 400;
    throw err;
  }
  let buffer;
  try { buffer = Buffer.from(match[3], 'base64'); } catch {
    const err = new Error('preview_decode');
    err.httpStatus = 400;
    throw err;
  }
  if (!buffer.length || buffer.length > MEME_PREVIEW_MAX_BYTES) {
    const err = new Error('preview_size');
    err.httpStatus = 400;
    throw err;
  }
  const mime = sniffMime(buffer);
  const dimensions = mime ? imageDimensions(buffer, mime) : null;
  if (!mime || !dimensions) {
    const err = new Error('preview_invalid');
    err.httpStatus = 400;
    throw err;
  }
  if (Math.max(dimensions.w, dimensions.h) > 512) {
    const err = new Error('preview_dimensions');
    err.httpStatus = 400;
    throw err;
  }
  const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/gif' ? 'gif' : 'webp';
  const previewFile = `${id}.${ext}`;
  const target = path.join(MEME_PREVIEW_DIR, previewFile);
  const tmp = path.join(MEME_PREVIEW_DIR, `.tmp-${id}`);
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, target);
  return { previewFile, previewMime: mime, previewW: dimensions.w, previewH: dimensions.h, previewBytes: buffer.length };
}

function memeUsageCount(id) {
  const ref = memeRef(id);
  return messages.filter((message) => message.type === 'sticker' && message.media?.ref === ref).length;
}

// Phase 2A：每次聊天请求开始时构建一份快照；注入和校验都用它，目录中途变化不影响本次。
// 固定骰子入口：测试可用 MEME_DICE=0.1/0.9 覆盖 Math.random。
function memeDice() {
  const raw = process.env.MEME_DICE;
  if (raw !== undefined && raw !== '') {
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
  }
  return Math.random();
}

function buildMemeCatalogSnapshot() {
  const strategy = loadMemeStrategy();
  const empty = {
    enabled: false,
    gated: true,
    reason: 'disabled',
    selected: [],
    byId: new Map(),
    prompt: '',
    strategy,
    dice: null,
  };
  if (!loadMemeEnabled()) return empty;
  const dice = memeDice();
  if (!rollMemeGate(strategy.probability, dice)) {
    return { ...empty, reason: 'probability', dice };
  }
  const selected = selectCatalog(memes.map(memeView)).selected;
  return {
    enabled: true,
    gated: false,
    selected,
    byId: new Map(selected.map((record) => [record.id, record])),
    prompt: memePromptBlock(selected, { softFrequency: strategy.softFrequency }),
    strategy,
    dice,
  };
}

function pickStickerFor(metadata, snapshot, userMsgId = '') {
  const id = String(metadata?.meme || '').trim();
  if (!id || !snapshot?.byId.has(id) || !isSafeMemeId(id)) return null;
  const gap = Math.max(0, Number(snapshot.strategy?.minGapReplies) || 0);
  if (gap > 0) {
    // 只统计当前回复之前的完整 AI 回复组；当前回复的 text 不能算作“已间隔”。
    const groups = [];
    const seen = new Set();
    for (let i = messages.length - 1; i >= 0 && groups.length < gap; i--) {
      const message = messages[i];
      if (message.role !== 'assistant') continue;
      if (userMsgId && message.replyTo === userMsgId) continue;
      const key = message.replyTo || message.id;
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push(messages.filter((row) => row.role === 'assistant' && (row.replyTo || row.id) === key));
    }
    if (groups.some((group) => group.some((message) => message.type === 'sticker'))) return null;
  }
  return snapshot.byId.get(id);
}

loadMemes();

function persistFact(fact, source, previous = null) {
  const row = {
    v: SCHEMA,
    id: previous?.id || crypto.randomUUID(),
    key: fact.key,
    quote: fact.quote,
    sourceId: source.id,
    sourceSeq: source.seq,
    at: source.at,
    ...(previous?.edited ? { edited: true } : {}),
  };
  factsByKey.set(row.key, row);
  factSourceKeys.add(`${row.key}\u0000${row.sourceId}`);
  appendJsonl(FACT_LOG, row);
  return row;
}

function indexUserFacts(source) {
  const changed = [];
  for (const fact of extractFacts(source.text)) {
    const sourceKey = `${fact.key}\u0000${source.id}`;
    if (deletedFactSources.has(sourceKey)) continue;
    const previous = factsByKey.get(fact.key);
    if (factSourceKeys.has(sourceKey)) continue;
    if (!previous || Number(previous.sourceSeq || 0) <= Number(source.seq || 0)) changed.push(persistFact(fact, source));
  }
  return changed;
}

// Load saved L2 facts, then backfill facts from explicit user statements in the
// existing message log. Assistant text is never used as a memory source.
for (const row of readJsonl(MEMORY_OVERRIDE_LOG)) {
  if (row?.op === 'delete_fact' && row.key && row.sourceId) deletedFactSources.add(`${row.key}\u0000${row.sourceId}`);
}
for (const row of readJsonl(FACT_LOG)) {
  if (row && typeof row.key === 'string' && typeof row.quote === 'string') {
    factsByKey.set(row.key, row);
    if (typeof row.sourceId === 'string') factSourceKeys.add(`${row.key}\u0000${row.sourceId}`);
  }
}
for (const key of deletedFactSources) {
  const [factKey, sourceId] = key.split('\u0000');
  if (factsByKey.get(factKey)?.sourceId === sourceId) factsByKey.delete(factKey);
}
for (const message of messages) if (message.role === 'user') indexUserFacts(message);

for (const row of readJsonl(SUMMARY_LOG)) {
  if (row?.id && Number.isFinite(Number(row.throughSeq))) summaryCursorById.set(row.id, Number(row.throughSeq));
  if (row?.id) {
    if (row.deleted) summariesById.delete(row.id);
    else summariesById.set(row.id, row);
  }
}
for (const row of readJsonl(MEMORY_VECTOR_LOG)) {
  if (row?.id && row.deleted) memoryVectors.delete(row.id);
  else if (row?.id && Array.isArray(row.vector) && row.model === loadConfig().embeddingModel
    && row.baseUrl === loadConfig().embeddingBaseUrl) memoryVectors.set(row.id, row.vector);
}
spaceRows.push(...readJsonl(SPACE_LOG).filter((row) => row?.id && (row.kind === 'post' || row.kind === 'comment')));
emotionRows.push(...readJsonl(EMOTION_LOG).filter((row) => Number.isFinite(Number(row.pleasure)) && Number.isFinite(Number(row.energy))));

function memoryRecords() {
  const facts = [...factsByKey.values()].map((row) => ({
    ...row, kind: 'fact', text: row.quote, sourceIds: [row.sourceId], importance: 4,
  }));
  const summaries = [...summariesById.values()].map((row) => ({
    ...row, kind: 'summary', text: row.summary, sourceIds: row.sourceIds || [], importance: row.importance || 3,
  }));
  return [...facts, ...summaries];
}

function memoryBlock(query = '', queryVector = null) {
  const rows = retrieveMemories(memoryRecords(), query, { vectors: memoryVectors, queryVector, limit: 4 });
  if (!rows.length) return '';
  const memories = rows.map(({ record }) => {
    const source = record.sourceSeq ? `来源消息序号 ${record.sourceSeq}`
      : record.sourceSeqs?.length ? `来源消息序号 ${record.sourceSeqs.join(', ')}`
        : record.sourceIds?.length ? `来源消息 ${record.sourceIds.length} 条` : '来源不详';
    return `- [${record.kind === 'fact' ? '明确事实' : '过往摘要'}] ${String(record.text).slice(0, 650)}（${source}）`;
  });
  return [
    '【与当前消息相关的长期记忆】',
    ...memories,
    '这些记录可能过时；用户最新说法优先。模型摘要不是用户原话，不能扩写成确定事实；没有来源依据就承认不确定。',
  ].join('\n');
}

function embeddingConfigured() {
  const cfg = loadConfig();
  return Boolean(cfg.embeddingApiKey && cfg.embeddingBaseUrl && cfg.embeddingModel && cfg.embeddingPrice !== null);
}

// P4：日常聊天先用关键词；只有关键词无命中或明确回忆时才付向量调用。
function shouldEmbedQuery(query) {
  const text = String(query || '').trim();
  if (!text || !embeddingConfigured()) return false;
  const records = memoryRecords();
  if (!records.length) return false;
  const keywordHits = retrieveMemories(records, text, { vectors: memoryVectors, queryVector: null, limit: 1 }).length;
  return shouldUseSemanticMemory(text, {
    configured: true,
    memoryCount: records.length,
    keywordHits,
  });
}

// ---------- token 估算与每日预算（D14） ----------
const CJK = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;

// mock 阶段没有 usage 回传，按字数估算：中日韩 1 字 ≈ 1 token，其余 4 字符 ≈ 1 token。
function estimateTokens(text) {
  const s = String(text || '');
  const cjk = (s.match(CJK) || []).length;
  return Math.ceil(cjk + (s.length - cjk) / 4);
}

// 预算按本地日期切天（与手机上的「今天」一致），所以每天 00:00 本地时间自动归零。
function localDay(d = now()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- 时间标签（给模型看的） ----------
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const pad2 = (n) => String(n).padStart(2, '0');

function formatNowLabel(d = new Date()) {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 星期${WEEKDAYS[d.getDay()]} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// "今天 22:13" / "昨天 22:13" / "10月27日 22:13" / "2025年12月31日 22:13"
function relativeTimeLabel(iso, nowDate = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = localDay(nowDate);
  const yesterdayDate = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - 1);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (localDay(d) === today) return `今天 ${hm}`;
  if (localDay(d) === localDay(yesterdayDate)) return `昨天 ${hm}`;
  if (d.getFullYear() === nowDate.getFullYear()) return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

// 系统提示词：人设 + 人格设定 + 当前时间 + "时间只被动用"的约束。
function recentUserPostsBlock() {
  const since = Date.now() - 3 * 86400000;
  const posts = spaceRows
    .filter((row) => row?.kind === 'post' && row.author === 'user' && Date.parse(row.at) >= since)
    .slice(-2);
  if (!posts.length) return '';
  return [
    '最近对方在空间发的动态（可以自然提起，但不要逐字复述，也不要在对方没提及时反复追问）：',
    ...posts.map((post) => `- ${String(post.text || '').slice(0, 200)}`),
  ].join('\n');
}

function buildPromptBundle(nowDate = new Date(), profile = loadProfile(), query = '', queryVector = null, memeCatalog = null, contextMessages = []) {
  const stablePrefix = buildStableSystemPrefix({
    persona: PERSONA,
    profileText: profileBlock(profile),
  });
  const memoryText = memoryBlock(query, queryVector);
  const postsText = recentUserPostsBlock();
  const catalogText = memeCatalog?.prompt || '';
  const nowLine = `现在是 ${formatNowLabel(nowDate)}（本地时间）。`;
  const signatureText = signatureBlock(profile);
  const weatherText = weatherContextLine();
  const dateText = dateContextLine(nowDate);
  const prompt = buildSystemContent({
    stablePrefix,
    memoryText,
    recentPostsText: postsText,
    memeText: catalogText,
    nowLine,
    signatureText,
    weatherText,
    dateText,
  });
  const l1 = contextMessages.reduce((sum, message) => sum + estimateTokens(message.content), 0);
  const breakdown = normalizeBreakdown({
    stable: estimateTokens(stablePrefix),
    memory: estimateTokens(memoryText),
    posts: estimateTokens(postsText),
    catalog: estimateTokens(catalogText),
    // 签名/天气/日期每轮可能变化，归入 time 尾巴；六项总数仍与 prompt 对齐。
    time: estimateTokens(nowLine) + estimateTokens(signatureText) + estimateTokens(weatherText) + estimateTokens(dateText),
    l1,
  });
  return { prompt, breakdown };
}

function buildSystemPrompt(nowDate = new Date(), profile = loadProfile(), query = '', queryVector = null, memeCatalog = null) {
  return buildPromptBundle(nowDate, profile, query, queryVector, memeCatalog, []).prompt;
}

const usage = [];
if (fs.existsSync(USAGE_LOG)) {
  for (const line of fs.readFileSync(USAGE_LOG, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { usage.push(JSON.parse(line)); } catch { /* 坏行跳过 */ }
  }
}

function recordUsage(entry) {
  // day 取「请求被受理时」的那一天，避免跨 0 点的长回复算到第二天。
  const stored = { v: SCHEMA, at: nowIso(), day: localDay(), ...entry };
  usage.push(stored);
  fs.appendFileSync(USAGE_LOG, JSON.stringify(stored) + '\n', 'utf8');
  return stored;
}

// D14 的显式例外：用户在弹窗里选择「今天继续」后，当天不再拦截；本地 0 点自动失效。
const BUDGET_OVERRIDE_FILE = path.join(DATA, 'budget-override.json');
let budgetOverride = null;
try {
  if (fs.existsSync(BUDGET_OVERRIDE_FILE)) budgetOverride = JSON.parse(fs.readFileSync(BUDGET_OVERRIDE_FILE, 'utf8'));
} catch { budgetOverride = null; }

function saveBudgetOverride(value) {
  budgetOverride = value;
  try {
    if (value) fs.writeFileSync(BUDGET_OVERRIDE_FILE, JSON.stringify(value), 'utf8');
    else if (fs.existsSync(BUDGET_OVERRIDE_FILE)) fs.unlinkSync(BUDGET_OVERRIDE_FILE);
  } catch { /* 写失败不影响本次运行 */ }
}

function budgetState() {
  const day = localDay();
  let cost = 0;
  let tokens = 0;
  let calls = 0;
  for (const u of usage) {
    if (u.day !== day) continue;
    cost += Number(u.costYuan) || 0;
    tokens += (Number(u.tokensIn) || 0) + (Number(u.tokensOut) || 0);
    calls++;
  }
  const overLimit = cost >= BUDGET_YUAN || tokens >= BUDGET_TOKENS;
  const override = budgetOverride?.day === day && budgetOverride?.mode === 'day' ? 'day' : null;
  return {
    day,
    limitYuan: BUDGET_YUAN,
    spentYuan: Math.round(cost * 1e6) / 1e6,
    tokenLimit: BUDGET_TOKENS,
    tokens,
    calls,
    overLimit,
    override,
    blocked: overLimit && override !== 'day',
  };
}

const costOf = (tokensIn, tokensOut) => (tokensIn * PRICE_IN + tokensOut * PRICE_OUT) / 1e6;

async function requestEmbeddings(inputs, { reserveChatTokens = 0, kind = 'embedding' } = {}) {
  const cfg = loadConfig();
  if (!cfg.embeddingApiKey || !cfg.embeddingBaseUrl || !cfg.embeddingModel || cfg.embeddingPrice === null) return null;
  if (!Array.isArray(inputs) || !inputs.length) return [];
  const inputTokens = inputs.reduce((sum, text) => sum + estimateTokens(text), 0);
  const estimatedCost = inputTokens * cfg.embeddingPrice / 1e6;
  const state = budgetState();
  const reserve = costOf(reserveChatTokens, 800);
  if (state.blocked || state.spentYuan + estimatedCost + reserve > state.limitYuan) return null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20000);
  try {
    const response = await fetch(`${cfg.embeddingBaseUrl.replace(/\/+$/, '')}/embeddings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.embeddingApiKey}` },
      body: JSON.stringify({ model: cfg.embeddingModel, input: inputs }),
      signal: ac.signal,
    });
    if (!response.ok) throw new Error(`Embedding 接口 HTTP ${response.status}`);
    const payload = await response.json();
    const vectors = (payload.data || []).sort((a, b) => Number(a.index) - Number(b.index)).map((item) => item.embedding);
    if (vectors.length !== inputs.length || vectors.some((v) => !Array.isArray(v) || !v.length)) throw new Error('Embedding 接口返回格式异常');
    const tokens = Number(payload.usage?.prompt_tokens ?? payload.usage?.total_tokens ?? inputTokens);
    recordUsage({
      kind, mode: 'live', model: cfg.embeddingModel,
      tokensIn: tokens, tokensOut: 0, estimated: !payload.usage,
      costYuan: tokens * cfg.embeddingPrice / 1e6,
      userMsgId: null, replyId: null,
    });
    return vectors;
  } catch (err) {
    console.warn('[embedding]', redactSecret(err.name === 'AbortError' ? 'Embedding 接口超时' : err.message, cfg.embeddingApiKey));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function embedQuery(query, reserveChatTokens = 0) {
  const vectors = await requestEmbeddings([String(query || '').slice(0, 4000)], { reserveChatTokens, kind: 'embedding_query' });
  return vectors?.[0] || null;
}

async function indexMemoryVectors(records) {
  if (embeddingInFlight) return { indexed: 0, skipped: records.length };
  const missing = records.filter((row) => row?.id && !memoryVectors.has(row.id) && String(row.text || row.quote || row.summary || '').trim());
  if (!missing.length) return { indexed: 0, skipped: 0 };
  embeddingInFlight = true;
  let indexed = 0;
  try {
    for (let i = 0; i < missing.length; i += 32) {
      const batch = missing.slice(i, i + 32);
      const vectors = await requestEmbeddings(batch.map((row) => String(row.text || row.quote || row.summary).slice(0, 3000)), { kind: 'embedding_index' });
      if (!vectors) break;
      for (let j = 0; j < batch.length; j++) {
        const item = { v: SCHEMA, id: batch[j].id, baseUrl: loadConfig().embeddingBaseUrl, model: loadConfig().embeddingModel, vector: vectors[j], at: nowIso() };
        memoryVectors.set(item.id, item.vector);
        appendJsonl(MEMORY_VECTOR_LOG, item);
        indexed++;
      }
    }
  } finally {
    embeddingInFlight = false;
  }
  return { indexed, skipped: missing.length - indexed };
}

// L1 工作记忆：最近 30 轮原文（第 6 步接真模型时直接用这段）。
function messageText(message) {
  if (!message) return '';
  if (message.type === 'sticker') return `[表情] ${message.media?.alt || ''}`;
  return message.text || '';
}

function buildContextMessages(now = new Date()) {
  return buildL1Context(messages, {
    maxMessages: L1_TURNS * 2,
    budget: L1_TOKEN_BUDGET,
    tokenize: estimateTokens,
    timeLabel: (at) => relativeTimeLabel(at, now),
    textOf: messageText,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 每日备份：app\data -> backups\YYYY-MM-DD，保留最近 7 天 ----------
// 只备份数据文件，不备份 secret.json（避免把 key 复制得到处都是）。
const DEFAULT_DATA = path.join(__dirname, 'data');
const BACKUP_ROOT = process.env.BACKUP_DIR
  || (path.resolve(DATA) === DEFAULT_DATA ? path.join(__dirname, '..', 'backups') : '');
let lastBackup = null;

function ensureDailyBackup() {
  if (!BACKUP_ROOT) return null;
  const day = localDay();
  const dir = path.join(BACKUP_ROOT, day);
  const marker = path.join(dir, '.done');
  if (fs.existsSync(marker)) {
    lastBackup = day;
    return dir;
  }
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const name of ['messages.jsonl', 'usage.jsonl', 'facts.jsonl', 'summaries.jsonl', 'memory-overrides.jsonl', 'memory-vectors.jsonl', 'space.jsonl', 'emotion.jsonl', 'memes.jsonl']) {
      const src = path.join(DATA, name);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, name));
    }
    const memeSource = path.join(DATA, 'memes');
    if (fs.existsSync(memeSource)) {
      fs.cpSync(memeSource, path.join(dir, 'memes'), {
        recursive: true,
        filter: (source) => !path.basename(source).startsWith('.tmp-'),
      });
    }
    fs.writeFileSync(marker, nowIso(), 'utf8');
    const days = fs.readdirSync(BACKUP_ROOT).filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n)).sort();
    while (days.length > 7) {
      const old = days.shift();
      fs.rmSync(path.join(BACKUP_ROOT, old), { recursive: true, force: true });
      console.log('[backup] removed', old);
    }
    lastBackup = day;
    console.log('[backup]', dir);
    return dir;
  } catch (err) {
    console.error('[backup] failed:', err.message);
    return null;
  }
}

// ---------- 模型层占位：V0 先用 mock，接真模型在后面的步骤 ----------
const forcedMock = process.env.MOCK_MODEL === '1' || process.env.MOCK_MODEL === 'true';
const forcedLive = process.env.MOCK_MODEL === '0';
function isMockMode() {
  return forcedMock || (!forcedLive && !loadConfig().apiKey);
}

const PERSONA = process.env.PERSONA || '你是一个只属于我的 AI 伴侣。语气自然、有情绪，不要像客服。';
const MODEL = process.env.MODEL || 'deepseek-flash';
const SECRET_FILE = path.join(DATA, 'secret.json');

// key 优先取环境变量，其次 app/data/secret.json。每次请求现读，换 key 不用重启。
function loadConfig() {
  let file = {};
  try {
    // 记事本可能存成带 BOM 的 UTF-8，直接 JSON.parse 会报错，这里先去掉。
    const raw = fs.readFileSync(SECRET_FILE, 'utf8').replace(/^\uFEFF/, '');
    file = JSON.parse(raw);
  } catch { /* 没有或格式不对就当作没配 */ }
  const embeddingPriceRaw = process.env.EMBEDDING_PRICE_YUAN_PER_MTOK ?? file.embeddingPrice;
  const embeddingPrice = embeddingPriceRaw === undefined || embeddingPriceRaw === null || embeddingPriceRaw === ''
    ? null : Number(embeddingPriceRaw);
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || file.apiKey || '',
    baseUrl: process.env.DEEPSEEK_BASE || file.baseUrl || 'https://api.deepseek.com',
    model: process.env.MODEL || file.model || MODEL,
    accessPassword: process.env.ACCESS_PASSWORD || file.accessPassword || '',
    embeddingApiKey: process.env.EMBEDDING_API_KEY || file.embeddingApiKey || '',
    embeddingBaseUrl: process.env.EMBEDDING_BASE || file.embeddingBaseUrl || '',
    embeddingModel: process.env.EMBEDDING_MODEL || file.embeddingModel || '',
    embeddingPrice: Number.isFinite(embeddingPrice) && embeddingPrice >= 0 ? embeddingPrice : null,
  };
}

function writeSecretConfig(update) {
  let file = {};
  try { file = JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8').replace(/^\uFEFF/, '')); } catch { /* initialize */ }
  Object.assign(file, update);
  const tmp = `${SECRET_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(file, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, SECRET_FILE);
}

function redactSecret(value, secret = loadConfig().apiKey) {
  let text = String(value || '');
  if (secret) text = text.split(secret).join('[redacted]');
  return text.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted]').slice(0, 300);
}

let lastConnectionTest = null;

function publicSettings() {
  const cfg = loadConfig();
  const envKey = Boolean(process.env.DEEPSEEK_API_KEY);
  return {
    provider: 'DeepSeek',
    model: cfg.model,
    apiKeyConfigured: Boolean(cfg.apiKey),
    keySource: envKey ? 'environment' : (cfg.apiKey ? 'local' : 'none'),
    keyEditable: !envKey,
    mode: isMockMode() ? 'mock' : 'live',
    replySpeed: loadReplySpeed(),
    connectionStatus: !cfg.apiKey ? 'not_configured'
      : (isMockMode() ? 'mock' : (lastConnectionTest?.ok ? 'connected' : (lastConnectionTest ? 'failed' : 'untested'))),
    embedding: {
      configured: Boolean(cfg.embeddingApiKey && cfg.embeddingBaseUrl && cfg.embeddingModel && cfg.embeddingPrice !== null),
      apiKeyConfigured: Boolean(cfg.embeddingApiKey),
      keySource: process.env.EMBEDDING_API_KEY ? 'environment' : (cfg.embeddingApiKey ? 'local' : 'none'),
      baseUrl: cfg.embeddingBaseUrl,
      model: cfg.embeddingModel,
      priceYuanPerMTok: cfg.embeddingPrice,
      indexCount: memoryVectors.size,
      memoryCount: memoryRecords().length,
    },
  };
}

function loadBalanceCache() {
  try {
    const cached = JSON.parse(fs.readFileSync(BALANCE_CACHE, 'utf8').replace(/^\uFEFF/, ''));
    if (cached && Array.isArray(cached.balanceInfos) && typeof cached.checkedAt === 'string') return cached;
  } catch { /* no cached balance yet */ }
  return null;
}

let lastBalance = loadBalanceCache();

function balanceResult(ok, error = '') {
  return {
    ok,
    available: ok ? Boolean(lastBalance?.isAvailable) : false,
    balanceInfos: lastBalance?.balanceInfos || [],
    updatedAt: lastBalance?.checkedAt || null,
    stale: !ok && Boolean(lastBalance),
    error,
  };
}

async function refreshProviderBalance() {
  const cfg = loadConfig();
  if (!cfg.apiKey) return balanceResult(false, '尚未配置 API key');
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12000);
  try {
    const response = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/user/balance`, {
      headers: { authorization: `Bearer ${cfg.apiKey}` },
      signal: ac.signal,
    });
    if (!response.ok) throw new Error(`余额接口 HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.balance_infos)) throw new Error('余额接口返回格式异常');
    const balanceInfos = payload.balance_infos
      .filter((item) => item && typeof item.currency === 'string')
      .map((item) => ({
        currency: item.currency,
        totalBalance: String(item.total_balance ?? '0'),
        grantedBalance: String(item.granted_balance ?? '0'),
        toppedUpBalance: String(item.topped_up_balance ?? '0'),
      }));
    lastBalance = {
      isAvailable: Boolean(payload.is_available),
      balanceInfos,
      checkedAt: nowIso(),
    };
    const tmp = `${BALANCE_CACHE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(lastBalance, null, 2) + '\n', 'utf8');
    fs.renameSync(tmp, BALANCE_CACHE);
    return balanceResult(true);
  } catch (err) {
    return balanceResult(false, redactSecret(err.name === 'AbortError' ? '余额查询超时' : err.message));
  } finally {
    clearTimeout(timer);
  }
}

// ---------- config.json（人格 / 设置，D1 留口 + D2 使用） ----------
const CONFIG_FILE = path.join(DATA, 'config.json');
const PROFILE_KEYS = ['name', 'avatar', 'callUser', 'tone', 'initiative', 'boundaries', 'persona', 'signature'];
const PROFILE_MAX = 2000;
const AVATAR_MAX = 400000; // 约 300KB 图片的 base64

const emptyProfile = () => ({
  name: 'Anam', avatar: '', callUser: '', tone: '', initiative: '', boundaries: '', persona: '', signature: '',
});
const emptyUserProfile = () => ({ name: '我', avatar: '' });

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return {};
  }
}

function writeConfigPatch(update) {
  const cfg = readConfig();
  cfg.v = Number.isInteger(cfg.v) ? cfg.v : 1;
  Object.assign(cfg, update);
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return cfg;
}

function readSecretFile() {
  try {
    return JSON.parse(fs.readFileSync(SECRET_FILE, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    return {};
  }
}

// ---------- 天气 / 日期（volatile prompt 尾巴） ----------
let weatherCache = null;
try {
  if (fs.existsSync(WEATHER_CACHE_FILE)) weatherCache = JSON.parse(fs.readFileSync(WEATHER_CACHE_FILE, 'utf8'));
} catch { weatherCache = null; }

function weatherCityConfig() {
  const cfg = readConfig();
  return {
    city: String(cfg.weatherCity || '').slice(0, 60),
    lat: Number(cfg.weatherLat),
    lon: Number(cfg.weatherLon),
  };
}

function saveWeatherCache(next) {
  weatherCache = next;
  const tmp = `${WEATHER_CACHE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, WEATHER_CACHE_FILE);
}

async function geocodeCity(city) {
  const qs = new URLSearchParams({ name: city, count: '1', language: 'zh', format: 'json' });
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${qs}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`geocoding HTTP ${response.status}`);
  const body = await response.json();
  const hit = body?.results?.[0];
  if (!hit) throw new Error('city_not_found');
  return { name: hit.name || city, lat: Number(hit.latitude), lon: Number(hit.longitude) };
}

async function refreshWeather() {
  const cfg = weatherCityConfig();
  if (!cfg.city || !Number.isFinite(cfg.lat) || !Number.isFinite(cfg.lon)) return null;
  const qs = new URLSearchParams({
    latitude: String(cfg.lat), longitude: String(cfg.lon),
    current: 'temperature_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max',
    timezone: 'auto', forecast_days: '1',
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${qs}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`weather HTTP ${response.status}`);
    const body = await response.json();
    const current = body?.current || {};
    const daily = body?.daily || {};
    const cache = {
      fetchedAt: nowIso(),
      city: cfg.city,
      current: { temp: Number(current.temperature_2m), code: Number(current.weather_code) },
      today: {
        tempMax: Number(daily.temperature_2m_max?.[0]),
        tempMin: Number(daily.temperature_2m_min?.[0]),
        code: Number(daily.weather_code?.[0]),
        rainChance: Number(daily.precipitation_probability_max?.[0]),
      },
    };
    saveWeatherCache(cache);
    return cache;
  } catch (err) {
    console.warn('[weather]', redactSecret(err.message));
    return null;
  }
}

function weatherContextLine() {
  if (!weatherCityConfig().city) return '';
  if (!weatherCache) return '';
  return buildWeatherLine(weatherCache);
}

function weatherStatusPayload() {
  const cfg = weatherCityConfig();
  return {
    city: cfg.city,
    configured: Boolean(cfg.city && Number.isFinite(cfg.lat) && Number.isFinite(cfg.lon)),
    cache: weatherCache ? {
      fetchedAt: weatherCache.fetchedAt,
      city: weatherCache.city,
      current: weatherCache.current,
      today: weatherCache.today,
      fresh: weatherFresh(weatherCache),
    } : null,
  };
}

// ---------- Web Push ----------
function loadPushSubscriptions() {
  const rows = [];
  const seen = new Set();
  try {
    for (const line of fs.readFileSync(PUSH_LOG, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      if (!row?.endpoint || seen.has(row.endpoint)) continue;
      seen.add(row.endpoint);
      rows.push(row);
    }
  } catch { /* no subscriptions */ }
  return rows;
}

let pushSubscriptions = loadPushSubscriptions();

function savePushSubscriptions() {
  const tmp = `${PUSH_LOG}.tmp`;
  fs.writeFileSync(tmp, pushSubscriptions.map((row) => JSON.stringify(row)).join('\n') + (pushSubscriptions.length ? '\n' : ''), 'utf8');
  fs.renameSync(tmp, PUSH_LOG);
}

function pushConfigured() {
  const secret = readSecretFile();
  return Boolean(secret.vapidPrivateKey && readConfig().vapidPublicKey);
}

function pushEnabled() {
  return readConfig().pushEnabled === true;
}

function pushStatusPayload() {
  return { configured: pushConfigured(), enabled: pushEnabled(), subscriptions: pushSubscriptions.length };
}

async function sendPushToAll(payload) {
  if (!pushEnabled() || !pushConfigured() || !pushSubscriptions.length) return { sent: 0, removed: 0 };
  const secret = readSecretFile();
  const publicKey = readConfig().vapidPublicKey;
  let sent = 0;
  let removed = 0;
  const keep = [];
  for (const sub of pushSubscriptions) {
    try {
      const result = await sendPush(sub, payload, {
        privateKeyJwk: secret.vapidPrivateKey,
        publicKey,
        subject: String(readConfig().pushSubject || 'mailto:anam@localhost'),
      });
      if (result.status === 404 || result.status === 410) {
        removed++;
        continue;
      }
      if (result.ok) sent++;
      keep.push(sub);
    } catch (err) {
      console.warn('[push]', redactSecret(err.message));
      keep.push(sub);
    }
  }
  if (removed) {
    pushSubscriptions = keep;
    savePushSubscriptions();
  }
  return { sent, removed };
}

function notifyReply(replyText) {
  if (!pushEnabled() || !pushSubscriptions.length) return;
  const body = String(replyText || '').replace(/\s+/gu, ' ').trim().slice(0, 100);
  if (!body) return;
  void sendPushToAll({ title: 'Anam', body, tag: 'anam-chat', url: '/' }).catch((err) => {
    console.warn('[push] notify failed:', redactSecret(err.message));
  });
}

function loadProfile() {
  const saved = readConfig().profile;
  const out = emptyProfile();
  if (saved && typeof saved === 'object') {
    for (const k of PROFILE_KEYS) if (typeof saved[k] === 'string') out[k] = saved[k];
  }
  return out;
}

function sanitizeProfileValue(key, value) {
  const s = String(value);
  if (key === 'avatar') {
    if (!s.startsWith('data:image/') || s.length > AVATAR_MAX) return '';
    return s;
  }
  if (key === 'name' || key === 'callUser') return s.slice(0, 40);
  if (key === 'signature') return cleanSignature(s);
  return s.slice(0, PROFILE_MAX);
}

function saveProfile(input) {
  const cfg = readConfig();
  const profile = { ...emptyProfile(), ...(cfg.profile && typeof cfg.profile === 'object' ? cfg.profile : {}) };
  for (const k of PROFILE_KEYS) {
    if (input && typeof input[k] === 'string') profile[k] = sanitizeProfileValue(k, input[k]);
  }
  cfg.v = Number.isInteger(cfg.v) ? cfg.v : 1;
  cfg.profile = profile;
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return profile;
}

function loadMemeEnabled() {
  return readConfig().memeEnabled !== false;
}

function saveMemeEnabled(enabled) {
  const cfg = readConfig();
  cfg.v = Number.isInteger(cfg.v) ? cfg.v : 1;
  cfg.memeEnabled = Boolean(enabled);
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return cfg.memeEnabled;
}

function loadMemeStrategy() {
  return memeStrategyFromConfig(readConfig());
}

function saveMemeStrategy(patch) {
  const clean = memeStrategyPatch(patch);
  const cfg = readConfig();
  cfg.v = Number.isInteger(cfg.v) ? cfg.v : 1;
  if ('probability' in clean) cfg.memeSendProbability = clean.probability;
  if ('minGapReplies' in clean) cfg.memeMinGapReplies = clean.minGapReplies;
  if ('softFrequency' in clean) cfg.memeSoftFrequency = clean.softFrequency;
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return loadMemeStrategy();
}

function loadReplySpeed() {
  return normalizeReplySpeed(readConfig().replySpeed);
}

function saveReplySpeed(value) {
  const speed = normalizeReplySpeed(value);
  const cfg = readConfig();
  cfg.v = Number.isInteger(cfg.v) ? cfg.v : 1;
  cfg.replySpeed = speed;
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return speed;
}

function loadUserProfile() {
  const saved = readConfig().userProfile;
  const profile = emptyUserProfile();
  if (saved && typeof saved === 'object') {
    if (typeof saved.name === 'string') profile.name = saved.name.slice(0, 40) || '我';
    if (typeof saved.avatar === 'string' && saved.avatar.startsWith('data:image/') && saved.avatar.length <= AVATAR_MAX) profile.avatar = saved.avatar;
  }
  return profile;
}

function saveUserProfile(input) {
  const cfg = readConfig();
  const profile = { ...emptyUserProfile(), ...loadUserProfile() };
  if (typeof input?.name === 'string') profile.name = input.name.trim().slice(0, 40) || '我';
  if (typeof input?.avatar === 'string') profile.avatar = input.avatar === '' ? '' : (input.avatar.startsWith('data:image/') && input.avatar.length <= AVATAR_MAX ? input.avatar : profile.avatar);
  cfg.userProfile = profile;
  const tmp = `${CONFIG_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, CONFIG_FILE);
  return profile;
}

// 把人设写进 system prompt；空字段不写
function profileBlock(profile = loadProfile()) {
  const rows = [
    profile.name && `- 你的名字是：${profile.name}（提到自己时用这个名字）`,
    profile.callUser && `- 你称呼我为：${profile.callUser}`,
    profile.tone && `- 语气：${profile.tone}`,
    profile.initiative && `- 主动性：${profile.initiative}`,
    profile.boundaries && `- 边界：${profile.boundaries}`,
    profile.persona && `- 整体人设：${profile.persona}`,
  ].filter(Boolean);
  if (!rows.length) return '';
  return ['【你们之间的设定】', ...rows, '这些设定优先于人设默认值；但不要越过安全底线。'].join('\n');
}

// 签名每轮可能变化，绝不能放进稳定前缀。
function signatureBlock(profile = loadProfile()) {
  return profile.signature
    ? `- 当前个性签名：${profile.signature}（只代表你此刻的自我表达，不是用户的个人事实）`
    : '';
}

if (!fs.existsSync(CONFIG_FILE)) {
  try { saveProfile({}); } catch (err) { console.error('[config] init failed:', err.message); }
}

// ---------- 访问口令（局域网里防误连；所有 /api/* 都校验） ----------
const AUTH_WINDOW_MS = 10 * 60 * 1000;
const AUTH_MAX_FAILS = 20;
const authFailures = new Map(); // ip -> { count, until }

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// 返回 true = 放行；false = 已经写回 401/429。
function checkAuth(req, res) {
  const pw = loadConfig().accessPassword;
  if (!pw) return true; // 没配口令就不拦（只适合本机）
  const ip = req.socket.remoteAddress || '?';
  const now = Date.now();
  const rec = authFailures.get(ip);
  if (rec && rec.until > now && rec.count >= AUTH_MAX_FAILS) {
    sendJson(res, 429, { error: 'too_many_attempts', message: '试太多次了，过十分钟再试。' });
    return false;
  }
  if (safeEqual(req.headers['x-access-token'] || '', pw)) return true;
  const fresh = rec && rec.until > now ? rec : { count: 0, until: now + AUTH_WINDOW_MS };
  fresh.count++;
  authFailures.set(ip, fresh);
  sendJson(res, 401, { error: 'unauthorized', message: '口令不对。' });
  return false;
}

// 流式调用（OpenAI 兼容），返回 { text, usage }。
// usage 来自最后一帧的 usage 字段（stream_options.include_usage），记账以它为准。
async function streamModel(onDelta, maxTokens, memeSnapshot = null) {
  const cfg = loadConfig();
  if (!cfg.apiKey) {
    const e = new Error('还没配置 API key');
    e.code = 'missing_api_key';
    e.status = 503;
    throw e;
  }

  const nowDate = new Date();
  const query = messages.at(-1)?.role === 'user' ? messages.at(-1).text : '';
  const queryVector = shouldEmbedQuery(query) ? await embedQuery(query, estimateInputTokens(query)) : null;
  const contextMessages = buildContextMessages(nowDate);
  const promptBundle = buildPromptBundle(nowDate, loadProfile(), query, queryVector, memeSnapshot, contextMessages);
  const messagesOut = [
    { role: 'system', content: promptBundle.prompt },
    ...contextMessages,
  ];
  if (process.env.DEBUG_PROMPT) {
    console.log(`[prompt] count=${messagesOut.length}`);
    for (const m of messagesOut) console.log(`[prompt] ${m.role}: ${JSON.stringify(m.content.slice(0, 120))}`);
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 90000);
  try {
    const r = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: messagesOut,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: maxTokens,
        temperature: 1.0,
      }),
      signal: ac.signal,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      const e = new Error(`模型接口 ${r.status}${detail ? '：' + redactSecret(detail, cfg.apiKey) : ''}`);
      e.status = 502;
      throw e;
    }

    let text = '';
    let usage = null;
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let j;
        try { j = JSON.parse(data); } catch { continue; }
        if (j.usage) usage = j.usage;
        const piece = j.choices?.[0]?.delta?.content;
        if (piece) { text += piece; onDelta(piece); }
      }
    }
    lastConnectionTest = { ok: true, at: nowIso() };
    return { text, usage, breakdown: promptBundle.breakdown };
  } finally {
    clearTimeout(timer);
  }
}

function mockReply(text, memeId = '') {
  const low = /累|难过|低落/u.test(text);
  const post = text.includes('模拟自动动态') ? '我今天想把步子放慢一点。' : '';
  const wantsMeme = text.includes('发个表情');
  const forcedMeme = process.env.MOCK_MEME_ID || '';
  const meme = wantsMeme ? (forcedMeme || memeId || '') : '';
  const meta = { emotion: { pleasure: low ? -0.35 : 0.2, energy: low ? 0.3 : 0.62 }, signature: low ? '今天想慢一点。' : '今天也在认真听。', spacePost: post, meme };
  const block = `<anam-meta>${JSON.stringify(meta)}</anam-meta>`;
  // 仅测试用：验证"文字为空但表情有效"的回复。
  if (process.env.MOCK_MEME_ONLY === '1' && wantsMeme && meme) return block;
  return `我听到你说「${text}」。这是模拟回复，链路已经通了 —— 接上真模型后这里就换成它自己说的话。\n${block}`;
}

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.join(PUB, path.normalize(rel).replace(/^(\.\.[\\/])+/, ''));
  if (!file.startsWith(PUB)) return sendJson(res, 403, { error: 'forbidden' });
  fs.readFile(file, (err, buf) => {
    if (err) return sendJson(res, 404, { error: 'not found' });

    const etag = `"${crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16)}"`;
    const ext = path.extname(file);
    const isShell = rel === '/index.html' || rel === '/sw.js' || /\.(?:css|js)$/iu.test(rel);
    const headers = {
      'content-type': MIME[ext] || 'application/octet-stream',
      etag,
      // 入口、SW、CSS 与 JS 每次校验，确保部署更新不混用版本；图标等静态资源可短缓存。
      'cache-control': isShell ? 'no-cache' : 'public, max-age=3600, must-revalidate',
    };

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers);
      res.end();
      return;
    }
    res.writeHead(200, headers);
    res.end(buf);
  });
}

async function readBody(req, maxBytes = 1e6) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxBytes) {
      const err = new Error('request_body_too_large');
      err.code = 'BODY_TOO_LARGE';
      throw err;
    }
  }
  return body;
}

// ---------- 事件序号 / 环形缓冲 / 订阅（第 5 步：断线重连，小改法） ----------
// 每一帧都带全局递增 id；最近 2000 帧留在内存里。
// 客户端丢了连接，用 ?lastEventId=N 把 N 之后的帧原样补回来。
let eventSeq = 0;
const RING_MAX = 2000;
const ring = [];
const subs = new Set(); // GET /api/events 的订阅者

function frameText(frame) {
  return `id: ${frame.id}\nevent: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`;
}

function publish(event, data) {
  const frame = { id: ++eventSeq, event, data };
  ring.push(frame);
  if (ring.length > RING_MAX) ring.splice(0, ring.length - RING_MAX);
  for (const sub of subs) {
    if (sub.res.writableEnded) { subs.delete(sub); continue; }
    sub.res.write(frameText(frame));
  }
  return frame;
}

// 心跳：防止代理/手机省电把空闲连接掐掉（注释行不产生 id，客户端会忽略）
setInterval(() => {
  for (const sub of subs) {
    if (sub.res.writableEnded) { subs.delete(sub); continue; }
    sub.res.write(': ping\n\n');
  }
}, 20000).unref();

// ---------- SSE 与幂等 ----------
// 每条用户消息由客户端生成 id，服务端拿这个 id 当主键：
// 同一个 id 再来一次，只回放已有回复，绝不重复生成。
const inflight = new Map(); // 客户端 id -> { promise }

function sseStart(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
}

function sseSend(res, event, data) {
  if (res.writableEnded) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const findReplies = (userId) => messages.filter((m) => m.role === 'assistant' && m.replyTo === userId);

function replayReply(res, userMsg, replies) {
  sseStart(res);
  sseSend(res, 'user', userMsg);
  sseSend(res, 'start', { jobId: userMsg.id, at: userMsg.at, mode: replies[0]?.mode || 'mock', replay: true });
  for (const r of replies) sseSend(res, 'message', { jobId: userMsg.id, ...r });
  sseSend(res, 'done', { jobId: userMsg.id, ids: replies.map((r) => r.id), count: replies.length });
  sseSend(res, 'budget', { jobId: userMsg.id, ...budgetState() });
  res.end();
}

// ---------- 按句切分（第 4 条） ----------
// 切句、停顿、时间标签清理都在 lib/reply.mjs，纯函数可单测。

async function streamReply(res, userMsg, tokensIn) {
  sseStart(res);
  // 客户端断开后继续把回复生成完、落盘，断线重连时从环形缓冲补齐。
  let alive = true;
  res.on('close', () => { alive = false; });

  const jobId = userMsg.id;
  const day = localDay(); // 计入「受理这条消息」的那一天
  const mode = isMockMode() ? 'mock' : 'live';
  const replySpeed = replySpeedMultiplier(loadReplySpeed());
  const memeSnapshot = buildMemeCatalogSnapshot();
  const emit = (event, data) => {
    const frame = publish(event, { jobId, ...data });
    if (alive && !res.writableEnded) res.write(frameText(frame));
    return frame;
  };

  emit('user', { ...userMsg });
  emit('start', { at: nowIso(), mode });

  let buf = '';
  let metadataStarted = false;
  const saved = [];
  let lastLen = 0;
  let firstPart = true;
  const startedAt = Date.now();

  const flushPart = async (text) => {
    const clean = sanitizeReply(text);
    if (!clean) return;
    if (firstPart) {
      // 第一句：至少等够"思考+打字"的时间；模型本身更慢就不再补
      const wait = Math.max(0, TYPING_FIRST_MS - (Date.now() - startedAt));
      if (wait > 0) await sleep(wait);
      firstPart = false;
    } else {
      await sleep(Math.max(0, Math.round(partDelay(lastLen) * replySpeed)));
    }
    const msg = append({
      id: crypto.randomUUID(), role: 'assistant', text: clean, at: nowIso(), replyTo: userMsg.id, mode,
    });
    saved.push(msg);
    lastLen = clean.length;
    emit('message', { ...msg });
  };

  const consume = async (chunk, final) => {
    if (metadataStarted) {
      if (final) {
        const tail = buf.trim();
        buf = '';
        await flushPart(tail);
      }
      return;
    }
    buf += chunk;
    const markerAt = buf.indexOf('<anam-meta>');
    if (markerAt >= 0) {
      metadataStarted = true;
      buf = buf.slice(0, markerAt);
    }
    for (;;) {
      let cut = findSentenceCut(buf);
      if (!cut && buf.length >= MAX_PART) cut = findCommaCut(buf);
      if (!cut) break;
      const part = buf.slice(0, cut).trim();
      buf = buf.slice(cut);
      await flushPart(part);
    }
    if (final) {
      const tail = buf.trim();
      buf = '';
      await flushPart(tail);
    }
  };

  let usage = null;
  let breakdown = null;
  let reply = '';

  if (isMockMode()) {
    reply = mockReply(userMsg.text, memeSnapshot.selected[0]?.id || '');
    for (const ch of Array.from(reply)) {
      await consume(ch, false);
      await sleep(6);
    }
    await consume('', true);
  } else {
    // 按剩余额度收紧输出上限，避免一句话就把当天预算打穿。
    // flash 是推理模型，先烧 reasoning tokens，下限给到 256，免得正文被截空。
    const remaining = Math.max(0, BUDGET_YUAN - budgetState().spentYuan);
    const maxTokens = Math.max(256, Math.min(500, Math.floor((remaining / PRICE_OUT) * 1e6)));

    // onDelta 是同步回调，先入队；由 consumer 按句消费（切句 + 停顿）
    const queue = [];
    let streamingDone = false;
    const consumer = (async () => {
      while (!streamingDone || queue.length) {
        if (!queue.length) { await sleep(15); continue; }
        await consume(queue.shift(), false);
      }
    })();

    try {
      const out = await streamModel((piece) => {
        reply += piece;
        queue.push(piece);
      }, maxTokens, memeSnapshot);
      usage = out.usage || null;
      breakdown = out.breakdown || null;
    } catch (err) {
      streamingDone = true;
      await consumer.catch(() => {});
      console.error('[model]', redactSecret(err.message));
      emit('error', {
        message: redactSecret(err.message || '模型调用失败'),
        code: err.code || 'model_error',
        status: err.status || 502,
      });
      if (alive && !res.writableEnded) res.end();
      return; // 不记账；已切出的句子保留
    }
    streamingDone = true;
    await consumer;
    await consume('', true);
  }

  const parsedOutput = parseAssistantMetadata(reply);
  // 整条回复完成后再校验表情；无效只剥掉，不改写、不重新生成。
  const sticker = pickStickerFor(parsedOutput.metadata, memeSnapshot, userMsg.id);
  if (!saved.length && !sticker) {
    emit('error', { message: '模型没有返回内容', code: 'empty_reply', status: 502 });
    if (alive && !res.writableEnded) res.end();
    return;
  }

  // 文字先落盘/下发；表情作为独立消息追加在文字之后。
  if (sticker) {
    const stickerMessage = append({
      id: crypto.randomUUID(),
      role: 'assistant',
      at: nowIso(),
      type: 'sticker',
      media: { ref: memeRef(sticker.id), w: sticker.w, h: sticker.h, alt: sticker.label },
      replyTo: userMsg.id,
      mode,
    });
    saved.push(stickerMessage);
    emit('message', { ...stickerMessage });
  }

  for (const update of maybeSaveAssistantMetadata(parsedOutput.metadata, userMsg, saved)) emit(update.event, update.data);

  emit('done', { ids: saved.map((m) => m.id), count: saved.length });

  // 真模型：token 与花费以 API 返回的 usage 为准；没回 usage 才退回估算。
  const tokensOut = usage?.completion_tokens ?? estimateTokens(reply);
  const tokensInFinal = usage?.prompt_tokens ?? tokensIn;
  const cacheHitRaw = usage?.prompt_cache_hit_tokens ?? usage?.prompt_tokens_details?.cached_tokens;
  const cacheMissRaw = usage?.prompt_cache_miss_tokens
    ?? (Number.isFinite(Number(cacheHitRaw)) && Number.isFinite(Number(usage?.prompt_tokens))
      ? Number(usage.prompt_tokens) - Number(cacheHitRaw) : null);
  const reasoningRaw = usage?.completion_tokens_details?.reasoning_tokens ?? usage?.reasoning_tokens;
  recordUsage({
    day,
    mode,
    model: isMockMode() ? 'mock' : loadConfig().model,
    tokensIn: tokensInFinal,
    tokensOut,
    estimated: !usage,
    costYuan: costOf(tokensInFinal, tokensOut),
    ...(breakdown ? { breakdown } : {}),
    ...(Number.isFinite(Number(cacheHitRaw)) ? { promptCacheHit: Number(cacheHitRaw) } : {}),
    ...(Number.isFinite(Number(cacheMissRaw)) ? { promptCacheMiss: Number(cacheMissRaw) } : {}),
    ...(Number.isFinite(Number(reasoningRaw)) ? { reasoningTokens: Number(reasoningRaw) } : {}),
    userMsgId: userMsg.id,
    replyId: saved[0].id,
  });
  notifyReply(saved.map((m) => messageText(m)).join(' '));
  emit('budget', { ...budgetState() });
  void maybeSummarize();

  if (alive && !res.writableEnded) res.end();
}

// 非流式补全（"试说三句"用）
async function completeOnce(systemContent, userContent, maxTokens = 300, temperature = 1.0) {
  const cfg = loadConfig();
  if (!cfg.apiKey) {
    const e = new Error('还没配置 API key');
    e.code = 'missing_api_key';
    e.status = 503;
    throw e;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 60000);
  try {
    const r = await fetch(`${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
      signal: ac.signal,
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      const e = new Error(`模型接口 ${r.status}${detail ? '：' + redactSecret(detail, cfg.apiKey) : ''}`);
      e.status = 502;
      throw e;
    }
    const j = await r.json();
    lastConnectionTest = { ok: true, at: nowIso() };
    return { text: j.choices?.[0]?.message?.content || '', usage: j.usage || null, model: cfg.model };
  } finally {
    clearTimeout(timer);
  }
}

// 输入 token：人设 + L1 最近 30 轮 + 这一句（mock 阶段按字数估算）
function estimateInputTokens(text) {
  let n = estimateTokens(PERSONA) + estimateTokens(profileBlock()) + estimateTokens(signatureBlock()) + estimateTokens(memoryBlock(text)) + 12;
  for (const m of buildContextMessages()) n += estimateTokens(m.content) + 4;
  return n + estimateTokens(text) + 4;
}

function safeEndpoint(value) {
  const raw = String(value || '').trim().slice(0, 300);
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.toString().replace(/\/$/, '') : '';
  } catch { return ''; }
}

function currentEmotion() {
  const latest = emotionRows.at(-1);
  if (!latest) return { pleasure: 0, energy: 0.5, at: nowIso() };
  const days = Math.max(0, (now().getTime() - (Date.parse(latest.at) || now().getTime())) / 86400000);
  const decay = Math.pow(0.72, days);
  return {
    ...latest,
    pleasure: Number(((Number(latest.pleasure) || 0) * decay).toFixed(3)),
    energy: Number((0.5 + ((Number(latest.energy) || 0.5) - 0.5) * decay).toFixed(3)),
    at: nowIso(),
  };
}

function dailyAiPosts() {
  const today = localDay();
  return spaceRows.filter((row) => row.kind === 'post' && row.author === 'ai' && localDay(new Date(row.at)) === today).length;
}

function appendSpaceRow(row) {
  const stored = { v: SCHEMA, ...row, id: row.id || crypto.randomUUID(), at: row.at || nowIso() };
  appendJsonl(SPACE_LOG, stored);
  spaceRows.push(stored);
  return stored;
}

function spaceFeed() {
  const posts = new Map();
  for (const row of spaceRows) {
    if (row.kind === 'post') posts.set(row.id, { ...row, comments: [] });
    else if (row.kind === 'comment' && posts.has(row.postId)) posts.get(row.postId).comments.push(row);
  }
  return [...posts.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// 你发动态后，让她主动留一句评论（后台生成，不阻塞发帖请求）
async function commentOnUserPost(post) {
  if (!post || post.kind !== 'post' || post.author !== 'user') return;
  if (budgetState().blocked) return;
  const hasAiComment = () => spaceRows.some((row) => row.kind === 'comment' && row.postId === post.id && row.author === 'ai');
  if (hasAiComment()) return;
  try {
    let replyText;
    let usageInfo = null;
    if (isMockMode()) {
      replyText = '看到你发的这条，我停了一下。写它的时候，你是什么心情？';
    } else {
      const out = await completeOnce([
        buildSystemPrompt(new Date(), loadProfile(), post.text),
        '你正在自己的私密空间看到对方刚发的动态。自然、简短地回应一到两句，可以顺着内容问一个问题；不要复述全文，不要提隐私，不要像客服。',
      ].join('\n\n'), String(post.text).slice(0, 800), 200);
      replyText = out.text;
      usageInfo = out;
    }
    const clean = String(replyText || '').trim().slice(0, 600);
    if (!clean || hasAiComment()) return;
    const comment = appendSpaceRow({ kind: 'comment', author: 'ai', assistantId: 'anam', postId: post.id, text: clean });
    if (usageInfo) {
      const tokensIn = usageInfo.usage?.prompt_tokens ?? estimateTokens(post.text);
      const tokensOut = usageInfo.usage?.completion_tokens ?? estimateTokens(clean);
      recordUsage({ kind: 'space_post_reply', mode: 'live', model: usageInfo.model, tokensIn, tokensOut, estimated: !usageInfo.usage, costYuan: costOf(tokensIn, tokensOut), userMsgId: null, replyId: null });
    }
    publish('space', { kind: 'comment', postId: post.id, comment, aiComment: comment });
  } catch (err) {
    console.warn('[space-post-reply]', redactSecret(err.message));
  }
}

function memoryGraph() {
  const nodes = [];
  const edges = [];
  const seen = new Set();
  for (const record of memoryRecords()) {
    const id = `memory:${record.id}`;
    if (!seen.has(id)) {
      seen.add(id);
      nodes.push({ id, kind: record.kind, label: String(record.text).slice(0, 36), recordId: record.id });
    }
    // 不在图里铺开每条来源消息：几十条来源会糊成一个扇形；来源在摘要页和记忆卡里看
    if (record.kind === 'summary') {
      for (const entity of (record.entities || []).slice(0, 6)) {
        const entityId = `entity:${entity.name}`;
        if (!seen.has(entityId)) { seen.add(entityId); nodes.push({ id: entityId, kind: 'entity', label: entity.name }); }
        edges.push({ from: id, to: entityId, label: '提及' });
      }
      for (const relation of (record.relations || []).slice(0, 8)) {
        const from = `entity:${relation.from}`;
        const to = `entity:${relation.to}`;
        if (seen.has(from) && seen.has(to)) edges.push({ from, to, label: relation.label });
      }
    }
  }
  return { nodes: nodes.slice(0, 48), edges: edges.filter((e) => e.from && e.to).slice(0, 80) };
}

function updateMemoryRecord(id, payload, remove = false) {
  const fact = [...factsByKey.values()].find((row) => row.id === id);
  if (fact) {
    if (remove) {
      appendJsonl(MEMORY_OVERRIDE_LOG, { v: SCHEMA, op: 'delete_fact', id, key: fact.key, sourceId: fact.sourceId, at: nowIso() });
      deletedFactSources.add(`${fact.key}\u0000${fact.sourceId}`);
      factsByKey.delete(fact.key);
      appendJsonl(MEMORY_VECTOR_LOG, { v: SCHEMA, id, deleted: true, at: nowIso() });
      memoryVectors.delete(id);
      return { ok: true, deleted: true };
    }
    const quote = String(payload?.text || '').trim().slice(0, 180);
    if (!quote) return { ok: false, status: 400, message: '记忆内容不能为空。' };
    const updated = { ...fact, quote, edited: true, updatedAt: nowIso() };
    factsByKey.set(fact.key, updated);
    appendJsonl(FACT_LOG, updated);
    appendJsonl(MEMORY_VECTOR_LOG, { v: SCHEMA, id, deleted: true, at: nowIso() });
    memoryVectors.delete(id);
    return { ok: true, record: { ...updated, kind: 'fact', text: updated.quote, sourceIds: [updated.sourceId] } };
  }
  const summary = summariesById.get(id);
  if (summary) {
    if (remove) {
      summariesById.delete(id);
      appendJsonl(SUMMARY_LOG, { ...summary, deleted: true, at: nowIso() });
      appendJsonl(MEMORY_VECTOR_LOG, { v: SCHEMA, id, deleted: true, at: nowIso() });
      memoryVectors.delete(id);
      return { ok: true, deleted: true };
    }
    const text = String(payload?.text || '').trim().slice(0, 1600);
    if (!text) return { ok: false, status: 400, message: '记忆内容不能为空。' };
    const updated = { ...summary, summary: text, edited: true, updatedAt: nowIso() };
    summariesById.set(id, updated);
    appendJsonl(SUMMARY_LOG, updated);
    appendJsonl(MEMORY_VECTOR_LOG, { v: SCHEMA, id, deleted: true, at: nowIso() });
    memoryVectors.delete(id);
    return { ok: true, record: { ...updated, kind: 'summary', text } };
  }
  return { ok: false, status: 404, message: '没有找到这条记忆。' };
}

async function maybeSummarize({ force = false } = {}) {
  if (summaryInFlight) return { ok: false, message: '正在整理中，请稍等。' };
  const cursor = Math.max(0, ...summaryCursorById.values());
  const pendingUsers = messages.filter((m) => m.role === 'user' && m.seq > cursor);
  if (!pendingUsers.length) return { ok: false, skipped: true, message: '没有新的对话可整理。' };
  if (!force && pendingUsers.length < 20) {
    return { ok: false, skipped: true, message: `还需要 ${20 - pendingUsers.length} 轮对话才能自动整理。` };
  }
  const batch = pendingUsers.slice(0, 20);
  const turnIds = new Set(batch.map((m) => m.id));
  const throughUser = batch[batch.length - 1];
  const sourceMessages = messages.filter((m) => m.seq > cursor && (m.seq <= throughUser.seq
    || (m.role === 'assistant' && turnIds.has(m.replyTo))));
  const throughSeq = sourceMessages.at(-1)?.seq || throughUser.seq;
  if (!sourceMessages.length) return { ok: false, message: '没有可整理的来源消息。' };
  if (budgetState().blocked) return { ok: false, message: '今日预算已用完，摘要延后。' };
  summaryInFlight = true;
  try {
    let summary;
    if (isMockMode()) {
      const claims = batch.slice(0, 6).map((message) => ({ text: message.text.slice(0, 90), sourceId: message.id, evidence: message.text.slice(0, 180) }));
      summary = { summary: claims.map((claim) => claim.text).join('；').slice(0, 1500), claims, importance: 3, topics: [], entities: [], relations: [] };
    } else {
      const sourceText = sourceMessages.map((m) => `[${m.id}|${m.seq}|${m.role}] ${messageText(m).slice(0, 500)}`).join('\n').slice(0, 16000);
      const system = [
        '你是 Anam 的长期记忆整理器。只总结下面真实对话中明确出现的事实、事件、偏好和约定；不能补造或推断用户事实。',
        '只输出 JSON：最多6条 claims([{text,sourceId,evidence}])、importance(1到5)、topics(字符串数组)、entities([{name,sourceId}])、relations([{from,to,label,sourceId,evidence}])。每条 claim 简短，必须附 sourceId 和原文连续子串 evidence；没有明确原文支撑就省略，不输出自由发挥的 summary。',
        '实体必须原样出现在对应 sourceId 的原文里；关系必须有对应原文 evidence，且 evidence 必须是 sourceId 原文的连续子串。没有把握就不输出实体或关系。',
      ].join('\n');
      const estimateCost = costOf(estimateTokens(system + sourceText), 2400);
      if (budgetState().spentYuan + estimateCost > budgetState().limitYuan) {
        return { ok: false, message: '今日预算不足以完成这次整理，摘要延后。' };
      }
      try {
        const out = await completeOnce(system, sourceText, 2400, 0.3);
        const tokensIn = out.usage?.prompt_tokens ?? estimateTokens(system + sourceText);
        const tokensOut = out.usage?.completion_tokens ?? estimateTokens(out.text);
        recordUsage({ kind: 'memory_summary', mode: 'live', model: out.model, tokensIn, tokensOut, estimated: !out.usage, costYuan: costOf(tokensIn, tokensOut), userMsgId: null, replyId: null });
        let raw = out.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
        const parsed = JSON.parse(raw);
        const claims = validateSummaryClaims(parsed, sourceMessages).slice(0, 6);
        const grounded = validateSummaryRelations(parsed, sourceMessages);
        summary = {
          summary: claims.map((claim) => claim.text).join('；').slice(0, 1600),
          claims,
          importance: Math.max(1, Math.min(5, Number(parsed.importance) || 3)),
          topics: Array.isArray(parsed.topics) ? parsed.topics.filter((x) => typeof x === 'string').slice(0, 12).map((x) => x.slice(0, 48)) : [],
          ...grounded,
        };
        if (!summary.summary) throw new Error('模型没有返回带原文证据的有效摘要');
      } catch (err) {
        // 模型 JSON 截断/格式错误时退化为“用户原话摘要”，保证这一窗口不丢
        console.warn('[memory-summary] fallback:', redactSecret(err.message));
        const claims = batch
          .filter((message) => {
            const text = String(message.text || '').trim();
            // 纯提问/测试类消息不当作长期事实；至少留 6 个字
            return text.length >= 6 && !/[?？]\s*$/u.test(text);
          })
          .slice(0, 6)
          .map((message) => ({ text: message.text.slice(0, 90), sourceId: message.id, evidence: message.text.slice(0, 180) }))
          .filter((claim) => claim.text && claim.evidence);
        const text = claims.length
          ? claims.map((claim) => claim.text).join('；').slice(0, 1500)
          : '这一阶段没有可确认的长期事实（以提问/测试为主）。';
        summary = { summary: text, claims, importance: claims.length ? 2 : 1, topics: [], entities: [], relations: [], fallback: true };
      }
    }
    const record = {
      v: SCHEMA, id: crypto.randomUUID(), kind: 'summary', summary: summary.summary,
      claims: summary.claims || [], importance: summary.importance, topics: summary.topics,
      fallback: Boolean(summary.fallback),
      entities: summary.entities, relations: summary.relations,
      sourceIds: sourceMessages.map((m) => m.id),
      sourceSeqs: sourceMessages.map((m) => m.seq),
      sourceStartSeq: sourceMessages[0].seq, sourceEndSeq: throughSeq,
      throughSeq, at: nowIso(),
    };
    summariesById.set(record.id, record);
    summaryCursorById.set(record.id, throughSeq);
    appendJsonl(SUMMARY_LOG, record);
    publish('memory', { kind: 'summary', record });
    if (loadConfig().embeddingApiKey) void indexMemoryVectors([record]);
    return { ok: true, record };
  } catch (err) {
    console.warn('[memory-summary]', redactSecret(err.message));
    return { ok: false, message: `整理失败：${redactSecret(err.message)}` };
  } finally {
    summaryInFlight = false;
  }
}

function maybeSaveAssistantMetadata(metadata, userMsg, replies) {
  if (!metadata) return [];
  const updates = [];
  const source = replies.at(-1);
  let emotion = null;
  if (metadata.emotion) {
    emotion = smoothEmotion(currentEmotion(), metadata.emotion, nowIso());
    if (emotion) {
      const row = { v: SCHEMA, id: crypto.randomUUID(), assistantId: 'anam', ...emotion, sourceMessageId: source?.id || '', sourceSeq: source?.seq || 0 };
      emotionRows.push(row);
      appendJsonl(EMOTION_LOG, row);
      updates.push({ event: 'emotion', data: row });
    }
  }
  const signature = cleanSignature(metadata.signature);
  if (signature && signature !== loadProfile().signature) {
    const profile = saveProfile({ ...loadProfile(), signature });
    updates.push({ event: 'signature', data: { signature: profile.signature } });
  }
  const post = cleanSelfPost(metadata.spacePost, loadProfile(), [...factsByKey.values()], userMsg?.text || '');
  if (post && dailyAiPosts() < 5 && source) {
    const record = appendSpaceRow({ kind: 'post', author: 'ai', assistantId: 'anam', text: post, sourceIds: [source.id], sourceSeqs: [source.seq], emotionId: emotion?.id || null });
    updates.push({ event: 'space', data: { kind: 'post', post: { ...record, comments: [] } } });
  }
  return updates;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  try {
    // 所有 API 都要口令；静态页和图标保持公开（不含数据）。
    if (url.pathname.startsWith('/api/') && !checkAuth(req, res)) return;

    if (url.pathname === '/api/status' && req.method === 'GET') {
      return sendJson(res, 200, statusPayload());
    }

    if (url.pathname === '/api/usage/breakdown' && req.method === 'GET') {
      return sendJson(res, 200, usageBreakdownState());
    }

    if (url.pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        v: SCHEMA,
        boot: BOOT_ID,
        mode: isMockMode() ? 'mock' : 'live',
        model: isMockMode() ? 'mock' : loadConfig().model,
        key: Boolean(loadConfig().apiKey),
        memoryFacts: factsByKey.size,
        memorySummaries: summariesById.size,
        spacePosts: spaceRows.filter((row) => row.kind === 'post').length,
        auth: Boolean(loadConfig().accessPassword),
        messages: messages.length,
        lastSeq: nextSeq - 1,
        eventSeq,
        budget: budgetState(),
        backup: lastBackup,
        time: nowIso(),
        uptime: Math.round(process.uptime()),
      });
    }

    if (url.pathname === '/api/messages' && req.method === 'GET') {
      const rawLimit = Number(url.searchParams.get('limit'));
      const limit = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 200, 1), 500);
      const before = Number(url.searchParams.get('before')) || 0;
      const source = before > 0 ? messages.filter((m) => m.seq < before) : messages;
      const slice = source.slice(-limit);
      const firstSeq = slice[0]?.seq;
      // 是否还有比这一批更早的消息（给前端"加载更早"用）
      const hasMore = firstSeq !== undefined && messages.some((m) => m.seq < firstSeq);
      return sendJson(res, 200, { lastSeq: nextSeq - 1, messages: slice, hasMore });
    }

    // ---------- 表情包（V2 Phase 1：库 / 审核 / 取图；发送在 Phase 2） ----------
    if (url.pathname === '/api/memes' && req.method === 'GET') {
      const list = memes.map(memeView)
        .sort((a, b) => (Date.parse(b.created_at) - Date.parse(a.created_at)) || String(b.id).localeCompare(String(a.id)));
      return sendJson(res, 200, {
        memes: list,
        counts: memeCounts(),
        enabled: loadMemeEnabled(),
        strategy: loadMemeStrategy(),
        stats: memeStats(),
      });
    }

    if (url.pathname === '/api/memes' && req.method === 'POST') {
      let payload = {};
      try {
        payload = JSON.parse(await readBody(req, 3 * 1024 * 1024) || '{}');
      } catch (err) {
        return err.code === 'BODY_TOO_LARGE'
          ? sendJson(res, 413, { error: 'too_large', message: '图片超过 1.5MB。' })
          : sendJson(res, 400, { error: 'invalid_json', message: '上传数据不是合法 JSON。' });
      }

      const dataUrl = String(payload.dataUrl || '');
      const match = /^data:([^;,]+)?(;base64)?,([\s\S]+)$/u.exec(dataUrl);
      if (!match || !match[2]) return sendJson(res, 400, { error: 'invalid_data_url', message: '图片数据格式不对。' });
      let buffer;
      try { buffer = Buffer.from(match[3], 'base64'); } catch { return sendJson(res, 400, { error: 'invalid_data_url', message: '图片数据无法解码。' }); }
      if (!buffer.length) return sendJson(res, 400, { error: 'empty_image', message: '图片是空的。' });
      if (buffer.length > MEME_MAX_BYTES) return sendJson(res, 413, { error: 'too_large', message: '图片超过 1.5MB。' });
      if (memes.length >= MEME_MAX_COUNT) return sendJson(res, 409, { error: 'meme_limit', message: '表情包已满 100 张。' });

      const mime = sniffMime(buffer);
      if (!mime) return sendJson(res, 400, { error: 'unsupported_type', message: '只接受 PNG / JPEG / GIF / WebP。' });
      const dimensions = imageDimensions(buffer, mime);
      if (!dimensions) return sendJson(res, 400, { error: 'invalid_image', message: '图片尺寸无法解析。' });
      if (mime !== 'image/gif' && Math.max(dimensions.w, dimensions.h) > MEME_STATIC_EDGE) {
        return sendJson(res, 400, { error: 'too_large_dimensions', message: '静态图长边需要缩到 768。' });
      }

      const hash = sha256(buffer);
      const existing = memes.find((record) => record.hash === hash);
      if (existing) {
        return sendJson(res, 200, { ok: true, duplicate: true, meme: memeView(existing), counts: memeCounts() });
      }

      let id = newMemeId();
      while (memesById.has(id)) id = newMemeId();
      const ext = mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/gif' ? 'gif' : 'webp';
      const file = `${id}.${ext}`;
      const tmp = path.join(MEME_DIR, `.tmp-${id}`);
      try {
        fs.writeFileSync(tmp, buffer);
        fs.renameSync(tmp, path.join(MEME_DIR, file));
      } catch (err) {
        try { fs.rmSync(tmp, { force: true }); } catch { /* ignore */ }
        return sendJson(res, 500, { error: 'write_failed', message: `图片写入失败：${redactSecret(err.message)}` });
      }

      let preview = {};
      if (payload.previewDataUrl) {
        try {
          preview = saveMemePreview(id, payload.previewDataUrl);
        } catch (err) {
          try { fs.rmSync(path.join(MEME_DIR, file), { force: true }); } catch { /* ignore */ }
          return sendJson(res, err.httpStatus || 400, { error: err.message, message: '预览图无效。' });
        }
      }

      const record = normalizeMemeRecord({
        id, file, mime, w: dimensions.w, h: dimensions.h, bytes: buffer.length, hash,
        label: sanitizeLabel(payload.label), tags: sanitizeTags(payload.tags),
        reviewed: false, reviewed_at: null, enabled: true, pinned: false,
        created_at: nowIso(), updated_at: nowIso(),
        ...preview,
      });
      if (!record) {
        try { fs.rmSync(path.join(MEME_DIR, file), { force: true }); } catch { /* ignore */ }
        return sendJson(res, 400, { error: 'invalid_record', message: '图片记录无效。' });
      }
      await withMemeWrite(() => {
        memes.push(record);
        memesById.set(record.id, record);
        writeMemesFile();
      });
      return sendJson(res, 201, { ok: true, meme: memeView(record), counts: memeCounts() });
    }

    if (url.pathname === '/api/memes/settings' && req.method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      const hasStrategy = ['probability', 'minGapReplies', 'softFrequency'].some((key) => key in payload);
      let strategy = loadMemeStrategy();
      if (hasStrategy) {
        try { strategy = saveMemeStrategy(payload); } catch (err) { return sendJson(res, 400, { error: err.message, message: '发送策略参数无效。' }); }
      }
      let enabled = loadMemeEnabled();
      if ('enabled' in payload) enabled = saveMemeEnabled(payload.enabled !== false);
      return sendJson(res, 200, { ok: true, enabled, strategy, stats: memeStats() });
    }

    const memePreviewMatch = url.pathname.match(/^\/api\/memes\/([^/]+)\/preview$/u);
    if (memePreviewMatch && req.method === 'POST') {
      const id = memePreviewMatch[1];
      if (!isSafeMemeId(id) || !memesById.has(id)) return sendJson(res, 404, { error: 'meme_not_found' });
      let payload = {};
      try { payload = JSON.parse(await readBody(req, 1024 * 1024) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      let preview;
      try {
        preview = saveMemePreview(id, payload.dataUrl);
      } catch (err) {
        return sendJson(res, err.httpStatus || 400, { error: err.message, message: '预览图无效。' });
      }
      const record = memesById.get(id);
      const oldPreview = record.previewFile;
      Object.assign(record, preview, { updated_at: nowIso() });
      await withMemeWrite(() => writeMemesFile());
      if (oldPreview && oldPreview !== preview.previewFile) {
        try { fs.rmSync(path.join(MEME_PREVIEW_DIR, oldPreview), { force: true }); } catch { /* ignore */ }
      }
      return sendJson(res, 200, { ok: true, meme: memeView(record), counts: memeCounts() });
    }

    if (memePreviewMatch && req.method === 'GET') {
      const id = memePreviewMatch[1];
      if (!isSafeMemeId(id)) return sendJson(res, 400, { error: 'invalid_id' });
      const record = memesById.get(id);
      if (!record || !record.previewFile) return sendJson(res, 404, { error: 'preview_not_found' });
      const file = path.join(MEME_PREVIEW_DIR, record.previewFile);
      let stat;
      try { stat = fs.statSync(file); } catch { return sendJson(res, 404, { error: 'preview_not_found' }); }
      res.writeHead(200, {
        'content-type': record.previewMime || 'image/png',
        'content-length': stat.size,
        'cache-control': 'private, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      });
      const stream = fs.createReadStream(file);
      stream.on('error', () => { try { res.destroy(); } catch { /* ignore */ } });
      stream.pipe(res);
      return;
    }

    const memeUsageMatch = url.pathname.match(/^\/api\/memes\/([^/]+)\/usage$/u);
    if (memeUsageMatch && req.method === 'GET') {
      const id = memeUsageMatch[1];
      if (!isSafeMemeId(id) || !memesById.has(id)) return sendJson(res, 404, { error: 'meme_not_found' });
      return sendJson(res, 200, { ok: true, id, references: memeUsageCount(id) });
    }

    const memeFileMatch = url.pathname.match(/^\/api\/memes\/([^/]+)\/file$/u);
    if (memeFileMatch && req.method === 'GET') {
      const id = memeFileMatch[1];
      if (!isSafeMemeId(id)) return sendJson(res, 400, { error: 'invalid_id' });
      const record = memesById.get(id);
      if (!record || corruptedMemes.has(id)) return sendJson(res, 404, { error: 'meme_not_found' });
      const file = memeFilePath(record);
      let stat;
      try { stat = fs.statSync(file); } catch { return sendJson(res, 404, { error: 'meme_not_found' }); }
      res.writeHead(200, {
        'content-type': record.mime || 'application/octet-stream',
        'content-length': stat.size,
        'cache-control': 'private, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      });
      const stream = fs.createReadStream(file);
      stream.on('error', () => { try { res.destroy(); } catch { /* ignore */ } });
      stream.pipe(res);
      return;
    }

    const memeIdMatch = url.pathname.match(/^\/api\/memes\/([^/]+)$/u);
    if (memeIdMatch && req.method === 'PATCH') {
      const id = memeIdMatch[1];
      if (!isSafeMemeId(id) || !memesById.has(id)) return sendJson(res, 404, { error: 'meme_not_found' });
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      try {
        await withMemeWrite(() => {
          const record = memesById.get(id);
          if (typeof payload.label === 'string') record.label = sanitizeLabel(payload.label);
          if (payload.tags !== undefined) record.tags = sanitizeTags(payload.tags);
          if (typeof payload.reviewed === 'boolean') {
            if (payload.reviewed && !record.label) {
              const err = new Error('label_required');
              err.httpStatus = 400;
              throw err;
            }
            record.reviewed = payload.reviewed;
            record.reviewed_at = payload.reviewed ? (record.reviewed_at || nowIso()) : null;
          }
          if (typeof payload.enabled === 'boolean') record.enabled = payload.enabled;
          if (typeof payload.pinned === 'boolean') record.pinned = payload.pinned;
          // label 被清空时自动取消审核，保证"已审核必须有 label"
          if (record.reviewed && !record.label) { record.reviewed = false; record.reviewed_at = null; }
          record.updated_at = nowIso();
          writeMemesFile();
        });
      } catch (err) {
        return sendJson(res, err.httpStatus || 400, { error: err.message, message: err.message === 'label_required' ? '先填名称再审核。' : '保存失败。' });
      }
      return sendJson(res, 200, { ok: true, meme: memeView(memesById.get(id)), counts: memeCounts() });
    }

    if (memeIdMatch && req.method === 'DELETE') {
      const id = memeIdMatch[1];
      if (!isSafeMemeId(id) || !memesById.has(id)) return sendJson(res, 404, { error: 'meme_not_found' });
      const references = memeUsageCount(id);
      if (url.searchParams.get('confirm') !== '1') {
        return sendJson(res, 409, { error: 'confirm_required', references, message: `这张图被 ${references} 条历史消息引用，确认后才会删除。` });
      }
      const record = memesById.get(id);
      await withMemeWrite(() => {
        const index = memes.findIndex((row) => row.id === id);
        if (index >= 0) memes.splice(index, 1);
        memesById.delete(id);
        corruptedMemes.delete(id);
        writeMemesFile();
      });
      if (record) {
        try { fs.rmSync(memeFilePath(record), { force: true }); } catch { /* 启动时还会清理孤儿 */ }
        if (record.previewFile) {
          try { fs.rmSync(path.join(MEME_PREVIEW_DIR, record.previewFile), { force: true }); } catch { /* ignore */ }
        }
      }
      return sendJson(res, 200, { ok: true, deleted: true, id, references });
    }

    if (url.pathname === '/api/memory' && req.method === 'GET') {
      const query = String(url.searchParams.get('q') || '').trim().slice(0, 300);
      const queryVector = query ? await embedQuery(query) : null;
      const results = retrieveMemories(memoryRecords(), query, { vectors: memoryVectors, queryVector, limit: 40 });
      const found = results.map(({ record, score }) => ({
        ...record,
        score: Number(score.toFixed(3)),
        sources: (record.sourceIds || [record.sourceId]).filter(Boolean).map((id) => messages.find((m) => m.id === id)).filter(Boolean)
          .map((m) => ({ id: m.id, seq: m.seq, role: m.role, text: m.text, at: m.at })),
      }));
      return sendJson(res, 200, {
        records: found,
        graph: memoryGraph(),
        counts: { facts: factsByKey.size, summaries: summariesById.size, indexed: memoryVectors.size },
        embeddingConfigured: publicSettings().embedding.configured,
      });
    }

    if (url.pathname === '/api/memory/summaries' && req.method === 'GET') {
      const list = [...summariesById.values()]
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .map((row) => ({
          id: row.id,
          at: row.at,
          summary: row.summary,
          claims: row.claims || [],
          importance: row.importance,
          fallback: Boolean(row.fallback),
          sourceStartSeq: row.sourceStartSeq,
          sourceEndSeq: row.sourceEndSeq,
          sources: (row.sourceIds || [])
            .map((id) => messages.find((m) => m.id === id))
            .filter(Boolean)
            .slice(0, 6)
            .map((m) => ({ seq: m.seq, role: m.role, text: m.text, at: m.at })),
        }));
      return sendJson(res, 200, { summaries: list });
    }

    if (url.pathname === '/api/memory/graph' && req.method === 'GET') {
      return sendJson(res, 200, { graph: memoryGraph() });
    }

    if (url.pathname === '/api/memory/index' && req.method === 'POST') {
      if (!publicSettings().embedding.configured) return sendJson(res, 409, { error: 'embedding_not_configured', message: '请先配置 Embedding 接口、模型、Key 和单价。' });
      if (isMockMode()) return sendJson(res, 200, { ok: true, mode: 'mock', indexed: 0, message: '模拟模式不会调用 Embedding 服务或写入虚假向量。' });
      const result = await indexMemoryVectors(memoryRecords());
      return sendJson(res, result.indexed ? 200 : 402, {
        ok: result.indexed > 0,
        ...result,
        budget: budgetState(),
        message: result.indexed ? `已建立 ${result.indexed} 条记忆的语义索引。` : '没有建立索引；请检查预算或 Embedding 设置。',
      });
    }

    if (url.pathname === '/api/memory/summarize' && req.method === 'POST') {
      const result = await maybeSummarize({ force: true });
      if (result.ok) return sendJson(res, 200, { ok: true, record: result.record });
      return sendJson(res, result.skipped ? 409 : 502, { ok: false, message: result.message || '整理失败' });
    }

    const memoryRecordMatch = url.pathname.match(/^\/api\/memory\/([^/]+)$/u);
    if (memoryRecordMatch && (req.method === 'PATCH' || req.method === 'DELETE')) {
      let payload = {};
      if (req.method === 'PATCH') {
        try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      }
      const outcome = updateMemoryRecord(decodeURIComponent(memoryRecordMatch[1]), payload, req.method === 'DELETE');
      if (!outcome.ok) return sendJson(res, outcome.status || 400, { error: 'memory_update_failed', message: outcome.message });
      return sendJson(res, 200, outcome);
    }

    if (url.pathname === '/api/emotion' && req.method === 'GET') {
      const days = Math.min(180, Math.max(1, Number(url.searchParams.get('days') || 30)));
      const since = now().getTime() - days * 86400000;
      const points = emotionRows.filter((row) => Date.parse(row.at) >= since);
      return sendJson(res, 200, { points, current: currentEmotion(), signature: loadProfile().signature });
    }

    if (url.pathname === '/api/space' && req.method === 'GET') {
      return sendJson(res, 200, { posts: spaceFeed(), current: currentEmotion(), signature: loadProfile().signature, dailyAiPosts: dailyAiPosts() });
    }

    if (url.pathname === '/api/space/posts' && req.method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      const text = String(payload.text || '').trim().slice(0, 1200);
      if (!text) return sendJson(res, 400, { error: 'empty_post', message: '动态内容不能为空。' });
      const post = appendSpaceRow({ kind: 'post', author: 'user', text, sourceIds: [], sourceSeqs: [] });
      publish('space', { kind: 'post', post: { ...post, comments: [] } });
      void commentOnUserPost(post);
      return sendJson(res, 201, { post: { ...post, comments: [] } });
    }

    const commentMatch = url.pathname.match(/^\/api\/space\/posts\/([^/]+)\/comments$/u);
    if (commentMatch && req.method === 'POST') {
      const postId = decodeURIComponent(commentMatch[1]);
      const post = spaceRows.find((row) => row.kind === 'post' && row.id === postId);
      if (!post) return sendJson(res, 404, { error: 'post_not_found' });
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      const text = String(payload.text || '').trim().slice(0, 800);
      if (!text) return sendJson(res, 400, { error: 'empty_comment', message: '评论不能为空。' });
      const comment = appendSpaceRow({ kind: 'comment', author: 'user', postId, text });
      let aiComment = null;
      if (!budgetState().blocked) {
        try {
          let replyText;
          let usageInfo = null;
          if (isMockMode()) replyText = '我看到你的留言了，想再听你多说一点。';
          else {
            const out = await completeOnce([
              buildSystemPrompt(new Date(), loadProfile(), text),
              '你正在自己的私密空间回复一条评论。自然、简短地回应，不要暴露聊天记录中的用户隐私。',
            ].join('\n\n'), `动态：${post.text}\n评论：${text}`, 180);
            replyText = out.text;
            usageInfo = out;
          }
          const clean = String(replyText || '').trim().slice(0, 600);
          if (clean) {
            aiComment = appendSpaceRow({ kind: 'comment', author: 'ai', assistantId: 'anam', postId, text: clean });
            if (usageInfo) {
              const tokensIn = usageInfo.usage?.prompt_tokens ?? estimateTokens(text + post.text);
              const tokensOut = usageInfo.usage?.completion_tokens ?? estimateTokens(clean);
              recordUsage({ kind: 'space_comment', mode: 'live', model: usageInfo.model, tokensIn, tokensOut, estimated: !usageInfo.usage, costYuan: costOf(tokensIn, tokensOut), userMsgId: null, replyId: null });
            }
          }
        } catch (err) { console.warn('[space-comment]', redactSecret(err.message)); }
      }
      publish('space', { kind: 'comment', postId, comment, aiComment });
      return sendJson(res, 201, { comment, aiComment, aiUnavailable: !aiComment });
    }

    if (url.pathname === '/api/weather/status' && req.method === 'GET') {
      return sendJson(res, 200, weatherStatusPayload());
    }

    if (url.pathname === '/api/weather/city' && req.method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      const city = String(payload.city || '').trim().slice(0, 60);
      if (!city) {
        writeConfigPatch({ weatherCity: '', weatherLat: null, weatherLon: null });
        return sendJson(res, 200, { ok: true, ...weatherStatusPayload() });
      }
      let lat = Number(payload.lat);
      let lon = Number(payload.lon);
      let resolvedCity = city;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        try {
          const hit = await geocodeCity(city);
          lat = hit.lat;
          lon = hit.lon;
          resolvedCity = hit.name;
        } catch (err) {
          return sendJson(res, 400, { error: 'city_not_found', message: err.message === 'city_not_found' ? '找不到这个城市。' : '城市查询失败，请稍后再试。' });
        }
      }
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return sendJson(res, 400, { error: 'invalid_coordinates' });
      writeConfigPatch({ weatherCity: resolvedCity, weatherLat: lat, weatherLon: lon });
      await refreshWeather();
      return sendJson(res, 200, { ok: true, ...weatherStatusPayload() });
    }

    if (url.pathname === '/api/weather/refresh' && req.method === 'POST') {
      await refreshWeather();
      return sendJson(res, 200, { ok: true, ...weatherStatusPayload() });
    }

    if (url.pathname === '/api/push/vapid' && req.method === 'POST') {
      if (pushConfigured()) return sendJson(res, 200, { ok: true, publicKey: readConfig().vapidPublicKey });
      const keys = generateVapidKeys();
      writeSecretConfig({ vapidPrivateKey: keys.privateJwk });
      writeConfigPatch({ vapidPublicKey: keys.publicKey });
      return sendJson(res, 200, { ok: true, publicKey: keys.publicKey });
    }

    if (url.pathname === '/api/push/vapid-public-key' && req.method === 'GET') {
      const publicKey = readConfig().vapidPublicKey;
      if (!publicKey) return sendJson(res, 404, { error: 'push_not_configured' });
      return sendJson(res, 200, { publicKey });
    }

    if (url.pathname === '/api/push/status' && req.method === 'GET') {
      return sendJson(res, 200, pushStatusPayload());
    }

    if (url.pathname === '/api/push/subscribe' && req.method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      const endpoint = String(payload.endpoint || '').trim();
      const p256dh = String(payload.keys?.p256dh || '').trim();
      const auth = String(payload.keys?.auth || '').trim();
      if (!/^https:\/\//u.test(endpoint) || endpoint.length > 2048 || !p256dh || !auth) return sendJson(res, 400, { error: 'invalid_subscription' });
      pushSubscriptions = pushSubscriptions.filter((row) => row.endpoint !== endpoint);
      pushSubscriptions.push({ endpoint, keys: { p256dh, auth }, at: nowIso() });
      savePushSubscriptions();
      writeConfigPatch({ pushEnabled: true });
      return sendJson(res, 200, { ok: true, ...pushStatusPayload() });
    }

    if (url.pathname === '/api/push/unsubscribe' && req.method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      const endpoint = String(payload.endpoint || '').trim();
      pushSubscriptions = pushSubscriptions.filter((row) => row.endpoint !== endpoint);
      savePushSubscriptions();
      if (!pushSubscriptions.length) writeConfigPatch({ pushEnabled: false });
      return sendJson(res, 200, { ok: true, ...pushStatusPayload() });
    }

    if (url.pathname === '/api/push/test' && req.method === 'POST') {
      if (!pushConfigured()) return sendJson(res, 409, { error: 'push_not_configured' });
      const result = await sendPushToAll({ title: 'Anam', body: '推送测试：连接成功。', tag: 'anam-test', url: '/' });
      return sendJson(res, 200, { ok: true, ...result, ...pushStatusPayload() });
    }

    if (url.pathname === '/api/settings' && req.method === 'GET') {
      return sendJson(res, 200, publicSettings());
    }

    if (url.pathname === '/api/settings/reply-speed' && req.method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      if (!['slow', 'normal', 'fast'].includes(payload.speed)) return sendJson(res, 400, { error: 'invalid_reply_speed' });
      const speed = saveReplySpeed(payload.speed);
      return sendJson(res, 200, { ok: true, replySpeed: speed });
    }

    if (url.pathname === '/api/settings' && req.method === 'POST') {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      if (payload.embedding && typeof payload.embedding === 'object') {
        const emb = payload.embedding;
        const cfg = loadConfig();
        const patchConfig = {};
        const rawBase = String(emb.baseUrl ?? cfg.embeddingBaseUrl ?? '').trim();
        const baseUrl = rawBase ? safeEndpoint(rawBase) : '';
        if (rawBase && !baseUrl) return sendJson(res, 400, { error: 'invalid_embedding_base', message: 'Embedding 地址必须是有效的 HTTP 或 HTTPS 地址。' });
        const model = String(emb.model ?? cfg.embeddingModel ?? '').trim();
        if (model.length > 128 || /[\r\n\u0000]/u.test(model)) return sendJson(res, 400, { error: 'invalid_embedding_model' });
        const rawPrice = emb.priceYuanPerMTok === undefined ? cfg.embeddingPrice : emb.priceYuanPerMTok;
        const price = rawPrice === '' || rawPrice === null ? null : Number(rawPrice);
        if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1000000)) return sendJson(res, 400, { error: 'invalid_embedding_price', message: '单价必须是 0 到 1000000 之间的元/百万 Token。' });
        if (emb.clearApiKey === true) {
          if (process.env.EMBEDDING_API_KEY) return sendJson(res, 409, { error: 'environment_managed', message: 'Embedding Key 由环境变量管理。' });
          patchConfig.embeddingApiKey = '';
        } else if (typeof emb.apiKey === 'string' && emb.apiKey.trim()) {
          const apiKey = emb.apiKey.trim();
          if (apiKey.length > 512 || /[\r\n\u0000]/u.test(apiKey)) return sendJson(res, 400, { error: 'invalid_embedding_key' });
          patchConfig.embeddingApiKey = apiKey;
        }
        patchConfig.embeddingBaseUrl = baseUrl;
        patchConfig.embeddingModel = model;
        patchConfig.embeddingPrice = price;
        if (baseUrl !== cfg.embeddingBaseUrl || model !== cfg.embeddingModel) memoryVectors.clear();
        writeSecretConfig(patchConfig);
        return sendJson(res, 200, { ok: true, settings: publicSettings() });
      }
      if (process.env.DEEPSEEK_API_KEY) {
        return sendJson(res, 409, { error: 'environment_managed', message: 'API key 由环境变量管理，请在那里修改。' });
      }
      if (payload.clearApiKey === true) {
        writeSecretConfig({ apiKey: '' });
        lastConnectionTest = null;
      } else if (typeof payload.apiKey === 'string' && payload.apiKey.trim()) {
        const apiKey = payload.apiKey.trim();
        if (apiKey.length > 512 || /[\r\n\u0000]/.test(apiKey)) {
          return sendJson(res, 400, { error: 'invalid_api_key', message: 'API key 格式不正确。' });
        }
        writeSecretConfig({ apiKey });
        lastConnectionTest = null;
      } else {
        return sendJson(res, 400, { error: 'missing_api_key', message: '请输入 API key，或明确选择清除。' });
      }
      return sendJson(res, 200, { ok: true, settings: publicSettings() });
    }

    if (url.pathname === '/api/settings/embedding/test' && req.method === 'POST') {
      const cfg = loadConfig();
      if (!publicSettings().embedding.configured) return sendJson(res, 503, { ok: false, message: '请先完整配置 Embedding 地址、模型、Key 和单价。' });
      if (isMockMode()) return sendJson(res, 200, { ok: true, mode: 'mock', message: '模拟模式已验证配置，不会连接 Embedding 服务。', budget: budgetState() });
      const vectors = await requestEmbeddings(['Anam memory connection test'], { kind: 'embedding_test' });
      if (!vectors) {
        const state = budgetState();
        return sendJson(res, state.blocked ? 402 : 502, { ok: false, error: state.blocked ? 'budget_exceeded' : 'embedding_unavailable', message: state.blocked ? '今日预算已用完。' : 'Embedding 请求失败或预算不足，聊天仍可回退到本地检索。', budget: state });
      }
      return sendJson(res, 200, { ok: true, model: cfg.embeddingModel, message: 'Embedding 连接成功。', budget: budgetState() });
    }

    if (url.pathname === '/api/settings/test' && req.method === 'POST') {
      const cfg = loadConfig();
      if (!cfg.apiKey) return sendJson(res, 503, { ok: false, message: '还没有配置 API key。' });
      const budget = budgetState();
      if (budget.blocked) {
        return sendJson(res, 402, { ok: false, error: 'budget_exceeded', message: '今日预算已用完，不能发起模型测试。', budget });
      }
      try {
        const out = await completeOnce('只回复 OK。', '连接测试，请回复 OK。', 8);
        const tokensIn = out.usage?.prompt_tokens ?? estimateTokens('只回复 OK。连接测试，请回复 OK。');
        const tokensOut = out.usage?.completion_tokens ?? estimateTokens(out.text);
        recordUsage({
          kind: 'connection_test', mode: 'live', model: out.model,
          tokensIn, tokensOut, estimated: !out.usage,
          costYuan: costOf(tokensIn, tokensOut), userMsgId: null, replyId: null,
        });
        return sendJson(res, 200, { ok: true, model: out.model, message: '模型连接成功。', budget: budgetState() });
      } catch (err) {
        lastConnectionTest = { ok: false, at: nowIso() };
        return sendJson(res, err.status || 502, { ok: false, message: redactSecret(err.message || '模型连接失败') });
      }
    }

    if (url.pathname === '/api/provider/balance' && req.method === 'GET') {
      return sendJson(res, 200, await refreshProviderBalance());
    }

    // ---------- 人格（D2） ----------
    if (url.pathname === '/api/profile' && req.method === 'GET') {
      return sendJson(res, 200, { profile: loadProfile() });
    }

    if (url.pathname === '/api/profile' && req.method === 'POST') {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch { /* ignore */ }
      const profile = saveProfile(payload.profile || {});
      return sendJson(res, 200, { ok: true, profile });
    }

    if (url.pathname === '/api/user-profile' && req.method === 'GET') {
      return sendJson(res, 200, { profile: loadUserProfile() });
    }
    if (url.pathname === '/api/user-profile' && req.method === 'POST') {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch { /* ignore */ }
      return sendJson(res, 200, { ok: true, profile: saveUserProfile(payload.profile || {}) });
    }

    // 用草稿设定试说三句，不保存
    if (url.pathname === '/api/profile/preview' && req.method === 'POST') {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch { /* ignore */ }

      const budget = budgetState();
      if (budget.blocked) {
        return sendJson(res, 402, {
          error: 'budget_exceeded',
          message: '今天的额度用完了，明天再试。',
          budget,
        });
      }

      if (isMockMode()) {
        return sendJson(res, 200, {
          lines: [
            '（模拟）第一句：用现在的设定说一句。',
            '（模拟）第二句：语气和边界会体现在这里。',
            '（模拟）第三句：接上真模型后就是它自己说的话。',
          ],
        });
      }

      const draft = payload.profile && typeof payload.profile === 'object' ? payload.profile : loadProfile();
      const system = [
        buildSystemPrompt(new Date(), draft),
        '现在只输出 3 句示例回复：每行一句，不要编号、不要解释、不要加引号。',
      ].filter(Boolean).join('\n\n');

      try {
        const out = await completeOnce(system, '（试说三句）用你现在的设定，对我说三句你会说的话。', 300);
        const lines = out.text
          .split('\n')
          .map((s) => s.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/, '').replace(/^["“]|["”]$/g, '').trim())
          .filter(Boolean)
          .slice(0, 3);
        const tokensIn = out.usage?.prompt_tokens ?? estimateTokens(system);
        const tokensOut = out.usage?.completion_tokens ?? estimateTokens(out.text);
        recordUsage({
          kind: 'preview',
          mode: 'live',
          model: out.model,
          tokensIn,
          tokensOut,
          estimated: !out.usage,
          costYuan: costOf(tokensIn, tokensOut),
          userMsgId: null,
          replyId: null,
        });
        return sendJson(res, 200, { lines: lines.length ? lines : [out.text.trim()] });
      } catch (err) {
        return sendJson(res, err.status || 502, {
          error: err.code || 'model_error',
          message: err.message || '生成失败',
        });
      }
    }

    // 断线续传：把 lastEventId 之后的帧原样发回来，然后保持连接等新帧。
    if (url.pathname === '/api/events' && req.method === 'GET') {
      const rawLast = url.searchParams.get('lastEventId') ?? req.headers['last-event-id'] ?? 0;
      const last = Math.max(0, Number(rawLast) || 0);
      const clientBoot = String(url.searchParams.get('boot') || '');

      sseStart(res);
      res.write('retry: 3000\n\n');
      const sub = { res };
      subs.add(sub);
      res.on('close', () => subs.delete(sub));
      res.on('error', () => subs.delete(sub));

      const oldest = ring.length ? ring[0].id : eventSeq + 1;
      const lost = (clientBoot && clientBoot !== BOOT_ID)
        || last > eventSeq
        || (last > 0 && last < oldest - 1);

      sseSend(res, 'hello', { boot: BOOT_ID, eventSeq, mode: isMockMode() ? 'mock' : 'live', schema: SCHEMA });
      if (lost) {
        // 缓冲已被覆盖 / 服务重启过：给一份快照，客户端以快照为准。
        sseSend(res, 'resync', { boot: BOOT_ID, eventSeq, messages: messages.slice(-200), hasMore: messages.length > 200 });
      } else {
        for (const f of ring) if (f.id > last) res.write(frameText(f));
      }
      return;
    }

    if (url.pathname === '/api/budget/override' && req.method === 'POST') {
      let payload = {};
      try { payload = JSON.parse(await readBody(req) || '{}'); } catch { return sendJson(res, 400, { error: 'invalid_json' }); }
      const mode = payload.mode === 'clear' ? 'clear' : 'day';
      saveBudgetOverride(mode === 'clear' ? null : { day: localDay(), mode: 'day', at: nowIso() });
      const budget = budgetState();
      publish('budget', budget);
      return sendJson(res, 200, { ok: true, mode, budget });
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = await readBody(req);
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch { /* ignore */ }

      const text = String(payload.text ?? '').slice(0, 4000).trim();
      const clientId = String(payload.id ?? '').trim();
      if (!text) return sendJson(res, 400, { error: 'empty_message' });
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(clientId)) {
        return sendJson(res, 400, { error: 'missing_id', message: '客户端必须为每条消息生成一个 id' });
      }

      // 幂等：这个 id 已经处理过 / 正在处理
      const existing = messages.find((m) => m.role === 'user' && m.id === clientId);
      if (existing) {
        if (existing.text !== text) {
          return sendJson(res, 409, { error: 'id_conflict', message: '同一个 id 不能对应不同内容' });
        }
        const replies = findReplies(clientId);
        if (replies.length) return replayReply(res, existing, replies);

        const job = inflight.get(clientId);
        if (job) {
          await job.promise.catch(() => {});
          const done = findReplies(clientId);
          if (done.length) return replayReply(res, existing, done);
        }
        // 有 user 没回复、也没在跑（比如上次进程崩在中间）：就着这条继续生成
        if (!isMockMode() && !loadConfig().apiKey) {
          return sendJson(res, 503, { error: 'missing_api_key', message: '还没配置 API key，这条先发不出去。' });
        }
        return streamReply(res, existing, estimateInputTokens(existing.text));
      }

      const budget = budgetState();
      if (budget.blocked) {
        const tokenHit = budget.tokens >= budget.tokenLimit;
        const reason = tokenHit
          ? `今天 token 用量已到上限（${budget.tokens} / ${budget.tokenLimit}）`
          : `今天的金额额度用完了（已花 ¥${budget.spentYuan.toFixed(3)} / 上限 ¥${budget.limitYuan.toFixed(2)}）`;
        return sendJson(res, 402, {
          error: 'budget_exceeded',
          message: `${reason}，明天再来吧；也可以选择今天继续。`,
          budget,
        });
      }

      if (!isMockMode() && !loadConfig().apiKey) {
        return sendJson(res, 503, {
          error: 'missing_api_key',
          message: '还没配置 API key：把它写进 app\\data\\secret.json，或设置环境变量 DEEPSEEK_API_KEY。',
        });
      }

      const userMsg = append({ id: clientId, role: 'user', text, at: nowIso() });
      const newFacts = indexUserFacts(userMsg);
      if (newFacts.length && loadConfig().embeddingApiKey) void indexMemoryVectors(newFacts.map((row) => ({ ...row, kind: 'fact', text: row.quote })));
      const job = { promise: null };
      job.promise = streamReply(res, userMsg, estimateInputTokens(text))
        .finally(() => inflight.delete(clientId));
      inflight.set(clientId, job);
      await job.promise;
      return;
    }

    if (req.method === 'GET') return serveStatic(req, res, url.pathname);
    return sendJson(res, 404, { error: 'not found' });
  } catch (err) {
    console.error('[error]', redactSecret(err?.message || 'unexpected error'));
    if (!res.headersSent) sendJson(res, 500, { error: 'internal error' });
    else res.end();
  }
});

ensureDailyBackup();
setInterval(ensureDailyBackup, 60 * 60 * 1000).unref();
void refreshWeather();
setInterval(() => { void refreshWeather(); }, 60 * 60 * 1000).unref();

server.listen(PORT, HOST, () => {
  console.log(`[companion] http://${HOST}:${PORT}  mode=${isMockMode() ? 'mock' : 'live'}  schema=v${SCHEMA}  history=${messages.length}  data=${DATA}  auth=${loadConfig().accessPassword ? 'on' : 'off'}`);
});
