// Metadane pól kalkulatora i wartości domyślne lokali.
// Jedno źródło prawdy: formularz, walidacja, udostępnianie i testy czytają tę listę.

export const SOURCES = Object.freeze({
  zasada: 'zasada rozliczenia',
  zal: 'założenie',
});

export const LOKALE = Object.freeze({
  13: Object.freeze({label: 'Lokal nr 13', desc: 'salon z aneksem i jeden pokój'}),
  42: Object.freeze({label: 'Lokal nr 42', desc: 'salon z aneksem i dwa pokoje'}),
});

export const CHANNELS = Object.freeze([
  ['ota', 'Portal zewnętrzny'],
  ['direct', 'Rezerwacja bezpośrednia'],
]);

// open: sekcja rozwinięta. fixed: sekcja stała, bez zwijania (pola na wierzchu).
export const GROUPS = Object.freeze([
  {id: 'rez', title: 'Rezerwacje', summary: 'założenia do poprawienia', fixed: true},
  {id: 'zasady', title: 'Zasady rozliczenia', summary: 'udział, VAT, limity', open: false},
  {id: 'koszty', title: 'Koszty właściciela', summary: 'opcjonalne', open: false},
  {id: 'res', title: 'Przykład pojedynczej rezerwacji', summary: '', hidden: true},
]);

// kind: money | percent | number | int | select
// d: wartość domyślna albo {13: ..., 42: ...}
const F = (key, group, label, unit, kind, src, d, opt = {}) => ({key, group, label, unit, kind, src, d, ...opt});

const base = [
  F('adr', 'rez', 'Cena za dobę (brutto, z VAT)', 'zł', 'money', 'zal', {13: 300, 42: 400}, {
    max: 10000, hint: 'Średnia kwota zapłacona przez gościa za dobę wraz z opłatami dodatkowymi (dodatkowe osoby, zwierzęta, zameldowanie), bez opłaty za sprzątanie, opłat miejscowych i innych danin, kaucji zwrotnych do chwili ich zatrzymania oraz odszkodowań przeznaczonych na naprawę szkód.'}),
  F('occ', 'rez', 'Obłożenie', '%', 'percent', 'zal', 55, {hint: 'Udział sprzedanych nocy w miesiącu.'}),
  F('stay', 'rez', 'Średni pobyt', 'nocy', 'number', 'zal', 2.5, {
    min: 1, max: 365, step: 0.1, hint: 'Wpływa na liczbę pobytów, a więc na opłaty za sprzątanie.'}),
  F('direct', 'rez', 'Rezerwacje bezpośrednie', '% nocy', 'percent', 'zal', 20, {
    hint: 'Rezerwacje bez portalu zewnętrznego. Nie ma od nich prowizji portalu.'}),
  F('otaPct', 'rez', 'Prowizja portalu zewnętrznego', '% przychodu', 'percent', 'zal', 15, {
    hint: 'Prowizja netto (bez VAT) faktycznie pobrana przez portal, pomniejszona o zwroty, korekty, rabaty i kredyty otrzymane od portalu. W rozliczeniu liczy się nie więcej niż limit z zasad rozliczenia.'}),
  F('cleanFee', 'rez', 'Opłata za sprzątanie od gościa', 'zł za pobyt', 'money', 'zal', 180, {
    max: 5000, hint: 'Łączna opłata za sprzątanie, pranie, tekstylia i przygotowanie lokalu. Do limitu z zasad rozliczenia nie jest przychodem; część ponad limit wchodzi do przychodu z noclegów.'}),

  F('opShare', 'zasady', 'Udział operatora w podstawie', '%', 'percent', 'zasada', 20, {
    hint: 'Czynsz to pozostała część podstawy.'}),
  F('vat', 'zasady', 'VAT od noclegów', '%', 'percent', 'zasada', 8, {
    max: 8, hint: 'VAT jest wliczony w kwotę brutto: kwota × stawka / (100 + stawka). W rozliczeniu liczy się faktycznie należny VAT, nie więcej niż 8/108 przychodu.'}),
  F('otaCap', 'zasady', 'Limit prowizji portalu zewnętrznego', '% przychodu', 'percent', 'zasada', 15, {
    hint: 'Prowizja ponad limit nie pomniejsza podstawy.'}),
  F('cleanLimit', 'zasady', 'Opłata za sprzątanie poza przychodem', 'zł za pobyt', 'money', 'zasada', 180, {
    max: 5000, hint: 'Opłaty za sprzątanie, pranie, tekstylia i przygotowanie lokalu do tej kwoty za pobyt nie wchodzą do przychodu.'}),
  F('minRent', 'zasady', 'Minimalny Czynsz miesięczny', 'zł', 'money', 'zasada', 1, {
    max: 1000, hint: 'Czynsz miesięczny nie jest niższy niż ta kwota.'}),

  F('costAdmin', 'koszty', 'Czynsz administracyjny i media', 'zł mies.', 'money', 'zal', {13: 480, 42: 620}, {
    max: 100000, hint: 'Czynsz do wspólnoty lub spółdzielni oraz zaliczki na media.'}),
  F('costOther', 'koszty', 'Internet, telewizja, śmieci, ubezpieczenie', 'zł mies.', 'money', 'zal', {13: 145, 42: 170}, {max: 100000}),
  F('costRepairs', 'koszty', 'Naprawy i uzupełnianie wyposażenia', 'zł mies.', 'money', 'zal', {13: 100, 42: 130}, {max: 100000}),
  F('costTax', 'koszty', 'Podatek od nieruchomości', 'zł mies.', 'money', 'zal', {13: 5, 42: 6}, {
    max: 100000, hint: 'Przykładowa wartość. Wpisz własną, stawka zależy od gminy.'}),
  F('startCost', 'koszty', 'Koszt uruchomienia lokalu', 'zł jednorazowo', 'money', 'zal', {13: 6430, 42: 9250}, {
    max: 100000, hint: 'Szacunek jednorazowego kosztu przygotowania lokalu.'}),
  F('startMonths', 'koszty', 'Rozłożenie kosztu uruchomienia na', 'mies.', 'int', 'zal', 24, {
    min: 1, max: 120, hint: 'Koszt uruchomienia jest dzielony na tyle miesięcy; w wyniku rocznym liczy się najwyżej pierwsze 12 miesięcy tego rozłożenia.'}),

  // Pola przykładu pojedynczej rezerwacji (wyświetlane w panelu wyniku, nie w formularzu).
  F('resGross', 'res', 'Kwota za noclegi brutto', 'zł', 'money', 'zal', 100, {max: 100000, hint: 'Noclegi i opłaty dodatkowe, bez opłaty za sprzątanie.'}),
  F('resClean', 'res', 'Opłata za sprzątanie', 'zł', 'money', 'zal', 0, {max: 5000}),
  F('resChannel', 'res', 'Kanał rezerwacji', '', 'select', 'zal', 'ota', {options: CHANNELS}),
];

const DEFAULT_RANGE = {money: [0, 100000], percent: [0, 100], number: [0, 1e6], int: [0, 1e5]};

export const FIELDS = Object.freeze(base.map(f => {
  const [min, max] = DEFAULT_RANGE[f.kind] || [];
  return Object.freeze({step: f.kind === 'int' ? 1 : undefined, min, max, ...f});
}));

export const FIELD_BY_KEY = Object.freeze(Object.fromEntries(FIELDS.map(f => [f.key, f])));

export function defaultsFor(lokal) {
  const key = String(lokal);
  if (!LOKALE[key]) throw new Error(`Nieznany lokal: ${lokal}`);
  return Object.fromEntries(FIELDS.map(f => [f.key, typeof f.d === 'object' ? f.d[key] : f.d]));
}

/** Pola „zasada”, których wartość różni się od proponowanej (domyślnej dla lokalu). */
export function changedRules(inp, lokal) {
  const d = defaultsFor(lokal);
  return FIELDS.filter(f => f.src === 'zasada' && inp[f.key] !== d[f.key]);
}

// Przykłady pojedynczej rezerwacji: kwoty z noclegów, opłata za sprzątanie i kanał.
export const EXAMPLES = Object.freeze([
  {id: 1, label: 'Przykład 1', values: {resGross: 100, resClean: 0, resChannel: 'ota'}},
  {id: 2, label: 'Przykład 2', values: {resGross: 100, resClean: 0, resChannel: 'direct'}},
  {id: 3, label: 'Przykład 3', values: {resGross: 600, resClean: 220, resChannel: 'direct'}},
]);
