/**
 * Competency framework: six observable skills rated 0-4.
 * Scenario scores map onto one primary skill each; the trainer dashboard
 * aggregates them into the skill matrix.
 */
import type { SkillId } from '../engine/types';

export interface SkillMeta {
  id: SkillId;
  name: string;
  short: string;
  description: string;
}

export const SKILLS: SkillMeta[] = [
  {
    id: 'startup',
    name: 'Line Startup & Shutdown',
    short: 'Startup',
    description: 'Correct station sequencing, setpoints and stabilisation on start/stop.'
  },
  {
    id: 'faults',
    name: 'Fault Diagnosis & Response',
    short: 'Diagnosis',
    description: 'Reading trends, isolating causes and correct corrective actions.'
  },
  {
    id: 'loto',
    name: 'LOTO & Energy Isolation',
    short: 'LOTO',
    description: 'Complete lockout-tagout sequences before any body-in-equipment work.'
  },
  {
    id: 'quality',
    name: 'Quality Control',
    short: 'Quality',
    description: 'Moisture, stem content and NTRM management against packed spec.'
  },
  {
    id: 'emergency',
    name: 'Emergency Response',
    short: 'Emergency',
    description: 'E-stop judgement, fire-risk response and safe recovery.'
  },
  {
    id: 'records',
    name: 'Data & Records',
    short: 'Records',
    description: 'Alarms, events and shift documentation discipline.'
  }
];

export const LEVEL_NAMES = [
  '0 - Awareness',
  '1 - Supervised practice',
  '2 - Basic operation',
  '3 - Independent operation',
  '4 - Coach / trainer'
];

export function skillName(id: SkillId): string {
  return SKILLS.find((s) => s.id === id)?.name ?? id;
}
