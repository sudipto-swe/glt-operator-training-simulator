/**
 * Scoring: converts the event journal + checklist runtime into the
 * 4-category score (Safety 40 / Procedure 30 / Quality 20 / Response 10).
 * A critical violation (LOTO breach or dryer fire-risk) auto-fails the
 * attempt regardless of the numeric total.
 */
import * as C from './constants';
import type {
  AlarmCode,
  Scenario,
  ScenarioRuntime,
  ScoreBreakdown,
  SimEvent,
  SimState
} from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Most recent ALARM_RAISED event for `code` at/after `from` (or null). */
export function alarmRaiseEvent(s: SimState, code: AlarmCode, from = 0): SimEvent | null {
  let out: SimEvent | null = null;
  for (const e of s.events) {
    if (e.kind === 'ALARM_RAISED' && e.t >= from && e.message.startsWith(`${code}:`)) out = e;
  }
  return out;
}

/**
 * Quality points from the packing model.
 * Fewer than 100 kg packed -> neutral 12/20 (not enough production to judge).
 * Otherwise 80% in-spec product already earns full points.
 */
export function qualityScore(s: SimState): { points: number; inSpecPct: number | null } {
  if (s.quality.packedKg < 100) return { points: 12, inSpecPct: null };
  const inSpecPct = 100 * (1 - s.quality.penaltyKg / s.quality.packedKg);
  const points = Math.round(
    C.QUALITY_MAX * clamp((inSpecPct / 100) * 1.25, 0, 1)
  );
  return { points, inSpecPct };
}

/** Skill level 0..4 from a scenario score. */
export function levelFromScore(score: number): number {
  if (score >= 90) return 4;
  if (score >= 75) return 3;
  if (score >= 60) return 2;
  if (score >= 45) return 1;
  return 0;
}

export function computeScore(sc: Scenario, s: SimState, rt: ScenarioRuntime): ScoreBreakdown {
  const deductions: { reason: string; points: number }[] = [];
  let safety = C.SAFETY_MAX;
  const add = (reason: string, points: number) => {
    safety -= points;
    deductions.push({ reason, points });
  };

  let guardEvents = 0;
  let blockedStarts = 0;
  let unackEvents = 0;
  for (const e of s.events) {
    if (e.kind === 'GUARD_INTERLOCK' && ++guardEvents === 1) {
      add('Guard opened while the line was running', 15);
    }
    if (e.kind === 'START_BLOCKED' && ++blockedStarts <= 2) {
      add('Start attempt blocked by an interlock', 3);
    }
    if (e.kind.startsWith('CRITICAL_UNACK:') && ++unackEvents <= 2) {
      add(e.message, 5);
    }
  }

  if (sc.lateEstop) {
    const raise = alarmRaiseEvent(s, sc.lateEstop.alarmCode);
    const estop = raise
      ? s.events.find((e) => e.kind === 'ESTOP_PRESS' && e.t >= raise.t)
      : undefined;
    if (raise && (!estop || estop.t - raise.t > sc.lateEstop.withinSec)) {
      add(
        `E-stop not actuated within ${sc.lateEstop.withinSec} s of ${sc.lateEstop.alarmCode}`,
        sc.lateEstop.deduct
      );
    }
  }

  const criticalEvent =
    s.events.find((e) => e.kind === 'LOTO_VIOLATION') ??
    s.events.find((e) => e.kind === 'FIRE_RISK');
  if (criticalEvent) safety = 0;
  safety = clamp(safety, 0, C.SAFETY_MAX);

  const totalW = sc.steps.reduce((acc, x) => acc + x.weight, 0);
  const doneW = sc.steps.reduce((acc, x, i) => acc + (rt.steps[i]?.done ? x.weight : 0), 0);
  const procedure =
    totalW > 0 ? Math.round(C.PROCEDURE_MAX * (doneW / totalW)) : C.PROCEDURE_MAX;

  const q = qualityScore(s);

  const respDefs = sc.steps
    .map((def, i) => ({ def, rtStep: rt.steps[i] }))
    .filter((x) => x.def.alarmCode != null && x.def.responseTarget != null);
  let response = C.RESPONSE_MAX;
  if (respDefs.length > 0) {
    const parts = respDefs.map(({ def, rtStep }) => {
      const target = def.responseTarget;
      if (!rtStep?.done || rtStep.responseSec == null || target == null) return 0;
      return clamp(target / Math.max(rtStep.responseSec, 0.001), 0, 1);
    });
    response = Math.round((parts.reduce((a, b) => a + b, 0) / respDefs.length) * C.RESPONSE_MAX);
  }

  const total = clamp(safety + procedure + q.points + response, 0, 100);
  return {
    safety,
    procedure,
    quality: q.points,
    response,
    total,
    passed: !criticalEvent && total >= sc.passMark,
    critical: criticalEvent ? criticalEvent.message : null,
    details: {
      safetyDeductions: deductions,
      steps: sc.steps.map((def, i) => ({
        id: def.id,
        label: def.label,
        done: !!rt.steps[i]?.done,
        responseSec: rt.steps[i]?.responseSec ?? null
      })),
      qualityPct: q.inSpecPct == null ? null : Math.round(q.inSpecPct)
    }
  };
}
