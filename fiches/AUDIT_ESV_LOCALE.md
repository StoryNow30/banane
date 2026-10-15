# Audit « ESV locale » : quoi faire d'un banc qui imite ESV pour tester Ariane (14 octobre 2026)

Statut : **audit du 14 octobre, puis solution construite le 15 octobre (§ 8 et § 9) à la demande de Mic.** Auteur : session Claude Code `claude/esv-locale-audit`. Base lue : `DECISIONS.md` (D-074 à D-105), `fiches/`, `consignes/`, `tools/`, `tests/`, `src/adapter-page.js`, `manifest.json`.

Limites de cet audit, à savoir avant de lire :
- La branche de départ porte le **code 4.8.6** (manifeste, `src/`). Le code 4.9 (observateur passif `src/esv-observer.js`, mode rapide, B3, retour à une coupe, `tools/perf-v3.cjs`) n'est **pas** sur cette branche : je l'ai lu à travers DECISIONS et les fiches, pas dans le code.
- `fiches/B3_RAPPORT.md` **n'existe pas** sur cette branche (B3 est décrit en D-102 et D-104).
- Le banc ESV local privé (mission B, `missions/B_ESV/banc`, hors dépôt) n'est pas accessible depuis ce conteneur : tout ce que j'en dis vient des décisions D-074, D-077, D-079, D-088, D-091, D-098 et de `PILOTAGE_REPRISE.md`.
- Aucune donnée d'export, aucun identifiant de projet, aucune adresse d'ESV n'est recopié ici.

## 1. Ce qu'Ariane attend d'ESV (contrat observé, pas documenté)

| Élément d'ESV | Ce qu'Ariane en fait | Où c'est écrit | Statut |
|---|---|---|---|
| Texte `Cut N of part P` dans `#O2N3DCutDescription` | identité du cut (toutes les commandes) | `src/adapter-page.js` `cutLabel` | **connu** (code) |
| Texte `U50` dans `#O2N3DCutShapeInfo` | profil ; tout autre profil est refusé | `context()` | **connu** |
| Boutons `#O2N3DCutLRClick`, `#O2N3DCutRRClick` | choix du rail courant (classe du bouton relue avant clic en mode rapide) | `select`, D-088 | **connu** |
| Bouton `#O2N3DCutValidate3DRail`, `#O2N3DCutNextInvalid3DRail` | valider, cut invalide suivant sans décision | `nextWithoutDecision`, KI-024/026 | **connu** |
| Raccourcis `Maj+Retour` (SKIP), `Ctrl+Entrée` (valider sur place), `Maj+Z`, `D`, `Maj+Espace` | décisions et navigation | `nativeDecision`, U3 | **connu** (dits par Mic ou lus dans le code chargé) |
| Compteur « N on M treated » (texte, parfois réparti sur 3 niveaux du DOM) et « M cuts » | `totalReleve` : fin de partie M−1, preuve de validation sur place (N → N+1, même M), tuile du lot | `releverEsv`, D-062, D-105 | **connu** (format du texte) ; **inconnu** : élément exact, moment de mise à jour, cas « plusieurs compteurs » |
| `window.viewer.scene.scene` : 2 `Object3D` (Mesh + profil avec `Line` de 625 sommets) | identification gauche/droite par la moyenne des y du contour ; poses lues dans les matrices monde | `context`, `railState` | **connu** |
| `viewer.scene.pointclouds` (Potree : `visibleNodes`, nœuds géométrie, `clipBoxes`) | lecture des points (lecteur gelé), signal de fin de chargement (I3), empreinte des nœuds | `vendor/lidar.js`, D-088 | **connu** dans ses grandes lignes ; détails de chargement **supposés** hors du vrai Potree |
| Clic sur le canevas (`viewer.renderer.domElement`) | pose du rail courant au point rayon caméra ∩ plan de coupe ; ESV ne vérifie pas que le point est dans la vue | `clickPosition`, D-088 P1 | **connu au banc**, **non vérifié sur le vrai ESV** |
| Boutons précédent/suivant, événement interne de saut | retour à une coupe (test 12) | D-098 | **supposé** (hypothèses du banc : index = N, partie en texte, boutons sans décision) |
| GET liste des coupes (pages de 1 000 lignes : `ExtractionStatus`, `TreatedByOperator`, bords gauche/droit en monde, `RailSpacing`…) | comptes (`listSummary`), B1 voisins validés (ombre) | `fiches/FICHE_B1.md`, D-095 | **connu** (HAR privé) ; appariement cut ↔ ligne **non établi** |
| PUT de validation (corps avec bords en monde, statut 204) | preuve d'écriture, calibrage monde = scène + T | D-079, FICHE_B1 | **connu** |
| Fonctions internes `buttonNextInvalidCut`, `loadNextInvalidCut`, `railPairUpdated('valid'/'skipped')` | chemins « navigation sans décision » et « décision » séparés | KI-024 | **connu** (code chargé, propriété de l'éditeur) |
| Temps : capture 4,8 s (sélection 0,3 s, stabilité 0,85 s, lecture 1,1 s par rail), pose 1,35 s, validation 1,0 s ; mode rapide −53 à −64 % | perf Orbite, mode rapide | D-088, D-092, D-105 | **connu sur le terrain** ; reproductible seulement avec le vrai Potree |

Formats produits par Ariane que le banc doit savoir lire ou rejouer : `banane-native-session-v2` (Écho, `src/native-session.js`), journal `banane-journal-v4` et bilan `banane-bilan-v4` (Orbite, `tools/perf-lot.cjs`, `tools/merge-segments.cjs`), captures `banane-lidar-…` (points en repère scène, `tests/corpus/`).

## 2. Ce qui existe déjà pour simuler ESV

| Double d'ESV | Niveau | Où | Sert à | Manque |
|---|---|---|---|---|
| `SimulatedESV` (`tests/fixtures.cjs`) | commandes de l'adaptateur (capture, apply, validate, next, defer) | dépôt, ~1 500 essais `verify` | moteur, lot, B3 (D-104), sauvegarde V5 | aucun DOM, aucun compteur, aucun Potree |
| Fixture web (`tools/browser-fixture.cjs`, `tests/browser/harness.js`) | page web, API Chrome simulées, ESV au niveau commandes | dépôt | panneau + service worker réels dans un navigateur | pas d'ESV ; jamais exécutée dans cette session (README) |
| Banc U2 (mission F, `claude/49-u2-qualification`) | vrai panneau dans Chromium | branche à part | qualification du panneau (24/24, 9/9) | pas sur cette branche |
| « Page synthétique » du retour à une coupe (D-098, 7/7 Chromium) | DOM minimal d'ESV | **emplacement inconnu** (privé ou branche test 12) | goToCut | à retrouver |
| **Banc ESV local privé** (mission B, D-074) : vrai code ESV + Potree reconstruit depuis les originaux du 4 octobre, confiné, latence simulée | ESV complet | `missions/B_ESV/banc`, **hors dépôt, dans un espace de session** | a prouvé le mode rapide (D-088), mesuré la lecture par rail (D-091), confirmé le saut par événement interne, essayé l'observateur dans Chromium (test 2) | points complets seulement pour les coupes 0 à 3 de la partie 21 ; relecture indépendante jamais faite ; **durabilité non garantie** (conteneur éphémère) |

Le point important : **l'ESV locale existe déjà**, et c'est elle qui a produit les preuves les plus utiles de la 4.9. Le problème n'est pas d'en construire une, c'est que celle qui existe est **hors dépôt, non relue, pauvre en données** et qu'elle dépend d'un espace de travail qui peut disparaître.

**Réponse de Mic (15 octobre) : les deux problèmes (banc B fragile ; doubles du dépôt sans DOM, sans compteur, sans Potree) doivent être résolus.** Le second l'est (§ 8). Le premier a sa solution écrite et outillée (§ 9) ; il reste une action de Mic.

## 3. Ce qui manque pour une simulation fidèle

| Besoin | Connu | Supposé | Inconnu |
|---|---|---|---|
| DOM d'ESV (identifiants, compteur, boutons précédent/suivant) | identifiants des 6 commandes, format des textes | structure autour du compteur, boutons de navigation arrière | HTML exact, moment où le compteur change |
| Potree (chargement, LOD, `visibleNodes`) | comportement au banc B | règles de visibilité | comportement sur carte graphique et réseau de Mic, Edge |
| Points des cuts | partie 21 coupes 0 à 3 (banc B) ; captures scène-relatives de la partie 23 (`tests/corpus/`) ; exports privés | – | nuages complets d'une partie entière (collecte HAR par Mic, D-079, mise de côté) |
| Liste des coupes et écritures | forme des lignes, PUT 204 | appariement cut ↔ ligne | erreurs serveur réelles (jamais observées, FEUILLE § 4) |
| Événements internes d'ESV | saut confirmé au banc | nom et charge utile stables | fidélité sur le vrai ESV |
| Déroulé d'un lot (pause, F5, erreurs) | transitions B3 nommées | – | comportement d'ESV après F5 et sur erreur réseau |

## 4. Options

| | A. Maquette minimale | B. Simulateur piloté par les sessions Écho / exports | C. Banc ESV réel (mission B) rendu durable |
|---|---|---|---|
| Quoi | page HTML + scène factice (2 rails `Object3D`, canevas, compteur, 6 boutons, liste des coupes synthétique), points pris dans `tests/corpus/` ; lancée par Playwright dans `verify` | A + un lecteur d'exports (`banane-native-session-v2`, bilan v4) qui rejoue cut par cut les identités, poses de départ, poses humaines finales, points | emballer le banc existant (code ESV + Potree + données) avec README, matrice d'essais, politique de données |
| Fidélité | DOM et commandes : bonne ; temps et Potree : **nulle** | comme A pour ESV ; **vraie séquence de données** | la meilleure disponible (vrai code) ; temps indicatifs seulement (D-088 : non mesuré sur le vrai ESV) |
| Valeur 4.9 | B3 (transitions, F5, erreurs), compteur et tuile du lot, fiche de départ, retour à une coupe (hypothèses), U3 : non-régression automatique à chaque `verify` | B1 en ombre jugé hors ligne contre les corrections Écho (déjà fait à la main, D-097 à D-100) ; rejeu des exports allégés | preuves de vitesse (mode rapide, I2/I3/P1), erreurs d'ESV, saut par événement |
| Valeur 5.0 | base de tout essai d'interface | **forte** : interpolation (D-098 à D-100), zones ADV/PN (`METHODES_METIER_5.0.md`), apprentissage GCV2, B2 caméra | forte pour B2 (caméra Potree), nouvelles failles d'ESV |
| Coût | 2 à 3 jours d'agent (page, Playwright, 10 à 15 scénarios) | +2 à 3 jours (lecteur, appariement, jeux privés) | 0,5 à 1 jour d'emballage ; collecte de points = temps de Mic (HAR nettoyé, 20 à 30 min par partie) |
| Risque | croire la maquette là où elle ne prouve rien (temps, Potree) : à écrire dans chaque essai | données client : rejeu seulement sur des exports **hors dépôt** ; appariement cut ↔ ligne non établi | code propriétaire de l'éditeur : **ne peut pas aller dans `banane`** (dépôts Banane publics selon `consignes/chantier-1-operateur.md`) ; relecture indépendante jamais faite |
| Dépôt possible | `banane` (`tests/esv-maquette/`), zéro contenu ESV, données = captures déjà versionnées | moteur de rejeu dans `banane`, données privées hors dépôt (modèle `datasets/native/`) | **`banane-banc` privé** ou poste de Mic seulement |

Choix du dépôt, en une ligne par cas :
- **`banane`** : tout ce qui est écrit par nous, sans un octet d'ESV ni de donnée de partie nouvelle (A, et le code de B).
- **Dossier privé dans `banane`** : non. Un dossier « privé » dans un dépôt partagé finit poussé par erreur ; `datasets/native/` montre la bonne règle : le chemin est versionné, le contenu non.
- **`banane-banc` privé** : oui pour C (code ESV, Potree, HAR nettoyés, points), si Mic accepte qu'une copie du code de l'éditeur existe sur GitHub privé. Sinon : archive chiffrée sur le poste de Mic avec SHA-256 consigné, et le banc ne tourne que chez lui.

## 5. Recommandation

**Faire A dans `banane` (fait le 15 octobre, § 8), sauver C dans `banane-banc` (§ 9), garder B pour la 5.0.**

1. C est la seule chose urgente : le banc qui a prouvé la 4.9 n'est ni versionné ni relu. Le mettre à l'abri coûte une demi-journée.
2. A donne à la 4.9 ce qui lui manque aujourd'hui : une preuve automatique, à chaque `verify`, que B3, le compteur, la fiche de départ et le retour à une coupe tiennent contre un DOM qui ressemble à ESV. Le banc complet « sur le poste de Mic » (D-104) n'est pas lancé : A le remplace pour tout ce qui ne dépend pas de Potree.
3. B n'est pas nécessaire pour livrer la 4.9 (Mic : pas de gros travaux avant la 5.0, D-101). Il sera le premier chantier de la 5.0, quand le périmètre sera redéfini avec Mic.

Ce que A ne prouvera **jamais** : la vitesse, le chargement des points, Edge, le vrai serveur. Chaque essai de A doit porter la mention « maquette, non vérifié sur ESV », comme D-098.

## 6. Plan par étapes

| # | Étape | Qui | Coût | Résultat attendu |
|---|---|---|---|---|
| 0 | Retrouver le banc B et la « page synthétique » du retour à une coupe (où sont-ils, dans quel état) | Mic (réponse) + orchestrateur | 30 min | inventaire : chemins, taille, SHA |
| 1 | Créer `banane-banc` privé (ou archive chiffrée), y déposer le banc B tel quel + README (origine, matrice 113/113, E1 à E6, règle « aucun identifiant de projet, aucun jeton ») | Mic (création du dépôt) + orchestrateur | 0,5 j | banc versionné, SHA consigné dans DECISIONS |
| 2 | Maquette A dans `banane/tests/esv-maquette/` : page HTML, scène factice, compteur, 6 boutons, boutons précédent/suivant, liste synthétique ; lancement Playwright dans `verify` (sauté si Chromium absent, comme le corpus natif) | agent (modèle fort, mandat borné) | 2 j | 10 scénarios : lot complet, pause/reprise, F5, erreur, fin de partie M−1, validation sur place, retour à une coupe, U3 |
| 3 | Relecture indépendante de A contre le contrat du § 1 ; chaque hypothèse (§ 3 « supposé ») listée dans le README de la maquette | agent relecteur | 0,5 j | liste des hypothèses à vérifier sur le vrai ESV |
| 4 | Vérification de 3 hypothèses sur le vrai ESV par Mic avec l'extrait A de `consignes/chantier-1-operateur.md` (compteur, boutons précédent/suivant, événement de saut) | Mic | 10 min | hypothèses → connu |
| 5 | (5.0) Lecteur de rejeu B : exports Écho → maquette, hors dépôt pour les données | agent | 2 à 3 j | B1, interpolation, zones à risque rejouables |
| 6 | (5.0) Collecte ciblée de points pour C (HAR nettoyé, méthode D-079) | Mic | 20 à 30 min par partie | banc B élargi au-delà de la partie 21 |

Total pour la 4.9 (étapes 0 à 4) : **environ 3 jours d'agent et 40 minutes de Mic**.

## 7. Ce que je demande à Mic (le minimum, mis à jour le 15 octobre)

1. **Où est le banc B aujourd'hui** (poste, archive, espace de session) et : d'accord pour un dépôt privé `banane-banc` qui contient du code de l'éditeur d'ESV ? Oui / non / archive chez toi seulement. Procédure prête au § 9.
2. **2 minutes sur le vrai ESV** : coller `tools/esv-contrat-releve.js` dans la console (lecture seule), remettre le JSON en privé ; `node tools/esv-contrat-comparer.cjs RELEVE.json` dit ce que la maquette doit changer. L'extension Claude dans le navigateur n'est utile qu'après, pour lire le code chargé d'ESV (boutons précédent/suivant, événement de saut, gestionnaire clavier), avec la réserve de D-079 (jamais pendant une validation, jamais de jeton).

La maquette A est dans `banane` (zéro contenu ESV, données déjà versionnées) : si Mic la refuse là, elle se déplace telle quelle dans `banane-banc`.

Sans réponse à la question 1, le risque de perte du banc B reste entier.

## 8. Réalisé le 15 octobre 2026 : la maquette ESV dans `banane` (option A, et plus)

Dossier `tests/esv-maquette/` (README avec le tableau connu / supposé / inconnu), outil `tools/banc-esv.cjs`, outil `tools/controle-confinement.cjs`. Aucun code ni contenu d'ESV ; données = les captures déjà versionnées dans `tests/corpus/` (repère scène), posées dans un monde factice. `src/`, `background.js`, `panel.*`, `vendor/`, `tools/verify.cjs` : **non touchés** (`verify` : 1 022 réussis, 0 échec, 2 sautés, comme avant).

| Niveau | Ce qui tourne | Résultat mesuré (Chromium 141, conteneur) |
|---|---|---|
| Page seule | DOM d'ESV (6 commandes, compteur « N on M treated », « M cuts »), scène (2 rails `Object3D` + profil + contours du corpus), Potree factice (16 nœuds par cut, chargés par lots avec latence, boîte de découpe, `numNodesLoading`), caméra orthographique, clic = pose du rail courant dans le plan de coupe au pixel entier, raccourcis `Maj+Z`, `Maj+Retour`, `Ctrl+Entrée`, `Maj+Espace`, `D`, boutons précédent/suivant, liste des coupes `GET` paginée, écriture `PUT` → 204 journalisée | utilisable à la main : `node tests/esv-maquette/serveur.cjs 8124` |
| Adaptateur réel | `src/adapter-page.js` et ses modules injectés tels quels (comme `background.js` le fait), 9 essais | **9 / 9** : identité et poses identiques au corpus ; **capture identique à la capture d'origine : 4 764 points, 2 322 gauche / 2 442 droit** ; pose par clics à moins de 1 mm puis restauration ; navigation sans décision (refus du doublon d'opération) ; valider et suivant (écriture `valid`, compteur N → N+1, cut non validé suivant) ; SKIP (écriture `skipped`) ; valider sur place ; retour à une coupe ; aucune erreur de page |
| Extension réelle | l'extension du dépôt chargée dans Chromium, l'hôte d'ESV **routé** vers la maquette, lot Orbite lancé par les messages du panneau (`connect`, `settings`, `start`), suivi jusqu'à la fin, journal et écritures rendus | lot de 10 cuts : **5 posés et validés, 3 différés (rail non résolu), fin de lot détectée** quand la maquette passe hors du lot ; 45 s ; 6,3 à 6,8 s par cut posé, 3,9 à 4,5 s par cut différé (latence factice 40 ms) ; 0 erreur. Essai automatique : lot de 2 cuts posés |

Ce que cela règle : **toute version d'Ariane peut maintenant être essayée de bout en bout sans ESV et sans le poste de Mic** (B3, compteur et tuile du lot, fiche de départ, retour à une coupe, U3, exports), à condition de rester sur ce que la maquette reproduit. Ce que cela ne règle pas : la vitesse réelle, le vrai Potree, Edge, le vrai serveur ; et les hypothèses du README restent à confirmer sur ESV (10 minutes de Mic).

Observation à vérifier par l'orchestrateur : sur le lot de 10 cuts, la vue du panneau rend `lotPosedCount` = 4 pour 5 poses appliquées et validées (événements `applied-verified` et écritures `valid` sur 103, 105, 106, 107, 108). Comptage de la 4.8.6 ou effet du dernier cut : non instruit ici.

**Rejeu d'un vrai lot (option B, faite le 15 octobre à la demande de Mic).** `tests/esv-maquette/lecteur-export.cjs` lit les exports d'Ariane tels que le code source les écrit : bilan Orbite avec nuages (`banane-test-dataset-v4` + captures `banane-lidar-capture-v1`), corpus GCV1, session Écho (`banane-native-session-v2`, ou segments compacts relus par `tools/merge-segments.cjs` : visites et blocs par rail). Il rend une partie rejouable avec la découpe réelle de chaque capture, la pose de départ d'ESV et une référence par cut (pose corrigée par Ariane en Orbite, **pose finale humaine** en Écho). `node tools/banc-esv.cjs --export EXPORT` joue le lot sur toute la partie et donne l'écart de chaque pose à la référence en mm. **Mesuré : un lot joué, exporté en bilan, rejoué depuis ce bilan rend les mêmes poses à 0,0 mm.** Un export Écho de terrain reste à rejouer une première fois (formats suivis depuis le code, essai sur session synthétique). Les données d'export ne vont jamais dans le dépôt.

**Premiers tests (15 octobre, demande de Mic) : la 4.9.0.15 (test 15, branche `claude/ux-variantes`) sur le banc.**

| Essai | 4.8.6 (dépôt) | 4.9.0.15 (test 15) |
|---|---|---|
| Lot synthétique de 10 cuts (mêmes cuts, latence factice 40 ms) | 5 posés et validés, 3 différés, 45 s ; 6,3 à 6,8 s par cut posé | **7 posés et validés, 1 différé**, 41 s ; 5,0 à 6,0 s par cut posé ; fin de lot : « navigation observée, état final non relu » sur le dernier cut |
| Rejeu du bilan (3 cuts, référence = poses d'Ariane 4.8.6) | 0,0 mm d'écart sur les 2 cuts posés | 0,0 mm d'écart sur les 2 cuts posés |
| Observateur passif 4.9 | sans objet | liste de la partie vue (112 lignes, une par indice), 7 écritures vues avec `rowIndex` = cut ; aucune perte |
| B1 en ombre | sans objet | repère **calibré** sur la première écriture, appariement indice = géométrie à 0 mm, voisins trouvés sur chaque cut (candidats, gardes, règle consignés) |
| Erreurs | 0 | 0 |

Ce que cela dit : le même lot, les deux versions, les mêmes données, sans ESV ; la 4.9 résout deux cuts de plus que la 4.8.6 (cause non instruite ici : moteur V5 ou garde d'écartement 1420). Ce que cela ne dit pas : la vitesse réelle (latence factice).

**Pour l'apprentissage (demande de Mic).** `tools/jeu-apprentissage.cjs` rend, hors ligne, un jeu `banane-apprentissage-v1` depuis n'importe quel export : pose de départ, référence (humaine en Écho), écart en repère profil, points par rail, voisins, interpolation D-098 et son écart, écart de la pose rejouée par Ariane. Les cuts d'un même repère de scène sont placés dans un repère commun ; avec un export 4.9 (écritures observées), le monde de la maquette devient le monde réel (T mesurée comme B1). `--valides K` sert des voisins déjà validés à leur pose de référence, pour éprouver B1 et l'interpolation sur le banc.

**Durcissement « ingénieur » (15 octobre, demande de Mic).** (a) Points chargés par cut au chargement du cut (`/maquette/ept-data/…`, cache), comme Potree ; l'observateur 4.9 les classe ressources de points. (b) Pannes simulées réglables (`--pannes`) : écriture refusée ou lente, liste illisible après démarrage, rails absents, nuage instable, nuage vide, changement de partie ; 4 essais disent ce qu'Ariane fait dans chaque cas (navigation malgré le refus, attente de stabilité, `nextReady` faux, capture vide). (c) `tools/banc-comparer.cjs` : deux rapports, même lot, issue par cut. (d) Contrat ESV **vérifiable** : `tests/esv-maquette/contrat-esv.json` (15 hypothèses), `tools/esv-contrat-releve.js` (relevé en lecture seule à coller dans la console du vrai ESV, sans adresse ni jeton), `tools/esv-contrat-comparer.cjs` (confirmée / infirmée / non relevée, quoi changer dans la maquette). (e) Revue de code indépendante du diff : 10 constats (cache des nœuds par cut sans la partie, retour arrière incomplet d'une écriture refusée, panne `http: 0` inatteignable, nœuds servis depuis un autre scénario, `--pannes` invalide laissant le serveur ouvert, cuts en chaînes ignorés, liste illisible dès le démarrage, promesse non rattrapée, arguments du comparateur) : **tous corrigés**, règles de panne normalisées côté serveur. (f) 21 essais de la maquette verts (`node tests/esv-maquette/essais.cjs`) ; `verify` inchangé.

Observations pour l'orchestrateur (4.9.0.15 sur le banc, à instruire, rien n'est changé dans Ariane ici) :
- la preuve de validation reste `navigation-only`, `serverConfirmed: false`, alors que l'observateur a vu l'écriture 204 du même cut (`rowIndex` = cut) : la preuve d'écriture n'alimente pas la preuve de validation du lot ;
- **écriture refusée par le serveur (HTTP 500 simulé sur le cut 105)** : l'observateur l'a vue (`status: 500`, `rowIndex: null`), ESV a navigué, et le lot a accepté le cut 105 comme validé (`validation-accepted`, preuve `navigation-only`) puis a continué. Sur le terrain, un tel cut serait compté validé par Ariane et resté invalide dans ESV. À confronter à la porte « exports conformes » et au compte des validés de la fiche de départ ; la liste des coupes relue (B1) le verrait.

Suites possibles, par ordre d'utilité : (1) rejouer le code 4.9 (branches `claude/49-test-*`, test 15) sur ce banc : `node tools/banc-esv.cjs --extension DOSSIER_DU_PAQUET` ; (2) premier rejeu d'un export de terrain de Mic (parties 17, 18 ou 23) : `--export`, puis comparer deux versions d'Ariane sur le même lot avec la référence humaine ; (3) erreurs d'ESV par réglage (écriture refusée, nuage jamais chargé) ; (4) exposer la référence humaine au futur apprentissage (GCV2) directement depuis le scénario rejoué.

## 9. Solution pour le banc B privé (code ESV + Potree) : procédure prête, une action de Mic

Le banc B ne peut pas entrer dans `banane` (code de l'éditeur, dépôts Banane traités comme publics). La solution est un **dépôt privé `banane-banc`**, ou, si Mic refuse qu'une copie du code de l'éditeur existe sur GitHub, une **archive chiffrée sur son poste** avec SHA-256 consigné dans DECISIONS. Dans les deux cas :

| Étape | Qui | Durée | Détail |
|---|---|---|---|
| 1. Retrouver le banc | Mic | 5 min | dire où est `missions/B_ESV/banc` (poste, archive, espace de session de l'orchestrateur) ; s'il est perdu, les originaux du 4 octobre suffisent à le reconstruire (D-074) |
| 2. Contrôler avant tout dépôt | orchestrateur | 5 min | `node tools/controle-confinement.cjs DOSSIER_DU_BANC` : refuse jetons, identifiants de projet, échanges d'authentification, HAR bruts |
| 3. Créer `banane-banc` privé | Mic | 5 min | dépôt privé GitHub, collaborateurs : Mic seul (l'orchestrateur y pousse par ses branches `claude/…`, comme ici) |
| 4. Structure | orchestrateur | 1 h | `originaux/` (code ESV et Potree du 4 octobre, jamais modifiés), `banc/` (serveur confiné, latence simulée), `donnees/` (HAR nettoyés, points de la partie 21), `essais/` (`x_turbo`, `x_ariane`, matrice 113/113, E1 à E6), `README.md` (provenance, interdictions, comment lancer), le contrôle de confinement en pré-commit |
| 5. Relecture indépendante | agent | 0,5 j | jamais faite (PILOTAGE_REPRISE § 2) : à faire avant tout nouvel usage comme preuve |
| 6. Élargir les données | Mic | 20 à 30 min par partie | HAR nettoyé selon la méthode D-079, puis `BANANE_MAQUETTE_CORPUS` et `donnees/` |

Partage des rôles entre les deux bancs, pour ne pas les confondre : **la maquette (`banane`) sert à tout ce qui est fonctionnel et automatique à chaque version ; le banc B (`banane-banc`) sert aux preuves qui dépendent du vrai code d'ESV et de Potree** (vitesse, failles, signal de fin de chargement, événements internes). Une preuve du banc B reste « non vérifiée sur le vrai ESV » tant qu'une séance terrain ne l'a pas confirmée (D-088).
