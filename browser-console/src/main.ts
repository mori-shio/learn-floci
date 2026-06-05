import { registerServiceWorker } from "./sw-register";
import { createLayout } from "./ui/layout";
import { renderSidebar } from "./ui/sidebar";
import type { Preset } from "./types";

let currentPreset: Preset | null = null;
let currentParams: Record<string, string> = {};

async function init() {
  await registerServiceWorker();

  const { sidebar, codePanel, resultPanel, runButton, resetButton, paramsPanel } =
    createLayout();

  renderSidebar(sidebar, (preset) => {
    currentPreset = preset;
    currentParams = {};
    for (const f of preset.fields) {
      currentParams[f.name] = f.default || "";
    }
    renderParams(paramsPanel, preset, codePanel);
    codePanel.textContent = preset.code(currentParams);
    resultPanel.textContent = "";
    runButton.disabled = false;
  });

  runButton.addEventListener("click", async () => {
    if (!currentPreset) return;
    runButton.disabled = true;
    resultPanel.textContent = "実行中...";
    try {
      const result = await currentPreset.run(currentParams);
      resultPanel.textContent = JSON.stringify(result, null, 2);
    } catch (err) {
      resultPanel.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      runButton.disabled = false;
    }
  });

  resetButton.addEventListener("click", async () => {
    if (!confirm("データをリセットしますか？")) return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "reset" });
    location.reload();
  });
}

function renderParams(
  container: HTMLElement,
  preset: Preset,
  codePanel: HTMLElement
): void {
  if (preset.fields.length === 0) {
    container.classList.add("hidden");
    return;
  }
  container.classList.remove("hidden");
  container.innerHTML = "";

  for (const field of preset.fields) {
    const wrapper = document.createElement("div");
    wrapper.className = "mb-2";

    const label = document.createElement("label");
    label.className = "block text-xs text-gray-500 mb-1";
    label.textContent = field.label;

    const input =
      field.type === "textarea"
        ? document.createElement("textarea")
        : document.createElement("input");
    input.className =
      "w-full px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200";
    input.value = field.default || "";

    input.addEventListener("input", () => {
      currentParams[field.name] = input.value;
      codePanel.textContent = currentPreset!.code(currentParams);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
  }
}

init();
