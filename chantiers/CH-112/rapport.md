# CH-112 : mauvaise voie en zone d'aiguillage (rapport, D-346)

Étude hors ligne. Aucun fichier de l'extension touché. Outils : `chantiers/CH-112/outils/` ; sorties par cut (numéros et millimètres) : `banane-data/outils/analyse-lots/CH-112/sorties/`, à verser dans `banane-data/outils/analyse-lots/CH-112/`.

## Données (ÉTABLI)
- Lots jugés rejoués : 11/11 (p15, p16, p17, Échos du 12/11), 06/11 (p13, p15, p16), 05/11 (p8 à p12, examen), 08/11 (p3, p4, p6). Jointures refaites avec `tools/jointure-echo-orbite.cjs --visite-sans-action-bonne` ; un posé vu sans action compte pour juste. Comptes du 11/11 identiques aux NOTES (p16 : 378 posés, 11 faux > 10 mm, 7 > 100 mm ; p17 : 34 revus, pire 28 mm).
- En tout : 2 548 posés, 812 jugés justes (≤ 10 mm), dont 297 en zone `adv: alerte`, et **17 faux de plus de 50 mm** (7 le 11/11, 7 le 06/11, 3 le 08/11 p6 ; aucun le 05/11).
- Partie 1 du 10/11 : Écho seul, sans lot ni pose d'Ariane. Elle sort du champ.

## Ce que montrent les traits (ÉTABLI, p16 du 11/11)
- Dans les deux zones fautives (3954-3975, 4504-4577), **les lignes validées d'office par ESV et les différés sont tous à 120-260 mm de la pose finale** : la liste d'ESV y suit l'autre voie. Les 7 faux d'Ariane collent à ces voisins ; les bons de la zone (3970, 4517-4522, 4565…) s'en écartent de 150 à 500 mm.
- D'où l'échec des traits locaux : saut par rapport aux voisins de la liste (3 à 5 faux arrêtés pour 9 à 25 bons), `advRails`, GCV1 (confiance, concurrents), déplacement d'Ariane, garde de voie (2/7), `adv: alerte` seule (27 bons par faux). L'écartement est normal des deux côtés, et le nuage seul ne permet pas de dire quelle voie est la bonne. Les nuages n'ont pas été rejoués.

## Le signe : « voie des cuts sûrs » (`outils/regle-voie.cjs`)
Il est rejoué dans l'ordre du lot. **Références sûres** : uniquement les cuts posés plus tôt par le lot et non arrêtés (journal du lot, connu en direct). Aucune ligne de la liste d'ESV ne sert de référence. Une première version prenait aussi les lignes « traitées par l'opérateur » hors du lot ; pour le 11/11, le drapeau venait d'un instantané postérieur. Sans elles, les chiffres sont identiques, et ces lignes ont été retirées. Pour un cut posé en `adv: alerte`, on mesure le décalage latéral, dans l'axe latéral du profil du cut, de chaque rail par rapport au même rail du dernier cut sûr situé au plus **G = 12 cuts** en arrière (écart g). **Arrêt (différé)** si les deux rails vont du même côté et que leur moyenne dépasse **S = 100 mm + K·g²**. Un cut sans référence passe mais ne devient pas sûr.

**Historique des réglages.** S = 100 et G = 12 ont été figés sur la p16 du 11/11, avec K = 0. Après le rejeu des autres lots, j'ai ajouté **K = 2** (courbure, rayon d'environ 250 m), au vu de 08/11 181 et 182. Les deux comptes sont refaits sur toutes les parties :

| | faux > 50 mm arrêtés | bons bloqués | arrêts / posés (11/11 · 06/11 · 05/11 · 08/11) |
|---|---|---|---|
| Figé sur p16 (K 0, S 100, G 12) | 12/17 | 2/812 (08/11 181, 182) | 16/2 548 (6 · 6 · 0 · 4) |
| **Retenu (K 2, S 100, G 12)** | **12/17** (71 %, Wilson 47-87 %) | **0/812** (borne haute 0,47 %) | **13/2 548** (6 · 6 · 0 · 1) |
| K 2, G 16 (non retenu) | 13/17 (+3968) | 4/812 (11/11 3970, 3971, 4517, 4518) | 18/2 548 (11 · 6 · 0 · 1) |

- Par lot (retenu) : 11/11 6/7 (p15 et p17 : 0 arrêt) ; 06/11 5/7 ; 05/11 0 arrêt sur 831 ; 08/11 1/3. S de 60 à 120 mm donne les mêmes chiffres.
- G 16 prend 3968 mais bloque 4 bons du 11/11. Sur les autres lots, il ne coûte rien de plus (mêmes arrêts au 06/11 et au 08/11).
- Les 11 faux de 10 à 40 mm ne sont pas touchés (décalages de −10 à +20 mm) : ce ne sont pas des mauvaises voies.
- Manqués (5) : 3968, 7260 et 7423, faute de cut sûr à moins de 12 cuts ; 360 au 08/11, en `marge-apres` (décalage 140 mm), et 361 qui le suit. Étendre l'arrêt aux marges : 14/17, avec 1 bon bloqué (06/11 9274).
- Abstention : 25 cuts sans référence sur 764 posés en zone alerte (3,3 %).
- Validation croisée par plages (PROBABLE) : réglé sur le 11/11 seul, le signe prend 6/10 ailleurs et bloque 2 bons. Avec K = 2, réglé ailleurs, il prend 6/7 au 11/11 sans bloquer de bon. Le terme K a été choisi après avoir vu les autres lots : seule la prochaine séance Écho fera examen.

## Coût en différés
Retenu : 13 cuts mis en attente sur 2 548 posés (0,5 %). Au 11/11 : 6 (tous en p16) ; au 06/11 : 6 ; au 05/11 : 0 ; au 08/11 : 1. Douze sont des mauvaises voies. Le treizième, 06/11 p16 8997 (127 mm), n'a pas été jugé : c'est l'un des « deux alignements » 8996-9003 que CH-100 demandait de regarder. La deuxième passe (plafond 10, D-259) pourrait en réécrire, mais ce n'est pas mesuré.

## Forme dans l'extension : en ombre seulement
Un événement `voie-sure-ombre` au journal, sur le modèle de `garde-voie-ombre`, pour chaque cut posé en zone `adv: alerte`. Il contient : écart en cuts à la référence, décalages gauche et droit, seuil, motif (`ok`, `sans-reference`, `autre-voie`) et `auraitDiffere`. La mémoire du lot se limite aux poses des cuts posés et non signalés. Aucune action : pas de différé, pas de commande. L'allumage reste à décider plus tard, avec l'accord écrit de l'opérateur et les chiffres de l'ombre (taux d'abstention, signalements sur les lots sans Écho). Comme module de décision, il passerait par un patch, la garde de pose et la parité.

## À demander
- Une séance Écho sur les zones `adv: alerte` du prochain lot : seul examen vierge du signe.
- Un coup d'œil sur 06/11 p16 8996-9003 (8997 signalé par le signe).
