/**
 * Trainer dashboard: cohort KPIs, the skill-matrix heatmap (accessible
 * table), recertification watchlist and export tools.
 */
import { useMemo } from 'react';
import { useRecords } from '../state/recordsStore';
import { SKILLS } from '../data/skills';
import { scenarioById } from '../data/scenarios';
import { toCsv, downloadCsv, downloadJson } from '../lib/csv';
import { daysSince, fmtDate, fmtDateTime } from '../lib/format';
import { Badge, Btn, Card, Empty, Kpi } from '../ui/primitives';

const RECERT_DAYS = 365;
const WATCH_WINDOW_DAYS = 30;

function levelColor(level: number): string {
  switch (level) {
    case 0:
      return 'bg-surf2 text-ink2';
    case 1:
      return 'bg-acc/15 text-acc';
    case 2:
      return 'bg-acc/30 text-ink';
    case 3:
      return 'bg-ok/30 text-ink';
    default:
      return 'bg-ok/60 text-white';
  }
}

export function TrainerScreen() {
  const data = useRecords((st) => st.data);
  const exportJson = useRecords((st) => st.exportJson);

  const kpis = useMemo(() => {
    const now = Date.now();
    const recent = data.attempts.filter(
      (a) => daysSince(a.startedAt, now) <= WATCH_WINDOW_DAYS
    );
    const assess = recent.filter((a) => a.mode === 'assess' && a.score != null);
    const avg = assess.length > 0 ? Math.round(assess.reduce((s, a) => s + (a.score ?? 0), 0) / assess.length) : 0;
    const passRate =
      assess.length > 0
        ? Math.round((assess.filter((a) => a.passed).length / assess.length) * 100)
        : 0;
    const atRisk = data.trainees.filter((t) => {
      const own = data.attempts.filter((a) => a.traineeId === t.id && a.mode === 'assess');
      const last = own[0];
      return last != null && (last.critical != null || (last.score != null && last.score < 60));
    });
    const recertDue = data.trainees.filter((t) =>
      Object.values(t.skills).some(
        (sk) => sk.level >= 2 && sk.lastCert != null && daysSince(sk.lastCert, now) >= RECERT_DAYS - 30
      )
    );
    return { recent, assess, avg, passRate, atRisk, recertDue };
  }, [data]);

  const matrixCsv = () => {
    const rows = data.trainees.map((t) => [
      t.name,
      t.role,
      `shift ${t.shift}`,
      ...SKILLS.map((sk) => t.skills[sk.id]?.level ?? 0)
    ]);
    return toCsv(['trainee', 'role', 'shift', ...SKILLS.map((s) => s.short)], rows);
  };

  const allAttemptsCsv = () => {
    const nameOf = (id: string) => data.trainees.find((t) => t.id === id)?.name ?? id;
    return toCsv(
      ['date', 'trainee', 'exercise', 'mode', 'score', 'result', 'critical', 'checklist', 'duration_sec'],
      data.attempts.map((a) => [
        fmtDateTime(a.startedAt),
        nameOf(a.traineeId),
        a.scenarioId,
        a.mode,
        a.score ?? '',
        a.passed == null ? '' : a.passed ? 'PASS' : 'FAIL',
        a.critical ?? '',
        a.checklistPct,
        Math.round(a.durationSec)
      ])
    );
  };

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-ink">Trainer dashboard</h1>
          <p className="text-sm text-ink2">Cohort competency at a glance - last {WATCH_WINDOW_DAYS} days.</p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => downloadCsv('glt-skill-matrix.csv', matrixCsv())}>Export matrix CSV</Btn>
          <Btn onClick={() => downloadCsv('glt-all-attempts.csv', allAttemptsCsv())}>Export attempts CSV</Btn>
          <Btn onClick={() => downloadJson('glt-records-backup.json', exportJson())}>Backup JSON</Btn>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Trainees" value={data.trainees.length} />
        <Kpi label="Attempts (30 d)" value={kpis.recent.length} />
        <Kpi label="Avg assess score" value={kpis.avg} unit="/100" tone={kpis.avg >= 75 ? 'ok' : kpis.avg >= 60 ? 'warn' : 'bad'} />
        <Kpi label="Pass rate" value={kpis.passRate} unit="%" tone={kpis.passRate >= 80 ? 'ok' : 'warn'} />
        <Kpi label="At-risk trainees" value={kpis.atRisk.length} tone={kpis.atRisk.length > 0 ? 'bad' : 'ok'} hint="last assess <60 or critical" />
        <Kpi label="Recerts due (90 d)" value={kpis.recertDue.length} tone={kpis.recertDue.length > 0 ? 'warn' : 'ok'} hint="annual recert window" />
      </div>

      <Card title="Skill matrix">
        {data.trainees.length === 0 ? (
          <Empty>No trainees. Add them in Records or regenerate the demo cohort.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Skill levels per trainee, zero to four</caption>
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-ink2">
                  <th scope="col" className="py-2 pr-3">Trainee</th>
                  {SKILLS.map((sk) => (
                    <th key={sk.id} scope="col" className="py-2 px-1 text-center" title={sk.description}>
                      {sk.short}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.trainees.map((t) => (
                  <tr key={t.id} className="border-b border-line/60">
                    <th scope="row" className="py-2 pr-3 text-left font-medium text-ink">
                      {t.name}
                      <span className="ml-2 text-xs font-normal text-ink2">{t.role}</span>
                    </th>
                    {SKILLS.map((sk) => {
                      const rec = t.skills[sk.id] ?? { level: 0, lastCert: null };
                      const due =
                        rec.lastCert != null && daysSince(rec.lastCert) >= RECERT_DAYS - 30;
                      return (
                        <td key={sk.id} className="px-1 py-1 text-center">
                          <span
                            className={`inline-block w-9 rounded-md py-1 text-xs font-bold ${levelColor(rec.level)}`}
                            aria-label={`${t.name} ${sk.name}: ${rec.level} of 4${due ? ', recertification due' : ''}`}
                            title={rec.lastCert ? `certified ${fmtDate(rec.lastCert)}` : 'not certified'}
                          >
                            {rec.level}
                            {due ? '*' : ''}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink2">
              0 awareness · 1 supervised · 2 basic · 3 independent · 4 coach. * = recertification due within 30 days.
            </p>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Watchlist">
          {kpis.atRisk.length === 0 ? (
            <Empty>Nobody on the watchlist.</Empty>
          ) : (
            <ul className="space-y-2">
              {kpis.atRisk.map((t) => {
                const last = data.attempts.find(
                  (a) => a.traineeId === t.id && a.mode === 'assess'
                );
                return (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink">{t.name}</span>
                    <span className="flex items-center gap-2">
                      {last?.critical && <Badge tone="crit">critical violation</Badge>}
                      {last?.score != null && <Badge tone={last.score < 60 ? 'bad' : 'warn'}>last {last.score}</Badge>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-ink2">
            Trainees whose most recent assessment scored below 60 or contained a critical violation.
          </p>
        </Card>

        <Card title="Recent attempts">
          {data.attempts.length === 0 ? (
            <Empty>No attempts recorded yet.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {data.attempts.slice(0, 10).map((a) => {
                const name = data.trainees.find((t) => t.id === a.traineeId)?.name ?? a.traineeId;
                const label =
                  a.mode === 'quiz'
                    ? `${a.scenarioId} quiz`
                    : (scenarioById(a.scenarioId)?.title ?? a.scenarioId);
                return (
                  <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-ink">
                      <span className="text-ink2">{fmtDate(a.startedAt)}</span> · {name} · {label}
                    </span>
                    {a.score != null ? (
                      <Badge tone={a.passed ? 'ok' : 'crit'}>
                        {a.score}
                        {a.mode === 'quiz' ? '%' : ''}
                      </Badge>
                    ) : (
                      <Badge>practice</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
