# Cycle d'un lot Orbite avec et sans l'ombre de la voie prédite (mesure, audit 5.0, I8)

Branche `claude/50-mesure-cycle-ombre`, 16 octobre 2026. **Mesure seulement** : aucun fichier de `src/` ni `background.js` n'est modifié, `DECISIONS.md` non plus, `src/engine.js` n'est pas touché.

**Question.** L'ombre (`voie-predite-ombre` : `voieOmbreNoter`, `voieOmbrePlanifier`, `voieOmbrePousser`, `voieOmbreVider`, module `src/voie-recentree.js`) relance le moteur, jusqu'à 2,5 s, dans le service worker, au moment où la page capture le cut suivant (`voieOmbreVider` part avec la commande `capture`). Le service worker ne fait qu'une chose à la fois : si le calcul dure plus que la capture, la réponse de la page attend la fin du calcul. De combien le cycle s'allonge-t-il ?

**Réponse courte.** Sur un poste comme celui du lot mesuré, **pas de façon mesurable** : environ **4 s de retard cumulé sur un lot de 17,8 minutes (0,4 %)**, au pire **0,8 s sur un seul cut**, 18 différés retardés sur 127. Sur le banc, le cycle (médiane, P90, max) et la durée du lot sont les mêmes avec et sans ombre, aux erreurs de mesure près. Le résultat dépend de la vitesse du poste (§ 4) : sur un poste 2,5 fois plus lent, le retard serait de 35 s (3,3 %).

## 1. Données et outil

- **Lot** : partie 1 du second projet, version 4.9.5.3, 351 cuts décidés en 17,8 min, 127 différés (`fiches/OMBRES_VOIE.md` § 3). Journal et nuages hors dépôt. Le lot a été joué sans l'ombre (elle date de la 5.0) : les temps de capture du journal sont ceux d'une page qui ne subit pas l'ombre.
- **Outil** : `tools/cycle-ombre.cjs` (sous-commandes `etalon`, `calcul`, `banc`), essai `tests/cycle-ombre.test.cjs` (données synthétiques, 6 cas, dont un petit lot réel dans le service worker avec et sans ombre). Rien d'autre n'est touché.
- **Aucun banc de l'existant ne joue un vrai lot dans Chromium** : `tools/navigateur-*.cjs` essaient l'adaptateur de page contre une page synthétique (retour à un cut, cohabitation, téléchargements), `tests/browser/harness.js` est une maquette de panneau, et la branche `claude/50-s4-banc` n'existe pas dans `origin`. Les essais `tests/voie-predite-ombre-sw*.test.cjs` jouent deux cuts. J'ai donc construit le banc ci-dessous, au plus près de ce qu'on peut faire sans ESV.

## 2. Méthode

**Banc (`banc`, mesure principale).** Le vrai `background.js` (moteur et GCV1 réels) chargé dans Node, avec les mocks de `tests/helpers/perf-production.cjs`, joue un lot contre un ESV simulé qui sert **les vrais nuages du lot** (corpus GCV1) dans l'ordre du journal. La page simulée met à répondre à chaque capture la durée relevée par le journal pour ce cut (commande `capture` côté service worker : `phase-timing-pli`, `command:capture`). Les cuts différés passent par `nextWithoutDecision` (cuts à reporter) et les autres par `apply` puis `validateAndNext`. Le réglage `voiePrediteOmbre.actif` est coupé puis actif, **en alternance** (coupé, actif, actif, coupé, coupé, actif), chaque lot **dans un processus neuf**. Verrou de la machine posé pendant les mesures, `nice -n 10`, charge notée avec chaque lot.

Relevés par cut : le cycle (de l'envoi de la capture d'un cut à celui du suivant), le **retard de la réponse** (instant où le service worker reçoit la réponse moins l'instant où la page l'avait prête) et l'écart entre la réponse et la commande suivante ; pour le lot, sa durée. Les décisions du lot (`gcv1-shadow-observed`) et les commandes à ESV sont **identiques** dans les six lots (contrôlé par l'outil).

**Étalonnage de la vitesse (`etalon`).** Cette machine est **2,5 fois plus lente** que le poste du terrain pour le moteur : sur 44 cuts du lot, le même calcul (`scientificProposeBoth`) prend 2,5 fois le `facade-total` du journal (médiane 2,5, P90 2,9, de 1,6 à 3,7). Le banc multiplie donc les durées de capture du journal par 2,5 (`--echelle 2.5`) pour garder le rapport calcul / capture du terrain ; tous les temps du banc sont des temps de machine, **divisés par 2,5 pour le terrain**. Le cycle de banc (médiane 2,8 s une fois ramené) est proche de celui du terrain (2,57 s).

**Calcul (`calcul`, au plus près, tout le lot).** L'ombre (`evaluerDiffere`, code de l'extension, moteur non mémoïsé) rejouée sur les 127 différés, trois passes, médiane par différé ; comparée à la durée de capture du cut suivant relevée au journal ; retard par cut = max(0, calcul − capture), ramené au terrain en divisant le calcul par le rapport d'étalonnage.

**Tranche du banc.** Un lot entier à cette vitesse dure 50 minutes ; le banc joue les **160 premières visites** (22 minutes par lot, 104 des 127 différés, toutes les longues séries), trois lots par réglage. Les 23 différés restants sont couverts par `calcul`.

## 3. Résultats du banc (tranche de 160 visites, 3 lots par réglage)

Temps de machine, puis entre parenthèses ramenés au terrain (divisés par 2,5). Charge machine de 0,7 à 1,5 pendant les lots.

| | ombre coupée | ombre active | écart apparié (actif − coupé) |
|---|---:|---:|---:|
| **Durée du lot** (3 lots) | 1 319 / 1 321 / 1 351 s (médiane 1 321 s, soit 528 s) | 1 316 / 1 311 / 1 331 s (médiane 1 316 s, soit 526 s) | −4,8 s (médiane), −11 s (moyenne par paire) : **dans le bruit** (dispersion d'un lot à l'autre : ± 16 s) |
| Cycle par cut, tous (n = 477) : médiane / P90 / max | 7,08 / 14,86 / 22,70 s (2,83 / 5,94 / 9,08) | 7,07 / 14,82 / 22,03 s (2,83 / 5,93 / 8,81) | médiane −70 ms, P90 +330 ms, max +1,0 s (par cut, 3 lots moyennés) |
| Cycle des cuts **qui suivent un différé** (n = 312) : médiane / P90 / max | 6,70 / 13,67 / 21,22 s (2,68 / 5,47 / 8,49) | 6,57 / 13,81 / 20,79 s (2,63 / 5,52 / 8,32) | médiane −91 ms, P90 +401 ms, max +1,0 s (−36 / +160 / +410 ms au terrain) |
| **Retard de la réponse de la page**, cuts qui suivent un différé : médiane / P90 / max | 7 / 16 / 56 ms | 7 / 37 / **1 833 ms** (0,73 s au terrain) | **+5,4 s en tout par lot** (104 différés), soit **+2,1 s au terrain** ; +52 ms par différé en moyenne |
| Cuts retardés de plus de 50 ms (même seuil de 100 ms : mêmes comptes) | 0 à 2 (bruit) | 9, 10, 10 par lot (dont 4 à 5 de plus de 500 ms) | |
| Retard de la réponse, cuts qui suivent une pose | médiane 8 ms | médiane 8 ms | 0 (−8 ms en tout) |
| De la réponse prête à la commande suivante, après un différé : médiane | 3,01 s | 2,96 s | −60 ms (bruit : il contient la décision du lot, de durée variable) |

Calcul de l'ombre dans le service worker, 312 événements (104 par lot) :

| | médiane | P90 | max |
|---|---:|---:|---:|
| Différé avec relance du moteur (156 événements, 52 par lot) | 949 ms (380 ms au terrain) | 2 112 ms (845) | 3 474 ms (1 390) |
| Différé sans relance (156 événements) | 0,2 ms | 0,3 ms | 1 ms |
| `voieOmbreNoter` (sur le chemin de la décision, chaque cut) | 1,3 ms | 2 ms | 9,5 ms |
| `voieOmbrePlanifier` (chaque cut) | 1,1 ms | 1,5 ms | 9,1 ms |

Le coût de l'ombre **sur le chemin du lot** (copies de `voieOmbreNoter` et mise en file) est de l'ordre de 2 ms par cut au pire de la machine, moins d'une seconde sur tout le lot.

## 4. Résultats du calcul (tout le lot, 127 différés)

Temps de capture du cut suivant un différé, au journal : médiane 652 ms, P90 2,0 s, max 6,7 s. Calcul de l'ombre : 60 relances du moteur sur 127 (les 67 autres : 0,1 ms). Relances, temps de cette machine : médiane 1 109 ms, P90 2 361, max 3 295 (terrain, ÷ 2,49 : 445 / 948 / 1 323 ms).

| Calcul de l'ombre divisé par | poste correspondant | différés retardés | retard cumulé | part du lot (1 067 s) | médiane des retardés | max |
|---|---|---:|---:|---:|---:|---:|
| 1 | poste aussi lent que la machine de mesure (2,5 fois plus lent que celui du terrain) | 36 (28 %) | 34,8 s | 3,3 % | 0,93 s | 2,68 s |
| 1,6 | poste 1,6 fois plus rapide que la machine (1,5 fois plus lent que le terrain) | 29 (23 %) | 14,1 s | 1,3 % | 0,43 s | 1,48 s |
| **2,49** | **poste du terrain** | **18 (14 %)** | **4,1 s** | **0,39 %** | 0,18 s | 0,78 s |
| 3,7 | poste 1,5 fois plus rapide que celui du terrain | 5 (4 %) | 0,8 s | 0,07 % | 0,14 s | 0,36 s |

Les retards viennent de quelques séries : cuts 311-312, 370-380, 406-416, 435-452, 568-577 (tous des différés avec relance du moteur suivis d'une capture courte, 400 à 800 ms). Au journal, les 127 cycles qui suivent un différé durent 2,43 s en médiane contre 2,62 s après une pose : l'ombre n'y change rien de visible.

**Concordance banc / calcul.** Sur la même tranche, le calcul (même formule, unités de la machine) prédit 8,1 s de retard cumulé et 11 cuts à plus de 100 ms ; le banc en mesure 5,4 s net et 9 à 10 cuts. Les mêmes cuts ressortent (375, 378, 406 à 408, 412, 415, 416, 445, 452), avec des retards du même ordre : 405 contre 332 ms (cut 375), 461 contre 447 (378), 611 contre 601 (408), 1 384 contre 1 925 (415). Le banc est plus bas que la prédiction : le calcul de l'ombre y est un peu plus court (médiane 949 ms contre 1 109 en passes séparées) ; l'écart restant n'est pas expliqué.

## 5. Recommandation (non appliquée)

**Garder l'ombre active pendant le lot.** Sur un poste du niveau de celui qui a joué le lot, elle coûte au plus 4 s sur 17,8 minutes (0,4 %), 0,8 s sur un cut, et ni la médiane, ni le P90, ni le maximum du cycle ne bougent. L'ombre est ce qui produira les preuves attendues (73 poses sans faute, `fiches/OMBRES_VOIE.md` § 6) : la couper dans Orbite pour ne la faire qu'hors ligne retarde ces preuves sans rien gagner de visible.

La différer en fin de lot **gagne au plus ces 4 s et coûte cher en mémoire** : l'ombre garde, pour chaque différé en attente, la capture (points, visibilité, rails, caméra) et la science, soit environ **1,5 Mo par différé** (mesuré sur 24 nuages du lot, 16 700 points en moyenne), donc **environ 190 Mo pour 127 différés**, contre 8 au plus aujourd'hui (la file est plafonnée à 8) ; et la mémoire de l'ombre est volatile : un redémarrage du service worker en cours de lot perdrait toute la file. Ce n'est pas rentable.

**À surveiller seulement si le poste est plus lent** que celui du lot mesuré : sur un poste 1,5 fois plus lent que celui du terrain le retard monte à 14 s (1,3 %), sur un poste 2,5 fois plus lent à 35 s (3,3 %), avec des cuts retardés de 1,5 à 2,7 s. Dans ce cas, deux garde-fous sont possibles sans toucher à la pose : plafonner la durée de la relance de l'ombre ou ne lancer l'ombre qu'après les cuts dont la capture est longue. Aucun n'est proposé ni écrit ici.

## 6. Doutes

- **Une seule partie, un seul poste, un seul lot** : la durée de capture et de calcul vient du lot de la partie 1 du second projet, joué sur un poste à 12 cœurs. Le rapport de vitesse (2,5) est mesuré sur le moteur seul (44 cuts, dispersion 1,6 à 3,7) et supposé le même pour le reste du service worker. À 1,6 ou à 3,7 le résultat change d'un ordre de grandeur (§ 4).
- **La page est simulée** : elle attend, elle ne travaille pas ; le stockage est en mémoire (copies JSON ; ni écritures IndexedDB, ni attentes de stockage du terrain, ni messages entre processus). Le cycle de banc ramené au terrain (2,83 s) est un peu plus long que celui du terrain (2,57 s) ; l'écart avec et sans ombre n'en est pas affecté dans la mesure où ces coûts sont les mêmes dans les deux réglages.
- **Le banc est dans Node, pas dans Chromium** : le service worker de Chrome ne ralentit pas le moteur comme le contexte `vm` de Node (facteur 2,4 mesuré, pourquoi le banc charge `background.js` dans le contexte principal) mais la remise des messages, la sérialisation des nuages et le ramasse-miettes n'y sont pas ceux du navigateur. Aucun banc ne joue un lot dans Chromium.
- **Tranche** : le banc couvre 160 visites sur 351 (104 différés sur 127) ; les 23 autres différés sont dans le calcul, pas dans le banc. Un lot entier aurait duré 50 minutes par essai.
- **Bruit** : trois lots par réglage, charge de la machine de 0,7 à 1,5, un lot coupé à 1 351 s contre 1 319 et 1 321 pour les deux autres. La durée totale ne peut pas montrer un effet de 2 à 5 s ; seuls le retard de la réponse et le calcul apparié par cut le montrent. L'écart de durée est de signe négatif (−5 s), c'est du bruit, pas un gain.
- **Les décisions du banc** ne sont pas exactement celles du lot réel (104 différés sur les 160 premières visites, comme au journal, mais l'état des appuis peut différer) ; les décisions sont en revanche identiques d'un bras à l'autre.
- Le lot mesuré n'a **jamais tourné avec l'ombre sur le terrain** : toutes les mesures de ce document sont rejouées. Une mesure de terrain du rythme avec l'ombre active reste à faire.

## 7. Rejouer

```
node tools/cycle-ombre.cjs etalon --corpus SEG… --journal JOURNAL.json --pas 8 --sortie ETALON.json
node tools/cycle-ombre.cjs calcul --corpus SEG… --journal JOURNAL.json --jointure JOINTURE.json --cache MEMOIRE.json \
     --reps 3 --facteurs 1,1.6,2.49,3.7 --sortie CALCUL.json
nice -n 10 node --max-old-space-size=8000 tools/cycle-ombre.cjs banc --corpus SEG… --journal JOURNAL.json \
     --reps 3 --coupe 0:160 --echelle 2.5 --verrou /chemin/lourd.lock --sortie BANC.json
```

`--echelle` est le rapport d'`etalon` (1 si la machine est celle du terrain). Un lot entier : omettre `--coupe` (durée : de l'ordre de 50 minutes par lot à l'échelle 2,5). Charge de la machine pendant les mesures de cette fiche (`uptime`, moyenne sur 1 minute, relevée par l'outil à la fin de chaque lot du banc, champ `charges`) : calcul 0,0 au départ puis 1,0 ; étalonnage 0,2 puis 0,8 ; lots du banc (dans l'ordre joué) 1,2 / 0,9 / 0,7 / 0,8 / 1,5 / 0,7.
