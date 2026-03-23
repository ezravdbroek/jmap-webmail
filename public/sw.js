/// <reference lib="webworker" />

const CACHE_NAME = 'brandways-webmail-v1';
const OFFLINE_URLS = [
  '/',
  '/brandways-icon.svg',
  '/brandways-logo.svg',
  '/brandways-logo-dark.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache essential assets for offline support
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first with offline fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and API calls
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/')) {
    // Cache Next.js static assets
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cache.match(event.request))
      )
    );
    return;
  }

  // For navigation requests, try network first, then cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/') || new Response('Offline', { status: 503 })
      )
    );
    return;
  }

  // For other assets, try cache first then network
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// Push notification
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  const title = data.title || 'Nieuw bericht';
  const options = {
    body: data.body || 'Je hebt een nieuw e-mailbericht ontvangen',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'new-email-' + (data.emailId || Date.now()),
    data: {
      url: data.url || '/',
      emailId: data.emailId,
    },
    renotify: true,
    actions: [
      { action: 'open', title: 'Openen' },
      { action: 'dismiss', title: 'Sluiten' },
    ],
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Update badge count
      self.navigator?.setAppBadge
        ? self.navigator.setAppBadge()
        : Promise.resolve(),
    ])
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Clear badge when app is opened
            if (self.navigator?.clearAppBadge) self.navigator.clearAppBadge();
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// Subscription change (auto re-subscribe)
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription?.options ?? { userVisibleOnly: true })
      .then((newSubscription) => {
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: newSubscription.toJSON(),
            oldEndpoint: event.oldSubscription?.endpoint,
          }),
        });
      })
  );
});

// Message handler for badge updates from the app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SET_BADGE') {
    const count = event.data.count || 0;
    if (self.navigator?.setAppBadge) {
      if (count > 0) {
        self.navigator.setAppBadge(count);
      } else {
        self.navigator.clearAppBadge();
      }
    }
  }
});
