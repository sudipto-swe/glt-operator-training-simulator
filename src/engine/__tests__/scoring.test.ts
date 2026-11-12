/**
 * Scoring + scenario runner tests: category maths, critical auto-fail,
 * late-e-stop rule, response times, and end-to-end checklist evaluation
 * through the S2 scenario runtime.
 */
import { describe, expect, it } from 'vitest';
import { SCENARIOS, scenarioById } from '../../data/scenarios';
import { createInitialState, dispatch, step } from '../index';
import { computeScore, levelFromScore, qualityScore } from '../scoring';
import { DT } from '../constants';
import { emit } from '../events';
import { startRuntime, tickScenario } from '../../sim/scenarioRunner';
import type { Scenario, ScenarioRuntime } from '../types';

function makeRuntime(
  sc: Scenario,
  doneIds: string[],
  responseSec: Record<string, number> = {}
): ScenarioRuntime {
  return {
    scenarioId: sc.id,
    mode: 'assess',
    startedAt: 0,
    wallStartedAt: 0,
    injected: [],
    steps: sc.steps.map((st) => ({
      id: st.id,
      done: doneIds.includes(st.id),
      doneAt: doneIds.includes(st.id) ? 10 : null,
      hold: 0,
      responseSec: responseSec[st.id] ?? null
    })),
    endedAt: 60,
    result: null,
    endReason: 'completed'
  };
}

describe('levelFromScore', () => {
  it('maps scores to competency levels', () => {
    expect(levelFromScore(95)).toBe(4);
    expect(levelFromScore(90)).toBe(4);
    expect(levelFromScore(89)).toBe(3);
    expect(levelFromScore(75)).toBe(3);
    expect(levelFromScore(74)).toBe(2);
    expect(levelFromScore(60)).toBe(2);
    expect(levelFromScore(59)).toBe(1);
    expect(levelFromScore(45)).toBe(1);
    expect(levelFromScore(44)).toBe(0);
  });
});

describe('qualityScore', () => {
  it('is neutral with insufficient production', () => {
    const s = createInitialState(1);
    expect(qualityScore(s).points).toBe(12);
    expect(qualityScore(s).inSpecPct).toBeNull();
  });

  it('scales with in-spec percentage', () => {
    const s = createInitialState(1);
    s.quality.packedKg = 1000;
    s.quality.penaltyKg = 100; // 90% in spec -> full points
    expect(qualityScore(s).points).toBe(20);
    s.quality.penaltyKg = 400; // 60% in spec -> 15 points
    expect(qualityScore(s).points).toBe(15);
    s.quality.penaltyKg = 1000; // 0% in spec -> 0 points
    expect(qualityScore(s).points).toBe(0);
  });
});

describe('computeScore', () => {
  const s2 = scenarioById('S2') as Scenario;

  it('a clean full run scores high and passes', () => {
    const s = createInitialState(2);
    const rt = makeRuntime(
      s2,
      s2.steps.map((x) => x.id),
      { ack: 10, feedoff: 20 } // both within targets (30 s / 60 s)
    );
    const res = computeScore(s2, s, rt);
    expect(res.safety).toBe(40);
    expect(res.procedure).toBe(30);
    expect(res.quality).toBe(12); // neutral, no packing in this synthetic state
    expect(res.response).toBe(10);
    expect(res.total).toBe(92);
    expect(res.passed).toBe(true);
    expect(res.critical).toBeNull();
  });

  it('no steps done gives zero procedure', () => {
    const s = createInitialState(2);
    const rt = makeRuntime(s2, []);
    const res = computeScore(s2, s, rt);
    expect(res.procedure).toBe(0);
    expect(res.passed).toBe(false);
  });

  it('a LOTO violation auto-fails regardless of points', () => {
    const s = createInitialState(2);
    emit(s, 'LOTO_VIOLATION', 'critical', 'SAFETY VIOLATION: body in equipment.');
    const rt = makeRuntime(
      s2,
      s2.steps.map((x) => x.id),
      { ack: 10, feedoff: 20 }
    );
    const res = computeScore(s2, s, rt);
    expect(res.safety).toBe(0);
    expect(res.passed).toBe(false);
    expect(res.critical).toContain('SAFETY VIOLATION');
  });

  it('guard interlock and unacknowledged criticals deduct safety points', () => {
    const s = createInitialState(2);
    emit(s, 'GUARD_INTERLOCK', 'bad', 'Line auto-stopped by interlock.');
    emit(s, 'CRITICAL_UNACK:DRYER_TEMP_CRIT', 'bad', 'Critical alarm unacked 60 s.');
    const rt = makeRuntime(s2, []);
    const res = computeScore(s2, s, rt);
    expect(res.safety).toBe(40 - 15 - 5);
    expect(res.details.safetyDeductions).toHaveLength(2);
  });

  it('late e-stop on S5 deducts and an on-time one does not', () => {
    const s5 = scenarioById('S5') as Scenario;
    // No e-stop at all.
    const s1 = createInitialState(3);
    emit(s1, 'ALARM_RAISED', 'critical', 'DRYER_TEMP_CRIT: fire risk');
    const noStop = computeScore(s5, s1, makeRuntime(s5, []));
    expect(noStop.safety).toBe(40 - 25);

    // E-stop 50 s after the raise (target 45 s) - still late.
    const s2 = createInitialState(3);
    emit(s2, 'ALARM_RAISED', 'critical', 'DRYER_TEMP_CRIT: fire risk');
    s2.time = 50;
    emit(s2, 'ESTOP_PRESS', 'critical', 'EMERGENCY STOP actuated.');
    const late = computeScore(s5, s2, makeRuntime(s5, []));
    expect(late.safety).toBe(40 - 25);

    // E-stop 30 s after the raise - on time.
    const s3 = createInitialState(3);
    emit(s3, 'ALARM_RAISED', 'critical', 'DRYER_TEMP_CRIT: fire risk');
    s3.time = 30;
    emit(s3, 'ESTOP_PRESS', 'critical', 'EMERGENCY STOP actuated.');
    const onTime = computeScore(s5, s3, makeRuntime(s5, []));
    expect(onTime.safety).toBe(40);
  });

  it('slow responses earn partial response points', () => {
    const s = createInitialState(2);
    const rt = makeRuntime(
      s2,
      s2.steps.map((x) => x.id),
      { ack: 60, feedoff: 60 } // ack target 30 (0.5), feedoff target 60 (1.0)
    );
    const res = computeScore(s2, s, rt);
    // (0.5 + 1.0) / 2 * 10 = 7.5 -> rounded to 8.
    expect(res.response).toBe(8);
  });
});

describe('scenario runner (S2 integration)', () => {
  it('injects the jam on schedule and completes checklist steps as the operator responds', () => {
    const sc = scenarioById('S2') as Scenario;
    let s = createInitialState(77);
    let rt = startRuntime(sc, 'assess', 0);

    const tickOnce = () => {
      const out = tickScenario(sc, s, rt);
      s = step(out.engine, DT);
      rt = out.runtime;
    };

    // Start the line and feed so the jam has something to bite into.
    s = dispatch(s, { type: 'LINE_START' });
    let elapsed = 0;
    while (elapsed < 30) {
      tickOnce();
      elapsed += DT;
    }
    s = dispatch(s, { type: 'SET', key: 'feedEnabled', value: true });
    while (elapsed < 100) {
      tickOnce();
      elapsed += DT;
    }

    // Fault injected at t=90 and the alarm has raised by now.
    expect(s.faults.some((f) => f.id === 'FEED_JAM' && !f.cleared)).toBe(true);
    expect(s.alarms.some((a) => a.code === 'FEED_JAM')).toBe(true);
    expect(rt.injected).toContain('90:FEED_JAM');

    // Operator: ack + stop feed.
    s = dispatch(s, { type: 'ACK_ALARM', code: 'FEED_JAM' });
    s = dispatch(s, { type: 'SET', key: 'feedEnabled', value: false });
    while (elapsed < 110) {
      tickOnce();
      elapsed += DT;
    }
    const stepById = (id: string) => rt.steps[sc.steps.findIndex((x) => x.id === id)];
    expect(stepById('ack').done).toBe(true);
    expect(stepById('feedoff').done).toBe(true);
    expect(stepById('ack').responseSec).not.toBeNull();
    // Exercise still running.
    expect(rt.endedAt).toBeNull();
  });

  it('every scenario has at least one fault-free step, a quiz gate and valid weights', () => {
    for (const sc of SCENARIOS) {
      expect(sc.steps.length).toBeGreaterThan(0);
      expect(sc.steps.every((st) => st.weight > 0)).toBe(true);
      expect(sc.requiredQuiz).toMatch(/^quiz-/);
      expect(sc.passMark).toBeGreaterThanOrEqual(50);
      expect(sc.modes.length).toBeGreaterThan(0);
    }
  });
});
