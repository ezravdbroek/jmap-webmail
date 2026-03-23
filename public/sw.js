/// <reference lib="webworker" />

// Service Worker for Web Push Notifications

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};

  const title = data.title || 'Nieuw bericht';
  const options = {
    body: data.body || 'Je hebt een nieuw e-mailbericht ontvangen',
    icon: '/brandways-icon.svg',
    badge: '/brandways-icon.svg',
    tag: 'new-email-' + (data.emailId || Date.now()),
    data: {
      url: data.url || '/',
      emailId: data.emailId,
    },
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Focus existing tab if found
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new tab
        return self.clients.openWindow(url);
      })
  );
});

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
