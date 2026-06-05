export async function registerServiceWorker(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.error("Service Worker not supported");
    return;
  }
  const base = import.meta.env.BASE_URL;
  const reg = await navigator.serviceWorker.register(`${base}sw.js`, {
    scope: base,
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
