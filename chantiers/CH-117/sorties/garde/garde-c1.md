# Garde de non-régression GCV2

Base : commit `92fbdfb93062115d2ba62eb0d4d936831ca2ac09`, version 4.9.5.20. Code jugé : commit `null`.

**Retour 1** (recul de qualité).

Pertes acceptées (colonne « avec passe » seulement, liste du manifeste, D-252) : ces cuts étaient à ≤ 10 mm en base et sont sans pose ; ils ne bloquent pas, ils sont montrés à chaque passage.

- reglage-9 : 2-17 9521 (2,74 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264
- reglage-9 : 2-17 9522 (2,57 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264

Signalé, non bloquant :

- reglage-9, avecPasse : cuts laissés sans pose 12 → 14
- terrain-partie-0-23-10, avecPasse : cuts laissés sans pose 79 → 81
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (pose > 50 mm 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (mauvaise voie 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse

Reculs de qualité (bloquants) :

- reglage-9, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 509 sur 510
- reglage-9, sansPasse : 1 cut(s) dégradé(s) de plus de 2 mm (2-18 204 11.53 mm)
- reglage-9, sansPasse : 3 vert(s) changé(s) (2-18 203, 2-18 451, 2-18 468)
- reglage-9, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 515 sur 518 ; hors de la liste des pertes acceptées : 2-18 204
- reglage-9, avecPasse : 2 cut(s) dégradé(s) de plus de 2 mm (2-18 204 11.53 mm, 2-18 467 14.44 mm)
- reglage-9, avecPasse : 3 vert(s) changé(s) (2-18 203, 2-18 451, 2-18 468)
- reglage-9, GCV2 dans le lot : 1 cut(s) dégradé(s) de plus de 2 mm (2-18 204 11.53 mm)
- partie-3:0, sansPasse : 4 vert(s) changé(s) (3-0 843, 3-0 861, 3-0 864, 3-0 867)
- partie-3:0, avecPasse : 4 vert(s) changé(s) (3-0 843, 3-0 861, 3-0 864, 3-0 867)
- terrain-partie-0-23-10, sansPasse : 1 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 940 5.96 mm)
- terrain-partie-0-23-10, sansPasse : 7 vert(s) changé(s) (0-2310-lot1 59, 0-2310-lot1 199, 0-2310-lot1 340, 0-2310-lot1 933, 0-2310-lot1 1359, 0-2310-lot1 1361, 0-2310-lot1 1362)
- terrain-partie-0-23-10, avecPasse : 1 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 1358 144.41 mm)
- terrain-partie-0-23-10, avecPasse : 1 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 1358 144.41 mm)
- terrain-partie-0-23-10, avecPasse : 1 cut(s) nouvellement en mauvaise voie (0-2310-lot1 1358 144.41 mm)
- terrain-partie-0-23-10, avecPasse : 1 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 940 5.96 mm)
- terrain-partie-0-23-10, avecPasse : 7 vert(s) changé(s) (0-2310-lot1 59, 0-2310-lot1 199, 0-2310-lot1 340, 0-2310-lot1 933, 0-2310-lot1 1359, 0-2310-lot1 1361, 0-2310-lot1 1362)
- terrain-partie-0-23-10, GCV2 dans le lot : 1 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 940 5.96 mm)

## reglage-9 (2-6, 2-7, 2-11, 2-13, 2-17, 2-18, 2-19, 2-20-fd7067f7, 2-20-f228f6f9)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 25 | 525 | 407 | 510 | 15 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| sans passe, actuel | 25 | 525 | 407 | 510 | 15 | 0 | 0 | 0 | 3 | 0 | 3,3 |
| avec passe, base | 12 | 534 | 412 | 518 | 16 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| avec passe, actuel | 14 | 532 | 410 | 516 | 16 | 0 | 0 | 0 | 3 | 0 | 3,3 |
| GCV2 dans le lot, base | — | 525 | 407 | 510 | 15 | 0 | 0 | 0 | — | — | 3,3 |
| GCV2 dans le lot, actuel | — | 520 | 402 | 505 | 15 | 0 | 0 | 0 | — | — | 3,3 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/520 (0 %, borne haute 0,7 %) tenu ; mauvaise voie 0/520 (0 %) tenu.

Par cut, sans passe : perdus 0, dégradés > 2 mm 1, gagnés > 2 mm 1, nouvellement posés 0 ; dégradés : 2-18 204 (2,03 → 11,53).
Par cut, avec passe : perdus 2, dégradés > 2 mm 2, gagnés > 2 mm 1, nouvellement posés 0 ; perdus : 2-17 9521, 2-17 9522 ; dégradés : 2-18 204 (2,03 → 11,53), 2-18 467 (10,51 → 14,44).

## partie-3:0 (3-0)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 14 | 23 | 10 | 18 | 5 | 0 | 0 | 0 | 0 | 0 | 5,5 |
| sans passe, actuel | 8 | 28 | 13 | 23 | 5 | 0 | 0 | 0 | 4 | 0 | 5,5 |
| avec passe, base | 8 | 29 | 14 | 23 | 6 | 0 | 0 | 0 | 0 | 0 | 5,1 |
| avec passe, actuel | 2 | 34 | 17 | 28 | 6 | 0 | 0 | 0 | 4 | 0 | 5,1 |
| GCV2 dans le lot, base | — | 23 | 10 | 18 | 5 | 0 | 0 | 0 | — | — | 5,5 |
| GCV2 dans le lot, actuel | — | 28 | 13 | 23 | 5 | 0 | 0 | 0 | — | — | 5,5 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/28 (0 %, borne haute 12,1 %) tenu ; mauvaise voie 0/28 (0 %) tenu.

Par cut, sans passe : perdus 0, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 6.
Par cut, avec passe : perdus 0, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 6.

## terrain-partie-0-23-10 (0-2310-lot1, 0-2310-lot2)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 98 | 105 | 60 | 92 | 5 | 8 | 5 | 5 | 0 | 0 | 4,3 |
| sans passe, actuel | 97 | 105 | 60 | 93 | 5 | 7 | 4 | 4 | 7 | 0 | 4,3 |
| avec passe, base | 79 | 124 | 68 | 106 | 5 | 13 | 10 | 10 | 0 | 0 | 4,4 |
| avec passe, actuel | 81 | 121 | 69 | 108 | 5 | 8 | 5 | 5 | 7 | 0 | 4,3 |
| GCV2 dans le lot, base | — | 105 | 60 | 92 | 5 | 8 | 5 | 5 | — | — | 4,3 |
| GCV2 dans le lot, actuel | — | 104 | 59 | 92 | 5 | 7 | 4 | 4 | — | — | 4,3 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 4/104 (3,8 %, borne haute 9,5 %) **DÉPASSÉ** ; mauvaise voie 4/104 (3,8 %) **DÉPASSÉ**.

Par cut, sans passe : perdus 0, dégradés > 2 mm 1, gagnés > 2 mm 1, nouvellement posés 1 ; dégradés : 0-2310-lot1 940 (2,12 → 5,96).
Par cut, avec passe : perdus 5, dégradés > 2 mm 1, gagnés > 2 mm 1, nouvellement posés 3 ; perdus : 0-2310-lot1 1135, 0-2310-lot2 1328, 0-2310-lot2 1329, 0-2310-lot2 1331, 0-2310-lot2 1332 ; dégradés : 0-2310-lot1 940 (2,12 → 5,96).

## Vitesse (critère 6-i)

option --vitesse absente : vitesse non contrôlée

