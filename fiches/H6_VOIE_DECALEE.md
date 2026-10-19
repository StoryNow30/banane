# H6 « voie décalée » — hypothèse, garde-fou de voie et validation croisée (19 octobre 2026)

Chantier H6 (D-207). Étude **hors ligne** : rien sous `src/` ne change, aucune action dans ESV. Outils : `tools/gcv2-jeu.cjs` (H6, jeu « lot »), `tools/gcv2-apprendre.cjs` (garde-fou de voie, V1+). Essais : `tests/gcv2-jeu.test.cjs`, `tests/gcv2-apprendre.test.cjs`. Variantes : `datasets/gcv2-variantes-h6.json`. Paramètres : `datasets/gcv2-parametres-h6.json` (`datasets/gcv2-parametres.json` n'a pas changé). Les parties sont désignées par leur rang (« 2:1 » = projet 2, partie 1). Seuls des numéros de cut, des millimètres et des comptes figurent ici. Les parties 2:6, 2:7, 1:11 et 1:25 n'ont pas été lues.

L'audit externe de G1-b (`audit/chantiers/audit-gcv2-g1b-astra.md`) est arrivé pendant le chantier. Trois de ses exigences y sont entrées : **F3** (jeu « lot » généré sans appui humain), **H1** (garde de série prouvé, essais adverses) et **H2** (mesures de voie séparées). Elles sont toutes appliquées avant la validation croisée.

## 1. En bref

| Question | Réponse |
|---|---|
| **H6** | La pose d'ESV d'origine, translatée du décalage (latéral, vertical) d'un voisin sûr à 10 cuts au plus : le plus proche, et la médiane des 5 plus proches ; rail par rail et « paire ». Même règle de temps que H4. |
| **Rappel atteignable** (corrections > 10 mm, paire à 10 mm, 406 cas) | Relecture : **83,0 % → 87,2 %** (G1-a : 83,7 %). Lot, jeu généré sans appui humain : **76,4 % → 78,8 %**. |
| **Abords** | Relecture 75,7 % → **81,3 %** ; lot 65,9 % → 68,7 %. |
| **Partie 2:1** | Relecture 57,5 % → **68,7 %** ; lot 41,0 % → 44,8 %. |
| **Zone 2 de 2:1** (cuts 293–459, 87 grosses corrections) | Relecture 40,2 % → **55,2 %** ; lot 28,7 % → 31,0 %. |
| **Les 57 cuts de D-206** | Relecture 0 → **15** ; lot 0 → **3**. |
| **V1 avec H6** (sans garde-fou de voie) | Relecture : 130 justes, 1 abîmé, 0 erreur > 50 mm, erreur 2,8 % (Wilson ≤ 5,6 %). Lot : 123 justes, 1 abîmé, 0, 2,9 % (≤ 5,8 %). Règle prudente : 107 justes, 4 abîmés. **Porte tenue** dans les deux usages. |
| **V1+** (V1 et les différés, garde-fou de voie) | Relecture : 136 justes, 1 abîmé, 0 erreur > 50 mm, 0 hors corridor, erreur 2,7 % (≤ 5,4 %). Lot : 131 justes, 1 abîmé, 0, 0, 3,2 % (≤ 6,1 %). **Porte tenue** (erreur finale, dégâts). Mais 3 actions (5 au lot) déplacent un rail de plus de 45 mm depuis H0 : selon la définition de G1-b, ce sont 3 (5) « mauvaises voies », alors que toutes sont à 15 mm au plus de Mic. |
| **Ce que V1+ ajoute** | Peu : +6 justes en relecture (7 différés agis), +8 au lot (10). **Aucune action dans la zone 2 de 2:1.** Le garde-fou de série ne trouve une référence sûre que pour 9 différés sur 161 (17 au lot). |
| **Franchement** | H6 nourrit l'apprentissage (rappel + 17 cuts en relecture, + 10 au lot). V1+ tient la porte, mais parce que le garde-fou interdit presque tout : il ne résout pas la zone 2. |

## 2. Méthode

### 2.1 L'hypothèse H6

- **Le décalage d'un voisin** : sa pose sûre moins sa pose d'ESV **d'origine**, en (latéral, vertical) mm, dans le repère profil de son rail de départ.
  - Voisin que le lot n'a pas posé : la pose d'origine est sa pose de départ dans l'Écho.
  - Voisin posé par le lot : la pose de départ de l'Écho est celle du lot. La pose d'ESV d'origine est la pose de départ **moins le déplacement du lot** (pose corrigée − pose initiale, lus dans le journal du lot). Le journal et l'Écho n'ont pas la même origine de scène : seule la différence se transporte (une première version soustrayait les positions brutes et donnait des écarts de plusieurs kilomètres ; corrigé, essai ajouté, jeux reconstruits).
- **Voisin sûr** : même règle de temps que H4 (`voisinsSursA`). Une pose de Mic validée **avant la première visite** du cut, ou une pose que le lot a posée et validée. Jamais la pose du cut lui-même, jamais une pose d'Ariane non vérifiée (chaîne), jamais une pose de la GCV2.
- **La pose H6** : la pose d'ESV d'origine du cut, translatée du décalage. Pour un cut que le lot a posé, la pose d'origine se lit de la même façon (journal du lot) ; inconnue, pas de H6.
- **Variantes** (fenêtre de 10 cuts) : le voisin **le plus proche** (à égalité, l'amont) ; la **médiane** des 5 plus proches (2 au moins). Chacune **rail par rail** et **« paire »** (la moyenne des deux rails du voisin, appliquée aux deux rails). Chacune avec et sans hauteur apprise.
- **Source marquée** : `h6-lot-…` (voisins validés par le lot seuls) et `h6-humain-…` (au moins un voisin humain). Exemple : `h6-lot-mediane-rail`.
- **Priorité** : après H5 et **avant H2** ; le plafond de 12 poses par rail tient. Les H6 poussent des cellules H2 hors du plafond : 3 grosses corrections de moins « avant H6 » en relecture (340 → 337), voir § 4.
- **Traits sans fuite** (`traits` de l'hypothèse) : `h6AmpleurMm` (ampleur de la translation), `h6DistCuts` (distance au voisin, la plus grande pour la médiane), `h6NVoisins`, `h6DispersionMm` (étendue latérale des décalages des voisins : leur accord), `h6DansReservoir`, `h6Perte` et `h6LignesSommet`.
  - **Perte et lignes au sommet** : connues seulement si une cellule du réservoir du moteur est à 5 mm de la pose. Au-delà d'environ 150 mm, la pose est hors de la fenêtre du moteur (± 180 mm) : **le réservoir ne permet pas de l'évaluer**, les deux traits restent nuls.
  - **Points du dessus et du flanc** (traits généraux) : pour une H6, ils sont comptés sur la capture dont le rail est **translaté** jusqu'à la pose. Sinon la bande de points (± 180 mm autour du départ) ne voit rien à 200 mm.
- Les hypothèses H0 à H5 ne changent pas : sur les 11 parties, toutes les hypothèses hors H6 du nouveau jeu sont identiques à celles de G1-a (décalage, origines, traits, étiquette), sauf l'écartement de paire contre la médiane (il dépend de toutes les poses de l'autre rail) et les cellules H2 poussées par le plafond.

### 2.2 Deux usages, deux jeux (audit F3)

- **Relecture** : `jeu-P.jsonl`, voisins humains permis (H4 et H6 « humain »).
- **Lot** : `jeu-lot-P.jsonl`, **généré** par le même passage (`--sortie-lot`) depuis des entrées **sans aucun appui humain** : H4 et H6 n'ont que les voisins du lot, **avant** déduplication, plafond et traits. Il n'est plus obtenu en filtrant le jeu de relecture. Conséquence directe : un H4 « voisins du lot » existe enfin pour les cuts à voisins mixtes. Avant H6, le rappel du lot passe de 72,4 % (filtrage de G1-a) à 76,4 % (jeu généré). `gcv2-apprendre` lit le jeu lot tel quel et refuse un jeu de relecture pour l'usage lot.

### 2.3 Garde-fou de voie des différés (option `--garde-voie`)

Le défaut ne change pas. Sans l'option, un rail est écarté s'il bouge de plus de 45 mm en travers depuis la pose de départ. Avec l'option, pour un cut **différé** seulement :

- **Voie de référence de la série** : la médiane rail par rail des décalages des 5 voisins sûrs les plus proches (10 cuts au plus), dans la famille de l'usage (« tous » en relecture, « lot » au lot). Elle est calculée sans la pose du cut.
- **Elle n'est sûre qu'avec des preuves** (audit H1) :
  1. au moins 2 appuis vérifiés et datés ;
  2. appuis concordants : étendue latérale de 50 mm au plus sur chaque rail (sinon « appuis contradictoires ») ;
  3. propagation limitée : l'appui le plus proche à 5 cuts au plus ;
  4. **support local des deux rails** à la pose de référence : au moins 5 points du dessus et 3 du flanc sous le gabarit, sur la capture translatée (les seuils `minTop` et `minFace` du lot) ;
  5. **pas de voie concurrente** : si la pose de départ a aussi ce support sur les deux rails, alors que la référence en est à plus de 45 mm, on s'abstient ;
  6. **pas de rupture de série** : aucun cut entre l'appui et le cut n'a un autre statut ADV que le cut (bifurcation).
- **Garde** : chaque rail à 45 mm au plus, en latéral, de la référence ; changement de dévers à 15 mm au plus de celui de la référence ; écartement de la paire comme ailleurs.
- **Sans référence sûre : aucune paire n'est permise, on n'agit pas.**
- **Ce que le garde-fou promet, et ce qu'il ne promet pas** (audit M4) : quand la référence est sûre, une pose hors de la voie de référence est impossible par construction. La référence elle-même peut être fausse, par exemple si deux appuis du lot concordent sur une mauvaise branche. Les preuves 4 et 5 la contrôlent, sans la garantir.
- **« Mauvaise voie » pour ces cuts** : pose à plus de 50 mm de celle de Mic, ou hors de la voie de référence (plus de 45 mm). Conformément à l'audit H2, la définition de G1-b n'est **pas** changée pour faire passer V1+. Quatre mesures sont publiées séparément :
  - erreur finale > 50 mm ;
  - amplitude > 45 mm depuis H0 ;
  - sortie du corridor du garde-fou ;
  - « mauvaise voie » au sens de G1-b (erreur > 50 mm ou amplitude > 45 mm).

  La **porte** garde l'erreur finale (0 pose à plus de 50 mm), le corridor (0 sortie) et les dégâts (abîmés ≤ règle prudente). Sans l'option, elle est exactement celle de G1-b. Le choix de τ et δ dans chaque pli suit la même règle : erreur finale ≤ 50 mm et corridor.

### 2.4 V1+ (déclarée avant le calcul)

`datasets/gcv2-variantes-h6.json`, commité (0d7c7b7) avant toute validation croisée et inchangé depuis :
- V1 : celle de D-204 ;
- **V1+** : V1, plus la GCV2 sur les **différés de toutes les zones**, sous le garde-fou de voie ; jamais un rouge.

Les preuves de l'audit (§ 2.3) ont été ajoutées après cette déclaration, mais **avant** tout calcul de validation croisée ; les zones et rôles n'ont pas bougé. L'outil refuse une variante qui confie un différé à la GCV2 sans `--garde-voie`.

## 3. Anti-fuite

### 3.1 Les essais

- **H6 (1)** : changer la pose finale du cut ne change aucune ligne H6, ni aucune ligne du cut, étiquette mise à part. Écho synthétique de bout en bout, observateur et lignes du jeu.
- **H6 (2)** : un voisin validé **après** la première visite ne change rien. Contre-épreuve : validé plus tôt, il entre ; l'essai n'est pas vide.
- **H6 (3)** : un voisin validé **avant** change H6 (son décalage passe tel quel). Un voisin du lot compte toujours. La voie de référence porte la liste de ses appuis (cut, source).
- **Lot (audit F3)** : modifier l'appui humain d'avant, rendre sûr un voisin d'après, ou **supprimer toutes les validations humaines** : le jeu lot est identique, octet pour octet, étiquettes retirées. Contre-épreuve : le jeu de relecture, lui, change.
- **Pas d'auto-validation** : changer les poses de la chaîne d'Ariane (non vérifiées) ne change pas la voie de référence. `posesVerifiees` ne connaît que des sources « humain » et « lot ».
- **Repère** : le journal du lot et l'Écho ont des origines différentes ; seul le déplacement se transporte.
- Les essais de G1-a restent verts : la fonction des hypothèses ne nomme aucun champ de référence ; aucune coordonnée absolue ne sort. Les jeux ne contiennent que des décalages de 300 mm au plus.

### 3.2 Relecture hostile de la frontière

- **Ce qui entre dans H6** : les poses sûres d'**autres** cuts, sous la règle de temps de H4 (fin de la visite qui a validé, strictement avant le début de la première visite du cut), les poses de départ et le **journal du lot**. Le journal est le produit du lot, antérieur à l'Écho, et non un geste de Mic.
- **Ce qu'on a vérifié qui n'entre pas** :
  - la pose du cut ;
  - une validation de Mic postérieure, y compris une revalidation : `referenceHumaine` prend la dernière validation, et son instant l'exclut si elle est postérieure ;
  - la chaîne d'Ariane ;
  - les champs `visites`, `reference` et `etat`, qui ne sont toujours pas des traits.
- **Reste discutable** :
  1. une validation « sans action » de Mic (visite de 0,8 s) compte comme pose humaine sûre, comme pour H4 ;
  2. les voisins du lot sont datés « avant tout » : au lot réel, un différé est repris après le premier passage, donc ces poses existent bien, mais seulement à la reprise ;
  3. la rupture de série lit la carte des zones, que l'audit (F4) soupçonne de lire des nuages postérieurs ;
  4. la voie de référence et le garde-fou ne sont pas des traits du modèle, mais ils décident quelles paires sont permises.

## 4. Rappel atteignable, avant et après H6

Corrections de Mic de plus de 10 mm sur les cuts avec nuage (406). « Atteint » : les deux rails ont une hypothèse à 10 mm de la pose finale (avec ou sans hauteur apprise). Colonnes :
- « G1-a » : les jeux de G1-a ;
- « avant » et « après » : les nouveaux jeux, sans puis avec H6.

| | n | G1-a | Relecture, avant | **Relecture, après** | Lot, avant | **Lot, après** |
|---|--:|--:|--:|--:|--:|--:|
| Global | 406 | 83,7 % (340/406) | 83,0 % (337/406) | **87,2 % (354/406)** | 76,4 % (310/406) | **78,8 % (320/406)** |
| zone pn | 86 | 95,3 % (82/86) | 95,3 % (82/86) | **96,5 % (83/86)** | 94,2 % (81/86) | **94,2 % (81/86)** |
| zone adv | 65 | 89,2 % (58/65) | 87,7 % (57/65) | **89,2 % (58/65)** | 81,5 % (53/65) | **86,2 % (56/65)** |
| zone abords | 214 | 76,2 % (163/214) | 75,7 % (162/214) | **81,3 % (174/214)** | 65,9 % (141/214) | **68,7 % (147/214)** |
| zone liste | 7 | 100,0 % (7/7) | 100,0 % (7/7) | **100,0 % (7/7)** | 100,0 % (7/7) | **100,0 % (7/7)** |
| zone hors | 34 | 88,2 % (30/34) | 85,3 % (29/34) | **94,1 % (32/34)** | 82,4 % (28/34) | **85,3 % (29/34)** |
| rôle vert | 227 | 96,0 % (218/227) | 95,2 % (216/227) | **96,5 % (219/227)** | 94,7 % (215/227) | **95,2 % (216/227)** |
| rôle rouge | 24 | 87,5 % (21/24) | 87,5 % (21/24) | **87,5 % (21/24)** | 79,2 % (19/24) | **83,3 % (20/24)** |
| rôle différé | 155 | 65,2 % (101/155) | 64,5 % (100/155) | **73,5 % (114/155)** | 49,0 % (76/155) | **54,2 % (84/155)** |
| partie 2:1 | 134 | 57,5 % (77/134) | 57,5 % (77/134) | **68,7 % (92/134)** | 41,0 % (55/134) | **44,8 % (60/134)** |
| 2:1, cuts 293–459 | 87 | 40,2 % (35/87) | 40,2 % (35/87) | **55,2 % (48/87)** | 28,7 % (25/87) | **31,0 % (27/87)** |
| 2:1, les 57 de D-206 | 57 | 0,0 % (0/57) | 0,0 % (0/57) | **26,3 % (15/57)** | 0,0 % (0/57) | **5,3 % (3/57)** |
| partie 1:17 | 44 | 88,6 % (39/44) | 88,6 % (39/44) | **90,9 % (40/44)** | 84,1 % (37/44) | **88,6 % (39/44)** |
| partie 1:24 | 24 | 95,8 % (23/24) | 91,7 % (22/24) | **91,7 % (22/24)** | 83,3 % (20/24) | **91,7 % (22/24)** |
| partie 1:29 | 93 | 98,9 % (92/93) | 96,8 % (90/93) | **97,8 % (91/93)** | 96,8 % (90/93) | **96,8 % (90/93)** |
| partie 2:11 | 23 | 91,3 % (21/23) | 91,3 % (21/23) | **91,3 % (21/23)** | 87,0 % (20/23) | **91,3 % (21/23)** |

- **À 5 mm** : relecture 63,1 % → 67,0 % ; lot 58,1 % → 60,3 %.
- **Apport propre de H6** (corrections perdues sans elle, toutes les autres gardées) : 17 en relecture, 10 au lot. À comparer : H4 22 et 11, H3 11 et 27.
- **Par variante, H0 + H6 seule** (relecture) :
  - toutes : 35,0 % ;
  - voisin le plus proche : 28,3 % ; médiane : 19,0 % ;
  - rail par rail : 30,5 % ; « paire » : 6,4 % ;
  - famille du lot : 16,3 %.

  **Le décalage rail par rail du voisin le plus proche est la variante utile**. Le même décalage aux deux rails n'atteint presque rien, car en zone 2 les deux rails de Mic ne bougent pas autant (par exemple 149 et 80 mm au cut 306).
- **Le coût du plafond** : H6 passe avant H2 et pousse des cellules hors des 12 poses (3 grosses corrections perdues en relecture : 1:24 et 1:29). Les cellules écartées n'en auraient rattrapé que 3.
- **Le hasard monte** : avec les hypothèses d'un autre cut à 3 rangs, 54 % des grosses corrections seraient « atteintes » (G1-a : 29 %). H6 copie le décalage des cuts voisins, qui ressemble à celui du cut. Le rappel est un plafond, pas une justesse.
- **Les 57 cuts de D-206** (§ 6) : D-206 en compte « 53 dans la zone 2 ». Recalculés depuis le jeu de G1-a, ce sont **52** cuts de 293 à 459, plus le cut 159 (vert, hors zone) et les 4 cuts d'ADV.

## 5. Validation croisée relancée (G1-b, mêmes plis et même méthode)

Mêmes 11 plis par partie, même modèle, mêmes τ et δ appris par zone dans chaque pli. Mêmes références : règle prudente figée, hasard au même taux, H0. 2 411 cuts jugés.
- Relecture : jeux de relecture.
- Lot : jeux « lot » générés sans appui humain.
- « V1 » : sans le garde-fou de voie. « V1+ » : avec `--garde-voie` ; dans cette passe, V1 est identique sur les verts.

Brier hors échantillon p(10 mm) : 0,0405 (relecture), 0,0408 (lot) ; G1-b : 0,043.

### 5.1 Totaux

| usage | méthode | agit | justes | abîmés | erreur > 50 mm | amplitude > 45 mm depuis H0 | hors corridor | « mauvaise voie » (G1-b) | erreurs (part), Wilson |
|---|---|--:|--:|--:|--:|--:|--:|--:|---|
| relecture | **V1** | 254 | **130** | **1** | 0 | 0 | 0 | 0 | 7 (2,8 %), ≤ 5,6 % |
| relecture | **V1+** | 261 | **136** | **1** | **0** | 3 | **0** | 3 | 7 (2,7 %), ≤ 5,4 % |
| relecture | règle prudente | 136 | 107 | 4 | 0 | 0 | 0 | 0 | 10 (7,4 %), ≤ 13 % |
| relecture | GCV2 seule, sans garde-fou de voie | 355 | 134 | 2 | 2 | 0 | 0 | 2 | 21 (5,9 %), ≤ 8,9 % |
| relecture | GCV2 seule, garde-fou de voie | 633 | 152 | 2 | 0 | 3 | 0 | 3 | 24 (3,8 %), ≤ 5,6 % |
| relecture | hasard (passe V1+) | 594,6 | 23,2 | 165,2 | 2 | 1,6 | 0 | 3,7 | 296,4 (49,8 %) |
| lot | **V1** | 242 | **123** | **1** | 0 | 0 | 0 | 0 | 7 (2,9 %), ≤ 5,8 % |
| lot | **V1+** | 252 | **131** | **1** | **0** | 5 | **0** | 5 | 8 (3,2 %), ≤ 6,1 % |
| lot | règle prudente | 136 | 107 | 4 | 0 | 0 | 0 | 0 | 10 (7,4 %), ≤ 13 % |
| lot | GCV2 seule, sans garde-fou de voie | 466 | 133 | 4 | 7 | 0 | 0 | 7 | 26 (5,6 %), ≤ 8 % |
| lot | GCV2 seule, garde-fou de voie | 741 | 151 | 4 | 1 | 5 | 0 | 6 | 28 (3,8 %), ≤ 5,4 % |
| lot | hasard (passe V1+) | 707,8 | 27,3 | 217,1 | 2,5 | 4,1 | 0 | 6,6 | 369 (52,1 %) |

Pour mémoire, G1-b, V1 sur les jeux de G1-a : relecture 128 justes, 2 abîmés, 3,5 % ; lot 123 justes, 2 abîmés, 4,3 %.

### 5.2 La porte

Porte : 0 erreur finale > 50 mm, 0 sortie de corridor, erreur ≤ 9 %, justes ≥ règle prudente, abîmés ≤ règle prudente.

| | relecture | lot |
|---|---|---|
| **V1** | **tenue** : 0 / 0, 2,8 % (≤ 5,6 %), 130 contre 107 justes, 1 contre 4 abîmés | **tenue** : 0 / 0, 2,9 % (≤ 5,8 %), 123 contre 107, 1 contre 4 |
| **V1+** | **tenue** : 0 / 0, 2,7 % (≤ 5,4 %), 136 contre 107, 1 contre 4 | **tenue** : 0 / 0, 3,2 % (≤ 6,1 %), 131 contre 107, 1 contre 4 |

**V1+ et la « mauvaise voie » de G1-b.**
- Lue avec la définition de G1-b (erreur > 50 mm **ou** rail déplacé de plus de 45 mm depuis H0), V1+ a 3 « mauvaises voies » en relecture et 5 au lot. Elle ne tiendrait donc pas l'ancienne porte.
- Ces actions sont toutes des corrections justes ou presque : cuts 7534 de 1:17 (Mic 120 mm, pose à 6 mm), 5716 et 5722 de 1:24 (106 et 111 mm, à 8 et 15 mm), 6565 de 1:29 (50 mm, à 5 mm), 2949 de 2:1 (51 mm, à 5 mm).
- Ce changement de comparabilité est voulu et déclaré (audit H2) : on ne rebaptise rien, la colonne reste publiée.

### 5.3 Ce que V1+ fait sur les différés

| | relecture | lot |
|---|--:|--:|
| différés jugés | 161 | 161 |
| avec une voie de référence | 146 | 110 |
| **avec une référence sûre** | **9** | **17** |
| motifs du refus : pas de support local / contradictoires / pas de référence / trop loin / voie concurrente / rupture | 128 / 87 / 15 / 0 / 14 / 6 | 88 / 38 / 51 / 14 / 10 / 3 |
| agit (GCV2 sur les différés) | 7 | 10 |
| justes | 6 | 8 |
| à plus de 10 mm | 0 | 1 (14,8 mm) |
| erreur finale > 50 mm | 0 | 0 |

Un cut peut avoir plusieurs motifs.

- Les actions de V1+ sur les différés portent sur :
  - en relecture : 1:17 (7392 et 7534), 1:24 (5716), 1:29 (3502, 3503, 6565), 2:11 (6457) ;
  - au lot : 1:17 (3086 et 7534), 1:24 (5716 et 5722), 1:29 (1662, 3502, 3503, 6565, 8002), 2:1 (2949, ADV).
- **Aucune action dans la zone 2 de 2:1.** Deux différés de la zone 2 ont une référence sûre en relecture (374 et 423), et le modèle s'y abstient (p = 0,017 et 0,003).

### 5.4 Par zone (agit / justes / abîmés / « mauvaise voie » G1-b / erreurs)

| zone | Mic > 10 mm | règle prudente | V1, relecture | V1+, relecture | V1, lot | V1+, lot |
|---|--:|---|---|---|---|---|
| pn | 86 | 60 / 56 / 2 / 0 / 2 | 146 / 69 / 1 / 0 / 2 | 146 / 69 / 1 / 0 / 2 | 164 / 65 / 1 / 0 / 2 | 165 / 66 / 1 / 0 / 2 |
| adv | 65 | 34 / 18 / 2 / 0 / 4 | 66 / 28 / 0 / 0 / 1 | 68 / 30 / 0 / 1 / 1 | 36 / 25 / 0 / 0 / 1 | 39 / 28 / 0 / 2 / 1 |
| abords | 214 | 42 / 33 / 0 / 0 / 4 | 42 / 33 / 0 / 0 / 4 | 47 / 37 / 0 / 2 / 4 | 42 / 33 / 0 / 0 / 4 | 48 / 37 / 0 / 3 / 5 |
| liste, hors | 41 | 0 | 0 | 0 | 0 | 0 |

Au lot, l'ADV de V1 agit moins (36 contre 57 en G1-b) : les jeux lot ne sont plus les mêmes (F3).

### 5.5 Ce que H6 apporte

- **En relecture** :
  - le rappel gagne 17 grosses corrections, dont 13 dans la zone 2 de 2:1 ;
  - V1 passe de 128 à 130 justes, avec 1 abîmé au lieu de 2 ;
  - V1+ ajoute 6 différés justes.

  La GCV2 apprend des cas complexes (audit H3) : les différés de la zone 2 entrent dans l'apprentissage avec leurs hypothèses H6 justes et fausses. Elle n'agit pas encore sur eux.
- **Au lot** :
  - les voisins du lot seuls donnent peu en zone 2 (31,0 % contre 28,7 %) ;
  - le gain vient surtout de F3 : le jeu lot généré proprement atteint 76,4 % avant H6, contre 72,4 % par filtrage ;
  - V1+ ajoute 8 différés justes, dont 1 en 2:1 (ADV).

## 6. Les cas de 2:1, un par un

Les 57 grosses corrections de 2:1 qu'aucune hypothèse de G1-a n'atteignait. Lecture des colonnes :
- latéral en mm depuis la pose de départ, rail gauche / rail droit ;
- « meilleure H6 » : la H6 la plus proche de Mic sur chaque rail, avec son écart 3D entre crochets ;
- « relecture » et « lot » : la paire est atteinte à 10 mm par une hypothèse du jeu (toutes origines, H6 comprise) ;
- « pourquoi » : le meilleur écart d'une H6, quand la paire n'est pas atteinte ;
- les cuts 293 à 459 forment la zone 2.

| cut | rôle | zone | Mic latéral g / d (mm) | meilleure H6 g / d : latéral [écart] | origine de la meilleure H6 (g / d) | relecture | lot | pourquoi (relecture) |
|--:|---|---|---|---|---|---|---|---|
| 159 | vert | hors | -23 / 0 | -18 [5] / -1 [2] | hum.proche paire, 2 cuts / hum.méd. rail, 6 cuts | **oui** | non | atteint par H6 |
| 293 | differe | abords | 25 / 66 | 7 [19] / 38 [28] | lot méd. paire, 9 cuts / lot méd. rail, 5 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 294 | differe | abords | 44 / 95 | 7 [38] / 38 [57] | lot méd. paire, 8 cuts / lot méd. rail, 8 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 295 | differe | abords | 83 / 122 | 45 [38] / 66 [56] | hum.proche paire, 2 cuts / hum.proche rail, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 298 | differe | abords | 103 / 150 | 70 [41] / 95 [55] | hum.méd. paire, 4 cuts / hum.méd. rail, 4 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 313 | differe | abords | 134 / 172 | 125 [9] / 171 [10] | hum.méd. rail, 5 cuts / hum.méd. rail, 5 cuts | non | non | décalage des voisins à 10–25 mm du sien |
| 314 | differe | abords | 133 / 110 | 126 [21] / 95 [15] | hum.méd. rail, 5 cuts / lot méd. paire, 6 cuts | non | non | décalage des voisins à 10–25 mm du sien |
| 316 | differe | abords | 84 / 146 | 72 [17] / 128 [28] | lot méd. paire, 6 cuts / hum.méd. rail, 4 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 319 | rouge | abords | -3 / -2 | -1 [9] / -16 [21] | lot proche paire, 1 cut / hum.méd. paire, 4 cuts | non | non | décalage des voisins à 10–25 mm du sien |
| 346 | differe | abords | -46 / -29 | -45 [7] / -11 [18] | lot proche rail, 1 cut / lot proche paire, 1 cut | non | non | décalage des voisins à 10–25 mm du sien |
| 372 | differe | abords | 144 / 201 | 144 [8] / 193 [10] | hum.proche rail, 2 cuts / lot proche rail, 3 cuts | non | non | décalage des voisins à 10–25 mm du sien |
| 373 | differe | abords | 140 / 198 | 144 [4] / 199 [5] | hum.proche rail, 2 cuts / hum.proche rail, 2 cuts | **oui** | non | atteint par H6 |
| 374 | differe | abords | 140 / 193 | 144 [6] / 193 [2] | hum.proche rail, 2 cuts / lot proche rail, 5 cuts | **oui** | **oui** | atteint par H6 |
| 375 | differe | abords | 131 / 186 | 128 [7] / 180 [7] | lot méd. rail, 10 cuts / lot méd. rail, 10 cuts | **oui** | **oui** | atteint par H6 |
| 377 | differe | abords | 195 / 119 | 169 [45] / 159 [92] | hum.méd. paire, 6 cuts / hum.proche paire, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 378 | differe | abords | 219 / 202 | 165 [99] / 193 [61] | lot proche paire, 9 cuts / lot proche rail, 9 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 379 | differe | abords | 208 / 83 | 195 [75] / 119 [41] | hum.proche rail, 2 cuts / hum.proche rail, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 380 | differe | abords | 154 / 116 | 219 [72] / 159 [80] | hum.proche rail, 2 cuts / hum.méd. paire, 6 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 382 | differe | abords | 135 / 191 | 135 [13] / 154 [38] | hum.proche paire, 2 cuts / hum.méd. paire, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 384 | differe | abords | 129 / 185 | 135 [11] / 191 [8] | hum.proche rail, 2 cuts / hum.proche rail, 2 cuts | non | non | décalage des voisins à 10–25 mm du sien |
| 385 | differe | abords | 130 / 189 | 129 [2] / 185 [6] | hum.proche rail, 2 cuts / hum.proche rail, 2 cuts | **oui** | non | atteint par H6 |
| 386 | differe | abords | 214 / 101 | 157 [62] / 157 [57] | hum.méd. paire, 6 cuts / hum.proche paire, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 387 | differe | abords | 146 / 201 | 160 [17] / 189 [25] | hum.méd. paire, 6 cuts / hum.méd. rail, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 389 | vert | abords | 147 / 160 | 146 [12] / 174 [91] | hum.proche rail, 2 cuts / hum.proche paire, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 391 | differe | abords | 208 / 168 | 146 [76] / 154 [21] | hum.méd. rail, 6 cuts / hum.proche paire, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 392 | differe | abords | 237 / 188 | 204 [48] / 160 [28] | hum.proche rail, 2 cuts / hum.méd. rail, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 394 | differe | abords | 231 / 126 | 237 [45] / 168 [44] | hum.proche rail, 2 cuts / hum.méd. rail, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 395 | differe | abords | 210 / 109 | 204 [53] / 160 [54] | hum.méd. rail, 6 cuts / hum.méd. rail, 6 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 396 | differe | abords | 190 / 175 | 178 [12] / 126 [51] | hum.méd. paire, 6 cuts / hum.méd. rail, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 397 | differe | abords | 157 / 179 | 178 [41] / 178 [14] | hum.méd. paire, 6 cuts / hum.méd. paire, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 398 | differe | abords | 143 / 199 | 166 [24] / 178 [27] | lot proche paire, 7 cuts / hum.méd. paire, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 399 | differe | abords | 143 / 199 | 166 [24] / 168 [32] | lot proche paire, 6 cuts / hum.proche paire, 2 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 400 | differe | abords | 143 / 195 | 143 [3] / 199 [4] | hum.proche rail, 2 cuts / hum.proche rail, 2 cuts | **oui** | non | atteint par H6 |
| 402 | differe | pn | 135 / 193 | 143 [11] / 195 [3] | hum.méd. rail, 2 cuts / hum.méd. rail, 5 cuts | **oui** | non | atteint (H6 et une autre origine) |
| 403 | differe | pn | 200 / 138 | 193 [11] / 108 [32] | lot proche rail, 2 cuts / hum.proche rail, 2 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 406 | differe | pn | 204 / 154 | 193 [11] / 166 [12] | lot proche rail, 1 cut / hum.méd. paire, 5 cuts | non | non | décalage des voisins à 10–25 mm du sien |
| 411 | differe | pn | 164 / 86 | 195 [33] / 172 [86] | hum.proche paire, 2 cuts / hum.proche rail, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 413 | differe | abords | 131 / 187 | 166 [35] / 176 [15] | lot proche paire, 8 cuts / hum.méd. paire, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 414 | vert | abords | 152 / 161 | 161 [53] / 166 [21] | hum.proche rail, 2 cuts / lot proche paire, 9 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 415 | differe | abords | 187 / 153 | 159 [80] / 166 [77] | hum.méd. paire, 6 cuts / lot proche paire, 10 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 417 | differe | abords | 134 / 192 | 157 [30] / 170 [23] | hum.méd. paire, 6 cuts / hum.proche paire, 2 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 418 | differe | abords | 136 / 191 | 159 [25] / 199 [20] | hum.méd. paire, 6 cuts / hum.proche paire, 2 cuts | non | non | décalage des voisins à 10–25 mm du sien |
| 420 | differe | abords | 139 / 196 | 136 [8] / 191 [5] | hum.proche rail, 2 cuts / hum.proche rail, 2 cuts | **oui** | non | atteint par H6 |
| 421 | differe | abords | 139 / 197 | 138 [3] / 194 [6] | hum.méd. rail, 2 cuts / hum.proche rail, 2 cuts | **oui** | non | atteint par H6 |
| 422 | differe | abords | 141 / 199 | 138 [6] / 196 [4] | hum.méd. rail, 6 cuts / hum.proche rail, 2 cuts | **oui** | non | atteint par H6 |
| 446 | differe | abords | 147 / 201 | 147 [1] / 176 [27] | lot méd. paire, 6 cuts / lot méd. rail, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 447 | differe | abords | 189 / 205 | 204 [16] / 176 [84] | hum.proche rail, 2 cuts / lot méd. rail, 7 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 448 | differe | abords | 195 / 247 | 174 [53] / 201 [80] | hum.proche paire, 2 cuts / hum.proche rail, 2 cuts | non | non | décalage des voisins à plus de 50 mm du sien |
| 450 | vert | abords | 164 / 172 | 158 [21] / 174 [44] | lot proche rail, 6 cuts / hum.méd. paire, 6 cuts | non | non | décalage des voisins à 25–50 mm du sien |
| 454 | differe | abords | 162 / 212 | 164 [9] / 218 [7] | hum.proche rail, 2 cuts / hum.proche rail, 2 cuts | **oui** | non | atteint par H6 |
| 456 | differe | abords | 160 / 213 | 162 [3] / 212 [2] | hum.proche rail, 2 cuts / hum.proche rail, 2 cuts | **oui** | non | atteint par H6 |
| 457 | differe | abords | 162 / 219 | 163 [2] / 214 [5] | hum.méd. rail, 6 cuts / hum.méd. rail, 2 cuts | **oui** | non | atteint par H6 |
| 459 | differe | abords | 157 / 210 | 162 [8] / 214 [5] | hum.proche rail, 2 cuts / hum.méd. rail, 6 cuts | **oui** | non | atteint par H6 |
| 625 | differe | adv | 17 / 86 | 6 [11] / 70 [16] | lot méd. paire, 6 cuts / lot proche rail, 1 cut | non | non | décalage des voisins à 10–25 mm du sien |
| 3011 | differe | adv | -36 / 31 | — | — | non | non | aucun voisin sûr à 10 cuts |
| 5521 | differe | adv | -16 / 30 | -16 [2] / 21 [10] | lot méd. rail, 1 cut / hum.méd. paire, 1 cut | **oui** | **oui** | atteint par H6 |
| 5550 | vert | adv | -1 / 28 | 0 [1] / 0 [29] | hum.méd. paire, 7 cuts / hum.méd. paire, 7 cuts | non | non | décalage des voisins à 25–50 mm du sien |

**Bilan des 57 cas.**
- Relecture : **15 atteints** (13 dans la zone 2, plus le 159, hors zone, et le 5521, en ADV).
- Lot : **3 atteints** (374 et 375 dans la zone 2, et le 5521).
- Dans la zone 2 (52 cuts), pour ceux qui restent hors d'atteinte en relecture, la meilleure H6 est à plus de 10 mm. Le décalage de Mic change d'un cut à l'autre plus vite que le voisin ne le suit : de 20 à 60 mm en trois cuts (303 à 306, 377 à 380, 391 à 395), et les deux rails ne bougent pas ensemble (par exemple 195 et 119 mm au cut 377).
- Au lot, 17 des 57 n'ont **aucun voisin du lot** à 10 cuts : la zone 2 est un long trou du lot.

## 7. Ce qui reste douteux

1. **V1+ n'aide pas la zone 2.** Le garde-fou de série exige le support local des deux rails à la référence. Dans la zone 2, la médiane des voisins tombe souvent à 20 ou 40 mm du rail réel, et le gabarit n'y trouve pas de points. Seules 2 références sont sûres, et le modèle s'y abstient. Assouplir ce support (le chercher à ± 20 mm, par exemple) serait un nouveau choix : à déclarer avant toute mesure, pas à régler sur ces chiffres.
2. **« Mauvaise voie » au sens de G1-b.** V1+ a 3 (relecture) et 5 (lot) actions à plus de 45 mm de H0, toutes justes. La porte de ce chantier lit l'erreur finale et le corridor (audit H2). Si l'on garde la définition de G1-b, V1+ ne tient pas la porte. Ces actions ne sont pas des erreurs, mais elles n'ont pas d'annotation indépendante de l'identité de voie.
3. **Une seule zone décalée, un seul opérateur.** Les 52 cuts de la zone 2 sont un seul épisode, et non 52 validations du mécanisme (audit H1, point 6). V1+ n'agit que sur 7 à 10 différés en tout.
4. **Choix faits après coup.** V1+ (zones et rôles) a été déclarée avant le calcul. Les preuves du garde-fou ont été ajoutées après la lecture de l'audit, avant la validation croisée. Mais leur forme a été pensée en regardant la zone 2, et le contrôle du support a été regardé sur les jeux (non sur les décisions) avant le calcul. Les seuils (5 et 3 points, 50 mm, 5 cuts, 45 mm) viennent du lot ou de la porte, pas d'un réglage.
5. **Le plafond de 12.** H6 avant H2 coûte 3 grosses corrections au rappel « avant » (1:24, 1:29) et rend la liste plus dense : hasard à 3 rangs de 29 à 54 %.
6. **Perte et lignes au sommet d'une H6 lointaine** : non évaluées (hors fenêtre du réservoir). Seuls les points sous le gabarit le sont, sur la capture translatée.
7. **Visibilité et écartement exacts** (audit M4) : non vérifiés. L'écartement de la paire reste l'approximation de G1-b (linéaire en latéral, juste pour une translation commune).
8. **Repère du journal du lot** : on suppose que l'Écho et le journal ne diffèrent que par une translation d'origine (mêmes axes). Les déplacements lus (10 à 20 cm en zone 2) sont cohérents ; une rotation n'a pas été testée sur données.
9. **Coût** : l'audit a obligé à reconstruire les 11 jeux deux fois. Une fois pour le jeu lot et la référence prouvée ; une seconde fois après la correction du repère du journal. Chaque passage prend environ 1 h 15 de calcul sur la machine partagée. La validation croisée demande quatre passes de 15 à 18 min, et l'export 4 min.

## 8. Reproduire

```
nice -n 10 node tools/gcv2-jeu.cjs construire --partie P:N --echo DOSSIER … (--journal J.json … | --sans-lot) --sortie jeu-P-N.jsonl --sortie-lot jeu-lot-P-N.jsonl
node tools/gcv2-jeu.cjs rappel --jeu jeu-1-12.jsonl … --selection zone2=2:1:293-459 --selection d206=2:1:159,2:1:293,… --json R.json
nice -n 10 node tools/gcv2-apprendre.cjs valider --jeu jeu-…jsonl … --usage relecture --variantes datasets/gcv2-variantes-h6.json --variante V1 [--variante V1+ --garde-voie] --sortie V.json
nice -n 10 node tools/gcv2-apprendre.cjs valider --jeu jeu-lot-…jsonl … --usage lot --variantes datasets/gcv2-variantes-h6.json --variante V1 [--variante V1+ --garde-voie] --sortie V-lot.json
nice -n 10 node tools/gcv2-apprendre.cjs exporter --jeu jeu-…jsonl … --jeu-lot jeu-lot-…jsonl … --garde-voie --date 2026-10-19 --sortie datasets/gcv2-parametres-h6.json
node --test tests/gcv2-jeu.test.cjs tests/gcv2-apprendre.test.cjs
```

- 1:17 : son Écho est en volumes 7z ; il est extrait dans un dossier temporaire (script de G1-a), lu, puis effacé.
- Les jeux sont hors dépôt.
- L'export est reproductible octet pour octet (deux exports identiques).
