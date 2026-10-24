import { describe, expect, it } from "vitest";
import { DEMO_SCRIPTS, DEMO_TRAINERS } from "../../src/demo-data";
import { SimulatedMessagingService, startSession } from "../../src/services/messaging";

describe("simulated session", () => {
  it("is labelled simulated and walks through the lesson script in order", async () => {
    const alex = DEMO_TRAINERS.find((t) => t.id === "demo-alex")!;
    const session = startSession("teach me JAWS", ["jaws"], alex, "https://meet.jit.si/test");
    expect(session.simulated).toBe(true);
    expect(session.messages.every((m) => m.simulated)).toBe(true);
    expect(session.messages[1].text).toBe(DEMO_SCRIPTS.jaws[0]);

    const messaging = new SimulatedMessagingService(0);
    const { sent, reply } = await messaging.send(session, "Okay");
    expect(sent.simulated).toBe(false);
    expect(reply?.text).toBe(DEMO_SCRIPTS.jaws[1]);
    expect(reply?.simulated).toBe(true);

    for (let i = 2; i < DEMO_SCRIPTS.jaws.length; i++) await messaging.send(session, "Next");
    const end = await messaging.send(session, "Done");
    expect(end.reply?.text).toMatch(/end of this demonstration/);
    const after = await messaging.send(session, "Anything else?");
    expect(after.reply).toBeUndefined();
  });
});
