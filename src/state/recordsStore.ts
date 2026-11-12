/**
 * Records store: trainee profiles, attempts, quiz passes and skill levels.
 * Persisted to localStorage (versioned + zod-validated); seeded with the
 * deterministic demo cohort on first run. Testable via an injected backend.
 */
import { create } from 'zustand';
import { buildDemoData } from '../data/demoCohort';
import { scenarioById } from '../data/scenarios';
import {
  migrateAndValidate,
  recomputeSkills,
  type Attempt,
  type RecordsData,
  type Trainee
} from './recordsSchema';
import { getBackend, loadJson, saveJson, type StorageBackend } from '../lib/storage';

const KEY = 'glt.records.v1';
const KEY_ACTIVE = 'glt.active';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

function seed(backend: StorageBackend | null, now: number): RecordsData {
  // Back up any unrecoverable payload before reseeding.
  if (backend) {
    const raw = backend.getItem(KEY);
    if (raw) {
      try {
        backend.setItem(`${KEY}.corrupt-backup`, raw);
      } catch {
        /* best effort */
      }
    }
  }
  return buildDemoData(now);
}

function initialData(backend: StorageBackend | null): RecordsData {
  const raw = loadJson(backend, KEY);
  const migrated = migrateAndValidate(raw);
  return migrated ?? seed(backend, Date.now());
}

interface RecordsStore {
  data: RecordsData;
  activeTraineeId: string;
  setActive: (id: string) => void;
  addTrainee: (name: string, role: string, shift: string) => Trainee | null;
  recordAttempt: (attempt: Omit<Attempt, 'id'>) => void;
  recordQuiz: (traineeId: string, quizId: string, scorePct: number, passed: boolean) => void;
  renameTrainee: (id: string, name: string) => void;
  resetDemo: () => void;
  clearAll: () => void;
  importJson: (json: string) => { ok: boolean; error: string | null };
  exportJson: () => string;
}

const backend = getBackend();

function persist(data: RecordsData, activeId: string): void {
  saveJson(backend, KEY, data);
  saveJson(backend, KEY_ACTIVE, activeId);
}

export const useRecords = create<RecordsStore>((set, get) => {
  const data = initialData(backend);
  const storedActive =
    (backend && typeof backend.getItem === 'function' ? backend.getItem(KEY_ACTIVE) : null) ?? '';
  const activeTraineeId =
    data.trainees.some((t) => t.id === storedActive) ? storedActive : (data.trainees[0]?.id ?? '');

  return {
    data,
    activeTraineeId,

    setActive: (id) => {
      set({ activeTraineeId: id });
      persist(get().data, id);
    },

    addTrainee: (name, role, shift) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const t: Trainee = {
        id: makeId('t'),
        name: trimmed,
        role: role || 'Operator',
        shift: shift || 'A',
        site: 'GLT Plant 2',
        joinedAt: new Date().toISOString(),
        passedQuizzes: [],
        skills: {
          startup: { level: 0, lastCert: null },
          faults: { level: 0, lastCert: null },
          loto: { level: 0, lastCert: null },
          quality: { level: 0, lastCert: null },
          emergency: { level: 0, lastCert: null },
          records: { level: 0, lastCert: null }
        }
      };
      const data = { ...get().data, trainees: [...get().data.trainees, t] };
      set({ data, activeTraineeId: t.id });
      persist(data, t.id);
      return t;
    },

    renameTrainee: (id, name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const data = {
        ...get().data,
        trainees: get().data.trainees.map((t) => (t.id === id ? { ...t, name: trimmed } : t))
      };
      set({ data });
      persist(data, get().activeTraineeId);
    },

    recordAttempt: (attempt) => {
      const full: Attempt = { ...attempt, id: makeId('a') };
      const { data } = get();
      const trainees = data.trainees.map((t) =>
        t.id === full.traineeId
          ? recomputeSkills(t, [...data.attempts, full])
          : t
      );
      const next: RecordsData = {
        ...data,
        trainees,
        attempts: [full, ...data.attempts].slice(0, 2000)
      };
      set({ data: next });
      persist(next, get().activeTraineeId);
    },

    recordQuiz: (traineeId, quizId, scorePct, passed) => {
      const { data } = get();
      const trainees = data.trainees.map((t) =>
        t.id === traineeId && passed && !t.passedQuizzes.includes(quizId)
          ? { ...t, passedQuizzes: [...t.passedQuizzes, quizId] }
          : t
      );
      const attempt: Attempt = {
        id: makeId('aq'),
        traineeId,
        scenarioId: quizId,
        mode: 'quiz',
        startedAt: new Date().toISOString(),
        durationSec: 0,
        score: scorePct,
        passed,
        breakdown: null,
        critical: null,
        checklistPct: 100
      };
      const next: RecordsData = {
        ...data,
        trainees,
        attempts: [attempt, ...data.attempts].slice(0, 2000)
      };
      set({ data: next });
      persist(next, get().activeTraineeId);
    },

    resetDemo: () => {
      const data = seed(backend, Date.now());
      set({ data, activeTraineeId: data.trainees[0]?.id ?? '' });
      persist(data, get().activeTraineeId);
    },

    clearAll: () => {
      const data: RecordsData = { version: 1, trainees: [], attempts: [] };
      set({ data, activeTraineeId: '' });
      persist(data, '');
    },

    importJson: (json) => {
      try {
        const parsed = migrateAndValidate(JSON.parse(json));
        if (!parsed) return { ok: false, error: 'File does not match a known records format.' };
        set({ data: parsed, activeTraineeId: parsed.trainees[0]?.id ?? '' });
        persist(parsed, parsed.trainees[0]?.id ?? '');
        return { ok: true, error: null };
      } catch {
        return { ok: false, error: 'Invalid JSON file.' };
      }
    },

    exportJson: () => JSON.stringify(get().data, null, 2)
  };
});

/* ---------------- selectors (pure helpers) ---------------- */

export function activeTrainee(data: RecordsData, id: string): Trainee | null {
  return data.trainees.find((t) => t.id === id) ?? null;
}

export function attemptsFor(data: RecordsData, traineeId: string): Attempt[] {
  return data.attempts.filter((a) => a.traineeId === traineeId);
}

/** Assess unlock: the scenario's required quiz must be passed. */
export function assessUnlocked(trainee: Trainee | null, scenarioId: string): boolean {
  const sc = scenarioById(scenarioId);
  if (!sc) return false;
  if (!trainee) return false;
  return trainee.passedQuizzes.includes(sc.requiredQuiz);
}
