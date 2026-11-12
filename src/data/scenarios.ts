/**
 * Scenario catalogue S1-S6. Each scenario is pure data plus small predicate
 * functions evaluated against the engine state/event journal - no engine
 * logic lives here, so scenarios can be authored by a training professional
 * without touching the simulator.
 *
 * Learn mode shows labels + hints; Assess mode hides them and scores.
 */
import type { AlarmCode, Scenario, SimState, StepCtx } from '../engine/types';

/* ---------------- predicate helpers ---------------- */

const acked = (ctx: StepCtx, code: AlarmCode) =>
  ctx.events.some((e) => e.kind === 'ALARM_ACK' && e.message.includes(code));

const hasEv = (ctx: StepCtx, kind: string) =>
  ctx.events.some((e) => e.kind === kind);

/** An event of `kindA` occurred after the LAST event of `kindB`. */
const after = (ctx: StepCtx, kindA: string, kindB: string) => {
  let lastB = -1;
  for (const e of ctx.events) if (e.kind === kindB && e.t > lastB) lastB = e.t;
  return ctx.events.some((e) => e.kind === kindA && e.t > lastB && lastB >= 0);
};

const num = (ctx: StepCtx, key: keyof SimState['inputs']) => ctx.s.inputs[key] as number;

const inRange = (ctx: StepCtx, key: keyof SimState['inputs'], lo: number, hi: number) => {
  const v = ctx.s.inputs[key];
  return typeof v === 'number' && v >= lo && v <= hi;
};

/** Wrap a plain state predicate as a StepCtx predicate (for hold-type steps). */
const holdWhen = (fn: (s: SimState) => boolean) => (ctx: StepCtx) => fn(ctx.s);

/* ------------------------------------------------------------------ */
/* S1 - Cold start & stabilisation                                     */
/* ------------------------------------------------------------------ */

const S1: Scenario = {
  id: 'S1',
  title: 'Cold Start & Line Stabilisation',
  difficulty: 'basic',
  durationSec: 420,
  modes: ['learn', 'assess'],
  skill: 'startup',
  requiredQuiz: 'quiz-process',
  brief:
    'The line has been down for maintenance. Bring it from OFF to stable production: purge, start each station in the correct order, set process targets and confirm product quality before packing.',
  objectives: [
    'Start the line following the correct station sequence',
    'Hold conditioner outlet moisture at 18.5-19.5%',
    'Stabilise packed moisture inside the 11.5-13.5% window',
    'Ramp feed to 3500-4500 kg/h without tripping the thresher'
  ],
  schedule: [],
  passMark: 70,
  steps: [
    {
      id: 'guard',
      label: 'Confirm all guards are closed',
      hint: 'Walk the line: every guard must show closed before you press start. The interlock will refuse a start otherwise.',
      weight: 1,
      done: (ctx) => !ctx.s.guardOpen
    },
    {
      id: 'start',
      label: 'Initiate the line start sequence',
      hint: 'Press LINE START. The 20-second purge and warm-up runs automatically.',
      weight: 2,
      done: (ctx) => hasEv(ctx, 'LINE_START')
    },
    {
      id: 'steam',
      label: 'Open conditioner steam and set moisture SP to 19%',
      hint: 'Conditioning first: steam on, moisture setpoint 19%. Leaf must be at threshing moisture before it reaches the cage.',
      weight: 2,
      done: (ctx) => ctx.s.inputs.steamOn && inRange(ctx, 'moistureSp', 18.5, 19.5)
    },
    {
      id: 'thresher',
      label: 'Start the thresher at 900-1000 rpm',
      hint: 'Thresher and air separator next. Nominal cage speed is 950 rpm.',
      weight: 2,
      done: (ctx) => ctx.s.inputs.thresherOn && inRange(ctx, 'thresherSpeedSp', 900, 1000)
    },
    {
      id: 'airsep',
      label: 'Start the air separator at 19-21 m/s',
      hint: 'Air velocity sets the lamina/stem split. Start near 20 m/s.',
      weight: 2,
      done: (ctx) => ctx.s.inputs.airSepOn && inRange(ctx, 'airVelocitySp', 19, 21)
    },
    {
      id: 'dryer',
      label: 'Start the dryer at 80-90 degC',
      hint: 'Dryer last, before any leaf reaches it: 85 degC is the standard profile.',
      weight: 2,
      done: (ctx) => ctx.s.inputs.dryerOn && inRange(ctx, 'dryerTempSp', 80, 90)
    },
    {
      id: 'feed',
      label: 'Enable feed and ramp to 3500-4500 kg/h',
      hint: 'Feed on, rate 4000 kg/h. Watch the hopper level and thresher load while the line fills.',
      weight: 2,
      done: (ctx) => ctx.s.inputs.feedEnabled && inRange(ctx, 'feedRateSp', 3500, 4500)
    },
    {
      id: 'stable',
      label: 'Hold stable operation for 60 s',
      hint: 'Stable = feed above 3000 kg/h, dryer 75-95 degC and packed moisture inside spec. Fix what drifts; do not just wait.',
      weight: 3,
      holdSec: 60,
      done: holdWhen(
        (s) =>
          s.pv.feedRate > 3000 &&
          s.pv.dryerTemp > 75 &&
          s.pv.dryerTemp < 95 &&
          s.pv.moistureOut >= 11.5 &&
          s.pv.moistureOut <= 13.5
      )
    },
    {
      id: 'pack',
      label: 'Start packing once moisture is in spec',
      hint: 'Only pack in-spec product. Packing starts AFTER moisture settles inside 11.5-13.5%.',
      weight: 3,
      done: (ctx) => ctx.s.inputs.packingOn && ctx.s.pv.moistureOut >= 11.5 && ctx.s.pv.moistureOut <= 13.5
    }
  ]
};

/* ------------------------------------------------------------------ */
/* S2 - Feed jam with full LOTO                                        */
/* ------------------------------------------------------------------ */

const S2: Scenario = {
  id: 'S2',
  title: 'Feed Jam Response & Safe Clearing',
  difficulty: 'intermediate',
  durationSec: 540,
  modes: ['learn', 'assess'],
  skill: 'loto',
  requiredQuiz: 'quiz-safety',
  brief:
    'You are running at 4000 kg/h when the intake conveyor jams. Respond to the alarm, make the equipment safe, clear the jam under full lockout-tagout and bring the line back.',
  objectives: [
    'Acknowledge and act on the feed jam alarm',
    'Stop feed and shut the line down',
    'Apply the complete LOTO sequence before touching the conveyor',
    'Clear the jam, restore and restart the line'
  ],
  schedule: [{ at: 90, fault: 'FEED_JAM' }],
  passMark: 70,
  steps: [
    {
      id: 'ack',
      label: 'Acknowledge the FEED_JAM alarm',
      hint: 'Acknowledge the alarm so the banner stops demanding attention, then act on it.',
      weight: 2,
      alarmCode: 'FEED_JAM',
      responseTarget: 30,
      done: (ctx) => acked(ctx, 'FEED_JAM')
    },
    {
      id: 'feedoff',
      label: 'Stop the feed',
      hint: 'Feed OFF first - no more leaf into a blocked path.',
      weight: 2,
      alarmCode: 'FEED_JAM',
      responseTarget: 60,
      done: (ctx) => !ctx.s.inputs.feedEnabled
    },
    {
      id: 'stop',
      label: 'Execute a normal line stop',
      hint: 'Normal stop, not e-stop: this is a process fault, not an emergency.',
      weight: 2,
      done: (ctx) => hasEv(ctx, 'LINE_STOP')
    },
    {
      id: 'isolate',
      label: 'Isolate all energy sources',
      hint: 'LOTO step 1: electrical main, steam header and instrument air isolated.',
      weight: 2,
      done: (ctx) => hasEv(ctx, 'LOTO_ISOLATE')
    },
    {
      id: 'lock',
      label: 'Apply your personal lock and tag',
      hint: 'LOTO step 2: lock it, tag it with your name.',
      weight: 2,
      done: (ctx) => hasEv(ctx, 'LOTO_LOCK')
    },
    {
      id: 'verify',
      label: 'Verify zero-energy state',
      hint: 'LOTO step 3: try-start the drives, confirm steam bled and air vented. Only then open the guard.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'LOTO_VERIFY')
    },
    {
      id: 'clear',
      label: 'Clear the jam',
      hint: 'Remove the foreign object and inspect the belt. This is only legal in VERIFIED state.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'JAM_CLEARED')
    },
    {
      id: 'unlock',
      label: 'Remove locks and restore energy',
      hint: 'LOTO step 4: tools and personnel clear, locks off, energy restored.',
      weight: 2,
      done: (ctx) => hasEv(ctx, 'LOTO_REMOVE')
    },
    {
      id: 'restart',
      label: 'Restart the line',
      hint: 'Back to STOPPED after lock removal - now start it.',
      weight: 2,
      done: (ctx) => after(ctx, 'LINE_START', 'LOTO_REMOVE')
    },
    {
      id: 'resume',
      label: 'Resume feed at 3500-4500 kg/h and hold 30 s',
      hint: 'Feed back on, watch the hopper drain to normal and the thresher recover.',
      weight: 2,
      holdSec: 30,
      done: holdWhen((s) => s.inputs.feedEnabled && s.pv.feedRate > 3000)
    }
  ]
};

/* ------------------------------------------------------------------ */
/* S3 - Conditioner over-moisture                                      */
/* ------------------------------------------------------------------ */

const S3: Scenario = {
  id: 'S3',
  title: 'Conditioner Over-Moisture Diagnosis',
  difficulty: 'intermediate',
  durationSec: 540,
  modes: ['learn', 'assess'],
  skill: 'faults',
  requiredQuiz: 'quiz-process',
  brief:
    'During stable production the conditioner steam valve fails open. Outlet moisture climbs toward the dryer. Diagnose, protect quality and product, repair under LOTO and restabilise.',
  objectives: [
    'Detect and acknowledge the over-moisture alarm',
    'Protect the dryer and product by cutting feed',
    'Repair the stuck valve under a verified LOTO',
    'Restabilise moisture within specification'
  ],
  schedule: [{ at: 60, fault: 'COND_VALVE_STUCK' }],
  passMark: 70,
  steps: [
    {
      id: 'ack',
      label: 'Acknowledge the COND_MOIST_HIGH alarm',
      hint: 'Acknowledge, then compare the moisture trend against setpoint - the gap keeps growing.',
      weight: 2,
      alarmCode: 'COND_MOIST_HIGH',
      responseTarget: 30,
      done: (ctx) => acked(ctx, 'COND_MOIST_HIGH')
    },
    {
      id: 'cutfeed',
      label: 'Cut feed back to 2500 kg/h or less',
      hint: 'Reduce load first: less wet leaf into the dryer while you work the problem.',
      weight: 2,
      alarmCode: 'COND_MOIST_HIGH',
      responseTarget: 120,
      done: (ctx) => num(ctx, 'feedRateSp') <= 2500
    },
    {
      id: 'stop',
      label: 'Stop the line for valve repair',
      hint: 'A stuck valve cannot be fixed while live. Normal stop.',
      weight: 2,
      done: (ctx) => hasEv(ctx, 'LINE_STOP')
    },
    {
      id: 'loto',
      label: 'Complete LOTO: isolate, lock, verify',
      hint: 'Full sequence - steam pressure is the hazard here. Verify zero energy before opening anything.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'LOTO_VERIFY')
    },
    {
      id: 'repair',
      label: 'Repair the steam valve',
      hint: 'Replace the actuator, stroke-test the valve. Requires VERIFIED state.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'VALVE_REPAIRED')
    },
    {
      id: 'restore',
      label: 'Remove locks and restart the line',
      hint: 'Locks off, energy restored, line started.',
      weight: 2,
      done: (ctx) => after(ctx, 'LINE_START', 'LOTO_REMOVE')
    },
    {
      id: 'steam',
      label: 'Steam on with moisture SP 18.5-19.5%',
      hint: 'Back to standard conditioning targets.',
      weight: 1,
      done: (ctx) => ctx.s.inputs.steamOn && inRange(ctx, 'moistureSp', 18.5, 19.5)
    },
    {
      id: 'restabilise',
      label: 'Bring outlet moisture back to 21% or below (hold 30 s)',
      hint: 'Watch the trend fall as the wet plug clears. Keep feed low until moisture is back in band.',
      weight: 2,
      holdSec: 30,
      done: holdWhen((s) => s.pv.moistureCond <= 21)
    },
    {
      id: 'fullrate',
      label: 'Return feed to 3500-4500 kg/h',
      hint: 'Quality restored - back to full rate.',
      weight: 2,
      done: (ctx) => inRange(ctx, 'feedRateSp', 3500, 4500)
    }
  ]
};

/* ------------------------------------------------------------------ */
/* S4 - NTRM contamination spike                                       */
/* ------------------------------------------------------------------ */

const S4: Scenario = {
  id: 'S4',
  title: 'NTRM Contamination Response',
  difficulty: 'basic',
  durationSec: 420,
  modes: ['learn', 'assess'],
  skill: 'quality',
  requiredQuiz: 'quiz-quality',
  brief:
    'A contaminated leaf load reaches intake and NTRM rockets past the acceptance limit. Stop the source, send in the sorting crew and protect packed product.',
  objectives: [
    'Acknowledge the NTRM alarm',
    'Stop the feed before the crew enters the intake area',
    'Run the sorting operation to completion',
    'Resume feed only once NTRM is back under the limit'
  ],
  schedule: [{ at: 45, fault: 'NTRM_SPIKE' }],
  passMark: 70,
  steps: [
    {
      id: 'ack',
      label: 'Acknowledge the NTRM_HIGH alarm',
      hint: 'Acknowledge, then check the NTRM trend - it is climbing fast.',
      weight: 2,
      alarmCode: 'NTRM_HIGH',
      responseTarget: 30,
      done: (ctx) => acked(ctx, 'NTRM_HIGH')
    },
    {
      id: 'feedoff',
      label: 'Stop the feed',
      hint: 'Nobody works at a running intake. Feed OFF first.',
      weight: 3,
      alarmCode: 'NTRM_HIGH',
      responseTarget: 60,
      done: (ctx) => !ctx.s.inputs.feedEnabled
    },
    {
      id: 'sort',
      label: 'Mobilise the sorting crew at intake',
      hint: 'SORT INTAKE action. The crew needs about 45 seconds; the feed must stay off.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'SORT_DONE')
    },
    {
      id: 'wait',
      label: 'Wait for NTRM to fall below 1500 ppm',
      hint: 'The trend decays once the contaminated pallets are segregated. Do not restart early.',
      weight: 2,
      done: (ctx) => ctx.s.pv.ntrm < 1500
    },
    {
      id: 'resume',
      label: 'Resume feed and hold NTRM below 1200 ppm for 30 s',
      hint: 'Feed back on; confirm the trend stays under control before declaring the line clean.',
      weight: 2,
      holdSec: 30,
      done: holdWhen((s) => s.inputs.feedEnabled && s.pv.ntrm < 1200)
    }
  ]
};

/* ------------------------------------------------------------------ */
/* S5 - Dryer over-temperature emergency                               */
/* ------------------------------------------------------------------ */

const S5: Scenario = {
  id: 'S5',
  title: 'Dryer Over-Temperature Emergency',
  difficulty: 'advanced',
  durationSec: 480,
  modes: ['learn', 'assess'],
  skill: 'emergency',
  requiredQuiz: 'quiz-safety',
  brief:
    'The dryer heater contactor welds closed and temperature runs away toward fire risk. This is the emergency every operator must get right: e-stop, isolate, repair, safe restart.',
  objectives: [
    'Acknowledge the temperature alarms immediately',
    'Actuate the emergency stop before the critical threshold',
    'Repair the heater under a verified LOTO',
    'Restart with a safe temperature setpoint'
  ],
  schedule: [{ at: 70, fault: 'DRYER_HEATER_FAULT' }],
  passMark: 75,
  lateEstop: { alarmCode: 'DRYER_TEMP_CRIT', withinSec: 45, deduct: 25 },
  steps: [
    {
      id: 'ackhigh',
      label: 'Acknowledge the DRYER_TEMP_HIGH alarm',
      hint: 'Temperature above 100 degC is already serious. Acknowledge and prepare.',
      weight: 2,
      alarmCode: 'DRYER_TEMP_HIGH',
      responseTarget: 15,
      done: (ctx) => acked(ctx, 'DRYER_TEMP_HIGH')
    },
    {
      id: 'estop',
      label: 'EMERGENCY STOP the line',
      hint: 'A runaway dryer is a fire risk. E-STOP, do not chase the setpoint.',
      weight: 4,
      alarmCode: 'DRYER_TEMP_CRIT',
      responseTarget: 45,
      done: (ctx) => hasEv(ctx, 'ESTOP_PRESS')
    },
    {
      id: 'resetestop',
      label: 'Reset the e-stop (guard closed)',
      hint: 'After the trip: twist-release the e-stop once the guard is closed. The line lands in STOPPED.',
      weight: 2,
      done: (ctx) => hasEv(ctx, 'ESTOP_RESET')
    },
    {
      id: 'loto',
      label: 'Complete LOTO: isolate, lock, verify',
      hint: 'Electrical energy is the hazard. Full sequence before opening panels.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'LOTO_VERIFY')
    },
    {
      id: 'repair',
      label: 'Repair the dryer heater',
      hint: 'Replace the welded contactor. VERIFIED state only.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'HEATER_REPAIRED')
    },
    {
      id: 'unlock',
      label: 'Remove locks',
      hint: 'Work complete: locks off, energy restored.',
      weight: 1,
      done: (ctx) => hasEv(ctx, 'LOTO_REMOVE')
    },
    {
      id: 'restart',
      label: 'Restart the line',
      hint: 'Start the line - the dryer is still hot from the fault, it will cool toward setpoint.',
      weight: 2,
      done: (ctx) => after(ctx, 'LINE_START', 'LOTO_REMOVE')
    },
    {
      id: 'safe',
      label: 'Bring the dryer back to 75-95 degC (hold 30 s)',
      hint: 'Confirm the temperature settles inside the safe band; adjust the setpoint if needed.',
      weight: 2,
      holdSec: 30,
      done: holdWhen((s) => s.pv.dryerTemp > 75 && s.pv.dryerTemp < 95)
    }
  ]
};

/* ------------------------------------------------------------------ */
/* S6 - Moisture analyser drift                                        */
/* ------------------------------------------------------------------ */

const S6: Scenario = {
  id: 'S6',
  title: 'Moisture Analyser Drift Diagnosis',
  difficulty: 'advanced',
  durationSec: 600,
  modes: ['learn', 'assess'],
  skill: 'quality',
  requiredQuiz: 'quiz-quality',
  brief:
    'The inline moisture analyser starts drifting low: the display looks healthy while real moisture creeps up. Trust nothing without verification - cross-check, switch to the reference and schedule recalibration.',
  objectives: [
    'Notice the analyser self-check failure',
    'Take a lab sample to quantify the divergence',
    'Switch control to the reference analyser',
    'Recalibrate the faulty analyser and return to auto'
  ],
  schedule: [{ at: 120, fault: 'SENSOR_DRIFT' }],
  passMark: 70,
  steps: [
    {
      id: 'ack',
      label: 'Acknowledge the SENSOR_DEV alarm',
      hint: 'The analyser flagged its own self-check. Acknowledge it and start verifying.',
      weight: 2,
      alarmCode: 'SENSOR_DEV',
      responseTarget: 60,
      done: (ctx) => acked(ctx, 'SENSOR_DEV')
    },
    {
      id: 'sample',
      label: 'Take a lab sample and compare with the display',
      hint: 'The lab value is the truth. A growing display-vs-lab gap means the sensor, not the process, is wrong.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'SAMPLE_RESULT')
    },
    {
      id: 'ref',
      label: 'Switch moisture control to the reference analyser',
      hint: 'SENSOR MODE -> reference. Control on the trusted signal while the inline unit is suspect.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'SENSOR_MODE_REF')
    },
    {
      id: 'hold',
      label: 'Hold true moisture in band for 60 s',
      hint: 'With the reference in control and SP at 19%, the real moisture settles. Do not chase the display!',
      weight: 2,
      holdSec: 60,
      done: holdWhen((s) => s.pv.moistureCond >= 18 && s.pv.moistureCond <= 20)
    },
    {
      id: 'stop',
      label: 'Stop the line for analyser recalibration',
      hint: 'Instrument work needs the line down. Normal stop.',
      weight: 2,
      done: (ctx) => hasEv(ctx, 'LINE_STOP')
    },
    {
      id: 'recal',
      label: 'Recalibrate the inline analyser',
      hint: 'RECAL SENSOR action (line stopped). Calibration against the lab reference.',
      weight: 3,
      done: (ctx) => hasEv(ctx, 'SENSOR_RECAL')
    },
    {
      id: 'back',
      label: 'Restart and return the analyser to auto mode',
      hint: 'Line started, sensor mode back to AUTO with the unit freshly calibrated.',
      weight: 2,
      done: (ctx) => after(ctx, 'SENSOR_MODE_AUTO', 'SENSOR_RECAL') && after(ctx, 'LINE_START', 'SENSOR_RECAL')
    },
    {
      id: 'final',
      label: 'Hold stable production for 60 s',
      hint: 'Feed on, moisture in band, everything steady - the shift is yours.',
      weight: 2,
      holdSec: 60,
      done: holdWhen(
        (s) => s.inputs.feedEnabled && s.pv.feedRate > 3000 && s.pv.moistureCond >= 18 && s.pv.moistureCond <= 20
      )
    }
  ]
};

export const SCENARIOS: Scenario[] = [S1, S2, S3, S4, S5, S6];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
