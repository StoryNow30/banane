# PN robuste : confirmer un PN par deux cœurs consécutifs (5.0, 17 octobre 2026)

Branche `claude/50-pn-robuste`, partie de `claude/50-base` (97dfca7). Contexte :
- **D-174** : dans la test 7, la passe de relecture pourra **corriger les verts des zones PN** (fiche `RELECTURE_AUTONOME.md` : 36 corrections justes sur 36 en validation croisée).
- Une zone PN fausse ferait donc agir Ariane sur des verts hors PN.
- L'audit P-5 (B2) a montré qu'**une fausse zone PN apparaît dès qu'on capture des verts** : 443–456 en partie 1 du second projet, sur l'union des captures du lot et de l'Écho.

Deux hypothèses de l'audit (H6, H7) sont mesurées ici, sur les seules parties d'apprentissage. `src/engine.js` n'est pas touché.

## 1. En bref

| Question | Réponse |
|---|---|
| **Référence** (deux cœurs à 3 cuts au plus) | Captures du lot seul : 17 PN de Mic sur 17 retrouvés (1:12, 1:13 et 1:29 : 16 ; 2:1 : 1), 0 fausse zone. Union lot + Écho : 17 sur 17, mais **1 fausse zone, 443–456** (2:1). |
| **H6** (deux cœurs consécutifs parmi les cuts vus) | **Tient partout** : 17 sur 17, **0 fausse zone**, dans toutes les conditions (lot seul, union dans les trois ordres, Écho seule). Sur les captures du lot, les zones sont identiques à la référence, et pas une évaluation ne change (1 379 cuts sur quatre lots). |
| **H7** (au moins une rainure par cœur) | Zones justes sur ces parties, mais **critère de l'audit non tenu** : 2 vrais cœurs perdus (1:12 cut 7286, 1:13 cut 6934 : aucune rainure), et 396 reste un cœur dans la capture de l'Écho (une rainure). Elle n'écarte le faux PN que parce que la seule capture de 450 n'a pas de rainure. |
| **H6 + H7** | Mêmes zones que H6, avec les pertes de cœurs de H7 : rien de plus. |
| **Décision** | **H6 est codée et livrée active** (`pn.consecutifs: true` dans `src/regles-metier.js`, figée dans `datasets/reglages-figes.json`). H7 n'est pas codée. |
| **Relecture (PN 36 sur 36)** | Étude relancée dans le mode de la fiche : **identique octet pour octet**. Zone PN : **36 corrections justes sur 36 actions, 0 erreur, 0 cut abîmé, 0 mauvaise voie**. Les réglages proposés sont inchangés. |
| **Ombre au lot et commandes ESV** | Sur les quatre lots d'apprentissage, l'ombre est identique cut par cut. Seuls les seuils du premier événement portent la clé de plus. Un essai du service worker montre un cas où l'ombre change (PN confirmé ou non) : commandes ESV, rails, enregistrements, événements métier et décisions restent identiques octet pour octet. La règle `pn-chaque-cut` est coupée au lot. |

## 2. Données et méthode

### 2.1 Parties

- **Apprentissage seulement** (`datasets/manifeste-parties.json`) : 1:12, 1:13, 1:17, 1:24, 1:29 et 2:1. Aucune partie réservée n'a été lue.
  - Les parties 2 à 9 du second projet ne sont pas listées au manifeste : elles sont réservées. Le chiffre de l'audit sur ces parties (« 21 zones sur 21 avec H6 ») n'a **pas** été refait ici, et rien n'y a été réglé.
- **PN de Mic** : 16 en 1:12, 1:13 et 1:29 (6, 6 et 4), 1 en 2:1 (405–409). Ce sont les 17 PN de `REGLES_METIER.md`.
- 1:17 et 1:24 n'ont pas de liste :
  - 1:17 : un cœur seul (1028), aucune zone ;
  - 1:24 : deux zones « à confirmer » (6569–6585 et 8518–8535). On y vérifie seulement qu'aucune variante ne les perd ni n'ajoute de zone.

### 2.2 Ce qu'on lit

Pour chaque cut, la surface du module (`surface` : `flushPct`, quarts, cœur), et le nombre de rainures lues par `src/level-crossing.js` (`read`) sur les mêmes points.
- **Lot** : le journal et le corpus de chaque lot, dans l'ordre du lot, comme `tools/regles-metier.cjs lot`.
- **Écho** : la meilleure capture de la première visite de Mic, comme `tools/regles-metier.cjs echo`.

| Partie | Captures du lot | Cuts visités à l'Écho | dont avec capture |
|---|--:|--:|--:|
| 1:12 | — (partie d'un opérateur humain) | 108 | 82 |
| 1:13 | — | 224 | 154 |
| 1:17 | 268 | 795 | 186 (export partiel) |
| 1:24 | 515 | 263 | 40 (nuages purgés) |
| 1:29 | 245 | 821 | 590 |
| 2:1 | 351 | 765 | 439 |

### 2.3 Conditions

- **(a) captures du lot seul**, dans l'ordre du lot. 1:12 et 1:13 n'ont pas de lot.
- **(b) union des captures du lot et de l'Écho**, dans l'ordre des cuts. Pour un cut vu des deux côtés, la capture du lot est préférée : la relecture ne visite que des verts. C'est ce que verra une relecture qui capture les verts. Pour 1:12 et 1:13, (b) est l'Écho seule.
- **Contrôles** :
  - **b-écho** : union, capture de l'Écho préférée ;
  - **b-ordre** : le lot dans son ordre, puis les cuts que seule l'Écho a vus, dans l'ordre des cuts (relecture après le lot) ;
  - **Écho seule**, pour 1:29 et 2:1 (lignes « Écho » de `REGLES_METIER.md`).

### 2.4 Mesures

- **PN retrouvés** : PN de Mic touchés par une plage à contrôler.
- **Fausse zone** : plage qui ne touche aucun PN de Mic.
- **Étendue** : nombre de cuts des plages à contrôler (4 cuts avant, 6 après).
- **Corrections PN de Mic** : cuts que Mic a corrigés de plus de 10 mm (jeu d'apprentissage) dans un PN de sa liste avec ses marges, ou dans la plage d'une zone vraie de la référence. On compte celles que les plages de la variante couvrent.

Le détecteur passe par le module lui-même (`evaluer` et `noter`, avec le réglage de la variante). Une copie indépendante de la logique, écrite avant le codage, donne les mêmes chiffres : 100 comparaisons sur 100.

## 3. Référence : le détecteur d'avant

| Partie | Condition | Cuts lus | Zones | PN de Mic | Fausses zones | Étendue | Corrections PN de Mic couvertes | Plages |
|---|---|--:|--:|--:|--:|--:|--:|---|
| 1:12 | (b) Écho | 82 | 6 | 6/6 | 0 | 116 | 30/30 | 3944–3965, 6231–6248, 7275–7293, 7883–7901, 8379–8397, 9068–9086 |
| 1:13 | (b) Écho | 154 | 6 | 6/6 | 0 | 112 | 21/21 | 123–141, 1284–1303, 6099–6117, 6926–6943, 8055–8072, 9454–9471 |
| 1:17 | (a) lot | 268 | 0 | liste absente | — | 0 | — | — |
| 1:17 | (b) union | 400 | 0 | liste absente | — | 0 | — | — |
| 1:24 | (a) lot | 515 | 2 | liste absente | — | 35 | — | 6569–6585, 8518–8535 |
| 1:24 | (b) union | 536 | 2 | liste absente | — | 35 | — | idem |
| 1:29 | (a) lot | 245 | 4 | 4/4 | 0 | 64 | 13/13 | 1652–1669, 3342–3356, 5977–5992, 6466–6480 |
| 1:29 | (b) union | 650 | 4 | 4/4 | 0 | 64 | 13/13 | idem |
| 2:1 | (a) lot | 351 | 1 | 1/1 | 0 | 14 | 13/14 | 401–414 |
| 2:1 | (b) union | 564 | 2 | 1/1 | **1** | 28 | 13/14 | 401–414, **443–456** |

- **Total en (a)** : 5 PN de Mic sur 5 pour les parties à lot avec liste (1:29 et 2:1), 0 fausse zone. Avec 1:12 et 1:13 (Écho seule) : **17 sur 17**. C'est le chiffre de `REGLES_METIER.md`, retrouvé à l'identique : mêmes plages, 58/58 cuts de PN de Mic couverts en 1:29, 98/98 en 1:12, 95/95 en 1:13.
- **En (b)** : 17 sur 17, mais **une fausse zone** : en 2:1, le cœur 447 (lot) et le cœur 450 (Écho) sont à 3 cuts, alors que 448 et 449 sont vus entre eux sans chaussée. C'est le constat de l'audit, reproduit.
- **Contrôles** :
  - b-écho : la fausse zone disparaît (dans la capture de l'Écho, 447 n'est pas un cœur) ;
  - b-ordre : elle reste ;
  - Écho seule : 1:29 donne 4/4 (57/58 cuts), 2:1 donne 1/1 (401–412), comme dans la fiche.
- **Correction 2:1 non couverte (415)** : elle est dans la marge de 6 cuts après le PN de Mic (405–409), juste après la plage 401–414. Elle n'est couverte par aucune règle, référence comprise. C'est la voie décalée de l'ADV 2 (207 mm), pas le PN.

## 4. Variantes

### 4.1 Zones, par partie et par condition

Dans toutes les conditions, H6, H7 et H6 + H7 donnent **les mêmes zones que la référence**, sauf là où la référence se trompe :

| Partie | Condition | Référence | H6 | H7 | H6 + H7 |
|---|---|---|---|---|---|
| 1:12 | (b) | 6/6, 0 fausse, 116 cuts | 6/6, 0, 116 | 6/6, 0, 116 | 6/6, 0, 116 |
| 1:13 | (b) | 6/6, 0, 112 | 6/6, 0, 112 | 6/6, 0, 112 | 6/6, 0, 112 |
| 1:17 | (a), (b) | 0 zone | 0 | 0 | 0 |
| 1:24 | (a), (b) | 2 zones (à confirmer), 35 | 2, 35 | 2, 35 | 2, 35 |
| 1:29 | (a), (b) | 4/4, 0, 64 | 4/4, 0, 64 | 4/4, 0, 64 | 4/4, 0, 64 |
| 2:1 | (a) | 1/1, 0, 14 | 1/1, 0, 14 | 1/1, 0, 14 | 1/1, 0, 14 |
| **2:1** | **(b)** | 1/1, **1 fausse (443–456)**, 28 | **1/1, 0, 14** | **1/1, 0, 14** | **1/1, 0, 14** |
| 2:1 | b-écho | 1/1, 0, 14 | 1/1, 0, 14 | 1/1, 0, 14 | 1/1, 0, 14 |
| **2:1** | **b-ordre** | 1/1, **1 fausse (443–456)**, 28 | **1/1, 0, 14** | **1/1, 0, 14** | **1/1, 0, 14** |
| 1:29 | b-ordre | 4/4, 0 fausse (plus un doublon, voir § 9) | idem | idem | idem |

- **Toutes les variantes, toutes les conditions** : 17 PN de Mic sur 17, 0 fausse zone, plages des PN de Mic identiques à celles de la référence. Les corrections PN de Mic couvertes sont les mêmes que pour la référence : 30/30, 21/21, 13/13 et 13/14.
- **Écho seule** (1:29 et 2:1) : les trois variantes donnent les zones de la référence (4/4 et 1/1, aucune fausse zone).
- **Critère de réussite** (17 sur 17, 0 fausse zone en (b), étendue qui couvre toujours les corrections PN de Mic) : tenu par H6, par H7 et par H6 + H7 **au niveau des zones**.

### 4.2 H7 au niveau du cœur

Critère de l'audit pour H7 : « 0 vrai cœur perdu, 396 écarté ». Un vrai cœur est dans un PN de Mic, un faux cœur hors de tout PN de Mic (parties avec liste).

| Partie | Source | Vrais cœurs | sans rainure (perdus par H7) | à une rainure | Faux cœurs (rainures) | écartés par H7 |
|---|---|--:|---|---|---|---|
| 1:12 | Écho | 43 | **7286** | 9 | 4497 (2) | — |
| 1:13 | Écho | 38 | **6934** | 10 | — | — |
| 1:29 | lot | 21 | — | 0 | — | — |
| 1:29 | Écho | 20 | — | 5 | — | — |
| 2:1 | lot | 4 | — | 406, 407 | 396 (0), 447 (1), 2913 (2) | 396 |
| 2:1 | Écho | 2 | — | 405 | 396 (1), 450 (0), 2913 (2) | 450 |

- **H7 perd 2 vrais cœurs sur 128** et n'écarte que 2 faux cœurs sur 7. Elle garde :
  - 447 (une rainure), qui fait la moitié du faux PN ;
  - 2913 (deux rainures) ;
  - 396 dans la capture de l'Écho (une rainure) ;
  - 4497 en 1:12 (deux rainures ; Mic a parcouru 4495–4499 comme un PN sans le lister, question ouverte).
- Elle n'écarte le faux PN 443–456 que parce que **la seule capture de 450** n'a pas de rainure. Une autre capture de 450 suffirait à le rouvrir.
- En 1:24, les 11 cœurs des deux zones à confirmer ont deux rainures ; en 1:17, 1028 aussi.
- **Exiger deux rainures** (essai) rétrécit les plages des vrais PN : 1:12 tombe à 92/98 cuts de PN de Mic couverts, 1:13 à 94/95. Écarté.

**Conclusion sur H7** : la rainure n'est pas une preuve indépendante. C'était déjà le constat de l'audit sur les cuts ordinaires : 140 sur 285 ont deux rainures. Elle n'apporte rien que H6 n'apporte déjà, et elle perd des vrais cœurs. **Non retenue, non codée.**

### 4.3 Le cas 407

À l'Écho de 2:1, 407 est vu mais **illisible** : deux quarts ont moins de 30 points, donc il n'a pas de quart minimal ; `flushPct` vaut 86. Pour H6, c'est un cut vu sans chaussée.
- **Écho seule** : 405 et 406 sont des cœurs consécutifs, ils confirment le PN (401–412). 407 vient après : il ne casse rien.
- **b-écho** : même confirmation par 405–406, puis 408 (capture du lot) étend la zone à 401–414.
- **Risque restant** : un PN dont les **deux seuls** cœurs seraient séparés par une capture illisible ne serait pas confirmé. Aucun cas dans les données.
  - Variante mesurée : « un cut illisible ne sépare pas » (seuls les cuts lus sur trois quarts au moins comptent). Elle donne les mêmes chiffres partout.
  - Elle n'est pas retenue : elle est plus permissive, et aucun cas ne la demande. Une zone manquée coûte une relecture de Mic ; une fausse zone ferait agir Ariane.

## 5. Ce qui est codé

`src/regles-metier.js`, réglage `DEFAULTS.pn.consecutifs` (**livré à `true`**, figé dans `datasets/reglages-figes.json`) :
- un cœur antérieur à 3 cuts au plus ne confirme le PN que si **aucun cut vu sans chaussée** ne tombe entre les deux ;
- un cut est « vu » s'il a une surface lue (`flushPct` présent) ; un cut sans capture n'est pas vu ;
- le dernier regard sur un cut fait foi : un cut d'abord vu sans chaussée, puis revu comme cœur, ne sépare plus rien ;
- l'**extension** d'une zone déjà confirmée (cœur dans la zone ou dans sa marge d'après) est **inchangée** ;
- les cuts vus sans chaussée sont **tous** gardés dans la mémoire du lot (`nonCoeurs` : des numéros, comme la mémoire des lignes).
  - Une première version les bornait à 80 cuts, comme les autres listes. Au rejeu « lot puis relecture » de 2:1, 448 et 449 étaient oubliés quand la relecture arrivait à 450, et le faux PN revenait.
  - Corrigé, et un essai le garde.
- `consecutifs: false` redonne exactement la règle d'avant. `tools/regles-metier.cjs` la montre à côté du détecteur retenu (variante `sans-consecutifs`).
- `version` reste `regles-metier-v1`. Les seuils du premier événement de chaque lot disent quelle règle a tourné (`pn.consecutifs`).

Essais, écrits **avant** le code et vus rouges, sauf deux. L'essai du cas 407 décrit un comportement que la règle d'avant avait déjà. L'essai « relecture après un lot long » a été écrit après le rejeu qui a montré l'oubli de la mémoire bornée ; il était rouge contre la première version.
- `tests/regles-metier.test.cjs` :
  - faux PN 447/450 écarté, et rouvert par `consecutifs:false` ;
  - cuts sans capture entre deux cœurs ;
  - cas 407 ;
  - extension inchangée ;
  - relecture après un lot de 400 cuts, dans les deux sens ;
- `tests/regles-metier-outil.test.cjs` : variante `sans-consecutifs` ;
- `tests/reglages-figes.test.cjs` : `pn.consecutifs` figé à `true` ;
- `tests/regles-metier-pn-consecutifs-sw.test.cjs` : service worker réel (§ 8).

## 6. Rejeu de l'outil dans le mode des tables de la relecture

`tools/regles-metier.cjs`, module livré (H6), mêmes entrées et mêmes arguments que le rejeu qui a produit les tables de `RELECTURE_AUTONOME.md` : lot pour 1:17, 1:24, 1:29 et 2:1 ; Écho pour 1:12 et 1:13.
- **Zones PN et zones d'ADV identiques à celles des tables**, pour les six parties.
- **Toute la sortie de l'outil est identique octet pour octet à l'ancienne** (règles, différés, verts signalés, zones, variantes), sauf les seuils, qui portent `pn.consecutifs`. Ce rejeu a été fait avant l'ajout de la ligne `sans-consecutifs` au rapport de l'outil ; depuis, la sortie porte aussi cette ligne.
- **Cut par cut** (condition (a), ordre du lot) : 268, 515, 245 et 351 évaluations (zone, règles, verdict), **0 différente** avec et sans `consecutifs`.

## 7. La relecture : PN 36 sur 36

Étude relancée : `tools/relecture-autonome.cjs etudier`, dans le même mode que `RELECTURE_AUTONOME.md`.
- Mêmes six parties d'apprentissage, mêmes cas, mêmes relevés de SKIP.
- Tables dont les zones PN viennent de l'outil des règles métier avec le module livré (§ 6).

**Résultat** :
- Les tables reconstruites sont identiques à celles de la fiche.
- **L'étude est identique octet pour octet à celle de la fiche**, réglages proposés compris : `datasets/relecture-reglages-proposes.json` est inchangé.

**Zone PN** (verts, règle de service, validation croisée) : **36 actions, 36 corrections justes, 0 erreur de plus de 10 mm, 0 cut abîmé, 0 mauvaise voie**. Cela porte sur 167 verts jugeables, dont 49 que Mic a corrigés de plus de 10 mm.

| Partie | Actions | Corrections justes | Erreurs | Abîmés | Mauvaise voie |
|---|--:|--:|--:|--:|--:|
| 1:12 | 20 | 20 | 0 | 0 | 0 |
| 1:13 | 9 | 9 | 0 | 0 | 0 |
| 1:29 | 7 | 7 | 0 | 0 | 0 |
| 2:1 | 0 (1 vert jugeable) | 0 | 0 | 0 | 0 |
| 1:17, 1:24 | aucun vert de PN jugeable | | | | |

Toutes zones confondues, rien ne change non plus : 97 actions, 79 corrections justes, 0 mauvaise voie.

**Contre-épreuve : la règle d'avant sur l'union**, c'est-à-dire ce que verrait la test 7 sans H6.
- La table 2:1 reçoit la fausse zone 443–456. Les autres parties ont les mêmes zones qu'au lot, donc leurs tables ne changent pas.
- La zone PN de 2:1 passe de 14 à 26 cuts : 12 sont pris à l'ADV.
- Le seul vert de ces 12 cuts est 450, que Mic a corrigé de 194 mm (voie décalée de l'ADV 2). Il devient un vert de PN, donc corrigeable. Ariane s'y abstient : sa décision n'a pas de pose sûre.
- PN : toujours 36 sur 36, 0 mauvaise voie. La règle prudente a tenu, mais sur **un seul** vert, dans une zone d'ADV où Mic a corrigé de 194 à 259 mm chaque cut qu'il a relu.
- C'est ce risque que H6 retire, sans rien changer ailleurs.

## 8. Ombre au lot et commandes envoyées à ESV

- Sur les lots d'apprentissage, le réglage ne change rien à l'ombre (§ 6).
- Il **peut** la changer : un cœur, un cut vu sans chaussée, puis un cœur à 2 cuts. C'est ce que montre `tests/regles-metier-pn-consecutifs-sw.test.cjs`, avec le service worker réel, le moteur et GCV1 réels, ESV simulé et une surface fabriquée :
  - règle d'avant : PN confirmé au cut 114, plage 108–120, `pn-chaque-cut` déclenchée en ombre, 115 en marge ;
  - règle livrée : 114 reste un cœur non confirmé ; aucune règle PN.
- **Commandes ESV, rails, appels à l'adaptateur, enregistrements, événements métier et décisions du lot : identiques octet pour octet** entre les deux. On le vérifie :
  - avec le réglage livré (règles coupées) ;
  - avec le lot « grappe » de la test 6 (seule `grappe-differes` activée : 114 et 115 différés par la grappe dans les deux cas).
- La raison : la règle `pn-chaque-cut` est **coupée au lot** (`src/settings.js`, `reglesMetier`). La zone PN n'y commande rien.

## 9. Doutes et limites

- **Un seul faux PN dans les données** (2:1, 447/450). H6 l'écarte par construction : c'est le motif « deux faux cœurs isolés à 2 ou 3 cuts ». Deux faux cœurs **voisins** (un platelage de deux cuts) passeraient encore. Aucun cas dans les données, mais rien ne l'exclut.
- **Aucune partie réservée** : tous les chiffres sont des chiffres d'apprentissage. Le jugement viendra des prochaines Échos, en ombre.
- **L'union est une simulation** : les captures de l'Écho sont celles des visites de Mic, pas celles qu'Ariane fera en relecture. Une autre capture d'un vert peut faire ou défaire un cœur. En 2:1, la fausse zone dépend déjà de la capture retenue pour 447 (lot ou Écho).
- **Échos partielles** : 1:17 (186 captures sur 795 cuts visités) et 1:24 (40 sur 263) pèsent peu en (b). Les deux zones à confirmer de 1:24 n'ont aucune visite de Mic dans le jeu.
- **Ordre des captures** : on a mesuré l'ordre des cuts et l'ordre « lot puis relecture ». La relecture réelle suivra peut-être un autre ordre.
  - Le module n'étend que la **dernière** zone ouverte. En ordre « lot puis relecture », un cœur vu tard dans une zone plus ancienne ouvre une **seconde zone** qui recouvre la première (1:29 : 5977–5991 dans 5977–5992). Ce n'est pas une fausse zone, et c'est vrai avec et sans H6.
  - Non corrigé ici : hors du sujet, et cela changerait la sortie au lot.
- **Cas 407** : H6 stricte refuserait un PN dont les deux seuls cœurs seraient séparés par une capture illisible (§ 4.3).
- **La mémoire `nonCoeurs`** grandit avec les cuts vus du lot : quelques milliers de numéros au plus par lot, comme la mémoire des lignes. Elle est volatile, comme le reste de la mémoire des règles.
- **H7 n'est pas codée** : si la rainure doit être revue, il faudra la consigner en ombre d'abord. Elle coûte une lecture `read` de plus par cut.

## 10. Rejouer

Les entrées (journaux, corpus, Échos, jeux) restent hors dépôt. Les sorties ne portent que des numéros de cut, des comptes et des millimètres. Tout sous `nice -n 10` ; le rejeu de l'outil prend environ 9 minutes, l'étude environ 3 minutes.

```
# zones et variantes : même rejeu que REGLES_METIER.md § 10 ; la variante `sans-consecutifs` donne la règle d'avant
node tools/regles-metier.cjs lot  --partie 2:1 --journal J.json --corpus SEG.json [...] --jeu jeu-pr2p1.jsonl --pn 405-409 --sortie lot-p1.json
node tools/regles-metier.cjs echo --partie 1:12 --echo "dossier Écho" --jeu jeu-p12.jsonl --pn … --sortie echo-p12.json
# étude de la relecture (même mode que RELECTURE_AUTONOME.md § 11)
node tools/relecture-autonome.cjs etudier --partie 1:12 --cas cas-1-12.jsonl --table t-1-12.json --skip skip-1-12.jsonl … (les six parties) \
     --json etude.json --reglages reglages.json --date 2026-10-17
# essais
node --test tests/regles-metier.test.cjs tests/regles-metier-outil.test.cjs tests/regles-metier-pn-consecutifs-sw.test.cjs tests/reglages-figes.test.cjs
```
