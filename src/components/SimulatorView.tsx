import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { DailyPunches } from '../types/timecard';
import { formatDuration, simulateSchedule } from '../utils/timeRules';

interface SimulatorViewProps {
  prevExitDefault: string;
  onApplyToCalculator: (patch: Partial<DailyPunches>) => void;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  prevExitDefault,
  onApplyToCalculator,
}) => {
  const [mode, setMode] = useState<'fromEntry' | 'fromExit'>('fromEntry');
  const [anchorTime, setAnchorTime] = useState('08:00');
  const [morningDuration, setMorningDuration] = useState(240); // 4h00
  const [lunchDuration, setLunchDuration] = useState(60); // 1h00
  const [overtimeMinutes, setOvertimeMinutes] = useState(0); // 0h00
  const [prevExit, setPrevExit] = useState(prevExitDefault);

  const plan = useMemo(
    () =>
      simulateSchedule({
        mode,
        anchorTime,
        morningDuration,
        lunchDuration,
        overtimeMinutes,
        prevExit,
      }),
    [mode, anchorTime, morningDuration, lunchDuration, overtimeMinutes, prevExit]
  );

  const handleModeChange = (nextMode: 'fromEntry' | 'fromExit') => {
    setMode(nextMode);
    if (nextMode === 'fromEntry' && anchorTime === '17:00') {
      setAnchorTime('08:00');
    } else if (nextMode === 'fromExit' && anchorTime === '08:00') {
      setAnchorTime('17:00');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
            Simulador de Jornada Segura
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Planeje seus horários antes de bater o ponto — partindo da entrada ou
            da hora em que precisa sair.
          </p>
        </div>

        {/* Segmented Mode Control */}
        <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1 dark:bg-slate-800 self-start">
          <button
            type="button"
            onClick={() => handleModeChange('fromEntry')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              mode === 'fromEntry'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            A partir da Entrada
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('fromExit')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              mode === 'fromExit'
                ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            A partir da Saída
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Parameters Panel */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <label
                htmlFor="sim-anchor"
                className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                {mode === 'fromEntry'
                  ? 'Horário de Entrada'
                  : 'Horário de Saída desejado'}
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {mode === 'fromEntry'
                  ? 'Quando pretende iniciar a jornada'
                  : 'Hora em que precisa encerrar o expediente'}
              </p>
            </div>
            <input
              id="sim-anchor"
              type="time"
              value={anchorTime}
              onChange={(e) => setAnchorTime(e.target.value)}
              className="w-30 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-[#143B63] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <div className="px-5 py-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <label
                htmlFor="sim-morning"
                className="font-semibold text-slate-900 dark:text-slate-100"
              >
                Período antes do almoço
              </label>
              <span className="font-mono tabular-nums text-xs font-semibold text-[#143B63] dark:text-sky-400">
                {formatDuration(morningDuration)}
              </span>
            </div>
            <input
              id="sim-morning"
              type="range"
              min={120}
              max={360}
              step={15}
              value={morningDuration}
              onChange={(e) => setMorningDuration(Number(e.target.value))}
              className="w-full accent-[#143B63] dark:accent-sky-500"
            />
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>02h00</span>
              <span>04h00</span>
              <span>06h00 (máx.)</span>
            </div>
          </div>

          <div className="px-5 py-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Duração do Almoço (Regra 2)
              </span>
              <span className="font-mono tabular-nums text-xs font-semibold text-[#143B63] dark:text-sky-400">
                {formatDuration(lunchDuration)}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[60, 75, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setLunchDuration(mins)}
                  className={`rounded-lg border py-2 text-xs font-mono tabular-nums font-medium transition-colors whitespace-nowrap ${
                    lunchDuration === mins
                      ? 'border-[#143B63] bg-[#143B63] text-white dark:border-sky-500 dark:bg-sky-600'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {formatDuration(mins)}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                Horas Extras Planejadas (Regra 4)
              </span>
              <span className="font-mono tabular-nums text-xs font-semibold text-[#143B63] dark:text-sky-400">
                +{formatDuration(overtimeMinutes)}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 30, 60, 90, 120].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setOvertimeMinutes(mins)}
                  className={`rounded-lg border py-2 text-xs font-mono tabular-nums font-medium transition-colors whitespace-nowrap ${
                    overtimeMinutes === mins
                      ? 'border-[#143B63] bg-[#143B63] text-white dark:border-sky-500 dark:bg-sky-600'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  +{formatDuration(mins)}
                </button>
              ))}
            </div>
          </div>

          <div className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <label
                htmlFor="sim-prev"
                className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
              >
                Saída de ontem (opcional)
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Confere se a entrada respeita 11h de descanso
              </p>
            </div>
            <input
              id="sim-prev"
              type="time"
              value={prevExit}
              onChange={(e) => setPrevExit(e.target.value)}
              className="w-30 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-[#143B63] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </section>

        {/* Simulated Schedule Output */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Escala Sugerida Sem Infrações
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Distribuição automática respeitando todas as 6 regras
              </p>
            </div>
            {plan && (
              <button
                type="button"
                onClick={() =>
                  onApplyToCalculator({
                    prevExit,
                    entry: plan.entry,
                    lunchOut: plan.lunchOut,
                    lunchIn: plan.lunchIn,
                    exit: plan.exit,
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg bg-[#143B63] px-4 py-2 text-xs font-medium text-white hover:bg-[#0f2d4d] dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
              >
                Aplicar na Calculadora
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {plan ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                <div className="px-5 py-5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    1. Entrada
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {plan.entry}
                  </div>
                </div>
                <div className="px-5 py-5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    2. Saída Almoço
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {plan.lunchOut}
                  </div>
                </div>
                <div className="px-5 py-5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    3. Volta Almoço
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {plan.lunchIn}
                  </div>
                </div>
                <div className="px-5 py-5">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    4. Saída Final
                  </div>
                  <div className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {plan.exit}
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Manhã
                    </div>
                    <div className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatDuration(plan.morningMinutes)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Tarde
                    </div>
                    <div className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatDuration(plan.afternoonMinutes)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Total Trabalhado
                    </div>
                    <div className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {formatDuration(plan.totalMinutes)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Entrada amanhã (11h)
                    </div>
                    <div className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                      {plan.nextEntryMin}
                    </div>
                  </div>
                </div>

                {plan.warning ? (
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{plan.warning}</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      Simulação 100% em conformidade: manhã de{' '}
                      {formatDuration(plan.morningMinutes)} (≤ 6h), intervalo de{' '}
                      {formatDuration(plan.lunchMinutes)} (1h–2h), tarde de{' '}
                      {formatDuration(plan.afternoonMinutes)} (≤ 6h) e total de{' '}
                      {formatDuration(plan.totalMinutes)} (8h–10h).
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Informe um horário válido para gerar a simulação.
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
