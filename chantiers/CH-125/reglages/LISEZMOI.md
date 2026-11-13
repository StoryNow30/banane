# CH-125 : réglages figés

Un réglage est figé et poussé ici AVANT son premier rejeu. Un réglage retouché après jugement est un nouveau fichier, dit comme tel.

## niveau1.json (figé le 13/11 au soir, avant tout rejeu d'une variante)
**Ce qu'il fait** (`mesure-source.patch`, clé `conventionSource`, `null` au livré) : dans `calibrate` de `src/placement-convention.js`, un rail que le calage livré refuse pour sa SEULE hauteur (|q90 + 1| > 8 mm, travers dans le domaine) n'est plus posé brut. Sa hauteur est la médiane des points du dessus + c, cherchée en point fixe (la bande de ±12 mm est relue à la hauteur corrigée, 8 tours au plus) ; puis le flanc est relu à cette hauteur, avec les constantes du livré (médiane − 2,6 mm dès 6 points, dans le domaine de 8 mm, sinon pas de correction latérale). Le motif `shift-out-of-domain` est gardé : la garde de paire le lit toujours. La mesure s'abstient (rail refusé comme au livré) si le point fixe ne converge pas, si la bande du dessus est épaisse (q90 − q10 > `epMaxMm`) ou si la correction dépasse `dzMaxMm`. Aucun autre rail n'est touché.

**Structure, fixée a priori** : `epMaxMm` 15 et `dzMaxMm` 13 (les bornes de l'étage de CH-121, reprises telles quelles) ; point fixe ; flanc relu aux constantes du livré.

**Constante c, apprise par pli** (`outils/c-par-pli.cjs --octobre`) : médiane de (hauteur finale de l'opérateur − médiane du dessus) sur TOUS les rails jugés refusés pour leur seule hauteur, retouchés ou laissés, des lots d'apprentissage du pli, plus le 14/10 partie 17 (hors du banc et hors de la garde scellée, déjà « vu » par CH-118 et CH-121) ajouté à chaque pli pour que c porte sur les deux époques. Valeurs : 5,1 mm (plis 04/11, 08/11a, 11/11), 5,2 (06/11, 08/11b), 4,2 (12/11) ; **5,1 pour le réglage final** (05/11 et garde d'octobre).

**Ce qui a été regardé avant de figer** (dit tel quel) :
- le rejeu du code livré et des simulations STATIQUES (la mesure refaite sur le nuage à la pose livrée, décisions non rejouées) sur les 6 lots réglables et sur le 14/10 partie 17 : `mesure.md`, `sorties/` ;
- la sensibilité statique à c, de 3,5 à 6,0 mm : novembre 14 gagnés / 0 perdu sur toute la plage ; 14/10 partie 17 : 21 à 24 gagnés, 0 perdu jusqu'à 5,5, 1 perdu à 6,0. Les valeurs retenues sont dans le plateau ;
- les deux définitions de c : « tous les refusés » (retenue : 5,1) et « refusés retouchés » (6,2, au bord du plateau). Le choix de la définition a donc été fait en connaissant ces simulations statiques ; il n'a été fait sur aucun rejeu d'une variante ;
- le lot d'examen 05/11 n'a été ni extrait ni affiché cut par cut ; les examens vierges réservés n'ont pas été lus ; aucun rejeu de la garde d'octobre n'avait tourné.

**Jugement, dans l'ordre** (`cible.md`) : éteint = livré ; garde d'octobre au banc avec le jugement R6 (`outils/oct-chaine.cjs`) ; validation croisée ; parité sur le réglage final.
