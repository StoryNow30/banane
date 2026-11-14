Travers des poses GCV2, simulation statique : 118 cuts jugés posés par la GCV2 (hors mauvaises voies du livré), borne 20 mm.

## Sensibilité au seuil (tous les lots réglables ensemble)
| seuil T (mm) | cuts déplacés | rapprochés (> 1 mm) | éloignés (> 1 mm) | ≤ 10 mm : gagnés | perdus |
|---|---|---|---|---|---|
| 3 | 26 | 24 | 1 | 8 | 0 |
| 4 | 25 | 23 | 1 | 8 | 0 |
| 5 | 19 | 18 | 0 | 8 | 0 |
| 6 | 14 | 13 | 0 | 6 | 0 |
| 7 | 12 | 12 | 0 | 6 | 0 |
| 8 | 11 | 11 | 0 | 6 | 0 |

## Seuil appris par pli, et jugement de chaque lot avec le seuil de son pli
| lot tenu à l'écart | T du pli | cuts GCV2 jugés | ≤ 10 mm livré | ≤ 10 mm mesuré | gagnés | perdus | déplacés | rapprochés | éloignés |
|---|---|---|---|---|---|---|---|---|---|
| 0411 | 5 | 3 | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| 0611 | 5 | 46 | 39 | 42 | 3 | 0 | 10 | 9 | 0 |
| 0811a | 5 | 6 | 5 | 5 | 0 | 0 | 0 | 0 | 0 |
| 0811b | 5 | 21 | 17 | 20 | 3 | 0 | 3 | 3 | 0 |
| 1111 | 5 | 30 | 28 | 30 | 2 | 0 | 6 | 6 | 0 |
| 1211 | 3 | 12 | 11 | 11 | 0 | 0 | 3 | 2 | 1 |
| **total** | final : 5 | 118 | 102 | 110 | 8 | 0 | 22 | 20 | 1 |

## Cuts déplacés (seuil du pli) : déplacement latéral proposé par rail (mm, + vers le champignon) et retouche de l'opérateur
| cut | décision livrée | rails | erreur du cut (pire rail) |
|---|---|---|---|
| 0611 13/7150 | valider | g -6.4 (opérateur -6.0) ; d 0.0 (opérateur -4.8) | 6 → 5.1 |
| 0611 16/9117 | consensus | g -5.5 (opérateur -7.2) ; d 8.6 (opérateur 9.0) | 10 → 4.3 |
| 0611 16/9157 | ecartement-corrige (corrigé g) | g 6.9 (opérateur 4.8) ; d 0.0 (opérateur -0.5) | 7.2 → 5.8 |
| 0611 16/9158 | ecartement-corrige (corrigé g) | g 9.3 (opérateur 7.6) ; d 0.0 (opérateur -1.0) | 7.6 → 2.8 |
| 0611 16/9165 | branche | g 0.0 (opérateur -2.9) ; d 10.3 (opérateur 10.3) | 10.3 → 9 |
| 0611 16/9168 | ecartement-corrige (corrigé g) | g 0.0 (opérateur 6.2) ; d 5.8 (opérateur 5.7) | 12.7 → 11.4 |
| 0611 16/9169 | consensus | g 10.0 (opérateur 8.3, départ large) ; d 0.0 (opérateur 0.0) | 8.6 → 2.9 |
| 0611 16/9170 | ecartement-corrige (corrigé g) | g 8.8 (opérateur 9.6) ; d 0.0 (opérateur -0.3) | 9.7 → 1.2 |
| 0611 16/9259 | valider (corrigé g) | g 16.6 (opérateur 17.7) ; d 0.0 (opérateur 0.3) | 17.8 → 7.5 |
| 0611 16/9260 | valider | g 6.2 (opérateur 12.4) ; d 0.0 (opérateur -0.3) | 12.8 → 7 |
| 0811b 6/228 | ecartement-corrige (corrigé d) | g 0.0 (opérateur 0.1) ; d 10.9 (opérateur 11.0, départ large) | 11.1 → 0.7 |
| 0811b 6/231 | consensus | g 0.0 (opérateur -7.7) ; d 11.4 (opérateur 16.9) | 16.9 → 8.4 |
| 0811b 6/232 | ecartement-corrige (corrigé d) | g 0.0 (opérateur -2.9) ; d 9.8 (opérateur 11.5) | 11.6 → 3.4 |
| 1111 16/4534 | valider (corrigé g) | g -8.7 (opérateur -7.7) ; d 0.0 (opérateur -0.3) | 9.1 → 5 |
| 1111 16/4546 | valider (corrigé d) | g 0.0 (opérateur 0.0) ; d 7.9 (opérateur 5.3) | 8.5 → 7.1 |
| 1111 16/5854 | sous-tau-coherent | g -9.5 (opérateur -12.2) ; d 0.0 (opérateur -0.2) | 12.3 → 3 |
| 1111 16/5855 | consensus | g -6.4 (opérateur -7.7) ; d 0.0 (opérateur -0.4) | 7.7 → 1.4 |
| 1111 16/5856 | consensus | g -10.5 (opérateur -13.3) ; d 0.0 (opérateur -0.4) | 13.3 → 2.9 |
| 1111 16/5902 | consensus | g 0.0 (opérateur 0.2) ; d -11.6 (opérateur -9.8) | 9.9 → 2 |
| 1211 0/122 | valider | g -5.0 (opérateur -4.5) ; d 0.0 (opérateur -0.1) | 8.1 → 6.8 |
| 1211 23/3682 | valider | g 0.0 (opérateur 0.4) ; d -4.9 (opérateur -9.8) | 10 → 5.3 |
| 1211 23/3746 | recherche-adv | g -4.0 (opérateur 0.3) ; d 0.0 (opérateur -0.2) | 0.4 → 4.4 |

{"maxMm":20,"seuilMm":{"1111":5,"1211":3,"0411":5,"0611":5,"0811a":5,"0811b":5,"final":5}}
