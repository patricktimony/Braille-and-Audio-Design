// Optional speech input and output. Every feature here has a text equivalent:
// speech input fills the same text box people can type in, and "read aloud"
// reads text that is already on the page.

import { announce } from "./common";

// The Web Speech API is not in TypeScript's DOM types in every version.
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function speechInputSupported(): boolean {
  return recognitionConstructor() !== undefined;
}

/** A short tone, so people know when to start talking without speech being recorded. */
function beep(audio: AudioContext, frequency: number): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = frequency;
  gain.gain.value = 0.15;
  osc.connect(gain).connect(audio.destination);
  osc.start();
  osc.stop(audio.currentTime + 0.15);
}

const ERROR_MESSAGES: Record<string, string> = {
  "no-speech": "No speech was heard. Try again, or type instead.",
  "not-allowed": "Microphone permission was not given. You can type instead, or allow the microphone in your browser settings.",
  "service-not-allowed": "Speech input is turned off in this browser. You can type instead.",
  "audio-capture": "No microphone was found. You can type instead.",
  network: "Speech input needs an internet connection. You can type instead.",
};

/**
 * Wires a "speak" button. If speech input is not available the button is hidden
 * and the help text explains how to type or use the device's own dictation.
 */
export function setUpSpeechInput(
  button: HTMLButtonElement,
  helpText: HTMLElement,
  onText: (text: string) => void,
): void {
  const Ctor = recognitionConstructor();
  if (!Ctor) {
    button.hidden = true;
    helpText.textContent =
      "Speech input is not available in this browser. You can type, or use your device's own dictation, such as the microphone key on the iPhone keyboard.";
    return;
  }
  helpText.textContent =
    "After you press the button, wait for the tone, then speak. Pausing your screen reader first stops it from being heard by the microphone.";

  const idleLabel = button.textContent ?? "Speak";
  let recognition: Recognition | null = null;
  let audio: AudioContext | null = null;
  let startTimer: number | undefined;

  const reset = () => {
    recognition = null;
    window.clearTimeout(startTimer);
    button.textContent = idleLabel;
  };

  button.addEventListener("click", () => {
    if (recognition || startTimer) {
      recognition?.stop();
      startTimer = undefined;
      reset();
      announce("Stopped listening.");
      return;
    }
    audio ??= new AudioContext();
    const rec = new Ctor();
    rec.lang = document.documentElement.lang || "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results, (r) => r[0].transcript).join(" ").trim();
      if (audio) beep(audio, 660);
      if (text) onText(text);
    };
    rec.onerror = (e) => announce(ERROR_MESSAGES[e.error] ?? "Speech input stopped. You can type instead.");
    rec.onend = reset;

    button.textContent = "Stop listening";
    announce("Get ready. Speak after the tone.");
    // Give the screen reader time to finish speaking before the microphone opens.
    startTimer = window.setTimeout(() => {
      startTimer = undefined;
      recognition = rec;
      if (audio) beep(audio, 880);
      try {
        rec.start();
      } catch {
        reset();
        announce("Speech input could not start. You can type instead.");
      }
    }, 1800);
  });
}

// --- Speech output -------------------------------------------------------

export function speechOutputSupported(): boolean {
  return "speechSynthesis" in window;
}

/** A button that reads text aloud, for people who are not using a screen reader. */
export function setUpReadAloud(button: HTMLButtonElement, getText: () => string): void {
  if (!speechOutputSupported()) {
    button.hidden = true;
    return;
  }
  const idleLabel = button.textContent ?? "Read aloud";
  button.addEventListener("click", () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      button.textContent = idleLabel;
      return;
    }
    const utterance = new SpeechSynthesisUtterance(getText());
    utterance.onend = () => (button.textContent = idleLabel);
    button.textContent = "Stop reading";
    speechSynthesis.speak(utterance);
  });
}
