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

  const options = {
    body: body,
    icon: '/icon.png',
    badge: '/badge.png',          // Optional – small icon for status bar (Android)
    vibrate: [300, 100, 400, 100, 500, 200, 600, 100, 800], // Long, strong pattern
    requireInteraction: true,     // Stays until user acts
    silent: false,                // Play system default sound
    actions: [
      { action: 'open', title: 'Open Dashboard' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'open') {
    event.waitUntil(clients.openWindow('/interface.html'));
  } else {
    event.waitUntil(clients.openWindow('/interface.html'));
  }
});