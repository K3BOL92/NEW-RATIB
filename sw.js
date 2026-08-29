const CACHE_NAME = 'idarat-v4-cache'
const STATIC_CACHE = 'idarat-static-v4'
const IMAGE_CACHE = 'idarat-images-v4'

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/App.jsx',
  '/manifest.json'
]

// Install: Cache static assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
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

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Strategy 1: Cache First for static assets
  if (STATIC_ASSETS.includes(url.pathname)) {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    )
    return
  }

  // Strategy 2: Network First for API/data (if you add later)
  // Strategy 3: Stale While Revalidate for images
  if (request.destination === 'image') {
    e.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone())
          return response
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
    return
  }

  // Default: Network with cache fallback
  e.respondWith(
    fetch(request).catch(() => caches.match(request))
  )
})
