import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
} from 'lucide-react';
import {
  EmployeeScheduleRecord,
  SCHEDULE_DAY_META,
  ScheduleDayCode,
} from '../types/schedule';
import { subscribeMonthSchedules } from '../utils/scheduleService';
import {
  formatMonthKey,
  getDaysInMonth,
  normalizeEmployeeName,
} from '../utils/scheduleSpreadsheet';
import { getTodayISO } from '../utils/timeRules';

const STORAGE_SELECTED_NAME_KEY = 'pontocerto_employee_name_v1';
const WEEKDAY_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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

  const [schedules, setSchedules] = useState<EmployeeScheduleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [savedNormalizedName, setSavedNormalizedName] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_SELECTED_NAME_KEY) || '';
    } catch {
      return '';
    }
  });
  const [searchInput, setSearchInput] = useState<string>('');
  const [isChangingEmployee, setIsChangingEmployee] = useState<boolean>(false);

  const monthKey = useMemo(() => formatMonthKey(year, month), [year, month]);
  const monthTitle = useMemo(() => formatMonthTitle(year, month), [year, month]);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);

    const unsubscribe = subscribeMonthSchedules(
      monthKey,
      (items) => {
        setSchedules(items);
        setLoading(false);
      },
      (errorMsg) => {
        setLoadError(errorMsg);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [monthKey]);

  const selectedSchedule = useMemo(() => {
    if (!savedNormalizedName || isChangingEmployee) return null;
    return (
      schedules.find((item) => item.normalizedName === savedNormalizedName) || null
    );
  }, [schedules, savedNormalizedName, isChangingEmployee]);

  const filteredSuggestions = useMemo(() => {
    const queryNorm = normalizeEmployeeName(searchInput);
    if (!queryNorm) return schedules;
    return schedules.filter(
      (item) =>
        item.normalizedName.includes(queryNorm) ||
        normalizeEmployeeName(item.department).includes(queryNorm)
    );
  }, [schedules, searchInput]);

  const handleSelectEmployee = (record: EmployeeScheduleRecord) => {
    setSavedNormalizedName(record.normalizedName);
    setSearchInput('');
    setIsChangingEmployee(false);
    try {
      localStorage.setItem(STORAGE_SELECTED_NAME_KEY, record.normalizedName);
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const queryNorm = normalizeEmployeeName(searchInput);
    if (!queryNorm) return;

    const exact = schedules.find((item) => item.normalizedName === queryNorm);
    if (exact) {
      handleSelectEmployee(exact);
      return;
    }

    if (filteredSuggestions.length === 1) {
      handleSelectEmployee(filteredSuggestions[0]);
    }
  };

  const handleSwitchEmployee = () => {
    setIsChangingEmployee(true);
    setSearchInput('');
  };

  const handleClearSavedName = () => {
    setSavedNormalizedName('');
    setSearchInput('');
    setIsChangingEmployee(false);
    try {
      localStorage.removeItem(STORAGE_SELECTED_NAME_KEY);
    } catch {
      // Ignore storage errors
    }
  };

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

  // Individual Calendar Calculation
  const calendarData = useMemo(() => {
    if (!selectedSchedule) return null;

    const totalDays = getDaysInMonth(year, month);
    const firstWeekday = new Date(year, month, 1).getDay();
    const items: Array<{
      day: number;
      iso: string;
      weekday: number;
      code: ScheduleDayCode;
      isToday: boolean;
    }> = [];

    let workDays = 0;
    let offDays = 0;
    const presentSpecialCodes = new Set<ScheduleDayCode>();

    for (let d = 1; d <= totalDays; d++) {
      const iso = toISODate(year, month, d);
      const weekday = new Date(year, month, d).getDay();
      const code: ScheduleDayCode = selectedSchedule.days[String(d)] || 'T';

      if (code === 'T') workDays++;
      else if (code === 'F') offDays++;
      else presentSpecialCodes.add(code);

      items.push({
        day: d,
        iso,
        weekday,
        code,
        isToday: iso === todayISO,
      });
    }

    const nonWorkList = items.filter((item) => item.code !== 'T');
    const nextOffDay = items.find((item) => item.code === 'F' && item.iso >= todayISO) || null;

    return {
      firstWeekday,
      items,
      workDays,
      offDays,
      nonWorkList,
      nextOffDay,
      presentSpecialCodes: Array.from(presentSpecialCodes),
    };
  }, [selectedSchedule, year, month, todayISO]);

  return (
    <div className="space-y-6">
      {/* Header & Month Navigation */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
            Escala do Mês
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Informe seu nome para consultar sua escala e folgas previstas no mês.
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
            <span className="min-w-34 sm:min-w-40 px-2.5 sm:px-3 text-center text-xs font-semibold text-slate-900 whitespace-nowrap">
              {monthTitle}
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

      {/* Global Load Error */}
      {loadError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-700" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Employee Consultation Content */}
      <div className="space-y-6">
        {loading ? (
          <section className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">Carregando escalas de {monthTitle}...</p>
          </section>
        ) : schedules.length === 0 ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-2.5">
            <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Nenhuma escala publicada para {monthTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-600 max-w-md mx-auto">
                Assim que a escala do mês for publicada pelo encarregado, você poderá informar seu nome aqui para consultar todas as suas folgas.
              </p>
            </div>
          </section>
        ) : !selectedSchedule ? (
            /* Name Identification Card */
            <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Identifique-se para ver sua escala
                </h2>
              </div>

              <div className="p-5 space-y-4">
                {savedNormalizedName && !isChangingEmployee && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
                    <span>
                      Não encontramos sua escala cadastrada em {monthTitle}. Selecione seu nome abaixo ou volte para o mês atual.
                    </span>
                    <button
                      type="button"
                      onClick={handleClearSavedName}
                      className="font-semibold underline hover:no-underline"
                    >
                      Limpar seleção
                    </button>
                  </div>
                )}

                <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Digite seu nome..."
                      aria-label="Digite seu nome para consultar a escala"
                      className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/15"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={filteredSuggestions.length === 0}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#143B63] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0F2F50] disabled:opacity-50 transition-colors shrink-0"
                  >
                    Consultar Escala
                  </button>
                </form>

                {filteredSuggestions.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500">
                    Nenhum funcionário encontrado com "{searchInput}" em {monthTitle}.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 max-h-72 overflow-y-auto">
                    {filteredSuggestions.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => handleSelectEmployee(emp)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {emp.employeeName}
                          </p>
                          {(emp.department || emp.shift) && (
                            <p className="text-xs text-slate-500 truncate">
                              {[emp.department, emp.shift].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                        <span className="text-xs font-semibold text-[#143B63] shrink-0">
                          Ver escala
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            /* Individual Employee Schedule View */
            calendarData && (
              <div className="space-y-6">
                {/* Identified Employee Header Bar */}
                <section className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Escala individual
                    </p>
                    <h2 className="mt-0.5 font-display text-lg font-bold text-slate-900 truncate">
                      {selectedSchedule.employeeName}
                    </h2>
                    {(selectedSchedule.department || selectedSchedule.shift) && (
                      <p className="mt-0.5 text-xs text-slate-600">
                        {[selectedSchedule.department, selectedSchedule.shift]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSwitchEmployee}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors self-start sm:self-auto shrink-0"
                  >
                    <Users className="h-3.5 w-3.5 text-[#143B63]" />
                    Trocar nome
                  </button>
                </section>

                {/* 3-Metric Summary Strip */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                    <p className="text-[11px] sm:text-xs font-medium text-slate-500">
                      Dias de Trabalho
                    </p>
                    <p className="mt-1 font-mono text-lg sm:text-xl font-bold tabular-nums text-slate-900">
                      {calendarData.workDays}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                    <p className="text-[11px] sm:text-xs font-medium text-slate-500">
                      Folgas no Mês
                    </p>
                    <p className="mt-1 font-mono text-lg sm:text-xl font-bold tabular-nums text-emerald-700">
                      {calendarData.offDays}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                    <p className="text-[11px] sm:text-xs font-medium text-slate-500">
                      Próxima Folga
                    </p>
                    <p className="mt-1 font-mono text-sm sm:text-lg font-bold tabular-nums text-[#143B63]">
                      {calendarData.nextOffDay
                        ? `${String(calendarData.nextOffDay.day).padStart(2, '0')}/${String(
                            month + 1
                          ).padStart(2, '0')} · ${WEEKDAY_HEADERS[calendarData.nextOffDay.weekday]}`
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Main Split: Calendar + Chronological Days Off / Special Days */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                  {/* Calendar Grid */}
                  <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <CalendarDays className="h-4 w-4 text-[#143B63]" />
                        Calendário de {monthTitle}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-600" />
                          Folga
                        </span>
                        {calendarData.presentSpecialCodes.map((code) => {
                          const meta = SCHEDULE_DAY_META[code];
                          return (
                            <span key={code} className="inline-flex items-center gap-1.5">
                              <span
                                className={`h-2.5 w-2.5 rounded-xs ${meta.legendDotClass}`}
                              />
                              {meta.label}
                            </span>
                          );
                        })}
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
                      {Array.from({ length: calendarData.firstWeekday }).map((_, idx) => (
                        <div
                          key={`empty-${idx}`}
                          className="min-h-14 sm:min-h-20 bg-slate-50/40 p-1.5 sm:p-2"
                        />
                      ))}

                      {calendarData.items.map((item) => {
                        const meta = SCHEDULE_DAY_META[item.code];
                        return (
                          <div
                            key={item.iso}
                            className={`min-h-14 sm:min-h-20 p-1.5 sm:p-2 flex flex-col justify-between ${
                              meta.cellBg
                            } ${item.isToday ? 'ring-2 ring-inset ring-[#143B63]' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-0.5">
                              <span
                                className={`font-mono text-xs font-semibold tabular-nums ${
                                  item.isToday ? 'text-[#143B63]' : 'text-slate-900'
                                }`}
                              >
                                {String(item.day).padStart(2, '0')}
                              </span>
                              {item.isToday && (
                                <span className="hidden sm:inline text-[10px] font-semibold tracking-wide text-[#143B63]">
                                  Hoje
                                </span>
                              )}
                            </div>

                            <div className="mt-1.5 sm:mt-2">
                              <span
                                className={`inline-block text-[10px] sm:text-[11px] leading-tight ${meta.badgeClass}`}
                              >
                                <span className="sm:hidden">{meta.shortLabel}</span>
                                <span className="hidden sm:inline">{meta.label}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  {/* Chronological List */}
                  <section className="lg:col-span-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-3.5">
                      <h3 className="text-sm font-semibold text-slate-900">
                        Folgas e eventos do mês
                      </h3>
                      <p className="text-xs text-slate-500">
                        Datas marcadas para {selectedSchedule.employeeName}
                      </p>
                    </div>

                    {calendarData.nonWorkList.length === 0 ? (
                      <div className="px-5 py-8 text-center text-xs text-slate-500">
                        Nenhuma folga ou evento especial marcado neste mês.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200 max-h-[440px] overflow-y-auto">
                        {calendarData.nonWorkList.map((item) => {
                          const meta = SCHEDULE_DAY_META[item.code];
                          return (
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
                              <span className={`font-semibold ${meta.listTextClass}`}>
                                {meta.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              </div>
            )
          )}
      </div>
    </div>
  );
};
