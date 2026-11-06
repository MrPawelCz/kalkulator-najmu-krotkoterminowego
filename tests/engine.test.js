import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsFor, EXAMPLES} from '../fields.js';
import {r2, reservation, monthly, costs, afterCosts, split, effectiveOtaPct, validate} from '../engine.js';

const d13 = () => defaultsFor(13);
const d42 = () => defaultsFor(42);
const ex = id => ({...d13(), ...EXAMPLES.find(e => e.id === id).values});

function rng(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

test('zaokrąglanie matematyczne do 0,01', () => {
  assert.equal(r2(1.005), 1.01);
  assert.equal(r2(2.675), 2.68);
  assert.equal(r2(7.4074), 7.41);
  assert.equal(r2(-1.005), -1.01);
  assert.equal(r2(0), 0);
  assert.equal(Object.is(r2(-0.001), -0), false);
});

test('przykład 1: 100,00 zł przez portal', () => {
  const r = reservation(ex(1));
  assert.equal(r.revenue, 100);
  assert.equal(r.vat, 7.41);
  assert.equal(r.fee, 15);
  assert.equal(r.base, 77.59);
  assert.equal(r.rent, 62.07);
  assert.equal(r.operator, 15.52);
});

test('przykład 2: 100,00 zł rezerwacja bezpośrednia', () => {
  const r = reservation(ex(2));
  assert.equal(r.vat, 7.41);
  assert.equal(r.fee, 0);
  assert.equal(r.base, 92.59);
  assert.equal(r.rent, 74.07);
  assert.equal(r.operator, 18.52);
});

test('przykład 3: 600,00 zł za noclegi i 220,00 zł za sprzątanie, limit 180 zł', () => {
  const r = reservation(ex(3));
  assert.equal(r.cleanKept, 180);
  assert.equal(r.cleanExcess, 40);
  assert.equal(r.revenue, 640);
  assert.equal(r.vat, 47.41);
  assert.equal(r.fee, 0);
  assert.equal(r.base, 592.59);
  assert.equal(r.rent, 474.07);
  assert.equal(r.operator, 118.52);
});

test('rezerwacja: tożsamość przychód = VAT + prowizja + operator + Czynsz co do grosza', () => {
  const rand = rng(7);
  for (let i = 0; i < 500; i++) {
    const inp = {...d13(), otaPct: rand() * 25, otaCap: rand() * 25, opShare: rand() * 60, vat: [0, 5, 8, 23][Math.floor(rand() * 4)],
      cleanLimit: rand() * 300};
    const r = reservation(inp, {gross: Math.round(rand() * 100000) / 100, clean: Math.round(rand() * 50000) / 100,
      channel: rand() > 0.5 ? 'ota' : 'direct'});
    assert.ok(Math.abs(r.identity) <= 0.01, `identity ${r.identity}`);
  }
});

test('limit prowizji: otaPct 18 liczy jak 15, różnicę pokazuje feeOver', () => {
  const r = reservation({...ex(1), otaPct: 18});
  assert.equal(effectiveOtaPct({otaPct: 18, otaCap: 15}), 15);
  assert.equal(r.feeCharged, 18);
  assert.equal(r.fee, 15);
  assert.equal(r.feeOver, 3);
  assert.equal(r.base, 77.59);
  assert.equal(r.rent, 62.07);
  const m18 = monthly({...d13(), otaPct: 18});
  const m15 = monthly({...d13(), otaPct: 15});
  assert.equal(m18.rent, m15.rent);
  const m12 = monthly({...d13(), otaPct: 12});
  assert.ok(m12.rent > m15.rent);
});

test('opłata za sprzątanie do limitu nie wchodzi do przychodu, ponad limit tak', () => {
  const at = reservation({...ex(2), resClean: 180});
  assert.equal(at.revenue, 100);
  const below = reservation({...ex(2), resClean: 50});
  assert.equal(below.revenue, 100);
  const over = reservation({...ex(2), resClean: 230});
  assert.equal(over.revenue, 150);
  const lim = reservation({...ex(2), resClean: 100, cleanLimit: 60});
  assert.equal(lim.revenue, 140);
});

test('model miesięczny, lokal 13: wartości kontrolne', () => {
  const m = monthly(d13());
  assert.equal(r2(m.revenue), 5018.75);
  assert.equal(r2(m.vat), 371.76);
  assert.equal(r2(m.fees), 602.25);
  assert.equal(r2(m.base), 4044.74);
  assert.equal(r2(m.rent), 3235.79);
  assert.equal(r2(m.operator), 808.95);
  assert.equal(m.floored, false);
});

test('model miesięczny, lokal 42: wartości kontrolne', () => {
  const m = monthly(d42());
  assert.equal(r2(m.revenue), 6691.67);
  assert.equal(r2(m.vat), 495.68);
  assert.equal(r2(m.fees), 803);
  assert.equal(r2(m.base), 5392.99);
  assert.equal(r2(m.rent), 4314.39);
  assert.equal(r2(m.operator), 1078.6);
});

test('model miesięczny: tożsamość przychód = VAT + prowizje + operator + Czynsz na losowych danych', () => {
  const rand = rng(11);
  for (let i = 0; i < 500; i++) {
    const inp = {...d13(), adr: rand() * 1500, occ: rand() * 100, stay: 0.5 + rand() * 10, direct: rand() * 100,
      otaPct: rand() * 25, otaCap: rand() * 25, cleanFee: rand() * 400, cleanLimit: rand() * 300, opShare: rand() * 60,
      vat: [0, 5, 8, 23][Math.floor(rand() * 4)], minRent: rand() * 10};
    const m = monthly(inp);
    assert.ok(Math.abs(m.identity) < 1e-8, `identity ${m.identity}`);
    assert.ok(m.rent >= inp.minRent - 1e-9);
  }
});

test('model miesięczny: zgodny z rezerwacją (jedna rezerwacja portalowa, bez sprzątania ponad limit)', () => {
  const nights = 10;
  const inp = {...d13(), occ: nights / (365 / 12) * 100, direct: 0, adr: 100};
  const m = monthly(inp);
  const r = reservation(inp, {gross: 1000, clean: 0, channel: 'ota'});
  assert.ok(Math.abs(m.rent - r.rent) < 0.02, `${m.rent} vs ${r.rent}`);
  assert.ok(Math.abs(m.operator - r.operator) < 0.02);
});

test('rezerwacje bezpośrednie nie płacą prowizji portalu', () => {
  const all = monthly({...d13(), direct: 100});
  assert.equal(all.fees, 0);
  const none = monthly({...d13(), direct: 0});
  assert.ok(none.fees > 0);
  assert.ok(all.rent > none.rent);
});

test('opłata za sprzątanie ponad limit zwiększa przychód miesięczny o część ponad limit razy liczbę pobytów', () => {
  const base = monthly(d13());
  const over = monthly({...d13(), cleanFee: 230});
  assert.ok(Math.abs(over.cleanExcess - 50 * over.stays) < 1e-9);
  assert.ok(Math.abs(over.revenue - base.revenue - 50 * base.stays) < 1e-9);
  assert.equal(monthly({...d13(), cleanFee: 100}).revenue, base.revenue);
});

test('minimalny Czynsz miesięczny: bez rezerwacji 1 zł, operator dopłaca', () => {
  const m = monthly({...d13(), occ: 0});
  assert.equal(m.revenue, 0);
  assert.equal(m.rent, 1);
  assert.equal(m.floored, true);
  assert.equal(m.operator, -1);
  assert.equal(split(m), null);
  const m5 = monthly({...d13(), occ: 0, minRent: 5});
  assert.equal(m5.rent, 5);
  assert.equal(monthly(d13()).floored, false);
});

test('podział każdych 100 zł sumuje się do 100', () => {
  const s = split(monthly(d13()));
  assert.ok(Math.abs(s.vat + s.portal + s.operator + s.owner - 100) < 1e-9);
  assert.ok(Math.abs(s.vat - 8 / 108 * 100) < 1e-9);
  assert.ok(s.owner > s.operator && s.operator > 0);
});

test('koszty właściciela i uruchomienie: Czynsz po kosztach', () => {
  const c = costs(d13());
  assert.equal(c.running, 730);
  assert.ok(Math.abs(c.startPerMonth - 6430 / 24) < 1e-9);
  const a = afterCosts(d13());
  assert.ok(Math.abs(a.net - (monthly(d13()).rent - 730 - 6430 / 24)) < 1e-9);
  assert.equal(r2(afterCosts(d42()).net), 3002.97);
  const free = afterCosts({...d13(), costAdmin: 0, costOther: 0, costRepairs: 0, costTax: 0, startCost: 0});
  assert.equal(free.net, free.rent);
});

test('koszt uruchomienia w średniej z roku: rozłożenie krótsze niż 12 miesięcy liczy się raz', () => {
  for (const startMonths of [1, 6, 12, 24, 120]) {
    const inp = {...d13(), startMonths};
    const yearStart = costs(inp).startPerMonth * 12;
    assert.ok(Math.abs(yearStart - inp.startCost * Math.min(12, startMonths) / startMonths) < 1e-9, `startMonths ${startMonths}`);
    assert.ok(yearStart <= inp.startCost + 1e-9, `startMonths ${startMonths}: w roku nie więcej niż cały koszt`);
    const a = afterCosts(inp);
    assert.ok(Math.abs(12 * a.net - (12 * (a.rent - a.running) - yearStart)) < 1e-6);
  }
  assert.ok(Math.abs(costs({...d13(), startMonths: 6}).startPerMonth * 12 - 6430) < 1e-9);
});

test('walidacja: wartości domyślne i skrajne', () => {
  assert.deepEqual(validate(d13()), []);
  assert.deepEqual(validate(d42()), []);
  const bad = (patch, key) => assert.ok(validate({...d13(), ...patch}).some(e => e.key === key), `${key}: ${JSON.stringify(patch)}`);
  const good = patch => assert.deepEqual(validate({...d13(), ...patch}), [], JSON.stringify(patch));
  bad({adr: -1}, 'adr'); bad({adr: 10001}, 'adr'); good({adr: 10000});
  bad({occ: 101}, 'occ'); good({occ: 100});
  bad({stay: 0.9}, 'stay'); bad({stay: 366}, 'stay'); good({stay: 1});
  bad({direct: -1}, 'direct');
  bad({otaPct: 101}, 'otaPct');
  bad({cleanFee: 5001}, 'cleanFee');
  bad({opShare: 101}, 'opShare');
  bad({vat: 9}, 'vat'); good({vat: 8}); good({vat: 0});
  bad({otaCap: -1}, 'otaCap');
  bad({cleanLimit: 5001}, 'cleanLimit');
  bad({minRent: 1001}, 'minRent');
  bad({costAdmin: 100001}, 'costAdmin');
  bad({startMonths: 0}, 'startMonths'); bad({startMonths: 121}, 'startMonths'); bad({startMonths: 2.5}, 'startMonths'); good({startMonths: 120});
  bad({adr: NaN}, 'adr'); bad({occ: Infinity}, 'occ'); bad({adr: '300'}, 'adr');
  bad({resChannel: 'inny'}, 'resChannel');
});
