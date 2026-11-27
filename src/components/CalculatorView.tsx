import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import type {
  DailyPunches,
  RuleEvaluation,
  TimecardAnalysis,
} from '../types/timecard';
import {
  formatClock,
  formatDateBR,
  formatDateFullBR,
  formatDuration,
  getCurrentHHMM,
  getTodayISO,
} from '../utils/timeRules';
import { TimelineBar } from './TimelineBar';

interface CalculatorViewProps {
  punches: DailyPunches;
  analysis: TimecardAnalysis;
  nowMinutes: number;
  onChange: (patch: Partial<DailyPunches>) => void;
  onClear: () => void;
}

function StatusLabel({ status }: { status: RuleEvaluation['status'] }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Conforme
      </span>
    );
  }
  if (status === 'violation') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400 whitespace-nowrap shrink-0">
        <XCircle className="h-3.5 w-3.5" />
        Violada
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 whitespace-nowrap shrink-0">
        <AlertTriangle className="h-3.5 w-3.5" />
        Atenção
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
      <MinusCircle className="h-3.5 w-3.5" />
      Pendente
    </span>
  );
}

export const CalculatorView: React.FC<CalculatorViewProps> = ({
  punches,
  analysis,
  nowMinutes,
  onChange,
  onClear,
}) => {
  const isToday = punches.date === getTodayISO();

  const handlePunchNow = (field: 'entry' | 'lunchOut' | 'lunchIn' | 'exit') => {
    onChange({ [field]: getCurrentHHMM() });
  };

  const { windows, guidance } = analysis;

  const punchRows: Array<{
    key: 'entry' | 'lunchOut' | 'lunchIn' | 'exit';
    step: string;
    label: string;
    hint: string;
    isNext: boolean;
  }> = [
    {
      key: 'entry',
      step: '01',
      label: 'Entrada',
      hint: 'Início da jornada diária',
      isNext: guidance.step === 'entry',
    },
    {
      key: 'lunchOut',
      step: '02',
      label: 'Saída Almoço',
      hint:
        windows.lunchOutMax !== null
          ? `Segura: ${formatClock(windows.lunchOutRecommendedMin)} até ${formatClock(windows.lunchOutMax, { showNextDayTag: true })}`
          : 'Máx. 6h após a entrada (Regra 1)',
      isNext: guidance.step === 'lunchOut',
    },
    {
      key: 'lunchIn',
      step: '03',
      label: 'Volta Almoço',
      hint:
        windows.lunchInMin !== null
          ? `Segura: ${formatClock(windows.lunchInMin)} até ${formatClock(windows.lunchInMax, { showNextDayTag: true })}`
          : 'Intervalo entre 01h00 e 01h59 (Regra 2)',
      isNext: guidance.step === 'lunchIn',
    },
    {
      key: 'exit',
      step: '04',
      label: 'Saída Final',
      hint:
        windows.exitMinFor8h !== null && windows.exitMaxSafe !== null
          ? windows.exitWindowImpossible
            ? `Conflito: mín. ${formatClock(windows.exitMinFor8h)} > máx. ${formatClock(windows.exitMaxSafe)}`
            : `Segura: ${formatClock(windows.exitMinFor8h)} até ${formatClock(windows.exitMaxSafe, { showNextDayTag: true })}`
          : 'Mín. 8h · Máx. 2h extras / 6h após almoço',
      isNext: guidance.step === 'exit',
    },
  ];

  const primaryWorkedDisplay =
    analysis.totalWorkedMinutes !== null
      ? formatDuration(analysis.totalWorkedMinutes)
      : analysis.liveWorkedMinutes !== null
        ? formatDuration(analysis.liveWorkedMinutes)
        : '—';

  const primaryWorkedSub =
    analysis.totalWorkedMinutes !== null
      ? 'Total do dia'
      : analysis.liveWorkedMinutes !== null
        ? 'Em andamento'
        : 'Sem registro';

  return (
    <div className="space-y-6">
      {/* Workspace Utility Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {formatDateFullBR(punches.date)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Agora {formatClock(nowMinutes)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpar
          </button>
        </div>
      </div>

      {/* Main Two-Column Desktop Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Punch Inputs */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5 dark:border-slate-800">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Marcações do Dia
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Informe as batidas conforme o relógio de ponto
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0 pt-0.5">
              {formatDateBR(punches.date)}
            </span>
          </div>

          {/* 4 Main Punch Inputs */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {punchRows.map((row) => {
              const value = punches[row.key];
              return (
                <div
                  key={row.key}
                  className={`px-4 py-4 sm:px-5 transition-colors ${
                    row.isNext
                      ? 'bg-[#143B63]/[0.03] dark:bg-sky-500/[0.06]'
                      : ''
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`punch-${row.key}`}
                        className="flex items-baseline gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
                      >
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500 shrink-0">
                          {row.step}
                        </span>
                        <span className="whitespace-nowrap">{row.label}</span>
                      </label>
                      <p className="mt-1 text-xs font-mono tabular-nums leading-relaxed text-slate-500 dark:text-slate-400">
                        {row.hint}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <input
                        id={`punch-${row.key}`}
                        type="time"
                        value={value}
                        onChange={(e) => onChange({ [row.key]: e.target.value })}
                        className="flex-1 sm:flex-none sm:w-30 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-[#143B63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#143B63]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => handlePunchNow(row.key)}
                        className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
                      >
                        Agora
                      </button>
                      {value && (
                        <button
                          type="button"
                          onClick={() => onChange({ [row.key]: '' })}
                          aria-label={`Limpar ${row.label}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: KPIs, Timeline & 5-Rule Audit */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* 3-Column KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            <div className="px-5 py-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Trabalhado
              </div>
              <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {primaryWorkedDisplay}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {primaryWorkedSub}
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Saldo / Extras
              </div>
              <div
                className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                  analysis.balanceMinutes === null
                    ? 'text-slate-900 dark:text-slate-50'
                    : analysis.balanceMinutes < 0 ||
                        (analysis.overtimeMinutes ?? 0) > 120
                      ? 'text-red-700 dark:text-red-400'
                      : analysis.balanceMinutes > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-slate-900 dark:text-slate-50'
                }`}
              >
                {formatDuration(analysis.balanceMinutes, true)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Meta 08h00 · Máx +02h00
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Intervalo
              </div>
              <div
                className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                  analysis.lunchMinutes !== null &&
                  (analysis.lunchMinutes < 60 || analysis.lunchMinutes > 119)
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-50'
                }`}
              >
                {formatDuration(analysis.lunchMinutes)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Faixa 01h00–01h59
              </div>
            </div>
          </div>

          {/* Horizontal Timeline */}
          <TimelineBar
            analysis={analysis}
            nowMinutes={nowMinutes}
            isToday={isToday}
          />

          {/* 5 Rules Verification List */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3.5 sm:px-5 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Verificação das 5 Regras
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums whitespace-nowrap shrink-0">
              {analysis.violationCount === 0
                ? '0 infrações'
                : `${analysis.violationCount} ${analysis.violationCount === 1 ? 'infração' : 'infrações'}`}
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {analysis.rules.map((rule) => (
              <div
                key={rule.id}
                className={`px-4 py-3.5 sm:px-5 transition-colors ${
                  rule.status === 'violation'
                    ? 'bg-red-50/60 dark:bg-red-950/20'
                    : rule.status === 'warning'
                      ? 'bg-amber-50/50 dark:bg-amber-950/15'
                      : ''
                }`}
              >
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                      {rule.code}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {rule.title}
                    </span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <span className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {rule.measuredLabel}
                    </span>
                    <StatusLabel status={rule.status} />
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {rule.detail}
                  {rule.limitHint ? ` · ${rule.limitHint}` : ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
