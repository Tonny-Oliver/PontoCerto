import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Search,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import type { SavedRecord } from '../types/timecard';
import { exportHistoryCSV, exportHistoryJSON } from '../utils/storage';
import { formatDateBR, formatDuration } from '../utils/timeRules';

interface HistoryViewProps {
  records: SavedRecord[];
  onLoadRecord: (record: SavedRecord) => void;
  onDeleteRecord: (id: string) => void;
  onImportRecords: (records: SavedRecord[]) => void;
  onGoToCalculator: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  records,
  onLoadRecord,
  onDeleteRecord,
  onImportRecords,
  onGoToCalculator,
}) => {
  const [filter, setFilter] = useState<'all' | 'ok' | 'violation'>('all');
  const [search, setSearch] = useState('');
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return records.filter((r) => {
      if (filter === 'ok' && r.violationCount > 0) return false;
      if (filter === 'violation' && r.violationCount === 0) return false;
      if (q) {
        const hay = `${formatDateBR(r.date)} ${r.date} ${r.note || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, filter, search]);

  const summary = useMemo(() => {
    const totalDays = records.length;
    const compliantDays = records.filter((r) => r.violationCount === 0).length;
    const totalWorked = records.reduce(
      (acc, r) => acc + (r.totalWorkedMinutes ?? 0),
      0
    );
    const totalBalance = records.reduce(
      (acc, r) => acc + (r.balanceMinutes ?? 0),
      0
    );
    return { totalDays, compliantDays, totalWorked, totalBalance };
  }, [records]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list = Array.isArray(parsed) ? parsed : parsed?.records;
        if (!Array.isArray(list)) {
          setImportMessage('Arquivo JSON inválido.');
          return;
        }
        const validRecords = list.filter(
          (item): item is SavedRecord =>
            Boolean(item && typeof item.date === 'string' && typeof item.id === 'string')
        );
        onImportRecords(validRecords);
        setImportMessage(`${validRecords.length} registro(s) importado(s).`);
      } catch {
        setImportMessage('Não foi possível ler o arquivo de backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
            Histórico de Marcações
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Dados salvos localmente no seu navegador. A saída do último dia
            alimenta automaticamente a Regra 6 (11h de descanso).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportHistoryCSV(records)}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => exportHistoryJSON(records)}
            disabled={records.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Backup JSON
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="h-3.5 w-3.5" />
            Importar JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {importMessage && (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {importMessage}
        </div>
      )}

      {/* Summary Strip */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="px-5 py-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Dias salvos
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {summary.totalDays}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Sem infrações
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {summary.compliantDays}/{summary.totalDays}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Horas registradas
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {formatDuration(summary.totalWorked)}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Saldo acumulado
            </div>
            <div
              className={`mt-1 font-mono text-xl font-bold tabular-nums ${
                summary.totalBalance < 0
                  ? 'text-red-700 dark:text-red-400'
                  : summary.totalBalance > 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-900 dark:text-slate-50'
              }`}
            >
              {formatDuration(summary.totalBalance, true)}
            </div>
          </div>
        </div>
      </section>

      {/* Filter Bar & Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800 self-start">
            {(
              [
                ['all', 'Todos'],
                ['ok', 'Conformes'],
                ['violation', 'Com infração'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filter === key
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar data ou observação..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#143B63] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>

        {records.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Nenhum dia salvo no histórico ainda
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Registre suas marcações na aba Hoje e clique em "Salvar dia" para
              acompanhar seu saldo e alimentar automaticamente o descanso de 11h.
            </p>
            <button
              type="button"
              onClick={onGoToCalculator}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#143B63] px-4 py-2 text-xs font-medium text-white hover:bg-[#0f2d4d] dark:bg-sky-600 dark:hover:bg-sky-500 transition-colors"
            >
              Registrar primeiro dia
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum registro encontrado para os filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  <th className="py-2.5 pl-5 pr-3">Data</th>
                  <th className="py-2.5 px-3 text-right">Entrada</th>
                  <th className="py-2.5 px-3 text-right">Almoço</th>
                  <th className="py-2.5 px-3 text-right">Saída</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Saldo</th>
                  <th className="py-2.5 px-3">Situação</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs dark:divide-slate-800">
                {filtered.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pl-5 pr-3">
                      <div className="font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {formatDateBR(rec.date)}
                      </div>
                      {rec.note && (
                        <div className="text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                          {rec.note}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {rec.entry || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {rec.lunchOut || '—'} – {rec.lunchIn || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {rec.exit || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                      {formatDuration(rec.totalWorkedMinutes)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono tabular-nums font-semibold ${
                        rec.balanceMinutes === null
                          ? 'text-slate-500'
                          : rec.balanceMinutes < 0
                            ? 'text-red-700 dark:text-red-400'
                            : rec.balanceMinutes > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {formatDuration(rec.balanceMinutes, true)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {rec.violationCount === 0 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Conforme
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
                          <XCircle className="h-3.5 w-3.5" />
                          {rec.violationCount}{' '}
                          {rec.violationCount === 1 ? 'infração' : 'infrações'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onLoadRecord(rec)}
                          title="Abrir na calculadora"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
                        >
                          <FolderOpen className="h-3 w-3" />
                          Abrir
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(rec.id)}
                          aria-label={`Excluir registro de ${formatDateBR(rec.date)}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
