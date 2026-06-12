self.addEventListener('push', function(event) {
  let title = 'Notification';
  let body = '';

  try {
    const data = event.data.json();
    title = data.title || 'Notification';
    body = data.body || '';
  } catch (e) {
    // Not JSON – treat the raw text as the notification body
    body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon.png',
      vibrate: [500, 300, 400],
      requireInteraction: true
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(clients.openWindow('/interface.html'));
});