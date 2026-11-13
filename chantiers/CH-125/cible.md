# CH-125 : cible chiffrée (écrite et poussée avant le premier rejeu, D-222, D-352)

Écrite le 13/11, avant tout rejeu du banc (y compris celui du code livré) et avant toute mesure d'une variante. Toute retouche de ce fichier après le premier rejeu sera datée et dite comme telle.

## Référence
- Banc de CH-116 (`chantiers/CH-116/outils/banc.cjs`), corpus de CH-116 refait dans cette session (545 posés jugés au lot réel chez CH-116), juge de CH-113 (pire rail, 3D ; juste ≤ 10 mm ; mauvaise voie > 50 mm).
- Référence de comparaison : le rejeu du code livré (« livre », tronc `8c4f614`). CH-116 y comptait 561 posés jugés : 496 ≤ 10 mm, 36 de 10 à 50, 29 au-delà de 50, soit **496 / 532 = 93,2 % hors mauvaises voies**. Si mon rejeu « livre » diffère de ces comptes, je le dis avant toute autre mesure.

## Cible (toutes les conditions ensemble ; celles du ticket)
1. **Posés jugés ≤ 10 mm, hors mauvaises voies : ≥ 96 %**, sur le total des lots tenus à l'écart de la validation croisée « un lot dehors » (les 6 lots réglables, chacun jugé une fois par un réglage appris sur les autres), plus le lot d'examen 05/11, jugé une seule fois par le réglage appris sur les 6 réglables. Le chiffre est aussi donné sur les 6 lots réglables seuls et sur 05/11 seul.
2. **Aucun juste passé au-delà de 10 mm** : aucun posé jugé ≤ 10 mm au livré ne passe au-delà de 10 mm. Un juste du livré qui devient différé est compté à part (« bon bloqué »).
3. **0 nouvelle mauvaise voie** : aucun posé au-delà de 50 mm qui ne l'était pas au livré (posé déplacé ou nouveau posé).
4. **0 décision changée par ricochet.** Définition, fixée ici : un cut est « touché » quand la variante change la mesure de l'un de ses propres rails (au moins un appel de la mesure fait pour ce cut rend une pose différente de celle du livré, à 0,05 mm près) ; un ricochet est un changement d'état (posé ↔ différé) ou une pose déplacée de plus de 0,5 mm sur un cut NON touché. Les ricochets sont comptés à part, changements d'état et poses déplacées séparément ; la cible porte sur les changements d'état.
5. **Garde d'octobre verte** : `node tools/garde-gcv2.cjs --rejouer` sur les lots d'octobre de la base scellée, retour 0. Elle passe AVANT la validation croisée complète (R1) : une garde rouge écarte le réglage sans autre rejeu.
6. **Éteint = livré** : clé à `null`/`false`, rejeu identique au livré sur tous les cuts du corpus (état, étage, source, pose).

## Ce qui est compté à part à chaque jugement (R3)
- Deux familles, jugées séparément : **poses de la GCV2 seules** (source `gcv2`, dans le lot ou en passe) et **toutes les poses** (chaîne comprise). Pour chacune : poses déplacées de plus de 0,5 mm (nombre, médiane, maximum), jugées, rapprochées ou éloignées de la pose finale de l'opérateur, gagnées et perdues à 10 mm.
- Les poses de la chaîne déplacées sont listées en nombre : les déplacer demande une décision de l'opérateur (D-264), même avec la cible atteinte.
- La puissance de chaque examen est dite (R4) : combien de posés de 10 à 50 mm et de mauvaises voies il contient, par zone.

## Méthode figée
- **Mesure d'abord** : erreur par rail de la mesure livrée contre la pose finale de l'opérateur, par zone et par étage, puis celle de chaque variante en simulation statique (la mesure refaite sur le nuage du cut, sans rejouer les décisions). Lots réglables seulement : 04, 06, 08a, 08b, 11 et 12/11. **Le lot d'examen 05/11 n'est ni affiché ni lu pendant la conception.** Les examens vierges réservés (Échos du 12/11 parties 3 et 4, lot du 12/11 au soir parties 6 à 18, Écho du 13/11) ne sont ni extraits ni lus.
- Trois variantes à la source (ticket) : gabarit du champignon ajusté en moindres carrés robustes avec une incertitude par rail ; nuage de plusieurs coupes ; écartement tiré de la mesure jointe des deux rails. Chacune remplace la mesure là où elle est faite (`src/placement-convention.js` et ses appelants), en **patch éteint** ; aucun étage après la décision.
- Toute constante apprise l'est par pli, sur les seuls lots d'apprentissage du pli. La structure d'un réglage est figée et poussée (`chantiers/CH-125/reglages/`) avant son premier rejeu ; un réglage retouché après jugement est un nouveau réglage, dit comme tel. Ce qui a été regardé avant de figer est écrit dans le fichier figé.
- Ordre de jugement d'un réglage figé : éteint = livré, garde d'octobre, validation croisée, puis parité (`tools/parite-l1se-sw.cjs --passe`) sur le réglage final seulement.
- Pas de rattrapage, pas d'ombre, pas d'étage ajouté après la décision. Si la cible n'est pas atteinte, le rapport le dit avec la raison mesurée.
