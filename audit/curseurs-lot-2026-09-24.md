# Bilan des curseurs de la décision sur le lot (critère C5)

**24 septembre 2026.** Chaque curseur de `src/lot-decision.js` est déplacé
seul, un cran de chaque côté, et toute la décision est rejouée en **un seul
passage**, comme dans le Pilote : les appuis sont recalculés, donc un curseur
qui change un appui change aussi les cuts suivants. La garde de paire (D-044)
reste active partout.

**Banc** — tout ce qui a été relu :

- **Natif, 6 sessions** : partie 22, partie 20 (courte et longue), relecture
  de la partie 19, parties 24 et 30. Jugement contre la référence stricte
  (`referenceFor`).
- **Pilote, 4 lots relus** : partie 19 (4.7.6), partie 31 (4.7.8 et 4.7.9),
  partie 34 (4.7.11). Jugement de `tools/acceptance-report.cjs`, D-040 compris.
- Faux : latéral **ou** vertical > 10 mm (D-038). Aucune pose humaine n'entre
  dans une décision ; l'écartement [1405, 1470] mm n'est qu'une admissibilité.

**Outils** : `tools/choice-anchor-study.cjs --option clé=valeur` (rejeu),
`tools/cursor-sweep.cjs` (comparaison à la base). Relevé :
`audit/curseurs-lot-2026-09-24.json` (base 4.7.14) et
`audit/curseurs-lot-2026-09-24-filtres.json` (filtres du choix, base 4.7.15) :
cuts gagnés, perdus et décidés autrement, par configuration.

## Base (règles de la 4.7.14)

| | Décidés | Jugés | Justes | Faux |
|---|---|---|---|---|
| Natif, 6 sessions | 448 | 293 | 290 | 3 : 398 (159,9 mm), 402 (273 mm), 983 (15 mm) |
| Pilote, 4 lots | 204 | 196 | 195 | 1 : 7026 (20,1 mm) |
| **Total** | **652** | **489** | **485** | **4** |

Étapes : 532 premiers passages, 48 reprises depuis la voie, 72 choix.

## Un curseur à la fois

Écarts à la base : cuts justes, faux, et ce qui les explique.

| Curseur (base) | Essai | Décidés | Justes | Faux | Lecture |
|---|---|---|---|---|---|
| `guardMm` garde de continuité (30) | 20 | 645 | −4 | 0 | 3 justes gagnés (dont 1834 de la partie 34), 7 perdus |
| | 40 | 653 | +1 | 0 | 1202 (partie 22) : reprise juste à 38,8 mm de la prédiction |
| `chooseMm` choix (15) | 10 | 645 | −5 | **−1** | retire le faux 7026, mais aussi 5 choix justes |
| | 20 | 651 | −2 | 0 | 2 choix justes perdus (7556, 5023), 1 cut non jugé gagné |
| `chainMm` reprise appui (10) | 5 | 650 | −2 | 0 | les reprises entre 5 et 10 mm ne sont plus appuis : 2 justes perdus (1201, 4521) |
| | **15** | **656** | **+4** | **0** | 4 justes gagnés, aucun perdu ; 5 décisions changées, toutes justes |
| | 20 | 656 | +4 | 0 | les mêmes 4 gains qu'à 15 mm : palier ; 3 décisions changées, toutes justes |
| `gap` voisinage (3) | 2 | 635 | −14 | 0 | 16 justes perdus, 1 faux gagné (405, 147,6 mm), 7026 perdu |
| | 4 | 655 | +3 | **+1** | faux 405 gagné, 402 perdu ; **1835 (partie 34) devient faux** (13,3 mm) |
| `anchors` appuis (2) | 3 | 651 | −1 | 0 | 9 décisions changées, dont 8435 : 2,1 → 8,3 mm |

Compléments, même base :

| Essai | Décidés | Justes | Faux | Lecture |
|---|---|---|---|---|
| `chainMm` 30 | 658 | +5 | **+1** | gagne 1202 et 1204, mais **1205 (partie 22) faux à 21,5 mm** : au-delà de 20 mm, une reprise lointaine devient appui et entraîne la suivante |
| `chainMm` 15 et `guardMm` 40 | 656 | +4 | 0 | identique à `chainMm` 15 seul : le gain de `guardMm` 40 disparaît |

## Filtres du choix (base : règles de la 4.7.15)

Un choix n'est jamais appui : ces filtres ne changent que les choix eux-mêmes,
sans effet sur les cuts suivants. Ce sont les filtres propres à la décision
sur le lot (`src/lot-decision.js`), pas les curseurs du moteur (`minTop` du
moteur reste 15, cahier §8). Base : 656 décidés, 489 justes, 4 faux.

| Curseur (base) | Essai | Décidés | Justes | Faux | Lecture |
|---|---|---|---|---|---|
| `minTop` points de dessus (15) | 1 | 681 | +13 | 0 | comme 3, un non jugé de plus |
| | 3 | 680 | +13 | 0 | 2 justes de plus qu'à 5, dont **765 à 10,0 mm**, au seuil du faux |
| | **5** | 676 | **+11** | 0 | 20 choix gagnés : 11 justes (0,6 à 8,1 mm), 9 non jugés, aucun perdu |
| | 10 | 663 | +4 | 0 | 7 choix gagnés : 4 justes (1139, 151, 496, 528 ; 1,2 à 3,9 mm), 3 non jugés, aucun perdu |
| | 20 | 653 | −2 | 0 | 2 choix justes perdus |
| `minFace` points de flanc (3) | 2 | 661 | +2 | 0 | 5 choix gagnés : 2 justes, dont 477 à **9 mm** (au bord du seuil de 10), 3 non jugés |
| `minTop` 10 et `minFace` 2 | | 669 | +6 | 0 | la somme des deux, sans interaction |
| | 5 | 646 | −6 | 0 | 6 choix justes perdus, dont 3 sur la partie 34 |
| `maxDzMm` écart vertical (20) | 10 | 642 | −10 | 0 | 10 choix justes perdus |
| | 30 | 655 | 0 | 0 | 1 choix non jugé perdu |

Tous les gains de `minTop` sont au banc Natif ; aucun lot Pilote relu ne
change. Aucun faux n'apparaît même à 1 point, mais sous 5 les cuts gagnés se
rapprochent du seuil (765 à 10,0 mm). **Retenu : 5** (4.7.16, D-050), avec la garde
d'écartement voisin à 20 mm (`audit/ecartement-voisin-2026-09-24.md`). La
combinaison, rejouée avec la partie 2 : 711 décidés, **+13 justes, −1 faux
(7026), aucun juste perdu** ; les gains des deux réglages s'additionnent.


## Décisions (D-047)

| Curseur | Valeur retenue | Décision |
|---|---|---|
| `chainMm` | **15** (était 10) | **Desserré en 4.7.15**, autorisé par la direction le 24/09 : +4 justes, 0 faux, 0 juste perdu ; 20 mm n'apporte rien de plus, 30 mm ajoute un faux. |
| `guardMm` | 30 | **Conservé.** 20 coûte 4 justes ; 40 ne gagne qu'un cut sur 653, gain qui disparaît avec `chainMm` 15. |
| `chooseMm` | 15 | **Conservé.** 10 retire le faux isolé 7026 pour 5 justes : D-042 (un faux isolé est toléré) ; 20 coûte 2 justes. |
| `gap` | 3 | **Conservé.** 2 coûte 14 justes ; 4 ajoute un faux sur un lot relu (1835). |
| `anchors` | 2 | **Conservé.** 3 : −1 juste, placements moins stables. |
| Garde de paire | active | **Conservée** (D-044) : bilan `audit/garde-paire-verification-2026-09-24.md`. |
| `minTop` du choix | **5** (était 15) | **Desserré en 4.7.16** (D-050) : +11 justes, 0 faux, 0 perdu (Natif seulement) ; 3 et 1 n'ajoutent que 2 justes, dont un au seuil. |
| `minFace` du choix | 3 | **Conservé.** 2 gagne 2 justes dont un à 9 mm ; 5 coûte 6 justes. |
| `maxDzMm` du choix | 20 | **Conservé.** 10 coûte 10 justes ; 30 n'apporte rien. |

## Les faux qui restent

Aucun curseur, dans les plages essayées, ne les retire sans coûter davantage de
justes :

- **398 et 402** (partie 20 longue, 160 et 273 mm) : premiers passages du
  moteur **sans aucun appui**, la décision sur le lot n'a rien pour les juger.
  C'est le chantier « faux sans appui » de l'analyste.
- **983** (15 mm, rail gauche) : premier passage à 3,9 mm de la voie de ses
  deux voisins. La garde de continuité ne peut pas le voir : il faudrait la
  descendre sous 4 mm, alors que la moitié des premiers passages avec appuis
  s'écartent déjà de la voie de 3,8 mm ou plus.
- **7026** (20,1 mm) : choix à un seul appui (KI-050), isolé, toléré (D-042).
