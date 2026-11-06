# CH-065 — Note à l'intégrateur : appliquer les patchs, patch par patch

Aucun fichier gelé ou interdit n'est modifié par ce chantier. Les quatre patchs sont indépendants : l'opérateur peut en choisir un sous-ensemble. Source unique : `blocs.json` (remplacements exacts), lue par `appliquer.cjs` ; les `.patch` en sont tirés. Chiffres : `rapport.md` § 1 (banc Chromium au repos), parités § 2.

| Patch | Fichier | Gain mesuré (médiane) | Journée du 05/11 | Empreintes touchées |
|---|---|--:|--:|---|
| `lidar-direct` | `vendor/lidar.js` (gelé 4.4.0) | −148 ms par vue rapide, −176 ms en référence (si les accesseurs d'ESV sont reconnus, voir plus bas) | −815 s | gel 4.4.0 (`verify.cjs`, `tests/geometry-brain.test.cjs`), copie dans `audit/v4.6.0-engine-baseline.json` (`unchangedSince440`) |
| `geometrie-elaguee-lot` | `src/geometry-candidate-v1.js` | −11 ms par nuage (composition du lot) | −10 s | `tests/pose-inchangee-4958.json` ; étiquettes non contrôlées : `CONTRACT.geometrySha256` (gcv1-shadow.js), `audit/gcv1-runtime-shadow.json`, workflow `gcv1-shadow-v1.yml` (déjà périmé) |
| `mediane-exacte` | `src/geometry-candidate-v1.js` | avec le précédent : −34 ms par nuage | avec le précédent : −29 s | les mêmes que le précédent |
| `geometrie-elaguee-v46` | `src/geometry.js` (gelé 4.4.0) | −5 ms par nuage (V4.6) | −2 s | gel 4.4.0, baseline v4.6.0, `pose-inchangee-4958` ; étiquette `baselineSha256` de gcv1-shadow.js |
| **les quatre** | | lot : 103,9 → 62,7 ms ; P90 667,8 → 310,7 | **−851 s (13,6 %)** | |

**Variante qui laisse `src/geometry.js` gelé** : `lidar-direct` + `geometrie-elaguee-lot` + `mediane-exacte`, soit −844 s sur 851.

## Ce que fait chaque patch
- **lidar-direct** : la boucle de lecture d'un nœud lit le tampon directement, sans tableau par point. Conditions : nœud non indexé, attribut Float32 ou Float64 non normalisé, ET attribut sans accesseur `getX/getY/getZ` OU dont les trois accesseurs sont ceux de `THREE.BufferAttribute.prototype` (ou `InterleavedBufferAttribute`) de la page, par identité de fonction. Corrigé le 06/11 : la seule preuve par sondes laissait passer un accesseur qui diffère sur un point hors des sondes (défaut relevé par Codex sur le portage Rust). Les sondes (17, plus le premier et le dernier point, `Object.is`) restent une seconde garde. Sinon, la boucle d'origine. Mêmes opérations flottantes dans le même ordre, mêmes exceptions, budget, pauses et contrôles d'intégrité point par point.
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

## Relevé à faire chez l'opérateur avant de compter sur le gain LiDAR
`tools/ch065-releve-accesseur.js`, à coller dans la console (F12) d'ESV sur une coupe chargée. Lecture seule, sans coordonnée, sans adresse. Il dit si `window.THREE` existe et si les accesseurs des nœuds sont reconnus ou absents, avec le nombre de nœuds où la lecture directe serait prise. Si la réponse est « 0 / N », le patch est exact mais sans gain : il faudrait alors reconnaître l'accesseur de Potree autrement, par décision de l'intégrateur.

## Consigne pour l'opérateur, à chaque paquet
« Décompresse le zip dans le même dossier, clique sur **Recharger** dans `chrome://extensions`, puis F5 sur ESV. »
Mesuré en maquette : Chrome garde dans le profil le code du service worker. Remplacer le dossier puis relancer Chrome, même avec un numéro de version neuf, fait encore tourner l'ancien code. L'effet de « Recharger » sur le vrai Chrome de l'opérateur est SUPPOSÉ : non reproductible ici, `chrome.runtime.reload()` décharge sans recharger une extension chargée en ligne de commande. Il a été simulé en vidant le cache des scripts du profil.

## Divers
- `.github/workflows/gcv1-shadow-v1.yml` compare par `sha256sum` `src/geometry.js` et `src/geometry-candidate-v1.js`. Il ne se déclenche que sur `integration/gcv1-runtime-shadow-v1` et épingle déjà une empreinte périmée de `src/engine.js` : ÉTABLI, sans effet sur le tronc.
- CH-064 garde le JS du tronc comme cible ; les patchs ne changent aucune sortie.
- Levier suivant mesuré, hors patch : après les quatre patchs, le P90 de la composition reste à 311 ms. Non profilé ici.
