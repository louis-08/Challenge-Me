self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'Challenge Me';
  const options = {
    body: data.body || '',
    tag: data.tag || undefined,
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || '/';

  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const client of clientsList) {
      if ('focus' in client) {
        try {
          await client.focus();
          if ('postMessage' in client) {
            client.postMessage({ type: 'DEEP_LINK', url: targetUrl });
          }
          return;
        } catch {
          // fallback to openWindow below
        }
      }
    }

    await clients.openWindow(targetUrl);
  })());
});
