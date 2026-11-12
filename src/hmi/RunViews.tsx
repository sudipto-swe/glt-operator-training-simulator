/**
 * Scenario run views: event log, coaching panel (Learn mode), objectives
 * panel (Assess mode) and the end-of-exercise score report modal.
 */
import type { Scenario, ScenarioRuntime, SimEvent, SimState } from '../engine/types';
import { useSim } from '../sim/simulationStore';
import { checklistPct } from '../sim/scenarioRunner';
import { Badge, Btn, Card, Progress } from '../ui/primitives';
import { Modal } from '../ui/overlays';
import { fmtTime } from '../lib/format';
import { scenarioById } from '../data/scenarios';

const SEV_DOT: Record<SimEvent['severity'], string> = {
  info: 'bg-ink2/50',
  good: 'bg-ok',
  warn: 'bg-warn',
  bad: 'bg-bad',
  critical: 'bg-crit'
};

export function EventLog({ s, max = 60 }: { s: SimState; max?: number }) {
  const events = s.events.slice(-max).reverse();
  return (
    <div className="max-h-72 overflow-y-auto" aria-label="Event log">
      {events.length === 0 && <p className="text-sm text-ink2">No events yet.</p>}
      <ul className="space-y-1.5">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-2 text-xs">
            <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEV_DOT[e.severity]}`} aria-hidden />
            <span className="value shrink-0 text-ink2">{fmtTime(e.t)}</span>
            <span className="text-ink">{e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Learn mode: guided objectives with the current step highlighted. */
export function CoachPanel({
  sc,
  rt,
  onEnd
}: {
  sc: Scenario;
  rt: ScenarioRuntime;
  onEnd: () => void;
}) {
  const s = useSim((st) => st.engine);
  const currentIdx = rt.steps.findIndex((x) => !x.done);
  const current = currentIdx >= 0 ? sc.steps[currentIdx] : null;
  const pctDone = checklistPct(rt, sc);
  return (
    <Card
      title={`${sc.id} - ${sc.title}`}
      right={<Badge tone="acc">Learn</Badge>}
    >
      <p className="mb-3 text-sm text-ink2">{sc.brief}</p>
      <div className="mb-3">
        <div className="mb-1 flex items-baseline justify-between text-xs">
          <span className="text-ink2">Progress</span>
          <span className="value font-semibold text-ink">{pctDone}%</span>
        </div>
        <Progress value={pctDone} tone={pctDone === 100 ? 'ok' : 'acc'} label="Checklist progress" />
      </div>
      {current && (
        <div className="mb-3 rounded-lg border border-acc/40 bg-acc/10 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-acc">Current step</div>
          <p className="mt-1 text-sm font-medium text-ink">{current.label}</p>
          <p className="mt-1 text-xs text-ink2">{current.hint}</p>
        </div>
      )}
      <ol className="space-y-1.5" aria-label="Objectives">
        {sc.steps.map((st, i) => {
          const done = rt.steps[i]?.done;
          return (
            <li key={st.id} className={`flex items-start gap-2 text-xs ${done ? 'text-ink2' : 'text-ink'}`}>
              <span
                aria-hidden
                className={`mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border text-center text-[10px] leading-4 ${
                  done ? 'border-ok bg-ok/20 text-ok' : 'border-line text-ink2'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={done ? 'line-through decoration-ink2/50' : ''}>{st.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex items-center justify-between">
        <span className="value text-xs text-ink2">t = {fmtTime(s.time)}</span>
        <Btn variant="primary" onClick={onEnd}>
          End exercise
        </Btn>
      </div>
    </Card>
  );
}

/** Assess mode: objectives only, no hints, running clock. */
export function ObjectivesPanel({
  sc,
  rt,
  onEnd
}: {
  sc: Scenario;
  rt: ScenarioRuntime;
  onEnd: () => void;
}) {
  const s = useSim((st) => st.engine);
  const doneCount = rt.steps.filter((x) => x.done).length;
  return (
    <Card
      title={`${sc.id} - ${sc.title}`}
      right={<Badge tone="bad">Assess</Badge>}
    >
      <p className="mb-3 text-sm text-ink2">{sc.brief}</p>
      <div className="mb-3 flex items-center justify-between text-xs text-ink2">
        <span>
          Objectives completed: <span className="value font-semibold text-ink">{doneCount}/{sc.steps.length}</span>
        </span>
        <span className="value">t = {fmtTime(s.time)}</span>
      </div>
      <ul className="space-y-1.5" aria-label="Objectives">
        {sc.objectives.map((o) => (
          <li key={o} className="flex items-start gap-2 text-xs text-ink">
            <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-acc" />
            {o}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex justify-end">
        <Btn variant="danger" onClick={onEnd}>
          End &amp; score
        </Btn>
      </div>
    </Card>
  );
}

/** End-of-exercise report: full score breakdown (assess) or completion (learn). */
export function ScoreReportModal() {
  const rt = useSim((st) => st.runtime);
  const show = useSim((st) => st.showReport);
  const close = useSim((st) => st.closeReport);
  const sc = rt ? scenarioById(rt.scenarioId) : null;
  if (!rt || !sc) return null;
  const result = rt.result;
  const pctDone = checklistPct(rt, sc);
  const bars =
    result == null
      ? []
      : [
          { label: 'Safety (40)', value: result.safety, max: 40, tone: 'ok' as const },
          { label: 'Procedure (30)', value: result.procedure, max: 30, tone: 'acc' as const },
          { label: 'Quality (20)', value: result.quality, max: 20, tone: 'acc' as const },
          { label: 'Response (10)', value: result.response, max: 10, tone: 'acc' as const }
        ];
  return (
    <Modal open={show} onOpenChange={(o) => !o && close()} title={`${sc.id} - ${sc.title}: exercise report`} wide>
      {result == null ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <Badge tone="acc">Learn</Badge>
            <span className="text-sm text-ink2">Practice run - not scored.</span>
          </div>
          <div className="mb-4">
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-ink2">Checklist completion</span>
              <span className="value font-semibold text-ink">{pctDone}%</span>
            </div>
            <Progress value={pctDone} tone={pctDone >= 80 ? 'ok' : 'warn'} />
          </div>
          <ul className="space-y-1.5">
            {sc.steps.map((st, i) => (
              <li key={st.id} className="flex items-start gap-2 text-sm">
                <span className={rt.steps[i]?.done ? 'text-ok' : 'text-bad'} aria-hidden>
                  {rt.steps[i]?.done ? '✓' : '✗'}
                </span>
                <span className={rt.steps[i]?.done ? 'text-ink' : 'text-ink2'}>{st.label}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Badge tone={result.passed ? 'ok' : 'crit'}>
              {result.passed ? 'PASSED' : 'FAILED'}
            </Badge>
            <span className="value text-2xl font-bold text-ink">{result.total}<span className="text-sm text-ink2">/100</span></span>
            <span className="text-xs text-ink2">pass mark {sc.passMark}</span>
          </div>
          {result.critical && (
            <p className="mb-4 rounded-lg border border-crit bg-crit/10 p-3 text-sm font-medium text-crit">
              Critical violation: {result.critical}
            </p>
          )}
          <div className="mb-4 space-y-2">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="text-ink2">{b.label}</span>
                  <span className="value font-semibold text-ink">{b.value}</span>
                </div>
                <Progress value={b.value} max={b.max} tone={b.tone} label={b.label} />
              </div>
            ))}
          </div>
          {result.details.safetyDeductions.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink2">Safety deductions</h3>
              <ul className="space-y-1 text-xs text-bad">
                {result.details.safetyDeductions.map((d, i) => (
                  <li key={i}>-{d.points} pts - {d.reason}</li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink2">Steps</h3>
            <ul className="space-y-1">
              {result.details.steps.map((st) => (
                <li key={st.id} className="flex items-start justify-between gap-3 text-xs">
                  <span className={st.done ? 'text-ink' : 'text-ink2'}>
                    <span className={st.done ? 'text-ok' : 'text-bad'} aria-hidden>
                      {st.done ? '✓ ' : '✗ '}
                    </span>
                    {st.label}
                  </span>
                  {st.responseSec != null && (
                    <span className="value shrink-0 text-ink2">{st.responseSec.toFixed(0)} s</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <div className="mt-5 flex justify-end">
        <Btn variant="primary" onClick={close}>
          Close
        </Btn>
      </div>
    </Modal>
  );
}
