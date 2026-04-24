const CACHE_NAME = 'affiliate-castle-v1'
// Only pre-cache truly static, public assets — not auth-protected routes
const STATIC_ASSETS = [
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Always use network for navigation requests (HTML pages) to preserve CSRF tokens
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request))
    return
  }

  // Network-first for API routes
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' },
      }))
    )
    return
  }

  // Cache-first only for static assets (images, fonts, manifest)
  const isStaticAsset =
    url.pathname.startsWith('/img/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname === '/manifest.json'

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request))
    )
    return
  }

  // All other requests: network-first
  event.respondWith(fetch(request))
})
