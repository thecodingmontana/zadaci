// Zadaci's service worker: an offline page for navigations, plus push notifications that open
// their link when tapped (see src/lib/push.server.ts). Nothing else is cached.
const OFFLINE = "/offline.html";
// bump when offline.html changes, so browsers fetch the new page
const CACHE = "zadaci-offline-v3";
// the offline page and the fonts it uses
const OFFLINE_FILES = [OFFLINE, "/fonts/bricolage-grotesque.woff2", "/fonts/ibm-plex-mono-400.woff2"];
self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_FILES)));
	self.skipWaiting();
});
self.addEventListener("activate", (event) =>
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim()),
	),
);
self.addEventListener("fetch", (event) => {
	// offline, the cached fonts still load for the offline page
	if (event.request.destination === "font" && OFFLINE_FILES.includes(new URL(event.request.url).pathname)) {
		event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
		return;
	}
	if (event.request.mode !== "navigate") return;
	event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

self.addEventListener("push", (event) => {
	// DevTools' "Push" button sends plain text, so fall back to it instead of failing silently
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { body: event.data ? event.data.text() : "" };
	}
	event.waitUntil(
		self.registration.showNotification(data.title || "Zadaci", {
			body: data.body,
			tag: data.tag,
			icon: "/android-chrome-192x192.png",
			badge: "/favicon-32x32.png",
			data: { url: data.url || "/" },
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const url = new URL(event.notification.data?.url || "/", self.location.origin);
	event.waitUntil(
		self.clients
			.matchAll({ type: "window", includeUncontrolled: true })
			.then((windows) => {
				// reuse an open Zadaci tab instead of opening another
				const open = windows.find((w) => new URL(w.url).origin === url.origin);
				if (!open) return self.clients.openWindow(url.href);
				return open.focus().then((w) => w.navigate(url.href));
			}),
	);
});
