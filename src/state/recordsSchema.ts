/**
 * Records schema (versioned, zod-validated) plus skill bookkeeping shared
 * by the live records store and the demo-cohort generator.
 *
 * Storage layout (localStorage):
 *   glt.records.v1  -> { version, trainees[], attempts[] }
 *   glt.active      -> active trainee id
 */
import { z } from 'zod';
import { scenarioById } from '../data/scenarios';
import { levelFromScore } from '../engine/scoring';
import type { SkillId } from '../engine/types';

export const RECORDS_VERSION = 1;

export const attemptSchema = z.object({
  id: z.string().min(1),
  traineeId: z.string().min(1),
  scenarioId: z.string().min(1), // 'S1'..'S6' or a quiz id
  mode: z.enum(['learn', 'assess', 'quiz']),
  startedAt: z.string().min(1), // ISO timestamp
  durationSec: z.number().min(0),
  score: z.number().min(0).max(100).nullable(),
  passed: z.boolean().nullable(),
  breakdown: z
    .object({
      safety: z.number(),
      procedure: z.number(),
      quality: z.number(),
      response: z.number()
    })
    .nullable(),
  critical: z.string().nullable(),
  checklistPct: z.number().min(0).max(100)
});

export const traineeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string(),
  shift: z.string(),
  site: z.string(),
  joinedAt: z.string(),
  passedQuizzes: z.array(z.string()),
  skills: z.record(
    z.string(),
    z.object({ level: z.number().min(0).max(4), lastCert: z.string().nullable() })
  )
});

export const recordsDataSchema = z.object({
  version: z.literal(RECORDS_VERSION),
  trainees: z.array(traineeSchema),
  attempts: z.array(attemptSchema)
});

export type Attempt = z.infer<typeof attemptSchema>;
export type Trainee = z.infer<typeof traineeSchema>;
export type RecordsData = z.infer<typeof recordsDataSchema>;

export function emptySkills(): Trainee['skills'] {
  return {
    startup: { level: 0, lastCert: null },
    faults: { level: 0, lastCert: null },
    loto: { level: 0, lastCert: null },
    quality: { level: 0, lastCert: null },
    emergency: { level: 0, lastCert: null },
    records: { level: 0, lastCert: null }
  };
}

/**
 * Apply one attempt to a trainee's skill record:
 * an assess pass can only ever RAISE a skill level (highest-valid evidence).
 */
export function applyAttemptToSkills(
  skills: Trainee['skills'],
  attempt: Attempt
): Trainee['skills'] {
  if (attempt.mode !== 'assess' || attempt.score == null) return skills;
  const sc = scenarioById(attempt.scenarioId);
  if (!sc) return skills;
  const level = levelFromScore(attempt.score);
  const current = skills[sc.skill] ?? { level: 0, lastCert: null };
  if (level > current.level) {
    return { ...skills, [sc.skill]: { level, lastCert: attempt.startedAt } };
  }
  return skills;
}

export function recomputeSkills(trainee: Trainee, attempts: Attempt[]): Trainee {
  let skills = emptySkills();
  for (const a of attempts) {
    if (a.traineeId === trainee.id) skills = applyAttemptToSkills(skills, a);
  }
  return { ...trainee, skills };
}

/** Best 3 assess scores for a skill domain, newest first. */
export function topScoresForSkill(
  attempts: Attempt[],
  traineeId: string,
  skill: SkillId,
  n = 3
): number[] {
  return attempts
    .filter(
      (a) =>
        a.traineeId === traineeId &&
        a.mode === 'assess' &&
        a.score != null &&
        scenarioById(a.scenarioId)?.skill === skill
    )
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, n)
    .map((a) => a.score as number);
}

/**
 * Migrate + validate a raw persisted value. Returns null when the payload
 * is unrecoverable (caller seeds demo data and backs up the bad payload).
 */
export function migrateAndValidate(raw: unknown): RecordsData | null {
  if (raw == null || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  // v0 legacy shape: { trainees: [...] } without version/attempts.
  if (!('version' in obj) && Array.isArray(obj.trainees)) {
    obj.version = RECORDS_VERSION;
    obj.attempts = [];
  }
  const parsed = recordsDataSchema.safeParse(obj);
  return parsed.success ? parsed.data : null;
}
