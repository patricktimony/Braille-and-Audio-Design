import { announce, byId, clearFieldError, h, moveFocusTo, showFieldError } from "../common";
import { matchTrainers, type TrainerMatch } from "../matching";
import { auth } from "../services/auth";
import { newCallUrl } from "../services/calls";
import { startSession } from "../services/messaging";
import { repository } from "../services/repository";
import { detectSkills, SKILLS, skillLabel } from "../skills";
import { setUpSpeechInput } from "../speech";
import type { SkillId } from "../types";

const form = byId<HTMLFormElement>("help-form");
const request = byId<HTMLTextAreaElement>("request");
const requestError = byId("request-error");
const volunteerOnly = byId<HTMLInputElement>("volunteer-only");
const results = byId("results");
const resultsHeading = byId("results-heading");
const resultsSummary = byId("results-summary");
const resultsList = byId("results-list");
const topicForm = byId<HTMLFormElement>("topic-form");
const topic = byId<HTMLSelectElement>("topic");

topic.append(...SKILLS.map((s) => h("option", { value: s.id }, s.label)));

setUpSpeechInput(byId<HTMLButtonElement>("speak"), byId("speech-help"), (text) => {
  request.value = request.value ? `${request.value} ${text}` : text;
  announce(`Heard: ${text}. You can edit it in the text box, then press Find helpers.`);
  request.focus();
});

function renderMatch(match: TrainerMatch, skills: SkillId[]): HTMLLIElement {
  const t = match.trainer;
  const profile = t.trainer!;
  const button = h("button", { type: "button" }, `Request a session with ${t.displayName}`);
  button.addEventListener("click", () => {
    const session = startSession(request.value.trim(), skills, t, newCallUrl());
    window.location.href = `./session.html?id=${encodeURIComponent(session.id)}`;
  });
  return h(
    "li",
    { class: "card" },
    h("h3", {}, t.displayName),
    h("p", {}, `Can help with: ${match.matchedSkills.map(skillLabel).join(", ")}.`),
    h("p", {}, `Available: ${profile.availability || "not stated"}.`),
    h("p", {}, profile.pricing === "volunteer" ? "Volunteer (free)." : `Charges for training. ${profile.rateNote}`.trim()),
    ...(profile.bio ? [h("p", {}, profile.bio)] : []),
    button,
  );
}

function showResults(skills: SkillId[]): void {
  results.hidden = false;
  resultsList.replaceChildren();
  topicForm.hidden = skills.length > 0;

  if (skills.length === 0) {
    resultsHeading.textContent = "Which topic is closest?";
    resultsSummary.textContent =
      "We could not tell which skill you need. Choose the closest topic, or try describing it in other words, for example naming your device or screen reader.";
    moveFocusTo(resultsHeading);
    return;
  }

  const matches = matchTrainers(repository.listPeople(), skills, {
    volunteerOnly: volunteerOnly.checked,
    excludePersonId: auth.currentPerson().id,
  });
  const topics = skills.map(skillLabel).join(", ");
  if (matches.length === 0) {
    resultsHeading.textContent = "No helpers found";
    resultsSummary.textContent = `Nobody is listed for: ${topics}.${volunteerOnly.checked ? " Try unticking Only show volunteers." : ""}`;
  } else {
    resultsHeading.textContent = `${matches.length} ${matches.length === 1 ? "helper" : "helpers"} found`;
    resultsSummary.textContent = `Topics we understood: ${topics}. Best matches are first.`;
    resultsList.append(...matches.map((m) => renderMatch(m, skills)));
  }
  moveFocusTo(resultsHeading);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  clearFieldError(request, requestError);
  const text = request.value.trim();
  if (!text) {
    showFieldError(request, requestError, "Please say or type what you need help with.");
    return;
  }
  showResults(detectSkills(text));
});

topicForm.addEventListener("submit", (e) => {
  e.preventDefault();
  showResults([topic.value]);
});
