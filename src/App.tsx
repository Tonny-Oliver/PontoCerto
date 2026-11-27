import { useEffect, useMemo, useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { AdminPage } from './components/AdminPage';
import { CalculatorView } from './components/CalculatorView';
import { InstallModal } from './components/InstallModal';
import { ScheduleView } from './components/ScheduleView';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { usePWAInstall } from './hooks/usePWAInstall';
import type { AppView, DailyPunches } from './types/timecard';
import {
  createEmptyPunches,
  loadDraft,
  saveDraft,
} from './utils/storage';
import {
  evaluateTimecard,
  getNowMinutes,
  getTodayISO,
} from './utils/timeRules';

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'calculator', label: 'Hoje' },
  { id: 'schedule', label: 'Escala do Mês' },
];

function isAdminPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '').toLowerCase();
  return clean === '/admin';
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => window.location.pathname);
  const [activeView, setActiveView] = useState<AppView>('calculator');
  const [punches, setPunches] = useState<DailyPunches>(() => loadDraft());
  const [nowMinutes, setNowMinutes] = useState<number>(() => getNowMinutes());
  const [todayDate, setTodayDate] = useState<string>(() => getTodayISO());
  const [installModalOpen, setInstallModalOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigateHome = (targetView: AppView = 'calculator') => {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
      setPathname('/');
    }
    setActiveView(targetView);
  };

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  // Persist current draft automatically
  useEffect(() => {
    saveDraft(punches);
  }, [punches]);

  // Keep live clock and current system date synchronized automatically
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMinutes(getNowMinutes());
      const currentDay = getTodayISO();
      setTodayDate((prevDay) => {
        if (prevDay !== currentDay) {
          setPunches((prevPunches) => {
            if (prevPunches.date === prevDay) {
              return createEmptyPunches(currentDay);
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

  const analysis = useMemo(
    () => evaluateTimecard(punches, nowMinutes),
    [punches, nowMinutes]
  );

  const handlePatchPunches = (patch: Partial<DailyPunches>) => {
    setPunches((prev) => ({
      ...prev,
      ...patch,
      date: todayDate,
    }));
  };

  const handleClearPunches = () => {
    const targetDate = getTodayISO();
    setTodayDate(targetDate);
    setPunches(createEmptyPunches(targetDate));
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

  if (isAdminPath(pathname)) {
    return <AdminPage onNavigateHome={handleNavigateHome} />;
  }

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
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
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
            onChange={handlePatchPunches}
            onClear={handleClearPunches}
          />
        )}

        {activeView === 'schedule' && <ScheduleView />}
      </main>

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
