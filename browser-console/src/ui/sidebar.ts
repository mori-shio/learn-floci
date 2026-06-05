import { SERVICES, getPresetsByService } from "../presets";
import type { Preset } from "../types";

export function renderSidebar(
  container: HTMLElement,
  onSelect: (preset: Preset) => void
): void {
  container.innerHTML = "";

  for (const service of SERVICES) {
    const presets = getPresetsByService(service);
    const section = document.createElement("div");
    section.className = "border-b border-gray-800";

    const header = document.createElement("button");
    header.className =
      "w-full text-left px-4 py-2 text-sm font-semibold text-gray-400 hover:bg-gray-800 flex items-center gap-1";
    header.textContent = service;

    const list = document.createElement("div");
    list.className = "hidden";

    header.addEventListener("click", () => {
      list.classList.toggle("hidden");
    });

    for (const preset of presets) {
      const item = document.createElement("button");
      item.className =
        "w-full text-left px-6 py-1.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white";
      item.textContent = preset.label;
      item.dataset.presetId = preset.id;
      item.addEventListener("click", () => {
        container
          .querySelectorAll("[data-preset-id]")
          .forEach((el) => el.classList.remove("bg-gray-800", "text-white"));
        item.classList.add("bg-gray-800", "text-white");
        onSelect(preset);
      });
      list.appendChild(item);
    }

    section.appendChild(header);
    section.appendChild(list);
    container.appendChild(section);
  }
}
