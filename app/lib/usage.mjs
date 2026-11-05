// 费用拆解：只做估算与汇总，不改调用逻辑/预算护栏。
export const BREAKDOWN_KEYS = ['stable', 'memory', 'posts', 'catalog', 'time', 'l1'];

export function emptyBreakdown() {
  return { stable: 0, memory: 0, posts: 0, catalog: 0, time: 0, l1: 0, total: 0 };
}

export function normalizeBreakdown(input = {}) {
  const out = {};
  let total = 0;
  for (const key of BREAKDOWN_KEYS) {
    const value = Math.max(0, Math.round(Number(input[key]) || 0));
    out[key] = value;
    total += value;
  }
  out.total = total;
  return out;
}

export function sumBreakdown(rows = []) {
  const out = emptyBreakdown();
  for (const row of rows) {
    const breakdown = row?.breakdown;
    if (!breakdown) continue;
    for (const key of BREAKDOWN_KEYS) out[key] += Math.max(0, Number(breakdown[key]) || 0);
  }
  out.total = BREAKDOWN_KEYS.reduce((sum, key) => sum + out[key], 0);
  return out;
}

export function cacheRate(hit, miss) {
  const h = Number(hit) || 0;
  const m = Number(miss) || 0;
  return h + m > 0 ? h / (h + m) : null;
}
