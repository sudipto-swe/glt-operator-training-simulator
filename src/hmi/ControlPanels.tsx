/**
 * Operator control panels for every station, the LOTO panel, maintenance
 * actions and the free-play fault injection panel. All controls dispatch
 * actions into the simulation store; the engine validates every command
 * (interlocks, LOTO requirements) and journals the outcome.
 */
import { useSim } from '../sim/simulationStore';
import type { SimState } from '../engine/types';
import { hasFault } from '../engine/faults';
import { FAULT_LIBRARY } from '../engine/faults';
import { SAMPLE_FRESH } from '../engine/constants';
import { Badge, Btn, Card } from '../ui/primitives';
import { Toggle } from '../ui/overlays';
import { LoadBar, LevelBar, ValuePill } from './widgets';

/* ------------------------------------------------------------------ */

function SpSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink2">{label}</span>
        <span className="value font-semibold text-ink">
          {Math.round(value)} <span className="text-ink2/70">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        className="w-full accent-acc disabled:opacity-40"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

function StationHeader({ title, running }: { title: string; running: boolean }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <Badge tone={running ? 'ok' : 'neutral'}>{running ? 'RUN' : 'OFF'}</Badge>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function QuickControls() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  const line = s.lineState;
  return (
    <Card title="Line control">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Btn
          variant="ok"
          onClick={() => dispatch({ type: 'LINE_START' })}
          disabled={line === 'RUNNING' || line === 'STARTING'}
        >
          Start line
        </Btn>
        <Btn
          onClick={() => dispatch({ type: 'LINE_STOP' })}
          disabled={line !== 'RUNNING' && line !== 'STARTING'}
        >
          Stop line
        </Btn>
        <Btn variant="danger" onClick={() => dispatch({ type: 'ESTOP_PRESS' })} disabled={s.eStop}>
          E-STOP
        </Btn>
        {s.eStop ? (
          <Btn variant="primary" onClick={() => dispatch({ type: 'ESTOP_RESET' })}>
            Reset e-stop
          </Btn>
        ) : (
          <Btn
            onClick={() => dispatch({ type: s.guardOpen ? 'GUARD_CLOSE' : 'GUARD_OPEN' })}
          >
            {s.guardOpen ? 'Close guard' : 'Open guard'}
          </Btn>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink2">
        <Badge tone={line === 'RUNNING' ? 'ok' : line === 'ESTOP' || s.guardOpen ? 'crit' : line === 'MAINTENANCE' ? 'warn' : 'neutral'}>
          {line}
        </Badge>
        {line === 'STARTING' && (
          <span className="value">purge {Math.round(s.startProgress * 100)}%</span>
        )}
        {s.loto !== 'NONE' && <Badge tone="warn">LOTO {s.loto}</Badge>}
        {s.guardOpen && <Badge tone="crit">guard open</Badge>}
      </div>
    </Card>
  );
}

export function IntakePanel() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  return (
    <Card title="Intake & Blending">
      <StationHeader title="Feed conveyor" running={s.inputs.feedEnabled && s.pv.feedRate > 10} />
      <div className="mb-3">
        <Toggle
          id="feed-toggle"
          label="Feed enabled"
          checked={s.inputs.feedEnabled}
          onCheckedChange={(v) => dispatch({ type: 'SET', key: 'feedEnabled', value: v })}
        />
      </div>
      <SpSlider
        label="Feed rate setpoint"
        value={s.inputs.feedRateSp}
        min={500}
        max={8000}
        step={100}
        unit="kg/h"
        onChange={(v) => dispatch({ type: 'SET', key: 'feedRateSp', value: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <ValuePill label="Actual" value={Math.round(s.pv.feedRate)} unit="kg/h" />
        <ValuePill
          label="Hopper"
          value={`${Math.round(s.pv.hopperLevel)}%`}
          tone={s.pv.hopperLevel >= 90 ? 'warn' : undefined}
        />
      </div>
    </Card>
  );
}

export function ConditioningPanel() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  const sampleFresh =
    s.sample != null && s.time - s.sample.takenAt <= SAMPLE_FRESH ? s.sample : null;
  return (
    <Card title="Conditioning">
      <StationHeader title="Steam & moisture" running={s.inputs.steamOn} />
      <div className="mb-3">
        <Toggle
          id="steam-toggle"
          label="Steam valve"
          checked={s.inputs.steamOn}
          onCheckedChange={(v) => dispatch({ type: 'SET', key: 'steamOn', value: v })}
        />
      </div>
      <SpSlider
        label="Moisture setpoint"
        value={s.inputs.moistureSp}
        min={15}
        max={24}
        step={0.5}
        unit="%"
        onChange={(v) => dispatch({ type: 'SET', key: 'moistureSp', value: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <ValuePill
          label={`Analyser (${s.sensorMode})`}
          value={s.pv.moistureReading.toFixed(1)}
          unit="%"
          tone={
            s.pv.moistureReading > 21.5 || s.pv.moistureReading < 17 ? 'warn' : undefined
          }
        />
        <div className="flex flex-col justify-between rounded-lg border border-line bg-surf2 px-3 py-2">
          <span className="text-[11px] uppercase tracking-wider text-ink2">Lab sample</span>
          {sampleFresh ? (
            <span className={`value text-sm font-semibold ${Math.abs(sampleFresh.value - s.pv.moistureReading) > 1 ? 'text-crit' : 'text-ok'}`}>
              {sampleFresh.value.toFixed(1)}%
            </span>
          ) : (
            <button className="self-start text-xs text-acc underline" onClick={() => dispatch({ type: 'TAKE_SAMPLE' })}>
              take sample
            </button>
          )}
        </div>
      </div>
      {sampleFresh && Math.abs(sampleFresh.value - s.pv.moistureReading) > 1 && (
        <p className="mt-2 text-xs font-medium text-crit">
          Display disagrees with lab by {(sampleFresh.value - s.pv.moistureReading).toFixed(1)} pts - treat the analyser as suspect.
        </p>
      )}
    </Card>
  );
}

export function ThresherPanel() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  return (
    <Card title="Threshing & Air Separation">
      <StationHeader title="Thresher cage" running={s.inputs.thresherOn} />
      <div className="mb-3">
        <Toggle
          id="thresher-toggle"
          label="Thresher motor"
          checked={s.inputs.thresherOn}
          onCheckedChange={(v) => dispatch({ type: 'SET', key: 'thresherOn', value: v })}
        />
      </div>
      <SpSlider
        label="Cage speed setpoint"
        value={s.inputs.thresherSpeedSp}
        min={600}
        max={1200}
        step={10}
        unit="rpm"
        onChange={(v) => dispatch({ type: 'SET', key: 'thresherSpeedSp', value: v })}
      />
      <LoadBar label="Motor load" value={s.pv.thresherCurrent} />
      <div className="mt-3 mb-3">
        <Toggle
          id="airsep-toggle"
          label="Air separator fan"
          checked={s.inputs.airSepOn}
          onCheckedChange={(v) => dispatch({ type: 'SET', key: 'airSepOn', value: v })}
        />
      </div>
      <SpSlider
        label="Air velocity setpoint"
        value={s.inputs.airVelocitySp}
        min={14}
        max={26}
        step={0.5}
        unit="m/s"
        onChange={(v) => dispatch({ type: 'SET', key: 'airVelocitySp', value: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <ValuePill label="Air velocity" value={s.pv.airVelocity.toFixed(1)} unit="m/s" />
        <ValuePill
          label="Stem in lamina"
          value={s.pv.stemInLamina.toFixed(1)}
          unit="%"
          tone={s.pv.stemInLamina > 4 ? 'warn' : 'ok'}
        />
      </div>
    </Card>
  );
}

export function DryerPanel() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  const temp = s.pv.dryerTemp;
  return (
    <Card title="Drying">
      <StationHeader title="Lamina dryer" running={s.inputs.dryerOn} />
      <div className="mb-3">
        <Toggle
          id="dryer-toggle"
          label="Dryer heater"
          checked={s.inputs.dryerOn}
          onCheckedChange={(v) => dispatch({ type: 'SET', key: 'dryerOn', value: v })}
        />
      </div>
      <SpSlider
        label="Temperature setpoint"
        value={s.inputs.dryerTempSp}
        min={60}
        max={110}
        step={1}
        unit="°C"
        onChange={(v) => dispatch({ type: 'SET', key: 'dryerTempSp', value: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <ValuePill
          label="Dryer temp"
          value={temp.toFixed(0)}
          unit="°C"
          tone={temp >= 115 ? 'crit' : temp >= 100 ? 'bad' : temp > 95 ? 'warn' : 'ok'}
        />
        <ValuePill
          label="Outlet moisture"
          value={s.pv.moistureOut.toFixed(1)}
          unit="%"
          tone={
            s.pv.moistureOut < 11.5 || s.pv.moistureOut > 13.5 ? 'warn' : 'ok'
          }
        />
      </div>
    </Card>
  );
}

export function PackingPanel() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  return (
    <Card title="Packing">
      <StationHeader title="Case packer" running={s.inputs.packingOn} />
      <div className="mb-3">
        <Toggle
          id="packing-toggle"
          label="Packing line"
          checked={s.inputs.packingOn}
          onCheckedChange={(v) => dispatch({ type: 'SET', key: 'packingOn', value: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ValuePill label="Cases packed" value={s.pv.casesPacked} />
        <ValuePill
          label="Current case"
          value={s.pv.caseWeight.toFixed(0)}
          unit="/ 200 kg"
        />
      </div>
      <div className="mt-3">
        <LevelBar label="Case fill" value={(s.pv.caseWeight / 200) * 100} warnAt={101} />
      </div>
    </Card>
  );
}

export function LotoPanel() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  const steps: { label: string; action: 'LOTO_ISOLATE' | 'LOTO_LOCK' | 'LOTO_VERIFY' | 'LOTO_REMOVE'; enabled: boolean; hint: string }[] = [
    {
      label: '1. Isolate energy',
      action: 'LOTO_ISOLATE',
      enabled: s.loto === 'NONE' && (s.lineState === 'STOPPED' || s.lineState === 'OFF'),
      hint: 'Line must be stopped first'
    },
    { label: '2. Lock & tag', action: 'LOTO_LOCK', enabled: s.loto === 'ISOLATED', hint: 'Requires isolation' },
    { label: '3. Verify zero energy', action: 'LOTO_VERIFY', enabled: s.loto === 'LOCKED', hint: 'Requires lock' },
    { label: '4. Remove locks', action: 'LOTO_REMOVE', enabled: s.loto !== 'NONE', hint: 'Restore to stopped' }
  ];
  return (
    <Card title="Lockout-Tagout (LOTO)">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-ink2">State:</span>
        <Badge tone={s.loto === 'VERIFIED' ? 'ok' : s.loto !== 'NONE' ? 'warn' : 'neutral'}>
          {s.loto === 'NONE' ? 'Not applied' : s.loto}
        </Badge>
      </div>
      <div className="grid gap-2">
        {steps.map((st) => (
          <Btn
            key={st.action}
            block
            disabled={!st.enabled}
            onClick={() => dispatch({ type: st.action })}
          >
            {st.label}
          </Btn>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink2">
        Body-in-equipment work (clearing jams, valve or heater repair) is only legal in the VERIFIED state.
      </p>
    </Card>
  );
}

export function MaintenancePanel() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  const line = s.lineState;
  const lineDown = line === 'STOPPED' || line === 'OFF' || line === 'MAINTENANCE' || line === 'ESTOP';

  const actions: { label: string; onClick: () => void; enabled: boolean; reason: string }[] = [
    {
      label: 'Clear feed jam',
      onClick: () => dispatch({ type: 'CLEAR_JAM' }),
      enabled: hasFault(s, 'FEED_JAM'),
      reason: 'no jam present'
    },
    {
      label: 'Repair steam valve',
      onClick: () => dispatch({ type: 'REPAIR_VALVE' }),
      enabled: hasFault(s, 'COND_VALVE_STUCK'),
      reason: 'valve operating normally'
    },
    {
      label: 'Repair dryer heater',
      onClick: () => dispatch({ type: 'REPAIR_HEATER' }),
      enabled: hasFault(s, 'DRYER_HEATER_FAULT'),
      reason: 'heater circuit healthy'
    },
    {
      label: 'Reset thresher motor',
      onClick: () => dispatch({ type: 'RESET_MOTOR' }),
      enabled: hasFault(s, 'THRESHER_OVERLOAD'),
      reason: 'motor protection healthy'
    },
    {
      label: 'Sort intake (NTRM)',
      onClick: () => dispatch({ type: 'SORT_INTAKE' }),
      enabled: hasFault(s, 'NTRM_SPIKE') && !s.inputs.feedEnabled,
      reason: 'requires NTRM spike + feed stopped'
    },
    {
      label: 'Recalibrate analyser',
      onClick: () => dispatch({ type: 'RECAL_SENSOR' }),
      enabled: hasFault(s, 'SENSOR_DRIFT') && lineDown,
      reason: 'requires drift + line stopped'
    },
    {
      label: `Sensor mode: ${s.sensorMode === 'auto' ? 'switch to reference' : 'back to auto'}`,
      onClick: () =>
        dispatch({ type: 'SENSOR_MODE', mode: s.sensorMode === 'auto' ? 'reference' : 'auto' }),
      enabled: true,
      reason: ''
    }
  ];

  return (
    <Card title="Maintenance & sampling">
      <div className="grid gap-2 sm:grid-cols-2">
        {actions.map((a) => (
          <div key={a.label}>
            <Btn block disabled={!a.enabled} onClick={a.onClick}>
              {a.label}
            </Btn>
            {!a.enabled && a.reason && <p className="mt-1 text-[11px] text-ink2">{a.reason}</p>}
          </div>
        ))}
      </div>
      {s.maintenance && (
        <p className="mt-3 text-xs text-warn">
          Sorting crew working at intake ({Math.max(0, Math.ceil(s.maintenance.doneAt - s.time))} s remaining)...
        </p>
      )}
      <p className="mt-3 text-xs text-ink2">
        Repairs inside equipment require LOTO = VERIFIED. The motor breaker reset requires the line stopped.
      </p>
    </Card>
  );
}

/** Free-play fault injection (trainer / exploration). Scenario runs only. */
export function FaultPanel() {
  const s = useSim((st) => st.engine);
  const mode = useSim((st) => st.mode);
  const dispatch = useSim((st) => st.dispatch);
  if (mode !== 'free') return null;
  return (
    <Card title="Fault injection (free play)">
      <div className="grid gap-2 sm:grid-cols-2">
        {FAULT_LIBRARY.map((f) => (
          <Btn
            key={f.id}
            disabled={hasFault(s, f.id)}
            onClick={() => dispatch({ type: 'INJECT_FAULT', fault: f.id })}
          >
            {f.title}
          </Btn>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-ink2">
          Faults develop gradually - watch the trends. Use the Maintenance panel to repair them.
        </p>
        <Btn onClick={() => dispatch({ type: 'CLEAR_ALL_FAULTS' })} disabled={s.faults.length === 0}>
          Clear all
        </Btn>
      </div>
    </Card>
  );
}

/** Compact PV strip used on scenario run screens. */
export function StatusStrip({ s }: { s: SimState }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <ValuePill label="Line" value={s.lineState} tone={s.lineState === 'RUNNING' ? 'ok' : s.lineState === 'ESTOP' ? 'crit' : undefined} />
      <ValuePill label="Feed" value={Math.round(s.pv.feedRate)} unit="kg/h" />
      <ValuePill label="Moisture (analyser)" value={s.pv.moistureReading.toFixed(1)} unit="%" />
      <ValuePill
        label="Packed moisture"
        value={s.pv.moistureOut.toFixed(1)}
        unit="%"
        tone={s.pv.moistureOut < 11.5 || s.pv.moistureOut > 13.5 ? 'warn' : 'ok'}
      />
      <ValuePill
        label="Dryer"
        value={s.pv.dryerTemp.toFixed(0)}
        unit="°C"
        tone={s.pv.dryerTemp >= 115 ? 'crit' : s.pv.dryerTemp >= 100 ? 'bad' : s.pv.dryerTemp > 95 ? 'warn' : 'ok'}
      />
      <ValuePill
        label="NTRM"
        value={Math.round(s.pv.ntrm)}
        unit="ppm"
        tone={s.pv.ntrm > 1500 ? 'bad' : 'ok'}
      />
    </div>
  );
}

/** The full control room, reused by the Control screen and scenario runs. */
export function ControlCore({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`grid gap-4 ${compact ? 'lg:grid-cols-3' : 'md:grid-cols-2 xl:grid-cols-3'}`}>
      <div className="grid gap-4">
        <QuickControls />
        <IntakePanel />
        <ConditioningPanel />
      </div>
      <div className="grid gap-4">
        <ThresherPanel />
        <DryerPanel />
        <PackingPanel />
      </div>
      <div className="grid gap-4">
        <LotoPanel />
        <MaintenancePanel />
        <FaultPanel />
      </div>
    </div>
  );
}
