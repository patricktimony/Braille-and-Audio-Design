import { announce, byId, clearFieldError, h, showFieldError } from "../common";
import { DEMO_REQUESTS } from "../demo-data";
import { auth } from "../services/auth";
import { repository } from "../services/repository";
import { detectSkills, SKILLS, skillLabel } from "../skills";
import type { Pricing } from "../types";

const form = byId<HTMLFormElement>("trainer-form");
const name = byId<HTMLInputElement>("name");
const skillsBox = byId("skills");
const availability = byId<HTMLTextAreaElement>("availability");
const rate = byId<HTMLInputElement>("rate");
const bio = byId<HTMLTextAreaElement>("bio");
const listed = byId<HTMLInputElement>("listed");

const me = auth.currentPerson();

skillsBox.append(
  ...SKILLS.map((s) =>
    h("div", { class: "check" },
      h("input", { type: "checkbox", id: `skill-${s.id}`, name: "skills", value: s.id }),
      h("label", { for: `skill-${s.id}` }, s.label),
    ),
  ),
);

function selectedSkills(): string[] {
  return Array.from(skillsBox.querySelectorAll<HTMLInputElement>("input:checked"), (i) => i.value);
}

// Fill the form from the saved profile.
name.value = me.displayName;
listed.checked = me.isTrainer;
if (me.trainer) {
  for (const id of me.trainer.skills) {
    const box = document.getElementById(`skill-${id}`) as HTMLInputElement | null;
    if (box) box.checked = true;
  }
  availability.value = me.trainer.availability;
  rate.value = me.trainer.rateNote;
  bio.value = me.trainer.bio;
  byId<HTMLInputElement>(`pricing-${me.trainer.pricing}`).checked = true;
} else {
  listed.checked = true;
}

function renderRequests(): void {
  const mine = me.trainer?.skills ?? [];
  const list = byId("requests");
  const matching = DEMO_REQUESTS.filter((r) => detectSkills(r.text).some((s) => mine.includes(s)));
  byId("requests-summary").textContent =
    mine.length === 0
      ? "Save your skills to see which requests match them."
      : `${matching.length} of ${DEMO_REQUESTS.length} demonstration requests match your skills.`;
  list.replaceChildren(
    ...matching.map((r) =>
      h("li", {}, `${r.learnerName}: "${r.text}" Topics: ${detectSkills(r.text).map(skillLabel).join(", ")}.`),
    ),
  );
}
renderRequests();

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const nameError = byId("name-error");
  const skillsError = byId("skills-error");
  clearFieldError(name, nameError);
  skillsError.hidden = true;

  if (!name.value.trim()) {
    showFieldError(name, nameError, "Please enter a first name or nickname.");
    return;
  }
  const skills = selectedSkills();
  if (listed.checked && skills.length === 0) {
    skillsError.textContent = "Choose at least one skill you can teach.";
    skillsError.hidden = false;
    skillsBox.querySelector<HTMLInputElement>("input")?.focus();
    return;
  }

  me.displayName = name.value.trim();
  me.isTrainer = listed.checked;
  me.trainer = {
    skills,
    availability: availability.value.trim(),
    pricing: (form.querySelector<HTMLInputElement>('input[name="pricing"]:checked')?.value ?? "volunteer") as Pricing,
    rateNote: rate.value.trim(),
    bio: bio.value.trim(),
  };
  repository.saveMe(me);
  renderRequests();
  announce(
    me.isTrainer
      ? "Trainer profile saved. In this prototype it is stored only on this device, so learners elsewhere cannot find you yet."
      : "Saved. You are not listed as a trainer.",
    byId("save-status"),
  );
});
