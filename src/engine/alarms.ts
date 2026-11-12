/**
 * Alarm subsystem: prioritised alarms with a full ISA-style lifecycle
 * (active/unacked -> active/acked -> cleared/unacked "RTN" -> removed)
 * plus operator acknowledgement. The alarm banner always shows the
 * highest-priority unacknowledged alarm.
 */
import { emit } from './events';
import type { Alarm, AlarmCode, AlarmPriority, SimState } from './types';
import * as C from './constants';

interface AlarmDef {
  code: AlarmCode;
  priority: AlarmPriority;
  message: string;
  active: (s: SimState) => boolean;
  clear: (s: SimState) => boolean;
}

const DEFS: AlarmDef[] = [
  {
    code: 'ESTOP',
    priority: 'CRITICAL',
    message: 'Emergency stop actuated',
    active: (s) => s.eStop,
    clear: () => false // handled explicitly by the reset action
  },
  {
    code: 'GUARD_OPEN',
    priority: 'CRITICAL',
    message: 'Guard open - line interlocked',
    active: (s) => s.guardOpen,
    clear: (s) => !s.guardOpen
  },
  {
    code: 'DRYER_TEMP_CRIT',
    priority: 'CRITICAL',
    message: 'Dryer temperature CRITICAL - fire risk',
    active: (s) => s.pv.dryerTemp >= C.DRYER_CRIT,
    clear: (s) => s.pv.dryerTemp <= C.DRYER_CRIT_CLEAR
  },
  {
    code: 'DRYER_TEMP_HIGH',
    priority: 'HIGH',
    message: 'Dryer temperature high',
    active: (s) => s.pv.dryerTemp >= C.DRYER_HIGH,
    clear: (s) => s.pv.dryerTemp <= C.DRYER_HIGH_CLEAR
  },
  {
    code: 'FEED_JAM',
    priority: 'HIGH',
    message: 'Feed conveyor jam detected',
    active: (s) => s.faults.some((f) => f.id === 'FEED_JAM' && !f.cleared),
    clear: (s) => !s.faults.some((f) => f.id === 'FEED_JAM' && !f.cleared)
  },
  {
    code: 'COND_MOIST_HIGH',
    priority: 'HIGH',
    message: 'Conditioner outlet moisture high',
    active: (s) =>
      (s.lineState === 'RUNNING' || s.lineState === 'STARTING') && s.pv.moistureCond >= C.MOIST_HIGH,
    clear: (s) =>
      s.pv.moistureCond <= C.MOIST_HIGH_CLEAR ||
      (s.lineState !== 'RUNNING' && s.lineState !== 'STARTING')
  },
  {
    code: 'COND_MOIST_LOW',
    priority: 'MEDIUM',
    message: 'Conditioner outlet moisture low',
    active: (s) =>
      (s.lineState === 'RUNNING' || s.lineState === 'STARTING') && s.pv.moistureCond <= C.MOIST_LOW,
    clear: (s) =>
      s.pv.moistureCond >= C.MOIST_LOW_CLEAR ||
      (s.lineState !== 'RUNNING' && s.lineState !== 'STARTING')
  },
  {
    code: 'THRESHER_OVERLOAD',
    priority: 'HIGH',
    message: 'Thresher motor load high',
    active: (s) => s.pv.thresherCurrent >= C.CURRENT_ALARM,
    clear: (s) => s.pv.thresherCurrent <= C.CURRENT_ALARM_CLEAR
  },
  {
    code: 'AIRFLOW_DEV',
    priority: 'MEDIUM',
    message: 'Air-separator flow deviation',
    active: (s) =>
      s.inputs.airSepOn &&
      s.lineState === 'RUNNING' &&
      Math.abs(s.pv.airVelocity - s.inputs.airVelocitySp) > C.AIR_DEV_ALARM,
    clear: (s) =>
      Math.abs(s.pv.airVelocity - s.inputs.airVelocitySp) <= C.AIR_DEV_ALARM ||
      !s.inputs.airSepOn ||
      s.lineState !== 'RUNNING'
  },
  {
    code: 'NTRM_HIGH',
    priority: 'HIGH',
    message: 'NTRM above acceptance limit',
    active: (s) => s.pv.ntrm >= C.NTRM_ALARM,
    clear: (s) => s.pv.ntrm <= C.NTRM_ALARM_CLEAR
  },
  {
    code: 'SENSOR_DEV',
    priority: 'MEDIUM',
    message: 'Moisture analyser self-check failed',
    active: (s) => Math.abs(s.sensorBias) >= C.SENSOR_DEV_ALARM,
    clear: (s) => Math.abs(s.sensorBias) <= C.SENSOR_DEV_CLEAR
  },
  {
    code: 'HOPPER_HIGH',
    priority: 'MEDIUM',
    message: 'Blend hopper level high',
    active: (s) => s.pv.hopperLevel >= C.HOPPER_HIGH,
    clear: (s) => s.pv.hopperLevel <= C.HOPPER_HIGH_CLEAR
  }
];

export const PRIORITY_ORDER: Record<AlarmPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

export function alarmDef(code: AlarmCode): AlarmDef {
  return DEFS.find((d) => d.code === code) as AlarmDef;
}

/** Evaluate every alarm condition and manage lifecycle transitions. */
export function updateAlarms(s: SimState): void {
  for (const def of DEFS) {
    let alarm = s.alarms.find((a) => a.code === def.code);
    if (def.active(s)) {
      if (!alarm || alarm.status === 'CLEARED_ACK') {
        if (alarm) {
          s.alarms = s.alarms.filter((a) => a !== alarm);
        }
        alarm = {
          code: def.code,
          priority: def.priority,
          message: def.message,
          status: 'ACTIVE_UNACK',
          since: s.time,
          ackedAt: null,
          clearedAt: null
        };
        s.alarms.push(alarm);
        emit(s, 'ALARM_RAISED', def.priority === 'CRITICAL' ? 'critical' : 'warn', `${def.code}: ${def.message}`);
      } else if (alarm.status === 'CLEARED_UNACK') {
        // Re-activated before the operator acknowledged the return-to-normal.
        alarm.status = 'ACTIVE_UNACK';
        alarm.since = s.time;
        alarm.clearedAt = null;
        emit(s, 'ALARM_RAISED', def.priority === 'CRITICAL' ? 'critical' : 'warn', `${def.code}: ${def.message}`);
      }
    } else if (alarm && (alarm.status === 'ACTIVE_UNACK' || alarm.status === 'ACTIVE_ACK')) {
      alarm.status = 'CLEARED_UNACK';
      alarm.clearedAt = s.time;
      emit(s, 'ALARM_CLEARED', 'info', `${def.code}: condition returned to normal (RTN).`);
    }
  }
  // Fully acknowledged + cleared alarms leave the list.
  s.alarms = s.alarms.filter((a) => a.status !== 'CLEARED_ACK');
}

export function acknowledgeAlarm(s: SimState, code: AlarmCode | 'ALL'): void {
  for (const a of s.alarms) {
    if (code !== 'ALL' && a.code !== code) continue;
    if (a.status === 'ACTIVE_UNACK') {
      a.status = 'ACTIVE_ACK';
      a.ackedAt = s.time;
      emit(s, 'ALARM_ACK', 'info', `Alarm acknowledged: ${a.code}.`);
    } else if (a.status === 'CLEARED_UNACK') {
      a.status = 'CLEARED_ACK';
      a.ackedAt = s.time;
      emit(s, 'ALARM_ACK', 'info', `RTN acknowledged: ${a.code}.`);
    }
  }
}

/** Highest-priority alarm for the banner (unacked first). */
export function topAlarm(s: SimState): Alarm | null {
  if (s.alarms.length === 0) return null;
  return [...s.alarms].sort((a, b) => {
    const unack = Number(a.status.includes('UNACK')) - Number(b.status.includes('UNACK'));
    if (unack !== 0) return -unack;
    const prio = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (prio !== 0) return prio;
    return b.since - a.since;
  })[0];
}

/** Time (s) an alarm has been active-unacknowledged, or null. */
export function activeUnackSeconds(s: SimState, code: AlarmCode): number | null {
  const a = s.alarms.find((x) => x.code === code && x.status === 'ACTIVE_UNACK');
  return a ? s.time - a.since : null;
}
