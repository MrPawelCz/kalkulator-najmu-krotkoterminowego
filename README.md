# Kalkulator czynszu właściciela: najem krótkoterminowy przez operatora

**Aplikacja:** https://mrpawelcz.github.io/kalkulator-najmu-krotkoterminowego/

Kalkulator pokazuje, ile zostaje właścicielowi mieszkania, gdy lokal wynajmuje operator (najem i podnajem gościom). Zestawia trzy sposoby liczenia obok siebie, bo schemat z maila operatora i projekt umowy nie dają tego samego wyniku:

- schemat z maila operatora (podstawa netto, prowizja operatora liczona od podstawy),
- projekt umowy z podstawą brutto (czynsz jako udział w przychodzie brutto pomniejszonym o prowizje),
- projekt umowy z podstawą netto.

## Funkcje

- Dwa lokale z przykładowymi danymi (nr 13 i nr 42, bez adresu). Wszystkie pola można zmienić.
- Pojedyncza rezerwacja krok po kroku, z zaokrągleniem do grosza po każdym kroku. Odtwarza przykład z maila: 100 zł brutto daje 69,83 zł przy rezerwacji z portalu i 83,33 zł przy sprzedaży bezpośredniej.
- Podział przychodu na VAT od noclegu, portale, operatora i właściciela z kontrolą sumy.
- VAT od noclegu i od czynszu, prowizje portali, opłaty płatnicze, opłata własnego portalu operatora, opłata za sprzątanie, minimalny czynsz.
- Koszty właściciela, podatek od nieruchomości (stawka mieszkalna i dla działalności), uruchomienie lokalu (ilość razy cena), ryczałt, porównanie z najmem długoterminowym i obłożenie progowe.
- Lista niejasności z wpływem w złotych na kwotę dla właściciela.
- Udostępnianie linkiem (dane w części po `#`, bez serwera), zapis na urządzeniu, wydruk do PDF, widok mobilny.

## Skąd są dane

Każde pole ma znacznik: „z maila operatora”, „z projektu umowy”, „z arkusza uruchomienia” albo „założenie”. Założenia (ceny, obłożenie, koszty, stawki gminne) są przykładowe i nie są prognozą.

## Uruchomienie i testy

Statyczna strona bez zależności i bez budowania.

```
python3 -m http.server 8767
node --test tests/*.test.js
```

Testy wymagają Node 20 lub nowszego. Sprawdzają m.in. przykład z maila, sumę podziału przychodu do grosza, minimalny czynsz, uruchomienie i udostępnianie linkiem.

## Zastrzeżenie

Narzędzie pomocnicze, nie porada prawna ani podatkowa. VAT, podatek dochodowy i podatek od nieruchomości warto potwierdzić z doradcą.
