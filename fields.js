// Metadane pól kalkulatora, wartości domyślne dla lokali i przykład z maila operatora.
// Jedno źródło prawdy: formularz, walidacja, udostępnianie i testy czytają tę listę.

export const SOURCES = Object.freeze({
  mail: 'z maila operatora',
  umowa: 'z projektu umowy',
  arkusz: 'z arkusza uruchomienia',
  zal: 'założenie',
});

export const LOKALE = Object.freeze({
  13: Object.freeze({label: 'Lokal nr 13', desc: 'salon z aneksem i jeden pokój'}),
  42: Object.freeze({label: 'Lokal nr 42', desc: 'salon z aneksem i dwa pokoje'}),
});

export const GROUPS = Object.freeze([
  {id: 'rez', title: 'Rezerwacje', summary: 'cena, obłożenie, kanały', open: true},
  {id: 'vat', title: 'VAT i opłaty od gości', summary: 'noclegi i sprzątanie', open: true},
  {id: 'prow', title: 'Prowizje portali i opłaty', summary: 'portal zewnętrzny, własny portal', open: true},
  {id: 'scen', title: 'Rozliczenie z operatorem', summary: 'trzy sposoby liczenia', open: true},
  {id: 'koszty', title: 'Koszty właściciela', summary: 'miesięcznie', open: false},
  {id: 'start', title: 'Uruchomienie lokalu', summary: 'jednorazowo', open: false},
  {id: 'pod', title: 'Podatek dochodowy', summary: 'ryczałt', open: false},
  {id: 'najem', title: 'Najem długoterminowy', summary: 'porównanie', open: false},
  {id: 'res', title: 'Przykład pojedynczej rezerwacji', summary: 'kwota z maila', open: false},
]);

// Pozycje arkusza uruchomienia: ilość (q) i cena jednostkowa (p).
export const START_ITEMS = Object.freeze([
  {q: 'qBed', p: 'pBed', label: 'Komplet pościeli', dq: {13: 12, 42: 18}, dp: 100},
  {q: 'qSheet', p: 'pSheet', label: 'Prześcieradło', dq: {13: 6, 42: 9}, dp: 60},
  {q: 'qTowel', p: 'pTowel', label: 'Komplet ręczników, mały i duży', dq: {13: 12, 42: 18}, dp: 100},
  {q: 'qDuvet', p: 'pDuvet', label: 'Wkłady: kołdra, poduszka', dq: {13: 4, 42: 6}, dp: 120},
  {q: 'qFoot', p: 'pFoot', label: 'Stopka', dq: {13: 3, 42: 3}, dp: 30},
  {q: 'qKey', p: 'pKey', label: 'Skrzynka na klucze', dq: {13: 1, 42: 1}, dp: 100},
  {q: 'qClean', p: 'pClean', label: 'Uruchomienie: sprzątanie, fotograf', dq: {13: 1, 42: 1}, dp: 600},
]);

// kind: money | percent | number | int | check | select
// d: wartość domyślna albo {13: ..., 42: ...}
const F = (key, group, label, unit, kind, src, d, opt = {}) => ({key, group, label, unit, kind, src, d, ...opt});

const base = [
  F('adr', 'rez', 'Cena za dobę (brutto, z VAT)', 'zł', 'money', 'zal', {13: 300, 42: 400},
    {hint: 'Średnia kwota zapłacona przez gościa za dobę, bez opłaty za sprzątanie. Przykładowa, wpisz własną prognozę.'}),
  F('occ', 'rez', 'Obłożenie', '%', 'percent', 'zal', 55, {hint: 'Udział sprzedanych nocy w miesiącu.'}),
  F('stay', 'rez', 'Średni pobyt', 'nocy', 'number', 'zal', 2.5,
    {min: 0.5, max: 365, step: 0.1, hint: 'Wpływa na liczbę pobytów, a więc na opłaty za sprzątanie.'}),
  F('direct', 'rez', 'Sprzedaż bezpośrednia', '% nocy', 'percent', 'zal', 20,
    {hint: 'Rezerwacje przez własny portal operatora, bez portalu zewnętrznego.'}),

  F('vatNights', 'vat', 'VAT od noclegu', '%', 'percent', 'mail', 8,
    {hint: 'Mail: miejsce noclegowe ze stawką VAT 8%. VAT płaci gość. Przy najmie i podnajmie odprowadza go operator i nie jest przychodem właściciela (do potwierdzenia, zob. „Model prawny” w niejasnościach).'}),
  F('cleanFee', 'vat', 'Opłata za sprzątanie od gościa (brutto, za pobyt)', 'zł', 'money', 'umowa', 180,
    {hint: 'Stawka operatora dla gości wg projektu umowy. Zostaje u operatora i jest poza podstawą czynszu. Pokazana informacyjnie. Projekt umowy podaje samą kwotę, a „brutto” i „za pobyt” to założenie.'}),
  F('vatClean', 'vat', 'VAT od opłaty za sprzątanie', '%', 'percent', 'zal', 8,
    {hint: 'Do potwierdzenia, czy jak za nocleg. Ma znaczenie tylko przy włączeniu opłaty do podstawy.'}),
  F('cleanInBase', 'vat', 'Wlicz opłatę za sprzątanie do podstawy czynszu', '', 'check', 'umowa', false,
    {hint: 'Wg projektu umowy opłaty za sprzątanie nie wchodzą do podstawy. Zaznacz, aby zobaczyć skutek, gdyby było inaczej. Założenie: portal nie pobiera prowizji od tej opłaty.'}),

  F('otaPct', 'prow', 'Prowizja portalu zewnętrznego', '%', 'percent', 'mail', 15),
  F('otaBase', 'prow', 'Od czego liczona jest prowizja portalu', '', 'select', 'mail', 'gross', {
    options: [['gross', 'od kwoty brutto (jak w przykładzie z maila)'], ['net', 'od kwoty netto']],
    hint: 'W przykładzie z maila 15 zł to 15% ze 100 zł brutto, a odejmowane jest od kwoty netto 92,59 zł.'}),
  F('payPct', 'prow', 'Opłaty operatorów płatności', '% brutto', 'percent', 'umowa', 0,
    {hint: 'Projekt umowy wymienia opłaty operatorów płatności, mail ich nie ma. Domyślnie 0.'}),
  F('ownPct', 'prow', 'Opłata własnego portalu operatora (sprzedaż bezpośrednia)', '% brutto', 'percent', 'umowa', 0,
    {hint: 'Projekt umowy: przy rezerwacjach przez portal operatora pobiera on oddzielne wynagrodzenie, liczone jak prowizja portalu. Wysokość i forma (procent czy kwota) nie są znane, w przykładzie z maila opłaty nie ma.'}),

  F('mailPct', 'scen', 'Prowizja operatora wg przykładu z maila', '%', 'percent', 'mail', 10, {
    hint: 'Przykład z maila: 10% prowizji dla zarządcy, liczone od podstawy po odjęciu prowizji portalu. Mail nie wyjaśnia, jak to się ma do 20 do 25%.'}),
  F('contractPct', 'scen', 'Udział operatora wg projektu umowy', '%', 'percent', 'umowa', 25, {
    chips: [25, 20],
    hint: 'Projekt umowy: czynsz właściciela 75% podstawy, czyli 25% dla operatora. Mail: 20 do 25% i promocja 20% (stawka albo rabat na wdrożenie, do doprecyzowania).'}),
  F('minRent', 'scen', 'Minimalny czynsz miesięczny', 'zł', 'money', 'umowa', 1),
  F('vatPayer', 'scen', 'Właściciel jest czynnym płatnikiem VAT', '', 'check', 'umowa', false,
    {hint: 'Projekt umowy: czynsz zostanie powiększony o VAT. Kwota netto dla właściciela się nie zmienia.'}),
  F('rentVat', 'scen', 'VAT od czynszu', '%', 'percent', 'umowa', 8,
    {hint: 'Projekt umowy wpisuje 8%. Stawkę dla czynszu warto potwierdzić z doradcą podatkowym, bo stawka za nocleg i za najem lokalu mogą się różnić.'}),

  F('area', 'koszty', 'Powierzchnia do podatku od nieruchomości', 'm²', 'number', 'zal', {13: 48, 42: 61}, {min: 0, max: 5000, step: 1}),
  F('taxResid', 'koszty', 'Stawka podatku: budynek mieszkalny', 'zł/m²/rok', 'money', 'zal', 1.25,
    {hint: 'Przykładowa stawka gminna. Wpisz stawkę swojej gminy.'}),
  F('taxBiz', 'koszty', 'Stawka podatku: zajęty na działalność gospodarczą', 'zł/m²/rok', 'money', 'zal', 35,
    {hint: 'Przykładowa stawka gminna dla lokali zajętych na działalność.'}),
  F('taxBizOn', 'koszty', 'Urząd uznaje lokal za zajęty na działalność gospodarczą', '', 'check', 'zal', false,
    {hint: 'Ryzyko przy podnajmie krótkoterminowym przez firmę. Kwalifikację ustala urząd gminy.'}),
  F('admin', 'koszty', 'Czynsz administracyjny (z zaliczkami)', 'zł/mies.', 'money', 'zal', {13: 350, 42: 450}),
  F('utilities', 'koszty', 'Prąd i gaz', 'zł/mies.', 'money', 'zal', {13: 130, 42: 170}),
  F('net', 'koszty', 'Internet i telewizja', 'zł/mies.', 'money', 'zal', 70),
  F('waste', 'koszty', 'Opłata za śmieci', 'zł/mies.', 'money', 'zal', {13: 35, 42: 50}),
  F('insurance', 'koszty', 'Ubezpieczenie lokalu i OC', 'zł/mies.', 'money', 'zal', {13: 40, 42: 50}),
  F('repairs', 'koszty', 'Naprawy i serwis (bez opłaty operatora)', 'zł/mies.', 'money', 'zal', {13: 60, 42: 80}),
  F('supplies', 'koszty', 'Uzupełnianie wyposażenia (zakupy przez operatora)', 'zł/mies.', 'money', 'zal', {13: 40, 42: 50}),
  F('buyFee', 'koszty', 'Opłata operatora za zakupy', '% wartości', 'percent', 'mail', 20,
    {hint: 'Mail: 20% wartości zakupów na zlecenie właściciela, osobna usługa. W projekcie umowy stawki nie ma (usługi dodatkowe są potrącane z czynszu).'}),
  F('ownerStays', 'koszty', 'Pobyty własne właściciela', 'pobytów/rok', 'int', 'umowa', 0,
    {hint: 'Po każdym pobycie własnym właściciel płaci za sprzątanie.'}),
  F('ownerClean', 'koszty', 'Sprzątanie po pobycie własnym', 'zł', 'money', 'umowa', 180),

  F('persons', 'start', 'Liczba osób (miejsc)', 'osób', 'int', 'mail', {13: 4, 42: 6}, {
    max: 50, hint: 'Wg operatora wycena uruchomienia zależy od liczby osób i stanu lokalu, nie od metrażu. Cztery osoby to parametr przykładu z arkusza operatora; dla lokalu nr 42 (sześć osób) to założenie.'}),
  F('beds', 'start', 'Liczba łóżek', 'szt.', 'int', 'zal', {13: 2, 42: 3}, {max: 50}),
  ...START_ITEMS.flatMap(it => [
    F(it.q, 'start', `${it.label}: ilość`, 'szt.', 'int', 'arkusz', it.dq, {table: 'start', max: 1000}),
    F(it.p, 'start', `${it.label}: cena`, 'zł', 'money', 'arkusz', it.dp, {table: 'start'}),
  ]),
  F('kitchen', 'start', 'Zakupy: kuchnia, AGD, chemia (szacunek)', 'zł', 'money', 'mail', {13: 2000, 42: 3000}, {
    hint: 'Mail: ok. 2 tys. zł dla 4 osób, bez pościeli i dekoracji. Dla lokalu nr 42 przeskalowane (założenie).'}),
  F('decor', 'start', 'Dekoracje', 'zł', 'money', 'mail', 0, {hint: 'Ustalane indywidualnie z właścicielem, bez ceny w mailu.'}),
  F('startDiscount', 'start', 'Rabat na wdrożenie', '%', 'percent', 'mail', 0, {
    chips: [0, 20],
    hint: 'Mail wspomina o promocji 20% na wdrożenie lokalu; warunki nie są jasne. Do doprecyzowania: jeśli dotyczy wdrożenia, wpisz 20. Rabat jest liczony od pozycji arkusza, nie od zakupów z opłatą operatora; skutek obu wariantów widać w „Niejasnościach”.'}),
  F('amort', 'start', 'Rozłożenie kosztu uruchomienia na', 'mies.', 'int', 'zal', 24, {min: 1, max: 240}),

  F('taxOn', 'pod', 'Uwzględnij podatek dochodowy', '', 'check', 'zal', true),
  F('taxPct', 'pod', 'Ryczałt od przychodów z najmu', '%', 'percent', 'zal', 8.5, {
    hint: 'Art. 12 ust. 1 pkt 4 ustawy o zryczałtowanym podatku dochodowym (tekst z 26.08.2026): 8,5% przychodu do 100 000 zł rocznie i 12,5% od nadwyżki. Kalkulator liczy jedną stawkę; przy przychodzie powyżej progu wpisz średnią.'}),
  F('taxBase', 'pod', 'Podstawa podatku', '', 'select', 'zal', 'rent', {
    options: [['rent', 'czynsz otrzymany (najem lokalu operatorowi)'], ['nights', 'przychód z noclegów netto, przed prowizjami (jeśli to pośrednictwo)']],
    hint: 'Zależy od modelu prawnego umowy. Do potwierdzenia z doradcą podatkowym.'}),

  F('ltRent', 'najem', 'Czynsz najmu długoterminowego (netto)', 'zł/mies.', 'money', 'zal', {13: 2300, 42: 3000}),
  F('ltCost', 'najem', 'Koszty właściciela przy najmie długim', 'zł/mies.', 'money', 'zal', {13: 60, 42: 80},
    {hint: 'Przyjęto, że najemca długoterminowy płaci czynsz administracyjny i media, więc właściciel ponosi tylko niewielkie koszty. Wpisz własne.'}),

  F('resGross', 'res', 'Kwota rezerwacji brutto', 'zł', 'money', 'mail', 100, {
    hint: 'Przykład z maila: rezerwacja za 100 zł brutto, 15% prowizji portalu, 10% prowizji operatora, VAT 8%.'}),
];

const DEFAULT_RANGE = {money: [0, 1e7], percent: [0, 100], number: [0, 1e6], int: [0, 1e5]};

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

// Parametry przykładu z maila operatora (100 zł brutto, 15%, 10%, VAT 8%).
export function mailExample() {
  return {vatNights: 8, otaPct: 15, otaBase: 'gross', payPct: 0, ownPct: 0, mailPct: 10, cleanInBase: false, resGross: 100};
}

// Ilości z arkusza: 3 komplety pościeli i ręczników na osobę, 3 prześcieradła na łóżko, 1 wkład na osobę.
// To wniosek z liczb arkusza (4 osoby i 2 łóżka dają 12, 6, 12, 4), nie deklaracja operatora.
export function quantitiesFor(persons, beds) {
  return {qBed: 3 * persons, qSheet: 3 * beds, qTowel: 3 * persons, qDuvet: persons};
}
