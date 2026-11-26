import { useEffect, useMemo, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { CalculatorView } from './components/CalculatorView';
import { HistoryView } from './components/HistoryView';
import { InstallModal } from './components/InstallModal';
import { RulesView } from './components/RulesView';
import { SimulatorView } from './components/SimulatorView';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import type { AppView, DailyPunches, SavedRecord } from './types/timecard';
import {
  createEmptyPunches,
  findPreviousExitForDate,
  loadDraft,
  loadHistory,
  loadTheme,
  saveDraft,
  saveHistory,
  saveTheme,
} from './utils/storage';
import {
  evaluateTimecard,
  getNowMinutes,
  getTodayISO,
} from './utils/timeRules';

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'calculator', label: 'Hoje' },
  { id: 'simulator', label: 'Simulador' },
  { id: 'history', label: 'Histórico' },
  { id: 'rules', label: 'Regras' },
];

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('calculator');
  const [punches, setPunches] = useState<DailyPunches>(() => loadDraft());
  const [history, setHistory] = useState<SavedRecord[]>(() => loadHistory());
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadTheme());
  const [nowMinutes, setNowMinutes] = useState<number>(() => getNowMinutes());
  const [todayDate, setTodayDate] = useState<string>(() => getTodayISO());
  const [isViewingArchivedRecord, setIsViewingArchivedRecord] = useState(false);
  const [installModalOpen, setInstallModalOpen] = useState(false);

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveTheme(theme);
  }, [theme]);

  // Persist current draft automatically (only when on today's live sheet)
  useEffect(() => {
    if (!isViewingArchivedRecord) {
      saveDraft(punches);
    }
  }, [punches, isViewingArchivedRecord]);

  // Persist history automatically
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Keep live clock and current system date synchronized automatically
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMinutes(getNowMinutes());
      const currentDay = getTodayISO();
      setTodayDate((prevDay) => {
        if (prevDay !== currentDay) {
          setPunches((prevPunches) => {
            if (prevPunches.date === prevDay) {
              return createEmptyPunches(
                currentDay,
                prevPunches.exit || prevPunches.prevExit
              );
            }
            return prevPunches;
          });
          return currentDay;
        }
        return prevDay;
      });
    }, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const previousSavedRecord = useMemo(
    () => findPreviousExitForDate(history, punches.date),
    [history, punches.date]
  );

  const analysis = useMemo(
    () => evaluateTimecard(punches, nowMinutes),
    [punches, nowMinutes]
  );

  const handlePatchPunches = (patch: Partial<DailyPunches>) => {
    setPunches((prev) => ({
      ...prev,
      ...patch,
      date: isViewingArchivedRecord ? prev.date : todayDate,
    }));
  };

  const handleClearPunches = () => {
    const targetDate = getTodayISO();
    setTodayDate(targetDate);
    setIsViewingArchivedRecord(false);
    const prevRec = findPreviousExitForDate(history, targetDate);
    setPunches(createEmptyPunches(targetDate, prevRec?.exit ?? ''));
  };

  const handleBackToToday = () => {
    const currentDay = getTodayISO();
    setTodayDate(currentDay);
    setIsViewingArchivedRecord(false);
    setPunches(loadDraft());
  };

  const handleLoadExample = () => {
    const currentDay = getTodayISO();
    setTodayDate(currentDay);
    setIsViewingArchivedRecord(false);
    setPunches({
      date: currentDay,
      prevExit: '18:30',
      prevExitAfterMidnight: false,
      entry: '08:00',
      lunchOut: '12:15',
      lunchIn: '13:15',
      exit: '',
      note: 'Exemplo em andamento',
    });
  };

  const handleSaveRecord = () => {
    const evaluated = evaluateTimecard(punches);
    const id = punches.date;
    const record: SavedRecord = {
      ...punches,
      id,
      savedAt: new Date().toISOString(),
      totalWorkedMinutes: evaluated.totalWorkedMinutes,
      balanceMinutes: evaluated.balanceMinutes,
      violationCount: evaluated.violationCount,
    };

    setHistory((prev) => {
      const withoutSameDate = prev.filter((item) => item.id !== id);
      return [record, ...withoutSameDate].sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    });
  };

  const handleLoadRecord = (record: SavedRecord) => {
    const currentDay = getTodayISO();
    setTodayDate(currentDay);
    setIsViewingArchivedRecord(record.date !== currentDay);
    setPunches({
      date: record.date,
      prevExit: record.prevExit,
      prevExitAfterMidnight: Boolean(record.prevExitAfterMidnight),
      entry: record.entry,
      lunchOut: record.lunchOut,
      lunchIn: record.lunchIn,
      exit: record.exit,
      note: record.note,
    });
    setActiveView('calculator');
  };

  const handleDeleteRecord = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  };

  const handleImportRecords = (incoming: SavedRecord[]) => {
    setHistory((prev) => {
      const map = new Map<string, SavedRecord>();
      prev.forEach((r) => map.set(r.id, r));
      incoming.forEach((r) => map.set(r.id, r));
      return Array.from(map.values()).sort((a, b) =>
        b.date.localeCompare(a.date)
      );
    });
  };

  const handleApplySimulation = (patch: Partial<DailyPunches>) => {
    const currentDay = getTodayISO();
    setTodayDate(currentDay);
    setIsViewingArchivedRecord(false);
    setPunches((prev) => ({ ...prev, ...patch, date: currentDay }));
    setActiveView('calculator');
  };

  const handleInstallAction = async () => {
    if (isInstallable && !isInstalled) {
      const accepted = await install();
      if (!accepted) {
        setInstallModalOpen(true);
      }
      return;
    }
    setInstallModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          {/* Zone 1: Single-element Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('calculator')}
            className="font-display text-lg font-bold tracking-tight text-[#143B63] dark:text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#143B63]"
          >
            PontoCerto
          </button>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveView(item.id)}
                  className={`relative py-1 transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-[#143B63] font-semibold dark:text-sky-400'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-[17px] h-0.5 bg-[#143B63] dark:bg-sky-400" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action (Install / Offline Download) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleInstallAction}
              className="inline-flex items-center gap-2 rounded-lg bg-[#143B63] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#0f2d4d] dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              {isInstalled ? 'Baixar Offline' : 'Instalar App'}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile View Switcher (in flow, non-sticky to respect 15% sticky cap) */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-4 py-2"
      >
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {NAV_ITEMS.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white text-[#143B63] shadow-xs dark:bg-slate-900 dark:text-sky-400'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {activeView === 'calculator' && (
          <CalculatorView
            punches={punches}
            analysis={analysis}
            nowMinutes={nowMinutes}
            previousSavedRecord={previousSavedRecord}
            theme={theme}
            onToggleTheme={() =>
              setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
            }
            onChange={handlePatchPunches}
            onClear={handleClearPunches}
            onSaveRecord={handleSaveRecord}
            onLoadExample={handleLoadExample}
            onBackToToday={handleBackToToday}
          />
        )}

        {activeView === 'simulator' && (
          <SimulatorView
            prevExitDefault={punches.prevExit || previousSavedRecord?.exit || ''}
            onApplyToCalculator={handleApplySimulation}
          />
        )}

        {activeView === 'history' && (
          <HistoryView
            records={history}
            onLoadRecord={handleLoadRecord}
            onDeleteRecord={handleDeleteRecord}
            onImportRecords={handleImportRecords}
            onGoToCalculator={() => setActiveView('calculator')}
          />
        )}

        {activeView === 'rules' && <RulesView />}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400">
          <span>
            PontoCerto · Cálculos locais no navegador (nenhum dado sai do seu
            dispositivo)
          </span>
          <button
            type="button"
            onClick={() => setInstallModalOpen(true)}
            className="font-medium text-slate-700 hover:text-[#143B63] dark:text-slate-300 dark:hover:text-sky-400 transition-colors"
          >
            Instalar no sistema ou baixar versão offline
          </button>
        </div>
      </footer>

      {/* Offline Connectivity Notice (only shown when genuinely offline) */}
      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          Modo offline ativo — seus cálculos e histórico continuam funcionando.
        </div>
      )}

      {/* Install PWA / Download Standalone Offline HTML Modal */}
      <InstallModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
        isInstallable={isInstallable}
        isInstalled={isInstalled}
        isIOS={isIOS}
        onTriggerNativeInstall={install}
      />
    </div>
  );
}
