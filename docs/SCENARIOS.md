# Scenario Catalogue

All six scenarios are available in **Learn** (guided, un-scored, hints visible) and **Assess** (no hints, scored, quiz-gated) modes. Faults are injected on a fixed schedule at 1x speed; scenario seeds are deterministic per scenario ID.

| ID | Title | Difficulty | Duration | Primary skill | Gate |
| --- | --- | --- | --- | --- | --- |
| S1 | Cold Start & Line Stabilisation | basic | 7 min | startup | Process Fundamentals quiz |
| S2 | Feed Jam Response & Safe Clearing | intermediate | 9 min | loto | Safety & LOTO quiz |
| S3 | Conditioner Over-Moisture Diagnosis | intermediate | 9 min | faults | Process Fundamentals quiz |
| S4 | NTRM Contamination Response | basic | 7 min | quality | Quality & Response quiz |
| S5 | Dryer Over-Temperature Emergency | advanced | 8 min | emergency | Safety & LOTO quiz |
| S6 | Moisture Analyser Drift Diagnosis | advanced | 10 min | quality | Quality & Response quiz |

---

## S1 — Cold Start & Line Stabilisation

**Brief.** The line has been down for maintenance. Bring it from OFF to stable production.

**Fault schedule.** None — this is the process-sequencing baseline.

**Key steps.** Guards confirmed → line start (20 s purge) → steam + 19 % moisture SP → thresher 900–1000 rpm → air separator 19–21 m/s → dryer 80–90 °C → feed 3500–4500 kg/h → hold stable 60 s (feed > 3000, dryer 75–95 °C, packed moisture in spec) → packing starts **after** moisture settles.

**Grading notes.** Order matters (procedure weights); packing before moisture is in band is the classic mistake this scenario catches. A hold-timer requires genuinely stable operation, not a passing glance.

## S2 — Feed Jam Response & Safe Clearing

**Brief.** At t+90 s the intake conveyor jams. Respond, make the equipment safe, clear the jam under full LOTO, restart.

**Fault schedule.** `FEED_JAM` at 90 s (ramps in over 5 s: feed collapses, hopper rises, HIGH alarm).

**Key steps.** Ack (≤ 30 s) → stop feed (≤ 60 s) → normal stop → isolate → lock → **verify zero energy** → clear jam → remove locks → restart → resume feed, hold 30 s.

**Grading notes.** The centre of the LOTO skill. Clearing the jam with anything less than `VERIFIED` is an auto-fail critical. E-stop here is the *wrong* tool (process fault, not an emergency) — it is not penalised, but the normal-stop path is what the checklist rewards.

## S3 — Conditioner Over-Moisture Diagnosis

**Brief.** At t+60 s the steam valve sticks open. Outlet moisture climbs toward the dryer.

**Fault schedule.** `COND_VALVE_STUCK` at 60 s (bias ramps to +6 % over 150 s).

**Key steps.** Ack (≤ 30 s) → cut feed ≤ 2500 kg/h (≤ 120 s) to protect the dryer → stop → full LOTO → repair valve → restore → steam + 19 % SP → moisture back ≤ 21 % (hold 30 s) → full feed.

**Grading notes.** The diagnosis skill: the setpoint-vs-trend gap keeps growing while the SP sits still. Quality accumulates penalties once wet product reaches packing; fast feed reduction is what protects the score.

## S4 — NTRM Contamination Response

**Brief.** At t+45 s a contaminated lot spikes NTRM past the acceptance limit.

**Fault schedule.** `NTRM_SPIKE` at 45 s (trend ramps to ~4200 ppm).

**Key steps.** Ack (≤ 30 s) → **stop feed first** (≤ 60 s) → SORT INTAKE (crew needs 45 s; feed must stay off — the action is refused otherwise) → wait for NTRM < 1500 → resume, hold < 1200 for 30 s.

**Grading notes.** The safety-culture test hidden in a quality scenario: nobody works a running intake. Sorting with the feed on is refused and journaled.

## S5 — Dryer Over-Temperature Emergency

**Brief.** At t+70 s the heater contactor welds closed. Temperature runs away toward fire risk.

**Fault schedule.** `DRYER_HEATER_FAULT` at 70 s (target climbs +40 °C over 120 s).

**Key steps.** Ack HIGH alarm (≤ 15 s) → **e-stop within 45 s of the CRITICAL alarm** → reset e-stop → full LOTO → repair heater → remove locks → restart → dryer settles 75–95 °C (hold 30 s).

**Grading notes.** The late-e-stop rule is explicit: no e-stop (or a late one) within 45 s of `DRYER_TEMP_CRIT` costs 25 safety points. Chasing the setpoint instead of e-stopping is exactly the failure mode this scenario exists to train. Pass mark 75.

## S6 — Moisture Analyser Drift Diagnosis

**Brief.** At t+120 s the inline analyser starts drifting low. Display healthy, product getting wetter.

**Fault schedule.** `SENSOR_DRIFT` at 120 s (bias ramps to −3.2 % over 240 s; self-check alarm at |bias| ≥ 1.2).

**Key steps.** Ack self-check (≤ 60 s) → take a lab sample and see the divergence → switch to the reference analyser → hold true moisture 18–20 % for 60 s → stop → recalibrate → restart, analyser back to AUTO → stable production 60 s.

**Grading notes.** The trap is compensating a lying sensor with setpoint changes — that hides the fault while real moisture drifts out of spec, and the quality model punishes it. Lab sample > display, always.

---

## Adding a scenario

Scenarios are pure data in `src/data/scenarios.ts` (see `docs/ARCHITECTURE.md`). Required: unique ID, schedule, weighted steps with `done` predicates, `passMark`, `requiredQuiz`. The Learn/Assess screens, scoring and records pick it up automatically.
