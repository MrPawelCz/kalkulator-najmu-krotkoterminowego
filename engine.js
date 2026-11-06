// Czysty silnik kalkulatora (bez DOM). Kwoty w zł.
import {FIELDS, START_ITEMS} from './fields.js';

const DAYS = 365 / 12;
export const r2 = x => Math.round((x + Number.EPSILON) * 100) / 100;
const p = x => x / 100;
const sum = list => list.reduce((a, b) => a + b, 0);

export const SCENARIOS = Object.freeze({
  mail: {id: 'mail', name: 'Schemat z maila operatora', short: 'Mail',
    rule: 'Podstawa to kwota netto minus prowizje portali. Od niej prowizja operatora, reszta dla właściciela.'},
  c1: {id: 'c1', name: 'Umowa z podstawą brutto', short: 'Umowa, brutto',
    rule: 'Czynsz to udział właściciela razy (przychód brutto minus prowizje i opłaty).'},
  c2: {id: 'c2', name: 'Umowa z podstawą netto', short: 'Umowa, netto',
    rule: 'Czynsz to udział właściciela razy (przychód netto minus prowizje i opłaty).'},
});
export const SCENARIO_IDS = Object.freeze(['mail', 'c1', 'c2']);

/** Pojedyncza rezerwacja, zaokrąglanie do 0,01 po każdym kroku (jak w przykładzie z maila). */
export function reservation(inp, gross = inp.resGross) {
  const net = r2(gross / (1 + p(inp.vatNights)));
  const vat = r2(gross - net);
  const channels = {};
  for (const ch of ['ota', 'direct']) {
    const feeOta = ch === 'ota' ? r2(p(inp.otaPct) * (inp.otaBase === 'gross' ? gross : net)) : 0;
    const feePay = r2(p(inp.payPct) * gross);
    const feeOwn = ch === 'direct' ? r2(p(inp.ownPct) * gross) : 0;
    const fees = r2(feeOta + feePay + feeOwn);
    const scen = {};
    const finish = (id, base, owner, operatorFee) => {
      // Udział operatora wprost z jego pozycji; przy podstawie brutto VAT wypada z jego puli.
      const share = r2(operatorFee + feeOwn - (id === 'c1' ? vat : 0));
      scen[id] = {id, base, owner, operatorFee, operatorKeeps: share,
        identity: r2(vat + feeOta + feePay + share + owner - gross)};
    };
    {
      const base = r2(net - fees), fee = r2(p(inp.mailPct) * base);
      finish('mail', base, r2(base - fee), fee);
    }
    for (const id of ['c1', 'c2']) {
      const base = r2((id === 'c1' ? gross : net) - fees), owner = r2((1 - p(inp.contractPct)) * base);
      finish(id, base, owner, r2(base - owner));
    }
    channels[ch] = {feeOta, feePay, feeOwn, fees, scen};
  }
  return {gross, net, vat, channels};
}

/** Miesięczny model średni. */
export function monthly(inp) {
  const vn = p(inp.vatNights), vc = p(inp.vatClean);
  const nights = DAYS * p(inp.occ);
  const nightsDir = nights * p(inp.direct), nightsOta = nights - nightsDir;
  const stays = inp.stay > 0 ? nights / inp.stay : 0;
  const grossOta = inp.adr * nightsOta, grossDir = inp.adr * nightsDir, gross = grossOta + grossDir;
  const netOta = grossOta / (1 + vn), net = gross / (1 + vn);
  const vatNights = gross - net;
  const feeOta = p(inp.otaPct) * (inp.otaBase === 'gross' ? grossOta : netOta);
  const feePay = p(inp.payPct) * gross;
  const feeOwn = p(inp.ownPct) * grossDir;
  const fees = feeOta + feePay + feeOwn;
  const cleanGross = stays * inp.cleanFee, cleanNet = cleanGross / (1 + vc);
  const potGross = gross + (inp.cleanInBase ? cleanGross : 0);
  const potNet = net + (inp.cleanInBase ? cleanNet : 0);
  const potVat = potGross - potNet;
  const scenarios = {};
  for (const id of SCENARIO_IDS) {
    let base, owner, floored = false;
    if (id === 'mail') {
      base = potNet - fees;
      owner = base * (1 - p(inp.mailPct));
    } else {
      base = (id === 'c1' ? potGross : potNet) - fees;
      const raw = base * (1 - p(inp.contractPct));
      owner = Math.max(inp.minRent, raw);
      floored = raw < inp.minRent;
    }
    const operatorFee = base - owner;
    const share = operatorFee + feeOwn - (id === 'c1' ? potVat : 0);
    scenarios[id] = {
      id, base, owner, operatorFee, operatorKeeps: share, floored,
      ownerShare: potGross > 0 ? owner / potGross : 0,
      rentVat: inp.vatPayer ? owner * p(inp.rentVat) : 0,
      identity: potGross - (potVat + feeOta + feePay + share + owner),
    };
    scenarios[id].rentGross = owner + scenarios[id].rentVat;
  }
  return {nights, nightsOta, nightsDir, stays, gross, grossOta, grossDir, net, vatNights,
    feeOta, feePay, feeOwn, fees, cleanGross, cleanNet, potGross, potNet, potVat, scenarios};
}

export function costs(inp) {
  const propRate = inp.taxBizOn ? inp.taxBiz : inp.taxResid;
  const items = [
    {id: 'admin', label: 'Czynsz administracyjny', amount: inp.admin},
    {id: 'utilities', label: 'Prąd i gaz', amount: inp.utilities},
    {id: 'net', label: 'Internet i telewizja', amount: inp.net},
    {id: 'waste', label: 'Opłata za śmieci', amount: inp.waste},
    {id: 'insurance', label: 'Ubezpieczenie lokalu i OC', amount: inp.insurance},
    {id: 'proptax', label: 'Podatek od nieruchomości', amount: inp.area * propRate / 12},
    {id: 'repairs', label: 'Naprawy i serwis', amount: inp.repairs},
    {id: 'supplies', label: 'Uzupełnianie wyposażenia', amount: inp.supplies},
    {id: 'buyfee', label: 'Opłata operatora za zakupy', amount: inp.supplies * p(inp.buyFee)},
    {id: 'stays', label: 'Sprzątanie po pobytach własnych', amount: inp.ownerStays * inp.ownerClean / 12},
  ];
  return {items, total: sum(items.map(i => i.amount)), propTaxExtra: inp.area * (inp.taxBiz - inp.taxResid) / 12};
}

export function startup(inp) {
  const lines = START_ITEMS.map(it => ({label: it.label, qty: inp[it.q], price: inp[it.p], sum: inp[it.q] * inp[it.p]}));
  const sheetTotal = sum(lines.map(l => l.sum));
  const discount = sheetTotal * p(inp.startDiscount);
  const purchases = inp.kitchen + inp.decor;
  const purchaseFee = purchases * p(inp.buyFee);
  const totalBeforeDiscount = sheetTotal + purchases + purchaseFee;
  const total = totalBeforeDiscount - discount;
  const months = Math.max(1, inp.amort);
  return {lines, sheetTotal, discount, purchases, purchaseFee, total, totalBeforeDiscount, months, perMonth: total / months};
}

/** Wynik właściciela w scenariuszu: koszty, uruchomienie, podatek, porównanie z najmem długim. */
export function result(inp, id, m = monthly(inp)) {
  const s = m.scenarios[id], c = costs(inp), st = startup(inp);
  const preTax = s.owner - c.total - st.perMonth;
  const taxBaseAmount = inp.taxBase === 'nights' ? m.net : s.owner;
  const tax = inp.taxOn ? Math.max(0, p(inp.taxPct) * taxBaseAmount) : 0;
  const afterTax = preTax - tax;
  const longTax = inp.taxOn ? p(inp.taxPct) * inp.ltRent : 0;
  const longNet = inp.ltRent - inp.ltCost - longTax;
  return {id, owner: s.owner, costs: c.total, startupPerMonth: st.perMonth, preTax, tax, afterTax,
    yearAfterTax: afterTax * 12, yearOwner: s.owner * 12, longNet, vsLong: afterTax - longNet};
}

/** Obłożenie (%), przy którym wynik przed podatkiem wynosi zero. null: nawet 100% nie wystarcza. */
export function breakEvenOccupancy(inp, id) {
  const f = occ => result({...inp, occ}, id).preTax;
  if (f(100) < 0) return null;
  if (f(0) >= 0) return 0;
  let lo = 0, hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) >= 0) hi = mid; else lo = mid;
  }
  return hi;
}

export const whatIf = (inp, id, patch) => monthly({...inp, ...patch}).scenarios[id].owner - monthly(inp).scenarios[id].owner;

/** Niejasności do wyjaśnienia z operatorem i ich wpływ na kwotę dla właściciela (zł/mies.).
 *  Cztery pierwsze pozycje porównują sposoby liczenia i nie zależą od wybranego sposobu (id). */
export function unclear(inp, id = 'c2') {
  const m = monthly(inp), s = m.scenarios;
  const st = startup(inp), c = costs(inp);
  const zl = x => String(r2(x)).replace('.', ',');
  const otherTaxBase = inp.taxBase === 'nights' ? 'rent' : 'nights';
  const taxSwitch = result(inp, id, m).tax - result({...inp, taxBase: otherTaxBase}, id, m).tax;
  const word = inp.contractPct === 30;
  return [
    {id: 'stawka', title: 'Prowizja operatora: 10%, 20% czy 25%?',
      says: 'Przykład z maila liczy 10%, tekst maila 20 do 25%, projekt umowy 25%.',
      value: s.c2.owner - s.mail.owner, unit: 'zł/mies.', note: 'Różnica: umowa z podstawą netto wobec przykładu z maila.'},
    {id: 'promocja', title: 'Czego dotyczy promocja 20%?',
      says: 'Mail wspomina o promocji 20% na wdrożenie lokalu; warunki nie są jasne. Stawka czy rabat na wdrożenie?',
      value: whatIf(inp, 'c2', {contractPct: 20}) - whatIf(inp, 'c2', {contractPct: 25}), unit: 'zł/mies.',
      note: `Gdyby chodziło o stawkę: 20% zamiast 25%, umowa z podstawą netto. Gdyby o wdrożenie: rabat 20% od pozycji arkusza to jednorazowo ${zl(st.sheetTotal * 0.2)} zł, od całości uruchomienia ${zl(st.totalBeforeDiscount * 0.2)} zł.`},
    {id: 'podstawa', title: 'Podstawa czynszu: brutto czy netto?',
      says: 'Projekt umowy mówi o przychodach brutto, ale to samo zdanie kończy się słowem „netto”, które może znaczyć koszty bez VAT albo wynik netto. Schemat z maila liczy od kwoty netto.',
      value: s.c2.owner - s.c1.owner, unit: 'zł/mies.', note: 'Różnica: podstawa netto wobec podstawy brutto.'},
    {id: 'procent', title: 'Udział z umowy: 75% czy 70%?',
      says: 'Zapis udziału w projekcie umowy jest niespójny: cyfry mówią 75%, słowo w nawiasie 70%.',
      value: whatIf(inp, 'c2', {contractPct: inp.contractPct + (word ? -5 : 5)}), unit: 'zł/mies.',
      note: word ? 'Skutek, gdyby obowiązywały cyfry (udział operatora 25%): umowa z podstawą netto.'
        : 'Skutek, gdyby obowiązywało słowo (udział operatora 30%): umowa z podstawą netto.'},
    {id: 'portal', title: 'Opłata własnego portalu operatora',
      says: 'Projekt umowy ją przewiduje i liczy jak prowizję portalu, przykład z maila sprzedaży bezpośredniej jej nie ma.',
      value: whatIf(inp, id, {ownPct: inp.ownPct + 5}), unit: 'zł/mies.', note: 'Skutek każdych 5 punktów procentowych opłaty od kwoty brutto sprzedaży bezpośredniej.'},
    {id: 'ota', title: 'Prowizja portalu: od brutto czy od netto?',
      says: 'W przykładzie z maila 15 zł to 15% ze 100 zł brutto, odejmowane od kwoty netto.',
      value: whatIf(inp, id, {otaBase: inp.otaBase === 'gross' ? 'net' : 'gross'}), unit: 'zł/mies.', note: 'Skutek zmiany podstawy prowizji portalu.'},
    {id: 'platnosci', title: 'Opłaty operatorów płatności',
      says: 'Projekt umowy je wymienia, mail ich nie podaje.',
      value: whatIf(inp, id, {payPct: inp.payPct + 1.5}), unit: 'zł/mies.', note: 'Skutek opłat płatniczych, np. 1,5% od kwoty brutto.'},
    {id: 'sprzatanie', title: 'Opłata za sprzątanie: w podstawie czy poza?',
      says: 'Projekt umowy: poza podstawą czynszu, zostaje u operatora. Mail tego nie podaje.',
      value: whatIf(inp, id, {cleanInBase: !inp.cleanInBase}), unit: 'zł/mies.', note: 'Skutek zmiany: opłata za sprzątanie od gości wchodzi do podstawy.'},
    {id: 'vat', title: 'VAT od czynszu: doliczany czy wliczony?',
      says: 'Projekt umowy: kwota powiększona o VAT, gdy właściciel jest płatnikiem, stawka 8%.',
      value: -(s[id].owner - s[id].owner / (1 + p(inp.rentVat))), unit: 'zł/mies.',
      note: 'Dotyczy właściciela będącego płatnikiem VAT: gdyby kwota czynszu zawierała już VAT, tyle zostałoby po jego odprowadzeniu mniej.'},
    {id: 'model', title: 'Model prawny: najem czy pośrednictwo?',
      says: 'Projekt umowy to najem i podnajem z czynszem, mail mówi o prowizji i kwocie dla właściciela.',
      value: taxSwitch, unit: 'zł/mies.',
      note: inp.taxBase === 'nights' ? 'Mniej ryczałtu, gdyby podstawą był czynsz, a nie przychód z noclegów netto.'
        : 'Dodatkowy ryczałt, gdyby podstawą był przychód z noclegów netto, a nie czynsz.'},
    {id: 'nieruchomosc', title: 'Podatek od nieruchomości: stawka mieszkalna czy dla działalności?',
      says: 'Zależy od kwalifikacji lokalu przez urząd gminy.',
      value: inp.taxBizOn ? c.propTaxExtra : -c.propTaxExtra, unit: 'zł/mies.',
      note: inp.taxBizOn ? 'Mniej podatku, gdyby urząd zastosował stawkę mieszkalną.' : 'Dodatkowy podatek, gdyby urząd zastosował stawkę dla działalności.'},
    {id: 'uruchomienie', title: 'Koszt uruchomienia: stała kwota, rabat, opłata 20%',
      says: 'Arkusz podaje 4030 zł dla 4 osób i 2 łóżek, zakupy ok. 2 tys. zł plus opłata 20% poza umową.',
      value: -st.total, unit: 'zł jednorazowo', note: `Razem: pozycje arkusza ${r2(st.sheetTotal)} zł plus zakupy z opłatą ${r2(st.purchases + st.purchaseFee)} zł.`},
    {id: 'minimum', title: `Minimalny czynsz ${zl(inp.minRent)} zł`,
      says: `Projekt umowy przewiduje minimalny czynsz 1 zł miesięcznie${r2(inp.minRent) === 1 ? '' : `, w formularzu wpisano ${zl(inp.minRent)} zł`}. Przy braku pobytów koszty lokalu pozostają po stronie właściciela.`,
      value: -c.total, unit: 'zł/mies.', note: 'Stałe koszty właściciela przy zerowym obłożeniu.'},
  ];
}

export function validate(inp) {
  const errors = [];
  for (const f of FIELDS) {
    const v = inp[f.key];
    if (f.kind === 'check') {
      if (typeof v !== 'boolean') errors.push({key: f.key, message: 'Wartość musi być tak albo nie.'});
    } else if (f.kind === 'select') {
      if (!f.options.some(([value]) => value === v)) errors.push({key: f.key, message: 'Wybierz jedną z opcji.'});
    } else if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push({key: f.key, message: 'Wpisz liczbę.'});
    } else if (v < f.min || v > f.max) {
      errors.push({key: f.key, message: `Wpisz wartość od ${f.min} do ${f.max}.`});
    } else if (f.kind === 'int' && !Number.isInteger(v)) {
      errors.push({key: f.key, message: 'Wpisz liczbę całkowitą.'});
    }
  }
  return errors;
}
