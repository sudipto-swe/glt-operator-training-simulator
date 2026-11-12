/**
 * Training Pack: SOPs, OPLs and quizzes rendered from one data source.
 * Printable to PDF via the browser print dialog; quiz passes are recorded
 * and gate Assess mode.
 */
import { useMemo, useState } from 'react';
import { PACK_DOCS, QUIZZES, type PackDoc, type Quiz } from '../data/trainingPack';
import { activeTrainee, useRecords } from '../state/recordsStore';
import { Badge, Btn, Card, Progress } from '../ui/primitives';
import { TabsShell } from '../ui/overlays';

/* ---------------- document viewer ---------------- */

function DocView({ doc }: { doc: PackDoc }) {
  return (
    <article className="print-doc">
      <header className="mb-4 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <Badge tone={doc.type === 'SOP' ? 'acc' : 'ok'}>{doc.type}</Badge>
          <span className="value text-xs text-ink2">{doc.id}</span>
        </div>
        <h3 className="mt-2 text-base font-bold text-ink">{doc.title}</h3>
        <p className="mt-1 text-sm text-ink2">{doc.purpose}</p>
      </header>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink2">Procedure</h4>
      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-sm text-ink">
        {doc.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      {doc.warnings.length > 0 && (
        <>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-bad">Warnings</h4>
          <ul className="mb-4 space-y-1.5">
            {doc.warnings.map((w, i) => (
              <li key={i} className="rounded-lg border-l-4 border-bad bg-bad/10 px-3 py-2 text-sm text-ink">
                {w}
              </li>
            ))}
          </ul>
        </>
      )}
      <footer className="text-xs text-ink2">
        Related scenarios: {doc.related.join(', ')}
      </footer>
    </article>
  );
}

/* ---------------- quiz runner ---------------- */

function QuizRunner({ quiz }: { quiz: Quiz }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const data = useRecords((st) => st.data);
  const activeId = useRecords((st) => st.activeTraineeId);
  const recordQuiz = useRecords((st) => st.recordQuiz);
  const trainee = activeTrainee(data, activeId);

  const correct = useMemo(
    () => quiz.questions.filter((q) => answers[q.id] === q.answer).length,
    [answers, quiz]
  );
  const answeredAll = quiz.questions.every((q) => answers[q.id] != null);
  const pctScore = Math.round((correct / quiz.questions.length) * 100);
  const passed = pctScore >= quiz.passPct;

  const submit = () => {
    setSubmitted(true);
    if (trainee) recordQuiz(trainee.id, quiz.id, pctScore, passed);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink">{quiz.title}</h3>
          <p className="text-sm text-ink2">{quiz.description}</p>
        </div>
        <Badge tone="acc">
          pass ≥ {quiz.passPct}% · {quiz.questions.length} questions
        </Badge>
      </div>

      {trainee ? (
        <p className="mb-4 text-xs text-ink2">
          Recording for <span className="font-semibold text-ink">{trainee.name}</span>.
          {trainee.passedQuizzes.includes(quiz.id) && (
            <span className="ml-1 font-semibold text-ok"> Already passed - retake anytime.</span>
          )}
        </p>
      ) : (
        <p className="mb-4 text-xs text-warn">
          No active trainee selected - your result will not be recorded (see Records screen).
        </p>
      )}

      <ol className="space-y-4">
        {quiz.questions.map((q, qi) => {
          const picked = answers[q.id];
          return (
            <li key={q.id} className="panel panel-pad">
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-ink">
                  {qi + 1}. {q.q}
                </legend>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => {
                    const isPicked = picked === oi;
                    const isRight = submitted && oi === q.answer;
                    const isWrongPick = submitted && isPicked && oi !== q.answer;
                    return (
                      <label
                        key={oi}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                          isRight
                            ? 'border-ok bg-ok/10 text-ink'
                            : isWrongPick
                              ? 'border-bad bg-bad/10 text-ink'
                              : isPicked
                                ? 'border-acc bg-acc/10 text-ink'
                                : 'border-line text-ink hover:bg-surf2'
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={isPicked}
                          disabled={submitted}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                        />
                        {opt}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {submitted && (
                <p className="mt-2 text-xs text-ink2">
                  <span className="font-semibold text-ink">Explanation: </span>
                  {q.explain}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      {!submitted ? (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-ink2">
            {Object.keys(answers).length}/{quiz.questions.length} answered
          </span>
          <Btn variant="primary" disabled={!answeredAll} onClick={submit}>
            Submit quiz
          </Btn>
        </div>
      ) : (
        <div className="mt-4 panel panel-pad">
          <div className="mb-2 flex items-center gap-3">
            <Badge tone={passed ? 'ok' : 'crit'}>{passed ? 'PASSED' : 'NOT PASSED'}</Badge>
            <span className="value text-xl font-bold text-ink">{pctScore}%</span>
            <span className="text-xs text-ink2">
              {correct}/{quiz.questions.length} correct
            </span>
          </div>
          <Progress value={pctScore} tone={passed ? 'ok' : 'bad'} label="Quiz score" />
          <div className="mt-3 flex gap-2">
            <Btn
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
            >
              Retake
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- screen ---------------- */

export function TrainingPackScreen() {
  const [tab, setTab] = useState('sops');
  const [docId, setDocId] = useState<string>(PACK_DOCS[0].id);
  const [quizId, setQuizId] = useState<string | null>(null);

  const doc = PACK_DOCS.find((d) => d.id === docId) ?? PACK_DOCS[0];
  const quiz = quizId ? QUIZZES.find((q) => q.id === quizId) : null;

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-ink">Training pack</h1>
          <p className="text-sm text-ink2">
            SOPs, one-point lessons and quizzes. Print documents or complete quizzes to unlock Assess scenarios.
          </p>
        </div>
        <Btn onClick={() => window.print()} disabled={tab === 'quizzes'}>
          Print document
        </Btn>
      </header>

      <TabsShell
        value={tab}
        onValueChange={setTab}
        tabs={[
          { value: 'sops', label: 'SOPs' },
          { value: 'opls', label: 'OPLs' },
          { value: 'quizzes', label: 'Quizzes' }
        ]}
      >
        {tab === 'sops' && (
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <Card title="Standard operating procedures">
              <ul className="space-y-1">
                {PACK_DOCS.filter((d) => d.type === 'SOP').map((d) => (
                  <li key={d.id}>
                    <button
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        d.id === docId ? 'bg-acc/10 font-medium text-acc' : 'text-ink hover:bg-surf2'
                      }`}
                      onClick={() => setDocId(d.id)}
                    >
                      {d.id} - {d.title}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <DocView doc={doc} />
            </Card>
          </div>
        )}

        {tab === 'opls' && (
          <div className="grid gap-4 md:grid-cols-[260px_1fr]">
            <Card title="One-point lessons">
              <ul className="space-y-1">
                {PACK_DOCS.filter((d) => d.type === 'OPL').map((d) => (
                  <li key={d.id}>
                    <button
                      className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                        d.id === docId ? 'bg-acc/10 font-medium text-acc' : 'text-ink hover:bg-surf2'
                      }`}
                      onClick={() => setDocId(d.id)}
                    >
                      {d.id} - {d.title}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <DocView doc={doc} />
            </Card>
          </div>
        )}

        {tab === 'quizzes' && (
          <div>
            {quiz ? (
              <Card>
                <div className="mb-4">
                  <button className="text-xs text-acc underline" onClick={() => setQuizId(null)}>
                    ← all quizzes
                  </button>
                </div>
                <QuizRunner quiz={quiz} />
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {QUIZZES.map((q) => (
                  <Card key={q.id} title={q.title}>
                    <p className="mb-3 min-h-[3rem] text-sm text-ink2">{q.description}</p>
                    <Btn variant="primary" block onClick={() => setQuizId(q.id)}>
                      Start quiz
                    </Btn>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </TabsShell>
    </div>
  );
}
