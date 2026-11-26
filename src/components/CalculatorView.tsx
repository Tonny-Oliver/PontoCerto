import React, { useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  MinusCircle,
  Moon,
  RotateCcw,
  Save,
  Sun,
  X,
  XCircle,
} from 'lucide-react';
import type {
  DailyPunches,
  RuleEvaluation,
  SavedRecord,
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
  previousSavedRecord: SavedRecord | null;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onChange: (patch: Partial<DailyPunches>) => void;
  onClear: () => void;
  onSaveRecord: () => void;
  onLoadExample: () => void;
  onBackToToday: () => void;
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
  previousSavedRecord,
  theme,
  onToggleTheme,
  onChange,
  onClear,
  onSaveRecord,
  onLoadExample,
  onBackToToday,
}) => {
  const [savedFeedback, setSavedFeedback] = useState(false);
  const isToday = punches.date === getTodayISO();

  const handlePunchNow = (field: 'entry' | 'lunchOut' | 'lunchIn' | 'exit') => {
    onChange({ [field]: getCurrentHHMM() });
  };

  const handleSave = () => {
    onSaveRecord();
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 2200);
  };

  const { windows, guidance } = analysis;

  const toneIcon =
    guidance.tone === 'ok' ? (
      <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
    ) : guidance.tone === 'violation' ? (
      <XCircle className="h-5 w-5 text-red-700 dark:text-red-400 shrink-0" />
    ) : guidance.tone === 'warning' ? (
      <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0" />
    ) : (
      <Clock className="h-5 w-5 text-[#143B63] dark:text-sky-400 shrink-0" />
    );

  const toneTextClass =
    guidance.tone === 'ok'
      ? 'text-emerald-700 dark:text-emerald-400'
      : guidance.tone === 'violation'
        ? 'text-red-700 dark:text-red-400'
        : guidance.tone === 'warning'
          ? 'text-amber-700 dark:text-amber-400'
          : 'text-[#143B63] dark:text-sky-400';

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
      hint:
        windows.entryMin !== null
          ? `Permitida a partir de ${formatClock(windows.entryMin)} (Regra 6)`
          : 'Início da jornada diária',
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
          : 'Intervalo entre 1h00 e 2h00 (Regra 2)',
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

  const nextDayDisplay =
    windows.nextDayEntryMin !== null
      ? formatClock(windows.nextDayEntryMin)
      : windows.nextDayEntryMinFrom8h !== null
        ? formatClock(windows.nextDayEntryMinFrom8h)
        : '—';

  const nextDaySub =
    windows.nextDayEntryMin !== null
      ? 'Amanhã (Regra 6)'
      : windows.nextDayEntryMinFrom8h !== null
        ? `Se sair às ${formatClock(windows.exitMinFor8h)}`
        : 'Descanso 11h';

  return (
    <div className="space-y-6">
      {/* Workspace Utility Row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {formatDateFullBR(punches.date)}
          </span>
          {isToday ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Agora {formatClock(nowMinutes)}
              </span>
            </>
          ) : (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Registro do histórico
              </span>
              <button
                type="button"
                onClick={onBackToToday}
                className="text-xs font-medium text-[#143B63] underline-offset-2 hover:underline dark:text-sky-400 whitespace-nowrap"
              >
                Voltar para hoje
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLoadExample}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            Exemplo rápido
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpar
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5" />
                Claro
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5" />
                Escuro
              </>
            )}
          </button>
        </div>
      </div>

      {/* Focal Anchor: Next Recommended Safe Punch */}
      <section
        aria-live="polite"
        className="rounded-xl border border-slate-200 bg-white px-6 py-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              {toneIcon}
              <span className={`text-sm font-semibold ${toneTextClass}`}>
                {guidance.headline}
              </span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums text-slate-900 dark:text-slate-50 text-balance">
              {guidance.windowLabel}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-3xl">
              {guidance.subtext}
            </p>
            {guidance.liveNote && (
              <p className="text-xs font-mono tabular-nums font-medium text-slate-700 dark:text-slate-300 pt-0.5">
                {guidance.liveNote}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {guidance.step !== 'complete' && (
              <button
                type="button"
                onClick={() => handlePunchNow(guidance.step as 'entry' | 'lunchOut' | 'lunchIn' | 'exit')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#143B63] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0f2d4d] dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
              >
                <Clock className="h-4 w-4" />
                Bater{' '}
                {guidance.step === 'entry'
                  ? 'Entrada'
                  : guidance.step === 'lunchOut'
                    ? 'Saída Almoço'
                    : guidance.step === 'lunchIn'
                      ? 'Volta Almoço'
                      : 'Saída Final'}{' '}
                Agora
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={!punches.entry}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              {savedFeedback ? (
                <>
                  <BookmarkCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Salvo no histórico
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar dia
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Main Two-Column Desktop Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left Column: Punch Inputs */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Marcações do Dia
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Informe as batidas conforme o relógio de ponto
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {formatDateBR(punches.date)}
            </span>
          </div>

          {/* Previous Day Exit (Regra 6) */}
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <label
                  htmlFor="punch-prevExit"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Saída do dia anterior (Regra 6 · 11h)
                </label>
                {previousSavedRecord &&
                  previousSavedRecord.exit !== punches.prevExit && (
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          prevExit: previousSavedRecord.exit,
                          prevExitAfterMidnight: false,
                        })
                      }
                      className="mt-0.5 text-xs font-medium text-[#143B63] underline-offset-2 hover:underline dark:text-sky-400"
                    >
                      Usar saída de {formatDateBR(previousSavedRecord.date)} (
                      {previousSavedRecord.exit})
                    </button>
                  )}
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  id="punch-prevExit"
                  type="time"
                  value={punches.prevExit}
                  onChange={(e) => onChange({ prevExit: e.target.value })}
                  className="w-30 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-mono tabular-nums text-slate-900 focus:border-[#143B63] focus:outline-none focus:ring-2 focus:ring-[#143B63]/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                {punches.prevExit && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ prevExit: '', prevExitAfterMidnight: false })
                    }
                    aria-label="Limpar saída anterior"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {punches.prevExit && (
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={punches.prevExitAfterMidnight}
                  onChange={(e) =>
                    onChange({ prevExitAfterMidnight: e.target.checked })
                  }
                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#143B63] focus:ring-[#143B63]"
                />
                Turno anterior terminou após 00:00 (madrugada de hoje)
              </label>
            )}
          </div>

          {/* 4 Main Punch Inputs */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {punchRows.map((row) => {
              const value = punches[row.key];
              return (
                <div
                  key={row.key}
                  className={`px-5 py-4 transition-colors ${
                    row.isNext
                      ? 'bg-[#143B63]/[0.03] dark:bg-sky-500/[0.06]'
                      : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={`punch-${row.key}`}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100"
                      >
                        <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                          {row.step}
                        </span>
                        <span>{row.label}</span>
                      </label>
                      <p className="mt-0.5 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                        {row.hint}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        id={`punch-${row.key}`}
                        type="time"
                        value={value}
                        onChange={(e) => onChange({ [row.key]: e.target.value })}
                        className="w-30 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-[#143B63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#143B63]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => handlePunchNow(row.key)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                      >
                        Agora
                      </button>
                      {value && (
                        <button
                          type="button"
                          onClick={() => onChange({ [row.key]: '' })}
                          aria-label={`Limpar ${row.label}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
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

          {/* Optional Note */}
          <div className="border-t border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <label
              htmlFor="punch-note"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Observação (opcional)
            </label>
            <input
              id="punch-note"
              type="text"
              value={punches.note}
              onChange={(e) => onChange({ note: e.target.value })}
              placeholder="Ex.: Home office, consulta médica, plantão..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#143B63]/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </section>

        {/* Right Column: KPIs, Timeline & 6-Rule Audit */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          {/* 4-Column KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
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
                  (analysis.lunchMinutes < 60 || analysis.lunchMinutes > 120)
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-slate-900 dark:text-slate-50'
                }`}
              >
                {formatDuration(analysis.lunchMinutes)}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Faixa 01h00–02h00
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Próxima Entrada
              </div>
              <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                {nextDayDisplay}
              </div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {nextDaySub}
              </div>
            </div>
          </div>

          {/* Horizontal Timeline */}
          <TimelineBar
            analysis={analysis}
            nowMinutes={nowMinutes}
            isToday={isToday}
          />

          {/* 6 Rules Verification List */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Verificação das 6 Regras
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {analysis.violationCount === 0
                ? '0 infrações'
                : `${analysis.violationCount} ${analysis.violationCount === 1 ? 'infração' : 'infrações'}`}
            </span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {analysis.rules.map((rule) => (
              <div
                key={rule.id}
                className={`px-5 py-3.5 transition-colors ${
                  rule.status === 'violation'
                    ? 'bg-red-50/60 dark:bg-red-950/20'
                    : rule.status === 'warning'
                      ? 'bg-amber-50/50 dark:bg-amber-950/15'
                      : ''
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {rule.code}
                    </span>
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {rule.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-xs font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {rule.measuredLabel}
                    </span>
                    <StatusLabel status={rule.status} />
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
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
