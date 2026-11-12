# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
semantic versioning.

## [0.1.0] — 2026-11-12

First complete release.

### Added

- Deterministic GLT line simulation engine (pure `step(state, dt)`, seeded RNG,
  fixed 10 Hz timestep, zero DOM access) covering intake/blending, conditioning,
  threshing, air separation, drying and packing.
- Fault library with gradual ramp-in: feed jam, stuck conditioner steam valve,
  NTRM spike, dryer heater runaway, moisture analyser drift, thresher motor
  overload; plus free-play fault injection for trainers.
- Prioritised alarm system (12 alarms, CRITICAL→LOW) with full
  active/ack/RTN lifecycle, global banner and a critical-unacknowledged watchdog.
- Safety layer: latching e-stop with twist-reset, guard interlock, complete
  LOTO state machine (isolate → lock → verify → remove) with critical-violation
  enforcement on body-in-equipment work.
- Six scenarios (S1–S6) across Learn (guided) and Assess (scored) modes with
  timed fault schedules, weighted checklists, hold timers and response-time
  capture.
- Four-category scoring (Safety 40 / Procedure 30 / Quality 20 / Response 10),
  critical auto-fail, per-attempt report with deductions and step detail.
- Competency framework: six skills rated 0–4 with certification dates and
  quiz gates (≥ 80 %) on Assess scenarios.
- Local-only records: versioned zod-validated schema with migrations, CSV
  export (RFC 4180, BOM, formula-injection safe), JSON backup/import, and a
  deterministic 12-trainee demo cohort with ~90 days of history.
- Trainer dashboard: cohort KPIs, accessible skill-matrix heatmap, watchlist,
  recertification flags, exports.
- Training pack: 5 SOPs, 3 OPLs, 3 quizzes from one data source; printable
  document view; quiz runner with explanations.
- Control-room HMI: SVG line mimic with live values and animated conveyors,
  arc gauges, sparkline trends, station control panels, alarm table, event log.
- Light/dark themes, keyboard e-stop hotkey (E), reduced-motion support.
- Verification pipeline: strict typecheck, ESLint (zero warnings), 34 Vitest
  tests (determinism, LOTO safety, alarm lifecycle, fault physics, scoring,
  CSV injection safety, schema migration, demo determinism), production build
  at ~116 KB JS gzip, headless-browser smoke.
- CI (verify gate) and GitHub Pages deploy workflows; full documentation set.
