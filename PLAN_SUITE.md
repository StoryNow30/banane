# Plan de la suite — 4.8.5, 4.9 (plan vivant)

Seul plan en vigueur ; `NEXT_TASKS.md` et `PLAN_4.8.md` sont clos. Règles de
pilotage : D-060, D-061. Diagnostic et portes : `audit/chantiers/audit-orchestration-485.md`.
Ta fiche pas à pas : `consignes/operateur-suite.md`.

## 0. Jalons

| Jalon | Contenu | Porte |
|---|---|---|
| **J0** clôture 4.8.0 | étiquettes ; relectures p15 et p11 ; rapport de sortie complété | C4 de la partie 15 évaluable, chaque faux nommé |
| **J1** 4.8.5 test 1 | chantiers D1 à D7 ci-dessous | § 1 (définition de « fini ») pour chaque chantier ; banc : 633 cuts inchangés, 8 jeux : seuls 707, 711, 718 changent |
| **J2** terrain 4.8.5 | un lot sur une partie neuve, puis sa relecture | C1 ≥ 79 % ; C3 = 0 ; C4 évaluable et ≤ 2 faux / 100 jugés ; 0 interruption non reprenable ; refus de la garde 0 à 2 |
| **J3** 4.8.5 stable | audit Astra du diff, étiquette | portes J2 + aucun P1 d'Astra |
| **J4** 4.9.0 | vitesse, exports, qualité (4.9 a et c) | § 3 |
| **J5** 4.9.5 | cuts difficiles (4.9 b) | § 3 |

## 1. Définition de « fini » pour tout chantier de développement

1. Travail sur `claude/banane-48-cahier`, un commit (ou plus) par chantier, préfixé par son identifiant (`[D2]`…).
2. Un **essai rouge** avant le correctif : il échoue sans le changement, passe avec.
3. `node tools/verify.cjs` à 0 ; aucun fichier d'essais au-delà de 7 s seul.
4. Banc : rejeu des 633 cuts de validation (parties 9, 11, 12) et des 8 jeux du banc 4.8.5 ; toute décision changée est listée et attendue.
5. Revue de code (skill `code-review`, niveau haut) sur le diff du chantier ; constats corrigés ou écrits.
6. Documents : `CHANGELOG.md`, `KNOWN_ISSUES.md`, `DECISIONS.md` si une règle change.
7. Pas de paquet tant qu'un chantier du paquet n'est pas fini.

## 2. 4.8.5 — chantiers de développement

| # | Chantier | Fichiers | Effort | Dépend de |
|---|---|---|---|---|
| D1 | Numérotation et cohabitation | `manifest.json`, `src/core.js`, `panel.html`, `panel.js`, `background.js`, `tools/package.py` | S | — |
| D2 | Garde d'écartement bas à 1 420 mm | `src/lot-decision.js`, `tools/acceptance-report.cjs` | S–M | — |
| D3 | Fin de partie après un différé (KI-067) | `background.js` | M | D1 (même fichier) |
| D4 | Instrumentation passive | `src/adapter-page.js`, `background.js` | M | D3 (même fichier) |
| D5 | Outils de portes | `tools/perf-lot.cjs`, nouvel outil de portes | S–M | — (en parallèle) |
| D6 | Documents et état | rapport de sortie, `KNOWN_ISSUES.md`, `LIRE_EN_PREMIER.md` | S | J0 pour les chiffres |
| D7 | Revue, paquet, essai Chromium | — | S | D1 à D6 |

**D1 — Numérotation et cohabitation.**
- Manifeste `4.8.5.1`, nom « Ariane 4.8.5 TEST », `version_name` « 4.8.5 test 1 » ; la version affichée dans le panneau, les exports et le zip en découle (`ariane-4.8.5-test.1.zip`).
- Avant d'injecter quoi que ce soit, Ariane regarde si la page ESV porte déjà l'adaptateur d'une autre version. Si oui, elle refuse : « Une autre Ariane (4.8.0) est active dans cet onglet : désactive-la dans edge://extensions, puis F5 sur ESV ».
- Essais : page équipée par une autre version → refus, rien d'injecté ; même version → connexion ; nom et version du paquet.
- Limite : la 4.8.0 ne peut plus changer ; « une seule Ariane active » reste la règle (D-060).

**D2 — Garde d'écartement bas (D-060).**
- Dans la décision sur le lot : un premier passage **sans appui** dont la paire est sous 1 420 mm est différé (motif « écartement bas au premier passage »). Garde seulement, jamais une cible.
- La règle est consignée dans la décision (nouvelle version de la décision) pour que le rejeu la relise ; les lots anciens se rejouent avec leurs règles.
- Essais : 1 405 et 1 414,5 mm refusés ; 1 426 mm accepté ; avec un appui, non concerné ; parité des lots anciens.
- Porte : 633 cuts de validation inchangés ; 8 jeux : 707 et 711 refusés, 718 posé en ricochet, 0 juste perdu.

**D3 — Fin de partie après un différé (KI-067).**
- Dans un lot « jusqu'à la fin de la partie », si ESV quitte la page juste après le « suivant sans décision » d'un cut sans pose, le lot se clôt : « Fin du lot : ESV a quitté la partie après le cut N ». Pas de pause « navigation incertaine », aucune commande renvoyée.
- Dans un lot borné, ou sur un cut posé, le comportement actuel reste : l'incertitude est réelle.
- Essais : ESV simulé qui ferme la page sur le dernier différé → lot clos proprement ; même panne au milieu d'un lot borné → pause, comme aujourd'hui.
- Réserve : le moteur (épinglé) gère le différé ; la correction se fait dans son enveloppe (`background.js`), avec une revue dédiée.

**D4 — Instrumentation passive (D-061).**
- À chaque capture, sans commande ni écriture dans ESV :
  - le texte « N on M treated » s'il est lisible (M = nombre de cuts de la partie) ;
  - le nombre de cuts voisins dont la page garde les rails, dans la structure que l'adaptateur lit déjà pour le cut courant (des nombres, pas les poses).
- Rangés dans le journal ; format inconnu → champ absent, jamais d'erreur.
- Usage : (a) fin de partie connue dès le premier lot ; (b) décide si les voisins validés en ligne (D-054) sont faisables en 4.9.5 sans inspection.

**D5 — Outils de portes (en parallèle).**
- `tools/perf-lot.cjs` : décomposition du cycle par phase (script du 28/09 intégré).
- Un outil qui rejoue les 633 cuts et les 8 jeux à partir de la recette banane-data et imprime chaque porte de J1 en vert ou en rouge.

**D6 — Documents et état.**
- Rapport de sortie 4.8 complété avec les parties 11 et 15 (chiffres de J0).
- `KNOWN_ISSUES.md` trié (entrées V4.4 à 4.6 closes ou marquées obsolètes).
- `LIRE_EN_PREMIER.md` redevient le seul état.
- Pour le paquet : CHANGELOG 4.8.5 et une note de 10 lignes pour toi (ce qui change, ce qu'il faut regarder).

**D7 — Revue, paquet, essai Chromium.**
- Revue de code sur tout le diff 4.8.5, puis `verify` et banc.
- Paquet reproductible (deux constructions identiques).
- Chargement dans Chromium avec la 4.8.0 à côté : refus attendu quand les deux sont actives.
- Livraison dans banane-data `travail/…_ariane-485-test1/`.

**Ordre** : jour 1 : D6 (partie J0), D1 → D2 → D3 → D4 en série (`background.js` commun), D5 en parallèle. Jour 2 : D7, paquet test 1, puis toi (J2). Astra relit le diff pendant J2. Un test 2 seulement en cas de panne au terrain.

**Hors 4.8.5** : garde de voie à 20 mm (sauf si, rejouée après D2, elle ne perd plus aucun juste) ; choix à un appui (7738, 7026) et biais vertical des passages à niveau : banc de fond pendant J2, sans code.

## 3. 4.9 — chantiers de développement

Préalable : cahier 4.9 v0.2 (ordonné, portes chiffrées), écrit par
l'orchestrateur après la 4.8.5 stable et l'audit d'orchestration d'Astra ;
signé par la direction. Découpage proposé : **4.9.0** = a + c ; **4.9.5** = b.

| # | Chantier | Objectif et porte | Effort | Dépend de |
|---|---|---|---|---|
| V1 | Mesure par phase dans l'extension | horodatage de chaque phase dans le journal ; tableau de bord `perf-lot` | S | — (premier) |
| V2 | Export sans doublon, compressé | le bilan renvoie au corpus au lieu de recopier le LiDAR ; compression dans le navigateur ; lecture des anciens formats gardée. Porte : taille −40 %, rapports identiques | M | V1 |
| V3 | Capture plus rapide | une expérience par cycle (attente de stabilité, lectures par vue, préchargement du cut suivant), réglée dans une version de test. Porte : capture médiane −30 %, 0 capture perdue, C1 et C4 inchangés | M–L | V1 |
| V4 | Comparaison V4.6 à la demande (P03) | retirer le calcul V4.6 du chemin du lot. Porte : décisions identiques, analyse plus courte (mesurée) | S–M | V1 |
| V5 | Stockage incrémental (P01) | seulement si un long lot montre une dérive de mémoire | L | V1, mesure |
| U1 | Résumé de partie (U04) | lots, cuts distincts, différés restants | M | — |
| U2 | Essais du vrai panneau (C02) | clavier, focus, mouvement réduit, 200 % | M | — |
| U3 | Raccourcis `D`, `Maj+Espace` | — | S | — |
| B1 | Voisins validés en ligne (D-054) | si D4 montre les rails voisins dans la page : les brancher (code prêt), en dernier recours. Porte : partie neuve, C1 en hausse, 0 faux ajouté | M | D4 |
| B2 | Décentrer la vue d'ESV (D-049) | une tâche de 10 min pour savoir déplacer la vue, puis prototype en version de test. Porte : zones décalées des parties 2, 11 et 33 posées, 0 faux ajouté | L | tâche de 10 min |
| B3 | Coordinateur de lot (C01) | seulement si B2 l'exige | L | B2 |
| P2 | Précision humaine (KI-038) | 30 cuts reposés en aveugle, une fois (15 min) | S | — |

**Ordre de la 4.9.0** : V1, puis V2 et V4, puis V3 (un réglage par cycle).
U1 à U3 en parallèle, sur des fichiers distincts. Stable aux portes.

**Ordre de la 4.9.5** : B1 dès que les données de D4 le permettent, puis B2
après sa tâche de 10 min, puis B3 si besoin. Stable aux portes.

**Après la 4.9** : régresseur appris (données qualifiées par la rotation) ; 5.0 multi-session.

## 4. Qui fait quoi

| Acteur | 4.8.5 | 4.9 |
|---|---|---|
| Direction | décisions de la fiche de chaque cycle ; étiquettes | signature du cahier 4.9 v0.2 |
| Opérateur | J0 ; un lot et sa relecture (J2) | un lot par cycle ; P2 (15 min) ; tâche décentrage (10 min) |
| Orchestrateur | D1 à D7, mesures, fiches de décision | tous les chantiers ; cahier 4.9 v0.2 |
| Astra | audit de l'orchestration (maintenant) ; diff 4.8.5 avant la stable | recalcul de toute règle née d'un banc ; diff avant chaque stable |

**Sessions parallèles** : l'orchestrateur peut confier D5, V1 ou U1 à U3 à une
session séparée : fichiers distincts, même définition de « fini ». Jamais deux
chantiers sur `background.js` en même temps.
