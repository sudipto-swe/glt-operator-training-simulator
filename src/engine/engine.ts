/**
 * The GLT simulation engine.
 *
 * `step(state, dt)` is a PURE function: it clones the state, consumes any
 * queued operator actions, advances the line state machine, integrates the
 * process model, advances fault effects, updates alarms, quality and the
 * trend buffer, and returns the new state. No DOM, no wall clock, no
 * Math.random anywhere in this file.
 *
 * Process model (simplified but qualitatively faithful):
 *   intake/blending -> conditioning (steam + water) -> threshing
 *   -> air separation (lamina up / stem down) -> drying -> packing
 */
import * as C from './constants';
import { acknowledgeAlarm, updateAlarms } from './alarms';
import { emit, hasEvent } from './events';
import { findFault, hasFault, injectFault, repairFault, tickFaults } from './faults';
import { lotoTransition, requireVerifiedForWork, startBlockReason } from './loto';
import { rand } from './rng';
import { DEFAULT_INPUTS } from './types';
import type { LineInputs, SimAction, SimState } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lag = (cur: number, target: number, dt: number, tau: number) =>
  cur + (target - cur) * Math.min(1, dt / tau);
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Setpoint clamping limits for numeric operator inputs. */
const NUMERIC_SP_LIMITS: Partial<Record<keyof LineInputs, [number, number]>> = {
  feedRateSp: [C.FEED_MIN, C.FEED_MAX],
  moistureSp: [C.MOIST_SP_MIN, C.MOIST_SP_MAX],
  thresherSpeedSp: [C.THRESHER_SPEED_MIN, C.THRESHER_SPEED_MAX],
  airVelocitySp: [C.AIR_VEL_MIN, C.AIR_VEL_MAX],
  dryerTempSp: [C.DRYER_TEMP_SP_MIN, C.DRYER_TEMP_SP_MAX]
};

/** Seconds each fault needs to reach full effect (and to decay after repair). */
const FAULT_RAMP_TIMES: Record<string, number> = {
  FEED_JAM: 5,
  COND_VALVE_STUCK: C.VALVE_RAMP_TIME,
  NTRM_SPIKE: 30,
  DRYER_HEATER_FAULT: C.HEATER_RAMP_TIME,
  SENSOR_DRIFT: C.SENSOR_RAMP_TIME,
  THRESHER_OVERLOAD: 120
};

export function createInitialState(seed = 42): SimState {
  return {
    time: 0,
    seed,
    lineState: 'OFF',
    startProgress: 0,
    eStop: false,
    guardOpen: false,
    loto: 'NONE',
    inputs: { ...DEFAULT_INPUTS },
    pv: {
      hopperLevel: C.HOPPER_NORMAL,
      feedRate: 0,
      moistureIn: C.MOIST_IN_BASE,
      moistureCond: C.MOIST_IN_BASE,
      moistureDryerIn: C.MOIST_IN_BASE,
      moistureOut: C.MOIST_IN_BASE,
      moistureReading: C.MOIST_IN_BASE,
      thresherSpeed: 0,
      thresherCurrent: 0,
      airVelocity: 0,
      dryerTemp: C.AMBIENT,
      ntrm: C.NTRM_BASE,
      stemInLamina: 2.5,
      casesPacked: 0,
      caseWeight: 0
    },
    faults: [],
    alarms: [],
    events: [],
    eventId: 0,
    quality: { packedKg: 0, penaltyKg: 0, fireRisk: false },
    trend: [],
    lastTrendAt: 0,
    sensorMode: 'auto',
    sensorBias: 0,
    valveBias: 0,
    heaterRamp: 0,
    overloadTimer: 0,
    maintenance: null,
    sample: null,
    pending: []
  };
}

/** Queue an operator action; it is applied at the next step. */
export function dispatch(prev: SimState, action: SimAction): SimState {
  return { ...prev, pending: [...prev.pending, action] };
}

/** Advance the simulation by dt seconds (dt should be C.DT). */
export function step(prev: SimState, dt: number): SimState {
  const s: SimState = structuredClone(prev);
  s.time += dt;
  const actions = s.pending;
  s.pending = [];
  for (const a of actions) applyAction(s, a);
  advanceLineState(s, dt);
  integrate(s, dt);
  tickFaults(s, dt, FAULT_RAMP_TIMES);
  updateMaintenance(s);
  updateAlarms(s);
  criticalUnackWatchdog(s);
  sampleTrend(s);
  return s;
}

/* ------------------------------------------------------------------ */
/* Action handling                                                     */
/* ------------------------------------------------------------------ */

function applyAction(s: SimState, a: SimAction): void {
  switch (a.type) {
    case 'SET': {
      const cur = s.inputs[a.key];
      const target = s.inputs as Record<keyof LineInputs, number | boolean>;
      if (typeof cur === 'boolean') {
        if (typeof a.value !== 'boolean') return;
        target[a.key] = a.value;
        emit(s, 'SP_SET', 'info', `${a.key} set to ${a.value}.`);
      } else {
        if (typeof a.value !== 'number') return;
        const lim = NUMERIC_SP_LIMITS[a.key];
        const v = lim ? clamp(a.value, lim[0], lim[1]) : a.value;
        target[a.key] = v;
        emit(s, 'SP_SET', 'info', `${a.key} set to ${Math.round(v)}.`);
      }
      return;
    }

    case 'LINE_START': {
      const reason = startBlockReason(s);
      if (reason) {
        emit(s, 'START_BLOCKED', 'warn', `Start refused: ${reason}.`);
        return;
      }
      s.lineState = 'STARTING';
      s.startProgress = 0;
      emit(s, 'LINE_START', 'info', 'Line start initiated: purge and warm-up running.');
      return;
    }

    case 'LINE_STOP': {
      if (s.lineState === 'RUNNING' || s.lineState === 'STARTING') {
        s.lineState = 'STOPPED';
        s.startProgress = 0;
        emit(s, 'LINE_STOP', 'info', 'Normal line stop: motors off, dryer cooling.');
      }
      return;
    }

    case 'ESTOP_PRESS': {
      if (s.eStop) return;
      s.eStop = true;
      s.lineState = 'ESTOP';
      s.startProgress = 0;
      emit(s, 'ESTOP_PRESS', 'critical', 'EMERGENCY STOP actuated - all drives de-energised.');
      return;
    }

    case 'ESTOP_RESET': {
      if (!s.eStop) return;
      if (s.guardOpen) {
        emit(s, 'ESTOP_RESET', 'warn', 'E-stop reset refused: close the guard first.');
        return;
      }
      s.eStop = false;
      s.lineState = 'STOPPED';
      emit(s, 'ESTOP_RESET', 'good', 'E-stop reset (twist-release). Line in STOPPED state.');
      return;
    }

    case 'ACK_ALARM':
      acknowledgeAlarm(s, a.code);
      return;

    case 'GUARD_OPEN': {
      s.guardOpen = true;
      emit(s, 'GUARD_OPEN', 'warn', 'Guard opened.');
      if (s.lineState === 'RUNNING' || s.lineState === 'STARTING') {
        s.lineState = 'STOPPED';
        s.startProgress = 0;
        emit(
          s,
          'GUARD_INTERLOCK',
          'bad',
          'Line auto-stopped by interlock: a guard was opened while running.'
        );
      }
      return;
    }

    case 'GUARD_CLOSE':
      s.guardOpen = false;
      emit(s, 'GUARD_CLOSED', 'info', 'Guard closed and interlock reset.');
      return;

    case 'LOTO_ISOLATE':
      lotoTransition(s, 'ISOLATE');
      return;
    case 'LOTO_LOCK':
      lotoTransition(s, 'LOCK');
      return;
    case 'LOTO_VERIFY':
      lotoTransition(s, 'VERIFY');
      return;
    case 'LOTO_REMOVE':
      lotoTransition(s, 'REMOVE');
      return;

    case 'CLEAR_JAM': {
      if (!hasFault(s, 'FEED_JAM')) {
        emit(s, 'CLEAR_JAM', 'info', 'No jam present at the feed conveyor.');
        return;
      }
      if (!requireVerifiedForWork(s, 'Clearing the feed jam')) return;
      repairFault(s, 'FEED_JAM', 'Feed path opened, foreign object removed, conveyor inspected.');
      emit(s, 'JAM_CLEARED', 'good', 'Feed conveyor jam cleared.');
      return;
    }

    case 'REPAIR_VALVE': {
      if (!hasFault(s, 'COND_VALVE_STUCK')) {
        emit(s, 'REPAIR_VALVE', 'info', 'Conditioner steam valve is operating normally.');
        return;
      }
      if (!requireVerifiedForWork(s, 'Repairing the steam valve')) return;
      repairFault(s, 'COND_VALVE_STUCK', 'Steam valve actuator replaced and stroke-tested.');
      emit(s, 'VALVE_REPAIRED', 'good', 'Conditioner steam valve repaired.');
      return;
    }

    case 'REPAIR_HEATER': {
      if (!hasFault(s, 'DRYER_HEATER_FAULT')) {
        emit(s, 'REPAIR_HEATER', 'info', 'Dryer heater circuit tests healthy.');
        return;
      }
      if (!requireVerifiedForWork(s, 'Repairing the dryer heater')) return;
      repairFault(s, 'DRYER_HEATER_FAULT', 'Welded contactor replaced, heater loop tested.');
      emit(s, 'HEATER_REPAIRED', 'good', 'Dryer heater repaired.');
      return;
    }

    case 'RESET_MOTOR': {
      if (s.lineState === 'RUNNING' || s.lineState === 'STARTING') {
        emit(s, 'RESET_MOTOR', 'warn', 'Stop the line before resetting the motor breaker.');
        return;
      }
      if (!hasFault(s, 'THRESHER_OVERLOAD')) {
        emit(s, 'RESET_MOTOR', 'info', 'Thresher motor protection is healthy.');
        return;
      }
      repairFault(s, 'THRESHER_OVERLOAD', 'Thresher cage inspected, overload cause removed.');
      emit(s, 'MOTOR_RESET', 'good', 'Thresher motor breaker reset.');
      return;
    }

    case 'SENSOR_MODE':
      s.sensorMode = a.mode;
      emit(
        s,
        a.mode === 'reference' ? 'SENSOR_MODE_REF' : 'SENSOR_MODE_AUTO',
        'info',
        a.mode === 'reference'
          ? 'Moisture control switched to the reference analyser.'
          : 'Moisture control switched back to the inline analyser.'
      );
      return;

    case 'RECAL_SENSOR': {
      if (s.lineState === 'RUNNING' || s.lineState === 'STARTING') {
        emit(s, 'RECAL_SENSOR', 'warn', 'Stop the line before recalibrating the analyser.');
        return;
      }
      if (!hasFault(s, 'SENSOR_DRIFT')) {
        emit(s, 'RECAL_SENSOR', 'info', 'Moisture analyser is within calibration.');
        return;
      }
      repairFault(s, 'SENSOR_DRIFT', 'Inline analyser recalibrated against the lab reference.');
      emit(s, 'SENSOR_RECAL', 'good', 'Moisture analyser recalibrated.');
      return;
    }

    case 'TAKE_SAMPLE': {
      const v = round2(s.pv.moistureCond);
      s.sample = { takenAt: s.time, value: v };
      emit(
        s,
        'SAMPLE_RESULT',
        'good',
        `Lab sample taken: conditioner outlet moisture ${v.toFixed(1)}% (display shows ${s.pv.moistureReading.toFixed(1)}%).`
      );
      return;
    }

    case 'SORT_INTAKE': {
      if (s.maintenance) {
        emit(s, 'SORT_INTAKE', 'info', 'Sorting crew is already working at intake.');
        return;
      }
      if (s.inputs.feedEnabled) {
        emit(
          s,
          'SORT_BLOCKED',
          'warn',
          'Sorting refused: stop the feed before the crew enters the intake area.'
        );
        return;
      }
      if (!hasFault(s, 'NTRM_SPIKE')) {
        emit(s, 'SORT_INTAKE', 'info', 'Nothing to sort: NTRM is within limits.');
        return;
      }
      s.maintenance = { kind: 'SORT', startedAt: s.time, doneAt: s.time + C.SORT_DURATION };
      emit(s, 'SORT_INTAKE', 'info', `Sorting crew mobilised at intake (${C.SORT_DURATION} s).`);
      return;
    }

    case 'INJECT_FAULT':
      injectFault(s, a.fault);
      return;

    case 'CLEAR_ALL_FAULTS':
      if (s.faults.length > 0) {
        s.faults = [];
        emit(s, 'FAULTS_CLEARED', 'info', 'Trainer action: all faults cleared.');
      }
      return;
  }
}

/* ------------------------------------------------------------------ */
/* Line state machine progression                                     */
/* ------------------------------------------------------------------ */

function advanceLineState(s: SimState, dt: number): void {
  if (s.lineState === 'STARTING' && !s.eStop && !s.guardOpen) {
    s.startProgress = Math.min(1, s.startProgress + dt / C.START_DURATION);
    if (s.startProgress >= 1) {
      s.lineState = 'RUNNING';
      emit(s, 'START_COMPLETE', 'good', 'Start sequence complete: line RUNNING.');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Physics                                                            */
/* ------------------------------------------------------------------ */

function integrate(s: SimState, dt: number): void {
  const run = s.lineState === 'RUNNING' || s.lineState === 'STARTING';
  const jam = hasFault(s, 'FEED_JAM');

  // Derived fault-effect caches (also displayed by the debug/trainer panel).
  const valve = findFault(s, 'COND_VALVE_STUCK');
  s.valveBias = valve ? valve.ramp * C.VALVE_BIAS_MAX : 0;
  const heat = findFault(s, 'DRYER_HEATER_FAULT');
  s.heaterRamp = heat ? heat.ramp * C.HEATER_RAMP_MAX : 0;
  const sens = findFault(s, 'SENSOR_DRIFT');
  s.sensorBias = sens ? C.SENSOR_BIAS_MAX * sens.ramp : 0;

  // --- Intake / blending ---
  const feedTarget = run && s.inputs.feedEnabled && !jam ? s.inputs.feedRateSp : 0;
  s.pv.feedRate = lag(s.pv.feedRate, feedTarget, dt, C.FEED_TAU);

  if (jam && run) {
    s.pv.hopperLevel = clamp(s.pv.hopperLevel + C.HOPPER_JAM_RISE * dt, 0, 100);
  } else if (run && s.inputs.feedEnabled) {
    // Tipper discharge control holds the blend hopper around its target.
    s.pv.hopperLevel = clamp(
      s.pv.hopperLevel + (C.HOPPER_NORMAL - s.pv.hopperLevel) * (dt / 60),
      0,
      100
    );
  } else if (run && !s.inputs.feedEnabled) {
    s.pv.hopperLevel = clamp(s.pv.hopperLevel - C.HOPPER_DRAIN * dt, 0, 100);
  }

  // --- Conditioning ---
  s.pv.moistureIn = C.MOIST_IN_BASE + 0.3 * Math.sin(s.time / 97) + (rand(s) - 0.5) * 0.1;
  const condTarget =
    run && s.inputs.steamOn ? s.inputs.moistureSp + s.valveBias : s.pv.moistureIn;
  s.pv.moistureCond = lag(s.pv.moistureCond, condTarget, dt, C.COND_TAU);
  s.pv.moistureDryerIn = lag(s.pv.moistureDryerIn, s.pv.moistureCond, dt, C.DRYER_MOIST_TAU);

  // --- Threshing ---
  const spdTarget = run && s.inputs.thresherOn ? s.inputs.thresherSpeedSp : 0;
  s.pv.thresherSpeed = lag(s.pv.thresherSpeed, spdTarget, dt, C.THRESHER_TAU);

  const overload = findFault(s, 'THRESHER_OVERLOAD');
  let curTarget =
    50 + 34 * (s.pv.feedRate / C.FEED_MAX) + 5 * Math.max(0, s.pv.moistureCond - 20);
  if (overload) curTarget += C.OVERLOAD_RAMP_MAX * overload.ramp;
  if (s.pv.thresherSpeed < 50) curTarget = Math.min(curTarget, 15);
  s.pv.thresherCurrent = lag(s.pv.thresherCurrent, curTarget, dt, C.CURRENT_TAU);

  if (s.pv.thresherCurrent >= C.CURRENT_TRIP) {
    s.overloadTimer += dt;
  } else {
    s.overloadTimer = 0;
  }
  if (s.overloadTimer >= C.CURRENT_TRIP_DELAY && s.inputs.thresherOn) {
    s.inputs.thresherOn = false;
    s.overloadTimer = 0;
    emit(s, 'MOTOR_TRIP', 'bad', 'Thresher motor protection TRIPPED on overload.');
  }

  // --- Air separation ---
  const airTarget = run && s.inputs.airSepOn ? s.inputs.airVelocitySp : 0;
  s.pv.airVelocity = lag(s.pv.airVelocity, airTarget, dt, C.AIR_TAU);
  const stemTarget = clamp(
    2.5 +
      0.55 * Math.abs(s.pv.airVelocity - C.AIR_OPTIMAL) +
      0.25 * Math.max(0, s.pv.moistureCond - 21),
    1,
    15
  );
  s.pv.stemInLamina = lag(s.pv.stemInLamina, stemTarget, dt, 10);

  // --- Drying ---
  const dryerTarget = run && s.inputs.dryerOn ? s.inputs.dryerTempSp + s.heaterRamp : C.AMBIENT;
  s.pv.dryerTemp = lag(s.pv.dryerTemp, dryerTarget, dt, C.DRYER_TAU);
  if (s.pv.dryerTemp >= C.DRYER_FIRE && !s.quality.fireRisk) {
    s.quality.fireRisk = true;
    emit(s, 'FIRE_RISK', 'critical', `FIRE RISK: dryer temperature exceeded ${C.DRYER_FIRE} degC.`);
  }

  const dryMoistTarget =
    run && s.inputs.dryerOn
      ? clamp(s.pv.moistureDryerIn - (s.pv.dryerTemp - 40) * C.DRY_MOIST_COEF, 3, 26)
      : s.pv.moistureDryerIn;
  s.pv.moistureOut = lag(s.pv.moistureOut, dryMoistTarget, dt, 15);

  // --- NTRM ---
  const spike = findFault(s, 'NTRM_SPIKE');
  let ntrmTarget = C.NTRM_BASE + 150 * Math.sin(s.time / 53 + 2) + (rand(s) - 0.5) * 60;
  if (spike && !spike.cleared) ntrmTarget += spike.ramp * C.NTRM_SPIKE_TARGET;
  s.pv.ntrm = lag(s.pv.ntrm, ntrmTarget, dt, C.NTRM_TAU);

  // --- Packing & quality ---
  if (run && s.inputs.packingOn && s.pv.feedRate > 10) {
    const kgPerSec = (s.pv.feedRate * C.LAMINA_YIELD) / 3600;
    s.pv.caseWeight += kgPerSec * dt;
    s.quality.packedKg += kgPerSec * dt;
    const outOfSpec =
      s.pv.moistureOut < C.PACK_MOIST_MIN ||
      s.pv.moistureOut > C.PACK_MOIST_MAX ||
      s.pv.stemInLamina > C.STEM_SPEC ||
      s.pv.ntrm > C.NTRM_ALARM ||
      s.pv.dryerTemp > C.DRYER_HIGH;
    if (outOfSpec) s.quality.penaltyKg += kgPerSec * dt;
    while (s.pv.caseWeight >= C.CASE_TARGET) {
      s.pv.caseWeight -= C.CASE_TARGET;
      s.pv.casesPacked += 1;
    }
  }

  // --- Moisture analyser display ---
  s.pv.moistureReading =
    s.sensorMode === 'auto' ? s.pv.moistureCond + s.sensorBias : s.pv.moistureCond;
}

/* ------------------------------------------------------------------ */
/* Timed maintenance, watchdog, trends                                */
/* ------------------------------------------------------------------ */

function updateMaintenance(s: SimState): void {
  if (s.maintenance && s.time >= s.maintenance.doneAt) {
    if (s.maintenance.kind === 'SORT') {
      repairFault(s, 'NTRM_SPIKE', 'Contaminated pallets segregated at intake.');
      emit(s, 'SORT_DONE', 'good', 'Intake sorting complete: NTRM source removed.');
    }
    s.maintenance = null;
  }
  if (s.sample && s.time - s.sample.takenAt > C.SAMPLE_FRESH) {
    s.sample = null; // lab results go stale in the HMI
  }
}

/** Flag critical alarms that sit unacknowledged for more than 60 s. */
function criticalUnackWatchdog(s: SimState): void {
  for (const a of s.alarms) {
    if (a.priority !== 'CRITICAL' || a.status !== 'ACTIVE_UNACK') continue;
    if (s.time - a.since >= 60 && !hasEvent(s, `CRITICAL_UNACK:${a.code}`, a.since)) {
      emit(
        s,
        `CRITICAL_UNACK:${a.code}`,
        'bad',
        `Critical alarm ${a.code} left unacknowledged for 60 s.`
      );
    }
  }
}

function sampleTrend(s: SimState): void {
  if (s.time - s.lastTrendAt < C.TREND_INTERVAL) return;
  s.lastTrendAt = s.time;
  s.trend.push({
    t: s.time,
    feedRate: round2(s.pv.feedRate),
    moistureCond: round2(s.pv.moistureCond),
    moistureOut: round2(s.pv.moistureOut),
    dryerTemp: round2(s.pv.dryerTemp),
    ntrm: Math.round(s.pv.ntrm)
  });
  if (s.trend.length > C.TREND_MAX) s.trend.splice(0, s.trend.length - C.TREND_MAX);
}
