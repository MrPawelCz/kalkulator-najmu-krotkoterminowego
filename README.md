# Kalkulator czynszu właściciela: najem krótkoterminowy

Kalkulator pokazuje, ile wynosi Czynsz właściciela mieszkania, gdy lokal wynajmuje operator. Liczy jednym sposobem, według jednej zasady rozliczenia, i daje jeden wynik.

## Zasada liczenia

Dla każdej rezerwacji (kwoty w zł, zaokrąglenie matematyczne do 0,01 po każdym kroku):

1. **Przychód z noclegów** = kwota brutto zapłacona za pobyt (noclegi i opłaty dodatkowe, bez opłat miejscowych i innych danin, kaucji zwrotnych do chwili ich zatrzymania i odszkodowań przeznaczonych na naprawę szkód) + część opłaty za sprzątanie ponad limit (domyślnie 180 zł za pobyt). Opłata za sprzątanie do limitu nie wchodzi do przychodu.
2. **VAT** = przychód × stawka / (100 + stawka), domyślnie stawka 8% (w polu można wpisać najwyżej 8%).
3. **Prowizja portalu zewnętrznego** (tylko rezerwacje z portalu) = prowizja faktyczna, nie więcej niż limit (domyślnie 15% przychodu).
4. **Podstawa Czynszu** = przychód − VAT − prowizja portalu.
5. **Czynsz** = 80% podstawy, udział operatora = pozostałe 20%.

Nie odejmuje się opłat operatorów płatności, opłat portali zewnętrznych innych niż prowizja od rezerwacji, opłaty portalu własnego operatora ani kosztów własnych operatora. Czynsz miesięczny nie jest niższy niż 1 zł.

Nie uwzględniono m.in. zwrotów dla gości, kwot i kaucji zatrzymanych po anulowaniu rezerwacji, rekompensat od portali, łączenia kolejnych rezerwacji tego samego gościa ani zaliczania kwot do okresów rozliczeniowych. W razie rozbieżności rozstrzyga treść zasad rozliczenia.

Przykłady (zgodne co do grosza z testami):

| | Przychód | VAT | Prowizja | Podstawa | Czynsz | Operator |
|---|---|---|---|---|---|---|
| 1: portal, 100,00 zł | 100,00 | 7,41 | 15,00 | 77,59 | 62,07 | 15,52 |
| 2: bezpośrednia, 100,00 zł | 100,00 | 7,41 | 0,00 | 92,59 | 74,07 | 18,52 |
| 3: bezpośrednia, 600,00 zł + sprzątanie 220,00 zł | 640,00 | 47,41 | 0,00 | 592,59 | 474,07 | 118,52 |

## Funkcje

- Dwa lokale z przykładowymi danymi (nr 13 i nr 42, bez adresu), przełączane przyciskiem.
- Sześć pól na wierzchu: cena doby, obłożenie, średni pobyt, udział rezerwacji bezpośrednich, prowizja portalu i opłata za sprzątanie. Zasady rozliczenia oraz koszty właściciela są zwinięte.
- Jeden wynik: Czynsz miesięcznie lub rocznie, a pod nim wynik po kosztach i uruchomieniu.
- Rozbicie przychodu na VAT, prowizje portali, Czynsz i udział operatora oraz podział każdych 100 zł.
- Przykład pojedynczej rezerwacji krok po kroku, z trzema gotowymi przykładami.
- Udostępnianie linkiem (dane w części po `#`, bez serwera), wydruk do PDF, widok na telefon.

## Skąd są dane

Pola oznaczone jako „zasada rozliczenia” opisują sposób liczenia. Pozostałe wartości (ceny, obłożenie, koszty) to założenia przykładowe, nie prognoza.

## Uruchomienie i testy

Statyczna strona bez zależności i bez budowania.

```
python3 -m http.server 8767
node --test tests/*.test.js
```

Testy wymagają Node 20 lub nowszego. Sprawdzają przykłady 1 do 3, model miesięczny obu lokali, tożsamość podziału przychodu, minimalny Czynsz, limit prowizji, opłatę za sprzątanie, walidację i udostępnianie linkiem.

## Zastrzeżenie

Narzędzie pomocnicze, wynik orientacyjny; dane przykładowe to założenia.
