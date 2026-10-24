import type { Person, SkillId } from "./types";

export interface MatchOptions {
  volunteerOnly?: boolean;
  /** Never match a person with themself. */
  excludePersonId?: string;
}

export interface TrainerMatch {
  trainer: Person;
  matchedSkills: SkillId[];
  score: number;
}

/**
 * Basic matching: rank trainers by how many of the requested skills they teach,
 * giving more weight to the skills detected first (the most specific ones).
 * Only trainers who teach at least one requested skill are returned.
 */
export function matchTrainers(
  people: Person[],
  requestedSkills: SkillId[],
  options: MatchOptions = {},
): TrainerMatch[] {
  const matches: TrainerMatch[] = [];
  for (const person of people) {
    if (!person.isTrainer || !person.trainer) continue;
    if (person.id === options.excludePersonId) continue;
    if (options.volunteerOnly && person.trainer.pricing !== "volunteer") continue;

    const matchedSkills = requestedSkills.filter((s) => person.trainer!.skills.includes(s));
    if (matchedSkills.length === 0) continue;

    const score = matchedSkills.reduce(
      (sum, s) => sum + (requestedSkills.length - requestedSkills.indexOf(s)),
      0,
    );
    matches.push({ trainer: person, matchedSkills, score });
  }
  return matches.sort(
    (a, b) => b.score - a.score || a.trainer.displayName.localeCompare(b.trainer.displayName),
  );
}
