// L1 工作记忆：最近 30 轮原文，同时受 3000 token 预算限制。
export const L1_TURNS = 30;
export const L1_TOKEN_BUDGET = 3000;

/**
 * 从最新往最旧累加；最新一条用户消息 + 最新一条助手回复保底保留。
 * 短历史（未超预算）输出与旧版 slice+map 完全一致。
 */
export function buildL1Context(messages, {
  maxMessages = L1_TURNS * 2,
  budget = L1_TOKEN_BUDGET,
  tokenize = (text) => String(text || '').length,
  timeLabel = (at) => String(at || ''),
  textOf = (message) => String(message?.text || ''),
} = {}) {
  const recent = (messages || []).slice(-Math.max(1, maxMessages));
  if (!recent.length) return [];

  const forced = new Set();
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i]?.role === 'user') { forced.add(i); break; }
  }
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i]?.role === 'assistant') { forced.add(i); break; }
  }

  const included = [];
  let used = 0;
  let forcedIncluded = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const content = `[${timeLabel(recent[i].at)}] ${textOf(recent[i])}`;
    const cost = tokenize(content);
    const mustKeep = forced.has(i);
    if (!mustKeep && used + cost > budget && forcedIncluded >= forced.size) break;
    if (!mustKeep && used + cost > budget) continue;
    included.push({ index: i, content });
    used += cost;
    if (mustKeep) forcedIncluded++;
  }
  included.sort((a, b) => a.index - b.index);
  return included.map((item) => ({
    role: recent[item.index].role,
    content: item.content,
  }));
}
