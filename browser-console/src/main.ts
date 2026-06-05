import { registerServiceWorker } from "./sw-register";
import { createLayout } from "./ui/layout";
import { renderTabs, renderPresetList, activateTab } from "./ui/sidebar";
import { renderCode } from "./ui/code-preview";
import { SERVICES } from "./presets";
import type { Preset } from "./types";

let currentPreset: Preset | null = null;
let currentParams: Record<string, string> = {};

async function init() {
  await registerServiceWorker();

  const { tabsContainer, sidebar, cardArea, historyContainer, resetButton } =
    createLayout();

  function selectPreset(preset: Preset) {
    currentPreset = preset;
    currentParams = {};
    for (const f of preset.fields) {
      currentParams[f.name] = f.default || "";
    }
    renderCard(cardArea, preset);
  }

  renderTabs(tabsContainer, (service) => {
    const first = renderPresetList(sidebar, service, selectPreset);
    if (first) {
      selectPreset(first);
      sidebar.querySelector("button")?.click();
    } else {
      cardArea.innerHTML = "";
    }
  });

  activateTab(tabsContainer, SERVICES[0]);

  resetButton.addEventListener("click", async () => {
    if (!confirm("データをリセットしますか？")) return;
    const reg = await navigator.serviceWorker.ready;
    reg.active?.postMessage({ type: "reset" });
    location.reload();
  });

  function renderCard(container: HTMLElement, preset: Preset) {
    container.innerHTML = "";

    const card = document.createElement("div");
    card.className =
      "rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 flex flex-col gap-3 h-full";

    // Service tag + title
    const titleRow = document.createElement("div");
    titleRow.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-zinc-700 text-zinc-300 tracking-wide uppercase">${preset.service}</span>
        <h3 class="text-base font-semibold text-zinc-100">${preset.label}</h3>
      </div>
      <p class="text-xs text-zinc-500 mt-1 min-h-[1.25rem]">${preset.description ?? "&nbsp;"}</p>
    `;
    card.appendChild(titleRow);

    // Fields
    if (preset.fields.length > 0) {
      const fieldsGrid = document.createElement("div");
      fieldsGrid.className = "grid grid-cols-1 md:grid-cols-2 gap-3";

      for (const field of preset.fields) {
        const wrapper = document.createElement("label");
        wrapper.className =
          field.type === "textarea"
            ? "flex flex-col gap-1 text-xs text-zinc-400 md:col-span-2"
            : "flex flex-col gap-1 text-xs text-zinc-400";

        const span = document.createElement("span");
        span.textContent = field.label;
        wrapper.appendChild(span);

        const input =
          field.type === "textarea"
            ? document.createElement("textarea")
            : document.createElement("input");
        input.className =
          "w-full rounded bg-zinc-950 border border-zinc-700 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-400";
        input.value = field.default || "";
        if (field.type === "textarea") {
          (input as HTMLTextAreaElement).rows = 2;
        } else if (field.type === "number") {
          (input as HTMLInputElement).type = "number";
        }

        input.addEventListener("input", () => {
          currentParams[field.name] = input.value;
          updateCodePreview();
        });

        wrapper.appendChild(input);
        fieldsGrid.appendChild(wrapper);
      }
      card.appendChild(fieldsGrid);
    }

    // Spacer + bottom section
    const bottomSection = document.createElement("div");
    bottomSection.className = "mt-auto space-y-3";

    // Code preview
    const codeLabel = document.createElement("p");
    codeLabel.className = "text-[10px] uppercase tracking-wide text-zinc-500 mb-1";
    codeLabel.textContent = "Code preview";

    const codeContainer = document.createElement("pre");
    codeContainer.className =
      "text-xs text-zinc-200 bg-zinc-950 border border-zinc-700 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all";
    codeContainer.id = "code-preview";

    const codeWrapper = document.createElement("div");
    codeWrapper.appendChild(codeLabel);
    codeWrapper.appendChild(codeContainer);
    bottomSection.appendChild(codeWrapper);

    // Run button row
    const runRow = document.createElement("div");
    runRow.className = "flex items-center gap-3 justify-end";

    const runIndicator = document.createElement("span");
    runIndicator.className = "text-xs text-zinc-500 hidden";
    runIndicator.id = "run-indicator";
    runIndicator.textContent = "running…";

    const runBtn = document.createElement("button");
    runBtn.type = "button";
    runBtn.className =
      "rounded bg-zinc-100 hover:bg-white text-zinc-900 text-sm font-semibold px-4 py-1.5 transition";
    runBtn.textContent = "Run";

    runBtn.addEventListener("click", async () => {
      if (!currentPreset) return;
      runBtn.disabled = true;
      runIndicator.classList.remove("hidden");

      const label = `${currentPreset.service} / ${currentPreset.label}`;
      const start = Date.now();

      try {
        const result = await currentPreset.run(currentParams);
        const elapsed = Date.now() - start;
        addHistoryEntry(historyContainer, {
          label,
          output: JSON.stringify(result, null, 2),
          error: null,
          durationMs: elapsed,
        });
      } catch (err) {
        const elapsed = Date.now() - start;
        addHistoryEntry(historyContainer, {
          label,
          output: null,
          error: err instanceof Error ? err.message : String(err),
          durationMs: elapsed,
        });
      } finally {
        runBtn.disabled = false;
        runIndicator.classList.add("hidden");
      }
    });

    runRow.appendChild(runIndicator);
    runRow.appendChild(runBtn);
    bottomSection.appendChild(runRow);

    card.appendChild(bottomSection);
    container.appendChild(card);

    updateCodePreview();

    function updateCodePreview() {
      renderCode(codeContainer, currentPreset!.code(currentParams));
    }
  }
}

function addHistoryEntry(
  container: HTMLElement,
  entry: {
    label: string;
    output: string | null;
    error: string | null;
    durationMs: number;
  },
) {
  const placeholder = container.querySelector(".empty-placeholder");
  if (placeholder) placeholder.remove();

  const ok = entry.error === null;
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });

  const article = document.createElement("article");
  article.className = `rounded-lg border ${ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"} p-4 mb-3`;

  const badge = ok
    ? `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300">OK</span>`
    : `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-rose-500/20 text-rose-300">Error</span>`;

  const content = ok
    ? `<pre class="text-sm text-zinc-100 bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">${escapeHtml(entry.output!)}</pre>`
    : `<pre class="text-sm text-rose-300 bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">${escapeHtml(entry.error!)}</pre>`;

  article.innerHTML = `
    <header class="flex flex-wrap items-center gap-2 mb-2">
      ${badge}
      <span class="font-semibold text-zinc-100">${escapeHtml(entry.label)}</span>
      <span class="text-xs text-zinc-500 ml-auto">${time} · ${entry.durationMs}ms</span>
    </header>
    ${content}
  `;

  container.insertBefore(article, container.firstChild);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

init();
