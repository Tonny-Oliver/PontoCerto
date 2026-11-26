import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

const RULE_SPECS = [
  {
    code: 'Regra 1',
    title: 'Até 6h para almoço',
    limit: 'Saída Almoço − Entrada ≤ 06h00',
    explanation:
      'Você pode trabalhar no máximo 6 horas contínuas antes de iniciar o intervalo de almoço. Além disso, para conseguir cumprir o mínimo de 8h no dia sem ultrapassar 6h à tarde (Regra 3), o período da manhã precisa ter pelo menos 2h00.',
    example: 'Entrada às 08:00 → Saída para almoço recomendada entre 10:00 e 14:00.',
  },
  {
    code: 'Regra 2',
    title: 'Intervalo de 1h a 2h',
    limit: '01h00 ≤ Volta Almoço − Saída Almoço ≤ 02h00',
    explanation:
      'O intervalo intrajornada obrigatório para jornadas acima de 6h deve ter no mínimo 1 hora completa e no máximo 2 horas.',
    example: 'Saída para almoço às 12:00 → Retorno permitido entre 13:00 e 14:00.',
  },
  {
    code: 'Regra 3',
    title: 'Até 6h após almoço',
    limit: 'Saída Final − Volta Almoço ≤ 06h00',
    explanation:
      'O segundo período de trabalho após o retorno do intervalo também não pode ultrapassar 6 horas contínuas.',
    example: 'Volta do almoço às 13:30 → Saída final não pode passar de 19:30.',
  },
  {
    code: 'Regra 4',
    title: 'Máx. 2h extras',
    limit: 'Total Trabalhado ≤ 10h00 (8h + 2h extras)',
    explanation:
      'A soma do período da manhã com o período da tarde não pode ultrapassar 10 horas trabalhadas no dia (jornada padrão de 8h somada ao limite de 2h extras). O sistema cruza automaticamente esta regra com a Regra 3 e mostra qual limite vence primeiro.',
    example:
      'Manhã de 05h00 + Volta às 14:00 → Limite pela Regra 4 às 19:00 (5h00 restantes para 10h totais), antes do limite das 20:00 da Regra 3.',
  },
  {
    code: 'Regra 5',
    title: 'Mínimo 8h',
    limit: 'Total Trabalhado ≥ 08h00',
    explanation:
      'A soma dos períodos trabalhados (descontando o almoço) deve atingir pelo menos 8 horas completas para cumprir a carga diária.',
    example: 'Manhã de 04h00 + Volta às 13:00 → Saída mínima às 17:00.',
  },
  {
    code: 'Regra 6',
    title: 'Descanso mínimo de 11h',
    limit: 'Entrada de Hoje − Saída de Ontem ≥ 11h00',
    explanation:
      'Entre o encerramento de uma jornada e o início da jornada seguinte deve haver no mínimo 11 horas consecutivas de descanso (interjornada).',
    example:
      'Saída às 19:30 hoje → Próxima entrada permitida amanhã somente a partir das 06:30.',
  },
];

export const RulesView: React.FC = () => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 text-balance">
          Guia das 6 Regras de Ponto
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Critérios exatos utilizados pelo motor de cálculo do PontoCerto para
          validar batidas e projetar janelas seguras.
        </p>
      </div>

      {/* Original Reference Image Card */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Quadro de referência das regras
          </h2>
        </div>
        <div className="p-5 flex justify-center bg-slate-50/60 dark:bg-slate-950/40">
          {!imgError ? (
            <img
              src="/assets/aistudio/image_9fc56d7b.png"
              alt="Tabela com as 6 regras de ponto: Regra 1 Até 6h para almoço, Regra 2 Intervalo de 1h a 2h, Regra 3 Até 6h após almoço, Regra 4 Máx. 2h extras, Regra 5 Mínimo 8h, Regra 6 Descanso mínimo de 11h"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="max-w-full h-auto rounded-lg border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <div className="flex items-center gap-3 rounded-lg bg-[#143B63] px-5 py-4 text-white text-xs font-medium">
              <BookOpen className="h-4 w-4 shrink-0" />
              <span>
                Regra 1: Até 6h p/ almoço · Regra 2: Intervalo 1h–2h · Regra 3:
                Até 6h após almoço · Regra 4: Máx. 2h extras · Regra 5: Mín. 8h
                · Regra 6: Descanso mín. 11h
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Detailed Rules Breakdown */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
        {RULE_SPECS.map((rule) => (
          <div key={rule.code} className="px-6 py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2.5">
                <span className="font-mono text-xs font-semibold text-[#143B63] dark:text-sky-400">
                  {rule.code}
                </span>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {rule.title}
                </h3>
              </div>
              <span className="font-mono text-xs text-slate-600 dark:text-slate-400">
                {rule.limit}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-4xl">
              {rule.explanation}
            </p>
            <p className="mt-2 text-xs font-mono text-slate-500 dark:text-slate-400">
              Exemplo: {rule.example}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
};
