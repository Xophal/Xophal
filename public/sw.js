self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "You have a new notification." };
  }

  const title = typeof payload.title === "string" ? payload.title : "Xophol";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a new notification.",
    data: { url: typeof payload.url === "string" ? payload.url : "/notifications" },
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const requestedTarget = new URL(event.notification.data?.url || "/notifications", self.location.origin);
  const target = requestedTarget.origin === self.location.origin
    ? requestedTarget.href
    : new URL("/notifications", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) return existing.navigate(target).then(() => existing.focus());
      return self.clients.openWindow(target);
    })
  );
});