# GLT Operator Training Simulator

A static, offline-capable web-based **operator training simulator for a simplified Green Leaf Threshing (GLT) line** — the process every primary tobacco facility runs: intake/blending → conditioning → threshing (with air separation) → drying → packing.

Built as a portfolio piece for a **Training Officer** role: it demonstrates instructional design (guided practice, scored assessment, competency matrix, training pack), process knowledge (faults, alarms, LOTO, quality specs) and engineering discipline (deterministic simulation core, typed state machines, verified pipeline).

**No backend. No accounts. No telemetry.** Deploy the `dist/` folder anywhere static (GitHub Pages included). All trainee records live in the browser's `localStorage`, exportable to CSV/JSON.

---

## What is in the box

| Area | Detail |
| --- | --- |
| Deterministic engine | Pure `step(state, dt) → state` at a fixed 10 Hz timestep, seeded RNG, zero DOM access. Identical seed + identical actions replay identically. |
| Process model | Blend hopper, feed rate, conditioning moisture, thresher load, air-separator split, dryer temperature, packed moisture, NTRM, case packing. |
| Fault library (6) | Feed jam, stuck steam valve (over-moisture), NTRM spike, dryer heater runaway, moisture analyser drift, thresher motor overload — all with gradual ramp-in. |
| Alarm system | 12 prioritised alarms (CRITICAL→LOW) with the full lifecycle: active/unacked → active/acked → RTN → removed, plus a global banner. |
| Safety systems | Latching e-stop (with twist-reset), guard interlock that auto-stops the line, and a complete **LOTO state machine** (isolate → lock → verify → remove). Body-in-equipment work without a verified LOTO is a critical violation. |
| Two training modes | **Learn**: guided exercises with step labels, hints and a live checklist. **Assess**: no hints, timed fault schedule, scored 0–100. |
| Scenarios S1–S6 | Cold start, feed jam + LOTO, over-moisture diagnosis, NTRM response, dryer over-temp emergency, sensor drift diagnosis. |
| Scoring | Safety 40 / Procedure 30 / Quality 20 / Response 10. Critical violations auto-fail. Score breakdown with deductions, response times and checklist detail. |
| Competency tracking | Six skills rated 0–4 with certification dates; quiz gates (≥80%) lock Assess scenarios. |
| Records | Local, versioned (zod-validated) schema with migrations, CSV export (RFC 4180 + BOM + injection-safe), JSON backup/import, 12-trainee seeded demo cohort. |
| Trainer dashboard | Cohort KPIs (attempts, average score, pass rate, at-risk, recerts due), accessible skill-matrix heatmap, watchlist, recent attempts, exports. |
| Training pack | 5 SOPs, 3 OPLs, 3 quizzes — one data source, rendered in-app, printable to PDF via the browser. |
| Design | Control-room SaaS aesthetic, light/dark themes, WCAG-minded (Radix primitives, focus rings, reduced-motion support, ARIA labelling). |

Bundle: **~116 KB JS (gzip)**, zero runtime dependencies beyond React/Radix/Zustand/zod, no external fonts or CDNs.

---

## Quick start

```bash
npm install
npm run dev        # local dev server
npm run verify     # typecheck + lint + tests + production build
npm run preview    # serve the production build locally
```

Node ≥ 18.

### Deploy to GitHub Pages

The repo ships a ready workflow (`.github/workflows/deploy.yml`):

1. Create a new **empty** GitHub repository.
2. Push this folder's contents to `main`.
3. Repo → **Settings → Pages → Source: GitHub Actions**.
4. Done. CI runs the full `verify` gate, then publishes `dist/`.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for details and alternatives (any static host works — Vite's `base: './'` makes the build path-independent).

---

## Repository layout

```
├── docs/                    # Mission, architecture, scenarios, scoring, data model...
├── .github/workflows/       # ci.yml (verify gate) + deploy.yml (GitHub Pages)
├── public/                  # favicon
└── src/
    ├── engine/              # Pure simulation core (no React, no DOM)
    │   ├── types.ts         #   state, actions, scenarios, runtime — the contract
    │   ├── constants.ts     #   all tunable process parameters
    │   ├── engine.ts        #   step(): actions → line FSM → physics → alarms → trends
    │   ├── alarms.ts        #   12 alarm definitions + lifecycle
    │   ├── faults.ts        #   fault library, injection, repair, ramps
    │   ├── loto.ts          #   lockout-tagout state machine + safety rules
    │   ├── scoring.ts       #   4-category scoring + skill levels
    │   └── __tests__/       #   determinism, LOTO, alarms, scoring, runner (34 tests)
    ├── sim/                 # Scenario lifecycle (fault schedule, checklist, runtime)
    ├── data/                # Scenarios S1–S6, skills, training pack, demo cohort
    ├── state/               # Records store (zod + migrations), UI store
    ├── hmi/                 # Line mimic, gauges, alarm views, control panels
    ├── ui/                  # Primitives + Radix-based overlays
    ├── screens/             # Overview, Control Room, Learn, Assess, Records, Trainer, Pack
    └── lib/                 # CSV, storage abstraction, formatting
```

The engine is deliberately framework-free: React code never computes physics, engine code never imports React. That separation is what makes the 34-test suite (including bit-exact replay determinism) possible.

---

## Documentation

| Doc | Contents |
| --- | --- |
| [docs/MISSION.md](docs/MISSION.md) | Binding mission spec and operating rules. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Engine purity, state machines, data flow, module map. |
| [docs/PROCESS-BASICS.md](docs/PROCESS-BASICS.md) | The GLT process in plain language — read this first if you are new to threshing lines. |
| [docs/SCENARIOS.md](docs/SCENARIOS.md) | S1–S6 briefs, objectives, fault schedules, grading notes. |
| [docs/SCORING.md](docs/SCORING.md) | The 0–100 rubric, critical violations, skills 0–4, quiz gates. |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Records schema, versioning/migrations, privacy stance. |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | GitHub Pages step-by-step, static hosting, local usage. |
| [docs/VERIFICATION.md](docs/VERIFICATION.md) | What is verified, how to reproduce it, known deviations. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | e2e/Lighthouse/a11y hardening, QR training pack, video tour. |
| [AGENTS.md](AGENTS.md) | Working conventions for AI coding agents on this repo. |

## Verification status

Run `npm run verify` — it must pass with **zero** type errors, **zero** lint warnings, all tests green, and a successful build. Current state on the shipped tree:

- TypeScript strict typecheck: clean
- ESLint (typescript-eslint + react-hooks): zero warnings
- Vitest: 34/34 passing (engine determinism, LOTO safety, alarm lifecycle, fault physics, scoring maths, CSV injection safety, schema migration, demo-cohort determinism)
- Production build: 116 KB JS gzip
- Headless-browser smoke: all 7 screens render, line start/stop/e-stop/fault flows work, no console errors

Details and the honest deviations list live in [docs/VERIFICATION.md](docs/VERIFICATION.md).

## License

MIT — see [LICENSE](LICENSE). Replace the `OWNER_TODO` copyright holder with your name after cloning.
