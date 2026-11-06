# CH-061 — reproduire les bancs

Prérequis : Node 22, Playwright (préinstallé), Chromium dans `/opt/pw-browsers/chromium` (ou `CHROMIUM=`), rustc avec la cible
`wasm32-unknown-unknown`, `unzip`, et un clone de `banane-data` (branche `claude/execute-prompt-00-18ra5a`, collections du 05/11)
désigné par `BANANE_DATA` (défaut `/home/user/data/banane-data`). Aucune donnée n'est copiée dans ce dépôt.

```sh
cd chantiers/CH-061/rust
cargo build --release --target wasm32-unknown-unknown
RUSTFLAGS="-C target-feature=+simd128" cargo build --release --target wasm32-unknown-unknown --target-dir target-simd
cd ../bancs
node --max-old-space-size=6000 parite-geometrie.cjs 865      # parité au bit, 5 variantes   → resultats/parite-geometrie.json
node --max-old-space-size=6000 banc-geometrie.cjs 300        # Chromium, façade proposeBoth → resultats/banc-geometrie.json
NUAGES=8 REP=5 node --max-old-space-size=6000 banc-lidar.cjs # Chromium, capture()          → resultats/banc-lidar.json
PAUSE=timeout NUAGES=4 REP=3 node --max-old-space-size=6000 banc-lidar.cjs                 # → resultats/banc-lidar-pause-timeout.json
node --max-old-space-size=6000 banc-export.cjs               # JSON, deflate, CRC, état, traversée → resultats/banc-export.json
node banc-csp.cjs                                            # vraie extension MV3, CSP      → resultats/banc-csp.json
node banc-demarrage.cjs                                      # scripts du SW, module WASM   → resultats/banc-demarrage.json
node --max-old-space-size=6000 journee.cjs                   # parts de la journée du 05/11 → resultats/journee-2026-11-05.json
```

Fichiers : `charger-sw.cjs` (chaîne de modules de `background.js` en vm), `nuages.cjs` (nuages réels lus dans les zips),
`noyaux.js` (variantes de `search` et colle WASM), `lidar-variante.js` (prototype de `capture()`), `chromium.cjs`,
`extension-csp/` (extension d'essai). Le code de `src/` et `vendor/` est lu, jamais modifié : les variantes sont fabriquées en mémoire.
