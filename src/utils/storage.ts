import type { DailyPunches, SavedRecord } from '../types/timecard';
import { formatDateBR, formatDurationColon, getTodayISO } from './timeRules';

const DRAFT_KEY = 'pontocerto_draft_v1';
const HISTORY_KEY = 'pontocerto_history_v1';
const THEME_KEY = 'pontocerto_theme_v1';

export function createEmptyPunches(date = getTodayISO(), prevExit = ''): DailyPunches {
  return {
    date,
    prevExit,
    prevExitAfterMidnight: false,
    entry: '',
    lunchOut: '',
    lunchIn: '',
    exit: '',
    note: '',
  };
}

export function loadDraft(): DailyPunches {
  const today = getTodayISO();
  const history = loadHistory();
  const prevFromHistory = findPreviousExitForDate(history, today)?.exit ?? '';

  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return createEmptyPunches(today, prevFromHistory);
    const parsed = JSON.parse(raw) as Partial<DailyPunches>;

    // If the stored draft is from a previous day, start fresh on today's date
    // while carrying over the last recorded exit for Regra 6 (11h rest).
    if (parsed.date !== today) {
      const carriedPrevExit =
        (typeof parsed.exit === 'string' && parsed.exit) || prevFromHistory;
      return createEmptyPunches(today, carriedPrevExit);
    }

    return {
      date: today,
      prevExit:
        typeof parsed.prevExit === 'string' && parsed.prevExit
          ? parsed.prevExit
          : prevFromHistory,
      prevExitAfterMidnight: Boolean(parsed.prevExitAfterMidnight),
      entry: typeof parsed.entry === 'string' ? parsed.entry : '',
      lunchOut: typeof parsed.lunchOut === 'string' ? parsed.lunchOut : '',
      lunchIn: typeof parsed.lunchIn === 'string' ? parsed.lunchIn : '',
      exit: typeof parsed.exit === 'string' ? parsed.exit : '',
      note: typeof parsed.note === 'string' ? parsed.note : '',
    };
  } catch {
    return createEmptyPunches(today, prevFromHistory);
  }
}

export function saveDraft(punches: DailyPunches): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(punches));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadHistory(): SavedRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is SavedRecord => Boolean(item && typeof item.date === 'string'))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export function saveHistory(records: SavedRecord[]): void {
  try {
    const sorted = [...records].sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore storage quota errors
  }
}

export function findPreviousExitForDate(
  records: SavedRecord[],
  targetDate: string
): SavedRecord | null {
  const earlier = records
    .filter((r) => r.date < targetDate && r.exit)
    .sort((a, b) => b.date.localeCompare(a.date));
  return earlier[0] ?? null;
}

export function loadTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore
  }
}

export function exportHistoryCSV(records: SavedRecord[]): void {
  const headers = [
    'Data',
    'Saida Anterior',
    'Entrada',
    'Saida Almoco',
    'Volta Almoco',
    'Saida Final',
    'Total Trabalhado',
    'Saldo',
    'Infracoes',
    'Observacao',
  ];

  const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;

  const rows = records.map((r) => [
    formatDateBR(r.date),
    r.prevExit || '-',
    r.entry || '-',
    r.lunchOut || '-',
    r.lunchIn || '-',
    r.exit || '-',
    formatDurationColon(r.totalWorkedMinutes),
    formatDurationColon(r.balanceMinutes, true),
    String(r.violationCount),
    escapeCsv(r.note || ''),
  ]);

  // UTF-8 BOM + semicolon delimiter for seamless opening in Brazilian Excel
  const csvContent =
    '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');

  triggerDownload(
    csvContent,
    `pontocerto-historico-${getTodayISO()}.csv`,
    'text/csv;charset=utf-8'
  );
}

export function exportHistoryJSON(records: SavedRecord[]): void {
  const payload = {
    app: 'PontoCerto',
    exportedAt: new Date().toISOString(),
    records,
  };
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `pontocerto-backup-${getTodayISO()}.json`,
    'application/json;charset=utf-8'
  );
}

export function triggerDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
