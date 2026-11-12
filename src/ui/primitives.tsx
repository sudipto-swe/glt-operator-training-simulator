/**
 * Small presentational primitives (no state, fully accessible).
 * Styled with Tailwind token colors defined in tailwind.config.ts.
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Tone = 'neutral' | 'acc' | 'ok' | 'warn' | 'bad' | 'crit';

const TONE_BG: Record<Tone, string> = {
  neutral: 'bg-surf2 text-ink2',
  acc: 'bg-acc/15 text-acc',
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  crit: 'bg-crit/15 text-crit'
};

export function Badge({
  tone = 'neutral',
  children,
  className = ''
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return <span className={`pill ${TONE_BG[tone]} ${className}`}>{children}</span>;
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ok' | 'danger';
  block?: boolean;
}

export function Btn({ variant = 'default', block, className = '', ...rest }: BtnProps) {
  const v =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'ok'
        ? 'btn-ok'
        : variant === 'danger'
          ? 'btn-danger'
          : '';
  return <button className={`btn ${v} ${block ? 'w-full' : ''} ${className}`} {...rest} />;
}

export function Card({
  title,
  right,
  children,
  className = ''
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-ink">{title}</h2>
          {right}
        </header>
      )}
      <div className="panel-pad">{children}</div>
    </section>
  );
}

export function Progress({
  value,
  max = 100,
  tone = 'acc',
  label
}: {
  value: number;
  max?: number;
  tone?: Tone;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar: Record<Tone, string> = {
    neutral: 'bg-line',
    acc: 'bg-acc',
    ok: 'bg-ok',
    warn: 'bg-warn',
    bad: 'bg-bad',
    crit: 'bg-crit'
  };
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-surf2"
    >
      <div className={`h-full rounded-full transition-[width] duration-200 ${bar[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  tone = 'neutral',
  hint
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Tone;
  hint?: string;
}) {
  const text =
    tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : tone === 'crit' ? 'text-crit' : tone === 'acc' ? 'text-acc' : 'text-ink';
  return (
    <div className="panel panel-pad">
      <div className="text-xs font-medium uppercase tracking-wider text-ink2">{label}</div>
      <div className={`mt-1 flex items-baseline gap-1 ${text}`}>
        <span className="value text-2xl font-semibold">{value}</span>
        {unit && <span className="text-xs text-ink2">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-ink2">{hint}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink2">{hint}</span>}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink2">
      {children}
    </p>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink2">{children}</h2>;
}
