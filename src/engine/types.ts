/**
 * Core type definitions for the GLT (Green Leaf Threshing) simulation engine.
 *
 * The engine is a pure function: `step(state, dt) -> state`.
 * It never touches the DOM, never reads the wall clock and never calls
 * Math.random — all randomness flows through a seeded RNG stored in the
 * state itself, so identical seeds + identical actions always replay
 * identically (see src/engine/__tests__).
 */

/* ------------------------------------------------------------------ */
/* Line state machine                                                  */
/* ------------------------------------------------------------------ */

/** Top-level line equipment state. */
export type LineState =
  | 'OFF' // never started since reset
  | 'STARTING' // purge / warm-up phase after LINE_START
  | 'RUNNING' // normal operation
  | 'STOPPED' // motors off, safe to start or begin LOTO
  | 'ESTOP' // emergency stop latched
  | 'MAINTENANCE'; // LOTO energy isolation active

/**
 * Lockout-Tagout energy-isolation sequence.
 * NONE -> ISOLATED -> LOCKED -> VERIFIED (work may now happen)
 * VERIFIED -> (LOTO_REMOVE) -> NONE
 */
export type LotoStep = 'NONE' | 'ISOLATED' | 'LOCKED' | 'VERIFIED';

/* ------------------------------------------------------------------ */
/* Operator inputs                                                     */
/* ------------------------------------------------------------------ */

export interface LineInputs {
  feedEnabled: boolean;
  feedRateSp: number; // kg/h, 500..8000
  steamOn: boolean; // conditioner steam / moisture valve
  moistureSp: number; // % target moisture at conditioner outlet, 15..24
  thresherOn: boolean;
  thresherSpeedSp: number; // rpm, 600..1200
  airSepOn: boolean;
  airVelocitySp: number; // m/s, 14..26
  dryerOn: boolean;
  dryerTempSp: number; // degC, 60..110
  packingOn: boolean;
}

export const DEFAULT_INPUTS: LineInputs = {
  feedEnabled: false,
  feedRateSp: 4000,
  steamOn: false,
  moistureSp: 19,
  thresherOn: false,
  thresherSpeedSp: 950,
  airSepOn: false,
  airVelocitySp: 20,
  dryerOn: false,
  dryerTempSp: 85,
  packingOn: false
};

/* ------------------------------------------------------------------ */
/* Faults                                                              */
/* ------------------------------------------------------------------ */

export type FaultId =
  | 'FEED_JAM' // feed conveyor jam at intake
  | 'COND_VALVE_STUCK' // conditioner steam valve stuck open -> over-moisture
  | 'NTRM_SPIKE' // non-tobacco related material entering with the leaf
  | 'DRYER_HEATER_FAULT' // dryer heater control failure -> runaway temperature
  | 'SENSOR_DRIFT' // moisture analyser reading slowly drifting low
  | 'THRESHER_OVERLOAD'; // thresher motor mechanically overloaded

export interface ActiveFault {
  id: FaultId;
  since: number; // sim seconds
  /** 0..1 how far the fault effect has ramped in (used by physics). */
  ramp: number;
  /** True once maintenance has repaired the root cause; effect decays out. */
  cleared: boolean;
}

/* ------------------------------------------------------------------ */
/* Alarms                                                              */
/* ------------------------------------------------------------------ */

export type AlarmCode =
  | 'HOPPER_HIGH'
  | 'FEED_JAM'
  | 'COND_MOIST_HIGH'
  | 'COND_MOIST_LOW'
  | 'THRESHER_OVERLOAD'
  | 'AIRFLOW_DEV'
  | 'DRYER_TEMP_HIGH'
  | 'DRYER_TEMP_CRIT'
  | 'NTRM_HIGH'
  | 'SENSOR_DEV'
  | 'GUARD_OPEN'
  | 'ESTOP';

export type AlarmPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AlarmStatus =
  | 'ACTIVE_UNACK' // alarm condition present, operator has not acknowledged
  | 'ACTIVE_ACK' // present and acknowledged
  | 'CLEARED_UNACK' // condition gone ("RTN" - return to normal), still unacked
  | 'CLEARED_ACK'; // gone and acked -> removed from the list

export interface Alarm {
  code: AlarmCode;
  priority: AlarmPriority;
  message: string;
  status: AlarmStatus;
  since: number;
  ackedAt: number | null;
  clearedAt: number | null;
}

/* ------------------------------------------------------------------ */
/* Process variables                                                   */
/* ------------------------------------------------------------------ */

export interface ProcessVars {
  hopperLevel: number; // % of blend hopper capacity
  feedRate: number; // kg/h actual
  moistureIn: number; // % moisture of leaf entering conditioning
  moistureCond: number; // % at conditioner outlet (ground truth)
  moistureDryerIn: number; // % entering dryer (transport lag)
  moistureOut: number; // % of packed product
  moistureReading: number; // value shown by the selected moisture sensor
  thresherSpeed: number; // rpm actual
  thresherCurrent: number; // % of nominal motor load
  airVelocity: number; // m/s actual in the air separator
  dryerTemp: number; // degC actual
  ntrm: number; // ppm non-tobacco related material in packed flow
  stemInLamina: number; // % stem contamination in lamina fraction
  casesPacked: number;
  caseWeight: number; // kg filled into current case
}

export interface TrendSample {
  t: number;
  feedRate: number;
  moistureCond: number;
  moistureOut: number;
  dryerTemp: number;
  ntrm: number;
}

export interface QualityState {
  packedKg: number; // total on-spec-or-not product packed
  penaltyKg: number; // kg packed while any quality condition was out of spec
  fireRisk: boolean; // dryer reached the fire-risk threshold this run
}

/* ------------------------------------------------------------------ */
/* Events (journal used for grading and the operator log)              */
/* ------------------------------------------------------------------ */

export type EventSeverity = 'info' | 'good' | 'warn' | 'bad' | 'critical';

export interface SimEvent {
  id: number;
  t: number;
  kind: string;
  severity: EventSeverity;
  message: string;
}

/**
 * Well-known event kinds emitted by the engine (also used for grading):
 * ALARM_RAISED, ALARM_ACK, ESTOP_PRESS, ESTOP_RESET, LINE_START,
 * LINE_STOP, START_COMPLETE, START_BLOCKED, GUARD_OPEN, GUARD_CLOSED,
 * GUARD_INTERLOCK, LOTO_ISOLATE, LOTO_LOCK, LOTO_VERIFY, LOTO_REMOVE,
 * LOTO_VIOLATION, JAM_CLEARED, VALVE_REPAIRED, HEATER_REPAIRED,
 * MOTOR_TRIP, MOTOR_RESET, SENSOR_MODE_AUTO, SENSOR_MODE_REF,
 * SENSOR_RECAL, SAMPLE_RESULT, SORT_DONE, SORT_BLOCKED, SP_SET,
 * FIRE_RISK, CRITICAL_UNACK.
 */

/* ------------------------------------------------------------------ */
/* Actions (operator / scenario commands, processed at the next step)   */
/* ------------------------------------------------------------------ */

export type SimAction =
  | { type: 'SET'; key: keyof LineInputs; value: number | boolean }
  | { type: 'LINE_START' }
  | { type: 'LINE_STOP' }
  | { type: 'ESTOP_PRESS' }
  | { type: 'ESTOP_RESET' }
  | { type: 'ACK_ALARM'; code: AlarmCode | 'ALL' }
  | { type: 'GUARD_OPEN' }
  | { type: 'GUARD_CLOSE' }
  | { type: 'LOTO_ISOLATE' }
  | { type: 'LOTO_LOCK' }
  | { type: 'LOTO_VERIFY' }
  | { type: 'LOTO_REMOVE' }
  | { type: 'CLEAR_JAM' }
  | { type: 'REPAIR_VALVE' }
  | { type: 'REPAIR_HEATER' }
  | { type: 'RESET_MOTOR' }
  | { type: 'SENSOR_MODE'; mode: 'auto' | 'reference' }
  | { type: 'RECAL_SENSOR' }
  | { type: 'TAKE_SAMPLE' }
  | { type: 'SORT_INTAKE' }
  | { type: 'INJECT_FAULT'; fault: FaultId } // free-play / trainer use only
  | { type: 'CLEAR_ALL_FAULTS' }; // free-play / trainer use only

/* ------------------------------------------------------------------ */
/* Simulation state                                                    */
/* ------------------------------------------------------------------ */

export type SensorMode = 'auto' | 'reference';

export interface SimState {
  time: number; // sim seconds since scenario/reset
  seed: number; // live RNG state (mulberry32)
  lineState: LineState;
  startProgress: number; // 0..1 during STARTING
  eStop: boolean; // e-stop latched?
  guardOpen: boolean;
  loto: LotoStep;
  inputs: LineInputs;
  pv: ProcessVars;
  faults: ActiveFault[];
  alarms: Alarm[];
  events: SimEvent[]; // newest last; capped
  eventId: number;
  quality: QualityState;
  trend: TrendSample[]; // ring buffer, ~8 minutes at 2 s sampling
  lastTrendAt: number;
  sensorMode: SensorMode;
  sensorBias: number; // % drift of the auto moisture sensor
  valveBias: number; // % extra moisture from the stuck valve
  heaterRamp: number; // degC runaway offset of the dryer heater fault
  overloadTimer: number; // s the thresher has spent above trip load
  /** In-flight timed maintenance action (SORT) or lab sample freshness. */
  maintenance: { kind: 'SORT'; startedAt: number; doneAt: number } | null;
  sample: { takenAt: number; value: number } | null;
  pending: SimAction[];
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export type SkillId =
  | 'startup' // line startup & shutdown
  | 'faults' // fault diagnosis & response
  | 'loto' // LOTO & energy isolation
  | 'quality' // quality control
  | 'emergency' // emergency response
  | 'records'; // data, records & documentation

/* ------------------------------------------------------------------ */
/* Scenarios and grading                                               */
/* ------------------------------------------------------------------ */

/** Context handed to every checklist predicate. */
export interface StepCtx {
  /** Current engine state. */
  s: SimState;
  /** Full event journal since scenario start. */
  events: SimEvent[];
  /** Completion timestamps of steps done so far (sim seconds). */
  doneAt: Readonly<Record<string, number>>;
}

export interface CheckStep {
  id: string;
  /** Imperative instruction shown to the trainee in Learn mode. */
  label: string;
  /** Deeper coaching hint shown in Learn mode only. */
  hint: string;
  /** Relative weight in the procedure score. */
  weight: number;
  /** If set, response time is measured from this alarm's most recent raise. */
  alarmCode?: AlarmCode;
  /** Seconds within which the step should be done for full response points. */
  responseTarget?: number;
  /** Condition must hold this many consecutive seconds before done. */
  holdSec?: number;
  done: (ctx: StepCtx) => boolean;
}

export interface FaultSchedule {
  at: number; // sim seconds into the scenario
  fault: FaultId;
}

export interface LateEstopRule {
  /** A critical e-stop must follow this alarm. */
  alarmCode: AlarmCode;
  withinSec: number;
  /** Safety points deducted when the operator reacts too late. */
  deduct: number;
}

export interface Scenario {
  id: string; // 'S1'..'S6'
  title: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  durationSec: number;
  modes: ('learn' | 'assess')[];
  skill: SkillId;
  /** Quiz that must be passed (>=80%) before Assess unlocks. */
  requiredQuiz: string;
  brief: string;
  objectives: string[];
  schedule: FaultSchedule[];
  steps: CheckStep[];
  passMark: number;
  lateEstop?: LateEstopRule;
}

/* ------------------------------------------------------------------ */
/* Runtime + scoring                                                   */
/* ------------------------------------------------------------------ */

export interface RuntimeStep {
  id: string;
  done: boolean;
  doneAt: number | null;
  /** Consecutive seconds the step condition currently holds (for holdSec). */
  hold: number;
  /** Response seconds from trigger alarm to completion (assess grading). */
  responseSec: number | null;
}

export interface ScenarioRuntime {
  scenarioId: string;
  mode: 'learn' | 'assess';
  startedAt: number; // sim time the scenario started
  wallStartedAt: number; // epoch ms, records only (never used by physics)
  injected: string[]; // schedule keys already injected
  steps: RuntimeStep[];
  endedAt: number | null;
  result: ScoreBreakdown | null; // assess mode only
  endReason: 'completed' | 'timeout' | 'aborted' | null;
}

export interface ScoreBreakdown {
  safety: number; // 0..40
  procedure: number; // 0..30
  quality: number; // 0..20
  response: number; // 0..10
  total: number; // 0..100
  passed: boolean;
  critical: string | null; // description of the auto-fail violation, if any
  details: {
    safetyDeductions: { reason: string; points: number }[];
    steps: { id: string; label: string; done: boolean; responseSec: number | null }[];
    qualityPct: number | null; // % of packed kg that was in spec
  };
}
