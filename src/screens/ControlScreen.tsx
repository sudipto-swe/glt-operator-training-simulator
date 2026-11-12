/**
 * Control room: every station panel, LOTO, maintenance, the alarm table
 * and the event log in one console.
 */
import { useSim } from '../sim/simulationStore';
import { AlarmBanner, AlarmTable } from '../hmi/AlarmViews';
import { ControlCore } from '../hmi/ControlPanels';
import { EventLog } from '../hmi/RunViews';
import { Card } from '../ui/primitives';

export function ControlScreen() {
  const s = useSim((st) => st.engine);
  return (
    <div className="grid gap-4">
      <AlarmBanner s={s} />
      <ControlCore />
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Alarm list">
          <AlarmTable />
        </Card>
        <Card title="Event log">
          <EventLog s={s} />
        </Card>
      </div>
    </div>
  );
}
