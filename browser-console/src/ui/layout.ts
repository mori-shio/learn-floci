export function createLayout(): {
  sidebar: HTMLElement;
  codePanel: HTMLElement;
  resultPanel: HTMLElement;
  runButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  paramsPanel: HTMLElement;
} {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  app.innerHTML = `
    <div class="flex flex-col h-screen">
      <header class="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <h1 class="text-lg font-bold text-white">Floci Browser Console</h1>
        <button id="reset-btn" class="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded text-gray-300">Reset</button>
      </header>
      <div class="flex flex-1 overflow-hidden">
        <aside id="sidebar" class="w-64 overflow-y-auto border-r border-gray-800 bg-gray-900"></aside>
        <main class="flex-1 flex flex-col overflow-hidden">
          <div id="params-panel" class="border-b border-gray-800 p-4 bg-gray-900 hidden"></div>
          <div class="flex-1 flex flex-col overflow-hidden">
            <div class="flex-1 overflow-auto border-b border-gray-800 p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-500 uppercase tracking-wide">Code Preview</span>
              </div>
              <pre id="code-panel" class="text-sm font-mono text-gray-300 whitespace-pre-wrap"></pre>
            </div>
            <div class="p-3 border-b border-gray-800 bg-gray-900">
              <button id="run-btn" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium disabled:opacity-50" disabled>&#9654; 実行</button>
            </div>
            <div class="flex-1 overflow-auto p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-500 uppercase tracking-wide">Result</span>
              </div>
              <pre id="result-panel" class="text-sm font-mono text-gray-400 whitespace-pre-wrap"></pre>
            </div>
          </div>
        </main>
      </div>
      <footer class="px-4 py-2 bg-gray-900 border-t border-gray-800 text-xs text-gray-600">
        &#9888; Lambda, RDS, ElastiCache, EC2, ECS はブラウザ版では利用できません (Docker コンテナが必要なため)
      </footer>
    </div>
  `;

  return {
    sidebar: document.getElementById("sidebar")!,
    codePanel: document.getElementById("code-panel")!,
    resultPanel: document.getElementById("result-panel")!,
    runButton: document.getElementById("run-btn") as HTMLButtonElement,
    resetButton: document.getElementById("reset-btn") as HTMLButtonElement,
    paramsPanel: document.getElementById("params-panel")!,
  };
}
