# Garde de non-régression GCV2

Base : commit `92fbdfb93062115d2ba62eb0d4d936831ca2ac09`, version 4.9.5.20. Code jugé : commit `ac47a281e9ad9c4c247d4b53863968c01f5b3b1d`.

**Retour 1** (recul de qualité).

Pertes acceptées (colonne « avec passe » seulement, liste du manifeste, D-252) : ces cuts étaient à ≤ 10 mm en base et sont sans pose ; ils ne bloquent pas, ils sont montrés à chaque passage.

- reglage-9 : 2-17 9521 (2,74 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264
- reglage-9 : 2-17 9522 (2,57 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264

Signalé, non bloquant :

- reglage-9, avecPasse : cuts laissés sans pose 12 → 15
- terrain-partie-0-23-10, avecPasse : cuts laissés sans pose 79 → 82
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (pose > 50 mm 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (mauvaise voie 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse

Reculs de qualité (bloquants) :

- reglage-9, sansPasse : 26 vert(s) changé(s) (2-6 4488, 2-6 4650, 2-6 4673, 2-7 1966, 2-7 3286, 2-7 4438, 2-7 4473, 2-11 8383)
- reglage-9, avecPasse : 26 vert(s) changé(s) (2-6 4488, 2-6 4650, 2-6 4673, 2-7 1966, 2-7 3286, 2-7 4438, 2-7 4473, 2-11 8383)
- partie-3:0, sansPasse : 12 vert(s) changé(s) (3-0 135, 3-0 224, 3-0 344, 3-0 375, 3-0 782, 3-0 897, 3-0 911, 3-0 918)
- partie-3:0, avecPasse : 12 vert(s) changé(s) (3-0 135, 3-0 224, 3-0 344, 3-0 375, 3-0 782, 3-0 897, 3-0 911, 3-0 918)
- terrain-partie-0-23-10, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 91 sur 92
- terrain-partie-0-23-10, sansPasse : 1 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 1372 60.19 mm)
- terrain-partie-0-23-10, sansPasse : 1 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 1372 60.19 mm)
- terrain-partie-0-23-10, sansPasse : 3 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 5.34 mm, 0-2310-lot1 13 2.73 mm, 0-2310-lot1 193 4.25 mm)
- terrain-partie-0-23-10, sansPasse : 15 vert(s) changé(s) (0-2310-lot1 10, 0-2310-lot1 68, 0-2310-lot1 79, 0-2310-lot1 80, 0-2310-lot1 254, 0-2310-lot1 261, 0-2310-lot1 262, 0-2310-lot1 264)
- terrain-partie-0-23-10, avecPasse : 1 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 1372 60.19 mm)
- terrain-partie-0-23-10, avecPasse : 1 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 1372 60.19 mm)
- terrain-partie-0-23-10, avecPasse : 3 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 5.34 mm, 0-2310-lot1 13 2.73 mm, 0-2310-lot1 193 4.25 mm)
- terrain-partie-0-23-10, avecPasse : 15 vert(s) changé(s) (0-2310-lot1 10, 0-2310-lot1 68, 0-2310-lot1 79, 0-2310-lot1 80, 0-2310-lot1 254, 0-2310-lot1 261, 0-2310-lot1 262, 0-2310-lot1 264)
- terrain-partie-0-23-10, GCV2 dans le lot : 1 cut(s) nouvellement à plus de 20 mm (0-2310-lot1 1372 60.19 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 1 cut(s) nouvellement à plus de 50 mm (0-2310-lot1 1372 60.19 mm)
- terrain-partie-0-23-10, GCV2 dans le lot : 3 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 5.34 mm, 0-2310-lot1 13 2.73 mm, 0-2310-lot1 193 4.25 mm)

## reglage-9 (2-6, 2-7, 2-11, 2-13, 2-17, 2-18, 2-19, 2-20-fd7067f7, 2-20-f228f6f9)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 25 | 525 | 407 | 510 | 15 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| sans passe, actuel | 25 | 525 | 416 | 512 | 13 | 0 | 0 | 0 | 26 | 0 | 3,2 |
| avec passe, base | 12 | 534 | 412 | 518 | 16 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| avec passe, actuel | 15 | 532 | 419 | 519 | 13 | 0 | 0 | 0 | 26 | 0 | 3,2 |
| GCV2 dans le lot, base | — | 525 | 407 | 510 | 15 | 0 | 0 | 0 | — | — | 3,3 |
| GCV2 dans le lot, actuel | — | 525 | 416 | 512 | 13 | 0 | 0 | 0 | — | — | 3,2 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/525 (0 %, borne haute 0,7 %) tenu ; mauvaise voie 0/525 (0 %) tenu.

Par cut, sans passe : perdus 0, dégradés > 2 mm 0, gagnés > 2 mm 14, nouvellement posés 0.
Par cut, avec passe : perdus 3, dégradés > 2 mm 0, gagnés > 2 mm 16, nouvellement posés 0 ; perdus : 2-17 9521, 2-17 9522, 2-18 36.

## partie-3:0 (3-0)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 14 | 23 | 10 | 18 | 5 | 0 | 0 | 0 | 0 | 0 | 5,5 |
| sans passe, actuel | 14 | 23 | 10 | 19 | 4 | 0 | 0 | 0 | 12 | 0 | 5,5 |
| avec passe, base | 8 | 29 | 14 | 23 | 6 | 0 | 0 | 0 | 0 | 0 | 5,1 |
| avec passe, actuel | 8 | 29 | 14 | 24 | 5 | 0 | 0 | 0 | 12 | 0 | 5,1 |
| GCV2 dans le lot, base | — | 23 | 10 | 18 | 5 | 0 | 0 | 0 | — | — | 5,5 |
| GCV2 dans le lot, actuel | — | 23 | 10 | 19 | 4 | 0 | 0 | 0 | — | — | 5,5 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/23 (0 %, borne haute 14,3 %) tenu ; mauvaise voie 0/23 (0 %) tenu.

Par cut, sans passe : perdus 0, dégradés > 2 mm 0, gagnés > 2 mm 1, nouvellement posés 0.
Par cut, avec passe : perdus 0, dégradés > 2 mm 0, gagnés > 2 mm 1, nouvellement posés 0.

## terrain-partie-0-23-10 (0-2310-lot1, 0-2310-lot2)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 98 | 105 | 60 | 92 | 5 | 8 | 5 | 5 | 0 | 0 | 4,3 |
| sans passe, actuel | 98 | 105 | 58 | 92 | 6 | 7 | 5 | 4 | 15 | 0 | 4,3 |
| avec passe, base | 79 | 124 | 68 | 106 | 5 | 13 | 10 | 10 | 0 | 0 | 4,4 |
| avec passe, actuel | 82 | 121 | 68 | 108 | 6 | 7 | 5 | 4 | 15 | 0 | 4,3 |
| GCV2 dans le lot, base | — | 105 | 60 | 92 | 5 | 8 | 5 | 5 | — | — | 4,3 |
| GCV2 dans le lot, actuel | — | 105 | 58 | 92 | 6 | 7 | 5 | 4 | — | — | 4,3 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 5/105 (4,8 %, borne haute 10,7 %) **DÉPASSÉ** ; mauvaise voie 4/105 (3,8 %) **DÉPASSÉ**.

Par cut, sans passe : perdus 1, dégradés > 2 mm 3, gagnés > 2 mm 1, nouvellement posés 1 ; perdus : 0-2310-lot1 1376 ; dégradés : 0-2310-lot1 4 (0,97 → 5,34), 0-2310-lot1 13 (0,38 → 2,73), 0-2310-lot1 193 (0,53 → 4,25).
Par cut, avec passe : perdus 5, dégradés > 2 mm 3, gagnés > 2 mm 1, nouvellement posés 2 ; perdus : 0-2310-lot1 1135, 0-2310-lot2 1328, 0-2310-lot2 1329, 0-2310-lot2 1331, 0-2310-lot2 1332 ; dégradés : 0-2310-lot1 4 (0,97 → 5,34), 0-2310-lot1 13 (0,38 → 2,73), 0-2310-lot1 193 (0,53 → 4,25).

## Vitesse (critère 6-i)

option --vitesse absente : vitesse non contrôlée

