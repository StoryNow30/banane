# Temps terrain — 670758b4-a7ae-441f-8693-89061653c315

Export banane-test-journal-v4 4.7.20, partie 12, état STOPPED ; 2026-09-26T06:13:48.300Z → 2026-09-26T06:28:31.557Z (lot exporté seul).
106 cuts distincts, 2619 événements. Durée 15 min, dont 0 min de silences (> 60 s) ; cadence 429 cuts/h hors silences.

| Mesure | n | médiane | p90 | max |
|---|---|---|---|---|
| Cycle par cut (hors silences) | 104 | 8,3 s | 9,8 s | 13,3 s |
| Analyse (capture reçue → proposition) | 106 | 372 ms | 593 ms | 2,4 s |
| Décision sur le lot (engineMs) | 106 | 1 ms | 215 ms | 1,6 s |
| Commande ESV « capture » | 106 | 5,7 s | 6,4 s | 10,1 s |
| Commande ESV « nextWithoutDecision » | 21 | 15 ms | 17 ms | 21 ms |
| Commande ESV « apply » | 84 | 677 ms | 686 ms | 697 ms |
| Commande ESV « validateAndNext » | 84 | 18 ms | 23 ms | 27 ms |
| Capture : points | 106 | 5188 | 6113 | 9135 |
| Capture : Mo | 106 | 0,90 | 1,10 | 1,18 |
| Capture : essais | 106 | 2 | 2 | 2 |
