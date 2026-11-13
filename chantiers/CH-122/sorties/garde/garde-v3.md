# Garde de non-régression GCV2

Base : commit `92fbdfb93062115d2ba62eb0d4d936831ca2ac09`, version 4.9.5.20. Code jugé : commit `null`.

**Retour 1** (recul de qualité).

Pertes acceptées (colonne « avec passe » seulement, liste du manifeste, D-252) : ces cuts étaient à ≤ 10 mm en base et sont sans pose ; ils ne bloquent pas, ils sont montrés à chaque passage.

- reglage-9 : 2-17 9521 (2,74 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264
- reglage-9 : 2-17 9522 (2,57 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264

Signalé, non bloquant :

- reglage-9, avecPasse : cuts laissés sans pose 12 → 14
- terrain-partie-0-23-10, avecPasse : cuts laissés sans pose 79 → 89
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (pose > 50 mm 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (mauvaise voie 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse

Reculs de qualité (bloquants) :

- reglage-9, sansPasse : cuts laissés sans pose 25 → 29
- reglage-9, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 453 sur 510
- reglage-9, sansPasse : 29 cut(s) nouvellement à plus de 20 mm (2-19 5141 25.46 mm, 2-19 5289 21.98 mm, 2-19 5290 21 mm, 2-20-f228f6f9 382 22.44 mm, 2-20-f228f6f9 410 22.05 mm, 2-20-f228f6f9 440 23.59 mm, 2-20-f228f6f9 446 22.07 mm, 2-20-f228f6f9 447 26.32 mm)
- reglage-9, sansPasse : 29 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (2-19 5141 25.46 mm, 2-19 5289 21.98 mm, 2-19 5290 21 mm, 2-20-f228f6f9 382 22.44 mm, 2-20-f228f6f9 410 22.05 mm, 2-20-f228f6f9 440 23.59 mm, 2-20-f228f6f9 446 22.07 mm, 2-20-f228f6f9 447 26.32 mm)
- reglage-9, sansPasse : 74 cut(s) dégradé(s) de plus de 2 mm (2-7 5638 7.52 mm, 2-17 9551 9.84 mm, 2-17 9645 7.84 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm, 2-18 204 11.55 mm, 2-18 292 13.46 mm, 2-19 5113 3.52 mm)
- reglage-9, sansPasse : 249 vert(s) changé(s) (2-6 3397, 2-6 3398, 2-6 3719, 2-6 3720, 2-6 3723, 2-6 3724, 2-6 3725, 2-6 4650)
- reglage-9, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 459 sur 518 ; hors de la liste des pertes acceptées : 2-17 9652, 2-17 9653, 2-18 88, 2-18 204, 2-18 292, 2-19 5141, 2-19 5289, 2-19 5290, 2-20-f228f6f9 350, 2-20-f228f6f9 369, 2-20-f228f6f9 371, 2-20-f228f6f9 372, 2-20-f228f6f9 382, 2-20-f228f6f9 392, 2-20-f228f6f9 410, 2-20-f228f6f9 414, 2-20-f228f6f9 422, 2-20-f228f6f9 426, 2-20-f228f6f9 427, 2-20-f228f6f9 429, 2-20-f228f6f9 437, 2-20-f228f6f9 440, 2-20-f228f6f9 441, 2-20-f228f6f9 444, 2-20-f228f6f9 446, 2-20-f228f6f9 447, 2-20-f228f6f9 449, 2-20-f228f6f9 450, 2-20-f228f6f9 451, 2-20-f228f6f9 452, 2-20-f228f6f9 453, 2-20-f228f6f9 454, 2-20-f228f6f9 455, 2-20-f228f6f9 456, 2-20-f228f6f9 458, 2-20-f228f6f9 459, 2-20-f228f6f9 464, 2-20-f228f6f9 465, 2-20-f228f6f9 467, 2-20-f228f6f9 468, 2-20-f228f6f9 470, 2-20-f228f6f9 471, 2-20-f228f6f9 472, 2-20-f228f6f9 473, 2-20-f228f6f9 474, 2-20-f228f6f9 475, 2-20-f228f6f9 476, 2-20-f228f6f9 477, 2-20-f228f6f9 483, 2-20-f228f6f9 484, 2-20-f228f6f9 485, 2-20-f228f6f9 493, 2-20-f228f6f9 494, 2-20-f228f6f9 496, 2-20-f228f6f9 497, 2-20-f228f6f9 502, 2-20-f228f6f9 506
- reglage-9, avecPasse : 31 cut(s) nouvellement à plus de 20 mm (2-7 5901 38.36 mm, 2-18 88 31.72 mm, 2-19 5141 25.46 mm, 2-19 5289 21.98 mm, 2-19 5290 21 mm, 2-20-f228f6f9 382 22.44 mm, 2-20-f228f6f9 410 22.05 mm, 2-20-f228f6f9 440 23.59 mm)
- reglage-9, avecPasse : 30 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (2-18 88 31.72 mm, 2-19 5141 25.46 mm, 2-19 5289 21.98 mm, 2-19 5290 21 mm, 2-20-f228f6f9 382 22.44 mm, 2-20-f228f6f9 410 22.05 mm, 2-20-f228f6f9 440 23.59 mm, 2-20-f228f6f9 446 22.07 mm)
- reglage-9, avecPasse : 77 cut(s) dégradé(s) de plus de 2 mm (2-7 5638 7.52 mm, 2-17 9551 9.84 mm, 2-17 9645 7.84 mm, 2-17 9646 8.39 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm, 2-18 88 31.72 mm, 2-18 204 11.55 mm)
- reglage-9, avecPasse : 249 vert(s) changé(s) (2-6 3397, 2-6 3398, 2-6 3719, 2-6 3720, 2-6 3723, 2-6 3724, 2-6 3725, 2-6 4650)
- reglage-9, GCV2 dans le lot : 29 cut(s) nouvellement à plus de 20 mm (2-19 5141 25.46 mm, 2-19 5289 21.98 mm, 2-19 5290 21 mm, 2-20-f228f6f9 382 22.44 mm, 2-20-f228f6f9 410 22.05 mm, 2-20-f228f6f9 440 23.59 mm, 2-20-f228f6f9 446 22.07 mm, 2-20-f228f6f9 447 26.32 mm)
- reglage-9, GCV2 dans le lot : 74 cut(s) dégradé(s) de plus de 2 mm (2-7 5638 7.52 mm, 2-17 9551 9.84 mm, 2-17 9645 7.84 mm, 2-17 9652 11.14 mm, 2-17 9653 10.57 mm, 2-18 204 11.55 mm, 2-18 292 13.46 mm, 2-19 5113 3.52 mm)
- partie-3:0, sansPasse : 72 vert(s) changé(s) (3-0 334, 3-0 335, 3-0 339, 3-0 342, 3-0 344, 3-0 345, 3-0 348, 3-0 360)
- partie-3:0, avecPasse : 72 vert(s) changé(s) (3-0 334, 3-0 335, 3-0 339, 3-0 342, 3-0 344, 3-0 345, 3-0 348, 3-0 360)
- terrain-partie-0-23-10, sansPasse : cuts laissés sans pose 98 → 102
- terrain-partie-0-23-10, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 81 sur 92
- terrain-partie-0-23-10, sansPasse : 5 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 288 23.26 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 1135 178.76 mm, 0-2310-lot2 1328 222.82 mm, 0-2310-lot2 1332 189.91 mm)
- terrain-partie-0-23-10, sansPasse : 3 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 1135 178.76 mm, 0-2310-lot2 1328 222.82 mm, 0-2310-lot2 1332 189.91 mm)
- terrain-partie-0-23-10, sansPasse : 3 cut(s) nouvellement en mauvaise voie (0-2310-lot1 1135 178.76 mm, 0-2310-lot2 1328 222.82 mm, 0-2310-lot2 1332 189.91 mm)
- terrain-partie-0-23-10, sansPasse : 2 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (0-2310-lot1 288 23.26 mm, 0-2310-lot1 941 29.81 mm)
- terrain-partie-0-23-10, sansPasse : 6 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 193 13.11 mm, 0-2310-lot1 195 7.18 mm, 0-2310-lot1 288 23.26 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 957 8.16 mm, 0-2310-lot1 958 9.41 mm)
- terrain-partie-0-23-10, sansPasse : 89 vert(s) changé(s) (0-2310-lot1 28, 0-2310-lot1 38, 0-2310-lot1 39, 0-2310-lot1 61, 0-2310-lot1 66, 0-2310-lot1 68, 0-2310-lot1 69, 0-2310-lot1 70)
- terrain-partie-0-23-10, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 88 sur 106 ; hors de la liste des pertes acceptées : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 193, 0-2310-lot1 288, 0-2310-lot1 941, 0-2310-lot1 1137, 0-2310-lot1 1138, 0-2310-lot1 1139, 0-2310-lot2 1119, 0-2310-lot2 1122, 0-2310-lot2 1166, 0-2310-lot2 1167, 0-2310-lot2 1168, 0-2310-lot2 1169, 0-2310-lot2 1171, 0-2310-lot2 1172, 0-2310-lot2 1173, 0-2310-lot2 1174
- terrain-partie-0-23-10, avecPasse : 2 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 288 23.26 mm, 0-2310-lot1 941 29.81 mm)
- terrain-partie-0-23-10, avecPasse : 2 cut(s) de ≤ 10 mm passé(s) à plus de 20 mm (0-2310-lot1 288 23.26 mm, 0-2310-lot1 941 29.81 mm)
- terrain-partie-0-23-10, avecPasse : 8 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 193 13.11 mm, 0-2310-lot1 195 7.18 mm, 0-2310-lot1 288 23.26 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 957 8.16 mm, 0-2310-lot1 958 9.41 mm, 0-2310-lot1 1135 178.76 mm, 0-2310-lot2 1328 222.82 mm)
- terrain-partie-0-23-10, avecPasse : 89 vert(s) changé(s) (0-2310-lot1 28, 0-2310-lot1 38, 0-2310-lot1 39, 0-2310-lot1 61, 0-2310-lot1 66, 0-2310-lot1 68, 0-2310-lot1 69, 0-2310-lot1 70)
- terrain-partie-0-23-10, GCV2 dans le lot : 2 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 288 23.26 mm, 0-2310-lot1 941 29.81 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 8 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 193 13.11 mm, 0-2310-lot1 195 7.18 mm, 0-2310-lot1 288 23.26 mm, 0-2310-lot1 941 29.81 mm, 0-2310-lot1 957 8.16 mm, 0-2310-lot1 958 9.41 mm, 0-2310-lot1 1135 178.76 mm, 0-2310-lot2 1328 222.82 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 déjà dépassé en base, taux en hausse 4.8 % → 5.8 %
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 déjà dépassé en base, taux en hausse 4.8 % → 5.8 %

## reglage-9 (2-6, 2-7, 2-11, 2-13, 2-17, 2-18, 2-19, 2-20-fd7067f7, 2-20-f228f6f9)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 25 | 525 | 407 | 510 | 15 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| sans passe, actuel | 29 | 527 | 411 | 462 | 36 | 29 | 0 | 0 | 249 | 0 | 2,9 |
| avec passe, base | 12 | 534 | 412 | 518 | 16 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| avec passe, actuel | 14 | 538 | 414 | 469 | 38 | 31 | 0 | 0 | 249 | 0 | 2,9 |
| GCV2 dans le lot, base | — | 525 | 407 | 510 | 15 | 0 | 0 | 0 | — | — | 3,3 |
| GCV2 dans le lot, actuel | — | 510 | 396 | 446 | 35 | 29 | 0 | 0 | — | — | 2,9 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/510 (0 %, borne haute 0,7 %) tenu ; mauvaise voie 0/510 (0 %) tenu.

Par cut, sans passe : perdus 9, dégradés > 2 mm 74, gagnés > 2 mm 75, nouvellement posés 5 ; perdus : 2-7 3154, 2-7 3227, 2-7 3291, 2-7 3294, 2-11 6456, 2-17 9623, 2-17 9815, 2-18 195, 2-20-fd7067f7 110 ; dégradés : 2-7 5638 (3,45 → 7,52), 2-17 9551 (4,87 → 9,84), 2-17 9645 (5,75 → 7,84), 2-17 9652 (2,57 → 11,14), 2-17 9653 (3,31 → 10,57), 2-18 204 (2,03 → 11,55), 2-18 292 (5,93 → 13,46), 2-19 5113 (0,46 → 3,52), 2-19 5141 (0,49 → 25,46), 2-19 5149 (3,26 → 6,04), 2-19 5289 (1 → 21,98), 2-19 5290 (4,17 → 21), 2-20-fd7067f7 288 (0,7 → 4,89), 2-20-f228f6f9 327 (1,58 → 7,01), 2-20-f228f6f9 350 (0,47 → 14,41), 2-20-f228f6f9 354 (1,2 → 3,51), 2-20-f228f6f9 361 (5,13 → 7,39), 2-20-f228f6f9 364 (4,75 → 8,95), 2-20-f228f6f9 365 (2,2 → 6,33), 2-20-f228f6f9 366 (5,77 → 9,77), 2-20-f228f6f9 367 (5,24 → 7,38), 2-20-f228f6f9 369 (8,51 → 11,92), 2-20-f228f6f9 371 (2,81 → 13,04), 2-20-f228f6f9 372 (1,74 → 14,59), 2-20-f228f6f9 381 (1,06 → 4,02), 2-20-f228f6f9 382 (3,96 → 22,44), 2-20-f228f6f9 392 (3,56 → 15,82), 2-20-f228f6f9 401 (2,76 → 5,11), 2-20-f228f6f9 410 (4,2 → 22,05), 2-20-f228f6f9 414 (2,28 → 16,34), 2-20-f228f6f9 419 (4,29 → 7,3), 2-20-f228f6f9 422 (1,86 → 18,37), 2-20-f228f6f9 426 (3,92 → 10,58), 2-20-f228f6f9 427 (7,87 → 14,41), 2-20-f228f6f9 429 (8,69 → 11,24), 2-20-f228f6f9 437 (7,87 → 17,17), 2-20-f228f6f9 440 (7,16 → 23,59), 2-20-f228f6f9 441 (5,66 → 17,98), 2-20-f228f6f9 444 (4,75 → 19,26), 2-20-f228f6f9 446 (3,55 → 22,07), 2-20-f228f6f9 447 (2,78 → 26,32), 2-20-f228f6f9 449 (4,63 → 23,89), 2-20-f228f6f9 450 (5,69 → 20,27), 2-20-f228f6f9 451 (3,51 → 20,75), 2-20-f228f6f9 452 (2,59 → 22,8), 2-20-f228f6f9 453 (5,65 → 22,54), 2-20-f228f6f9 454 (3,94 → 19,09), 2-20-f228f6f9 455 (2,07 → 18,01), 2-20-f228f6f9 456 (4,36 → 19,43), 2-20-f228f6f9 458 (4,92 → 28,67), 2-20-f228f6f9 459 (3,97 → 19,14), 2-20-f228f6f9 464 (4,32 → 16,44), 2-20-f228f6f9 465 (8,09 → 18,98), 2-20-f228f6f9 467 (2,42 → 16,36), 2-20-f228f6f9 468 (6,99 → 23,02), 2-20-f228f6f9 470 (4,19 → 23,93), 2-20-f228f6f9 471 (1,52 → 23,28), 2-20-f228f6f9 472 (5,3 → 21,67), 2-20-f228f6f9 473 (3,08 → 12), 2-20-f228f6f9 474 (2,18 → 24,51), 2-20-f228f6f9 475 (1,53 → 25,22), 2-20-f228f6f9 476 (5,33 → 23,81), 2-20-f228f6f9 477 (4,95 → 29,27), 2-20-f228f6f9 483 (3,66 → 26,28), 2-20-f228f6f9 484 (7,38 → 30,61), 2-20-f228f6f9 485 (3,1 → 27,79), 2-20-f228f6f9 493 (3,49 → 27,34), 2-20-f228f6f9 494 (7,69 → 27,06), 2-20-f228f6f9 496 (2,02 → 24,37), 2-20-f228f6f9 497 (3,66 → 25,29), 2-20-f228f6f9 502 (3,33 → 17,87), 2-20-f228f6f9 506 (2,87 → 16,62), 2-20-f228f6f9 508 (6,07 → 9,27), 2-20-f228f6f9 682 (0,4 → 6,05).
Par cut, avec passe : perdus 8, dégradés > 2 mm 77, gagnés > 2 mm 76, nouvellement posés 6 ; perdus : 2-7 3154, 2-7 3227, 2-7 3291, 2-7 3294, 2-17 9521, 2-17 9522, 2-17 9623, 2-20-fd7067f7 110 ; dégradés : 2-7 5638 (3,45 → 7,52), 2-17 9551 (4,87 → 9,84), 2-17 9645 (5,75 → 7,84), 2-17 9646 (6,31 → 8,39), 2-17 9652 (2,57 → 11,14), 2-17 9653 (3,31 → 10,57), 2-18 88 (6,53 → 31,72), 2-18 204 (2,03 → 11,55), 2-18 292 (5,93 → 13,46), 2-18 467 (10,51 → 15,34), 2-19 5113 (0,46 → 3,52), 2-19 5141 (0,49 → 25,46), 2-19 5149 (3,26 → 6,04), 2-19 5289 (1 → 21,98), 2-19 5290 (4,17 → 21), 2-20-fd7067f7 288 (0,7 → 4,89), 2-20-f228f6f9 327 (1,58 → 7,01), 2-20-f228f6f9 350 (0,47 → 14,41), 2-20-f228f6f9 354 (1,2 → 3,51), 2-20-f228f6f9 361 (5,13 → 7,39), 2-20-f228f6f9 364 (4,75 → 8,95), 2-20-f228f6f9 365 (2,2 → 6,33), 2-20-f228f6f9 366 (5,77 → 9,77), 2-20-f228f6f9 367 (5,24 → 7,38), 2-20-f228f6f9 369 (8,51 → 11,92), 2-20-f228f6f9 371 (2,81 → 13,04), 2-20-f228f6f9 372 (1,74 → 14,59), 2-20-f228f6f9 381 (1,06 → 4,02), 2-20-f228f6f9 382 (3,96 → 22,44), 2-20-f228f6f9 392 (3,56 → 15,82), 2-20-f228f6f9 401 (2,76 → 5,11), 2-20-f228f6f9 410 (4,2 → 22,05), 2-20-f228f6f9 414 (2,28 → 16,34), 2-20-f228f6f9 419 (4,29 → 7,3), 2-20-f228f6f9 422 (1,86 → 18,37), 2-20-f228f6f9 426 (3,92 → 10,58), 2-20-f228f6f9 427 (7,87 → 14,41), 2-20-f228f6f9 429 (8,69 → 11,24), 2-20-f228f6f9 437 (7,87 → 17,17), 2-20-f228f6f9 440 (7,16 → 23,59), 2-20-f228f6f9 441 (5,66 → 17,98), 2-20-f228f6f9 444 (4,75 → 19,26), 2-20-f228f6f9 446 (3,55 → 22,07), 2-20-f228f6f9 447 (2,78 → 26,32), 2-20-f228f6f9 449 (4,63 → 23,89), 2-20-f228f6f9 450 (5,69 → 20,27), 2-20-f228f6f9 451 (3,51 → 20,75), 2-20-f228f6f9 452 (2,59 → 22,8), 2-20-f228f6f9 453 (5,65 → 22,54), 2-20-f228f6f9 454 (3,94 → 19,09), 2-20-f228f6f9 455 (2,07 → 18,01), 2-20-f228f6f9 456 (4,36 → 19,43), 2-20-f228f6f9 458 (4,92 → 28,67), 2-20-f228f6f9 459 (3,97 → 19,14), 2-20-f228f6f9 464 (4,32 → 16,44), 2-20-f228f6f9 465 (8,09 → 18,98), 2-20-f228f6f9 467 (2,42 → 16,36), 2-20-f228f6f9 468 (6,99 → 23,02), 2-20-f228f6f9 470 (4,19 → 23,93), 2-20-f228f6f9 471 (1,52 → 23,28), 2-20-f228f6f9 472 (5,3 → 21,67), 2-20-f228f6f9 473 (3,08 → 12), 2-20-f228f6f9 474 (2,18 → 24,51), 2-20-f228f6f9 475 (1,53 → 25,22), 2-20-f228f6f9 476 (5,33 → 23,81), 2-20-f228f6f9 477 (4,95 → 29,27), 2-20-f228f6f9 483 (3,66 → 26,28), 2-20-f228f6f9 484 (7,38 → 30,61), 2-20-f228f6f9 485 (3,1 → 27,79), 2-20-f228f6f9 493 (3,49 → 27,34), 2-20-f228f6f9 494 (7,69 → 27,06), 2-20-f228f6f9 496 (2,02 → 24,37), 2-20-f228f6f9 497 (3,66 → 25,29), 2-20-f228f6f9 502 (3,33 → 17,87), 2-20-f228f6f9 506 (2,87 → 16,62), 2-20-f228f6f9 508 (6,07 → 9,27), 2-20-f228f6f9 682 (0,4 → 6,05).

## partie-3:0 (3-0)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 14 | 23 | 10 | 18 | 5 | 0 | 0 | 0 | 0 | 0 | 5,5 |
| sans passe, actuel | 11 | 28 | 15 | 27 | 1 | 0 | 0 | 0 | 72 | 0 | 4,7 |
| avec passe, base | 8 | 29 | 14 | 23 | 6 | 0 | 0 | 0 | 0 | 0 | 5,1 |
| avec passe, actuel | 5 | 33 | 19 | 32 | 1 | 0 | 0 | 0 | 72 | 0 | 4,6 |
| GCV2 dans le lot, base | — | 23 | 10 | 18 | 5 | 0 | 0 | 0 | — | — | 5,5 |
| GCV2 dans le lot, actuel | — | 28 | 15 | 27 | 1 | 0 | 0 | 0 | — | — | 4,7 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/28 (0 %, borne haute 12,1 %) tenu ; mauvaise voie 0/28 (0 %) tenu.

Par cut, sans passe : perdus 4, dégradés > 2 mm 0, gagnés > 2 mm 2, nouvellement posés 7 ; perdus : 3-0 859, 3-0 953, 3-0 954, 3-0 1461.
Par cut, avec passe : perdus 4, dégradés > 2 mm 0, gagnés > 2 mm 3, nouvellement posés 7 ; perdus : 3-0 859, 3-0 953, 3-0 954, 3-0 1461.

## terrain-partie-0-23-10 (0-2310-lot1, 0-2310-lot2)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 98 | 105 | 60 | 92 | 5 | 8 | 5 | 5 | 0 | 0 | 4,3 |
| sans passe, actuel | 102 | 105 | 56 | 92 | 5 | 8 | 6 | 6 | 89 | 0 | 4,5 |
| avec passe, base | 79 | 124 | 68 | 106 | 5 | 13 | 10 | 10 | 0 | 0 | 4,4 |
| avec passe, actuel | 89 | 116 | 61 | 100 | 8 | 8 | 6 | 6 | 89 | 0 | 4,8 |
| GCV2 dans le lot, base | — | 105 | 60 | 92 | 5 | 8 | 5 | 5 | — | — | 4,3 |
| GCV2 dans le lot, actuel | — | 104 | 56 | 91 | 5 | 8 | 6 | 6 | — | — | 4,5 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 6/104 (5,8 %, borne haute 12 %) **DÉPASSÉ** ; mauvaise voie 6/104 (5,8 %) **DÉPASSÉ**.

Par cut, sans passe : perdus 17, dégradés > 2 mm 6, gagnés > 2 mm 8, nouvellement posés 13 ; perdus : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 289, 0-2310-lot1 926, 0-2310-lot1 972, 0-2310-lot1 1138, 0-2310-lot1 1139, 0-2310-lot1 1181, 0-2310-lot1 1326, 0-2310-lot1 1352, 0-2310-lot2 1123, 0-2310-lot2 1170, 0-2310-lot2 1171, 0-2310-lot2 1172, 0-2310-lot2 1173, 0-2310-lot2 1174, 0-2310-lot2 1333 ; dégradés : 0-2310-lot1 193 (0,53 → 13,11), 0-2310-lot1 195 (1,85 → 7,18), 0-2310-lot1 288 (6,44 → 23,26), 0-2310-lot1 941 (0,8 → 29,81), 0-2310-lot1 957 (0,31 → 8,16), 0-2310-lot1 958 (2,38 → 9,41).
Par cut, avec passe : perdus 25, dégradés > 2 mm 8, gagnés > 2 mm 9, nouvellement posés 15 ; perdus : 0-2310-lot1 51, 0-2310-lot1 52, 0-2310-lot1 289, 0-2310-lot1 926, 0-2310-lot1 972, 0-2310-lot1 1137, 0-2310-lot1 1138, 0-2310-lot1 1139, 0-2310-lot1 1181, 0-2310-lot1 1352, 0-2310-lot2 1119, 0-2310-lot2 1122, 0-2310-lot2 1123, 0-2310-lot2 1166, 0-2310-lot2 1167, 0-2310-lot2 1168, 0-2310-lot2 1169, 0-2310-lot2 1170, 0-2310-lot2 1171, 0-2310-lot2 1172, 0-2310-lot2 1173, 0-2310-lot2 1174, 0-2310-lot2 1329, 0-2310-lot2 1331, 0-2310-lot2 1333 ; dégradés : 0-2310-lot1 193 (0,53 → 13,11), 0-2310-lot1 195 (1,85 → 7,18), 0-2310-lot1 288 (6,44 → 23,26), 0-2310-lot1 941 (0,8 → 29,81), 0-2310-lot1 957 (0,31 → 8,16), 0-2310-lot1 958 (2,38 → 9,41), 0-2310-lot1 1135 (150,25 → 178,76), 0-2310-lot2 1328 (212,4 → 222,82).

## Vitesse (critère 6-i)

option --vitesse absente : vitesse non contrôlée

