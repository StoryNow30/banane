# P7 : différés en chaîne

Essai du 17 octobre 2026, branche `claude/50-p7-differes-en-chaine`, partie de `claude/50-base` (d8a7bcd). Il teste l'hypothèse H1 du catalogue des échecs d'Ariane en ADV, aux abords et en grappes (diagnostic P7, hors dépôt). Le cap de Mic (D-170) : Ariane fait seule la relecture qu'il fait en Écho, et pose elle-même les cuts qu'elle lui laisse aujourd'hui.

Seules les six **parties d'apprentissage** sont lues : 1:12, 1:13, 1:17, 1:24, 1:29 et 2:1. Aucune partie réservée n'a été ouverte, et le mode `juger` n'a pas été lancé. `src/engine.js` et `src/lot-decision.js` ne sont pas modifiés.

Conventions :
- **[FAIT]** : mesuré ; le chiffre vient d'une commande du § 7 ;
- **[HYP]** : hypothèse, plausible mais non démontrée ;
- **[NON MESURÉ]** : ces données ne permettent pas de le mesurer.

Les parties sont désignées « 1:29 » (projet 1, partie 29). Toutes les distances sont en mm.

## 1. En bref

| Question | Réponse |
|---|---|
| **Hypothèse** | La règle de relecture accepte un cut **différé par le lot** si sa pose vient de la **chaîne** avec **au moins un appui** (étapes `first-pass`, `window`, `choice` ou `crossing`), sans les limites D (rail déplacé en travers, 45 mm) et G (écartement à 15 mm de la médiane) des verts. Les différés posés seuls restent exclus. |
| **Verdict** | **Gain sur les parties d'apprentissage**, en validation croisée. Les quatre conditions de réussite tiennent. Le gain est réel, mais concentré et à confirmer (§ 6). |
| **Validation croisée** (`etudier --differes-en-chaine`) | **+21 corrections justes** (79 → 100), **−1 cut abîmé** (6 → 5), erreurs inchangées (12), **0 mauvaise voie**. Gain net : **+22**. Chaque pli choisit les différés en chaîne avec 1 appui au moins. [FAIT] |
| **À la lettre** (`greffer`) | La règle de service de chaque pli, plus la seule condition des différés : **+22 justes** (79 → 101), **+1 erreur** (1:24, cut 5722 : 14,7 mm de Mic, qui corrige de 111 mm), 0 cut abîmé de plus, **0 mauvaise voie**. Verts et cuts posés : inchangés. [FAIT] |
| **ADV** | 11 → **25** justes, erreurs 3 → 3 (18 % → 10 % des actions). [FAIT] |
| **Abords** | 30 → **36** justes (37 à la lettre), un cut abîmé de moins (à la lettre : une erreur de plus). [FAIT] |
| **Grappes** | 35 → **50** justes (51 à la lettre), cuts abîmés 3 → 2 (3 à la lettre). [FAIT] |
| **PN** | Verts de PN : **36 justes sur 36 actions**, comme la référence. Zone PN tous genres : +1 juste (1:29, cut 3345, différé). [FAIT] |
| **Différés** | 29 différés jugeables ont une pose de la chaîne. Ariane agit sur **23** : **22 justes, 1 erreur, 0 mauvaise voie**. Elle en refuse 6 : 4 sans appui, 1 par la cohérence des rails, 1 sous le seuil. [FAIT] |
| **Prix sur les verts** | En validation croisée, le seuil de la variante sobre monte de 8–10 à 10–12 mm. **Un vert juste est perdu** (1:24, abords), et 5 actions de moins sont faites sur les verts. À la lettre, les verts ne changent pas. [FAIT] |
| **Risques non levés** | **5 des 23 cibles** sont à plus de 200 mm de la pose d'ESV ; elles peuvent sortir de la vue (D-156). **[NON MESURÉ]** : combien ne pourraient pas être cliquées. Lever la limite de voie pour un différé va contre l'invariant « jamais de changement de voie » du lecteur de la relecture (D-159) : il faut l'accord de Mic et de la direction. |

## 2. Ce qui a été fait

### 2.1 Le correctif

- **`src/differes-en-chaine.js`** : une fonction **pure** de post-traitement. `admet({ genre, variante, etage, appuis }, réglages)` admet un différé si :
  - l'option est active (`actif`, **coupée par défaut**) ;
  - sa pose vient de la chaîne (variante `chaine` ou `chaine+h`) ;
  - l'étape de la décision pose (`first-pass`, `window`, `choice`, `crossing`) ;
  - la décision s'appuie sur au moins `appuisMin` appuis (1 au moins ; 0 est refusé).

  Admis, le cut est jugé par le reste de la règle : seuil X, confiance, cohérence des rails, étapes permises. Les limites D et G des verts sont levées (`sansVoie`, `sansEcartement`). `jugerRelecture(entrée)` rend le même jugement sur l'entrée de la passe de relecture : rôle, `jugement.etage`, `jugement.appuis`. Rien n'est commandé, rien n'est lu d'ESV.
- **`tools/relecture-autonome.cjs`** :
  - `etudier --differes-en-chaine` (**option coupée par défaut**) : la grille de la règle prudente ajoute aux différés exclus deux façons de les admettre en chaîne (1 ou 2 appuis au moins). La validation croisée choisit. À gain égal, elle prend la règle sans différé, puis celle qui exige le plus d'appuis.
  - `etudier` donne aussi les bilans de la règle de service **tous genres** : par type de zone, par genre, dans les grappes. Il ajoute le détail des différés posés par la chaîne.
  - `greffer` : l'hypothèse **à la lettre**, sans rien apprendre. On prend, pour chaque partie, la règle de service apprise sans elle (lue dans une étude **sans** l'option). On lui ajoute la seule condition des différés, avec un appui au moins comme le veut l'hypothèse, et on mesure sur la partie laissée de côté.
  - `comparer` : deux études des mêmes parties, par partie et par groupe.
  - `refus` : la première condition qui retient Ariane.
  - le bloc `differesEnChaine` du fichier de réglages est lu par `regleDuReglage`. `jamais` y garde « cut différé par le lot » : un lecteur qui ignore le bloc reste fermé.
- **Sans l'option, l'étude rend à l'identique** tous les champs de la base. C'est vérifié champ par champ sur les six parties, contre l'outil de `claude/50-base` : 0 écart. [FAIT]

### 2.2 Branchement dans la relecture

- La base n'a pas de passe de relecture. Son lecteur de règle, `src/relecture-critere.js`, n'existe que sur `claude/50-relecture-ombre`. Dans la base, la règle de relecture est le fichier de réglages lu par `regleDuReglage`. C'est là que l'option est branchée, coupée : le fichier proposé (`datasets/relecture-reglages-proposes.json`) n'a pas de bloc `differesEnChaine` et **n'est pas modifié**.
- Sur la branche de la relecture en ombre, le lecteur refuse aujourd'hui, par sécurité :
  - un fichier dont `jamais` n'exclut pas les différés ;
  - une limite de voie au-delà de 45 mm.

  Brancher `jugerRelecture` dans ce lecteur n'est **pas fait** : il faudrait d'abord lever l'invariant D-159 pour les différés (§ 6).

### 2.3 Essais

`tests/differes-en-chaine.test.cjs` compte 17 essais, sur des données synthétiques :
- le module ;
- la règle de l'outil avec et sans l'option ;
- les lignes : appuis, grappe ;
- l'étude ;
- la greffe ;
- la comparaison ;
- le fichier de réglages ;
- la ligne de commande.

Ils ont été lancés **rouges d'abord** :
- contre l'outil de la base : les 6 essais de l'outil en échec ;
- contre la première version de l'option : 4 essais en échec (`refus`, greffe, ligne de commande de la greffe) ;
- puis 1 essai du fichier de réglages (`jamais` gardé entier).

Avec `tests/relecture-autonome.test.cjs`, les 26 essais passent. `tests/hauteur-apprise.test.cjs` et `tests/package.test.cjs` passent aussi : ils lisent tous les fichiers de `src/`. [FAIT]

## 3. Méthode

- **Données** : les cas extraits (`zones/cas/cas-P-N.jsonl`) et les tables (`adv/tables/t-P-N.json`), hors dépôt, des six parties d'apprentissage. Les cas portent la décision du lot **en chaîne** : les appuis sont les poses qu'Ariane vient de donner aux cuts précédents visités par Mic, dans l'ordre des cuts, jamais une pose de Mic. Ils portent aussi son nombre d'appuis.
- **Jugement** (définitions de la fiche `RELECTURE_AUTONOME.md`) :
  - **juste** : Mic corrige de plus de 10 mm, Ariane arrive à 10 mm de lui ;
  - **abîmé** : Mic est à 5 mm au plus, Ariane au-delà de 10 mm (ou elle aggrave) ;
  - **erreur > 10 mm** : toute action posée à plus de 10 mm de Mic, abîmés compris ;
  - **mauvaise voie** : plus de 50 mm d'écart à Mic ;
  - **abstention** : la variante ne pose pas ;
  - **laissé faux** : Mic corrige de plus de 10 mm et Ariane n'agit pas.
- **Validation croisée par partie** : on laisse une partie de côté, on choisit la règle sur les cinq autres (grille, contrainte : 0 mauvaise voie, dégâts ≤ 1 % des visités), puis on prend sa variante sobre, la **règle de service**. On mesure sur la partie laissée. La référence et l'essai passent par la **même commande** ; seule l'option change.
- **Grappe** : les cuts d'une suite d'au moins 3 rouges du lot (trous de 5 cuts au plus), avec 3 cuts de marge, comme dans le catalogue.

## 4. Référence : la base, même commande sans l'option

Règle de service, validation croisée, **tous genres**. Chaque cellule se lit : *visités : actions / justes / abîmés / erreurs > 10 mm / mauvaise voie / abstentions / laissés faux*. Les zones absentes d'une partie ne sont pas listées. [FAIT]

| Partie | PN | ADV | abords | verts hors zone | grappes | toutes zones |
|---|---|---|---|---|---|---|
| 1:12 | 72 : 20 / 20 / 0 / 0 / 0 / 6 / 3 | — | — | 1 : 1 / 1 / 0 / 0 / 0 / 0 / 0 | — | 73 : 21 / 21 / 0 / 0 / 0 / 6 / 3 |
| 1:13 | 67 : 9 / 9 / 0 / 0 / 0 / 15 / 6 | 72 : 8 / 3 / 1 / 3 / 0 / 15 / 1 | — | — | — | 139 : 17 / 12 / 1 / 3 / 0 / 30 / 7 |
| 1:17 | — | 39 : 1 / 1 / 0 / 0 / 0 / 27 / 6 | 236 : 7 / 2 / 2 / 3 / 0 / 123 / 45 | 15 : 0 / 0 / 0 / 0 / 0 / 11 / 5 | 162 : 5 / 1 / 2 / 3 / 0 / 96 / 33 | 290 : 8 / 3 / 2 / 3 / 0 / 161 / 56 |
| 1:24 | — | — | 30 : 4 / 1 / 0 / 2 / 0 / 15 / 21 | — | 30 : 4 / 1 / 0 / 2 / 0 / 15 / 21 | 30 : 4 / 1 / 0 / 2 / 0 / 15 / 21 |
| 1:29 | 47 : 8 / 7 / 1 / 1 / 0 / 8 / 5 | 90 : 2 / 2 / 0 / 0 / 0 / 37 / 13 | 342 : 30 / 27 / 2 / 3 / 0 / 80 / 30 | 6 : 1 / 1 / 0 / 0 / 0 / 4 / 2 | 199 : 32 / 31 / 1 / 1 / 0 / 65 / 30 | 485 : 41 / 37 / 3 / 4 / 0 / 129 / 50 |
| 2:1 | 10 : 0 / 0 / 0 / 0 / 0 / 8 / 10 | 412 : 6 / 5 / 0 / 0 / 0 / 231 / 120 | 6 : 0 / 0 / 0 / 0 / 0 / 2 / 0 | — | 301 : 2 / 2 / 0 / 0 / 0 / 190 / 122 | 428 : 6 / 5 / 0 / 0 / 0 / 241 / 130 |
| **total** | 196 : 37 / 36 / 1 / 1 / 0 / 37 / 24 | 613 : 17 / 11 / 1 / 3 / 0 / 310 / 140 | 614 : 41 / 30 / 4 / 8 / 0 / 220 / 96 | 22 : 2 / 2 / 0 / 0 / 0 / 15 / 7 | 692 : 43 / 35 / 3 / 6 / 0 / 366 / 206 | **1 445 : 97 / 79 / 6 / 12 / 0 / 582 / 267** |

- Verts seuls, par zone : PN **36 justes sur 36 actions** ; ADV 11 sur 17 ; abords 30 sur 37 ; verts hors zone 2 sur 2. Ce sont les chiffres de la fiche `RELECTURE_AUTONOME.md` : la référence les reproduit. [FAIT]
- Par genre : verts 92 actions / 79 justes ; posés 5 / 0 (4 abîmés) ; **différés 0 action sur 158 visités**, dont 151 laissés faux. [FAIT]
- La seule action abîmée en zone PN est un cut posé par le lot (1:29), dans un pli dont la règle admet les posés. [FAIT]

## 5. Résultats

### 5.1 Validation croisée avec l'option (`etudier --differes-en-chaine`)

Règles de service choisies sans la partie : toutes `chaine+h`, D 45, différés en chaîne avec **1 appui au moins**. Le seuil X vaut 10 (1:12, 1:13, 1:29, 2:1) ou 12 (1:17, 1:24), au lieu de 8 ou 10 dans la référence. Même lecture des cellules qu'au § 4. [FAIT]

| Partie | PN | ADV | abords | grappes | toutes zones | Δ justes / abîmés / erreurs / mauvaise voie |
|---|---|---|---|---|---|---|
| 1:12 | 72 : 20 / 20 / 0 / 0 / 0 / 6 / 3 | — | — | — | 73 : 21 / 21 / 0 / 0 / 0 / 6 / 3 | 0 / 0 / 0 / 0 |
| 1:13 | 67 : 9 / 9 / 0 / 0 / 0 / 15 / 6 | 72 : 6 / 3 / 1 / 3 / 0 / 15 / 1 | — | — | 139 : 15 / 12 / 1 / 3 / 0 / 30 / 7 | 0 / 0 / 0 / 0 |
| 1:17 | — | 39 : 1 / 1 / 0 / 0 / 0 / 27 / 6 | 236 : 5 / 3 / 1 / 2 / 0 / 123 / 44 | 162 : 3 / 1 / 1 / 2 / 0 / 96 / 33 | 290 : 6 / 4 / 1 / 2 / 0 / 161 / 55 | +1 / −1 / −1 / 0 |
| 1:24 | — | — | 30 : 3 / 0 / 0 / 3 / 0 / 15 / 21 | 30 : 3 / 0 / 0 / 3 / 0 / 15 / 21 | 30 : 3 / 0 / 0 / 3 / 0 / 15 / 21 | **−1** / 0 / +1 / 0 |
| 1:29 | 47 : 9 / 8 / 1 / 1 / 0 / 8 / 4 | 90 : 3 / 3 / 0 / 0 / 0 / 37 / 12 | 342 : 36 / 33 / 2 / 3 / 0 / 80 / 24 | 199 : 35 / 34 / 1 / 1 / 0 / 65 / 27 | 485 : 49 / 45 / 3 / 4 / 0 / 129 / 42 | +8 / 0 / 0 / 0 |
| 2:1 | 10 : 0 / 0 / 0 / 0 / 0 / 8 / 10 | 412 : 19 / 18 / 0 / 0 / 0 / 231 / 107 | 6 : 0 / 0 / 0 / 0 / 0 / 2 / 0 | 301 : 15 / 15 / 0 / 0 / 0 / 190 / 109 | 428 : 19 / 18 / 0 / 0 / 0 / 241 / 117 | +13 / 0 / 0 / 0 |
| **total** | 196 : 38 / 37 / 1 / 1 / 0 / 37 / 23 | 613 : **29 / 25** / 1 / 3 / 0 / 310 / 126 | 614 : 44 / **36 / 3** / 8 / 0 / 220 / 89 | 692 : 56 / **50 / 2** / 6 / 0 / 366 / 190 | **1 445 : 113 / 100 / 5 / 12 / 0 / 582 / 245** | **+21 / −1 / 0 / 0** |

- Verts hors zone : inchangés (2 justes sur 2 actions). Verts de PN : **36 sur 36**, inchangés. [FAIT]
- Par genre : verts 87 actions / 78 justes (référence 92 / 79) ; posés 3 / 0 (référence 5 / 0, un abîmé de moins) ; **différés 23 / 22, 1 erreur**. [FAIT]
- Taux d'erreur parmi les actions (Wilson 95 %) : [FAIT]
  - toutes zones : 12/97 = 12,4 % (7,2–20,4) → 12/113 = 10,6 % (6,2–17,6) ;
  - ADV : 3/17 = 17,6 % (6,2–41) → 3/29 = 10,3 % (3,6–26,4) ;
  - abords : 8/41 = 19,5 % → 8/44 = 18,2 %.
- Règle figée sur les six parties (en échantillon, pour mémoire) : X 12, différés en chaîne à 1 appui. Elle fait 109 actions, 101 justes, 0 cut abîmé, 7 erreurs, 0 mauvaise voie ; la référence figée faisait 102 / 84 / 1 / 8 / 0. [FAIT, en échantillon]
- **Pourquoi des verts sont perdus** : la variante sobre relève le seuil tant que la règle garde 90 % de ses corrections justes. Les différés, déplacés de 36 à 234 mm, ne craignent pas un seuil plus haut. Le seuil monte donc, et des petites corrections de verts sont perdues : 1:24 perd son seul vert juste, 1:13 fait 2 actions de moins. C'est un effet de la procédure de réglage, pas de la condition elle-même. [FAIT pour les chiffres, HYP pour l'explication]

### 5.2 À la lettre : la règle de service de chaque pli, plus la seule condition des différés (`greffer`)

Rien n'est appris ici : les règles sont celles de la référence, appuis au moins 1. [FAIT]

| Groupe (total des six parties) | Référence | Greffe | Δ justes / abîmés / erreurs / mauvaise voie |
|---|---|---|---|
| zone PN | 196 : 37 / 36 / 1 / 1 / 0 / 37 / 24 | 196 : 38 / 37 / 1 / 1 / 0 / 37 / 23 | +1 / 0 / 0 / 0 |
| zone ADV | 613 : 17 / 11 / 1 / 3 / 0 / 310 / 140 | 613 : 31 / 25 / 1 / 3 / 0 / 310 / 126 | **+14** / 0 / 0 / 0 |
| abords | 614 : 41 / 30 / 4 / 8 / 0 / 220 / 96 | 614 : 49 / 37 / 4 / 9 / 0 / 220 / 88 | **+7** / 0 / +1 / 0 |
| verts hors zone | 22 : 2 / 2 / 0 / 0 / 0 / 15 / 7 | identique | 0 |
| verts de PN | 167 : 36 / 36 / 0 / 0 / 0 / 24 / 13 | identique | 0 |
| grappes | 692 : 43 / 35 / 3 / 6 / 0 / 366 / 206 | 692 : 60 / 51 / 3 / 7 / 0 / 366 / 189 | **+16** / 0 / +1 / 0 |
| **toutes zones** | 1 445 : 97 / 79 / 6 / 12 / 0 / 582 / 267 | **1 445 : 120 / 101 / 6 / 13 / 0 / 582 / 244** | **+22 / 0 / +1 / 0** |

Par partie, en justes : 1:12 0, 1:13 0, 1:17 +1, 1:24 0 (+1 erreur), 1:29 +8, 2:1 +13. Verts et cuts posés : identiques à la référence dans chaque partie. [FAIT]

### 5.3 Les différés posés par la chaîne, un par un

Ce sont les mêmes 29 cuts dans les deux mesures (validation croisée et greffe). Le déplacement d'Ariane se mesure depuis la pose d'ESV : 3D, plus grand rail ; puis le plus grand |latéral|. [FAIT]

| Partie | Cut | Zone | Grappe | Étape | Appuis | Mic | Déplacement d'Ariane (3D ; latéral) | Écart à Mic | Action | Issue |
|---|--:|---|---|---|--:|--:|---|--:|---|---|
| 1:17 | 2168 | abords | non | choice | 1 | 113,8 | 116,7 ; 116,6 | 6,3 | agit | juste |
| 1:17 | 7534 | abords | oui | first-pass | 0 | 120,5 | 117,5 ; 117,5 | 6,4 | refus (0 appui) | laissé faux |
| 1:24 | 5722 | abords | oui | choice | 1 | 111,4 | 103,3 ; 102,8 | **14,7** | agit | **erreur** (faux qui reste) |
| 1:29 | 283 | abords | oui | first-pass | 1 | 8 | 3,4 ; 2 | 5,1 | refus (seuil X) | laissé |
| 1:29 | 862 | abords | non | window | 1 | 34,5 | 35,8 ; 34 | 1,9 | agit | juste |
| 1:29 | 897 | abords | non | choice | 1 | 43,1 | 42,1 ; 41 | 3,5 | agit | juste |
| 1:29 | 3345 | PN | oui | choice | 2 | 56 | 59,1 ; 56,8 | 4,9 | agit | juste |
| 1:29 | 3503 | abords | oui | choice | 2 | 37,8 | 35,3 ; 32,8 | 7,7 | agit | juste |
| 1:29 | 4388 | abords | non | choice | 1 | 36,3 | 36,6 ; 34,7 | 2,5 | agit | juste |
| 1:29 | 5698 | abords | non | first-pass | 1 | 64 | 61,1 ; 61 | 6,6 | agit | juste |
| 1:29 | 6164 | abords | non | choice | 2 | 43,4 | 38,7 ; 38,7 | 4,9 | agit | juste |
| 1:29 | 6634 | ADV | oui | choice | 2 | 45,4 | 42,6 ; 42 | 2,9 | agit | juste |
| 2:1 | 297 | ADV | oui | first-pass | 0 | 143 | 143,1 ; 142,9 | 2,7 | refus (0 appui) | laissé faux |
| 2:1 | 301 | ADV | oui | window | 1 | 162,8 | 164,1 ; 163,9 | 2,9 | agit | juste |
| 2:1 | 303 | ADV | oui | window | 1 | 210 | **208,9** ; 208,6 | 2,2 | agit | juste |
| 2:1 | 304 | ADV | oui | choice | 2 | 180,7 | 183,7 ; 183,3 | 4,1 | agit | juste |
| 2:1 | 305 | ADV | oui | choice | 1 | 161,7 | 161,4 ; 161,2 | 5,4 | agit | juste |
| 2:1 | 306 | ADV | oui | window | 1 | 149,4 | 148,6 ; 148,4 | 3,4 | agit | juste |
| 2:1 | 307 | ADV | oui | choice | 1 | 172,3 | 176,1 ; 175 | 4,5 | agit | juste |
| 2:1 | 311 | ADV | oui | window | 1 | 207,3 | **204,4** ; 204,3 | 5,9 | agit | juste |
| 2:1 | 312 | ADV | oui | window | 2 | 205,3 | **210,5** ; 210,3 | 5,6 | agit | juste |
| 2:1 | 318 | ADV | oui | first-pass | 0 | 140,3 | 140,4 ; 138,7 | 2,8 | refus (0 appui) | laissé faux |
| 2:1 | 370 | ADV | oui | window | 1 | 196,9 | 198,1 ; 197 | 3,4 | agit | juste |
| 2:1 | 406 | PN | oui | crossing | 0 | 203,6 | 193,1 ; 193 | 11 | refus (0 appui) | laissé faux |
| 2:1 | 409 | PN | oui | window | 1 | 218,1 | 217,8 ; 217,7 | 1,9 | refus (cohérence) | laissé faux |
| 2:1 | 435 | ADV | oui | window | 2 | 226,8 | **223,8** ; 209,6 | 3,4 | agit | juste |
| 2:1 | 569 | ADV | oui | window | 1 | 232,6 | **233,9** ; 233,8 | 1,9 | agit | juste |
| 2:1 | 2949 | ADV | oui | choice | 1 | 51 | 46,9 ; 44,7 | 5,5 | agit | juste |
| 2:1 | 5518 | ADV | oui | choice | 2 | 54,4 | 53,8 ; 53,5 | 3,3 | agit | juste |

- **23 actions : 22 justes, 1 erreur, 0 mauvaise voie.** Taux d'erreur : 1/23 = 4,3 % (Wilson 95 % : 0,8–21 %). [FAIT]
- **L'erreur** (1:24, cut 5722) : Mic déplace le cut de 111 mm, Ariane le pose à 14,7 mm de lui. Le catalogue la range dans les écarts de hauteur (surtout vertical). Elle n'est pas un cut abîmé : l'écart à Mic passe de 111 à 14,7 mm. [FAIT]
- **Les refus** : [FAIT]
  - 4 poses de la chaîne **sans appui**, que la condition écarte : 3 auraient été justes, la quatrième (2:1, cut 406) à 11 mm ;
  - 1 refus par la cohérence des rails, 2:1, cut 409 : Mic monte le rail droit de 105 mm et pas le gauche ; la différence verticale des deux rails (110 mm) dépasse la limite de 100 mm, que la règle garde ;
  - 1 refus sous le seuil (1:29, cut 283 : Mic à 8 mm).
- **Concentration** : 11 des 22 justes sont dans la seule zone d'ADV « bordélique » de 2:1 (cuts 301 à 569), et 8 en 1:29. Ces cuts se suivent et s'appuient les uns sur les autres dans la chaîne : ils ne sont pas indépendants. [FAIT]
- **Hors de la vue** : 5 cibles sont à plus de 200 mm de la pose d'ESV (2:1 : cuts 303, 311, 312, 435, 569). 6 autres sont entre 148 et 199 mm (301, 304, 305, 306, 307, 370). [FAIT]

## 6. Critère de réussite, doutes et risques

### 6.1 Le critère

| Condition | Validation croisée | À la lettre |
|---|---|---|
| 0 mauvaise voie | **0** ✓ | **0** ✓ |
| Plus de corrections justes nettes en ADV, abords ou grappes | ADV +14, abords +7 net, grappes +16 net ✓ | ADV +14, abords +7, grappes +16 ✓ |
| Cuts abîmés : pas plus de +0,2 % des visités (2,9 cuts sur 1 445) | **−1** ✓ | **0** ✓ |
| PN sans régression (36/36) | verts de PN 36/36 ✓ | verts de PN 36/36 ✓ |

### 6.2 Doutes

- **[FAIT] L'hypothèse a été tirée de ces mêmes parties.** Le catalogue avait déjà compté ces poses justes. La validation croisée protège les réglages appris : l'appui minimal, le seuil, les limites. Elle ne protège pas le choix de l'hypothèse elle-même. Le gain doit être jugé sur des parties neuves, ce qui n'est pas fait ici. Les parties réservées n'ont pas été lues.
- **[FAIT] Le gain tient à deux parties** : 13 justes viennent de 2:1, dont 11 dans une seule zone, et 8 de 1:29. 1:12 et 1:13 n'ont aucun différé posé par la chaîne. 1:24 a l'erreur, et 1:17 un seul juste.
- **[FAIT] Le prix sur les verts** n'apparaît qu'en validation croisée : 1 juste perdu, 5 actions de moins. Il vient du seuil de la variante sobre (§ 5.1). On peut l'éviter en gardant le seuil de la règle de service et en greffant la condition (§ 5.2). Ce choix n'a pas été fait sur ces parties : les deux chiffres sont donnés.
- **[FAIT] Bruit de la référence de Mic** : 2 à 4 mm par axe. Les justes entre 5 et 10 mm (7 sur 22) ne sont pas francs à l'unité près.

### 6.3 Risques

- **Invariant de voie (D-159)** : le lecteur de la relecture en ombre interdit tout déplacement latéral au-delà de 45 mm, parce que les poses sur la mauvaise voie mesurées allaient de 163 à 280 mm. Les 11 différés justes de la zone d'ADV « bordélique » de 2:1 sont déplacés de 149 à 234 mm. Une bonne pose et une mauvaise voie ont donc la même taille : **seule la chaîne les distingue**. [FAIT] Sur ces données, en chaîne, aucune mauvaise voie. Seules, les mêmes décisions en faisaient 4 (catalogue § 2.4).
  - **[HYP]** Une mauvaise voie posée par la chaîne deviendrait l'appui du cut suivant et se propagerait. Il n'y en a aucune ici, ce qui ne prouve pas qu'elle ne peut pas arriver.
  - Lever l'invariant pour les différés demande l'accord de Mic et de la direction.
- **Vue d'ESV (D-156)** :
  - **[FAIT]** Dans le code, l'adaptateur refuse sans cliquer une cible que la projection dit hors de la vue. Le mode de clic « tel-quel » laisse partir un clic calculé dans la marge du canevas, et le relève (D-157).
  - **[NON MESURÉ]** Combien des 5 cibles à plus de 200 mm, et des 6 entre 148 et 199 mm, seraient refusées ou cliquées en marge. « Déplacer la vue » est coupé.
  - Sans ces 5 cibles, le gain à la lettre serait de +17 justes. [FAIT, par soustraction]
- **Ordre de la chaîne** : au rejeu, la chaîne suit les cuts visités par Mic, dans l'ordre des cuts. La passe d'Ariane visiterait sa propre sélection : plus de cuts, donc d'autres appuis. **[NON MESURÉ]**
- **Capture** : les cas utilisent la capture de la première visite de Mic, souvent partielle. Celle d'Ariane prend les deux rails. **[NON MESURÉ]** L'effet de cette différence sur ces différés.

## 7. Rejouer

Les cas et les tables sont hors dépôt (dossier de travail : `zones/cas/`, `adv/tables/`). Seules les six parties d'apprentissage sont passées : le manifeste refuse les autres.

```
P="--partie 1:12 --cas zones/cas/cas-1-12.jsonl --table adv/tables/t-1-12.json \
   --partie 1:13 --cas zones/cas/cas-1-13.jsonl --table adv/tables/t-1-13.json \
   --partie 1:17 --cas zones/cas/cas-1-17.jsonl --table adv/tables/t-1-17.json \
   --partie 1:24 --cas zones/cas/cas-1-24.jsonl --table adv/tables/t-1-24.json \
   --partie 1:29 --cas zones/cas/cas-1-29.jsonl --table adv/tables/t-1-29.json \
   --partie 2:1  --cas zones/cas/cas-2-1.jsonl  --table adv/tables/t-2-1.json"
nice -n 10 node tools/relecture-autonome.cjs etudier $P --json ref.json                          # référence (≈ 3 min)
nice -n 10 node tools/relecture-autonome.cjs etudier $P --differes-en-chaine --json essai.json   # option (≈ 8 min)
node tools/relecture-autonome.cjs comparer --ref ref.json --essai essai.json                     # § 4 et § 5.1
nice -n 10 node tools/relecture-autonome.cjs greffer --ref ref.json $P --json greffe.json         # § 5.2 et § 5.3 (< 1 s)
node --test tests/differes-en-chaine.test.cjs tests/relecture-autonome.test.cjs                 # essais
```

`etudier` affiche le détail des différés (§ 5.3) quand l'option est active ; `greffer` l'affiche toujours. Le contrôle « sans l'option, à l'identique » compare `ref.json` à la sortie de `etudier` lancée avec l'outil de `claude/50-base`.
