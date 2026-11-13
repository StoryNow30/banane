# CH-121 : cible chiffrée (écrite et poussée avant le premier rejeu, D-222, D-352)

Écrite le 13/11 avant tout rejeu et avant toute mesure de l'étage d'ajustement. Toute retouche de ce fichier après le premier rejeu sera datée et dite comme telle.

## Référence
- Banc de CH-116 (`chantiers/CH-116/outils/banc.cjs`), corpus `corpus.jsonl` de CH-116 (545 posés jugés au lot réel), juge de CH-113 (pire rail, 3D ; juste ≤ 10 mm ; mauvaise voie > 50 mm).
- Référence de comparaison : le rejeu du code livré (« livre », tronc `7503dce`) refait dans cette session. CH-116 y comptait 561 posés jugés : 496 ≤ 10 mm, 36 de 10 à 50, 29 au-delà de 50, soit **496 / 532 = 93,2 % hors mauvaises voies**. Le chiffre de 90,5 % du ticket (CH-118, 371 / 410) vient d'un autre jeu (lots du 05 au 12/11, simulation statique) ; je le recalcule sur ce même jeu à titre de lien, mais **la cible se juge sur le banc**.

## Cible (toutes les conditions ensemble)
1. **Posés jugés ≤ 10 mm, hors mauvaises voies du livré : ≥ 95 %**, mesuré sur le **total des lots tenus à l'écart** de la validation croisée « un lot dehors » (chaque lot jugé par le réglage choisi sur les autres lots seulement), et rapporté à part sur le lot d'examen 05/11.
2. **Aucun juste dégradé** : aucun posé jugé ≤ 10 mm au livré ne passe au-delà de 10 mm.
3. **Aucune pose déplacée de plus de 30 mm** (pire rail, 3D) contre le livré, sur tous les posés, jugés ou non.
4. **0 nouvelle mauvaise voie** (aucun posé ≤ 50 mm au livré ne passe au-delà de 50 mm ; aucun nouveau posé au-delà de 50 mm).
5. Décisions inchangées (l'étage ne pose ni ne diffère : il déplace une pose déjà décidée) ; s'il change une décision par ricochet des appuis, chaque cas est listé.
6. **Garde** : `node tools/garde-gcv2.cjs --rejouer` sur les 11 lots d'octobre, aucun recul ; 14/10 partie 17 (rapport opérateur / dz de 0,64, CH-118 § 2 b) : aucun posé jugé passé au-delà de 10 mm, aucun au-delà de 20 mm ; chiffres publiés. Parité `tools/parite-l1se-sw.cjs --passe` sur le réglage final.
7. **Éteint = livré** : clé unique à `false`/`null`, rejeu identique au livré sur 4 016 cuts sur 4 016 (état, pose, motif).

## Méthode figée
- L'étage est une proposition en patch éteint (clé unique). Les variantes de réglage (seuils de points, bornes d'écartement, pas de déplacement) sont **chacune figée et poussée avant d'être jugée** (`reglages/`), puis rejouées au banc.
- Choix du réglage : validation croisée « un lot dehors » sur les 6 lots réglables (04, 06, 08a, 08b, 11, 12/11), coût = 100·(> 50) + 10·(10–50) + 50·(justes dégradés au-delà de 10 mm) ; l'examen 05/11 n'est jugé qu'une fois, par le réglage choisi sur les 6 autres. Réserve : CH-118 (`lateral.md` § 4) a déjà regardé 05/11 pour une règle d'écartement en abords à l'étage `deferred` ; si l'étage revient à une telle règle, 05/11 ne compte pas comme jamais vu.
- Un réglage retouché après jugement est un nouveau réglage, jugé comme tel.
- Pas de rattrapage, pas d'ombre : un gain du calcul ou rien. Si la cible n'est pas atteinte, le rapport le dit avec la raison mesurée.
