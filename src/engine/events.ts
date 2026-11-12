/**
 * Tiny event journal helpers. Events drive the operator log AND grading:
 * scorers replay them looking for alarm raises, acknowledgements, e-stops
 * and LOTO steps. Keeping them in the (cloned) state preserves determinism.
 */
import { EVENT_LOG_MAX } from './constants';
import type { EventSeverity, SimEvent, SimState } from './types';

export function emit(
  s: SimState,
  kind: string,
  severity: EventSeverity,
  message: string
): SimEvent {
  const ev: SimEvent = { id: ++s.eventId, t: s.time, kind, severity, message };
  s.events.push(ev);
  if (s.events.length > EVENT_LOG_MAX) {
    s.events.splice(0, s.events.length - EVENT_LOG_MAX);
  }
  return ev;
}

/** All events of a kind since sim-time `from` (inclusive). */
export function eventsSince(s: SimState, kind: string, from = 0): SimEvent[] {
  return s.events.filter((e) => e.kind === kind && e.t >= from);
}

/** True if an event of this kind exists at or after `from`. */
export function hasEvent(s: SimState, kind: string, from = 0): boolean {
  return s.events.some((e) => e.kind === kind && e.t >= from);
}

/** Last event of a kind at/after `from`, or null. */
export function lastEvent(s: SimState, kind: string, from = 0): SimEvent | null {
  let out: SimEvent | null = null;
  for (const e of s.events) {
    if (e.kind === kind && e.t >= from) out = e;
  }
  return out;
}
