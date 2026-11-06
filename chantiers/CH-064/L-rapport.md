# CH-064-L — Lecture LiDAR en Rust (`ariane-lidar`) : rapport (06/11/2026)

**Périmètre porté.** La boucle par point de `capture()` (`vendor/lidar.js`, chemin du lot et de la relecture) : parcours d'un nœud Potree non indexé, positions Float32 ou Float64 non normalisées. Le reste de `capture()` (inventaire, sondes, attributs, `boxVisible`, statut) reste le JS d'origine : la coquille `js/lidar-wasm.js` insère une seule branche dans le texte de `vendor/lidar.js`, lu à chaque construction, et la boucle d'origine sert de repli (nœud indexé, normalisé, réglages non numériques). Écart connu, comme CH-061 : l'horloge du budget (15 s) est lue avant chaque tranche de 4 096 points au plus, pas avant chaque point ; aucune différence tant que ce budget n'est pas atteint.

## 1. Parité — ÉTABLI
Scènes Potree reconstruites à partir des **4 647 captures réelles** du 04, 05 et 06/11 (`tools/ch064-l-scene.cjs`) : matrices des nœuds, nombre de points réel, sondes au bit, points retenus replacés à leur indice, boîtes de découpe et attributs de l'export. Plus 22 cas synthétiques (NaN, exception « Transformation non finie. », Float64, entrelacé au pas 5 et 9, plages fractionnaires, budgets `maxPoints`/`maxInspected`, `yieldEvery` 7, replis).
- **Chromium 153 : 9 316 / 9 316 identiques**, Node 22 : 9 316 / 9 316 (`L/parite-chromium.json`, `L/parite-node.json`) — 9 294 vues, 4,29 milliards de points lus. La sortie ENTIÈRE de `capture()` est comparée strictement (Object.is, ordre des clés, exceptions), horodatages seuls retirés ; 4 vues lèvent la même exception des deux côtés.
- Binaire mesuré : `ariane_lidar.wasm` sha256 b21c7691…, identique sur la tête du chef (e68ba3e). 1 131 019 tranches passées par le noyau WASM (Node) : la preuve ne repose pas sur le repli.

## 2. Temps — Chromium 153, machine au repos, 15 répétitions, `capture()` complète de bout en bout (`L/banc-rapide.json`, `L/banc-reference.json`)
Vues réelles de 491 800 points en médiane (p90 714 820), 17 nœuds.

| ms par vue (médiane / p90) | origine | JS élagué | **Rust/WASM** |
|---|--:|--:|--:|
| lecture « rapide » (`scheduler.yield`, 60 vues) | 280,6 / 412,1 | 36,9 / 49,2 | **19,1 / 26,3** |
| dont noyau (copie des tranches comprise) | — | 30,0 | **12,9** |
| lecture « référence » (`setTimeout(0)`, 20 vues) | 865,7 / 1 074,8 | 605,8 | **579,9** |
| dont pauses (identiques dans les trois) | 554 | 554 | 554 |
| noyau seul, Node (`L/natif.json`, 20 vues) | — | 33,1 | 10,8 ; **natif x86-64 : 20,2** |

**Gain** (rapports du banc appliqués aux 190 ms par vue rapide du terrain et aux 4 867 vues rapides + 552 vues de référence du 05/11, CH-061) — PROBABLE :
- par vue rapide : −177 ms (Rust) contre −165 ms (JS élagué) ; **par cut de lot** (2 vues, cut de 2,82 s) : **−354 ms, soit −12,6 %** ;
- **par journée** : rapide −862 s (Rust) contre −803 s (JS élagué) ; référence (819 ms par vue au terrain) −149 s (Rust) contre −136 s ; **total ≈ −1 010 s, soit −16 % des 6 276 s de cuts**. La part propre à Rust, au-delà du JS élagué, est ≈ −72 s par jour : l'essentiel du gain vient de la suppression des allocations par point, que le JS élagué obtient aussi.
- Lecture « référence » : 64 % du temps est fait de pauses `setTimeout(0)` (4 ms chacune, 133 par vue) ; aucun langage n'y change rien (réglage, CH-061 § 8.4).

## 3. Mémoire — ÉTABLI
- **Mémoire linéaire WASM : 512 Kio, constante** (avant = haute eau = après sur 80 vues ; 524 288 octets en fin des 9 294 vues de parité). Plafond déclaré à l'édition des liens (`--initial-memory` = `--max-memory`, `build.rs`) : une croissance est refusée (`Memory.grow` lève). Aucune allocation : arène statique (entrée 128 Kio, sorties 112 Kio, pile 64 Kio). Les vues JS sur la mémoire sont créées une fois.
- **Tas JS au plus haut pendant la lecture** (relevé à chaque pause) : origine 32,0 Mo, JS élagué 20,1 Mo, **WASM 2,35 Mo** (max 8,45). Tas retenu par la sortie : 0,38 Mo dans les trois (sortie identique).
- Module : 39 Ko, compilation 0,2 ms, instanciation < 0,1 ms.

## 4. Export : module autonome, pas dans le cœur — recommandation
La lecture tourne dans la page ESV ; le cœur (`ariane-coeur`, 226 Ko sans la lecture) tourne dans le service worker. Le module autonome (39 Ko) a une mémoire bornée et jamais détachée ; lié au cœur, il partagerait une mémoire qui grandit (les vues JS seraient à recréer après chaque croissance) et ferait charger 226 Ko inutiles dans la page. Les deux voies existent : `ariane_lidar.wasm` (cdylib) et, si le chef le veut, une ligne dans `ariane-coeur/src/lib.rs` (`pub use ariane_lidar::abi as lidar;`, essayée : les 10 exports `lidar_*` apparaissent).

## 5. Ce qui reste en JS, mesuré (`L/fusion.json`, 20 captures)
- `merge-clouds` : 13,1 ms par cut (p90 21,2), dont clés de dédoublonnage 2,6 ms et recomptage `perRail` 0,6 ms — seules parts numériques portables (≈ 3 ms par cut) ; le reste est clonage JSON et construction d'objets, où Rust perd (CH-061). `compactNodes` + `messageBytes` : 5,6 ms. **Non porté.**
- `lod-signature` : 0,1 ms par appel (inventaire compris). **Non porté** : les jetons sont des chaînes construites en JS.
- `native-lidar` (mode natif) : son chemin rapide (`nextCandidate`) est déjà sans allocation ; non porté, non mesuré ici.
- Option B (programme natif) : sans objet pour la lecture (sortir les tampons de la page coûte 256 ms par vue, CH-064 `banc-b`). Le noyau natif est d'ailleurs plus lent que le WASM au banc (20,2 contre 10,8 ms ; cause non établie, SUPPOSÉ : construction x86-64 de base).

## Reproduire
`BANANE_DATA=<clone banane-data>` ; `node tools/ch064-l-parite.cjs --moteur node|chromium [--json …]` ; `node tools/ch064-l-banc.cjs [--pause timeout]` ; `node tools/ch064-l-fusion.cjs` ; `node tools/ch064-l-natif.cjs` ; `cargo test -p ariane-lidar` (6 essais, toutes les fonctions publiques et l'ABI). Clippy pedantic : 0 avertissement sur l'espace.
