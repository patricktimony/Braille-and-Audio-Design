// Review-and-save form for generated instructions. Used after a session and
// after pasting a transcript. People always check the steps before saving,
// and instructions are private unless they explicitly choose to share them.

import { byId, clearFieldError, moveFocusTo, showFieldError } from "./common";
import type { GeneratedInstructions } from "./services/instruction-generator";
import { newId, nowIso } from "./services/ids";
import { repository } from "./services/repository";
import type { Instruction } from "./types";

// Static markup only. Text from people is filled in through .value, never as HTML.
const MARKUP = `
  <h3 id="editor-heading">Review your instructions</h3>
  <p class="hint" id="editor-method"></p>
  <form id="editor-form" novalidate>
    <label for="editor-title">Title</label>
    <input type="text" id="editor-title" name="title">
    <label for="editor-steps">Steps, one per line</label>
    <p class="hint" id="editor-steps-hint"></p>
    <p class="error" id="editor-steps-error" hidden></p>
    <textarea id="editor-steps" name="steps" rows="8" aria-describedby="editor-steps-hint editor-steps-error"></textarea>
    <fieldset>
      <legend>Who can see these instructions?</legend>
      <div class="radio"><input type="radio" id="editor-private" name="sharing" value="private" checked><label for="editor-private">Only me (private)</label></div>
      <div class="radio"><input type="radio" id="editor-shared" name="sharing" value="shared"><label for="editor-shared">Me, and share a copy in the Shared Library</label></div>
      <div id="editor-share-confirm" hidden>
        <p class="error" id="editor-share-error" hidden></p>
        <div class="check">
          <input type="checkbox" id="editor-share-ok" aria-describedby="editor-share-error">
          <label for="editor-share-ok">I confirm these steps contain no names, addresses, passwords, or other personal information.</label>
        </div>
      </div>
    </fieldset>
    <button type="submit">Save to My Instructions</button>
  </form>`;

export function parseSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.):]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}

export function showInstructionEditor(
  container: HTMLElement,
  draft: GeneratedInstructions,
  source: Instruction["source"],
  sessionId?: string,
): void {
  container.innerHTML = MARKUP;
  byId("editor-method").textContent = draft.method;
  byId<HTMLInputElement>("editor-title").value = draft.title;
  const steps = byId<HTMLTextAreaElement>("editor-steps");
  steps.value = draft.steps.join("\n");
  byId("editor-steps-hint").textContent =
    draft.steps.length > 0
      ? `${draft.steps.length} steps were found. Each line becomes one numbered step.`
      : "No steps were found automatically. Type each step on its own line.";

  const confirmBox = byId("editor-share-confirm");
  const sharedRadio = byId<HTMLInputElement>("editor-shared");
  for (const radio of container.querySelectorAll<HTMLInputElement>('input[name="sharing"]')) {
    radio.addEventListener("change", () => (confirmBox.hidden = !sharedRadio.checked));
  }

  byId("editor-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const stepsError = byId("editor-steps-error");
    const shareOk = byId<HTMLInputElement>("editor-share-ok");
    const shareError = byId("editor-share-error");
    clearFieldError(steps, stepsError);
    clearFieldError(shareOk, shareError);

    const stepList = parseSteps(steps.value);
    if (stepList.length === 0) {
      showFieldError(steps, stepsError, "Add at least one step before saving.");
      return;
    }
    const share = sharedRadio.checked;
    if (share && !shareOk.checked) {
      showFieldError(shareOk, shareError, "To share, tick the box to confirm there is no personal information. Or choose Only me.");
      return;
    }
    const instruction: Instruction = {
      id: newId("instr"),
      title: byId<HTMLInputElement>("editor-title").value.trim() || "My instructions",
      steps: stepList,
      createdAt: nowIso(),
      source,
      sessionId,
      sharing: share ? "shared" : "private",
      sharingConsentAt: share ? nowIso() : undefined,
    };
    repository.saveInstruction(instruction);
    window.location.href = `./instructions.html?id=${encodeURIComponent(instruction.id)}&saved=1`;
  });

  moveFocusTo(byId("editor-heading"));
}
