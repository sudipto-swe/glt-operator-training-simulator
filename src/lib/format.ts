/** Display formatting helpers (pure). */

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtNum(v: number, digits = 1): string {
  return v.toFixed(digits);
}

export function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

export function pct(v: number): string {
  return `${Math.round(v)}%`;
}

/** Days between an ISO date and now (positive = in the past). */
export function daysSince(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86400000);
}
