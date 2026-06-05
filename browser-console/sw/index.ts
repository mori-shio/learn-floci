// Service Worker entry point
// Will be implemented in Task 3

self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
});

self.addEventListener("fetch", (event) => {
  // Passthrough for now
});
