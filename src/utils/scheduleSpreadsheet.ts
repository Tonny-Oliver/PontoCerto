import {
  EmployeeScheduleRecord,
  ParsedMonthBlock,
  ParsedSpreadsheetRow,
  ScheduleDayCode,
  SpreadsheetParseResult,
} from '../types/schedule';

// Matches Brazilian company schedule convention: Dom=D, Seg=S, Ter=T, Qua=Q, Qui=I, Sex=X, Sáb=S
const COMPANY_WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'I', 'X', 'S'];

export const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_TOKEN_MAP: Record<string, number> = {
  janeiro: 0,
  jan: 0,
  fevereiro: 1,
  fev: 1,
  marco: 2,
  mar: 2,
  abril: 3,
  abr: 3,
  maio: 4,
  mai: 4,
  junho: 5,
  jun: 5,
  julho: 6,
  jul: 6,
  agosto: 7,
  ago: 7,
  setembro: 8,
  set: 8,
  outubro: 9,
  out: 9,
  novembro: 10,
  nov: 10,
  dezembro: 11,
  dez: 11,
};

export function formatMonthKey(year: number, monthZeroBased: number): string {
  return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}`;
}

export function getDaysInMonth(year: number, monthZeroBased: number): number {
  return new Date(year, monthZeroBased + 1, 0).getDate();
}

export function normalizeEmployeeName(rawName: string): string {
  return rawName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function sanitizeField(value: string, maxLength: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function buildScheduleDocId(monthKey: string, employeeName: string): string {
  const normalized = normalizeEmployeeName(employeeName);
  const slug = normalized.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 96);
  const safeSlug = slug.length >= 2 ? slug : `colab_${Date.now()}`;
  return `${monthKey}_${safeSlug}`.slice(0, 128);
}

export function rebuildMonthBlockForYear(
  block: ParsedMonthBlock,
  newYear: number
): ParsedMonthBlock {
  const newMonthKey = formatMonthKey(newYear, block.monthIndex);
  const totalDays = getDaysInMonth(newYear, block.monthIndex);

  const updatedRows: ParsedSpreadsheetRow[] = block.rows.map((row) => {
    const trimmedDays: Record<string, ScheduleDayCode> = {};
    let offCount = 0;
    let specialCount = 0;

    for (let d = 1; d <= totalDays; d++) {
      const code = row.days[String(d)] || 'T';
      trimmedDays[String(d)] = code;
      if (code === 'F') offCount++;
      else if (code !== 'T') specialCount++;
    }

    return {
      ...row,
      docId: buildScheduleDocId(newMonthKey, row.employeeName),
      days: trimmedDays,
      offCount,
      specialCount,
    };
  });

  return {
    ...block,
    year: newYear,
    monthKey: newMonthKey,
    rows: updatedRows,
  };
}

export function generateDefault5x2Days(
  year: number,
  monthZeroBased: number,
  startOffWeekday = 6
): Record<string, ScheduleDayCode> {
  const totalDays = getDaysInMonth(year, monthZeroBased);
  const firstDayWeekday = new Date(year, monthZeroBased, 1).getDay();
  const days: Record<string, ScheduleDayCode> = {};

  for (let d = 1; d <= totalDays; d++) {
    const weekday = new Date(year, monthZeroBased, d).getDay();
    if (weekday === 0) {
      days[String(d)] = 'F';
      continue;
    }
    const weekIndex = Math.floor((firstDayWeekday + d - 1) / 7);
    const rotatingWeekday = ((startOffWeekday - 1 + weekIndex) % 6) + 1;
    days[String(d)] = weekday === rotatingWeekday ? 'F' : 'T';
  }

  return days;
}

function stripAccentsLower(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeDayCode(rawCell: unknown): { code: ScheduleDayCode; unrecognized: boolean } {
  const text = String(rawCell ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

  if (
    !text ||
    text === '-' ||
    text === 'T' ||
    text === 'TRAB' ||
    text === 'TRABALHO' ||
    text === 'X' ||
    text === '1'
  ) {
    return { code: 'T', unrecognized: false };
  }
  if (
    text === 'DS' ||
    text === 'DSR' ||
    text === 'F' ||
    text === 'FOL' ||
    text === 'FOLGA' ||
    text === 'OFF' ||
    text === 'DESC' ||
    text === 'DESCANSO'
  ) {
    return { code: 'F', unrecognized: false };
  }
  if (text === 'FE' || text === 'FER' || text === 'FERIAS') {
    return { code: 'FE', unrecognized: false };
  }
  if (text === 'FR' || text === 'FERIADO' || text === 'FER.') {
    return { code: 'FR', unrecognized: false };
  }
  if (
    text === 'A' ||
    text === 'AF' ||
    text === 'AT' ||
    text === 'ATESTADO' ||
    text === 'AFASTAMENTO' ||
    text === 'AFAST' ||
    text === 'LICENCA'
  ) {
    return { code: 'A', unrecognized: false };
  }

  return { code: 'T', unrecognized: true };
}

function dayCodeToCompanyCell(code: ScheduleDayCode | undefined): string {
  switch (code) {
    case 'F':
      return 'DS';
    case 'FR':
      return 'FR';
    case 'FE':
      return 'FE';
    case 'A':
      return 'A';
    default:
      return '';
  }
}

function extractDayNumber(cell: unknown): number | null {
  if (typeof cell === 'number' && Number.isInteger(cell) && cell >= 1 && cell <= 31) {
    return cell;
  }

  const raw = String(cell ?? '').trim();
  if (!raw) return null;

  // Matches "1", "01", "Dia 1", "Dia 01", "01/12", "1/12/2026"
  const match = raw.match(/^(?:dia\s*)?0?([1-9]|[12][0-9]|3[01])(?:\/\d{1,2}(?:\/\d{2,4})?)?$/i);
  if (match) {
    const parsed = Number(match[1]);
    if (parsed >= 1 && parsed <= 31) {
      return parsed;
    }
  }

  return null;
}

function detectMonthAndYearFromText(cell: unknown): {
  monthIndex: number | null;
  explicitYear: number | null;
} {
  const cleaned = stripAccentsLower(cell);
  if (!cleaned) return { monthIndex: null, explicitYear: null };

  let monthIndex: number | null = null;
  const tokens = cleaned.split(/[^a-z]+/).filter(Boolean);
  for (const token of tokens) {
    if (token in MONTH_TOKEN_MAP) {
      monthIndex = MONTH_TOKEN_MAP[token];
      break;
    }
  }

  const yearMatch = cleaned.match(/\b(20\d{2})\b/);
  const explicitYear = yearMatch ? Number(yearMatch[1]) : null;

  return { monthIndex, explicitYear };
}

interface DayRunSegment {
  dayCols: Map<number, number>;
  startCol: number;
  endCol: number;
  monthIndex: number | null;
  explicitYear: number | null;
}

interface SheetMergeRange {
  s: { r: number; c: number };
  e: { r: number; c: number };
}

function resolveMonthBannerForColumns(
  dayRowIdx: number,
  startCol: number,
  endCol: number,
  rawRows: unknown[][],
  merges: SheetMergeRange[]
): { monthIndex: number | null; explicitYear: number | null } {
  const minRow = Math.max(0, dayRowIdx - 3);
  for (let r = dayRowIdx - 1; r >= minRow; r--) {
    // 1. Merged cells overlapping [startCol..endCol] on row r
    for (const merge of merges) {
      if (
        merge.s.r <= r &&
        merge.e.r >= r &&
        merge.e.c >= startCol &&
        merge.s.c <= endCol
      ) {
        const anchorVal = rawRows[merge.s.r]?.[merge.s.c];
        const found = detectMonthAndYearFromText(anchorVal);
        if (found.monthIndex !== null) {
          return found;
        }
      }
    }

    // 2. Individual cells inside [startCol - 1 .. endCol]
    const rowData = rawRows[r] || [];
    const scanStart = Math.max(0, startCol - 1);
    const scanEnd = Math.min(rowData.length - 1, endCol);
    for (let c = scanStart; c <= scanEnd; c++) {
      const found = detectMonthAndYearFromText(rowData[c]);
      if (found.monthIndex !== null) {
        return found;
      }
    }
  }

  return { monthIndex: null, explicitYear: null };
}

function extractDayRunSegments(
  row: unknown[],
  dayRowIdx: number,
  rawRows: unknown[][],
  merges: SheetMergeRange[]
): DayRunSegment[] {
  const segments: DayRunSegment[] = [];
  let col = 0;

  while (col < row.length) {
    const dayVal = extractDayNumber(row[col]);
    if (dayVal === 1) {
      const dayCols = new Map<number, number>();
      const startCol = col;
      let expected = 1;
      let cursor = col;

      while (cursor < row.length && expected <= 31) {
        const val = extractDayNumber(row[cursor]);
        if (val === expected) {
          dayCols.set(expected, cursor);
          expected++;
          cursor++;
        } else {
          break;
        }
      }

      if (dayCols.size >= 7) {
        const endCol = cursor - 1;
        const { monthIndex, explicitYear } = resolveMonthBannerForColumns(
          dayRowIdx,
          startCol,
          endCol,
          rawRows,
          merges
        );
        segments.push({ dayCols, startCol, endCol, monthIndex, explicitYear });
        col = cursor;
        continue;
      }
    }
    col++;
  }

  return segments;
}

function extractSheetMetadata(
  rawRows: unknown[][],
  headerLimitRow: number
): {
  defaultDepartment: string;
  headerMonthIndex: number | null;
  headerYear: number | null;
} {
  let defaultDepartment = '';
  let headerMonthIndex: number | null = null;
  let headerYear: number | null = null;
  const maxRow = Math.min(rawRows.length, headerLimitRow);

  for (let r = 0; r < maxRow; r++) {
    const row = rawRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const rawText = String(row[c] ?? '').trim();
      if (!rawText) continue;

      if (!defaultDepartment) {
        const deptInline = rawText.match(/^setor\s*[:\-]\s*(.+)$/i);
        if (deptInline && deptInline[1].trim()) {
          defaultDepartment = sanitizeField(deptInline[1], 60);
        } else if (/^setor\s*[:\-]?$/i.test(rawText)) {
          const nextCell = String(row[c + 1] ?? '').trim();
          if (nextCell) {
            defaultDepartment = sanitizeField(nextCell, 60);
          }
        }
      }

      if (headerMonthIndex === null) {
        const monthInline = rawText.match(/^m[eê]s\s*[:\-]\s*(.+)$/i);
        if (monthInline && monthInline[1].trim()) {
          const found = detectMonthAndYearFromText(monthInline[1]);
          headerMonthIndex = found.monthIndex;
          if (found.explicitYear) headerYear = found.explicitYear;
        } else if (/^m[eê]s\s*[:\-]?$/i.test(rawText)) {
          const nextCell = String(row[c + 1] ?? '').trim();
          if (nextCell) {
            const found = detectMonthAndYearFromText(nextCell);
            headerMonthIndex = found.monthIndex;
            if (found.explicitYear) headerYear = found.explicitYear;
          }
        }
      }

      if (headerYear === null) {
        const yearMatch = rawText.match(/\b(20\d{2})\b/);
        if (yearMatch) {
          headerYear = Number(yearMatch[1]);
        }
      }
    }
  }

  return { defaultDepartment, headerMonthIndex, headerYear };
}

function isIgnoredFooterRow(rawName: string): boolean {
  const lower = stripAccentsLower(rawName);
  if (!lower) return true;
  return (
    lower.startsWith('total') ||
    lower.startsWith('legenda') ||
    lower.startsWith('obs') ||
    lower.startsWith('visto') ||
    lower.startsWith('assinatura') ||
    lower.startsWith('ds =') ||
    lower.startsWith('fr =') ||
    lower === 'colaborador' ||
    lower === 'nome'
  );
}

function isInstructionSheetName(name: string): boolean {
  const lower = stripAccentsLower(name);
  return lower.includes('instruc') || lower.includes('legenda') || lower.includes('ajuda');
}

function buildCompanyTemplateRows(
  year: number,
  monthZeroBased: number,
  existingSchedules?: EmployeeScheduleRecord[]
): {
  aoa: (string | number)[][];
  merges: SheetMergeRange[];
  totalDays: number;
} {
  const totalDays = getDaysInMonth(year, monthZeroBased);
  const monthName = MONTH_NAMES_PT[monthZeroBased];
  const defaultDept =
    existingSchedules?.find((item) => item.department)?.department || 'Sala do transporte';

  const weekdayLetters = Array.from({ length: totalDays }, (_, i) => {
    const wd = new Date(year, monthZeroBased, i + 1).getDay();
    return COMPANY_WEEKDAY_LETTERS[wd];
  });
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  const row0: (string | number)[] = ['ESCALA MENSAL'];
  const row1: (string | number)[] = [`Setor: ${defaultDept}`, '', '', '', '', `Mês: ${monthName}`];
  const row2: (string | number)[] = [];
  const row3: (string | number)[] = ['', monthName.toUpperCase()];
  const row4: (string | number)[] = ['COLABORADOR', ...weekdayLetters];
  const row5: (string | number)[] = ['', ...dayNumbers];

  let employeeRows: (string | number)[][];
  if (existingSchedules && existingSchedules.length > 0) {
    employeeRows = existingSchedules.map((item) => [
      item.employeeName,
      ...Array.from({ length: totalDays }, (_, i) =>
        dayCodeToCompanyCell(item.days[String(i + 1)])
      ),
    ]);
  } else {
    const sampleA = generateDefault5x2Days(year, monthZeroBased, 6);
    const sampleB = generateDefault5x2Days(year, monthZeroBased, 4);
    employeeRows = [
      [
        'DENILSON',
        ...Array.from({ length: totalDays }, (_, i) =>
          dayCodeToCompanyCell(sampleA[String(i + 1)])
        ),
      ],
      [
        'TONY',
        ...Array.from({ length: totalDays }, (_, i) =>
          dayCodeToCompanyCell(sampleB[String(i + 1)])
        ),
      ],
    ];
  }

  const merges: SheetMergeRange[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalDays } },
    { s: { r: 3, c: 1 }, e: { r: 3, c: totalDays } },
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
  ];

  return {
    aoa: [row0, row1, row2, row3, row4, row5, ...employeeRows],
    merges,
    totalDays,
  };
}

export async function downloadStandardExcelTemplate(
  year: number,
  monthZeroBased: number,
  existingSchedules?: EmployeeScheduleRecord[]
): Promise<void> {
  const XLSX = await import('xlsx');
  const monthKey = formatMonthKey(year, monthZeroBased);
  const { aoa, merges, totalDays } = buildCompanyTemplateRows(
    year,
    monthZeroBased,
    existingSchedules
  );

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!merges'] = merges;
  sheet['!cols'] = [
    { wch: 24 },
    ...Array.from({ length: totalDays }, () => ({ wch: 4.5 })),
  ];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Escala');

  const instructionsRows = [
    ['PLANILHA PADRÃO DE ESCALA MENSAL — PONTOCERTO'],
    ['Mês de referência', `${MONTH_NAMES_PT[monthZeroBased]} / ${year}`],
    [],
    ['COMO PREENCHER'],
    ['1. Você pode usar esta planilha padrão OU anexar diretamente a planilha atual da empresa (ESCALA MENSAL), inclusive com vários meses lado a lado (ex.: DEZEMBRO e JANEIRO) ou em abas separadas.'],
    ['2. Todos os meses encontrados na planilha serão detectados e registrados automaticamente de uma só vez.'],
    ['3. Nos dias do mês, utilize os códigos abaixo:'],
    [],
    ['Código', 'Significado', 'Também aceito na importação'],
    ['(vazio) ou T', 'Trabalho', 'Trabalho, Trab, X'],
    ['DS', 'Folga / Descanso Semanal', 'F, Folga, DSR, Off'],
    ['FR', 'Feriado', 'Feriado'],
    ['FE', 'Férias', 'Férias, Ferias'],
    ['A', 'Afastamento / Atestado', 'AT, Atestado, Afastamento, Licença'],
    [],
    ['4. Salve o arquivo (.xlsx ou .csv) e anexe em /admin no PontoCerto.'],
  ];
  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsRows);
  instructionsSheet['!cols'] = [{ wch: 22 }, { wch: 36 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instrucoes');

  const filename =
    existingSchedules && existingSchedules.length > 0
      ? `escala-pontocerto-${monthKey}.xlsx`
      : `escala-mensal-padrao-${monthKey}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

export function downloadStandardCsvTemplate(
  year: number,
  monthZeroBased: number,
  existingSchedules?: EmployeeScheduleRecord[]
): void {
  const monthKey = formatMonthKey(year, monthZeroBased);
  const totalDays = getDaysInMonth(year, monthZeroBased);
  const header = [
    'COLABORADOR',
    ...Array.from({ length: totalDays }, (_, i) => String(i + 1).padStart(2, '0')),
  ];

  let dataRows: string[][];
  if (existingSchedules && existingSchedules.length > 0) {
    dataRows = existingSchedules.map((item) => [
      item.employeeName,
      ...Array.from({ length: totalDays }, (_, i) =>
        dayCodeToCompanyCell(item.days[String(i + 1)])
      ),
    ]);
  } else {
    const sampleA = generateDefault5x2Days(year, monthZeroBased, 6);
    const sampleB = generateDefault5x2Days(year, monthZeroBased, 4);
    dataRows = [
      [
        'DENILSON',
        ...Array.from({ length: totalDays }, (_, i) =>
          dayCodeToCompanyCell(sampleA[String(i + 1)])
        ),
      ],
      [
        'TONY',
        ...Array.from({ length: totalDays }, (_, i) =>
          dayCodeToCompanyCell(sampleB[String(i + 1)])
        ),
      ],
    ];
  }

  const matrix = [header, ...dataRows];
  const csvContent =
    '\uFEFF' +
    matrix
      .map((row) =>
        row
          .map((cell) => {
            const safe = String(cell ?? '').replace(/"/g, '""');
            return safe.includes(';') || safe.includes('"') || safe.includes('\n')
              ? `"${safe}"`
              : safe;
          })
          .join(';')
      )
      .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download =
    existingSchedules && existingSchedules.length > 0
      ? `escala-pontocerto-${monthKey}.csv`
      : `escala-mensal-padrao-${monthKey}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export async function parseScheduleSpreadsheet(
  file: File,
  fallbackYear: number,
  fallbackMonthZeroBased: number
): Promise<SpreadsheetParseResult> {
  const warnings: string[] = [];

  try {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (!workbook.SheetNames.length) {
      return {
        months: [],
        warnings: [],
        error: 'A planilha está vazia ou não possui abas válidas.',
      };
    }

    const candidateSheetNames = workbook.SheetNames.filter(
      (name) => !isInstructionSheetName(name)
    );
    const sheetsToScan =
      candidateSheetNames.length > 0 ? candidateSheetNames : [workbook.SheetNames[0]];

    const parsedMonthMap = new Map<string, ParsedMonthBlock>();
    let totalUnrecognizedCells = 0;

    for (const sheetName of sheetsToScan) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const merges: SheetMergeRange[] =
        (sheet['!merges'] as SheetMergeRange[] | undefined) || [];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: true,
      });

      if (rawRows.length < 2) continue;

      // Step 1: Find day-numbers row with 1+ contiguous day runs starting at 1
      let dayHeaderRow = -1;
      let segments: DayRunSegment[] = [];
      const scanLimit = Math.min(rawRows.length, 25);

      for (let r = 0; r < scanLimit; r++) {
        const found = extractDayRunSegments(rawRows[r] || [], r, rawRows, merges);
        if (found.length > 0) {
          dayHeaderRow = r;
          segments = found;
          break;
        }
      }

      // Fallback for small/partial sheets (< 7 day columns)
      if (dayHeaderRow === -1) {
        for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
          const row = rawRows[r] || [];
          const fallbackDays = new Map<number, number>();
          let hasNameHeader = false;
          row.forEach((cell, colIdx) => {
            const label = stripAccentsLower(cell);
            if (
              label === 'nome' ||
              label === 'colaborador' ||
              label === 'funcionario' ||
              label.startsWith('nome')
            ) {
              hasNameHeader = true;
              return;
            }
            const d = extractDayNumber(cell);
            if (d !== null && !fallbackDays.has(d)) {
              fallbackDays.set(d, colIdx);
            }
          });
          if (hasNameHeader && fallbackDays.size >= 1) {
            dayHeaderRow = r;
            const cols = Array.from(fallbackDays.values());
            segments = [
              {
                dayCols: fallbackDays,
                startCol: Math.min(...cols),
                endCol: Math.max(...cols),
                monthIndex: null,
                explicitYear: null,
              },
            ];
            break;
          }
        }
      }

      if (dayHeaderRow === -1 || segments.length === 0) {
        continue;
      }

      // Step 2: Sheet-level metadata (Setor, Mês, tab name month)
      const { defaultDepartment, headerMonthIndex, headerYear } = extractSheetMetadata(
        rawRows,
        dayHeaderRow
      );
      const sheetNameInfo = detectMonthAndYearFromText(sheetName);

      // Step 3: Locate COLABORADOR / NOME, SETOR, TURNO columns to the left of first segment
      const firstSegStartCol = segments[0].startCol;
      let nameCol = -1;
      let deptCol = -1;
      let shiftCol = -1;

      const headerScanTop = Math.max(0, dayHeaderRow - 2);
      for (let r = dayHeaderRow; r >= headerScanTop; r--) {
        const row = rawRows[r] || [];
        const limitCol = Math.min(row.length, firstSegStartCol);
        for (let c = 0; c < limitCol; c++) {
          const label = stripAccentsLower(row[c]);
          if (!label) continue;

          if (
            nameCol === -1 &&
            (label === 'colaborador' ||
              label === 'colaboradores' ||
              label === 'nome' ||
              label === 'nome completo' ||
              label === 'funcionario' ||
              label === 'funcionarios' ||
              label.startsWith('nome'))
          ) {
            nameCol = c;
          } else if (
            deptCol === -1 &&
            (label === 'setor' || label === 'departamento' || label === 'equipe' || label === 'area')
          ) {
            deptCol = c;
          } else if (
            shiftCol === -1 &&
            (label === 'turno' || label === 'horario' || label === 'jornada')
          ) {
            shiftCol = c;
          }
        }
      }

      if (nameCol === -1) {
        if (firstSegStartCol > 0) {
          nameCol = 0;
        } else {
          continue;
        }
      }

      // Step 4: Resolve monthIndex + year for EVERY segment in left-to-right order
      let runningYear = headerYear ?? sheetNameInfo.explicitYear ?? fallbackYear;
      let prevMonthIndex: number | null = null;

      segments.forEach((seg, segIdx) => {
        let resolvedMonthIndex = seg.monthIndex;

        if (resolvedMonthIndex === null) {
          if (segIdx === 0) {
            resolvedMonthIndex =
              headerMonthIndex ?? sheetNameInfo.monthIndex ?? fallbackMonthZeroBased;
          } else if (prevMonthIndex !== null) {
            resolvedMonthIndex = (prevMonthIndex + 1) % 12;
          } else {
            resolvedMonthIndex = (fallbackMonthZeroBased + segIdx) % 12;
          }
        }

        let resolvedYear: number;
        if (seg.explicitYear !== null) {
          resolvedYear = seg.explicitYear;
        } else if (prevMonthIndex !== null) {
          // Automatic year rollover when e.g. Janeiro (0) follows Dezembro (11)
          resolvedYear =
            resolvedMonthIndex <= prevMonthIndex ? runningYear + 1 : runningYear;
        } else {
          // First block: if user is viewing Dezembro (11) and imports Janeiro (0), assume next year
          if (fallbackMonthZeroBased === 11 && resolvedMonthIndex === 0 && !headerYear) {
            resolvedYear = runningYear + 1;
          } else {
            resolvedYear = runningYear;
          }
        }

        runningYear = resolvedYear;
        prevMonthIndex = resolvedMonthIndex;

        const monthKey = formatMonthKey(resolvedYear, resolvedMonthIndex);
        const totalDays = getDaysInMonth(resolvedYear, resolvedMonthIndex);
        const rowMap = new Map<string, ParsedSpreadsheetRow>();

        for (let r = dayHeaderRow + 1; r < rawRows.length; r++) {
          const row = rawRows[r] || [];
          const rawName = sanitizeField(String(row[nameCol] ?? ''), 80);
          if (!rawName || isIgnoredFooterRow(rawName)) continue;

          const normalizedName = normalizeEmployeeName(rawName);
          if (normalizedName.length < 2) {
            warnings.push(`Linha ${r + 1}: nome "${rawName}" é muito curto e foi ignorado.`);
            continue;
          }

          const rowDepartment =
            deptCol !== -1 ? sanitizeField(String(row[deptCol] ?? ''), 60) : '';
          const department = rowDepartment || defaultDepartment;
          const shift = shiftCol !== -1 ? sanitizeField(String(row[shiftCol] ?? ''), 40) : '';

          const days: Record<string, ScheduleDayCode> = {};
          let offCount = 0;
          let specialCount = 0;

          for (let d = 1; d <= totalDays; d++) {
            const colIdx = seg.dayCols.get(d);
            if (colIdx === undefined) {
              days[String(d)] = 'T';
              continue;
            }
            const { code, unrecognized } = normalizeDayCode(row[colIdx]);
            if (unrecognized) {
              totalUnrecognizedCells++;
            }
            days[String(d)] = code;
            if (code === 'F') offCount++;
            else if (code !== 'T') specialCount++;
          }

          const docId = buildScheduleDocId(monthKey, rawName);
          rowMap.set(docId, {
            docId,
            employeeName: rawName,
            normalizedName,
            department,
            shift,
            days,
            offCount,
            specialCount,
          });
        }

        const rows = Array.from(rowMap.values()).sort((a, b) =>
          a.employeeName.localeCompare(b.employeeName, 'pt-BR')
        );

        if (rows.length > 0) {
          parsedMonthMap.set(monthKey, {
            monthIndex: resolvedMonthIndex,
            year: resolvedYear,
            monthKey,
            monthLabel: MONTH_NAMES_PT[resolvedMonthIndex],
            sheetName,
            rows,
          });
        }
      });
    }

    if (totalUnrecognizedCells > 0) {
      warnings.push(
        `${totalUnrecognizedCells} célula(s) tinham códigos fora do padrão e foram marcadas como Trabalho.`
      );
    }

    const months = Array.from(parsedMonthMap.values()).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey)
    );

    if (months.length === 0) {
      return {
        months: [],
        warnings,
        error:
          'Não encontramos a linha com os dias do mês (1, 2, 3...) e os colaboradores. Confira se a planilha contém a escala mensal.',
      };
    }

    return { months, warnings };
  } catch (err) {
    console.error('Erro ao ler planilha:', err);
    return {
      months: [],
      warnings: [],
      error:
        'Não foi possível ler o arquivo enviado. Envie um arquivo .xlsx, .xls ou .csv válido.',
    };
  }
}
