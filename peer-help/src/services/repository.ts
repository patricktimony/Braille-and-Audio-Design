// All reading and writing of app data goes through this module, so a database
// or API can replace local storage later without changing the pages.

import { DEMO_LIBRARY, DEMO_TRAINERS } from "../demo-data";
import type { Instruction, LibraryEntry, Person, Session } from "../types";
import { newId } from "./ids";
import { BrowserStore, type KeyValueStore } from "./storage";

const KEYS = {
  me: "peerhelp.me",
  sessions: "peerhelp.sessions",
  instructions: "peerhelp.instructions",
} as const;

export class Repository {
  constructor(private store: KeyValueStore) {}

  // --- The person using this device -------------------------------------

  getMe(): Person {
    const existing = this.store.get<Person>(KEYS.me);
    if (existing) return existing;
    const me: Person = {
      id: newId("me"),
      displayName: "",
      isLearner: true,
      isTrainer: false,
      usesTechnology: "",
      isDemo: false,
    };
    this.store.set(KEYS.me, me);
    return me;
  }

  saveMe(me: Person): void {
    this.store.set(KEYS.me, me);
  }

  // --- Trainers ---------------------------------------------------------

  /** Everyone who might teach: demo trainers, plus this person if they are a trainer. */
  listPeople(): Person[] {
    const me = this.getMe();
    return me.isTrainer ? [...DEMO_TRAINERS, me] : [...DEMO_TRAINERS];
  }

  getPerson(id: string): Person | undefined {
    return this.listPeople().find((p) => p.id === id);
  }

  // --- Sessions ---------------------------------------------------------

  listSessions(): Session[] {
    return this.store.get<Session[]>(KEYS.sessions) ?? [];
  }

  getSession(id: string): Session | undefined {
    return this.listSessions().find((s) => s.id === id);
  }

  saveSession(session: Session): void {
    const others = this.listSessions().filter((s) => s.id !== session.id);
    this.store.set(KEYS.sessions, [session, ...others]);
  }

  // --- Personal instructions --------------------------------------------

  listInstructions(): Instruction[] {
    return this.store.get<Instruction[]>(KEYS.instructions) ?? [];
  }

  getInstruction(id: string): Instruction | undefined {
    return this.listInstructions().find((i) => i.id === id);
  }

  saveInstruction(instruction: Instruction): void {
    const others = this.listInstructions().filter((i) => i.id !== instruction.id);
    this.store.set(KEYS.instructions, [instruction, ...others]);
  }

  deleteInstruction(id: string): void {
    this.store.set(KEYS.instructions, this.listInstructions().filter((i) => i.id !== id));
  }

  // --- Shared library ---------------------------------------------------

  /**
   * Demo entries plus the instructions this person explicitly chose to share.
   * In the prototype "shared" entries never leave this device.
   */
  listLibrary(): LibraryEntry[] {
    const mine: LibraryEntry[] = this.listInstructions()
      .filter((i) => i.sharing === "shared")
      .map((i) => ({ id: i.id, title: i.title, steps: i.steps, skills: [], isDemo: false }));
    return [...mine, ...DEMO_LIBRARY];
  }

  // --- Privacy ----------------------------------------------------------

  deleteEverything(): void {
    for (const key of Object.values(KEYS)) this.store.remove(key);
  }
}

export const repository = new Repository(new BrowserStore());
