# RM-12 : lire un vert sur N pendant le lot, coût et gain (19 octobre 2026)

Chantier RM-12 du projet Ariane (règles métier 5.0). Étude **hors ligne, mesure seulement**. Aucun code de l'extension ne change : `src/`, `datasets/reglages-figes.json` et le comportement du lot sont intacts (un essai le vérifie). L'outil de rejeu est `tools/lecture-verts.cjs`.

Conventions : les parties sont désignées par leur rang (« 2:11 » = projet 2, partie 11). Seuls des numéros de cut, des millimètres, des secondes et des minutes figurent ici. Règle D-195, corrigée par D-197 : tout se choisit sur les parties d'apprentissage. Les témoins 1:11 et 1:25 ne sont pas lus. 2:6, réservée, est lue une seule fois, à la fin, réglages figés (§ 7).

## 1. En bref

| Question | Réponse |
|---|---|
| **Le problème est-il réel ?** | Oui, mais rare. Sur les 6 parties d'apprentissage qui ont un lot et un Écho, le lot lit au moins 3 cuts dans **23 des 24 zones de Mic** (11 ADV, 13 PN). La 24e est l'ADV 6362–6424 de 2:11 : aucun cut du lot dedans, le plus proche est à 11 cuts. |
| **Gain, au mieux (l'Écho complet, le plafond)** | Zones de Mic retrouvées 23 → 24 sur 24. Grosses corrections de Mic (plus de 10 mm) hors zone : **47 → 39 sur 633** (marges livrées). Cuts à relire : 3 839 → 4 095 (+ 7 %). Le gain tient à **2 parties** : 2:11 (7 → 1) et 1:29 (7 → 5). |
| **Gain avec les marges de RM-2** (proposées, non figées) | Le lot seul est déjà à **8 sur 633** hors zone, 24 zones sur 24 ; l'Écho complet est à 7. Les marges de RM-2 reprennent presque tout ce que la lecture des verts apporterait. |
| **Coût (journaux de lot, 6 lots, 1 520 cuts lus)** | Une lecture sans pose coûte **0,9 s (médiane) à 1,5 s (moyenne)** à un cut d'écart, **1,4 s à 2,2 s** (médiane à moyenne) quand on avance de 4 à 10 cuts ; un cut posé coûte 2,6 s (médiane), 3,1 s (moyenne). Une partie compte environ 9 800 cuts dont le lot en décide 9 à 515 : il reste environ 9 500 verts. |
| **Temps ajouté, par partie** | 1 vert sur 10 : **+36 min** (27 à 43) ; sur 5 : **+66 min** (43 à 79) ; sur 3 : **+89 min** (63 à 111) ; sur 2 : **+134 min** (82 à 167). Le lot actuel dure **14 min** en moyenne (6 à 31) : il serait **3,6 à 10 fois plus long**. |
| **N recommandé** | **5**, avec un écart de confirmation de 5 (§ 5) : c'est le plus grand N qui retrouve les 24 zones de Mic dans toutes les phases. Mais **je ne recommande pas de l'activer sur ces chiffres** : 66 min de plus par partie pour 6 grosses corrections sur 633 (marges livrées) ou moins d'une (marges de RM-2). À soumettre à Mic avec un essai en ombre (§ 8). |
| **2:6** (lue une fois, N = 5 figé) | **PN 3931–3935 : non vu** (0 phase sur 5). **Zone 3478–3535 : vue dans 3 phases sur 5** (le lot seul ne la voit pas). Grosses corrections hors zone : 5 sur 35 dans les 5 phases, comme le lot seul (§ 7). |
| **Variante ciblée (RM-12b, § 11)** | Ne lire un vert sur N que dans les trous du lot (T = 400 cuts sans lecture, N = 3) : **22,6 min de plus par partie** au lieu de 89, grosses corrections hors zone 47 → 42,7 (40 en lisant partout). L'ADV 6362–6424 de 2:11 n'est retrouvée que dans 2 phases sur 3 ; le PN 3931–3935 de 2:6 n'est pas vu. Même conclusion : à ne pas activer sur ces chiffres. |
| **Limite principale** | Les nuages des verts viennent de l'Écho : seuls **1 033 verts sur 57 470 (1,8 %)** ont un nuage, et, dans les 4 parties jugeables, les deux tiers sont dans ou près d'une zone que Mic regardait. Les fausses plages ne peuvent pas se mesurer (§ 6, § 9). |

## 2. Méthode et données

### 2.1 Ce qui est simulé

- **Parties** : 1:17, 1:24, 1:29, 2:1, 2:10, 2:11, les seules d'apprentissage qui ont un lot et un Écho.
- **Cuts du lot** : la surface de la capture **du lot** (cache de RM-1, un par partie), pas celle de l'Écho. La différence compte : sur 2:1, 85 cuts du lot sur 243 donnent un autre résultat (alerte ou cœur) selon que l'on lit le lot ou l'Écho. Les 268 cuts du lot de 1:17 n'ont un nuage dans l'Écho que pour 60 d'entre eux ; 1:24, 19 sur 515.
- **Verts** : les cuts qui ne sont pas du lot, avec leur surface lue dans l'Écho (tous les points de la capture quand le cache de RM-1 existe, sinon les cas de RM-4). Seuls les verts que Mic a visités avec un nuage existent : 1 033 verts sur 57 470.
- **Un vert sur N** : un cut sur N parmi les verts, en comptant le rang parmi les verts (les cuts du lot ne comptent pas). N phases sont essayées (le premier vert lu peut être le 1er, le 2e, …) ; les tableaux donnent la moyenne et, entre crochets, le minimum et le maximum sur les phases. **N = 1** est le plafond, noté « Écho complet » : tous les verts à nuage.
- **Zones** : relevées dans l'ordre des cuts par `src/regles-metier.js`, comme au lot. Deux détecteurs :
  - **figé** : deux cœurs de chaussée, ou deux alertes d'ADV, à 3 cuts au plus l'un de l'autre ouvrent une zone ;
  - **adapté** : l'écart de confirmation passe à max(3, N), pour les PN et les ADV. À 3 cuts, deux lectures espacées de 4 cuts ou plus ne se confirment **jamais**.
- **Sélection et marges** : `selection` de `tools/relecture-autonome.cjs`, marges livrées (PN 4 et 6 cuts, ADV 30 et 30, abords du lot). Une seconde passe utilise les marges proposées de RM-2 (`datasets/marges-zones-proposees.json`).
- **Zones de Mic** : `datasets/lecture-verts-zones-de-mic.json` (11 ADV, 13 PN ; 2:11 découpée en cinq ADV pour que la première, 6362–6424, reste visible). 1:17 et 1:24 n'ont pas de liste.
- **Mesures** : zones retrouvées (une plage ou une zone de PN, marges comprises, recouvre la zone de Mic), cuts de ces zones dans la sélection (sur 2 084), grosses corrections de Mic hors zone + marge (sur 633), cuts à relire (comme RM-2, sans les rouges du lot), fausses plages (un cœur détecté sans zone de Mic à 10 cuts près ; seulement pour les parties qui ont une liste).
- **Contrôle du banc** : avec la surface de l'Écho pour les cuts du lot, le banc redonne exactement les chiffres de RM-2 pour chacune des 6 parties (par exemple 35 / 588, 1 / 1 111, 7 / 747 pour 1:17, 1:24, 1:29).

### 2.2 Ce que le journal sépare

Le journal du lot sépare la lecture de la pose : chaque cut a ses dates de navigation, de capture reçue, de proposition, de décision, de pose relue, de capture après pose et de validation (`tools/perf-lot.cjs`, décomposition du cycle). Les versions des 6 journaux vont de 4.9.0.12 à 4.9.5.7 : les plus anciennes sont plus lentes (1:17 : 3,8 s par cut posé). Les parties 2:10 et 2:11 ont de plus la **relecture après le lot**, qui lit des verts sans rien poser : ses durées sont une mesure directe d'une lecture sans pose (138 lectures).

## 3. Gain

### 3.1 Marges livrées

6 parties d'apprentissage (1:17, 1:24, 1:29, 2:1, 2:10, 2:11). Moyenne [minimum-maximum] sur les phases.

| Configuration | Verts lus avec nuage | ADV (sur 11) | PN (sur 13) | Cuts de zone dans la sélection (sur 2 084) | Grosses corrections hors zone (sur 633) | Cuts à relire | Plages sans zone de Mic (parties jugeables) |
|---|--:|--:|--:|--:|--:|--:|--:|
| **Lot seul (aujourd'hui)** | 0 | 10 | 13 | 1 425 | **47** | 3 839 | 0 |
| 1 vert sur 10, figé | 103 | 10,5 [10-11] | 13 | 1 437 | 45,4 [42-47] | 3 861 | 0 |
| 1 vert sur 10, adapté | 103 | 10,7 [10-11] | 13 | 1 468 | 41,5 [38-45] | 3 962 | 0 |
| 1 vert sur 5, figé | 207 | 10,8 [10-11] | 13 | 1 445 | 44,8 [42-47] | 3 880 | 0 |
| **1 vert sur 5, adapté** | 207 | **11** | 13 | 1 486 | **41,0 [40-42]** | 3 953 | 0 |
| 1 vert sur 3 (figé = adapté) | 344 | 11 | 13 | 1 516 | 40,0 | 4 005 | 0 |
| 1 vert sur 2 (figé = adapté) | 517 | 11 | 13 | 1 507 | 40,0 | 3 993 | 0 |
| **Écho complet (plafond)** | 1 033 | 11 | 13 | 1 563 | **39** | 4 095 | 0 |

Lectures :

- **Le détecteur figé ne sert qu'à 3 cuts et moins.** À 5 et 10 cuts, deux lectures ne se confirment jamais : il ne reste que l'allongement de zones déjà ouvertes par le lot. C'est pour cela que le détecteur « adapté » (écart de confirmation = N) est mesuré à côté. C'est un réglage **proposé, non figé**.
- **Le gain est petit et concentré.** Du lot seul à l'Écho complet : 47 → 39 grosses corrections hors zone, sur deux parties seulement.

| Partie | Mic > 10 mm | Lot seul (hors / cuts) | 1 sur 5 adapté | 1 sur 3 | Écho complet |
|---|--:|---|---|---|---|
| 1:17 | 203 | 32 / 685 | 32 / 704 | 32 / 709 | 32 / 712 |
| 1:24 | 108 | 1 / 1 190 | 1 / 1 190 | 1 / 1 190 | 1 / 1 190 |
| 1:29 | 122 | 7 / 755 | 6,2 / 798 | 5,7 / 812 | 5 / 821 |
| 2:1 | 172 | 0 / 734 | 0 / 739 | 0 / 742 | 0 / 760 |
| 2:10 | 1 | 0 / 21 | 0 / 21 | 0 / 21 | 0 / 21 |
| 2:11 | 27 | 7 / 454 | 1,8 / 500 | 1,3 / 531 | 1 / 591 |

- **2:11** : les sept grosses corrections sont 6391 (cœur de l'ADV, 19 mm), 6415 à 6419 (marge avant de l'ADV) et 7177 (isolé de Mic). La lecture de verts rattrape les six premières, par la zone 6362–6424 : une plage s'ouvre autour du 6391 dès qu'un vert voisin donne une alerte.
- **1:29** : la lecture de verts allonge la plage de la zone 7954–8066 aux deux bouts (7970 avant, 8089 après).
- **Le reste ne bouge pas.** 1:17 (32 hors zone) et 1:24 (1) n'ont aucune zone notée : les corrections de Mic y sont des abords, des cuts isolés, pas des zones oubliées. 2:1 et 2:10 sont à 0 hors zone avec le lot seul.

### 3.2 Avec les marges de RM-2

| Configuration | ADV (sur 11) | PN (sur 13) | Grosses corrections hors zone (sur 633) | Cuts à relire |
|---|--:|--:|--:|--:|
| Lot seul | 11 | 13 | **8** | 4 615 |
| 1 vert sur 10, adapté | 11 | 13 | 7,9 [7-8] | 4 710 |
| 1 vert sur 5, adapté | 11 | 13 | 7,6 [7-8] | 4 706 |
| 1 vert sur 3 | 11 | 13 | 7,3 [7-8] | 4 757 |
| 1 vert sur 2 | 11 | 13 | 7,5 [7-8] | 4 753 |
| Écho complet | 11 | 13 | **7** | 4 795 |

Avec la marge avant de 40 cuts, la plage de 6425–6488 recouvre déjà 6362–6424 : la zone est « retrouvée » par le lot seul. Il ne reste à gagner que le cut 6391 de 2:11 : **une grosse correction sur 633**, pour 180 cuts de plus à relire. Si RM-2 est activé un jour, la lecture de verts n'a presque plus rien à apporter sur ces six parties.

### 3.3 Fausses plages

Aucune fausse plage n'apparaît dans l'échantillon, pour aucun N, et c'est **sans valeur** : sur les 4 parties jugeables, 576 des 872 verts à nuage (66 %) sont à moins de 30 cuts d'une zone de Mic (208 sur 223 en 2:1, 210 sur 231 en 2:11, 10 sur 12 en 2:10). Les 296 autres donnent 1 alerte et 0 cœur. La partie 1:17, sans liste, donne 5 alertes sur 140 verts (3,6 %) : on ne sait pas si ce sont des ADV oubliées ou de fausses alertes ; 6 à 8 plages de 1:17 et 1:24 ne sont pas jugeables, avec le lot seul comme avec la lecture de verts.

Ordre de grandeur, **non mesuré**, par partie de 9 500 verts : si une lecture donne une fausse alerte avec la probabilité p, et si deux lectures voisines doivent s'accorder, il y a environ R × p² fausses plages (R : nombre de lectures). Avec p = 0,34 % (1 alerte sur 296) : 0,04 ou moins. Avec p = 3,6 % (le taux de 1:17) : 4 à 1 par partie selon N (N = 3 à 10). Elles viennent en paquets (un quai, une autre voie), donc plus que ce calcul. Chaque fausse plage coûte environ 40 à 90 cuts à relire (+ 43 cuts pour la plage de 1:17 à N = 10), pour 640 cuts à relire par partie aujourd'hui. D'où une fourchette de **0 à environ +60 %** de cuts à relire, que seule une mesure en ombre peut trancher.

## 4. Coût

### 4.1 Une lecture sans pose contre un cut posé

Six journaux de lot, 1 520 cuts lus (1 203 posés, 313 différés). Secondes.

| | n | Médiane | Moyenne | p90 |
|---|--:|--:|--:|--:|
| **Cut posé, du cut visé à la validation** | 1 203 | 2,59 | 3,10 | — |
| Lecture sans pose, chemin du lot (navigation → capture, analyse, décision) | 1 203 | 1,92 | 2,37 | — |
| Navigation → capture reçue seule (chargement du nuage), tous les cuts lus | 1 520 | 1,37 | 1,87 | — |
| **Lecture sans pose de la relecture**, mesurée par la page (2:10 et 2:11) | 138 | **0,91** | **1,53** | 3,9 |
| dont la capture / le calcul | 138 | 0,77 / 0,11 | 1,38 / 0,12 | 3,8 / 0,15 |
| Analyse GCV1 / décision du lot | environ 1 520 | 0,32 / 0,08 | 0,42 / 0,11 | — |

Par partie (médiane / moyenne, en secondes) :

| Partie (version du journal) | Cut posé | Lecture sans pose, chemin du lot |
|---|---|---|
| 1:17 (4.9.0.12) | 3,76 / 3,79 | 3,14 / 3,10 |
| 1:24 (4.9.0.15) | 2,85 / 3,24 | 2,35 / 2,45 |
| 1:29 (4.9.5.3) | 1,78 / 2,50 | 1,41 / 2,06 |
| 2:1 (4.9.5.3) | 2,33 / 2,79 | 1,56 / 1,97 |
| 2:10 (4.9.5.7, 9 cuts) | 2,43 / 3,43 | 1,65 / 2,64 |
| 2:11 (4.9.5.7) | 2,27 / 2,94 | 1,32 / 1,98 |

**Le journal sépare bien la lecture de la pose.** Une lecture sans pose coûte de **0,6 à 0,8 fois** un cut posé. Ce qui s'ajoute pour poser (pose, capture après pose, validation) pèse 0,4 à 1,0 s médians selon la partie.

### 4.2 Le temps dépend de la distance parcourue

Aller lire un vert à N cuts du précédent n'est pas aussi rapide que passer au cut suivant : ESV charge le nuage d'un autre endroit. Navigation → capture reçue, en avançant (tous les lots) :

| Distance | n | Médiane | Moyenne |
|---|--:|--:|--:|
| 1 cut | 927 | 0,87 | 1,43 |
| 2 cuts | 80 | 1,03 | 1,56 |
| 3 cuts | 55 | 1,19 | 1,56 |
| 4 à 5 cuts | 59 | 1,36 | 1,95 |
| 6 à 10 cuts | 87 | 1,67 | 2,17 |
| 11 à 30 cuts | 141 | 2,27 | 2,49 |
| 31 à 100 cuts | 84 | 2,91 | 3,32 |
| plus de 100 cuts | 83 | 3,72 | 4,13 |

Une mesure indépendante donne la même pente : dans la relecture de 2:10 et 2:11, l'intervalle médian entre deux lectures successives sans pose est de 0,70 s à 1 cut (104 cas), 1,02 s à 2 cuts (14), 2,23 s à 11 à 100 cuts (13), 4,32 s à plus de 100 cuts (11) ; 1,18 s à 4 ou 5 cuts et 2,04 s à 6 à 10 cuts, sur 1 et 3 cas seulement.

### 4.3 Projection

Chaque partie a environ 9 800 cuts (9 864 pour 2:1, 9 933 pour 2:10, 9 792 pour 2:11 ; 9 800 pris pour les autres) ; le lot en décide 268, 515, 245, 351, 9 et 131. Lectures = (cuts − cuts du lot) / N. Les durées sont celles du § 4.2 à la distance N, avec trois hypothèses :
- **bas** : la médiane de navigation → capture ;
- **centre** : la moyenne de navigation → capture, plus 0,11 s de calcul (celui d'une relecture) ;
- **haut** : la moyenne, plus l'analyse et la décision du lot (le chemin du lot, sans la pose).

| N | Lectures par partie | Minutes ajoutées par partie : bas / centre / haut | Part du lot actuel (14,2 min en moyenne ; 85,2 min pour les 6 lots) : bas / centre / haut | Capturé par partie | Journal de plus par partie |
|--:|--:|--:|--:|--:|--:|
| 10 | 958 | 27 / **36** / 43 | 187 / **257** / 304 % | 1,1 Go | 11 Mo |
| 5 | 1 916 | 43 / **66** / 79 | 306 / **464** / 559 % | 2,2 Go | 23 Mo |
| 3 | 3 193 | 63 / **89** / 111 | 446 / **626** / 783 % | 3,7 Go | 38 Mo |
| 2 | 4 790 | 82 / **134** / 167 | 580 / **942** / 1 177 % | 5,6 Go | 57 Mo |
| 1 (tous) | 9 580 | environ 245 | environ ×17 | environ 11 Go | environ 115 Mo |

- En pourcentage par partie, le lot actuel est très court : 6,4 min pour 2:11 (+574 % à N = 10, +2 107 % à N = 2), 30 min pour 1:24 (+117 % à N = 10, +429 % à N = 2). 2:10, dont le lot décide 9 cuts, est hors échelle.
- Les sauts longs du lot (plus de N cuts) deviendraient des sauts de N cuts : **1 à 1,8 min économisées par partie**, négligeable.
- Capturé : médiane par capture de 0,8 à 2,1 Mo selon la partie. Journal : environ 12 Ko par cut relu (fiches/RELECTURE_OMBRE.md).
- Non mesuré ici, mais écrit dans fiches/RELECTURE_OMBRE.md : un cut capturé sans pose par le lot coûte 6,1 lectures de nuage (médiane 5), contre 0,67 à 1,11 pour un vert passé par Mic. Le coût côté ESV peut donc dépasser le temps affiché.
- ESV écrit lui-même « vu » sur chaque cut affiché pour la première fois (même fiche, § 1) : lire 1 vert sur N marquerait de 960 à 4 800 cuts « vu » par partie. À faire trancher par Mic : ce marquage change l'état des cuts dans ESV, sans aucune pose.

## 5. Gain contre coût, et N recommandé

Marges livrées, détecteur adapté. Coût au centre.

| N | Zones de Mic retrouvées | Grosses corrections rattrapées (sur 8 possibles) | Cuts à relire de plus | Minutes de plus par partie | Minutes par grosse correction rattrapée (6 parties) |
|--:|---|--:|--:|--:|--:|
| 10 | 23,7 sur 24 (la zone 6362–6424 manque dans 3 phases sur 10) | 5,5 [2-9] | + 123 | 36 | 40 |
| **5** | **24 sur 24 dans les 5 phases** | **6,0 [5-7]** | + 114 | **66** | 66 |
| 3 | 24 sur 24 | 7,0 | + 166 | 89 | 76 |
| 2 | 24 sur 24 | 7,0 | + 154 | 134 | 115 |
| 1 (Écho) | 24 sur 24 | 8 | + 256 | environ 245 | environ 180 |

**Règle écrite avant de lire 2:6** (`FIGE.json` du scratchpad, § 7) : le plus grand N qui retrouve les 24 zones de Mic des 6 parties dans toutes les phases, avec le détecteur dont l'écart de confirmation suit N. C'est **N = 5**, écart de confirmation 5, marges livrées. À N = 10, la zone 6362–6424 manque dans 3 phases sur 10.

Ce que cela veut dire :

- **N = 5 est le moins cher qui tient** sur l'apprentissage, pas un bon marché : 66 minutes de plus par partie (le lot passe de 14 à 80 minutes), pour 6 grosses corrections sur 633 en marges livrées, **moins d'une** avec les marges de RM-2 (8 → 7,6). À ce prix, une grosse correction de plus rattrapée coûte environ 1 000 minutes de lot supplémentaires.
- **Une zone n'est vue que si elle reçoit deux lectures** (ou un cœur seul, option `pn.seule` de RM-2). Largeur des 24 zones d'apprentissage : 5, 13, 13, 14, 15, 16, 18, 19, 21, 21, 23, 24, 24, 50, 56, 63, 71, 81, 87, 113, 121, 126, 400, 690 cuts. Avec deux lectures sûres dans la zone, il faut une largeur d'au moins 2N : 23 zones sur 24 pour N = 3 et 5 (le PN de 5 cuts de 2:1 n'y est pas, il est vu par le lot), **16 sur 24 pour N = 10** (8 PN sur 13 sont trop étroits). Un petit PN posé entièrement en vert est donc invisible à N = 5 sans le cœur seul.
- **Le choix entre N = 3 et N = 5 est serré** : N = 3 rattrape une grosse correction de plus pour 23 minutes de plus par partie et garde le détecteur figé. Je garde 5 parce que la règle écrite le donne, et parce qu'elle ne dépend pas d'une seule grosse correction.

**Recommandation.** (1) Ne pas activer la lecture de verts sur ces chiffres. (2) Si Mic la veut quand même comme filet contre les zones posées entièrement en vert : N = 5, écart de confirmation 5, plus la marge de RM-2 « un cœur seul ouvre une zone » pour les petits PN ; coût : un lot environ 5,6 fois plus long. (3) Avant tout, un **essai en ombre sur une partie** : lire un vert sur 5 sans rien consigner d'autre que les alertes, puis faire juger les plages par Mic. C'est la seule façon de mesurer les fausses plages et le vrai coût (§ 8).

## 6. Les fausses plages, pourquoi elles ne se mesurent pas

- L'échantillon des verts est celui que **Mic a visité avec un nuage** : 1 033 verts sur 57 470 (1,8 %). Dans les 4 parties jugeables, 66 % de ces verts sont dans ou à moins de 30 cuts d'une zone qu'il a notée. Un lot réel lirait 5 000 verts par partie, presque tous loin de toute zone : c'est là que naissent les fausses alertes, et l'échantillon ne les contient pas.
- Dans les zones de Mic, seuls 33 à 60 % des cuts ont un nuage dans l'Écho (RM-1 : 1:29 140 sur 234, 2:1 420 sur 1 266, 2:11 206 sur 358). Le gain à N grand est donc **sous-estimé** (il y aurait plus de lectures dans les zones), et le coût en fausses plages **sous-estimé** aussi. Les deux biais vont dans des sens opposés et ne se compensent pas.
- Les plages de 1:17 et 1:24 ne se jugent pas (pas de liste de zones de Mic) : 6 avec le lot seul, 7 avec l'Écho complet.

## 7. 2:6, lue une fois

**Règle de lecture.** N, le détecteur et les marges sont figés **avant** la lecture (§ 5). Une seule exécution (un script, un seul chargement des cas et de la table de 2:6), résultats écrits, rien relancé. Aucun réglage n'est modifié d'après ce résultat. Les témoins ne sont pas lus.

**Réglage figé** (écrit avant la lecture, date 19/10/2026 à 08 h 28 UTC, lecture à 08 h 34) :
- N = 5, écart de confirmation 5 (PN et ADV), marges livrées ;
- règle : « la plus grande foulée N qui retrouve les 24 zones de Mic des 6 parties d'apprentissage dans toutes les phases, avec le détecteur dont l'écart de confirmation est adapté à N » ;
- **prédiction écrite avant la lecture** : PN 3931–3935 non vu à N = 5, parce qu'il a 5 cuts de large et ne reçoit qu'une lecture sur 5 ; zone 3478–3535 vue.

**Données de 2:6** : les cas et la table de RM-2/RM-4 (83 cuts du lot, 431 cuts visités par Mic, nuages de l'Écho). Les cuts du lot prennent la surface de l'**Écho** : la capture du lot de 2:6 n'a pas été reconstruite (il faudrait relire le corpus du lot, donc lire 2:6 une seconde fois), et les verts prennent les surfaces des cas (pas le cache de tous les points). C'est la méthode de RM-2 sur 2:6, pas celle des 6 parties d'apprentissage.

| | Lot seul | N = 5 figé (5 phases) | Écho complet |
|---|---|---|---|
| **PN 3931–3935** (cœur de chaussée non noté par Mic) | non vu | **non vu, 0 phase sur 5** | vu |
| **Zone 3478–3535** (aiguille 3505) | non vue | **vue dans 3 phases sur 5** | vue |
| Zones d'ADV de Mic retrouvées (sur 5) | 4 | 4 à 5 (5 dans 3 phases) | 5 |
| PN noté 7935–7957 | vu | vu | vu |
| Grosses corrections de Mic hors zone (sur 35) | 5 (3931 à 3935) | 5 dans les 5 phases | 0 |
| Cuts à relire | 464 | 490 à 576 (moyenne 537) | 603 |
| Plages sans zone notée par Mic | 2 | 2 | 3 |

- **La prédiction se vérifie** : le PN de 5 cuts est invisible à N = 5. Les 5 grosses corrections de 34 à 41 mm restent hors zone. Ce n'est pas une surprise : le PN est plus étroit que la foulée.
- **La zone 3478–3535** est vue dans 3 phases sur 5, pas dans toutes (le lot n'y lit que 2 cuts, tous deux différés). Ce n'est pas une garantie.
- **Pour information, sans rien en tirer** : à N = 2 et 3, le PN est vu dans 1 phase sur 2 et 1 sur 3 ; la zone 3478–3535 dans toutes les phases ; à N = 10, le PN n'est jamais vu et la zone 3478–3535 dans 2 phases sur 10. Avec les marges de RM-2 (qui ouvrent une zone sur un cœur seul), N = 5 voit le PN dans 4 phases sur 5 et ramène les grosses corrections hors zone à 0 dans 4 phases sur 5. Ces lignes ne changent ni N ni la recommandation.

**Écart de méthode à signaler.** Avant de figer N, j'avais lu les fiches de travail de RM-2 sur 2:6 (jugement des marges et examen de la partie), en cherchant la définition de la zone 3478–3535. J'y ai vu que le lot ne lit que 2 cuts dans cette zone, tous deux différés, et que le PN 3931–3935 a des cœurs sur 4 de ses 5 cuts. Aucune de ces informations n'a servi à choisir N : il sort de la règle écrite sur l'apprentissage. La prédiction n'utilise que la largeur du PN (5 cuts), donnée dans D-202.

## 8. Ce qu'il faudrait pour trancher

1. **Un essai en ombre sur une partie neuve** : le lot lit 1 vert sur 5 sans pose, consigne les alertes et les cœurs, et Mic juge les plages le lendemain à l'Écho. Mesure : fausses plages, temps réel, lectures de nuage côté ESV, cuts marqués « vu ». C'est la seule façon de lever les limites du § 9.
2. **Décider d'abord RM-2** : avec ses marges, le gain de la lecture de verts passe de 8 à moins de 1 grosse correction sur 633 (6 parties).
3. **Ne pas élargir N sans élargir les zones étroites** : un PN de moins de 2N cuts demande l'option « cœur seul ».
4. **Piste moins chère** (mesurée ensuite, § 11) : ne lire que là où le lot est resté longtemps muet (un trou de plus de quelques centaines de cuts entre deux cuts du lot). La mesure demande le profil des trous de chaque lot ; le lot de 2:11 en a un de 890 cuts autour de la zone manquée (5545 à 6435).

## 9. Limites

- **L'échantillon des verts biaise vers les zones que Mic regarde** : 1,8 % des verts, 66 % près d'une zone notée (§ 6). Le gain par lecture est donc surestimé près des zones et inconnu ailleurs ; les fausses plages ne sont pas mesurables.
- **Le gain repose sur une seule zone** : la zone 6362–6424 de 2:11 (6 grosses corrections) et la fin d'une zone de 1:29 (2). Sur 24 zones, une seule est invisible au lot ; la seule autre observée est le PN de 2:6, hors apprentissage.
- **N est un cut sur N parmi les verts, pas une position fixe** : les lectures dépendent du rang. Les phases rendent l'effet visible (par exemple 38 à 45 grosses corrections hors zone à N = 10).
- **Zones de Mic** : 1:17 et 1:24 n'ont pas de liste ; 1:29 et 2:1 viennent de fiches/DETECTION_ADV.md ; 2:11 est découpée en cinq. Une zone que Mic n'a pas notée est comptée « fausse ».
- **Surface du lot** : prise dans la capture du lot (cache de RM-1). Pour 2:6, dans l'Écho (§ 7).
- **Coût** : mesuré sur 6 lots d'avant 4.9.5.8, versions différentes. Il dépend de la distance parcourue et de la taille du nuage (2:1 : 2,1 Mo par capture contre 0,8 Mo). Les 6 lectures de nuage par capture de la fiche de relecture ne sont pas reprises dans les minutes.
- **Détecteur adapté** : écart de confirmation = N. C'est un réglage proposé ; son risque (fausses plages quand l'écart grandit) est celui que RM-1 avait mesuré en portant l'écart à 6, 10 et 20 (une plage de plus en 1:17).
- **Totaux de cuts** : 9 800 pour 1:17, 1:24 et 1:29 (la consigne), les vrais totaux pour 2:1, 2:10 et 2:11 (journaux).
- **ESV** : la lecture d'un vert écrit « vu » sur ce cut dans ESV (§ 4.3). Ce n'est pas une pose, mais ce n'est pas sans effet.

## 10. Rejeu

```
# Gain, 6 parties d'apprentissage (--surfaces-lot et --surfaces-echo : une ligne {"cut":…,"surface":{…}} par cut)
node tools/lecture-verts.cjs simuler --partie 1:29 --cas CAS.jsonl --table TABLE.json --surfaces-lot LOT.jsonl --surfaces-echo ECHO.jsonl \
    --partie 2:11 … --zones datasets/lecture-verts-zones-de-mic.json [--marges datasets/marges-zones-proposees.json] [--n 2,3,5,10] [--json S.json]
# Variante ciblée (§ 11) : --trous T1,T2 lit un vert sur N seulement dans les trous du lot ; --cout C.json (sortie JSON du mode cout) ajoute les minutes
node tools/lecture-verts.cjs simuler … --n 2,3,5 --trous 100,200,400 --cout C.json
# Coût, journaux de lot (les options --total, --lot et --minutes-lot se rapportent au dernier --journal)
node tools/lecture-verts.cjs cout --journal J.json --partie 11 --total 9792 --lot 131 --minutes-lot 6.4 --journal … [--json S.json]
node tools/lecture-verts.cjs essai       # partie et journal inventés
```

Un test (`tests/lecture-verts.test.cjs`) rejoue l'essai synthétique : un PN posé entièrement en vert, invisible au lot, vu à 1 sur 2 par le détecteur figé, jamais à 1 sur 5 par le détecteur figé, toujours à 1 sur 5 par le détecteur adapté. Une partie réservée ou un témoin est refusé sans `--juger-partie-reservee`.

Les cas et les tables de RM-4 ne sont pas dans le dépôt (ce sont des fichiers de travail) ; les surfaces du lot viennent du cache de RM-1.

## 11. Variante ciblée (RM-12b)

Mesure seulement, comme le reste de la fiche. Aucun code de l'extension ne change ; l'outil gagne une option (`--trous`) et, sans elle, ses sorties sont inchangées (un essai le vérifie).

### 11.1 En bref

| Question | Réponse |
|---|---|
| **Ce qui est lu** | Le lot lit ce qu'il lit. Quand **T cuts consécutifs** passent sans aucune lecture (entre deux cuts du lot, ou depuis le cut 0 jusqu'au premier), il lit ensuite **un vert sur N** jusqu'au cut du lot suivant. T = 100, 200, 400 ; N = 2, 3, 5. Rien n'est lu après le dernier cut du lot. |
| **Coût** | **17 à 63 minutes de plus par partie** (lot actuel : 14 min en moyenne), contre 66 à 134 minutes pour un vert sur N partout. Le couple retenu coûte **22,6 min** : le lot dure 2,6 fois plus (3,9 fois moins de minutes qu'un vert sur 3 partout, 89 min). |
| **Gain** | Grosses corrections de Mic hors zone : 47 → **42,7** (T = 400, N = 3), contre 40 en lisant partout ; plafond 39. Avec les marges de RM-2 : 8 → 7,3. |
| **ADV 6362–6424 de 2:11** | **Aucun couple ne la retrouve dans toutes les phases** : 1 phase sur 2 (N = 2), **2 sur 3 (N = 3)**, 2 sur 5 (N = 5), quel que soit T. Lire partout la retrouvait toujours (§ 11.4 dit pourquoi). |
| **Couple retenu** | **T = 400, N = 3** (règle de repli, § 11.5) : le moins cher des couples qui la retrouvent dans la plus grande part des phases. |
| **2:6** (lue une fois, couple figé) | **PN 3931–3935 : non vu** (0 phase sur 3), comme prédit : la première lecture du trou tombe au cut 4128 ou après, le PN est environ 200 cuts avant. Les 5 grosses corrections restent hors zone. Pour information : T = 100 ou 200 le voient dans une partie des phases (§ 11.6). |
| **Lecture** | Moins cher par grosse correction rattrapée qu'un vert partout (32 min contre 66, marges livrées), mais le filet est troué : une zone sur trois manque selon la phase, et un PN placé dans les T premiers cuts d'un trou est invisible. Avec les marges de RM-2, 23 min par partie rattrapent moins d'une grosse correction. |

### 11.2 Méthode

- **Parties, zones, mesures** : celles du § 2 (1:17, 1:24, 1:29, 2:1, 2:10, 2:11 ; marges livrées, détecteur adapté, écart de confirmation = max(3, N) ; N phases essayées, moyenne [minimum-maximum]). Un deuxième passage utilise les marges proposées de RM-2.
- **Trou** : du dernier cut lu `a` au cut du lot suivant `b`. Les lectures sont aux cuts `a + T + 1 + phase`, puis tous les N cuts, tant qu'ils sont avant `b`. La phase va de 0 à N − 1. Le début de la partie compte comme un trou qui part du cut 0. **Après le dernier cut du lot, rien n'est lu** : le lot est fini (c'est ce qui ménage 2:1 et 2:10, dont le lot s'arrête bien avant la fin de la partie).
- **Lectures utiles** : comme au § 2, seuls les verts que Mic a visités avec un nuage dans l'Écho (1,8 %) donnent une surface. Le nombre de **lectures** (pour le coût) compte en revanche tous les cuts lus, avec ou sans nuage.
- **Coût** : lectures × secondes d'une lecture sans pose à N cuts de distance (valeur « centre » du § 4.3 : 1,68 s à N = 2 et N = 3, 2,06 s à N = 5), puis moyenne sur les 6 parties. Les sauts longs du lot, qui deviennent des sauts plus courts, ne sont pas déduits (1 à 1,8 min par partie, § 4.3).
- **Zones de Mic** : fichier du § 2, avec deux vérités de plus (D-206) : le PN 3931–3935 de 2:6 (liste de 2:6 complétée avec ses notes : 5 ADV et le PN 7935–7957) et l'ADV 4006–4071 de 1:16 (partie sans liste complète : `liste: false`, vérité isolée).

### 11.3 Gain et coût, apprentissage

6 parties d'apprentissage, marges livrées. Repères : lot seul 47 grosses corrections hors zone, 3 839 cuts à relire, 10 zones d'ADV sur 11 ; lot actuel 14,2 min en moyenne.

| T | N | ADV 6362–6424 de 2:11 retrouvée | Grosses hors zone (sur 633) | Gagnées | Cuts à relire de plus | Lectures par partie | Minutes de plus par partie | Part du lot actuel | Minutes par grosse correction gagnée | Hors zone avec les marges de RM-2 (lot seul : 8) |
|--:|--:|---|---|--:|--:|--:|--:|--:|--:|---|
| 100 | 2 | 1 phase sur 2 | 43,5 [40-47] | 3,5 | + 40 | 2 273 | 63,4 | 446 % | 109 | 7,5 [7-8] |
| 100 | 3 | 2 sur 3 | 42,7 [40-47] | 4,3 | + 54 | 1 515 | 42,2 | 297 % | 59 | 7,3 [7-8] |
| 100 | 5 | 2 sur 5 | 44,6 [41-47] | 2,4 | + 22 | 909 | 31,3 | 220 % | 78 | 7,6 [7-8] |
| 200 | 2 | 1 sur 2 | 43,5 [40-47] | 3,5 | + 23 | 1 751 | 48,9 | 344 % | 84 | 7,5 [7-8] |
| 200 | 3 | 2 sur 3 | 42,7 [40-47] | 4,3 | + 38 | 1 168 | 32,5 | 229 % | 45 | 7,3 [7-8] |
| 200 | 5 | 2 sur 5 | 44,6 [41-47] | 2,4 | + 15 | 701 | 24,1 | 170 % | 60 | 7,6 [7-8] |
| 400 | 2 | 1 sur 2 | 43,5 [40-47] | 3,5 | + 23 | 1 218 | 34,0 | 239 % | 58 | 7,5 [7-8] |
| **400** | **3** | **2 sur 3** | **42,7 [40-47]** | **4,3** | **+ 38** | **812** | **22,6** | **159 %** | **32** | **7,3 [7-8]** |
| 400 | 5 | 2 sur 5 | 44,6 [41-47] | 2,4 | + 15 | 487 | 16,8 | 118 % | 42 | 7,6 [7-8] |

Comparaison avec RM-12 (§ 3.1, § 5 : un vert sur N partout, détecteur adapté) :

| | Grosses hors zone | Cuts à relire de plus | Minutes de plus par partie | Minutes par grosse correction gagnée |
|---|--:|--:|--:|--:|
| Lot seul | 47 | 0 | 0 | — |
| Partout, N = 5 | 41,0 | + 114 | 66 | 66 |
| Partout, N = 3 | 40,0 | + 166 | 89 | 76 |
| Partout, N = 2 | 40,0 | + 154 | 134 | 115 |
| **Trous, T = 400, N = 3** | **42,7** | **+ 38** | **22,6** | **32** |
| Écho complet (plafond) | 39 | + 256 | environ 245 | environ 180 |

Lectures :

- **T = 400 donne le même gain que T = 100** à chaque N (mêmes chiffres de zones et de grosses corrections), pour 1,9 fois moins de minutes. Tout le gain vient des trous de plus de 400 cuts. Le seul trou qui compte est celui de 2:11 (890 cuts, 5545 à 6435) ; en 1:29, la zone 7954–8066 touche la fin d'un trou de 721 cuts (7280 à 8002) et fait passer les grosses corrections de 7 à 6,7.
- **Le coût est dominé par trois parties** (T = 400, N = 3, minutes de plus) : 2:11 **52**, 2:1 36, 2:10 34,5 ; 1:29 8,5 ; 1:17 2,8 ; 1:24 1,5. 2:10 est un cas à part : son lot décide 9 cuts (0,5 min), le trou de 4 120 cuts coûte 35 min pour 0 grosse correction. 2:11 commence par un trou de 4 560 cuts (1 à 4 562), qui pèse plus de 1 380 lectures sans lien avec l'ADV manquée.
- **Le gain reste petit** : 4,3 grosses corrections sur 633 avec les marges livrées, 0,7 avec celles de RM-2. Il tient à deux parties (2:11 : 7 → 3 en moyenne, soit 1 quand la zone est vue et 7 sinon ; 1:29 : 7 → 6,7).
- **Les fausses plages** (§ 3.3) : 0 dans l'échantillon, sans valeur ici aussi ; les trous contiennent les verts les plus éloignés des zones de Mic, donc la limite du § 6 est plus forte, pas plus faible.

### 11.4 Pourquoi 2:11 n'est pas retrouvée dans toutes les phases

Lire partout (§ 5) retrouvait la zone 6362–6424 à chaque phase. Ici, non. Les alertes d'ADV de la zone sont éparses (8 alertes sur les 51 verts à nuage de 6362 à 6424 : 6390, 6391, 6394, 6407, 6411, 6412, 6414, 6418) et, avec un vert sur N, deux alertes ne se confirment que si elles sont lues à N cuts ou moins l'une de l'autre : cela dépend du reste de la division du numéro de cut par N, donc de la phase.

Lire partout retrouve la zone même quand les lectures de l'intérieur ne se confirment pas, grâce aux verts **6436 à 6454**, entre les cuts du lot 6435 et 6455, portent 8 alertes (6436, 6438, 6439, 6440, 6442, 6452, 6453, 6454). Lus avec le cut 6435 du lot, ils font un cœur d'ADV qui commence vers 6435 ; sa marge avant de 30 cuts atteint 6405 et recouvre la zone (le lot seul n'a de cœur qu'à partir de 6455, marge jusqu'à 6425 : un cut après la zone). Ces cuts sont **hors du trou** : la variante ciblée ne les lit pas. Elle ne garde que les lectures de l'intérieur, qui ne suffisent que si deux alertes tombent sur les bonnes lectures.

Piste non mesurée : prolonger la lecture sur quelques dizaines de cuts après la fin du trou (jusqu'au prochain cut du lot, ou une marge fixe). Elle rendrait la phase moins décisive. Elle n'est pas dans la mission, donc pas dans les chiffres.

### 11.5 Couple retenu

Règle écrite avant la première simulation (`FIGE-b.json`, fichier de travail hors dépôt, daté du 19/10/2026 à 10 h 18 UTC) : « parmi T = 100, 200, 400 et N = 2, 3, 5, le couple le moins cher dont l'ADV 6362–6424 de 2:11 est retrouvée dans **toutes les phases**, marges livrées, détecteur adapté ; égalité : le moins de cuts à relire ».

**Aucun couple ne la remplit** (§ 11.3). Règle de repli, écrite **après** la simulation d'apprentissage et **avant** toute lecture de 2:6 : « celui qui la retrouve dans la plus grande part des phases de 2:11, puis le moins cher en minutes ». Parts : 1/2 (N = 2), **2/3 (N = 3)**, 2/5 (N = 5) ; la plus grande part est à N = 3, et T n'y change rien (les trois T retrouvent la zone dans les mêmes phases). Le moins cher est **T = 400, N = 3 : 22,6 min par partie**.

Ce choix n'utilise aucun chiffre de 2:6. Il est donc **sensible** à une chose qu'il ne voit pas : T = 400 est le T le plus bas en coût, et le moins capable d'atteindre une zone proche du début d'un trou (§ 11.6).

### 11.6 2:6, lue une fois

**Règle de lecture.** Couple figé avant la lecture : T = 400, N = 3, marges livrées, détecteur adapté. Une seule exécution (un seul chargement des cas et de la table de 2:6), résultats écrits, rien relancé, aucun réglage modifié d'après le résultat. Les surfaces des cuts du lot viennent de l'Écho, comme au § 7. **Prédiction écrite avant la lecture**, d'après la seule géométrie du trou (le trou de 2:6 va du cut 3727 au cut 4450) : PN 3931–3935 non vu, parce que, avec T = 400, la première lecture du trou tombe au cut 4128 ou après, bien après le PN.

| | Lot seul | **T = 400, N = 3 (figé), 3 phases** | Écho complet |
|---|---|---|---|
| **PN 3931–3935** | non vu | **non vu, 0 phase sur 3** | vu |
| Zone ADV 3478–3535 | non vue | non vue, 0 phase sur 3 (entre des cuts du lot à moins de 110 cuts l'un de l'autre : aucun trou à lire, même à T = 100) | vue |
| Autres zones de Mic (4 ADV, PN 7935–7957) | vues | vues | vues |
| Grosses corrections hors zone (sur 35) | 5 (3931 à 3935) | 5 dans les 3 phases | 0 |
| Cuts à relire | 464 | 464 à 467 | 603 |
| Lectures, temps de plus | 0 | 1 632 à 1 635 lectures, **environ 45 min** (le lot de 2:6 n'est pas mesuré) | — |

- **La prédiction se vérifie.** Le PN commence 203 cuts après le début du trou (cut 3728) : tout T de 208 ou plus le manque, quel que soit N et quelle que soit la phase.
- **Pour information, sans rien en tirer** (les autres couples, calculés dans la même exécution) : PN 3931–3935 vu dans 1 phase sur 2 (N = 2) et 1 sur 3 (N = 3) pour T = 100 et T = 200, jamais à N = 5 ; avec les marges de RM-2 (qui ouvrent une zone sur un cœur seul), vu dans toutes les phases à N = 2 et 3 pour T = 100 et T = 200, dans 4 phases sur 5 à N = 5, jamais à T = 400. Coût de ces lectures : 41 à 93 min pour T = 100 ou 200, contre 45 min à T = 400, N = 3. La zone 3478–3535 n'est vue par aucun couple.
- **Ce que cela dit du réglage** : T doit rester inférieur à la distance qui sépare le début d'un trou des zones qu'on veut atteindre, et la distance à la zone n'est connue qu'après coup. Le PN de 2:6 est le seul cas observé hors apprentissage ; cela ne justifie pas de changer T.

**Écart de méthode à signaler.** Avant de figer le couple, je connaissais les bornes du trou de 2:6 (3727 à 4450) par la consigne de la mission. J'ai aussi ouvert deux fichiers de 2:6 avant le script de lecture, sans lien avec le choix : la liste des notes de Mic (pour compléter le fichier des zones) et la table, pour n'en lire que le nombre de cuts du lot (83), le premier (1) et le dernier (7951). Le choix du couple vient de l'apprentissage ; la prédiction n'en tire que le fait que T = 400 dépasse la distance du PN au début du trou. Les cas de 2:6 et le détail des trous n'ont été chargés qu'une fois, par le script de lecture.

### 11.7 Ce que cela change à la recommandation

- La variante ciblée coûte **de 3 à 4 fois moins** que lire partout (22,6 min contre 66 à 89), et **32 min par grosse correction gagnée** contre 66 à 76. Le temps de lot est multiplié par 2,6 au lieu de 5,6 à 7,3.
- Mais elle **ne tient pas ce qu'elle visait** : elle ne retrouve l'ADV de 2:11 que dans 2 phases sur 3, et elle manque le PN de 2:6 par construction à T = 400. Pour 4,3 grosses corrections sur 633 (0,7 avec les marges de RM-2), le coût reste de 23 min par partie, dont 2:11 : 52 min et 2:10 : 34,5 min pour des lots de 6 et de 0,5 min.
- Elle ne change pas la recommandation du § 5 : ne pas l'activer sur ces chiffres. Si Mic veut tout de même un filet : (1) décider d'abord RM-2, qui reprend déjà presque tout ; (2) prolonger la lecture après la fin du trou (§ 11.4) avant de mesurer de nouveau ; (3) un essai en ombre sur une partie neuve, comme au § 8.

### 11.8 Limites

- **Un seul cas pour l'ADV** : la zone 6362–6424 de 2:11 décide du couple retenu, avec 2 ou 3 phases possibles à N = 2 et 3. Les parts 1/2, 2/3 et 2/5 sont trois mesures sur un seul cas.
- **Les mêmes limites que RM-12** : seuls 1,8 % des verts ont un nuage (§ 6) ; les lots mesurés datent d'avant la version 4.9.5.8 ; le coût d'une lecture dépend de la distance et de la taille du nuage.
- **Pas de lecture après le dernier cut du lot** : si le lot continuait jusqu'à la fin de la partie, 2:1 (3 700 cuts après le dernier), 2:10 (5 800) et 1:17 (2 200) auraient chacune un long trou de plus, donc un coût plus élevé.
- **Les sauts du lot ne sont pas déduits** : 1 à 1,8 min par partie (§ 4.3).
- **Deux vérités ajoutées** (PN de 2:6, ADV de 1:16) : la seconde (1:16) ne sert à aucune mesure ici (1:16 n'est pas dans les 6 parties).
