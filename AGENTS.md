# AGENTS.md — conventions for AI coding agents

This repository is maintained with AI assistance. If you are an agent working here, follow these rules; they exist to keep the codebase verifiable and honest.

## Commands

```bash
npm run verify     # THE gate: typecheck + lint + test + build — must pass before any commit
npm run dev        # local dev server
npm run test       # vitest (34 tests at time of writing)
npm run lint       # eslint — zero warnings tolerated
npm run typecheck  # tsc strict
```

## Hard rules

1. **The engine stays pure.** `src/engine/**` must never import React, touch the DOM, read the wall clock (`Date.now`) or call `Math.random`. All randomness goes through the seeded RNG in state. All UI/store code lives outside the engine.
2. **No debug leftovers.** Zero `console.log`, `TODO`, `FIXME`, `@ts-ignore`, `eslint-disable` in the shipped tree. If something must be flagged for the owner, use `OWNER_TODO` (the only tolerated marker).
3. **Never weaken a check to make a test pass.** If an interlock, alarm threshold or scoring rule blocks a test, the test or the feature is wrong — not the safety logic. Safety rules (LOTO verification, guard interlock, critical alarms) are product requirements, not obstacles.
4. **Determinism is a feature.** Any new engine behaviour must be covered by a test asserting identical replay for identical seed + actions.
5. **Scenarios are data.** New scenarios/quiz questions/SOPs go in `src/data/**` as pure data + predicate closures — no engine changes required, no UI changes either.
6. **Records are sacred.** Schema changes require: bump `RECORDS_VERSION`, extend the zod schema in `src/state/recordsSchema.ts`, write the migration in `migrateAndValidate`, add a test. Never write a shape that `recordsDataSchema` would reject.
7. **Accessibility is not optional.** Interactive elements need labels/roles; alarms encode priority in color **and** text **and** icon; respect `prefers-reduced-motion`; overlays go through the Radix wrappers in `src/ui/overlays.tsx`.

## Project layout

- `src/engine/` — pure simulation core (see `docs/ARCHITECTURE.md`)
- `src/sim/` — scenario lifecycle + the Zustand store that owns the tick loop
- `src/data/` — scenarios, skills, training pack, demo cohort (content lives here)
- `src/state/` — records (zod + migrations) and UI stores
- `src/hmi/`, `src/ui/`, `src/screens/` — presentation only
- `src/lib/` — CSV, storage abstraction, formatting (pure, testable)

## Documentation contract

If you change behaviour, update the matching doc in `docs/` in the same change: scenarios → `SCENARIOS.md`, scoring → `SCORING.md`, records schema → `DATA-MODEL.md`, architecture → `ARCHITECTURE.md`, verification claims → `VERIFICATION.md`.
