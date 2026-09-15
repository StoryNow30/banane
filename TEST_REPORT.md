# Rapport de tests — Banane 4.4.3 TEST

Date : 13 septembre 2026. `node tools/verify.cjs` régénère `audit/verification.json` et `.txt`. Les paragraphes qui suivent sur le défaut V4.4 et sur la V4.4.1 restent des preuves historiques.

## Régression réelle du bouton et correction V4.4.3

Mic a ouvert Banane avec la V4.4.2 et fourni une capture d'écran montrant que « Banane V4 · ouvrir » reste affiché au bas d'ESV. **L'acceptation terrain V4.4.2 échoue pour le bouton.** Le test antérieur supposait que la recherche des onglets d'extension par URL retrouvait les fenêtres et ne contrôlait pas l'absence physique du bouton dans le DOM. La cause exacte sur sa session Edge n'est pas observable depuis la capture seule.

La V4.4.3 suit explicitement fenêtres créées et pages connectées, renouvelle la connexion après redémarrage du service worker, recherche les onglets ESV parmi les onglets dont l'URL est effectivement accessible, et retire physiquement le bouton pendant la présence de Banane. La notification récente prime une ancienne réponse asynchrone. Le nom de version dans le panneau et sur le bouton a été rendu vérifiable. `tests/background.test.cjs`, `tests/bridge.test.cjs` et `tests/panel-presence.test.cjs` simulent l'ouverture, plusieurs fenêtres, fermeture, recherche d'URL vide, réponse tardive et reconnexion. Résultat à compléter après vérification ESV réelle, sans déclarer le défaut définitivement résolu sur Edge.

## Audit du vrai export V4.4.1 et correctif V4.4.2

`node tools/audit-native-v441.cjs --input /chemin/banane-native-v4-1789294517253.json` recalcule, depuis le JSON en lecture seule (SHA-256 `86700e4d29ff0406614c901aae6ed52b1b3a1f2d3dbb59b724f69b16884d33f6`), **76 visites, 2 283 événements, 226 captures, 316 chunks et 539 309 points** (195 781 G, 343 528 D). **297 185** points sont visibles dans le clipping déclaré ; 242 124 ne le sont pas. Fins : 148 `VIEW_CHANGED`, 38 `TARGET_CHANGED`, 35 `RAIL_STATE_CHANGED`, 4 `RESOURCE_LIMIT`, 1 `NONE`. L'écart maximal de cohérence interne des matrices est 2,24 × 10⁻⁹ unité de scène, ce qui ne prouve pas la calibration physique.

Un filtrage exploratoire « visible + pose initiale » trouve 23 rails-visites et 4 paires, mais **toutes ces captures finissent interrompues** et la V4.4.1 n'acquittait pas le stockage de l'instantané avant le geste : **0 rail comparable prouvé**. Le rejeu hors ligne ancien (`audit/native-offline-v4.4.1-baseline.json`) confirme 0/0 rail et 0 paire, sans score ni preuve visuelle. La V4.4.2 sauve désormais le checkpoint par rail, acquitte le stockage avant l'événement, vérifie date d'acquisition/pose/source/clipping, et conserve la révocation explicite en cas de contradiction ; elle n'attribue pas ce bénéfice aux anciens exports.

Le bouton flottant V4.4.2 **semblait** masqué en simulation, mais ce résultat est infirmé par la capture réelle de Mic. La V4.4.3 fait l'objet d'un test séparé ci-dessus. Les événements opérateur restent passifs ; moteur et pilote sont inchangés. Une vraie page ESV V4.4.3 et son JSON restent nécessaires avant de conclure.

## Traçabilité complémentaire V4.4.2

| Exigence | Implémentation | Test exécuté | Résultat |
|---|---|---|---|
| Audit V4.4.1 reproductible | `tools/audit-native-v441.cjs` | `tests/native-v441-audit.test.cjs` | 539 309 points, 0 comparable prouvé |
| Instantané acquis avant intention et sauvegardé | `src/native-lidar.js`, `src/native-session.js` | Tests lecteur/session avec réception retardée et fin perturbée | Conforme en simulation |
| Rails indépendants, pose/source/clipping | Lecteur et éligibilité par rail | Tests rail seul, clipping absent/hors zone, changement d'identité | Conforme en simulation |
| Révocation motivée | `src/native-session.js` | Test de contradiction après checkpoint | Conforme en simulation |
| Rejeu sans fuite du final humain | `tools/native-offline-evaluate.cjs` | Tests du banc hors ligne | Conforme en simulation |
| Masquer/réafficher bouton, plusieurs fenêtres | `src/bridge.js`, `background.js`, `panel.js` | `tests/bridge.test.cjs`, `tests/background.test.cjs`, `tests/panel-presence.test.cjs` | Échec en ESV V4.4.2, correctif V4.4.3 conforme en simulation |
| Preuves terrain et fluidité Edge | Protocole `NATIVE_GEOMETRY_ACCEPTANCE.md` | Session ESV V4.4.3 non disponible | **Non vérifié** |

Le paquet **source/tests** contient les trois références V4.4.0 nécessaires aux tests et permet de relancer `node tools/verify.cjs` après extraction ; le paquet installable exclut les JSON réels et les fixtures volumineuses. Le grand JSON V4.4.1 reste hors des deux paquets : son audit et son SHA-256 permettent une vérification après fourniture séparée. Le statut `serverConfirmationStatus: not-observed` reste normal en Natif. Aucune réussite géométrique sur ESV V4.4.2, ni aucun exemple utilisable à l'entraînement, n'est déclaré.

## Défaut reproduit sur trois exports réels V4.4

`node tools/audit-native-geometry.cjs` recalcule 426 visites, 115 captures, 67 206 881 points annoncés dans les buffers, 38 675 sondés, 685 558 lus et transformés, et seulement **4 retenus, sauvegardés et exportés**. Les sondes rencontrent une ROI de rail dans 103 captures sur 115 ; 114 captures touchent une limite de ressources et 1 595 nœuds sur 2 275 ne sont pas balayés. Le parcours séquentiel des nœuds épuisait les 300 ms avant les zones utiles ; `no-points` pouvait masquer la limite réelle. Rapport : `audit/native-geometry-loss-v4.4.0.md`. Les trois JSON sous `datasets/native/reference/` sont en lecture seule, exclus du ZIP installable mais inclus dans le ZIP source/tests pour reproduire l'audit.

## Vérifications locales

Dernière exécution de `node tools/verify.cjs` : **188/188 tests réussis**, 24 scripts contrôlés syntaxiquement, 0 ignoré. Tests : priorisation ROI et comparaison sur les mêmes buffers avec le lecteur historique sans navigation ; observations gauche/droite non simultanées ; rail unique ; limites, vue/cut changé, sauvegarde par chunks, transformations et couverture ; checkpoint avant décision, fin reçue tard, révocation, bouton flottant multi-fenêtres et réponse tardive, reconnexion du panneau, revisites, Pause/Reprendre, chronologie, intentions multiples et interruption récupérée ; banc hors ligne sans fuite de la référence. Les anciens scénarios V4.3 restent actifs. Les empreintes SHA-256 figées de `src/geometry.js`, `src/engine.js`, `vendor/capture-core.js` et `vendor/lidar.js` sont inchangées.

Simulation V4.4.3 `node tools/native-fluidity.cjs` (`audit/native-fluidity-v4.4.3.json`) :

| Scénario Node | Entrées | p95 observateur | Maximum | Pertes explicites | État final |
|---|---:|---:|---:|---:|---|
| Cadencé | 1 000 | 1,261 ms | 2,988 ms | 0 | `FULL` |
| Rafale | 5 000 | 1,187 ms | 3,026 ms | 4 744 | `METADATA_ONLY` |

Dans les deux cas : zéro geste bloqué, zéro événement réémis et zéro commande native Banane. Les temps Node varient d'un lancement à l'autre ; ils ne mesurent ni WebGL ni l'expérience ESV réelle et ne prouvent aucune amélioration de fluidité.

## Traçabilité

| Exigence | Implémentation | Test exécuté | Résultat |
|---|---|---|---|
| Reproduire perte et étapes | Audit des trois exports | `tests/native-geometry-audit.test.cjs` | Cause documentée, 4 points exportés |
| Capturer sans piloter ESV | `src/native-lidar.js` séparé, identité contrôlée | `tests/native-lidar.test.cjs`, hashes | Conforme en simulation |
| Rails séparés, sauvegarde progressive | Chunks par rail, matrices et horodatages | Lecteur et session | Conforme en simulation |
| Couverture, repère et référence | Éligibilité par rail/pair, motifs d'exclusion | Session et banc hors ligne | Conforme en simulation |
| Chronologie et interruption | `event_seq`, intentions multiples, clôture récupérée | Tests de session | Conforme en simulation |
| Absence de fuite du final humain | Entrée moteur figée avant lecture du final | Test de mutation de référence | Conforme en simulation |
| Fluidité et preuve visuelle ESV | `NATIVE_GEOMETRY_ACCEPTANCE.md` | Session réelle indisponible | **À vérifier avec Mic** |

`tools/native-offline-evaluate.cjs` rejoue le moteur inchangé sur des captures synthétiques qualifiées, en formant son entrée avant la lecture du final humain. Sur les **trois anciens exports**, 0 rail gauche, 0 droit et 0 paire qualifiés ; aucune comparaison ni preuve visuelle réelle n'est possible (`audit/native-offline-evaluation-v4.4.0.md`). Aucun gain de précision n'est revendiqué. Les 110 corrections humaines et leur banc V4.3 restent inchangés.

Sans nouveau JSON V4.4.3 ou accès à ESV, restent non évalués : correction réelle du bouton, couverture et repère sur vraie session gauche/droite ou rail seul, revisite/pause réelles, superposition visuelle, score réel, récupération IndexedDB après panne et impact de fluidité WebGL. `serverConfirmationStatus: not-observed` est normal en Natif. Cette version est **TEST**, pas une certification terrain.
# Complément V4.5 lot 1 — expérimentation hors ligne, 14 septembre 2026

Sur la copie des sources V4.4.3 fournies, `node tools/verify.cjs` réussit 195 tests dont sept nouveaux tests de non-fuite de finale, temporisation des snapshots, stabilité de la proposition, cohérence d'identité, unités et intention multiple. Avant modification, les mêmes sources réussissaient 188 tests. Les empreintes figées moteur/pilote/lecteur partagé restent identiques. `node tools/placement-lab.cjs --input EXPORT.json --out-dir audit/placement-run` a été exécuté sur le témoin : 22 visites, 377 477 points, 23 rails admissibles avant changement observé, sept paires géométriques, cinq comparaisons avec finale candidate (trois gauches, deux droites), 23 superpositions SVG. Les sept comparaisons du banc historique sont également reproduites ; les deux exemples retirés du score strict sont 314 droit et 333 droit, après premier changement observé. Résultats et limites détaillés dans `audit/V45_LOT1_RAPPORT.md`. **Aucun test ESV réel, aucune fluidité terrain mesurée, aucune amélioration du moteur revendiquée.**
# Correctif temporel du banc V4.5 lot 1

Le texte « cinq comparaisons, 195 tests » ci-dessous est l'historique de la première livraison. Après correction de la borne **par rail** et vérification du final humain, `node tools/verify.cjs` réussit **201/201** tests. Sur le même témoin, 14 rails gauches et 12 droits admis, 7 paires, 3 + 4 comparaisons candidates, 26 superpositions. Trois seuls changements d'éligibilité : 314, 332, 333 droits ; le cut 332 n'a pas de référence humaine comparable. Les empreintes moteur/pilote/lecteur restent inchangées. Rapport détaillé et motifs : `audit/V45_LOT1_BORNE_TEMPORELLE.md`. Aucun test ESV ni nouveau modèle.
