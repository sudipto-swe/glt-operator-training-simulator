/**
 * Learn and Assess screens: scenario picker cards plus the shared
 * scenario run view (mimic + status + control room + coach/objectives).
 * Assess is gated on the scenario's module quiz (pass >= 80%).
 */
import { scenarioById } from '../data/scenarios';
import { SCENARIOS } from '../data/scenarios';
import { quizById } from '../data/trainingPack';
import { useSim } from '../sim/simulationStore';
import { useRecords, activeTrainee, assessUnlocked } from '../state/recordsStore';
import { useUi } from '../state/uiStore';
import { Badge, Btn, Card, Empty } from '../ui/primitives';
import { LineMimic } from '../hmi/LineMimic';
import { AlarmBanner } from '../hmi/AlarmViews';
import { ControlCore, StatusStrip } from '../hmi/ControlPanels';
import { CoachPanel, EventLog, ObjectivesPanel, ScoreReportModal } from '../hmi/RunViews';
import { fmtTime } from '../lib/format';

const DIFF_TONE = { basic: 'ok', intermediate: 'warn', advanced: 'bad' } as const;

function ScenarioPicker({
  mode,
  onStart
}: {
  mode: 'learn' | 'assess';
  onStart: (id: string) => void;
}) {
  const data = useRecords((st) => st.data);
  const activeId = useRecords((st) => st.activeTraineeId);
  const trainee = activeTrainee(data, activeId);
  const runtime = useSim((st) => st.runtime);
  const setScreen = useUi((st) => st.setScreen);

  return (
    <div className="grid gap-4">
      {!trainee && mode === 'assess' && (
        <Empty>Select or create a trainee in Records first - assess attempts are logged per trainee.</Empty>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SCENARIOS.filter((sc) => sc.modes.includes(mode)).map((sc) => {
          const unlocked = mode === 'learn' || assessUnlocked(trainee, sc.id);
          const quiz = quizById(sc.requiredQuiz);
          const isActive = runtime?.scenarioId === sc.id && runtime.endedAt == null;
          return (
            <Card
              key={sc.id}
              title={`${sc.id} - ${sc.title}`}
              right={<Badge tone={DIFF_TONE[sc.difficulty]}>{sc.difficulty}</Badge>}
            >
              <p className="mb-3 min-h-[3.5rem] text-sm text-ink2">{sc.brief}</p>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-ink2">
                <span className="value">{Math.round(sc.durationSec / 60)} min</span>
                <span aria-hidden>·</span>
                <span>{sc.steps.length} steps</span>
                {mode === 'assess' && (
                  <>
                    <span aria-hidden>·</span>
                    <span>pass {sc.passMark}%</span>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                {unlocked ? (
                  <Btn variant={mode === 'assess' ? 'danger' : 'primary'} onClick={() => onStart(sc.id)}>
                    {mode === 'learn' ? 'Start practice' : 'Start assessment'}
                  </Btn>
                ) : (
                  <div>
                    <Btn disabled>Locked</Btn>
                    <p className="mt-1 text-xs text-ink2">
                      Pass the <button className="text-acc underline" onClick={() => setScreen('pack')}>{quiz?.title}</button> quiz first
                    </p>
                  </div>
                )}
                {isActive && <Badge tone="warn">in progress</Badge>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ScenarioRun({ onExit }: { onExit: () => void }) {
  const s = useSim((st) => st.engine);
  const runtime = useSim((st) => st.runtime);
  const mode = useSim((st) => st.mode);
  const endScenario = useSim((st) => st.endScenario);
  if (!runtime) return null;
  const sc = scenarioById(runtime.scenarioId);
  if (!sc) return null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Badge tone={mode === 'assess' ? 'bad' : 'acc'}>
            {mode === 'assess' ? 'ASSESS' : 'LEARN'}
          </Badge>
          <span className="value text-sm text-ink2">
            {sc.id} · t = {fmtTime(s.time)} / {fmtTime(sc.durationSec)}
          </span>
        </div>
        <Btn onClick={onExit}>Leave exercise</Btn>
      </div>

      <StatusStrip s={s} />
      <AlarmBanner s={s} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Line" className="xl:col-span-2">
          <LineMimic s={s} compact />
        </Card>
        {mode === 'learn' ? (
          <CoachPanel sc={sc} rt={runtime} onEnd={endScenario} />
        ) : (
          <ObjectivesPanel sc={sc} rt={runtime} onEnd={endScenario} />
        )}
      </div>

      <ControlCore compact />

      <Card title="Event log">
        <EventLog s={s} />
      </Card>
    </div>
  );
}

function ScenarioScreenBody({ mode }: { mode: 'learn' | 'assess' }) {
  const runtime = useSim((st) => st.runtime);
  const simMode = useSim((st) => st.mode);
  const startScenario = useSim((st) => st.startScenario);
  const abortScenario = useSim((st) => st.abortScenario);
  const resetSim = useSim((st) => st.resetSim);

  const inRun = runtime != null && runtime.endedAt == null && simMode === mode;

  if (inRun) {
    return (
      <>
        <ScenarioRun
          onExit={() => {
            abortScenario();
            resetSim();
          }}
        />
        <ScoreReportModal />
      </>
    );
  }

  // A finished run keeps its report open until closed; show the picker below it.
  return (
    <>
      <ScenarioPicker
        mode={mode}
        onStart={(id) => startScenario(id, mode)}
      />
      <ScoreReportModal />
    </>
  );
}

export function LearnScreen() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-lg font-bold text-ink">Learn - guided practice</h1>
        <p className="text-sm text-ink2">
          Guided exercises with step-by-step coaching. Not scored - practise until the sequence is second nature.
        </p>
      </header>
      <ScenarioScreenBody mode="learn" />
    </div>
  );
}

export function AssessScreen() {
  return (
    <div>
      <header className="mb-4">
        <h1 className="text-lg font-bold text-ink">Assess - scored exercises</h1>
        <p className="text-sm text-ink2">
          Faults arrive on a fixed schedule with no hints. Scored 0-100 (Safety 40 / Procedure 30 / Quality 20 / Response 10).
          Critical violations fail the attempt.
        </p>
      </header>
      <ScenarioScreenBody mode="assess" />
    </div>
  );
}
