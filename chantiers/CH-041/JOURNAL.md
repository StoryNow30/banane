# CH-041 : journal de recherche (la recherche large sans son temps de calcul)

Branche `chantier/CH-041`, partie du tronc 4.9.5.35. Qualifications : ÉTABLI = compté par script sur les exports de `banane-data` ; PROBABLE = lecture ; SUPPOSÉ = hypothèse. Aucun numéro de cut, aucune coordonnée ici ; les tables par cut vivent hors dépôt (scratchpad de la session). Les scripts de mesure du chantier sont dans `tools/ch041/` (lecture seule des exports, rien n'est copié dans `banane`).

## 0. Protocole (écrit le 2/11, AVANT toute mesure)

### 0.1 Ce que fait le levier aujourd'hui, et où va son temps (lecture du code et de CH-034, PROBABLE jusqu'à la mesure du § 1)
`rechercheLargeCommande` (background.js) est appelé dans `commandLot`, APRÈS la décision du lot (étage, GCV2, L1) et AVANT la garde R3, sur un cut que la commande allait valider. Il appelle `decider()` (module pur) avec la capture et la pose que le lot va commander : `cellules()` relance le moteur gelé aux graines utiles de la grille (0, ±120, ±240, ±360 mm, moins celles sans 15 points dans ±180 mm : 6 à 7 relances en médiane sur la partie 20), fait les paires, puis la règle « différer ». Tout est SYNCHRONE dans le fil du service worker : rien d'autre n'avance pendant ces 3,5 s (médiane, CH-034 § 2.9), et le temps s'ajoute en série au cycle du cut (capture → analyse → décision → pose → validation → navigation). Les cellules ne dépendent que de la capture ; seule la règle finale lit la pose. Dans le lot, la science du moteur n'a pas de réservoir (`observeLot` reçoit `shadow.rails` sans `_reservoir`) : la graine 0 est recalculée par le levier.

### 0.2 Question
Peut-on rendre la même décision que la grille de CH-034 (réglage livré : mode `differer`, 50 mm, rapport 1,5, `sansPaireLoin`, soutien de dessus 60, graines `grille`) sans ajouter de temps au cycle du cut, mesurable ?

### 0.3 Jeux (figés avant la mesure ; tous dans `banane-data`, branche des documents)
- **Réglage** : partie 20 du 28/10 (`2026-10-28_v4.9.5.23_partie-20-lot`, 4.9.5.23, 721 posés attendus), jugée par l'Écho du 29/10 (`2026-10-29_v4.9.5.23_echo-partie-20`) : les classes CH-030 (faute > 50 mm, moyenne 10 à 50, fine ≤ 10, acceptation) par `tools/juger-lot.cjs`. Tout seuil nouveau (porte, graines) est fixé sur CE lot, puis n'est plus touché.
- **Examen 1 (coût et décisions, sans Écho)** : lots récents `.24` partie 0 (`2026-10-29_v4.9.5.24_partie-0-lot`) et `.28` parties 5 à 8 (`2026-10-31_v4.9.5.28_file`) : 410 posés attendus (CH-034 § 2.6).
- **Examen 2 (hors échantillon strict, nuages pauvres)** : lot Aurore des parties 10 et 11 (`2026-11-01_v4.9.5.30_aurore-parties-10-11`, 213 posés, 27 vérités, 0 faute connue).
- **Examen 3 (cuts réels du 2/11)** : `2026-11-02_v4.9.5.31_aurore-une-seule-partie`, `2026-11-02_v4.9.5.31_constellation-fin-de-lot-newpart`, `2026-11-02_v4.9.5.33_lot-arrete-deplacement-vue` : décisions et temps seulement (pas d'Écho attendu).
- **Temps de référence du lot sans levier** : les jalons `phase-timing` des journaux ci-dessus (capture reçue → décision → pose relue → validation acceptée → cut suivant vu), par cut posé : c'est le cycle réel sur la machine de l'opérateur, dans lequel le levier doit disparaître.

### 0.4 Définitions
- **Décision de référence** `D_ref(cut)` : `decider()` du module livré, réglage `{actif:true}` + `soutienTop:60` (le défaut de `src/settings.js`), sur la capture du cut (corpus, par `captureId`) et la POSE RÉELLE du lot (enregistrement de validation du lot, rails `corrected`), hors ligne, sans passe ni dynamique des appuis : c'est la grille de CH-034 § 2. Valeurs : `differer` ou `garde` (+ motif).
- **Décision candidate** `D_new(cut)` : la même fonction avec le levier modifié (porte, graines ciblées, exécution ailleurs), mêmes seuils.
- **Accord** : part des cuts posés où `D_new = D_ref` (état). Une différence de motif à état égal n'est pas un désaccord.
- **Fautes différées par CH-034** : posés de la partie 20 jugés faute (> 50 mm) dont `D_ref = differer` (19 attendues sur 21).
- **Poses justes** : posés jugés fine ou acceptation.
- **Temps** : `ms` de `decider()` (horloge `hrtime`, processus seul, machine de la session), par cut ; médiane, P90, total ; et, pour l'exécution cachée, le temps RESTANT à attendre au moment de la commande (= ce qui s'ajoute vraiment au cycle), mesuré dans un Chromium réel sur la maquette ESV.

### 0.5 Critères (ceux du ticket, chiffrés)
- (a) accord `D_new = D_ref` ≥ 99 % des posés, sur chacun des jeux : partie 20 entière, lots `.24`/`.28`, Aurore ;
- (b) les fautes différées par CH-034 sur la partie 20 restent toutes différées (0 perdue) ;
- (c) poses justes différées en plus par `D_new` par rapport à `D_ref` : ≤ 0,5 point de pourcentage des poses justes (partie 20 et Aurore) ;
- (d) temps : médiane du temps ajouté par cut posé ≤ 10 % de la médiane du cycle du cut sans levier (mesurée au § 1), ET moyenne du temps ajouté ≤ 0,3 s par cut posé ; mesuré ici sur chaque jeu, et outil laissé prêt pour la machine de l'opérateur (événement `recherche-large` : `ms`, relances, porte, temps attendu).
Un critère non tenu est dit non tenu ; un seuil n'est pas déplacé après coup.

### 0.6 Hypothèses à éprouver, dans l'ordre (chacune avec sa prédiction écrite avant)
- **H1, la porte (piste 2)** : la règle « différer » n'agit que s'il existe une paire concurrente SOUTENUE (dessus ≥ 60 sur ses deux rails) à plus de 50 mm de la pose ; une paire est « loin » si l'un au moins de ses rails l'est (`ecart` = max des deux côtés). Donc : si, sur aucun des deux rails, le nuage n'a d'amas de ≥ 60 points à la hauteur du dessus (bande verticale ±100 mm du départ, celle que lit le moteur) dans une fenêtre latérale de la largeur du champignon (≈ 70 mm) située à plus de 50 mm de la pose du lot, aucune relance n'est nécessaire : `garde`. Prédiction : sur les cuts que la porte ferme, `D_ref = garde` dans 100 % des cas (rappel 1 sur les 19 fautes : toutes ont une concurrente à ≥ 117 points et à > 100 mm) ; la porte ferme la majorité des cuts hors appareils de voie (à mesurer par zone). La porte coûte quelques millisecondes (un histogramme). Un amas seulement VERTICAL (même travers, autre hauteur) n'est pas détecté par la porte : on compte combien de `D_ref = differer` ont leur concurrente à ≤ 50 mm en travers (attendu 0).
- **H2, graines ciblées (piste 4)** : pour un cut que la porte laisse passer, ne relancer qu'aux graines de la grille (mêmes valeurs) dont la fenêtre de recherche (±80 mm) touche la pose du lot ou un amas de ≥ 15 points (le minimum d'une cellule forte) : les cellules trouvées sont celles de la grille aux mêmes graines, les graines retirées ne pouvaient pas donner de cellule forte. Prédiction : accord ≥ 99 %, relances divisées par 2 environ sur les cuts ouverts.
- **H3, exécution cachée (piste 1)** : les cellules ne dépendent que de la capture ; elles se calculent HORS du fil du service worker (document hors écran + `Worker`, ou page de l'extension), lancées dès la capture reçue, en parallèle de l'analyse du moteur, de la décision du lot et de la GCV2 ; la commande n'attend que le reliquat. Prédiction : le temps caché vaut la durée capture → décision du cycle (mesurée au § 1) ; le reliquat moyen par cut posé = part des cuts ouverts × max(0, temps des relances − temps caché). Le document hors écran demande la permission `offscreen` au manifeste (interdit à l'exécutant : patch séparé pour l'intégrateur) ; sans elle, repli synchrone, mêmes décisions.
- **H4, réutiliser la science (piste 3)** : dans la passe, la science est déjà passée ; dans le lot, non. Si la décision L1 (GCV2) a déjà calculé `scientificProposeBothAvecReservoir` sur ce cut, la reprendre comme relance 0 : une relance de moins, cellules identiques (c'est déjà ce que fait le banc).
- Écartées d'avance, avec leur raison : sous-échantillonnage du nuage (piste 5 : change les pertes, donc les seuils basculent, CH-034 § 2.11 a montré 1,8 % de bascules pour moins que ça) ; décision à retardement (piste 6 : pose puis décide ; un cut appliqué dans ESV puis non validé est un état que le moteur gelé ne connaît pas, `src/engine.js` interdit, D-264 : non éprouvé ici, dit au rapport) ; réglage par zone (piste 7 : dernier recours, coût en fautes à chiffrer si tout le reste échoue).

### 0.7 Puissance
Partie 20 : 721 posés, 19 fautes différées ; un accord de 99 % laisse 7 désaccords au plus ; avec 0 faute perdue sur 19, borne haute de Wilson 17 %. Lots récents 410 posés : 4 désaccords au plus. Aurore 213 : 2 au plus. Ce sont des bornes de non-régression sur les décisions, pas une preuve de gain terrain (celle-ci reste CH-034 § 7 et l'Écho à venir).

## 1. Le cycle réel d'un cut, et le prix d'une relance (ÉTABLI, 2/11, 11:00)
**Outils** : `tools/ch041/cycle-lot.cjs` (jalons `phase-timing-pli` du journal : open → capture-received → capture-stored → proposed → decision → accepted → open suivant ; spans du service worker), `tools/ch041/chrono-science.cjs` (une relance du moteur gelé ici, sur les captures du corpus).

**Partie 20 du 28/10 (machine de l'opérateur, 4.9.5.23, 721 cuts posés, levier absent)**, médianes en ms (P90 entre parenthèses) :

| population | capture | analyse (moteur) | décision du lot | pose + validation | cycle entier | navigation | **fenêtre capture reçue → décision** | science (une paire) |
|---|---|---|---|---|---|---|---|---|
| tous (721) | 2 533 (4 036) | 1 027 (1 684) | 240 (1 729) | 1 821 (2 628) | **6 278** (9 387) | 488 (707) | **1 606** (3 150) | 754 (1 934) |
| commande `lot` (205) | 2 554 | 1 161 | 1 174 (3 542) | 1 870 | 7 321 (11 501) | 489 | 2 643 (5 894) | 761 |
| commande `engine` (516) | 2 519 | 991 | 201 (288) | 1 771 | 5 967 (7 983) | 486 | 1 393 (2 035) | 657 |

Lot du 2/11 (4.9.5.33, 11 posés, partie à appareils) : cycle 3 440 (9 820), fenêtre 1 741 (8 177), science 3 109 : sur les cuts que la chaîne pose, la décision du lot relance elle-même le moteur recentré (`lot-decision`, 2,7 à 3,9 s sur cette machine-là).

**Une relance du moteur ici** (`scientificProposeBothAvecReservoir`, 40 captures de la partie 20, 17 110 points en médiane) : **638 ms** en médiane, P90 1 419, min 196, max 3 456. Chez l'opérateur, le span `science-public-total` du même lot vaut 754 ms en médiane : sa machine est environ **1,2 fois plus lente** que celle-ci (PROBABLE : spans de nature voisine, pas la même fonction exactement). Les 3,5 s par cut de CH-034 (6 à 7 relances) y valent donc ~4,2 s, sur un cycle de 6,3 s : c'est ce que l'opérateur a vu.

**Lecture pour la suite.** (1) Le critère (d) chiffré : 10 % de la médiane du cycle = **0,63 s par cut en médiane**, et 0,3 s en moyenne. (2) Une exécution parallèle lancée à la capture reçue dispose de **1,6 s en médiane** (2,6 s sur les cuts que la chaîne pose) avant que la commande n'ait besoin du résultat : elle cache un tiers à la moitié de la grille, pas tout ; la porte et les graines exactes doivent faire le reste. (3) La capture elle-même (2,5 s : lecture du nuage par la page) précède tout : rien ne peut démarrer avant.

## 3. H3 : l'exécution cachée (conception et plomberie, 2/11, 12:30 ; mesures de terrain au § 4)
**Ce qui est livré (réglage `lot.rechercheLarge.parallele`, vrai ; la recherche large reste ÉTEINTE).**
- `src/recherche-large.js` : `grainesChoisies(capture, R)` (les graines à relancer, sans la pose) et `decider({…, relances})` qui accepte des relances faites ailleurs (`relance` est une fonction pure de la capture et de la graine : une graine manquante est relancée sur place, le résultat est le même).
- `src/recherche-large-worker.js` : un `Worker` qui charge le moteur gelé (mêmes fichiers que le service worker, dans le même ordre) et le module pur, reçoit la configuration du moteur (flanc partiel, calage de convention) et rend les cellules fortes de ses graines.
- `offscreen-recherche-large.html` + `src/recherche-large-offscreen.js` : le document hors écran ouvre `min(4, cœurs − 1)` fils, se connecte au service worker par un port `banane-recherche-large`, répartit les graines d'une demande sur les fils, rend l'union.
- `background.js` : au départ du lot le document est ouvert et préchauffé (`rlPrechauffer`) ; à la capture AVANT enregistrée (`before-captured`), la capture est relue du magasin, les graines choisies, la demande part (`rlPrecalculer`), la promesse est rangée par identifiant de capture ; à la commande (`rechercheLargeCommande`, devenue asynchrone), la porte est jugée d'abord : fermée, rien n'est attendu ; ouverte, on attend le reliquat (`rlRelancesPrecalculees`) puis `decider` reçoit les relances. Panne, délai (20 s), document absent : `relances` null, calcul sur place. Sans permission `offscreen` au manifeste (interdit à l'exécutant : `chantiers/CH-041/propositions/manifest-offscreen.patch`), rien ne part. L'événement `recherche-large` porte `executeur` : `precalcule`, `attenteMs` (ce qui s'ajoute vraiment au cycle), `cacheMs` (capture → commande), `calculMs`, `fils`, `graines`, ou `porteFermee`, ou `erreur`.
**Essais (rouge puis vert).** `tests/recherche-large.test.cjs` (13 : porte, graines exactes, relances précalculées), `tests/recherche-large-executeur-sw.test.cjs` (6, service worker réel en VM, document hors écran simulé : nominal, panne, muet, porte fermée, sans permission, éteinte), `tests/recherche-large-sw.test.cjs` et `-passe-sw` inchangés verts, `tests/banc-differes-recherche-large.test.cjs` vert, `tests/pose-lot-inchanges-4959.test.cjs` (les deux fichiers nouveaux déclarés), `tests/esv-maquette/recherche-large-executeur.test.cjs` (Chromium réel, extension copiée avec la permission : les relances reviennent du document et sont identiques à celles du module ; sans la permission `chrome.offscreen` est absent).
**Mesuré dans Chromium 153 sur la capture synthétique (ÉTABLI, 4 cœurs ici, 3 fils)** : première demande, document à ouvrir et fils à charger : 795 ms aller-retour, calcul 725 ms (fils 569, 544, 499 ms pour 2 graines chacun), contre 351 ms en série dans le service worker : à froid, les fils perdent (compilation, chargement). D'où le préchauffage au départ du lot. La mesure qui compte est sur des captures réelles, fils chauds, machine au repos : § 4.

### 0.8 Jeu ajouté par l'intégrateur (2/11, 10:53 ; écrit AVANT la mesure)
**Examen 4, hors échantillon strict, couverture 98 %** : lot Orbite de la partie 0 du 2/11 (`2026-11-02_v4.9.5.31_aurore-une-seule-partie`, 4.9.5.31, sans recherche large ; 151 cibles, 123 posés, 28 différés) et son Écho final (`2026-11-02_v4.9.5.31_partie0-echo-complet`, 360 visites) : 121 jugés sur 123 posés, **1 faute** (196,7 mm, mauvaise voie), fine 50,4 %, acceptation 42,2 % (chiffres de l'intégrateur, `tools/juger-lot.cjs`). Questions, dans l'ordre : (1) la référence (grille, soutien 60) diffère-t-elle la faute ? (2) combien de poses justes (fine, acceptation) diffère-t-elle sur les 121 jugés (critère de retour arrière de CH-034 : 8 % des posés) ? (3) la candidate (porte, graines exactes) rend-elle les mêmes décisions que la grille (critères a, b, c du § 0.5) ? Les décisions sont calculées sur la pose RÉELLE du lot (comme partout ici), aucun seuil n'est touché.

## 2. H1 et H2 : la porte et les graines exactes, mesurées (2/11)
### 2.1 La référence reproduit CH-034 (ÉTABLI, 12:30 ; `tools/ch041/decisions.cjs`, réglage livré + `actif:true`, pose réelle du lot, `porte:false`)
| jeu | posés avec capture | différés par la grille (concurrence / pose sans paire forte) | fautes jugées différées | poses justes jugées différées | ms par cut, médiane / moyenne (sous charge de 2 à 3 calculs) | relances médiane | points médiane |
|---|---|---|---|---|---|---|---|
| partie 20 (réglage) | 721 | 33 (24 / 9) | **19 sur 21** | 1 acceptation sur 140 ; 13 non jugés | 3 128 / 4 277 | 6 | 16 863 |
| .24 partie 0 + .28 parties 5 à 8 | 230 + 176 | 7 + 3 = 10 (9 / 1) | sans Écho | sans Écho | 3 111 / 2 921 ; 3 095 / 3 511 | 7 ; 7 | 8 923 ; 5 119 |
| Aurore parties 10 et 11 | 213 | 11 (7 / 4) | 0 faute connue | (27 vérités, § 8 de CH-034) | 1 277 / 1 927 | 6 | 4 791 |
| 2/11 partie 0 (Écho 121 jugés) | 123 | 7 (7 / 0) | **1 sur 1** (196,7 mm : concurrence, meilleure paire à 195 mm de la pose, dessus 268 et 272) | **6 sur 115** (3 acceptations, 3 fines : 5,2 %) | 4 069 / 4 031 | 6 | 18 099 |
| 2/11 partie 1 | 83 | 4 (2 / 2) | sans Écho | sans Écho | 1 379 / 1 544 | 6 | 5 299 |

(Table corrigée à 13:40 avec les références recalculées `porte:false`, § 2.2 « erreur de méthode » ; une première version donnait 10 différés sur Aurore : c'était une candidate.) Lecture : CH-034 donnait, au soutien 60, 10 différés sur 410 sur les lots .24/.28 et 11 sur 219 sur Aurore : **retrouvés exactement** (10 sur 406, 11 sur 213). Sur le jeu neuf du 2/11 (§ 0.8), réponses aux questions (1) et (2) : **la faute est différée** ; prix 7 différés sur 123 posés (5,7 %), sous le critère de retour arrière de 8 % (CH-034 § 5), mais 6 poses justes sur 115 jugées justes (5,2 %), plus que sur la partie 20 (1 sur 140) : les nuages du 2/11 sont denses (18 000 points, voie à appareils et dalle) et portent des paires concurrentes complètes (dessus 228 à 292) à 100 à 150 mm des poses justes. PROBABLE : c'est le prix de la règle elle-même, pas d'un défaut de calcul (les deux paires ont le même soutien et des produits proches : indécidable par le nuage seul, CH-034 § 2.8 piste 3). À dire à l'intégrateur ; aucun seuil touché ici.

### 2.2 La candidate (porte + graines exactes) contre la grille, partie 20 entière (ÉTABLI, 13:05 ; `tools/ch041/comparer.cjs`, référence `porte:false`, candidate `porte:true`, mêmes seuils)
| critère | résultat |
|---|---|
| (a) accord des états | **721 sur 721 (100 %)** |
| (b) fautes différées par la grille conservées | **19 sur 19** (21 fautes jugées) |
| (c) poses justes différées en plus | **0** (1 acceptation sur 140 dans les deux cas) ; non jugés différés 13 et 13 |
| porte | fermée **291 sur 721 (40 %)** ; la grille dit `garde` sur les 291 ; coût 4 ms en médiane (max 153) |
| relances | grille 4 080 ; candidate 2 649 (porte fermée : 0 ; porte ouverte : 2 649 contre 2 673 : les graines exactes n'épargnent presque rien sur ces nuages denses) |
| temps du module par cut, en série, sous charge | grille 3 128 ms médiane, 4 277 moyenne ; candidate 2 960 médiane, 3 384 moyenne ; sur les cuts ouverts : 4 109 contre 4 150 |
| par étage (n / fermés / grille différer) | première passe 516 / 255 / 14 ; fenêtre 93 / 19 / 4 ; différé 74 / 17 / 6 ; choix 31 / 0 / 6 ; passage 7 / 0 / 3 |

**Lecture.** La porte est exacte sur ce lot (aucune décision changée, aucune faute perdue) et ferme 40 % des cuts ; mais la partie 20 est une voie sur dalle à appareils : six cuts sur dix ont, loin de la pose, une structure à dessus et flanc (contre-rail, gorge, second rail) que seule la grille peut départager, et ces cuts ont des nuages de 17 000 points où chaque relance coûte 0,5 à 1 s. **Sur ce lot, la porte seule ne tient pas le critère (d)** : il faut l'exécution cachée (§ 3, § 4).

**Erreur de méthode corrigée (13:00).** Les premières « références » des jeux d'examen avaient été calculées avec `--reglage '{}'` APRÈS que `porte:true` fut inscrite dans `src/settings.js` : c'étaient des candidates (et de versions successives de la porte), pas la grille ; seule la référence de la partie 20 (lancée avant) était la grille. Les références des jeux d'examen sont recalculées avec `porte:false` explicite (§ 2.3) ; `tools/ch041/decisions.cjs` le dit en tête et consigne le réglage lu dans l'en-tête de sortie. La portée d'une cellule depuis sa graine a aussi été corrigée entre-temps (90 → 270 mm, § 2.4) ; la comparaison ci-dessus est faite avec le module corrigé des deux côtés.

### 2.4 Impasse levée : portée d'une cellule depuis sa graine (ÉTABLI, 12:40)
Première version des graines exactes : portée ±90 mm (la fenêtre de recherche du moteur). Sur 245 cuts de la partie 20 : 1 désaccord, `concurrence` → `pose-unique` : la concurrente à 250 mm de la pose venait d'une graine sautée. Cause lue dans le moteur : il centre sa recherche sur la graine ET sur l'hypothèse médiane des points lus (±180 mm), et accepte une cellule à ±90 mm de l'un ou l'autre centre : une cellule peut être à 270 mm de sa graine. Portée portée à 270 mm et filtre pris en intersection avec la grille utile de CH-034 (15 points à ±180 mm) : exact par construction, jamais plus de relances. Depuis : 0 désaccord sur 721.

## 4. H3 mesuré : le temps mural des fils, et ce qui resterait au cycle (ÉTABLI puis SUPPOSÉ, 13:10)
**Chromium 153, extension réelle avec la permission, 25 captures RÉELLES de la partie 20 (17 005 points en médiane, 5 graines), fils chauds, machine au repos, 3 fils (4 cœurs ici)** (`tools/ch041/chrono-executeur.cjs`) : aller-retour parallèle **1 145 ms en médiane** (P90 5 173) contre **2 257 ms** pour le même calcul en série dans le service worker (P90 10 885) ; rapport médian **1,98** ; cellules identiques 25 sur 25. ÉTABLI.

**Estimation du reliquat sur la partie 20 entière** (`tools/ch041/reliquat.cjs` : fenêtre réelle capture reçue → décision de chaque cut, temps de la candidate × 1,2 pour la machine de l'opérateur ÷ 1,98 pour les fils + 60 ms d'envoi ; SUPPOSÉ : rapport et surcoût constants, fenêtre indépendante du levier) :

| temps ajouté par cut posé (721) | médiane | moyenne | P90 | cuts avec reliquat |
|---|---|---|---|---|
| CH-034 (grille en série, sans porte) | 3 754 ms | 5 132 ms | 7 878 ms | — |
| porte + graines exactes, en série | 3 552 ms | 4 061 ms | 7 855 ms | — |
| **porte + exécuteur à 3 fils** | **8 ms** | **836 ms** | 2 063 ms | 344 sur 721 |

Lecture : la médiane tient le critère (d) (≤ 630 ms) de très loin ; la moyenne ne le tient pas sur CE lot (836 ms > 300 ms) : un cut sur deux garde un reliquat, et les plus lourds (17 000 points, 7 relances, 5 à 8 s en série) dépassent la fenêtre même divisés par deux. Deux leviers restent, dits au rapport : le nombre de fils (réglage `fils`, 0 = cœurs − 1 ; à 6 fils le rapport attendu est ~3 et la moyenne tomberait vers 0,4 s, SUPPOSÉ, à mesurer sur la machine de l'opérateur) et la restriction par zone (`zones`) sur les voies sur dalle. Sur les jeux de voie courante (§ 2.3), les nuages sont trois fois plus légers : à chiffrer de la même façon.

### 2.3 La candidate définitive (porte à écartement + graines exactes) contre la grille, tous les jeux (ÉTABLI, 13:55 ; références `porte:false`, candidate `porte:true`, module c50b18f + porte à écartement)
La porte exige désormais une **paire** soutenue admissible (deux positions à dessus ≥ 60 et flanc ≥ 6, l'une loin de la pose, écartement du contrat ± 20 mm sur les vraies positions) : un rail seul loin de la pose (quai, mur, caniveau, rail d'une autre voie) n'ouvre plus.

| jeu | cuts | (a) accord | (b) fautes conservées | (c) justes différées en plus | porte fermée | relances grille → candidate | ms par cut en série, médiane grille → candidate (sous charge) |
|---|---|---|---|---|---|---|---|
| partie 20 | 721 | **721 / 721** | **19 / 19** | 0 (1 / 140 des deux côtés) | **377 (52 %)** | 4 080 → 2 093 | 3 128 → 10 |
| .24 partie 0 | 230 | 230 / 230 | — | — | 128 (56 %) | 1 382 → 639 | 3 082 → 6 |
| .28 parties 5 à 8 | 176 | 176 / 176 | — | — | 51 (29 %) | 1 103 → 817 | 3 091 → 2 236 |
| Aurore 10 et 11 | 213 | 213 / 213 | — (0 faute) | — | 110 (52 %) | 1 200 → 638 | 1 277 → 12 |
| 2/11 partie 0 (Écho) | 123 | 123 / 123 | **1 / 1** | 0 (6 / 112 des deux côtés) | 41 (33 %) | 695 → 493 | 4 069 → 3 800 |
| 2/11 partie 1 | 83 | 83 / 83 | — | — | 34 (41 %) | 504 → 287 | 1 379 → 1 085 |
| **total** | **1 546** | **1 546 / 1 546 (100 %)** | **20 / 20** | **0** | 741 (48 %) | 8 964 → 4 967 (− 45 %) | |

**Verdict (a), (b), (c) : tenus partout, sans marge à discuter** : la porte est un majorant exact (aucune décision changée sur 1 546 cuts, bornes hautes de Wilson 0,25 % de désaccords, 15 % de fautes perdues sur 20). Sur les cuts ouverts, les graines exactes épargnent peu (2 à 10 % des relances) : la porte fait presque tout le gain, et elle ne ferme que la moitié des cuts : l'autre moitié a réellement, loin de la pose, une paire que seul le moteur départage (contre-rails et gorges des voies sur dalle, rails d'appareils, voies voisines à l'écartement). Le temps en série sur un cut ouvert est celui de la grille.

## 5. Le critère (d) : ce qui est établi, ce qui est estimé, ce qui manque (14:00)
- **Établi** : (1) le temps d'une porte : 4 à 12 ms par cut (max 164) ; (2) les fils : dans Chromium 153, sur captures réelles, machine au repos, 3 fils : × 1,98 (partie 20, 17 000 points, aller-retour 1 145 ms contre 2 257 en série) et × 1,90 (Aurore, 4 800 points, 424 ms contre 766) ; cellules identiques 50 sur 50 ; (3) la fenêtre réelle capture reçue → décision chez l'opérateur : 1,6 s sur la partie 20, 1,7 s sur .24, 1,4 à 1,8 s sur le 2/11, mais **0,2 à 0,4 s sur .28 et Aurore** (nuages légers : l'analyse du moteur est rapide, il n'y a presque rien derrière quoi se cacher).
- **Estimé** (`tools/ch041/reliquat.cjs`, candidate × 1,2 pour la machine de l'opérateur ÷ 1,98 pour 3 fils + 60 ms ; temps de la candidate mesurés sous charge, donc majorés ; SUPPOSÉ) :

| jeu | cuts | temps ajouté par cut posé CH-034 (médiane / moyenne, ms) | porte + fils, estimé (médiane / moyenne / P90) | cuts avec reliquat |
|---|---|---|---|---|
| partie 20 (dalle, appareils) | 721 | 3 754 / 5 132 | **6 / 846** / 2 196 | 275 (38 %) |
| .24 partie 0 | 230 | 3 698 / 3 505 | **5 / 98** / 328 | 38 (17 %) |
| .28 partie 5 | 37 | 7 343 / 6 983 | 3 227 / 3 007 / 3 853 | 34 (92 %) |
| .28 partie 6 | 95 | 2 845 / 3 971 | 882 / 1 408 / 3 105 | 72 (76 %) |
| .28 partie 7 | 21 | 1 788 / 3 240 | 5 / 812 / 2 616 | 9 |
| .28 partie 8 | 23 | 1 100 / 1 644 | 6 / 209 / 352 | 5 |
| Aurore 10 | 139 | 1 682 / 2 488 | 285 / 775 / 2 940 | 76 (55 %) |
| Aurore 11 | 74 | 667 / 1 983 | 5 / 813 / 2 590 | 25 (34 %) |
| 2/11 partie 0 | 123 | 4 883 / 4 837 | **7 / 530** / 1 876 | 52 (42 %) |
| 2/11 partie 1 | 83 | 1 655 / 1 853 | **5 / 65** / 104 | 9 (11 %) |

**Lecture honnête.** La médiane tient le critère (≤ 630 ms) sur tous les jeux sauf .28 parties 5 et 6 (fenêtre de 0,4 s, porte fermée sur 8 et 22 % des cuts : ces deux parties sont des voies où presque chaque cut a une paire concurrente possible loin de la pose, probablement une voie voisine à l'écartement nominal, à vérifier sur place). **La moyenne (≤ 300 ms) ne tient, par l'estimation, que sur .24, .28 partie 8 et le 2/11 partie 1** ; elle vaut 0,5 à 0,85 s sur la partie 20, le 2/11 partie 0 et Aurore, 1,4 à 3 s sur .28 parties 5 et 6. La cause est structurelle : une relance du moteur gelé coûte 0,5 à 1 s et il en faut 6 ou 7 sur un cut ouvert ; divisées par 2 (3 fils) ou 3 (6 fils), elles dépassent une fenêtre de 0,2 à 1,7 s dès que le nuage est fourni. Ce qui reste pour descendre : plus de fils (réglage `fils`, machine de l'opérateur : cœurs inconnus), ou les zones (`zones:['adv','abords']`, qui enlève la voie courante : CH-034 § 2.11 rappelle que les fautes connues sont en appareils ; le coût en fautes d'une voie courante à voie voisine n'est pas connu), ou toucher au moteur gelé (interdit ici). **Mesure vraie à faire sur le terrain** : l'événement `recherche-large` porte `executeur.attenteMs` ; `node tools/ch041/cycle-lot.cjs <journal> --partie N` en donne la médiane et la moyenne par cut consulté.
- **Non fait** : H4 (reprendre la science de la GCV2 comme relance 0 dans le lot : une relance de moins sur les cuts que la chaîne ne pose pas ; la passe le fait déjà) ; piste 6 (décider après la pose : écarté, § 0.6) ; mesure sur la machine de l'opérateur (outil prêt).
