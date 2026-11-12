/**
 * Overview screen: line mimic, key process indicators, trends and the
 * alarm banner. The control room is one click away.
 */
import { useSim } from '../sim/simulationStore';
import { useUi } from '../state/uiStore';
import { AlarmBanner } from '../hmi/AlarmViews';
import { LineMimic } from '../hmi/LineMimic';
import { QuickControls } from '../hmi/ControlPanels';
import { Sparkline } from '../hmi/widgets';
import { Badge, Btn, Card, Kpi } from '../ui/primitives';
import { fmtTime } from '../lib/format';

export function OverviewScreen() {
  const s = useSim((st) => st.engine);
  const running = useSim((st) => st.running);
  const speed = useSim((st) => st.speed);
  const setScreen = useUi((st) => st.setScreen);
  const moistureTrend = s.trend.map((t) => t.moistureOut);
  const tempTrend = s.trend.map((t) => t.dryerTemp);
  const feedTrend = s.trend.map((t) => t.feedRate);

  return (
    <div className="grid gap-4">
      <Card
        title="Process overview"
        right={
          <div className="flex items-center gap-2">
            <Badge tone={running ? 'ok' : 'neutral'}>{running ? `RUNNING ${speed}x` : 'PAUSED'}</Badge>
            <span className="value text-xs text-ink2">t = {fmtTime(s.time)}</span>
          </div>
        }
      >
        <LineMimic s={s} />
      </Card>

      <AlarmBanner s={s} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Feed rate" value={Math.round(s.pv.feedRate)} unit="kg/h" />
        <Kpi
          label="Analyser"
          value={s.pv.moistureReading.toFixed(1)}
          unit="%"
          tone={s.sensorMode === 'reference' ? 'warn' : 'acc'}
          hint={s.sensorMode === 'reference' ? 'reference sensor' : 'inline sensor'}
        />
        <Kpi
          label="Packed moisture"
          value={s.pv.moistureOut.toFixed(1)}
          unit="%"
          tone={s.pv.moistureOut < 11.5 || s.pv.moistureOut > 13.5 ? 'warn' : 'ok'}
          hint="spec 11.5-13.5"
        />
        <Kpi
          label="Dryer temp"
          value={s.pv.dryerTemp.toFixed(0)}
          unit="°C"
          tone={s.pv.dryerTemp >= 115 ? 'crit' : s.pv.dryerTemp >= 100 ? 'bad' : 'ok'}
          hint="alarm at 100"
        />
        <Kpi
          label="NTRM"
          value={Math.round(s.pv.ntrm)}
          unit="ppm"
          tone={s.pv.ntrm > 1500 ? 'bad' : 'ok'}
          hint="limit 1500"
        />
        <Kpi label="Cases packed" value={s.pv.casesPacked} hint={`quality hold: ${s.quality.penaltyKg > 0 ? 'yes' : 'no'}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Packed moisture trend">
          <Sparkline
            data={moistureTrend}
            lo={8}
            hi={18}
            label="Outlet moisture"
            unit="%"
            dangerLo={11.5}
            dangerHi={13.5}
          />
          <p className="mt-2 text-xs text-ink2">Shaded band outside 11.5-13.5% counts against quality.</p>
        </Card>
        <Card title="Dryer temperature trend">
          <Sparkline
            data={tempTrend}
            lo={30}
            hi={140}
            label="Dryer temperature"
            unit="°C"
            dangerHi={100}
          />
          <p className="mt-2 text-xs text-ink2">High alarm 100 °C, critical 115 °C, fire risk 130 °C.</p>
        </Card>
        <Card title="Feed rate trend">
          <Sparkline data={feedTrend} lo={0} hi={8000} label="Feed rate" unit="kg/h" />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-ink2">Hopper {Math.round(s.pv.hopperLevel)}%</p>
            <Btn variant="primary" onClick={() => setScreen('control')}>
              Enter control room
            </Btn>
          </div>
        </Card>
      </div>

      <QuickControls />
    </div>
  );
}
