/**
 * Fault library: injection, repair and effect ramps.
 * "Ramp" scales how strongly a fault's physical effect is felt, so faults
 * develop gradually instead of stepping instantly - operators must watch
 * trends, not single snapshots.
 */
import { emit } from './events';
import type { ActiveFault, FaultId, SimState } from './types';

export interface FaultMeta {
  id: FaultId;
  title: string;
  description: string;
  /** Learn-mode coaching hint about the typical symptom pattern. */
  symptom: string;
}

export const FAULT_LIBRARY: FaultMeta[] = [
  {
    id: 'FEED_JAM',
    title: 'Feed conveyor jam',
    description:
      'Foreign object wedges the intake conveyor. Feed collapses, the blend hopper keeps filling and the thresher starves.',
    symptom: 'Feed rate falls to zero while the hopper level rises.'
  },
  {
    id: 'COND_VALVE_STUCK',
    title: 'Conditioner steam valve stuck open',
    description:
      'The moisture-addition valve fails open. Outlet moisture climbs well above setpoint and threatens dryer loading and packed-spec.',
    symptom: 'Conditioner outlet moisture drifts up despite a fixed setpoint.'
  },
  {
    id: 'NTRM_SPIKE',
    title: 'NTRM contamination spike',
    description:
      'A contaminated leaf load arrives at intake. Non-tobacco related material rises far above the acceptance limit.',
    symptom: 'NTRM ppm trend steps up and keeps climbing.'
  },
  {
    id: 'DRYER_HEATER_FAULT',
    title: 'Dryer heater control failure',
    description:
      'Heater contactor welds closed. Dryer temperature runs away toward fire risk unless the line is e-stopped and repaired.',
    symptom: 'Dryer temperature keeps rising above setpoint; air-flow does not help.'
  },
  {
    id: 'SENSOR_DRIFT',
    title: 'Moisture analyser drift',
    description:
      'The inline moisture analyser drifts low. Displayed moisture looks fine while the real product gets wetter.',
    symptom: 'Display disagrees with lab sample; packed moisture creeps out of spec.'
  },
  {
    id: 'THRESHER_OVERLOAD',
    title: 'Thresher motor overload',
    description:
      'Mechanical overload builds on the thresher motor (worn cage, wet leaf). Load current rises toward the trip point.',
    symptom: 'Thresher load current trends up with normal feed and moisture.'
  }
];

export function faultMeta(id: FaultId): FaultMeta {
  return FAULT_LIBRARY.find((f) => f.id === id) as FaultMeta;
}

export function injectFault(s: SimState, id: FaultId): void {
  if (hasFault(s, id)) return;
  s.faults.push({ id, since: s.time, ramp: 0, cleared: false });
  emit(s, 'FAULT_INJECTED', 'warn', `Fault injected: ${faultMeta(id).title}.`);
}

/** Mark root cause repaired - physics decays the effect back out. */
export function repairFault(s: SimState, id: FaultId, message: string): boolean {
  const f = s.faults.find((x) => x.id === id);
  if (!f || f.cleared) return false;
  f.cleared = true;
  emit(s, 'FAULT_REPAIRED', 'good', message);
  return true;
}

export function hasFault(s: SimState, id: FaultId): boolean {
  return s.faults.some((f) => f.id === id && !f.cleared);
}

export function findFault(s: SimState, id: FaultId): ActiveFault | undefined {
  return s.faults.find((f) => f.id === id);
}

/** Advance the ramp of every active fault; drop fully-decayed repaired ones. */
export function tickFaults(s: SimState, dt: number, rampTimes: Record<FaultId, number>): void {
  for (const f of [...s.faults]) {
    const rt = rampTimes[f.id];
    if (!f.cleared) {
      f.ramp = Math.min(1, f.ramp + dt / rt);
    } else {
      f.ramp = Math.max(0, f.ramp - dt / rt);
      if (f.ramp === 0) {
        s.faults = s.faults.filter((x) => x !== f);
      }
    }
  }
}
