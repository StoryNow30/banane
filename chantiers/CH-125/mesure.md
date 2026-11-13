# CH-125 : la mesure d'abord (13/11, avant tout rejeu d'une variante)

Hors ligne, lecture seule. Outils : `outils/` ; sorties (comptes, numéros de cut, millimètres) : `sorties/`. Lots lus : les 6 lots réglables (04, 06, 08a, 08b, 11, 12/11 ; 359 cuts posés jugés, 718 rails) et, comme contrôle d'époque, le 14/10 partie 17 (table par rail de CH-118, lot déjà « vu », hors de la garde scellée). **Le lot d'examen 05/11 n'a été ni extrait ni affiché cut par cut** (seul son total au tableau standard du banc a été vu : 201 justes sur 202, donc aucune puissance pour un gain). Simulation STATIQUE : la mesure est refaite sur le nuage du cut à la pose livrée ; les décisions ne sont pas rejouées.

## 1. Référence (ÉTABLI)
Rejeu « livre » et corpus refaits : identiques à CH-116 (561 posés jugés : 496 ≤ 10 mm, 36 de 10 à 50, 29 au-delà de 50 ; 6 lots réglables : 295 / 35 / 29).

## 2. Erreur par rail de la pose livrée (ÉTABLI, 660 rails hors mauvaises voies ; `sorties/mesure-statique-novembre.md`)
| | rails | travers : p90, part > 5 mm | hauteur : p90, part > 5 mm |
|---|---|---|---|
| tous | 660 | 5,4 mm, 10,9 % | 3,3 mm, 7,0 % |
| GCV2 dans le lot (`deferred`) | 236 | 7,7 mm, 17,8 % | 3,3 mm, 5,1 % |
| chaîne, premier passage | 270 | 3,2 mm, 5,6 % | 3,7 mm, 8,5 % |
| chaîne, choix | 58 | 6,1 mm, 13,8 % | 6,6 mm, 12,1 % |
| zones : abords / ADV / PN | 158 / 436 / 66 | 8,9 % / 11,0 % / 15,2 % | 2,5 % / 7,8 % / 12,1 % |

## 3. Ce que l'opérateur suit quand il retouche (ÉTABLI sur ces lots ; `sorties/enveloppe-*.md`, `predicteurs-*.md`, `forme-surfaces-*.md`)
- **Hauteur, novembre** (101 rails retouchés) : il pose le dessus du gabarit à l'ENVELOPPE des points visibles. La statistique la plus resserrée est un compte absolu, le 8e point le plus haut (étendue q75 − q25 de 3,0 mm), devant le 90e centile (4,0) et la médiane (4,6). La constante apprise par pli est stable (0,4 à 0,9 mm).
- **Hauteur, 14/10 partie 17** (223 rails retouchés) : aucune statistique du nuage ne prédit sa hauteur à mieux que 8,9 mm d'étendue (médiane) ; l'enveloppe y est la pire (11,4). Sur 147 rails au calage appliqué, il DESCEND le rail de 4,5 mm en médiane. Deux régimes, donc ; la cause (nuage plus bruité, autre geste) reste SUPPOSÉE.
- **Patin** : le gabarit entier (champignon, âme, patin) a été ajusté. En novembre, la hauteur choisie ne suit pas le patin (pente 0,14 contre l'écart dessus-patin du nuage) ; le patin seul prédit mal (étendue 8,8 mm). Piste écartée.
- **Travers** (145 rails retouchés) : la médiane du flanc est la statistique la plus resserrée (3,9 mm), pas une enveloppe.
- **Pente le long de la voie** : la tranche visible fait ±0,25 m ; le dessus y penche de 3,2 mm par m en médiane (q90 9,6). Les bandes « épaisses » du 12/11 (parties 0 et 23) sont des dessus inclinés, que l'opérateur enveloppe par le bout haut.

## 4. Les 35 posés de 10 à 50 mm des lots réglables (ÉTABLI, `sorties/liste-10-50-novembre.txt`)
- **Hauteur, rail refusé posé brut** : 14 cuts (10 sur le 12/11, chaîne ; 0611 16/9237 ; trois poses de la GCV2). Le calage livré y mesure un décalage de 8 à 12 mm et s'abstient.
- **Travers d'une pose de la GCV2** : 9 cuts environ. Origines lues au rejeu : rail déplacé par la correction d'écartement de L1-e (08/11b 6/228, 6/232 ; 11/11 16/4565), hypothèse non mesurée sur le nuage (H0, H5 : 06/11 13/8012, 13/8061), cellule au calage refusé en travers (11/11 16/5854, 5856).
- **Autre élément** (le rail juste est à 17 à 42 mm, ou la pose finale ne suit pas le champignon) : 12 cuts. Hors de portée d'une mesure locale.

## 5. Variantes en simulation statique, constantes apprises par pli (ÉTABLI ; `sorties/mesure-statique-*.md`)
| variante | novembre, 6 lots : gagnés / perdus à 10 mm | cuts déplacés | 14/10 p17 : gagnés / perdus |
|---|---|---|---|
| hauteur = médiane + c, **rails refusés seulement** | **14 / 0** | 33 | **23 / 0** |
| même chose, flanc relu à la hauteur corrigée (− 2,6 mm) | 14 / 0 | 33 | 23 / 0 |
| hauteur = 8e point le plus haut + c, rails refusés seulement | 14 / 0 | 33 | 23 / **23** |
| hauteur = médiane + c, tous les rails | 14 / 1 | 267 | non mesuré |
| travers = médiane du flanc + k, tous les rails (points chargés, point fixe) | 12 / 2 | 320 | non mesuré |
- L'enveloppe gagne autant que la médiane en novembre et perd en octobre : **la médiane + c reste la mesure de hauteur** (acquis de CH-121), appliquée à la source et aux seuls rails que le calage refuse aujourd'hui.
- **Nuage de plusieurs coupes** (`sorties/flanc-compte-novembre.md`) : sur 5 146 rails posés, 464 ont moins de 6 points de flanc visibles (430 sur le 06/11) ; 415 en ont 6 avec les points déjà chargés hors de la découpe (±0,5 m, même capture) ; les coupes voisines n'en ajoutent que 11 (un lot ne visite pas des cuts consécutifs : 148 rails seulement ont un voisin).
- **Correction d'écartement de L1-e** (`sorties/correction-ecartement-novembre.txt`) : 17 appliquées et jugées, 10 rapprochent la pose de l'opérateur, 4 l'éloignent ; ≤ 10 mm : 2 avant, 7 après.

## 6. Ce que cela fixe pour la suite
- Niveau 1 (hauteur) : dans `calibrate`, un rail refusé pour sa seule hauteur reçoit la médiane du dessus + c (point fixe), puis le flanc relu à cette hauteur. Attendu au mieux : 11 cuts de la chaîne et jusqu'à 3 de la GCV2, soit 95,3 à 95,9 % sur 7 lots : **la cible de 96 % demande aussi un gain en travers**.
- Niveau 2 (travers) : points chargés sous 6 points de flanc visibles ; pose de la GCV2 non mesurée ou déplacée par la correction d'écartement, relue sur le flanc.
