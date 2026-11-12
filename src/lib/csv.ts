/**
 * RFC 4180 CSV export with BOM (Excel-friendly) and formula-injection
 * protection: any cell starting with = + - @ or a tab is prefixed with an
 * apostrophe so spreadsheet apps render it as text.
 */

export type CsvCell = string | number | boolean | null | undefined;

function escapeCell(cell: CsvCell): string {
  let v = cell == null ? '' : String(cell);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  if (/[",\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCell).join(','));
  return lines.join('\r\n');
}

/** Trigger a browser download of CSV content (UI-only, DOM-guarded). */
export function downloadCsv(filename: string, content: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([`\ufeff${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Trigger a JSON file download (backup export). */
export function downloadJson(filename: string, content: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
