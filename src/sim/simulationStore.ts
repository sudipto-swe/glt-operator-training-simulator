/**
 * Simulation store: owns the engine state, the fixed-timestep clock and the
 * scenario runtime. React components only ever dispatch actions here - the
 * engine itself stays pure and DOM-free.
 */
import { create } from 'zustand';
import { DT } from '../engine/constants';
import { createInitialState, dispatch as engineDispatch, step } from '../engine/engine';
import type { SimAction, SimState, ScenarioRuntime } from '../engine/types';
import { scenarioById } from '../data/scenarios';
import { useRecords } from '../state/recordsStore';
import { checklistPct, forceEnd, startRuntime, tickScenario } from './scenarioRunner';

export type SimMode = 'free' | 'learn' | 'assess';
export type Speed = 1 | 2 | 5;

interface SimStore {
  engine: SimState;
  runtime: ScenarioRuntime | null;
  mode: SimMode;
  running: boolean;
  speed: Speed;
  showReport: boolean;
  attemptSaved: boolean;
  dispatch: (a: SimAction) => void;
  tick: () => void;
  setSpeed: (s: Speed) => void;
  setRunning: (v: boolean) => void;
  startScenario: (id: string, mode: 'learn' | 'assess') => void;
  endScenario: () => void;
  abortScenario: () => void;
  resetSim: () => void;
  closeReport: () => void;
}

function saveAttempt(runtime: ScenarioRuntime): void {
  const sc = scenarioById(runtime.scenarioId);
  if (!sc) return;
  const records = useRecords.getState();
  const traineeId = records.activeTraineeId;
  if (!traineeId) return;
  const dur = Math.round((runtime.endedAt ?? 0) - runtime.startedAt);
  records.recordAttempt({
    traineeId,
    scenarioId: sc.id,
    mode: runtime.mode,
    startedAt: new Date(runtime.wallStartedAt).toISOString(),
    durationSec: dur,
    score: runtime.result ? runtime.result.total : null,
    passed: runtime.result ? runtime.result.passed : null,
    breakdown: runtime.result
      ? {
          safety: runtime.result.safety,
          procedure: runtime.result.procedure,
          quality: runtime.result.quality,
          response: runtime.result.response
        }
      : null,
    critical: runtime.result?.critical ?? null,
    checklistPct: checklistPct(runtime, sc)
  });
}

/** Deterministic per-scenario seed so every S1 attempt starts identically. */
function seedFor(id: string): number {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) % 100000;
}

export const useSim = create<SimStore>((set, get) => ({
  engine: createInitialState(42),
  runtime: null,
  mode: 'free',
  running: false,
  speed: 1,
  showReport: false,
  attemptSaved: false,

  dispatch: (a) => set({ engine: engineDispatch(get().engine, a) }),

  tick: () => {
    const st = get();
    if (!st.running) return;
    let engine = st.engine;
    let runtime = st.runtime;

    const sc = runtime ? scenarioById(runtime.scenarioId) : null;
    if (sc && runtime && runtime.endedAt == null) {
      const out = tickScenario(sc, engine, runtime);
      engine = out.engine;
      runtime = out.runtime;
    }

    for (let i = 0; i < st.speed; i++) engine = step(engine, DT);

    let attemptSaved = st.attemptSaved;
    let showReport = st.showReport;
    let running = true;
    if (runtime && runtime.endedAt != null && !st.attemptSaved) {
      saveAttempt(runtime);
      attemptSaved = true;
      showReport = true;
      running = false;
    }
    set({ engine, runtime, attemptSaved, showReport, running });
  },

  setSpeed: (speed) => set({ speed }),
  setRunning: (running) => set({ running }),

  startScenario: (id, mode) => {
    const sc = scenarioById(id);
    if (!sc) return;
    set({
      engine: createInitialState(seedFor(id)),
      runtime: startRuntime(sc, mode, Date.now()),
      mode,
      running: true,
      speed: 1,
      showReport: false,
      attemptSaved: false
    });
  },

  endScenario: () => {
    const st = get();
    const sc = st.runtime ? scenarioById(st.runtime.scenarioId) : null;
    if (!sc || !st.runtime || st.runtime.endedAt != null) return;
    const runtime = forceEnd(sc, st.engine, st.runtime, 'completed');
    saveAttempt(runtime);
    set({ runtime, running: false, attemptSaved: true, showReport: true });
  },

  abortScenario: () => {
    const st = get();
    const sc = st.runtime ? scenarioById(st.runtime.scenarioId) : null;
    if (!sc || !st.runtime || st.runtime.endedAt != null) {
      set({ running: false });
      return;
    }
    const runtime = forceEnd(sc, st.engine, st.runtime, 'aborted');
    saveAttempt(runtime);
    set({ runtime, running: false, attemptSaved: true, showReport: false });
  },

  resetSim: () =>
    set({
      engine: createInitialState(42),
      runtime: null,
      mode: 'free',
      running: false,
      speed: 1,
      showReport: false,
      attemptSaved: false
    }),

  closeReport: () => set({ showReport: false })
}));
