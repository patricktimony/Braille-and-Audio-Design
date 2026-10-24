import { announce, byId, clearFieldError, h, queryParam, showFieldError } from "../common";
import { showInstructionEditor } from "../editor";
import { callServiceName } from "../services/calls";
import { RuleBasedInstructionGenerator } from "../services/instruction-generator";
import { messaging } from "../services/messaging";
import { repository } from "../services/repository";
import { setUpSpeechInput } from "../speech";
import type { Message, Session } from "../types";

const generator = new RuleBasedInstructionGenerator();
const session = repository.getSession(queryParam("id") ?? "");

if (!session) {
  byId("not-found").hidden = false;
} else {
  showSession(session);
}

function showSession(session: Session): void {
  const trainer = repository.getPerson(session.trainerId);
  const trainerName = trainer?.displayName ?? "your trainer";
  byId("session").hidden = false;
  byId("session-title").textContent = `Session with ${trainerName}`;
  document.title = `Session with ${trainerName} – Peer Tech Help`;
  byId("simulated-notice").hidden = !session.simulated;
  byId("session-request").textContent = `You asked: "${session.requestText}"`;

  const callLink = byId<HTMLAnchorElement>("call-link");
  callLink.href = session.callUrl;
  callLink.textContent = `Join a voice call on ${callServiceName()} (external website)`;
  if (session.simulated) {
    byId("call-hint").textContent =
      `The call opens on ${callServiceName()}, a free external service that may ask you to sign in. Demonstration trainers are not real people and will not join the call.`;
  }

  const list = byId("messages");
  const speaker = (m: Message) => (m.from === "me" ? "You" : trainerName);
  const renderMessage = (m: Message) =>
    h("li", {}, h("strong", {}, `${speaker(m)}${m.simulated ? " (simulated)" : ""}: `), m.text);
  list.replaceChildren(...session.messages.map(renderMessage));

  // --- Sending messages ---
  const form = byId<HTMLFormElement>("message-form");
  const input = byId<HTMLInputElement>("message");
  const error = byId("message-error");

  setUpSpeechInput(byId<HTMLButtonElement>("speak"), byId("speech-help"), (text) => {
    input.value = text;
    announce(`Heard: ${text}. Press Send, or edit the message first.`);
    input.focus();
  });

  let sending = false;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldError(input, error);
    const text = input.value.trim();
    if (!text) {
      showFieldError(input, error, "Type a message before sending.");
      return;
    }
    if (sending) return;
    sending = true;
    input.value = "";
    const pending = messaging.send(session, text);
    list.append(renderMessage(session.messages[session.messages.length - 1]));
    announce("Sent.");
    const { reply } = await pending;
    sending = false;
    if (reply) {
      list.append(renderMessage(reply));
      // Replies are announced explicitly rather than through a live list, which
      // screen readers handle inconsistently.
      announce(`${trainerName} replied: ${reply.text}`);
    }
  });

  // --- Turning the conversation into instructions ---
  const consent = byId<HTMLInputElement>("consent");
  const consentError = byId("consent-error");
  byId("consent-hint").textContent = session.simulated
    ? "In a real session both people would have to agree. This demonstration trainer's agreement is simulated."
    : "Your trainer must also agree before the conversation is used.";

  byId("create").addEventListener("click", async () => {
    clearFieldError(consent, consentError);
    if (!consent.checked) {
      showFieldError(consent, consentError, "Please tick the agreement box first. The conversation is only used if you agree.");
      return;
    }
    // The trainer's side holds the teaching; leaving out the learner's side
    // also keeps the learner's own words out of the generated steps.
    const transcript = session.messages
      .filter((m) => m.from === "other")
      .map((m) => `${trainerName}: ${m.text}`)
      .join("\n");
    const draft = await generator.generate(transcript, session.requestText);
    showInstructionEditor(byId("editor"), draft, "session", session.id);
  });
}
