const CACHE_NAME = 'idarat-v4-cache'
const STATIC_CACHE = 'idarat-static-v4'
const IMAGE_CACHE = 'idarat-images-v4'

const APP_BASE = new URL('./', self.location.href).pathname
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
]

// Install: Cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined)
  )
  self.skipWaiting()
})

// Activate: Clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== IMAGE_CACHE).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch: Cache strategies
self.addEventListener('fetch', (e) => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  const isAppRequest = request.mode === 'navigate' || url.pathname === APP_BASE || url.pathname.startsWith(APP_BASE)

  if (isAppRequest && !url.pathname.endsWith('.js') && !url.pathname.endsWith('.css')) {
    e.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match(request)
        const fallback = await cache.match('./index.html')

        try {
          const response = await fetch(request)
          if (response && response.ok) cache.put(request, response.clone())
          return response
        } catch {
          return cached || fallback || Response.error()
        }
      })()
    )
    return
  }

  if (request.destination === 'image') {
    e.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone())
            return response
          })
          .catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }

  e.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
