import {FIELDS, FIELD_BY_KEY, GROUPS, LOKALE, SOURCES, EXAMPLES, defaultsFor, changedRules} from './fields.js';
import {reservation, monthly, afterCosts, split, effectiveOtaPct, validate} from './engine.js';
import {encodeShare, decodeShare} from './share.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money0 = new Intl.NumberFormat('pl-PL', {style: 'currency', currency: 'PLN', maximumFractionDigits: 0, useGrouping: 'always'});
const money2 = new Intl.NumberFormat('pl-PL', {style: 'currency', currency: 'PLN', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always'});
const minus = text => text.replace('-', '−');
const fmt = n => Number.isFinite(n) ? minus(money0.format(Math.round(n) || 0)) : 'n/d';
const fmt2 = n => Number.isFinite(n) ? minus(money2.format(Math.abs(n) < 0.005 ? 0 : n)) : 'n/d';
const neg2 = v => Math.round(v * 100) > 0 ? `−${fmt2(v)}` : Math.round(v * 100) < 0 ? `+${fmt2(-v)}` : fmt2(0);
const num = n => String(Math.round(n * 100) / 100).replace('.', ',').replace('-', '−');
const pct = n => `${(Math.round(n * 10) / 10).toString().replace('.', ',').replace('-', '−')}%`;
const inputValue = n => Number.isFinite(n) ? String(n).replace('.', ',') : '';
// Tylko zwykły zapis dziesiętny: bez notacji naukowej, szesnastkowej i dwójkowej, które zna Number().
const parseNum = s => { const t = String(s).trim().replace(/\s/g, '').replace(',', '.'); return /^-?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : NaN; };

const fresh = (lokal, period = 'month') => ({lokal: String(lokal), period, inp: defaultsFor(lokal)});
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
  const src = f.src === 'zasada' ? `<span class="src src-${f.src}">${esc(SOURCES[f.src])}</span>` : '';
  const hint = f.hint ? `<p class="hint" id="${id}-hint">${esc(f.hint)}</p>` : '';
  const desc = f.hint ? ` aria-describedby="${id}-hint"` : '';
  if (f.kind === 'select') {
    const options = f.options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
    return `<div class="field"><label for="${id}">${esc(f.label)}${src}</label><div class="input-wrap"><select id="${id}" data-key="${f.key}"${desc}>${options}</select></div>${hint}</div>`;
  }
  return `<div class="field"><label for="${id}">${esc(f.label)}${src}</label><div class="input-wrap"><input id="${id}" data-key="${f.key}" type="text" inputmode="decimal" autocomplete="off"${desc}><span class="unit">${esc(f.unit)}</span></div>${hint}</div>`;
}

function renderForm() {
  $('form').innerHTML = GROUPS.filter(g => !g.hidden).map(g => {
    const body = FIELDS.filter(f => f.group === g.id).map(fieldHtml).join('');
    if (g.fixed) return `<div class="block" id="group-${g.id}"><h2 class="block-title">${esc(g.title)}<span class="summary-value">${esc(g.summary)}</span></h2>${body}</div>`;
    return `<details class="section" id="group-${g.id}"><summary><span>${esc(g.title)}</span><span class="summary-value">${esc(g.summary)}</span></summary><div class="details-body">${body}</div></details>`;
  }).join('');
  $('lokal-switch').innerHTML = Object.entries(LOKALE).map(([k, v]) => `<button type="button" data-lokal="${k}" aria-pressed="false">${esc(v.label)}</button>`).join('');
  const resFields = FIELDS.filter(f => f.group === 'res').map(fieldHtml).join('');
  const buttons = EXAMPLES.map(e => `<button type="button" class="chip" data-example="${e.id}" aria-pressed="false">${esc(e.label)}</button>`).join('');
  $('res-inputs').innerHTML = `<div class="res-fields">${resFields}</div><div class="chips" role="group" aria-label="Przykłady z zasad rozliczenia">${buttons}</div>`;
}

function syncControls() {
  for (const f of FIELDS) {
    const el = $(`f-${f.key}`);
    if (!el) continue;
    el.value = f.kind === 'select' ? state.inp[f.key] : inputValue(state.inp[f.key]);
  }
  document.querySelectorAll('[data-lokal]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lokal === state.lokal)));
  syncExampleButtons();
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
const periodWord = d => d === 12 ? 'rocznie' : 'miesięcznie';
const lower = s => s.replace(/^\p{Lu}(?=\p{Ll})/u, c => c.toLowerCase());
// Gdy zmieniono zasady rozliczenia, wynik przestaje odpowiadać proponowanym zasadom i przykładom: mówi o tym jedna notka.
const rulesNote = inp => {
  const changed = changedRules(inp, state.lokal);
  return changed.length ? `<p class="sens-note rules-note">Zmieniono zasady rozliczenia względem proponowanych (${esc(changed.map(f => lower(f.label)).join(', '))}). Wynik nie odpowiada przykładom z zasad rozliczenia.</p>` : '';
};

function renderHero(inp, m, d) {
  const a = afterCosts(inp, m);
  const word = periodWord(d);
  const buttons = `<div class="segmented" role="group" aria-label="Okres kwot"><button data-period="month" aria-pressed="${state.period === 'month'}">Miesięcznie</button><button data-period="year" aria-pressed="${state.period === 'year'}">Rocznie</button></div>`;
  $('hero').innerHTML = `<div class="section-head"><h2>Wynik: ${esc(LOKALE[state.lokal].label)}</h2>${buttons}</div>
    <div class="recommendation"><div class="recommend-label">Czynsz ${word}</div><strong id="hero-value">${fmt(m.rent * d)}</strong>
      <p class="after-costs">Po kosztach i uruchomieniu: <b>${fmt(a.net * d)} ${word}</b></p></div>
    <p class="hero-note">Kwoty miesięczne to średnia z roku. Dane przykładowe to założenia, nie prognoza. Koszty i uruchomienie zmienisz w zwiniętej sekcji „Koszty właściciela”.</p>${rulesNote(inp)}`;
  $('mobile-summary').textContent = `Czynsz: ${fmt(m.rent * d)} ${word}`;
}

function renderBreakdown(inp, m, d) {
  const row = (label, note, value, cls = '') => `<tr class="${cls}"><td>${esc(label)}${note ? `<span class="calc">${esc(note)}</span>` : ''}</td><td>${value}</td></tr>`;
  const rows = [
    row('Przychód z noclegów (brutto)', '', fmt2(m.revenue * d)),
    m.cleanExcess > 0.004 ? row('w tym opłata za sprzątanie ponad limit', '', fmt2(m.cleanExcess * d), 'muted') : '',
    row('VAT od noclegów', `${num(inp.vat)}% wliczone w kwotę brutto`, neg2(m.vat * d)),
    row('Prowizje portali zewnętrznych', `${num(effectiveOtaPct(inp))}% przychodu z portali`, neg2(m.fees * d)),
    row('Podstawa Czynszu', '', fmt2(m.base * d), 'total'),
    row('Czynsz', m.floored ? 'minimalny Czynsz miesięczny' : `${num(100 - inp.opShare)}% podstawy`, fmt2(m.rent * d), 'total'),
    row('Udział operatora', `${num(inp.opShare)}% podstawy`, fmt2(m.operator * d), 'muted'),
  ].join('');
  const s = split(m);
  let bar;
  if (!s) {
    bar = '<div class="split" role="img" aria-label="Brak przychodu do podziału"></div><p class="sens-note">Brak przychodu od gości, nie ma czego dzielić.</p>';
  } else {
    const parts = [['vat', s.vat, 'VAT'], ['portal', s.portal, 'Portale zewnętrzne'], ['op', s.operator, 'Operator'], ['owner', s.owner, 'Właściciel (Czynsz)']];
    // Pasek rysuje tylko części dodatnie, a przy ujemnej części reszta jest skalowana, by pasek się nie przepełnił. Legenda zostaje prawdziwa.
    const scale = Math.max(1, parts.reduce((acc, [, v]) => acc + Math.max(0, v), 0) / 100);
    const segs = parts.map(([c, v, l]) => `<span class="seg-${c}" style="width:${Math.max(0, v) / scale}%" title="${esc(l)}: ${pct(v)}"></span>`).join('');
    const legend = parts.map(([c, v, l]) => `<span><i class="dot-${c}"></i>${esc(l)} ${pct(v)}</span>`).join('');
    bar = `<div class="split" role="img" aria-label="Podział przychodu z noclegów">${segs}</div><div class="split-legend">${legend}</div>`;
  }
  const note = m.floored ? `<p class="sens-note">Zastosowano minimalny Czynsz miesięczny (${fmt2(inp.minRent)}). Udział operatora jest wtedy różnicą między podstawą a tym minimum.</p>` : '';
  $('breakdown').innerHTML = `<div class="section-head"><h2>Z czego to wynika (${periodWord(d)})</h2></div>
    <div class="table-scroll"><table class="res-table"><caption class="sr-only">Rozbicie przychodu z noclegów na VAT, prowizje, Czynsz i udział operatora</caption><thead><tr><th scope="col">Pozycja</th><th scope="col">Kwota</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${note}
    <h3 class="sub-heading">Z każdych 100 zł zapłaconych przez gości</h3>${bar}`;
}

function renderReservation(inp) {
  const r = reservation(inp);
  const row = (label, note, value, cls = '') => `<tr class="${cls}"><td>${esc(label)}${note ? `<span class="calc">${esc(note)}</span>` : ''}</td><td>${value}</td></tr>`;
  const ota = r.channel === 'ota';
  const feeNote = !ota ? 'brak, rezerwacja bezpośrednia'
    : r.feeOver > 0 ? `portal pobrał ${fmt2(r.feeCharged)}, odejmuje się ${num(effectiveOtaPct(inp))}% przychodu (limit); różnicę ${fmt2(r.feeOver)} ponosi operator`
    : `${num(inp.otaPct)}% przychodu`;
  const rows = [
    row('Kwota za noclegi brutto', '', fmt2(r.gross)),
    r.clean > 0 ? row('Opłata za sprzątanie ponad limit', `opłata ${fmt2(r.clean)}, limit ${fmt2(inp.cleanLimit)}; ${fmt2(r.cleanKept)} zostaje poza przychodem`, `+${fmt2(r.cleanExcess)}`) : '',
    row('Przychód z noclegów', '', fmt2(r.revenue), 'total'),
    row('VAT wliczony', `${fmt2(r.revenue)} × ${num(inp.vat)} / ${num(100 + inp.vat)}`, neg2(r.vat)),
    row('Prowizja portalu zewnętrznego', feeNote, neg2(r.fee), r.fee === 0 ? 'muted' : ''),
    row('Podstawa Czynszu', '', fmt2(r.base), 'total'),
    row('Czynsz', `${num(100 - inp.opShare)}% podstawy`, fmt2(r.rent), 'total'),
    row('Udział operatora', `${num(inp.opShare)}% podstawy`, fmt2(r.operator), 'muted'),
  ].join('');
  const ok = Math.abs(r.identity) <= 0.01;
  $('res-table').innerHTML = `<div class="table-scroll"><table class="res-table"><caption class="sr-only">Kroki obliczenia Czynszu dla jednej rezerwacji</caption><thead><tr><th scope="col">Krok</th><th scope="col">Kwota</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${r.base < 0 ? '<p class="sens-note">Prowizja i VAT przewyższają przychód, więc podstawa jest ujemna.</p>' : ''}
    <p class="res-check">Kontrola: VAT, prowizja, udział operatora i Czynsz razem dają przychód z noclegów <span class="${ok ? 'ok' : 'bad'}">${ok ? 'zgodnie' : 'niezgodnie'}</span>.</p>${rulesNote(inp)}`;
}

function update() {
  const inp = state.inp;
  const errors = validate(inp);
  fieldValidation(errors);
  const ok = !errors.length;
  for (const id of ['hero', 'breakdown', 'res-table']) $(id).hidden = !ok;
  syncExampleButtons();
  if (!ok) { $('mobile-summary').textContent = 'Popraw dane, aby zobaczyć wynik'; return; }
  const m = monthly(inp);
  const d = state.period === 'year' ? 12 : 1;
  renderHero(inp, m, d);
  renderBreakdown(inp, m, d);
  renderReservation(inp);
  if (focusAfter) { document.querySelector(focusAfter)?.focus({preventScroll: true}); focusAfter = null; }
}

function syncExampleButtons() {
  document.querySelectorAll('[data-example]').forEach(b => {
    const e = EXAMPLES.find(x => String(x.id) === b.dataset.example);
    b.setAttribute('aria-pressed', String(Object.entries(e.values).every(([k, v]) => state.inp[k] === v)));
  });
}

/* ---------- zdarzenia ---------- */
function onInput(e) {
  const key = e.target.dataset.key;
  if (!key || e.target.tagName === 'SELECT') return;
  state.inp[key] = parseNum(e.target.value);
  clearSharedAddress();
  update();
}
function onChange(e) {
  const key = e.target.dataset.key;
  if (!key || e.target.tagName !== 'SELECT') return;
  state.inp[key] = e.target.value;
  clearSharedAddress();
  update();
}
for (const id of ['form', 'res-inputs']) {
  $(id).addEventListener('input', onInput);
  $(id).addEventListener('change', onChange);
}
$('res-inputs').addEventListener('click', e => {
  const b = e.target.closest('[data-example]');
  if (!b) return;
  Object.assign(state.inp, EXAMPLES.find(x => String(x.id) === b.dataset.example).values);
  syncControls(); clearSharedAddress(); update();
});
$('lokal-switch').addEventListener('click', e => {
  const b = e.target.closest('[data-lokal]');
  if (!b) return;
  state = fresh(b.dataset.lokal, state.period);
  clearSharedAddress(); syncControls(); update();
  status(`Wczytano dane przykładowe: ${LOKALE[state.lokal].label}.`);
});
$('hero').addEventListener('click', e => {
  const pe = e.target.closest('[data-period]');
  if (!pe) return;
  state.period = pe.dataset.period; focusAfter = `[data-period="${state.period}"]`;
  clearSharedAddress(); update();
});
$('errors').addEventListener('click', e => {
  const a = e.target.closest('[data-reveal]');
  if (a) { e.preventDefault(); reveal(a.dataset.reveal); }
});
$('reset').addEventListener('click', () => {
  state = fresh(state.lokal, state.period);
  clearSharedAddress(); syncControls(); update();
  status(`Przywrócono dane przykładowe: ${LOKALE[state.lokal].label}.`);
});
$('print').addEventListener('click', () => window.print());
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
  if (!location.hash.startsWith('#dane=')) return;
  try { state = decodeShare(location.hash); status('Wczytano dane z udostępnionego linku.'); }
  catch (err) { state = fresh('13'); status(`${err.message} Wyświetlono dane przykładowe.`, true); }
}

renderForm();
load();
syncControls();
update();

// Wydruk i PDF: rozwiń opis i zwinięte sekcje danych, żeby dokument zawierał komplet wartości, po wydruku przywróć stan.
let reopened = [];
window.addEventListener('beforeprint', () => {
  reopened = [...document.querySelectorAll('#method:not([open]), details.section:not([open])')];
  reopened.forEach(d => { d.open = true; });
});
window.addEventListener('afterprint', () => { reopened.forEach(d => { d.open = false; }); reopened = []; });
