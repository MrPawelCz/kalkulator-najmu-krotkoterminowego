import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELDS, FIELD_BY_KEY, SOURCES, GROUPS, LOKALE, START_ITEMS, defaultsFor, mailExample} from '../fields.js';

test('klucze pól są unikalne, a źródła, grupy i rodzaje znane', () => {
  const keys = FIELDS.map(f => f.key);
  assert.equal(new Set(keys).size, keys.length);
  const groups = new Set(GROUPS.map(g => g.id));
  for (const f of FIELDS) {
    assert.ok(SOURCES[f.src], f.key);
    assert.ok(groups.has(f.group), f.key);
    assert.ok(['money', 'percent', 'number', 'int', 'check', 'select'].includes(f.kind), f.key);
    assert.ok(f.label.length > 3, f.key);
  }
});

test('każdy lokal ma pełny komplet wartości domyślnych', () => {
  for (const lokal of Object.keys(LOKALE)) {
    const d = defaultsFor(lokal);
    assert.deepEqual(Object.keys(d).sort(), FIELDS.map(f => f.key).sort());
    for (const f of FIELDS) assert.notEqual(d[f.key], undefined, `${lokal} ${f.key}`);
  }
  assert.throws(() => defaultsFor(7));
});

test('pozycje arkusza i opcje list wyboru są spójne', () => {
  for (const it of START_ITEMS) assert.ok(FIELD_BY_KEY[it.q] && FIELD_BY_KEY[it.p], it.label);
  for (const f of FIELDS.filter(x => x.kind === 'select')) assert.ok(f.options.some(([v]) => v === defaultsFor(13)[f.key]), f.key);
  for (const f of FIELDS.filter(x => x.chips)) for (const c of f.chips) assert.equal(typeof c, 'number');
});

test('przykład z maila używa tylko istniejących pól', () => {
  for (const key of Object.keys(mailExample())) assert.ok(FIELD_BY_KEY[key], key);
});
