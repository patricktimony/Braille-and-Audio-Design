import { describe, expect, it } from "vitest";
import { detectSkills } from "../../src/skills";

describe("detectSkills", () => {
  it("understands the example requests", () => {
    expect(detectSkills("I need help scanning a document")[0]).toBe("scanning");
    expect(detectSkills("I need someone to teach me JAWS")[0]).toBe("jaws");
  });

  it("finds several skills, most specific first", () => {
    const skills = detectSkills("How do I send email in Outlook with NVDA?");
    expect(skills).toContain("nvda");
    expect(skills).toContain("email");
  });

  it("prefers VoiceOver on Mac when a Mac is named", () => {
    const skills = detectSkills("VoiceOver on my MacBook");
    expect(skills).toContain("voiceover-mac");
    expect(skills).not.toContain("voiceover-ios");
  });

  it("matches whole words only", () => {
    expect(detectSkills("my phone")).toContain("smartphone-basics");
    expect(detectSkills("I like jawsome puns")).not.toContain("jaws");
  });

  it("returns nothing for unrelated text", () => {
    expect(detectSkills("hello there")).toEqual([]);
  });
});
