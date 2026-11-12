/**
 * App shell: navigation, the fixed-timestep simulation clock, top bar with
 * line status / speed / e-stop, theme handling and the E-stop hotkey.
 */
import { useEffect } from 'react';
import { useSim } from './sim/simulationStore';
import { useUi, type Screen } from './state/uiStore';
import { useRecords, activeTrainee } from './state/recordsStore';
import { OverviewScreen } from './screens/OverviewScreen';
import { ControlScreen } from './screens/ControlScreen';
import { AssessScreen, LearnScreen } from './screens/ScenarioScreens';
import { RecordsScreen } from './screens/RecordsScreen';
import { TrainerScreen } from './screens/TrainerScreen';
import { TrainingPackScreen } from './screens/TrainingPackScreen';
import { fmtTime } from './lib/format';
import { Badge } from './ui/primitives';

const NAV: { id: Screen; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Process overview and trends' },
  { id: 'control', label: 'Control Room', hint: 'Full HMI console' },
  { id: 'learn', label: 'Learn', hint: 'Guided practice scenarios' },
  { id: 'assess', label: 'Assess', hint: 'Scored fault-response exercises' },
  { id: 'records', label: 'Records', hint: 'Trainee history and exports' },
  { id: 'trainer', label: 'Trainer', hint: 'Cohort dashboard' },
  { id: 'pack', label: 'Training Pack', hint: 'SOPs, OPLs and quizzes' }
];

function Logo() {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
        <rect width="64" height="64" rx="14" fill="rgb(var(--c-surf2))" stroke="rgb(var(--c-line))" />
        <path d="M32 26 C 20 26, 12 34, 12 44 C 12 52, 18 56, 24 54 C 34 51, 40 44, 40 32 Z" fill="rgb(var(--c-ok))" />
        <path d="M32 26 C 44 26, 52 34, 52 44 C 52 52, 46 56, 40 54 C 30 51, 24 44, 24 32 Z" fill="rgb(var(--c-acc))" opacity="0.85" />
        <circle cx="32" cy="49" r="3" fill="rgb(var(--c-surf2))" />
      </svg>
      <div className="leading-tight">
        <div className="text-sm font-bold text-ink">GLT Trainer</div>
        <div className="text-[11px] text-ink2">Green Leaf Threshing line</div>
      </div>
    </div>
  );
}

function TopBar() {
  const s = useSim((st) => st.engine);
  const running = useSim((st) => st.running);
  const speed = useSim((st) => st.speed);
  const mode = useSim((st) => st.mode);
  const setSpeed = useSim((st) => st.setSpeed);
  const setRunning = useSim((st) => st.setRunning);
  const dispatch = useSim((st) => st.dispatch);
  const theme = useUi((st) => st.theme);
  const toggleTheme = useUi((st) => st.toggleTheme);
  const setScreen = useUi((st) => st.setScreen);
  const data = useRecords((st) => st.data);
  const activeId = useRecords((st) => st.activeTraineeId);
  const trainee = activeTrainee(data, activeId);

  const activeAlarms = s.alarms.filter((a) => a.status.startsWith('ACTIVE'));
  const unack = activeAlarms.filter((a) => a.status === 'ACTIVE_UNACK').length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        tone={
          s.lineState === 'RUNNING'
            ? 'ok'
            : s.lineState === 'ESTOP' || s.guardOpen
              ? 'crit'
              : s.lineState === 'MAINTENANCE' || s.lineState === 'STARTING'
                ? 'warn'
                : 'neutral'
        }
      >
        {s.lineState}
      </Badge>
      <span className="value text-xs text-ink2" aria-label="Simulation time">
        t={fmtTime(s.time)}
      </span>

      {mode === 'free' && (
        <button className="btn" onClick={() => setRunning(!running)} aria-pressed={running}>
          {running ? 'Pause sim' : 'Run sim'}
        </button>
      )}
      <label className="flex items-center gap-1 text-xs text-ink2">
        <span className="sr-only">Simulation speed</span>
        <select
          className="inp py-1 text-xs"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value) as 1 | 2 | 5)}
          aria-label="Simulation speed"
        >
          <option value={1}>1x</option>
          <option value={2}>2x</option>
          <option value={5}>5x</option>
        </select>
      </label>

      <button
        onClick={() => useUi.getState().setScreen('control')}
        className={`pill ${unack > 0 ? 'bg-crit/15 text-crit' : activeAlarms.length > 0 ? 'bg-warn/15 text-warn' : 'bg-surf2 text-ink2'}`}
        aria-label={`${activeAlarms.length} active alarms, ${unack} unacknowledged`}
      >
        {unack > 0 ? `${unack} unack alarm${unack === 1 ? '' : 's'}` : `${activeAlarms.length} active`}
      </button>

      <div className="ml-auto flex items-center gap-2">
        {trainee && (
          <button className="pill bg-surf2 text-ink2" onClick={() => setScreen('records')}>
            {trainee.name}
          </button>
        )}
        <button className="btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
          {theme === 'dark' ? 'Light' : 'Dark'}
        </button>
        <button
          className={`relative h-11 w-11 rounded-full border-4 text-[10px] font-black uppercase tracking-tight ${
            s.eStop
              ? 'border-crit bg-crit text-white alarm-blink'
              : 'border-bad bg-bad/90 text-white hover:bg-bad'
          }`}
          onClick={() => dispatch({ type: 'ESTOP_PRESS' })}
          disabled={s.eStop}
          aria-label="Emergency stop. Keyboard shortcut: E"
          title="Emergency stop (hotkey: E)"
        >
          E-Stop
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const screen = useUi((st) => st.screen);
  const setScreen = useUi((st) => st.setScreen);
  const theme = useUi((st) => st.theme);
  const tick = useSim((st) => st.tick);
  const dispatch = useSim((st) => st.dispatch);

  // Fixed-timestep simulation clock (10 Hz x speed multiplier).
  useEffect(() => {
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [tick]);

  // Theme <-> <html class="dark">
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // E-stop hotkey (ignored while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'e' && e.key !== 'E') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      dispatch({ type: 'ESTOP_PRESS' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <div className="flex min-h-screen bg-bg text-ink">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surf px-3 py-4 md:flex">
        <div className="mb-5 px-2">
          <Logo />
        </div>
        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setScreen(n.id)}
              aria-current={screen === n.id ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                screen === n.id
                  ? 'bg-acc/15 text-acc'
                  : 'text-ink2 hover:bg-surf2 hover:text-ink'
              }`}
              title={n.hint}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <footer className="px-3 text-[11px] leading-relaxed text-ink2">
          v0.1.0 · offline · local-only records
          <br />
          E-stop hotkey: E
        </footer>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-surf/95 px-4 py-2.5 backdrop-blur">
          <TopBar />
        </header>

        {/* Mobile navigation */}
        <nav
          aria-label="Main navigation"
          className="flex gap-1 overflow-x-auto border-b border-line bg-surf px-2 py-1.5 md:hidden"
        >
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setScreen(n.id)}
              aria-current={screen === n.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                screen === n.id ? 'bg-acc/15 text-acc' : 'text-ink2'
              }`}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-[1500px] flex-1 p-4">
          {screen === 'overview' && <OverviewScreen />}
          {screen === 'control' && <ControlScreen />}
          {screen === 'learn' && <LearnScreen />}
          {screen === 'assess' && <AssessScreen />}
          {screen === 'records' && <RecordsScreen />}
          {screen === 'trainer' && <TrainerScreen />}
          {screen === 'pack' && <TrainingPackScreen />}
        </main>
      </div>
    </div>
  );
}
