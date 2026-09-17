# Capsule Geometry Candidate V1

Rejeu **exact** de A_STAR + SUPPORT_FALLBACK_15 tel que gelé à `0dbcb7a`.

Ce n’est pas un lot de tuning. Le moteur n’est pas modifié. Loki n’a pas besoin des recoveries attendues.

## Commande

```
node replication/geometry-candidate-v1/run.cjs \
  --dataset /chemin/vers/datasets/native-v4.6-2026-09-16 \
  --out geometry-candidate-v1-replay.json
```

Dataset obligatoire :

- dépôt `StoryNow30/banane-data`
- branche `infra/materialized-native-v46-v1`
- commit `d541686d3a98569125cdbdb261ef121c9f533d6a`
- dossier `datasets/native-v4.6-2026-09-16`

Mémoire : `NODE_OPTIONS=--max-old-space-size=4096`.

Si la population assemblée n’est pas **239/239**, le processus sort 2.

## Contrats (pas les identités scientifiques)

```
node replication/geometry-candidate-v1/run.cjs --hash-only
node --test replication/geometry-candidate-v1/contracts.test.cjs
```

Les tests vérifient hashes, DEFAULTS, lock 239, absence d’oracle dans la sortie. Ils ne figent aucun compteur scientifique (recoveries, S1, lossRatio).

Deux SHA distincts — ne pas les confondre :

- `src/geometry.js` (lab Candidate V1) = `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503`
- `src/geometry-baseline.js` (V4.6 figé) = `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53`

Le SHA historique « geometry.js = 3343330… » est le **même blob** que `geometry-baseline.js` aujourd’hui (état `3256d8b`). Détail : `HASH_PROVENANCE.md`.

## Déterminisme

Deux exécutions sur le même dataset doivent produire le même SHA-256 du JSON.

## Contenu

| fichier | rôle |
|---|---|
| `GEOMETRY_CANDIDATE_V1_SPEC.md` | spec gelée 0dbcb7a |
| `DEFINITIONS.md` | définitions exécutables, sans paraphrase |
| `candidate-v1-config.json` | hashes et DEFAULTS |
| `run.cjs` | unique point d’entrée |
| `pinned/` | copies octet-identiques (src, vendor, tools, lock 239) |
| `contracts.test.cjs` | contrats |
| `REPLICATION_CAPSULE_MANIFEST.json` | SHA-256 de la capsule |

`pinned/` est un mini-racine : `tools/*.cjs` continue de `require('../src/geometry.js')` sans retouche.

## Interdit dans cette capsule

- listes d’identités de recoveries ou d’activations S1
- JSON de référence d’un autre agent
- oracle humain
- résultats de la validation du 17 septembre
- tout nouveau seuil
