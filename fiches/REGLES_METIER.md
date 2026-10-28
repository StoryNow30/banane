# Règles métier de l'opérateur dans Ariane (5.0, nuit du 16 au 17 octobre 2026)

Branche `claude/50-regles-metier`, partie de `claude/50-base`. Méthode de départ : la fiche de méthode de la partie 29 (`fiches/METHODE_MIC_P29.md`, sur la branche de pilotage, absente de la base 5.0) et les réponses de l'opérateur du 16/10 (PN avec marges, grappes, cut isolé, ADV avec marges, « visité 0,8 s sans action = bon », PN à contrôler en entier). Chiffres repris de G0 (`fiches/G0_APPRENTISSAGE_V1.md`), de D-134 à D-142 et de D-147 à D-155.

**Rien n'est activé.** Les règles sont **en ombre** : un événement `regles-metier-ombre` dit, à chaque cut d'un lot Orbite, la zone reconnue, la règle déclenchée et ce qu'Ariane aurait fait. La décision, la commande, la pose et les appuis sont les mêmes, octet pour octet, avec et sans l'ombre. Le chemin d'activation existe, **coupé** ; une règle activée ne peut que **différer** un cut que le lot allait valider. Seul l'opérateur l'ouvre, règle par règle.

## 1. En bref

| | Résultat |
|---|---|
| **Détection des PN sans liste** | Le PN est reconnu quand la chaussée affleure sur les **quatre quarts** autour des rails, sur **deux cuts à 3 cuts au plus**. Plage à contrôler : 4 cuts avant, 6 après. **17 PN de l'opérateur sur 17 retrouvés** (parties 12, 13, 29 et partie 1 du second projet), **0 zone reconnue sans PN**. Les plages tombent à 0 à 3 cuts près de celles de l'opérateur. Sur le second projet, `flushPct` à 30 % donnait 7 zones sans PN ; le détecteur retenu n'en donne aucune. |
| **ADV** | Aucun signal géométrique fiable. La forme qu'un ADV prend dans un lot, c'est une **grappe de différés** autour de l'aiguille. La règle `grappe-differes` s'appuie là-dessus. **Mise à jour du 17/10** : le nuage, lui, montre l'ADV (un rail de plus autour des rails posés) ; zone `adv` en ombre, 8 zones de l'opérateur sur 8, voir `fiches/DETECTION_ADV.md`. |
| **Faux verts évités** (lots 17, 24, 29 et partie 1 du second projet) | **18 sur 85** (21 %), dont les **3 poses sur la mauvaise voie** du second projet (163 à 280 mm). Ils viennent tous de `grappe-differes`. |
| **Cuts différés en plus** | **96** : 56 bons, 22 sans référence, 18 faux verts. |
| **Coût en temps de l'opérateur** | **1,7 à 5,4 minutes** pour les quatre lots, soit 6 à 18 s par faux vert évité. |
| **Écartement** | Écart à la **médiane de la partie** à plus de **15 mm** : **54 mauvais objets sur 54** (parties 12 et 13), 0 fausse alerte à 5 mm. Le seuil tient sur les six parties. Le seuil fixe de 10 mm se trompe trois fois sur quatre sur la partie 17. |
| **Verts à contrôler** (signalés, jamais posés) | Partie 29 : 256 verts signalés retrouvent **67 des 83** verts corrigés de plus de 10 mm, et **36 des 39** de 25 mm ou plus. L'opérateur avait relu 585 verts (36 min). |
| **Parties** | Toutes les parties disponibles ont servi à régler. Les parties 12 et 13 passent en apprentissage dans le manifeste : elles avaient déjà servi à G0 (D-140). **Aucune partie n'a jugé ces seuils à l'aveugle.** Les réglages sont figés (`datasets/reglages-figes.json`, `reglesMetier`, 17/10). |

## 2. Inventaire : chaque règle de l'opérateur, Ariane aujourd'hui, Ariane demain

| Règle de l'opérateur | Ce qu'Ariane fait aujourd'hui | Ce qu'elle devrait faire | Ce qui est livré (en ombre) |
|---|---|---|---|
| **Cut isolé** : contrôler le cut d'avant et celui d'après | Orbite ne passe que par les rouges ; les voisins verts ne sont jamais vus. | Signaler à l'opérateur les deux voisins verts d'un rouge isolé. | Verts `isole`. Signal faible : 8 à 26 % de ces verts sont corrigés de plus de 10 mm. |
| **Grappe** : contrôler toute la plage, sans trou | Le lot pose les rouges un par un. Les verts entre les rouges restent tels qu'ESV les a extraits. Un rouge posé au milieu de rouges différés est validé comme les autres. | Ne pas valider un cut posé au milieu de différés. Signaler les verts de la plage et de ses 3 cuts de marge. | Règle `grappe-differes` (différer). Verts `grappe` et `grappe-marge`. |
| **PN avec marges : contrôler chaque cut** | `flushPct` est relevé à chaque cut, sans effet. La lecture par l'ornière ne sert qu'en dernier recours sur un cut différé. Le lot ne connaît ni zone ni marge. Les verts d'un PN ne sont jamais vus : ce sont eux qui portent les erreurs de 30 à 40 mm (parties 12 et 13, et en partie 29 les cuts 3351, 5983, 5985, 6469 et 6475). | Reconnaître le PN et sa plage. Laisser à l'opérateur chaque cut de la plage que le lot allait valider. Lui signaler chaque vert de la plage. | Zone PN confirmée, marges 4 et 6. Règle `pn-chaque-cut` (différer). Verts `pn`. |
| **ADV avec marges** | Pas de zone. Le moteur diffère de lui-même le noyau de l'aiguille (flanc, pente, ambiguïté) et pose les cuts entre deux. | Ne pas valider entre les différés de l'aiguille. | Couvert par `grappe-differes`. La géométrie ne permet pas de reconnaître une zone d'ADV (voir 3.3). |
| **Visité 0,8 s sans action = bon** | C'est une règle de mesure, pas de pose. La jointure l'applique déjà (D-138, D-152). | — | Les étiquettes du rejeu l'appliquent. |
| **Ne pas valider en place une pose d'extraction** | Sur un rouge, Ariane recalcule toujours. Sur 1 075 cuts validés dans les quatre lots, **un seul** bouge de moins de 1 mm (partie 1 du second projet, cut 620, juste). Ce qu'Ariane « valide en place », ce sont les verts, qu'elle ne voit pas. | Refuser une validation sans mouvement dans une zone. | Règle `zone-validation-en-place` (différer) : un cas, juste. |
| **Écartement** (1 435 mm, 54 sur 54) | Garde de 20 mm contre l'écartement des appuis. Garde basse à 1 420 mm au premier passage sans appui. Rien sur les verts. | Signaler un vert dont l'écartement s'écarte de plus de 15 mm de la médiane de la partie. | Verts `ecartement`. La référence est la médiane des lignes valides de la liste d'ESV déjà vues dans le lot (20 au moins). |

**Que veut dire « contrôler chaque cut » pour une machine ?** Trois lectures ont été pesées :

1. **Recalculer la pose de chaque cut de la zone.** Ariane le fait déjà pour les rouges. Pour les verts, il faudrait les visiter et les poser : c'est poser à un nouvel endroit, ce que la consigne interdit sans l'opérateur.
2. **Refuser une validation en place.** Ariane ne le fait presque jamais sur un rouge (1 cas sur 1 075). Le vrai « en place », c'est le vert d'extraction : il est **signalé**.
3. **Différer quand le moteur n'a pas de pose sûre.** Dans un PN, rien ne dit qu'une pose est sûre. Partie 29 : 15 des 20 cuts que la règle aurait différés ont été corrigés de 5 à 10 mm par l'opérateur, aucun de plus de 10 mm. **Retenu** : dans un PN confirmé et sa marge d'après, tout cut que le lot validerait est laissé à l'opérateur. C'est la lecture stricte de « chaque cut ». Elle ne coûte presque rien, puisque l'opérateur contrôle ce PN de toute façon.

## 3. Détecter les zones sans la liste de l'opérateur

### 3.1 Le détecteur de PN retenu

- **Surface au ras, par quart.** Pour chaque rail, on prend les points visibles du côté intérieur et du côté extérieur : 9 à 45 cm du rail, ±60 cm le long de la voie. Un point est « au ras » s'il est à moins de 5 cm sous la pose de départ (même bande et mêmes points que `flushPct`). Un cut est un **cœur de PN** si :
  - au moins 200 points sont dans la bande ;
  - `flushPct` ≥ 50 ;
  - **le plus faible des quarts** (au moins 3 quarts de 30 points chacun) est à 50 % ou plus.

  Un quai, un trottoir ou une autre voie au ras **d'un seul côté** font monter `flushPct` sans remplir les quatre quarts.
- **Confirmation** : deux cœurs à 3 cuts au plus. Un cœur seul reste « non confirmé » et n'ouvre pas de zone.
  - **Depuis le 17/10 (`fiches/PN_ROBUSTE.md`)** : les deux cœurs doivent aussi être **consécutifs parmi les cuts vus**, sans cut vu sans chaussée entre eux (réglage `pn.consecutifs`, livré actif). Sur les captures du lot, rien ne change : mêmes zones, et pas une évaluation différente sur les quatre lots d'apprentissage. Sur l'union du lot et de l'Écho, le faux PN 443–456 du second projet disparaît.
- **Plage à contrôler** : 4 cuts avant le premier cœur, 6 après le dernier (marges de l'opérateur sur la partie 29 ; G0 § 4.3). Dans un lot qui avance, les 4 cuts d'avant sont déjà passés quand le PN est reconnu : ils sont seulement signalés dans la plage. Les 6 d'après sont tenus.
- Dans le lot, la surface est lue sur la capture du cut, que le lot a déjà ; elle ne coûte qu'un passage sur les points. Pour les verts, `tools/regles-metier.cjs` mode « écho » la lit sur la capture de la première visite de l'opérateur.

### 3.2 Rappel et fausses alertes, par partie

PN de l'opérateur : partie 29, 4 PN (fiche de méthode) ; partie 12, 6 PN (dont 7276–7289, D-136) ; partie 13, 6 PN (dont 6100–6115) ; partie 1 du second projet, PN 405–409 (D-142). Parties 17 et 24 : pas de liste.

| Partie | Source | PN de l'opérateur retrouvés | Zones reconnues sans PN | Cuts des plages de l'opérateur couverts | Plages reconnues (l'opérateur) |
|---|---|--:|--:|--:|---|
| 29 | lot (rouges) | **4/4** | **0** | 58/58 | 1652–1669 (1652–1667), 3342–3356 (3342–3355), 5977–5992 (5978–5992), 6466–6480 (6466–6478) |
| 29 | Écho (tous les cuts vus) | 4/4 | 0 | 57/58 | idem, à 1 cut près |
| 12 | Écho | **6/6** | **0** | 98/98 | 3944–3965 (identique), 6231–6248, 7275–7293, 7883–7901, 8379–8397, 9068–9086 |
| 13 | Écho | **6/6** | **0** | 95/95 | 123–141 (124–139), 1284–1303, 6099–6117, 6926–6943, 8055–8072, 9454–9471 |
| 1 (2ᵉ projet) | lot | **1/1** | **0** | 5/5 | 401–414 (PN 405–409) |
| 1 (2ᵉ projet) | Écho | 1/1 | 0 | 5/5 | 401–412 |
| 17 | lot | liste absente | 0 | — | un cœur seul (1028), non confirmé |
| 24 | lot | liste absente | **2 à faire confirmer** | — | 6569–6585 et 8518–8535 |

Détecteurs comparés sur les mêmes cuts (zones reconnues ; « sans PN » = aucune plage de l'opérateur touchée) :

| Partie | `flushPct` ≥ 30, un cœur | `flushPct` ≥ 50, un cœur | Quarts, un cœur | **Retenu (quarts, deux cœurs)** |
|---|---|---|---|---|
| 29 (lot) | 4 zones, 0 sans PN | 4, 0 | 4, 0 | **4, 0** |
| 1, 2ᵉ projet (lot) | 8 zones, **7 sans PN** (155 cuts) | 6, 5 (85 cuts) | 4, 3 (47 cuts) | **1, 0** (14 cuts) |
| 1, 2ᵉ projet (Écho) | 8, 7 | 8, 7 | 4, 3 | **1, 0** |
| 12 (Écho) | 7, 1 | 7, 1 | 7, 1 | **6, 0** |
| 13 (Écho) | 6, 0 | 6, 0 | 6, 0 | **6, 0** |

Les fausses alertes du second projet (388–396 et 447–450, que l'opérateur a dites « pas des PN », et 2913) ont toutes un quart nu ou un cœur seul. La « zone sans PN » de la partie 12 en un cœur, c'est 4495–4499 : l'opérateur l'a parcourue comme un PN sans la lister. **Question à l'opérateur.**

### 3.3 ADV

Aucun trait géométrique ne sépare une zone d'ADV :
- `flushPct` reste bas ;
- l'écartement de départ est normal (partie 13, ADV1 : de 1 431 à 1 441 mm) ;
- le cap ne rompt pas.

Ce qui se voit dans un lot, c'est la **grappe de différés** autour de l'aiguille, aux motifs flanc, pente et ambiguïté (partie 29 : 6633–6638 et 8002–8005), et les grosses corrections latérales de l'opérateur de −5 à +8 cuts autour de l'aiguille (D-134). La règle `grappe-differes` est la traduction retenue. Elle ne reconnaît pas l'ADV en tant que tel : elle reconnaît son noyau, et toute grappe d'invalides.

**Mise à jour du 17/10 (`fiches/DETECTION_ADV.md`).** Les traits ci-dessus sont ceux des poses. Le **nuage de points** de la capture, lui, montre l'ADV : l'aiguille, le contre-rail, le cœur ou la voie qui diverge forment un **rail de plus** autour des deux rails posés. Ce signal (`railsDePlus`) donne la zone `adv`, en ombre et sans règle : 8 zones de l'opérateur sur 8 (parties 13 et 29, partie 1 du second projet), aucune plage sans ADV, aucun PN confondu. La liste des verts à contrôler en fait entrer les verts.

## 4. Règle d'écartement

Sur tous les verts que l'opérateur a relus (écartement de la pose de départ, correction de l'opérateur) :

| Partie | Verts (> 10 mm ; ≥ 25 mm) | 1 435 ± 10 | 1 435 ± 15 | Médiane de la partie ± 10 | **Médiane de la partie ± 15** | Voisins ± 10 |
|---|---|---|---|---|---|---|
| 12 | 107 (31 ; 28) | 31 signalés : 31 / 28 / 0 | 30 : 30 / 28 / 0 | 30 : 30 / 28 / 0 | **30 : 30 / 28 / 0** | 36 : 23 / 20 / 13 |
| 13 | 223 (29 ; 26) | 30 : 29 / 26 / 1 | 27 : 27 / 26 / 0 | 29 : 29 / 26 / 0 | **27 : 27 / 26 / 0** | 31 : 20 / 18 / 9 |
| 17 | 372 (126 ; 16) | 57 : 23 / 6 / 14 | 17 : 7 / 3 / 3 | 92 : 21 / 4 / 26 | **9 : 5 / 3 / 1** | 5 : 2 / 2 / 2 |
| 24 | 96 (47 ; 8) | 14 : 9 / 1 / 1 | 3 : 3 / 0 / 0 | 4 : 3 / 0 / 1 | **0** | 1 : 1 / 0 / 0 |
| 29 | 584 (83 ; 39) | 22 : 20 / 13 / 1 | 15 : 14 / 11 / 1 | 19 : 18 / 14 / 1 | **15 : 14 / 11 / 1** | 19 : 17 / 13 / 0 |
| 1, 2ᵉ projet | 275 (35 ; 20) | 34 : 25 / 16 / 5 | 21 : 20 / 15 / 0 | 29 : 23 / 15 / 2 | **19 : 19 / 14 / 0** | 19 : 16 / 9 / 2 |

Lecture d'une case : nombre de verts signalés, puis parmi eux les corrections de plus de 10 mm, de 25 mm ou plus, et de 5 mm au plus (fausses alertes).

- **Retenu : écart à la médiane de la partie supérieur à 15 mm.**
  - 54 mauvais objets sur 54 en parties 12 et 13, aucune fausse alerte.
  - Partie 29 : 14 justes sur 15. Second projet : 19 sur 19.
  - Partie 17, qui a la plus forte dispersion (MAD 5,3 mm) : 5 justes sur 9. À 10 mm, cette partie signale 92 verts, dont 21 justes seulement : c'est le « seuil fixe qui ne se transporte pas ».
- Rapporté à la dispersion (6 × MAD), le seuil monte à 32 mm sur la partie 17 et ne signale plus rien : écarté.
- Les voisins seuls se trompent sur les parties humaines : les mauvais objets viennent par blocs de 6 à 8 cuts, et la médiane des voisins y est elle-même fausse.
- Dans le lot, la médiane vient des lignes valides de la liste d'ESV déjà vues par B1, 20 au moins. Rejeu des parties 12 et 13 : 52 mauvais objets sur 54 au seul écartement (la référence se forme sur les premières lignes). Les 2 autres sont signalés par la plage de leur PN.
- **Ce que la règle ne voit pas** : les sauts **verticaux** sur un seul rail. En partie 29, ce sont 29 des 39 gros écarts des verts (G0 § 5.2). Le dénivelé local, AUC de 0,80 à 0,90, reste une piste non codée.
- La même règle appliquée aux **poses d'Ariane** (écart à l'écartement des verts voisins) ne paie pas : à 15 mm, 22 cuts différés pour 2 faux verts sur les quatre lots. Elle n'est pas proposée.

## 5. L'ombre `regles-metier-ombre`

- **Module commun** `src/regles-metier.js`, pur : il ne commande rien et ne rend aucune position. Il est utilisé par le service worker et par l'outil de rejeu.
- **Dans Orbite**, après la décision et la commande de chaque cut, un événement `portee:'cut'` porte :
  - la zone : `pn` (`coeur`, `coeur-non-confirme`, `marge-apres`), la plage à contrôler, la grappe (différés du lot dans les 6 cuts d'avant, le plus proche) ;
  - la surface : `flushPct`, le plus faible des quarts, le cœur ;
  - le réel : étage, commande, déplacement en mm depuis la pose d'ESV, écartement de la pose ;
  - les règles déclenchées ;
  - le verdict `aurait` : `valider`, `differer`, `deja-differe` ou `sans-pose`.

  Les seuils figurent au premier événement du lot.
- **Verts** : un événement `portee:'verts'` à chaque fenêtre de la liste d'ESV que B1 lit déjà (±5 lignes). Il donne le numéro, les raisons (`ecartement`, `pn`, `grappe`, `grappe-marge`, `isole`), l'écart en mm et la référence. **Aucune demande nouvelle à la page.** Un vert est signalé une fois par raison et par lot.
- **Poids** : environ 560 octets par cut, 970 pour le premier, enveloppe du journal comprise (identifiants, horloge, lot, session : 150 à 250 octets) ; le contenu seul mesure 318 octets par cut, 730 pour le premier (seuils compris). Environ 200 Ko pour un lot de 350 cuts (1 % d'un journal de 20 Mo).
- **Preuve « ombre sans effet »** (service worker réel en VM, moteur et GCV1 réels, ESV simulé, données synthétiques) :
  - `tests/regles-metier-ombre-sw.test.cjs` compare le réglage livré à l'ombre coupée. Commandes ESV, rails, enregistrements et événements métier sont identiques ; les décisions du lot le sont **octet pour octet**. Au cut 114, l'ombre dit « différer » (`grappe-differes`) : le lot l'a quand même posé ;
  - `tests/regles-metier-panne-sw.test.cjs` : un module en panne, même avec toutes les règles activées, ne change rien. Il ne laisse qu'un événement « erreur » ;
  - `tests/regles-metier-verts-sw.test.cjs` : les verts voisins d'un rouge isolé sont signalés sans coordonnée, sans aucune demande de plus à la page ;
  - l'essai B1 (`tests/b1-sw-ombre.test.cjs`) range ce nouvel événement d'ombre avec `b1-ombre`, hors des événements métier ;
  - aucun fichier de `src/` ne lit le module, et `src/engine.js` n'est pas touché.

## 6. Le chemin d'activation (coupé)

Réglage `reglesMetier` (`src/settings.js`) : `{ ombre: true, actif: false, regles: { 'zone-validation-en-place': false, 'pn-chaque-cut': false, 'grappe-differes': false } }`.

- Pour qu'une règle agisse, il faut `actif: true` **et** cette règle à `true`.
- Elle n'agit que sur un cut que le lot allait **valider** (les deux rails résolus). La commande est remplacée par deux abstentions GCV1 (`deferRails`, motif `regles-metier`), et le moteur diffère le cut comme tout rail non résolu.
- **Jamais** une position nouvelle ; jamais un différé changé en pose. Un cut différé ne devient pas appui.
- Un cut différé par une règle ne compte pas dans la grappe suivante : pas d'avalanche.
- Essai (`tests/regles-metier-actif-sw.test.cjs`), avec `grappe-differes` seule activée : les cuts 114 et 115, que le lot posait, sont différés. Il y a 0 validation au lieu de 1, 0 pose appliquée au lieu de 2, aucun type d'appel nouveau à ESV, et les cuts 112 et 113 sont identiques.
- Les verts ne passent **jamais** par l'activation. Les faire visiter par Orbite serait une capacité nouvelle, à décider à part.

## 7. Rejeu sur toutes les parties

`tools/regles-metier.cjs` appelle le module de l'extension sur les lots réels, dans l'ordre du lot : journal, corpus (surface recalculée : `flushPct` identique au journal sur 245/245 et 351/351 cuts) et pose de départ. Le jugement vient après coup, par les étiquettes des jeux, règle des 0,8 s comprise.

### 7.1 Règles du lot (ce qu'elles auraient différé)

| Partie | Posés (avec réf.) / faux verts | Règle | Différés en plus | Faux verts évités | Bons différés (dont ≤ 5 mm) | Sans réf. | Minutes de l'opérateur |
|---|---|---|--:|--:|--:|--:|---|
| 17 | 232 (192) / 47 | `grappe-differes` | 14 | **4** (3371, 5981, 7539, 7540) | 10 (4) | 0 | 0,2 – 0,7 |
| 24 | 409 (70) / 21 | `grappe-differes` | 24 | **7** (1993, 2170, 2172, 2173, 2204, 5718, 5729) | 6 (2) | 11 | 0,4 – 1,2 |
| 24 | | `pn-chaque-cut` | 9 | 0 | 0 | 9 | 0,2 – 0,6 |
| 29 | 210 (201) / 7 | `grappe-differes` | 10 | **1** (8004) | 9 (5) | 0 | 0,2 – 0,6 |
| 29 | | `pn-chaque-cut` | 20 | 0 | 20 (5) | 0 | 0,4 – 1,4 |
| 1, 2ᵉ projet | 224 (161) / 10 | `grappe-differes` | 19 | **6** (299, 302, 315 : mauvaise voie ; 319, 405, 628) | 11 (7) | 2 | 0,3 – 0,9 |
| 1, 2ᵉ projet | | `zone-validation-en-place` | 1 | 0 | 1 (1) | 0 | 0 – 0,1 |
| **Total** | 1 075 (624) / **85** | toutes | **96** | **18** | 56 (25) | 22 | **1,7 – 5,4** |

- **Temps de l'opérateur.** Un cut juste qui devient différé lui coûte la différence entre poser et relire. Médianes de l'Écho : partie 29, différé 2,9 s contre posé juste 2,0 s ; second projet, 3,4 s contre 1,7 s. On compte donc 1,3 s, et 4,1 s pour la borne haute (écart des moyennes). Un faux vert évité ne fait gagner aucune minute si l'opérateur l'aurait trouvé de toute façon : le gain est de **qualité**, dans les cuts qu'il ne relit pas.
- **Bilan net : environ 2 à 5 minutes de l'opérateur de plus sur les quatre lots, pour 18 faux verts qu'Ariane ne valide plus.** C'est 21 % des faux verts, dont les trois poses sur la mauvaise voie. Ces trois-là, aucun autre trait ne les voyait : M6, `flushPct` et la garde de déplacement latéral ratent (D-141).
- `pn-chaque-cut` n'évite aucun faux vert à plus de 10 mm, et coûte 20 cuts justes en partie 29. Ce sont pourtant des cuts que l'opérateur contrôle de toute façon dans un PN, et 15 des 20 sont corrigés de 5 à 10 mm. Sur la partie 24, ses 9 cuts tombent dans les deux zones à confirmer.

### 7.2 Verts à contrôler (signalés seulement)

| Partie | Source | Verts signalés | Corrigés > 10 mm retrouvés | ≥ 25 mm retrouvés | ≤ 5 mm (fausses alertes) | Minutes de l'opérateur (2 s par vert) |
|---|---|--:|---|---|--:|--:|
| 17 | lot | 256 (215 relus) | 78/126 (62 %) | 12/16 | 61 | 8,5 |
| 24 | lot | 99 (77 relus) | 40/47 (85 %) | 8/8 | 21 | 3,3 |
| 29 | lot | 256 | 67/83 (81 %) | 36/39 | 103 | 8,5 |
| 1, 2ᵉ projet | lot | 126 (118 relus) | 27/35 (77 %) | 15/20 | 76 | 4,2 |
| 12 | Écho, sans lot | 100 | 31/31 (100 %) | 28/28 | 65 | 3,3 |
| 13 | Écho, sans lot | 101 | 27/29 (93 %) | 26/26 | 71 | 3,4 |

Par raison, part des verts signalés corrigés de plus de 10 mm :

| Raison | 17 | 24 | 29 | 1, 2ᵉ projet | 12 | 13 |
|---|---|---|---|---|---|---|
| `ecartement` | 5/7 | — | 13/14 | 14/14 | 29/29 | 26/26 |
| `grappe` (entre les rouges) | 14/49 | 30/39 | 25/49 | 14/29 | — | — |
| `grappe-marge` (3 cuts autour) | 45/103 | 25/35 | 40/80 | 19/99 | — | — |
| `pn` | — | — | 11/32 | 2/2 | 30/99 | 21/95 |
| `isole` | 18/68 | 2/27 | 11/139 | 1/8 | — | — |

- **Lecture.** Sur la partie 29, l'opérateur a relu 585 verts en 36 minutes. La liste en propose 256 (environ 8,5 minutes) et garde 81 % des verts corrigés de plus de 10 mm, et 36 des 39 gros écarts. Sur le second projet : 413 verts en 23 minutes, contre une liste de 126 qui garde 77 % des erreurs. Ce n'est un gain que si l'opérateur accepte de relire d'après la liste. **À décider.**
- Le signal `isole` est faible (8 % sur la partie 29). La règle de l'opérateur reste consignée, mais sans valeur de tri.
- Les verts que l'opérateur n'a pas relus manquent au rejeu : la précision réelle d'une liste sur une partie entière n'est pas mesurée. C'est le biais déjà noté en D-134.

### 7.3 Apprentissage et parties réservées

**Toutes les parties disponibles ont servi** :
- 17, 24, 29 et la partie 1 du second projet étaient déjà en apprentissage ;
- 12 et 13 avaient servi à G0 (D-140) ; elles passent en apprentissage dans `datasets/manifeste-parties.json`.

**Aucun chiffre de cette fiche n'est donc un jugement à l'aveugle.** Les seuils sont figés le 17/10 dans `datasets/reglages-figes.json` (`reglesMetier`), et un essai vérifie qu'ils concordent avec le module et le réglage livré. Le jugement viendra des parties suivantes, en ombre.

Les seuils choisis **après avoir vu** ces parties :
- la confirmation par deux cœurs, choisie après les fausses alertes du second projet ;
- la grappe : 2 différés dans les 6 cuts, dont un à 2 cuts au plus (dans l'exploration sur les jeux, un voisinage de 3 cuts donnait 28 différés pour 10 faux verts ; 6 cuts en donnent 67 pour 18 au rejeu) ;
- le seuil de 15 mm.

Les marges de 4 et 6 cuts viennent de la partie 29 seule ; elles reproduisent les plages des parties 12 et 13 à 0 à 3 cuts près.

## 8. Ce que l'opérateur doit décider

1. **`grappe-differes` (proposée en premier)** : l'activer après une ou deux parties neuves en ombre ? Porte proposée, dans l'esprit de D-155 : en ombre, au moins **un faux vert évité pour trois cuts justes différés**, et pas plus de **2 minutes de l'opérateur par partie**. Sur les quatre lots, la règle seule diffère 67 cuts : 18 faux verts, 36 justes et 13 sans référence (environ 1 pour 2), pour 1,1 à 3,4 minutes au total.
2. **`pn-chaque-cut`** : la lecture stricte de « contrôler chaque cut » te convient-elle, c'est-à-dire laisser tous les cuts du PN et des 6 suivants, même ceux qu'Ariane pose à 5–10 mm ? Ou préfères-tu qu'Ariane pose dans le PN, et seulement te signaler la plage ?
3. **`zone-validation-en-place`** : presque sans objet (1 cas). L'activer ne coûte rien.
4. **Verts à contrôler** : veux-tu une liste dans le panneau, triée par raison (écartement d'abord, puis grappe, PN, marge, isolé) ? Veux-tu que la visite des verts devienne un mode d'Orbite ? Ce serait une capacité nouvelle : se rendre sur un vert, le poser ou le différer. Elle n'est pas codée.
5. **Zones à confirmer** :
   - partie 24, 6569–6585 et 8518–8535 : sont-ce des PN ?
   - partie 12, 4495–4499 : est-ce un PN ? Un PN dont le lot ne voit qu'**un** cœur rouge n'est pas confirmé : c'est la limite du détecteur.
   - partie 29, plages 267–312, 3473–3565 et 6558–6571 (D-134) : les corrections y sont verticales, et aucune règle ne les voit.
6. **Seuil de 15 mm** pour l'écartement, et médiane de la partie comme référence : d'accord ?

## 9. Limites et doutes

- **Petits effectifs et aucune partie à l'aveugle.** 85 faux verts dans quatre lots ; 17 PN dans quatre parties, un seul sur le second projet. Les seuils ont été choisis sur ces parties.
- **Effet du premier ordre.** Une règle activée retire un appui : les décisions suivantes du lot pourraient changer (reprise depuis la voie, garde d'écartement). Le rejeu ne les recalcule pas. L'ombre de terrain les verra, puisque ses appuis sont les appuis réels.
- **Concordance ombre et rejeu.** Même module, même surface (vérifiée sur 596 cuts). Mais aucun lot réel n'a encore porté l'ombre. Le déplacement vient de la pose attendue dans l'extension et de la pose validée dans le rejeu : elles diffèrent de 1 mm au plus, ce qui ne compte que pour `zone-validation-en-place`.
- **Verts** : seuls ceux que l'opérateur a relus ont un écartement connu hors ligne. Dans le lot, B1 ne lit que ±5 lignes autour des rouges : un vert à plus de 5 cuts de tout rouge n'est jamais vu, alors que 94 % des verts faux sont à 3 cuts ou moins d'un rouge (partie 29).
- **Captures de l'Écho** (parties 12 et 13) : la surface est lue sur les points visibles, ou sur tous les points quand il y en a moins de 200 dans la bande. 82 cuts sur 108 et 154 sur 224 ont une capture utile.
- **Temps de l'opérateur** : médianes de deux Échos seulement ; les durées de visite ne sont pas des durées de regard.
- Un PN où l'extraction a réussi (peu de rouges) est vu tard ou pas du tout par Orbite : la zone n'existe qu'autour des rouges.

## 10. Rejouer

```
node tools/regles-metier.cjs essai
node tools/regles-metier.cjs lot --partie 1:29 --journal J.json --corpus SEG01.json [--corpus …] --jeu jeu-p29.jsonl \
     --pn 1652-1667,3342-3355,5978-5992,6466-6478 --sortie lot-p29.json
node tools/regles-metier.cjs echo --partie 1:12 --echo "dossier des volumes de l'Écho" --jeu jeu-p12.jsonl \
     --pn 3944-3965,6232-6246,7885-7899,8380-8394,9070-9086,7276-7289 --sortie echo-p12.json
node tools/regles-metier.cjs rapport lot-p17.json lot-p24.json lot-p29.json lot-p1.json echo-p12.json echo-p13.json
```

Les entrées (journaux, corpus, Échos, jeux) restent hors dépôt. Les sorties ne contiennent que des comptes, des millimètres et des numéros de cut. Essais : `tests/regles-metier.test.cjs` (module), `tests/regles-metier-outil.test.cjs` (outil, fixture synthétique), et les quatre essais du service worker cités en § 5 et § 6.
