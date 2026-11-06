# CH-064 — Fiche d'état du chef (06/11/2026, 16 h 40)

Branche `chantier/CH-064` (tête a70c172 et suivantes). Architecture A décidée (D-294) : cœur Rust/WASM dans l'extension, coquille JS. Le JS reste la production ; rien du Rust n'entre dans le paquet sans décision écrite de l'opérateur. PR n° 25 (brouillon, vers le tronc) : audit externe seulement — ne jamais la fusionner ni la fermer.

## Fait (chaque point mesuré, fichiers dans ce dossier)
- **Étape 1 close** (`etape-1-rapport.md`) : sémantique JS (`ariane-js`), format VBA (`vba.md`), coquille, banc de parité Node et Chromium. Aller-retour VBA sur 201 documents réels (04 au 06/11, 4,62 Go) identique 201/201 sur les trois chemins, aucun refus (`vba-corpus.json`).
- **Étape 1 bis** (`A-contre-B.md`, `banc-b.json`) : A retenue ; B (natif par `connectNative`) documentée, non développée.
- **Étape 2** : capture-core, V4.6, GCV1, calage de convention, jauge portés ; parité identique sur tous les nuages réels (`parite-*-node.json`).
- **Étape 4** : construction séparée (`tools/ch064-construire-extension.cjs`, `'wasm-unsafe-eval'` dans la COPIE seulement) ; rejeu d'un export réel du 06/11 (partie 13) identique au paquet officiel, 76 commandes à la page octet pour octet, haute eau WASM 2,1 Mio (`banc-esv-export-06-11.json`).
- **Qualité** : clippy pedantic `-D warnings` (cible WASM comprise), `SÛRETÉ` sur chaque `unsafe`, arène remise à zéro à chaque appel (`ariane-coeur/src/arene.rs`), plafond mémoire 256 Mio (`ariane-rs/.cargo/config.toml`), conversion des nombres unique (`ariane_js::nombre`, 0 écart sur 10 millions de tirages Node et Chromium). Six constats de l'audit corrigés (3248d16), second audit sans constat.

## En cours
- **Banc de temps** (`tools/ch064-banc-temps.cjs --nuages 200 --rep 15`), perdu au redémarrage du conteneur, à relancer SEUL sur la machine ; puis le **temps CPU par cut** : appels par cut du rejeu de la partie 13 (V4.6 3,4 ; GCV1 2,5 ; calage 8,8) × durée médiane d'un appel (JS du tronc, JS élagué de CH-061, WASM).

## Suivant
1. Fusion de **CH-064-L** à son PRÊT et au signal de l'intégrateur : `pub use ariane_lidar::abi as lidar;` dans `ariane-coeur/src/lib.rs` ; essai « trappe puis appel LiDAR servi et identique » ; mesure du refus propre au plafond de 256 Mio.
2. Fusions de **CH-064-D** puis **CH-064-E** dans le même ordre (PRÊT, signal, audit relancé par l'intégrateur).
3. Étape 5 : bilan pour décision de l'opérateur (gains poste par poste, risques, ce qui serait prêt à remplacer le JS).

## Équipe et adresses
- Intégrateur (toutes les questions passent par lui) : `@parent`, session `session_01Td4bNnR2Eydn3tQm8A3rz5`.
- CH-064-L (`ariane-lidar`) : session `session_01Td4bNjqpQHxtkUvZLixRmX` ; branche `chantier/CH-064-L`.
- CH-064-D (`ariane-decision`, numéros 50 à 99) : session `session_01Td4bNktXfAF7FeRpGygFhD` ; branche `chantier/CH-064-D` ; ses questions Q1 à Q3 non encore reçues.
- CH-064-E (`ariane-etat`, numéros 100 à 149) : Cursor, PR n° 24 ; il appelle `ariane_js::nombre` (son Ryū retiré).

## Règles de fusion et de travail
- Ne fusionner une branche `chantier/CH-064-X` qu'après son « PRÊT » ET le signal de l'intégrateur ; pour leur donner ma base, ce sont EUX qui fusionnent `chantier/CH-064`.
- Avant chaque push : `node tools/scan-identite.cjs` et `node --test tests/noms-modeles.test.cjs tests/scan-identite.test.cjs` ; aucune adresse web, aucun nom de modèle, aucun identifiant ni donnée réelle dans un fichier suivi.
- Rien dans `tests/` ni dans les fichiers de production ; essais dans `ariane-rs/` (`cargo test`) et `tools/ch064-*` (lanceur `tools/ch064-essais.cjs`).
- Données réelles : clone sparse de `banane-data` dans `/home/user/data/banane-data` (collections du 04 au 06/11), jamais copiées dans le dépôt.
- Bancs de temps : machine au repos, rien d'autre en parallèle ; tâches de fond longues lancées avec la durée maximale.
