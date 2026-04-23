import { DateTime } from 'luxon';
import { formatDurationMs } from './formatDuration';
import type { Activity, TimesheetDayTotal } from '@/TimeharborAPI/dashboard';

// ── types ──────────────────────────────────────────────────────────────────────

export interface TimesheetDayGroup {
  dateKey: string;
  dayName: string;
  fullDate: string;
  activities: Activity[];
  totalMs: number;
}

interface ExportRow {
  date: string;
  day: string;
  startTime: string;
  endTime: string;
  duration: string;
  ticket: string;
  description: string;
  flag: string;
  status: string;
}

// ── constants ──────────────────────────────────────────────────────────────────

const FLAG_LABELS: Record<string, string> = {
  none: '',
  billable: 'Billable',
  'non-billable': 'Non-Billable',
  overtime: 'Overtime',
  holiday: 'Holiday',
};

// ── shared helpers ─────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return DateTime.fromISO(iso).toFormat('h:mm a');
}

function buildRows(groups: TimesheetDayGroup[]): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const group of groups) {
    for (const a of group.activities) {
      rows.push({
        date: group.dateKey,
        day: group.dayName,
        startTime: fmtTime(a.startTime),
        endTime: a.endTime ? fmtTime(a.endTime) : '',
        duration: a.durationMs ? formatDurationMs(a.durationMs) : '',
        ticket: a.subtitle || '',
        description: a.description || a.title || '',
        flag: FLAG_LABELS[a.metadata?.flag as string] ?? (a.metadata?.flag as string) ?? '',
        status: a.status || '',
      });
    }
  }
  return rows;
}

async function triggerDownload(filename: string, mimeType: string, content: string): Promise<void> {
  const blob = new Blob([content], { type: mimeType });

  // On mobile (Capacitor / iOS / Android) the `download` attribute on anchors
  // is ignored by WKWebView. Use the native share sheet via Web Share API instead,
  // which lets the user email/message the file directly to their manager.
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([blob], filename, { type: mimeType });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Timesheet Export' });
      return;
    }
  }

  // Desktop fallback: trigger a browser download.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFilename(
  ext: string,
  dateRange: { from: DateTime; to: DateTime },
): string {
  const from = dateRange.from.toFormat('yyyy-MM-dd');
  const to = dateRange.to.toFormat('yyyy-MM-dd');
  return `timesheet-${from}_${to}.${ext}`;
}

function headerLine(
  dateRange: { from: DateTime; to: DateTime },
  totalMs: number,
): { period: string; exported: string; total: string } {
  return {
    period: `${dateRange.from.toFormat('MMM d, yyyy')} – ${dateRange.to.toFormat('MMM d, yyyy')}`,
    exported: DateTime.now().toFormat('MMM d, yyyy h:mm a'),
    total: formatDurationMs(totalMs),
  };
}

// ── CSV ────────────────────────────────────────────────────────────────────────

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(cells: string[]): string {
  return cells.map(csvEscape).join(',');
}

export async function exportToCSV(
  groups: TimesheetDayGroup[],
  totalMs: number,
  dateRange: { from: DateTime; to: DateTime },
): Promise<void> {
  const { period, exported, total } = headerLine(dateRange, totalMs);
  const rows = buildRows(groups);

  const lines: string[] = [];

  // Report header block
  lines.push('TIMESHEET REPORT');
  lines.push(`Period,${csvEscape(period)}`);
  lines.push(`Exported,${csvEscape(exported)}`);
  lines.push(`Total Time,${csvEscape(total)}`);
  lines.push('');

  // Day summary section
  lines.push('DAY SUMMARY');
  lines.push(toCsvRow(['Date', 'Day', 'Total Time']));
  for (const g of groups) {
    lines.push(toCsvRow([g.dateKey, g.dayName, formatDurationMs(g.totalMs)]));
  }
  lines.push('');

  // Entry detail section
  lines.push('ENTRY DETAIL');
  lines.push(toCsvRow(['Date', 'Day', 'Start Time', 'End Time', 'Duration', 'Ticket', 'Description', 'Flag', 'Status']));
  for (const r of rows) {
    lines.push(toCsvRow([r.date, r.day, r.startTime, r.endTime, r.duration, r.ticket, r.description, r.flag, r.status]));
  }

  await triggerDownload(buildFilename('csv', dateRange), 'text/csv;charset=utf-8;', lines.join('\n'));
}

// ── Plain Text ─────────────────────────────────────────────────────────────────

function padRight(s: string, len: number): string {
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

export async function exportToText(
  groups: TimesheetDayGroup[],
  totalMs: number,
  dateRange: { from: DateTime; to: DateTime },
): Promise<void> {
  const { period, exported, total } = headerLine(dateRange, totalMs);
  const lines: string[] = [];

  const separator = '─'.repeat(60);

  lines.push('TIMESHEET REPORT');
  lines.push(separator);
  lines.push(`Period   : ${period}`);
  lines.push(`Exported : ${exported}`);
  lines.push(`Total    : ${total}`);
  lines.push('');

  for (const g of groups) {
    lines.push(separator);
    lines.push(`${g.dayName.toUpperCase()}, ${g.fullDate}  (${formatDurationMs(g.totalMs)})`);
    lines.push(separator);

    if (g.activities.length === 0) {
      lines.push('  No entries');
    } else {
      const colW = { start: 10, end: 10, dur: 10, ticket: 18, flag: 14 };
      const header =
        `  ${padRight('Start', colW.start)}${padRight('End', colW.end)}${padRight('Duration', colW.dur)}${padRight('Ticket', colW.ticket)}${padRight('Flag', colW.flag)}Description`;
      lines.push(header);
      lines.push(`  ${'·'.repeat(header.length - 2)}`);

      for (const a of g.activities) {
        const flag = FLAG_LABELS[a.metadata?.flag as string] ?? '';
        const dur = a.durationMs ? formatDurationMs(a.durationMs) : '';
        const start = fmtTime(a.startTime);
        const end = a.endTime ? fmtTime(a.endTime) : '';
        const ticket = a.subtitle || '';
        const desc = a.description || a.title || '';
        lines.push(
          `  ${padRight(start, colW.start)}${padRight(end, colW.end)}${padRight(dur, colW.dur)}${padRight(ticket, colW.ticket)}${padRight(flag, colW.flag)}${desc}`,
        );
      }
    }
    lines.push('');
  }

  lines.push(separator);
  lines.push(`TOTAL: ${total}`);
  lines.push(separator);

  await triggerDownload(buildFilename('txt', dateRange), 'text/plain;charset=utf-8;', lines.join('\n'));
}

// ── HTML (print/PDF) ──────────────────────────────────────────────────────────

export async function exportToHTML(
  groups: TimesheetDayGroup[],
  totalMs: number,
  dateRange: { from: DateTime; to: DateTime },
): Promise<void> {
  const { period, exported, total } = headerLine(dateRange, totalMs);

  const dayRows = groups
    .map(g => `
      <tr>
        <td>${g.dateKey}</td>
        <td>${g.dayName}</td>
        <td class="num">${formatDurationMs(g.totalMs)}</td>
      </tr>`)
    .join('');

  const entryRows = buildRows(groups)
    .map(r => `
      <tr>
        <td>${r.date}</td>
        <td>${r.day}</td>
        <td class="num">${r.startTime}</td>
        <td class="num">${r.endTime}</td>
        <td class="num">${r.duration}</td>
        <td>${escapeHtml(r.ticket)}</td>
        <td>${escapeHtml(r.description)}</td>
        <td>${escapeHtml(r.flag)}</td>
        <td>${escapeHtml(r.status)}</td>
      </tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Timesheet Report – ${period}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; font-size: 13px; color: #111; margin: 32px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 24px; }
    h2 { font-size: 14px; margin: 28px 0 8px; border-bottom: 2px solid #1a8aff; padding-bottom: 4px; color: #1a8aff; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
    th { background: #f0f4f8; text-align: left; padding: 6px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    td { padding: 5px 10px; border-bottom: 1px solid #e8ecf0; }
    tr:last-child td { border-bottom: none; }
    .num { text-align: left; white-space: nowrap; }
    .total-row { font-weight: bold; background: #f0f4f8; }
    .footer { margin-top: 32px; font-size: 11px; color: #888; }
    @media print {
      body { margin: 16px; font-size: 11px; }
      h2 { page-break-before: auto; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Timesheet Report</h1>
  <div class="meta">
    Period: <strong>${period}</strong> &nbsp;·&nbsp;
    Total: <strong>${total}</strong> &nbsp;·&nbsp;
    Exported: ${exported}
  </div>

  <h2>Day Summary</h2>
  <table>
    <thead>
      <tr><th>Date</th><th>Day</th><th>Total Time</th></tr>
    </thead>
    <tbody>
      ${dayRows}
      <tr class="total-row"><td colspan="2">Total</td><td class="num">${total}</td></tr>
    </tbody>
  </table>

  <h2>Entry Detail</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Day</th><th>Start</th><th>End</th><th>Duration</th>
        <th>Ticket</th><th>Description</th><th>Flag</th><th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${entryRows}
    </tbody>
  </table>

  <div class="footer">Generated by TimeHarbor · ${exported}</div>
</body>
</html>`;

  // On mobile: share the HTML as a file via the native share sheet.
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([new Blob([html], { type: 'text/html' })], buildFilename('html', dateRange), { type: 'text/html' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Timesheet Report' });
      return;
    }
  }

  // Desktop: open in a new tab so the user can Ctrl+P → Save as PDF.
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
