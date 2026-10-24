import { announce, byId } from "../common";
import { auth } from "../services/auth";
import { repository } from "../services/repository";

const me = auth.currentPerson();
const name = byId<HTMLInputElement>("name");
const isLearner = byId<HTMLInputElement>("is-learner");
const isTrainer = byId<HTMLInputElement>("is-trainer");
const uses = byId<HTMLTextAreaElement>("uses");

name.value = me.displayName;
isLearner.checked = me.isLearner;
isTrainer.checked = me.isTrainer;
uses.value = me.usesTechnology;

function renderDataSummary(): void {
  const sessions = repository.listSessions().length;
  const instructions = repository.listInstructions().length;
  byId("data-summary").textContent =
    `Stored in this browser: your profile, ${sessions} ${sessions === 1 ? "session" : "sessions"}, and ${instructions} saved ${instructions === 1 ? "set" : "sets"} of instructions. Nothing is stored anywhere else.`;
}
renderDataSummary();

byId<HTMLFormElement>("profile-form").addEventListener("submit", (e) => {
  e.preventDefault();
  me.displayName = name.value.trim();
  me.isLearner = isLearner.checked;
  me.isTrainer = isTrainer.checked;
  me.usesTechnology = uses.value.trim();
  repository.saveMe(me);
  announce(
    me.isTrainer && !me.trainer?.skills.length
      ? "Profile saved. Next, add the skills you can teach on the Help Someone page."
      : "Profile saved.",
    byId("save-status"),
  );
});

byId("delete-all").addEventListener("click", () => {
  if (!window.confirm("Delete your profile, sessions, and saved instructions from this device? This cannot be undone.")) return;
  repository.deleteEverything();
  window.location.href = "./index.html";
});
