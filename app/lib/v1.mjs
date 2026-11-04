export function memoryTerms(value) {
  const text = String(value || '').toLocaleLowerCase('zh-CN');
  const terms = new Set(text.match(/[a-z0-9_'-]{2,}/gu) || []);
  const chars = Array.from(text.replace(/[^\u3400-\u9fff]/gu, ''));
  for (let i = 0; i < chars.length; i++) {
    terms.add(chars[i]);
    if (i + 1 < chars.length) terms.add(chars[i] + chars[i + 1]);
  }
  return terms;
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = Number(a[i]);
    const y = Number(b[i]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    dot += x * y;
    aa += x * x;
    bb += y * y;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}

export function scoreMemory(record, query, { vector, queryVector, now = Date.now() } = {}) {
  const text = [record.text, record.quote, record.summary, ...(record.topics || [])].filter(Boolean).join(' ');
  const queryText = String(query || '').trim().toLocaleLowerCase('zh-CN');
  const terms = memoryTerms(queryText);
  const target = memoryTerms(text);
  let overlap = 0;
  for (const term of terms) if (target.has(term)) overlap++;
  const lexical = terms.size ? overlap / terms.size : 0;
  const phrase = queryText.length >= 2 && text.toLocaleLowerCase('zh-CN').includes(queryText) ? 0.8 : 0;
  const semantic = cosineSimilarity(vector, queryVector);
  const created = Date.parse(record.at || record.updatedAt || '');
  const ageDays = Number.isFinite(created) ? Math.max(0, (now - created) / 86400000) : 365;
  const recency = 1 / (1 + ageDays / 30);
  const importance = Math.max(0, Math.min(5, Number(record.importance) || 1)) / 5;
  const score = lexical * 0.55 + Math.max(0, semantic) * 0.35 + phrase + importance * 0.06 + recency * 0.04;
  return { lexical, semantic, importance, recency, score };
}

export function retrieveMemories(records, query, options = {}) {
  return records
    .filter((row) => row && row.deleted !== true && String(row.text || row.quote || row.summary || '').trim())
    .map((record) => ({ record, ...scoreMemory(record, query, {
      ...options,
      vector: options.vectors?.get?.(record.id),
    }) }))
    .filter((row) => !String(query || '').trim() || (row.score > 0.08 && (row.lexical > 0 || row.semantic > 0.15)))
    .sort((a, b) => b.score - a.score || String(b.record.at || '').localeCompare(String(a.record.at || '')))
    .slice(0, Math.max(0, Number(options.limit) || 5));
}

export function smoothEmotion(previous, target, at = new Date().toISOString()) {
  const t = Date.parse(at) || Date.now();
  const daySpan = previous?.at ? Math.max(0, (t - (Date.parse(previous.at) || t)) / 86400000) : 0;
  const decay = Math.pow(0.72, daySpan);
  const priorPleasure = (Number(previous?.pleasure) || 0) * decay;
  const priorEnergy = 0.5 + ((Number(previous?.energy) || 0.5) - 0.5) * decay;
  const nextPleasure = Math.max(-1, Math.min(1, Number(target?.pleasure)));
  const nextEnergy = Math.max(0, Math.min(1, Number(target?.energy)));
  if (!Number.isFinite(nextPleasure) || !Number.isFinite(nextEnergy)) return null;
  return {
    pleasure: Number((priorPleasure + (nextPleasure - priorPleasure) * 0.28).toFixed(3)),
    energy: Number((priorEnergy + (nextEnergy - priorEnergy) * 0.28).toFixed(3)),
    at: new Date(t).toISOString(),
  };
}

export function cleanSignature(value) {
  return String(value || '').replace(/[\r\n<>]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 56);
}

export function cleanSelfPost(value, profile = {}, facts = [], sourceText = '') {
  const text = String(value || '').replace(/[\r\n]+/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, 280);
  if (!text || /(?:你|您|咱(?:们)?|我们|咱们)/u.test(text)) return '';
  for (const personal of [profile.name, profile.callUser, ...facts.map((f) => f.quote)]) {
    const needle = String(personal || '').trim();
    if (needle.length >= 2 && text.includes(needle)) return '';
  }
  if (/\b(?:you|your|we|our|user)\b/iu.test(text)) return '';
  const meaningful = (value) => {
    const chars = Array.from(String(value || '').replace(/[^\u3400-\u9fff]/gu, ''));
    return new Set(chars.map((_, i) => chars.slice(i, i + 2).join(''))
    .filter((term) => term.length === 2 && !['今天', '现在', '感觉', '有点', '然后', '因为', '所以', '这个', '那个'].includes(term)));
  };
  const sourceTerms = meaningful(sourceText);
  let overlap = 0;
  for (const term of meaningful(text)) if (sourceTerms.has(term)) overlap++;
  if (overlap >= 2) return '';
  return text;
}

export function parseAssistantMetadata(value) {
  const text = String(value || '');
  // 允许元数据块出现在任意位置，也容忍块后还有模型多写的尾巴
  const matches = [...text.matchAll(/<anam-meta>\s*([\s\S]*?)<\/anam-meta>/gu)];
  if (!matches.length) return { text, metadata: null, found: false };

  const match = matches[matches.length - 1];
  let metadata = null;
  try {
    const parsed = JSON.parse(match[1]);
    const pleasure = Number(parsed?.emotion?.pleasure);
    const energy = Number(parsed?.emotion?.energy);
    metadata = {
      emotion: Number.isFinite(pleasure) && Number.isFinite(energy)
        ? { pleasure, energy }
        : null,
      signature: cleanSignature(parsed?.signature),
      spacePost: String(parsed?.spacePost || '').trim().slice(0, 280),
      meme: String(parsed?.meme || '').trim().slice(0, 32),
    };
  } catch { /* invalid private metadata is dropped */ }

  const cleaned = text.replace(match[0], '').replace(/[ \t]+\n/gu, '\n').trimEnd();
  return { text: cleaned, metadata, found: true };
}

export function validateSummaryRelations(summary, sourceMessages) {
  const byId = new Map(sourceMessages.map((m) => [m.id, m]));
  const entities = (Array.isArray(summary?.entities) ? summary.entities : [])
    .map((e) => ({ name: String(e?.name || '').trim().slice(0, 80), sourceId: String(e?.sourceId || '') }))
    .filter((e) => e.name && byId.has(e.sourceId) && byId.get(e.sourceId).text.includes(e.name));
  const entityNames = new Set(entities.map((e) => e.name));
  const relations = (Array.isArray(summary?.relations) ? summary.relations : [])
    .map((r) => ({
      from: String(r?.from || '').trim().slice(0, 80),
      to: String(r?.to || '').trim().slice(0, 80),
      label: String(r?.label || '').trim().slice(0, 48),
      sourceId: String(r?.sourceId || ''),
      evidence: String(r?.evidence || '').trim().slice(0, 180),
    }))
    .filter((r) => r.from && r.to && r.label && r.evidence && byId.has(r.sourceId)
      && entityNames.has(r.from) && entityNames.has(r.to)
      && byId.get(r.sourceId).text.includes(r.evidence));
  return { entities, relations };
}

export function validateSummaryClaims(summary, sourceMessages) {
  const byId = new Map(sourceMessages.map((message) => [message.id, message]));
  // 模型经常只改标点/空白，严格逐字比较会把有效摘要全丢掉；比较前统一去掉空白和标点。
  const normalize = (value) => String(value || '')
    .replace(/[\s\u3000]+/gu, '')
    .replace(/[，。！？；：、,.!?;:'"“”‘’（）()【】\[\]《》<>·…—]/gu, '');
  const seen = new Set();
  return (Array.isArray(summary?.claims) ? summary.claims : [])
    .map((claim) => ({
      text: String(claim?.text || '').trim().slice(0, 180),
      sourceId: String(claim?.sourceId || ''),
      evidence: String(claim?.evidence || '').trim().slice(0, 240),
    }))
    .filter((claim) => {
      const source = byId.get(claim.sourceId);
      if (!claim.text || !claim.evidence || !source) return false;
      const sourceText = normalize(source.text);
      const evidenceText = normalize(claim.evidence);
      if (!sourceText.includes(evidenceText)) return false;
      const key = `${claim.sourceId}\u0000${claim.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
