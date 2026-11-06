# CH-065 — Note à l'intégrateur : appliquer les patchs

Trois patchs, appliqués ensemble ou pas du tout. Aucun fichier gelé ou interdit n'est modifié par ce chantier : tout est ici.

| Patch | Fichiers | Ce qu'il fait |
|---|---|---|
| `lidar-direct.patch` | `vendor/lidar.js` (gelé 4.4.0) | Boucle de lecture d'un nœud : lecture directe du tampon, sans allocation par point. Elle n'est prise que si le nœud est non indexé, à attribut Float32 ou Float64 non normalisé, et si les sondes du nœud (17 au plus) plus le premier et le dernier point relus par les deux chemins donnent les mêmes valeurs (`Object.is`). Sinon, la boucle d'origine, inchangée. |
| `geometrie-elaguee.patch` | `src/geometry.js` (gelé 4.4.0), `src/geometry-candidate-v1.js` (moteur du lot) | `loss` : seuls les points à moins de 26 mm de l'ancre (sur `p[0]`, points triés une fois) sont examinés. Hors de cette fenêtre, aucun point ne peut abaisser le minimum (borné à 0,025²). Hors domaine (`|u| ≥ 1` ou `|a[0]| ≥ 1`), la boucle d'origine. |
| `garde-empreintes.patch` | `tools/verify.cjs`, `tests/geometry-brain.test.cjs`, `tests/pose-lot-inchanges-4959.test.cjs` | Les gardes d'empreintes comparent le fichier **sans les blocs déclarés de CH-065** à l'empreinte historique. `audit/v4.4.0-frozen-engine-hashes.json` n'est **pas** modifié (règle de passation de `verify.cjs`). Toute autre dérive reste un échec. Un fichier à moitié patché aussi. |

Source unique des patchs : `blocs.json` (remplacements exacts), lu par `appliquer.cjs` (`etat`, `appliquer RACINE`, `patchs`). Les `.patch` en sont tirés.

## Ordre
1. `git apply chantiers/CH-065/lidar-direct.patch chantiers/CH-065/geometrie-elaguee.patch chantiers/CH-065/garde-empreintes.patch`
   (ou `node chantiers/CH-065/appliquer.cjs appliquer .` pour les deux premiers).
2. `node chantiers/CH-065/appliquer.cjs etat` : trois fois « patché ».
3. Essais ciblés : `node --test tests/ch065-*.test.cjs tests/geometry-brain.test.cjs tests/pose-lot-inchanges-4959.test.cjs`. Les essais `ch065-*` valent avant et après l'application (ils reconstruisent l'autre version depuis `blocs.json`).
4. Garde et parités sur l'arbre patché (rapport § 3) ; puis le `verify` de la version.

## Mesuré sur l'arbre patché (trois patchs)
- 111 fichiers d'essai qui touchent ces modules : 740 essais. **Sans** `garde-empreintes.patch`, 3 échouent, comme prévu : `geometry-brain` (gel 4.4.0) et `pose-lot-inchanges-4959` (deux essais, empreintes de la test 8). **Avec** : tous verts. Contrôle négatif : une dérive hors patch (`minFace` 6 → 7 dans `src/geometry.js`) fait échouer `geometry-brain`.
- `verify.cjs` : seule sa vérification d'empreintes est touchée. Le `verify` complet n'a pas été lancé (règle : une fois par version, par l'intégrateur).

## À décider par l'intégrateur (pas par ce chantier)
- **Étiquettes d'empreinte qui deviennent fausses si on ne les touche pas.** Ce sont des chaînes, pas des contrôles :
  - `CONTRACT.geometrySha256` (`77f01766…`) et `baselineSha256` (`3343330e…`) de `src/gcv1-shadow.js` ;
  - `audit/gcv1-runtime-shadow.json`, `audit/v4.2.1-geometry-hashes.json`, `PROJECT_STATE.md`, `GCV1_RUNTIME_*.md`, `RETOUR_ARRIERE.md`, `.github/workflows/gcv1-shadow-v1.yml`.
- **Recommandation : ne pas changer `CONTRACT.geometrySha256`.** Il entre dans `parameters` de chaque proposition, donc dans les journaux et les parités. Surtout, `background.js:67` refuse de reprendre un lot en pause dont le contrat enregistré diffère du contrat vivant. Le changer rendrait non reprenable tout lot en pause au moment de la mise à jour. Le garder est exact au sens où le patch ne change aucune sortie : l'empreinte nomme le comportement épinglé, et ce comportement est inchangé au bit près (rapport § 2). À écrire dans `DECISIONS.md` si l'intégrateur suit.
- `.github/workflows/gcv1-shadow-v1.yml` compare par `sha256sum` les empreintes de `src/geometry.js` et `src/geometry-candidate-v1.js`. Il ne se déclenche que sur la branche `integration/gcv1-runtime-shadow-v1`, et il épingle déjà une empreinte de `src/engine.js` (`f7d3ea22…`) qui n'est plus celle du tronc. ÉTABLI : il est déjà périmé et ne touche pas le tronc.
- `CH-064` (Rust) garde le JS du tronc comme cible de parité : ces patchs ne changent aucune sortie, la cible reste valable.
