# Verification

Honest record of what is verified, how to reproduce it, and what is deliberately out of scope for v0.1.0. Run everything with one command:

```bash
npm run verify   # typecheck && lint && test && build
```

## Verified on the shipped tree

| Check | Command | Status at release |
| --- | --- | --- |
| TypeScript strict typecheck (`strict`, `noUnusedLocals/Parameters`) | `npm run typecheck` | Clean |
| ESLint 9 flat config, typescript-eslint + react-hooks, zero warnings | `npm run lint` | Clean |
| Vitest suite — 34 tests | `npm run test` | 34/34 pass |
| Production build | `npm run build` | 116 KB JS gzip, 5 KB CSS gzip |
| Headless-browser smoke (Chromium 157) | manual, see below | All screens render, zero console errors |

### What the tests actually prove

- **Determinism**: same seed + same action script ⇒ bit-identical state (JSON equality); different seeds diverge.
- **Line state machine**: start/purge/running, blocked starts, e-stop latch + reset, guard interlock auto-stop.
- **LOTO safety**: full sequence; isolation refused while running; start refused while locked out; jam-clearing without `VERIFIED` emits the critical violation and does **not** clear the fault.
- **Fault physics**: jam collapses feed/raises hopper and recovers after a legal clear; motor overload ramps, trips at 115 % after 30 s and refuses reset while running; NTRM sorting is blocked while feeding and clears the spike; sensor drift biases the display vs lab truth and the reference sensor shows the truth.
- **Alarm lifecycle**: raise → unack → ack → RTN → removal, end to end on the dryer path.
- **Scoring maths**: clean run (92/100 example), zero-procedure, critical auto-fail, guard/unack deductions, late-e-stop rule (S5) both directions, partial response points, quality neutral/scale/zero bands.
- **Scenario runner**: S2 integration — fault injected at t+90, checklist steps complete as the operator responds, response times captured.
- **Data layer**: CSV RFC 4180 escaping + formula-injection protection, storage round-trip + corrupt JSON, schema validation + v0 migration, skill monotonicity, demo-cohort determinism (12 trainees, valid levels, assess attempts all scored).

### Headless-browser smoke (reproduction)

```bash
npm run build && npm run preview &     # localhost:4173
# any headless browser, e.g.:
agent-browser open http://localhost:4173/
agent-browser errors                   # expect: none
```

Walked at release: all 7 screens; free-play start → all stations on → feed ~3500 kg/h, moisture tracking SP, dryer heating; `E` hotkey e-stop (state → ESTOP, banner "E-STOP LATCHED"); S1 Learn run (coach panel + current step visible); Trainer dashboard KPIs + heatmap; Training Pack. Screenshots confirmed rendered content (dark theme, no blank regions).

## Known deviations & non-goals for v0.1.0

Documented rather than silently dropped (per the mission's blocker protocol):

1. **Coverage thresholds not instrumented** — no `@vitest/coverage-vanilla` run (the mission's 95 % engine / 85 % global targets). The engine, scoring and data layers are behaviour-covered by the 34 tests; the UI layer is covered by the browser smoke, not by unit tests. Adding coverage is a one-line devDependency + `vitest run --coverage`.
2. **No automated e2e suite** (Playwright) — the release smoke was a scripted headless-browser pass, not a committed spec. The `ci.yml` gate covers typecheck/lint/test/build only.
3. **No Lighthouse CI / axe run in CI** — accessibility is designed in (Radix primitives, focus-visible rings, ARIA roles/labels, reduced-motion, color+icon+text alarm encoding) and spot-checked in the smoke, but not machine-audited on every push.
4. **No property-based tests** (fast-check) — determinism is asserted on fixed scripts instead.
5. **QR training-pack cards, generated PDFs and the ~2-min demo video** — roadmap items (see `docs/ROADMAP.md`); print-to-PDF via the browser covers the immediate need.

None of these block the product goal: a verifiable, deployable, portfolio-grade training simulator.
