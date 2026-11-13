# Garde de non-régression GCV2

Base : commit `92fbdfb93062115d2ba62eb0d4d936831ca2ac09`, version 4.9.5.20. Code jugé : commit `null`.

**Retour 1** (recul de qualité).

Pertes acceptées (colonne « avec passe » seulement, liste du manifeste, D-252) : ces cuts étaient à ≤ 10 mm en base et sont sans pose ; ils ne bloquent pas, ils sont montrés à chaque passage.

- reglage-9 : 2-17 9521 (2,74 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264
- reglage-9 : 2-17 9522 (2,57 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264

Signalé, non bloquant :

- terrain-partie-0-23-10, avecPasse : cuts laissés sans pose 79 → 88
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (pose > 50 mm 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (mauvaise voie 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse

Reculs de qualité (bloquants) :

- reglage-9, sansPasse : cuts laissés sans pose 25 → 36
- reglage-9, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 469 sur 510
- reglage-9, sansPasse : 23 cut(s) nouvellement à plus de 20 mm (2-18 153 34.66 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5141 24.28 mm, 2-19 5155 23.08 mm, 2-19 5246 26.06 mm, 2-19 5285 24.72 mm, 2-20-f228f6f9 400 23.89 mm)
- reglage-9, sansPasse : 21 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5141 24.28 mm, 2-19 5155 23.08 mm, 2-19 5246 26.06 mm, 2-19 5285 24.72 mm, 2-20-f228f6f9 400 23.89 mm, 2-20-f228f6f9 410 27.09 mm)
- reglage-9, sansPasse : 39 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 7.69 mm, 2-7 5821 4.49 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm, 2-18 292 13.46 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5113 3.52 mm)
- reglage-9, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 483 sur 518 ; hors de la liste des pertes acceptées : 2-17 9553, 2-17 9652, 2-17 9653, 2-18 204, 2-18 205, 2-18 292, 2-19 5034, 2-19 5040, 2-19 5141, 2-19 5155, 2-19 5246, 2-19 5279, 2-19 5285, 2-20-f228f6f9 371, 2-20-f228f6f9 392, 2-20-f228f6f9 400, 2-20-f228f6f9 410, 2-20-f228f6f9 414, 2-20-f228f6f9 418, 2-20-f228f6f9 426, 2-20-f228f6f9 437, 2-20-f228f6f9 440, 2-20-f228f6f9 441, 2-20-f228f6f9 444, 2-20-f228f6f9 447, 2-20-f228f6f9 449, 2-20-f228f6f9 458, 2-20-f228f6f9 467, 2-20-f228f6f9 468, 2-20-f228f6f9 470, 2-20-f228f6f9 480, 2-20-f228f6f9 488, 2-20-f228f6f9 493
- reglage-9, avecPasse : 24 cut(s) nouvellement à plus de 20 mm (2-18 153 34.66 mm, 2-18 467 30.76 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5141 24.28 mm, 2-19 5155 23.08 mm, 2-19 5246 26.06 mm, 2-19 5285 24.72 mm)
- reglage-9, avecPasse : 21 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5141 24.28 mm, 2-19 5155 23.08 mm, 2-19 5246 26.06 mm, 2-19 5285 24.72 mm, 2-20-f228f6f9 400 23.89 mm, 2-20-f228f6f9 410 27.09 mm)
- reglage-9, avecPasse : 41 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 7.69 mm, 2-7 5821 4.49 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm, 2-18 292 13.46 mm, 2-18 467 30.76 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm)
- reglage-9, GCV2 dans le lot : 23 cut(s) nouvellement à plus de 20 mm (2-18 153 34.66 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5141 24.28 mm, 2-19 5155 23.08 mm, 2-19 5246 26.06 mm, 2-19 5285 24.72 mm, 2-20-f228f6f9 400 23.89 mm)
- reglage-9, GCV2 dans le lot : 40 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 7.69 mm, 2-7 5821 4.49 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm, 2-18 292 13.46 mm, 2-19 5034 32.08 mm, 2-19 5040 34.95 mm, 2-19 5113 3.52 mm)
- partie-3:0, avecPasse : 1 cut(s) dégradé(s) de plus de 2 mm (3-0 797 17.7 mm)
- partie-3:0, GCV2 dans le lot : 1 cut(s) dégradé(s) de plus de 2 mm (3-0 797 17.7 mm)
- terrain-partie-0-23-10, sansPasse : cuts laissés sans pose 98 → 101
- terrain-partie-0-23-10, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 82 sur 92
- terrain-partie-0-23-10, sansPasse : 6 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 1135 178.07 mm, 0-2310-lot2 1328 213.55 mm, 0-2310-lot2 1329 175.06 mm, 0-2310-lot2 1331 150.83 mm, 0-2310-lot2 1332 143.24 mm, 0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, sansPasse : 6 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 1135 178.07 mm, 0-2310-lot2 1328 213.55 mm, 0-2310-lot2 1329 175.06 mm, 0-2310-lot2 1331 150.83 mm, 0-2310-lot2 1332 143.24 mm, 0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, sansPasse : 5 cut(s) nouvellement en mauvaise voie (0-2310-lot1 1135 178.07 mm, 0-2310-lot2 1328 213.55 mm, 0-2310-lot2 1329 175.06 mm, 0-2310-lot2 1332 143.24 mm, 0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, sansPasse : 3 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 7.77 mm, 0-2310-lot1 193 19.23 mm, 0-2310-lot1 1176 3.25 mm)
- terrain-partie-0-23-10, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 89 sur 106 ; hors de la liste des pertes acceptées : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 193, 0-2310-lot1 941, 0-2310-lot1 1137, 0-2310-lot1 1138, 0-2310-lot1 1139, 0-2310-lot2 1119, 0-2310-lot2 1122, 0-2310-lot2 1166, 0-2310-lot2 1167, 0-2310-lot2 1168, 0-2310-lot2 1169, 0-2310-lot2 1171, 0-2310-lot2 1172, 0-2310-lot2 1173, 0-2310-lot2 1174
- terrain-partie-0-23-10, avecPasse : 3 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 941 29.81 mm, 0-2310-lot1 1366 101.33 mm, 0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, avecPasse : 2 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 1366 101.33 mm, 0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, avecPasse : 1 cut(s) nouvellement en mauvaise voie (0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, avecPasse : 1 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (0-2310-lot1 941 29.81 mm)
- terrain-partie-0-23-10, avecPasse : 6 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 7.77 mm, 0-2310-lot1 193 19.23 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 1135 178.07 mm, 0-2310-lot1 1176 3.25 mm, 0-2310-lot1 1350 6 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 2 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 941 29.81 mm, 0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 1 cut(s) nouvellement à plus de 50 mm (0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 1 cut(s) nouvellement en mauvaise voie (0-2310-lot2 1334 195.67 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 5 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 7.77 mm, 0-2310-lot1 193 19.23 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 1135 178.07 mm, 0-2310-lot1 1176 3.25 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 déjà dépassé en base, taux en hausse 4.8 % → 10.9 %
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 déjà dépassé en base, taux en hausse 4.8 % → 9.9 %

## reglage-9 (2-6, 2-7, 2-11, 2-13, 2-17, 2-18, 2-19, 2-20-fd7067f7, 2-20-f228f6f9)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 25 | 525 | 407 | 510 | 15 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| sans passe, actuel | 36 | 514 | 441 | 475 | 16 | 23 | 0 | 0 | 0 | 0 | 2,6 |
| avec passe, base | 12 | 534 | 412 | 518 | 16 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| avec passe, actuel | 12 | 534 | 451 | 491 | 19 | 24 | 0 | 0 | 0 | 0 | 2,7 |
| GCV2 dans le lot, base | — | 525 | 407 | 510 | 15 | 0 | 0 | 0 | — | — | 3,3 |
| GCV2 dans le lot, actuel | — | 514 | 441 | 475 | 16 | 23 | 0 | 0 | — | — | 2,6 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/514 (0 %, borne haute 0,7 %) tenu ; mauvaise voie 0/514 (0 %) tenu.

Par cut, sans passe : perdus 16, dégradés > 2 mm 39, gagnés > 2 mm 88, nouvellement posés 5 ; perdus : 2-6 4725, 2-7 5638, 2-11 6456, 2-11 6457, 2-17 9552, 2-17 9553, 2-17 9554, 2-18 195, 2-18 204, 2-18 205, 2-18 206, 2-18 452, 2-20-f228f6f9 408, 2-20-f228f6f9 418, 2-20-f228f6f9 429, 2-20-f228f6f9 503 ; dégradés : 2-6 3399 (5,6 → 7,69), 2-7 5821 (1,47 → 4,49), 2-17 9652 (2,57 → 11,14), 2-17 9653 (3,31 → 10,57), 2-18 292 (5,93 → 13,46), 2-19 5034 (5,58 → 32,08), 2-19 5040 (6,28 → 34,95), 2-19 5113 (0,46 → 3,52), 2-19 5141 (0,49 → 24,28), 2-19 5155 (2,54 → 23,08), 2-19 5246 (3,07 → 26,06), 2-19 5279 (3,13 → 19,48), 2-19 5285 (4,02 → 24,72), 2-19 5289 (1 → 8,38), 2-20-fd7067f7 288 (0,7 → 5,18), 2-20-f228f6f9 354 (1,2 → 3,51), 2-20-f228f6f9 371 (2,81 → 13,04), 2-20-f228f6f9 381 (1,06 → 4,02), 2-20-f228f6f9 392 (3,56 → 18,48), 2-20-f228f6f9 400 (4,62 → 23,89), 2-20-f228f6f9 406 (6,06 → 9,74), 2-20-f228f6f9 410 (4,2 → 27,09), 2-20-f228f6f9 414 (2,28 → 18,98), 2-20-f228f6f9 426 (3,92 → 23,12), 2-20-f228f6f9 433 (10,9 → 22,74), 2-20-f228f6f9 437 (7,87 → 21,36), 2-20-f228f6f9 440 (7,16 → 23,59), 2-20-f228f6f9 441 (5,66 → 18,05), 2-20-f228f6f9 444 (4,75 → 21,4), 2-20-f228f6f9 447 (2,78 → 26,32), 2-20-f228f6f9 449 (4,63 → 23,89), 2-20-f228f6f9 450 (5,69 → 9,49), 2-20-f228f6f9 458 (4,92 → 23,78), 2-20-f228f6f9 467 (2,42 → 22,43), 2-20-f228f6f9 468 (6,99 → 23,02), 2-20-f228f6f9 470 (4,19 → 26,05), 2-20-f228f6f9 480 (5,06 → 30,66), 2-20-f228f6f9 488 (3,22 → 29,93), 2-20-f228f6f9 493 (3,49 → 35,65).
Par cut, avec passe : perdus 6, dégradés > 2 mm 41, gagnés > 2 mm 93, nouvellement posés 6 ; perdus : 2-17 9521, 2-17 9522, 2-17 9553, 2-18 204, 2-18 205, 2-18 206 ; dégradés : 2-6 3399 (5,6 → 7,69), 2-7 5821 (1,47 → 4,49), 2-17 9652 (2,57 → 11,14), 2-17 9653 (3,31 → 10,57), 2-18 292 (5,93 → 13,46), 2-18 467 (10,51 → 30,76), 2-19 5034 (5,58 → 32,08), 2-19 5040 (6,28 → 34,95), 2-19 5113 (0,46 → 3,52), 2-19 5141 (0,49 → 24,28), 2-19 5155 (2,54 → 23,08), 2-19 5246 (3,07 → 26,06), 2-19 5279 (3,13 → 19,48), 2-19 5285 (4,02 → 24,72), 2-19 5289 (1 → 8,38), 2-20-fd7067f7 288 (0,7 → 5,18), 2-20-f228f6f9 354 (1,2 → 3,51), 2-20-f228f6f9 371 (2,81 → 13,04), 2-20-f228f6f9 381 (1,06 → 4,02), 2-20-f228f6f9 392 (3,56 → 18,48), 2-20-f228f6f9 400 (4,62 → 23,89), 2-20-f228f6f9 406 (6,06 → 9,74), 2-20-f228f6f9 410 (4,2 → 27,09), 2-20-f228f6f9 414 (2,28 → 18,98), 2-20-f228f6f9 418 (5,07 → 16,72), 2-20-f228f6f9 426 (3,92 → 23,12), 2-20-f228f6f9 433 (10,9 → 22,74), 2-20-f228f6f9 437 (7,87 → 21,36), 2-20-f228f6f9 440 (7,16 → 23,59), 2-20-f228f6f9 441 (5,66 → 18,05), 2-20-f228f6f9 444 (4,75 → 21,4), 2-20-f228f6f9 447 (2,78 → 26,32), 2-20-f228f6f9 449 (4,63 → 23,89), 2-20-f228f6f9 450 (5,69 → 9,49), 2-20-f228f6f9 458 (4,92 → 23,78), 2-20-f228f6f9 467 (2,42 → 22,43), 2-20-f228f6f9 468 (6,99 → 23,02), 2-20-f228f6f9 470 (4,19 → 26,05), 2-20-f228f6f9 480 (5,06 → 30,66), 2-20-f228f6f9 488 (3,22 → 29,93), 2-20-f228f6f9 493 (3,49 → 35,65).

## partie-3:0 (3-0)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 14 | 23 | 10 | 18 | 5 | 0 | 0 | 0 | 0 | 0 | 5,5 |
| sans passe, actuel | 14 | 24 | 10 | 18 | 6 | 0 | 0 | 0 | 0 | 0 | 5,7 |
| avec passe, base | 8 | 29 | 14 | 23 | 6 | 0 | 0 | 0 | 0 | 0 | 5,1 |
| avec passe, actuel | 8 | 29 | 14 | 23 | 6 | 0 | 0 | 0 | 0 | 0 | 5,1 |
| GCV2 dans le lot, base | — | 23 | 10 | 18 | 5 | 0 | 0 | 0 | — | — | 5,5 |
| GCV2 dans le lot, actuel | — | 24 | 10 | 18 | 6 | 0 | 0 | 0 | — | — | 5,7 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/24 (0 %, borne haute 13,8 %) tenu ; mauvaise voie 0/24 (0 %) tenu.

Par cut, sans passe : perdus 1, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 1 ; perdus : 3-0 1461.
Par cut, avec passe : perdus 1, dégradés > 2 mm 1, gagnés > 2 mm 0, nouvellement posés 1 ; perdus : 3-0 1461 ; dégradés : 3-0 797 (10,27 → 17,7).

## terrain-partie-0-23-10 (0-2310-lot1, 0-2310-lot2)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 98 | 105 | 60 | 92 | 5 | 8 | 5 | 5 | 0 | 0 | 4,3 |
| sans passe, actuel | 101 | 101 | 55 | 84 | 5 | 12 | 11 | 10 | 0 | 0 | 4,4 |
| avec passe, base | 79 | 124 | 68 | 106 | 5 | 13 | 10 | 10 | 0 | 0 | 4,4 |
| avec passe, actuel | 88 | 113 | 60 | 93 | 6 | 14 | 12 | 10 | 0 | 0 | 4,5 |
| GCV2 dans le lot, base | — | 105 | 60 | 92 | 5 | 8 | 5 | 5 | — | — | 4,3 |
| GCV2 dans le lot, actuel | — | 101 | 55 | 84 | 5 | 12 | 11 | 10 | — | — | 4,4 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 11/101 (10,9 %, borne haute 18,5 %) **DÉPASSÉ** ; mauvaise voie 10/101 (9,9 %) **DÉPASSÉ**.

Par cut, sans passe : perdus 12, dégradés > 2 mm 3, gagnés > 2 mm 7, nouvellement posés 9 ; perdus : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 289, 0-2310-lot1 941, 0-2310-lot1 1138, 0-2310-lot1 1139, 0-2310-lot2 1123, 0-2310-lot2 1170, 0-2310-lot2 1171, 0-2310-lot2 1172, 0-2310-lot2 1173, 0-2310-lot2 1174 ; dégradés : 0-2310-lot1 4 (0,97 → 7,77), 0-2310-lot1 193 (0,53 → 19,23), 0-2310-lot1 1176 (0,61 → 3,25).
Par cut, avec passe : perdus 18, dégradés > 2 mm 6, gagnés > 2 mm 10, nouvellement posés 9 ; perdus : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 289, 0-2310-lot1 1137, 0-2310-lot1 1138, 0-2310-lot1 1139, 0-2310-lot2 1119, 0-2310-lot2 1122, 0-2310-lot2 1123, 0-2310-lot2 1166, 0-2310-lot2 1167, 0-2310-lot2 1168, 0-2310-lot2 1169, 0-2310-lot2 1170, 0-2310-lot2 1171, 0-2310-lot2 1172, 0-2310-lot2 1173, 0-2310-lot2 1174 ; dégradés : 0-2310-lot1 4 (0,97 → 7,77), 0-2310-lot1 193 (0,53 → 19,23), 0-2310-lot1 941 (0,8 → 29,81), 0-2310-lot1 1135 (150,25 → 178,07), 0-2310-lot1 1176 (0,61 → 3,25), 0-2310-lot1 1350 (3,95 → 6).

## Vitesse (critère 6-i)

option --vitesse absente : vitesse non contrôlée

