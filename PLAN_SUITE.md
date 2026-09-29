# Plan de la suite — 4.8.5, 4.9 (plan vivant)

Seul plan en vigueur ; `NEXT_TASKS.md` et `PLAN_4.8.md` sont clos. Règles de
pilotage : D-060, D-061. Diagnostic et portes : `audit/chantiers/audit-orchestration-485.md` ;
contre-regard d'Astra et suites données : `audit/chantiers/audit-orchestration-485-astra.md`.
Ta fiche pas à pas : `consignes/operateur-suite.md`.

## 0. Jalons

| Jalon | Contenu | Porte |
|---|---|---|
| **J0** clôture 4.8.0 — **faite** | étiquettes créées et vérifiées ; qualité finale validée par l'expertise de la direction, **C4 de la partie 15 non mesuré** (D-060) | clôture documentaire : le rapport de sortie le dit ; la mesure enregistrée reprend en J2 |
| **J1** 4.8.5 test 1 | chantiers D1 à D7 ci-dessous | § 1 (définition de « fini ») pour chaque chantier ; banc : 633 cuts inchangés, 8 jeux : seuls 707, 711, 718 changent |
| **J2** terrain 4.8.5 — **fait** (D-063 : lots 25 et 33 sous le test 1 ; C4 de la partie 25 validé sur l'expertise de la direction, moins de 100 jugés) | un lot sur une partie neuve, puis sa relecture | C1 ≥ 79 % ; C3 = 0 ; C4 : **au moins 100 posés jugés** et ≥ 80 % des posés, pris dans l'ordre du lot sans choix, ≤ 2 faux / 100 jugés, chacun typé, les posés non jugés listés, borne haute de Clopper–Pearson publiée (information) ; 0 interruption non reprenable ; **chaque refus de la garde examiné** à la relecture : aucun refus d'une pose qui aurait été juste, sauf décision nommée |
| **J3** 4.8.5 stable — **candidat prêt** (D-063), en attente de la direction | audit Astra du diff, étiquette | portes J2 + aucun P1 d'Astra |
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
| KI-066 | Numéros de segment Écho | `panel.js`, `background.js`, `src/native-session.js` | **fait** (`bea32f0`, essais `budget-liberation`, `echo-vidage-audit-480`) ; part dans le paquet (D7) | — |
| D1 | Numérotation et cohabitation | `manifest.json`, `src/core.js`, `panel.html`, `panel.js`, `background.js`, `tools/package.py` | S | — |
| D2 | Garde d'écartement bas à 1 420 mm | `src/lot-decision.js`, `tools/acceptance-report.cjs` | S–M | — |
| D3 | Fin de partie après un différé (KI-067) | `background.js` | M | D4 (preuve de fin de partie) |
| D4 | Instrumentation passive | `src/adapter-page.js`, `background.js` | M | D1 (même fichier) |
| D5 | Outils de portes | `tools/perf-lot.cjs`, nouvel outil de portes | S–M | — (en premier : les portes avant le code) |
| D6 | Documents et état | rapport de sortie, `KNOWN_ISSUES.md`, `LIRE_EN_PREMIER.md` | S | J0 pour les chiffres |
| D7 | Revue, paquet, essai Chromium | — | S | D1 à D6 |

**D1 — Numérotation et cohabitation.**
- Manifeste `4.8.5.1`, nom « Ariane 4.8.5 TEST », `version_name` « 4.8.5 test 1 » ; la version affichée dans le panneau, les exports et le zip en découle (`ariane-4.8.5-test.1.zip`).
- Avant d'injecter quoi que ce soit, Ariane regarde si la page ESV porte déjà l'adaptateur d'une autre version. Si oui, elle refuse : « Une autre Ariane (4.8.0) est active dans cet onglet : désactive-la dans edge://extensions, puis F5 sur ESV ».
- **Vérifier avant d'injecter** : aujourd'hui `equiperOnglet` injecte les fichiers, puis vérifie la version (Astra, VÉRIFIÉ).
- **Adaptateur à propriétaire unique** : l'adaptateur de la version de test n'obéit qu'à l'extension qui l'a installé, et garde ses propres modules dès l'installation. Aujourd'hui, il accepte les commandes de n'importe quel canal. Sans cela, une 4.8.0 activée après la version de test réinjecterait ses fichiers par-dessus : le seul refus côté test ne suffit pas (Astra).
- Essais (rouges sans correctif) : 4.8.0 connectée puis TEST → refus, rien d'injecté ; TEST connectée puis réinjection 4.8.0 et commande d'un canal étranger → aucune action ESV, mise en sécurité dite ; même version → connexion ; nom et version du paquet.
- Limite : la 4.8.0 ne peut plus changer ; « une seule Ariane active » reste la règle (D-060).

**D2 — Garde d'écartement bas (D-060).**
- Dans la décision sur le lot : un premier passage **sans appui** dont la paire est sous 1 420 mm est différé (motif « écartement bas au premier passage »). Garde seulement, jamais une cible. Le motif « écartement bas » est affiché dans le panneau, pour que l'opérateur trouve ces cuts à la relecture.
- La règle est consignée dans la décision (nouvelle version de la décision) pour que le rejeu la relise ; les lots anciens se rejouent avec leurs règles.
- Essais : 1 405 et 1 414,5 mm refusés ; 1 426 mm accepté ; avec un appui, non concerné ; parité des lots anciens.
- Porte : 633 cuts de validation inchangés ; 8 jeux : 707 et 711 refusés, 718 posé en ricochet, 0 juste perdu.

**D3 — Fin de partie après un différé (KI-067).**
- Dans un lot « jusqu'à la fin de la partie », si ESV quitte la page juste après le « suivant sans décision » d'un cut sans pose : **pause**, avec un message clair : « ESV a quitté la page après le différé du cut N ; fin de partie probable : F5, puis Reprendre ».
- **Preuve de fin** : à la reprise, ESV affiche une autre partie **et** le dernier geste du lot était la navigation depuis N. Alors le lot se clôt, « Fin du lot : ESV a quitté la partie après le cut N », et N est retenu comme fin de la partie. Une autre partie ouverte à la main, sans cette navigation, protège le lot sans rien affirmer sur la fin.
- **Le compteur « N on M » n'est pas une preuve** : il compte les cuts traités, pas le rang du cut, et sa signification n'est pas établie (Astra, VÉRIFIÉ : `cutLabel` lit un identifiant). Aucune commande n'est renvoyée.
- **Onglet sorti d'ESV** pendant une lecture : erreur reprenable, comme une page absente. Aujourd'hui, `callSur` renvoie une erreur distincte (Astra, VÉRIFIÉ).
- Dans un lot borné, ou sur un cut posé : comportement actuel, car l'incertitude y est réelle.
- Essais : dernier différé, reprise sur une autre partie → lot clos et fin retenue ; sans reprise → pause et message, aucune commande renvoyée ; autre partie ouverte à la main au milieu d'un cut → arrêt de protection, aucune fin retenue ; onglet hors ESV → erreur reprenable ; F5 pendant un lot → pause reprenable (non-régression).
- Réserve : le moteur (épinglé) gère le différé ; la correction se fait dans son enveloppe (`background.js`), avec une revue dédiée.

**D4 — Instrumentation passive (D-061).**
- À chaque capture, sans commande ni écriture dans ESV :
  - le texte « N on M treated » s'il est lisible (M = nombre de cuts de la partie) ;
  - le nombre de cuts voisins dont la page garde les rails, dans la structure que l'adaptateur lit déjà pour le cut courant (des nombres, pas les poses).
- Rangés dans le journal ; format inconnu → champ absent, jamais d'erreur.
- Chaque relevé porte l'identité du cut et l'heure : jamais de réemploi d'une valeur précédente ; format inconnu → champ absent. Essai : format reconnu → absent → inconnu → changement de cut.
- Usage : (a) **qualifier** la signification du compteur sur le premier lot (information, pas une preuve de fin) ; (b) **premier signal seulement** pour les voisins validés en ligne (D-054) : B1 exigera en plus l'identité des cuts, leur statut validé, des coordonnées lisibles et leur fraîcheur (Astra, constat 6).

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

D8 (« Relire ce lot dans Écho ») : non retenu par la direction (28/09).

**Ordre** (revu après Astra) : **D5 d'abord** (les portes existent avant le code) et D6 (clôture J0) ; puis D1 → D2 → D4 → D3 en série (`background.js` commun) ; enfin D7, paquet test 1, puis toi (J2). Astra relit le diff pendant J2. Un test 2 seulement en cas de panne au terrain.

**Hors 4.8.5** : garde de voie à 20 mm (sauf si, rejouée après D2, elle ne perd plus aucun juste) ; choix à un appui (7738, 7026) et biais vertical des passages à niveau : banc de fond pendant J2, sans code.

**Après le lot J2** (avec son résultat ; pas de test 3 avant) :
- **(a) Message de fin de partie contradictoire** quand M est connu et que le
  cut n'est pas M−1 : « M cuts relevés : le dernier serait le M−1 », puis « le
  cut N pourrait être le dernier de la partie ; saisis-le comme dernier cut ».
  Dans ce cas, le message ne doit plus inviter à saisir ce cut.
- **(b) « Lot terminé, sauf les différés »** : quand le compteur D4 donne total
  − traités = nombre de cuts différés du lot, clore proprement (« Fin du lot : il
  ne reste que N cuts différés ») au lieu d'une pause « Adaptateur ESV sans
  réponse ». Constaté sur le lot 25 (29/09, test 1 : total − traités = 12 =
  différés), `audit/lot-485-p25-2026-09-29.md` de la branche
  `claude/banane-48-cahier`.

**D9 — registre de rotation des parties** : `audit/rotation-parties.md` (fait le
29/09), à tenir à jour à chaque lot ; le lot J2 suivant prend une partie neuve
avec au moins ~200 cuts non validés (la partie 25 était validée à 99 %).

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

**Ordre de la 4.9.0** : **P2 au premier cycle** (avant toute conclusion sur la précision, Astra), V1, puis V2 et V4, puis V3 (un réglage par cycle). U1 à U3 en parallèle, sur des fichiers distincts, **seulement si le budget de l'opérateur le permet**.

**Porte de version 4.9.0** : cycle médian −25 % (V3, V4 et le reste ensemble), C1 et C4 non dégradés. La capture seule ne suffit pas : elle pèse 48 % du cycle, et −30 % sur la capture n'en retire qu'environ 14 %.

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
