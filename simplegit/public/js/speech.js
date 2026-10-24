// Optional spoken instructions using the browser's built-in speech.
// Speech never starts until the person turns it on or presses Repeat.
import { announce } from './ui.js';

const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let enabled = false;
let current = '';

function speak(text) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.9;
  u.lang = document.documentElement.lang || 'en';
  synth.speak(u);
}

export function stopSpeaking() {
  if (synth) synth.cancel();
}

// Called on every new screen with that screen's one-step instruction.
export function setInstruction(text) {
  current = text;
  if (enabled) speak(text);
  else stopSpeaking();
}

export function initSpeech() {
  if (!synth) return; // Not supported: the bar stays hidden.
  document.getElementById('speech-bar').hidden = false;
  // Remembered only for this browser tab, so speech never starts by surprise
  // on a later visit.
  try { enabled = sessionStorage.getItem('sg.speech') === 'on'; } catch { enabled = false; }

  const toggle = document.getElementById('speech-toggle');
  // Screen readers hear "Spoken Help, toggle button, pressed / not pressed";
  // the visible ": On / : Off" is hidden from them to avoid repeating it.
  const state = document.createElement('span');
  state.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.append('Spoken Help', state);
  toggle.replaceChildren(label);
  const update = () => {
    toggle.setAttribute('aria-pressed', String(enabled));
    state.textContent = enabled ? ': On' : ': Off';
  };
  update();

  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { sessionStorage.setItem('sg.speech', enabled ? 'on' : 'off'); } catch { /* ignore */ }
    update();
    if (enabled) speak(`Spoken help is on. ${current}`);
    else { stopSpeaking(); announce('Spoken help is off.'); }
  });
  document.getElementById('speech-repeat').addEventListener('click', () => speak(current));
  document.getElementById('speech-stop').addEventListener('click', () => { stopSpeaking(); announce('Stopped speaking.'); });
}
