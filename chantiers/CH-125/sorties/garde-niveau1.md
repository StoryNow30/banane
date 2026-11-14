# CH-125 : garde d'octobre du niveau 1 (hauteur des rails refusés, à la source, tous les appels du calage ; c = 5,1) — 14/11

Réglage `reglages/niveau1.json`, patch `mesure-source.patch`, rejeux du banc de CH-116 (`banc.cjs garde`, 12 lots, réglages de la base scellée). Référence : la garde à l'éteint du même patch (retour 0, 0 recul, 0 vert changé).

## Verdict de la garde : ROUGE (retour 1). Le réglage est écarté (R1).
```
garde d'octobre au banc, réglage « ch125-n1 » : retour 1 ; 15 recul(s) dont 15 RÉEL(S) et 0 « verts changés » ; rejeux 1451 s
  réel : reglage-9, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 507 sur 510
  réel : reglage-9, sansPasse : 1 cut(s) nouvellement à plus de 20 mm (2-7 3220 29.15 mm)
  réel : reglage-9, sansPasse : 2 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 8.25 mm, 2-20-f228f6f9 447 5.11 mm)
  réel : reglage-9, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 513 sur 518 ; hors de la liste des pertes acceptées : 2-18 452, 2-18 453, 2-18 454
  réel : reglage-9, avecPasse : 1 cut(s) nouvellement à plus de 20 mm (2-7 3220 29.15 mm)
  réel : reglage-9, avecPasse : 2 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 8.25 mm, 2-20-f228f6f9 447 5.11 mm)
  réel : reglage-9, GCV2 dans le lot : 1 cut(s) nouvellement à plus de 20 mm (2-7 3220 29.15 mm)
  réel : reglage-9, GCV2 dans le lot : 2 cut(s) dégradé(s) de plus de 2 mm (2-6 3399 8.25 mm, 2-20-f228f6f9 447 5.11 mm)
  réel : partie-3:0, sansPasse : cuts laissés sans pose 14 → 15
  réel : terrain-partie-0-23-10, sansPasse : 1 cut(s) nouvellement à plus de 20 mm (0-2310-lot2 1329 215.98 mm)
  réel : terrain-partie-0-23-10, sansPasse : 1 cut(s) nouvellement à plus de 50 mm (0-2310-lot2 1329 215.98 mm)
  réel : terrain-partie-0-23-10, sansPasse : 1 cut(s) nouvellement en mauvaise voie (0-2310-lot2 1329 215.98 mm)
  réel : terrain-partie-0-23-10, sansPasse : 1 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 1166 9.27 mm)
  réel : terrain-partie-0-23-10, avecPasse : 1 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 1166 9.27 mm)
  réel : terrain-partie-0-23-10, GCV2 dans le lot : 1 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 1166 9.27 mm)
  signalé : reglage-9, avecPasse : cuts laissés sans pose 12 → 13
  signalé : partie-3:0, avecPasse : cuts laissés sans pose 8 → 9
  signalé : terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (pose > 50 mm 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
  signalé : terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (mauvaise voie 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
```

## Jugement contre la vérité d'octobre (R6) : poses de la chaîne (profil `base`), éteint → réglage (`outils/oct-chaine.cjs`)
| groupe | poses de la chaîne | déplacées | médiane, max (mm) | jugées (validation) | dont déplacées | rapprochées / éloignées / égales | justes à l'éteint | justes passés > 10 mm | gagnés | médiane de l'écart, toutes : avant → après | déplacées : avant → après | « visité sans action » : poses, déplacées, justes passés > 10 mm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| reglage-9 | 811 | 37 | 8.9, 246.9 | 393 | 19 | 9 / 5 / 5 | 329 | 1 | 5 | 0.5 → 0.5 | 9.2 → 5.5 | 0, 0, 0 |
| total | 1497 | 73 | 8.9, 246.9 | 490 | 39 | 24 / 6 / 9 | 404 | 1 | 8 | 0.5 → 0.5 | 9.1 → 3.9 | 178, 3, 0 |
| partie-3:0 | 279 | 14 | 9.0, 36.1 | 21 | 5 | 3 / 0 / 2 | 9 | 0 | 2 | 10.2 → 7.9 | 40.9 → 29.8 | 0, 0, 0 |
| terrain-partie-0-23-10 | 407 | 22 | 7.9, 10.3 | 76 | 15 | 12 / 1 / 2 | 66 | 0 | 1 | 5.9 → 5.0 | 7.7 → 2.6 | 178, 3, 0 |

Justes d'octobre passés au-delà de 10 mm (validations) : 2-20-fd7067f7 275 0.3→10.8
Gagnés : 2-7 4438 12.8→4.5 ; 2-7 4473 11.3→5.5 ; 2-18 302 11.4→2.3 ; 2-18 451 247.1→2.3 ; 2-20-fd7067f7 110 11.5→5.9 ; 3-0 897 10.2→2.4 ; 3-0 911 10.2→4.0 ; 0-2310-lot1 261 13.4→5.5
« Visité sans action », justes passés au-delà de 10 mm : aucun
États changés, profil base (chaîne) : 5 : 2-18 452 differe→pose (ricochet) ; 2-18 453 differe→pose (ricochet) ; 2-18 454 differe→pose (ricochet) ; 0-2310-lot1 268 differe→pose ; 0-2310-lot1 1365 differe→pose (ricochet)
États changés, profil L1-se : 11 : 2-7 3220 differe→pose ; 3-0 229 pose→differe ; 0-2310-lot1 1365 differe→pose (ricochet) ; 0-2310-lot1 1366 differe→pose (ricochet) ; 0-2310-lot1 1367 differe→pose (ricochet) ; 0-2310-lot1 1368 differe→pose (ricochet) ; 0-2310-lot1 1370 differe→pose ; 0-2310-lot1 1371 differe→pose ; 0-2310-lot1 1372 differe→pose ; 0-2310-lot2 1329 differe→pose ; 0-2310-lot2 1333 pose→differe
Ricochets (état changé sur un cut non touché par la mesure) : 4 : 0-2310-lot1 1365 ; 0-2310-lot1 1366 ; 0-2310-lot1 1367 ; 0-2310-lot1 1368
Poses L1-se déplacées sur un cut non touché : 25 : 2-6 4674 1.1 ; 2-7 4441 0.7 ; 2-18 449 0.8 ; 2-18 451 246.9 ; 2-18 493 0.7 ; 2-18 497 1.3 ; 2-20-fd7067f7 278 0.7 ; 2-20-fd7067f7 282 0.5 ; 2-20-fd7067f7 284 0.7 ; 2-20-f228f6f9 393 5.1 ; 2-20-f228f6f9 521 0.7 ; 3-0 345 0.5 ; 3-0 864 1.1 ; 3-0 928 36.1 ; 0-2310-lot1 70 0.9 ; 0-2310-lot1 71 1.1 ; 0-2310-lot1 264 9.5 ; 0-2310-lot1 265 0.6 ; 0-2310-lot1 266 0.6 ; 0-2310-lot1 282 0.8 ; 0-2310-lot1 283 1.8 ; 0-2310-lot1 284 0.9 ; 0-2310-lot1 293 4.1 ; 0-2310-lot1 906 1.6 ; 0-2310-lot2 906 1.6

## Lecture (ÉTABLI)
- La mesure elle-même, sur les poses de la chaîne jugées et déplacées : 24 rapprochées de la vérité, 6 éloignées, 9 égales ; 8 passent sous 10 mm, 1 juste passe au-delà (2-20-fd7067f7 275 : 0,3 → 10,8 mm). Médiane de l'écart des déplacées : 9,1 → 3,9 mm.
- La propagation : 73 poses de la chaîne déplacées, dont des décisions changées (5 états au profil de base, 11 au profil L1-se), 4 états changés par ricochet sur des cuts non touchés, 25 poses L1-se déplacées sur des cuts non touchés. Une mauvaise voie nouvelle (0-2310-lot2 1329, 216 mm) et une pose nouvelle à 29 mm (2-7 3220) sont des cuts TOUCHÉS (hypothèses de la GCV2 relevées par la mesure) ; 2-18 451 passe de 247 mm à 2,3 mm par ricochet.
- Différence avec aj5 de CH-121 (même mesure, médiane + c, mêmes bornes) : aj5 ne touche que la pose écrite des cuts posés par la chaîne et ne la propage à rien (0 décision changée, 53 « verts changés » en octobre). À la source, la même hauteur entre dans les cellules de la GCV2 et dans les appuis de la chaîne : c'est cette propagation, et non la mesure, qui rend la garde rouge.
