# CH-064 — Fiche d'état du chef (06/11/2026, 18 h 10)

Branche `chantier/CH-064` (tête 8a2c47b et suivantes). D-295 (opérateur) : porter TOUT le calcul pur portable, au bit près, hors du paquet ; revue d'intégration complète ensuite. Architecture A décidée (D-294) : cœur Rust/WASM dans l'extension, coquille JS. Le JS reste la production ; rien du Rust n'entre dans le paquet sans décision écrite de l'opérateur. PR n° 25 (brouillon, vers le tronc) : audit externe seulement — ne jamais la fusionner ni la fermer.

## Fait (chaque point mesuré, fichiers dans ce dossier)
- **Étape 1 close** (`etape-1-rapport.md`) : sémantique JS (`ariane-js`), format VBA (`vba.md`), coquille, banc de parité Node et Chromium. Aller-retour VBA sur 201 documents réels (04 au 06/11, 4,62 Go) identique 201/201 sur les trois chemins, aucun refus (`vba-corpus.json`).
- **Étape 1 bis** (`A-contre-B.md`, `banc-b.json`) : A retenue ; B (natif par `connectNative`) documentée, non développée.
- **Étape 2** : capture-core, V4.6, GCV1, calage de convention, jauge portés ; parité identique sur tous les nuages réels (`parite-*-node.json`).
- **Étape 4** : construction séparée (`tools/ch064-construire-extension.cjs`, `'wasm-unsafe-eval'` dans la COPIE seulement) ; rejeu d'un export réel du 06/11 (partie 13) identique au paquet officiel, 76 commandes à la page octet pour octet, haute eau WASM 2,1 Mio (`banc-esv-export-06-11.json`).
- **Qualité** : clippy pedantic `-D warnings` (cible WASM comprise), `SÛRETÉ` sur chaque `unsafe`, arène remise à zéro à chaque appel (`ariane-coeur/src/arene.rs`), plafond mémoire 256 Mio (`ariane-rs/.cargo/config.toml`), conversion des nombres unique (`ariane_js::nombre`, 0 écart sur 10 millions de tirages Node et Chromium). Six constats de l'audit corrigés (3248d16), second audit sans constat.

- **Temps** (`temps-par-cut.md`, `bilan.md`) : par cut de lot, tronc ≈ 1 160 ms, JS élagué ≈ 187, WASM ≈ 205 ; le Rust n'apporte en propre que ≈ −49 ms (LiDAR). `scientificProposeBoth` : 491 / 280 / 145 ms par appel, 0,21 appel par cut de lot (`appels-shadow-p13.json`).
- **Fusion de L** (3d12d5b) : module LiDAR autonome, reprise sur trappe, essais de la trappe et du plafond de 256 Mio ; le cœur ne dépend plus de `ariane-lidar` (son build.rs lui imposait 512 Kio).
- `Valeur::canonique` (ariane-vba) ; NaN marqués dans l'empreinte de parité (`sansNaN`).
- **Bilan de l'étape 5** (`bilan.md`) et **inventaire D-295** (`inventaire-100.md`, `tools/ch064-inventaire.cjs`) : 56,5 % du calcul pur porté ou en cours ; lots 200 à 549 proposés.

## Suivant
1. `Date.parse` au bit près dans ariane-js (plusieurs lots en dépendent) ; lot 450–499 (restes de capture-core et de L) si l'intégrateur me le confie.
2. Fusions de **CH-064-D** (doit corriger les clés NaN `to_bits` et remplacer `js::canon` par `Valeur::canonique` ; branchement 50..=99 dans `aiguiller` à sa fusion), puis **CH-064-E**, puis **CH-068** (J4), à leur PRÊT et au signal de l'intégrateur.
3. Rejeu d'un lot avec la lecture LiDAR en WASM ; rejeu d'une relecture pour compter `scientificProposeBoth` par cut relu.

## Équipe et adresses
- Intégrateur (toutes les questions passent par lui) : `@parent`, session `session_01Td4bNnR2Eydn3tQm8A3rz5`.
- CH-064-L (`ariane-lidar`) : session `session_01Td4bNjqpQHxtkUvZLixRmX` ; branche `chantier/CH-064-L`.
- CH-064-D (`ariane-decision`, numéros 50 à 99) : session `session_01Td4bNktXfAF7FeRpGygFhD` ; branche `chantier/CH-064-D`.
- CH-068 (J4, Codex puis session `session_01Td4bNniJJML8gw3R2SayBV`) : branche `chantier/CH-068` partie de D ; numéros 150 à 199.
- CH-065 (élagage JS) : session `session_01Td4bNm8jgE4JysBDDVv7ax`.
- CH-064-E (`ariane-etat`, numéros 100 à 149) : Cursor, PR n° 24 ; il appelle `ariane_js::nombre` (son Ryū retiré).

## Règles de fusion et de travail
- Ne fusionner une branche `chantier/CH-064-X` qu'après son « PRÊT » ET le signal de l'intégrateur ; pour leur donner ma base, ce sont EUX qui fusionnent `chantier/CH-064`.
- Avant chaque push : `node tools/scan-identite.cjs` et `node --test tests/noms-modeles.test.cjs tests/scan-identite.test.cjs` ; aucune adresse web, aucun nom de modèle, aucun identifiant ni donnée réelle dans un fichier suivi.
- Rien dans `tests/` ni dans les fichiers de production ; essais dans `ariane-rs/` (`cargo test`) et `tools/ch064-*` (lanceur `tools/ch064-essais.cjs`).
- Données réelles : clone sparse de `banane-data` dans `/home/user/data/banane-data` (collections du 04 au 06/11), jamais copiées dans le dépôt.
- Bancs de temps : machine au repos, rien d'autre en parallèle ; tâches de fond longues lancées avec la durée maximale.
