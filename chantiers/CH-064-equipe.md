# CH-064 — Équipe de la réécriture en Rust (06/11/2026)

Ordre de l'opérateur (06/11) : « un effort particulier sur la réécriture d'Ariane en Rust, avec un véritable attendu sur ses performances (rapidité, RAM, etc.) ; n'hésite pas à mettre plus d'agents sur le chantier, que ce soit sur [modèle de Claude, nom retiré : CLAUDE.md] ou sur Cursor ».

## Organisation
- **CH-064 (chef)** porte :
  - l'architecture, le codec VBA, `ariane-js` et la comparaison A contre B ;
  - l'espace Cargo : `ariane-rs/Cargo.toml` (membres), la coquille et le banc de parité générique `tools/ch064-*` ;
  - la fusion des sous-chantiers dans `chantier/CH-064`.
  Il seul ajoute un membre à l'espace.
- Chaque sous-chantier :
  - a sa branche `chantier/CH-064-X`, partie de `origin/chantier/CH-064` (pas du tronc) ;
  - travaille dans SA crate, sans toucher les crates des autres ;
  - utilise `ariane-js` (fonctions au bit près de V8) et `ariane-vba` (échanges) tels quels. Il demande au chef s'il lui faut un changement ;
  - livre sa crate, ses essais `cargo test`, son banc de parité (rejoué par `tools/ch064-essais.cjs`), son banc de temps et de mémoire, et un rapport `chantiers/CH-064/X-rapport.md`.

| Sous-chantier | Agent | Crate | Modules JS de référence |
|---|---|---|---|
| CH-064-L | session Claude | `ariane-lidar` | `vendor/lidar.js`, `src/native-lidar.js`, lecture des tampons de la capture (`src/adapter-page.js`, en lecture), `src/merge-clouds.js`, `src/lod-signature.js` |
| CH-064-D | session Claude | `ariane-decision` | `src/lot-decision.js`, `src/gcv2*.js`, `src/regles-metier.js`, `src/voie-b1-ecart.js`, `src/garde-*.js`, `src/relecture-ombre.js`, `src/relecture-critere.js`, `src/relecture-signal.js` |
| CH-064-E | Cursor | `ariane-etat` | `src/etat-morceaux.js`, `src/journal-index.js`, `src/correction-liste.js`, `src/liste-memoire.js`, `src/verts-a-controler.js`, sérialisation de l'export (`src/native-session.js`, `dataset`) |

## Ce que chacun doit prouver (non négociable)
1. **Parité octet pour octet** avec le module JS du tronc, sur les données réelles de `banane-data` : collections du 04/11, du 05/11 et du 06/11, `2026-11-06_v5_constellation-parties-13-16`. Cursor peut lire `banane-data` (D-253). Mêmes sorties, mêmes exceptions, même ordre des clés (Object.is).
2. **Performance mesurée dans un vrai Chromium** (`/opt/pw-browsers/chromium`, machine au repos, 15 répétitions, médiane et P90) :
   - temps JS du tronc ;
   - temps JS élagué, quand CH-061 ou CH-065 en a un ;
   - temps Rust/WASM, traversée JS ↔ WASM comprise ;
   - Rust natif (option B), si la crate s'y prête.
3. **Mémoire mesurée** :
   - tas JS ;
   - mémoire linéaire du WASM au plus haut et après l'opération (elle n'est jamais rendue : la borner, par exemple avec une arène réutilisée et une taille fixe) ;
   - RSS du processus natif.
4. Rapport : un tableau par module (temps, mémoire, gain par cut et par journée, rapporté au temps réel d'un cut mesuré par CH-058 et CH-060) ; ÉTABLI / PROBABLE / SUPPOSÉ.

## Interdits (pour tous)
- Rien dans `src/`, `background.js`, `panel.*`, `vendor/`, `manifest.json`, ni dans le paquet ou le tronc : tout est dans `ariane-rs/crates/<sa crate>/`, `chantiers/CH-064/` et `tools/ch064-<x>-*`.
- Aucune requête vers le vrai ESV. Aucun nom d'opérateur, code projet ESV, adresse ESV, UUID ni capture dans un fichier ou un commit. Aucune coordonnée absolue dans les résultats.
- Jamais « identique » sans le banc de parité ; jamais un chiffre non mesuré.

## Communication
- Les sessions Claude passent par `send_message` à `@parent`, l'intégrateur, qui relaie au chef.
- Cursor passe par sa PR (`chantier/CH-064-E` vers `chantier/CH-064`), via `node tools/hub.cjs dire --chantier CH-064-E --de cursor …` : `question`, puis `rapport`.
- Fin = « PRÊT CH-064-X <sha> ».
