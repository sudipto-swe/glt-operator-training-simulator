/**
 * Deterministic 12-trainee demo cohort with ~90 days of attempt history.
 * Seeded with mulberry32 so every fresh browser gets the same believable
 * dashboard (and tests can assert on it). The `now` parameter is injected
 * so tests stay deterministic across days.
 */
import { mulberry32 } from '../engine/rng';
import { SCENARIOS } from './scenarios';
import { QUIZZES } from './trainingPack';
import {
  emptySkills,
  recomputeSkills,
  type Attempt,
  type RecordsData,
  type Trainee
} from '../state/recordsSchema';

const NAMES = [
  'A. Rahman',
  'M. Chen',
  'S. Okafor',
  'J. Pereira',
  'L. Nguyen',
  'K. Tanaka',
  'R. Singh',
  'E. Costa',
  'T. Mwangi',
  'D. Ivanov',
  'F. Haddad',
  'N. Kim'
];

const ROLES = ['Operator', 'Operator', 'Senior Operator', 'Operator', 'Operator', 'Team Lead'];

/** Per-trainee ability bias: some strong, some developing - a realistic mix. */
const ABILITY = [0.82, 0.55, 0.9, 0.68, 0.42, 0.75, 0.6, 0.88, 0.35, 0.7, 0.5, 0.78];

function isoDaysAgo(now: number, days: number, hour = 7): string {
  const d = new Date(now - days * 86400000);
  d.setHours(hour, 10 + (days % 40), (days * 7) % 60, 0);
  return d.toISOString();
}

export function buildDemoData(now: number = Date.now()): RecordsData {
  const rng = mulberry32(20260101);
  const trainees: Trainee[] = [];
  const attempts: Attempt[] = [];

  NAMES.forEach((name, i) => {
    const id = `t-${i + 1}`;
    const ability = ABILITY[i];
    const joinedDays = 200 + Math.floor(rng() * 400);
    const trainee: Trainee = {
      id,
      name,
      role: ROLES[i % ROLES.length],
      shift: ['A', 'B', 'C'][i % 3],
      site: 'GLT Plant 2',
      joinedAt: isoDaysAgo(now, joinedDays),
      passedQuizzes: [],
      skills: emptySkills()
    };

    // Quiz passes: most trainees have the required modules, a few are behind.
    for (const q of QUIZZES) {
      if (rng() < 0.55 + ability * 0.4) {
        trainee.passedQuizzes.push(q.id);
        attempts.push({
          id: `aq-${id}-${q.id}`,
          traineeId: id,
          scenarioId: q.id,
          mode: 'quiz',
          startedAt: isoDaysAgo(now, 80 - Math.floor(rng() * 20)),
          durationSec: 180 + Math.floor(rng() * 240),
          score: Math.round(80 + rng() * 20),
          passed: true,
          breakdown: null,
          critical: null,
          checklistPct: 100
        });
      }
    }

    // Scenario attempts over the past 90 days.
    const nAttempts = 5 + Math.floor(rng() * 12);
    for (let k = 0; k < nAttempts; k++) {
      const sc = SCENARIOS[Math.floor(rng() * SCENARIOS.length)];
      const daysAgo = Math.floor(rng() * 90);
      const isAssess = rng() < 0.65;
      // Learn attempts: un-scored practice.
      if (!isAssess) {
        attempts.push({
          id: `aa-${id}-${k}`,
          traineeId: id,
          scenarioId: sc.id,
          mode: 'learn',
          startedAt: isoDaysAgo(now, daysAgo),
          durationSec: 300 + Math.floor(rng() * 400),
          score: null,
          passed: null,
          breakdown: null,
          critical: null,
          checklistPct: 60 + Math.floor(rng() * 40)
        });
        continue;
      }
      // Assess attempt: score around ability, harder scenarios cost points.
      const difficultyCost = sc.difficulty === 'advanced' ? 12 : sc.difficulty === 'intermediate' ? 6 : 0;
      let score = Math.round(35 + ability * 60 - difficultyCost * (1 - ability) + (rng() - 0.5) * 16);
      score = Math.max(18, Math.min(98, score));
      const critical =
        rng() < 0.08 + (1 - ability) * 0.12
          ? 'LOTO attempted without verified energy isolation.'
          : null;
      if (critical) score = Math.min(score, 45);
      const passed = !critical && score >= sc.passMark;
      attempts.push({
        id: `aa-${id}-${k}`,
        traineeId: id,
        scenarioId: sc.id,
        mode: 'assess',
        startedAt: isoDaysAgo(now, daysAgo),
        durationSec: 300 + Math.floor(rng() * 400),
        score,
        passed,
        breakdown: {
          safety: Math.min(40, Math.round(score * 0.4 + (critical ? -20 : 4))),
          procedure: Math.round(score * 0.3),
          quality: Math.round(score * 0.2),
          response: Math.round(score * 0.1)
        },
        critical,
        checklistPct: Math.min(100, score + Math.floor(rng() * 10))
      });
    }

    trainees.push(trainee);
  });

  // Recompute skills from the generated history.
  const finalTrainees = trainees.map((t) => recomputeSkills(t, attempts));

  // Give three senior trainees certifications that are about to expire,
  // so the trainer dashboard has recertification calls to action.
  for (const idx of [2, 7, 5]) {
    const t = finalTrainees[idx];
    for (const key of Object.keys(t.skills) as (keyof typeof t.skills)[]) {
      if (t.skills[key].level >= 2) {
        t.skills[key] = { ...t.skills[key], lastCert: isoDaysAgo(now, 360 + idx) };
      }
    }
  }

  attempts.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return { version: 1, trainees: finalTrainees, attempts };
}
