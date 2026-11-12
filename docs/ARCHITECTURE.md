# Architecture

## The one rule

> **The engine is a pure function. It never touches the DOM, never reads the wall clock, never calls `Math.random`.**

Everything else follows from that:

- Identical seed + identical operator actions ⇒ bit-identical replay (tested).
- The full grading system is a **replay of the event journal**, not live instrumentation — scoring can be recomputed offline at any time.
- The engine runs in Node for tests without any browser shim.

## Data flow

```
┌────────────────────────── UI (React) ──────────────────────────┐
│  screens/            hmi/                ui/                   │
│  (page-level)   (mimic, gauges,     (Button, Modal,     Radix  │
│                  panels, alarms)      Tabs, Switch)  overlays) │
└────────────┬───────────────▲───────────────────────────────────┘
    dispatch(action)    subscribe(state)
┌────────────▼───────────────┴───────────────────────────────────┐
│                      stores (Zustand)                          │
│  sim/simulationStore   state/recordsStore   state/uiStore      │
│  engine + runtime +    trainees + attempts  screen + theme     │
│  clock + scenarios     (localStorage, zod)                     │
└────────────┬───────────────────────────────────────────────────┘
             │ pure calls only
┌────────────▼───────────────────────────────────────────────────┐
│                      engine/ (pure core)                       │
│  step(state, dt) → state                                        │
│  actions → line FSM → LOTO → physics → faults → alarms →        │
│  quality → trends → event journal                               │
│                                                                │
│  sim/scenarioRunner  fault schedule + checklist + end rules     │
│  engine/scoring     4-category score from events + runtime      │
│  data/scenarios     S1–S6 as pure data + predicate closures     │
└─────────────────────────────────────────────────────────────────┘
```

## The tick loop

`App.tsx` runs a 100 ms `setInterval`. Each tick:

1. **Scenario runner** (`sim/scenarioRunner.ts`) checks the fault schedule against sim time and queues due `INJECT_FAULT` actions, then evaluates every checklist predicate against the current state + event journal (with hold-timers for stability steps and response-time capture for alarm steps).
2. The engine `step()` runs `speed` times (1x/2x/5x) at a fixed `dt = 0.1 s`. Each step: consume queued actions → advance line state machine → integrate physics → advance fault ramps → update alarms → watchdog → sample trends.
3. If the scenario reached an end condition, the store computes the score, saves the attempt to records and stops the clock.

## State machines

**Line** (`OFF → STARTING → RUNNING → STOPPED → ESTOP → MAINTENANCE`):

- `LINE_START` is refused (journaled `START_BLOCKED`) unless e-stop is reset, guards are closed and no LOTO is applied.
- `STARTING` runs a 20 s purge/warm-up with progress.
- Guard open while running ⇒ interlock auto-stop + scored violation.
- E-stop latches; reset requires the guard closed.

**LOTO** (`NONE → ISOLATED → LOCKED → VERIFIED → NONE`): each transition validates the previous step and journals the outcome. `CLEAR_JAM`, `REPAIR_VALVE`, `REPAIR_HEATER` call `requireVerifiedForWork()` — anything short of `VERIFIED` emits a `LOTO_VIOLATION` **critical** event, which auto-fails the exercise.

**Alarms** (ISA-style lifecycle): condition true → `ACTIVE_UNACK` (banner + blink); acknowledge → `ACTIVE_ACK`; condition false → `CLEARED_UNACK` (RTN); acknowledge → removed. Critical alarms unacknowledged for 60 s raise a scored `CRITICAL_UNACK` event.

## Physics model (first-order, tunable)

Every process variable is a first-order lag toward a target with a documented time constant (`engine/constants.ts`):

| Variable | Target | Tau |
| --- | --- | --- |
| Feed rate | setpoint (0 when jammed/stopped) | 8 s |
| Conditioner moisture | setpoint + valve fault bias | 25 s |
| Thresher speed / current | setpoint / load model | 4 s / 2 s |
| Air velocity | setpoint | 3 s |
| Dryer temperature | setpoint + heater fault ramp | 35 s |
| Packed moisture | `dryerIn − (temp − 40) × 0.145` | 15 s |

Faults ramp in over 5–240 s (`FAULT_RAMP_TIMES`), so operators must read **trends**, not snapshots. Repairs ramp effects back out.

## Quality model

While packing runs, every kilogram packed is compared against four specs (packed moisture 11.5–13.5 %, stem ≤ 4 %, NTRM ≤ 1500 ppm, dryer ≤ 100 °C). Out-of-spec kilograms accumulate `penaltyKg`; the quality score maps the in-spec ratio onto 0–20 points (80 % in-spec ⇒ full points, < 100 kg packed ⇒ neutral 12/20).

## Records & persistence

`state/recordsStore.ts` owns `{ version: 1, trainees[], attempts[] }`, validated with zod on load. Unknown/corrupt payloads are backed up to `glt.records.v1.corrupt-backup` and the store reseeds with the deterministic demo cohort. Writes go through `lib/storage.ts` (localStorage in the browser, memory backend in tests). CSV export is RFC 4180 with a BOM and formula-injection protection.

## Scenario authoring

A scenario is **data + predicates** (`data/scenarios.ts`):

```ts
{
  id: 'S2', schedule: [{ at: 90, fault: 'FEED_JAM' }],
  steps: [{ id: 'ack', label: '...', hint: '...', weight: 2,
            alarmCode: 'FEED_JAM', responseTarget: 30,
            done: (ctx) => ctx.events.some(...) }],
}
```

Predicates receive `{ s, events, doneAt }` — state, the full journal, and completion timestamps (for ordering checks like "restart **after** lock removal"). Adding a scenario requires no engine changes.

## Deliberate non-choices

- **No router**: single-page state-based navigation keeps the static build trivially hostable.
- **No chart library**: gauges/sparklines are hand-rolled SVG (part of why the bundle is 116 KB gzip).
- **Hand-rolled FSMs instead of XState**: the two machines are small; exhaustive typed switches keep transitions compile-checked with zero extra dependencies.
- **System font stack** (`Inter → ui-sans-serif`): honours locally installed fonts with zero network requests. Swap in self-hosted woff2 files under `public/fonts` if brand consistency matters more than offline purity.
