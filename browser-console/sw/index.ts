import { seedInitialData } from "./seed";
import { routeRequest } from "./router";
import { clearAll } from "./store";

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("install", (event) => {
  event.waitUntil(
    seedInitialData().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/mock-api")) {
    event.respondWith(routeRequest(event.request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "reset") {
    event.waitUntil(
      clearAll().then(() => seedInitialData())
    );
  }
});
