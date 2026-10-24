import { describe, expect, it } from "vitest";
import { DEMO_TRAINERS } from "../../src/demo-data";
import { matchTrainers } from "../../src/matching";
import type { Person } from "../../src/types";

describe("matchTrainers", () => {
  it("only returns trainers who teach a requested skill", () => {
    const matches = matchTrainers(DEMO_TRAINERS, ["jaws"]);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) expect(m.trainer.trainer!.skills).toContain("jaws");
  });

  it("ranks trainers who cover more requested skills first", () => {
    const matches = matchTrainers(DEMO_TRAINERS, ["jaws", "email"]);
    expect(matches[0].trainer.id).toBe("demo-alex");
    expect(matches[0].matchedSkills).toEqual(["jaws", "email"]);
  });

  it("can show volunteers only", () => {
    const matches = matchTrainers(DEMO_TRAINERS, ["magnification", "braille"], { volunteerOnly: true });
    expect(matches).toEqual([]);
  });

  it("never matches a person with themself", () => {
    const me: Person = {
      id: "me-1", displayName: "Me", isLearner: true, isTrainer: true, usesTechnology: "", isDemo: false,
      trainer: { skills: ["jaws"], availability: "", pricing: "volunteer", rateNote: "", bio: "" },
    };
    const matches = matchTrainers([...DEMO_TRAINERS, me], ["jaws"], { excludePersonId: "me-1" });
    expect(matches.some((m) => m.trainer.id === "me-1")).toBe(false);
  });

  it("ignores people who are not trainers", () => {
    const learner: Person = { id: "l", displayName: "L", isLearner: true, isTrainer: false, usesTechnology: "", isDemo: false };
    expect(matchTrainers([learner], ["jaws"])).toEqual([]);
  });
});
