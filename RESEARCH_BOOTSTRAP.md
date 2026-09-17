# Banane Research Bootstrap V1

Objectif : rendre les labs/replays Banane reproductibles depuis un clone propre, sans chercher manuellement les archives Natif ni deviner leurs chemins.

Ce lot ne touche ni au runtime, ni à `src/geometry.js`, ni au moteur, ni au Brain, ni à Pair Arbitration.

## Commandes

```sh
node tools/banane-bootstrap.cjs doctor
node tools/banane-bootstrap.cjs prepare
node tools/banane-bootstrap.cjs verify
node tools/banane-bootstrap.cjs paths
```

Ajouter `--json` pour une sortie machine-readable.

`prepare` n'est réussi que si le dataset est `READY`. Une archive absente, de mauvaise taille ou de mauvais SHA fait échouer la préparation.

## Source canonique

Le lock `data/native-v46.lock.json` est la source de vérité.

Release privée :

`StoryNow30/banane-data` / `native-v4.6-2026-09-16`

| rôle | asset | octets | SHA-256 |
|---|---|---:|---|
| historique | `banane-native-v4.6-2026-09-16.7z` | 34 509 008 | `32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0` |
| complément final | `banane-native-v4.6-2026-09-16-final.7z` | 56 657 500 | `7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66` |

## Résolution des données

Le bootstrap cherche dans cet ordre :

1. `BANANE_NATIVE_HISTORICAL` / `BANANE_NATIVE_FINAL`
2. `BANANE_NATIVE_DIR`
3. `.banane-data/native-v46/downloads/`
4. `datasets/native-v46/`
5. `/tmp/native-v46/`

Toute archive trouvée est vérifiée par **taille puis SHA-256** avant usage.

Le cache canonique est :

```text
.banane-data/native-v46/
  downloads/
  extracted/
    historical/
    final/
  state.json
```

`.banane-data/` doit rester hors Git.

## Téléchargement privé

Si une archive manque, `prepare` peut utiliser :

- `GH_TOKEN`, ou
- `GITHUB_TOKEN`, ou
- `gh auth token` si la CLI GitHub est installée et authentifiée.

Le token n'est jamais écrit dans les logs.

Important : l'authentification d'un connecteur/MCP GitHub n'est pas automatiquement disponible dans le shell d'un agent. Si le shell n'a ni token ni `gh`, le bootstrap s'arrête avec `AUTH_MISSING` et demande le montage des deux `.7z`. Il ne tente pas de contourner l'authentification.

## Extraction

Un `7zz` ou `7z` doit être disponible.

L'extraction se fait d'abord dans un répertoire temporaire. Le répertoire canonique ne remplace l'ancien qu'après succès et présence de JSON.

Chaque extraction reçoit `.banane-bootstrap.json`, qui lie :

- le dataset ;
- l'asset ;
- son SHA-256 et sa taille ;
- le fingerprint du lock ;
- le nombre de JSON extrait.

Une extraction sans marker valide n'est pas considérée comme préparée.

## Contrat pour les labs

Un lab qui a besoin des Natif complets ne doit plus chercher lui-même des chemins.

En CLI :

```sh
node tools/banane-bootstrap.cjs verify
node tools/banane-bootstrap.cjs paths --json
```

En Node :

```js
const B = require('./tools/banane-bootstrap.cjs');
const dirs = await B.resolvePreparedDataset();
// dirs.historical
// dirs.final
```

Si le dataset n'est pas prêt, `resolvePreparedDataset()` lève `DATASET_NOT_READY`. Un lab complet ne doit jamais convertir cet état en `0 rail`, `null` silencieux ou succès partiel.

## États attendus

Exemple prêt :

```text
CODE                 PASS
GITHUB_AUTH          AVAILABLE
EXTRACTOR            PASS
HISTORICAL_ARCHIVE   PASS
HISTORICAL_DATA      PASS
FINAL_ARCHIVE        PASS
FINAL_DATA           PASS
DATASET              READY
```

Sans credentials et sans montage local :

```text
CODE                 PASS
GITHUB_AUTH          MISSING
HISTORICAL_ARCHIVE   MISSING
FINAL_ARCHIVE        MISSING
DATASET              NOT_READY
```

`NOT_READY` est un état bloquant pour un rejeu complet.

## Code compatible

`doctor` vérifie l'existence des outils de base et les empreintes critiques :

- `src/geometry.js`
- `src/engine.js`
- `vendor/capture-core.js`
- `vendor/lidar.js`

Le lock fixe les hashes V4.6 connus. Un mismatch produit `CODE FAIL`.

## Tests rapides

`tests/fixtures/bootstrap/` contient uniquement de petites fixtures de provisioning. Ce ne sont pas des données LiDAR, des références humaines, ni un corpus d'évaluation.

```sh
node --test tests/banane-bootstrap.test.cjs
```

Ces tests vérifient notamment :

- lock des deux assets ;
- taille/SHA fail-closed ;
- ordre de résolution ;
- marker d'extraction ;
- détection de code manquant/altéré ;
- impossibilité d'obtenir `READY` avec des archives absentes.

## Règle de livraison des futurs agents

Avant d'annoncer un lot terminé :

1. repartir d'un clone propre de la branche livrée ;
2. exécuter `node tools/banane-bootstrap.cjs doctor` ;
3. vérifier que chaque fichier annoncé existe réellement dans le commit ;
4. pour un lab Natif complet, exiger `node tools/banane-bootstrap.cjs verify` → `DATASET READY` ;
5. relancer les tests depuis ce clone.

Un résultat obtenu uniquement dans `/tmp`, dans un workspace éphémère ou dans un fichier local non versionné n'est pas une livraison.
