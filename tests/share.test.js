import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultsFor} from '../fields.js';
import {encodeShare, decodeShare} from '../share.js';

const b64 = obj => '#dane=' + Buffer.from(JSON.stringify(obj)).toString('base64url');

test('udostępnianie: pełny obieg stanu', () => {
  for (const lokal of ['13', '42']) {
    const inp = {...defaultsFor(lokal), adr: 350.5, occ: 62, otaPct: 18, opShare: 25, resGross: 600, resClean: 220, resChannel: 'direct', startMonths: 12};
    const state = {lokal, period: 'year', inp};
    const hash = encodeShare(state);
    assert.ok(hash.startsWith('#dane='));
    assert.deepEqual(decodeShare(hash), state);
  }
});

test('udostępnianie: dane domyślne dają krótki link, a payload ma wersję 2', () => {
  const state = {lokal: '13', period: 'month', inp: defaultsFor(13)};
  const hash = encodeShare(state);
  assert.ok(hash.length < 80, hash);
  const payload = JSON.parse(Buffer.from(hash.slice(6), 'base64url').toString());
  assert.deepEqual(payload, {v: 2, l: '13', p: 'month', d: {}});
  assert.deepEqual(decodeShare(hash), state);
});

test('udostępnianie: zwykła kotwica nie jest importem', () => {
  assert.equal(decodeShare('#results'), null);
  assert.equal(decodeShare(''), null);
});

test('udostępnianie: stary link v1 daje czytelny komunikat o starszej wersji', () => {
  const old = b64({v: 1, l: '13', s: 'c2', p: 'month', d: {adr: 350}});
  assert.throws(() => decodeShare(old), /starszej wersji/);
});

test('udostępnianie: uszkodzone i nieprawidłowe dane są odrzucane', () => {
  const bad = [
    '#dane=', '#dane=!!!', '#dane=abc', '#dane=' + 'A'.repeat(13000),
    b64({v: 2, l: '99', p: 'month', d: {}}),
    b64({v: 2, l: '13', p: 'decade', d: {}}),
    b64({v: 2, l: '13', p: 'month', d: []}),
    b64({v: 2, l: '13', p: 'month'}),
    b64({v: 2, l: '13', p: 'month', d: {nieznane: 1}}),
    b64({v: 2, l: '13', p: 'month', d: {adr: '300'}}),
    b64({v: 2, l: '13', p: 'month', d: {adr: -5}}),
    b64({v: 2, l: '13', p: 'month', d: {occ: 150}}),
    b64({v: 2, l: '13', p: 'month', d: {resChannel: 5}}),
    b64({v: 2, l: '13', p: 'month', d: {resChannel: 'inny'}}),
    b64({v: 3, l: '13', p: 'month', d: {}}),
    '#dane=' + Buffer.from('{niepoprawny json').toString('base64url'),
  ];
  for (const hash of bad) assert.throws(() => decodeShare(hash), /link/i, hash.slice(0, 40));
  const proto = '#dane=' + Buffer.from('{"v":2,"l":"13","p":"month","d":{"__proto__":1}}').toString('base64url');
  assert.throws(() => decodeShare(proto), /link/i);
});
