import { describe, expect, it } from "vitest";
import { DEMO_SCRIPTS } from "../../src/demo-data";
import { extractSteps, RuleBasedInstructionGenerator } from "../../src/services/instruction-generator";
import { parseSteps } from "../../src/editor";

describe("extractSteps", () => {
  it("keeps instructions and drops chatter and questions", () => {
    const steps = extractSteps(
      [
        "Trainer: Hi, nice to meet you.",
        "Learner: Hi! Can you help me with NVDA?",
        "Trainer: Sure. First, open your web browser. Then press H to move to the next heading.",
        "Learner: Okay, done.",
        "Trainer: Great. NVDA+F7 opens the Elements List.",
        "Trainer: Does that make sense?",
      ].join("\n"),
    );
    expect(steps).toEqual([
      "Open your web browser.",
      "Press H to move to the next heading.",
      "NVDA+F7 opens the Elements List.",
    ]);
  });

  it("keeps numbered and bulleted lines as steps", () => {
    expect(extractSteps("1. The settings app is grey\n- Battery is near the bottom")).toEqual([
      "The settings app is grey.",
      "Battery is near the bottom.",
    ]);
  });

  it("looks past a leading clause", () => {
    expect(extractSteps("When the text appears, swipe right to read it.")).toEqual([
      "When the text appears, swipe right to read it.",
    ]);
  });

  it("removes duplicates", () => {
    expect(extractSteps("Press Tab.\nPress tab.")).toEqual(["Press Tab."]);
  });

  it("turns every demonstration lesson into at least three steps", () => {
    for (const [skill, script] of Object.entries(DEMO_SCRIPTS)) {
      expect(extractSteps(script.join("\n")).length, skill).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("RuleBasedInstructionGenerator", () => {
  it("makes a title from the request and says how the steps were made", async () => {
    const result = await new RuleBasedInstructionGenerator().generate("Press H.", "I need help scanning a document");
    expect(result.title).toBe("How to: Scanning a document");
    expect(result.method).toMatch(/not by AI/);
  });
});

describe("parseSteps", () => {
  it("splits lines and strips existing numbering", () => {
    expect(parseSteps("1. Open it\n\n2) Press H\n- Done")).toEqual(["Open it", "Press H", "Done"]);
  });
});
