import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTodayISO } from '../utils/timeRules';

type DayStatus = 'work' | 'off';

const DEFAULT_START_WEEKDAY = 6;
const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getDefaultDayStatus(
  year: number,
  monthZeroBased: number,
  day: number
): DayStatus {
  const date = new Date(year, monthZeroBased, day);
  const weekday = date.getDay(); // 0 = Sun, 1..6 = Mon..Sat

  if (weekday === 0) {
    return 'off';
  }

  const firstDayWeekday = new Date(year, monthZeroBased, 1).getDay();
  const weekIndex = Math.floor((firstDayWeekday + day - 1) / 7);
  const rotatingWeekday = ((DEFAULT_START_WEEKDAY - 1 + weekIndex) % 6) + 1;

  return weekday === rotatingWeekday ? 'off' : 'work';
}

function formatMonthTitle(year: number, monthZeroBased: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthZeroBased, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function toISODate(year: number, monthZeroBased: number, day: number): string {
  return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const ScheduleView: React.FC = () => {
  const todayISO = getTodayISO();
  const [todayYear, todayMonth] = todayISO.split('-').map(Number);

  const [year, setYear] = useState<number>(todayYear);
  const [month, setMonth] = useState<number>(todayMonth - 1); // 0-based

  const daysData = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstWeekday = new Date(year, month, 1).getDay();
    const items: Array<{
      day: number;
      iso: string;
      weekday: number;
      status: DayStatus;
      isToday: boolean;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISODate(year, month, d);
      const weekday = new Date(year, month, d).getDay();
      items.push({
        day: d,
        iso,
        weekday,
        status: getDefaultDayStatus(year, month, d),
        isToday: iso === todayISO,
      });
    }

    return { firstWeekday, items };
  }, [year, month, todayISO]);

  const offDaysList = useMemo(
    () => daysData.items.filter((item) => item.status === 'off'),
    [daysData.items]
  );

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleGoToCurrentMonth = () => {
    setYear(todayYear);
    setMonth(todayMonth - 1);
  };

  const isCurrentMonth = year === todayYear && month === todayMonth - 1;

  return (
    <div className="space-y-6">
      {/* Header & Month Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
            Escala do Mês (5×2)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Visualização das folgas previstas no mês.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={handleGoToCurrentMonth}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Mês atual
            </button>
          )}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Mês anterior"
              className="inline-flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-l-lg transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-40 px-3 text-center text-xs font-semibold text-slate-900 whitespace-nowrap">
              {formatMonthTitle(year, month)}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Próximo mês"
              className="inline-flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-r-lg transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Split: Calendar + Off-days list */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Calendar Grid */}
        <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CalendarDays className="h-4 w-4 text-[#143B63]" />
              Calendário de Folgas
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                Folga
              </span>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center text-xs font-semibold text-slate-600">
            {WEEKDAY_HEADERS.map((wd) => (
              <div key={wd} className="py-2.5">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 border-b border-slate-200">
            {Array.from({ length: daysData.firstWeekday }).map((_, idx) => (
              <div key={`empty-${idx}`} className="min-h-20 bg-slate-50/40 p-2" />
            ))}

            {daysData.items.map((item) => {
              const isOff = item.status === 'off';

              return (
                <div
                  key={item.iso}
                  className={`min-h-20 p-2 flex flex-col justify-between ${
                    isOff ? 'bg-emerald-50/80' : 'bg-white'
                  } ${item.isToday ? 'ring-2 ring-inset ring-[#143B63]' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        item.isToday ? 'text-[#143B63]' : 'text-slate-900'
                      }`}
                    >
                      {String(item.day).padStart(2, '0')}
                    </span>
                    {item.isToday && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#143B63]">
                        Hoje
                      </span>
                    )}
                  </div>

                  <div className="mt-2 truncate">
                    {isOff ? (
                      <span className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold bg-emerald-600 text-white">
                        Folga
                      </span>
                    ) : (
                      <span className="inline-block text-[11px] font-medium text-slate-400">
                        Trabalho
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Off-days Chronological List */}
        <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Folgas previstas no mês
            </h2>
            <p className="text-xs text-slate-500">
              Sequência de folgas para seguir em {formatMonthTitle(year, month)}
            </p>
          </div>

          {offDaysList.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-slate-500">
              Nenhuma folga marcada neste mês.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-[440px] overflow-y-auto">
              {offDaysList.map((item) => (
                <div
                  key={item.iso}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold tabular-nums text-slate-900">
                      {String(item.day).padStart(2, '0')}/
                      {String(month + 1).padStart(2, '0')}
                    </span>
                    <span className="text-slate-500">
                      {WEEKDAY_HEADERS[item.weekday]}
                    </span>
                  </div>
                  <span className="font-medium text-emerald-700">Folga</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
