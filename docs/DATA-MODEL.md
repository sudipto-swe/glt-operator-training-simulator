# Data Model & Privacy

## Where data lives

**In the browser, and only in the browser.** `localStorage` on the origin that serves the app. There is no backend, no account, no network call at runtime (fonts are system-local; the app works fully offline once loaded). Clearing site data deletes records — exports are the backup mechanism.

| Key | Contents |
| --- | --- |
| `glt.records.v1` | The records document (below) |
| `glt.active` | Active trainee id |
| `glt.theme` | `light` / `dark` |
| `glt.records.v1.corrupt-backup` | Automatic backup when an unrecoverable payload was found at load |

## Records document (version 1)

Validated with zod on every load (`src/state/recordsSchema.ts`):

```jsonc
{
  "version": 1,
  "trainees": [{
    "id": "t-1",
    "name": "A. Rahman",
    "role": "Operator", "shift": "A", "site": "GLT Plant 2",
    "joinedAt": "2025-06-01T07:10:00.000Z",
    "passedQuizzes": ["quiz-safety", "quiz-process"],
    "skills": {
      "startup":   { "level": 3, "lastCert": "2026-01-05T07:40:00.000Z" },
      "loto":      { "level": 2, "lastCert": null }
      // ... faults, quality, emergency, records
    }
  }],
  "attempts": [{
    "id": "a-...", "traineeId": "t-1",
    "scenarioId": "S2",            // S1..S6 or a quiz id
    "mode": "assess",              // learn | assess | quiz
    "startedAt": "2026-01-05T07:40:00.000Z",
    "durationSec": 412,
    "score": 84, "passed": true,   // null for learn attempts
    "breakdown": { "safety": 40, "procedure": 26, "quality": 10, "response": 8 },
    "critical": null,              // description of the auto-fail violation
    "checklistPct": 92
  }]
}
```

Invariants enforced in code:

- Attempts are capped at 2000 (newest first).
- Skill levels only rise; `lastCert` updates only on a level increase.
- `passed` requires `score ≥ passMark` **and** `critical == null`.

## Versioning & migrations

`migrateAndValidate(raw)` in `recordsSchema.ts`:

1. Legacy v0 shape (`{ trainees: [...] }` without `version`/`attempts`) is upgraded to version 1.
2. Anything that still fails zod validation ⇒ the payload is copied to the `.corrupt-backup` key and the store reseeds with the demo cohort.

Adding a field later: bump `RECORDS_VERSION`, extend the schema, write the migration step, and add a test in `src/lib/__tests__/lib.test.ts`.

## Demo cohort

First run (or "Regenerate demo cohort") seeds **12 trainees with ~90 days of history** via `buildDemoData(now)` — deterministic (mulberry32, fixed seed) so every fresh browser shows the same believable dashboard: mixed ability, learn/assess/quiz attempts, some critical violations, three senior trainees with recerts coming due. The injected `now` keeps it anchored to the current date.

## Exports

- **Attempts CSV** (per trainee, Records screen) and **all-attempts / skill-matrix CSV** (Trainer screen): RFC 4180, `\r\n` rows, UTF-8 BOM so Excel opens them cleanly, and formula-injection protection (cells starting with `= + - @` are prefixed with an apostrophe). Unit-tested in `src/lib/__tests__/lib.test.ts`.
- **JSON backup / import** (Records screen): the full records document; import validates + migrates before accepting.

## GDPR stance

No personal data leaves the device, no cookies, no analytics. Trainee "names" in the demo cohort are fictional. If real names are entered, the operator of the deployment is the data controller — export and delete are one click each.
