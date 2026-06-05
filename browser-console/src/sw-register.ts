export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.error("Service Worker not supported");
    return;
  }
  const reg = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });
  if (reg.installing) {
    await new Promise<void>((resolve) => {
      reg.installing!.addEventListener("statechange", function handler() {
        if (this.state === "activated") {
          this.removeEventListener("statechange", handler);
          resolve();
        }
      });
    });
  }
}
