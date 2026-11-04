// 网络层：口令、REST、SSE 解析。这里不碰 DOM。
let token = localStorage.getItem('companion.token') || '';

export function getToken() { return token; }

export function setToken(value) {
  token = value || '';
  if (token) localStorage.setItem('companion.token', token);
  else localStorage.removeItem('companion.token');
}

// 所有 /api 请求自动带口令
export function apiFetch(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (token) headers['x-access-token'] = token;
  return fetch(path, { ...opts, headers });
}

// 用候选口令验证；返回 HTTP 状态码（200 = 通过）
export async function checkPassword(password) {
  const r = await fetch('/api/health', { headers: { 'x-access-token': password } });
  return r.status;
}

export const getHealth = () => apiFetch('/api/health');
export const getMessages = (limit = 200, before = 0) => apiFetch(
  `/api/messages?limit=${limit}${before > 0 ? `&before=${before}` : ''}`,
);

export function postChat(id, text) {
  return apiFetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, text }),
  });
}

export function openEvents(lastEventId, boot, signal) {
  const qs = new URLSearchParams({ lastEventId: String(lastEventId) });
  if (boot) qs.set('boot', boot);
  return apiFetch(`/api/events?${qs.toString()}`, { signal });
}

// 解析一个 SSE 块为 { event, data, id }
export function parseFrame(block) {
  let event = 'message';
  const data = [];
  let id = null;
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    else if (line.startsWith('id:')) id = Number(line.slice(3).trim());
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join('\n')), id };
  } catch {
    return null;
  }
}

// 读完整个 SSE 响应；每帧回调。会一直读到连接结束。
export async function readSse(response, onFrame) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const frame = parseFrame(block);
      if (frame) onFrame(frame);
    }
  }
}
