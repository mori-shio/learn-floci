import { createHighlighter, type Highlighter } from "shiki";

let highlighter: Highlighter | null = null;

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighter) {
    highlighter = await createHighlighter({
      themes: ["github-dark"],
      langs: ["typescript"],
    });
  }
  return highlighter;
}

export async function renderCode(
  container: HTMLElement,
  code: string
): Promise<void> {
  const hl = await getHighlighter();
  container.innerHTML = hl.codeToHtml(code, {
    lang: "typescript",
    theme: "github-dark",
  });
}
