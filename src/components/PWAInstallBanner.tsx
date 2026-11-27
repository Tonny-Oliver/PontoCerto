import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const DISMISS_STORAGE_KEY = 'pontocerto_pwa_banner_dismissed_v1';

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (!Number.isFinite(dismissedAt)) return false;
    // Re-enable prompt after 7 days if still not installed
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < sevenDaysMs;
  } catch {
    return false;
  }
}

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(() => isDismissedRecently());
  const [showInstructions, setShowInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Never show when already installed as standalone PWA or dismissed
  if (isInstalled || dismissed) {
    return null;
  }

  // Only show when browser natively supports installation or on iOS Safari
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    setShowInstructions(false);
    try {
      localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
      return;
    }

    if (isIOS) {
      setShowInstructions((prev) => !prev);
    }
  };

  return (
    <div
      role="region"
      aria-label="Instalar aplicativo PontoCerto"
      className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-3">
        <img
          src="/pwa-192x192.png"
          alt="Ícone PontoCerto"
          width={40}
          height={40}
          className="h-10 w-10 rounded-lg border border-slate-200 shrink-0 dark:border-slate-700"
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
            Instalar PontoCerto
          </p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 leading-snug">
            Acesse direto da tela inicial, mesmo sem internet.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={installing}
            onClick={() => void handleInstallClick()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#143B63] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0F2F50] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {isIOS && !isInstallable ? (
              <>
                <Smartphone className="h-3.5 w-3.5" />
                {showInstructions ? 'Ocultar' : 'Instalar'}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                {installing ? 'Abrindo...' : 'Instalar'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dispensar aviso de instalação"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isIOS && !isInstallable && showInstructions && (
        <div className="mt-3 border-t border-slate-200 pt-2.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300 space-y-1">
          <p>
            1. Toque no botão{' '}
            <strong className="inline-flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
              Compartilhar <Share className="h-3 w-3" />
            </strong>{' '}
            na barra do Safari.
          </p>
          <p>
            2. Role a lista e toque em{' '}
            <strong className="font-semibold text-slate-900 dark:text-slate-100">
              Adicionar à Tela de Início
            </strong>
            .
          </p>
        </div>
      )}
    </div>
  );
};
