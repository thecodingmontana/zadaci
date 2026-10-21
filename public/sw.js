// Shows Zadaci's push notifications and opens their link when tapped (see src/lib/push.server.ts).
self.addEventListener("push", (event) => {
	const data = event.data ? event.data.json() : {};
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
