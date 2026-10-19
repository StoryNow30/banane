# G1-a — Le jeu d'hypothèses de la GCV2 et le rappel atteignable (19 octobre 2026)

Chantier G1-a (`PLAN_SUITE_5.0.md` § 4, `G0_GCV2_CONCEPTION.md` § 2 « Étage 1 — Hypothèses »). Étude **hors ligne** : rien sous `src/` ne change, aucune action dans ESV, aucun modèle appris. L'outil est `tools/gcv2-jeu.cjs` (modes `construire`, `rappel`, `essai`) ; l'essai est `tests/gcv2-jeu.test.cjs`. Les parties sont désignées par leur rang (« 1:29 » = projet 1, partie 29). Seuls des numéros de cut, des millimètres et des comptes figurent ici.

## 1. En bref

| Question | Réponse |
|---|---|
| **Question de la porte** | Parmi les corrections de l'opérateur expert de plus de 10 mm, quelle part a au moins une hypothèse (pour les **deux** rails) à 10 mm de sa pose finale ? Seuil : 60 %. |
| **Jeu construit** | 11 parties d'apprentissage, 4 567 cuts visités, 62 302 hypothèses, 0 erreur, 0 écart entre la copie du moteur et le moteur livré. |
| **Rappel atteignable, cuts avec nuage** | **83,7 %** (340/406) des corrections > 10 mm ; 91,8 % (739/805) des > 5 mm. À 5 mm : 65,3 % (265/406). |
| **Chiffre brut** | **45,9 %** (340/740) : 334 corrections > 10 mm tombent sur des cuts **sans nuage** (l'Écho n'a plus de points : 1:17 en a 159, 1:24 en a 84, 2:1 en a 37). Elles sont perdues pour de bon. |
| **Porte des 60 %** | **Atteinte sur les cuts avec nuage** (83,7 %, borne basse de l'intervalle de Wilson à 95 % : 79,8 %). **Pas atteinte en brut** (45,9 %). La porte se lit sur les cuts avec nuage, mais 45 % des grosses corrections n'ont aucun nuage à exploiter : c'est une limite des données, pas des hypothèses. |
| **Jugement séparé** (témoins 1:11 et 1:25, jeu à part, lu une fois) | 79,3 % (69/87) avec nuage ; brut 55,6 % (69/124). Même verdict. |
| **Ce qui porte le rappel** | Les voisins sûrs (H4, +48 cuts à eux seuls), puis la chaîne (H3, +14), le réservoir (H2, +12). La hauteur apprise n'ajoute rien à 10 mm (+7 cuts à 5 mm). |
| **Ce qui manque** | 66 cuts (dont 57 de la partie 2:1) : le bon rail est à plus de 50 mm, en latéral, en zone des abords, le moteur s'est abstenu (« absent »). Aucune hypothèse du jeu ne l'atteint. |

## 2. Méthode

### 2.1 Entrées, sans fuite

Pour chaque cut que l'opérateur expert a visité dans un Écho, l'outil lit la même **entrée sans fuite** que `relecture-autonome.cjs extraire` (`entreeSansFuite` : la pose de départ qu'ESV montrait et les points pris avant le premier geste de l'opérateur expert). Il réutilise, sans les recopier, la lecture de l'Écho, le moteur livré (`Shadow.scientificProposeBoth`), la décision du lot (`LotDecision.decideCut`), la chaîne d'appuis (les poses qu'Ariane vient de donner aux cuts précédents, jamais une pose de l'opérateur expert) et la hauteur apprise. Seul changement à `relecture-autonome.cjs` : un **observateur** facultatif, appelé après chaque cut avec les objets bruts (sans lui, la sortie est inchangée ; ses 10 essais passent).

Le **réservoir de cellules** du moteur (`pool`) n'est pas rendu par `src/gcv1-shadow.js`. L'outil en charge une **copie en mémoire** où une seule ancre de texte est remplacée (`return {ok:true,side,` reçoit en plus le champ `_reservoir`). Le fichier de `src/` n'est pas touché. À chaque cut, la publication de la copie est comparée à celle du module livré (écarts constatés : voir § 3) ; l'essai compare la science entière.

### 2.2 Les hypothèses (douze poses de base au plus par rail)

| Origine | Ce que c'est |
|---|---|
| **H0** | la pose de départ (ne rien faire) |
| **H1** | la cellule A* du moteur (`astar-published`), calage de convention compris |
| **H2** | les cellules du réservoir **compétitives** (perte à 1,5 fois la meilleure au plus) et les cellules **STRONG écartées** par ce ratio ; chaque cellule est posée comme le moteur la poserait (calage de convention). Sous-origines : `comp-strong`, `comp`, `strong-ecartee` |
| **H3** | la pose de la décision du lot **en chaîne** (appuis = poses d'Ariane), et la **voie prédite** elle-même quand la chaîne a des appuis |
| **H4** | l'**interpolation des voisins sûrs** (voie du lot : encadrée si des appuis sont des deux côtés, sinon les plus proches, à 3 cuts au plus). Voisin sûr = pose de l'opérateur expert **déjà validée avant la première visite du cut** (ordre du temps), ou pose de départ d'un cut que le lot a **posé et validé**. Jamais une pose non vérifiée d'Ariane |
| **H5** | le **rail manquant complété par l'écartement médian** de la partie, à partir du rail sûr (l'autre rail, quand le moteur le publie) : latéral qui donne à la paire l'écartement médian, hauteur du rail sûr. Ajouté sur la demande de RM-4 (556 abstentions n'ont qu'un rail en échec) |

Chaque pose existe **avec et sans hauteur apprise** quand celle-ci donne une correction non nulle (ligne `hauteur: true`, décalage vertical corrigé). Deux poses à moins de 0,75 mm n'en font qu'une : la liste `origines` garde toutes les origines qui y mènent. Priorité en cas de plafond : H0, H1, H3, H4, H5, puis H2 (compétitives STRONG, compétitives, STRONG écartées, par perte croissante) ; le plafond écarte seulement des cellules de H2 (comptées).

### 2.3 Traits et étiquette

Traits (sans fuite) par hypothèse : perte, ratio de perte à la meilleure, lignes au sommet, faces, palier, STRONG, repêchée par S1, publiée par le moteur, balises du réservoir, distance à la cellule la plus proche (hors cellule), points du dessus et du flanc, épaisseur du dessus, `dz` et `du` de convention, groupe de la hauteur apprise et sa correction, déplacement depuis le départ, écart à la voie prédite, écart aux voisins sûrs, écartement de la paire avec l'autre rail au départ contre la médiane de la partie, meilleur écartement possible avec l'autre rail contre la médiane, zone, rôle du cut. Traits du rail (ligne `rail`) : statut et motif du moteur, confiance et rapport de perte de A*, S1, concurrents forts, cellules compétitives, grappes, cellules STRONG, taille du réservoir.

**Étiquette** : écart 3D (mm) de l'hypothèse à la pose finale de l'opérateur expert (sa dernière validation corrigée par l'écriture serveur, D-143 ; un cut visité 0,8 s sans action vaut une correction nulle), en classes `<=5`, `<=10`, `<=50`, `>50`. Elle est posée **après** les traits, par une autre fonction.

### 2.4 Frontière anti-fuite (à relire par le fort)

- `hypothesesDuCut` ne reçoit ni la référence de l'opérateur expert ni aucune pose de lui pour le cut lui-même : capture, science, décisions du lot, appuis de la chaîne, **voisins sûrs** et médiane d'écartement de la partie. L'essai vérifie que le texte de la fonction ne nomme aucun champ de référence.
- `etiqueter(hypothèses, mic)` est la seule fonction qui lit la référence. L'essai de bout en bout (Écho synthétique, observateur, lignes du jeu) change la pose finale du cut : **toutes les lignes, étiquettes retirées, sont identiques**.
- Les poses de l'opérateur expert des **autres** cuts entrent par H4 : l'essai montre qu'une pose voisine validée **après** la première visite du cut ne change rien, et qu'une pose validée **avant** change l'interpolation.
- La médiane d'écartement de la partie est une statistique de poses de départ (hors cuts du lot, hors la valeur par défaut 1 500 mm), comme dans `relecture-autonome.cjs lignes`.
- Rien d'absolu ne sort : décalages en mm dans le repère profil de la pose de départ, comptes, drapeaux. L'essai fabrique des coordonnées de scène et vérifie qu'aucun nombre de leur taille ne sort.

## 3. Comptes par partie

Cuts visités = cuts que l'opérateur expert a visités dans l'Écho (périmètre de `relecture-autonome.cjs`). Calculés = cuts avec nuage exploitable (le moteur a tourné). Jugeables = calculés avec la pose finale des deux rails. Sans nuage = cuts avec pose finale mais sans point dans l'Écho.

| Partie | Visités | Calculés | Hypothèses | Jugeables | Sans nuage (avec référence) | > 10 mm | > 5 mm | À 10 mm | À 5 mm |
|---|---|---|---|---|---|---|---|---|---|
| 1:12 | 108 | 81 | 2 525 | 79 | 24 | 24 | 28 | 100,0 % (24/24) | 100,0 % (24/24) |
| 1:13 | 224 | 155 | 4 017 | 143 | 46 | 21 | 26 | 100,0 % (21/21) | 100,0 % (21/21) |
| 1:14 | 112 | 108 | 3 280 | 94 | 3 | 15 | 21 | 100,0 % (15/15) | 100,0 % (15/15) |
| 1:15 | 524 | 346 | 10 001 | 281 | 135 | 7 | 27 | 100,0 % (7/7) | 85,7 % (6/7) |
| 1:16 | 388 | 347 | 9 904 | 311 | 28 | 20 | 54 | 100,0 % (20/20) | 65,0 % (13/20) |
| 1:17 | 795 | 200 | 4 277 | 197 | 559 | 44 | 105 | 88,6 % (39/44) | 56,8 % (25/44) |
| 1:24 | 263 | 40 | 1 061 | 31 | 175 | 24 | 29 | 95,8 % (23/24) | 54,2 % (13/24) |
| 1:29 | 821 | 582 | 11 274 | 563 | 197 | 93 | 295 | 98,9 % (92/93) | 82,8 % (77/93) |
| 2:1 | 765 | 465 | 8 946 | 439 | 129 | 134 | 184 | **57,5 % (77/134)** | 37,3 % (50/134) |
| 2:10 | 21 | 21 | 525 | 21 | 0 | 1 | 3 | 100,0 % (1/1) | 100,0 % (1/1) |
| 2:11 | 546 | 303 | 6 492 | 252 | 46 | 23 | 33 | 91,3 % (21/23) | 87,0 % (20/23) |
| **Total** | **4 567** | **2 648** | **62 302** | **2 411** | **1 342** | **406** | **805** | **83,7 %** (340/406) | **65,3 %** (265/406) |

Sans la partie 2:1, le rappel à 10 mm des > 10 mm est de 96,7 % (263/272). La partie 2:1 est la seule sous la porte.

Corrections > 10 mm sans nuage, perdues pour de bon : 334 (1:17 : 159, 1:24 : 84, 2:1 : 37, 1:29 : 29, 1:13 : 8, 1:12 : 7, 2:11 : 4, 1:15 : 3, 1:14 : 2, 1:16 : 1).

Densité : 7,7 poses de base par rail en moyenne (médiane 7, plafond 12 atteint par 968 rails sur 4 822).

## 4. Rappel atteignable par zone et par origine

« À 10 mm » = pour les deux rails, au moins une hypothèse (de l'ensemble d'origines nommé, H0 toujours comprise) à 10 mm ou moins de la pose finale. Corrections de plus de 10 mm, cuts avec nuage (n = 406).

### 4.1 Par zone (toutes origines, avec et sans hauteur apprise)

| Zone | > 10 mm : n | À 10 mm | À 5 mm | > 5 mm : n | À 10 mm | À 5 mm |
|---|---|---|---|---|---|---|
| PN | 86 | 95,3 % (82/86) | 90,7 % (78/86) | 127 | 96,9 % (123/127) | 87,4 % (111/127) |
| ADV | 65 | 89,2 % (58/65) | 73,8 % (48/65) | 132 | 94,7 % (125/132) | 75,0 % (99/132) |
| Abords | 214 | 76,2 % (163/214) | 52,3 % (112/214) | 426 | 88,0 % (375/426) | 62,0 % (264/426) |
| Liste | 7 | 100,0 % (7/7) | 85,7 % (6/7) | 14 | 100,0 % (14/14) | 78,6 % (11/14) |
| Hors | 34 | 88,2 % (30/34) | 61,8 % (21/34) | 106 | 96,2 % (102/106) | 67,9 % (72/106) |
| **Tout** | **406** | **83,7 %** (340/406) | **65,3 %** (265/406) | **805** | **91,8 %** (739/805) | **69,2 %** (557/805) |

Au moins un des deux rails à 10 mm : 93,1 % (378/406) des > 10 mm. Les abords sont la zone faible : 214 grosses corrections sur 406, 76,2 %.

### 4.2 Par origine (> 10 mm, à 10 mm)

| Ensemble d'origines | Tout | PN | ADV | Abords | Liste | Hors |
|---|---|---|---|---|---|---|
| H0 seule (ne rien faire) | 0,0 % | 0,0 % | 0,0 % | 0,0 % | 0,0 % | 0,0 % |
| H0 + H1 (A* du moteur) | 45,8 % (186) | 61,6 % | 52,3 % | 34,1 % | 71,4 % | 61,8 % |
| H0 + H2 (réservoir) | 57,6 % (234) | 80,2 % | 63,1 % | 44,9 % | 71,4 % | 67,6 % |
| H0 + H2 compétitives | 39,4 % (160) | 53,5 % | 36,9 % | 33,2 % | 71,4 % | 41,2 % |
| H0 + H2 STRONG écartées | 37,7 % (153) | 57,0 % | 40,0 % | 27,6 % | 42,9 % | 47,1 % |
| H0 + H3 (chaîne, voie prédite) | 41,6 % (169) | 76,7 % | 36,9 % | 29,0 % | 28,6 % | 44,1 % |
| H0 + H4 (voisins sûrs) | 56,9 % (231) | 82,6 % | 52,3 % | 49,5 % | 57,1 % | 47,1 % |
| H0 + H4, voisins du lot seuls | 3,9 % (16) | 0,0 % | 6,2 % | 5,6 % | 0,0 % | 0,0 % |
| H0 + H5 (rail complété, écartement médian) | 9,9 % (40) | 14,0 % | 15,4 % | 5,1 % | 28,6 % | 14,7 % |
| H0 + H1 + H2 | 59,4 % (241) | 80,2 % | 69,2 % | 45,8 % | 71,4 % | 70,6 % |
| H0 à H3 | 69,5 % (282) | 94,2 % | 76,9 % | 56,5 % | 71,4 % | 73,5 % |
| H0 à H4 (sans hauteur) | 83,3 % (338) | 95,3 % | 87,7 % | 76,2 % | 100,0 % | 85,3 % |
| H0 à H5 (sans hauteur) | 83,7 % (340) | 95,3 % | 89,2 % | 76,2 % | 100,0 % | 88,2 % |
| H0 à H5, avec et sans hauteur | 83,7 % (340) | 95,3 % | 89,2 % | 76,2 % | 100,0 % | 88,2 % |

À 5 mm : H0 + H1 27,1 % ; H0 + H2 39,4 % ; H0 à H3 51,7 % ; H0 à H4 61,8 % ; H0 à H5 63,5 % ; avec la hauteur apprise 65,3 %.

### 4.3 Ce que chaque origine ajoute (toutes les autres gardées)

Nombre de grosses corrections (> 10 mm, sur 406) perdues quand on retire une origine : 

| Origine retirée | Corrections perdues | Rappel sans elle |
|---|---|---|
| H4 (voisins sûrs) | 48 | 71,9 % (292/406) |
| H3 (chaîne, voie prédite) | 14 | 80,3 % (326/406) |
| H2 (réservoir) | 12 | 80,8 % (328/406) |
| dont H2 STRONG écartées | 5 | 82,5 % (335/406) |
| H5 (rail complété) | 2 | 83,3 % (338/406) |
| H1 (A* du moteur) | 1 | 83,5 % (339/406) |
| Hauteur apprise | 0 | 83,7 % (340/406) |

Les origines se recouvrent : l'A* du moteur (H1) est presque toujours déjà dans le réservoir (H2) et dans la chaîne (H3), d'où son apport marginal nul bien que seul il atteigne 45,8 %. À 5 mm, la hauteur apprise ajoute 7 cuts (258 contre 265). Le plafond de 12 poses écarte des cellules de H2 sur 153 grosses corrections ; une seule aurait été rattrapée par une cellule écartée.

## 5. Abstentions du moteur rattrapées

Le moteur s'abstient (rail sans candidat ou paire hors contrat) sur 1 105 cuts jugeables, dont 286 sont de grosses corrections. Part de ces 286 pour laquelle une hypothèse est à 10 mm (à 5 mm) :

| Origines | À 10 mm | À 5 mm |
|---|---|---|
| Toutes, avec et sans hauteur | **78,0 %** (223/286) | 56,3 % (161/286) |
| H0 + H1 (le moteur) | 31,8 % (91/286) | 18,5 % (53/286) |
| H0 + H2 | 43,7 % (125/286) | 30,1 % (86/286) |
| H0 + H2 STRONG écartées | 23,8 % (68/286) | 16,8 % (48/286) |
| H0 + H3 | 36,4 % (104/286) | 26,2 % (75/286) |
| H0 + H4 | 54,5 % (156/286) | 24,5 % (70/286) |
| H0 + H5 | 3,8 % (11/286) | 0,7 % (2/286) |

Par zone (toutes origines) : PN 92,7 % (51/55), ADV 88,5 % (46/52), abords 66,7 % (102/153), liste 5/5, hors 90,5 % (19/21). Le moteur seul n'en rattrape que 31,8 % : le gain des hypothèses est là. Cuts que le lot diffère en premier passage (264 grosses corrections) : 76,5 % (202/264) atteignables, contre 29,9 % pour le moteur seul. Par rôle du cut (> 10 mm, toutes origines) : vert 96,0 % (218/227), rouge 87,5 % (21/24), différé 65,2 % (101/155).

Motifs d'abstention les plus fréquents parmi les 286 : `absent` 56, `flank` 47, `gauge-out-of-contract` 43, `minTop` 37, `ambiguity` 28.

## 6. Ce qui manque : les 66 cuts hors d'atteinte

66 cuts (16 % des 406) n'ont aucune hypothèse à 10 mm pour la paire : 54 sont à plus de 50 mm de la pose finale, 87 rails sur 94 manquent en **latéral**, 51 sont en zone des abords, 54 sont des cuts différés par le lot, et le moteur s'est abstenu sur 63. **57 de ces 66 cuts sont dans la partie 2:1** (52 à plus de 50 mm, 48 en abords, motif d'abstention `absent` : 35 des 122 abstentions graves de la partie). Dans cette partie, l'opérateur expert déplace des rails de plus de 50 mm en latéral là où le nuage du moteur ne donne aucune cellule et où aucun voisin sûr ne le précède. Le meilleur écart restant sur ces rails est de 18,6 mm (médiane). Aucune des 66 n'est réduite à la pose de départ seule : le jeu a des hypothèses, aucune n'est juste.

Ce qu'il faudrait ajouter pour ces cas (à décider avec G1-b, pas fait ici) : des hypothèses de **déplacement latéral large** (voie voisine à ± 50 à 150 mm, rail de l'autre côté de la voie, gabarit de voie ouverte) pour les abords, et des voisins sûrs plus lointains pour 2:1.

## 7. Garde-fous de lecture

- **Le hasard.** Une liste de 7,7 poses par rail atteint par hasard des cibles proches. Témoin : on applique à chaque cut les hypothèses d'un **autre** cut de la même partie (décalage de rang 3, 7 ou 11) : 28,8 %, 19,2 %, 22,7 % des > 10 mm seraient « atteints ». Le rappel mesuré (83,7 %) est loin de ce niveau, mais le hasard n'est pas nul : une partie a souvent des décalages voisins d'un cut à l'autre. Le rappel mesure le **plafond** d'un classeur, pas sa justesse ; la justesse se mesure à G1-b.
- **H4 voit la main de l'opérateur expert.** Les voisins sûrs sont des poses déjà validées avant la première visite du cut (ordre du temps). C'est licite pour un outil qui travaille à côté de l'opérateur, mais cela suppose que les cuts voisins ont été relus avant. Sans H4, le rappel tombe à 71,9 % (encore au-dessus de la porte).
- **Les voisins du lot seuls** (poses du lot validées) n'atteignent que 3,9 % : l'essentiel de H4 vient des poses de l'opérateur expert.
- **Hauteur apprise.** Nul à 10 mm, +7 cuts à 5 mm : elle ne change pas la porte.
- **Un cut sans nuage reste perdu.** Il ne peut pas être aidé par un classeur appris sur le nuage. H4 et H5 n'ont pas besoin du nuage, mais ne sont pas calculées ici pour les cuts sans nuage (pas de traits de moteur, pas de capture).
- **Une seule étiquette.** Les classes (≤ 5, ≤ 10, > 10, > 50 mm) reposent sur la pose finale de l'opérateur expert (dernière validation, corrigée par l'écriture serveur) ; un cut visité sans action vaut une correction nulle.

## 8. Jugement séparé (témoins 1:11 et 1:25)

Jeu construit à part (`--juger-partie-reservee`), jamais mélangé à celui de l'apprentissage, lu une seule fois, sans qu'aucun réglage en ait été tiré : 482 cuts visités, 285 jugeables, 87 corrections > 10 mm.

| | Corrections > 10 mm | À 10 mm | À 5 mm | Brut (sans nuage compté comme échec) |
|---|---|---|---|---|
| 1:11 | 68 | 76,5 % (52/68) | 50,0 % (34/68) | 50,5 % (52/103) |
| 1:25 | 19 | 89,5 % (17/19) | 52,6 % (10/19) | 81,0 % (17/21) |
| Deux témoins | 87 | **79,3 %** (69/87) | 50,6 % (44/87) | 55,6 % (69/124) |

Par zone : PN 4/4, ADV 69,0 % (29/42), hors 87,8 % (36/41). Hasard (décalage 3, 7, 11) : 14,9 %, 9,2 %, 5,7 %. Le résultat est un peu plus bas que l'apprentissage (79,3 % contre 83,7 %) ; 1:11 porte à lui seul 35 des 37 cuts sans nuage. Même verdict : au-dessus de 60 % avec nuage, en dessous en brut.

## 9. Ce qui reste douteux

- **Le rappel brut est sous la porte.** 334 des 740 grosses corrections de l'apprentissage n'ont pas de nuage. Si la porte doit se lire en brut, elle n'est pas atteinte, et aucune hypothèse bâtie sur le nuage ne peut y remédier : seuls H4 et H5 (qui n'ont pas besoin du nuage) pourraient être produits pour ces cuts, ce que l'outil ne fait pas aujourd'hui.
- **La partie 2:1** (57,5 %) et **les abords** (76,2 %) sont sous le niveau des autres : la GCV2 ne sera pas aidée là par un simple classeur.
- **La liste est dense.** Hasard de 19 à 29 % ; le classeur de G1-b devra être jugé sur sa justesse, pas sur ce plafond.
- **La copie du moteur.** Le réservoir est lu dans une copie en mémoire de `src/gcv1-shadow.js` (une ancre remplacée ; l'outil refuse si elle change). 0 écart sur les 11 + 2 parties entre la copie et le moteur livré.
- **Poids de la partie 2:1** : 134 des 406 grosses corrections (33 %) ; son poids tire le global vers le bas.

## 10. Reproduire

```
node tools/gcv2-jeu.cjs construire --partie P:N --echo DOSSIER [--echo …] (--journal J.json | --sans-lot) --sortie JEU.jsonl
node tools/gcv2-jeu.cjs rappel --jeu JEU.jsonl [--jeu …] [--json R.json]
node tests/gcv2-jeu.test.cjs
```

Les jeux construits sont hors dépôt (un fichier JSON lignes par partie, quelques mégaoctets chacun).
