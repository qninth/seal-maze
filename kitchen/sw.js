// 厨房助手 Service Worker —— 「添加到主屏幕」后秒开的核心
// 策略：
//   - App 壳（index.html）：network-first，离线兜底缓存（保证更新及时 + 断网能开）
//   - 带 hash 的静态资源（js/css/图标）：cache-first（文件名变 = 自动换新）
//   - API 请求：绝不缓存（库存/AI 必须实时）
const CACHE = 'kitchen-pwa-v1'
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  // 只管同源 GET
  if (e.request.method !== 'GET' || url.origin !== location.origin) return
  // API 与菜谱图：透传，不缓存
  if (url.pathname.includes('/api/')) return

  // 带 hash 的静态资源：cache-first
  if (/\/assets\/|\/icons\//.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((resp) => {
        const copy = resp.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy))
        return resp
      }))
    )
    return
  }

  // App 壳（index.html / 导航请求）：network-first，失败回落缓存
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/kitchen/') || url.pathname.endsWith('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then((resp) => {
          const copy = resp.clone()
          caches.open(CACHE).then((c) => c.put('./index.html', copy))
          return resp
        })
        .catch(() => caches.match('./index.html'))
    )
  }
})
