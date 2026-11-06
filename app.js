import {FIELDS, FIELD_BY_KEY, GROUPS, LOKALE, SOURCES, START_ITEMS, defaultsFor, mailExample, quantitiesFor} from './fields.js';
import {SCENARIOS, SCENARIO_IDS, reservation, monthly, costs, startup, result, breakEvenOccupancy, unclear, validate} from './engine.js';
import {encodeShare, decodeShare} from './share.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money0 = new Intl.NumberFormat('pl-PL', {style: 'currency', currency: 'PLN', maximumFractionDigits: 0});
const money2 = new Intl.NumberFormat('pl-PL', {style: 'currency', currency: 'PLN', minimumFractionDigits: 2, maximumFractionDigits: 2});
const minus = text => text.replace('-', '\u2212');
const fmt = n => Number.isFinite(n) ? minus(money0.format(Math.round(n))) : 'n/d';
const fmt2 = n => Number.isFinite(n) ? minus(money2.format(n)) : 'n/d';
const signed = n => (n > 0.5 ? '+' : n < -0.5 ? '−' : '') + fmt(Math.abs(n));
const pct = n => `${(Math.round(n * 10) / 10).toString().replace('.', ',')}%`;
const inputValue = n => Number.isFinite(n) ? String(Math.round((n + Number.EPSILON) * 100) / 100).replace('.', ',') : '';
const parseNum = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.'); return t === '' ? NaN : Number(t); };
const STORAGE = 'kalkulator-najmu-krotkiego-v1';

const fresh = lokal => ({lokal: String(lokal), scenario: 'c2', period: 'month', inp: defaultsFor(lokal)});
let state = fresh('13');
let statusTimer, focusAfter = null;

function status(text, persistent = false) {
  clearTimeout(statusTimer);
  $('status').textContent = text;
  $('status-toast').hidden = !text;
  if (text && !persistent) statusTimer = setTimeout(() => { $('status-toast').hidden = true; }, 9000);
}
$('status-dismiss').addEventListener('click', () => { clearTimeout(statusTimer); $('status-toast').hidden = true; });

/* ---------- formularz ---------- */
function fieldHtml(f) {
  const id = `f-${f.key}`;
  const src = `<span class="src src-${f.src}">${esc(SOURCES[f.src])}</span>`;
  const hint = f.hint ? `<p class="hint" id="${id}-hint">${esc(f.hint)}</p>` : '';
  const desc = f.hint ? ` aria-describedby="${id}-hint"` : '';
  if (f.kind === 'check') {
    return `<div class="field"><label class="check"><input id="${id}" type="checkbox" data-key="${f.key}"${desc}><span>${esc(f.label)}${src}</span></label>${hint}</div>`;
  }
  if (f.kind === 'select') {
    const options = f.options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    return `<div class="field"><label for="${id}">${esc(f.label)}${src}</label><div class="input-wrap"><select id="${id}" data-key="${f.key}"${desc}>${options}</select></div>${hint}</div>`;
  }
  const chips = f.chips
    ? `<div class="chips" role="group" aria-label="Szybki wybór: ${esc(f.label)}">${f.chips.map(c => `<button type="button" class="chip" data-chip="${f.key}" data-value="${c}" aria-pressed="false">${c}%</button>`).join('')}</div>`
    : '';
  return `<div class="field"><label for="${id}">${esc(f.label)}${src}</label><div class="input-wrap"><input id="${id}" data-key="${f.key}" type="text" inputmode="decimal" autocomplete="off"${desc}><span class="unit">${esc(f.unit)}</span></div>${chips}${hint}</div>`;
}

function startTable() {
  const rows = START_ITEMS.map(it => `<tr><td>${esc(it.label)}</td>
    <td><input id="f-${it.q}" data-key="${it.q}" type="text" inputmode="decimal" aria-label="${esc(it.label)}: ilość"></td>
    <td><input id="f-${it.p}" data-key="${it.p}" type="text" inputmode="decimal" aria-label="${esc(it.label)}: cena w złotych"></td>
    <td class="sum" data-sum="${it.q}"></td></tr>`).join('');
  return `<div class="field"><span class="src src-arkusz" style="margin-left:0">${esc(SOURCES.arkusz)}</span>
    <p class="hint">Arkusz operatora: 4030 zł dla 25 m², 4 miejsc i 2 łóżek. Według maila operatora ceny w arkuszu są brutto i zawierają jego marżę za usługę. Ilości dla innych lokali to wniosek z arkusza (3 komplety na osobę), nie deklaracja operatora.</p>
    <button type="button" class="chip" data-action="qty">Przelicz ilości dla liczby osób i łóżek</button>
    <div class="table-scroll"><table class="startup-table"><thead><tr><th>Pozycja</th><th>Ilość</th><th>Cena zł</th><th>Razem</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
}

function renderForm() {
  $('form').innerHTML = GROUPS.map(g => {
    let body = '', tableDone = false;
    for (const f of FIELDS.filter(x => x.group === g.id)) {
      if (f.table) { if (!tableDone) { body += startTable(); tableDone = true; } continue; }
      body += fieldHtml(f);
    }
    return `<details class="section" id="group-${g.id}" ${g.open ? 'open' : ''}><summary><span>${esc(g.title)}</span><span class="summary-value">${esc(g.summary)}</span></summary><div class="details-body">${body}</div></details>`;
  }).join('');
  $('lokal-switch').innerHTML = Object.entries(LOKALE).map(([k, v]) => `<button type="button" data-lokal="${k}" aria-pressed="false">${esc(v.label)}</button>`).join('');
}

function syncControls() {
  for (const f of FIELDS) {
    const el = $(`f-${f.key}`);
    if (!el) continue;
    if (f.kind === 'check') el.checked = !!state.inp[f.key];
    else if (f.kind === 'select') el.value = state.inp[f.key];
    else el.value = inputValue(state.inp[f.key]);
  }
  document.querySelectorAll('[data-chip]').forEach(b => b.setAttribute('aria-pressed', String(state.inp[b.dataset.chip] === Number(b.dataset.value))));
  document.querySelectorAll('[data-lokal]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lokal === state.lokal)));
  $('lokal-desc').textContent = `${LOKALE[state.lokal].label}: ${LOKALE[state.lokal].desc}. Dane przykładowe, bez adresu.`;
}

function reveal(id) {
  const target = $(id);
  if (!target) return;
  for (let el = target; el; el = el.parentElement) if (el.tagName === 'DETAILS') el.open = true;
  target.scrollIntoView({block: 'center'});
  target.focus({preventScroll: true});
}

function fieldValidation(errors) {
  document.querySelectorAll('.field-error').forEach(el => el.remove());
  document.querySelectorAll('[aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  for (const e of errors) {
    const el = $(`f-${e.key}`);
    if (!el) continue;
    el.setAttribute('aria-invalid', 'true');
    const p = document.createElement('p');
    p.className = 'field-error';
    p.textContent = e.message;
    (el.closest('.field') || el.parentElement).append(p);
  }
  const box = $('errors');
  box.hidden = !errors.length;
  box.innerHTML = errors.length
    ? `<strong>Popraw dane, aby zobaczyć wynik</strong><ul>${errors.slice(0, 6).map(e => `<li><a href="#f-${e.key}" data-reveal="f-${e.key}">${esc(FIELD_BY_KEY[e.key].label)}: ${esc(e.message)}</a></li>`).join('')}</ul>`
    : '';
}

/* ---------- wyniki ---------- */
const kpi = (label, value, sub, cls = '') => `<div class="kpi ${cls}"><div class="label">${esc(label)}</div><div class="value">${value}</div><div class="sub">${sub}</div></div>`;

function splitBar(m, s) {
  const total = m.potGross || 1;
  const parts = [['vat', m.potVat, 'VAT od noclegu'], ['portal', m.feeOta + m.feePay, 'Portale i płatności'], ['op', Math.max(0, s.operatorKeeps), 'Operator'], ['owner', s.owner, 'Właściciel']];
  const bar = parts.map(([c, v, l]) => `<span class="seg-${c}" style="width:${Math.max(0, v / total * 100)}%" title="${esc(l)}: ${fmt(v)}"></span>`).join('');
  const legend = parts.map(([c, v, l]) => `<span><i class="dot-${c}"></i>${esc(l)} ${pct(v / total * 100)}</span>`).join('');
  return `<div class="split" role="img" aria-label="Podział przychodu brutto">${bar}</div><div class="split-legend">${legend}</div>`;
}

function dlRows(rows) {
  return `<dl>${rows.map(([l, v, cls = '']) => `<div class="${cls}"><dt>${esc(l)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function stepRows(id, m, s, inp) {
  const rows = [];
  const minus = v => v === 0 ? fmt(0) : `−${fmt(v)}`;
  if (id === 'c1') {
    rows.push(['Przychód brutto z VAT', fmt(m.potGross)], ['Prowizje portali i opłaty', minus(m.fees)], ['Podstawa (z VAT)', fmt(s.base)],
      [`Udział operatora ${pct(inp.contractPct)}`, minus(s.operatorFee)], [s.floored ? 'Czynsz (minimum umowy)' : 'Czynsz dla właściciela', fmt(s.owner), 'strong'],
      ['VAT od noclegu do odprowadzenia z puli operatora', fmt(m.potVat), 'muted']);
  } else {
    rows.push(['Przychód brutto z VAT', fmt(m.potGross)], ['VAT od noclegu', minus(m.potVat)], ['Przychód netto', fmt(m.potNet)],
      ['Prowizje portali i opłaty', minus(m.fees)], ['Podstawa', fmt(s.base)]);
    rows.push(id === 'mail'
      ? [`Prowizja operatora ${pct(inp.mailPct)}`, minus(s.operatorFee)]
      : [`Udział operatora ${pct(inp.contractPct)}`, minus(s.operatorFee)]);
    rows.push([id === 'mail' ? 'Kwota dla właściciela' : (s.floored ? 'Czynsz (minimum umowy)' : 'Czynsz dla właściciela'), fmt(s.owner), 'strong']);
  }
  rows.push(['Zostaje u operatora, po portalach', fmt(s.operatorKeeps), 'muted']);
  if (!inp.cleanInBase) rows.push(['Opłata za sprzątanie od gości (netto, u operatora)', fmt(m.cleanNet), 'muted']);
  if (inp.vatPayer) rows.push([`VAT od czynszu ${pct(inp.rentVat)}`, fmt(s.rentVat), 'muted'], ['Czynsz brutto z VAT', fmt(s.rentGross), 'muted']);
  return rows;
}

function renderHero(inp, m, res, d, unit) {
  const s = res[state.scenario], sc = SCENARIOS[state.scenario];
  const be = breakEvenOccupancy(inp, state.scenario);
  const c = costs(inp), st = startup(inp);
  const periodButtons = `<div class="segmented" role="group" aria-label="Okres kwot"><button data-period="month" aria-pressed="${state.period === 'month'}">Miesięcznie</button><button data-period="year" aria-pressed="${state.period === 'year'}">Rocznie</button></div>`;
  const scenButtons = `<div class="segmented lokal-switch" role="group" aria-label="Sposób liczenia">${SCENARIO_IDS.map(id => `<button data-scenario="${id}" aria-pressed="${id === state.scenario}">${esc(SCENARIOS[id].short)}</button>`).join('')}</div>`;
  const delta = s.afterTax;
  $('hero').innerHTML = `<div class="section-head"><h2>Wynik dla właściciela: ${esc(LOKALE[state.lokal].label)}</h2>${periodButtons}</div>
    ${scenButtons}
    <div class="recommendation"><div class="recommend-label">${esc(sc.name)}</div><strong>${fmt(s.owner * d)} ${unit}</strong>
      <p>${esc(sc.rule)} To ${pct(m.scenarios[state.scenario].ownerShareOfNights * 100)} kwoty brutto zapłaconej przez gości za noclegi (${fmt(m.gross * d)} ${unit}).</p></div>
    <div class="kpis">
      ${kpi('Koszty właściciela', fmt(c.total * d), `w tym podatek od nieruchomości ${fmt(c.items.find(i => i.id === 'proptax').amount * d)}`)}
      ${kpi('Uruchomienie, rozłożone', fmt(st.perMonth * d), `razem ${fmt(st.total)} na ${st.months} mies.`)}
      ${kpi('Podatek dochodowy', fmt(s.tax * d), inp.taxOn ? `ryczałt ${pct(inp.taxPct)}` : 'wyłączony')}
      ${kpi('Wynik po kosztach i podatku', fmt(res[state.scenario].afterTax * d), 'po uruchomieniu i ryczałcie', delta > 0 ? 'good' : '')}
      ${kpi('Najem długoterminowy po podatku', fmt(res[state.scenario].longNet * d), `krótki wobec długiego: ${signed(res[state.scenario].vsLong * d)}`)}
      ${kpi('Obłożenie progowe', be === null ? 'brak' : pct(be), be === null ? 'nawet 100% nie pokrywa kosztów' : 'wynik przed podatkiem równy zero')}
    </div>
    <p class="hero-note">Kwoty miesięczne to średnia z roku. Dane domyślne są przykładowe, nie są prognozą. Źródło każdego pola jest oznaczone przy etykiecie.</p>`;
  $('mobile-summary').textContent = `Właściciel: ${fmt(s.owner * d)} ${unit} (${sc.short})`;
}

function renderComparison(inp, m, res, d, unit) {
  const best = Math.max(...SCENARIO_IDS.map(id => m.scenarios[id].owner));
  $('comparison').innerHTML = SCENARIO_IDS.map(id => {
    const s = m.scenarios[id], sc = SCENARIOS[id], isBest = s.owner === best;
    return `<article class="scen-card ${isBest ? 'best' : ''}" role="listitem" aria-label="${esc(sc.name)}">
      <div class="card-heading"><h3>${esc(sc.name)}</h3></div>
      <p class="rule">${esc(sc.rule)}</p>
      <div class="net-label">Dla właściciela</div><div class="net-value">${fmt(s.owner * d)}</div><div class="net-unit">${unit}</div>
      ${isBest ? '<span class="winner">Najwięcej dla właściciela</span>' : `<p class="difference">${signed((s.owner - best) * d)} wobec najwyższej</p>`}
      ${splitBar(m, s)}
      <div class="card-burden"><span>Udział w płatnościach gości</span><strong>${pct(s.ownerShareOfNights * 100)}</strong></div>
      <details class="scen-detail" id="detail-${id}"><summary>Rozbicie krok po kroku</summary>${dlRows(stepRows(id, m, s, inp).map(([l, v, c]) => [l, v, c]))}</details></article>`;
  }).join('');
}

function reservationTable(r, ch, title, inp) {
  const c = r.channels[ch], ids = SCENARIO_IDS;
  const cell = (id, fn) => `<td>${fn(c.scen[id], id)}</td>`;
  const row = (label, fn, cls = '') => `<tr class="${cls}"><td>${esc(label)}</td>${ids.map(id => cell(id, fn)).join('')}</tr>`;
  const neg = v => v === 0 ? fmt2(0) : `−${fmt2(v)}`;
  const check = ids.every(id => Math.abs(c.scen[id].identity) < 1e-9);
  return `<h3 class="sub-heading">${esc(title)}</h3><div class="table-scroll"><table class="res-table"><thead><tr><th></th>${ids.map(id => `<th>${esc(SCENARIOS[id].short)}</th>`).join('')}</tr></thead><tbody>
    ${row('Kwota brutto od gościa', () => fmt2(r.gross))}
    ${row('VAT od noclegu', (s, id) => id === 'c1' ? '<span class="minus">nie odejmowany</span>' : neg(r.vat))}
    ${row('Kwota netto', (s, id) => id === 'c1' ? '<span class="minus">nie dotyczy</span>' : fmt2(r.net))}
    ${row('Prowizja portalu zewnętrznego', () => neg(c.feeOta), c.feeOta === 0 ? 'muted' : '')}
    ${row('Opłaty płatnicze', () => neg(c.feePay), c.feePay === 0 ? 'muted' : '')}
    ${row('Opłata własnego portalu', () => neg(c.feeOwn), c.feeOwn === 0 ? 'muted' : '')}
    ${row('Podstawa', s => fmt2(s.base))}
    ${row('Prowizja lub udział operatora', (s, id) => `${neg(s.operatorFee)} <span class="minus">(${pct(id === 'mail' ? inp.mailPct : inp.contractPct)})</span>`)}
    ${row('Kwota dla właściciela', s => fmt2(s.owner), 'total')}
    ${row('Zostaje u operatora, po portalach', s => fmt2(s.operatorKeeps), 'muted')}
    </tbody></table></div>
    <p class="res-check">Kontrola: VAT, portale, operator i właściciel razem dają kwotę brutto <span class="${check ? 'ok' : 'bad'}">${check ? 'zgodnie' : 'niezgodnie'}</span>.</p>`;
}

function renderReservation(inp) {
  const r = reservation(inp);
  const mail = mailExample();
  const isMail = Object.entries(mail).every(([k, v]) => inp[k] === v);
  const ota = r.channels.ota.scen.mail.owner, dir = r.channels.direct.scen.mail.owner;
  const match = isMail
    ? `Zgodność z przykładem z maila: ${ota === 69.83 && dir === 83.33 ? '<span class="ok">zgodne, 69,83 zł i 83,33 zł</span>' : '<span class="bad">niezgodne</span>'}.`
    : 'Parametry różnią się od przykładu z maila (100 zł, VAT 8%, portal 15% od brutto, prowizja operatora 10%). Przycisk „Przykład z maila” przywraca je.';
  $('reservation').innerHTML = `<div class="section-head"><h2>Przykład pojedynczej rezerwacji</h2><span class="subtle">${fmt2(r.gross)} brutto</span></div>
    <p class="hint">Rozbicie kroków jak w mailu operatora, z zaokrągleniem do grosza po każdym kroku. Trzy sposoby liczenia dla tej samej rezerwacji. Kwotę zmienisz w sekcji „Przykład pojedynczej rezerwacji” po lewej.</p>
    <p class="res-check">${match}</p>
    ${reservationTable(r, 'ota', 'Rezerwacja z portalu zewnętrznego', inp)}
    ${reservationTable(r, 'direct', 'Sprzedaż bezpośrednia', inp)}
    <p class="sens-note">Minimalny czynsz miesięczny dotyczy całego miesiąca, nie pojedynczej rezerwacji, więc nie widać go w tej tabeli.</p>`;
}

function renderWaterfall(inp, m, res) {
  const s = res[state.scenario], c = costs(inp), st = startup(inp), sm = m.scenarios[state.scenario];
  const line = (label, v, cls = '') => `<tr class="${cls}"><td>${esc(label)}</td><td>${fmt(v)}</td><td>${fmt(v * 12)}</td></tr>`;
  const neg = (label, v, cls = '') => `<tr class="${cls || (v === 0 ? 'muted' : '')}"><td>${esc(label)}</td><td>${v === 0 ? fmt(0) : '−' + fmt(v)}</td><td>${v === 0 ? fmt(0) : '−' + fmt(v * 12)}</td></tr>`;
  $('waterfall').innerHTML = `<div class="section-head"><h2>Koszty i wynik</h2><span class="subtle">${esc(SCENARIOS[state.scenario].name)}</span></div>
    <div class="table-scroll"><table class="res-table"><thead><tr><th></th><th>Miesięcznie</th><th>Rocznie</th></tr></thead><tbody>
    ${line('Kwota dla właściciela', sm.owner, 'total')}
    ${c.items.map(i => neg(i.label, i.amount)).join('')}
    ${neg(`Uruchomienie, rozłożone na ${st.months} mies.`, st.perMonth)}
    ${line('Wynik przed podatkiem', s.preTax, 'total')}
    ${neg(inp.taxOn ? `Ryczałt ${pct(inp.taxPct)} od ${inp.taxBase === 'nights' ? 'przychodu z noclegów netto' : 'czynszu'}` : 'Podatek dochodowy (wyłączony)', s.tax)}
    ${line('Wynik po podatku', s.afterTax, 'total')}
    ${line('Najem długoterminowy po kosztach i podatku', s.longNet, 'muted')}
    ${line('Krótki najem wobec długiego', s.vsLong, 'muted')}
    </tbody></table></div>
    <p class="sens-note">Uruchomienie: pozycje arkusza ${fmt(st.sheetTotal)}${st.discount ? `, rabat −${fmt(st.discount)}` : ''}, zakupy ${fmt(st.purchases)} z opłatą operatora ${fmt(st.purchaseFee)}, razem ${fmt(st.total)}. Ryczałt nie pozwala odliczać kosztów.</p>`;
}

function renderUnclear(inp) {
  const list = unclear(inp, state.scenario);
  $('unclear').innerHTML = `<div class="section-head"><h2>Niejasności i ich wpływ</h2><span class="subtle">pytania do operatora</span></div>
    <p class="hint">Mail i projekt umowy różnią się w kilku miejscach. Przy każdej pozycji widać, ile zmienia się kwota dla właściciela (dla wybranego sposobu liczenia), gdyby rozstrzygnięto ją inaczej.</p>
    <div class="unclear-list">${list.map(u => {
      const once = u.unit.includes('jednorazowo');
      const v = once ? fmt(u.value) : `${signed(u.value)} / mies.`;
      return `<div class="unclear-item"><strong>${esc(u.title)}</strong><div class="says">${esc(u.says)}</div><div class="impact">Skutek: <b class="${u.value < -0.5 ? 'negative' : u.value > 0.5 ? 'pos' : ''}">${v}</b> <span class="subtle">${esc(u.note)}</span></div></div>`;
    }).join('')}</div>`;
}

function renderStartSums(inp) {
  document.querySelectorAll('[data-sum]').forEach(td => {
    const it = START_ITEMS.find(x => x.q === td.dataset.sum);
    td.textContent = fmt(inp[it.q] * inp[it.p]);
  });
}

function update() {
  const inp = state.inp;
  const errors = validate(inp);
  fieldValidation(errors);
  const ok = !errors.length;
  for (const id of ['hero', 'comparison', 'reservation', 'waterfall', 'unclear']) $(id).hidden = !ok;
  if (!ok) { $('mobile-summary').textContent = 'Popraw dane, aby zobaczyć wynik'; return; }
  const open = [...document.querySelectorAll('#results details[open]')].map(e => e.id).filter(Boolean);
  const m = monthly(inp);
  const res = Object.fromEntries(SCENARIO_IDS.map(id => [id, result(inp, id, m)]));
  const d = state.period === 'year' ? 12 : 1, unit = d === 12 ? 'rocznie' : 'miesięcznie';
  renderHero(inp, m, res, d, unit);
  renderComparison(inp, m, res, d, unit);
  renderReservation(inp);
  renderWaterfall(inp, m, res);
  renderUnclear(inp);
  renderStartSums(inp);
  open.forEach(id => { const el = $(id); if (el) el.open = true; });
  if (focusAfter) { document.querySelector(focusAfter)?.focus({preventScroll: true}); focusAfter = null; }
}

/* ---------- zdarzenia ---------- */
$('form').addEventListener('input', e => {
  const key = e.target.dataset.key;
  if (!key || e.target.type === 'checkbox' || e.target.tagName === 'SELECT') return;
  state.inp[key] = parseNum(e.target.value);
  document.querySelectorAll(`[data-chip="${key}"]`).forEach(b => b.setAttribute('aria-pressed', String(state.inp[key] === Number(b.dataset.value))));
  clearSharedAddress();
  update();
});
$('form').addEventListener('change', e => {
  const key = e.target.dataset.key;
  if (!key || !(e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) return;
  state.inp[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  clearSharedAddress();
  update();
});
$('form').addEventListener('click', e => {
  const chip = e.target.closest('[data-chip]');
  if (chip) {
    state.inp[chip.dataset.chip] = Number(chip.dataset.value);
    syncControls(); clearSharedAddress(); update();
    return;
  }
  if (e.target.closest('[data-action="qty"]')) {
    Object.assign(state.inp, quantitiesFor(state.inp.persons, state.inp.beds));
    syncControls(); clearSharedAddress(); update();
    status('Ilości przeliczone dla liczby osób i łóżek (3 komplety na osobę, wniosek z arkusza).');
  }
});
$('lokal-switch').addEventListener('click', e => {
  const b = e.target.closest('[data-lokal]');
  if (!b) return;
  const keep = {scenario: state.scenario, period: state.period};
  state = {...fresh(b.dataset.lokal), ...keep};
  clearSharedAddress(); syncControls(); update();
  status(`Wczytano dane przykładowe: ${LOKALE[state.lokal].label}.`);
});
$('results').addEventListener('click', e => {
  const sc = e.target.closest('[data-scenario]'), pe = e.target.closest('[data-period]');
  if (sc) { state.scenario = sc.dataset.scenario; focusAfter = `[data-scenario="${state.scenario}"]`; clearSharedAddress(); update(); }
  if (pe) { state.period = pe.dataset.period; focusAfter = `[data-period="${state.period}"]`; clearSharedAddress(); update(); }
});
$('errors').addEventListener('click', e => {
  const a = e.target.closest('[data-reveal]');
  if (a) { e.preventDefault(); reveal(a.dataset.reveal); }
});
$('example').addEventListener('click', () => {
  Object.assign(state.inp, mailExample());
  syncControls(); clearSharedAddress(); update();
  status('Wczytano parametry przykładu z maila: 100 zł brutto, VAT 8%, portal 15% od brutto, prowizja operatora 10%.');
});
$('reset').addEventListener('click', () => {
  const keep = {scenario: state.scenario, period: state.period};
  state = {...fresh(state.lokal), ...keep};
  clearSharedAddress(); syncControls(); update();
  status(`Przywrócono dane przykładowe: ${LOKALE[state.lokal].label}.`);
});
$('print').addEventListener('click', () => window.print());
$('save').addEventListener('click', () => {
  try { localStorage.setItem(STORAGE, JSON.stringify({version: 1, state})); status('Zapisano na tym urządzeniu. Dane nie są wysyłane na serwer.'); }
  catch { status('Nie udało się zapisać: przeglądarka blokuje pamięć lokalną.', true); }
});
$('share').addEventListener('click', () => {
  try {
    const link = location.origin + location.pathname + location.search + encodeShare(state);
    $('share-link').value = link; $('share-status').textContent = '';
    $('share-dialog').showModal(); $('share-link').select();
  } catch (err) { status(err.message, true); }
});
$('share-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('share-link').value); $('share-status').textContent = 'Skopiowano link.'; }
  catch { $('share-link').select(); $('share-status').textContent = 'Zaznaczono link. Skopiuj go skrótem klawiszowym.'; }
});
$('share-close').addEventListener('click', () => $('share-dialog').close());

function clearSharedAddress() {
  if (location.hash.startsWith('#dane=')) history.replaceState(null, '', location.pathname + location.search);
}

function load() {
  if (location.hash.startsWith('#dane=')) {
    try { state = decodeShare(location.hash); status('Wczytano dane z udostępnionego linku. Twój zapis na urządzeniu pozostaje bez zmian.'); return; }
    catch (err) { state = fresh('13'); status(err.message + ' Wyświetlono dane przykładowe.', true); return; }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (saved && saved.version === 1 && LOKALE[saved.state.lokal]) {
      const inp = {...defaultsFor(saved.state.lokal), ...saved.state.inp};
      if (!validate(inp).length) state = {lokal: String(saved.state.lokal), scenario: SCENARIOS[saved.state.scenario] ? saved.state.scenario : 'c2', period: saved.state.period === 'year' ? 'year' : 'month', inp};
    }
  } catch { /* zapis uszkodzony: zostają dane przykładowe */ }
}

renderForm();
load();
syncControls();
update();

// Wydruk i PDF: rozwiń założenia oraz sekcje danych, żeby dokument zawierał komplet wartości, po wydruku przywróć stan.
let reopened = [];
window.addEventListener('beforeprint', () => {
  reopened = [...document.querySelectorAll('#method:not([open]), details.section:not([open])')];
  reopened.forEach(d => { d.open = true; });
});
window.addEventListener('afterprint', () => { reopened.forEach(d => { d.open = false; }); reopened = []; });
