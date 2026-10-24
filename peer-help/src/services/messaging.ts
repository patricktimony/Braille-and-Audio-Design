// Messaging boundary.
//
// The prototype only talks to demo trainers, whose replies are scripted and
// clearly marked "simulated". A real implementation would send messages to a
// server and deliver the other person's replies.

import { demoScriptFor } from "../demo-data";
import type { Message, Person, Session, SkillId } from "../types";
import { newId, nowIso } from "./ids";
import { repository } from "./repository";

export interface MessagingService {
  /** Saves the person's message and returns the reply, if any. */
  send(session: Session, text: string): Promise<{ sent: Message; reply?: Message }>;
}

const END_OF_SCRIPT =
  "That is the end of this demonstration lesson. When you are ready, use Create instructions below to turn this conversation into steps you can keep.";

export function simulatedMessage(text: string): Message {
  return { id: newId("msg"), from: "other", text, sentAt: nowIso(), simulated: true };
}

export class SimulatedMessagingService implements MessagingService {
  constructor(private replyDelayMs = 1200) {}

  async send(session: Session, text: string) {
    const sent: Message = { id: newId("msg"), from: "me", text, sentAt: nowIso(), simulated: false };
    session.messages.push(sent);
    repository.saveSession(session);

    const trainer = repository.getPerson(session.trainerId);
    if (!session.simulated || !trainer) return { sent };

    await new Promise((r) => setTimeout(r, this.replyDelayMs));
    const script = demoScriptFor(session.skills, trainer);
    // The first trainer message is a greeting added when the session starts.
    const scriptedSoFar = session.messages.filter((m) => m.from === "other").length - 1;
    const alreadyEnded = session.messages.some((m) => m.text === END_OF_SCRIPT);
    if (alreadyEnded) return { sent };

    const reply = simulatedMessage(script[scriptedSoFar] ?? END_OF_SCRIPT);
    session.messages.push(reply);
    repository.saveSession(session);
    return { sent, reply };
  }
}

export const messaging: MessagingService = new SimulatedMessagingService();

/** Starts a session with a trainer. With a demo trainer the conversation is simulated. */
export function startSession(requestText: string, skills: SkillId[], trainer: Person, callUrl: string): Session {
  const session: Session = {
    id: newId("session"),
    requestText,
    skills,
    trainerId: trainer.id,
    createdAt: nowIso(),
    messages: [],
    callUrl,
    simulated: trainer.isDemo,
  };
  if (trainer.isDemo) {
    const firstName = trainer.displayName.replace(/ \(demo\)$/, "");
    session.messages.push(
      simulatedMessage(
        `Hi, I am ${firstName}, a demonstration trainer. My messages are scripted by the prototype, not typed by a real person. Reply to me to move through the lesson.`,
      ),
      simulatedMessage(demoScriptFor(skills, trainer)[0]),
    );
  }
  repository.saveSession(session);
  return session;
}
