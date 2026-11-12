/**
 * Line mimic: SVG process diagram of the GLT line with live values,
 * per-station status and animated conveyors (animation honours
 * prefers-reduced-motion via CSS).
 */
import type { SimState } from '../engine/types';

interface StationBox {
  id: string;
  name: string;
  x: number;
  values: (s: SimState) => { label: string; text: string }[];
  alarmFor: (s: SimState) => boolean;
}

const STATIONS: StationBox[] = [
  {
    id: 'intake',
    name: 'Intake & Blending',
    x: 24,
    values: (s) => [
      { label: 'Hopper', text: `${Math.round(s.pv.hopperLevel)}%` },
      { label: 'Feed', text: `${Math.round(s.pv.feedRate)} kg/h` }
    ],
    alarmFor: (s) => s.alarms.some((a) => ['HOPPER_HIGH', 'FEED_JAM'].includes(a.code) && a.status.startsWith('ACTIVE'))
  },
  {
    id: 'conditioning',
    name: 'Conditioning',
    x: 222,
    values: (s) => [
      { label: 'Moisture', text: `${s.pv.moistureReading.toFixed(1)}%` },
      { label: 'Steam', text: s.inputs.steamOn ? 'ON' : 'off' }
    ],
    alarmFor: (s) =>
      s.alarms.some(
        (a) => ['COND_MOIST_HIGH', 'COND_MOIST_LOW', 'SENSOR_DEV'].includes(a.code) && a.status.startsWith('ACTIVE')
      )
  },
  {
    id: 'threshing',
    name: 'Threshing & Air Sep',
    x: 420,
    values: (s) => [
      { label: 'Cage', text: `${Math.round(s.pv.thresherSpeed)} rpm` },
      { label: 'Load', text: `${Math.round(s.pv.thresherCurrent)}%` }
    ],
    alarmFor: (s) =>
      s.alarms.some(
        (a) => ['THRESHER_OVERLOAD', 'AIRFLOW_DEV'].includes(a.code) && a.status.startsWith('ACTIVE')
      )
  },
  {
    id: 'drying',
    name: 'Drying',
    x: 618,
    values: (s) => [
      { label: 'Temp', text: `${s.pv.dryerTemp.toFixed(0)} °C` },
      { label: 'Out moist', text: `${s.pv.moistureOut.toFixed(1)}%` }
    ],
    alarmFor: (s) =>
      s.alarms.some((a) => a.code.startsWith('DRYER_TEMP') && a.status.startsWith('ACTIVE'))
  },
  {
    id: 'packing',
    name: 'Packing',
    x: 816,
    values: (s) => [
      { label: 'Cases', text: `${s.pv.casesPacked}` },
      { label: 'NTRM', text: `${Math.round(s.pv.ntrm)} ppm` }
    ],
    alarmFor: (s) => s.alarms.some((a) => a.code === 'NTRM_HIGH' && a.status.startsWith('ACTIVE'))
  }
];

const BOX_W = 160;
const BOX_Y = 86;
const BOX_H = 118;
const CONV_Y = 148;

function statusOf(s: SimState): 'run' | 'warn' | 'stop' {
  const running = s.lineState === 'RUNNING' || s.lineState === 'STARTING';
  if (s.lineState === 'ESTOP') return 'warn';
  if (running && s.alarms.some((a) => a.status.startsWith('ACTIVE'))) return 'warn';
  return running ? 'run' : 'stop';
}

export function LineMimic({ s, compact = false }: { s: SimState; compact?: boolean }) {
  const st = statusOf(s);
  const flowing = st === 'run';
  const stroke = st === 'run' ? 'ok' : st === 'warn' ? 'warn' : 'line';
  const summary = `GLT line mimic: ${s.lineState}. Hopper ${Math.round(s.pv.hopperLevel)} percent, feed ${Math.round(
    s.pv.feedRate
  )} kg/h, moisture ${s.pv.moistureReading.toFixed(1)} percent, dryer ${s.pv.dryerTemp.toFixed(0)} degrees C, ${s.pv.casesPacked} cases packed.`;

  return (
    <svg
      viewBox="0 0 1000 240"
      className="w-full"
      role="img"
      aria-label={summary}
      style={{ maxHeight: compact ? 190 : 260 }}
    >
      {/* Station connectors (conveyors) */}
      {STATIONS.slice(0, -1).map((stn, i) => {
        const x1 = stn.x + BOX_W;
        const x2 = STATIONS[i + 1].x;
        return (
          <g key={stn.id}>
            <line
              x1={x1}
              y1={CONV_Y}
              x2={x2}
              y2={CONV_Y}
              stroke="rgb(var(--c-line))"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {flowing && (
              <line
                x1={x1}
                y1={CONV_Y}
                x2={x2}
                y2={CONV_Y}
                stroke={`rgb(var(--c-${stroke}))`}
                strokeWidth="3"
                strokeLinecap="round"
                className="conveyor-flow"
              />
            )}
          </g>
        );
      })}

      {/* Stations */}
      {STATIONS.map((stn) => {
        const alarmed = stn.alarmFor(s);
        const dot = alarmed ? 'crit' : st === 'run' ? 'ok' : 'line';
        const vals = stn.values(s);
        return (
          <g key={stn.id}>
            <rect
              x={stn.x}
              y={BOX_Y}
              width={BOX_W}
              height={BOX_H}
              rx="12"
              fill="rgb(var(--c-surf2))"
              stroke={alarmed ? 'rgb(var(--c-crit))' : 'rgb(var(--c-line))'}
              strokeWidth={alarmed ? 2 : 1.5}
            />
            <circle cx={stn.x + 14} cy={BOX_Y + 18} r="5" fill={`rgb(var(--c-${dot}))`} />
            <text x={stn.x + 26} y={BOX_Y + 22} fontSize="12" fontWeight="600" fill="rgb(var(--c-ink))">
              {stn.name}
            </text>
            {vals.map((v, i) => (
              <g key={v.label}>
                <text x={stn.x + 14} y={BOX_Y + 52 + i * 26} fontSize="10.5" fill="rgb(var(--c-ink2))">
                  {v.label}
                </text>
                <text
                  x={stn.x + BOX_W - 14}
                  y={BOX_Y + 52 + i * 26}
                  fontSize="12.5"
                  textAnchor="end"
                  className="value"
                  fontWeight="600"
                  fill={alarmed ? 'rgb(var(--c-crit))' : 'rgb(var(--c-ink))'}
                >
                  {v.text}
                </text>
              </g>
            ))}
          </g>
        );
      })}

      {/* Hopper level glyph above intake */}
      <g>
        <path
          d={`M ${STATIONS[0].x + 20} ${BOX_Y - 26} L ${STATIONS[0].x + 52} ${BOX_Y - 4} L ${STATIONS[0].x + 108} ${BOX_Y - 4} L ${STATIONS[0].x + 140} ${BOX_Y - 26} Z`}
          fill="rgb(var(--c-surf2))"
          stroke="rgb(var(--c-line))"
          strokeWidth="1.5"
        />
        <rect
          x={STATIONS[0].x + 20}
          y={BOX_Y - 26 + 22 * (1 - s.pv.hopperLevel / 100)}
          width={120}
          height={Math.max(0, 22 * (s.pv.hopperLevel / 100))}
          fill={`rgb(var(--c-${s.pv.hopperLevel >= 90 ? 'warn' : 'acc'}) / 0.45)`}
        />
        <text x={STATIONS[0].x + 80} y={BOX_Y - 32} fontSize="10" textAnchor="middle" fill="rgb(var(--c-ink2))">
          Blend hopper
        </text>
      </g>

      {/* Steam glyph above conditioning */}
      {s.inputs.steamOn && (
        <text x={STATIONS[1].x + BOX_W / 2} y={BOX_Y - 14} fontSize="16" textAnchor="middle" fill="rgb(var(--c-ink2))">
          ~ ~
        </text>
      )}

      {/* Flow label */}
      <text x="500" y="34" fontSize="13" fontWeight="700" textAnchor="middle" fill={`rgb(var(--c-${stroke}))`}>
        {s.lineState}
        {s.eStop ? ' - E-STOP LATCHED' : ''}
        {s.loto !== 'NONE' ? ` - LOTO: ${s.loto}` : ''}
        {s.guardOpen ? ' - GUARD OPEN' : ''}
      </text>
      <text x="500" y="222" fontSize="10.5" textAnchor="middle" fill="rgb(var(--c-ink2))">
        leaf flow: intake → conditioning → threshing → air separation → drying → packing
      </text>
    </svg>
  );
}
