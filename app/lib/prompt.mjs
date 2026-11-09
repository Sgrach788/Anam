// Prompt 结构：稳定前缀（可缓存）+ 易变尾巴（每轮变化）。
// 任何新增内容都必须明确属于 stable 或 volatile；volatile 只能放尾巴。
export const TIME_RULES = [
  '时间信息只在这两种情况下使用：用户问现在几点、今天几号、星期几；或需要判断「昨天 / 上次 / 多久以前 / 前几天」指的是哪件事。',
  '不要主动提今天是几号、星期几，也不要在回复里报时。',
  '回复里绝对不能出现时间标签（例如 [今天 19:12]、裸的 [21:25] 或行首 21:25）、日期或时间戳，也不要复述历史消息开头的时间。',
  '对话历史每条开头的 [今天 12:30] / [昨天 22:13] 是那条消息的发送时间，只用来理解时间跨度，不要照抄进回复。',
].join('\n');

export const META_FORMAT = '在可见回复正文结束后，最后追加一个独立的 <anam-meta>JSON</anam-meta> 内部块，不能在正文中提及这个块。JSON 格式为 {"emotion":{"pleasure":-1到1,"energy":0到1},"signature":"不超过56字的AI自身短想法，没变化时空字符串","spacePost":"AI自身动态，没有合适内容时空字符串","meme":"可选，表情包目录里的 id；不合适时留空字符串"}。';

export const STICKER_BAN = '正文禁止书写 [表情] 格式；表情只能通过 <anam-meta> 的 meme 字段选择。';
export const HTML_BAN = '正文禁止输出任何 HTML 标签（包括 <img>、<a>、<div>、<span> 等）；需要发图只用 <anam-meta> 的 meme 字段选表情，或用已有的发照片机制，不要自己拼 HTML、不要贴图片直链当标签。';

export const EMOTION_RULES = '情绪只表达你自己的愉悦度与活跃度。签名和动态只写你自身，不提、不暗示用户身份、经历、偏好或隐私；动态必须是独立于用户当前内容的自身想法或状态，不能改写用户刚说的事，不确定就留空。';

// 稳定前缀：顺序固定，不能插入任何每轮变化的内容。
export function buildStableSystemPrefix({ persona = '', profileText = '' } = {}) {
  return [
    persona,
    profileText,
    TIME_RULES,
    META_FORMAT,
    STICKER_BAN,
    HTML_BAN,
    EMOTION_RULES,
  ].filter(Boolean).join('\n\n');
}

// 易变尾巴：memory → recent posts → meme catalog → signature → weather/date → now。
export function buildSystemContent({
  stablePrefix = '',
  memoryText = '',
  recentPostsText = '',
  memeText = '',
  nowLine = '',
  signatureText = '',
  weatherText = '',
  dateText = '',
} = {}) {
  return [
    stablePrefix,
    memoryText,
    recentPostsText,
    memeText,
    signatureText,
    weatherText,
    dateText,
    nowLine,
  ].filter(Boolean).join('\n\n');
}

// 供测试/审计：返回稳定前缀的字节表示，避免测试误把尾巴算进去。
export function stablePrefixOf(prompt, stablePrefix) {
  return String(prompt || '').startsWith(stablePrefix) ? stablePrefix : '';
}
