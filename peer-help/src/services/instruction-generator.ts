// Turns a training conversation into numbered steps.
//
// The prototype uses simple on-device rules, not AI, so no paid API and no data
// leaves the device. A future AI service (for example a self-hosted open model)
// can implement the same interface. Whatever produces the steps, the person
// always reviews and edits them before saving.

export interface GeneratedInstructions {
  title: string;
  steps: string[];
  /** Plain-English description of how the steps were produced, shown to the person. */
  method: string;
}

export interface InstructionGenerator {
  generate(transcript: string, topic: string): Promise<GeneratedInstructions>;
}

// Words that usually start an instruction in assistive technology training.
const ACTION_VERBS = [
  "activate", "add", "adjust", "ask", "attach", "change", "check", "choose", "click", "close",
  "connect", "copy", "double-tap", "double", "download", "drag", "enter", "find", "flick", "go",
  "hold", "install", "launch", "listen", "move", "navigate", "open", "paste", "place", "point",
  "position", "practice", "practise", "press", "put", "read", "repeat", "save", "say", "scan", "scroll", "search", "select",
  "send", "set", "slide", "start", "stop", "swipe", "switch", "tab", "take", "tap", "triple-tap",
  "turn", "type", "use", "wait",
];

const KEY_COMBO = /\b(insert|ctrl|control|alt|shift|caps ?lock|windows|win|cmd|command|option|vo|nvda)\s*\+\s*\w+/i;
const LIST_MARKER = /^\s*(?:step\s*)?(?:\d+[.):]|[-*•])\s+/i;
const SPEAKER_LABEL = /^\s*[\p{L}\p{N} ().'-]{1,40}:\s+/u;
const FILLER = /^(ok(ay)?|so|now|next|then|first|after that|and|great|good|right|alright|well|finally)[,]?\s+/i;

function splitSentences(line: string): string[] {
  return line.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((s) => s.trim()).filter(Boolean);
}

function stripFiller(sentence: string): string {
  let s = sentence;
  for (let i = 0; i < 3; i++) s = s.replace(FILLER, "");
  return s;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "When the text appears, swipe right" is still an instruction: look past a leading clause.
const LEADING_CLAUSE = /^(when|if|once|after|before|in|on|to|from)\b[^,]{0,60},\s*/;

function isInstruction(sentence: string): boolean {
  const s = stripFiller(sentence).toLowerCase().replace(LEADING_CLAUSE, "");
  const firstWord = s.split(/[\s,]+/)[0] ?? "";
  if (ACTION_VERBS.includes(firstWord)) return true;
  if (/^you (can|should|will|need to) /.test(s)) return true;
  return KEY_COMBO.test(s);
}

export function extractSteps(transcript: string): string[] {
  const steps: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of transcript.split(/\r?\n/)) {
    const hadMarker = LIST_MARKER.test(rawLine);
    const line = rawLine.replace(SPEAKER_LABEL, "").replace(LIST_MARKER, "").trim();
    if (!line) continue;
    for (const sentence of splitSentences(line)) {
      if (sentence.endsWith("?")) continue;
      if (!hadMarker && !isInstruction(sentence)) continue;
      let step = capitalise(stripFiller(sentence).replace(/^you (can|should|will|need to) /i, ""));
      if (!/[.!]$/.test(step)) step += ".";
      const key = step.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      steps.push(step);
    }
  }
  return steps;
}

export class RuleBasedInstructionGenerator implements InstructionGenerator {
  async generate(transcript: string, topic: string): Promise<GeneratedInstructions> {
    const cleanTopic = topic.trim().replace(/^i (need|want) (help|someone to teach me|to learn)( with| how to)?\s*/i, "");
    return {
      title: cleanTopic ? `How to: ${capitalise(cleanTopic)}` : "My instructions",
      steps: extractSteps(transcript),
      method:
        "These steps were picked out of the conversation by simple rules on this device, not by AI. Check every step, then edit, add, or remove steps before saving.",
    };
  }
}
