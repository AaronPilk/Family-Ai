/* eslint-disable no-restricted-globals */
/**
 * FamLink service worker — push notifications only.
 *
 * Scope: lives at the site root (`/sw.js`) so it controls the whole origin.
 * This is required for iOS 16.4+ PWA push and for Android/Chrome push too.
 *
 * We deliberately do NOT cache anything. FamLink is an online-first PWA;
 * the service worker exists purely to receive push events while the app is
 * not in the foreground. Adding stale-while-revalidate or precaching here
 * without a full offline strategy would cause "I shipped a fix but everyone
 * still sees the old build" bugs, so we punt that to a later milestone.
 *
 * Two events:
 *   1. `push`             — show the OS notification
 *   2. `notificationclick` — focus / open the relevant URL
 */

self.addEventListener('install', (event) => {
  // Activate immediately on first install so push works on the first visit.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (_e) {
    // Some senders (notably tests) push plain text; treat the whole body as
    // the notification body and use a generic title.
    try {
      payload = { title: 'FamLink', body: event.data ? event.data.text() : '' };
    } catch (_inner) {
      payload = { title: 'FamLink', body: 'You have a new update.' };
    }
  }

  const title = payload.title || 'FamLink';
  const body = payload.body || '';
  const url = payload.url || '/';

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Tag groups subsequent notifications from the same surface so we don't
    // pile up duplicates if the user has the tab open while pushes arrive.
    tag: payload.tag || undefined,
    data: { url },
    // Vibrate on Android — iOS ignores this but doesn't error.
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // If the app is already open in a tab, focus it and navigate.
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            await client.focus();
            if ('navigate' in client) {
              await client.navigate(targetUrl);
            }
            return;
          } catch (_e) {
            // fall through to openWindow
          }
        }
      }

      // Otherwise open a new window.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
