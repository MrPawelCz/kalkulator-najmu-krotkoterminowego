import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsFor, mailExample, quantitiesFor} from '../fields.js';
import {r2, reservation, monthly, costs, startup, result, breakEvenOccupancy, unclear, validate, SCENARIO_IDS} from '../engine.js';

const base13 = () => ({...defaultsFor(13), ...mailExample()});

function rng(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

test('przykład z maila: 100 zł przez portal daje właścicielowi 69,83 zł', () => {
  const r = reservation(base13());
  assert.equal(r.net, 92.59);
  assert.equal(r.vat, 7.41);
  const ota = r.channels.ota;
  assert.equal(ota.feeOta, 15);
  assert.equal(ota.scen.mail.base, 77.59);
  assert.equal(ota.scen.mail.operatorFee, 7.76);
  assert.equal(ota.scen.mail.owner, 69.83);
});

test('przykład z maila: 100 zł sprzedaży bezpośredniej daje właścicielowi 83,33 zł', () => {
  const d = reservation(base13()).channels.direct;
  assert.equal(d.feeOta, 0);
  assert.equal(d.scen.mail.operatorFee, 9.26);
  assert.equal(d.scen.mail.owner, 83.33);
});

test('projekt umowy: 100 zł przez portal i sprzedaż bezpośrednia przy 25%', () => {
  const r = reservation(base13());
  assert.equal(r.channels.ota.scen.c1.owner, 63.75);
  assert.equal(r.channels.ota.scen.c2.owner, 58.19);
  assert.equal(r.channels.direct.scen.c1.owner, 75);
  assert.equal(r.channels.direct.scen.c2.owner, 69.44);
});

test('prowizja portalu od netto zamiast od brutto', () => {
  const r = reservation({...base13(), otaBase: 'net'}).channels.ota;
  assert.equal(r.feeOta, 13.89);
  assert.equal(r.scen.mail.owner, r2fix(92.59 - 13.89, 0.1));
});
function r2fix(base, pct) { const fee = Math.round((pct * base + Number.EPSILON) * 100) / 100; return Math.round((base - fee + Number.EPSILON) * 100) / 100; }

test('pojedyncza rezerwacja: podział sumuje się do kwoty brutto w każdym scenariuszu', () => {
  const rand = rng(7);
  for (let i = 0; i < 300; i++) {
    const inp = {...base13(), otaPct: rand() * 25, payPct: rand() * 3, ownPct: rand() * 12, mailPct: rand() * 30,
      contractPct: rand() * 40, vatNights: [0, 5, 8, 23][Math.floor(rand() * 4)], otaBase: rand() > 0.5 ? 'gross' : 'net'};
    const r = reservation(inp, Math.round(rand() * 100000) / 100);
    for (const ch of Object.values(r.channels)) for (const id of SCENARIO_IDS) {
      assert.ok(Math.abs(ch.scen[id].identity) < 1e-9, `${id}: ${ch.scen[id].identity}`);
    }
  }
});

test('miesięcznie: podział sumuje się do przychodu w każdym scenariuszu', () => {
  const rand = rng(11);
  for (let i = 0; i < 300; i++) {
    const inp = {...defaultsFor(rand() > 0.5 ? 13 : 42), adr: 100 + rand() * 500, occ: rand() * 100, direct: rand() * 100,
      stay: 1 + rand() * 6, otaPct: rand() * 20, payPct: rand() * 3, ownPct: rand() * 12, mailPct: rand() * 30,
      contractPct: rand() * 40, minRent: 0, cleanInBase: rand() > 0.5, otaBase: rand() > 0.5 ? 'gross' : 'net'};
    const m = monthly(inp);
    for (const id of SCENARIO_IDS) assert.ok(Math.abs(m.scenarios[id].identity) < 1e-6, `${id}: ${m.scenarios[id].identity}`);
  }
});

test('kwota dla właściciela rośnie liniowo z ceną doby (bez minimum czynszu)', () => {
  const inp = {...defaultsFor(13), minRent: 0};
  const a = monthly(inp), b = monthly({...inp, adr: inp.adr * 2});
  for (const id of SCENARIO_IDS) assert.ok(Math.abs(b.scenarios[id].owner - 2 * a.scenarios[id].owner) < 1e-6);
});

test('miesięczny model zgadza się z sumą pojedynczych rezerwacji (jedna doba, tylko portal zewnętrzny)', () => {
  const inp = {...defaultsFor(13), ...mailExample(), direct: 0, stay: 1, adr: 300, minRent: 0};
  const m = monthly(inp), r = reservation(inp, 300).channels.ota;
  for (const id of SCENARIO_IDS) {
    assert.ok(Math.abs(m.scenarios[id].owner - m.nights * r.scen[id].owner) < m.nights * 0.015, id);
  }
});

test('minimum czynszu: bez rezerwacji właściciel dostaje 1 zł wg umowy, 0 zł wg maila', () => {
  const m = monthly({...defaultsFor(13), occ: 0});
  assert.equal(m.scenarios.c1.owner, 1);
  assert.equal(m.scenarios.c2.owner, 1);
  assert.equal(m.scenarios.mail.owner, 0);
  assert.equal(m.scenarios.c1.floored, true);
  assert.equal(monthly(defaultsFor(13)).scenarios.c2.floored, false);
});

test('VAT od czynszu: tylko informacyjnie, kwota właściciela bez zmian', () => {
  const off = monthly(defaultsFor(13)).scenarios.c2;
  const on = monthly({...defaultsFor(13), vatPayer: true}).scenarios.c2;
  assert.equal(off.rentVat, 0);
  assert.ok(Math.abs(on.rentVat - on.owner * 0.08) < 1e-9);
  assert.equal(on.owner, off.owner);
  assert.ok(Math.abs(on.rentGross - on.owner * 1.08) < 1e-9);
});

test('opłata za sprzątanie wchodzi do podstawy tylko na życzenie', () => {
  const inp = defaultsFor(13);
  const a = monthly(inp), b = monthly({...inp, cleanInBase: true});
  assert.ok(Math.abs(b.scenarios.c1.base - a.scenarios.c1.base - a.cleanGross) < 1e-9);
  assert.ok(Math.abs(b.scenarios.c2.base - a.scenarios.c2.base - a.cleanNet) < 1e-9);
  assert.ok(Math.abs(b.scenarios.mail.base - a.scenarios.mail.base - a.cleanNet) < 1e-9);
});

test('kolejność dla danych domyślnych: mail, potem umowa brutto, potem umowa netto', () => {
  const s = monthly(defaultsFor(13)).scenarios;
  assert.ok(s.mail.owner > s.c1.owner && s.c1.owner > s.c2.owner);
});

test('podatek od nieruchomości: stawka mieszkalna i dla działalności', () => {
  const inp = defaultsFor(13);
  const rate = key => costs(inp).items.find(i => i.id === key).amount;
  assert.equal(rate('proptax'), 48 * 1.25 / 12);
  const biz = costs({...inp, taxBizOn: true});
  assert.equal(biz.items.find(i => i.id === 'proptax').amount, 48 * 35 / 12);
  assert.equal(biz.propTaxExtra, 48 * (35 - 1.25) / 12);
});

test('uruchomienie: arkusz 4030 zł dla 4 osób i 2 łóżek, zakupy z opłatą 20%', () => {
  const st13 = startup(defaultsFor(13));
  assert.equal(st13.sheetTotal, 4030);
  assert.equal(st13.purchases, 2000);
  assert.equal(st13.purchaseFee, 400);
  assert.equal(st13.total, 6430);
  assert.ok(Math.abs(st13.perMonth - 6430 / 24) < 1e-9);
  assert.equal(startup(defaultsFor(42)).sheetTotal, 5650);
  assert.equal(startup(defaultsFor(42)).total, 9250);
  assert.equal(startup({...defaultsFor(13), startDiscount: 20}).total, 6430 - 806);
});

test('ilości z arkusza zgadzają się z liczbą osób i łóżek w lokalach', () => {
  for (const [lokal, persons, beds] of [[13, 4, 2], [42, 6, 3]]) {
    const d = defaultsFor(lokal), q = quantitiesFor(persons, beds);
    assert.equal(d.persons, persons);
    assert.equal(d.beds, beds);
    for (const key of Object.keys(q)) assert.equal(d[key], q[key], `${lokal} ${key}`);
  }
});

test('wynik właściciela: koszty, uruchomienie i ryczałt', () => {
  const inp = defaultsFor(13), m = monthly(inp), r = result(inp, 'c2', m);
  assert.equal(r.owner, m.scenarios.c2.owner);
  assert.ok(Math.abs(r.preTax - (r.owner - costs(inp).total - startup(inp).perMonth)) < 1e-9);
  assert.ok(Math.abs(r.tax - 0.085 * r.owner) < 1e-9);
  assert.ok(Math.abs(r.afterTax - (r.preTax - r.tax)) < 1e-9);
  assert.ok(Math.abs(result({...inp, taxBase: 'nights'}, 'c2', m).tax - 0.085 * m.net) < 1e-9);
  assert.equal(result({...inp, taxOn: false}, 'c2', m).tax, 0);
  assert.ok(Math.abs(r.longNet - (2300 - 60 - 0.085 * 2300)) < 1e-9);
});

test('obłożenie progowe: wynik przed podatkiem wynosi tam zero', () => {
  const inp = defaultsFor(13);
  for (const id of SCENARIO_IDS) {
    const occ = breakEvenOccupancy(inp, id);
    assert.ok(occ > 0 && occ < 100, `${id}: ${occ}`);
    assert.ok(Math.abs(result({...inp, occ}, id).preTax) < 0.01);
  }
  assert.equal(breakEvenOccupancy({...inp, admin: 1e6}, 'c2'), null);
  assert.equal(breakEvenOccupancy({...inp, admin: 0, utilities: 0, net: 0, waste: 0, insurance: 0, repairs: 0, supplies: 0, kitchen: 0, startDiscount: 100, pClean: 0, pBed: 0, pSheet: 0, pTowel: 0, pDuvet: 0, pFoot: 0, pKey: 0, taxResid: 0}, 'c2'), 0);
});

test('walidacja danych', () => {
  assert.deepEqual(validate(defaultsFor(13)), []);
  assert.deepEqual(validate(defaultsFor(42)), []);
  assert.equal(validate({...defaultsFor(13), occ: 120})[0].key, 'occ');
  assert.equal(validate({...defaultsFor(13), occ: NaN})[0].key, 'occ');
  assert.equal(validate({...defaultsFor(13), otaBase: 'x'})[0].key, 'otaBase');
  assert.equal(validate({...defaultsFor(13), vatPayer: 'tak'})[0].key, 'vatPayer');
  assert.equal(validate({...defaultsFor(13), amort: 0})[0].key, 'amort');
  assert.equal(validate({...defaultsFor(13), persons: 2.5})[0].key, 'persons');
});

test('lista niejasności ma skończone wartości i właściwe znaki', () => {
  for (const id of SCENARIO_IDS) {
    const list = unclear(defaultsFor(42), id);
    assert.equal(list.length, 13);
    for (const u of list) assert.ok(Number.isFinite(u.value), `${id} ${u.id}`);
  }
  const u = Object.fromEntries(unclear(defaultsFor(13)).map(x => [x.id, x]));
  assert.ok(u.podstawa.value < 0, 'brutto daje więcej niż netto');
  assert.ok(u.stawka.value < 0, 'przykład z maila daje więcej niż umowa');
  assert.ok(u.promocja.value > 0, '20% daje więcej niż 25%');
  assert.ok(u.nieruchomosc.value < 0);
});

test('udział 20% w umowie z podstawą netto: 62,07 zł przez portal i 74,07 zł przy sprzedaży bezpośredniej', () => {
  const r = reservation({...base13(), contractPct: 20});
  assert.equal(r.channels.ota.scen.c2.owner, 62.07);
  assert.equal(r.channels.direct.scen.c2.owner, 74.07);
});

test('udział operatora liczony wprost zgadza się z resztą po VAT, portalach i właścicielu', () => {
  const rand = rng(3);
  for (let i = 0; i < 300; i++) {
    const inp = {...base13(), otaPct: rand() * 25, payPct: rand() * 3, ownPct: rand() * 12, mailPct: rand() * 30,
      contractPct: rand() * 40, vatNights: [0, 5, 8, 23][Math.floor(rand() * 4)], otaBase: rand() > 0.5 ? 'gross' : 'net'};
    const r = reservation(inp, Math.round(rand() * 100000) / 100);
    for (const ch of Object.values(r.channels)) for (const id of SCENARIO_IDS) {
      const s = ch.scen[id];
      assert.equal(s.operatorKeeps, r2(r.net - ch.feeOta - ch.feePay - s.owner), `${id} ${i}`);
    }
  }
  const direct = reservation({...base13(), ownPct: 3}).channels.direct.scen;
  assert.equal(direct.c1.operatorKeeps, r2(direct.c1.operatorFee + 3 - 7.41), 'przy podstawie brutto VAT wypada z puli operatora');
  assert.equal(direct.mail.operatorKeeps, r2(direct.mail.operatorFee + 3));
});

test('scenariusz z maila nie ma dolnej granicy: rezerwacja i miesiąc dają ten sam ujemny wynik', () => {
  const inp = {...base13(), otaPct: 100, payPct: 20, direct: 0, stay: 1, minRent: 0};
  const m = monthly(inp), r = reservation(inp, inp.adr).channels.ota.scen.mail;
  assert.ok(r.owner < 0 && m.scenarios.mail.owner < 0);
  assert.ok(Math.abs(m.scenarios.mail.owner - m.nights * r.owner) < m.nights * 0.015);
});

test('bez przychodu: minimum umowy płaci operator, udział w płatnościach gości nie dzieli przez zero', () => {
  const m = monthly({...defaultsFor(13), occ: 0});
  assert.equal(m.potGross, 0);
  assert.equal(m.scenarios.c1.operatorKeeps, -1);
  assert.equal(m.scenarios.c1.ownerShare, 0);
  assert.ok(SCENARIO_IDS.every(id => Number.isFinite(m.scenarios[id].operatorKeeps)));
});

test('udział w płatnościach gości liczony od całości wpłat, także z opłatą za sprzątanie w podstawie', () => {
  const m = monthly({...defaultsFor(13), cleanInBase: true});
  for (const id of SCENARIO_IDS) assert.ok(Math.abs(m.scenarios[id].ownerShare - m.scenarios[id].owner / m.potGross) < 1e-12);
  assert.ok(m.potGross > m.gross);
});

test('rabat na wdrożenie dotyczy pozycji arkusza, nie zakupów z opłatą operatora', () => {
  const st = startup({...defaultsFor(13), startDiscount: 20});
  assert.ok(Math.abs(st.discount - 806) < 1e-9);
  assert.ok(Math.abs(st.total - 5624) < 1e-9);
  assert.equal(st.totalBeforeDiscount, 6430);
});

test('niejasności: pozycje porównujące sposoby liczenia nie zależą od wybranego sposobu', () => {
  const pick = id => Object.fromEntries(unclear(defaultsFor(13), id).map(x => [x.id, x.value]));
  const a = pick('mail'), b = pick('c1'), c = pick('c2');
  for (const key of ['stawka', 'promocja', 'podstawa', 'procent']) {
    assert.equal(a[key], b[key], key);
    assert.equal(b[key], c[key], key);
  }
});

test('niejasności: pozycja 75 czy 70% kosztuje 5 punktów podstawy umowy z podstawą netto', () => {
  const inp = defaultsFor(13), m = monthly(inp);
  const u = Object.fromEntries(unclear(inp).map(x => [x.id, x]));
  assert.ok(Math.abs(u.procent.value + 0.05 * m.scenarios.c2.base) < 1e-9);
  assert.ok(Math.abs(u.promocja.value - 0.05 * m.scenarios.c2.base) < 1e-9);
  const word = Object.fromEntries(unclear({...inp, contractPct: 30}).map(x => [x.id, x]));
  assert.ok(word.procent.value > 0, 'po wpisaniu 30% skutek jest odwrotny');
});

test('niejasności: pozycje reagują na stan formularza', () => {
  const inp = defaultsFor(13);
  const pick = patch => Object.fromEntries(unclear({...inp, ...patch}).map(x => [x.id, x]));
  assert.equal(pick({}).minimum.title, 'Minimalny czynsz 1 zł');
  assert.equal(pick({minRent: 50}).minimum.title, 'Minimalny czynsz 50 zł');
  assert.equal(pick({minRent: 0.5}).minimum.title, 'Minimalny czynsz 0,5 zł');
  assert.ok(pick({}).model.value < 0 && pick({}).nieruchomosc.value < 0);
  const chosen = pick({taxBase: 'nights', taxBizOn: true});
  assert.ok(chosen.model.value > 0 && chosen.nieruchomosc.value > 0, 'po wybraniu odpowiedzi skutek jest odwrotny');
});
