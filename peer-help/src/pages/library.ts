import { announce, byId, h } from "../common";
import { newId, nowIso } from "../services/ids";
import { repository } from "../services/repository";
import type { LibraryEntry } from "../types";

const search = byId<HTMLInputElement>("search");
const container = byId("library");
const summary = byId("library-summary");
const entries = repository.listLibrary();

function renderEntry(entry: LibraryEntry): HTMLElement {
  const copy = h("button", { type: "button" }, `Save a copy of "${entry.title}" to My Instructions`);
  copy.addEventListener("click", () => {
    repository.saveInstruction({
      id: newId("instr"),
      title: entry.title,
      steps: [...entry.steps],
      createdAt: nowIso(),
      source: "typed",
      sharing: "private",
    });
    announce(`Saved a private copy of "${entry.title}" to My Instructions.`);
  });
  return h(
    "article",
    { class: "card" },
    h("h2", {}, entry.title),
    h("p", { class: "hint" }, entry.isDemo ? "Demonstration entry." : "Shared by you from this device."),
    h("ol", {}, ...entry.steps.map((s) => h("li", {}, s))),
    ...(entry.isDemo ? [copy] : []),
  );
}

function render(): void {
  const q = search.value.trim().toLowerCase();
  const shown = entries.filter(
    (e) => !q || e.title.toLowerCase().includes(q) || e.steps.some((s) => s.toLowerCase().includes(q)),
  );
  summary.textContent = `Showing ${shown.length} of ${entries.length} entries.`;
  container.replaceChildren(...shown.map(renderEntry));
}

render();

let timer: number | undefined;
search.addEventListener("input", () => {
  render();
  // Wait for a pause in typing before announcing, so the count is not read on every key.
  window.clearTimeout(timer);
  timer = window.setTimeout(() => announce(summary.textContent ?? ""), 700);
});
