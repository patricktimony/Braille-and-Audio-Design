// Demonstration data. None of these people are real and none of their messages
// are typed by a person. Everything here is labelled "demo" in the interface.

import type { LibraryEntry, Person, SkillId } from "./types";

function demoTrainer(
  id: string,
  name: string,
  skills: SkillId[],
  availability: string,
  pricing: "volunteer" | "paid",
  bio: string,
  rateNote = "",
): Person {
  return {
    id,
    displayName: `${name} (demo)`,
    isLearner: false,
    isTrainer: true,
    usesTechnology: "",
    isDemo: true,
    trainer: { skills, availability, pricing, rateNote, bio },
  };
}

export const DEMO_TRAINERS: Person[] = [
  demoTrainer("demo-alex", "Alex", ["jaws", "web", "email", "word-processing"], "Weekday evenings", "volunteer",
    "Long-time JAWS user who enjoys teaching web browsing and Outlook."),
  demoTrainer("demo-priya", "Priya", ["nvda", "narrator", "computer-basics", "spreadsheets"], "Weekend mornings", "volunteer",
    "NVDA user and former IT help desk worker."),
  demoTrainer("demo-sam", "Sam", ["voiceover-ios", "scanning", "visual-help-apps", "smartphone-basics"], "Most afternoons", "volunteer",
    "Totally blind iPhone user. Uses Seeing AI every day to read mail."),
  demoTrainer("demo-jordan", "Jordan", ["magnification", "computer-basics", "voiceover-mac"], "Tuesdays and Thursdays", "paid",
    "Certified assistive technology instructor specialising in low vision.", "Demonstration rate: 30 per hour"),
  demoTrainer("demo-maria", "Maria", ["braille", "voiceover-ios", "jaws"], "Monday to Friday, daytime", "paid",
    "Braille teacher. Helps people connect and use braille displays.", "Demonstration rate: 25 per hour"),
  demoTrainer("demo-kwame", "Kwame", ["talkback", "smartphone-basics", "scanning"], "Evenings and weekends", "volunteer",
    "Android and TalkBack enthusiast."),
];

/** Scripted trainer messages used by the simulated session, keyed by skill. */
export const DEMO_SCRIPTS: Record<string, string[]> = {
  jaws: [
    "Let's learn to find your way around a web page with JAWS. First, open your web browser and go to any web page.",
    "Press H to move to the next heading. Press Shift+H to move back to the previous heading.",
    "Press Insert+F6 to open a list of all headings. Use the Up and Down Arrow keys, then press Enter to jump to one.",
    "Press Insert+F7 to list all the links on the page. Type the first letter of a link to jump to it.",
    "Press Insert+Down Arrow to read from where you are. Press Control to stop speech.",
  ],
  nvda: [
    "Let's learn to move around a web page with NVDA. First, open your web browser and go to any web page.",
    "Press H to move to the next heading. Press Shift+H to go back.",
    "Press NVDA+F7 to open the Elements List. Use the arrow keys to choose a heading or link, then press Enter.",
    "Press NVDA+Down Arrow to read everything from where you are. Press Control to stop speech.",
  ],
  narrator: [
    "Let's get started with Windows Narrator. Press Windows+Control+Enter to turn Narrator on or off.",
    "Press Caps Lock+Spacebar to turn scan mode on, so you can read web pages with single keys.",
    "In scan mode, press H to move to the next heading.",
    "Press Caps Lock+R to read from the current position. Press Control to stop reading.",
    "Press Caps Lock+F1 to open the list of all Narrator commands.",
  ],
  "voiceover-ios": [
    "Let's practise the main VoiceOver gestures on iPhone. Swipe right with one finger to move to the next item. Swipe left to go back.",
    "Double-tap anywhere on the screen to activate the item VoiceOver just read.",
    "Turn two fingers on the screen like a dial to open the rotor. Stop when you hear Headings.",
    "Swipe down with one finger to jump to the next heading.",
    "Swipe down with two fingers to read everything from the current item. Tap with two fingers to pause speech.",
  ],
  scanning: [
    "Let's read a printed letter with the Seeing AI app on iPhone. Open the Seeing AI app.",
    "Choose the Document channel from the channel selector at the bottom of the screen.",
    "Place the page on a flat surface with good light.",
    "Hold the phone flat, about one foot above the middle of the page. Listen to the guidance, such as top edge not visible, and move the phone until it takes the picture.",
    "When the text appears, swipe right to read it, or use the Share button to save it.",
  ],
  magnification: [
    "Let's use Windows Magnifier. Press Windows+Plus to turn on Magnifier and zoom in.",
    "Press Windows+Minus to zoom out.",
    "Press Control+Alt+M to switch between full screen, docked, and lens views.",
    "Press Windows+Escape to turn Magnifier off.",
  ],
  email: [
    "Let's send an email in Outlook on Windows. Press Control+N to start a new message.",
    "Type the email address in the To field.",
    "Press Tab until you hear Subject, then type a subject.",
    "Press Tab to move to the message body and type your message.",
    "Press Alt+S to send the message.",
  ],
  braille: [
    "Let's connect a braille display to an iPhone. Turn on the braille display and put it in Bluetooth pairing mode.",
    "On the iPhone, open Settings, then Accessibility, then VoiceOver, then Braille.",
    "Select your display from the list to pair it.",
    "Use the panning keys on the display to move through text.",
  ],
  general: [
    "Let's take it one step at a time. Tell me which device and screen reader you use.",
    "Open the app you want to learn, and listen to the first thing your screen reader says.",
    "Use your screen reader's heading navigation to get an overview of the screen.",
    "Practise each step slowly, then repeat it twice so it sticks.",
  ],
};

export function demoScriptFor(skills: SkillId[], trainer: Person): string[] {
  const taught = skills.filter((s) => trainer.trainer?.skills.includes(s));
  for (const s of taught) if (DEMO_SCRIPTS[s]) return DEMO_SCRIPTS[s];
  for (const s of skills) if (DEMO_SCRIPTS[s]) return DEMO_SCRIPTS[s];
  return DEMO_SCRIPTS.general;
}

export const DEMO_LIBRARY: LibraryEntry[] = [
  {
    id: "demo-lib-nvda-headings",
    title: "How to: jump between headings on a web page with NVDA",
    skills: ["nvda", "web"],
    steps: [
      "Open your web browser and go to a web page.",
      "Press H to move to the next heading.",
      "Press Shift+H to move to the previous heading.",
      "Press NVDA+F7 to open the Elements List, choose a heading, and press Enter.",
    ],
    isDemo: true,
  },
  {
    id: "demo-lib-seeing-ai",
    title: "How to: read a printed letter with Seeing AI",
    skills: ["scanning", "voiceover-ios"],
    steps: [
      "Open the Seeing AI app.",
      "Choose the Document channel.",
      "Put the page on a flat surface with good light.",
      "Hold the phone flat about one foot above the page and follow the spoken guidance.",
      "Swipe right to read the text.",
    ],
    isDemo: true,
  },
  {
    id: "demo-lib-magnifier",
    title: "How to: zoom in and out with Windows Magnifier",
    skills: ["magnification"],
    steps: [
      "Press Windows+Plus to turn on Magnifier and zoom in.",
      "Press Windows+Minus to zoom out.",
      "Press Windows+Escape to turn Magnifier off.",
    ],
    isDemo: true,
  },
];

export interface DemoRequest {
  id: string;
  learnerName: string;
  text: string;
}

/** Example requests shown to trainers so they can see what matching looks like. */
export const DEMO_REQUESTS: DemoRequest[] = [
  { id: "demo-req-1", learnerName: "Chris (demo)", text: "I need someone to teach me JAWS for reading web pages." },
  { id: "demo-req-2", learnerName: "Lee (demo)", text: "I need help scanning a document with my iPhone." },
  { id: "demo-req-3", learnerName: "Pat (demo)", text: "How do I make the text bigger on my Windows laptop?" },
  { id: "demo-req-4", learnerName: "Robin (demo)", text: "I want to learn to send email in Outlook with NVDA." },
  { id: "demo-req-5", learnerName: "Dana (demo)", text: "Can someone help me pair my braille display with my iPhone?" },
];
