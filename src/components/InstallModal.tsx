import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileCode2,
  MonitorDown,
  Share,
  Smartphone,
  X,
} from 'lucide-react';
import { downloadStandaloneOfflineApp } from '../utils/offlineExport';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  onTriggerNativeInstall: () => Promise<boolean>;
}

export const InstallModal: React.FC<InstallModalProps> = ({
  isOpen,
  onClose,
  isInstallable,
  isInstalled,
  isIOS,
  onTriggerNativeInstall,
}) => {
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);
  const [downloadedFile, setDownloadedFile] = useState(false);

  if (!isOpen) return null;

  const handleNativeInstall = async () => {
    const accepted = await onTriggerNativeInstall();
    if (accepted) {
      setInstallFeedback('Aplicativo instalado no sistema com sucesso.');
    }
  };

  const handleDownloadOffline = () => {
    downloadStandaloneOfflineApp();
    setDownloadedFile(true);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div>
            <h2
              id="install-modal-title"
              className="text-base font-semibold text-slate-900 dark:text-slate-100"
            >
              Instalar ou Baixar no Sistema
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Use no computador ou celular mesmo sem conexão com a internet
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {/* Option 1: Install as Native PWA */}
          <div className="px-6 py-5">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#143B63]/10 text-[#143B63] dark:bg-sky-500/15 dark:text-sky-400">
                {isIOS ? (
                  <Smartphone className="h-4 w-4" />
                ) : (
                  <MonitorDown className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  1. Instalar como Aplicativo (PWA)
                </h3>

                {isInstalled ? (
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    O PontoCerto já está instalado neste dispositivo.
                  </p>
                ) : isInstallable ? (
                  <>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Cria um atalho nativo na área de trabalho ou tela inicial
                      com abertura instantânea em janela própria e suporte offline.
                    </p>
                    <div className="mt-3.5">
                      <button
                        type="button"
                        onClick={handleNativeInstall}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#143B63] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f2d4d] dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors whitespace-nowrap"
                      >
                        <Download className="h-4 w-4" />
                        Instalar Aplicativo Agora
                      </button>
                    </div>
                  </>
                ) : isIOS ? (
                  <div className="mt-1.5 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <p>No Safari do iPhone ou iPad:</p>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>
                        Toque no botão{' '}
                        <span className="inline-flex items-center gap-1 font-medium text-slate-900 dark:text-slate-100">
                          Compartilhar <Share className="h-3.5 w-3.5" />
                        </span>{' '}
                        na barra do Safari.
                      </li>
                      <li>
                        Role e toque em{' '}
                        <strong className="font-semibold text-slate-900 dark:text-slate-100">
                          Adicionar à Tela de Início
                        </strong>
                        .
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                    <p>
                      No Chrome, Edge ou Brave, abra este aplicativo em uma aba
                      própria e clique no ícone de instalação na barra de
                      endereços (ou menu do navegador →{' '}
                      <strong className="font-medium text-slate-900 dark:text-slate-100">
                        Instalar PontoCerto
                      </strong>
                      ).
                    </p>
                  </div>
                )}

                {installFeedback && (
                  <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    {installFeedback}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Option 2: Download standalone local HTML file */}
          <div className="px-6 py-5">
            <div className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <FileCode2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  2. Baixar Arquivo Local Offline (.html)
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  Prefere um arquivo salvo diretamente na sua pasta do computador?
                  Baixe a versão independente em arquivo único: basta clicar duas
                  vezes para usar sem servidor e sem internet.
                </p>
                <div className="mt-3.5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleDownloadOffline}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                  >
                    <Download className="h-4 w-4" />
                    Baixar versão offline (.html)
                  </button>
                  {downloadedFile && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Arquivo baixado
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
