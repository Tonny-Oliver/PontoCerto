import { triggerDownload } from './storage';

/**
 * Generates a fully self-contained, zero-dependency HTML file with the complete
 * 6-rule PontoCerto calculator that can be saved anywhere on the user's computer
 * and opened directly in any browser without internet access.
 */
export function downloadStandaloneOfflineApp(): void {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PontoCerto — Calculadora de Ponto (Offline)</title>
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #475569;
      --navy: #143b63;
      --navy-hover: #0f2d4d;
      --ok: #15803d;
      --warn: #b45309;
      --err: #b91c1c;
      --subtle: #f1f5f9;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
    }
    header h1 { margin: 0; font-size: 18px; font-weight: 700; color: var(--navy); }
    header span { font-size: 13px; color: var(--muted); }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    .banner {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 20px 24px;
      margin-bottom: 24px;
    }
    .banner-kicker { font-size: 13px; color: var(--muted); margin-bottom: 4px; }
    .banner-main { font-size: 28px; font-weight: 700; margin: 0 0 6px; letter-spacing: -0.02em; }
    .banner-sub { font-size: 14px; color: var(--muted); margin: 0; }
    .grid { display: grid; grid-template-columns: 1fr 1.25fr; gap: 24px; align-items: start; }
    @media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .panel-head {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .panel-head h2 { margin: 0; font-size: 15px; font-weight: 600; }
    .row {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .row:last-child { border-bottom: none; }
    .row label { display: block; font-size: 14px; font-weight: 600; }
    .hint { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .controls { display: flex; align-items: center; gap: 8px; }
    input[type="time"] {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 15px;
      padding: 7px 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: var(--bg);
      color: var(--text);
    }
    button {
      cursor: pointer;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      padding: 7px 12px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      white-space: nowrap;
    }
    button:hover { background: var(--subtle); }
    button.primary {
      background: var(--navy);
      color: #fff;
      border-color: var(--navy);
    }
    button.primary:hover { background: var(--navy-hover); }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      border-bottom: 1px solid var(--border);
    }
    @media (max-width: 600px) { .kpis { grid-template-columns: repeat(2, 1fr); } }
    .kpi { padding: 14px 16px; border-right: 1px solid var(--border); }
    .kpi:last-child { border-right: none; }
    .kpi-label { font-size: 12px; color: var(--muted); }
    .kpi-val { font-size: 19px; font-weight: 700; margin-top: 2px; }
    .rule-item { padding: 14px 20px; border-bottom: 1px solid var(--border); }
    .rule-item:last-child { border-bottom: none; }
    .rule-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .rule-name { font-size: 14px; font-weight: 600; }
    .rule-meta { display: flex; align-items: center; gap: 12px; font-size: 13px; }
    .rule-detail { font-size: 13px; color: var(--muted); margin-top: 4px; }
    .st-ok { color: var(--ok); font-weight: 600; }
    .st-warn { color: var(--warn); font-weight: 600; }
    .st-err { color: var(--err); font-weight: 600; }
    .st-pend { color: var(--muted); font-weight: 500; }
  </style>
</head>
<body>
  <header>
    <h1>PontoCerto</h1>
    <span id="offline-today-label">Versão Offline Local · 6 Regras de Jornada</span>
  </header>
  <main>
    <section class="banner">
      <div class="banner-kicker" id="g-head">Comece registrando sua entrada</div>
      <div class="banner-main mono" id="g-win">Aguardando 1ª marcação</div>
      <p class="banner-sub" id="g-sub">Informe os horários abaixo para saber exatamente quando bater cada ponto sem violar regras.</p>
    </section>

    <div class="grid">
      <section class="panel">
        <div class="panel-head">
          <h2>Marcações do Dia</h2>
          <button type="button" id="btn-clear">Limpar</button>
        </div>
        <div class="row">
          <div>
            <label for="prevExit">Saída do dia anterior (opcional)</label>
            <div class="hint" id="hint-prev">Valida 11h de descanso (Regra 6)</div>
          </div>
          <div class="controls">
            <input type="time" id="prevExit" />
          </div>
        </div>
        <div class="row">
          <div>
            <label for="entry">1. Entrada</label>
            <div class="hint mono" id="hint-entry">Início da jornada</div>
          </div>
          <div class="controls">
            <input type="time" id="entry" />
            <button type="button" data-now="entry">Agora</button>
          </div>
        </div>
        <div class="row">
          <div>
            <label for="lunchOut">2. Saída Almoço</label>
            <div class="hint mono" id="hint-lunchOut">Até 6h após a entrada</div>
          </div>
          <div class="controls">
            <input type="time" id="lunchOut" />
            <button type="button" data-now="lunchOut">Agora</button>
          </div>
        </div>
        <div class="row">
          <div>
            <label for="lunchIn">3. Volta Almoço</label>
            <div class="hint mono" id="hint-lunchIn">Intervalo de 01h00 a 01h59</div>
          </div>
          <div class="controls">
            <input type="time" id="lunchIn" />
            <button type="button" data-now="lunchIn">Agora</button>
          </div>
        </div>
        <div class="row">
          <div>
            <label for="exit">4. Saída Final</label>
            <div class="hint mono" id="hint-exit">Mín. 8h · Máx. 2h extras / 6h após almoço</div>
          </div>
          <div class="controls">
            <input type="time" id="exit" />
            <button type="button" data-now="exit">Agora</button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="kpis">
          <div class="kpi"><div class="kpi-label">Trabalhado</div><div class="kpi-val mono" id="k-total">—</div></div>
          <div class="kpi"><div class="kpi-label">Saldo</div><div class="kpi-val mono" id="k-bal">—</div></div>
          <div class="kpi"><div class="kpi-label">Intervalo</div><div class="kpi-val mono" id="k-lunch">—</div></div>
          <div class="kpi"><div class="kpi-label">Próx. Entrada</div><div class="kpi-val mono" id="k-next">—</div></div>
        </div>
        <div id="rules-list"></div>
      </section>
    </div>
  </main>
  <script>
    (function () {
      const STORAGE_KEY = 'pontocerto_offline_v1';
      const ids = ['prevExit', 'entry', 'lunchOut', 'lunchIn', 'exit'];
      const els = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

      function parseM(v) {
        if (!v || !/^\\d{2}:\\d{2}$/.test(v)) return null;
        const [h, m] = v.split(':').map(Number);
        return h * 60 + m;
      }
      function fmtClock(m) {
        if (m === null) return '—';
        const n = ((m % 1440) + 1440) % 1440;
        return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
      }
      function fmtDur(m, signed) {
        if (m === null) return '—';
        const s = m < 0 ? '-' : (signed && m > 0 ? '+' : '');
        const a = Math.abs(Math.round(m));
        return s + String(Math.floor(a / 60)).padStart(2, '0') + 'h' + String(a % 60).padStart(2, '0');
      }

      function getTodayISO() {
        const d = new Date();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }
      function updateTodayLabel() {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const el = document.getElementById('offline-today-label');
        if (el) el.textContent = dd + '/' + mm + '/' + yyyy + ' · Versão Offline Local';
      }

      function save() {
        try {
          const data = Object.fromEntries(ids.map((id) => [id, els[id].value]));
          data.date = getTodayISO();
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
      }
      function load() {
        updateTodayLabel();
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return;
          const data = JSON.parse(raw);
          const today = getTodayISO();
          if (data.date && data.date !== today) {
            if (data.exit) els.prevExit.value = data.exit;
            return;
          }
          ids.forEach((id) => { if (data[id]) els[id].value = data[id]; });
        } catch (e) {}
      }

      function render() {
        save();
        const rawPrev = parseM(els.prevExit.value);
        const prevAbs = rawPrev === null ? null : rawPrev - 1440;
        const t1 = parseM(els.entry.value);
        let t2 = parseM(els.lunchOut.value);
        if (t1 !== null && t2 !== null && t2 < t1) t2 += 1440;
        let t3 = parseM(els.lunchIn.value);
        const b3 = t2 ?? t1;
        if (b3 !== null && t3 !== null && t3 < b3) t3 += 1440;
        let t4 = parseM(els.exit.value);
        const b4 = t3 ?? t2 ?? t1;
        if (b4 !== null && t4 !== null && t4 < b4) t4 += 1440;

        const morning = t1 !== null && t2 !== null ? t2 - t1 : null;
        const lunch = t2 !== null && t3 !== null ? t3 - t2 : null;
        const afternoon = t3 !== null && t4 !== null ? t4 - t3 : null;
        const total = morning !== null && afternoon !== null ? morning + afternoon : null;
        const bal = total !== null ? total - 480 : null;
        const ot = total !== null ? Math.max(0, total - 480) : null;
        const rest = prevAbs !== null && t1 !== null ? t1 - prevAbs : null;

        const entryMin = prevAbs !== null ? prevAbs + 660 : null;
        const lunchOutMin = t1 !== null ? t1 + 120 : null;
        const lunchOutMax = t1 !== null ? t1 + 360 : null;
        const lunchInMin = t2 !== null ? t2 + 60 : null;
        const lunchInMax = t2 !== null ? t2 + 119 : null;
        const exitMin = morning !== null && t3 !== null ? t3 + Math.max(0, 480 - morning) : null;
        const exitR3 = t3 !== null ? t3 + 360 : null;
        const exitR4 = morning !== null && t3 !== null ? t3 + Math.max(0, 600 - morning) : null;
        const exitMax = exitR3 !== null && exitR4 !== null ? Math.min(exitR3, exitR4) : null;
        const nextEntry = t4 !== null ? t4 + 660 : (exitMin !== null ? exitMin + 660 : null);

        document.getElementById('hint-entry').textContent = entryMin !== null ? 'Permitida a partir de ' + fmtClock(entryMin) : 'Início da jornada';
        document.getElementById('hint-lunchOut').textContent = lunchOutMax !== null ? 'Janela segura: ' + fmtClock(lunchOutMin) + ' até ' + fmtClock(lunchOutMax) : 'Até 6h após a entrada';
        document.getElementById('hint-lunchIn').textContent = lunchInMin !== null ? 'Janela segura: ' + fmtClock(lunchInMin) + ' até ' + fmtClock(lunchInMax) : 'Intervalo de 01h00 a 01h59';
        document.getElementById('hint-exit').textContent = exitMin !== null && exitMax !== null ? (exitMin > exitMax ? 'Conflito entre Regra 3 e Regra 5' : 'Janela segura: ' + fmtClock(exitMin) + ' até ' + fmtClock(exitMax)) : 'Mín. 8h · Máx. 2h extras / 6h após almoço';

        document.getElementById('k-total').textContent = fmtDur(total);
        document.getElementById('k-bal').textContent = fmtDur(bal, true);
        document.getElementById('k-lunch').textContent = fmtDur(lunch);
        document.getElementById('k-next').textContent = fmtClock(nextEntry);

        const rules = [
          {
            name: 'Regra 1 · Até 6h para almoço',
            st: morning === null ? 'pend' : (morning <= 0 || morning > 360 ? 'err' : (morning < 120 ? 'warn' : 'ok')),
            val: morning !== null ? fmtDur(morning) + ' / 06h00' : (lunchOutMax !== null ? 'Até ' + fmtClock(lunchOutMax) : 'Aguardando'),
            det: morning === null ? 'Informe entrada e saída para almoço.' : (morning > 360 ? 'Excedeu 6h00 em ' + fmtDur(morning - 360) + '.' : (morning < 120 ? 'Menos de 2h00 impede atingir 8h sem passar de 6h à tarde.' : 'Dentro do limite máximo de 6h00.'))
          },
          {
            name: 'Regra 2 · Intervalo de 1h a 1h59',
            st: lunch === null ? 'pend' : (lunch < 60 || lunch > 119 ? 'err' : 'ok'),
            val: lunch !== null ? fmtDur(lunch) : (lunchInMin !== null ? fmtClock(lunchInMin) + ' – ' + fmtClock(lunchInMax) : 'Aguardando'),
            det: lunch === null ? 'Intervalo obrigatório entre 01h00 e 01h59 (< 2h00).' : (lunch < 60 ? 'Faltaram ' + fmtDur(60 - lunch) + ' para 1h00.' : (lunch > 119 ? 'Excedeu o máximo de 01h59 em ' + fmtDur(lunch - 119) + '.' : 'Intervalo em conformidade.'))
          },
          {
            name: 'Regra 3 · Até 6h após almoço',
            st: afternoon === null ? 'pend' : (afternoon <= 0 || afternoon > 360 ? 'err' : 'ok'),
            val: afternoon !== null ? fmtDur(afternoon) + ' / 06h00' : (exitR3 !== null ? 'Até ' + fmtClock(exitR3) : 'Aguardando'),
            det: afternoon === null ? 'Segundo período não pode ultrapassar 6h00.' : (afternoon > 360 ? 'Excedeu 6h00 em ' + fmtDur(afternoon - 360) + '.' : 'Segundo período em conformidade.')
          },
          {
            name: 'Regra 4 · Máx. 2h extras',
            st: total === null ? 'pend' : (total > 600 ? 'err' : 'ok'),
            val: ot !== null ? '+' + fmtDur(ot) + ' / 02h00' : (exitR4 !== null ? 'Até ' + fmtClock(exitR4) : 'Aguardando'),
            det: total === null ? 'Total diário não pode ultrapassar 10h00.' : (total > 600 ? 'Excedeu 2h00 extras em ' + fmtDur(total - 600) + '.' : 'Dentro do teto de horas extras.')
          },
          {
            name: 'Regra 5 · Mínimo 8h',
            st: total === null ? 'pend' : (total < 480 ? 'err' : 'ok'),
            val: total !== null ? fmtDur(total) + ' / 08h00' : (exitMin !== null ? 'A partir de ' + fmtClock(exitMin) : 'Aguardando'),
            det: total === null ? 'Jornada mínima diária de 8h00.' : (total < 480 ? 'Faltaram ' + fmtDur(480 - total) + ' para 8h00.' : 'Carga horária mínima atingida.')
          },
          {
            name: 'Regra 6 · Descanso mínimo de 11h',
            st: rest === null ? 'pend' : (rest < 660 ? 'err' : 'ok'),
            val: rest !== null ? fmtDur(rest) + ' / 11h00' : (entryMin !== null ? 'A partir de ' + fmtClock(entryMin) : (t4 !== null ? 'Amanhã ' + fmtClock(t4 + 660) : 'Opcional')),
            det: rest === null ? 'Informe a saída de ontem para validar a interjornada de hoje.' : (rest < 660 ? 'Faltaram ' + fmtDur(660 - rest) + ' de descanso.' : 'Interjornada cumprida.')
          }
        ];

        const errCount = rules.filter((r) => r.st === 'err').length;
        const gHead = document.getElementById('g-head');
        const gWin = document.getElementById('g-win');
        const gSub = document.getElementById('g-sub');

        if (t1 === null) {
          gHead.textContent = entryMin !== null ? 'Entrada permitida a partir de' : 'Comece registrando sua entrada';
          gWin.textContent = entryMin !== null ? fmtClock(entryMin) : 'Aguardando 1ª marcação';
          gSub.textContent = 'Preencha os horários do dia para receber a janela segura de cada marcação.';
        } else if (t2 === null) {
          gHead.textContent = 'Próximo ponto: Saída para Almoço';
          gWin.textContent = fmtClock(lunchOutMin) + ' até ' + fmtClock(lunchOutMax);
          gSub.textContent = 'Saia até ' + fmtClock(lunchOutMax) + ' (Regra 1). Ideal a partir de ' + fmtClock(lunchOutMin) + ' para fechar 8h sem passar de 6h à tarde.';
        } else if (t3 === null) {
          gHead.textContent = 'Próximo ponto: Volta do Almoço';
          gWin.textContent = fmtClock(lunchInMin) + ' até ' + fmtClock(lunchInMax);
          gSub.textContent = 'Intervalo obrigatório de 01h00 a 01h59 (< 2h00, Regra 2).';
        } else if (t4 === null) {
          gHead.textContent = 'Próximo ponto: Saída Final';
          gWin.textContent = exitMin > exitMax ? 'Conflito (mín ' + fmtClock(exitMin) + ' > máx ' + fmtClock(exitMax) + ')' : fmtClock(exitMin) + ' até ' + fmtClock(exitMax);
          gSub.textContent = 'Mínimo ' + fmtClock(exitMin) + ' para 8h00 (Regra 5) e máximo ' + fmtClock(exitMax) + ' (Regras 3 e 4).';
        } else {
          gHead.textContent = errCount === 0 ? 'Jornada concluída dentro das 6 regras' : 'Jornada concluída com ' + errCount + ' infração(ões)';
          gWin.textContent = fmtDur(total) + ' (' + fmtDur(bal, true) + ')';
          gSub.textContent = 'Próxima entrada permitida amanhã a partir das ' + fmtClock(t4 + 660) + ' (Regra 6).';
        }

        const labelMap = { ok: 'Conforme', warn: 'Atenção', err: 'Violada', pend: 'Pendente' };
        document.getElementById('rules-list').innerHTML = rules.map((r) => (
          '<div class="rule-item">' +
            '<div class="rule-top">' +
              '<div class="rule-name">' + r.name + '</div>' +
              '<div class="rule-meta"><span class="mono">' + r.val + '</span><span class="st-' + r.st + '">' + labelMap[r.st] + '</span></div>' +
            '</div>' +
            '<div class="rule-detail">' + r.det + '</div>' +
          '</div>'
        )).join('');
      }

      ids.forEach((id) => els[id].addEventListener('input', render));
      document.querySelectorAll('[data-now]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const now = new Date();
          const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
          els[btn.getAttribute('data-now')].value = hhmm;
          render();
        });
      });
      document.getElementById('btn-clear').addEventListener('click', () => {
        ids.forEach((id) => { els[id].value = ''; });
        render();
      });

      load();
      render();
    })();
  </script>
</body>
</html>`;

  triggerDownload(
    html,
    'pontocerto-calculadora-offline.html',
    'text/html;charset=utf-8'
  );
}
