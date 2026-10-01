# Pair Lab V1

Banc hors ligne. Il mesure une grandeur de **paire**, parce que le contrôle
rail par rail a manqué le défaut vu à l’œil sur le cut 6/9480.

## Grandeurs — pas de repli silencieux

Deux métriques distinctes. L’une n’est jamais substituée à l’autre.

| nom | champ lu | rôle |
|---|---|---|
| `pairProfileOriginDistance` | `profileOriginSceneRelative` uniquement | **canonique** |
| `pairRailPositionDistance` | `positionSceneRelative` uniquement | secondaire |

Si le champ canonique manque, la mesure canonique vaut `unavailable`
(`profileOriginSceneRelative-missing`). Aucun fallback.

Ce n’est **pas** l’écartement ESV. Les unités sont des unités de scène. Le
facteur ×10³ est une échelle d’affichage. Aucune cible, y compris 1436.
Aucun seuil, aucun SKIP, aucun entraînement, aucune commande ESV.

## Séries

| série | source |
|---|---|
| `initial` | origines avant geste |
| `human` | origines après correction humaine |
| `engineFrozen` | deltas du moteur **gelé** (`src/geometry.js`) appliqués aux poses initiales |
| `brainOfflineReplayV1Forced` | post-traitement V1 hors ligne, cerveau **forcé** actif, paramètres `AJUSTE` |

`brainOfflineReplayV1Forced` n’est **pas** le comportement runtime : au
runtime le cerveau est éteint par défaut et la sélection peut être coupée.
Le banc appelle `geometry-brain.js` avec `actif: true` et les mêmes
paramètres uniquement dans un test d’identité.

La correction humaine n’entre jamais dans l’entrée du moteur.

## Témoin obligatoire — part 6 / cut 9480

Statut : `reported-not-replayed`. La formule Pair Lab **ne prétend pas**
reproduire ces trois chiffres tant que les origines brutes manquent.

| source | valeur rapportée ×10³ |
|---|---:|
| initial ESV | 1499,93 |
| Banane observée | 1517,73 |
| moteur gelé | 1518,19 |

## Couverture par source

Pour `banane-corrections-session-v4` :

- jointure `record.lidarCaptureId → cloud.captureId`, sinon `visitId` ;
- si une capture LiDAR est jointe : rejeu `Geometry.proposeBoth` sur
  l’initial + le nuage, jamais sur `corrected` ;
- si le LiDAR manque : `engineFrozen` et `brainOfflineReplayV1Forced`
  restent `unavailable`.

Pour `banane-offline-evaluation-v1` : les propositions déjà stockées sont
relues telles quelles.

## Associations descriptives

Pas un « pouvoir prédictif ».

Descripteurs calculables **avant** la finale humaine :

- variation de paire initial → moteur ;
- valeur absolue de cette variation.

L’erreur finale n’entre ensuite que comme comparateur (Pearson si n ≥ 3,
sinon `null`). Aucun seuil.

## Reproduire

```bash
node --test tests/pair-lab.test.cjs tests/pair-lab.integration.test.cjs

node tools/pair-lab.cjs \
  --out audit/pair-lab-v1.json \
  --markdown audit/pair-lab-v1.md

node tools/pair-lab.cjs \
  datasets/automatic/offline-evaluation-v4.3.0.json \
  --out audit/pair-lab-v1.json \
  --markdown audit/pair-lab-v1.md
```

Les JSON de corrections parts 17 et 20 seront passés au banc **après** cette
correction de méthodologie.

## Hors périmètre V1

- lire l’écartement affiché par ESV (`KI-001`) ;
- brancher une contrainte de paire dans le moteur ou le cerveau ;
- régler quoi que ce soit sur le jeu réservé 9031–9047 ;
- appeler les unités de scène des millimètres ;
- prétendre que la formule courante reproduit le témoin 6/9480.
