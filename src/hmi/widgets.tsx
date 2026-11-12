/**
 * HMI display widgets: arc gauge, level bar, sparkline trend, motor load
 * bar and value pill. All SVG/div based, no chart library (keeps the JS
 * bundle tiny and styling fully tokenised).
 */
import type { ReactNode } from 'react';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function Gauge({
  label,
  value,
  unit,
  min,
  max,
  warnAt,
  critAt,
  digits = 1
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  warnAt?: number;
  critAt?: number;
  digits?: number;
}) {
  const frac = clamp((value - min) / (max - min), 0, 1);
  const cx = 60;
  const cy = 58;
  const r = 44;
  const angle = (f: number) => (-210 + f * 240) * (Math.PI / 180);
  const pt = (f: number) => `${cx + r * Math.cos(angle(f))},${cy + r * Math.sin(angle(f))}`;
  const needle = pt(frac);
  const stroke = critAt != null && value >= critAt ? 'crit' : warnAt != null && value >= warnAt ? 'warn' : 'acc';
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 120 78" className="w-full max-w-[150px]" role="img" aria-label={`${label}: ${value.toFixed(digits)} ${unit}`}>
        <path d={`M ${pt(0)} A ${r} ${r} 0 1 1 ${pt(1)}`} fill="none" stroke="rgb(var(--c-line))" strokeWidth="8" strokeLinecap="round" />
        {warnAt != null && (
          <path d={`M ${pt(clamp((warnAt - min) / (max - min), 0, 1))} A ${r} ${r} 0 0 1 ${pt(1)}`} fill="none" stroke="rgb(var(--c-warn) / 0.5)" strokeWidth="8" />
        )}
        {critAt != null && (
          <path d={`M ${pt(clamp((critAt - min) / (max - min), 0, 1))} A ${r} ${r} 0 0 1 ${pt(1)}`} fill="none" stroke="rgb(var(--c-crit) / 0.6)" strokeWidth="8" />
        )}
        <path d={`M ${pt(0)} A ${r} ${r} 0 0 1 ${needle}`} fill="none" stroke={`rgb(var(--c-${stroke}))`} strokeWidth="8" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="3.5" fill="rgb(var(--c-ink2))" />
        <text x={cx} y={cy + 17} textAnchor="middle" className="value" fontSize="14" fontWeight="600" fill="rgb(var(--c-ink))">
          {value.toFixed(digits)}
        </text>
      </svg>
      <div className="text-xs text-ink2">
        {label} <span className="text-ink2/70">[{unit}]</span>
      </div>
    </div>
  );
}

export function LevelBar({
  label,
  value,
  warnAt = 90,
  unit = '%'
}: {
  label: string;
  value: number;
  warnAt?: number;
  unit?: string;
}) {
  const v = clamp(value, 0, 100);
  const tone = v >= warnAt ? 'bg-warn' : v < 15 ? 'bg-bad' : 'bg-acc';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink2">{label}</span>
        <span className="value font-semibold text-ink">
          {Math.round(v)}
          {unit}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-surf2" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function LoadBar({
  label,
  value,
  warnAt = 105,
  tripAt = 115,
  unit = '%'
}: {
  label: string;
  value: number;
  warnAt?: number;
  tripAt?: number;
  unit?: string;
}) {
  const v = clamp(value, 0, 130);
  const tone = v >= tripAt ? 'bg-crit' : v >= warnAt ? 'bg-warn' : 'bg-ok';
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink2">{label}</span>
        <span className="value font-semibold text-ink">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surf2">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${(v / 130) * 100}%` }} />
        <div className="absolute top-0 h-full w-px bg-ink2/60" style={{ left: `${(warnAt / 130) * 100}%` }} />
        <div className="absolute top-0 h-full w-px bg-crit" style={{ left: `${(tripAt / 130) * 100}%` }} />
      </div>
    </div>
  );
}

export function Sparkline({
  data,
  lo,
  hi,
  label,
  unit,
  dangerLo,
  dangerHi,
  height = 64
}: {
  data: number[];
  lo: number;
  hi: number;
  label: string;
  unit: string;
  dangerLo?: number;
  dangerHi?: number;
  height?: number;
}) {
  const W = 260;
  const H = height;
  const pad = 4;
  const n = data.length;
  const yOf = (v: number) => H - pad - (clamp(v, lo, hi) - lo) / (hi - lo) * (H - 2 * pad);
  const xOf = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const last = n > 0 ? data[n - 1] : lo;
  const inDanger =
    (dangerLo != null && last < dangerLo) || (dangerHi != null && last > dangerHi);
  const color = inDanger ? 'crit' : 'acc';
  return (
    <figure className="m-0">
      <figcaption className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-ink2">{label}</span>
        <span className={`value font-semibold ${inDanger ? 'text-crit' : 'text-ink'}`}>
          {last.toFixed(1)} <span className="text-ink2/70">{unit}</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-surf2" role="img" aria-label={`${label} trend, current ${last.toFixed(1)} ${unit}`}>
        {dangerLo != null && (
          <rect x="0" y="0" width={W} height={Math.max(0, yOf(dangerLo))} fill="rgb(var(--c-crit) / 0.07)" />
        )}
        {dangerHi != null && (
          <rect x="0" y={yOf(dangerHi)} width={W} height={H - yOf(dangerHi)} fill="rgb(var(--c-crit) / 0.07)" />
        )}
        <line x1="0" y1={yOf((lo + hi) / 2)} x2={W} y2={yOf((lo + hi) / 2)} stroke="rgb(var(--c-line))" strokeDasharray="3 4" />
        {n > 1 && <path d={path} fill="none" stroke={`rgb(var(--c-${color}))`} strokeWidth="1.8" strokeLinejoin="round" />}
        {n > 0 && <circle cx={xOf(n - 1)} cy={yOf(last)} r="2.6" fill={`rgb(var(--c-${color}))`} />}
      </svg>
    </figure>
  );
}

export function ValuePill({
  label,
  value,
  unit,
  tone
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: 'ok' | 'warn' | 'bad' | 'crit' | 'acc';
}) {
  const t =
    tone === 'ok'
      ? 'text-ok'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'bad'
          ? 'text-bad'
          : tone === 'crit'
            ? 'text-crit'
            : tone === 'acc'
              ? 'text-acc'
              : 'text-ink';
  return (
    <div className="rounded-lg border border-line bg-surf2 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-ink2">{label}</div>
      <div className={`value text-sm font-semibold ${t}`}>
        {value}
        {unit && <span className="ml-0.5 text-[11px] text-ink2">{unit}</span>}
      </div>
    </div>
  );
}
