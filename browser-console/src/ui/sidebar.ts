import { SERVICES, getPresetsByService } from "../presets";
import type { Preset } from "../types";

export function renderTabs(
  tabsContainer: HTMLElement,
  onTabChange: (service: string) => void,
): void {
  tabsContainer.innerHTML = "";

  for (const service of SERVICES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = service;
    btn.dataset.service = service;
    btn.className =
      "px-4 py-2 border-b-2 text-sm font-medium transition whitespace-nowrap border-transparent text-zinc-400 hover:text-zinc-200";
    btn.addEventListener("click", () => {
      tabsContainer
        .querySelectorAll("button")
        .forEach((b) => {
          b.className =
            "px-4 py-2 border-b-2 text-sm font-medium transition whitespace-nowrap border-transparent text-zinc-400 hover:text-zinc-200";
        });
      btn.className =
        "px-4 py-2 border-b-2 text-sm font-medium transition whitespace-nowrap border-zinc-200 text-zinc-100";
      onTabChange(service);
    });
    tabsContainer.appendChild(btn);
  }
}

export function renderPresetList(
  sidebar: HTMLElement,
  service: string,
  onSelect: (preset: Preset) => void,
): Preset | null {
  sidebar.innerHTML = "";
  const presets = getPresetsByService(service);

  for (const preset of presets) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = preset.label;
    btn.dataset.presetId = preset.id;
    btn.className =
      "w-full text-left px-3 py-1.5 text-sm rounded-r transition border-l-2 border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800";
    btn.addEventListener("click", () => {
      sidebar
        .querySelectorAll("button")
        .forEach((b) => {
          b.className =
            "w-full text-left px-3 py-1.5 text-sm rounded-r transition border-l-2 border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800";
        });
      btn.className =
        "w-full text-left px-3 py-1.5 text-sm rounded-r transition border-l-2 bg-zinc-700 text-zinc-100 border-zinc-300";
      onSelect(preset);
    });
    sidebar.appendChild(btn);
  }

  return presets[0] ?? null;
}

export function activateTab(tabsContainer: HTMLElement, service: string): void {
  const btn = tabsContainer.querySelector(
    `button[data-service="${service}"]`,
  ) as HTMLButtonElement | null;
  btn?.click();
}
