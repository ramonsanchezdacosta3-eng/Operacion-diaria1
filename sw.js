// Service Worker for push notifications
self.addEventListener('push', function(event) {
  let data = {};
  try { data = event.data.json(); } catch(e) { data = { title: 'Operación Diaria', body: event.data ? event.data.text() : '' }; }

  const title = data.title || 'Operación Diaria';
  const options = {
    body: data.body || '',
    icon: 'https://cdn-icons-png.flaticon.com/512/619/619153.png',
    badge: 'https://cdn-icons-png.flaticon.com/512/619/619153.png',
    tag: data.tag || 'ops-notification',
    data: { url: data.url || '/' },
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

self.addEventListener('install', function(event) {
  self.skipWaiting();
});
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
