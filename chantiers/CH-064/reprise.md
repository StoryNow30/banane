# CH-064 — État de reprise (arrêt sur ordre de l'opérateur, 06/11/2026, 23 h 40 Paris ; reprise dimanche soir)

## Où en est le chantier
- **Branche `chantier/CH-064`** : tout est poussé (voir `git log`). Elle contient les fusions de L (lecture LiDAR), CH-066 (fuzz VBA et ses correctifs), D (décision J1 à J3), CH-068 (J4, 61 à 65), et E (état, journal, listes, 100 à 149).
- **Premier paquet en Rust** : le patch d'entrée de la lecture LiDAR (`patch-lidar-paquet.patch`, note `patch-lidar-paquet.md`, PRÊT a85366e) a été **intégré au tronc par l'intégrateur en 33684d3**. Verify, maquette et paquet « Vision » restent de son ressort.
- **Qualité, sur la tête** : `cargo clippy --workspace --all-targets -- -D warnings` est propre, en natif et en `--target wasm32-unknown-unknown`. **C'est la règle de l'espace** : pedantic avec les six exceptions de `[workspace.lints]` ; ne pas ajouter `-W clippy::pedantic` sur la ligne de commande. `cargo test` : 81 essais verts.
- **Parités établies** :
  - L sur 65036e1 : Node 9 316 / 9 316 ; Chromium 4 600 captures, puis 116 / 116 (`L/`).
  - E sur fcbe8d05 : IDENTIQUE, 227 appels, 0 rejeu (`E-parite-fusion.json`).
  - D dans Chromium, module par module (sur 5e43626) : critere, signal, gardeApresDiffere, gardePasseAppuis, relectureOmbre, reglesMetier et crossing, tous IDENTIQUES.

## Plantage Chromium de la parité de D (`tools/ch064-d-chromium.cjs`)
1. **Cause 1, mesurée et corrigée (42fc997d)** : `shadow` dépassait le seuil de réinstanciation à chaque appel (1 086 réinstanciations pour environ 4 000 appels). `coeur.js` ne recrée plus l'instance qu'après un gros appel isolé (occupation de moins du quart).
2. **Cause 2, PROBABLE** : l'outil pousse des lots de 200 cas, de près de 1 Mo chacun, dans la page, dont le tas JS montait à 2,1 Go. Passe de vérification lancée avec `--lot 20`. Résultat : voir la fin de ce fichier.

## Prochaine étape, dans l'ordre
1. Si la passe `--lot 20` est allée au bout : baisser le lot par défaut de `tools/ch064-d-chromium.cjs` (20), et verser `D-parite-chromium-fusion.json`. Sinon, rejouer `--lot 20` et regarder le tas JS des derniers lots, imprimés tous les 20 lots.
2. **Patchs en attente, signal de l'intégrateur déjà donné** : CH-070 (`origin/chantier/CH-070`, dacb14a) :
   - `chantiers/CH-070/coeur-aiguillage.patch` : le bras 250..=299 vers `ariane_session::appeler`, et la dépendance dans `ariane-coeur` ;
   - `chantiers/CH-070/ariane-js-date-json.patch` : `ariane_js::date` (`Date.parse`) et `ariane_js::json` (lecture JSON), avec la dépendance à `ariane-vba`.

   Après application : clippy de l'espace (natif et WASM) et `cargo test`. Le patch `ariane-js-extra.patch` reste de côté tant qu'il n'a pas d'utilisateur (décision transmise à l'intégrateur).
3. Lot 450–499 (restes de capture-core et de L) : confié au chef ; pas commencé.
4. Entrée de la décision dans le paquet : seulement après une parité Chromium complète de J1 à J5 sur la tête.

## Équipe (sessions)
Intégrateur `session_01Td4bNnR2Eydn3tQm8A3rz5` · D `session_01Td4bNktXfAF7FeRpGygFhD` · CH-068 `session_01Td4bNniJJML8gw3R2SayBV` · CH-069 `session_01Td4bNkNMCDvCyGRQtdY1Wa` · CH-070 `session_01Td4bNoRey1P6j2CpBeeLAS` · CH-065 `session_01Td4bNm8jgE4JysBDDVv7ax` · L `session_01Td4bNjqpQHxtkUvZLixRmX`.

## Données et outils
- Corpus réel : `/home/user/data/banane-data` (clone partiel ; collections du 04 au 06/11), à recloner s'il manque.
- `tools/ch064-e-parite.cjs` lit `BANANE_DATA=<…>/collections` ; sans cette variable, il rend IDENTIQUE sur un corpus vide (faux vert, signalé à l'intégrateur).
- Parités longues : en tâche de fond, deux heures au plus par tâche ; `--saut N` permet de reprendre une parité de L.

## Résultat de la passe de D (`--lot 20`, tête fcbe8d05 + coquille 42fc997d)
- Elle a dépassé le point du plantage précédent (297 800 cas avec les lots de 200). Elle s'est arrêtée au **lot 15 012, cas 300 240**, sur « page fermée », **au moment du redémarrage du conteneur** : je ne peux pas distinguer un plantage d'un arrêt dû au conteneur. Aucun écart n'a été signalé jusque-là, mais le verdict final n'existe pas (aucun fichier de résultat).
- État mesuré juste avant : cœur 2,2 Mio, haute eau 136 Mio, 100 réinstanciations en 300 240 cas ; **tas JS de la page 1,35 Go**, avec des pointes à 1,4 Go aux lots 14 920 et suivants. Le tas reste haut : à surveiller.
- **À la reprise** : relancer `CHROMIUM=/opt/pw-browsers/chromium node --max-old-space-size=12000 tools/ch064-d-chromium.cjs --lot 20 --json chantiers/CH-064/D-parite-chromium-fusion.json` sur une machine au repos, en tâche de fond de deux heures. S'il plante encore vers 300 000 cas, réduire à `--lot 5`, ou chercher ce qui retient le tas (`ms.js` et `ms.rs`, modules JS). Environ 330 000 cas au total.
