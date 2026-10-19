# RM-4 : les abstentions du moteur et ce qu'elles font perdre (19 octobre 2026)

Chantier RM-4 du projet Ariane. Étude **hors ligne**, en lecture seule : le dépôt et les données ne sont pas modifiés. Cette table alimente la GCV2 (G1-a) : elle dit où l'on peut gagner.

Conventions : les parties sont désignées par leur rang (« 1:29 » = projet 1, partie 29). Seuls des numéros de cut, des millimètres et des comptes figurent ici.

## 1. En bref

| Question | Réponse |
|---|---|
| **Parties** | **11 sur 11** traitées : 1:12, 1:13, 1:14, 1:15, 1:16, 1:17, 1:24, 1:29, 2:1, 2:10, 2:11. Aucune sautée. 4 567 cuts visités par Mic, 3 753 avec une référence, 2 648 calculés par Ariane, 1 919 sans nuage, 0 erreur. |
| **Abstentions** | Sur les 2 648 cuts calculés : **1 077 (40,7 %) seul**, **836 (31,6 %) en chaîne**. |
| **Grosses corrections de Mic (plus de 10 mm)** | **741** avec référence. En chaîne : **217 (29,3 %) perdues par abstention**, **334 (45,1 %) perdues faute de nuage**, soit 551 (74,4 %) sans pose utile. 167 sont posées à 10 mm de Mic, 23 posées à plus de 10 mm. Seul : 265 (35,8 %) par abstention. |
| **Parmi celles qui ont un nuage** | 217 sur 407 : **53,3 %** des grosses corrections avec nuage tombent en abstention (chaîne). |
| **Où** | ADV : 41 sur 85 (48,2 %). Abords : 137 sur 467 (29,3 %), et 253 (54,2 %) sans nuage. PN : 21 sur 108 (19,4 %). |
| **Première cause** | En chaîne : « pas d'appui » (423 cuts, **140 des 217** grosses corrections abstenues, 64,5 %), puis « un rail absent » (204 cuts, 35). Mais 82 % des « pas d'appui » viennent de la mesure elle-même (§ 5). |
| **Pistes** | (1) compléter le rail manquant (plafond 69 grosses corrections, 9,3 %) ; (2) donner les poses du lot comme appuis (reprise attendue 23, 3,1 %) ; (3) trancher l'ambiguïté (plafond 26, 3,5 % ; position de la cellule écartée absente du cas). Condition de mesure : rendre leurs nuages à 1:17 et 1:24 (243 grosses corrections sans nuage). Chiffres au § 6. |

## 2. Méthode

### 2.1 Données

- **Cas** au format `ariane-relecture-autonome-cas-v1` : une ligne par cut visité par Mic dans l'Écho. Les parties 1:14, 1:15 et 1:16 viennent des fichiers déjà extraits ; les huit autres ont été extraites avec `tools/relecture-autonome.cjs extraire`, une partie à la fois, sous `nice -n 10`.
- **Tables de zones** : `table --sans-lot` pour les parties d'opérateur humain (1:12, 1:13) et celles déjà extraites sans lot (1:14 à 1:16) ; `table --journal` pour les parties avec lot Orbite (1:17, 1:24, 1:29, 2:1, 2:10, 2:11).
- Les journaux Orbite sont dans des zips en plusieurs volumes que l'outil ne lit pas : seul le journal de chaque lot a été extrait (par un script qui lit les volumes comme un seul zip, sans les recoller), puis **supprimé** à la fin. L'Écho de 1:17 est en 7z : ses 14 segments ont été extraits le temps du calcul, puis supprimés.
- Aucune ligne de ces cas ne porte de coordonnée absolue ni d'identifiant. Les tables de zones, elles, portent les bords des rails (comme les tables de `tools/verts-a-controler.cjs`) : elles restent dans le scratchpad, hors dépôt.

### 2.2 Définitions

- **Correction de Mic** : le pire des deux rails, en 3D, entre la pose de départ et sa dernière validation (un cut visité 0,8 s sans action vaut 0). Seuls les cuts avec référence comptent dans les colonnes « Mic > 5 » et « Mic > 10 ».
- **Abstention seul** : le cut est calculé et, sans appui, la décision du lot ne pose pas les deux rails. **Abstention en chaîne** : même chose avec pour appuis les poses qu'Ariane vient de donner aux cuts précédents de la relecture (jamais une pose de Mic).
- **Sans nuage** : le cut n'a pas de nuage dans l'Écho (visite trop brève, ou nuage purgé par l'export). Ce n'est pas une abstention du moteur : il n'a rien pu lire.
- **Cause d'un rail** (le moteur, `ariane.rails.left|right`) : *candidat*, ou *absent* (le cadre de lecture du rail n'est pas monté), *ambiguïté* (plusieurs placements concurrents), *sommet* (`minTop` : le plan de roulement est trop peu observé), *flanc* (`flank` : flanc interne insuffisant), *écartement* (`gauge-out-of-contract` : la paire sort de 1420–1470 mm), *autre* (`slope`, `rsf`…).
- **Famille d'un cut abstenu**, dans cet ordre de priorité : écartement hors contrat, un rail absent, ambiguïté, sommet insuffisant, flanc, autre. **En chaîne seulement**, « pas d'appui » passe avant toutes : la décision dit `no-anchor`, c'est-à-dire qu'aucun cut posé n'existe dans les 3 cuts précédents. Seul, tous les cuts sont sans appui par construction : la famille y est donc la cause du moteur. La cause du moteur reste visible sous « pas d'appui » (T7).
- **Zone** : celle de la table, par `selection` de `tools/relecture-autonome.cjs` : PN (avec marges), ADV (avec marges), abords des rouges et des différés du lot, liste « À contrôler » (verts hors zone listés par `src/verts-a-controler.js`), et **hors** pour le reste. Les parties sans lot n'ont pas d'abords.
- **Posée à 10 mm de Mic** : la pose d'Ariane (hauteur apprise ajoutée) tombe à 10 mm de celle de Mic. Une abstention peut être juste : sur les 836 abstentions en chaîne, 390 des 755 qui ont une référence ont une correction de Mic de 5 mm ou moins.

### 2.3 Contrôle

Les comptes principaux (cuts, calculés, sans nuage, abstentions seul et chaîne, grosses corrections par destination) ont été recalculés à part par un second script indépendant : ils sont identiques (4 567 ; 2 648 ; 1 919 ; 836 ; 1 077 ; 741 ; 217 ; 334 ; 265).

## 3. Cuts et grosses corrections, par partie

Cuts visités avec référence, calculés, sans nuage, abstentions (T1, annexe) :

| Partie | Visités | Réf. | Calculés | Sans nuage | Abst. seul | Abst. chaîne |
|---|--:|--:|--:|--:|--:|--:|
| 1:12 | 108 | 103 | 81 | 27 | 15 | 9 |
| 1:13 | 224 | 189 | 155 | 69 | 59 | 39 |
| 1:14 | 112 | 97 | 108 | 4 | 22 | 9 |
| 1:15 | 524 | 416 | 346 | 178 | 91 | 60 |
| 1:16 | 388 | 339 | 347 | 41 | 92 | 69 |
| 1:17 | 795 | 756 | 200 | 595 | 128 | 121 |
| 1:24 | 263 | 206 | 40 | 223 | 26 | 19 |
| 1:29 | 821 | 760 | 582 | 239 | 230 | 171 |
| 2:1 | 765 | 568 | 465 | 300 | 296 | 260 |
| 2:10 | 21 | 21 | 21 | 0 | 2 | 2 |
| 2:11 | 546 | 298 | 303 | 243 | 116 | 77 |
| **total** | 4 567 | 3 753 | 2 648 | 1 919 | 1 077 | 836 |

(Pour 1:14 et 1:16 le nombre de calculés dépasse celui des cuts avec référence : des cuts calculés n'ont pas de référence de Mic.)

Où vont les grosses corrections de Mic (plus de 10 mm), en chaîne (T2, annexe, avec le détail par partie et le mode seul) :

| Partie | Mic > 10 mm | Abstention | Faute de nuage | Posées à 10 mm | Posées à plus de 10 mm |
|---|--:|--:|--:|--:|--:|
| 1:12 | 31 | 3 (9,7 %) | 7 (22,6 %) | 21 | 0 |
| 1:13 | 29 | 7 (24,1 %) | 8 (27,6 %) | 12 | 2 |
| 1:14 | 17 | 0 | 2 (11,8 %) | 15 | 0 |
| 1:15 | 10 | 0 | 3 (30,0 %) | 7 | 0 |
| 1:16 | 21 | 7 (33,3 %) | 1 (4,8 %) | 13 | 0 |
| 1:17 | 203 | 32 (15,8 %) | 159 (78,3 %) | 7 | 5 |
| 1:24 | 108 | 14 (13,0 %) | 84 (77,8 %) | 4 | 6 |
| 1:29 | 122 | 33 (27,0 %) | 29 (23,8 %) | 53 | 7 |
| 2:1 | 172 | 109 (63,4 %) | 37 (21,5 %) | 24 | 2 |
| 2:10 | 1 | 0 | 0 | 0 | 1 |
| 2:11 | 27 | 12 (44,4 %) | 4 (14,8 %) | 11 | 0 |
| **toutes** | **741** | **217 (29,3 %)** | **334 (45,1 %)** | 167 | 23 |
| projet 1 | 541 | 96 (17,7 %) | 293 (54,2 %) | 132 | 20 |
| projet 2 | 200 | 121 (60,5 %) | 41 (20,5 %) | 35 | 3 |
| sans 1:17 et 1:24 | 430 | 171 (39,8 %) | 91 (21,2 %) | 156 | 12 |

Ce qu'on lit :

- **Part perdue par abstention, toutes parties : 217 sur 741, 29,3 %** (chaîne). Seul : 265, 35,8 %. Au seuil de 5 mm : 365 sur 1 473 (24,8 %) en chaîne, 449 (30,5 %) seul.
- **Part perdue faute de nuage : 334 sur 741, 45,1 %.** Elle vient surtout de deux parties dont l'Écho n'a plus ses nuages : 1:17 (159) et 1:24 (84), soit 243 des 334. Sans elles : 91 sur 430 (21,2 %). Ce n'est pas une propriété du moteur (§ 5).
- **Le projet 2 abstient beaucoup plus que le projet 1** : 60,5 % des grosses corrections (2:1 : 63,4 %) contre 17,7 %. Dans 2:1, 127 cuts ont été différés par le lot (zone d'ADV difficile).
- **Les posées sont presque toujours justes** : 167 sur 190 grosses corrections posées en chaîne sont à 10 mm de Mic (87,9 %). La perte vient de ce qu'Ariane ne pose pas, bien plus que de poses fausses.

Par zone (grosses corrections de plus de 10 mm, T2c) :

| Zone | Cuts visités | Mic > 10 mm | Abstention (chaîne) | Faute de nuage | Posées à 10 mm | Posées à plus de 10 mm |
|---|--:|--:|--:|--:|--:|--:|
| PN | 622 | 108 | 21 (19,4 %) | 21 (19,4 %) | 64 | 2 |
| ADV | 1 349 | 85 | 41 (48,2 %) | 20 (23,5 %) | 22 | 2 |
| abords | 1 648 | 467 | 137 (29,3 %) | 253 (54,2 %) | 62 | 15 |
| liste | 48 | 15 | 4 (26,7 %) | 8 (53,3 %) | 3 | 0 |
| hors | 900 | 66 | 14 (21,2 %) | 32 (48,5 %) | 16 | 4 |

L'ADV est la zone où l'abstention coûte le plus (près de la moitié des grosses corrections). Le PN est la mieux couverte : 64 posées justes sur 66 posées.

## 4. Les causes

### 4.1 Par rail et par paire (moteur, T3 et T4)

- En chaîne, **le rail droit échoue plus que le gauche** : 585 rails droits non candidats contre 479 gauches (sur 836 abstentions). La différence vient de « absent » (214 contre 165), « sommet » (142 contre 93) et « flanc » (151 contre 127).
- **Un seul rail est en échec dans 556 des 836 abstentions en chaîne (66,5 %)**, et dans 122 des 217 grosses corrections abstenues (56,2 %). Les paires les plus fréquentes : candidat + absent (211, dont 52 grosses corrections), candidat + flanc (146 ; 26), candidat + sommet (128 ; 23).
- Les deux rails en échec : 254 abstentions en chaîne, dont écartement + écartement 24 (11 grosses corrections), absent + flanc 55 (15), absent + sommet 43 (16).
- Les deux rails candidats mais la décision s'abstient : 26 cuts en chaîne (16 grosses corrections).
- **Présence d'une cause sur au moins un rail, sans l'ordre de priorité des familles** (T3b, chaîne ; un cut peut compter deux fois) : absent 356 cuts (104 grosses corrections, **47,9 %** des 217), flanc 251 (47), sommet 216 (47), ambiguïté 53 (26), autre 68 (25), écartement 24 (11). C'est cette lecture, et non le tableau des familles, qui donne le poids réel de chaque cause : la famille « pas d'appui » en cache une partie.

### 4.2 Les familles (T5 en chaîne, T6 seul)

En chaîne (836 abstentions, 217 grosses corrections) :

| Famille | Cuts | Mic > 5 mm | Mic > 10 mm | Part des > 10 abstenus |
|---|--:|--:|--:|--:|
| pas d'appui | 423 | 217 | 140 | 64,5 % |
| un rail absent | 204 | 67 | 35 | 16,1 % |
| autre | 45 | 23 | 20 | 9,2 % |
| flanc | 80 | 29 | 11 | 5,1 % |
| sommet insuffisant | 70 | 23 | 7 | 3,2 % |
| écartement hors contrat | 8 | 4 | 3 | 1,4 % |
| ambiguïté | 6 | 2 | 1 | 0,5 % |

Par zone, les cuts (corrigés de plus de 5 mm ; de plus de 10 mm), chaîne :

| Famille | PN | ADV | abords | liste | hors |
|---|--:|--:|--:|--:|--:|
| pas d'appui | 26 (9 ; 8) | 108 (44 ; 31) | 197 (130 ; 91) | 6 (5 ; 2) | 86 (29 ; 8) |
| un rail absent | 34 (8 ; 7) | 59 (13 ; 5) | 61 (36 ; 19) | 2 (2 ; 1) | 48 (8 ; 3) |
| autre | 6 (2 ; 2) | 16 (4 ; 3) | 22 (17 ; 15) | 0 | 1 (0 ; 0) |
| flanc | 9 (3 ; 2) | 20 (2 ; 0) | 35 (18 ; 6) | 2 (2 ; 1) | 14 (4 ; 2) |
| sommet insuffisant | 14 (5 ; 2) | 19 (4 ; 0) | 21 (11 ; 4) | 0 | 16 (3 ; 1) |
| écartement hors contrat | 1 (0 ; 0) | 5 (2 ; 1) | 2 (2 ; 2) | 0 | 0 |
| ambiguïté | 0 | 3 (1 ; 1) | 2 (1 ; 0) | 0 | 1 (0 ; 0) |
| **total** | 90 (27 ; 21) | 230 (70 ; 41) | 340 (215 ; 137) | 10 (9 ; 4) | 166 (44 ; 14) |

Seul (1 077 abstentions, 265 grosses corrections) : un rail absent 356 cuts (104 grosses), flanc 262 (47), sommet 239 (37), ambiguïté 83 (26), autre 75 (25), écartement hors contrat 62 (26). Le détail par zone est en annexe (T6).

Ce que la chaîne reprend parmi les abstentions « seul » (T8) : écartement hors contrat 62,9 % (39 sur 62), ambiguïté 53,0 % (44 sur 83), flanc 32,4 %, sommet 31,0 %, autre 21,3 % — et **un rail absent 0 % (0 sur 356)** : quand le cadre du rail n'est pas monté, les appuis n'y changent rien.

### 4.3 Ce que dit chaque famille

- **Pas d'appui** (chaîne) : la cause moteur dessous est un rail absent (152 cuts, 69 grosses corrections), un flanc (98 ; 18), un sommet (97 ; 20), une ambiguïté (34 ; 17), un écartement (16 ; 8), autre (26 ; 8) (T7).
- **Un rail absent** : le moteur n'a pas monté le cadre de lecture de ce rail. Les 379 rails absents ont presque tous beaucoup de points lus (500 et plus pour 294), et la correction latérale de Mic sur ces rails est de 0,6 mm en médiane (plus de 180 mm pour 27 rails sur 352). Ce n'est donc ni un rail sans points, ni le plus souvent une pose de départ trop loin. Le motif exact (`prepareFrame`) n'est pas dans le cas : **la donnée manque**.
- **Écartement hors contrat** : 142 cuts calculés ont leurs deux rails hors contrat. Seul, 80 sont quand même posés par l'ornière du passage à niveau et 62 s'abstiennent. En chaîne, 118 sont posés (84 par le choix par la voie, 19 par la reprise depuis la voie, 15 par l'ornière) et 24 s'abstiennent, dont 8 classés « écartement » (les 16 autres sous « pas d'appui »). L'écartement prédit est à 45,5 mm de la bande en médiane (3e quartile 110,3 mm) ; 5 cuts seulement sont à 10 mm ou moins de la bande. L'écartement de Mic est dans le contrat pour **133 des 134** cuts avec référence. Le contrat fait donc bien son travail : le gain n'est pas de l'élargir.
- **Ambiguïté** : 164 rails en ambiguïté dans les cuts calculés. La chaîne reprend 53 % des abstentions « seul » classées ambiguïté (44 sur 83). Il reste en chaîne 53 cuts avec au moins un rail en ambiguïté (26 grosses corrections, T3b) ; la famille « ambiguïté » (6 cuts, 1 grosse) n'en montre qu'une petite partie, le reste est sous « un rail absent » et « pas d'appui ». Au moins une cellule STRONG compétitive existe pour 130 de ces 164 rails (79,3 %), au moins deux pour 123 (75,0 %) ; le rapport de perte médian est de 1,17 (quartiles 1,08 à 1,28). **La position de la cellule écartée n'est pas dans le cas** : on ne peut pas dire si elle est celle de Mic.
- **Sommet insuffisant et flanc** : 70 et 80 cuts, 7 et 11 grosses corrections. Le moteur ne trouve pas de minimum qualifié près de la voie prédite (« aucun-minimum », 167 cuts en chaîne, 25 grosses corrections).
- **Autre** (45 cuts, 20 grosses corrections) : surtout la **garde de paire** : le moteur propose les deux rails, la décision les retire (14 cuts, **10 grosses corrections**). Sur ces 14, les deux rails du moteur sont à 10 mm de Mic pour 8, et pour 7 des 10 grosses corrections. Viennent ensuite `rsf` (13 cuts, 1 grosse), « aucun-minimum » avec moteur candidat (8 ; 3), garde d'écartement (4 ; 3).
- **Les différés du lot** : 133 des 836 abstentions en chaîne sont des cuts que le lot avait différés (101 sous « pas d'appui »). Ce sont les cuts les plus durs ; leur abstention n'est pas une surprise.

## 5. Ce qui gonfle les chiffres : limites de la mesure

1. **Les nuages manquent.** 1 919 cuts sur 4 567 n'ont pas de nuage dans l'Écho (42 %), 595 sur 795 en 1:17 et 223 sur 263 en 1:24. Ces cuts sont comptés « perdus faute de nuage », mais Ariane les lirait avec ses propres nuages en relecture réelle.
2. **La chaîne mesurée est pauvre en appuis.** Elle n'utilise que les poses qu'Ariane vient de donner aux cuts précédents *qui ont un nuage*. En relecture réelle, les cuts posés et validés par le lot, et les cuts déjà relus, seraient aussi des appuis. Sur les 423 « pas d'appui » : **346 (81,8 %) ont un cut posé par le lot à 3 cuts ou moins, ou un cut précédent visité sans nuage** ; 63 n'ont aucun des 3 cuts précédents visité ; 94 ont des précédents avec nuage mais aucun appui retenu. Le chiffre « pas d'appui » est donc un **plafond**, pas une mesure du moteur.
3. **Zones.** Dans 1:17 et 1:24, la table ne reconnaît ni PN ni ADV : les zones se reconnaissent sur les nuages des cuts du lot, et ces cuts n'ont presque pas de nuage dans l'Écho. Les grosses corrections y tombent dans « abords » et « hors ». Ces deux parties pèsent donc sur la ligne « abords » (467 grosses corrections).
4. **2:10 et 2:11.** Leur pose de départ est celle d'après la relecture automatique de la test 7 (Ariane a déjà corrigé 1 cut en 2:10 et 17 en 2:11) : les corrections de Mic y sont celles qui restaient. Peu de cas (28 grosses corrections).
5. **Une abstention n'est pas une erreur.** 390 des 755 abstentions en chaîne avec référence ont une correction de 5 mm ou moins : ne pas poser y est juste.
6. **Hauteur apprise** ajoutée aux poses (pour juger les posées), comme dans `fiches/RELECTURE_AUTONOME.md` ; elle ne change pas les abstentions.

## 6. Trois pistes, chiffrées

**Piste 1. Compléter le rail manquant quand l'autre est bon.**
- 556 des 836 abstentions en chaîne (66,5 %) n'ont **qu'un rail en échec** ; c'est le cas de 122 des 217 grosses corrections abstenues (56,2 %).
- Le rail candidat du moteur est juste : à 10 mm de Mic pour 446 cuts sur 498 avec référence (89,6 %), et pour 90 des 122 grosses corrections (73,8 %).
- Essai simple, sans Mic : poser le latéral du rail manquant pour que l'écartement soit la médiane des poses d'Ariane de la partie. Le latéral manquant tombe à 10 mm de Mic pour **76 des 122 grosses corrections (62,3 %)**, contre 41 (33,6 %) si l'on ne bouge pas ce rail et 27 si on le bouge comme l'autre. Sur l'ensemble des 498, 83,1 % (414) contre 83,7 % (417) sans rien bouger : l'essai n'abîme pas les petites corrections de façon visible.
- **Plafond** : 69 grosses corrections ont les deux rails à 10 mm (le vertical du rail manquant n'est pas traité), soit **9,3 % des 741** et 31,8 % des 217 abstenues. À confirmer cut par cut avant tout usage.

**Piste 2. Donner les poses du lot (et les cuts déjà relus) comme appuis de la chaîne.**
- « Pas d'appui » : 423 cuts, 140 grosses corrections (18,9 % des 741).
- 201 de ces cuts (58 grosses corrections) ont un cut posé par le lot à 3 cuts ou moins, 280 (96) à 8 cuts ou moins.
- Mais la chaîne ne reprend pas tout : elle reprend 0 % des rails absents. Avec les taux de reprise observés (seul vers chaîne) par cause moteur, la **reprise attendue est d'environ 95 cuts, dont 23 grosses corrections (3,1 % des 741)**. Le gros du « pas d'appui » est en fait un rail absent (69 des 140) : il se traite par la piste 1.
- La table donne l'existence d'un cut posé par le lot, pas sa pose (elle est dans le journal) : la mesure demande de rejouer la chaîne avec ces poses.

**Piste 3. Trancher l'ambiguïté avec la cellule STRONG écartée.**
- En chaîne, 53 cuts ont au moins un rail en ambiguïté : **26 grosses corrections** (12,0 % des 217 abstenues, 3,5 % des 741). Seul : 96 cuts, 34 grosses.
- **Le cas dit** qu'au moins une cellule STRONG compétitive existe pour 130 des 164 rails en ambiguïté (**79,3 %**), au moins deux pour 123 (75,0 %). La chaîne en tranche déjà la moitié (44 des 83 abstentions « seul » de cette famille).
- **Le cas ne dit pas** si la cellule écartée est celle de Mic (sa position n'est pas enregistrée) : la donnée manque. Il faut ajouter la position (latéral, vertical) des cellules STRONG concurrentes au cas pour chiffrer le gain. Plafond : 26 grosses corrections, dont 8 sont aussi un rail absent (piste 1).

**Condition de mesure, avant toute décision : rendre leurs nuages aux parties purgées.**
- 334 grosses corrections sur 741 (45,1 %) n'ont pas de nuage ; 243 d'entre elles (72,8 %) sont dans 1:17 (159) et 1:24 (84).
- Ce n'est pas une perte du moteur, mais cela cache les abstentions de ces parties. Avec le taux d'abstention des autres parties (39,8 %), les 243 ajouteraient environ 97 grosses corrections perdues par abstention, au lieu de 46 mesurées (32 + 14).
- Il faudrait un autre export de l'Écho, ou le corpus du lot Orbite pour les cuts qu'il couvre (non vérifié ici).

**Ce qui ne se gagne pas** : l'écartement hors contrat (8 cuts classés, 24 en abstention en chaîne dont 11 grosses corrections ; contrat juste dans 133 cas sur 134, prédiction à 45,5 mm de la bande en médiane). La garde de paire pèse 10 grosses corrections mais se trompe sur 6 des 14 cuts : on ne la lève pas sans autre mesure.

## 7. Rejouer

Script, hors dépôt : `<scratchpad>/rm4/abstentions.cjs` (Node, qui charge `selection` et `listeAControler` de `tools/relecture-autonome.cjs` du worktree GCV2). Il lit les cas et les tables ci-dessous et rend les tables T1 à T10 (annexe).

    node <scratchpad>/rm4/abstentions.cjs --md <scratchpad>/rm4/RM4_tables.md --json <scratchpad>/rm4/abstentions.json

Cas extraits (réutilisables par G1-a) : `<scratchpad>/rm4/cas-1-12.jsonl`, `cas-1-13.jsonl`, `cas-1-17.jsonl`, `cas-1-24.jsonl`, `cas-1-29.jsonl`, `cas-2-1.jsonl`, `cas-2-10.jsonl`, `cas-2-11.jsonl`, et dans `<scratchpad>/res/` : `cas14.jsonl`, `cas15.jsonl`, `cas16.jsonl`. Tables de zones : `<scratchpad>/rm4/table-P-N.json` (même numérotation) et `<scratchpad>/res/table14.json`, `table15.json`, `table16.json`. Résultats chiffrés complets : `<scratchpad>/rm4/abstentions.json`.

Pour refaire une extraction : `node tools/relecture-autonome.cjs extraire --partie P:N --echo "<dossier Écho>" --sortie <cas.jsonl>` puis `table --partie P:N --echo … (--journal <journal.json> | --sans-lot) --cas <cas.jsonl> --sortie <table.json>`. Les scripts de lancement (`lancer.sh`, `tables.sh`) et d'extraction des journaux (`jextraire.py`, lancé avec `python3 -I`) sont dans le même dossier.

---

# Annexe : tables produites par le script

### T1. Par partie

| Partie | Cuts visités | dont avec référence | Calculés | Sans nuage | Autre | Abstentions seul | Abstentions chaîne | Les deux |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| 1:12 | 108 | 103 | 81 | 27 | 0 | 15 (18,5 %) | 9 (11,1 %) | 9 |
| 1:13 | 224 | 189 | 155 | 69 | 0 | 59 (38,1 %) | 39 (25,2 %) | 39 |
| 1:14 | 112 | 97 | 108 | 4 | 0 | 22 (20,4 %) | 9 (8,3 %) | 9 |
| 1:15 | 524 | 416 | 346 | 178 | 0 | 91 (26,3 %) | 60 (17,3 %) | 53 |
| 1:16 | 388 | 339 | 347 | 41 | 0 | 92 (26,5 %) | 69 (19,9 %) | 65 |
| 1:17 | 795 | 756 | 200 | 595 | 0 | 128 (64,0 %) | 121 (60,5 %) | 121 |
| 1:24 | 263 | 206 | 40 | 223 | 0 | 26 (65,0 %) | 19 (47,5 %) | 19 |
| 1:29 | 821 | 760 | 582 | 239 | 0 | 230 (39,5 %) | 171 (29,4 %) | 170 |
| 2:1 | 765 | 568 | 465 | 300 | 0 | 296 (63,7 %) | 260 (55,9 %) | 256 |
| 2:10 | 21 | 21 | 21 | 0 | 0 | 2 (9,5 %) | 2 (9,5 %) | 2 |
| 2:11 | 546 | 298 | 303 | 243 | 0 | 116 (38,3 %) | 77 (25,4 %) | 76 |
| **total** | 4567 | 3753 | 2648 | 1919 | 0 | 1077 (40,7 %) | 836 (31,6 %) | 819 |

### T2. Grosses corrections de Mic (plus de 10 mm) : où vont-elles ?

| Partie | Mode | Mic > 10 mm | perdues par abstention | perdues faute de nuage | perdues au total | abstention, parmi celles qui ont un nuage | posées, à 10 mm de Mic | posées, à plus de 10 mm | autre |
| --- | --- | --: | --: | --: | --: | --: | --: | --: | --: |
| 1:12 | chaîne | 31 | 3 (9,7 %) | 7 (22,6 %) | 10 (32,3 %) | 12,5 % | 21 | 0 | 0 |
| 1:13 | chaîne | 29 | 7 (24,1 %) | 8 (27,6 %) | 15 (51,7 %) | 33,3 % | 12 | 2 | 0 |
| 1:14 | chaîne | 17 | 0 (0,0 %) | 2 (11,8 %) | 2 (11,8 %) | 0,0 % | 15 | 0 | 0 |
| 1:15 | chaîne | 10 | 0 (0,0 %) | 3 (30,0 %) | 3 (30,0 %) | 0,0 % | 7 | 0 | 0 |
| 1:16 | chaîne | 21 | 7 (33,3 %) | 1 (4,8 %) | 8 (38,1 %) | 35,0 % | 13 | 0 | 0 |
| 1:17 | chaîne | 203 | 32 (15,8 %) | 159 (78,3 %) | 191 (94,1 %) | 72,7 % | 7 | 5 | 0 |
| 1:24 | chaîne | 108 | 14 (13,0 %) | 84 (77,8 %) | 98 (90,7 %) | 58,3 % | 4 | 6 | 0 |
| 1:29 | chaîne | 122 | 33 (27,0 %) | 29 (23,8 %) | 62 (50,8 %) | 35,5 % | 53 | 7 | 0 |
| 2:1 | chaîne | 172 | 109 (63,4 %) | 37 (21,5 %) | 146 (84,9 %) | 80,7 % | 24 | 2 | 0 |
| 2:10 | chaîne | 1 | 0 (0,0 %) | 0 (0,0 %) | 0 (0,0 %) | 0,0 % | 0 | 1 | 0 |
| 2:11 | chaîne | 27 | 12 (44,4 %) | 4 (14,8 %) | 16 (59,3 %) | 52,2 % | 11 | 0 | 0 |
| **total** | chaîne | 741 | 217 (29,3 %) | 334 (45,1 %) | 551 (74,4 %) | 53,3 % | 167 | 23 | 0 |
| projet 1 | chaîne | 541 | 96 (17,7 %) | 293 (54,2 %) | 389 (71,9 %) | 38,7 % | 132 | 20 | 0 |
| projet 2 | chaîne | 200 | 121 (60,5 %) | 41 (20,5 %) | 162 (81,0 %) | 76,1 % | 35 | 3 | 0 |
| total sans 1:17 et 1:24 | chaîne | 430 | 171 (39,8 %) | 91 (21,2 %) | 262 (60,9 %) | 50,4 % | 156 | 12 | 0 |
| 1:12 | seul | 31 | 3 (9,7 %) | 7 (22,6 %) | 10 (32,3 %) | 12,5 % | 21 | 0 | 0 |
| 1:13 | seul | 29 | 10 (34,5 %) | 8 (27,6 %) | 18 (62,1 %) | 47,6 % | 10 | 1 | 0 |
| 1:14 | seul | 17 | 4 (23,5 %) | 2 (11,8 %) | 6 (35,3 %) | 26,7 % | 11 | 0 | 0 |
| 1:15 | seul | 10 | 1 (10,0 %) | 3 (30,0 %) | 4 (40,0 %) | 14,3 % | 6 | 0 | 0 |
| 1:16 | seul | 21 | 11 (52,4 %) | 1 (4,8 %) | 12 (57,1 %) | 55,0 % | 7 | 2 | 0 |
| 1:17 | seul | 203 | 34 (16,7 %) | 159 (78,3 %) | 193 (95,1 %) | 77,3 % | 6 | 4 | 0 |
| 1:24 | seul | 108 | 17 (15,7 %) | 84 (77,8 %) | 101 (93,5 %) | 70,8 % | 4 | 3 | 0 |
| 1:29 | seul | 122 | 46 (37,7 %) | 29 (23,8 %) | 75 (61,5 %) | 49,5 % | 42 | 5 | 0 |
| 2:1 | seul | 172 | 122 (70,9 %) | 37 (21,5 %) | 159 (92,4 %) | 90,4 % | 8 | 5 | 0 |
| 2:10 | seul | 1 | 0 (0,0 %) | 0 (0,0 %) | 0 (0,0 %) | 0,0 % | 1 | 0 | 0 |
| 2:11 | seul | 27 | 17 (63,0 %) | 4 (14,8 %) | 21 (77,8 %) | 73,9 % | 5 | 1 | 0 |
| **total** | seul | 741 | 265 (35,8 %) | 334 (45,1 %) | 599 (80,8 %) | 65,1 % | 121 | 21 | 0 |
| projet 1 | seul | 541 | 126 (23,3 %) | 293 (54,2 %) | 419 (77,4 %) | 50,8 % | 107 | 15 | 0 |
| projet 2 | seul | 200 | 139 (69,5 %) | 41 (20,5 %) | 180 (90,0 %) | 87,4 % | 14 | 6 | 0 |
| total sans 1:17 et 1:24 | seul | 430 | 214 (49,8 %) | 91 (21,2 %) | 305 (70,9 %) | 63,1 % | 111 | 14 | 0 |

Même chose au seuil de 5 mm (toutes parties) :

| Mode | Mic > 5 mm (toutes parties) | perdues par abstention | perdues faute de nuage | perdues au total |
| --- | --: | --: | --: | --: |
| chaîne | 1473 | 365 (24,8 %) | 668 (45,3 %) | 1033 (70,1 %) |
| seul | 1473 | 449 (30,5 %) | 668 (45,3 %) | 1117 (75,8 %) |

Par zone (plus de 10 mm, toutes parties) :

| Mode | Zone | Cuts visités | Mic > 10 mm | perdues par abstention | perdues faute de nuage | posées, à 10 mm | posées, à plus de 10 mm |
| --- | --- | --: | --: | --: | --: | --: | --: |
| chaîne | PN | 622 | 108 | 21 (19,4 %) | 21 (19,4 %) | 64 | 2 |
| chaîne | ADV | 1349 | 85 | 41 (48,2 %) | 20 (23,5 %) | 22 | 2 |
| chaîne | abords | 1648 | 467 | 137 (29,3 %) | 253 (54,2 %) | 62 | 15 |
| chaîne | liste | 48 | 15 | 4 (26,7 %) | 8 (53,3 %) | 3 | 0 |
| chaîne | hors | 900 | 66 | 14 (21,2 %) | 32 (48,5 %) | 16 | 4 |
| seul | PN | 622 | 108 | 28 (25,9 %) | 21 (19,4 %) | 57 | 2 |
| seul | ADV | 1349 | 85 | 52 (61,2 %) | 20 (23,5 %) | 11 | 2 |
| seul | abords | 1648 | 467 | 162 (34,7 %) | 253 (54,2 %) | 40 | 12 |
| seul | liste | 48 | 15 | 5 (33,3 %) | 8 (53,3 %) | 2 | 0 |
| seul | hors | 900 | 66 | 18 (27,3 %) | 32 (48,5 %) | 11 | 5 |

### T3. Cause de chaque rail dans les abstentions (moteur ; entre parenthèses : cuts corrigés de plus de 10 mm par Mic)

| Mode | Rail | Abstentions | candidat (dont Mic > 10) | écartement (dont Mic > 10) | absent (dont Mic > 10) | ambiguïté (dont Mic > 10) | sommet (dont Mic > 10) | flanc (dont Mic > 10) | autre (dont Mic > 10) |
| --- | --- | --: | --: | --: | --: | --: | --: | --: | --: |
| chaîne | gauche | 836 | 357 (92) | 24 (11) | 165 (40) | 35 (18) | 93 (20) | 127 (22) | 35 (14) |
| chaîne | droit | 836 | 251 (62) | 24 (11) | 214 (68) | 20 (10) | 142 (28) | 151 (26) | 34 (12) |
| seul | gauche | 1077 | 450 (101) | 62 (26) | 165 (40) | 65 (23) | 123 (23) | 168 (35) | 44 (17) |
| seul | droit | 1077 | 328 (76) | 62 (26) | 214 (68) | 36 (14) | 191 (36) | 205 (33) | 41 (12) |

### T3b. Au moins un rail en échec pour une cause (non exclusif : un cut peut compter dans deux lignes)

| Mode | Au moins un rail en | Cuts | Mic > 5 | Mic > 10 | part des Mic > 10 abstenus |
| --- | --- | --: | --: | --: | --: |
| chaîne | écartement | 24 | 13 | 11 | 5,1 % |
| chaîne | absent | 356 | 161 | 104 | 47,9 % |
| chaîne | ambiguïté | 53 | 30 | 26 | 12,0 % |
| chaîne | sommet | 216 | 86 | 47 | 21,7 % |
| chaîne | flanc | 251 | 102 | 47 | 21,7 % |
| chaîne | autre | 68 | 35 | 25 | 11,5 % |
| seul | écartement | 62 | 29 | 26 | 9,8 % |
| seul | absent | 356 | 161 | 104 | 39,2 % |
| seul | ambiguïté | 96 | 42 | 34 | 12,8 % |
| seul | sommet | 291 | 104 | 57 | 21,5 % |
| seul | flanc | 339 | 140 | 66 | 24,9 % |
| seul | autre | 84 | 43 | 28 | 10,6 % |

### T4. Cause par paire (moteur)

| Paire (moteur) | chaîne : cuts | Mic > 5 | Mic > 10 | seul : cuts | Mic > 5 | Mic > 10 |
| --- | --: | --: | --: | --: | --: | --: |
| candidat + absent | 211 | 85 | 52 | 211 | 85 | 52 |
| candidat + flanc | 146 | 69 | 26 | 223 | 102 | 43 |
| candidat + sommet | 128 | 46 | 23 | 192 | 62 | 31 |
| absent + flanc | 55 | 23 | 15 | 55 | 23 | 15 |
| candidat + autre | 44 | 18 | 11 | 60 | 26 | 14 |
| candidat + ambiguïté | 27 | 14 | 10 | 64 | 24 | 17 |
| absent + sommet | 43 | 24 | 16 | 43 | 24 | 16 |
| écartement + écartement | 24 | 13 | 11 | 62 | 29 | 26 |
| flanc + flanc | 27 | 4 | 1 | 34 | 7 | 2 |
| absent + absent | 23 | 11 | 4 | 23 | 11 | 4 |
| sommet + sommet | 19 | 6 | 1 | 23 | 7 | 2 |
| candidat + candidat | 26 | 17 | 16 | 14 | 11 | 10 |
| sommet + flanc | 15 | 3 | 2 | 19 | 4 | 3 |
| absent + ambiguïté | 13 | 8 | 8 | 13 | 8 | 8 |
| absent + autre | 11 | 10 | 9 | 11 | 10 | 9 |
| ambiguïté + sommet | 6 | 4 | 4 | 9 | 4 | 4 |
| flanc + autre | 5 | 2 | 2 | 5 | 2 | 2 |
| sommet + autre | 5 | 3 | 1 | 5 | 3 | 1 |
| ambiguïté + ambiguïté | 2 | 2 | 2 | 5 | 3 | 3 |
| ambiguïté + flanc | 3 | 1 | 1 | 3 | 2 | 1 |
| ambiguïté + autre | 2 | 1 | 1 | 2 | 1 | 1 |
| autre + autre | 1 | 1 | 1 | 1 | 1 | 1 |

### T5. Familles d'abstention, chaîne

| Famille | Cuts | avec référence | Mic > 5 mm | Mic > 10 mm | dont différés par le lot | part des Mic > 10 abstenus |
| --- | --: | --: | --: | --: | --: | --: |
| écartement hors contrat | 8 | 7 | 4 | 3 | 1 | 1,4 % |
| un rail absent | 204 | 190 | 67 | 35 | 12 | 16,1 % |
| ambiguïté | 6 | 6 | 2 | 1 | 1 | 0,5 % |
| sommet insuffisant | 70 | 59 | 23 | 7 | 2 | 3,2 % |
| flanc | 80 | 68 | 29 | 11 | 6 | 5,1 % |
| pas d'appui | 423 | 382 | 217 | 140 | 101 | 64,5 % |
| autre | 45 | 43 | 23 | 20 | 10 | 9,2 % |
| **total** | 836 | 755 | 365 | 217 | 133 | 100 % |

Par zone, cellule = cuts (corrigés > 5 mm ; > 10 mm) :

| Famille | PN | ADV | abords | liste | hors | toutes zones |
| --- | --: | --: | --: | --: | --: | --: |
| écartement hors contrat | 1 (0 ; 0) | 5 (2 ; 1) | 2 (2 ; 2) | 0 | 0 | 8 (4 ; 3) |
| un rail absent | 34 (8 ; 7) | 59 (13 ; 5) | 61 (36 ; 19) | 2 (2 ; 1) | 48 (8 ; 3) | 204 (67 ; 35) |
| ambiguïté | 0 | 3 (1 ; 1) | 2 (1 ; 0) | 0 | 1 (0 ; 0) | 6 (2 ; 1) |
| sommet insuffisant | 14 (5 ; 2) | 19 (4 ; 0) | 21 (11 ; 4) | 0 | 16 (3 ; 1) | 70 (23 ; 7) |
| flanc | 9 (3 ; 2) | 20 (2 ; 0) | 35 (18 ; 6) | 2 (2 ; 1) | 14 (4 ; 2) | 80 (29 ; 11) |
| pas d'appui | 26 (9 ; 8) | 108 (44 ; 31) | 197 (130 ; 91) | 6 (5 ; 2) | 86 (29 ; 8) | 423 (217 ; 140) |
| autre | 6 (2 ; 2) | 16 (4 ; 3) | 22 (17 ; 15) | 0 | 1 (0 ; 0) | 45 (23 ; 20) |
| **total** | 90 (27 ; 21) | 230 (70 ; 41) | 340 (215 ; 137) | 10 (9 ; 4) | 166 (44 ; 14) | 836 (365 ; 217) |

### T6. Familles d'abstention, seul

| Famille | Cuts | avec référence | Mic > 5 mm | Mic > 10 mm | dont différés par le lot | part des Mic > 10 abstenus |
| --- | --: | --: | --: | --: | --: | --: |
| écartement hors contrat | 62 | 61 | 29 | 26 | 14 | 9,8 % |
| un rail absent | 356 | 331 | 161 | 104 | 62 | 39,2 % |
| ambiguïté | 83 | 81 | 34 | 26 | 15 | 9,8 % |
| sommet insuffisant | 239 | 197 | 76 | 37 | 19 | 14,0 % |
| flanc | 262 | 230 | 111 | 47 | 30 | 17,7 % |
| pas d'appui | 0 | 0 | 0 | 0 | 0 | 0,0 % |
| autre | 75 | 70 | 38 | 25 | 10 | 9,4 % |
| **total** | 1077 | 970 | 449 | 265 | 150 | 100 % |

Par zone :

| Famille | PN | ADV | abords | liste | hors | toutes zones |
| --- | --: | --: | --: | --: | --: | --: |
| écartement hors contrat | 5 (2 ; 2) | 42 (13 ; 11) | 10 (9 ; 9) | 0 | 5 (5 ; 4) | 62 (29 ; 26) |
| un rail absent | 43 (12 ; 11) | 84 (25 ; 15) | 145 (97 ; 67) | 5 (5 ; 3) | 79 (22 ; 8) | 356 (161 ; 104) |
| ambiguïté | 11 (7 ; 5) | 47 (9 ; 7) | 20 (16 ; 13) | 0 | 5 (2 ; 1) | 83 (34 ; 26) |
| sommet insuffisant | 36 (6 ; 3) | 77 (14 ; 7) | 82 (44 ; 24) | 2 (1 ; 1) | 42 (11 ; 2) | 239 (76 ; 37) |
| flanc | 17 (6 ; 3) | 81 (22 ; 10) | 104 (63 ; 30) | 3 (3 ; 1) | 57 (17 ; 3) | 262 (111 ; 47) |
| pas d'appui | 0 | 0 | 0 | 0 | 0 | 0 |
| autre | 9 (4 ; 4) | 20 (5 ; 2) | 39 (28 ; 19) | 1 (1 ; 0) | 6 (0 ; 0) | 75 (38 ; 25) |
| **total** | 121 (37 ; 28) | 351 (88 ; 52) | 400 (257 ; 162) | 11 (10 ; 5) | 194 (57 ; 18) | 1077 (449 ; 265) |

### T7. Motifs de la décision en chaîne

| Motif de la décision (chaîne) | Cuts | dont Mic > 10 mm | familles |
| --- | --: | --: | --: |
| no-anchor | 423 | 140 | pas d'appui 423 |
| aucun-minimum | 167 | 25 | flanc 74, sommet insuffisant 67, autre 12, écartement hors contrat 8, ambiguïté 6 |
| frame | 163 | 28 | un rail absent 162, autre 1 |
| aucun-minimum + frame | 40 | 8 | un rail absent 40 |
| rsf | 19 | 3 | autre 13, flanc 5, sommet insuffisant 1 |
| pair-guard | 14 | 10 | autre 14 |
| garde d'écartement | 5 | 3 | autre 4, sommet insuffisant 1 |
| aucun-minimum + rsf | 3 | 0 | flanc 1, sommet insuffisant 1, autre 1 |
| frame + rsf | 2 | 0 | un rail absent 2 |

| Cause moteur sous « pas d'appui » (chaîne) | Cuts | Mic > 5 | Mic > 10 |
| --- | --: | --: | --: |
| un rail absent | 152 | 94 | 69 |
| flanc | 98 | 46 | 18 |
| sommet insuffisant | 97 | 35 | 20 |
| ambiguïté | 34 | 20 | 17 |
| autre | 26 | 13 | 8 |
| écartement hors contrat | 16 | 9 | 8 |

Détail de « autre » :

| Mode | Moteur / décision | Cuts | Mic > 5 | Mic > 10 |
| --- | --- | --: | --: | --: |
| chaîne | moteur candidat / pair-guard | 14 | 11 | 10 |
| chaîne | rsf / rsf | 13 | 1 | 1 |
| chaîne | moteur candidat / aucun-minimum | 8 | 3 | 3 |
| chaîne | moteur candidat / garde d'écartement | 4 | 3 | 3 |
| chaîne | slope / aucun-minimum | 4 | 3 | 2 |
| chaîne | rsf / frame | 1 | 1 | 1 |
| chaîne | rsf / aucun-minimum + rsf | 1 | 1 | 0 |
| seul | slope / no-anchor | 32 | 16 | 8 |
| seul | rsf / no-anchor | 26 | 8 | 4 |
| seul | moteur candidat / pair-guard | 14 | 11 | 10 |
| seul | window / no-anchor | 2 | 2 | 2 |
| seul | rsf+slope / no-anchor | 1 | 1 | 1 |

### T8. Abstentions « seul » reprises par la chaîne

| Famille (seul) | Abstentions seul | dont posées en chaîne | part | Mic > 10 : seul | Mic > 10 : posées en chaîne |
| --- | --: | --: | --: | --: | --: |
| écartement hors contrat | 62 | 39 | 62,9 % | 26 | 15 |
| un rail absent | 356 | 0 | 0,0 % | 104 | 0 |
| ambiguïté | 83 | 44 | 53,0 % | 26 | 8 |
| sommet insuffisant | 239 | 74 | 31,0 % | 37 | 10 |
| flanc | 262 | 85 | 32,4 % | 47 | 18 |
| autre | 75 | 16 | 21,3 % | 25 | 3 |

### T9. Données pour les pistes

- Ambiguïté (rails en ambiguïté dans les cuts calculés : 164) : au moins 1 cellule STRONG compétitive pour 130 (79,3 %), au moins 2 pour 123 (75,0 %) ; rapport de perte médian 1,17 (quartiles 1,08 à 1,28) ; confiance médiane 0. La position de la cellule écartée n'est pas dans le cas : on ne sait pas si elle est celle de Mic.
- Écartement hors contrat (cuts calculés avec un rail hors contrat : 142) : écartement prédit sous 1420 mm pour 44, au-dessus de 1470 mm pour 98 ; hors de la bande de 45,5 mm en médiane (3e quartile 110,3 mm) ; à 5 mm au plus de la bande : 2, à 10 mm : 5, à 20 mm : 7, à 30 mm : 12 ; écartement de départ dans le contrat : 117 ; écartement de Mic dans le contrat : 133 sur 134 avec référence (dont Mic > 10 mm : 42 sur 43).
- Un seul rail en échec, l'autre candidat (abstentions en chaîne) : 556 cuts, 498 avec référence, Mic > 5 mm : 232, Mic > 10 mm : 122 ; le rail candidat du moteur est à 10 mm de Mic pour 446 sur 498 (89,6 %), à 5 mm pour 360 (72,3 %) ; sur les Mic > 10 mm : 90 sur 122 (73,8 %).
  - par cause de l'autre rail : sommet 128 cuts (Mic > 10 : 23 ; rail candidat à 10 mm de Mic : 93 sur 109) ; flanc 146 cuts (Mic > 10 : 26 ; rail candidat à 10 mm de Mic : 120 sur 129) ; ambiguïté 27 cuts (Mic > 10 : 10 ; rail candidat à 10 mm de Mic : 24 sur 27) ; absent 211 cuts (Mic > 10 : 52 ; rail candidat à 10 mm de Mic : 173 sur 192) ; autre 44 cuts (Mic > 10 : 11 ; rail candidat à 10 mm de Mic : 36 sur 41).
- Moteur candidat des deux côtés mais décision en abstention (chaîne) : 26 cuts (motifs : garde d'écartement 4, aucun-minimum 8, pair-guard 14), 26 avec référence, Mic > 10 mm : 16 ; les deux rails du moteur sont à 10 mm de Mic pour 17 sur 26 (65,4 %), à 5 mm pour 8 ; sur les Mic > 10 mm : 10 sur 16.
- Pas d'appui (chaîne) : 423 cuts (Mic > 10 mm : 140) ; aucun des 3 cuts précédents visité : 63 ; un des 3 précédents visité sans nuage : 266 (Mic > 10 mm : 91) ; précédents visités avec nuage mais aucun appui retenu : 94 (Mic > 10 mm : 44) ; autres : 0. Cut posé par le lot à 3 cuts au plus (avant ou après) : 201 (Mic > 10 mm : 58) ; à 8 cuts au plus : 280 (Mic > 10 mm : 96) ; lot à 3 cuts ou précédent sans nuage : 346 (Mic > 10 mm : 114). Aucun appui ne vient du lot ni de Mic dans la chaîne mesurée. Reprise attendue si ces cuts avaient des appuis (taux de reprise seul vers chaîne, par cause moteur, T8) : 95 cuts, dont 23 avec Mic > 10 mm.
  - complétion latérale du rail manquant par l'écartement médian des poses d'Ariane de la partie (sans Mic ; vertical non traité) : 498 cuts avec référence (Mic > 10 mm : 122) ; latéral du rail manquant à 10 mm de Mic : 414 (83,1 %), à 5 mm : 311 (62,4 %) ; sur les Mic > 10 mm : 76 sur 122 (62,3 %) à 10 mm ; rail candidat à 10 mm (3D) ET latéral complété à 10 mm : 399 (80,1 %), sur les Mic > 10 mm : 69 sur 122 ; erreur latérale médiane 3,6 mm (3e quartile 7,7 mm). Repères sans écartement : ne rien bouger sur le rail manquant, latéral à 10 mm de Mic pour 417 (83,7 %), sur les Mic > 10 mm 41 sur 122 ; déplacer le rail manquant comme le rail candidat (même latéral) : 387 (77,7 %), sur les Mic > 10 mm 27 sur 122.
- Moteur candidat des deux côtés, décision en abstention, par motif (chaîne, avec référence) : garde d'écartement 4 cuts (Mic > 10 : 3 ; moteur à 10 mm de Mic : 3 ; sur les Mic > 10 : 2) ; aucun-minimum 8 cuts (Mic > 10 : 3 ; moteur à 10 mm de Mic : 6 ; sur les Mic > 10 : 1) ; pair-guard 14 cuts (Mic > 10 : 10 ; moteur à 10 mm de Mic : 8 ; sur les Mic > 10 : 7).
- Rail absent (statut absent du moteur, 379 rails dans les cuts calculés) : points lus sur ce rail : 0 pour 0, de 1 à 99 pour 38, de 100 à 499 pour 47, 500 et plus pour 294, inconnu 0 ; cuts avec Mic > 10 mm : 108 ; correction latérale de Mic sur ce rail : médiane 0,59 mm, plus de 180 mm pour 27 rails sur 352 avec référence (le cadre du rail n'est monté qu'avec des points à moins de 180 mm de la pose de départ).
- Nombre d'appuis de la chaîne dans les abstentions : 0 appui(s) : 433 cuts (Mic > 10 : 147) ; 1 appui(s) : 254 cuts (Mic > 10 : 46) ; 2 appui(s) : 149 cuts (Mic > 10 : 24).

### T10. Sélection (comptes de la fonction selection)

| Partie | PN | ADV | abords | liste | cuts du lot | grappes | isolés |
| --- | --: | --: | --: | --: | --: | --: | --: |
| 1:12 | 115 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1:13 | 111 | 188 | 0 | 0 | 0 | 0 | 0 |
| 1:14 | 115 | 0 | 0 | 0 | 0 | 0 | 0 |
| 1:15 | 44 | 300 | 0 | 0 | 0 | 0 | 0 |
| 1:16 | 134 | 275 | 0 | 0 | 0 | 0 | 0 |
| 1:17 | 0 | 0 | 588 | 36 | 268 | 24 | 40 |
| 1:24 | 0 | 0 | 1215 | 2 | 515 | 27 | 117 |
| 1:29 | 62 | 209 | 502 | 9 | 245 | 15 | 81 |
| 2:1 | 12 | 405 | 304 | 0 | 351 | 15 | 4 |
| 2:10 | 18 | 0 | 3 | 0 | 9 | 1 | 1 |
| 2:11 | 73 | 276 | 106 | 1 | 131 | 14 | 7 |

