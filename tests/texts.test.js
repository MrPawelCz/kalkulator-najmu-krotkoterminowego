import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join, dirname} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILES = ['index.html', 'app.js', 'engine.js', 'fields.js', 'share.js', 'styles.css', 'README.md', 'package.json'];
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
const read = f => readFileSync(join(root, f), 'utf8');
const sources = () => FILES.map(f => [f, read(f)]);

test('teksty bez długich myślników (U+2014, U+2013); minus U+2212 jest dozwolony', () => {
  for (const [f, text] of sources()) assert.ok(!LONG_DASH.test(text), f);
  for (const f of readdirSync(join(root, 'tests'))) assert.ok(!LONG_DASH.test(read(`tests/${f}`)), f);
});

test('teksty bezosobowe, bez form „my”', () => {
  const we = /(?<![\p{L}\d_])(my|mamy|liczymy|przyjmujemy|widzimy|robimy|proponujemy|prosimy|zakładamy|nasz\p{L}*)(?![\p{L}\d_])/iu;
  for (const [f, text] of sources()) assert.ok(!we.test(text), `${f}: ${text.match(we)?.[0]}`);
});

test('brak danych kontaktowych, identyfikatorów, adresów zewnętrznych i ścieżek lokalnych', () => {
  const checks = {
    email: /[\w.+-]+@[\w-]+\.[\w.-]+/,
    telefon: /(?<![\d,.])(\+?48[\s-]?)?\d{3}[\s-]\d{3}[\s-]\d{3}(?![\d])/,
    identyfikator: /(?<!\d)\d{10}(?!\d)/,
    adresZewnetrzny: /https?:\/\/(?!127\.0\.0\.1|localhost)/,
    sciezkaLokalna: /\/Users\/|\/home\/|~\/|[A-Z]:\\/,
  };
  for (const [f, text] of sources()) for (const [name, re] of Object.entries(checks)) assert.ok(!re.test(text), `${f}: ${name}: ${text.match(re)?.[0]}`);
});

test('stopka i README zawierają zastrzeżenie o narzędziu pomocniczym', () => {
  const note = 'Narzędzie pomocnicze, wynik orientacyjny; dane przykładowe to założenia';
  assert.ok(read('index.html').includes(note));
  assert.ok(read('README.md').includes(note));
});

test('strona nie wczytuje zasobów z innych hostów i nie używa pamięci przeglądarki', () => {
  const html = read('index.html');
  assert.ok(!/(src|href)="(https?:)?\/\//.test(html));
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie|fetch\(|XMLHttpRequest|sendBeacon/.test(read('app.js') + read('share.js')));
});
