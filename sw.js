const CACHE_VERSION = 'v5'
const STATIC_CACHE = `idarat-static-${CACHE_VERSION}`
const IMAGE_CACHE = `idarat-images-${CACHE_VERSION}`

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './icon-192.png',
  './icon-512.png'
]

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE)
    try {
      await cache.addAll(STATIC_ASSETS)
    } catch (error) {
      console.warn('PWA cache warning:', error)
    }
    self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== IMAGE_CACHE).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE)
      try {
        const response = await fetch(request)
        cache.put(request, response.clone())
        return response
      } catch (error) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error()
      }
    })())
    return
  }

  if (request.destination === 'image') {
    event.respondWith((async () => {
      const cache = await caches.open(IMAGE_CACHE)
      const cached = await cache.match(request)
      try {
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      } catch (error) {
        return cached || Response.error()
      }
    })())
    return
  }

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(STATIC_CACHE)
      return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error()
    })
  )
})
