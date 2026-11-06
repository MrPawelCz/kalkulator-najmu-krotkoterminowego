// Czysty silnik kalkulatora (bez DOM). Kwoty w zł. Jedna zasada liczenia Czynszu.
import {FIELDS} from './fields.js';

const DAYS = 365 / 12;
const p = x => x / 100;

/** Zaokrąglenie matematyczne do 0,01 (połówka w górę co do wartości bezwzględnej), odporne na błędy zapisu binarnego. */
export const r2 = x => {
  const cents = Number((Math.abs(x) * 100).toPrecision(12));
  const v = Math.sign(x) * Math.round(cents) / 100;
  return Object.is(v, -0) ? 0 : v;
};

/** Prowizja portalu zewnętrznego liczona w rozliczeniu: nie więcej niż limit. */
export const effectiveOtaPct = inp => Math.min(inp.otaPct, inp.otaCap);

/**
 * Pojedyncza rezerwacja, zaokrąglenie do 0,01 po każdym kroku.
 * Przychód z noclegów = kwota za noclegi + część opłaty za sprzątanie ponad limit.
 */
export function reservation(inp, {gross = inp.resGross, clean = inp.resClean, channel = inp.resChannel} = {}) {
  const cleanExcess = r2(Math.max(0, clean - inp.cleanLimit));
  const cleanKept = r2(clean - cleanExcess);
  const revenue = r2(gross + cleanExcess);
  const vat = r2(revenue * inp.vat / (100 + inp.vat));
  const feeCharged = channel === 'ota' ? r2(p(inp.otaPct) * revenue) : 0;
  const fee = channel === 'ota' ? r2(p(effectiveOtaPct(inp)) * revenue) : 0;
  const base = r2(revenue - vat - fee);
  const rent = r2(p(100 - inp.opShare) * base);
  const operator = r2(base - rent);
  return {gross, clean, channel, cleanExcess, cleanKept, revenue, vat, feeCharged, fee, feeOver: r2(feeCharged - fee),
    base, rent, operator, identity: r2(vat + fee + operator + rent - revenue)};
}

/** Miesięczny model średni (bez zaokrąglania kroków). */
export function monthly(inp) {
  const nights = DAYS * p(inp.occ);
  const nightsDirect = nights * p(inp.direct);
  const stays = nights / inp.stay;
  const cleanExcess = Math.max(0, inp.cleanFee - inp.cleanLimit) * stays;
  const revenue = inp.adr * nights + cleanExcess;
  const revenueOta = revenue * (1 - p(inp.direct));
  const vat = revenue * inp.vat / (100 + inp.vat);
  const fees = p(effectiveOtaPct(inp)) * revenueOta;
  const base = revenue - vat - fees;
  const rentRaw = p(100 - inp.opShare) * base;
  const rent = Math.max(inp.minRent, rentRaw);
  return {nights, nightsDirect, nightsOta: nights - nightsDirect, stays, cleanExcess, revenue, revenueOta, vat, fees, base,
    rentRaw, rent, floored: rentRaw < inp.minRent, operator: base - rent,
    identity: revenue - (vat + fees + (base - rent) + rent)};
}

/** Koszty właściciela i uruchomienie rozłożone na miesiące. */
export function costs(inp) {
  const items = [
    {id: 'costAdmin', label: 'Czynsz administracyjny i media', amount: inp.costAdmin},
    {id: 'costOther', label: 'Internet, telewizja, śmieci, ubezpieczenie', amount: inp.costOther},
    {id: 'costRepairs', label: 'Naprawy i uzupełnianie wyposażenia', amount: inp.costRepairs},
    {id: 'costTax', label: 'Podatek od nieruchomości', amount: inp.costTax},
  ];
  const running = items.reduce((a, i) => a + i.amount, 0);
  // Kwoty miesięczne to średnia z roku: koszt rozłożony na mniej niż 12 miesięcy liczy się w całości w pierwszym roku.
  const startPerMonth = inp.startCost / Math.max(12, inp.startMonths);
  return {items, running, startPerMonth, total: running + startPerMonth};
}

/** Czynsz po kosztach i uruchomieniu (miesięcznie). */
export function afterCosts(inp, m = monthly(inp)) {
  const c = costs(inp);
  return {rent: m.rent, running: c.running, startPerMonth: c.startPerMonth, net: m.rent - c.total};
}

/** Podział każdych 100 zł przychodu z noclegów: VAT, portal, operator, właściciel (w %). null: brak przychodu. */
export function split(m) {
  if (!(m.revenue > 0)) return null;
  const pct = v => v / m.revenue * 100;
  return {vat: pct(m.vat), portal: pct(m.fees), operator: pct(m.operator), owner: pct(m.rent)};
}

export function validate(inp) {
  const errors = [];
  for (const f of FIELDS) {
    const v = inp[f.key];
    if (f.kind === 'select') {
      if (!f.options.some(([value]) => value === v)) errors.push({key: f.key, message: 'Wybierz jedną z opcji.'});
    } else if (typeof v !== 'number' || !Number.isFinite(v)) {
      errors.push({key: f.key, message: 'Wpisz liczbę.'});
    } else if (v < f.min || v > f.max) {
      errors.push({key: f.key, message: `Wpisz wartość od ${String(f.min).replace('.', ',')} do ${f.max}.`});
    } else if (f.kind === 'int' && !Number.isInteger(v)) {
      errors.push({key: f.key, message: 'Wpisz liczbę całkowitą.'});
    }
  }
  return errors;
}
