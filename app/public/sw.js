// Service Worker：缓存应用外壳，API 一律不走缓存。
// 前端有改动时把 VERSION 加一（浏览器下次导航会拉新 sw.js 并换缓存）。
const VERSION = 'companion-v47-2026-11-07-p1';

const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/api.js',
  '/ui.js',
  '/meme-image.js',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      // 新版本安装时绕过浏览器 HTTP 缓存，避免新 cache 里再次写入旧 CSS/JS。
      await Promise.all(SHELL.map(async (url) => {
        const response = await fetch(new Request(url, { cache: 'reload' }));
        if (!response.ok) throw new Error(`shell fetch failed: ${url}`);
        await cache.put(url, response);
      }));
    })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // 接口（聊天、历史、SSE、口令）一律走网络，绝不缓存
  if (url.pathname.startsWith('/api/')) return;

  // 页面导航走网络优先：保证每次打开都是最新前端（本地/尾网延迟很小），
  // 断网时才回退到缓存壳。静态资源仍走缓存优先。
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(event));
    return;
  }

  event.respondWith(cacheFirst(event));
});

async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(VERSION);

  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const shell = await cache.match('/index.html');
    if (shell) return shell;
    return new Response('离线', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

async function cacheFirst(event) {
  const { request } = event;
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request, { ignoreSearch: true });

  // 后台更新：先给缓存（秒开），同时把新版本写回缓存
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    event.waitUntil(network);
    return cached;
  }

  const fresh = await network;
  if (fresh) return fresh;

  if (request.mode === 'navigate') {
    const shell = await cache.match('/index.html');
    if (shell) return shell;
  }

  return new Response('离线', {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

// v44：Web Push。前台可见时不重复弹；点击聚焦已有窗口。
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (clients.some((client) => client.visibilityState === 'visible')) return;
    await self.registration.showNotification(payload.title || 'Anam', {
      body: String(payload.body || '').slice(0, 160),
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'anam-chat',
      data: { url: payload.url || '/' },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.focus();
      return;
    }
    await self.clients.openWindow(target);
  })());
});

// 浏览器换订阅时，交给页面重新订阅并保存（服务端需要口令，SW 不直接持有 token）。
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) client.postMessage({ type: 'push-resubscribe' });
  })());
});




