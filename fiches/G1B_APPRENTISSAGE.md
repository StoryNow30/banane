# G1-b — L'apprentissage de la GCV2 (19 octobre 2026)

Chantier G1-b (`G0_GCV2_CONCEPTION.md` § 2 « Étage 2 » et « Étage 3 », § 3 et § 4 ; D-201). Étude **hors ligne** : rien sous `src/` ne change, `src/engine.js` n'est pas touché, aucune action dans ESV. L'outil est `tools/gcv2-apprendre.cjs` (modes `valider`, `exporter`, `rapport`) ; l'essai est `tests/gcv2-apprendre.test.cjs` ; les paramètres appris sur les 11 parties sont dans `datasets/gcv2-parametres.json`. Les parties sont désignées par leur rang (« 1:29 » = projet 1, partie 29). Seuls des numéros de cut, des millimètres et des comptes figurent ici.

## 1. En bref

| Question | Réponse |
|---|---|
| **La porte du plan est-elle tenue ?** | **Non, dans les deux usages.** Elle demande : 0 mauvaise voie, erreur ≤ 9 % parmi les actions, corrections justes ≥ règle prudente, abîmés ≤ règle prudente. La GCV2 apprise a **5 mauvaises voies** (toutes dans la partie 2:1, toutes aux abords) et **plus de cuts abîmés** que la règle prudente (6 contre 4 en relecture, 9 contre 4 au lot). |
| **Usage « relecture »** (voisins humains permis) | 2 411 cuts jugés. La GCV2 agit sur 392 cuts : **144 corrections justes** (100 à 5 mm), 6 abîmés, 5 mauvaise voie, 26 erreurs (**6,6 %**, Wilson ≤ 9,5 %). La règle prudente : 136 actions, 107 justes, 4 abîmés, 0 mauvaise voie, 10 erreurs (7,4 %). |
| **Usage « lot »** (sans pose humaine) | La GCV2 agit sur 466 cuts : **125 justes** (92 à 5 mm), 9 abîmés, 5 mauvaise voie, 30 erreurs (**6,4 %**, Wilson ≤ 9,0 %). |
| **Dans le périmètre de la règle prudente** (verts de PN, ADV et abords) | Relecture : 244 actions, **105 justes contre 107**, 3 abîmés contre 4, **0 mauvaise voie**, erreur 5,3 % (Wilson ≤ 8,9 %). Lot : 94 justes, 3 abîmés, 1 mauvaise voie. La porte y est manquée de **2 corrections justes** en relecture. |
| **Le hasard** | Une paire tirée au hasard sous les mêmes garde-fous, avec le même taux d'action : **20 corrections justes** (en espérance) et **50 % d'erreurs**. La GCV2 apprise est loin du hasard : c'est la condition 3 de D-201, tenue. |
| **Ce qui est gagné** | Contre la règle prudente, la GCV2 corrige **37 cuts justes de plus** en relecture (144 contre 107) : **hors zone** (23 justes, la règle n'y agit jamais), en **PN** (69 contre 56) et en **ADV** (38 contre 18). Elle **perd aux abords** (14 justes contre 33). |
| **Ce qui manque** | Les **abords** (214 des 406 grosses corrections) : sous les garde-fous, seules 35 % de ces corrections ont une paire à 10 mm (`§ 5.4`) ; la GCV2 y fait 16 erreurs sur 58 actions. Le **rappel atteignable sous garde-fous** est de 57,1 % (relecture) et 53,9 % (lot), contre 83,7 % sans garde-fous (G1-a). |
| **Calibrage** | Brier de p(10 mm) : 0,043 (relecture) et 0,0446 (lot), hors-échantillon. La courbe de fiabilité tient entre 60 et 100 % ; elle est trop confiante entre 10 et 50 % (p 0,35, observé 0,27). |
| **Petits arbres** | **Non retenus** : Brier −3,6 %, perte logistique −4,6 % (en validation croisée par partie, sur les hypothèses), moins de 5 % : pas « nettement ». |
| **Export** | `datasets/gcv2-parametres.json` (44 ko), appris sur les 11 parties, reproductible octet pour octet. |
| **Variantes par zone** (§ 11, choisies après coup en D-204) | **V1** (GCV2 sur les verts de PN et d'ADV, règle prudente sur les verts des abords) tient la porte en relecture et au lot : 128 justes contre 107, 2 abîmés contre 4, 0 mauvaise voie, erreur 3,5 %. V2 et V3 ne la tiennent pas (5 abîmés contre 4). Le juge sera G1-c. |

**Lecture honnête.** La GCV2 corrige nettement plus que la règle prudente (+35 %), avec une erreur globale du même ordre (6,4 à 6,6 % contre 7,4 %), mais elle ne tient pas la règle « 0 mauvaise voie » à cause d'une seule partie (2:1, 5 cuts) et de la zone des abords. Elle n'est **pas prête à agir sans garde supplémentaire**. Aucune activation n'est proposée ici : elle reste à Mic. Les sensibilités du § 7 (hors porte, après coup) montrent que le résultat ne change pas de nature quand on durcit l'erreur visée ou qu'on retire les traits d'accord.

## 2. Méthode

### 2.1 Exemples et étiquettes

Un exemple = (partie, cut, rail, hypothèse) d'un jeu de `gcv2-jeu.cjs` (G1-a). Étiquettes binaires : l'hypothèse est à **10 mm** (à **5 mm**) de la pose finale de Mic (3D, repère profil). Seuls entrent les cuts **calculés** (le moteur a tourné : un nuage) avec une référence pour les deux rails : **2 411 cuts, 56 936 hypothèses** (53 354 au lot). Les 1 342 cuts sans nuage n'entrent pas : aucune GCV2 ne peut agir dessus.

L'outil **refuse** de lire un jeu de jugement, un témoin fixe (1:11, 1:25) ou une partie qui n'est pas d'apprentissage au manifeste (la partie réservée 2:6 en est une) : l'essai le vérifie.

### 2.2 Liste blanche des traits (condition 1 de D-201)

Les traits sont lus **champ par champ** dans une liste écrite dans l'outil (`NUM`, `CAT`, `MULTI`) et exportée dans le fichier de paramètres. 50 colonnes numériques ou booléennes (dont 11 booléens), 10 catégories, 3 listes à indicateurs :

| Groupe | Contenu |
|---|---|
| **Traits de l'hypothèse** (`traits`) | perte, ratio de perte, lignes au sommet, faces, points du dessus et du flanc, épaisseur du dessus, distance à la cellule la plus proche, `dz` et `du` de convention, déplacement depuis le départ, écart à la voie prédite, écart aux voisins, écart de la paire à la médiane (avec l'autre rail au départ, et meilleur possible), correction de hauteur ; STRONG, pente, fenêtre, compétitive, A*, publiée, S1 ; palier, convention, groupe de hauteur, étage de la chaîne, abstention de hauteur ; balises du réservoir |
| **Traits du rail** (`rail`) | statut et motif du moteur, confiance et rapport de perte de A*, S1, concurrents forts, cellules compétitives, grappes, cellules STRONG, taille du réservoir, points du rail, perte minimale |
| **Contexte** (`contexte`) | étage de la chaîne, appuis de la chaîne, voisins (nombre, humains, lot, encadrement, distance du plus proche), écart de départ à la médiane de la partie |
| **Zone, rôle, origine, hauteur** | zone (PN, ADV, abords, liste, hors), rôle (vert, rouge, différé), origines H0 à H5 et sous-origines, drapeau « hauteur » |
| **Accord** (ajout, calculé sur `decal` seul) | combien d'autres hypothèses du rail sont à 5 mm et à 10 mm, distance à la plus proche, à H1, à la pose de la chaîne, à l'interpolation des voisins, nombre d'origines qui mènent à la pose |

**Interdits** : `visites`, `reference`, `etat`, `etiquette`, `micRailMm`, `micMaxMm`, `grosse`, `ecartMm`, `classe` et tout nom commençant par `mic`, `etiquette`, `reference` ou `visites`. Trois garanties : (1) une liste blanche qui en nomme un est **refusée** (`verifierListeBlanche`) ; (2) les traits sont lus par chemin, un champ glissé dans `traits` ou changé dans la ligne de cut est **ignoré** ; (3) l'essai change `visites`, `reference`, `etat`, `etiquette` et `micRailMm`, y compris dans les traits, et vérifie que traits bruts, scores à 10 et à 5 mm et coefficients appris sont **identiques**. Les champs de la ligne `moteur` du cut (abstention, écartement rejeté) ne sont **pas** dans la liste : le motif d'abstention par rail y est déjà.

L'ajout « accord » n'est pas dans la liste de la consigne ; il ne lit que les décalages des hypothèses (aucune étiquette). Il gagne au niveau des hypothèses (perte logistique 0,1645 contre 0,1779, Brier 0,0466 contre 0,0517), mais **pas au niveau de la paire** (§ 7).

### 2.3 Modèle

- **Régression logistique L2** par la méthode de Newton, dans le script (aucune dépendance). λ = 30 ; l'ordonnée n'est pas pénalisée. Deux modèles : p(à 10 mm) et p(à 5 mm).
- **Codage** : traits numériques en signe·ln(1+|x|) ou log10 quand ils sont à queue lourde, puis moyenne et écart du **pli d'apprentissage seulement** (pondérés par partie), bornés à ±6 écarts ; un trait manquant vaut la moyenne et allume un indicateur « manque » ; catégories et balises en indicateurs, vocabulaire du pli d'apprentissage seulement (au moins 20 exemples). 150 colonnes en relecture, 149 au lot.
- **Pondération** : chaque partie pèse autant (somme des poids = nombre d'exemples).
- **Calibrage de Platt**, appris sur les scores **hors-échantillon** du pli d'apprentissage : chaque partie d'apprentissage est notée par un modèle qui ne l'a pas vue (10 modèles internes par pli). Pente toujours positive : le calibrage est monotone.
- **λ** a été choisi (3, 30, 300) sur la perte logistique de la validation croisée par partie **au niveau des hypothèses**, avant tout chiffre de paire : mesure faite sur les 11 parties, donc légèrement optimiste (§ 8).
- **Petits arbres** (option) : 50 arbres de profondeur 3 au plus, comparés au niveau des hypothèses seulement : Brier 0,0449 contre 0,0466 (−3,6 %, meilleur dans 9 plis sur 11), perte 0,1570 contre 0,1645 (−4,6 %, meilleur dans 5 plis sur 11), AUC égal (0,9731). Critère posé avant de lire la mesure : un gain d'au moins 5 % du Brier, sur au moins 8 plis sur 11. **Non retenus.** Le code reste dans l'outil (`ajusterArbres`).

### 2.4 Décision de paire (étage 3)

1. **Garde-fous non appris**, appliqués avant tout score : écartement de la paire à **15 mm de la médiane** de la partie **ou** dans **1 420–1 470 mm** ; chaque rail déplacé de **45 mm au plus en latéral** depuis la pose de départ ; changement de dévers (écart de hauteur entre les deux rails, par rapport au départ) de **15 mm au plus**. Ne rien faire (H0, H0) est toujours permis.
2. **Choix** : parmi (H0, H0) et les paires permises, celle qui maximise p_gauche × p_droite à 10 mm (71 paires permises par cut en moyenne).
3. **Agir** seulement si p ≥ τ **et** si l'écart de la paire à H0 (le plus grand |latéral| ou |vertical| des deux rails) est ≥ δ. Si la meilleure paire est H0, ou à moins de δ de H0, ou si la zone est inactive : **laisser**. Si la paire est loin de H0 mais p < τ : **abstention**.
4. **τ et δ par zone**, choisis sur les scores **hors-échantillon du pli d'apprentissage** : grille τ de 0,30 à 0,99, δ de 2 à 30 mm ; contraintes : **0 mauvaise voie**, **erreur parmi les actions ≤ 9 %**, au moins 10 corrections justes dans la zone (sinon la zone est inactive, comme dans RELECTURE_AUTONOME) ; objectif : le plus de corrections justes, puis le moins d'erreurs, le moins d'abîmés, les seuils les plus hauts.

### 2.5 Deux usages

- **Relecture** : tout le jeu, H4 avec voisins humains.
- **Lot** : au lot, aucune pose de Mic n'existe. L'outil retire les hypothèses H4 dont la seule source est humaine (3 582 : 56 936 hypothèses deviennent 53 354), retire H4 des hypothèses où il s'était confondu avec une autre origine, annule `ecartVoisinsMm` et les comptes de voisins des cuts dont les voisins étaient humains, et **recalcule** l'écart de la paire à la médiane sans les hypothèses retirées (formule du § 2.6). **Limite** : le jeu ne porte pas les poses des voisins ; pour un cut à voisins **mixtes** (humains et lot), l'interpolation « voisins du lot seuls » ne peut pas être recalculée, elle est perdue. Seule une interpolation pure du lot est gardée. Pour la corriger il faudrait ajouter au jeu, par cut, une seconde interpolation `H4-lot` calculée sans les poses humaines (champ `sous: voisins-lot` même quand des humains existent). Dans G1-a, les voisins du lot seuls n'atteignaient que 3,9 % des grosses corrections : la perte est petite.

### 2.6 Écartement de la paire à partir du jeu

Le jeu ne porte pas les positions. L'écartement de la paire (gauche i, droite j) est estimé par `G0 + (g_i − G0) + (g_j − G0)`, où `G0` est l'écartement de départ et `g` l'écartement du rail avec l'autre rail laissé au départ (trait `ecartementAutreH0Mm`). Contrôle contre le calcul exact du jeu (`ecartPaireMedMm`) sur 32 820 hypothèses : écart de 0,3 mm au plus dans 97,1 % des cas, de plus de 1 mm dans 0,3 %. Le dévers absolu de départ n'est pas dans le jeu : le garde-fou porte sur **le changement** de dévers. « Rails dans la vue capturée » n'est pas vérifiable sur le jeu.

### 2.7 Les trois références, sur les mêmes cuts

- **(a) H0** : ne rien faire.
- **(b) La règle prudente figée** (D-180, D-190) relue sur le jeu : variante `chaine+h` (pose de la chaîne, sinon A* du moteur, avec la hauteur apprise), agir si la pose s'écarte de **8 mm** ou plus, rail déplacé de **45 mm** au plus en travers, écartement à **15 mm** de la médiane, confiance présente, **verts seulement**, zones PN, ADV et abords. Les paramètres sont relus dans `datasets/relecture-reglages-proposes.json` par l'essai. **Contrôle** sur les parties 1:14, 1:15 et 1:16, contre les chiffres de D-190 (entre parenthèses) : 528 cuts mesurables (528), 35 grosses corrections (35), 38 actions (40), 27 justes (29), 2 abîmés (2), 0 mauvaise voie (0), 87 abstentions (87), 8 laissés faux (6). Écart faible : la chaîne sans appui est lue comme l'A* du moteur.
- **(c) Le hasard** : une paire tirée uniformément parmi les paires permises par les garde-fous, avec dans chaque zone et chaque pli **le taux d'action de la GCV2** à la place de τ et δ. Calculé **en espérance exacte** (pas de tirage, aucune graine), donc des comptes décimaux.

### 2.8 Mesures

Définitions (identiques pour toutes les méthodes) : **correction juste** = Mic a corrigé de plus de 10 mm et la pose est à 10 mm ou moins de la sienne (« dont à 5 mm » : à 5 mm ou moins) ; **abîmé** = on agit sur un cut que Mic laisse à 5 mm ou moins et la pose est à plus de 10 mm ; **mauvaise voie** = on agit et la pose est à plus de 50 mm de celle de Mic (mauvais rail), ou un rail est déplacé de plus de 45 mm en latéral ; **erreur** = on agit et la pose reste à plus de 10 mm de Mic ; **abstention** = pose candidate trop incertaine (pour la règle prudente : le moteur diffère) ; **grosse laissée fausse** = Mic a corrigé de plus de 10 mm et on n'agit pas. Borne de Wilson à 95 % sur l'erreur. Calibrage : Brier et courbe de fiabilité en 10 classes, sur les scores hors-échantillon.

## 3. Validation croisée par partie : usage « relecture »

Onze plis : apprendre sur dix parties (y compris calibrage et τ, δ), juger la onzième.

### Usage « relecture » (2411 cuts jugés, 11 plis)

#### Total, par méthode (mêmes cuts)

méthode | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses | Wilson haut
---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---
GCV2 | 2411 | 406 | 392 | 144 | 100 | 6 | 5 | 26 (6,6 %) | 38 | 246 | ≤ 9,5 %
règle prudente | 2411 | 406 | 136 | 107 | 84 | 4 | 0 | 10 (7,4 %) | 755 | 293 | ≤ 13 %
hasard | 2411 | 406 | 375 | 20,4 | 10 | 124,7 | 5,7 | 189,5 (50,5 %) | 0 | 343,7 | ≤ 55,6 %
H0 (ne rien faire) | 2411 | 406 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 0 | 406 | —

#### Dans le périmètre de la règle prudente (verts de PN, ADV et abords)

méthode | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses | Wilson haut
---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---
GCV2 | 1423 | 186 | 244 | 105 | 77 | 3 | 0 | 13 (5,3 %) | 16 | 73 | ≤ 8,9 %
règle prudente | 1423 | 186 | 136 | 107 | 84 | 4 | 0 | 10 (7,4 %) | 324 | 73 | ≤ 13 %
hasard | 1423 | 186 | 229,2 | 14,8 | 7,9 | 78,9 | 1,3 | 114,8 (50,1 %) | 0 | 145 | ≤ 56,5 %
H0 (ne rien faire) | 1423 | 186 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 0 | 186 | —

#### Par partie jugée (GCV2 | règle prudente)

partie | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses | règle prudente : agit | justes | abîmés | mauvaise voie
---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:
1:12 | 79 | 24 | 37 | 23 | 18 | 0 | 0 | 0 (0 %) | 1 | 1 | 19 | 19 | 0 | 0
1:13 | 143 | 21 | 35 | 18 | 16 | 0 | 0 | 2 (5,7 %) | 1 | 1 | 15 | 10 | 1 | 0
1:14 | 94 | 15 | 32 | 15 | 13 | 0 | 0 | 0 (0 %) | 0 | 0 | 16 | 14 | 0 | 0
1:15 | 281 | 7 | 27 | 7 | 5 | 0 | 0 | 1 (3,7 %) | 1 | 0 | 12 | 6 | 1 | 0
1:16 | 311 | 20 | 56 | 15 | 10 | 3 | 0 | 3 (5,4 %) | 2 | 5 | 10 | 7 | 1 | 0
1:17 | 197 | 44 | 36 | 9 | 3 | 1 | 0 | 5 (13,9 %) | 1 | 32 | 5 | 3 | 0 | 0
1:24 | 31 | 24 | 13 | 5 | 1 | 0 | 0 | 4 (30,8 %) | 4 | 15 | 4 | 1 | 0 | 0
1:29 | 563 | 93 | 50 | 19 | 13 | 2 | 0 | 2 (4 %) | 5 | 74 | 42 | 38 | 0 | 0
2:1 | 439 | 134 | 69 | 17 | 10 | 0 | 5 | 8 (11,6 %) | 23 | 111 | 6 | 5 | 0 | 0
2:10 | 21 | 1 | 4 | 0 | 0 | 0 | 0 | 0 (0 %) | 0 | 1 | 0 | 0 | 0 | 0
2:11 | 252 | 23 | 33 | 16 | 11 | 0 | 0 | 1 (3 %) | 0 | 6 | 7 | 4 | 1 | 0

#### Par zone (GCV2 | règle prudente | hasard)

zone | méthode | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses
---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
pn | GCV2 | 458 | 86 | 168 | 69 | 54 | 2 | 0 | 3 (1,8 %) | 4 | 16
pn | règle prudente | 458 | 86 | 60 | 56 | 50 | 2 | 0 | 2 (3,3 %) | 77 | 30
pn | hasard | 458 | 86 | 168 | 11,2 | 6,6 | 61,9 | 0 | 87,8 (52,3 %) | 0 | 55,5
adv | GCV2 | 767 | 65 | 66 | 38 | 29 | 0 | 0 | 3 (4,5 %) | 5 | 25
adv | règle prudente | 767 | 65 | 34 | 18 | 12 | 2 | 0 | 4 (11,8 %) | 201 | 45
adv | hasard | 767 | 65 | 64,4 | 3 | 1,6 | 19,5 | 0 | 24,5 (38 %) | 0 | 59,1
abords | GCV2 | 746 | 214 | 58 | 14 | 4 | 1 | 5 | 16 (27,6 %) | 25 | 187
abords | règle prudente | 746 | 214 | 42 | 33 | 22 | 0 | 0 | 4 (9,5 %) | 326 | 177
abords | hasard | 746 | 214 | 42,7 | 2,5 | 0,6 | 8,5 | 5,6 | 25,9 (60,7 %) | 0 | 199,1
liste | GCV2 | 17 | 7 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 0 | 7
liste | règle prudente | 17 | 7 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 10 | 7
liste | hasard | 17 | 7 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 0 | 7
hors | GCV2 | 423 | 34 | 100 | 23 | 13 | 3 | 0 | 4 (4 %) | 4 | 11
hors | règle prudente | 423 | 34 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 141 | 34
hors | hasard | 423 | 34 | 100 | 3,7 | 1,2 | 34,8 | 0 | 51,4 (51,4 %) | 0 | 23

#### Par rôle du cut

rôle | méthode | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses
---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
vert | GCV2 | 1863 | 227 | 344 | 128 | 90 | 6 | 0 | 17 (4,9 %) | 20 | 91
vert | règle prudente | 1863 | 227 | 136 | 107 | 84 | 4 | 0 | 10 (7,4 %) | 475 | 114
vert | hasard | 1863 | 227 | 329,2 | 18,4 | 9,1 | 113,7 | 1,3 | 166,2 (50,5 %) | 0 | 175
rouge | GCV2 | 387 | 24 | 27 | 2 | 1 | 0 | 0 | 3 (11,1 %) | 1 | 20
rouge | règle prudente | 387 | 24 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 148 | 24
rouge | hasard | 387 | 24 | 38,5 | 0,7 | 0,2 | 11 | 0,4 | 17,4 (45,2 %) | 0 | 20,7
differe | GCV2 | 161 | 155 | 21 | 14 | 9 | 0 | 5 | 6 (28,6 %) | 17 | 135
differe | règle prudente | 161 | 155 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 132 | 155
differe | hasard | 161 | 155 | 7,3 | 1,2 | 0,7 | 0 | 3,9 | 5,9 (80,8 %) | 0 | 148

#### Porte du plan (0 mauvaise voie, erreur ≤ 9 %, corrections justes ≥ règle prudente, abîmés ≤ règle prudente)

lecture | 0 mauvaise voie | erreur ≤ 9 % | borne de Wilson ≤ 9 % | justes ≥ prudente | abîmés ≤ prudente | porte tenue
---|---|---|---|---|---|---
tous les cuts | NON | oui (6,6 %) | NON (≤ 9,5 %) | oui (144 contre 107) | NON (6 contre 4) | NON
périmètre de la règle prudente | oui | oui (5,3 %) | oui (≤ 8,9 %) | NON (105 contre 107) | oui (3 contre 4) | NON

#### Calibrage (hors-échantillon)

Brier p(10 mm) 0.043 sur 56936 hypothèses ; p(5 mm) 0.068 ; paire gagnante 0.0302 (2411 cuts).

classe | n (10 mm) | p moyen | observé | n (gagnants) | p moyen | observé
---|--:|--:|--:|--:|--:|--:
0–10 % | 24378 | 0.01 | 0.01 | 134 | 0.008 | 0.015
10–20 % | 1562 | 0.145 | 0.106 | 13 | 0.157 | 0.077
20–30 % | 1042 | 0.247 | 0.187 | 14 | 0.245 | 0.357
30–40 % | 882 | 0.35 | 0.269 | 17 | 0.354 | 0.588
40–50 % | 902 | 0.452 | 0.38 | 21 | 0.453 | 0.667
50–60 % | 931 | 0.552 | 0.502 | 18 | 0.545 | 0.611
60–70 % | 1134 | 0.652 | 0.623 | 32 | 0.659 | 0.781
70–80 % | 1625 | 0.754 | 0.762 | 94 | 0.755 | 0.915
80–90 % | 3181 | 0.857 | 0.873 | 218 | 0.864 | 0.927
90–100 % | 21299 | 0.974 | 0.983 | 1850 | 0.973 | 0.989

#### Seuils par pli

partie jugée | pn (τ, δ) | adv (τ, δ) | abords (τ, δ) | liste (τ, δ) | hors (τ, δ)
---|---|---|---|---|---|
1:12 | 0.59 ; 3 | 0.43 ; 5 | 0.81 ; 10 | inactive | 0.32 ; 5
1:13 | 0.43 ; 3 | 0.45 ; 8 | 0.79 ; 10 | inactive | 0.32 ; 5
1:14 | 0.4 ; 3 | 0.44 ; 5 | 0.82 ; 10 | inactive | 0.32 ; 5
1:15 | 0.47 ; 3 | 0.46 ; 8 | 0.79 ; 8 | inactive | 0.51 ; 5
1:16 | 0.47 ; 3 | 0.44 ; 8 | 0.79 ; 10 | inactive | 0.59 ; 5
1:17 | 0.49 ; 3 | 0.51 ; 5 | 0.61 ; 8 | inactive | 0.3 ; 3
1:24 | 0.48 ; 3 | 0.37 ; 8 | 0.69 ; 2 | inactive | 0.42 ; 5
1:29 | 0.48 ; 15 | 0.5 ; 5 | inactive | inactive | 0.33 ; 5
2:1 | 0.48 ; 3 | 0.54 ; 5 | 0.36 ; 2 | inactive | 0.41 ; 3
2:10 | 0.42 ; 3 | 0.47 ; 8 | 0.81 ; 10 | inactive | 0.35 ; 5
2:11 | 0.48 ; 3 | 0.38 ; 5 | 0.8 ; 10 | inactive | 0.31 ; 5

#### Traits dominants (coefficient moyen sur les plis, traits normalisés)

trait | coefficient moyen | plis de même signe
---|--:|--:
ecartPaireMedMm | -1.807 | 100 %
deplMm | -1.334 | 100 %
accDistChaineMm | -1.233 | 100 %
perte | -1.077 | 100 %
epaisseurDessusMm:manque | 0.78 | 100 %
pointsDessus | 0.775 | 100 %
ratioPerte | -0.752 | 100 %
accNProches10 | 0.725 | 100 %
sousOrigines∋chaine | -0.616 | 100 %
motif=slope | -0.545 | 100 %
sousOrigines∋voie | 0.509 | 100 %
ecartVoieMm | -0.484 | 100 %
faces | -0.483 | 100 %
origines∋H5 | 0.481 | 100 %
sousOrigines∋ecartement-median | 0.481 | 100 %
accDistVoisinsMm | -0.479 | 100 %
ecartVoisinsMm | -0.457 | 100 %
palier=STRONG_FACE | -0.438 | 100 %
motif=ambiguity | 0.403 | 100 %
fortsReservoir | -0.402 | 100 %

## 4. Validation croisée par partie : usage « lot »

### Usage « lot » (2411 cuts jugés, 11 plis)

#### Total, par méthode (mêmes cuts)

méthode | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses | Wilson haut
---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---
GCV2 | 2411 | 406 | 466 | 125 | 92 | 9 | 5 | 30 (6,4 %) | 38 | 261 | ≤ 9 %
règle prudente | 2411 | 406 | 136 | 107 | 84 | 4 | 0 | 10 (7,4 %) | 755 | 293 | ≤ 13 %
hasard | 2411 | 406 | 450,7 | 18,6 | 9,8 | 161,9 | 5,1 | 231,8 (51,4 %) | 0 | 345,4 | ≤ 56 %
H0 (ne rien faire) | 2411 | 406 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 0 | 406 | —

#### Dans le périmètre de la règle prudente (verts de PN, ADV et abords)

méthode | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses | Wilson haut
---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---
GCV2 | 1423 | 186 | 236 | 94 | 74 | 3 | 1 | 13 (5,5 %) | 17 | 83 | ≤ 9,2 %
règle prudente | 1423 | 186 | 136 | 107 | 84 | 4 | 0 | 10 (7,4 %) | 324 | 73 | ≤ 13 %
hasard | 1423 | 186 | 223,9 | 11,7 | 7,3 | 83,4 | 1,2 | 118,1 (52,7 %) | 0 | 149,1 | ≤ 59,2 %
H0 (ne rien faire) | 1423 | 186 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 0 | 186 | —

#### Par partie jugée (GCV2 | règle prudente)

partie | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses | règle prudente : agit | justes | abîmés | mauvaise voie
---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:
1:12 | 79 | 24 | 43 | 23 | 19 | 0 | 0 | 0 (0 %) | 0 | 1 | 19 | 19 | 0 | 0
1:13 | 143 | 21 | 34 | 14 | 13 | 0 | 0 | 2 (5,9 %) | 3 | 5 | 15 | 10 | 1 | 0
1:14 | 94 | 15 | 34 | 15 | 13 | 0 | 0 | 0 (0 %) | 1 | 0 | 16 | 14 | 0 | 0
1:15 | 281 | 7 | 50 | 7 | 5 | 1 | 0 | 1 (2 %) | 0 | 0 | 12 | 6 | 1 | 0
1:16 | 311 | 20 | 85 | 15 | 8 | 4 | 0 | 6 (7,1 %) | 1 | 3 | 10 | 7 | 1 | 0
1:17 | 197 | 44 | 36 | 6 | 3 | 2 | 0 | 6 (16,7 %) | 6 | 35 | 5 | 3 | 0 | 0
1:24 | 31 | 24 | 4 | 1 | 1 | 0 | 0 | 1 (25 %) | 6 | 22 | 4 | 1 | 0 | 0
1:29 | 563 | 93 | 64 | 16 | 12 | 1 | 0 | 4 (6,3 %) | 4 | 74 | 42 | 38 | 0 | 0
2:1 | 439 | 134 | 65 | 14 | 8 | 1 | 5 | 9 (13,8 %) | 17 | 112 | 6 | 5 | 0 | 0
2:10 | 21 | 1 | 4 | 0 | 0 | 0 | 0 | 0 (0 %) | 0 | 1 | 0 | 0 | 0 | 0
2:11 | 252 | 23 | 47 | 14 | 10 | 0 | 0 | 1 (2,1 %) | 0 | 8 | 7 | 4 | 1 | 0

#### Par zone (GCV2 | règle prudente | hasard)

zone | méthode | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses
---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
pn | GCV2 | 458 | 86 | 162 | 66 | 54 | 1 | 0 | 3 (1,9 %) | 4 | 18
pn | règle prudente | 458 | 86 | 60 | 56 | 50 | 2 | 0 | 2 (3,3 %) | 77 | 30
pn | hasard | 458 | 86 | 162 | 9,5 | 6,3 | 61,6 | 0 | 88,6 (54,7 %) | 0 | 56,1
adv | GCV2 | 767 | 65 | 68 | 32 | 23 | 1 | 0 | 7 (10,3 %) | 5 | 27
adv | règle prudente | 767 | 65 | 34 | 18 | 12 | 2 | 0 | 4 (11,8 %) | 201 | 45
adv | hasard | 767 | 65 | 66 | 2,2 | 1,2 | 24,2 | 0 | 29 (43,9 %) | 0 | 60,1
abords | GCV2 | 746 | 214 | 47 | 7 | 3 | 3 | 5 | 13 (27,7 %) | 25 | 198
abords | règle prudente | 746 | 214 | 42 | 33 | 22 | 0 | 0 | 4 (9,5 %) | 326 | 177
abords | hasard | 746 | 214 | 34,5 | 1,2 | 0,2 | 8,4 | 5 | 21,7 (62,9 %) | 0 | 204,2
liste | GCV2 | 17 | 7 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 0 | 7
liste | règle prudente | 17 | 7 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 10 | 7
liste | hasard | 17 | 7 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 0 | 7
hors | GCV2 | 423 | 34 | 189 | 20 | 12 | 4 | 0 | 7 (3,7 %) | 4 | 11
hors | règle prudente | 423 | 34 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 141 | 34
hors | hasard | 423 | 34 | 188,2 | 5,8 | 2 | 67,7 | 0 | 92,5 (49,1 %) | 0 | 17,9

#### Par rôle du cut

rôle | méthode | visités | Mic > 10 mm | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions) | abstentions | grosses laissées fausses
---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
vert | GCV2 | 1863 | 227 | 425 | 114 | 86 | 7 | 1 | 20 (4,7 %) | 21 | 101
vert | règle prudente | 1863 | 227 | 136 | 107 | 84 | 4 | 0 | 10 (7,4 %) | 475 | 114
vert | hasard | 1863 | 227 | 412,2 | 17,5 | 9,3 | 151 | 1,2 | 210,6 (51,1 %) | 0 | 174
rouge | GCV2 | 387 | 24 | 23 | 2 | 1 | 2 | 0 | 2 (8,7 %) | 5 | 22
rouge | règle prudente | 387 | 24 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 148 | 24
rouge | hasard | 387 | 24 | 32,9 | 0,4 | 0,1 | 10,8 | 0,4 | 16,3 (49,5 %) | 0 | 21,9
differe | GCV2 | 161 | 155 | 18 | 9 | 5 | 0 | 4 | 8 (44,4 %) | 12 | 138
differe | règle prudente | 161 | 155 | 0 | 0 | 0 | 0 | 0 | 0 (—) | 132 | 155
differe | hasard | 161 | 155 | 5,7 | 0,7 | 0,3 | 0 | 3,5 | 4,9 (86 %) | 0 | 149,5

#### Porte du plan (0 mauvaise voie, erreur ≤ 9 %, corrections justes ≥ règle prudente, abîmés ≤ règle prudente)

lecture | 0 mauvaise voie | erreur ≤ 9 % | borne de Wilson ≤ 9 % | justes ≥ prudente | abîmés ≤ prudente | porte tenue
---|---|---|---|---|---|---
tous les cuts | NON | oui (6,4 %) | NON (≤ 9 %) | oui (125 contre 107) | NON (9 contre 4) | NON
périmètre de la règle prudente | NON | oui (5,5 %) | NON (≤ 9,2 %) | NON (94 contre 107) | oui (3 contre 4) | NON

#### Calibrage (hors-échantillon)

Brier p(10 mm) 0.0446 sur 53354 hypothèses ; p(5 mm) 0.0659 ; paire gagnante 0.0419 (2411 cuts).

classe | n (10 mm) | p moyen | observé | n (gagnants) | p moyen | observé
---|--:|--:|--:|--:|--:|--:
0–10 % | 23189 | 0.013 | 0.011 | 111 | 0.028 | 0.045
10–20 % | 1872 | 0.145 | 0.091 | 24 | 0.14 | 0.208
20–30 % | 1062 | 0.247 | 0.164 | 17 | 0.252 | 0.471
30–40 % | 890 | 0.348 | 0.285 | 31 | 0.354 | 0.613
40–50 % | 862 | 0.452 | 0.4 | 34 | 0.449 | 0.529
50–60 % | 923 | 0.551 | 0.517 | 58 | 0.551 | 0.603
60–70 % | 1166 | 0.651 | 0.647 | 54 | 0.66 | 0.759
70–80 % | 1567 | 0.754 | 0.759 | 96 | 0.756 | 0.896
80–90 % | 2794 | 0.856 | 0.866 | 225 | 0.858 | 0.942
90–100 % | 19029 | 0.975 | 0.983 | 1761 | 0.974 | 0.989

#### Seuils par pli

partie jugée | pn (τ, δ) | adv (τ, δ) | abords (τ, δ) | liste (τ, δ) | hors (τ, δ)
---|---|---|---|---|---|
1:12 | 0.36 ; 3 | 0.37 ; 5 | 0.76 ; 8 | inactive | 0.36 ; 3
1:13 | 0.39 ; 3 | 0.38 ; 5 | 0.77 ; 8 | inactive | 0.36 ; 3
1:14 | 0.34 ; 3 | 0.36 ; 5 | 0.78 ; 8 | inactive | 0.36 ; 3
1:15 | 0.31 ; 3 | 0.31 ; 8 | 0.78 ; 8 | inactive | 0.35 ; 3
1:16 | 0.35 ; 3 | 0.38 ; 5 | 0.78 ; 8 | inactive | 0.33 ; 3
1:17 | 0.33 ; 12 | 0.34 ; 5 | 0.57 ; 8 | inactive | 0.5 ; 3
1:24 | 0.33 ; 3 | 0.53 ; 8 | 0.76 ; 8 | inactive | 0.38 ; 5
1:29 | 0.37 ; 15 | 0.64 ; 8 | inactive | inactive | 0.32 ; 3
2:1 | 0.61 ; 12 | 0.5 ; 5 | 0.5 ; 2 | inactive | 0.34 ; 3
2:10 | 0.35 ; 3 | 0.38 ; 5 | 0.78 ; 8 | inactive | 0.37 ; 3
2:11 | 0.37 ; 3 | 0.35 ; 5 | 0.76 ; 8 | inactive | 0.36 ; 3

#### Traits dominants (coefficient moyen sur les plis, traits normalisés)

trait | coefficient moyen | plis de même signe
---|--:|--:
deplMm | -1.577 | 100 %
accDistChaineMm | -1.432 | 100 %
perte | -1.177 | 100 %
ratioPerte | -0.943 | 100 %
pointsDessus | 0.846 | 100 %
ecartVoieMm | -0.836 | 100 %
accNProches10 | 0.669 | 100 %
epaisseurDessusMm:manque | 0.633 | 100 %
ecartPaireMedMm | -0.611 | 100 %
origines∋H5 | 0.602 | 100 %
sousOrigines∋ecartement-median | 0.602 | 100 %
sousOrigines∋chaine | -0.59 | 100 %
faces | -0.568 | 100 %
motif=flank | -0.43 | 100 %
motif=slope | -0.425 | 100 %
fortsReservoir | -0.42 | 100 %
hauteurMm | -0.416 | 100 %
hauteurMm:manque | 0.412 | 100 %
palier=PARTIAL_FACE | 0.412 | 100 %
motif=ambiguity | 0.401 | 100 %

## 5. Lecture des résultats

### 5.1 Les trois références

| Total, 2 411 cuts | agit | justes | à 5 mm | abîmés | mauvaise voie | erreur | grosses laissées fausses |
|---|--:|--:|--:|--:|--:|--:|--:|
| GCV2, relecture | 392 | **144** | 100 | 6 | 5 | 6,6 % | 246 |
| GCV2, lot | 466 | 125 | 92 | 9 | 5 | 6,4 % | 261 |
| (b) règle prudente | 136 | 107 | 84 | 4 | 0 | 7,4 % | 293 |
| (c) hasard | 375 / 451 | 20 / 19 | 10 / 10 | 125 / 162 | 6 / 5 | 50 % / 51 % | 344 / 345 |
| (a) H0 | 0 | 0 | 0 | 0 | 0 | — | 406 |

La GCV2 fait **sept fois plus de corrections justes que le hasard** avec une erreur sept fois plus basse (6,6 % contre 50 %) : le modèle apprend ce que la liste dense ne donne pas à elle seule. Elle bat la règle prudente en nombre de corrections justes, pas en abîmés ni en mauvaise voie.

### 5.2 Par zone (relecture)

| Zone | GCV2 : agit / justes / erreurs | Règle prudente : agit / justes / erreurs |
|---|---|---|
| PN | 168 / 69 / 3 (1,8 %) | 60 / 56 / 2 (3,3 %) |
| ADV | 66 / 38 / 3 (4,5 %) | 34 / 18 / 4 (11,8 %) |
| Abords | 58 / 14 / 16 (27,6 %) | 42 / 33 / 4 (9,5 %) |
| Hors zone | 100 / 23 / 4 (4,0 %) | 0 (jamais) |
| Liste | 0 | 0 |

PN, ADV et hors zone tiennent la porte zone par zone ; **les abords ne la tiennent pas** (27,6 % d'erreurs, 5 mauvaises voies). Au lot, la GCV2 garde PN (66 justes pour 3 erreurs) mais perd en ADV (10,3 % d'erreurs) et aux abords (13 erreurs sur 47 actions).

### 5.3 Par rôle (relecture)

Verts : 128 justes, 17 erreurs sur 344 actions (4,9 %), **0 mauvaise voie**, 6 abîmés (la règle prudente : 107 justes, 4 abîmés). Rouges : 2 justes, 3 erreurs. **Différés : 14 justes mais 6 erreurs sur 21 actions (28,6 %), et les 5 mauvaises voies de la relecture** : comme dans RELECTURE_AUTONOME, c'est le rôle qui produit les mauvaises voies. Retirer les rôles « rouge » et « différé » (comme la règle prudente) ne donne pas pour autant la porte : il reste 6 abîmés contre 4. (Lecture après coup, pas un réglage.)

### 5.4 Ce que les garde-fous coûtent

Sur les 406 grosses corrections, une paire permise est à 10 mm de Mic pour **232 (57,1 %)** en relecture, **219 (53,9 %)** au lot (G1-a, sans garde-fous : 83,7 %). Par zone : PN 77/86, hors 30/34, ADV 45/65, **abords 75/214 (35 %)**. Les garde-fous retirent les poses de Mic qui sont à plus de 45 mm en latéral. Ce n'est pas un défaut de l'apprentissage : c'est un plafond qui vient de la consigne.

### 5.5 Calibrage

Brier hors-échantillon (relecture, p à 10 mm) 0,043 sur 56 936 hypothèses, p à 5 mm 0,068, paire gagnante 0,0302. Au niveau des hypothèses, la courbe est trop confiante entre 10 et 50 % (p moyen 0,35, observé 0,27) et bien tenue de 60 à 100 %. Au niveau des paires gagnantes, c'est le contraire : de 20 à 50 % le taux observé (0,36 à 0,67) dépasse la probabilité annoncée (0,25 à 0,45). Le produit de deux probabilités n'est donc pas un taux de réussite exact, et les τ de PN, ADV et hors zone (0,3 à 0,6) sont bas.

## 6. La porte du plan

| Lecture | 0 mauvaise voie | erreur ≤ 9 % | borne de Wilson ≤ 9 % | justes ≥ prudente | abîmés ≤ prudente | **porte** |
|---|---|---|---|---|---|---|
| Relecture, tous les cuts | **non** (5) | oui (6,6 %) | non (≤ 9,5 %) | oui (144 contre 107) | **non** (6 contre 4) | **non tenue** |
| Relecture, périmètre de la règle prudente | oui (0) | oui (5,3 %) | oui (≤ 8,9 %) | **non** (105 contre 107) | oui (3 contre 4) | **non tenue** (de 2 justes) |
| Lot, tous les cuts | **non** (5) | oui (6,4 %) | non (≤ 9,04 %) | oui (125 contre 107) | **non** (9 contre 4) | **non tenue** |
| Lot, périmètre de la règle prudente | **non** (1) | oui (5,5 %) | non (≤ 9,2 %) | **non** (94 contre 107) | oui (3 contre 4) | **non tenue** |

Cela dit franchement : la porte **n'est tenue dans aucun des quatre cas**. La mauvaise voie vient de la seule partie 2:1 ; la porte est la plus proche en relecture, dans le périmètre de la règle prudente (2 justes de moins, tout le reste tenu). Rien n'a été réglé après coup pour la faire passer.

## 7. Variantes d'essai (exploratoires, après coup, hors porte)

Relecture, mêmes cuts, mêmes plis. **Ces lignes ne règlent rien** : elles disent si le résultat dépend d'un choix.

| Variante | agit | justes | abîmés | mauvaise voie | erreur |
|---|--:|--:|--:|--:|--:|
| Choix retenu (accord, erreur visée 9 %) | 392 | 144 | 6 | 5 | 6,6 % |
| Sans les traits d'accord | 471 | 139 | 5 | 4 | 4,7 % |
| Erreur visée 5 % au lieu de 9 % | 487 | 142 | 6 | 2 | 4,5 % |

Les trois lignes disent la même chose : 140 justes environ, 4 à 6 abîmés, 2 à 5 mauvaises voies. Les écarts sont dans le bruit de onze plis et de 5 cuts de mauvaise voie. Les traits d'accord aident à classer les hypothèses, pas à décider la paire ; durcir l'erreur visée ne supprime pas les mauvaises voies (elles viennent d'une partie que les autres ne ressemblent pas).

## 8. Traits dominants

Coefficients de la régression à 10 mm, moyenne sur les 11 plis (traits numériques normalisés, donc comparables entre eux ; les 20 premiers sont dans les tableaux des § 3 et 4). **Tous les signes sont les mêmes dans les 11 plis.**

- **Moins une hypothèse est loin de H0 (`deplMm`, −1,3 à −1,6), plus elle est juste.** Ne pas déplacer est le bon pari.
- **Loin de la pose de la chaîne (`accDistChaineMm`, −1,2 à −1,4), moins juste.**
- **Perte et ratio de perte élevés (−1,1 et −0,8 à −0,9) : moins juste** ; **beaucoup de points au dessus (+0,8)** : plus juste.
- **Accord : plus d'hypothèses voisines à 10 mm (`accNProches10`, +0,7), plus juste.** Plusieurs origines qui mènent à la même pose font la justesse.
- **Écart de la paire à la médiane de la partie (`ecartPaireMedMm`) : −1,8 en relecture, −0,6 au lot.**
- **Voie prédite (`ecartVoieMm`, −0,5 à −0,8) et voisins (`ecartVoisinsMm` −0,5)** : s'écarter de la voie ou des voisins est un mauvais signe.
- **H5 (rail complété à l'écartement médian)** : +0,5 à +0,6. Les colonnes « origine H5 » et « sous-origine écartement-médian » sont identiques ; le coefficient se partage entre elles.
- **Motifs d'abstention du moteur** : `ambiguity` positif (+0,4) (les hypothèses de réservoir sont utiles quand le moteur hésite), `slope` et `flank` négatifs.

## 9. Ce qui reste douteux

1. **La partie 2:1 décide de la mauvaise voie.** 134 des 406 grosses corrections, des déplacements latéraux de plus de 50 mm que les dix autres parties ne montrent pas. Un modèle appris sans elle ne peut pas savoir qu'il ne faut pas s'y fier, et le garde-fou de 45 mm laisse passer des déplacements que la voie réelle contredit. Les cinq mauvaises voies de la relecture sont des cuts **différés** (au lot : quatre sur cinq). Une règle simple — jamais sur un différé, comme la règle prudente — les supprimerait, mais elle n'est pas dans la consigne et elle n'est pas dans la porte ci-dessus. Les seuils de l'abord dépendent entièrement de 2:1 : appris sans elle, ils sont lâches (τ 0,36 ; δ 2 mm), appris avec elle, ils sont stricts (τ 0,8 ; δ 10 mm) ou la zone est inactive.
2. **Les abords** (35 % de rappel sous garde-fous, 27,6 % d'erreurs) ne sont pas servis par un classeur par hypothèse ; la piste de G1-a (hypothèses de déplacement latéral large) reste ouverte, mais elle viendrait contre le garde-fou de 45 mm.
3. **Cinq cuts de mauvaise voie, onze plis, un opérateur** : la borne de Wilson (≤ 9,5 % relecture, ≤ 9,04 % lot) est au-dessus de 9 % ; ni la règle prudente (≤ 13 %) ni la GCV2 ne *prouvent* la porte.
4. **τ et δ par zone, sur peu de cuts.** Les seuils varient d'un pli à l'autre (abords : τ de 0,36 à 0,82 ; zone **inactive** dans le pli sans 1:29). La zone « liste » (17 cuts) n'est jamais active.
5. **Petits déplacements.** La GCV2 agit sur 16 % des cuts (la règle prudente sur 5,6 %), avec δ de 3 mm en PN : chaque action est une écriture dans ESV. Les actions « dans le gris » (5 à 10 mm de Mic) ne sont pas comptées comme erreurs.
6. **λ choisi sur les 11 parties** (mesure au niveau des hypothèses, avant la paire) : optimisme léger, impossible à éviter sans un second niveau d'imbrication.
7. **Les exemples n'existent que si le nuage existe.** Un cut visité trop vite pour avoir un nuage n'entre pas ; le nombre de visites, lui, n'est pas un trait. Mais la sélection par la présence de référence et de nuage peut écarter des cuts que Mic juge « évidents ». Le rappel brut (45,9 % en G1-a) reste la limite des données.
8. **L'usage « lot » est approché** (§ 2.5) : le vrai lot n'a ni les mêmes voisins ni les mêmes rôles que l'Écho de Mic.
9. **La règle prudente relue sur le jeu** n'est pas la règle exacte de D-190 (38 actions contre 40, 27 justes contre 29) ; la différence est la chaîne sans appui, lue comme l'A* du moteur.
10. **Ablation et variantes** (§ 7) : après coup, non réglées.
11. **p1-17** n'était pas dans le compteur (`datasets/compteur-gcv2-sources.json`) : son Écho est en 7z. Elle y est maintenant, à l'état « appris » : l'Écho est extrait le temps du comptage (dossier temporaire, effacé ensuite) et lu par `node tools/compteur-gcv2.cjs … --racine-supplementaire <dossier>`. Elle compte 507 cuts corrigés, et le compteur passe de 1 631 à 2 138 cuts corrigés appris.

## 10. Reproduire

```
nice -n 10 node tools/gcv2-apprendre.cjs valider --jeu jeu-1-12.jsonl … --usage relecture --sortie V.json
nice -n 10 node tools/gcv2-apprendre.cjs valider --jeu … --usage lot --sortie V-lot.json
nice -n 10 node tools/gcv2-apprendre.cjs exporter --jeu … --sortie datasets/gcv2-parametres.json --date 2026-10-19
node tools/gcv2-apprendre.cjs rapport --json V.json
node --test tests/gcv2-apprendre.test.cjs
```

Chaque `valider` prend 12 minutes sur une machine peu chargée (121 modèles par usage) ; l'export 4 minutes. Les jeux sont hors dépôt ; leurs empreintes SHA-256 sont dans le fichier de paramètres.

## 11. Variantes par zone (déclarées en D-204, après lecture de la validation croisée)

**Un choix fait après coup.** Les trois variantes ci-dessous ont été écrites en D-204 **après** la lecture de la validation croisée des § 3 à 6. On y avait vu que la GCV2 gagne en PN, en ADV et hors zone, qu'elle perd aux abords, et que les 5 mauvaises voies sont toutes des cuts différés. Les variantes en tirent les conséquences. Elles ont été déclarées **avant** tout calcul de ce paragraphe et rien n'a été changé ensuite, mais elles n'ont pas été choisies à l'aveugle : les chiffres ci-dessous sont **optimistes** pour elles. **Le vrai juge sera G1-c**, à l'aveugle, sur la partie réservée 2:6 et sur les témoins 1:11 et 1:25. Aucune de ces trois parties n'a été lue pour ce paragraphe.

### 11.1 Les trois variantes

| Variante | La GCV2 agit sur | La règle prudente figée agit sur | Partout ailleurs |
|---|---|---|---|
| **V1** | les **verts** de PN et d'ADV | les **verts des abords** | rien : hors zone, liste, rouges, différés |
| **V2** | les verts de PN, d'ADV et **hors zone** | les verts des abords | rien : liste, rouges, différés |
| **V3** | tous les verts **sauf les abords** (PN, ADV, liste si active, hors zone) | rien | rien : abords, rouges, différés |

- La liste exacte des zones et des rôles est dans `datasets/gcv2-variantes.json`. Elle ne contient **aucun coefficient**. L'outil la lit et refuse une variante qui agirait sur un rouge ou sur un différé.
- Le modèle, le calibrage, **τ et δ par zone** sont ceux de chaque pli de la validation croisée des § 3 et 4 : une variante ne réapprend rien. Les mêmes 11 plis, les mêmes 2 411 cuts. La règle prudente garde ses paramètres figés. La zone « liste » n'est jamais active (§ 9) : V3 y est donc égale à V2.
- Les références sont celles des § 3 et 4, sur les mêmes cuts : la règle prudente seule, le hasard, H0.
- Sortie : `node tools/gcv2-apprendre.cjs valider … --usage relecture|lot --variante V1 --variante V2 --variante V3`. Sans l'option, la sortie est celle de G1-b, octet pour octet (l'essai le vérifie). Le contenu de base des deux validations refaites est identique à celui de G1-b ; les variantes s'y ajoutent.

### 11.2 Résultats, relecture et lot

Lecture des colonnes : « agit » = cuts où l'on écrit une pose ; « corrections justes » = Mic corrigeait de plus de 10 mm et la pose est à 10 mm ou moins de la sienne ; « abîmés » = on agit sur un cut que Mic laisse à 5 mm ou moins et la pose est à plus de 10 mm ; « mauvaise voie » = pose à plus de 50 mm de celle de Mic ou rail déplacé de plus de 45 mm en latéral.

##### Usage « relecture » — total (2411 cuts jugés, mêmes cuts pour toutes les lignes)

méthode | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions), Wilson | abstentions | grosses laissées fausses
---|--:|--:|--:|--:|--:|--:|--:|--:
règle prudente seule | 136 | **107** | 84 | 4 | 0 | 10 (7,4 %) ≤ 13 % | 755 | 293
V1 | 257 | **128** | 97 | 2 | 0 | 9 (3,5 %) ≤ 6,5 % | 135 | 272
V2 | 357 | **151** | 110 | 5 | 0 | 13 (3,6 %) ≤ 6,1 % | 139 | 249
V3 | 315 | **118** | 88 | 5 | 0 | 9 (2,9 %) ≤ 5,3 % | 10 | 286
GCV2 seule (G1-b) | 392 | **144** | 100 | 6 | 5 | 26 (6,6 %) ≤ 9,5 % | 38 | 246
hasard | 375 | **20,4** | 10 | 124,7 | 5,7 | 189,5 (50,5 %) ≤ 55,6 % | 0 | 343,7
H0 | 0 | **0** | 0 | 0 | 0 | 0 (—) — | 0 | 406

##### Usage « lot » — total (2411 cuts jugés, mêmes cuts pour toutes les lignes)

méthode | agit | corrections justes | dont à 5 mm | abîmés | mauvaise voie | erreurs (part des actions), Wilson | abstentions | grosses laissées fausses
---|--:|--:|--:|--:|--:|--:|--:|--:
règle prudente seule | 136 | **107** | 84 | 4 | 0 | 10 (7,4 %) ≤ 13 % | 755 | 293
V1 | 258 | **123** | 94 | 2 | 0 | 11 (4,3 %) ≤ 7,5 % | 136 | 274
V2 | 447 | **143** | 106 | 6 | 0 | 18 (4 %) ≤ 6,3 % | 140 | 251
V3 | 405 | **110** | 84 | 6 | 0 | 14 (3,5 %) ≤ 5,7 % | 11 | 288
GCV2 seule (G1-b) | 466 | **125** | 92 | 9 | 5 | 30 (6,4 %) ≤ 9 % | 38 | 261
hasard | 450,7 | **18,6** | 9,8 | 161,9 | 5,1 | 231,8 (51,4 %) ≤ 56 % | 0 | 345,4
H0 | 0 | **0** | 0 | 0 | 0 | 0 (—) — | 0 | 406

##### Porte du plan

usage | variante | 0 mauvaise voie | erreur ≤ 9 % | borne de Wilson ≤ 9 % | justes ≥ prudente | abîmés ≤ prudente | **porte**
---|---|---|---|---|---|---|---
relecture | V1, tous les cuts | oui (0) | oui (3,5 %) | oui (≤ 6,5 %) | oui (128 contre 107) | oui (2 contre 4) | **oui**
relecture | V1, périmètre prudent | oui (0) | oui (3,5 %) | oui (≤ 6,5 %) | oui (128 contre 107) | oui (2 contre 4) | **oui**
relecture | V2, tous les cuts | oui (0) | oui (3,6 %) | oui (≤ 6,1 %) | oui (151 contre 107) | NON (5 contre 4) | **NON**
relecture | V2, périmètre prudent | oui (0) | oui (3,5 %) | oui (≤ 6,5 %) | oui (128 contre 107) | oui (2 contre 4) | **oui**
relecture | V3, tous les cuts | oui (0) | oui (2,9 %) | oui (≤ 5,3 %) | oui (118 contre 107) | NON (5 contre 4) | **NON**
relecture | V3, périmètre prudent | oui (0) | oui (2,3 %) | oui (≤ 5,3 %) | NON (95 contre 107) | oui (2 contre 4) | **NON**
lot | V1, tous les cuts | oui (0) | oui (4,3 %) | oui (≤ 7,5 %) | oui (123 contre 107) | oui (2 contre 4) | **oui**
lot | V1, périmètre prudent | oui (0) | oui (4,3 %) | oui (≤ 7,5 %) | oui (123 contre 107) | oui (2 contre 4) | **oui**
lot | V2, tous les cuts | oui (0) | oui (4 %) | oui (≤ 6,3 %) | oui (143 contre 107) | NON (6 contre 4) | **NON**
lot | V2, périmètre prudent | oui (0) | oui (4,3 %) | oui (≤ 7,5 %) | oui (123 contre 107) | oui (2 contre 4) | **oui**
lot | V3, tous les cuts | oui (0) | oui (3,5 %) | oui (≤ 5,7 %) | oui (110 contre 107) | NON (6 contre 4) | **NON**
lot | V3, périmètre prudent | oui (0) | oui (3,2 %) | oui (≤ 6,5 %) | NON (90 contre 107) | oui (2 contre 4) | **NON**

##### Par zone — usage « relecture » (agit / justes / abîmés / mauvaise voie / erreurs)

zone | Mic > 10 mm | règle prudente | V1 | V2 | V3 | GCV2 seule
---|--:|---|---|---|---|---
pn | 86 | 60 / 56 / 2 / 0 / 2 | 163 / 68 / 2 / 0 / 3 | 163 / 68 / 2 / 0 / 3 | 163 / 68 / 2 / 0 / 3 | 168 / 69 / 2 / 0 / 3
adv | 65 | 34 / 18 / 2 / 0 / 4 | 52 / 27 / 0 / 0 / 2 | 52 / 27 / 0 / 0 / 2 | 52 / 27 / 0 / 0 / 2 | 66 / 38 / 0 / 0 / 3
abords | 214 | 42 / 33 / 0 / 0 / 4 | 42 / 33 / 0 / 0 / 4 | 42 / 33 / 0 / 0 / 4 | 0 / 0 / 0 / 0 / 0 | 58 / 14 / 1 / 5 / 16
liste | 7 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0
hors | 34 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 100 / 23 / 3 / 0 / 4 | 100 / 23 / 3 / 0 / 4 | 100 / 23 / 3 / 0 / 4

##### Par zone — usage « lot » (agit / justes / abîmés / mauvaise voie / erreurs)

zone | Mic > 10 mm | règle prudente | V1 | V2 | V3 | GCV2 seule
---|--:|---|---|---|---|---
pn | 86 | 60 / 56 / 2 / 0 / 2 | 159 / 65 / 1 / 0 / 3 | 159 / 65 / 1 / 0 / 3 | 159 / 65 / 1 / 0 / 3 | 162 / 66 / 1 / 0 / 3
adv | 65 | 34 / 18 / 2 / 0 / 4 | 57 / 25 / 1 / 0 / 4 | 57 / 25 / 1 / 0 / 4 | 57 / 25 / 1 / 0 / 4 | 68 / 32 / 1 / 0 / 7
abords | 214 | 42 / 33 / 0 / 0 / 4 | 42 / 33 / 0 / 0 / 4 | 42 / 33 / 0 / 0 / 4 | 0 / 0 / 0 / 0 / 0 | 47 / 7 / 3 / 5 / 13
liste | 7 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0
hors | 34 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 189 / 20 / 4 / 0 / 7 | 189 / 20 / 4 / 0 / 7 | 189 / 20 / 4 / 0 / 7

##### Par partie — usage « relecture » (agit / justes / abîmés / mauvaise voie)

partie | Mic > 10 mm | règle prudente | V1 | V2 | V3 | GCV2 seule
---|--:|---|---|---|---|---
1:12 | 24 | 19 / 19 / 0 / 0 | 36 / 22 / 0 / 0 | 37 / 23 / 0 / 0 | 37 / 23 / 0 / 0 | 37 / 23 / 0 / 0
1:13 | 21 | 15 / 10 / 1 / 0 | 35 / 18 / 0 / 0 | 35 / 18 / 0 / 0 | 35 / 18 / 0 / 0 | 35 / 18 / 0 / 0
1:14 | 15 | 16 / 14 / 0 / 0 | 32 / 15 / 0 / 0 | 32 / 15 / 0 / 0 | 32 / 15 / 0 / 0 | 32 / 15 / 0 / 0
1:15 | 7 | 12 / 6 / 1 / 0 | 19 / 6 / 0 / 0 | 27 / 7 / 0 / 0 | 27 / 7 / 0 / 0 | 27 / 7 / 0 / 0
1:16 | 20 | 10 / 7 / 1 / 0 | 45 / 11 / 2 / 0 | 56 / 15 / 3 / 0 | 56 / 15 / 3 / 0 | 56 / 15 / 3 / 0
1:17 | 44 | 5 / 3 / 0 / 0 | 5 / 3 / 0 / 0 | 32 / 8 / 0 / 0 | 27 / 5 / 0 / 0 | 36 / 9 / 1 / 0
1:24 | 24 | 4 / 1 / 0 / 0 | 4 / 1 / 0 / 0 | 5 / 1 / 0 / 0 | 1 / 0 / 0 / 0 | 13 / 5 / 0 / 0
1:29 | 93 | 42 / 38 / 0 / 0 | 48 / 38 / 0 / 0 | 75 / 42 / 2 / 0 | 42 / 13 / 2 / 0 | 50 / 19 / 2 / 0
2:1 | 134 | 6 / 5 / 0 / 0 | 11 / 7 / 0 / 0 | 29 / 9 / 0 / 0 | 29 / 9 / 0 / 0 | 69 / 17 / 0 / 5
2:10 | 1 | 0 / 0 / 0 / 0 | 4 / 0 / 0 / 0 | 4 / 0 / 0 / 0 | 4 / 0 / 0 / 0 | 4 / 0 / 0 / 0
2:11 | 23 | 7 / 4 / 1 / 0 | 18 / 7 / 0 / 0 | 25 / 13 / 0 / 0 | 25 / 13 / 0 / 0 | 33 / 16 / 0 / 0

##### Par partie — usage « lot » (agit / justes / abîmés / mauvaise voie)

partie | Mic > 10 mm | règle prudente | V1 | V2 | V3 | GCV2 seule
---|--:|---|---|---|---|---
1:12 | 24 | 19 / 19 / 0 / 0 | 37 / 22 / 0 / 0 | 43 / 23 / 0 / 0 | 43 / 23 / 0 / 0 | 43 / 23 / 0 / 0
1:13 | 21 | 15 / 10 / 1 / 0 | 33 / 14 / 0 / 0 | 34 / 14 / 0 / 0 | 34 / 14 / 0 / 0 | 34 / 14 / 0 / 0
1:14 | 15 | 16 / 14 / 0 / 0 | 34 / 15 / 0 / 0 | 34 / 15 / 0 / 0 | 34 / 15 / 0 / 0 | 34 / 15 / 0 / 0
1:15 | 7 | 12 / 6 / 1 / 0 | 18 / 6 / 1 / 0 | 50 / 7 / 1 / 0 | 50 / 7 / 1 / 0 | 50 / 7 / 1 / 0
1:16 | 20 | 10 / 7 / 1 / 0 | 53 / 11 / 1 / 0 | 85 / 15 / 4 / 0 | 85 / 15 / 4 / 0 | 85 / 15 / 4 / 0
1:17 | 44 | 5 / 3 / 0 / 0 | 5 / 3 / 0 / 0 | 31 / 7 / 0 / 0 | 26 / 4 / 0 / 0 | 36 / 6 / 2 / 0
1:24 | 24 | 4 / 1 / 0 / 0 | 4 / 1 / 0 / 0 | 5 / 1 / 0 / 0 | 1 / 0 / 0 / 0 | 4 / 1 / 0 / 0
1:29 | 93 | 42 / 38 / 0 / 0 | 42 / 38 / 0 / 0 | 92 / 41 / 1 / 0 | 59 / 12 / 1 / 0 | 64 / 16 / 1 / 0
2:1 | 134 | 6 / 5 / 0 / 0 | 11 / 7 / 0 / 0 | 27 / 8 / 0 / 0 | 27 / 8 / 0 / 0 | 65 / 14 / 1 / 5
2:10 | 1 | 0 / 0 / 0 / 0 | 4 / 0 / 0 / 0 | 4 / 0 / 0 / 0 | 4 / 0 / 0 / 0 | 4 / 0 / 0 / 0
2:11 | 23 | 7 / 4 / 1 / 0 | 17 / 6 / 0 / 0 | 42 / 12 / 0 / 0 | 42 / 12 / 0 / 0 | 47 / 14 / 0 / 0

### 11.3 La porte du plan

La porte : 0 mauvaise voie, erreur parmi les actions ≤ 9 %, corrections justes ≥ règle prudente, abîmés ≤ règle prudente. La lecture qui compte est « tous les cuts » ; la lecture « périmètre prudent » (verts de PN, ADV et abords) est donnée en plus, comme au § 6.

| Variante | Relecture | Lot |
|---|---|---|
| **V1** | **porte tenue** : 0 mauvaise voie, erreur 3,5 % (Wilson ≤ 6,5 %), 128 justes contre 107, 2 abîmés contre 4 | **porte tenue** : 0 mauvaise voie, erreur 4,3 % (Wilson ≤ 7,5 %), 123 justes contre 107, 2 abîmés contre 4 |
| **V2** | **non tenue** : 5 abîmés contre 4 (tout le reste est tenu : 0 mauvaise voie, erreur 3,6 %, 151 justes) | **non tenue** : 6 abîmés contre 4 (0 mauvaise voie, erreur 4 %, 143 justes) |
| **V3** | **non tenue** : 5 abîmés contre 4 ; dans le périmètre prudent, 95 justes contre 107 | **non tenue** : 6 abîmés contre 4 ; dans le périmètre prudent, 90 justes contre 107 |

Pour V2, la lecture « périmètre prudent » est tenue (elle est égale à V1, puisque le hors zone en est exclu) ; la porte ne l'est pas sur tous les cuts. Ce n'est pas une lecture plus douce qui la fait passer : c'est le hors zone (3 abîmés en relecture, 4 au lot) qui la fait échouer.

### 11.4 Lecture

- **V1 tient la porte dans les deux usages.** Elle corrige 21 cuts justes de plus que la règle prudente en relecture (128 contre 107) et 16 de plus au lot (123), avec la moitié des abîmés (2 contre 4) et 0 mauvaise voie. Le gain vient de **PN** (68 justes contre 56) et d'**ADV** (27 contre 18) ; aux abords la variante **est** la règle prudente (42 actions, 33 justes, identiques). Aucune partie n'a moins de justes que la règle prudente.
- **V2 ajoute le hors zone** : 23 justes de plus en relecture (151), mais 3 abîmés de plus. Elle dépasse la limite de 4 abîmés d'un cut en relecture et de deux au lot.
- **V3 retire les abords** et perd les 33 corrections justes que la règle prudente y fait : dans le périmètre prudent, 95 justes contre 107. Elle laisse 286 grosses corrections fausses, contre 249 pour V2.
- **Les mauvaises voies tombent à 0 dans les trois variantes.** C'est **par construction** : les 5 mauvaises voies de la relecture (4 au lot) étaient des cuts différés, et le seul vert à mauvaise voie du lot était aux abords ; D-204 les a écartés en lisant ces résultats. La borne haute de 0 sur 257 actions est d'environ 1,2 % (règle des trois), sur des cuts que l'on a déjà regardés : ce n'est pas une preuve.
- **Taille des écarts.** 2 abîmés contre 4, ou 5 contre 4, sont des écarts de quelques cuts sur 2 411, sur 11 parties et un seul opérateur. Les bornes de Wilson de l'erreur sont toutes en dessous de 9 % (V1 ≤ 6,5 % et ≤ 7,5 %), plus basses que celles de la GCV2 seule (≤ 9,5 % et ≤ 9 %).
- **Le lot** perd 5 justes pour V1 (123 contre 128) : même ordre qu'au § 5.1. Sa limite (§ 2.5) reste : les voisins mixtes du lot ne sont pas recalculés.

### 11.5 Ce que ces chiffres ne disent pas

1. **Les variantes ont été choisies sur les cuts qui les jugent.** Un partage en zones et en rôles choisi en regardant les erreurs de chaque zone fera toujours mieux sur ces cuts que sur d'autres. La validation croisée par partie protège τ, δ et le modèle ; elle ne protège pas le choix des zones.
2. **Les abords restent le point faible.** Ils portent 214 des 406 grosses corrections, et la règle prudente n'en corrige justes que 33 (15 %). V1 et V2 ne changent pas ce point ; V3 l'aggrave.
3. **Une zone de plus à surveiller : le hors zone.** Il apporte des corrections justes (23) mais aussi les abîmés qui font échouer V2 et V3. Les seuils de la zone sont bas (τ de 0,3 à 0,6, § 3).
4. **Les abîmés de V2 et de V3 viennent surtout de deux parties** : 1:16 (3 en relecture, 4 au lot) et 1:29 (2 en relecture, 1 au lot). Ils sont peu nombreux, donc fragiles à lire.
5. **Rien n'est activé.** La décision d'activer une variante reste à Mic, après G1-c.

### 11.6 Reproduire

```
nice -n 10 node tools/gcv2-apprendre.cjs valider --jeu jeu-1-12.jsonl … --usage relecture --variante V1 --variante V2 --variante V3 --sortie Vvar.json
nice -n 10 node tools/gcv2-apprendre.cjs valider --jeu … --usage lot --variante V1 --variante V2 --variante V3 --sortie Vvar-lot.json
node tools/gcv2-apprendre.cjs rapport --json Vvar.json
node --test tests/gcv2-apprendre.test.cjs
```

Chaque validation prend de 13 à 17 minutes sur une machine peu chargée (un seul calcul sert aux trois variantes).
