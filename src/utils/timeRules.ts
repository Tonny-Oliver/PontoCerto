import type {
  DailyPunches,
  NextPunchGuidance,
  RuleEvaluation,
  SafeWindows,
  TimecardAnalysis,
} from '../types/timecard';

export const RULE_CONSTANTS = {
  MAX_BEFORE_LUNCH: 360, // 6h00 (Regra 1)
  MIN_LUNCH: 60, // 1h00 (Regra 2)
  MAX_LUNCH: 119, // 1h59 — menos de 2h00 (Regra 2)
  MAX_AFTER_LUNCH: 360, // 6h00 (Regra 3)
  MIN_DAILY_WORK: 480, // 8h00 (Regra 5)
  MAX_OVERTIME: 120, // 2h00 (Regra 4)
  MAX_DAILY_WORK: 600, // 10h00 (Regra 5 + Regra 4)
  MIN_INTERSHIFT_REST: 660, // 11h00 (Regra 6)
  MIN_BEFORE_LUNCH_FOR_8H: 120, // 2h00 (needed so 8h - morning <= 6h after lunch)
} as const;

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function getNowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function parseTimeToMinutes(value: string): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hStr, mStr] = value.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}

export function formatClock(
  minutes: number | null,
  options?: { showNextDayTag?: boolean }
): string {
  if (minutes === null || Number.isNaN(minutes)) return '—';
  const dayOffset = Math.floor(minutes / 1440);
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (options?.showNextDayTag && dayOffset > 0) {
    return `${base} (+${dayOffset}d)`;
  }
  return base;
}

export function formatDuration(minutes: number | null, signed = false): string {
  if (minutes === null || Number.isNaN(minutes)) return '—';
  const sign = minutes < 0 ? '-' : signed && minutes > 0 ? '+' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

export function formatDurationColon(minutes: number | null, signed = false): string {
  if (minutes === null || Number.isNaN(minutes)) return '—';
  const sign = minutes < 0 ? '-' : signed && minutes > 0 ? '+' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDateBR(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateFullBR(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(dateObj);
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
}

export function evaluateTimecard(
  punches: DailyPunches,
  nowMinutes?: number
): TimecardAnalysis {
  const isToday = punches.date === getTodayISO();
  const liveNow = isToday && typeof nowMinutes === 'number' ? nowMinutes : null;

  const rawPrev = parseTimeToMinutes(punches.prevExit);
  const prevExitAbs =
    rawPrev === null ? null : punches.prevExitAfterMidnight ? rawPrev : rawPrev - 1440;

  const t1 = parseTimeToMinutes(punches.entry);

  let t2 = parseTimeToMinutes(punches.lunchOut);
  if (t1 !== null && t2 !== null && t2 < t1) {
    t2 += 1440;
  }

  let t3 = parseTimeToMinutes(punches.lunchIn);
  const baseForT3 = t2 ?? t1;
  if (baseForT3 !== null && t3 !== null && t3 < baseForT3) {
    t3 += 1440;
  }

  let t4 = parseTimeToMinutes(punches.exit);
  const baseForT4 = t3 ?? t2 ?? t1;
  if (baseForT4 !== null && t4 !== null && t4 < baseForT4) {
    t4 += 1440;
  }

  const morningMinutes = t1 !== null && t2 !== null ? t2 - t1 : null;
  const lunchMinutes = t2 !== null && t3 !== null ? t3 - t2 : null;
  const afternoonMinutes = t3 !== null && t4 !== null ? t4 - t3 : null;
  const totalWorkedMinutes =
    morningMinutes !== null && afternoonMinutes !== null
      ? morningMinutes + afternoonMinutes
      : null;

  // Live worked estimation when today's shift is still in progress
  let liveWorkedMinutes: number | null = totalWorkedMinutes;
  if (liveWorkedMinutes === null && liveNow !== null && t1 !== null) {
    const adjustedNow = liveNow < t1 ? liveNow + 1440 : liveNow;
    if (t2 === null) {
      liveWorkedMinutes = Math.max(0, adjustedNow - t1);
    } else if (t3 === null) {
      liveWorkedMinutes = Math.max(0, t2 - t1);
    } else if (t4 === null) {
      const adjNowAfterLunch = liveNow < t3 % 1440 && t3 >= 1440 ? liveNow + 1440 : adjustedNow;
      liveWorkedMinutes = Math.max(0, t2 - t1 + Math.max(0, adjNowAfterLunch - t3));
    }
  }

  const balanceMinutes =
    totalWorkedMinutes !== null
      ? totalWorkedMinutes - RULE_CONSTANTS.MIN_DAILY_WORK
      : null;
  const overtimeMinutes =
    totalWorkedMinutes !== null
      ? Math.max(0, totalWorkedMinutes - RULE_CONSTANTS.MIN_DAILY_WORK)
      : null;

  const restMinutes =
    prevExitAbs !== null && t1 !== null ? t1 - prevExitAbs : null;

  // Compute Safe Windows
  const entryMin =
    prevExitAbs !== null ? prevExitAbs + RULE_CONSTANTS.MIN_INTERSHIFT_REST : null;

  const lunchOutRecommendedMin =
    t1 !== null ? t1 + RULE_CONSTANTS.MIN_BEFORE_LUNCH_FOR_8H : null;
  const lunchOutMax =
    t1 !== null ? t1 + RULE_CONSTANTS.MAX_BEFORE_LUNCH : null;

  const lunchInMin = t2 !== null ? t2 + RULE_CONSTANTS.MIN_LUNCH : null;
  const lunchInMax = t2 !== null ? t2 + RULE_CONSTANTS.MAX_LUNCH : null;

  let exitMinFor8h: number | null = null;
  let exitMaxByRule3: number | null = null;
  let exitMaxByRule4: number | null = null;
  let exitMaxSafe: number | null = null;
  let exitLimitingRule: string | null = null;
  let exitWindowImpossible = false;

  if (morningMinutes !== null && t3 !== null) {
    const neededFor8h = Math.max(0, RULE_CONSTANTS.MIN_DAILY_WORK - morningMinutes);
    exitMinFor8h = t3 + neededFor8h;
    exitMaxByRule3 = t3 + RULE_CONSTANTS.MAX_AFTER_LUNCH;
    const remainingFor10h = Math.max(0, RULE_CONSTANTS.MAX_DAILY_WORK - morningMinutes);
    exitMaxByRule4 = t3 + remainingFor10h;
    exitMaxSafe = Math.min(exitMaxByRule3, exitMaxByRule4);

    if (exitMaxByRule3 < exitMaxByRule4) {
      exitLimitingRule = 'Regra 3 (até 6h após almoço)';
    } else if (exitMaxByRule4 < exitMaxByRule3) {
      exitLimitingRule = 'Regra 4 (máx. 2h extras)';
    } else {
      exitLimitingRule = 'Regras 3 e 4 (6h após almoço e 10h totais)';
    }

    exitWindowImpossible = exitMinFor8h > exitMaxSafe;
  }

  const nextDayEntryMin =
    t4 !== null ? t4 + RULE_CONSTANTS.MIN_INTERSHIFT_REST : null;
  const nextDayEntryMinFrom8h =
    exitMinFor8h !== null ? exitMinFor8h + RULE_CONSTANTS.MIN_INTERSHIFT_REST : null;
  const nextDayEntryMinFromMax =
    exitMaxSafe !== null ? exitMaxSafe + RULE_CONSTANTS.MIN_INTERSHIFT_REST : null;

  const windows: SafeWindows = {
    entryMin,
    lunchOutRecommendedMin,
    lunchOutMax,
    lunchInMin,
    lunchInMax,
    exitMinFor8h,
    exitMaxByRule3,
    exitMaxByRule4,
    exitMaxSafe,
    exitLimitingRule,
    exitWindowImpossible,
    nextDayEntryMin,
    nextDayEntryMinFrom8h,
    nextDayEntryMinFromMax,
  };

  // Evaluate all 6 rules individually
  const rules: RuleEvaluation[] = [];

  // Regra 1: Até 6h para almoço
  if (morningMinutes !== null) {
    if (morningMinutes <= 0) {
      rules.push({
        id: 1,
        code: 'Regra 1',
        title: 'Até 6h para almoço',
        shortRule: 'Máx. 06h00 antes do intervalo',
        status: 'violation',
        measuredLabel: formatDuration(morningMinutes),
        detail: 'A saída para almoço precisa ser posterior à entrada.',
      });
    } else if (morningMinutes > RULE_CONSTANTS.MAX_BEFORE_LUNCH) {
      const over = morningMinutes - RULE_CONSTANTS.MAX_BEFORE_LUNCH;
      rules.push({
        id: 1,
        code: 'Regra 1',
        title: 'Até 6h para almoço',
        shortRule: 'Máx. 06h00 antes do intervalo',
        status: 'violation',
        measuredLabel: `${formatDuration(morningMinutes)} / 06h00`,
        detail: `Excedeu o limite antes do almoço em ${formatDuration(over)}. Deveria ter saído até ${formatClock(lunchOutMax)}.`,
      });
    } else if (morningMinutes < RULE_CONSTANTS.MIN_BEFORE_LUNCH_FOR_8H) {
      rules.push({
        id: 1,
        code: 'Regra 1',
        title: 'Até 6h para almoço',
        shortRule: 'Máx. 06h00 antes do intervalo',
        status: 'warning',
        measuredLabel: `${formatDuration(morningMinutes)} / 06h00`,
        detail:
          'Abaixo de 6h, porém com menos de 2h00 antes do almoço não é possível atingir 8h00 sem ultrapassar 6h00 na tarde (Regra 3).',
      });
    } else {
      rules.push({
        id: 1,
        code: 'Regra 1',
        title: 'Até 6h para almoço',
        shortRule: 'Máx. 06h00 antes do intervalo',
        status: 'ok',
        measuredLabel: `${formatDuration(morningMinutes)} / 06h00`,
        detail: `Período da manhã dentro do limite máximo de 6h00.`,
      });
    }
  } else if (t1 !== null) {
    let status: RuleEvaluation['status'] = 'pending';
    let detail = `Bata a saída para almoço até ${formatClock(lunchOutMax, { showNextDayTag: true })} (ideal a partir de ${formatClock(lunchOutRecommendedMin, { showNextDayTag: true })}).`;
    let measured = `Até ${formatClock(lunchOutMax)}`;

    if (liveNow !== null) {
      const elapsed = Math.max(0, (liveNow < t1 ? liveNow + 1440 : liveNow) - t1);
      measured = `${formatDuration(elapsed)} agora`;
      if (elapsed > RULE_CONSTANTS.MAX_BEFORE_LUNCH) {
        status = 'violation';
        detail = `Já passou de 6h00 sem almoço (excesso de ${formatDuration(elapsed - RULE_CONSTANTS.MAX_BEFORE_LUNCH)}).`;
      } else if (elapsed >= RULE_CONSTANTS.MAX_BEFORE_LUNCH - 30) {
        status = 'warning';
        detail = `Faltam apenas ${formatDuration(RULE_CONSTANTS.MAX_BEFORE_LUNCH - elapsed)} para o limite das ${formatClock(lunchOutMax)}.`;
      }
    }

    rules.push({
      id: 1,
      code: 'Regra 1',
      title: 'Até 6h para almoço',
      shortRule: 'Máx. 06h00 antes do intervalo',
      status,
      measuredLabel: measured,
      detail,
    });
  } else {
    rules.push({
      id: 1,
      code: 'Regra 1',
      title: 'Até 6h para almoço',
      shortRule: 'Máx. 06h00 antes do intervalo',
      status: 'pending',
      measuredLabel: 'Aguardando',
      detail: 'Informe a entrada para calcular o horário limite do almoço.',
    });
  }

  // Regra 2: Intervalo de 1h a 1h59 (< 2h00)
  if (lunchMinutes !== null) {
    if (lunchMinutes < RULE_CONSTANTS.MIN_LUNCH) {
      const missing = RULE_CONSTANTS.MIN_LUNCH - lunchMinutes;
      rules.push({
        id: 2,
        code: 'Regra 2',
        title: 'Intervalo de 1h a 1h59',
        shortRule: 'Entre 01h00 e 01h59 (< 2h00)',
        status: 'violation',
        measuredLabel: formatDuration(lunchMinutes),
        detail: `Intervalo curto demais — faltaram ${formatDuration(missing)} para 1h00 (mínimo às ${formatClock(lunchInMin)}).`,
      });
    } else if (lunchMinutes > RULE_CONSTANTS.MAX_LUNCH) {
      const over = lunchMinutes - RULE_CONSTANTS.MAX_LUNCH;
      rules.push({
        id: 2,
        code: 'Regra 2',
        title: 'Intervalo de 1h a 1h59',
        shortRule: 'Entre 01h00 e 01h59 (< 2h00)',
        status: 'violation',
        measuredLabel: formatDuration(lunchMinutes),
        detail: `Intervalo excedeu o máximo de 01h59 em ${formatDuration(over)} (fechar 2h00 viola a regra; limite era até ${formatClock(lunchInMax)}).`,
      });
    } else {
      rules.push({
        id: 2,
        code: 'Regra 2',
        title: 'Intervalo de 1h a 1h59',
        shortRule: 'Entre 01h00 e 01h59 (< 2h00)',
        status: 'ok',
        measuredLabel: formatDuration(lunchMinutes),
        detail: 'Intervalo dentro da faixa permitida de 1h01 a 01h59 (menor que 2h00).',
      });
    }
  } else if (t2 !== null) {
    rules.push({
      id: 2,
      code: 'Regra 2',
      title: 'Intervalo de 1h a 1h59',
      shortRule: 'Entre 01h00 e 01h59 (< 2h00)',
      status: 'pending',
      measuredLabel: `${formatClock(lunchInMin)} – ${formatClock(lunchInMax)}`,
      detail: `Retorne do almoço entre ${formatClock(lunchInMin, { showNextDayTag: true })} e ${formatClock(lunchInMax, { showNextDayTag: true })}.`,
    });
  } else {
    rules.push({
      id: 2,
      code: 'Regra 2',
      title: 'Intervalo de 1h a 1h59',
      shortRule: 'Entre 01h00 e 01h59 (< 2h00)',
      status: 'pending',
      measuredLabel: 'Aguardando',
      detail: 'Informe a saída para almoço para ver a janela de retorno.',
    });
  }

  // Regra 3: Até 6h após almoço
  if (afternoonMinutes !== null) {
    if (afternoonMinutes <= 0) {
      rules.push({
        id: 3,
        code: 'Regra 3',
        title: 'Até 6h após almoço',
        shortRule: 'Máx. 06h00 no segundo período',
        status: 'violation',
        measuredLabel: formatDuration(afternoonMinutes),
        detail: 'A saída final precisa ser posterior à volta do almoço.',
      });
    } else if (afternoonMinutes > RULE_CONSTANTS.MAX_AFTER_LUNCH) {
      const over = afternoonMinutes - RULE_CONSTANTS.MAX_AFTER_LUNCH;
      rules.push({
        id: 3,
        code: 'Regra 3',
        title: 'Até 6h após almoço',
        shortRule: 'Máx. 06h00 no segundo período',
        status: 'violation',
        measuredLabel: `${formatDuration(afternoonMinutes)} / 06h00`,
        detail: `Excedeu 6h00 após o almoço em ${formatDuration(over)}. Limite era ${formatClock(exitMaxByRule3)}.`,
      });
    } else {
      rules.push({
        id: 3,
        code: 'Regra 3',
        title: 'Até 6h após almoço',
        shortRule: 'Máx. 06h00 no segundo período',
        status: 'ok',
        measuredLabel: `${formatDuration(afternoonMinutes)} / 06h00`,
        detail: 'Segundo período dentro do limite máximo de 6h00.',
      });
    }
  } else if (t3 !== null) {
    const limitRule3 = t3 + RULE_CONSTANTS.MAX_AFTER_LUNCH;
    let status: RuleEvaluation['status'] = 'pending';
    let detail = `Saia até ${formatClock(limitRule3, { showNextDayTag: true })} para não exceder 6h00 após o almoço.`;
    let measured = `Até ${formatClock(limitRule3)}`;

    if (liveNow !== null) {
      const baseNow = liveNow < t3 % 1440 && t3 >= 1440 ? liveNow + 1440 : liveNow < t3 ? liveNow + 1440 : liveNow;
      const elapsedAfter = Math.max(0, baseNow - t3);
      if (baseNow >= t3) {
        measured = `${formatDuration(elapsedAfter)} agora`;
        if (elapsedAfter > RULE_CONSTANTS.MAX_AFTER_LUNCH) {
          status = 'violation';
          detail = `Já excedeu 6h00 após o almoço em ${formatDuration(elapsedAfter - RULE_CONSTANTS.MAX_AFTER_LUNCH)}.`;
        } else if (elapsedAfter >= RULE_CONSTANTS.MAX_AFTER_LUNCH - 30) {
          status = 'warning';
          detail = `Faltam ${formatDuration(RULE_CONSTANTS.MAX_AFTER_LUNCH - elapsedAfter)} para o limite das ${formatClock(limitRule3)}.`;
        }
      }
    }

    rules.push({
      id: 3,
      code: 'Regra 3',
      title: 'Até 6h após almoço',
      shortRule: 'Máx. 06h00 no segundo período',
      status,
      measuredLabel: measured,
      detail,
    });
  } else {
    rules.push({
      id: 3,
      code: 'Regra 3',
      title: 'Até 6h após almoço',
      shortRule: 'Máx. 06h00 no segundo período',
      status: 'pending',
      measuredLabel: 'Aguardando',
      detail: 'Informe a volta do almoço para calcular o limite da tarde.',
    });
  }

  // Regra 4: Máx. 2h extras (total <= 10h)
  if (totalWorkedMinutes !== null && overtimeMinutes !== null) {
    if (totalWorkedMinutes > RULE_CONSTANTS.MAX_DAILY_WORK) {
      const excessOvertime = totalWorkedMinutes - RULE_CONSTANTS.MAX_DAILY_WORK;
      rules.push({
        id: 4,
        code: 'Regra 4',
        title: 'Máx. 2h extras',
        shortRule: 'Total diário até 10h00 (8h + 2h)',
        status: 'violation',
        measuredLabel: `+${formatDuration(overtimeMinutes)} / 02h00`,
        detail: `Passou do teto de 2h00 extras em ${formatDuration(excessOvertime)} (máximo permitido era até ${formatClock(exitMaxByRule4)}).`,
      });
    } else {
      rules.push({
        id: 4,
        code: 'Regra 4',
        title: 'Máx. 2h extras',
        shortRule: 'Total diário até 10h00 (8h + 2h)',
        status: 'ok',
        measuredLabel:
          overtimeMinutes > 0
            ? `+${formatDuration(overtimeMinutes)} / 02h00`
            : '00h00 / 02h00',
        detail:
          overtimeMinutes > 0
            ? `Horas extras dentro do limite diário de 2h00.`
            : 'Nenhuma hora extra registrada hoje.',
      });
    }
  } else if (exitMaxByRule4 !== null) {
    rules.push({
      id: 4,
      code: 'Regra 4',
      title: 'Máx. 2h extras',
      shortRule: 'Total diário até 10h00 (8h + 2h)',
      status: 'pending',
      measuredLabel: `Até ${formatClock(exitMaxByRule4)}`,
      detail: `Limite de 10h00 totais atingido às ${formatClock(exitMaxByRule4, { showNextDayTag: true })}.`,
    });
  } else {
    rules.push({
      id: 4,
      code: 'Regra 4',
      title: 'Máx. 2h extras',
      shortRule: 'Total diário até 10h00 (8h + 2h)',
      status: 'pending',
      measuredLabel: 'Aguardando',
      detail: 'Calculado automaticamente após a volta do almoço.',
    });
  }

  // Regra 5: Mínimo 8h
  if (totalWorkedMinutes !== null) {
    if (totalWorkedMinutes < RULE_CONSTANTS.MIN_DAILY_WORK) {
      const missing = RULE_CONSTANTS.MIN_DAILY_WORK - totalWorkedMinutes;
      rules.push({
        id: 5,
        code: 'Regra 5',
        title: 'Mínimo 8h',
        shortRule: 'Jornada diária mínima de 08h00',
        status: 'violation',
        measuredLabel: `${formatDuration(totalWorkedMinutes)} / 08h00`,
        detail: `Faltaram ${formatDuration(missing)} para completar 8h00 (saída mínima era ${formatClock(exitMinFor8h)}).`,
      });
    } else {
      rules.push({
        id: 5,
        code: 'Regra 5',
        title: 'Mínimo 8h',
        shortRule: 'Jornada diária mínima de 08h00',
        status: 'ok',
        measuredLabel: `${formatDuration(totalWorkedMinutes)} / 08h00`,
        detail: 'Carga horária mínima de 8h00 cumprida.',
      });
    }
  } else if (exitMinFor8h !== null) {
    rules.push({
      id: 5,
      code: 'Regra 5',
      title: 'Mínimo 8h',
      shortRule: 'Jornada diária mínima de 08h00',
      status: exitWindowImpossible ? 'warning' : 'pending',
      measuredLabel: `A partir de ${formatClock(exitMinFor8h)}`,
      detail: exitWindowImpossible
        ? `Seria necessário sair às ${formatClock(exitMinFor8h)}, porém isso ultrapassa o limite de 6h após almoço (${formatClock(exitMaxByRule3)}).`
        : `Você completa 8h00 trabalhadas às ${formatClock(exitMinFor8h, { showNextDayTag: true })}.`,
    });
  } else {
    rules.push({
      id: 5,
      code: 'Regra 5',
      title: 'Mínimo 8h',
      shortRule: 'Jornada diária mínima de 08h00',
      status: 'pending',
      measuredLabel: 'Aguardando',
      detail: 'Informe a volta do almoço para calcular o horário exato das 8h00.',
    });
  }

  // Regra 6: Descanso mínimo de 11h
  if (restMinutes !== null) {
    if (restMinutes < RULE_CONSTANTS.MIN_INTERSHIFT_REST) {
      const missing = RULE_CONSTANTS.MIN_INTERSHIFT_REST - restMinutes;
      rules.push({
        id: 6,
        code: 'Regra 6',
        title: 'Descanso mínimo de 11h',
        shortRule: 'Interjornada mínima de 11h00',
        status: 'violation',
        measuredLabel: `${formatDuration(restMinutes)} / 11h00`,
        detail: `Descanso insuficiente — faltaram ${formatDuration(missing)}. Entrada permitida era a partir de ${formatClock(entryMin)}.`,
        limitHint:
          nextDayEntryMin !== null
            ? `Amanhã: entrada a partir de ${formatClock(nextDayEntryMin)}`
            : undefined,
      });
    } else {
      rules.push({
        id: 6,
        code: 'Regra 6',
        title: 'Descanso mínimo de 11h',
        shortRule: 'Interjornada mínima de 11h00',
        status: 'ok',
        measuredLabel: `${formatDuration(restMinutes)} / 11h00`,
        detail: `Interjornada cumprida com folga de ${formatDuration(restMinutes - RULE_CONSTANTS.MIN_INTERSHIFT_REST)}.`,
        limitHint:
          nextDayEntryMin !== null
            ? `Amanhã: entrada a partir de ${formatClock(nextDayEntryMin)}`
            : undefined,
      });
    }
  } else if (entryMin !== null) {
    rules.push({
      id: 6,
      code: 'Regra 6',
      title: 'Descanso mínimo de 11h',
      shortRule: 'Interjornada mínima de 11h00',
      status: 'pending',
      measuredLabel: `A partir de ${formatClock(entryMin)}`,
      detail: `Com saída anterior às ${punches.prevExit}, sua entrada hoje deve ser a partir das ${formatClock(entryMin)}.`,
    });
  } else if (nextDayEntryMin !== null) {
    rules.push({
      id: 6,
      code: 'Regra 6',
      title: 'Descanso mínimo de 11h',
      shortRule: 'Interjornada mínima de 11h00',
      status: 'pending',
      measuredLabel: `Amanhã ${formatClock(nextDayEntryMin)}`,
      detail: `Saída de ontem não informada. Com sua saída às ${formatClock(t4)}, amanhã você pode entrar a partir das ${formatClock(nextDayEntryMin)}.`,
    });
  } else {
    rules.push({
      id: 6,
      code: 'Regra 6',
      title: 'Descanso mínimo de 11h',
      shortRule: 'Interjornada mínima de 11h00',
      status: 'pending',
      measuredLabel: 'Opcional',
      detail: 'Informe a saída do dia anterior para validar o descanso de 11h00.',
    });
  }

  const violationCount = rules.filter((r) => r.status === 'violation').length;
  const warningCount = rules.filter((r) => r.status === 'warning').length;
  const isComplete = t1 !== null && t2 !== null && t3 !== null && t4 !== null;
  const isAllCompliant = isComplete && violationCount === 0;

  // Build Focal Guidance ("Próximo Ponto Seguro")
  let guidance: NextPunchGuidance;

  if (t1 === null) {
    guidance = {
      step: 'entry',
      headline: entryMin !== null ? 'Entrada liberada a partir de' : 'Comece registrando sua entrada',
      windowLabel: entryMin !== null ? formatClock(entryMin) : 'Aguardando 1ª marcação',
      subtext:
        entryMin !== null
          ? `Baseado na saída anterior às ${punches.prevExit}, respeitando 11h00 de descanso (Regra 6).`
          : 'Digite a hora em que bateu o primeiro ponto ou clique em "Agora" para calcular todas as janelas seguras do dia.',
      tone: 'neutral',
    };
  } else if (t2 === null) {
    let liveNote: string | undefined;
    let tone: NextPunchGuidance['tone'] = violationCount > 0 ? 'violation' : 'neutral';
    if (liveNow !== null) {
      const adjNow = liveNow < t1 ? liveNow + 1440 : liveNow;
      const remainingToMax = (lunchOutMax ?? 0) - adjNow;
      if (remainingToMax < 0) {
        liveNote = `Limite de 6h ultrapassado há ${formatDuration(-remainingToMax)}`;
        tone = 'violation';
      } else if (remainingToMax <= 30) {
        liveNote = `Faltam ${formatDuration(remainingToMax)} para o limite do almoço`;
        tone = 'warning';
      } else {
        liveNote = `Trabalhado até agora: ${formatDuration(adjNow - t1)} · Limite em ${formatDuration(remainingToMax)}`;
      }
    }
    guidance = {
      step: 'lunchOut',
      headline: 'Próximo ponto: Saída para Almoço',
      windowLabel: `${formatClock(lunchOutRecommendedMin)} até ${formatClock(lunchOutMax, { showNextDayTag: true })}`,
      subtext: `Máximo até ${formatClock(lunchOutMax)} (Regra 1). Sair a partir de ${formatClock(lunchOutRecommendedMin)} garante espaço para completar 8h00 sem violar 6h00 à tarde.`,
      tone,
      liveNote,
    };
  } else if (t3 === null) {
    let liveNote: string | undefined;
    let tone: NextPunchGuidance['tone'] =
      violationCount > 0 ? 'violation' : warningCount > 0 ? 'warning' : 'neutral';
    if (liveNow !== null && lunchInMin !== null && lunchInMax !== null) {
      const adjNow = liveNow < t2 % 1440 && t2 >= 1440 ? liveNow + 1440 : liveNow < t2 ? liveNow + 1440 : liveNow;
      if (adjNow < lunchInMin) {
        liveNote = `Faltam ${formatDuration(lunchInMin - adjNow)} para completar 1h00 de intervalo`;
      } else if (adjNow <= lunchInMax) {
        liveNote = `Retorno liberado agora · Prazo máximo (01h59) termina em ${formatDuration(lunchInMax - adjNow)}`;
        if (tone === 'neutral') tone = 'ok';
      } else {
        liveNote = `Limite de 01h59 (< 2h00) excedido há ${formatDuration(adjNow - lunchInMax)}`;
        tone = 'violation';
      }
    }
    guidance = {
      step: 'lunchIn',
      headline: 'Próximo ponto: Volta do Almoço',
      windowLabel: `${formatClock(lunchInMin)} até ${formatClock(lunchInMax, { showNextDayTag: true })}`,
      subtext: `O intervalo precisa ter entre 01h00 e 01h59 (< 2h00, Regra 2). Manhã registrada: ${formatDuration(morningMinutes)}.`,
      tone,
      liveNote,
    };
  } else if (t4 === null) {
    let liveNote: string | undefined;
    let tone: NextPunchGuidance['tone'] =
      violationCount > 0 ? 'violation' : exitWindowImpossible ? 'warning' : 'neutral';

    if (liveNow !== null && exitMinFor8h !== null && exitMaxSafe !== null) {
      const adjNow = liveNow < t3 % 1440 && t3 >= 1440 ? liveNow + 1440 : liveNow < t3 ? liveNow + 1440 : liveNow;
      if (adjNow < exitMinFor8h) {
        liveNote = `Faltam ${formatDuration(exitMinFor8h - adjNow)} para completar as 8h00 mínimas`;
      } else if (adjNow <= exitMaxSafe) {
        liveNote = `8h00 cumpridas · Você pode sair agora (teto seguro termina em ${formatDuration(exitMaxSafe - adjNow)})`;
        if (tone === 'neutral') tone = 'ok';
      } else {
        liveNote = `Teto seguro ultrapassado há ${formatDuration(adjNow - exitMaxSafe)}`;
        tone = 'violation';
      }
    }

    guidance = {
      step: 'exit',
      headline: 'Próximo ponto: Saída Final',
      windowLabel: exitWindowImpossible
        ? `Conflito: mín. ${formatClock(exitMinFor8h)} > máx. ${formatClock(exitMaxSafe)}`
        : `${formatClock(exitMinFor8h)} até ${formatClock(exitMaxSafe, { showNextDayTag: true })}`,
      subtext: exitWindowImpossible
        ? `Como a manhã teve apenas ${formatDuration(morningMinutes)}, não é possível fechar 8h00 sem passar de 6h00 após o almoço.`
        : `Mínimo ${formatClock(exitMinFor8h)} para 8h00 (Regra 5). Limite ${formatClock(exitMaxSafe)} definido por ${exitLimitingRule}. Amanhã: entrada a partir de ${formatClock(nextDayEntryMinFrom8h)} (saindo às ${formatClock(exitMinFor8h)}).`,
      tone,
      liveNote,
    };
  } else {
    guidance = {
      step: 'complete',
      headline:
        violationCount === 0
          ? 'Jornada concluída dentro de todas as regras'
          : `Jornada concluída com ${violationCount} ${violationCount === 1 ? 'infração' : 'infrações'}`,
      windowLabel: `${formatDuration(totalWorkedMinutes)} trabalhadas (${formatDuration(balanceMinutes, true)})`,
      subtext:
        violationCount === 0
          ? `Hora mínima para próxima entrada permitida a partir das ${formatClock(nextDayEntryMin)} (Regra 6 — 11h00 de descanso).`
          : `Revise os itens marcados como "Violada" abaixo. Próxima entrada permitida amanhã a partir das ${formatClock(nextDayEntryMin)}.`,
      tone: violationCount === 0 ? 'ok' : 'violation',
    };
  }

  return {
    normalized: { prevExitAbs, t1, t2, t3, t4 },
    morningMinutes,
    lunchMinutes,
    afternoonMinutes,
    totalWorkedMinutes,
    liveWorkedMinutes,
    balanceMinutes,
    overtimeMinutes,
    restMinutes,
    windows,
    rules,
    guidance,
    violationCount,
    warningCount,
    isComplete,
    isAllCompliant,
  };
}

export interface SimulationPlan {
  entry: string;
  lunchOut: string;
  lunchIn: string;
  exit: string;
  morningMinutes: number;
  lunchMinutes: number;
  afternoonMinutes: number;
  totalMinutes: number;
  overtimeMinutes: number;
  nextEntryMin: string;
  valid: boolean;
  warning?: string;
}

export function simulateSchedule(params: {
  mode: 'fromEntry' | 'fromExit';
  anchorTime: string; // entry if fromEntry, exit if fromExit
  morningDuration: number; // minutes, e.g. 240 (4h)
  lunchDuration: number; // minutes, 60..119
  overtimeMinutes: number; // 0..120
  prevExit?: string;
}): SimulationPlan | null {
  const anchor = parseTimeToMinutes(params.anchorTime);
  if (anchor === null) return null;

  const totalMinutes = RULE_CONSTANTS.MIN_DAILY_WORK + params.overtimeMinutes;
  const lunchMinutes = Math.min(
    RULE_CONSTANTS.MAX_LUNCH,
    Math.max(RULE_CONSTANTS.MIN_LUNCH, params.lunchDuration)
  );
  // Ensure morning and afternoon stay within 6h each when possible
  const minMorning = Math.max(60, totalMinutes - RULE_CONSTANTS.MAX_AFTER_LUNCH);
  const maxMorning = Math.min(RULE_CONSTANTS.MAX_BEFORE_LUNCH, totalMinutes - 60);
  const morningMinutes = Math.min(maxMorning, Math.max(minMorning, params.morningDuration));
  const afternoonMinutes = totalMinutes - morningMinutes;

  let t1: number;
  let t2: number;
  let t3: number;
  let t4: number;

  if (params.mode === 'fromEntry') {
    t1 = anchor;
    t2 = t1 + morningMinutes;
    t3 = t2 + lunchMinutes;
    t4 = t3 + afternoonMinutes;
  } else {
    t4 = anchor;
    t3 = t4 - afternoonMinutes;
    t2 = t3 - lunchMinutes;
    t1 = t2 - morningMinutes;
    if (t1 < 0) {
      t1 += 1440;
      t2 += 1440;
      t3 += 1440;
      t4 += 1440;
    }
  }

  let warning: string | undefined;
  const prevMin = parseTimeToMinutes(params.prevExit ?? '');
  if (prevMin !== null) {
    const rest = t1 - (prevMin - 1440);
    if (rest < RULE_CONSTANTS.MIN_INTERSHIFT_REST) {
      warning = `Atenção: entrada às ${formatClock(t1)} deixa apenas ${formatDuration(rest)} de descanso desde ontem (${params.prevExit}). Mínimo seguro pela Regra 6: ${formatClock(prevMin - 1440 + RULE_CONSTANTS.MIN_INTERSHIFT_REST)}.`;
    }
  }

  return {
    entry: formatClock(t1),
    lunchOut: formatClock(t2),
    lunchIn: formatClock(t3),
    exit: formatClock(t4),
    morningMinutes,
    lunchMinutes,
    afternoonMinutes,
    totalMinutes,
    overtimeMinutes: params.overtimeMinutes,
    nextEntryMin: formatClock(t4 + RULE_CONSTANTS.MIN_INTERSHIFT_REST),
    valid: !warning,
    warning,
  };
}
