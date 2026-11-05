// V0 L2 memory is deliberately conservative: only explicit first-person statements
// are extracted, and every fact keeps the exact user message that supports it.
const clean = (value) => String(value || '').replace(/[\s，。.!！？?]+$/u, '').trim();

export function extractFacts(text) {
  const source = String(text || '').trim();
  if (!source) return [];
  const facts = [];
  const add = (key, phrase) => {
    const quote = String(phrase || '').trim().slice(0, 180);
    if (quote && quote.length <= 180 && !facts.some((fact) => fact.key === key)) {
      facts.push({ key, quote });
    }
  };

  const pet = source.match(/我(?:养了|养着|养|家里有)(?:一只|只|一条|条)?(猫|狗|兔子|仓鼠)[^。！？\n]{0,14}?(?:名字叫|名叫|叫)\s*([^\s，,。.!！？?]{1,20})/u);
  if (pet) add(`pet:${pet[1]}`, source);

  const myName = source.match(/我叫\s*([^\s，,。.!！？?]{1,20})/u);
  if (myName) add(`identity:name:${myName[1]}`, source);

  const preference = source.match(/我(喜欢|不喜欢|讨厌|偏爱)\s*([^。！？\n]{1,40})/u);
  if (preference) {
    const topic = clean(preference[2]);
    if (topic) add(`preference:${topic}`, source);
  }

  const englishPet = source.match(/\bI have (?:a|an) (cat|dog|rabbit|hamster) named ([A-Za-z][A-Za-z0-9_-]{0,19})\b/i);
  if (englishPet) add(`pet:${englishPet[1].toLowerCase()}`, source);
  const englishName = source.match(/\bMy name is ([A-Za-z][A-Za-z0-9_-]{0,39})\b/i);
  if (englishName) add(`identity:name:${englishName[1]}`, source);
  const englishPreference = source.match(/\bI (like|love|dislike|hate) ([^.!?\n]{1,40})/i);
  if (englishPreference) {
    const topic = clean(englishPreference[2]);
    if (topic) add(`preference:${topic.toLowerCase()}`, source);
  }
  return facts;
}

export function renderMemoryFacts(facts, limit = 30) {
  return facts.slice(-limit).map((fact) => `- ${fact.quote}（来源：用户原话，消息序号 ${fact.sourceSeq}）`);
}

// P4：只在关键词无命中或明确回忆时请求 embedding。
export const RECALL_CUE_RE = /(记得|还记得|以前|之前|上次|那次|曾经|过去|回忆|那时|当初|多久|后来|当时)/u;

export function shouldUseSemanticMemory(query, { configured = false, memoryCount = 0, keywordHits = 0 } = {}) {
  const text = String(query || '').trim();
  if (!text || !configured || memoryCount <= 0) return false;
  if (RECALL_CUE_RE.test(text)) return true;
  return keywordHits <= 0;
}
