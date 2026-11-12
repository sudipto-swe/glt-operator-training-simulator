/**
 * Records screen: trainee profile, quiz gates, attempt history and
 * CSV/JSON export/import (local-only data, RFC 4180 CSV with BOM).
 */
import { useRef, useState } from 'react';
import { attemptsFor, activeTrainee, useRecords } from '../state/recordsStore';
import { SCENARIOS, scenarioById } from '../data/scenarios';
import { QUIZZES, quizById } from '../data/trainingPack';
import { SKILLS, LEVEL_NAMES } from '../data/skills';
import { toCsv, downloadCsv, downloadJson } from '../lib/csv';
import { fmtDate, fmtDateTime, fmtTime } from '../lib/format';
import { Badge, Btn, Card, Empty, Field } from '../ui/primitives';
import { Modal } from '../ui/overlays';

function attemptsCsv(traineeId: string): string {
  const { data } = useRecords.getState();
  const rows = data.attempts
    .filter((a) => a.traineeId === traineeId)
    .map((a) => [
      fmtDate(a.startedAt),
      a.scenarioId,
      a.mode,
      a.mode === 'quiz' ? (a.score ?? '') + '%' : (a.score ?? ''),
      a.passed == null ? '' : a.passed ? 'PASS' : 'FAIL',
      a.breakdown ? a.breakdown.safety : '',
      a.breakdown ? a.breakdown.procedure : '',
      a.breakdown ? a.breakdown.quality : '',
      a.breakdown ? a.breakdown.response : '',
      a.critical ?? '',
      a.mode === 'quiz' ? '' : a.checklistPct + '%',
      Math.round(a.durationSec) + 's'
    ]);
  return toCsv(
    ['date', 'exercise', 'mode', 'score', 'result', 'safety', 'procedure', 'quality', 'response', 'critical', 'checklist', 'duration'],
    rows
  );
}

export function RecordsScreen() {
  const data = useRecords((st) => st.data);
  const activeId = useRecords((st) => st.activeTraineeId);
  const setActive = useRecords((st) => st.setActive);
  const addTrainee = useRecords((st) => st.addTrainee);
  const importJson = useRecords((st) => st.importJson);
  const exportJson = useRecords((st) => st.exportJson);
  const resetDemo = useRecords((st) => st.resetDemo);
  const clearAll = useRecords((st) => st.clearAll);

  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const trainee = activeTrainee(data, activeId);
  const attempts = trainee ? attemptsFor(data, trainee.id) : [];

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const res = importJson(text);
    setImportMsg(res.ok ? 'Records imported.' : res.error);
  };

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="text-lg font-bold text-ink">Records</h1>
        <p className="text-sm text-ink2">
          All data lives in this browser only. Export CSV/JSON to move it - nothing is ever uploaded.
        </p>
      </header>

      <Card title="Trainee">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field label="Active trainee">
              <select
                className="inp w-full"
                value={activeId}
                onChange={(e) => setActive(e.target.value)}
                aria-label="Active trainee"
              >
                {data.trainees.length === 0 && <option value="">(no trainees)</option>}
                {data.trainees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} - {t.role}, shift {t.shift}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Btn onClick={() => setShowAdd(true)}>Add trainee</Btn>
        </div>
        {trainee && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-ink2">
            <Badge tone="acc">{trainee.role}</Badge>
            <Badge>shift {trainee.shift}</Badge>
            <Badge>{trainee.site}</Badge>
            <Badge>joined {fmtDate(trainee.joinedAt)}</Badge>
            <Badge tone={trainee.passedQuizzes.length === QUIZZES.length ? 'ok' : 'warn'}>
              quizzes {trainee.passedQuizzes.length}/{QUIZZES.length}
            </Badge>
          </div>
        )}
      </Card>

      {trainee && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Skill levels (highest demonstrated)">
            <ul className="space-y-2">
              {SKILLS.map((sk) => {
                const rec = trainee.skills[sk.id] ?? { level: 0, lastCert: null };
                return (
                  <li key={sk.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink">{sk.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={rec.level >= 3 ? 'ok' : rec.level === 2 ? 'acc' : 'neutral'}>
                        {LEVEL_NAMES[rec.level]}
                      </Badge>
                      {rec.lastCert && (
                        <span className="text-xs text-ink2">since {fmtDate(rec.lastCert)}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Quiz gates">
            <ul className="space-y-2">
              {QUIZZES.map((q) => {
                const passed = trainee.passedQuizzes.includes(q.id);
                return (
                  <li key={q.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink">{q.title}</span>
                    <Badge tone={passed ? 'ok' : 'warn'}>{passed ? 'passed' : 'not passed'}</Badge>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-ink2">
              Quizzes live in the Training Pack and gate Assess scenarios.
            </p>
          </Card>
        </div>
      )}

      <Card
        title={`Attempt history${trainee ? ` - ${trainee.name}` : ''}`}
        right={
          trainee && (
            <div className="flex gap-2">
              <Btn onClick={() => downloadCsv(`glt-attempts-${trainee.name.replace(/\W+/g, '-')}.csv`, attemptsCsv(trainee.id))}>
                Export CSV
              </Btn>
              <Btn onClick={() => downloadJson('glt-records-backup.json', exportJson())}>Backup JSON</Btn>
            </div>
          )
        }
      >
        {attempts.length === 0 ? (
          <Empty>No attempts recorded yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-ink2">
                  <th scope="col" className="py-2 pr-3">Date</th>
                  <th scope="col" className="py-2 pr-3">Exercise</th>
                  <th scope="col" className="py-2 pr-3">Mode</th>
                  <th scope="col" className="py-2 pr-3">Score</th>
                  <th scope="col" className="py-2 pr-3">Result</th>
                  <th scope="col" className="py-2 pr-3">Checklist</th>
                  <th scope="col" className="py-2">Duration</th>
                </tr>
              </thead>
              <tbody>
                {attempts.slice(0, 50).map((a) => {
                  const label =
                    a.mode === 'quiz'
                      ? `${quizById(a.scenarioId)?.title ?? a.scenarioId} (quiz)`
                      : `${a.scenarioId} - ${scenarioById(a.scenarioId)?.title ?? ''}`;
                  return (
                    <tr key={a.id} className="border-b border-line/60">
                      <td className="value py-2 pr-3 text-xs text-ink2">{fmtDateTime(a.startedAt)}</td>
                      <td className="py-2 pr-3 text-ink">{label}</td>
                      <td className="py-2 pr-3">
                        <Badge tone={a.mode === 'assess' ? 'bad' : a.mode === 'quiz' ? 'acc' : 'neutral'}>
                          {a.mode}
                        </Badge>
                      </td>
                      <td className="value py-2 pr-3 text-ink">
                        {a.score == null ? '-' : a.mode === 'quiz' ? `${a.score}%` : a.score}
                      </td>
                      <td className="py-2 pr-3">
                        {a.passed == null ? (
                          <span className="text-ink2">-</span>
                        ) : (
                          <Badge tone={a.passed ? 'ok' : 'crit'}>{a.passed ? 'PASS' : 'FAIL'}</Badge>
                        )}
                        {a.critical && <div className="mt-1 text-[11px] text-crit">{a.critical}</div>}
                      </td>
                      <td className="value py-2 pr-3 text-ink2">
                        {a.mode === 'quiz' ? '-' : `${a.checklistPct}%`}
                      </td>
                      <td className="value py-2 text-ink2">
                        {a.mode === 'quiz' ? '-' : fmtTime(a.durationSec)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Data management">
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => fileRef.current?.click()}>Import JSON</Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportFile(f);
              e.target.value = '';
            }}
          />
          <Btn onClick={() => setConfirmReset(true)}>Regenerate demo cohort</Btn>
          <Btn variant="danger" onClick={() => { clearAll(); setImportMsg('All records cleared.'); }}>
            Clear all data
          </Btn>
        </div>
        {importMsg && <p className="mt-3 text-xs text-acc">{importMsg}</p>}
        <p className="mt-3 text-xs text-ink2">
          {SCENARIOS.length} scenarios · {data.trainees.length} trainees · {data.attempts.length} attempts stored.
        </p>
      </Card>

      <Modal open={showAdd} onOpenChange={setShowAdd} title="Add trainee">
        <Field label="Name">
          <input
            className="inp w-full"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. J. Doe"
            aria-label="Trainee name"
          />
        </Field>
        <div className="mt-4 flex justify-end gap-2">
          <Btn onClick={() => setShowAdd(false)}>Cancel</Btn>
          <Btn
            variant="primary"
            onClick={() => {
              if (addTrainee(newName, 'Operator', 'A')) {
                setNewName('');
                setShowAdd(false);
              }
            }}
          >
            Add
          </Btn>
        </div>
      </Modal>

      <Modal open={confirmReset} onOpenChange={setConfirmReset} title="Regenerate demo cohort?">
        <p className="text-sm text-ink2">
          This replaces all current trainees and attempts with the seeded 12-trainee demo cohort. Export a backup first if you need the current data.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Btn onClick={() => setConfirmReset(false)}>Cancel</Btn>
          <Btn
            variant="danger"
            onClick={() => {
              resetDemo();
              setConfirmReset(false);
            }}
          >
            Regenerate
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
