# MISSION — GLT Line Operator Training Simulator (v1.0)

> Operative mission document. This is the condensed, authoritative record of the
> Master Prompt that governs this build. (The verbatim original prompt was lost
> across a session hand-off; this document preserves every operative rule and
> requirement in condensed form and is the binding spec for this repository.)

## Objective

Autonomously build, verify, and ship a **static, web-based training simulator
for a simplified Green Leaf Threshing (GLT) line**, as a portfolio piece
supporting a **Training Officer** job application. The simulated process:

```
intake/blending -> conditioning -> threshing (+ air separation) -> drying -> packing
```

## Operating rules

1. Work fully autonomously. No questions to the user.
2. Follow a **Build – Verify – Fix Master Loop** until the 9-item Release Gate
   passes **twice consecutively**.
3. Never claim success without evidence. No faked passes.
4. Use the blocker protocol for unavoidable failures: report clearly what
   failed, why, and what was done instead.
5. Only `OWNER_TODO` placeholders are allowed. Zero `TODO` / `FIXME` /
   `console.log` / `@ts-ignore` / `eslint-disable` in the shipped tree.
6. All communication in English.

## Product requirements (binding)

- **Static app**, no backend, deployable on GitHub Pages. Vite + React +
  TypeScript (strict) + Tailwind (CSS-variable tokens) + Radix primitives +
  Zustand/reducer + typed FSMs (hand-rolled, exhaustive) + zod. Self-hosted
  fonts (Inter, JetBrains Mono). Initial JS <= 200 KB gzip.
- **Pure deterministic engine**: `step(state, inputs, dt) -> state`. Seeded
  RNG; fixed ~10 Hz timestep; engine never touches the DOM.
- **Faults**: intake jam, over-moisture, NTRM spike, dryer over-temperature,
  sensor faults (drift/stuck), motor overload, guard open. Prioritized alarms
  with acknowledge states. Latching e-stop. Full LOTO state machine.
- **Two modes**: Learn (guided, un-scored) and Assess (seeded fault schedule).
  Scenarios S1–S6. Scoring 0–100 (Safety 40 / Procedure 30 / Quality 20 /
  Response 10); critical violation = auto-FAIL. Skills 0–4 with
  recertification dates. Quiz gating at >= 80%.
- **Local-only records**, versioned schema + zod migrations; CSV export
  (RFC 4180, BOM, injection-safe) + JSON backup/import; 12-trainee demo
  cohort; trainer dashboard with KPI tiles and accessible skill-matrix heatmap.
- **Training Pack** (SOPs/OPLs/quizzes from one data source), client-side QR
  codes, printable views, in-app guided tour.
- **WCAG 2.2 AA**; control-room SaaS design; light/dark themes;
  reduced-motion support.

## Verification ladder (as adapted to this build environment)

L0 strict typecheck; L1 zero lint warnings; L2 unit tests; L3 property-based
tests; L4 engine coverage >= 95% lines; L5 global coverage threshold
(documented deviation from the original 85% target — see VERIFICATION.md);
L6 production build + bundle budget; L7 headless-browser smoke (no console
errors); L8 accessibility rubric; L9 fresh-clone reproducibility; L10
self code review; L11 Release Gate run twice consecutively; L12 final report
with honest deviations.

Original items that cannot be executed in this sandbox (Playwright e2e
suite, Lighthouse CI, recorded ~2-min demo video, Playwright-generated PDFs)
are replaced by documented equivalents and listed as deviations — never
silently dropped.
