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

// 回复速度档位：只缩放句间停顿，不改切句/内容。
export const REPLY_SPEED_MULTIPLIERS = Object.freeze({ slow: 1.5, normal: 1, fast: 0.6 });

export function normalizeReplySpeed(value) {
  return Object.prototype.hasOwnProperty.call(REPLY_SPEED_MULTIPLIERS, value) ? value : 'normal';
}

export function replySpeedMultiplier(value) {
  return REPLY_SPEED_MULTIPLIERS[normalizeReplySpeed(value)];
}

// 模型有时会把历史开头的 [今天 19:12] 抄进正文；这里直接清掉。
const TIME_LABEL_RE = /[\[【（(]\s*(?:今天|昨天|前天|\d{1,2}月\d{1,2}日)\s*\d{1,2}:\d{2}\s*[\]】）)]/g;
// 模型也会写裸的 [21:25] / [21:25:30]；只剥标签，不动正文。
const BARE_TIME_LABEL_RE = /[\[【（(]\s*\d{1,2}:\d{2}(?::\d{2})?\s*[\]】）)]/g;
const LEADING_BARE_TIME_RE = /^\s*\d{1,2}:\d{2}(?::\d{2})?\s*[：:，,、]?\s*/;
const LEADING_TIME_RE = /^(?:今天|昨天|前天)\s*\d{1,2}:\d{2}\s*[：:，,、]?\s*/;
// 表情只能用 meta.meme 选择；模型若把历史里的 [表情] X 抄成独立句子，正文清掉。
const STICKER_SENTENCE_RE = /(^|[。！？!?…\n])\s*[\[【]\s*表情\s*[\]】]\s*[^\n。！？!?…]{1,24}\s*[。！？!?…]?/gu;

// 流式 HTML 过滤器：标签可能在任意 chunk 处被切断，必须跨 chunk 持有。
// 只处理已知 HTML 标签；<anam-meta> 会原样通过。
const HTML_TAGS = ['img', 'a', 'div', 'span', 'p', 'br', 'hr', 'b', 'i', 'strong', 'em', 'u', 's', 'small', 'big', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'video', 'audio', 'source', 'iframe', 'script', 'style'];
const HTML_TAG_NAME = new RegExp(`^(?:${HTML_TAGS.join('|')})\\b`, 'iu');
export function createHtmlStreamFilter() {
  let pending = '';
  return (chunk) => {
    let text = pending + String(chunk || '');
    pending = '';
    let out = '';
    for (let i = 0; i < text.length; i++) {
      if (text[i] !== '<') { out += text[i]; continue; }
      const rest = text.slice(i);
      const name = /^<\/?([a-z][a-z0-9-]*)\b/iu.exec(rest);
      if (!name || !HTML_TAG_NAME.test(name[1])) {
        // chunk 正好断在 "<"、"</" 或 "<im" 这类标签名前缀时，先持有到下一块。
        const partial = /^<\/?([a-z][a-z0-9-]*)?$/u.exec(rest);
        if (partial && (!partial[1] || HTML_TAGS.some((tag) => tag.startsWith(partial[1])))) {
          pending = rest;
          break;
        }
        out += '<';
        continue;
      }
      const end = text.indexOf('>', i);
      if (end < 0) { pending = rest; break; }
      i = end;
    }
    return out;
  };
}

export function sanitizeReply(text) {
  return String(text || '')
    // 模型偶尔会把空占位 HTML 当正文吐出来；空 <p> 不能变成可见气泡。
    .replace(/<p\b[^>]*>\s*(?:&nbsp;)?\s*<\/p>/giu, '')
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/giu, '$1')
    // 其他 HTML：空标签整个删，有内文的标签只留内文；未闭合的标签尾部也删。
    .replace(/<[^>]*>/gu, '')
    .replace(/<\/?[a-z][^>]*$/giu, '')
    .replace(TIME_LABEL_RE, '')
    .replace(BARE_TIME_LABEL_RE, '')
    .replace(LEADING_BARE_TIME_RE, '')
    .replace(LEADING_TIME_RE, '')
    .replace(STICKER_SENTENCE_RE, '$1')
    .replace(/^[\s，。、；：,;:]+/, '')
    .trim();
}
