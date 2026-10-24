import { announce, byId, clearFieldError, confirmOnPage, formatDate, h, moveFocusTo, queryParam, showFieldError } from "../common";
import { showInstructionEditor } from "../editor";
import { nowIso } from "../services/ids";
import { RuleBasedInstructionGenerator } from "../services/instruction-generator";
import { repository } from "../services/repository";
import { setUpReadAloud } from "../speech";
import type { Instruction } from "../types";

const id = queryParam("id");
const instruction = id ? repository.getInstruction(id) : undefined;

if (instruction) showDetail(instruction);
else showList(id !== null);

// --- List of saved instructions, plus making new ones ------------------

function showList(missing: boolean): void {
  byId("list-view").hidden = false;
  const all = repository.listInstructions();
  byId("list-summary").textContent =
    (missing ? "Those instructions were not found; they may have been deleted. " : "") +
    (all.length === 0
      ? "You have no saved instructions yet. Finish a session on Get Help, or paste a transcript below."
      : `You have ${all.length} saved ${all.length === 1 ? "set" : "sets"} of instructions.`);
  byId("instruction-list").replaceChildren(
    ...all.map((i) =>
      h("li", {},
        h("a", { href: `./instructions.html?id=${encodeURIComponent(i.id)}` }, i.title),
        ` (${i.steps.length} steps, saved ${formatDate(i.createdAt)}${i.sharing === "shared" ? ", shared" : ""})`,
      ),
    ),
  );

  const form = byId<HTMLFormElement>("transcript-form");
  const transcript = byId<HTMLTextAreaElement>("transcript");
  const consent = byId<HTMLInputElement>("transcript-consent");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const transcriptError = byId("transcript-error");
    const consentError = byId("transcript-consent-error");
    clearFieldError(transcript, transcriptError);
    clearFieldError(consent, consentError);
    if (!transcript.value.trim()) {
      showFieldError(transcript, transcriptError, "Paste or type the transcript first.");
      return;
    }
    if (!consent.checked) {
      showFieldError(consent, consentError, "Only use a conversation if everyone in it agreed. Tick the box to confirm.");
      return;
    }
    const draft = await new RuleBasedInstructionGenerator().generate(
      transcript.value,
      byId<HTMLInputElement>("transcript-topic").value,
    );
    showInstructionEditor(byId("editor"), draft, "transcript");
  });

  byId("write-own").addEventListener("click", () => {
    showInstructionEditor(
      byId("editor"),
      { title: "", steps: [], method: "Type a title, then each step on its own line." },
      "typed",
    );
  });
}

// --- One set of instructions -------------------------------------------

function asText(i: Instruction): string {
  return `${i.title}\n\n${i.steps.map((s, n) => `${n + 1}. ${s}`).join("\n")}\n`;
}

function showDetail(i: Instruction): void {
  byId("detail-view").hidden = false;
  const title = byId("detail-title");
  title.textContent = i.title;
  document.title = `${i.title} – Peer Tech Help`;
  byId("detail-meta").textContent = `${i.steps.length} steps. Saved ${formatDate(i.createdAt)}.`;
  byId("detail-steps").replaceChildren(...i.steps.map((s) => h("li", {}, s)));

  setUpReadAloud(byId<HTMLButtonElement>("read-aloud"), () =>
    i.steps.map((s, n) => `Step ${n + 1}. ${s}`).join(" "),
  );

  byId("download").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([asText(i)], { type: "text/plain" }));
    const link = h("a", { href: url, download: `${i.title.replace(/[^\w -]+/g, "").trim() || "instructions"}.txt` });
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    announce("Download started.");
  });

  renderSharing(i);

  // The confirmation is part of the page rather than a browser dialog, so it
  // works everywhere the page is shown, including embedded viewers.
  confirmOnPage(byId("delete"), byId("delete-confirm"), byId("delete-question"), byId("delete-yes"), byId("delete-no"), () => {
    repository.deleteInstruction(i.id);
    window.location.href = "./instructions.html";
  });

  if (queryParam("saved")) announce("Saved to My Instructions.");
  moveFocusTo(title);
}

function renderSharing(i: Instruction): void {
  const state = byId("sharing-state");
  const shareForm = byId<HTMLFormElement>("share-form");
  const unshare = byId<HTMLButtonElement>("unshare");
  const shared = i.sharing === "shared";
  state.textContent = shared
    ? "Shared in the Shared Library. In this prototype the library is only on this device."
    : "Private. Only you can see these instructions.";
  shareForm.hidden = shared;
  unshare.hidden = !shared;
}

byId<HTMLFormElement>("share-form").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!instruction) return;
  const confirm = byId<HTMLInputElement>("share-confirm");
  const error = byId("share-error");
  clearFieldError(confirm, error);
  if (!confirm.checked) {
    showFieldError(confirm, error, "Tick the box to confirm before sharing.");
    return;
  }
  instruction.sharing = "shared";
  instruction.sharingConsentAt = nowIso();
  repository.saveInstruction(instruction);
  renderSharing(instruction);
  announce("Shared in the library.");
  moveFocusTo(byId("sharing-state"));
});

byId("unshare").addEventListener("click", () => {
  if (!instruction) return;
  instruction.sharing = "private";
  instruction.sharingConsentAt = undefined;
  repository.saveInstruction(instruction);
  byId<HTMLInputElement>("share-confirm").checked = false;
  renderSharing(instruction);
  announce("No longer shared. These instructions are private.");
  moveFocusTo(byId("sharing-state"));
});
