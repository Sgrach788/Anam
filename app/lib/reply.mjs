// 回复文本处理：切句、停顿、清理模型误抄的时间标签。
// 单独成模块，方便直接用纯函数测试。

export const MAX_PART = 60;
const ENDERS = '。！？!?…\n';
const CLOSERS = '”’」』）)》"\'';

// 返回第一个完整句的切点（含句末标点与紧跟的引号/括号），没有则 0
export function findSentenceCut(buf) {
  for (let i = 0; i < buf.length; i++) {
    if (!ENDERS.includes(buf[i])) continue;
    let j = i + 1;
    while (j < buf.length && ENDERS.includes(buf[j])) j++;
    while (j < buf.length && CLOSERS.includes(buf[j])) j++;
    return j;
  }
  return 0;
}

// 超过 60 字还没有句末标点：在最后一个逗号类标点处切，找不到就硬切
export function findCommaCut(buf) {
  const win = buf.slice(0, MAX_PART);
  let cut = 0;
  for (const ch of ['，', ',', '、', '；', ';', '：', ':']) {
    const idx = win.lastIndexOf(ch);
    if (idx > cut) cut = idx;
  }
  return cut > 0 ? cut + 1 : MAX_PART;
}

// 两条之间的停顿：拟人化，按上一条字数递增（约 40ms/字），600–1800ms
export function partDelay(len) {
  return Math.min(1800, Math.max(600, 600 + Math.max(0, len) * 40));
}

// 模型有时会把历史开头的 [今天 19:12] 抄进正文；这里直接清掉。
const TIME_LABEL_RE = /[\[【（(]\s*(?:今天|昨天|前天|\d{1,2}月\d{1,2}日)\s*\d{1,2}:\d{2}\s*[\]】）)]/g;
const LEADING_TIME_RE = /^(?:今天|昨天|前天)\s*\d{1,2}:\d{2}\s*[：:，,、]?\s*/;

export function sanitizeReply(text) {
  return String(text || '')
    .replace(TIME_LABEL_RE, '')
    .replace(LEADING_TIME_RE, '')
    .replace(/^[\s，。、；：,;:]+/, '')
    .trim();
}
