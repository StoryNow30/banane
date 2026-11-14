# Garde de non-régression GCV2

Base : commit `92fbdfb93062115d2ba62eb0d4d936831ca2ac09`, version 4.9.5.20. Code jugé : commit `43d71d6c99593abcb5ae3528ccb178fc1ea2d912`.

**Retour 1** (recul de qualité).

Pertes acceptées (colonne « avec passe » seulement, liste du manifeste, D-252) : ces cuts étaient à ≤ 10 mm en base et sont sans pose ; ils ne bloquent pas, ils sont montrés à chaque passage.

- reglage-9 : 2-17 9521 (2,74 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264
- reglage-9 : 2-17 9522 (2,57 mm en base) ; D-252, accord de l'opérateur du 26/10 : garde A, bonnes poses perdues à 7 et 8 cuts d'appui ; garde-appuis ; commit acf24f99596c563b8dac333e4855918546d3f264

Signalé, non bloquant :

- reglage-9, avecPasse : cuts laissés sans pose 12 → 14
- terrain-partie-0-23-10, avecPasse : cuts laissés sans pose 79 → 83
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (pose > 50 mm 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
- terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (mauvaise voie 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse

Reculs de qualité (bloquants) :

- reglage-9, sansPasse : cuts laissés sans pose 25 → 27
- reglage-9, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 508 sur 510

## reglage-9 (2-6, 2-7, 2-11, 2-13, 2-17, 2-18, 2-19, 2-20-fd7067f7, 2-20-f228f6f9)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 25 | 525 | 407 | 510 | 15 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| sans passe, actuel | 27 | 523 | 406 | 508 | 15 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| avec passe, base | 12 | 534 | 412 | 518 | 16 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| avec passe, actuel | 14 | 532 | 410 | 516 | 16 | 0 | 0 | 0 | 0 | 0 | 3,3 |
| GCV2 dans le lot, base | — | 525 | 407 | 510 | 15 | 0 | 0 | 0 | — | — | 3,3 |
| GCV2 dans le lot, actuel | — | 523 | 406 | 508 | 15 | 0 | 0 | 0 | — | — | 3,3 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/523 (0 %, borne haute 0,7 %) tenu ; mauvaise voie 0/523 (0 %) tenu.

Par cut, sans passe : perdus 2, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 0 ; perdus : 2-19 5030, 2-20-f228f6f9 289.
Par cut, avec passe : perdus 2, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 0 ; perdus : 2-17 9521, 2-17 9522.

## partie-3:0 (3-0)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 14 | 23 | 10 | 18 | 5 | 0 | 0 | 0 | 0 | 0 | 5,5 |
| sans passe, actuel | 14 | 23 | 10 | 18 | 5 | 0 | 0 | 0 | 0 | 0 | 5,5 |
| avec passe, base | 8 | 29 | 14 | 23 | 6 | 0 | 0 | 0 | 0 | 0 | 5,1 |
| avec passe, actuel | 8 | 29 | 14 | 23 | 6 | 0 | 0 | 0 | 0 | 0 | 5,1 |
| GCV2 dans le lot, base | — | 23 | 10 | 18 | 5 | 0 | 0 | 0 | — | — | 5,5 |
| GCV2 dans le lot, actuel | — | 23 | 10 | 18 | 5 | 0 | 0 | 0 | — | — | 5,5 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 0/23 (0 %, borne haute 14,3 %) tenu ; mauvaise voie 0/23 (0 %) tenu.

Par cut, sans passe : perdus 0, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 0.
Par cut, avec passe : perdus 0, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 0.

## terrain-partie-0-23-10 (0-2310-lot1, 0-2310-lot2)

| Colonne | Sans pose | Jugées | ≤ 5 | ≤ 10 | 10–20 | > 20 | > 50 | MV | Verts changés | Sans preuve | Médiane mm |
|---|---|---|---|---|---|---|---|---|---|---|---|
| sans passe, base | 98 | 105 | 60 | 92 | 5 | 8 | 5 | 5 | 0 | 0 | 4,3 |
| sans passe, actuel | 98 | 105 | 60 | 92 | 5 | 8 | 5 | 5 | 0 | 0 | 4,3 |
| avec passe, base | 79 | 124 | 68 | 106 | 5 | 13 | 10 | 10 | 0 | 0 | 4,4 |
| avec passe, actuel | 83 | 120 | 69 | 107 | 5 | 8 | 5 | 5 | 0 | 0 | 4,3 |
| GCV2 dans le lot, base | — | 105 | 60 | 92 | 5 | 8 | 5 | 5 | — | — | 4,3 |
| GCV2 dans le lot, actuel | — | 105 | 60 | 92 | 5 | 8 | 5 | 5 | — | — | 4,3 |

Budget D-223, GCV2 dans le lot (actuel) : pose > 50 mm 5/105 (4,8 %, borne haute 10,7 %) **DÉPASSÉ** ; mauvaise voie 5/105 (4,8 %) **DÉPASSÉ**.

Par cut, sans passe : perdus 0, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 0.
Par cut, avec passe : perdus 5, dégradés > 2 mm 0, gagnés > 2 mm 0, nouvellement posés 1 ; perdus : 0-2310-lot1 1135, 0-2310-lot2 1328, 0-2310-lot2 1329, 0-2310-lot2 1331, 0-2310-lot2 1332.

## Vitesse (critère 6-i)

option --vitesse absente : vitesse non contrôlée

