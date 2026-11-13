# Garde de non-régression GCV2

Base : commit `92fbdfb93062115d2ba62eb0d4d936831ca2ac09`, version 4.9.5.20. Code jugé : commit `null`.

**Retour 1** (recul de qualité).

Signalé, non bloquant :

- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (pose > 50 mm 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (mauvaise voie 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
- perte acceptée sans objet : 2-17 9521 (colonne avec passe) : le cut n'est pas perdu (posé à ≤ 10 mm, ou pas à ≤ 10 mm en base)
- perte acceptée sans objet : 2-17 9522 (colonne avec passe) : le cut n'est pas perdu (posé à ≤ 10 mm, ou pas à ≤ 10 mm en base)

Reculs de qualité (bloquants) :

- reglage-9, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 468 sur 510
- reglage-9, sansPasse : 27 cut(s) nouvellement à plus de 20 mm (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 153 34.66 mm, 2-18 206 410.2 mm, 2-18 467 30.8 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5141 24.28 mm)
- reglage-9, sansPasse : 3 cut(s) nouvellement à plus de 50 mm (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 206 410.2 mm)
- reglage-9, sansPasse : 3 cut(s) nouvellement en mauvaise voie (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 206 410.2 mm)
- reglage-9, sansPasse : 23 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5141 24.28 mm, 2-19 5155 23.08 mm, 2-19 5246 26.06 mm, 2-19 5285 24.72 mm)
- reglage-9, sansPasse : 44 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 7.69 mm, 2-7 5821 4.49 mm, 2-11 6456 16.7 mm, 2-11 6457 8.82 mm, 2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm)
- reglage-9, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 481 sur 518 ; hors de la liste des pertes acceptées : 2-17 9552, 2-17 9553, 2-17 9554, 2-17 9556, 2-17 9557, 2-17 9652, 2-17 9653, 2-18 204, 2-18 205, 2-18 292, 2-19 5034, 2-19 5040, 2-19 5141, 2-19 5155, 2-19 5246, 2-19 5279, 2-19 5285, 2-20-f228f6f9 371, 2-20-f228f6f9 392, 2-20-f228f6f9 400, 2-20-f228f6f9 410, 2-20-f228f6f9 414, 2-20-f228f6f9 418, 2-20-f228f6f9 426, 2-20-f228f6f9 437, 2-20-f228f6f9 440, 2-20-f228f6f9 441, 2-20-f228f6f9 444, 2-20-f228f6f9 447, 2-20-f228f6f9 449, 2-20-f228f6f9 458, 2-20-f228f6f9 467, 2-20-f228f6f9 468, 2-20-f228f6f9 470, 2-20-f228f6f9 480, 2-20-f228f6f9 488, 2-20-f228f6f9 493
- reglage-9, avecPasse : 28 cut(s) nouvellement à plus de 20 mm (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 153 34.66 mm, 2-18 205 337.43 mm, 2-18 206 410.2 mm, 2-18 467 30.8 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm)
- reglage-9, avecPasse : 4 cut(s) nouvellement à plus de 50 mm (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 205 337.43 mm, 2-18 206 410.2 mm)
- reglage-9, avecPasse : 4 cut(s) nouvellement en mauvaise voie (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 205 337.43 mm, 2-18 206 410.2 mm)
- reglage-9, avecPasse : 24 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 205 337.43 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5141 24.28 mm, 2-19 5155 23.08 mm, 2-19 5246 26.06 mm)
- reglage-9, avecPasse : 47 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 7.69 mm, 2-7 5821 4.49 mm, 2-11 6456 16.7 mm, 2-11 6457 8.82 mm, 2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm)
- reglage-9, GCV2 dans le lot : 28 cut(s) nouvellement à plus de 20 mm (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 153 34.66 mm, 2-18 205 337.43 mm, 2-18 206 410.2 mm, 2-18 467 30.8 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm)
- reglage-9, GCV2 dans le lot : 4 cut(s) nouvellement à plus de 50 mm (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 205 337.43 mm, 2-18 206 410.2 mm)
- reglage-9, GCV2 dans le lot : 4 cut(s) nouvellement en mauvaise voie (2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-18 205 337.43 mm, 2-18 206 410.2 mm)
- reglage-9, GCV2 dans le lot : 47 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 7.69 mm, 2-7 5821 4.49 mm, 2-11 6456 16.7 mm, 2-11 6457 8.82 mm, 2-17 9556 158.52 mm, 2-17 9557 201.85 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm)
- partie-3:0, sansPasse : 4 cut(s) nouvellement à plus de 20 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, sansPasse : 4 cut(s) nouvellement à plus de 50 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, sansPasse : 3 cut(s) nouvellement en mauvaise voie (3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 21 sur 23 ; hors de la liste des pertes acceptées : 3-0 598, 3-0 794
- partie-3:0, avecPasse : 4 cut(s) nouvellement à plus de 20 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, avecPasse : 4 cut(s) nouvellement à plus de 50 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, avecPasse : 3 cut(s) nouvellement en mauvaise voie (3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, avecPasse : 2 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm)
- partie-3:0, avecPasse : 3 cut(s) dégradé(s) de plus de 2 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm, 3-0 797 17.7 mm)
- partie-3:0, GCV2 dans le lot : 4 cut(s) nouvellement à plus de 20 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, GCV2 dans le lot : 4 cut(s) nouvellement à plus de 50 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, GCV2 dans le lot : 3 cut(s) nouvellement en mauvaise voie (3-0 794 156.09 mm, 3-0 869 217.07 mm, 3-0 870 257.96 mm)
- partie-3:0, GCV2 dans le lot : 3 cut(s) dégradé(s) de plus de 2 mm (3-0 598 70.69 mm, 3-0 794 156.09 mm, 3-0 797 17.7 mm)
- partie-3:0, GCV2 dans le lot : budget D-223 (pose > 50 mm ≤ 3 %) tenu en base, dépassé : 4/29 (13.8 %)
- partie-3:0, GCV2 dans le lot : budget D-223 (mauvaise voie ≤ 1 %) tenu en base, dépassé : 3/29 (10.3 %)
- terrain-partie-0-23-10, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 86 sur 92
- terrain-partie-0-23-10, sansPasse : 19 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 170 186.93 mm, 0-2310-lot1 1130 101.83 mm, 0-2310-lot1 1131 143.52 mm, 0-2310-lot1 1135 178.07 mm, 0-2310-lot1 1366 101.33 mm, 0-2310-lot2 750 87.45 mm, 0-2310-lot2 947 228.52 mm, 0-2310-lot2 948 198.48 mm)
- terrain-partie-0-23-10, sansPasse : 19 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 170 186.93 mm, 0-2310-lot1 1130 101.83 mm, 0-2310-lot1 1131 143.52 mm, 0-2310-lot1 1135 178.07 mm, 0-2310-lot1 1366 101.33 mm, 0-2310-lot2 750 87.45 mm, 0-2310-lot2 947 228.52 mm, 0-2310-lot2 948 198.48 mm)
- terrain-partie-0-23-10, sansPasse : 14 cut(s) nouvellement en mauvaise voie (0-2310-lot1 170 186.93 mm, 0-2310-lot1 1135 178.07 mm, 0-2310-lot2 947 228.52 mm, 0-2310-lot2 948 198.48 mm, 0-2310-lot2 949 177.38 mm, 0-2310-lot2 952 175.86 mm, 0-2310-lot2 954 209.17 mm, 0-2310-lot2 955 238.37 mm)
- terrain-partie-0-23-10, sansPasse : 1 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (0-2310-lot1 170 186.93 mm)
- terrain-partie-0-23-10, sansPasse : 6 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 7.77 mm, 0-2310-lot1 170 186.93 mm, 0-2310-lot1 193 19.23 mm, 0-2310-lot1 996 15.9 mm, 0-2310-lot1 1139 2.87 mm, 0-2310-lot1 1176 3.25 mm)
- terrain-partie-0-23-10, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 98 sur 106 ; hors de la liste des pertes acceptées : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 170, 0-2310-lot1 193, 0-2310-lot1 941, 0-2310-lot1 996, 0-2310-lot2 1168, 0-2310-lot2 1169
- terrain-partie-0-23-10, avecPasse : 20 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 170 186.93 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 1130 101.83 mm, 0-2310-lot1 1131 143.52 mm, 0-2310-lot1 1366 101.33 mm, 0-2310-lot2 750 87.45 mm, 0-2310-lot2 942 232.18 mm, 0-2310-lot2 944 217.15 mm)
- terrain-partie-0-23-10, avecPasse : 19 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 170 186.93 mm, 0-2310-lot1 1130 101.83 mm, 0-2310-lot1 1131 143.52 mm, 0-2310-lot1 1366 101.33 mm, 0-2310-lot2 750 87.45 mm, 0-2310-lot2 942 232.18 mm, 0-2310-lot2 944 217.15 mm, 0-2310-lot2 945 198.58 mm)
- terrain-partie-0-23-10, avecPasse : 14 cut(s) nouvellement en mauvaise voie (0-2310-lot1 170 186.93 mm, 0-2310-lot2 942 232.18 mm, 0-2310-lot2 944 217.15 mm, 0-2310-lot2 945 198.58 mm, 0-2310-lot2 947 228.52 mm, 0-2310-lot2 948 198.48 mm, 0-2310-lot2 949 177.38 mm, 0-2310-lot2 950 212.4 mm)
- terrain-partie-0-23-10, avecPasse : 3 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (0-2310-lot1 170 186.93 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot2 1169 226.51 mm)
- terrain-partie-0-23-10, avecPasse : 11 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 7.77 mm, 0-2310-lot1 170 186.93 mm, 0-2310-lot1 193 19.23 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 996 15.9 mm, 0-2310-lot1 1135 178.07 mm, 0-2310-lot1 1139 2.87 mm, 0-2310-lot1 1176 3.25 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 15 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 170 186.93 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 1130 101.83 mm, 0-2310-lot1 1131 143.52 mm, 0-2310-lot1 1366 101.33 mm, 0-2310-lot2 750 87.45 mm, 0-2310-lot2 947 228.52 mm, 0-2310-lot2 948 198.48 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 14 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 170 186.93 mm, 0-2310-lot1 1130 101.83 mm, 0-2310-lot1 1131 143.52 mm, 0-2310-lot1 1366 101.33 mm, 0-2310-lot2 750 87.45 mm, 0-2310-lot2 947 228.52 mm, 0-2310-lot2 948 198.48 mm, 0-2310-lot2 949 177.38 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 9 cut(s) nouvellement en mauvaise voie (0-2310-lot1 170 186.93 mm, 0-2310-lot2 947 228.52 mm, 0-2310-lot2 948 198.48 mm, 0-2310-lot2 949 177.38 mm, 0-2310-lot2 952 175.86 mm, 0-2310-lot2 954 209.17 mm, 0-2310-lot2 955 238.37 mm, 0-2310-lot2 1135 178.07 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 11 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 7.77 mm, 0-2310-lot1 170 186.93 mm, 0-2310-lot1 193 19.23 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 996 15.9 mm, 0-2310-lot1 1135 178.07 mm, 0-2310-lot1 1139 2.87 mm, 0-2310-lot1 1176 3.25 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 déjà dépassé en base, taux en hausse 4.8 % → 17.1 %
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 déjà dépassé en base, taux en hausse 4.8 % → 13.2 %

## reglage-9 (2-6, 2-7, 2-11, 2-13, 2-17, 2-18, 2-19, 2-20-fd7067f7, 2-20-f228f6f9)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 25 | 525 | 407 | 510 | 15 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| sans passe, actuel | 20 | 527 | 446 | 479 | 21 | 27 | 3 | 3 | 0 | 0 | 2,6 |
| avec passe, base | 12 | 534 | 412 | 518 | 16 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| avec passe, actuel | 7 | 539 | 453 | 489 | 22 | 28 | 4 | 4 | 0 | 0 | 2,6 |
| GCV2 dans le lot, base | — | 525 | 407 | 510 | 15 | 0 | 0 | 0 | — | — | 3,3 |
| GCV2 dans le lot, actuel | — | 527 | 446 | 479 | 21 | 27 | 3 | 3 | — | — | 2,6 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 3/527 (0,6 %, borne haute 1,7 %) tenu ; mauvaise voie 3/527 (0,6 %) tenu.

Par cut, sans passe : perdus 12, dégradés > 2 mm 44, gagnés > 2 mm 91, nouvellement posés 17 ; perdus : 2-7 5638, 2-17 9552, 2-17 9553, 2-17 9554, 2-18 195, 2-18 204, 2-18 205, 2-18 452, 2-20-f228f6f9 408, 2-20-f228f6f9 418, 2-20-f228f6f9 429, 2-20-f228f6f9 503 ; dégradés : 2-6 3399 (5,6 → 7,69), 2-7 5821 (1,47 → 4,49), 2-11 6456 (11,86 → 16,7), 2-11 6457 (6,69 → 8,82), 2-17 9556 (3,27 → 158,52), 2-17 9557 (4,23 → 201,85), 2-17 9652 (2,57 → 11,14), 2-17 9653 (3,31 → 10,57), 2-18 206 (10,19 → 410,2), 2-18 292 (5,93 → 13,46), 2-19 5034 (5,58 → 32,08), 2-19 5040 (6,28 → 34,95), 2-19 5113 (0,46 → 3,52), 2-19 5141 (0,49 → 24,28), 2-19 5155 (2,54 → 23,08), 2-19 5246 (3,07 → 26,06), 2-19 5279 (3,13 → 19,48), 2-19 5285 (4,02 → 24,72), 2-19 5289 (1 → 8,38), 2-20-fd7067f7 288 (0,7 → 5,18), 2-20-f228f6f9 354 (1,2 → 3,51), 2-20-f228f6f9 371 (2,81 → 13,04), 2-20-f228f6f9 381 (1,06 → 4,02), 2-20-f228f6f9 392 (3,56 → 18,48), 2-20-f228f6f9 400 (4,62 → 23,89), 2-20-f228f6f9 406 (6,06 → 9,74), 2-20-f228f6f9 410 (4,2 → 27,09), 2-20-f228f6f9 414 (2,28 → 18,98), 2-20-f228f6f9 426 (3,92 → 23,12), 2-20-f228f6f9 433 (10,9 → 22,74), 2-20-f228f6f9 437 (7,87 → 21,36), 2-20-f228f6f9 440 (7,16 → 23,59), 2-20-f228f6f9 441 (5,66 → 18,05), 2-20-f228f6f9 444 (4,75 → 21,4), 2-20-f228f6f9 447 (2,78 → 26,32), 2-20-f228f6f9 449 (4,63 → 23,89), 2-20-f228f6f9 450 (5,69 → 9,49), 2-20-f228f6f9 458 (4,92 → 23,78), 2-20-f228f6f9 467 (2,42 → 22,43), 2-20-f228f6f9 468 (6,99 → 23,02), 2-20-f228f6f9 470 (4,19 → 26,05), 2-20-f228f6f9 480 (5,06 → 30,66), 2-20-f228f6f9 488 (3,22 → 29,93), 2-20-f228f6f9 493 (3,49 → 35,65).
Par cut, avec passe : perdus 4, dégradés > 2 mm 47, gagnés > 2 mm 95, nouvellement posés 9 ; perdus : 2-17 9552, 2-17 9553, 2-17 9554, 2-18 204 ; dégradés : 2-6 3399 (5,6 → 7,69), 2-7 5821 (1,47 → 4,49), 2-11 6456 (11,86 → 16,7), 2-11 6457 (6,69 → 8,82), 2-17 9556 (3,27 → 158,52), 2-17 9557 (4,23 → 201,85), 2-17 9652 (2,57 → 11,14), 2-17 9653 (3,31 → 10,57), 2-18 205 (1,51 → 337,43), 2-18 206 (10,19 → 410,2), 2-18 292 (5,93 → 13,46), 2-18 467 (10,51 → 30,8), 2-19 5034 (5,58 → 32,08), 2-19 5040 (6,28 → 34,95), 2-19 5113 (0,46 → 3,52), 2-19 5141 (0,49 → 24,28), 2-19 5155 (2,54 → 23,08), 2-19 5246 (3,07 → 26,06), 2-19 5279 (3,13 → 19,48), 2-19 5285 (4,02 → 24,72), 2-19 5289 (1 → 8,38), 2-20-fd7067f7 288 (0,7 → 5,18), 2-20-f228f6f9 354 (1,2 → 3,51), 2-20-f228f6f9 371 (2,81 → 13,04), 2-20-f228f6f9 381 (1,06 → 4,02), 2-20-f228f6f9 392 (3,56 → 18,48), 2-20-f228f6f9 400 (4,62 → 23,89), 2-20-f228f6f9 406 (6,06 → 9,74), 2-20-f228f6f9 410 (4,2 → 27,09), 2-20-f228f6f9 414 (2,28 → 18,98), 2-20-f228f6f9 418 (5,07 → 16,72), 2-20-f228f6f9 426 (3,92 → 23,12), 2-20-f228f6f9 433 (10,9 → 22,74), 2-20-f228f6f9 437 (7,87 → 21,36), 2-20-f228f6f9 440 (7,16 → 23,59), 2-20-f228f6f9 441 (5,66 → 18,05), 2-20-f228f6f9 444 (4,75 → 21,4), 2-20-f228f6f9 447 (2,78 → 26,32), 2-20-f228f6f9 449 (4,63 → 23,89), 2-20-f228f6f9 450 (5,69 → 9,49), 2-20-f228f6f9 458 (4,92 → 23,78), 2-20-f228f6f9 467 (2,42 → 22,43), 2-20-f228f6f9 468 (6,99 → 23,02), 2-20-f228f6f9 470 (4,19 → 26,05), 2-20-f228f6f9 480 (5,06 → 30,66), 2-20-f228f6f9 488 (3,22 → 29,93), 2-20-f228f6f9 493 (3,49 → 35,65).

## partie-3:0 (3-0)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 14 | 23 | 10 | 18 | 5 | 0 | 0 | 0 | 0 | 0 | 5,5 |
| sans passe, actuel | 8 | 29 | 10 | 19 | 6 | 4 | 4 | 3 | 0 | 0 | 5,8 |
| avec passe, base | 8 | 29 | 14 | 23 | 6 | 0 | 0 | 0 | 0 | 0 | 5,1 |
| avec passe, actuel | 4 | 32 | 13 | 22 | 6 | 4 | 4 | 3 | 0 | 0 | 5,7 |
| GCV2 dans le lot, base | — | 23 | 10 | 18 | 5 | 0 | 0 | 0 | — | — | 5,5 |
| GCV2 dans le lot, actuel | — | 29 | 10 | 19 | 6 | 4 | 4 | 3 | — | — | 5,8 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 4/29 (13,8 %, borne haute 30,6 %) **DÉPASSÉ** ; mauvaise voie 3/29 (10,3 %) **DÉPASSÉ**.

Par cut, sans passe : perdus 1, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 7 ; perdus : 3-0 1461.
Par cut, avec passe : perdus 1, dégradés > 2 mm 3, gagnés > 2 mm 0, nouvellement posés 5 ; perdus : 3-0 1461 ; dégradés : 3-0 598 (7,93 → 70,69), 3-0 794 (3,18 → 156,09), 3-0 797 (10,27 → 17,7).

## terrain-partie-0-23-10 (0-2310-lot1, 0-2310-lot2)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 98 | 105 | 60 | 92 | 5 | 8 | 5 | 5 | 0 | 0 | 4,3 |
| sans passe, actuel | 73 | 129 | 61 | 98 | 8 | 23 | 22 | 17 | 0 | 0 | 5,1 |
| avec passe, base | 79 | 124 | 68 | 106 | 5 | 13 | 10 | 10 | 0 | 0 | 4,4 |
| avec passe, actuel | 45 | 156 | 72 | 116 | 11 | 29 | 27 | 22 | 0 | 0 | 5,4 |
| GCV2 dans le lot, base | — | 105 | 60 | 92 | 5 | 8 | 5 | 5 | — | — | 4,3 |
| GCV2 dans le lot, actuel | — | 129 | 61 | 98 | 8 | 23 | 22 | 17 | — | — | 5,1 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 22/129 (17,1 %, borne haute 24,5 %) **DÉPASSÉ** ; mauvaise voie 17/129 (13,2 %) **DÉPASSÉ**.

Par cut, sans passe : perdus 5, dégradés > 2 mm 6, gagnés > 2 mm 10, nouvellement posés 30 ; perdus : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 289, 0-2310-lot1 941, 0-2310-lot1 1134 ; dégradés : 0-2310-lot1 4 (0,97 → 7,77), 0-2310-lot1 170 (3,85 → 186,93), 0-2310-lot1 193 (0,53 → 19,23), 0-2310-lot1 996 (6,81 → 15,9), 0-2310-lot1 1139 (0,45 → 2,87), 0-2310-lot1 1176 (0,61 → 3,25).
Par cut, avec passe : perdus 4, dégradés > 2 mm 11, gagnés > 2 mm 14, nouvellement posés 38 ; perdus : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 289, 0-2310-lot2 1168 ; dégradés : 0-2310-lot1 4 (0,97 → 7,77), 0-2310-lot1 170 (3,85 → 186,93), 0-2310-lot1 193 (0,53 → 19,23), 0-2310-lot1 941 (0,8 → 29,81), 0-2310-lot1 996 (6,81 → 15,9), 0-2310-lot1 1135 (150,25 → 178,07), 0-2310-lot1 1139 (0,45 → 2,87), 0-2310-lot1 1176 (0,61 → 3,25), 0-2310-lot1 1350 (3,95 → 7,11), 0-2310-lot2 1169 (2,27 → 226,51), 0-2310-lot2 1328 (212,4 → 220,19).

## Vitesse (critère 6-i)

option --vitesse absente : vitesse non contrôlée

