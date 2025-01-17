self.addEventListener("message", event => {
  event.waitUntil(fetch("image.png"));
});

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
