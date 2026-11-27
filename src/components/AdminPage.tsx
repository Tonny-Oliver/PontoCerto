import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { EmployeeScheduleRecord } from '../types/schedule';
import type { AppView } from '../types/timecard';
import { subscribeMonthSchedules } from '../utils/scheduleService';
import { formatMonthKey } from '../utils/scheduleSpreadsheet';
import { getTodayISO } from '../utils/timeRules';
import { SupervisorSchedulePanel } from './SupervisorSchedulePanel';

const STORAGE_SELECTED_NAME_KEY = 'pontocerto_employee_name_v1';

function formatMonthTitle(year: number, monthZeroBased: number): string {
  const label = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, monthZeroBased, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

interface AdminPageProps {
  onNavigateHome: (initialView?: AppView) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigateHome }) => {
  const todayISO = getTodayISO();
  const [todayYear, todayMonth] = todayISO.split('-').map(Number);

  const [year, setYear] = useState<number>(todayYear);
  const [month, setMonth] = useState<number>(todayMonth - 1);

  const [schedules, setSchedules] = useState<EmployeeScheduleRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const monthKey = useMemo(() => formatMonthKey(year, month), [year, month]);
  const monthTitle = useMemo(() => formatMonthTitle(year, month), [year, month]);
  const isCurrentMonth = year === todayYear && month === todayMonth - 1;

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

  const handlePreviewEmployee = (normalizedName: string) => {
    try {
      localStorage.setItem(STORAGE_SELECTED_NAME_KEY, normalizedName);
    } catch {
      // Ignore storage quota errors
    }
    onNavigateHome('schedule');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Dedicated Admin Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => onNavigateHome('calculator')}
              className="font-display text-lg font-bold tracking-tight text-[#143B63] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#143B63]"
            >
              PontoCerto
            </button>
            <span className="text-slate-300 select-none" aria-hidden="true">
              /
            </span>
            <span className="text-sm font-medium text-slate-600 truncate">
              Administração
            </span>
          </div>

          <button
            type="button"
            onClick={() => onNavigateHome('calculator')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar ao aplicativo
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Header & Month Navigation */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 text-balance">
              Painel do Encarregado
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Organize a escala mensal da equipe importando a planilha padrão ou ajustando diretamente na grade.
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

        {loadError && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-700" />
            <span>{loadError}</span>
          </div>
        )}

        <SupervisorSchedulePanel
          year={year}
          month={month}
          monthKey={monthKey}
          monthTitle={monthTitle}
          schedules={schedules}
          loadingSchedules={loading}
          onSelectEmployeePreview={handlePreviewEmployee}
          onSelectMonth={(targetYear, targetMonth) => {
            setYear(targetYear);
            setMonth(targetMonth);
          }}
        />
      </main>
    </div>
  );
};
