/**
 * Alarm banner (global, always visible when alarms exist) and the full
 * alarm table with acknowledge controls.
 */
import type { Alarm, AlarmPriority, SimState } from '../engine/types';
import { PRIORITY_ORDER, topAlarm } from '../engine/alarms';
import { useSim } from '../sim/simulationStore';
import { Badge, Empty } from '../ui/primitives';
import { fmtTime } from '../lib/format';

export function priorityTone(p: AlarmPriority): 'crit' | 'bad' | 'warn' | 'acc' {
  return p === 'CRITICAL' ? 'crit' : p === 'HIGH' ? 'bad' : p === 'MEDIUM' ? 'warn' : 'acc';
}

export function AlarmBanner({ s }: { s: SimState }) {
  const top = topAlarm(s);
  const unack = s.alarms.filter((a) => a.status.includes('UNACK')).length;
  if (!top) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surf2 px-3 py-2 text-sm text-ink2">
        <span aria-hidden>●</span> No active alarms
      </div>
    );
  }
  const tone = priorityTone(top.priority);
  const bg = tone === 'crit' ? 'border-crit' : tone === 'bad' ? 'border-bad' : 'border-warn';
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 rounded-lg border-l-4 ${bg} bg-surf2 px-3 py-2`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Badge tone={tone}>{top.priority}</Badge>
        <span className={`truncate text-sm font-medium ${top.status === 'ACTIVE_UNACK' && top.priority === 'CRITICAL' ? 'alarm-blink rounded px-1' : ''}`}>
          {top.message}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {unack > 0 && <Badge tone="bad">{unack} unack</Badge>}
        <span className="value text-xs text-ink2">since {fmtTime(top.since)}</span>
      </div>
    </div>
  );
}

export function AlarmTable() {
  const s = useSim((st) => st.engine);
  const dispatch = useSim((st) => st.dispatch);
  const alarms = [...s.alarms].sort(
    (a, b) =>
      Number(b.status.includes('UNACK')) - Number(a.status.includes('UNACK')) ||
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      b.since - a.since
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-ink2">
          {alarms.length} alarm{alarms.length === 1 ? '' : 's'} in the list
        </p>
        <button
          className="btn"
          onClick={() => dispatch({ type: 'ACK_ALARM', code: 'ALL' })}
          disabled={alarms.length === 0}
        >
          Ack all
        </button>
      </div>
      {alarms.length === 0 ? (
        <Empty>No alarms. Enjoy it while it lasts.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wider text-ink2">
                <th scope="col" className="py-2 pr-3">Priority</th>
                <th scope="col" className="py-2 pr-3">Message</th>
                <th scope="col" className="py-2 pr-3">Since</th>
                <th scope="col" className="py-2 pr-3">State</th>
                <th scope="col" className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {alarms.map((a: Alarm) => (
                <tr
                  key={a.code}
                  className={`border-b border-line/60 ${a.status === 'ACTIVE_UNACK' && a.priority === 'CRITICAL' ? 'alarm-blink' : ''}`}
                >
                  <td className="py-2 pr-3">
                    <Badge tone={priorityTone(a.priority)}>{a.priority}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-ink">{a.message}</div>
                    <div className="value text-xs text-ink2">{a.code}</div>
                  </td>
                  <td className="value py-2 pr-3 text-ink2">{fmtTime(a.since)}</td>
                  <td className="py-2 pr-3">
                    {a.status === 'ACTIVE_UNACK' && <Badge tone="bad">Active</Badge>}
                    {a.status === 'ACTIVE_ACK' && <Badge tone="warn">Active, acked</Badge>}
                    {a.status === 'CLEARED_UNACK' && <Badge tone="ok">RTN</Badge>}
                  </td>
                  <td className="py-2 text-right">
                    {a.status.includes('UNACK') && (
                      <button
                        className="btn"
                        onClick={() => dispatch({ type: 'ACK_ALARM', code: a.code })}
                      >
                        Ack
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
