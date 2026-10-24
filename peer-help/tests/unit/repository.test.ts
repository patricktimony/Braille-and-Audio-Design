import { describe, expect, it } from "vitest";
import { Repository } from "../../src/services/repository";
import { MemoryStore } from "../../src/services/storage";
import type { Instruction } from "../../src/types";

function instruction(id: string, sharing: Instruction["sharing"]): Instruction {
  return { id, title: id, steps: ["Step"], createdAt: new Date().toISOString(), source: "typed", sharing };
}

describe("Repository", () => {
  it("creates a learner profile on first use and keeps it", () => {
    const repo = new Repository(new MemoryStore());
    const me = repo.getMe();
    expect(me.isLearner).toBe(true);
    expect(me.isDemo).toBe(false);
    expect(repo.getMe().id).toBe(me.id);
  });

  it("only puts explicitly shared instructions in the library", () => {
    const repo = new Repository(new MemoryStore());
    repo.saveInstruction(instruction("private-one", "private"));
    repo.saveInstruction(instruction("shared-one", "shared"));
    const mine = repo.listLibrary().filter((e) => !e.isDemo);
    expect(mine.map((e) => e.id)).toEqual(["shared-one"]);
  });

  it("includes this person in trainers only when they are a trainer", () => {
    const repo = new Repository(new MemoryStore());
    const me = repo.getMe();
    expect(repo.listPeople().some((p) => p.id === me.id)).toBe(false);
    repo.saveMe({ ...me, isTrainer: true });
    expect(repo.listPeople().some((p) => p.id === me.id)).toBe(true);
  });

  it("deletes everything", () => {
    const repo = new Repository(new MemoryStore());
    const firstId = repo.getMe().id;
    repo.saveInstruction(instruction("a", "private"));
    repo.deleteEverything();
    expect(repo.listInstructions()).toEqual([]);
    expect(repo.getMe().id).not.toBe(firstId);
  });
});
