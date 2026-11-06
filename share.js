import {FIELDS, FIELD_BY_KEY, LOKALE, defaultsFor} from './fields.js';
import {validate} from './engine.js';

// Format v2: stan w części URL po #, jako różnica względem wartości domyślnych lokalu.
const VERSION = 2;
const MAX_HASH_LENGTH = 12000;
const PERIODS = ['month', 'year'];
const ERROR_MESSAGE = 'Nieprawidłowy lub nieobsługiwany link. Sprawdź, czy został skopiowany w całości.';
const OLD_MESSAGE = 'Ten link pochodzi ze starszej wersji kalkulatora (inne zasady liczenia) i nie może zostać wczytany.';

class ShareError extends Error {}
const fail = (message = ERROR_MESSAGE) => { throw new ShareError(message); };

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodeShare(state) {
  const defs = defaultsFor(state.lokal);
  const d = {};
  for (const f of FIELDS) if (state.inp[f.key] !== defs[f.key]) d[f.key] = state.inp[f.key];
  const payload = {v: VERSION, l: String(state.lokal), p: state.period, d};
  const hash = '#dane=' + toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  if (hash.length > MAX_HASH_LENGTH) fail();
  return hash;
}

/** Zwykłe kotwice nie są importem (null). Uszkodzony lub stary import zgłasza błąd z czytelnym komunikatem. */
export function decodeShare(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#dane=')) return null;
  try {
    if (hash.length > MAX_HASH_LENGTH) fail();
    const encoded = hash.slice('#dane='.length);
    if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) fail();
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(encoded.length / 4) * 4, '='));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    if (toBase64Url(bytes) !== encoded) fail();
    const payload = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    if (payload === null || typeof payload !== 'object') fail();
    if (payload.v === 1) fail(OLD_MESSAGE);
    if (payload.v !== VERSION) fail();
    if (!LOKALE[payload.l] || !PERIODS.includes(payload.p)) fail();
    if (payload.d === null || typeof payload.d !== 'object' || Array.isArray(payload.d)) fail();
    const inp = defaultsFor(payload.l);
    for (const [key, value] of Object.entries(payload.d)) {
      if (!Object.hasOwn(FIELD_BY_KEY, key)) fail();
      const f = FIELD_BY_KEY[key];
      if (f.kind === 'select' ? typeof value !== 'string' : (typeof value !== 'number' || !Number.isFinite(value))) fail();
      inp[key] = value;
    }
    if (validate(inp).length) fail();
    return {lokal: payload.l, period: payload.p, inp};
  } catch (err) {
    throw err instanceof ShareError ? err : new ShareError(ERROR_MESSAGE);
  }
}
