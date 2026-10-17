# Verts à contrôler (5.0, nuit du 16 au 17 octobre 2026)

Chantier parti de la base 5.0. Point de départ : la liste « verts à contrôler » des règles métier (`fiches/REGLES_METIER.md`, § 7.2 : en partie 29, 256 verts signalés retrouvent 67 des 83 verts corrigés de plus de 10 mm), les signaux de hauteur de `fiches/FAUX_VERTS.md` et de G0 (§ 5.2, dénivelé local), et le panneau « à relire » de M6, resté suspendu.

Un **vert**, ici, est un cut qu'ESV a laissé valide et qu'Orbite ne visite pas. Ce chantier en fait un **outil pour l'opérateur** : une liste, classée par risque et groupée en plages, qu'il consulte après un lot. **Ariane ne fait rien dans ESV** pour la dresser : ni clic, ni navigation, ni requête, ni changement d'état d'un cut.

Conventions : parties désignées par leur rang (« 1:29 » = projet 1, partie 29 ; « 2:1 » = projet 2, partie 1). Une **erreur** est un vert que l'opérateur a corrigé de plus de 10 mm (3D, pire des deux rails, même définition que G0) ; un **gros écart**, de 25 mm ou plus.

## 1. En bref

| | Résultat |
|---|---|
| **Classement** | Score à cinq signaux utiles : écart d'écartement à la médiane de la partie, dénivelé (hauteur gauche − droite) contre les verts voisins, hauteur de chaque rail contre la voie des verts voisins, hauteur contre les poses validées d'Ariane, densité de rouges (cuts du lot à 5 cuts) et voisin d'un différé. Chaque terme est nul sous 2 mm. |
| **Partie 29** (relecture la plus soignée) | L'opérateur a relu 584 verts (36 min). La liste en garde **121** (21 %), **7,5 min** à 3,7 s par vert, et y trouve **63 des 83 erreurs** (76 %) et **38 des 39 gros écarts**. La liste des règles métier en gardait 256 pour 67 erreurs et 36 gros écarts : **moitié moins de verts, deux gros écarts de plus**. |
| **Partie 1, second projet** | 77 verts (27 %) sur 275, **4,8 min** au lieu de 23 : 27 erreurs sur 35, 15 gros écarts sur 20. |
| **Parties 17 et 24** (lots de la 4.9.0) | 188 verts, 67/126 erreurs, 16/16 gros écarts (11,6 min au lieu de 30) ; 63 verts, 37/47, 8/8 (3,9 min au lieu de 8). Beaucoup d'erreurs y sont de petites corrections verticales de 10 à 20 mm sur des verts semblables à leurs voisins. |
| **Parties 12 et 13** (sans lot) | 37 verts, 30/31 erreurs, 28/28 gros écarts ; 29 verts, 27/29, 26/26. |
| **Validation croisée** (seuil appris sans la partie jugée) | Partie 29 : 77 % des erreurs, 38/39 gros écarts, 25 % des verts relus. Second projet : 77 %, 32 %. Le point « 80 % des erreurs en relisant 30 % des verts » est **presque** tenu sur les deux lots de la version actuelle, pas sur les lots de la 4.9.0 (§ 4). |
| **Temps de l'opérateur** | **3,7 s par vert vérifié** : 3,6 s en partie 29 (visites plafonnées à 30 s ; 4,1 s à 120 s ; médiane 2,4 s). De 3,4 à 5,5 s selon la partie. |
| **Dans l'extension** | En fin de lot, une carte « À contrôler » dans le panneau Orbite : nombre de cuts, temps estimé, plages dans l'ordre des cuts (« PN 1656–1663 · 1655–1666 · 4 cuts », « autour du différé 283 · 282–289 · 4 cuts »). « Recalculer » à la demande. La liste part dans l'export (« Tout télécharger ») en petit fichier JSON. **Active par défaut** (réglage `vertsAControler`), coupable. |
| **Sans effet sur la pose** | Prouvé par essai (service worker réel) : commandes, rails, enregistrements, événements et décisions du lot identiques octet pour octet, liste active ou coupée, même demandée pendant le lot ; aucune commande à l'adaptateur et aucun message à l'onglet quand on la demande. `src/engine.js` n'est pas touché. |

## 2. Ce que la liste contient

- **Les verts** sont les lignes de la liste d'ESV au statut `valid`, jamais traitées par un opérateur, hors des cuts du lot.
- **Les candidats** sont les verts que la méthode de l'opérateur fait relire :
  - à 5 cuts au plus d'un cut du lot, c'est-à-dire la fenêtre que B1 lit déjà ;
  - ou dans la plage d'un PN reconnu par les règles métier (4 cuts avant, 6 après).
  
  Un vert loin de tout rouge n'est jamais proposé, même mal extrait. En partie 29, ces verts portent 3 des 83 erreurs.
- **Le score** est une somme de termes bornés à 40 mm. Chaque terme vaut zéro sous sa zone morte de 2 mm.

  | Terme | Signal | Poids (par 10 mm, ou par unité) |
  |---|---|--:|
  | écartement | écart à la médiane de l'écartement des verts de la partie | 0,5 |
  | dénivelé | hauteur gauche − droite contre la médiane des verts voisins (±10 cuts) | 0,5 |
  | hauteur | chaque rail contre l'interpolation du même rail des verts voisins (un avant, un après, à 5 cuts au plus) | 1 |
  | poses | la même chose contre les poses validées d'Ariane, quand il y en a de part et d'autre | 0,5 |
  | rouges | cuts du lot à 5 cuts au plus (5 rouges = 1 point, 6 au plus) | 1 |
  | différé | un différé du lot à 2 cuts au plus | 0,5 |
  | voie latérale, PN | calculés, poids nul : ils n'apportaient rien en validation croisée | 0 |

  Un vert entre dans la liste si son score atteint **1**.
- **Les plages** suivent l'ordre des cuts. Des verts retenus à 2 cuts au plus l'un de l'autre forment une plage. Le libellé dit pourquoi on y va :
  - le PN touché : « PN 405–408 » ;
  - sinon le différé à 2 cuts : « autour du différé 512 » ;
  - sinon la grappe de cuts du lot : « grappe 294–304 » ;
  - sinon le signal : « écartement, cut 4498 », « hauteur, cuts 300–301 » ;
  - sinon « près du cut 1794 ».

  Deux plages voisines qui ont le même libellé n'en font qu'une. Les cuts sont donnés en clair : « 1655, 1664–1666 ».
- **Le temps estimé** compte 3,7 s par vert.

## 3. Signaux

AUC des erreurs de plus de 10 mm parmi les candidats que l'opérateur a relus (0,5 : aucun pouvoir) :

| Partie | Verts relus | Erreurs | Candidats | écartement | dénivelé | hauteur | poses | voie lat. | rouges | différé | PN |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1:17 | 372 | 126 | 327 | 0,42 | 0,71 | 0,71 | 0,83 | 0,60 | 0,54 | 0,54 | 0,50 |
| 1:24 | 96 | 47 | 96 | 0,47 | 0,45 | 0,58 | 0,64 | 0,61 | 0,82 | 0,70 | 0,50 |
| 1:29 | 584 | 83 | 405 | 0,63 | 0,76 | 0,83 | 0,97 | 0,57 | 0,77 | 0,66 | 0,54 |
| 2:1 | 275 | 35 | 164 | 0,88 | 0,69 | 0,60 | 0,73 | 0,76 | 0,74 | 0,68 | 0,54 |
| 1:12 | 107 | 31 | 107 | 1,00 | 0,94 | 0,69 | — | 0,72 | — | — | 0,53 |
| 1:13 | 223 | 29 | 223 | 1,00 | 0,90 | 0,68 | — | 0,85 | — | — | 0,67 |

- **Hauteur d'un rail.** C'est le signal de hauteur de FAUX_VERTS et de G0, transposé aux verts, et le plus utile sur la version actuelle :
  - contre les verts voisins, AUC 0,83 en partie 29 ;
  - contre les poses d'Ariane, 0,97, mais connu seulement pour 98 verts sur 584.
  
  Les signaux de FAUX_VERTS (calage de convention, dessus épais) demandent la capture du cut : un vert n'en a pas, puisqu'Orbite ne le visite pas.
- **Écartement.** Il est décisif sur les parties humaines (54 mauvais objets sur 54) et sur le second projet. Il est sans pouvoir, voire inverse, sur les parties 17 et 24, où les erreurs sont verticales.
- **Densité de rouges.** Elle est forte partout où il y a des grappes : partie 24 (0,82), partie 29 (0,77). C'est la traduction de « grappe : contrôler toute la plage ».
- **Plage de PN.** Seule, elle ne trie pas : AUC de 0,53 à 0,67. Les verts faux d'un PN ont un écartement ou une hauteur qui sort, et c'est par là qu'ils entrent dans la liste. Le PN reste dans le libellé de la plage.

## 4. Courbe et validation croisée

Méthode (`tools/verts-a-controler.cjs etudier`) :
- On apprend sur trois lots et on juge le quatrième. Les parties 12 et 13 (sans lot) sont jugées avec ce qui a été appris sur les quatre lots. Une partie ne sert jamais des deux côtés.
- L'univers est celui des verts que l'opérateur a relus.
- **Liste « terrain »** : les verts relus que la liste retient, plus une estimation des verts de la fenêtre qu'il n'a pas relus.
  - On connaît leur contexte (cuts du lot, différés), pas leur pose.
  - On leur prête la pose d'un vert juste tiré au hasard dans la même partie.
  
  En partie 29, la fenêtre contient 599 verts non relus, presque tous à 2 cuts ou plus d'un rouge isolé. C'est la borne pessimiste de la taille de la liste au terrain.

**Seuil seul appris sans la partie jugée** (poids livrés). Le seuil retenu est celui qui fait le meilleur compromis moyen sur l'apprentissage : relire 10 % de verts en plus doit rapporter au moins 3 % d'erreurs en plus. Rappel pour une liste terrain de 10 / 20 / 30 / 40 / 50 / 60 % des verts relus :

| Partie | Seuil appris | Courbe | Liste relue (part) | Liste terrain (part) | Erreurs | Gros écarts | Minutes (relue – terrain) |
|---|--:|---|--:|--:|--:|--:|---|
| 1:17 | 1,06 | 19 / 28 / 35 / 44 / 46 / 52 % | 145 (39 %) | 200 (54 %) | 63/126 (50 %) | 16/16 | 8,9 – 12,3 |
| 1:24 | 0,94 | 17 / 26 / 40 / 53 / 62 / 64 % | 56 (58 %) | 115 | 38/47 (81 %) | 8/8 | 3,5 – 7,1 |
| **1:29** | 0,86 | **55 / 72 / 76 / 77 / 77 / 78 %** | **146 (25 %)** | 211 (36 %) | **64/83 (77 %)** | **38/39** | 9 – 13 |
| **2:1** | 0,86 | **51 / 71 / 77 / 77 / 77 / 77 %** | **88 (32 %)** | 97 (35 %) | **27/35 (77 %)** | 15/20 | 5,4 – 6 |
| 1:12 | 1,04 | 32 / 68 / 94 / 97 / 100 / 100 % | 36 (34 %) | 36 | 30/31 | 28/28 | 2,2 |
| 1:13 | 1,04 | 76 / 100 / 100 / 100 / 100 / 100 % | 28 (13 %) | 28 | 26/29 | 26/26 | 1,7 |

**Réglage complet appris sans la partie jugée** (poids, zone morte et seuil). Les courbes se ressemblent : partie 29, 49 / 65 / 71 / 76 / 78 / 81 % ; second projet, 46 / 60 / 74 / 74 / 77 / 77 %. Le seuil, lui, ne se transporte pas. Appris sans la partie 29, avec d'autres poids, il tombe à 2,26 et ne garde que 72 verts pour 46 erreurs (55 %). D'où le choix livré : des poids appris sur les quatre lots, et un seuil fixé d'après la validation croisée du seuil seul (0,86 à 1,06), arrondi à 1.

**Point de fonctionnement.** Sur les deux lots de la version actuelle :
- **trois quarts des erreurs de plus de 10 mm, et presque tous les gros écarts, en relisant un quart à un tiers des verts** ;
- les 80 % ne sont pas atteints : la courbe plafonne vers 77 à 78 % ;
- en partie 29, les erreurs manquées sont surtout des corrections de 10 à 19 mm (1682, 1709, 2181…), plus un gros écart (267, 27 mm) ;
- au second projet, ce sont les ADV hors fenêtre (157–160, 5549–5551), que rien ne signale sans zone d'ADV.

Sur les lots de la 4.9.0, une erreur sur deux seulement est trouvée. Un tiers des verts y sont corrigés de plus de 10 mm, souvent en série, par petites corrections verticales.

## 5. Temps de l'opérateur

Durée des visites de l'Écho sur les verts relus (une visite plafonnée à 30 s, puis à 120 s) :

| Partie | Verts | Minutes (≤ 30 s) | s par vert | Minutes (≤ 120 s) | s par vert | Médiane |
|---|--:|--:|--:|--:|--:|--:|
| 1:17 | 372 | 27,7 | 4,5 | 30,2 | 4,9 | 2,8 s |
| 1:24 | 96 | 6,6 | 4,1 | 8,1 | 5,0 | 2,7 s |
| **1:29** | 584 | **35,4** | **3,6** | 39,8 | 4,1 | 2,4 s |
| 2:1 | 275 | 18,5 | 4,0 | 23,4 | 5,1 | 2,4 s |
| 1:12 | 107 | 9,8 | 5,5 | 14,1 | 7,9 | 2,0 s |
| 1:13 | 223 | 12,5 | 3,4 | 14,2 | 3,8 | 1,3 s |

Les 36 minutes de la partie 29 se retrouvent : 35,4 minutes, soit 3,6 s par vert. **3,7 s est gardé.** Ailleurs, on va de 3,4 à 5,5 s.

Le rejeu donne aussi le temps « réel », c'est-à-dire la somme des visites de l'opérateur sur les verts de la liste :
- partie 29 : 6,7 min, contre 7,5 min à 3,7 s ;
- second projet : 6,5 min, contre 4,8 min.

Les verts de la liste prennent un peu plus de temps que la moyenne : ce sont ceux qu'on corrige.

## 6. Rejeu sur toutes les parties (réglages livrés)

`tools/verts-a-controler.cjs rejeu`. C'est la liste qu'Ariane aurait donnée. Ces chiffres sont **en échantillon** : les poids ont été appris sur ces lots.

| Partie | Verts relus par l'opérateur (min réelles) | Candidats | À contrôler (dont relus ; part) | Erreurs attrapées | Gros écarts | ≤ 5 mm | Minutes à 3,7 s | Liste terrain estimée (min) |
|---|---|--:|--:|--:|--:|--:|--:|---|
| 1:17 | 372 (30,2) | 417 | 188 (159 ; 43 %) | 67/126 (53 %) | 16/16 | 41 | 11,6 | 234 (14,4) |
| 1:24 | 96 (8,1) | 130 | 63 (52 ; 54 %) | 37/47 (79 %) | 8/8 | 5 | 3,9 | 105 (6,5) |
| **1:29** | 584 (39,8) | 406 | **121 (121 ; 21 %)** | **63/83 (76 %)** | **38/39** | 25 | **7,5** | 154 (9,5) |
| **2:1** | 275 (23,4) | 190 | **77 (73 ; 27 %)** | **27/35 (77 %)** | 15/20 | 33 | **4,8** | 78 (4,8) |
| 1:12 (sans lot) | 107 (14,1) | 107 | 37 (35 %) | 30/31 (97 %) | 28/28 | 7 | 2,3 | — |
| 1:13 (sans lot) | 223 (14,2) | 224 | 29 (13 %) | 27/29 (93 %) | 26/26 | 2 | 1,8 | — |

« Dont relus » : les verts de la liste que l'opérateur a relus à l'Écho. Les autres sont des verts de l'Écho sans référence. La partie 24 n'a été relue qu'en partie (cuts 1957 à 5763, 133 des 515 cuts du lot) : sa liste terrain n'a pas de sens.

**Ce que l'opérateur aurait vu dans le panneau, partie 29** (38 plages ; entre crochets, ce qu'il a corrigé de plus de 10 mm) :

```
À contrôler                                         Recalculer
121 cuts à contrôler · environ 7 min 28 s
grappe 268–278            269–273 · 5 cuts      [5 erreurs]
autour du différé 283     282–289 · 4 cuts      [3]
grappe 294–304            299 · 1 cut           [1]
grappe 302–306            307–310 · 4 cuts      [2]
grappe 458–465            463 · 1 cut
grappe 496–503            497–502 · 4 cuts      [1]
autour du différé 1484    1485, 1486 · 2 cuts
PN 1656–1663              1655, 1664–1666 · 4 cuts [1]
près du cut 1794          1793 · 1 cut
grappe 1883–1892          1885–1888 · 4 cuts
près du cut 2018          2017, 2021 · 2 cuts
autour du différé 2026    2027, 2028 · 2 cuts
… et 26 autres plages, dans l'export
Verts qu'Ariane n'a pas visités, à relire d'abord. Liste à consulter : aucune action dans ESV.
```

Second projet, partie 1 (35 plages) :
- autour des différés 135–136 · 133–134 ;
- grappe 325–334 · 329–332 (3 erreurs) ;
- autour du différé 346 · 344–345 (1 erreur) ;
- grappe 359–369 · 364 (1 erreur) ;
- PN 405–408 · 401, 414 (2 erreurs) ;
- autour des différés 448–452 · 450 (1 erreur) ;
- …

Partie 12 :
- PN 3948–3959 · 3947–3960, 11 cuts (8 erreurs) ;
- écartement, cut 4498 (1 erreur) ;
- PN 6235–6242 · 6235–6243, 4 cuts (4 erreurs) ;
- …

## 7. Dans l'extension

- **Module** `src/verts-a-controler.js`, pur. Il est commun au service worker et à l'outil, si bien que le terrain et le rejeu ne peuvent pas diverger. Il ne lit rien, ne commande rien et ne rend aucune position.
- **Service worker**, action de panneau `verts-a-controler` (`background.js`). Elle est calculée à la demande et ne lit que ce qu'Ariane a déjà :
  - les cuts du lot et les PN : événements `regles-metier-ombre` du journal local. À défaut, les listes du lot courant ;
  - les lignes de la liste d'ESV : l'**instantané E1** de la partie (`chrome.storage.local`). Il n'est gardé que s'il concorde avec le lot : au moins 80 % des cuts du lot y sont rouges ou traités. Sinon, Ariane se replie sur les lignes que B1 a lues pendant le lot, qui ne donnent que l'écartement ;
  - les poses d'Ariane : les bords qu'elle a écrits (mémoire E1, même liste).
  
  Elle n'envoie rien à la page, n'écrit rien et ne touche ni au lot ni à ses appuis. Elle est permise à tout moment, même pendant une session Écho.
- **Panneau** (vue Orbite) : une carte « À contrôler », sous « Ce lot ».
  - Elle apparaît quand le lot est fini. La liste est demandée une fois par lot.
  - Elle montre le nombre de cuts, le temps estimé et au plus 12 plages ; le reste est dans l'export.
  - « Recalculer » redemande la liste.
  - Pendant un lot, la carte est cachée.
  - Les textes sont échappés (aucun HTML venu de la liste).
- **Export** : « Tout télécharger » joint `ariane-verts-a-controler-partieN-<heure>.json`, quelques kilo-octets, et une ligne dans `CONTENU.txt` : « Verts à contrôler, partie N : 121 cuts en 38 plages, environ 7 min 28 s ».
- **Réglage** `vertsAControler = { actif: true }` (`src/settings.js`), avec une ligne dans la liste des réglages. Il est livré actif parce qu'il n'agit pas sur ESV. À `false`, rien n'est calculé, affiché ni exporté.
- **Réglages figés** : `datasets/reglages-figes.json`, entrée `vertsAControler` (poids, zones mortes, fenêtres, seuil, temps par vert, parties qui ont servi). Un essai vérifie qu'ils concordent avec le module.

### Preuve « aucune action dans ESV, décision et pose inchangées »

- `tests/verts-a-controler-sw.test.cjs` (service worker réel en VM, moteur et GCV1 réels, ESV simulé, lot 112–115 dont 112 et 113 différés, instantané E1 synthétique) :
  - demander la liste n'ajoute **aucune commande** à l'adaptateur et **aucun message** à l'onglet ;
  - liste active ou coupée, et même demandée pendant le lot, on obtient les mêmes commandes ESV dans le même ordre, les mêmes rails, les mêmes enregistrements, les mêmes événements métier et les **mêmes décisions du lot, octet pour octet** ;
  - un instantané qui ne concorde pas avec le lot est écarté ;
  - réglage coupé : `{ actif: false }`.
- Aucun fichier de `src/` (hors le module et `settings.js`) ne lit le module : la décision, le moteur et la pose l'ignorent. `src/engine.js` n'est pas touché.
- `tests/verts-a-controler-panel.test.cjs` : carte, demande unique, échappement, réglage coupé, fichier joint et ligne de `CONTENU.txt` (archives relues par Python).
- `tests/verts-a-controler.test.cjs` et `tests/verts-a-controler-outil.test.cjs` : module et outil sur données synthétiques. Aucune position ne sort.

## 8. Limites et doutes

- **Aucune partie à l'aveugle.** Les six parties ont servi, et les poids ont été appris sur les quatre lots. La validation croisée du seuil est honnête ; celle des poids, déjà moins (§ 4). Le vrai jugement viendra d'une partie neuve : comparer la liste à la relecture de l'opérateur.
- **L'univers du rejeu.** Seuls les verts que l'opérateur a relus ont une étiquette et une pose connue hors ligne. La liste du terrain contiendra aussi des verts qu'il ne relit pas aujourd'hui. Estimation pessimiste : 154 au lieu de 121 en partie 29 (9,5 min).
- **Les voisins sont plus denses au terrain.** L'instantané donne tous les verts, alors que le rejeu n'a que les verts relus. Les signaux de hauteur et de dénivelé y seront plus précis, mais leur loi sur les verts justes peut changer.
- **L'instantané E1 est indispensable** pour la hauteur et le dénivelé. Sans lui (liste vue partiellement, ou mémoire de la liste coupée), il ne reste que l'écartement des fenêtres de B1. C'est dit dans la carte.
- **ADV.** Un ADV sans différé n'est pas vu, et ses marges de 20 à 40 cuts dépassent la fenêtre. Au second projet, 7 erreurs manquées sont dans les zones d'ADV 1 et 4. **Mise à jour du 17/10** : les zones d'ADV reconnues par le rail de plus (`fiches/DETECTION_ADV.md`) font entrer leurs verts comme candidats (poids nul). Au second projet, la liste passe à 33 erreurs sur 35 et 20 gros écarts sur 20, pour 7 verts de plus ; les autres parties ne changent pas.
- **Les PN** viennent des règles métier en ombre. Un PN que le lot n'a pas vu (peu de rouges) n'a pas de plage.
- **Le seuil de 10 mm et le bruit de la référence** (2 à 4 mm, D-134, D-158) : beaucoup des erreurs manquées sont des corrections de 10 à 15 mm.
- **Temps** : 3,7 s est une moyenne de la partie 29. On mesure des durées de visite, pas des durées de regard.

## 9. À décider

1. Relire d'après la liste plutôt que tout relire, sur une partie neuve, en gardant la relecture complète pour juger ?
2. Le seuil : 1 (trois quarts des erreurs, un quart des verts) ? Ou plus bas pour viser les 80 %, ce qui coûte environ deux fois plus de verts pour 2 à 4 points ?
3. Faut-il toujours faire entrer les verts d'un PN dans la liste (« contrôler chaque cut »), même sans signal ? Aujourd'hui, ils n'y entrent que par l'écartement, la hauteur ou les rouges.

## 10. Rejouer

```
node tools/verts-a-controler.cjs essai
node tools/verts-a-controler.cjs extraire --partie 1:29 --jeu jeu-p29.jsonl --echo "dossier Écho 1,dossier Écho 2" \
     --journal ariane-journal-v4-….json --regles lot-p29.json --sortie t-1-29.json
node tools/verts-a-controler.cjs etudier t-1-17.json t-1-24.json t-1-29.json t-2-1.json t-1-12.json t-1-13.json --json etude.json
node tools/verts-a-controler.cjs rejeu   t-1-17.json t-1-24.json t-1-29.json t-2-1.json t-1-12.json t-1-13.json --json rejeu.json
```

- `--regles` est la sortie de `tools/regles-metier.cjs` (zones de PN). Pour les parties 12 et 13 : pas de `--journal`, et la sortie du mode « écho ».
- Les tables d'extraction portent les bords des rails : elles restent **hors dépôt**, comme les jeux, les journaux et les Échos.
- Les sorties de `etudier` et `rejeu` ne portent que des comptes, des millimètres, des minutes et des numéros de cut.
- Lancer sous `nice -n 10`. L'extraction lit les Échos : quelques minutes par partie. L'étude prend 20 s.
