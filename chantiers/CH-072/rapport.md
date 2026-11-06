# CH-072 — rapport (ariane-vue, numéros 350–399)

Port au bit près des fonctions pures de `src/deplacement-vue.js` et `src/gestes-vue.js`, crate `ariane-rs/crates/ariane-vue`, façade `ariane-rs/coquille/facade-vue.js`. Le JS d'origine n'est pas modifié. Le branchement du cœur est proposé dans `chantiers/CH-072/ariane-coeur.patch` (une dépendance, un bras `350..=399`) : non appliqué.

## Porté

| n° | fonction |
|---|---|
| 350 | `reglages` |
| 351–353 | journal vide, `noter`, `resume` |
| 354 | `juger` |
| 355 | `gesteJournal` |
| 356 | `detailDeplacement` |
| 357 | `detailRemise` |
| 358–362 | bilan : vide, `noterDeplacement`, `noterRemise`, `vide`, `resume` |
| 370 | `approche` |
| 371 | `besoin` |
| 372–375 | `ecartCamera`, `memeCamera`, `pixelMm`, `resumeCamera` |
| 376 | relevé : `evenement`, `finirGlisser`, `finirMolette`, `apres` (état et réponses de l'hôte dans la valeur) |

## Reste en JS

- `sequence`, `sequenceMolette`, `sequenceGlisser`, `sequenceClicDroit` : `Math.random` (`alea`), le nombre de tirages dépend des données. **ÉTABLI** dans le source (lignes 53–86 de `gestes-vue.js`, appelées par `sequence`).
- `construire`, `emettre` : DOM. `deplacer` : async. **ÉTABLI**.
- Toutes les fonctions portées ci-dessus **restent appelées en JS par la façade** : en Chromium, 15 répétitions, médiane d'un lot de 400 appels, traversée comprise, le WASM est plus lent. Lot JS 0 à 0,6 ms, lot WASM 2,0 à 191,3 ms. Par appel (médiane du lot / 400) : `reglages` 0,25 µs contre 9,7 µs ; `detailDeplacement` 0,50 contre 18,8 ; `detailRemise` 0,25 contre 8,8 ; `juger` 0,50 contre 10,8 ; `besoin` 0 ms sur le lot (sous le pas de 0,1 ms, donc **PROBABLE** < 0,25 µs) contre 6,7 µs ; `ecartCamera` 0,25 contre 8,0 ; `pixelMm` lot 0 ms contre 5,0 µs ; `journal` 0,50 contre 46 µs ; un scénario court de relevé 1,5 µs contre 478 µs. **ÉTABLI** (`chantiers/CH-072/temps-chromium.json`).

## Parité

0 écart (trames VBA). **ÉTABLI**.

- Node : 193 cas, 0 écart. Chromium (binaire du banc, 15 s de budget virtuel non utilisé par le script) : 193 cas, 0 écart. Cas des essais du tronc qui exercent ces fonctions (`reglages`, journal, `juger`, détail, remise, bilan, `besoin`, caméra, `approche`, quatre scripts de relevé) plus 160 variantes à graine fixe.
- Données réelles, hors dépôt : le lot du 2/11 nommé pour le déplacement de vue (branche de données). 36 caméras du corpus, 35 paires : `pixelMm`, `resumeCamera`, `ecartCamera`, `memeCamera`, 0 écart. Journal du même lot : 1 `deplacement-vue` et 2 `deplacement-vue-remise` rejoués, bilan sur ces 3 événements, 0 écart. Aucune matrice `cameraToSceneRelative` dans ce journal (0 occurrence).
- Collections du 4, du 5 et du 6/11 : archives ; une table de jointure du 4/11 (546 Ko) ne contient aucun de ces champs (0 occurrence). **ÉTABLI**. Les autres archives de ces trois jours n'ont pas été déballées : **SUPPOSÉ** qu'elles n'ajoutent pas de forme nouvelle au-delà des caméras et des événements déjà comparés.

`cargo test -p ariane-vue` : 9 essais, 0 échec. `cargo clippy -p ariane-vue --all-targets -- -D warnings`, hôte et cible WASM : propre.
