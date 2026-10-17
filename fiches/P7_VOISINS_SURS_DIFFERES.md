# P7 : voisins sûrs pour les cuts différés (5.0, 17 octobre 2026)

Branche `claude/50-p7-voisins-surs-differes`, partie de `claude/50-base` (d8a7bcd).

Contexte :
- le cap de Mic (D-170) : Ariane fait seule la relecture qu'il fait en Écho, et **pose elle-même** les cuts qu'elle lui laisse aujourd'hui ;
- l'hypothèse testée est **H3** du catalogue des échecs (ADV, abords, grappes), qui suit la fiche `RELECTURE_AUTONOME.md`.

Le commit donné pour la base dans la consigne (ba3947b) n'est plus la tête de `origin/claude/50-base`. Ce qui a changé depuis ne touche pas l'étude : `etudier` rend sur la base d8a7bcd **le même fichier, octet pour octet**, que l'étude publiée (§ 2.3).

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
| **Hypothèse** | Quand la chaîne diffère un cut que **le lot a différé**, la décision du lot est reprise. Ses appuis validés sont les **poses actuelles des voisins** à ±5 cuts : jamais un cut différé par le lot, jamais une pose fictive (1 500 mm), jamais une pose de Mic. La garde de cohérence livrée (`consistentValidated`) et les étapes livrées décident. |
| **Correctif** | Module pur `src/voisins-surs-differes.js`, coupé par défaut. Il est branché dans le rejeu de la relecture (`extraire`) et dans l'étude (`etudier`) par l'option `--voisins-surs-differes`. La pose reprise **ne devient jamais un appui** de la chaîne. |
| **Résultat** (règle de service, validation croisée, 6 parties) [FAIT] | **+13 corrections justes, +2 erreurs, 0 cut abîmé de plus, 0 mauvaise voie**, 18 abstentions de moins. Total : 79 → **92** justes ; 97 → 115 actions ; abîmés 6 → 6. |
| **Par zone** [FAIT] | **ADV : 11 → 21 justes** (+1 erreur). **Abords : 30 → 33** (+1 erreur). **Grappes : 35 → 45**. **PN : inchangée**, 36 justes sur 36 actions sur les verts. Verts hors zone : inchangés. |
| **Par partie** [FAIT] | 1:29 : +6 justes. 2:1 : +6. 1:17 : +1 juste, +1 erreur. 1:12, 1:13 et 1:24 : rien ne change. 1:12 et 1:13 n'ont pas de lot ; en 1:24, aucune reprise ne pose. |
| **Critère de réussite** | **Tenu** sur les parties d'apprentissage : 0 mauvaise voie ; plus de justes nettes en ADV, abords et grappes ; aucun cut abîmé de plus (le plafond était +2,9, soit 0,2 % de 1 445) ; PN à 36 sur 36. |
| **Ce qui tempère** | Le gain est **petit et fragile** (§ 5) : <br>– 18 actions en tout ; <br>– 2 erreurs sur 18 (11 %, borne haute 33 %), au-dessus de la porte des 9 % ; <br>– 4 des 13 justes tombent entre 9,0 et 9,6 mm de Mic ; <br>– la restriction « différés seulement » a été choisie par le catalogue **sur ces mêmes parties**. Il faut des parties neuves pour conclure. |
| **Hors de portée** | Ce correctif ne touche presque pas les 87 « hors de portée » du catalogue (zone d'ADV de 2:1). Sur 87 reprises tentées en 2:1, **48 n'ont pas 3 voisins sûrs** : tout le voisinage y est différé lui aussi. |

## 2. Données, correctif et contrôles

### 2.1 Le correctif

`src/voisins-surs-differes.js` est un post-traitement **pur** : pas d'horloge, pas de réglage global, pas d'écriture, entrées non modifiées. Il est **coupé par défaut** : l'appel doit passer `options.actif === true`.

`reprendre({ decision, differe, capture, science, anchors, poses, Shadow, options })` :
1. **Conditions.** La fonction ne fait rien si le module est coupé, si le cut n'est pas différé par le lot, ou si la chaîne le pose déjà.
2. **Voisins sûrs.** Sont retenues les poses actuelles à ±`rayon` cuts (5) de la même partie et du même repère :
   - jamais le cut lui-même ;
   - jamais un cut différé par le lot (une pose sans le champ `differe: false` est écartée elle aussi) ;
   - jamais une pose fictive, d'écartement 1 500 mm à 0,5 mm près.
3. **Moins de 3 voisins sûrs** (`validatedMinInliers` livré) : rien ne se passe, motif `trop-peu-de-voisins`.
4. **Reprise.** Sinon, la fonction appelle `LotDecision.decideCut({ capture, science, anchors, validated, Shadow })`, l'option livrée de D-054. Deux protections livrées s'y appliquent :
   - **la garde de cohérence** : au moins 3 voisins alignés à 8 mm sur les deux rails ;
   - **les étapes livrées** : premier passage, fenêtre relancée à 30 mm, choix à 15 mm, gardes de paire et d'écartement.
5. **Résultat.** La reprise ne compte que si la décision pose **avec au moins un voisin gardé**. Elle est alors marquée `post: 'voisins-surs'` et `anchor: false` : elle ne sert jamais d'appui, et une reprise fausse ne se propage pas.
6. **Panne.** En cas de panne, la décision de la chaîne est rendue telle quelle.

Branchement, par l'option `--voisins-surs-differes` de `tools/relecture-autonome.cjs` :
- **`extraire`** (le rejeu de la relecture, en chaîne) :
  - les poses actuelles sont les poses de départ de la première visite de chaque cut, avant tout geste de Mic ;
  - les cuts différés viennent de la table de la partie ;
  - la reprise va dans `chaineVoisins`.
  - Avec `--greffer ANCIEN.jsonl`, les cas d'une extraction antérieure sont gardés. La reprise n'y est reportée que si la chaîne nouvelle rend la même décision : même étape, poses à 0,5 mm près.
- **`etudier`** :
  - **la variante en chaîne** d'un différé du lot prend la pose reprise ;
  - **la grille** de la règle prudente gagne un seul choix, `differes: 'voisins'`. Il veut dire : agir sur un différé seulement s'il vient de la reprise, et alors sans les seuils des verts. Ce choix est réglé en validation croisée, comme le reste ;
  - **la règle de service** (variante sobre) reste celle des verts (§ 2.4) ;
  - **les tables ajoutées** donnent, par partie et par type de zone, les résultats tous genres, plus « en grappe » et « différés du lot ».

Il n'y a pas d'autre branchement : la base ne contient pas de passe de relecture dans l'extension (`src/relecture-critere.js` est sur une autre branche). Rien n'est activé dans l'extension.

### 2.2 Données

- **Cas de l'étude** : `zones/cas/cas-*.jsonl`, ceux de `RELECTURE_AUTONOME.md`.
- **Reprises** : extraites avec l'option et greffées sur ces cas, dans `p7vs/cas/` (1:17, 1:24, 1:29, 2:1). 1:12 et 1:13 n'ont pas de lot dans leur table, donc aucun cut différé : leurs cas sont repris tels quels.
- **Contrôle de la greffe** [FAIT] :

  | Partie | Chaînes identiques à l'ancienne extraction | Différés visés | Différés greffés |
  |---|--:|--:|--:|
  | 1:24 | 40 / 40 | 9 | 9 |
  | 2:1 | 465 / 465 | 87 | 87 |
  | 1:29 | 582 / 582 | 19 | 19 |
  | 1:17 | 199 / 200 | 15 | **9** |

  En 1:17, **6 différés visés manquent** : le dossier d'Écho d'origine n'est plus sur le disque (même limite que le catalogue, § 2.3). Ces 6 cuts restent des abstentions avec l'option.

### 2.3 Contrôles de non-régression [FAIT]

- **L'outil de base sur la base d8a7bcd** (`B50/tools/relecture-autonome.cjs etudier`, cas de l'étude) rend un `etude.json` identique, octet pour octet, à `zones/etude.json`, l'étude publiée.
- **L'outil modifié sans l'option**, sur les cas greffés, rend le même texte que l'outil de base. Seules s'y ajoutent les nouvelles tables (lignes 61 à 148). Règles choisies, bilans et réglages sont inchangés : **PN 36 sur 36, ADV 11 sur 17, abords 30 sur 37**, comme dans la fiche.
- **Essais** :
  - `tests/voisins-surs-differes.test.cjs` (8) et `tests/relecture-autonome-voisins.test.cjs` (8) : 16 essais ;
  - avec `tests/relecture-autonome.test.cjs` : 25 essais, 25 passent ;
  - avant le correctif, les essais nouveaux étaient rouges : 7 échecs sur 8 comptés (le fichier du module échoue en entier, module absent), et l'essai de la règle sobre (§ 2.4) rendait 20 au lieu de 8 ;
  - essais qui parcourent `src/` (paquet, hauteur apprise, ombres, valides de la décision, cohérence des voisins) : 67 essais, 66 passent, 1 sauté. Le verify complet n'a pas été lancé.

### 2.4 Une correction de méthode, faite en cours de mesure

**[FAIT] Premier passage.** La règle de service (« sobre ») remontait le seuil X des verts : **8 → 12 mm** dans la règle figée, et dans 4 plis sur 6.

**Cause.** Les 13 corrections des différés repris ne dépendent pas de X, mais elles comptaient dans les « 90 % des corrections justes gardées ». Le seuil des verts pouvait donc monter et leur faire perdre des corrections, sans rien gagner sur les différés. Résultat brut de ce premier passage :
- total : 108 actions, 91 justes, 5 abîmés, 0 mauvaise voie ;
- verts des abords : 29 justes sur 34 au lieu de 30 sur 37.

**Correction.** Ce mélange d'effets ne vient pas de l'hypothèse. Désormais, les différés repris ne comptent plus dans la part gardée (`sobre`). Un essai rouge, puis vert, le vérifie.

Sans l'option, le code suit exactement le même chemin qu'avant : la mesure de référence est identique octet pour octet à la première.

Après correction, le seuil des verts est celui de la référence dans chaque pli : X 8 / 8 / 10 / 8 / 10 / 8 et G 15 / 15 / 10 / 15 / 100 / 15. Les chiffres du § 3 sont ceux d'après la correction.

## 3. Résultats (règle de service, validation croisée)

Chaque partie est jugée avec la règle apprise sur les cinq autres. Dans **les 6 plis**, la règle apprise choisit `differes: 'voisins'` ; ses autres réglages sont ceux de la référence. Cellules : **actions / justes / erreurs / abîmés / mauvaises voies / abstentions**.

### 3.1 Par partie et type de zone, tous genres [FAIT]

| Partie | Zone | Visités | Mic > 10 mm | Référence | Avec l'option | Δ justes | Δ abîmés |
|---|---|--:|--:|---|---|--:|--:|
| 1:12 | pn | 72 | 23 | 20 / 20 / 0 / 0 / 0 / 6 | identique | 0 | 0 |
| 1:12 | liste | 1 | 1 | 1 / 1 / 0 / 0 / 0 / 0 | identique | 0 | 0 |
| 1:13 | pn | 67 | 15 | 9 / 9 / 0 / 0 / 0 / 15 | identique | 0 | 0 |
| 1:13 | adv | 72 | 6 | 8 / 3 / 3 / 1 / 0 / 15 | identique | 0 | 0 |
| 1:17 | adv | 39 | 7 | 1 / 1 / 0 / 0 / 0 / 27 | identique | 0 | 0 |
| 1:17 | abords | 236 | 47 | 7 / 2 / 3 / 2 / 0 / 123 | 11 / 3 / 4 / 2 / 0 / 119 | **+1** | 0 |
| 1:17 | liste | 15 | 5 | 0 / 0 / 0 / 0 / 0 / 11 | identique | 0 | 0 |
| 1:17 | en grappe | 162 | 34 | 5 / 1 / 3 / 2 / 0 / 96 | 7 / 1 / 3 / 2 / 0 / 94 | 0 | 0 |
| 1:24 | abords (en grappe) | 30 | 24 | 4 / 1 / 2 / 0 / 0 / 15 | identique | 0 | 0 |
| 1:29 | pn | 47 | 12 | 8 / 7 / 1 / 1 / 0 / 8 | identique | 0 | 0 |
| 1:29 | adv | 90 | 15 | 2 / 2 / 0 / 0 / 0 / 37 | 8 / 6 / 1 / 0 / 0 / 31 | **+4** | 0 |
| 1:29 | abords | 342 | 58 | 30 / 27 / 3 / 2 / 0 / 80 | 32 / 29 / 3 / 2 / 0 / 78 | **+2** | 0 |
| 1:29 | liste | 6 | 3 | 1 / 1 / 0 / 0 / 0 / 4 | identique | 0 | 0 |
| 1:29 | en grappe | 199 | 61 | 32 / 31 / 1 / 1 / 0 / 65 | 38 / 35 / 2 / 1 / 0 / 59 | **+4** | 0 |
| 2:1 | pn | 10 | 10 | 0 / 0 / 0 / 0 / 0 / 8 | identique | 0 | 0 |
| 2:1 | adv | 412 | 125 | 6 / 5 / 0 / 0 / 0 / 231 | 12 / 11 / 0 / 0 / 0 / 225 | **+6** | 0 |
| 2:1 | abords | 6 | 0 | 0 / 0 / 0 / 0 / 0 / 2 | identique | 0 | 0 |
| 2:1 | en grappe | 301 | 124 | 2 / 2 / 0 / 0 / 0 / 190 | 8 / 8 / 0 / 0 / 0 / 184 | **+6** | 0 |
| **total** | **pn** | 196 | 60 | 37 / 36 / 1 / 1 / 0 / 37 | identique | 0 | 0 |
| **total** | **adv** | 613 | 153 | 17 / 11 / 3 / 1 / 0 / 310 | 29 / 21 / 4 / 1 / 0 / 298 | **+10** | 0 |
| **total** | **abords** | 614 | 129 | 41 / 30 / 8 / 4 / 0 / 220 | 47 / 33 / 9 / 4 / 0 / 214 | **+3** | 0 |
| **total** | **vert hors zone (liste)** | 22 | 9 | 2 / 2 / 0 / 0 / 0 / 15 | identique | 0 | 0 |
| **total** | **en grappe** | 692 | 243 | 43 / 35 / 6 / 3 / 0 / 366 | 57 / 45 / 7 / 3 / 0 / 352 | **+10** | 0 |
| **total** | **différés du lot** | 158 | 151 | 0 / 0 / 0 / 0 / 0 / 129 | 18 / 13 / 2 / 0 / 0 / 111 | **+13** | 0 |
| **total** | **tout** | **1 445** | 351 | 97 / 79 / 12 / 6 / 0 / 582 | **115 / 92 / 14 / 6 / 0 / 564** | **+13** | **0** |

Lecture :
- la ligne « pn » tous genres compte 37 actions : la 37ᵉ est un cut posé par le lot en 1:29 (le pli 1:29 permet les cuts posés), comme dans la référence ;
- **sur les verts seuls**, rien ne change : PN 36 / 36 / 0 / 0 / 0, ADV 17 / 11 / 3 / 1 / 0, abords 37 / 30 / 5 / 1 / 0, liste 2 / 2 / 0 / 0 / 0 ;
- l'erreur parmi les actions de la règle de service passe de 12 / 97 (12,4 % ; Wilson ≤ 20,4 %) à 14 / 115 (12,2 % ; ≤ 19,4 %).

### 3.2 Autres lectures [FAIT]

| Lecture | Référence | Avec l'option |
|---|---|---|
| Règle de la procédure (X appris, validation croisée) : actions / justes / erreurs / abîmés / mauvaises voies | 312 / 84 / 23 / 8 / 0 | 330 / 97 / 25 / 8 / 0 |
| Chiffre central, en chaîne + hauteur, sans règle : reproduites à 10 mm parmi les corrections > 10 mm | 122 sur 351 | **135 sur 351** |
| Chiffre central : abîmés / mauvaises voies / abstentions | 9 / 0 / 582 | 9 / 0 / 564 |

### 3.3 Les 18 reprises, cut par cut [FAIT]

Toutes ont une référence de Mic. Toutes sont dans une zone de la sélection : ADV avec ses marges, ou abords. Colonnes :
- **Voisins** : voisins sûrs, puis voisins gardés par la cohérence ;
- **Mic** : correction de Mic (mm) ;
- **Écart** : pose reprise, hauteur apprise comprise, moins Mic (mm).

| Partie | Cut | Zone | Étape | Voisins | Mic | Écart | Issue |
|---|--:|---|---|---|--:|--:|---|
| 1:17 | 2874 | abords | window | 9 / 6 | 122,6 | 9,4 | juste |
| 1:17 | 3086 | abords, grappe | choice | 10 / 10 | 7,8 | 4,8 | reproduit (Mic ≤ 10) |
| 1:17 | 5793 | abords | choice | 5 / 3 | 121,1 | 13,1 | **erreur** |
| 1:17 | 7392 | abords, grappe | choice | 7 / 7 | 0 | 7,6 | gris (≤ 10, non abîmé) |
| 1:29 | 1163 | abords | choice | 3 / 3 | 64,2 | 5,6 | juste |
| 1:29 | 1484 | abords | choice | 5 / 5 | 34,7 | 4,5 | juste |
| 1:29 | 6560 | ADV, grappe | choice | 6 / 4 | 53,9 | 3,9 | juste |
| 1:29 | 6565 | ADV, grappe | choice | 7 / 6 | 50,2 | 5,1 | juste |
| 1:29 | 6566 | ADV, grappe | choice | 8 / 7 | 45,8 | 4,6 | juste |
| 1:29 | 6570 | ADV, grappe | choice | 8 / 7 | 9,3 | 7,9 | gris |
| 1:29 | 8002 | ADV, grappe | choice | 8 / 4 | 34,4 | 3,1 | juste |
| 1:29 | 8005 | ADV, grappe | choice | 8 / 6 | 39,1 | 22,0 | **erreur** |
| 2:1 | 356 | ADV, grappe | first-pass | 10 / 4 | 73,2 | 9,3 | juste |
| 2:1 | 445 | ADV, grappe | window | 6 / 4 | 222,0 | 2,5 | juste (rail déplacé de 203 mm en travers) |
| 2:1 | 614 | ADV, grappe | choice | 6 / 5 | 139,4 | 9,0 | juste |
| 2:1 | 625 | ADV, grappe | choice | 9 / 6 | 86,9 | 9,6 | juste |
| 2:1 | 627 | ADV, grappe | choice | 9 / 6 | 52,2 | 3,5 | juste |
| 2:1 | 3010 | ADV, grappe | choice | 8 / 7 | 37,4 | 2,7 | juste |

Ce sont les mêmes chiffres que le banc du catalogue pour H3 : +13 justes, +2 erreurs (5793 et 8005), 0 abîmé. Le banc laissait la reprise devenir un appui ; ici, elle n'en devient jamais un, et le compte ne change pas.

Les reprises tentées sans pose, par partie :

| Partie | Tentées | Posées | Pourquoi les autres ne posent pas |
|---|--:|--:|---|
| 1:17 | 9 | 4 | pas de cadre moteur sur un rail ou pas de minimum qualifié près de la voie (5) |
| 1:24 | 9 | 0 | garde de paire (3) ; sans minimum (2) ; pas de cadre (2) ; trop peu de voisins (1) ; voisins incohérents, `no-anchor` (1) |
| 1:29 | 19 | 8 | sans minimum (6) ; pas de cadre (2) ; garde de paire (1) ; `rsf` (1) ; trop peu de voisins (1) |
| 2:1 | 87 | 6 | **trop peu de voisins (48)** ; pas de cadre (17) ; sans minimum (14) ; voisins incohérents (2) |

Dans le voisinage d'une reprise, la garde de cohérence ne voit que des poses actuelles ; elle ne sait pas si elles sont justes. **Diagnostic avec la référence de Mic** (jamais une entrée) [FAIT] :
- **8002 et 8005** (1:29, ADV2) s'appuient sur les verts 8000 et 8001, que Mic corrige de 21 et 19 mm ;
- **8002 reste juste** : le choix tombe sur le bon minimum ;
- **8005 est l'erreur de 22 mm**.

Le risque nommé par l'hypothèse se produit donc : des voisins **verts** faux, alignés entre eux, passent la garde.

### 3.4 Les quatre mauvaises voies de 2:1 [FAIT]

Les cuts 303, 568, 569 et 572 ne sont pas touchés :
- **303 et 569** : la chaîne les pose déjà, donc la reprise ne s'applique pas ;
- **568** : 4 voisins gardés, mais pas de minimum qualifié près de la voie. Le cut reste différé ;
- **572** : voisins incohérents. Le cut reste différé.

## 4. Critère de réussite

| Critère | Mesure | Tenu |
|---|---|---|
| 0 mauvaise voie | 0 en validation croisée, dans chaque partie et dans chaque zone | oui |
| Plus de corrections justes nettes en ADV, abords ou grappes | ADV +10, abords +3, grappes +10 ; abîmés +0 | oui |
| Cuts abîmés : pas plus de +0,2 % des visités (+2,9 cuts sur 1 445) | +0 | oui |
| Aucune régression sur la PN (36 sur 36) | verts de PN : 36 / 36, 0 erreur, 0 abîmé ; PN tous genres identique | oui |

## 5. Ce qui tempère le résultat

- **[FAIT] Petits nombres.** 18 actions de plus, dont 13 justes.
  - **Erreurs** : 2 sur 18, soit 11 %. C'est au-dessus de la porte des 9 % pour ce seul groupe (Wilson : 3 à 33 %).
  - **Justes limites** : 4 justes sont entre 9,0 et 9,6 mm de Mic (2874, 356, 614, 625). Le bruit de la référence est de 2 à 4 mm par axe : à 10 mm près, ce ne sont pas des cas francs.
- **[FAIT] Étape `choice`.** 15 reprises sur 18 posent à l'étape `choice`, dont les 2 erreurs. Sur les verts, la même reprise abîmait 3 cuts à cette étape (catalogue). La restriction aux différés les évite ici.
- **[HYP] Biais de conception.** La restriction « différés seulement » a été choisie par le catalogue **après lecture du banc, sur ces mêmes parties**. La validation croisée par partie ne règle que le choix `differes`, et le même choix sort dans les 6 plis. Elle n'efface pas ce biais. Il faut un jugement sur des parties neuves, qui n'est pas fait ici.
- **[NON MESURÉ] Vue d'ESV.** Le cut 445 (2:1) demande de déplacer un rail de **203 mm en travers**. Au-delà d'environ 200 mm, la cible sort de la vue d'ESV (D-156 ; « déplacer la vue » est coupé). On ne sait pas si ce clic est faisable aujourd'hui. Les autres reprises bougent un rail de 133 mm au plus.
- **[NON MESURÉ] 1:17.** 6 différés visés sur 15 n'ont pas pu être recalculés : la source d'Écho est absente du disque.
- **[FAIT] Portée limitée.** Les « hors de portée » de 2:1 restent hors de portée : 48 de leurs 87 reprises n'ont pas 3 voisins sûrs. Il faudra une autre voie, comme H2 (graine d'écartement) ou H4 (recapture).
- **[FAIT] Pose actuelle des voisins.** Elle peut être fausse (8005). Rien ne l'arrête si elle est cohérente avec ses propres voisins.
- **Ordre de la chaîne.** Le rejeu suit l'ordre de visite de Mic, comme dans la fiche et le catalogue. Les poses actuelles connues sont celles des cuts que Mic a visités. En service, Ariane connaîtrait aussi celles des cuts qu'il n'a pas visités. **[NON MESURÉ]**

**Verdict** : **gain**, au sens du critère fixé, sur les parties d'apprentissage. Le gain est modeste : +13 justes sur 351 corrections de Mic de plus de 10 mm. Il reste à juger sur des parties neuves avant toute activation. Rien n'est activé : l'option est coupée par défaut et aucun réglage livré ne change.

## 6. Fichiers

Dans le dépôt :
- `src/voisins-surs-differes.js` : le module ;
- `tools/relecture-autonome.cjs` : l'option `--voisins-surs-differes` (`extraire`, `etudier`, `juger`), `--greffer`, les tables par partie et par type de zone, et la règle sobre limitée aux verts sous l'option ;
- `tests/voisins-surs-differes.test.cjs` et `tests/relecture-autonome-voisins.test.cjs` : les essais.

Hors dépôt, dans le dossier de travail `p7vs/` : numéros de cut, mm et comptes seulement.

| Fichier | Contenu |
|---|---|
| `extraire.sh`, `extraire.log` | extraction avec l'option, greffée sur `zones/cas` |
| `cas/` | cas greffés de 1:17, 1:24, 1:29 et 2:1 |
| `tmpc/` | les six parties, en liens vers les cas |
| `mesurer.sh` | lancement de l'étude |
| `mesures2/ref.*`, `mesures2/vs.*` | référence et option, après la correction du § 2.4 |
| `mesures/vs.txt` | premier passage (§ 2.4) |
| `comparer.cjs` | tableau du § 3.1 |
| `reprises.cjs` | §§ 3.3 et 3.4 |

## 7. Rejouer

`$S` désigne le dossier de travail. Pour chaque partie P, les arguments sont `--partie P --cas $S/p7vs/tmpc/cas-P.jsonl --table $S/adv/tables/t-P.json --skip $S/zones/skip/skip-P.jsonl`.

```
# extraction avec l'option, greffée (≈ 18 min, sous le verrou des calculs lourds)
p7vs/extraire.sh 24 21 29 17
# référence et option, même commande (≈ 3 et 6 min)
p7vs/mesurer.sh tools/relecture-autonome.cjs $S/p7vs/tmpc p7vs/mesures2/ref
p7vs/mesurer.sh tools/relecture-autonome.cjs $S/p7vs/tmpc p7vs/mesures2/vs --voisins-surs-differes
#   soit : nice -n 10 node tools/relecture-autonome.cjs etudier <arguments des 6 parties> --json OUT.json [--voisins-surs-differes]
node p7vs/comparer.cjs p7vs/mesures2/ref.json p7vs/mesures2/vs.json
node p7vs/reprises.cjs
# essais
node --test tests/voisins-surs-differes.test.cjs tests/relecture-autonome-voisins.test.cjs tests/relecture-autonome.test.cjs
```
