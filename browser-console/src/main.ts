import { registerServiceWorker } from "./sw-register";

async function init() {
  const app = document.getElementById("app")!;
  app.textContent = "Service Worker を登録中...";

  await registerServiceWorker();
  app.textContent = "Floci Browser Console - 準備完了";

  const res = await fetch("/mock-api/");
  const json = await res.json();
  console.log("Mock API response:", json);
}

init();
