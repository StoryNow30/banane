# P7 : graine d'écartement sur pose fictive (5.0, 17 octobre 2026)

Branche `claude/50-p7-graine-ecartement-fictive`, partie de `claude/50-base` (d8a7bcd).

Contexte :
- le cap de Mic (D-170) : Ariane fait seule la relecture qu'il fait en Écho, et **pose elle-même** les cuts qu'elle lui laisse aujourd'hui ;
- l'hypothèse testée est **H2** du catalogue des échecs (ADV, abords, grappes), qui suit la fiche `RELECTURE_AUTONOME.md`.

La consigne donnait ba3947b pour la base ; la tête de `origin/claude/50-base` est d8a7bcd. Ce qui a changé entre les deux ne touche pas l'étude : sur d8a7bcd, `etudier` rend **le même fichier, octet pour octet**, que l'étude publiée (§ 2.3).

`src/engine.js` n'est pas touché. Seules les **parties d'apprentissage** sont lues : 1:12, 1:13, 1:17, 1:24, 1:29 et 2:1. Aucune partie réservée n'a été ouverte, et le mode `juger` n'a pas été lancé.

Conventions :
- **[FAIT]** : mesuré ; le chiffre est donné avec sa commande (§ 7) ;
- **[HYP]** : hypothèse, plausible mais non démontrée ;
- **[NON MESURÉ]** : ces données ne permettent pas de le mesurer.

Les définitions sont celles de la fiche `RELECTURE_AUTONOME.md` :
- **juste** : Mic corrige de plus de 10 mm, et Ariane arrive à 10 mm de lui ;
- **erreur** : Ariane agit et reste à plus de 10 mm de Mic ;
- **abîmé** : Mic est à 10 mm au plus, et Ariane met le cut au-delà ;
- **mauvaise voie** : Ariane agit à plus de 50 mm de Mic ;
- **abstention** : la décision d'Ariane diffère.

## 1. En bref

| Question | Réponse |
|---|---|
| **Hypothèse** | Sur un cut que la chaîne diffère et dont la pose de départ est **fictive** (1 500 mm, gabarit par défaut d'ESV), si le moteur trouve un rail, l'autre est replacé à l'écartement des voisins et le **moteur livré est relancé** depuis cette graine. La paire est gardée si les deux rails sont candidats, l'écartement dans le contrat et à 20 mm au plus de la référence ; deux graines doivent s'accorder à 10 mm. Ces poses ne deviennent jamais des appuis. |
| **Correctif** | Module pur `src/graine-ecartement-fictive.js`, coupé par défaut. Il est branché dans le rejeu de la relecture (`extraire`) et dans l'étude (`etudier`) par l'option `--graine-ecartement-fictive`. |
| **Résultat** (règle de service, validation croisée, 6 parties) [FAIT] | **+12 corrections justes, +1 erreur, 0 cut abîmé de plus, 0 mauvaise voie**, 13 abstentions de moins. Total : 79 → **91** justes ; 97 → 110 actions ; abîmés 6 → 6. |
| **Par zone** [FAIT] | **ADV : 11 → 18 justes** (0 erreur de plus). **Abords : 30 → 35** (+1 erreur). **Grappes : 35 → 46**. **PN : inchangée**, 36 justes sur 36 actions sur les verts. Verts hors zone : inchangés. |
| **Par partie** [FAIT] | 2:1 : +7 justes. 1:24 : +4. 1:29 : +1. 1:17 : +1 erreur (cut 5793, 13,4 mm, surtout vertical). 1:12 et 1:13 : rien (pas de lot, aucune pose fictive). |
| **Critère de réussite** | **Tenu** sur les parties d'apprentissage : 0 mauvaise voie ; plus de justes nettes en ADV (+7), abords (+5) et grappes (+11) ; aucun cut abîmé de plus ; PN à 36 sur 36. |
| **Ce qui tempère** | Le gain est **petit** (13 actions) et **mesuré sur les parties qui ont servi à concevoir l'hypothèse** (§ 5). La graine ne pose que **13 des 83 cuts** recalculés : dans 42 cas, le moteur relancé ne trouve pas l'autre rail (hors de la capture, ou flanc non vu), et dans 27 il n'a trouvé aucun rail. 4 poses déplacent un rail de 193 à 215 mm en travers, au bord de la vue d'ESV. |
| **Garde « pose fictive »** | Les 6 cuts que le catalogue range parmi les mauvaises voies possibles (1:29, 6570 ; 2:1, 303, 380, 568, 569, 572) ont une pose de départ **non fictive** (1 412 à 1 449 mm) : la graine n'y est **jamais tentée**. [FAIT] |

## 2. Correctif, branchement et contrôles

### 2.1 Le module

`src/graine-ecartement-fictive.js` est un post-traitement **pur** : pas d'horloge, pas de réglage global, pas d'écriture, entrées non modifiées. Il est **coupé par défaut** : l'appel doit passer `options.actif === true`.

`reprendre({ decision, capture, science, poses, gPartie, Shadow, options })` :
1. **Conditions.** Rien si le module est coupé, si la chaîne pose déjà, ou si la pose de départ n'est **pas fictive** (écartement de 1 500 mm à 0,5 mm près). Dans ces trois cas, la tentative est nulle et le moteur n'est pas relancé.
2. **Écartement de référence.** Médiane des poses actuelles des voisins sûrs, à ±5 cuts, de la même partie et du même repère :
   - jamais le cut lui-même ;
   - jamais un cut différé par le lot ;
   - jamais une pose fictive ;
   - jamais une pose de Mic : l'appelant passe les poses **actuelles**, celles qu'ESV montre avant tout geste.
   Sans voisin sûr, on prend la médiane de la partie (poses actuelles hors lot). Sans l'une ni l'autre : motif `sans-reference`.
3. **Graines.** Pour chaque rail que le moteur a trouvé (`candidate`) au premier passage :
   - l'autre rail est translaté à l'écartement de référence, dans la direction de sa pose de départ (`translated` de l'observateur livré) ;
   - le moteur livré est relancé sur la même capture (`minimalCapture`, `scientificProposeBoth`) ;
   - la paire est gardée si l'autre rail est `candidate`, si l'écartement est dans le contrat (`gauge.js`) et s'il est à **20 mm** au plus de la référence.
4. **Accord.** Si les deux rails donnent une paire, elles doivent s'accorder à **10 mm** près sur chaque rail (motif `graines-en-desaccord` sinon) ; la paire de la première graine est rendue.
5. **Résultat.** Étape `graine-ecartement`, `anchor: false` : la pose ne sert jamais d'appui, et une graine fausse ne se propage pas. Elle ne reçoit pas de hauteur apprise (l'étage est hors du domaine du modèle de hauteur).
6. **Panne.** Une panne du moteur annule la graine concernée ; la décision de la chaîne est alors rendue telle quelle.

Le moteur décide ; l'écartement sert de **graine** et de **garde**, jamais de pose.

### 2.2 Branchement

Par l'option `--graine-ecartement-fictive` de `tools/relecture-autonome.cjs` :
- **`extraire`** (le rejeu de la relecture, en chaîne) :
  - les poses actuelles sont les poses de départ de la première visite de chaque cut, avant tout geste de Mic ;
  - les cuts différés par le lot viennent de la table de la partie (`--table`) ;
  - la graine va dans `chaineGraine` : la pose, l'écartement de référence et sa source, les rails trouvés, et pour chaque graine la garde qui l'a arrêtée ;
  - avec `--greffer ANCIEN.jsonl`, les cas d'une extraction antérieure sont gardés. La graine n'y est reportée que si la chaîne nouvelle rend la même décision : même étape, poses à 0,5 mm près.
- **`etudier`** :
  - **la variante en chaîne** d'un cut différé par le lot prend la pose de la graine ;
  - **la grille** de la règle prudente gagne un seul choix, `differes: 'graine'` : agir sur un différé seulement s'il vient de la graine, et alors sans les seuils des verts. Ce choix est réglé en validation croisée, comme le reste ;
  - **la règle de service** (variante sobre) reste celle des verts : les différés posés par la graine ne dépendent pas du seuil X et ne comptent pas dans les 90 % gardés ;
  - **les tables ajoutées** donnent, par partie et par type de zone, les résultats tous genres, plus « en grappe » et « différés du lot ».

Rien n'est activé dans l'extension : la base ne contient pas de passe de relecture qui agisse (`src/relecture-critere.js` est sur une autre branche).

### 2.3 Contrôles [FAIT]

- **Base.** L'outil livré sur d8a7bcd (`etudier`, cas de l'étude) rend un `etude.json` identique, octet pour octet, à l'étude publiée (`zones/etude.json`).
- **Non-régression.** L'outil modifié **sans l'option**, sur les cas greffés, rend la même étude que l'outil livré : les champs communs sont identiques (`p7g/controle.cjs`), et les 60 premières lignes du texte aussi. Seules s'ajoutent les nouvelles tables.
- **Greffe** :

  | Partie | Chaînes identiques à l'ancienne extraction | Cuts visés (différé du lot, départ fictif, chaîne qui diffère) | Greffés |
  |---|--:|--:|--:|
  | 1:24 | 40 / 40 | 9 | 9 |
  | 2:1 | 465 / 465 | 55 | 55 |
  | 1:29 | 582 / 582 | 16 | 16 |
  | 1:17 | 199 / 200 | 6 | **3** |

  En 1:17, **3 cuts visés manquent** : le dossier d'Écho d'origine n'est plus sur le disque (même limite que le catalogue). Ils restent des abstentions avec l'option.
- **Poses fictives** : dans les cas des six parties, toutes les poses de départ fictives sont sur des cuts **différés par le lot**. Aucun vert ni aucun cut posé n'en a. 1:12 et 1:13 n'en ont aucune.
- **Médiane de la partie** : celle de l'extraction (sur tous les cuts visités) et celle de l'étude (sur les cas calculés) diffèrent de 0,3 mm (2:1 : 1 436,4 contre 1 436,15 ; 1:24 : 1 439,2 contre 1 439,5). Une seule pose s'en sert (2:1, cut 420).
- **Essais** :
  - `tests/graine-ecartement-fictive.test.cjs` (9 essais, monde synthétique : le moteur ne voit un rail que dans sa fenêtre de ±80 mm) ;
  - `tests/relecture-autonome-graine.test.cjs` (10 essais, dont 2 avec le vrai moteur sur le cut de corpus des essais) ;
  - avec `tests/relecture-autonome.test.cjs` : 28 essais, 28 passent ;
  - **avant le correctif, les essais étaient rouges** : le fichier du module échouait en entier (module absent), puis 8 essais sur 10 de l'outil échouaient (les 2 qui passaient vérifient que rien ne change option coupée ou garde fictive) ;
  - essais qui parcourent `src/` (paquet, cœur, hauteur apprise, faux verts, garde de paire, cohérence des voisins, valides de la décision) : 47 essais, 46 passent, 1 sauté. Le verify complet n'a pas été lancé.

## 3. Résultats (règle de service, validation croisée)

Chaque partie est jugée avec la règle apprise sur les cinq autres. Dans **les 6 plis**, la règle apprise choisit `differes: 'graine'` ; ses autres réglages sont ceux de la référence (X 8 / 8 / 10 / 8 / 10 / 8 ; G 15 / 15 / 10 / 15 / 100 / 15). Le seul paramètre réglé est donc ce choix ; les seuils de 20 et 10 mm sont ceux de l'hypothèse, **non réglés**.

Cellules : **actions / justes / erreurs / abîmés / mauvaises voies / abstentions**.

### 3.1 Par partie et type de zone, tous genres [FAIT]

| Partie | Zone | Visités | Mic > 10 mm | Référence | Avec l'option | Δ justes | Δ abîmés |
|---|---|--:|--:|---|---|--:|--:|
| 1:12 | pn | 72 | 23 | 20 / 20 / 0 / 0 / 0 / 6 | identique | 0 | 0 |
| 1:12 | vert hors zone | 1 | 1 | 1 / 1 / 0 / 0 / 0 / 0 | identique | 0 | 0 |
| 1:13 | pn | 67 | 15 | 9 / 9 / 0 / 0 / 0 / 15 | identique | 0 | 0 |
| 1:13 | adv | 72 | 6 | 8 / 3 / 3 / 1 / 0 / 15 | identique | 0 | 0 |
| 1:17 | adv | 39 | 7 | 1 / 1 / 0 / 0 / 0 / 27 | identique | 0 | 0 |
| 1:17 | abords | 236 | 47 | 7 / 2 / 3 / 2 / 0 / 123 | 8 / 2 / 4 / 2 / 0 / 122 | 0 | 0 |
| 1:17 | vert hors zone | 15 | 5 | 0 / 0 / 0 / 0 / 0 / 11 | identique | 0 | 0 |
| 1:17 | en grappe | 162 | 34 | 5 / 1 / 3 / 2 / 0 / 96 | identique | 0 | 0 |
| 1:24 | abords (en grappe) | 30 | 24 | 4 / 1 / 2 / 0 / 0 / 15 | 8 / 5 / 2 / 0 / 0 / 11 | **+4** | 0 |
| 1:29 | pn | 47 | 12 | 8 / 7 / 1 / 1 / 0 / 8 | identique | 0 | 0 |
| 1:29 | adv | 90 | 15 | 2 / 2 / 0 / 0 / 0 / 37 | identique | 0 | 0 |
| 1:29 | abords | 342 | 58 | 30 / 27 / 3 / 2 / 0 / 80 | 31 / 28 / 3 / 2 / 0 / 79 | **+1** | 0 |
| 1:29 | vert hors zone | 6 | 3 | 1 / 1 / 0 / 0 / 0 / 4 | identique | 0 | 0 |
| 1:29 | en grappe | 199 | 61 | 32 / 31 / 1 / 1 / 0 / 65 | identique | 0 | 0 |
| 2:1 | pn | 10 | 10 | 0 / 0 / 0 / 0 / 0 / 8 | identique | 0 | 0 |
| 2:1 | adv | 412 | 125 | 6 / 5 / 0 / 0 / 0 / 231 | 13 / 12 / 0 / 0 / 0 / 224 | **+7** | 0 |
| 2:1 | abords | 6 | 0 | 0 / 0 / 0 / 0 / 0 / 2 | identique | 0 | 0 |
| 2:1 | en grappe | 301 | 124 | 2 / 2 / 0 / 0 / 0 / 190 | 9 / 9 / 0 / 0 / 0 / 183 | **+7** | 0 |
| **total** | **pn** | 196 | 60 | 37 / 36 / 1 / 1 / 0 / 37 | identique | 0 | 0 |
| **total** | **adv** | 613 | 153 | 17 / 11 / 3 / 1 / 0 / 310 | 24 / 18 / 3 / 1 / 0 / 303 | **+7** | 0 |
| **total** | **abords** | 614 | 129 | 41 / 30 / 8 / 4 / 0 / 220 | 47 / 35 / 9 / 4 / 0 / 214 | **+5** | 0 |
| **total** | **vert hors zone** | 22 | 9 | 2 / 2 / 0 / 0 / 0 / 15 | identique | 0 | 0 |
| **total** | **en grappe** | 692 | 243 | 43 / 35 / 6 / 3 / 0 / 366 | 54 / 46 / 6 / 3 / 0 / 355 | **+11** | 0 |
| **total** | **différés du lot** | 158 | 151 | 0 / 0 / 0 / 0 / 0 / 129 | 13 / 12 / 1 / 0 / 0 / 116 | **+12** | 0 |
| **total** | **tout** | **1 445** | 351 | 97 / 79 / 12 / 6 / 0 / 582 | **110 / 91 / 13 / 6 / 0 / 569** | **+12** | **0** |

Lecture :
- « vert hors zone » est le type `liste` de l'outil (liste « À contrôler ») ;
- la ligne « pn » tous genres compte 37 actions : la 37ᵉ est un cut posé par le lot en 1:29 (le pli 1:29 permet les cuts posés), comme dans la référence ;
- **sur les verts seuls**, rien ne change : PN 36 / 36 / 0 / 0 / 0, ADV 17 / 11 / 3 / 1 / 0, abords 37 / 30 / 5 / 1 / 0, vert hors zone 2 / 2 / 0 / 0 / 0 ;
- l'erreur parmi les actions de la règle de service passe de 12 / 97 (12,4 % ; Wilson ≤ 20,4 %) à 13 / 110 (11,8 % ; ≤ 19,2 %).

### 3.2 Autres lectures [FAIT]

| Lecture | Référence | Avec l'option |
|---|---|---|
| Règle de la procédure (X appris, validation croisée) : actions / justes / erreurs / abîmés / mauvaises voies | 312 / 84 / 23 / 8 / 0 | 325 / 96 / 24 / 8 / 0 |
| Chiffre central, en chaîne + hauteur, sans règle : reproduites à 10 mm parmi les corrections > 10 mm | 122 sur 351 | **134 sur 351** |
| Chiffre central : abîmés / mauvaises voies / abstentions | 9 / 0 / 582 | 9 / 0 / 569 |

### 3.3 Les 13 poses, cut par cut [FAIT]

Toutes ont une référence de Mic, et toutes sont dans une zone de la sélection. Colonnes :
- **Réf.** : écartement de référence (mm) et sa source ;
- **Trouvé** : rail(s) que le moteur a trouvés au premier passage ;
- **Écart.** : écartement de la paire posée ;
- **Mic** : correction de Mic (mm) ;
- **Écart** : pose de la graine moins Mic (mm, pire rail, 3D), puis latéral / vertical de ce rail ;
- **Travers** : rail le plus déplacé en travers depuis la pose actuelle (mm).

| Partie | Cut | Zone | Réf. | Trouvé | Écart. | Mic | Écart | lat. / vert. | Travers | Issue |
|---|--:|---|---|---|--:|--:|--:|---|--:|---|
| 1:17 | 5793 | abords | 1 438,7 (5 voisins) | gauche | 1 433,9 | 121,1 | 13,4 | 1,7 / 13,3 | 119 | **erreur** |
| 1:24 | 5713 | abords, grappe | 1 442,4 (4 voisins) | gauche | 1 444,7 | 92,7 | 2,5 | 1,0 / −2,3 | 94 | juste |
| 1:24 | 5715 | abords, grappe | 1 444,9 (6 voisins) | les deux | 1 445,5 | 102,7 | 5,6 | 2,6 / 5,0 | 100 | juste |
| 1:24 | 5716 | abords, grappe | 1 444,4 (7 voisins) | les deux | 1 449,9 | 106,2 | 8,3 | 2,9 / 7,8 | 99 | juste |
| 1:24 | 5727 | abords, grappe | 1 441,1 (7 voisins) | les deux | 1 448,6 | 100,4 | 8,3 | 5,2 / 6,5 | 98 | juste |
| 1:29 | 1681 | abords | 1 435,9 (2 voisins) | gauche | 1 438,3 | 62,3 | 8,7 | 0,2 / 8,7 | 62 | juste |
| 2:1 | 296 | ADV, grappe | 1 439,5 (3 voisins) | gauche | 1 456,5 | 137,3 | 4,4 | −2,7 / 3,4 | 137 | juste |
| 2:1 | 356 | ADV, grappe | 1 445,1 (10 voisins) | les deux | 1 456,2 | 73,2 | 9,1 | −8,4 / 3,5 | 65 | juste |
| 2:1 | 374 | ADV, grappe | 1 443,3 (1 voisin) | gauche | 1 444,6 | 194,4 | 5,3 | −1,9 / −5,0 | 193 | juste |
| 2:1 | 400 | ADV, grappe | 1 447,2 (2 voisins) | gauche | 1 446,4 | 196,9 | 0,8 | −0,5 / −0,7 | 195 | juste |
| 2:1 | 420 | ADV, grappe | 1 436,4 (partie) | gauche | 1 444,0 | 196,0 | 1,7 | 1,7 / 0,4 | 196 | juste |
| 2:1 | 454 | ADV, grappe | 1 460,7 (1 voisin) | gauche | 1 446,9 | 212,8 | 3,5 | 3,0 / −1,9 | 215 | juste |
| 2:1 | 3010 | ADV, grappe | 1 433,8 (8 voisins) | droit | 1 431,4 | 37,4 | 2,7 | 0,9 / 2,6 | 34 | juste |

Ce sont les cuts du banc du catalogue pour H2 : +12 justes, +1 erreur (1:17, 5793), 0 abîmé. Les exemples de l'hypothèse (2:1, cuts 374, 400, 420, 454) tombent à **0,8 à 5,3 mm** de Mic, comme annoncé.

- **L'erreur** (1:17, cut 5793) est **verticale** : 13,3 mm sur le rail le plus faux, 1,7 mm en latéral. Elle réduit l'écart à Mic de 121 à 13 mm. C'est un « faux qui reste », pas un cut abîmé.
- **Par mécanisme du catalogue** : 10 poses sur des cuts « hors de portée » (9 justes, 1 erreur) et 3 sur des « poses de départ fausses » (2:1, 356 et 3010 ; 1:29, 1681).

### 3.4 Pourquoi la graine ne pose que 13 fois sur 83 [FAIT]

| Partie | Visés | Tentés | Posés | Aucun rail trouvé | Autre rail non candidat après relance | Paire loin de la référence |
|---|--:|--:|--:|--:|--:|--:|
| 1:17 | 6 | 3 | 1 | 1 | 1 | 0 |
| 1:24 | 9 | 9 | 4 | 1 | 4 | 0 |
| 1:29 | 16 | 16 | 1 | 3 | 11 | 1 (cut 6637, deux graines à 1 465–1 467 mm pour 1 436) |
| 2:1 | 55 | 55 | 7 | 22 | 26 | 0 |
| **total** | **86** | **83** | **13** | **27** | **42** | **1** |

- **[FAIT]** Le verrou est **la capture** : dans 42 cas, le moteur relancé au bon endroit ne trouve pas l'autre rail. 2:1 est la zone d'ADV « bordélique » ; le catalogue y relève le rail lointain hors de la boîte capturée dans 52 captures sur 85.
- **[FAIT]** En 1:29 (ADV1, cuts 6560 à 6638 ; ADV2, 8002 à 8005), la graine échoue partout : le rail replacé reste non candidat. Le catalogue y voit un contre-rail ou une aiguille, et un flanc côté voie non vu.
- **[FAIT]** Aucune graine n'est refusée pour un désaccord entre deux graines, ni pour un écartement hors contrat. Les 3 cuts où les deux rails donnent une paire (1:24, 5715 et 5716 ; 2:1, 356) s'accordent à 0,2–5,9 mm.
- **[HYP]** Ce qui reste demande une **capture recentrée** sur la pose provisoire (H4 du catalogue), que les Échos ne contiennent pas.

### 3.5 Les cuts à risque du catalogue [FAIT]

Sans la garde « pose fictive », le banc du catalogue relevait 4 mauvaises voies (1:29, cut 6570 ; 2:1, cuts 380, 568, 572). La fiche de la relecture en relevait 4 sur la pose seule (2:1, 303, 568, 569, 572). Leur pose de départ :

| Partie | Cut | Pose de départ | Chaîne | Graine |
|---|--:|--:|---|---|
| 1:29 | 6570 | 1 448,7 mm | diffère | non tentée |
| 2:1 | 303 | 1 431,8 mm | pose (`window`) | non tentée |
| 2:1 | 380 | 1 412,3 mm | diffère | non tentée |
| 2:1 | 568 | 1 437,2 mm | diffère | non tentée |
| 2:1 | 569 | 1 433,2 mm | pose (`window`) | non tentée |
| 2:1 | 572 | 1 420,5 mm | diffère | non tentée |

La garde « pose fictive » écarte ces cuts. Elle est donc nécessaire. **[NON MESURÉ ici]** Je n'ai pas refait la mesure sans elle : le chiffre de 4 mauvaises voies vient du banc du catalogue.

## 4. Critère de réussite

| Critère | Mesure | Tenu |
|---|---|---|
| 0 mauvaise voie | 0 en validation croisée, dans chaque partie et dans chaque zone | oui |
| Plus de corrections justes nettes en ADV, abords ou grappes | ADV +7, abords +5, grappes +11 ; abîmés +0 | oui |
| Cuts abîmés : pas plus de +0,2 % des visités (+2,9 cuts sur 1 445) | +0 | oui |
| Aucune régression sur la PN (36 sur 36) | verts de PN : 36 / 36, 0 erreur, 0 abîmé ; PN tous genres identique | oui |

## 5. Ce qui tempère le résultat

- **[FAIT] Petits nombres.** 13 actions de plus, dont 12 justes et 1 erreur (7,7 % ; Wilson de 1,4 à 33 %).
- **[FAIT] Justes limites.** 4 justes sont entre 8,3 et 9,1 mm de Mic (1:24, 5716 et 5727 ; 1:29, 1681 ; 2:1, 356). Le bruit de la référence est de 2 à 4 mm par axe : ces cas ne sont pas francs. Pour trois d'entre eux, l'écart est surtout vertical.
- **[HYP] Hauteur.** La graine ne reçoit pas de hauteur apprise : son étage est hors du domaine du modèle. L'erreur de 5793 et les justes limites sont surtout verticaux. Une hauteur adaptée à la graine pourrait les resserrer. Non mesuré.
- **[HYP] Biais de conception.** L'hypothèse, ses seuils (20 et 10 mm) et sa garde « pose fictive » ont été choisis par le catalogue **après lecture du banc, sur ces mêmes parties**. La validation croisée par partie ne règle ici que le choix `differes` (activer ou non), et le même choix sort dans les 6 plis. Elle n'efface pas ce biais. Il faut un jugement sur des parties neuves, qui n'est pas fait ici.
- **[FAIT, cut synthétique] Rail trouvé à tort.** Sur le cut de corpus des essais, avec une pose de départ fictive décalée de 150 mm, le moteur rend un faux rail `candidate` au premier passage, et la graine trouve un second faux rail à l'écartement (1 437,8 mm) : la paire tombe à **138 et 140 mm** de la voie vraie (`p7g/exp-fixture.cjs`). Dans les données, aucune des 13 poses n'est dans ce cas. La garde « deux graines d'accord » ne joue que si les deux rails donnent une graine. C'est le risque principal de cette hypothèse.
- **[NON MESURÉ] Vue d'ESV.** 2:1, cut 454 : un rail déplacé de **215 mm** en travers. Les cuts 374, 400 et 420 sont à 193–196 mm. Au-delà d'environ 200 mm, la cible sort de la vue d'ESV (D-156 ; « déplacer la vue » est coupé). On ne sait pas si ces clics sont faisables aujourd'hui.
- **[NON MESURÉ] 1:17.** 3 cuts visés sur 6 n'ont pas pu être recalculés : la source d'Écho est absente du disque.
- **[NON MESURÉ] Ordre et voisins.** Le rejeu suit l'ordre de visite de Mic, comme dans la fiche et le catalogue. Les poses actuelles connues sont celles des cuts que Mic a visités ; en service, Ariane connaîtrait aussi les autres. La référence vient d'un seul voisin dans 2 poses (374, 454) et de la partie dans une (420).
- **[FAIT] D-033.** L'écartement sert ici de graine et de garde, jamais de pose : le moteur relancé décide. C'est tout de même au bord de l'invariant D-033 et du § 3.6 du cahier 4.8. **Il faut l'accord de Mic et de la direction** avant toute activation.

**Verdict** : **gain**, au sens du critère fixé, sur les parties d'apprentissage. Il est modeste : +12 corrections justes sur 351 corrections de Mic de plus de 10 mm, presque toutes en 2:1 et 1:24. Il reste à juger sur des parties neuves avant toute activation. Rien n'est activé : l'option est coupée par défaut et aucun réglage livré ne change.

## 6. Fichiers

Dans le dépôt :
- `src/graine-ecartement-fictive.js` : le module ;
- `tools/relecture-autonome.cjs` : l'option `--graine-ecartement-fictive` (`extraire`, `etudier`, `juger`), `--greffer`, les tables par partie et par type de zone, et la règle sobre limitée aux verts sous l'option ;
- `tests/graine-ecartement-fictive.test.cjs` et `tests/relecture-autonome-graine.test.cjs` : les essais.

Hors dépôt, dans le dossier de travail `p7g/` : numéros de cut, mm et comptes seulement.

| Fichier | Contenu |
|---|---|
| `extraire.sh`, `extraire-24.log`, `extraire-reste.log` | extraction avec l'option, greffée sur `zones/cas` |
| `cas/` | cas greffés de 1:17, 1:24, 1:29 et 2:1 |
| `tmpc/` | les six parties, en liens vers les cas (1:12 et 1:13 : ceux de l'étude) |
| `mesurer.sh` | lancement de l'étude, même commande avec ou sans l'option |
| `mesures/base-b50.*` | outil livré sur les cas de l'étude (contrôle) |
| `mesures/ref.*`, `mesures/graine.*` | référence et option |
| `controle.cjs` | non-régression (champs communs) |
| `comparer.cjs` | tableau du § 3.1 |
| `poses.cjs`, `graines.cjs` | §§ 3.3 à 3.5 |
| `exp-fixture.cjs` | essai du cut de corpus (§ 5) |
| `essais-rouges.txt` | les essais avant le correctif de l'outil |

## 7. Rejouer

`$S` désigne le dossier de travail. Pour chaque partie P, les arguments sont `--partie P --cas $S/p7g/tmpc/cas-P.jsonl --table $S/adv/tables/t-P.json --skip $S/zones/skip/skip-P.jsonl`.

```
# extraction avec l'option, greffée (≈ 15 min, sous le verrou des calculs lourds)
p7g/extraire.sh 24 21 29 17
# référence et option, même commande (≈ 4 et 7 min)
p7g/mesurer.sh tools/relecture-autonome.cjs $S/p7g/tmpc p7g/mesures/ref
p7g/mesurer.sh tools/relecture-autonome.cjs $S/p7g/tmpc p7g/mesures/graine --graine-ecartement-fictive
#   soit : nice -n 10 node tools/relecture-autonome.cjs etudier <arguments des 6 parties> --json OUT.json [--graine-ecartement-fictive]
node p7g/controle.cjs p7g/mesures/base-b50.json p7g/mesures/ref.json
node p7g/comparer.cjs p7g/mesures/ref.json p7g/mesures/graine.json
node p7g/poses.cjs
# essais
node --test tests/graine-ecartement-fictive.test.cjs tests/relecture-autonome-graine.test.cjs tests/relecture-autonome.test.cjs
```
