# CH-069 — Rust : export (lot 200–249) — rapport et état de reprise (06/11/2026, 22 h 40 UTC)

Arrêt sur ordre de l'opérateur (relayé par l'intégrateur) jusqu'à dimanche soir. Le travail n'est PAS fini : pas de PRÊT.

## Fait (mesuré)
- Crate `ariane-rs/crates/ariane-export` (membre de l'espace, `[lints] workspace = true`), `appeler(200..=249)`. cargo test : 18 essais (un par module public et par fonction d'entrée) ; clippy pedantic `-D warnings` propre, natif et wasm32. Aucun `unwrap`/`expect`/`panic` hors essais ; un `unsafe` (`ariane_export_crc32`), avec `SÛRETÉ`.
- Fonctions portées : crc32 200 ; export-cache : signature 201, signatures en lot 202 (extension de la façade), capturesAGarder 203, refus 204, reprenable 205, finiPourDeBon 206, ficheDepart 207, ajouterDepart 208 ; native-export : compact 210, expand 211, expandCloud 212, unfoldRefs 213, misfiledHead 214, alleger 215, enteteMince 216, deltaMetadonnees 217, evenementsParReference 218, rehydraterEvenements 219 ; phase-pli : plier 220, deplier 221, estPlie 222, eligible 223 ; gcv1-export : buildDiagnostic 230 (`exportedAt` passé par la façade).
- Restent en JS par nature : createInterner/compactCloud/foldRefs à interneur reçu (état entre appels), exportMode/MODES (fonctions), confirmerJalon (identité), buildCorpusPlan (asynchrone, fonction reçue), supprimer/lire/ecrire/lireDeparts/noterDepart (stockage), texte (`Date.parse`), texteDepart/heureParis (`Intl`). `localeCompare` porté pour l'ASCII imprimable seulement (ordre ICU mesuré), hors de là : repli JS.
- Façade `ariane-rs/coquille/facade-export.js` (même API, repli JS compté ; objets rendus par identité remis par la façade). Branchement proposé au chef : `chantiers/CH-069/branchement-coeur.patch` (non appliqué : ariane-coeur non touché).
- Patch ariane-js `ariane-js-nombre-rapide.patch` : non retenu, le chef a fait l'équivalent (81404d9, fusionné ici). Essai différentiel `tools/ch069-sonde-nombres.cjs` : 20 434 110 tirages, 0 écart Node 22 et Chromium 153.

## Parité (ÉTABLI sauf mention)
| Cas | Node 22 | Chromium 153 |
|---|---|---|
| Relevé des 55 essais du tronc (1 341 appels, 34 essais) + 4 153 variantes à graine fixe, build livré (256 Mio) | 5 494 / 5 494, empreintes égales | 5 494 / 5 494, empreintes égales |
| Données réelles 04–06/11, cœur à plafond relevé (tout calculé en Rust) | 213 cas faits (docs 1 à 44), 0 écart — INCOMPLET | non fait |

Replis du build livré sur relevé + variantes : 142, tous des formes rares voulues (événement null, `events` non tableau, référence `§` non canonique, clé « toString » dans un résumé…).

## Temps et mémoire (Node, machine NON au repos : PROBABLE, à confirmer au banc Chromium)
- `nombre_en_chaine` (avant 81404d9) : 1,7 µs par nombre en natif contre 0,19 µs pour `String(x)` ; tout `JSON.stringify` en Rust en héritait.
- crc32 d'un Uint8Array de 33 Mo : JS 86,9 ms ; chemin direct (copie dans la mémoire du module, découpage par 8) 26,6 ms ; par trame (`Array.from`) 16 s. Gain réel seulement avec une entrée « octets » dans `coeur.js` (instance unique), à décrire au chef : la façade livrée laisse crc32 d'un Uint8Array en JS.
- buildDiagnostic, journal réel de 33 Mo : JS 3 981 ms ; WASM 1 785 ms trame comprise, mais 574 Mio de mémoire linéaire → au-delà du plafond de 256 Mio : reste en JS (décision de l'intégrateur).
- expand, segment Écho de 29 Mo : JS 273 ms ; WASM 821 ms et 543 Mio → reste en JS. Signatures de 20 000 événements : JS 114 ms, WASM 534 ms → restent en JS.
- Levier trouvé (ticket à part, plus tard) : un décodage de la trame sans copie, qui éviterait l'arbre `Valeur` : décodée, une trame pèse ~15 fois sa taille en mémoire linéaire.

## Reprise (prochaines étapes, dans l'ordre)
1. Parité réelle, Node, cœur à plafond relevé : `node --max-old-space-size=12000 tools/ch069-parite.cjs --memoire-max 4294967296 --sans-releve --sans-variantes --suivi --json …` (plusieurs heures ; données : clone sparse de banane-data, collections 04–06/11, hors du dépôt).
2. Même parité dans Chromium (`--moteur chromium`), au moins sur un sous-ensemble réel (`--reels N`).
3. Banc seul sur la machine : `node tools/ch069-banc.cjs --rep 15 --json …` (médiane et P90, JS contre WASM trame comprise, crc32 direct en plus).
4. Trancher fonction par fonction (gain seulement, 256 Mio), mettre la façade d'accord (fonctions sans gain → JS), compléter ce rapport, PRÊT.

Outils : `tools/ch069-*.cjs` (commun, enregistreur, relevé, adaptateur, parité, banc, sonde). Le cœur de mesure est construit dans une copie patchée sous `ariane-rs/target/` (non suivie).
