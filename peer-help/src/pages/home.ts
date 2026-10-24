import { announce, byId } from "../common";
import { setUpSpeechInput } from "../speech";

const DESTINATIONS: { words: RegExp; page: string; name: string }[] = [
  // Most specific first: "help someone" also contains "help".
  { words: /\bhelp someone\b|\bhelp others\b|\btrainer\b/, page: "./help-someone.html", name: "Help Someone" },
  { words: /\bget help\b|\bneed help\b|\blearn\b/, page: "./get-help.html", name: "Get Help" },
  { words: /\binstructions?\b|\bsteps\b/, page: "./instructions.html", name: "My Instructions" },
];

setUpSpeechInput(byId<HTMLButtonElement>("speak"), byId("speech-help"), (text) => {
  const said = text.toLowerCase();
  const match = DESTINATIONS.find((d) => d.words.test(said));
  if (!match) {
    announce(`I heard "${text}". Please say get help, help someone, or my instructions.`);
    return;
  }
  announce(`Opening ${match.name}.`);
  window.location.href = match.page;
});
