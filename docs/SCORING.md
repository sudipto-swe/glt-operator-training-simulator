# Scoring & Competency Model

## The 0–100 score (Assess mode)

| Category | Points | Source |
| --- | --- | --- |
| Safety | 40 | Event journal deductions; critical violations zero it out |
| Procedure | 30 | Weighted checklist completion |
| Quality | 20 | Packing model in-spec ratio |
| Response | 10 | Alarm → correct-action latency on key steps |

**Pass** = total ≥ scenario pass mark (70 default; S5 uses 75) **and** no critical violation.

### Safety (40)

Starts at 40; deductions (journaled, itemised in the report):

| Event | Deduction |
| --- | --- |
| Guard opened while running (`GUARD_INTERLOCK`) | −15 (first occurrence) |
| Start attempt blocked by an interlock (`START_BLOCKED`) | −3 (max 2) |
| Critical alarm unacknowledged 60 s (`CRITICAL_UNACK:*`) | −5 (max 2) |
| Late e-stop (scenario rule, e.g. S5: no e-stop within 45 s of `DRYER_TEMP_CRIT`) | −25 (rule-defined) |

**Critical violations** (auto-fail, safety = 0):

- `LOTO_VIOLATION` — body-in-equipment work (clearing a jam, valve or heater repair) without a VERIFIED zero-energy state.
- `FIRE_RISK` — dryer reached 130 °C.

### Procedure (30)

Each checklist step carries a weight (1–4, safety-critical steps weigh more). Score = 30 × (done weight / total weight). Steps with `holdSec` must hold their condition for the full duration — stability cannot be bluffed.

### Quality (20)

The engine accumulates packed kilograms and out-of-spec kilograms (moisture outside 11.5–13.5 %, stem > 4 %, NTRM > 1500 ppm, dryer > 100 °C). Score = 20 × min(1, inSpec% × 1.25) — i.e. 80 % in-spec product earns full points. Runs with < 100 kg packed score a neutral 12/20 (insufficient production to judge).

### Response (10)

Steps carrying `alarmCode` + `responseTarget` measure the time from the alarm's most recent raise to step completion. Per step: `clamp(target / actual, 0, 1)`; the category is the average × 10. A step never completed scores 0 for response.

## Learn mode

Un-scored by design. The report shows checklist completion % and per-step ✓/✗ with hints — practice without grade anxiety. Attempts are still recorded (mode `learn`, score null) so the trainer dashboard shows practice volume.

## Quiz gates

Each scenario requires its module quiz (≥ 80 %) before Assess unlocks:

| Quiz | Gates |
| --- | --- |
| Safety & LOTO (8 questions) | S2, S5 |
| Process Fundamentals (8 questions) | S1, S3 |
| Quality & Response (8 questions) | S4, S6 |

Quiz attempts are recorded (mode `quiz`) and passes are stamped on the trainee profile.

## Skills 0–4

Six observable skills: `startup`, `faults`, `loto`, `quality`, `emergency`, `records`. Each scenario maps to one primary skill. An assess attempt converts its score to a level:

| Score | Level | Name |
| --- | --- | --- |
| ≥ 90 | 4 | Coach / trainer |
| ≥ 75 | 3 | Independent operation |
| ≥ 60 | 2 | Basic operation |
| ≥ 45 | 1 | Supervised practice |
| < 45 | 0 | Awareness |

Skill levels only ever **rise** (highest-valid-evidence model) and carry a `lastCert` date. Levels 2+ with a certification older than 12 months (due within 30 days) are flagged `*` on the trainer heatmap and counted in the recert KPI.

## Where it is computed

`src/engine/scoring.ts` (`computeScore`, `qualityScore`, `levelFromScore`) — pure functions over the event journal + scenario runtime, unit-tested in `src/engine/__tests__/scoring.test.ts`.
