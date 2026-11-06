// 表情包库的纯函数：ID、魔数、尺寸、标签、目录选择、备份校验。
// 不依赖 DOM / 网络；服务端、测试脚本共用。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MEME_MAX_BYTES = 1.5 * 1024 * 1024;
export const MEME_MAX_COUNT = 100;
export const MEME_STATIC_EDGE = 768;
export const MEME_CATALOG_MAX = 50;
export const MEME_LABEL_MAX = 20;
export const MEME_TAGS_MAX = 2;
export const MEME_TAG_MAX = 10;
export const MEME_MAX_PER_REPLY = 1;
export const MEME_STRATEGY_DEFAULTS = Object.freeze({
  probability: 100,
  minGapReplies: 2,
  softFrequency: false,
  maxPerReply: MEME_MAX_PER_REPLY,
});

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function memeStrategyFromConfig(config = {}) {
  return {
    probability: clampInt(config.memeSendProbability, 0, 100, MEME_STRATEGY_DEFAULTS.probability),
    minGapReplies: clampInt(config.memeMinGapReplies, 0, 5, MEME_STRATEGY_DEFAULTS.minGapReplies),
    softFrequency: config.memeSoftFrequency === true,
    maxPerReply: MEME_MAX_PER_REPLY,
  };
}

// 只接受显式字段；越界/非数字抛错，由 API 返回 400。
export function memeStrategyPatch(input = {}) {
  const patch = {};
  if ('probability' in input) {
    const value = Number(input.probability);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('invalid_probability');
    patch.probability = Math.round(value);
  }
  if ('minGapReplies' in input) {
    const value = Number(input.minGapReplies);
    if (!Number.isFinite(value) || value < 0 || value > 5) throw new Error('invalid_min_gap');
    patch.minGapReplies = Math.round(value);
  }
  if ('softFrequency' in input) {
    if (typeof input.softFrequency !== 'boolean') throw new Error('invalid_soft_frequency');
    patch.softFrequency = input.softFrequency;
  }
  return patch;
}

// 固定骰子入口：测试可直接传 dice；概率 0/100 不依赖随机数。
export function rollMemeGate(probability, dice) {
  const chance = Number(probability);
  if (!Number.isFinite(chance) || chance <= 0) return false;
  if (chance >= 100) return true;
  const roll = Number(dice);
  return Number.isFinite(roll) && roll >= 0 && roll <= 1 ? roll * 100 < chance : false;
}

export function memeSoftFrequencyBlock(enabled) {
  if (!enabled) return '';
  return [
    '【表情使用频率】',
    '参考每约 2–3 条助手回复有 1 条配图；按完整回复计算，不必精确计数，也不必固定在第 3 条。',
    '连续 2 条回复都没有配图，且当前有合适选择时，优先配 1 张。',
    '遇到玩笑、鼓励、庆祝、共情或轻松接话，有贴切的表情就可以配图。',
    '没有合适表情时不要为凑比例勉强发送。',
    '用户明确要求时不受软频率参考约束。',
    '不要向用户解释频率判断。',
    '【输出示例，只学形式，不要照抄】',
    '纯文字：先接住对方的话，正常回答，不附加表情。',
    '文字+表情：回答后，在 <anam-meta> 里加 {"meme":"目录里的具体id"}；正文不要写表情 id 或分类。',
    '只发表情：正文可以很短，仍用 <anam-meta> 的 meme 字段发送；不要编造 id，没合适的就不发。',
  ].join('\n');
}

// 12 个 URL 安全字符；与 UUID 区分，但同样全局唯一、永不复用。
export function newMemeId() {
  return crypto.randomBytes(9).toString('base64url');
}

export function isSafeMemeId(id) {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{8,16}$/u.test(id);
}

export function memeRef(id) {
  return `meme:${id}`;
}

export function mediaRefId(ref) {
  if (typeof ref !== 'string' || !ref.startsWith('meme:')) return '';
  const id = ref.slice(5);
  return isSafeMemeId(id) ? id : '';
}

export function sanitizeLabel(value) {
  return String(value || '')
    .replace(/[|\u0000-\u001f\u007f]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, MEME_LABEL_MAX);
}

export function sanitizeTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，]/u);
  const seen = new Set();
  const out = [];
  for (const item of raw) {
    const tag = String(item || '')
      .replace(/[|\u0000-\u001f\u007f]/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim()
      .slice(0, MEME_TAG_MAX);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= MEME_TAGS_MAX) break;
  }
  return out;
}

// 只按文件头识别；扩展名与前端声明一律不信。
export function sniffMime(buffer) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
    && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  const head6 = b.subarray(0, 6).toString('latin1');
  if (head6 === 'GIF87a' || head6 === 'GIF89a') return 'image/gif';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}

export function imageDimensions(buffer, mime = sniffMime(buffer)) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  try {
    if (mime === 'image/png') {
      if (b.length < 24) return null;
      return positive(b.readUInt32BE(16), b.readUInt32BE(20));
    }
    if (mime === 'image/gif') {
      if (b.length < 10) return null;
      return positive(b.readUInt16LE(6), b.readUInt16LE(8));
    }
    if (mime === 'image/jpeg') {
      let offset = 2;
      while (offset + 9 < b.length) {
        if (b[offset] !== 0xff) { offset++; continue; }
        const marker = b[offset + 1];
        offset += 2;
        if (marker === 0xd8 || marker === 0xd9) continue;
        if (offset + 2 > b.length) return null;
        const length = b.readUInt16BE(offset);
        if (length < 2) return null;
        const isSof = (marker >= 0xc0 && marker <= 0xcf)
          && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
        if (isSof) {
          if (offset + 7 > b.length) return null;
          return positive(b.readUInt16BE(offset + 5), b.readUInt16BE(offset + 3));
        }
        offset += length;
      }
      return null;
    }
    if (mime === 'image/webp') {
      const chunk = b.subarray(12, 16).toString('latin1');
      if (chunk === 'VP8X') {
        if (b.length < 30) return null;
        const w = 1 + b.readUIntLE(24, 3);
        const h = 1 + b.readUIntLE(27, 3);
        return positive(w, h);
      }
      if (chunk === 'VP8 ') {
        if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
        return positive(b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff);
      }
      if (chunk === 'VP8L') {
        if (b.length < 25 || b[20] !== 0x2f) return null;
        const bits = b.readUInt32LE(21);
        return positive((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1);
      }
      return null;
    }
  } catch { return null; }
  return null;
}

function positive(w, h) {
  const width = Number(w);
  const height = Number(h);
  return width > 0 && height > 0 ? { w: width, h: height } : null;
}

export function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// 目录选择：置顶优先，其次审核时间，再按 id 稳定排序；取前 30。
// 普通新审核图 reviewed_at 更晚，自然排队；置顶是唯一能挤掉最后一张未置顶图的手段。
export function selectCatalog(records) {
  const qualified = (records || []).filter((record) => record
    && record.reviewed === true
    && record.enabled === true
    && typeof record.label === 'string'
    && record.label.trim()
    && !record.corrupted);
  qualified.sort((a, b) => {
    const pinned = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinned) return pinned;
    const at = (record) => Date.parse(record.reviewed_at || record.created_at || '') || 0;
    const time = at(a) - at(b);
    if (time) return time;
    return String(a.id).localeCompare(String(b.id));
  });
  return {
    selected: qualified.slice(0, MEME_CATALOG_MAX),
    qualified,
    waiting: Math.max(0, qualified.length - MEME_CATALOG_MAX),
  };
}

export function catalogLine(record) {
  const tags = Array.isArray(record?.tags) && record.tags.length ? ` | ${record.tags.join(',')}` : '';
  return `${record?.id || ''} | ${record?.label || ''}${tags}`;
}

// 只注入稳定前缀之后；空目录/总开关关闭时调用方不传，整块零 token。
export function memePromptBlock(selected, { softFrequency = false } = {}) {
  const rows = (selected || [])
    .filter((record) => record?.id && record.label)
    .map(catalogLine)
    .sort((a, b) => a.localeCompare(b));
  if (!rows.length) return '';
  return [
    '【可用表情包】',
    '只在语境合适时选一张；每条回复最多一张；不必刻意使用。',
    '选择方式：在 <anam-meta> 里加 "meme":"表情id"；不要编造 id，没合适的就留空字符串。',
    memeSoftFrequencyBlock(softFrequency),
    ...rows.map((line) => `- ${line}`),
  ].filter(Boolean).join('\n');
}

export function readJsonlFile(file) {
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* 坏行跳过 */ }
  }
  return rows;
}

// 恢复验证：记录/文件/hash/消息引用，返回缺失或损坏的 id。
export function verifyMemeBackup(dir) {
  const root = path.resolve(dir);
  const records = readJsonlFile(path.join(root, 'memes.jsonl'));
  const missing = [];
  const hashMismatch = [];
  const ids = new Set();
  for (const record of records) {
    if (!record?.id) continue;
    ids.add(record.id);
    const file = path.join(root, 'memes', path.basename(String(record.file || '')));
    if (!fs.existsSync(file)) { missing.push(record.id); continue; }
    try {
      const buffer = fs.readFileSync(file);
      if (record.hash && sha256(buffer) !== record.hash) hashMismatch.push(record.id);
    } catch { missing.push(record.id); }
  }
  const messages = readJsonlFile(path.join(root, 'messages.jsonl'));
  const referenced = new Set();
  for (const message of messages) {
    const id = mediaRefId(message?.media?.ref);
    if (id) referenced.add(id);
  }
  const unresolvedRefs = [...referenced].filter((id) => !ids.has(id));
  return { ok: missing.length === 0 && hashMismatch.length === 0 && unresolvedRefs.length === 0, records: records.length, missing, hashMismatch, unresolvedRefs };
}

