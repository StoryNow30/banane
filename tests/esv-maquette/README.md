# Maquette ESV — un ESV local pour tester Ariane sans ESV ni poste de Mic

**Aucun code ni contenu d'ESV.** La maquette reproduit uniquement le *contrat* que le code de page d'Ariane lit (identifiants DOM, textes, forme des objets de scène et de Potree, chemins d'API), avec des données prises dans `tests/corpus/` (points en repère scène, déjà versionnés) posées dans un monde factice. Fiche d'origine : `fiches/AUDIT_ESV_LOCALE.md`.

## Trois niveaux d'usage

| Niveau | Commande | Ce qui tourne | Ce que ça prouve |
|---|---|---|---|
| 1. À la main | `node tests/esv-maquette/serveur.cjs 8124` puis `http://localhost:8124/tests/esv-maquette/esv.html?cuts=12` | la page seule (vue 2D, boutons, raccourcis, journal) | le comportement de la maquette elle-même |
| 2. Adaptateur réel | `node --test --test-timeout=60000 tests/esv-maquette/adaptateur.test.cjs` | `src/adapter-page.js` et ses modules injectés dans la page (comme `background.js` le fait, monde principal), commandes envoyées par un pont d'essai | état, capture, pose par clics, validation, SKIP, navigation, relevé passif, retour à une coupe |
| 3. Extension réelle | `node tools/banc-esv.cjs --cuts 3` ou `node --test --test-timeout=120000 tests/esv-maquette/extension.test.cjs` | l'extension du dépôt (ou `--extension DOSSIER` d'un paquet décompressé) chargée dans Chromium, l'hôte d'ESV **routé** vers la maquette, un lot Orbite lancé par les messages du panneau | la chaîne service worker → pont → adaptateur → page, de bout en bout, avec un rapport par cut |

Prérequis : Playwright et Chromium (`PLAYWRIGHT_MODULE`, `PLAYWRIGHT_BROWSERS_PATH` ou `CHROMIUM`). Sans eux, les essais se **sautent** avec leur raison ; ils sont volontairement hors de `node tools/verify.cjs` (le banc complet refuse les essais sautés).

Réglages de la page (paramètres d'URL) : `cuts` (nombre de coupes de la partie), `debut` (premier numéro), `part`, `cut` (coupe affichée au départ), `latence` (ms par lot de nœuds de points), `lots` (nombre de lots), `latenceRails` (ms avant l'arrivée des rails après le libellé), `decoupeTardive` (0/1 : ESV déplace sa boîte de découpe 150 ms après le changement de cut, constat 4.7.3).

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

Fidélité mesurée : un lot joué sur la maquette, exporté en bilan avec ses nuages, puis rejoué depuis ce bilan, rend **les mêmes poses à 0,0 mm** (`extension.test.cjs`, aller-retour). Les cuts sans nuage ou sans pose de départ sont listés dans `provenance.exclus`, jamais inventés. Un export Écho de terrain n'a pas encore été rejoué (les formats sont ceux du code source ; l'essai `lecteur-export.test.cjs` les couvre sur une session synthétique) : le premier rejeu réel dira ce qui manque.

## Ce que la maquette reproduit, et avec quelle certitude

| Élément | Reproduit | Statut |
|---|---|---|
| `#O2N3DCutDescription` « Cut N of part P », `#O2N3DCutShapeInfo` « U50 » | oui | **connu** (code d'Ariane, terrain) |
| `#O2N3DCutLRClick` / `#O2N3DCutRRClick` : rail courant tout de suite, caméra recentrée à l'image suivante | oui | **connu** (D-088) ; la classe `active` du bouton est une **hypothèse** |
| `#O2N3DCutValidate3DRail` (titre « Load next non validated cut ») : valide, écrit, charge le cut non validé suivant ; au dernier, la partie suivante | oui | **connu** (terrain du 30/09) |
| `#O2N3DCutNextInvalid3DRail` et `Maj+Z` : cut invalide suivant, sans décision | oui | **connu** (KI-024) |
| `Maj+Retour` : passer (SKIP) ; `Ctrl+Entrée` : valider sans suivant ; `Maj+Espace` : valider | oui | **supposé** (dits par Mic, non lus dans ESV) |
| `D` : cut suivant (« cut de droite ») | oui | **supposé** (FICHE_U3) |
| Compteur « N on M treated », texte « M cuts » | oui, un seul élément | format **connu** ; élément exact, moment de mise à jour, « traité = validé ou passé » : **hypothèses** |
| Rails : `Object3D` + `Mesh` + profil `Object3D` + `Line` (contour du corpus, 3 lignes) ; gauche/droite par le signe du y moyen du contour | oui, poses du corpus | **connu** |
| Rails absents pendant `latenceRails` après le libellé | oui | **supposé** (Ariane attend ce cas) |
| Potree : `pointclouds[0].visibleNodes[].sceneNode` (Points, `matrixWorld`, `geometry.attributes.position/intensity/classification`, `drawRange`), `material.clipBoxes[].inverse`, `clipTask` SHOW_INSIDE, `Potree.ClipTask/ClipMethod`, `Potree.numNodesLoading` | oui ; les 16 nœuds de chaque capture du corpus, par lots avec latence | forme **connue** (lecteur gelé) ; latence, lots, LOD : **factices** |
| Clic dans la vue : pose du rail courant au point rayon ∩ plan de coupe, pixel entier, sans contrôle « dans la vue » | oui | **connu** (D-088 P1, 4.8.0) ; plan de coupe = plan du rail perpendiculaire à la vue : **supposé** |
| Caméra orthographique (échelle 5 = 0,4 unité de scène de large, comme au corpus) | oui | **connu** (corpus) ; position exacte et hauteur : **supposées** |
| Liste des coupes `GET /rails/<table>?page=N` (1 000 lignes, champs de `fiches/FICHE_B1.md`), écriture `PUT /rails/<table>/<RowKey>` → 204 | oui, chemins **relatifs** et table factice | forme **connue** ; chemin exact, en-têtes, corps exact : **inconnus** (jamais recopiés) |
| Boutons précédent/suivant (`#maquette-cut-precedent`, `#maquette-cut-suivant`), événement `maquette:goto` | oui | **hypothèses** de la maquette (identifiants inventés, marqués) |
| Erreurs d'ESV (écriture refusée, nuage jamais chargé, changement de partie imprévu) | non (à ajouter par réglage) | **inconnu** sur le terrain |

## Ce que ça ne prouve jamais

La vitesse réelle (le vrai Potree, la carte graphique, le réseau, Edge), le vrai serveur, la vraie sémantique des raccourcis. Toute mesure de temps faite ici compare des versions d'Ariane **entre elles**, sur la même maquette ; elle ne vaut pas pour le terrain.

## Fichiers

`scenario.cjs` (partie synthétique depuis le corpus), `lecteur-export.cjs` (partie rejouée depuis un export), `serveur.cjs` (statique + API factice, journal des écritures), `esv.html` + `esv-maquette.js` (la page), `navigateur.cjs` (Playwright, injection, pont d'essai), `adaptateur.test.cjs`, `lecteur-export.test.cjs`, `extension.test.cjs`, et `tools/banc-esv.cjs` (banc extension réelle ; `--json` rapport, `--dataset` bilan avec nuages, `--export` rejeu).
