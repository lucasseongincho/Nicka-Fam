/**
 * The FCM service worker, served from a route handler rather than a
 * static public/ file specifically so it can read
 * NEXT_PUBLIC_FIREBASE_* at request time and inline them -- static files
 * in public/ can't see environment variables at all.
 *
 * Deliberately has no `fetch` handler / app-shell cache: the only jobs
 * here are background push handling and notification clicks. With
 * nothing cached, there's nothing that can ever go stale, which is what
 * actually guarantees "every deploy is picked up automatically, no need
 * to remove/re-add the home screen icon" -- a cache-first strategy is
 * what causes that problem in the first place, so the fix is simply not
 * having one.
 */
export const runtime = "nodejs";

function buildServiceWorkerScript(): string {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  return `
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js");

firebase.initializeApp(${JSON.stringify(config)});

// Take over immediately on deploy rather than waiting for every open tab
// to close first (skipWaiting) and for the new worker to actually control
// already-open pages once activated (clients.claim).
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const messaging = firebase.messaging.isSupported() ? firebase.messaging() : null;

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const title = data.title || "nicka fam";
    const body = data.body || "";
    self.registration.showNotification(title, {
      body,
      icon: "/apple-icon",
      data: { url: data.url || "/" },
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
`.trim();
}

export async function GET() {
  return new Response(buildServiceWorkerScript(), {
    headers: {
      "Content-Type": "text/javascript",
      "Cache-Control": "no-cache",
      "Service-Worker-Allowed": "/",
    },
  });
}
