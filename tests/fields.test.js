import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELDS, FIELD_BY_KEY, SOURCES, GROUPS, LOKALE, EXAMPLES, defaultsFor, changedRules} from '../fields.js';

test('klucze pól są unikalne, a źródła, grupy i rodzaje znane', () => {
  const keys = FIELDS.map(f => f.key);
  assert.equal(new Set(keys).size, keys.length);
  const groups = new Set(GROUPS.map(g => g.id));
  for (const f of FIELDS) {
    assert.ok(['zasada', 'zal'].includes(f.src) && SOURCES[f.src], f.key);
    assert.ok(groups.has(f.group), f.key);
    assert.ok(['money', 'percent', 'number', 'int', 'select'].includes(f.kind), f.key);
    assert.ok(f.label.length > 3, f.key);
  }
});

test('na wierzchu jest sześć pól o rezerwacjach, reszta w zwiniętych sekcjach', () => {
  assert.deepEqual(FIELDS.filter(f => f.group === 'rez').map(f => f.key), ['adr', 'occ', 'stay', 'direct', 'otaPct', 'cleanFee']);
  assert.deepEqual(FIELDS.filter(f => f.group === 'zasady').map(f => f.key), ['opShare', 'vat', 'otaCap', 'cleanLimit', 'minRent']);
  assert.deepEqual(FIELDS.filter(f => f.group === 'koszty').map(f => f.key),
    ['costAdmin', 'costOther', 'costRepairs', 'costTax', 'startCost', 'startMonths']);
  for (const g of GROUPS) if (g.id !== 'rez' && g.id !== 'res') assert.equal(g.open, false);
  for (const f of FIELDS.filter(x => x.group === 'zasady')) assert.equal(f.src, 'zasada');
});

test('wartości domyślne lokali 13 i 42', () => {
  const a = defaultsFor(13), b = defaultsFor(42);
  assert.deepEqual([a.adr, a.occ, a.stay, a.direct, a.otaPct, a.cleanFee], [300, 55, 2.5, 20, 15, 180]);
  assert.deepEqual([b.adr, b.costAdmin, b.costOther, b.costRepairs, b.costTax, b.startCost], [400, 620, 170, 130, 6, 9250]);
  assert.deepEqual([a.costAdmin, a.costOther, a.costRepairs, a.costTax, a.startCost, a.startMonths], [480, 145, 100, 5, 6430, 24]);
  assert.deepEqual([a.opShare, a.vat, a.otaCap, a.cleanLimit, a.minRent], [20, 8, 15, 180, 1]);
  assert.deepEqual([a.resGross, a.resClean, a.resChannel], [100, 0, 'ota']);
});

test('każdy lokal ma pełny komplet wartości domyślnych', () => {
  for (const lokal of Object.keys(LOKALE)) {
    const d = defaultsFor(lokal);
    assert.deepEqual(Object.keys(d).sort(), FIELDS.map(f => f.key).sort());
    for (const f of FIELDS) assert.notEqual(d[f.key], undefined, `${lokal} ${f.key}`);
  }
  assert.throws(() => defaultsFor(7));
});

test('przykłady rezerwacji używają istniejących pól i poprawnych wartości', () => {
  assert.equal(EXAMPLES.length, 3);
  for (const e of EXAMPLES) for (const [k, v] of Object.entries(e.values)) {
    assert.ok(FIELD_BY_KEY[k], k);
    assert.equal(typeof v, typeof defaultsFor(13)[k], k);
  }
});

test('opcje list wyboru są spójne z wartością domyślną', () => {
  for (const f of FIELDS.filter(x => x.kind === 'select')) assert.ok(f.options.some(([v]) => v === defaultsFor(13)[f.key]), f.key);
});

test('zmienione zasady rozliczenia: tylko pola „zasada” różniące się od wartości domyślnych lokalu', () => {
  for (const lokal of Object.keys(LOKALE)) assert.deepEqual(changedRules(defaultsFor(lokal), lokal), []);
  const inp = {...defaultsFor(13), adr: 999, occ: 10, opShare: 25, minRent: 5};
  assert.deepEqual(changedRules(inp, 13).map(f => f.key), ['opShare', 'minRent']);
  assert.deepEqual(changedRules({...defaultsFor(42), costAdmin: 1, startMonths: 6, resGross: 7}, 42), []);
});

test('VAT w zasadach nie przekracza 8 %, a średni pobyt wynosi co najmniej jedną noc', () => {
  assert.equal(FIELD_BY_KEY.vat.max, 8);
  assert.equal(FIELD_BY_KEY.stay.min, 1);
});
