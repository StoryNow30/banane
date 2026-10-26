# Maquette ESV — un ESV local pour tester Ariane sans ESV ni poste de l'opérateur

**Aucun code ni contenu d'ESV.** La maquette reproduit uniquement le *contrat* que le code de page d'Ariane lit (identifiants DOM, textes, forme des objets de scène et de Potree, chemins d'API), avec des données prises dans `tests/corpus/` (points en repère scène, déjà versionnés) posées dans un monde factice. Fiche d'origine : `fiches/AUDIT_ESV_LOCALE.md`.

## Trois niveaux d'usage

| Niveau | Commande | Ce qui tourne | Ce que ça prouve |
|---|---|---|---|
| 1. À la main | `node tests/esv-maquette/serveur.cjs 8124` puis `http://localhost:8124/tests/esv-maquette/esv.html?cuts=12` | la page seule (vue 2D, boutons, raccourcis, journal) | le comportement de la maquette elle-même |
| 2. Adaptateur réel | `node --test --test-timeout=60000 tests/esv-maquette/adaptateur.test.cjs` | `src/adapter-page.js` et ses modules injectés dans la page (comme `background.js` le fait, monde principal), commandes envoyées par un pont d'essai | état, capture, pose par clics, validation, SKIP, navigation, relevé passif, retour à une coupe |
| 3. Extension réelle | `node tools/banc-esv.cjs --cuts 3` ou `node --test --test-timeout=120000 tests/esv-maquette/extension.test.cjs` | l'extension du dépôt (ou `--extension DOSSIER` d'un paquet décompressé) chargée dans Chromium, l'hôte d'ESV **routé** vers la maquette, un lot Orbite lancé par les messages du panneau | la chaîne service worker → pont → adaptateur → page, de bout en bout, avec un rapport par cut |

Prérequis : Node 22 et, pour les niveaux 2 et 3, Playwright avec Chromium. Sur un poste neuf : `npm install playwright` puis `npx playwright install chromium` (ou `PLAYWRIGHT_MODULE=/chemin/vers/playwright`, `CHROMIUM=/chemin/vers/chrome`). Sans eux, les essais navigateur se **sautent** avec leur raison. Tous les essais de la maquette : `node tests/esv-maquette/essais.cjs` ; ils sont volontairement hors de `node tools/verify.cjs` (le banc complet refuse les essais sautés).

Réglages de la page (paramètres d'URL) : `cuts` (nombre de coupes de la partie), `debut` (premier numéro), `part`, `cut` (coupe affichée au départ), `latence` (ms par lot de nœuds de points), `lots` (nombre de lots), `latenceRails` (ms avant l'arrivée des rails après le libellé), `decoupeTardive` (0/1 : ESV déplace sa boîte de découpe 150 ms après le changement de cut, constat 4.7.3), `selecteur` (0/1 : sélecteur de parties SUPPOSÉ, T20a).

Corpus privé : `BANANE_MAQUETTE_CORPUS=/chemin/vers/captures` fait lire d'autres captures `banane-lidar-…json` (jamais dans le dépôt).

## Rejouer un VRAI lot (export d'Ariane)

`tests/esv-maquette/lecteur-export.cjs` transforme un export d'Ariane en partie rejouable ; les données restent hors dépôt.

| Export | Ce qui est lu | Pose de départ | Référence rendue dans le rapport |
|---|---|---|---|
| Orbite : bilan « Télécharger le bilan et les LiDAR » (`banane-test-dataset-v4` + `clouds`), corpus GCV1, ou journal + fichier de nuages | enregistrements (`rails.*.initial`, `before.rails`, identifiant de nuage) et captures `banane-lidar-capture-v1` (points des fenêtres, nœuds, **découpe réelle**) | celle d'ESV avant la pose d'Ariane | la pose corrigée par Ariane (`source: ariane`) |
| Écho : session `banane-native-session-v2` complète, ou dossier de segments `banane-native-session-v3-compact` (relus par `tools/merge-segments.cjs`) | visites `banane-native-visit-v2` et blocs `banane-native-lidar-chunk-v1` (points des fenêtres par rail, visibles par la découpe) | celle lue au moment de la visite | la **pose finale humaine** (`humanFinalReference`, `source: humaine`) et l'intention VALIDATE / SKIP |

Commandes :

```
node tests/esv-maquette/lecteur-export.cjs EXPORT [--part N]         # inventaire : cuts rejouables, exclus et pourquoi
node tests/esv-maquette/serveur.cjs 8124 --export EXPORT              # à la main : http://localhost:8124/tests/esv-maquette/esv.html?source=export
node tools/banc-esv.cjs --export EXPORT [--part N] [--cuts K] [--extension DOSSIER]   # lot Orbite sur toute la partie, écart de chaque pose à la référence (mm)
```

Placement : tous les cuts d'un même repère de scène (`frameId`, une page d'ESV) partagent une origine, comme dans Ariane (mesuré : cut 105 à 2 m du cut 103 dans le même repère). Si l'export porte des écritures observées (4.9, `esv-observation` kind `write`), T = monde − scène est mesurée comme le fait B1 et le monde de la maquette est le **monde réel** (`monde: reel`) ; sinon une origine factice par repère (`monde: factice`). `--valides K` sert un cut rejouable sur K déjà validé à sa pose de référence : appui pour B1, sauté par le lot.

Fidélité mesurée : un lot joué sur la maquette, exporté en bilan avec ses nuages, puis rejoué depuis ce bilan, rend **les mêmes poses à 0,0 mm** (`extension.test.cjs`, aller-retour), avec la 4.8.6 comme avec la 4.9.0.15.

## Jeu d'apprentissage

`node tools/jeu-apprentissage-maquette.cjs EXPORT [EXPORT…] [--rejeu RAPPORT.json] [--fenetre 3] [--points] [--sortie JEU.json]` (hors ligne, sans navigateur) rend `banane-apprentissage-v1` : par cut, repère, pose de départ d'ESV, référence (humaine en Écho, Ariane en Orbite), écart départ → référence en mm et en repère profil (le long de la voie, en travers, vertical), points par rail, voisins à référence dans la fenêtre, prédiction par interpolation entre les deux voisins les plus proches (D-098 à D-100) et son écart, et l'écart de la pose rejouée par Ariane si un rapport `--json` du banc est donné ; `--points` ajoute les points en scène. Résumé : médiane, P90, max par rail. Les cuts sans nuage ou sans pose de départ sont listés dans `provenance.exclus`, jamais inventés. Un export Écho de terrain n'a pas encore été rejoué (les formats sont ceux du code source ; l'essai `lecteur-export.test.cjs` les couvre sur une session synthétique) : le premier rejeu réel dira ce qui manque.

## Points, pannes, comparaison, contrat

- **Points par cut** : le scénario servi à la page est un squelette ; les nœuds d'un cut sont demandés au serveur au chargement du cut (`/maquette/ept-data/<part>/<cut>/noeuds.json`, gardés en cache ensuite), comme Potree charge les siens ; l'observateur 4.9 les classe « ressource de points ».
- **Pannes simulées** (`POST /maquette/pannes`, ou `node tools/banc-esv.cjs --pannes '{…}'`) : `ecritureRefusee {cuts|'toutes', http}` (ESV navigue quand même, la ligne reprend son statut : hypothèse), `ecritureLenteMs`, `listeIllisible`, `railsAbsents {cuts}`, `nuageInstable {cuts, dureeMs}` (nœuds remplacés toutes les 250 ms), `nuageVide {cuts}`, `changementPartie {apresCut}`. Essais : `pannes.test.cjs` (ce qu'Ariane fait dans chaque cas).
- **Comparer deux versions** : `node tools/banc-comparer.cjs A.json B.json [--md SORTIE.md]` sur deux rapports `--json` du banc (même lot) : issue par cut, durées, écarts à la référence, cuts d'issue différente.
- **Contrat ESV vérifiable** : `tests/esv-maquette/contrat-esv.json` liste chaque hypothèse ; `tools/esv-contrat-releve.js` est un relevé **en lecture seule** à coller dans la console du vrai ESV (aucune adresse, aucun jeton) ; `node tools/esv-contrat-comparer.cjs RELEVE.json` dit ce qui est confirmé, infirmé, non relevé, et quoi changer dans la maquette. Le relevé reste privé.

## Ce que la maquette reproduit, et avec quelle certitude

| Élément | Reproduit | Statut |
|---|---|---|
| `#O2N3DCutDescription` « Cut N of part P », `#O2N3DCutShapeInfo` « U50 » | oui | **connu** (code d'Ariane, terrain) |
| `#O2N3DCutLRClick` / `#O2N3DCutRRClick` : rail courant tout de suite, caméra recentrée à l'image suivante ; classes `leftRailSClass` / `leftRailUSClass` (S = sélectionné), idem à droite | oui | **connu** (D-088 ; classes relevées sur ESV le 15 octobre, celles que lit la 4.9) |
| `#O2N3DCutValidate3DRail` (titre « Load next non validated cut ») : valide, écrit, charge le cut non validé suivant ; au dernier, la partie suivante | oui | **connu** (terrain du 30/09) |
| `#O2N3DCutNextInvalid3DRail` (« Next non validated cut ») et `Maj+Z` : cut non validé suivant, sans décision ; `#O2N3DCutPreviousInvalid3DRail`, `#O2N3DCutPrevious3DRail` (« Previous cut »), `#O2N3DCutNext3DRail` (« Next cut »), `#O2N3DCutSkip3DRail` (« Ignore this cut and load the next one ») | oui, mêmes identifiants et titres | **connu** (KI-024 ; six boutons relevés sur ESV le 15 octobre) ; « non validé = statut différent de valid » est **déduit des titres** |
| `Maj+Retour` : passer (SKIP) ; `Ctrl+Entrée` : valider sans suivant ; `Maj+Espace` : valider | oui | **supposé** (dits par l'opérateur, non lus dans ESV) |
| `D` : cut suivant (« cut de droite ») | oui | **supposé** (FICHE_U3) |
| Compteur « N on M treated » : un `li.list-group-item`, nombre dans un enfant, « treated » en texte ; aucun texte « M cuts » | oui, tenu sur la liste de la partie | **connu** (relevé du 15 octobre : 9114 on 9260, M = nombre de cuts de la partie) ; moment de mise à jour et « traité = validé ou passé » : **hypothèses** |
| Racine de la scène : deux rails `Object3D` (+ `Mesh` + profil `Object3D` + `Line`, contour du corpus) puis trois `Mesh` ; le nuage Potree n'est pas enfant de la racine ; gauche/droite par le signe du y moyen du contour | oui | **connu** (relevé du 15 octobre) |
| Rails absents pendant `latenceRails` après le libellé | oui | **supposé** (Ariane attend ce cas) |
| Potree : `pointclouds[0].visibleNodes[].sceneNode` (Points, `matrixWorld`, `geometry.attributes.position/intensity/classification`, `drawRange`), `material.clipBoxes[].inverse`, `clipTask` SHOW_INSIDE, `Potree.ClipTask/ClipMethod`, `Potree.numNodesLoading` | oui ; les 16 nœuds de chaque capture du corpus, par lots avec latence | forme **connue** (lecteur gelé) ; latence, lots, LOD : **factices** |
| Clic dans la vue : pose du rail courant au point rayon ∩ plan de coupe, pixel entier, sans contrôle « dans la vue » | oui | **connu** (D-088 P1, 4.8.0) ; plan de coupe = plan du rail perpendiculaire à la vue : **supposé** |
| Caméra orthographique, échelle 5 (0,4 unité de scène de large), profondeur −1e-4, vue 763 × 943 px | oui | **connu** (relevé du 15 octobre) ; position exacte et hauteur : **supposées** |
| Liste des coupes `GET /rails/<table>` paginée par `?npk=…&nrk=…` (1 000 lignes, champs de `fiches/FICHE_B1.md`, **une ligne par indice, cut N = ligne N**), écriture `PUT /rails/<table>/<RowKey>` → 204, les deux en **XMLHttpRequest** | oui, chemins **relatifs** et table factice ; vus par l'observateur passif 4.9 (liste, écritures avec `rowIndex` = cut) ; B1 y calibre son repère et apparie ses lignes | forme **connue** (code de l'observateur) ; corps exact de la réponse, en-têtes : **inconnus** (jamais recopiés) |
| Événements internes d'ESV : `#globalcontainer` (div) porte les événements jQuery `railPairSelected`, `railPairUpdated`, `railPairSeen`, `loading`, `newPart` ; gestionnaire `function(e,n,i){t.loadCut(n,i)}` | oui : `$` minimal (pas jQuery) avec `_data` et `trigger`, `loadCut(partie en texte, index)` ; la 4.9 prend le chemin « événement », et le chemin pas à pas par `Previous cut` / `Next cut` marche aussi (vérifié avec la 4.9.0.15) | **connu** (relevé B du 15 octobre, lecture seule) ; sens des arguments et comportement hors partie : **supposés** |
| Bouton SKIP = passer puis cut non validé suivant ; Valider = valider puis suivant ; Previous / Next = pas d'un cut | oui | **connu** (relevé B du 15 octobre : `buttonSkipRail()` puis `buttonNextInvalidCut()`) |
| Sélecteur de parties : une liste de liens `?…&p=N` (`#maquette-parties` ; parties du scénario et leurs voisines, texte « Part N », entrée courante en classe `active`) ; `selecteur=0` : absent. Relevé en lecture seule par l'adaptateur (`ping` de contrat, `selecteurParties`, T20a) | oui (T20a) | **SUPPOSÉ** (architecture 5.0, § P : lu dans une page enregistrée, jamais relevé dans ESV ; texte, classes, conteneur et sens de `p` inconnus) ; le relevé que Mic fournira avant T27 tranchera |
| Erreurs d'ESV (écriture refusée, nuage jamais chargé, changement de partie imprévu) | non (à ajouter par réglage) | **inconnu** sur le terrain |

## Ce que ça ne prouve jamais

La vitesse réelle (le vrai Potree, la carte graphique, le réseau, Edge), le vrai serveur, la vraie sémantique des raccourcis. Toute mesure de temps faite ici compare des versions d'Ariane **entre elles**, sur la même maquette ; elle ne vaut pas pour le terrain.

## Fichiers

`scenario.cjs` (partie synthétique depuis le corpus), `lecteur-export.cjs` (partie rejouée depuis un export), `serveur.cjs` (statique + API factice, journal des écritures), `esv.html` + `esv-maquette.js` (la page), `navigateur.cjs` (Playwright, injection, pont d'essai), `adaptateur.test.cjs`, `lecteur-export.test.cjs`, `extension.test.cjs`, et `tools/banc-esv.cjs` (banc extension réelle ; `--json` rapport, `--dataset` bilan avec nuages, `--export` rejeu).
