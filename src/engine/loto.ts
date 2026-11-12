/**
 * Lockout-Tagout (LOTO) energy-isolation state machine.
 *
 * Legal sequence:  NONE -> ISOLATED -> LOCKED -> VERIFIED -> (work)
 *                  VERIFIED -> REMOVE -> NONE
 *
 * Hard safety rule: any body-in-equipment maintenance action (clearing a
 * jam, repairing the steam valve or the dryer heater) is only legal in
 * VERIFIED. Doing it earlier emits a LOTO_VIOLATION critical event, which
 * auto-fails the exercise.
 */
import type { SimState } from './types';
import { emit } from './events';

export type LotoAction = 'ISOLATE' | 'LOCK' | 'VERIFY' | 'REMOVE';

export function lotoTransition(s: SimState, action: LotoAction): void {
  switch (action) {
    case 'ISOLATE':
      if (s.loto !== 'NONE') {
        emit(s, 'LOTO_ISOLATE', 'warn', 'Energy sources are already isolated.');
        return;
      }
      if (s.lineState !== 'STOPPED' && s.lineState !== 'OFF') {
        emit(
          s,
          'LOTO_ISOLATE',
          'warn',
          'Isolation refused: shut the line down before isolating energy sources.'
        );
        return;
      }
      s.loto = 'ISOLATED';
      s.lineState = 'MAINTENANCE';
      emit(
        s,
        'LOTO_ISOLATE',
        'info',
        'Energy sources isolated: electrical main, steam header and instrument air cut.'
      );
      return;

    case 'LOCK':
      if (s.loto !== 'ISOLATED') {
        emit(s, 'LOTO_LOCK', 'warn', 'Apply lock & tag only after energy isolation.');
        return;
      }
      s.loto = 'LOCKED';
      emit(s, 'LOTO_LOCK', 'info', 'Personal lock and danger tag applied.');
      return;

    case 'VERIFY':
      if (s.loto !== 'LOCKED') {
        emit(s, 'LOTO_VERIFY', 'warn', 'Zero-energy verification requires a lock in place.');
        return;
      }
      s.loto = 'VERIFIED';
      emit(
        s,
        'LOTO_VERIFY',
        'good',
        'Zero-energy state verified: motors de-energised, steam lines bled, air vented.'
      );
      return;

    case 'REMOVE':
      if (s.loto === 'NONE') return;
      s.loto = 'NONE';
      s.lineState = 'STOPPED';
      emit(s, 'LOTO_REMOVE', 'info', 'Locks removed, energy restored to a safe-to-start state.');
      return;
  }
}

/**
 * True when physical work inside equipment is legal.
 * If not, calling this emits the critical violation (auto-fail).
 */
export function requireVerifiedForWork(s: SimState, work: string): boolean {
  if (s.loto === 'VERIFIED') return true;
  emit(
    s,
    'LOTO_VIOLATION',
    'critical',
    `SAFETY VIOLATION: ${work} attempted with live equipment (LOTO not verified).`
  );
  return false;
}

/** Can the line be started right now? Returns a blocking reason or null. */
export function startBlockReason(s: SimState): string | null {
  if (s.eStop) return 'Emergency stop is latched - reset it first';
  if (s.guardOpen) return 'A guard is open';
  if (s.loto !== 'NONE') return 'Line is locked out for maintenance';
  if (s.lineState === 'RUNNING' || s.lineState === 'STARTING') return 'Line already started';
  return null;
}
