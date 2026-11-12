/**
 * Scenario runner: wraps the pure engine with scenario lifecycle -
 * timed fault injection, checklist evaluation (with hold timers and
 * response-time capture) and end conditions. Still pure: everything is
 * derived from the engine state, never from the wall clock.
 */
import { DT } from '../engine/constants';
import { alarmRaiseEvent, computeScore } from '../engine/scoring';
import { dispatch } from '../engine/engine';
import type { Scenario, ScenarioRuntime, SimState, StepCtx } from '../engine/types';

export function startRuntime(
  sc: Scenario,
  mode: 'learn' | 'assess',
  wallStartedAt: number
): ScenarioRuntime {
  return {
    scenarioId: sc.id,
    mode,
    startedAt: 0,
    wallStartedAt,
    injected: [],
    steps: sc.steps.map((st) => ({
      id: st.id,
      done: false,
      doneAt: null,
      hold: 0,
      responseSec: null
    })),
    endedAt: null,
    result: null,
    endReason: null
  };
}

export interface ScenarioTick {
  engine: SimState;
  runtime: ScenarioRuntime;
}

/**
 * Advance one engine tick under a scenario: inject due faults, evaluate
 * the checklist, decide end conditions. Call BEFORE stepping the engine
 * physics so injected faults take effect on the same tick.
 */
export function tickScenario(
  sc: Scenario,
  s: SimState,
  rtIn: ScenarioRuntime
): ScenarioTick {
  const rt: ScenarioRuntime = structuredClone(rtIn);
  let engine = s;

  const t = engine.time - rt.startedAt;

  // 1. Timed fault injection.
  for (const f of sc.schedule) {
    const key = `${f.at}:${f.fault}`;
    if (t >= f.at && !rt.injected.includes(key)) {
      rt.injected.push(key);
      engine = dispatch(engine, { type: 'INJECT_FAULT', fault: f.fault });
    }
  }

  // 2. Checklist evaluation (predicates see the pre-step state).
  const doneAt: Record<string, number> = {};
  for (const st of rt.steps) {
    if (st.done && st.doneAt != null) doneAt[st.id] = st.doneAt;
  }
  const ctx: StepCtx = { s: engine, events: engine.events, doneAt };

  sc.steps.forEach((def, i) => {
    const st = rt.steps[i];
    if (st.done) return;
    if (def.holdSec != null && def.holdSec > 0) {
      if (def.done(ctx)) {
        st.hold += DT;
        if (st.hold >= def.holdSec) {
          st.done = true;
          st.doneAt = engine.time;
        }
      } else {
        st.hold = 0;
      }
    } else if (def.done(ctx)) {
      st.done = true;
      st.doneAt = engine.time;
    }
    if (st.done && def.alarmCode && def.responseTarget != null) {
      const raise = alarmRaiseEvent(engine, def.alarmCode, rt.startedAt);
      st.responseSec = raise && st.doneAt != null && raise.t <= st.doneAt ? st.doneAt - raise.t : null;
    }
  });

  // 3. End conditions.
  if (rt.endedAt == null) {
    const allDone = rt.steps.every((x) => x.done);
    const timeout = t >= sc.durationSec;
    if (allDone || timeout) {
      rt.endedAt = engine.time;
      rt.endReason = allDone ? 'completed' : 'timeout';
      rt.result = rt.mode === 'assess' ? computeScore(sc, engine, rt) : null;
    }
  }

  return { engine, runtime: rt };
}

/** Force an end (manual "End exercise" or navigation abort). */
export function forceEnd(
  sc: Scenario,
  s: SimState,
  rtIn: ScenarioRuntime,
  reason: 'completed' | 'aborted'
): ScenarioRuntime {
  const rt: ScenarioRuntime = structuredClone(rtIn);
  if (rt.endedAt != null) return rt;
  rt.endedAt = s.time;
  rt.endReason = reason;
  rt.result = rt.mode === 'assess' ? computeScore(sc, s, rt) : null;
  return rt;
}

export function checklistPct(rt: ScenarioRuntime, sc: Scenario): number {
  const total = sc.steps.reduce((a, x) => a + x.weight, 0);
  const done = sc.steps.reduce((a, x, i) => a + (rt.steps[i]?.done ? x.weight : 0), 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
