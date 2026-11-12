/**
 * Tunable process constants for the simplified GLT line model.
 * Values are deliberately "plausible for a primary tobacco processing
 * facility" rather than calibrated to any real plant. They are collected
 * here so a process engineer can retune the model without touching logic.
 */

/** Fixed engine timestep (s). The UI ticks 10x per second. */
export const DT = 0.1;

/** Sim seconds between trend samples (~8 min of history kept). */
export const TREND_INTERVAL = 2;
export const TREND_MAX = 240;

export const EVENT_LOG_MAX = 600;

/** STARTING phase length (s) - purge and warm-up. */
export const START_DURATION = 20;

/* Intake / blending ------------------------------------------------ */
export const FEED_MIN = 500;
export const FEED_MAX = 8000;
export const HOPPER_NORMAL = 72; // % tipper control target
export const HOPPER_HIGH = 90; // alarm threshold
export const HOPPER_HIGH_CLEAR = 85;
export const HOPPER_JAM_RISE = 8 / 60; // %/s while feed path is jammed
export const HOPPER_DRAIN = 12 / 60; // %/s when line runs without feed
export const FEED_TAU = 8; // first-order lag (s)

/* Conditioning ---------------------------------------------------- */
export const MOIST_IN_BASE = 16.2; // % moisture of cased leaf
export const MOIST_SP_MIN = 15;
export const MOIST_SP_MAX = 24;
export const COND_TAU = 25; // moisture response lag (s)
export const VALVE_BIAS_MAX = 6; // % over-moisture when valve stuck open
export const VALVE_RAMP_TIME = 150; // s to reach VALVE_BIAS_MAX
export const MOIST_HIGH = 21.5; // conditioner outlet high-alarm threshold
export const MOIST_HIGH_CLEAR = 21;
export const MOIST_LOW = 17;
export const MOIST_LOW_CLEAR = 17.5;

/* Threshing + air separation --------------------------------------- */
export const THRESHER_SPEED_MIN = 600;
export const THRESHER_SPEED_MAX = 1200;
export const THRESHER_TAU = 4;
export const CURRENT_TAU = 2;
export const CURRENT_TRIP = 115; // % load where the motor protection trips
export const CURRENT_TRIP_DELAY = 30; // s above trip level before tripping
export const CURRENT_ALARM = 105;
export const CURRENT_ALARM_CLEAR = 100;
export const OVERLOAD_RAMP_MAX = 55; // extra % load from THRESHER_OVERLOAD fault
export const AIR_VEL_MIN = 14;
export const AIR_VEL_MAX = 26;
export const AIR_TAU = 3;
export const AIR_OPTIMAL = 20; // m/s sweet spot for lamina/stem split
export const AIR_DEV_ALARM = 3; // m/s deviation while running -> alarm

/* Drying ----------------------------------------------------------- */
export const DRYER_TEMP_SP_MIN = 60;
export const DRYER_TEMP_SP_MAX = 110;
export const DRYER_TAU = 35;
export const AMBIENT = 35; // degC when dryer off
export const DRYER_HIGH = 100; // high alarm
export const DRYER_HIGH_CLEAR = 95;
export const DRYER_CRIT = 115; // critical alarm - fire risk begins
export const DRYER_CRIT_CLEAR = 108;
export const DRYER_FIRE = 130; // fire-risk event: scenario auto-fail
export const HEATER_RAMP_MAX = 40; // degC runaway offset
export const HEATER_RAMP_TIME = 120;
export const DRYER_MOIST_TAU = 20;
/** Moisture removed per degC of dryer temperature above 40 degC. */
export const DRY_MOIST_COEF = 0.145;
export const PACK_MOIST_MIN = 11.5; // packed product spec window
export const PACK_MOIST_MAX = 13.5;

/* NTRM --------------------------------------------------------------- */
export const NTRM_BASE = 650;
export const NTRM_SPIKE_TARGET = 4200; // ppm with the spike fault active
export const NTRM_TAU = 20;
export const NTRM_ALARM = 1500;
export const NTRM_ALARM_CLEAR = 1200;
export const NTRM_CLEAR_AFTER_SORT = 60; // s decay once source sorted out
export const SORT_DURATION = 45; // s the sorting crew needs

/* Moisture analyser -------------------------------------------------- */
export const SENSOR_BIAS_MAX = -3.2; // % (drifts LOW - reads drier than truth)
export const SENSOR_RAMP_TIME = 240;
export const SENSOR_DEV_ALARM = 1.2; // self-diagnostic divergence alarm
export const SENSOR_DEV_CLEAR = 0.9;
export const SAMPLE_FRESH = 60; // s a lab sample stays "fresh" in the HMI

/* Quality model ------------------------------------------------------ */
export const CASE_TARGET = 200; // kg per packed case
export const LAMINA_YIELD = 0.85; // lamina fraction of feed that gets packed
export const STEM_SPEC = 4; // % max acceptable stem in lamina

/* Scoring ----------------------------------------------------------- */
export const PASS_MARK_DEFAULT = 70;
export const SAFETY_MAX = 40;
export const PROCEDURE_MAX = 30;
export const QUALITY_MAX = 20;
export const RESPONSE_MAX = 10;
