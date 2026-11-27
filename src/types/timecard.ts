export type RuleStatus = 'ok' | 'warning' | 'violation' | 'pending';

export interface DailyPunches {
  date: string; // YYYY-MM-DD
  entry: string; // HH:MM or ''
  lunchOut: string; // HH:MM or ''
  lunchIn: string; // HH:MM or ''
  exit: string; // HH:MM or ''
}

export interface RuleEvaluation {
  id: 1 | 2 | 3 | 4 | 5;
  code: string;
  title: string;
  shortRule: string;
  status: RuleStatus;
  measuredLabel: string;
  detail: string;
  limitHint?: string;
}

export interface SafeWindows {
  lunchOutRecommendedMin: number | null; // entry + 2h (to allow 8h without breaking Regra 3)
  lunchOutMax: number | null; // entry + 6h (Regra 1)
  lunchInMin: number | null; // lunchOut + 1h (Regra 2)
  lunchInMax: number | null; // lunchOut + 1h59 (Regra 2)
  exitMinFor8h: number | null; // Regra 5
  exitMaxByRule3: number | null; // lunchIn + 6h
  exitMaxByRule4: number | null; // lunchIn + (10h - morning)
  exitMaxSafe: number | null; // min(Rule3, Rule4)
  exitLimitingRule: string | null;
  exitWindowImpossible: boolean; // true if morning < 2h so exitMinFor8h > exitMaxSafe
}

export type GuidanceStep =
  | 'entry'
  | 'lunchOut'
  | 'lunchIn'
  | 'exit'
  | 'complete';

export interface NextPunchGuidance {
  step: GuidanceStep;
  headline: string;
  windowLabel: string;
  subtext: string;
  tone: 'neutral' | 'ok' | 'warning' | 'violation';
  liveNote?: string;
}

export interface TimecardAnalysis {
  normalized: {
    t1: number | null;
    t2: number | null;
    t3: number | null;
    t4: number | null;
  };
  morningMinutes: number | null;
  lunchMinutes: number | null;
  afternoonMinutes: number | null;
  totalWorkedMinutes: number | null;
  liveWorkedMinutes: number | null; // includes ongoing live elapsed time if today
  balanceMinutes: number | null; // totalWorked - 480 (can be negative or positive)
  overtimeMinutes: number | null; // max(0, totalWorked - 480)
  windows: SafeWindows;
  rules: RuleEvaluation[];
  guidance: NextPunchGuidance;
  violationCount: number;
  warningCount: number;
  isComplete: boolean;
  isAllCompliant: boolean;
}

export type AppView = 'calculator' | 'schedule';
