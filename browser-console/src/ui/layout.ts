export function createLayout(): {
  tabsContainer: HTMLElement;
  sidebar: HTMLElement;
  cardArea: HTMLElement;
  historyContainer: HTMLElement;
  resetButton: HTMLButtonElement;
} {
  const app = document.getElementById("app")!;
  app.innerHTML = `
    <header class="border-b border-zinc-700 px-6 py-3 flex items-center gap-4">
      <h1 class="text-base font-bold">
        <span class="text-zinc-300">Floci</span> Browser Console
      </h1>
      <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-sky-500/20 text-sky-300">JS SDK</span>
      <span class="text-xs text-zinc-500 font-mono">Mock API (Service Worker)</span>
      <div class="ml-auto">
        <button
          id="reset-btn"
          class="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded border border-zinc-700 hover:border-zinc-600"
        >Reset</button>
      </div>
    </header>

    <nav id="tabs" role="tablist" class="px-6 border-b border-zinc-700 flex gap-1 overflow-x-auto"></nav>

    <main class="max-w-[1600px] mx-auto px-6 pt-4 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
      <aside id="sidebar" class="self-start overflow-y-auto max-h-[340px] lg:max-h-[360px]"></aside>
      <section id="card-area" class="min-h-[360px]"></section>
    </main>

    <section class="max-w-[1600px] mx-auto px-6 pb-6 pt-6">
      <div class="border-t border-zinc-700 pt-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-zinc-300">History</h2>
          <span class="text-xs text-zinc-600">最新が上</span>
        </div>
        <div id="history" class="space-y-3">
          <p class="empty-placeholder text-xs text-zinc-600 italic">まだ実行履歴がありません。コマンドを選んで Run を押してください。</p>
        </div>
      </div>
    </section>

    <footer class="border-t border-zinc-700 px-6 py-2 text-xs text-zinc-600">
      &#9888; Lambda, RDS, ElastiCache, EC2, ECS はブラウザ版では利用できません (Docker コンテナが必要なため)
    </footer>
  `;

  return {
    tabsContainer: document.getElementById("tabs")!,
    sidebar: document.getElementById("sidebar")!,
    cardArea: document.getElementById("card-area")!,
    historyContainer: document.getElementById("history")!,
    resetButton: document.getElementById("reset-btn") as HTMLButtonElement,
  };
}
