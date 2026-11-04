// 探测当前 secret.json 指向的接口：有哪些模型、目标模型能不能用。
// 只打印状态码/模型列表/回复，不打印 key。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const secret = JSON.parse(fs.readFileSync(path.join(DATA, 'secret.json'), 'utf8').replace(/^\uFEFF/, ''));

const base = (secret.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '');
const key = secret.apiKey || '';
const want = process.argv[2] || secret.model || 'deepseek-chat';

console.log('baseUrl :', base);
console.log('model   :', want);
console.log('key     :', key ? `set (${key.length} chars)` : 'MISSING');
if (!key) process.exit(2);

const headers = { 'content-type': 'application/json', authorization: `Bearer ${key}` };

const m = await fetch(`${base}/models`, { headers });
console.log('\nGET /models ->', m.status);
if (m.ok) {
  const j = await m.json().catch(() => ({}));
  const ids = (j.data || []).map((x) => x.id);
  console.log('models  :', ids.join(', ') || '(empty)');
  if (ids.length && !ids.includes(want)) console.log('!! 目标模型不在列表里');
}

console.log('\nPOST /chat/completions ->');
const r = await fetch(`${base}/chat/completions`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    model: want,
    messages: [{ role: 'user', content: '只回两个字：在的' }],
    max_tokens: 16,
  }),
});
const body = await r.text();
console.log('status  :', r.status);
try {
  const j = JSON.parse(body);
  console.log('reply   :', JSON.stringify(j.choices?.[0]?.message?.content ?? j.error ?? j));
  console.log('usage   :', JSON.stringify(j.usage ?? null));
} catch {
  console.log('body    :', body.slice(0, 400));
}
