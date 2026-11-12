# Roadmap

v0.1.0 ships a complete, deployable training loop. Ordered by training value:

## Hardening (next)

- **Playwright e2e journeys** committed to CI: cold start, jam + LOTO, dryer emergency (each failing on any console error or third-party request).
- **Coverage instrumentation**: `@vitest/coverage-vanilla`, engine ≥ 95 %, global ≥ 85 %, enforced in `ci.yml`.
- **Lighthouse CI + axe** in the deploy workflow (budgets: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90).
- **Property-based tests** (fast-check): engine determinism over random action scripts; score bounds over random journals.

## Training-pack expansion

- **QR-code cards** per SOP/OPL/quiz (client-side generation, printable from the Training Pack) for on-the-floor reference.
- **Generated PDFs** of the pack (Playwright print pipeline in CI) alongside the in-app print view.
- **Guided in-app tour** of the HMI (spotlight sequence over the mimic, alarm banner, LOTO panel).
- **~2-minute demo video** (scripted Playwright recording) linked from the README.

## Scenario & model growth

- Scenario S7+: shutdown & product changeover; multiple simultaneous faults; night-shift disturbances (tipper starvation, steam header pressure droop).
- Difficulty modifiers on existing scenarios (tighter response targets, compound faults).
- A second line configuration (e.g. different dryer size) driven entirely by `constants.ts` overrides.
- Trainee-visible **history trend** per skill (sparkline of attempts over time).

## Records & integrations

- CSV template **import** for cohort bootstrap (names/shifts/roles).
- Optional SCORM/xAPI packaging for LMS enrolment (kept strictly optional — the local-only default is a feature, not a gap).
- Trainer **session notes** per attempt (free-text, exported with CSV).

## Conventions for contributors (human or agent)

See [AGENTS.md](../AGENTS.md). The short version: keep the engine pure, keep `npm run verify` green, never bypass interlocks in tests to make them pass.
