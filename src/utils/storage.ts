import type { DailyPunches } from '../types/timecard';
import { getTodayISO } from './timeRules';

const DRAFT_KEY = 'pontocerto_draft_v1';

export function createEmptyPunches(date = getTodayISO()): DailyPunches {
  return {
    date,
    entry: '',
    lunchOut: '',
    lunchIn: '',
    exit: '',
  };
}

export function loadDraft(): DailyPunches {
  const today = getTodayISO();

  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return createEmptyPunches(today);
    const parsed = JSON.parse(raw) as Partial<DailyPunches>;

    // If the stored draft is from a previous day, start fresh on today's date
    if (parsed.date !== today) {
      return createEmptyPunches(today);
    }

    return {
      date: today,
      entry: typeof parsed.entry === 'string' ? parsed.entry : '',
      lunchOut: typeof parsed.lunchOut === 'string' ? parsed.lunchOut : '',
      lunchIn: typeof parsed.lunchIn === 'string' ? parsed.lunchIn : '',
      exit: typeof parsed.exit === 'string' ? parsed.exit : '',
    };
  } catch {
    return createEmptyPunches(today);
  }
}

export function saveDraft(punches: DailyPunches): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(punches));
  } catch {
    // Ignore storage quota errors
  }
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
