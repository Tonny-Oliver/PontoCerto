export type ScheduleDayCode = 'T' | 'F' | 'FE' | 'FR' | 'A';

export const SCHEDULE_CODE_CYCLE: ScheduleDayCode[] = ['T', 'F', 'FE', 'FR', 'A'];

export interface ScheduleDayMeta {
  code: ScheduleDayCode;
  label: string;
  shortLabel: string;
  cellBg: string;
  badgeClass: string;
  matrixBtnClass: string;
  legendDotClass: string;
  listTextClass: string;
}

export const SCHEDULE_DAY_META: Record<ScheduleDayCode, ScheduleDayMeta> = {
  T: {
    code: 'T',
    label: 'Trabalho',
    shortLabel: 'Trab.',
    cellBg: 'bg-white',
    badgeClass: 'text-slate-400 font-medium',
    matrixBtnClass: 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50',
    legendDotClass: 'bg-slate-300',
    listTextClass: 'text-slate-600',
  },
  F: {
    code: 'F',
    label: 'Folga',
    shortLabel: 'Folga',
    cellBg: 'bg-emerald-50/80',
    badgeClass: 'rounded px-1 sm:px-1.5 py-0.5 bg-emerald-600 text-white font-semibold',
    matrixBtnClass: 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700',
    legendDotClass: 'bg-emerald-600',
    listTextClass: 'text-emerald-700',
  },
  FE: {
    code: 'FE',
    label: 'Férias',
    shortLabel: 'Férias',
    cellBg: 'bg-sky-50/85',
    badgeClass: 'rounded px-1 sm:px-1.5 py-0.5 bg-sky-600 text-white font-semibold',
    matrixBtnClass: 'bg-sky-600 text-white border-sky-700 hover:bg-sky-700',
    legendDotClass: 'bg-sky-600',
    listTextClass: 'text-sky-700',
  },
  FR: {
    code: 'FR',
    label: 'Feriado',
    shortLabel: 'Fer.',
    cellBg: 'bg-amber-50/85',
    badgeClass: 'rounded px-1 sm:px-1.5 py-0.5 bg-amber-600 text-white font-semibold',
    matrixBtnClass: 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600',
    legendDotClass: 'bg-amber-500',
    listTextClass: 'text-amber-700',
  },
  A: {
    code: 'A',
    label: 'Afastamento',
    shortLabel: 'Afast.',
    cellBg: 'bg-rose-50/80',
    badgeClass: 'rounded px-1 sm:px-1.5 py-0.5 bg-rose-600 text-white font-semibold',
    matrixBtnClass: 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700',
    legendDotClass: 'bg-rose-600',
    listTextClass: 'text-rose-700',
  },
};

export interface EmployeeScheduleRecord {
  id: string;
  monthKey: string;
  employeeName: string;
  normalizedName: string;
  department: string;
  shift: string;
  days: Record<string, ScheduleDayCode>;
  isPublished: boolean;
  updatedBy: string;
}

export interface ParsedSpreadsheetRow {
  docId: string;
  employeeName: string;
  normalizedName: string;
  department: string;
  shift: string;
  days: Record<string, ScheduleDayCode>;
  offCount: number;
  specialCount: number;
}

export interface ParsedMonthBlock {
  monthIndex: number; // 0..11
  year: number;
  monthKey: string;
  monthLabel: string;
  sheetName: string;
  rows: ParsedSpreadsheetRow[];
}

export interface SpreadsheetParseResult {
  months: ParsedMonthBlock[];
  warnings: string[];
  error?: string;
}
