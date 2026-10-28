# Précision des poses de la GCV2, base de la v6 (28/10/2026, CH-009)

Mesure seule. Aucun seuil n'est réglé, aucun changement de la GCV2 n'est proposé. Outil : `node tools/precision-poses.cjs --donnees <banane-data>` (lecture seule). Essai : `tests/precision-poses.test.cjs`, journal et Écho fictifs, 5 essais verts. Intervalles à 95 % : Wilson pour les parts, bootstrap par cut (2 000 tirages, graine 20261028) pour la médiane.

**Définition (ÉTABLI dans l'outil).** Une pose du lot est une décision `gcv1-shadow-observed` dont la commande est `gcv2-l1` (`l1s` `gcv2`, action `lot`), vérifiée par `applied-verified` avant la passe et avant la relecture. L'écart est le plus grand des deux rails, en 3D, entre cette pose et la dernière validation de l'Écho (`tools/jointure-echo-orbite.cjs`, base calibrée sur la pose du lot). Une visite sans validation n'est pas un écart de 0. La passe en ombre (`passe-differes-ombre`, passe 1, décision `poserait`) est un tableau à part. Zone grise : écart à ±1,5 mm de 5 mm ou de 10 mm (`fiches/BRUIT_REFERENCE.md`, borne latérale du bruit de la référence). Le seuil de 5 mm se lit comme un taux, pas comme un verdict de cut.

## Population

Huit lots du 26/10/2026, versions 4.9.5.21 (parties 15 à 20), 4.9.5.22 (partie 0), 4.9.5.23 (partie 1). L'Écho de la partie 0 est archivé sous 4.9.5.23. L'Écho de la partie 19 est perdu (note de `2026-10-26_v4.9.5.21_parties-18-19-20-lots`) : ses 3 poses n'ont pas de jugement. Repère non calibré : 0. Le record du journal et la pose vérifiée du lot diffèrent de 0 mm sur les 86 poses (max mesuré 0).

**Rôle au réglage, les huit parties : non établi.** Les notes de chaque collecte disent que le projet n'a pas été précisé. Le journal de la partie 15 n'a aucun identifiant de projet (0 sur 3 572 événements qui portent une identité). Les paramètres figés du 19/10 (`datasets/gcv2-parametres.json`, `gcv2-g1b-1`) nomment d'autres exports (parties 12, 13, 14, 15, 16, 17, 24, 29, et parties 1, 10, 11 d'un second projet), pas ces lots du 26/10. On ne sait donc pas si une partie d'ici a servi au réglage. Le total ci-dessous n'est ni un chiffre de réglage ni un chiffre d'examen : les deux ne sont pas séparables, ils ne sont pas mélangés sous un autre nom.

## Poses du lot

| Partie | Version | Posés | Jugés | Sans Écho | Sans pose finale | Médiane mm [IC] | ≤ 2 | ≤ 5 | ≤ 10 | > 20 | > 50 | Zone grise | Max |
|---|---|--:|--:|--:|--:|---|--:|--:|--:|--:|--:|--:|--:|
| 15 | 4.9.5.21 | 0 | 0 | 0 | 0 | — | — | — | — | — | — | — | — |
| 16 | 4.9.5.21 | 2 | 0 | 0 | 2 | — | — | — | — | — | — | — | — |
| 17 | 4.9.5.21 | 3 | 0 | 0 | 3 | — | — | — | — | — | — | — | — |
| 18 | 4.9.5.21 | 8 | 2 | 1 | 5 | 5,64 [5,15 ; 6,14] | 0/2 | 0/2 | 2/2 | 0/2 | 0/2 | 2/2 | 6,14 |
| 19 | 4.9.5.21 | 3 | 0 | 3 | 0 | — | — | — | — | — | — | — | — |
| 20 | 4.9.5.21 | 15 | 5 | 4 | 6 | 5,78 [0 ; 14,03] | 1/5 | 1/5 | 3/5 | 0/5 | 0/5 | 2/5 | 14,03 |
| 0 | 4.9.5.22 | 39 | 2 | 37 | 0 | 12,01 [7,07 ; 16,95] | 0/2 | 0/2 | 1/2 | 0/2 | 0/2 | 0/2 | 16,95 |
| 1 | 4.9.5.23 | 16 | 0 | 15 | 1 | — | — | — | — | — | — | — | — |
| **Total** | | **86** | **9** | **60** | **17** | **6,14 [5,12 ; 12,1]** | **1/9** | **1/9** | **6/9** | **0/9** | **0/9** | **4/9** | **16,95** |

Wilson 95 % sur les 9 : ≤ 2 mm et ≤ 5 mm, 11 % [2 ; 43] ; ≤ 10 mm, 67 % [35 ; 88] ; > 20 mm et > 50 mm, 0 % [0 ; 30] ; zone grise, 44 % [19 ; 73].

Les 9 écarts, du plus petit au plus grand, sans numéro de cut : 0 ; 5,12 ; 5,15 ; 5,78 ; 6,14 ; 7,07 ; 12,05 ; 14,03 ; 16,95 mm. Pires cas : 16,95 mm, puis 14,03 et 12,05. Aucun au-dessus de 20 mm, aucun au-dessus de 50 mm.

**ÉTABLI :** ces comptes, relus sur les journaux et les Échos. Les 17 « sans pose finale » sont dans l'Écho sans validation : ils ne comptent pas pour 0. Les rapports du 26/10 comptaient une partie d'entre eux comme justes par la règle « visité sans action » ; cette règle n'est pas utilisée ici, elle ne mesure pas la précision (le rapport de la partie 15 le disait déjà).

## Passe en ombre (séparée)

| Partie | Poserait | Jugés | Médiane mm [IC] | ≤ 5 | ≤ 10 | > 20 | > 50 | Zone grise | Max |
|---|--:|--:|---|--:|--:|--:|--:|--:|--:|
| 15 | 0 | 0 | — | — | — | — | — | — | — |
| 16 | 0 | 0 | — | — | — | — | — | — | — |
| 17 | 1 | 1 | 17,68 | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 | 17,68 |
| 18 | 2 | 2 | 12,87 [4,7 ; 21,04] | 1/2 | 1/2 | 1/2 | 0/2 | 1/2 | 21,04 |
| 19 | 0 | 0 | — | — | — | — | — | — | — |
| 20 | 4 | 4 | 3,89 [2,38 ; 9,12] | 3/4 | 4/4 | 0/4 | 0/4 | 3/4 | 9,12 |
| 0 | 12 | 12 | 7,04 [2,94 ; 11,57] | 6/12 | 7/12 | 1/12 | 0/12 | 4/12 | 21,41 |
| 1 | 9 | 9 | 11,17 [6,34 ; 13,14] | 1/9 | 3/9 | 1/9 | 0/9 | 4/9 | 22,49 |
| **Total** | **28** | **28** | **9,56 [4,13 ; 11,22]** | **11/28** | **15/28** | **3/28** | **0/28** | **12/28** | **22,49** |

Wilson 95 % sur les 28 : ≤ 5 mm, 39 % [24 ; 58] ; ≤ 10 mm, 54 % [36 ; 70] ; > 20 mm, 11 % [4 ; 27] ; > 50 mm, 0 % [0 ; 12] ; zone grise, 43 % [27 ; 61]. Les 28 ont une validation. Ces écarts retrouvent ceux des rapports du 26/10 (maxima 17,7 ; 21,0 ; 21,4 ; 22,5 mm). **ÉTABLI.**

## Ce qui reste supposé

- **SUPPOSÉ, non tranché :** ces parties ont-elles servi au réglage ? Le projet n'est pas dans les exports. Tant que ce n'est pas établi, le total des 9 ne s'emploie ni comme base d'examen ni comme base de réglage.
- **ÉTABLI comme limite, pas comme correction :** 8 des 9 jugements du lot sont au-dessus de 5 mm. Ce sont des cuts que l'opérateur a validés, donc un échantillon tiré vers la correction. Les 17 visites sans validation ne disent pas où serait l'écart.
- Le biais constant de la référence n'est pas mesuré (`BRUIT_REFERENCE.md`). « À 5 mm » veut dire à 5 mm de la pose validée, à 1 ou 2 mm près. Quatre des neuf écarts du lot sont dans la zone grise de 5 mm : le taux ≤ 5 mm bouge si le seuil bouge de 1,5 mm.
- Avec 9 jugements, une borne haute de Wilson à 0 faute serait de 30 % (ici 0 pose au-dessus de 20 mm). Ce n'est pas une cible tenue. Rien n'est proposé à partir de ce constat.
