/**
 * Engine tests: determinism, line state machine, e-stop, guard interlock,
 * LOTO safety, jam lifecycle, alarm lifecycle, motor trip and sensor drift.
 */
import { describe, expect, it } from 'vitest';
import { createInitialState, dispatch, step } from '../index';
import { DT } from '../constants';
import type { SimAction, SimState } from '../types';

/** Apply one action (dispatch + a single step so it takes effect). */
function act(s: SimState, a: SimAction): SimState {
  return step(dispatch(s, a), DT);
}

/** Advance `sec` simulated seconds. */
function run(s: SimState, sec: number): SimState {
  let out = s;
  const n = Math.round(sec / DT);
  for (let i = 0; i < n; i++) out = step(out, DT);
  return out;
}

/** Start the line and return the state once RUNNING. */
function startLine(seed: number): SimState {
  let s = act(createInitialState(seed), { type: 'LINE_START' });
  s = run(s, 22);
  return s;
}

describe('determinism', () => {
  it('same seed + same actions replay identically', () => {
    const script = (s: SimState): SimState => {
      let out = act(s, { type: 'LINE_START' });
      out = act(out, { type: 'SET', key: 'feedEnabled', value: true });
      out = act(out, { type: 'SET', key: 'dryerOn', value: true });
      return run(out, 50);
    };
    const a = script(createInitialState(1234));
    const b = script(createInitialState(1234));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds produce different runs', () => {
    const a = run(createInitialState(1), 5);
    const b = run(createInitialState(2), 5);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe('line state machine & e-stop', () => {
  it('start sequence completes and reports RUNNING', () => {
    const s = startLine(7);
    expect(s.lineState).toBe('RUNNING');
    expect(s.events.some((e) => e.kind === 'START_COMPLETE')).toBe(true);
  });

  it('e-stop latches, then resets to STOPPED', () => {
    let s = startLine(7);
    s = act(s, { type: 'ESTOP_PRESS' });
    expect(s.eStop).toBe(true);
    expect(s.lineState).toBe('ESTOP');
    s = act(s, { type: 'ESTOP_RESET' });
    expect(s.eStop).toBe(false);
    expect(s.lineState).toBe('STOPPED');
  });

  it('start is blocked with the guard open', () => {
    let s = createInitialState(8);
    s = act(s, { type: 'GUARD_OPEN' });
    s = act(s, { type: 'LINE_START' });
    expect(s.lineState).toBe('OFF');
    expect(s.events.some((e) => e.kind === 'START_BLOCKED')).toBe(true);
  });

  it('opening the guard while running auto-stops the line', () => {
    let s = startLine(9);
    s = act(s, { type: 'GUARD_OPEN' });
    expect(s.lineState).toBe('STOPPED');
    expect(s.events.some((e) => e.kind === 'GUARD_INTERLOCK' && e.severity === 'bad')).toBe(true);
    s = act(s, { type: 'GUARD_CLOSE' });
    s = run(act(s, { type: 'LINE_START' }), 21);
    expect(s.lineState).toBe('RUNNING');
  });
});

describe('LOTO', () => {
  it('full sequence isolates, locks, verifies and restores', () => {
    let s = startLine(11);
    // Isolation refused while running.
    s = act(s, { type: 'LOTO_ISOLATE' });
    expect(s.loto).toBe('NONE');
    s = act(s, { type: 'LINE_STOP' });
    s = act(s, { type: 'LOTO_ISOLATE' });
    expect(s.loto).toBe('ISOLATED');
    expect(s.lineState).toBe('MAINTENANCE');
    s = act(s, { type: 'LOTO_LOCK' });
    expect(s.loto).toBe('LOCKED');
    s = act(s, { type: 'LOTO_VERIFY' });
    expect(s.loto).toBe('VERIFIED');
    // Line cannot start while locked out.
    s = act(s, { type: 'LINE_START' });
    expect(s.lineState).toBe('MAINTENANCE');
    s = act(s, { type: 'LOTO_REMOVE' });
    expect(s.loto).toBe('NONE');
    expect(s.lineState).toBe('STOPPED');
  });

  it('clearing a jam without a verified LOTO is a critical violation', () => {
    let s = createInitialState(12);
    s = act(s, { type: 'INJECT_FAULT', fault: 'FEED_JAM' });
    s = act(s, { type: 'LOTO_ISOLATE' }); // isolated but NOT verified
    s = act(s, { type: 'CLEAR_JAM' });
    const violation = s.events.find((e) => e.kind === 'LOTO_VIOLATION');
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe('critical');
    // Jam not cleared.
    expect(s.faults.some((f) => f.id === 'FEED_JAM' && !f.cleared)).toBe(true);
  });
});

describe('feed jam lifecycle', () => {
  it('jam collapses feed, raises hopper and alarm; LOTO clear restores it', () => {
    let s = startLine(13);
    s = act(s, { type: 'SET', key: 'feedEnabled', value: true });
    s = run(s, 30);
    expect(s.pv.feedRate).toBeGreaterThan(1000);

    s = act(s, { type: 'INJECT_FAULT', fault: 'FEED_JAM' });
    s = run(s, 30);
    expect(s.pv.feedRate).toBeLessThan(300);
    expect(s.pv.hopperLevel).toBeGreaterThan(72);
    expect(s.alarms.some((a) => a.code === 'FEED_JAM')).toBe(true);

    s = act(s, { type: 'LINE_STOP' });
    s = act(s, { type: 'LOTO_ISOLATE' });
    s = act(s, { type: 'LOTO_LOCK' });
    s = act(s, { type: 'LOTO_VERIFY' });
    s = act(s, { type: 'CLEAR_JAM' });
    expect(s.events.some((e) => e.kind === 'JAM_CLEARED')).toBe(true);
    s = act(s, { type: 'LOTO_REMOVE' });
    s = run(act(s, { type: 'LINE_START' }), 22);
    s = run(s, 45);
    expect(s.pv.feedRate).toBeGreaterThan(1000);
  });
});

describe('alarms', () => {
  it('dryer temperature alarm raises, acks, clears and leaves the list', () => {
    let s = startLine(21);
    s = act(s, { type: 'SET', key: 'dryerOn', value: true });
    s = act(s, { type: 'SET', key: 'dryerTempSp', value: 110 });
    s = run(s, 120);
    expect(s.pv.dryerTemp).toBeGreaterThan(100);
    expect(s.alarms.find((a) => a.code === 'DRYER_TEMP_HIGH')?.status).toBe('ACTIVE_UNACK');

    s = act(s, { type: 'ACK_ALARM', code: 'DRYER_TEMP_HIGH' });
    expect(s.alarms.find((a) => a.code === 'DRYER_TEMP_HIGH')?.status).toBe('ACTIVE_ACK');

    s = act(s, { type: 'SET', key: 'dryerTempSp', value: 60 });
    s = run(s, 100);
    expect(s.alarms.find((a) => a.code === 'DRYER_TEMP_HIGH')?.status).toBe('CLEARED_UNACK');

    s = act(s, { type: 'ACK_ALARM', code: 'DRYER_TEMP_HIGH' });
    expect(s.alarms.find((a) => a.code === 'DRYER_TEMP_HIGH')).toBeUndefined();
  });
});

describe('thresher overload', () => {
  it('ramps load, trips the motor and resets only with the line stopped', () => {
    let s = startLine(33);
    s = act(s, { type: 'SET', key: 'thresherOn', value: true });
    s = act(s, { type: 'SET', key: 'feedEnabled', value: true });
    s = run(s, 30);
    s = act(s, { type: 'INJECT_FAULT', fault: 'THRESHER_OVERLOAD' });
    s = run(s, 180);
    expect(s.inputs.thresherOn).toBe(false);
    expect(s.events.some((e) => e.kind === 'MOTOR_TRIP')).toBe(true);

    // Reset refused while running.
    s = act(s, { type: 'RESET_MOTOR' });
    expect(s.events.some((e) => e.kind === 'MOTOR_RESET')).toBe(false);

    s = act(s, { type: 'LINE_STOP' });
    s = act(s, { type: 'RESET_MOTOR' });
    expect(s.events.some((e) => e.kind === 'MOTOR_RESET')).toBe(true);
  });
});

describe('NTRM spike and sorting', () => {
  it('sorting is blocked while feeding, then clears the spike', () => {
    let s = startLine(41);
    s = act(s, { type: 'SET', key: 'feedEnabled', value: true });
    s = run(s, 10);
    s = act(s, { type: 'INJECT_FAULT', fault: 'NTRM_SPIKE' });
    s = run(s, 70);
    expect(s.pv.ntrm).toBeGreaterThan(1500);

    s = act(s, { type: 'SORT_INTAKE' });
    expect(s.events.some((e) => e.kind === 'SORT_BLOCKED')).toBe(true);

    s = act(s, { type: 'SET', key: 'feedEnabled', value: false });
    s = act(s, { type: 'SORT_INTAKE' });
    expect(s.maintenance).not.toBeNull();
    s = run(s, 120);
    expect(s.events.some((e) => e.kind === 'SORT_DONE')).toBe(true);
    expect(s.pv.ntrm).toBeLessThan(1500);
  });
});

describe('sensor drift', () => {
  it('drifted analyser raises SENSOR_DEV and disagrees with the lab sample', () => {
    let s = startLine(51);
    s = act(s, { type: 'SET', key: 'steamOn', value: true });
    s = run(s, 60);
    s = act(s, { type: 'INJECT_FAULT', fault: 'SENSOR_DRIFT' });
    s = run(s, 150);
    expect(Math.abs(s.sensorBias)).toBeGreaterThan(1.2);
    expect(s.alarms.some((a) => a.code === 'SENSOR_DEV')).toBe(true);
    const truth = s.pv.moistureCond;
    expect(s.pv.moistureReading).toBeLessThan(truth - 1);
    s = act(s, { type: 'TAKE_SAMPLE' });
    const sample = s.events.filter((e) => e.kind === 'SAMPLE_RESULT').pop();
    expect(sample).toBeDefined();
    // Reference mode shows the truth.
    s = act(s, { type: 'SENSOR_MODE', mode: 'reference' });
    expect(s.pv.moistureReading).toBeCloseTo(truth, 1);
  });
});
