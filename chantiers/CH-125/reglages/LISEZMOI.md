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

**Suivi (14/11)** : garde d'octobre au banc à l'ÉTEINT (patch appliqué, clé `null`) : retour 0, 0 recul, 0 « vert changé » (12 lots, 13/11 au soir, patch d'avant la fusion du tronc). Le patch a ensuite été replacé sur le tronc `a756988` : mêmes lignes ajoutées, crochet du banc déplacé de quelques lignes (voir `niveau1.json`). Jugements : `BANC_ZONES=journal` (R5 tranchée, audit 4) ; la garde, elle, se compare à la base scellée et se rejoue avec les réglages de cette base.

## travers.json (figé le 14/11, avant tout rejeu du levier `flancSource`)
**Ce qu'il fait** (`flanc-source.patch`, levier `flancSource` de la décision L1-e, absent des leviers livrés) : à la fin de `deciderL1e`, quand une paire est VALIDÉE, le flanc de chaque rail est relu à sa pose, fenêtre centrée sur elle, par la mesure du calage de convention (médiane des points du flanc − 2,6 mm, 6 points au moins, bande de 12 mm ; bande large de `maxMm` si la bande est vide). Si ce premier pas contredit la pose d'au moins `seuilMm`, le flanc est suivi en point fixe et le rail prend sa place, à `maxMm` au plus. La hauteur n'est pas touchée, l'état du cut ne change jamais.

**Structure, fixée a priori** : borne `maxMm` 20 ; 6 tours ; écartement de la paire mesurée libre dans le contrat (1 420 à 1 470 mm), jamais plus loin du contrat que la paire reçue (il n'est PAS ramené à la référence de la liste) ; soutien du nuage de L1-e exigé à la nouvelle place ; garde de voie absolue relue sur la paire mesurée. **Flanc propre** : la pose est gardée si plus du tiers des points lus sont à 3 mm de l'écart que la convention attend (elle a son flanc) ; la place suivie n'est prise que si au moins le tiers de ses points l'appuient. Propagation « A » : la pose de la décision est la pose mesurée (commande, voisins, transport lisent la même).

**Seuil, appris par pli** (`outils/travers-gcv2.cjs`, simulation statique) : le plus petit entier de 3 à 8 mm qui n'éloigne aucun cut GCV2 jugé des lots d'apprentissage de plus de 1 mm de la pose finale de l'opérateur. Valeurs : 5 mm pour cinq plis, 3 mm pour le pli sans le 12/11 ; **5 mm pour le réglage final** (05/11 et garde d'octobre).

**Ce qui a été regardé avant de figer** (dit tel quel) :
- les simulations STATIQUES sur les 118 cuts jugés posés par la GCV2 des 6 lots réglables (`sorties/travers-gcv2-novembre.md`) : seuils de 3 à 8, bornes de 12 à 25, une application ou suivi, départ large ou non. Au seuil final : 19 cuts déplacés, 18 rapprochés, 0 éloigné, 8 passent sous 10 mm, 0 perdu ;
- la garde du flanc propre a été ajoutée après avoir vu, en novembre, un rail aux deux nappes (06/11 16/9178 : médiane entre les deux, la pose était juste) et la table des parts d'appui (0 à 25 % pour les 24 rails rapprochés au seuil de 5 ; 29 à 50 % pour les 5 rails éloignés sous 5 mm). Le tiers et les 3 mm ont été choisis en la connaissant ;
- le verdict de la garde du niveau 1 (hauteur à la source, propagée) : rouge par ricochets. Il n'a pas servi à régler la mesure du travers, mais il fait attendre des ricochets de la propagation « A » ;
- les trois cuts d'octobre que le latéral de CH-121 avait dégradés (2-17 9803, 2-20-fd7067f7 288, 0-2310-lot1 4) sont connus par son rapport ; leurs nuages n'ont pas été lus. Aucun nuage d'octobre de la garde n'a été lu pour concevoir le travers ; le lot d'examen 05/11 non plus.

**Ce qui distingue ce flanc du latéral de CH-121 (aj3)** : aj3 appliquait une fois la médiane du flanc − 2,6 mm à TOUTE pose (chaîne et GCV2) dès 4 mm d'écart, jusqu'à 12 mm, en fin de chaîne. Ici : paires validées par la GCV2 seulement ; seuil de 5 mm appris par pli ; flanc suivi (jusqu'à 20 mm) ; pose gardée si elle a son propre flanc ; écartement dans le contrat.

**Repli annoncé avant le rejeu** : si la garde de « A » est rouge par ricochets seulement (cuts non touchés), la même mesure, mêmes constantes, sera rejouée en propagation « B » (la pose mesurée est écrite, les voisins et le transport gardent la pose de la décision, comme aj5 de CH-121). Ce sera un nouveau réglage, dit comme tel. Si des cuts TOUCHÉS sont dégradés, la mesure elle-même est en cause et le réglage est écarté.

**Jugement, dans l'ordre** : éteint = livré ; garde d'octobre au banc avec le jugement R6 (`outils/oct-poses.cjs`) ; validation croisée (`BANC_ZONES=journal`) ; parité sur le réglage final.

**Verdict (14/11)** : garde d'octobre ROUGE (retour 1), réglage ÉCARTÉ. Des cuts touchés sont dégradés (2-17 9803, 2-20-fd7067f7 288, 0-2310-lot1 4 et 193 ; deux justes passent au-delà de 10 mm) : par la règle écrite ci-dessus, la mesure est en cause et la variante « B » n'est pas rejouée. Détail et diagnostic : `sorties/garde-travers.md`. Aucun pli de novembre n'a été rejoué (R1). `flanc-source-b.patch` (mode `ecrite`) reste un patch non figé : éteint = livré sur le 08/11b (225 lignes), aucun rejeu allumé.
