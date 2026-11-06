# CH-065 — Note à l'intégrateur : appliquer les patchs, patch par patch

Aucun fichier gelé ou interdit n'est modifié par ce chantier. Les quatre patchs sont indépendants : l'opérateur peut en choisir un sous-ensemble. Source unique : `blocs.json` (remplacements exacts), lue par `appliquer.cjs` ; les `.patch` en sont tirés. Chiffres : `rapport.md` § 1 (banc Chromium au repos), parités § 2.

| Patch | Fichier | Gain mesuré (médiane) | Journée du 05/11 | Empreintes touchées |
|---|---|--:|--:|---|
| `lidar-direct` | `vendor/lidar.js` (gelé 4.4.0) | accesseur reconnu (r124) : −174 ms par vue rapide, −198 ms en référence ; **accesseur inconnu : +31 / +16 ms** | −958 s (reconnu) ; **+161 s** (inconnu) | gel 4.4.0 (`verify.cjs`, `tests/geometry-brain.test.cjs`), copie dans `audit/v4.6.0-engine-baseline.json` (`unchangedSince440`) |
| `geometrie-elaguee-lot` | `src/geometry-candidate-v1.js` | −11 ms par nuage (composition du lot) | −10 s | `tests/pose-inchangee-4958.json` ; étiquettes non contrôlées : `CONTRACT.geometrySha256` (gcv1-shadow.js), `audit/gcv1-runtime-shadow.json`, workflow `gcv1-shadow-v1.yml` (déjà périmé) |
| `mediane-exacte` | `src/geometry-candidate-v1.js` | avec le précédent : −34 ms par nuage | avec le précédent : −29 s | les mêmes que le précédent |
| `geometrie-elaguee-v46` | `src/geometry.js` (gelé 4.4.0) | −5 ms par nuage (V4.6) | −2 s | gel 4.4.0, baseline v4.6.0, `pose-inchangee-4958` ; étiquette `baselineSha256` de gcv1-shadow.js |
| **les quatre** | | lot : 103,9 → 62,7 ms ; P90 667,8 → 310,7 | **−994 s (15,8 %)** si r124 ; +125 s sinon | |

**Variante qui laisse `src/geometry.js` gelé** : `lidar-direct` + `geometrie-elaguee-lot` + `mediane-exacte`, soit −987 s sur 994 (si r124). **Sans condition** : les deux patchs de `geometry-candidate-v1.js` seuls, −29 s ; avec `geometrie-elaguee-v46`, −36 s.

## Ce que fait chaque patch
- **lidar-direct** (règle finale, commune au Rust, 06/11) : la boucle de lecture d'un nœud lit le tampon directement, sans tableau par point, seulement si le nœud est non indexé, l'attribut Float32 ou Float64 non normalisé, ET l'attribut sans accesseur, ou avec des `getX/getY/getZ` (lus par DESCRIPTEURS, sans rien invoquer ; un getter = inconnu) identiques à l'instantané des fonctions de `THREE` pris au chargement du module, au `THREE` courant, et dont le code (`toString`) est dans `LISTE_BLANCHE_THREE` (three.js r124 de Potree 1.8.0, repris de CH-064 au caractère près ; classes de la maquette). Sinon : boucle d'origine telle quelle, et le patch n'appelle aucun accesseur de lui-même. Limite assumée : une page qui falsifie `Function.prototype.toString`. Mesuré : avec un accesseur inconnu, le module patché est plus lent (+31 ms par vue rapide, cause supposée : optimisation de V8 sur une fonction plus grande).
- **geometrie-elaguee-lot / -v46** : `loss` n'examine que les points à moins de 26 mm de l'ancre (sur `p[0]` trié). Hors de cette fenêtre, aucun point ne peut abaisser le minimum (borné à 0,025²). Hors du domaine où cette borne est prouvée (`|u| ≥ 1` ou `|a[0]| ≥ 1`), la boucle d'origine.
- **mediane-exacte** : tri natif d'une copie `Float64Array` quand il range les valeurs comme le comparateur d'origine, c'est-à-dire pour un tableau ordinaire de nombres, sans NaN, sans mélange de -0 et +0. Sinon, le code d'origine.

## Appliquer
1. Choisir les patchs, puis : `node chantiers/CH-065/appliquer.cjs appliquer . lidar-direct,geometrie-elaguee-lot,mediane-exacte[,geometrie-elaguee-v46]` (ou `git apply` des `.patch` voulus) ; puis `git apply chantiers/CH-065/garde-empreintes.patch`.
2. `node chantiers/CH-065/appliquer.cjs etat` : chaque patch est « present » ou « absent », jamais à moitié (sinon, erreur).
3. `node --test tests/ch065-*.test.cjs tests/geometry-brain.test.cjs tests/pose-lot-inchanges-4959.test.cjs`. Les essais `ch065-*` valent pour tout sous-ensemble appliqué.
4. Garde, parités et `verify` de la version (déjà faits ici sur l'arbre aux quatre patchs : verts, voir le rapport).

## `garde-empreintes.patch` (verify et deux essais)
Les gardes d'empreintes comparent un fichier gelé **sans les blocs déclarés de CH-065** à l'empreinte historique, qui reste inchangée. `audit/v4.4.0-frozen-engine-hashes.json` n'est pas modifié (règle de passation de `verify.cjs`). Mesuré sur l'arbre aux quatre patchs :
- sans ce patch, 3 essais échouent comme prévu (`geometry-brain`, `pose-lot-inchanges-4959` × 2) ;
- avec lui, 750 essais sur 113 fichiers (dont les `ch065-*`) : 749 verts, 1 sauté (corpus natif privé absent, déjà sauté sur le tronc), 0 échec ;
- une dérive hors patch (`minFace` 6 → 7) fait toujours échouer la garde.

## Chaîne `CONTRACT.geometrySha256` : NON changée (décision de l'intégrateur)
- Aucun des quatre patchs n'entre dans un hash vérifié à l'exécution. Le seul contrôle à l'exécution compare la chaîne `CONTRACT.geometrySha256` du code chargé à celle enregistrée dans le lot (`background.js:64-68`), et aucune empreinte de fichier n'est recalculée. La baseline v4.6.0, le gel 4.4.0 et `pose-inchangee-4958` ne sont lus que par `verify` et les essais.
- Mesuré en maquette (`resultats/maquette-reprise.json`), pour les quatre patchs pris un par un puis ensemble : un lot neuf part et finit ; un lot mis en pause sous l'ancien paquet reprend et finit, avec ou sans rechargement.
- Si la chaîne était changée, la reprise serait refusée net : « Moteur GCV1 du lot indisponible ou incohérent : reprise refusée. », le lot reste en pause, rien n'est écrit. Il faudrait alors finir ou arrêter tout lot avant d'installer le paquet. Avec la chaîne inchangée, aucune contrainte.

## Relevé à faire chez l'opérateur AVANT d'installer `lidar-direct`
`tools/ch065-releve-accesseur.js`, à coller dans la console (F12) d'ESV sur une coupe chargée. Lecture seule, sans coordonnée, sans adresse. Il dit si `window.THREE` existe et si les accesseurs des nœuds sont reconnus ou absents, avec le nombre de nœuds où la lecture directe serait prise. Il rend aussi `listeBlanche` (révision et code des accesseurs de three.js). Attendu : `three.revision` = « 124 », `lectureDirectePossible` = « N / N ». Si ce n'est pas le cas, ne pas installer `lidar-direct` (il coûterait environ +160 s par journée), ou verser d'abord le code relevé dans `LISTE_BLANCHE_THREE`, par décision de l'intégrateur.

## Consigne pour l'opérateur, à chaque paquet
« Décompresse le zip dans le même dossier, clique sur **Recharger** dans `chrome://extensions`, puis F5 sur ESV. »
Mesuré en maquette : Chrome garde dans le profil le code du service worker. Remplacer le dossier puis relancer Chrome, même avec un numéro de version neuf, fait encore tourner l'ancien code. L'effet de « Recharger » sur le vrai Chrome de l'opérateur est SUPPOSÉ : non reproductible ici, `chrome.runtime.reload()` décharge sans recharger une extension chargée en ligne de commande. Il a été simulé en vidant le cache des scripts du profil.

## Divers
- `.github/workflows/gcv1-shadow-v1.yml` compare par `sha256sum` `src/geometry.js` et `src/geometry-candidate-v1.js`. Il ne se déclenche que sur `integration/gcv1-runtime-shadow-v1` et épingle déjà une empreinte périmée de `src/engine.js` : ÉTABLI, sans effet sur le tronc.
- CH-064 garde le JS du tronc comme cible ; les patchs ne changent aucune sortie.
- Levier suivant mesuré, hors patch : après les quatre patchs, le P90 de la composition reste à 311 ms. Non profilé ici.
