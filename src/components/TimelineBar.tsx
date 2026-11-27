import React from 'react';
import type { TimecardAnalysis } from '../types/timecard';
import { formatClock, formatDuration } from '../utils/timeRules';

interface TimelineBarProps {
  analysis: TimecardAnalysis;
  nowMinutes: number;
  isToday: boolean;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({
  analysis,
  nowMinutes,
  isToday,
}) => {
  const { t1, t2, t3, t4 } = analysis.normalized;
  const { lunchOutMax, lunchInMin, lunchInMax, exitMinFor8h, exitMaxSafe } =
    analysis.windows;

  if (t1 === null) {
    return (
      <div className="px-4 py-4 sm:px-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mb-2">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Linha do tempo da jornada
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Aguardando 1ª marcação
          </span>
        </div>
        <div className="h-2.5 w-full rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  // Build span from t1 to the furthest relevant point (max safe exit, t4, or t1 + 11h)
  const spanStart = t1;
  const candidates = [
    t1 + 660, // default 11h visual span (e.g. 8h work + 1h lunch + 2h overtime)
    t2 ?? 0,
    t3 ?? 0,
    t4 ?? 0,
    lunchOutMax ?? 0,
    lunchInMax ?? 0,
    exitMaxSafe ?? 0,
    exitMinFor8h ?? 0,
  ];
  const spanEnd = Math.max(...candidates);
  const totalSpan = Math.max(60, spanEnd - spanStart);

  const toPct = (minuteVal: number) =>
    Math.max(0, Math.min(100, ((minuteVal - spanStart) / totalSpan) * 100));

  const morningEnd = t2 ?? (isToday ? Math.min(spanEnd, Math.max(t1, nowMinutes < t1 ? nowMinutes + 1440 : nowMinutes)) : t1);
  const morningLeft = toPct(t1);
  const morningWidth = Math.max(0, toPct(morningEnd) - morningLeft);
  const morningViolated =
    analysis.morningMinutes !== null && analysis.morningMinutes > 360;

  const hasLunch = t2 !== null;
  const lunchEnd = t3 ?? (t2 !== null ? (lunchInMin ?? t2 + 60) : t1);
  const lunchLeft = t2 !== null ? toPct(t2) : 0;
  const lunchWidth =
    t2 !== null && t3 !== null ? Math.max(0, toPct(t3) - lunchLeft) : 0;
  const lunchViolated =
    analysis.lunchMinutes !== null &&
    (analysis.lunchMinutes < 60 || analysis.lunchMinutes > 119);

  const hasAfternoon = t3 !== null;
  const afternoonEnd =
    t4 ??
    (t3 !== null && isToday
      ? Math.min(
          spanEnd,
          Math.max(
            t3,
            nowMinutes < t3 % 1440 && t3 >= 1440
              ? nowMinutes + 1440
              : nowMinutes < t3
                ? nowMinutes + 1440
                : nowMinutes
          )
        )
      : t3 ?? t1);
  const afternoonLeft = t3 !== null ? toPct(t3) : 0;
  const afternoonWidth =
    t3 !== null ? Math.max(0, toPct(afternoonEnd) - afternoonLeft) : 0;
  const afternoonViolated =
    (analysis.afternoonMinutes !== null && analysis.afternoonMinutes > 360) ||
    (analysis.totalWorkedMinutes !== null && analysis.totalWorkedMinutes > 600);

  // Safe exit zone highlight when afternoon is open
  const showSafeExitZone =
    t3 !== null &&
    t4 === null &&
    exitMinFor8h !== null &&
    exitMaxSafe !== null &&
    exitMaxSafe >= exitMinFor8h;

  const safeZoneLeft = showSafeExitZone ? toPct(exitMinFor8h!) : 0;
  const safeZoneWidth = showSafeExitZone
    ? Math.max(1.5, toPct(exitMaxSafe!) - safeZoneLeft)
    : 0;

  // Live "now" marker
  const adjNow =
    isToday ? (nowMinutes < t1 ? nowMinutes + 1440 : nowMinutes) : null;
  const showNowMarker =
    adjNow !== null && adjNow >= spanStart && adjNow <= spanEnd && t4 === null;

  return (
    <div className="px-4 py-4 sm:px-5 border-b border-slate-200 dark:border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Linha do tempo da jornada
        </span>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-[#143B63] dark:bg-sky-500" />
            Trabalho
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-slate-300 dark:bg-slate-600" />
            Almoço
          </span>
          {showSafeExitZone && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-xs bg-emerald-500/40 border border-emerald-600/50" />
              Janela segura de saída
            </span>
          )}
        </div>
      </div>

      {/* Track */}
      <div className="relative h-3.5 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
        {/* Safe exit window band */}
        {showSafeExitZone && (
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/25 dark:bg-emerald-400/20 border-x border-emerald-600/60 dark:border-emerald-400/60"
            style={{ left: `${safeZoneLeft}%`, width: `${safeZoneWidth}%` }}
            title={`Janela segura de saída: ${formatClock(exitMinFor8h)} até ${formatClock(exitMaxSafe)}`}
          />
        )}

        {/* Morning segment */}
        {morningWidth > 0 && (
          <div
            className={`absolute top-0 bottom-0 transition-all duration-200 ${
              morningViolated
                ? 'bg-red-600 dark:bg-red-500'
                : t2 === null
                  ? 'bg-[#143B63]/70 dark:bg-sky-500/70'
                  : 'bg-[#143B63] dark:bg-sky-500'
            }`}
            style={{ left: `${morningLeft}%`, width: `${morningWidth}%` }}
          />
        )}

        {/* Lunch segment */}
        {hasLunch && lunchWidth > 0 && (
          <div
            className={`absolute top-0 bottom-0 transition-all duration-200 ${
              lunchViolated
                ? 'bg-red-400 dark:bg-red-500/70'
                : 'bg-slate-300 dark:bg-slate-600'
            }`}
            style={{ left: `${lunchLeft}%`, width: `${lunchWidth}%` }}
          />
        )}

        {/* Afternoon segment */}
        {hasAfternoon && afternoonWidth > 0 && (
          <div
            className={`absolute top-0 bottom-0 transition-all duration-200 ${
              afternoonViolated
                ? 'bg-red-600 dark:bg-red-500'
                : t4 === null
                  ? 'bg-[#143B63]/70 dark:bg-sky-500/70'
                  : 'bg-[#143B63] dark:bg-sky-500'
            }`}
            style={{ left: `${afternoonLeft}%`, width: `${afternoonWidth}%` }}
          />
        )}

        {/* Live current time line */}
        {showNowMarker && adjNow !== null && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-600 dark:bg-amber-400"
            style={{ left: `${toPct(adjNow)}%` }}
            title={`Agora: ${formatClock(adjNow)}`}
          />
        )}
      </div>

      {/* Anchor ticks underneath */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
        <span>Entrada {formatClock(t1)}</span>
        {t2 !== null ? (
          <span>
            Almoço {formatClock(t2)}
            {t3 !== null ? `–${formatClock(t3)}` : ` (${formatClock(lunchEnd)} mín)`}
          </span>
        ) : (
          <span>Limite almoço {formatClock(lunchOutMax)}</span>
        )}
        {t4 !== null ? (
          <span>
            Saída {formatClock(t4)} ({formatDuration(analysis.totalWorkedMinutes)})
          </span>
        ) : exitMinFor8h !== null && exitMaxSafe !== null ? (
          <span>
            Saída {formatClock(exitMinFor8h)}–{formatClock(exitMaxSafe)}
          </span>
        ) : (
          <span>Teto {formatClock(spanEnd)}</span>
        )}
      </div>
    </div>
  );
};
