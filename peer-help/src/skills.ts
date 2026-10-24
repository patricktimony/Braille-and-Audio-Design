import type { Skill, SkillId } from "./types";

// The skill list drives both trainer profiles and request matching.
// Keywords are matched as whole words or phrases against a lower-cased request.
export const SKILLS: Skill[] = [
  { id: "jaws", label: "JAWS screen reader (Windows)", keywords: ["jaws", "freedom scientific"] },
  { id: "nvda", label: "NVDA screen reader (Windows)", keywords: ["nvda", "non visual desktop access", "nonvisual desktop access"] },
  { id: "narrator", label: "Windows Narrator", keywords: ["narrator"] },
  { id: "voiceover-ios", label: "VoiceOver on iPhone or iPad", keywords: ["voiceover", "voice over", "iphone", "ipad", "ios", "rotor"] },
  { id: "voiceover-mac", label: "VoiceOver on Mac", keywords: ["mac", "macbook", "macos", "imac"] },
  { id: "talkback", label: "TalkBack on Android", keywords: ["talkback", "talk back", "android", "samsung", "pixel"] },
  { id: "magnification", label: "Screen magnification (ZoomText, Zoom, Magnifier)", keywords: ["zoomtext", "zoom text", "magnifier", "magnification", "magnify", "zoom", "fusion", "low vision", "bigger text", "larger text", "enlarge"] },
  { id: "braille", label: "Braille displays", keywords: ["braille", "refreshable", "focus 40", "brailliant", "orbit", "mantis"] },
  { id: "scanning", label: "Scanning and reading documents (OCR)", keywords: ["scan", "scanning", "scanner", "ocr", "read a document", "read documents", "read my mail", "mail", "letter", "printed", "print", "seeing ai", "envision", "kurzweil", "openbook", "pdf"] },
  { id: "visual-help-apps", label: "Visual assistance apps (Be My Eyes, Aira)", keywords: ["be my eyes", "aira", "video call", "describe", "identify"] },
  { id: "email", label: "Email", keywords: ["email", "e-mail", "outlook", "gmail", "inbox", "attachment"] },
  { id: "web", label: "Web browsing and online forms", keywords: ["web", "website", "browser", "browse", "internet", "chrome", "edge", "safari", "firefox", "online form", "shopping", "banking"] },
  { id: "word-processing", label: "Word processing (Microsoft Word, Pages)", keywords: ["word", "microsoft word", "word document", "word processing", "pages", "google docs", "write a letter", "letter writing"] },
  { id: "spreadsheets", label: "Spreadsheets (Excel)", keywords: ["excel", "spreadsheet", "spreadsheets", "numbers", "google sheets"] },
  { id: "smartphone-basics", label: "Smartphone basics", keywords: ["smartphone", "phone", "apps", "app store", "text message", "texting", "siri", "dictation"] },
  { id: "computer-basics", label: "Computer and keyboard basics", keywords: ["computer", "keyboard", "typing", "files", "folders", "windows", "laptop", "pc", "shortcuts"] },
];

const byId = new Map(SKILLS.map((s) => [s.id, s]));

export function skillLabel(id: SkillId): string {
  return byId.get(id)?.label ?? id;
}

export function isKnownSkill(id: string): boolean {
  return byId.has(id);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Finds the skills a free-text request is about, strongest first.
 * A request naming a product ("JAWS") beats one naming a general topic ("computer"),
 * because product names are more specific: longer keywords score higher.
 */
export function detectSkills(text: string): SkillId[] {
  const lower = ` ${text.toLowerCase().replace(/[^a-z0-9+\- ]+/g, " ")} `;
  const scores: { id: SkillId; score: number }[] = [];
  for (const skill of SKILLS) {
    let score = 0;
    for (const kw of skill.keywords) {
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(kw)}([^a-z0-9]|$)`);
      if (pattern.test(lower)) score += 1 + kw.length / 10;
    }
    if (score > 0) scores.push({ id: skill.id, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return dropGenericWhenSpecific(scores.map((s) => s.id));
}

// "VoiceOver on my Mac" mentions "voiceover", which also suggests iPhone.
// When Mac is named, prefer VoiceOver on Mac and drop the iPhone guess.
function dropGenericWhenSpecific(ids: SkillId[]): SkillId[] {
  if (ids.includes("voiceover-mac") && ids.includes("voiceover-ios")) {
    return ids.filter((id) => id !== "voiceover-ios");
  }
  return ids;
}
