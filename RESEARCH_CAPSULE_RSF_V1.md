# Research Capsule RSF V1

Capsule de recherche **autonome et versionnée** : elle permet à un tiers
(Grok / Loki) de rejouer la population *Running Surface* sans jamais disposer
des archives `.7z` ni de `banane-data`. Aucun runtime, `geometry.js`, moteur,
Brain, Pair Arbitration, seuil ou politique n'est modifié.

## Base et provenance

- Branche : `infra/research-capsule-rsf-v1`, partie de
  `infra/research-bootstrap-v1 @ 580a2326bc15b401c6b86199b9be41f9c4018c5e`.
- Méthodologie (identification de la population **uniquement**, jamais payload) :
  `4005aa4569bd597d3b15be6bc35482a187f547a4` (Running Surface Failure Lab V1).
- Données préparées par `tools/banane-bootstrap.cjs` à partir des deux archives
  reconstituées et vérifiées fail-closed :

| archive | octets | SHA-256 |
|---|---:|---|
| `banane-native-v4.6-2026-09-16.7z` | 34 509 008 | `32e48aa7…` |
| `banane-native-v4.6-2026-09-16-final.7z` | 56 657 500 | `7cac220b…` |

`bootstrap verify` → **DATASET READY** (18 JSON historiques, 33 JSON finaux).

## Population

Exactement celle de RSF V1 : **63 échecs** `Plan de roulement non estimable.` +
**176 témoins** `engine-candidate` = **239 rails**. Répartition : 100 historique
/ 139 final ; 125 gauche / 114 droite ; 9 sessions.

Les identités viennent des artefacts RSF/CGD ; **les nuages sont relus depuis les
exports Natif bruts** préparés par le bootstrap. Jamais depuis `4005aa` JSON, les
stats RSF, les rapports MD, CGD ou `placement-lab`.

## Contenu par rail

`sessionId`, `visitIndex`, part, cut, side, identité cible exacte, état initial
exact du rail (dont `sceneRelativeToProfileLocal` et les contours),
snapshot exact (`snapshotId`), références de chunks, points LiDAR exacts dans
l'ordre des `chunkIds`, provenance (archive `historical`/`final`, fichier
source), et `payloadSha256` déterministe par rail.

## Isolation humaine (sémantique)

Aucun champ de référence humaine dans le payload : ni `humanFinalReference`,
`finalObserved`, `operatorIntent(s)`, `observedLabelCandidate`, oracle, cible
d'entraînement… Le test est **sémantique**, pas `/final/i` : le mot « final »
reste permis pour l'archive `final` et la provenance technique (prouvé par test :
`isFinalArchive`, `finalSegment`, `corpus: final-complementary` ne déclenchent
aucun faux positif).

## Structure versionnée

```
data/capsules/rsf-v1/
  manifest.json            (104 Ko)
  rails/rails-000.jsonl … rails-005.jsonl   (6 shards, JSONL UTF-8)
```

Total versionné : **33,8 Mo**, 403 436 points. Pas de `.7z`, ZIP ni blob opaque.
`.banane-data/` reste hors Git.

**Manifest** : format `banane-research-capsule-v1`, id `rsf-v1`, total 239,
63/176, SHA des deux archives, commit méthodologie `4005aa…`, commit base
`580a232…`, liste des shards (fichier/rails/octets/SHA), 239 identités +
provenance, hashes runtime gelés, et **SHA déterministe global**
`a8bb638f63e415ddf5bfede627f869a564c8af9afd68c556c2af2f943dcbdbb9`
(`generatedAt` exclu du SHA).

## CLI + API

```sh
node tools/banane-capsule.cjs verify rsf-v1
node tools/banane-capsule.cjs summary rsf-v1
node tools/banane-capsule.cjs paths rsf-v1
```

API Node : `loadRails('rsf-v1')`, `captureFromPayload(rail)`, `trace(capture,
side)`, `findHumanKeys(obj)`. Capsule absente, hash faux, shard manquant ou rail
incomplet → **échec explicite**, aucun fallback silencieux.

## Preuve de parité RAW ↔ CAPSULE

Pour chacun des 239 rails : trace depuis le RAW (bootstrap) et depuis la capsule,
même traceur, comparaison de `exit`, `sign`, points retenus, **hash déterministe
des points locaux**, ancres, coarse best, refined best, seed, template loss,
topRows, robustLine (`top`), motif moteur.

**Résultat : 239/239, 0 divergence.** `tools/_capsule-parity.cjs`.

Le traceur embarqué est identique à celui de RSF V1 (miroir du moteur gelé,
réutilise `G.median`, `G.robustLine`, `C.point`, accumulation `u += step`
préservée). Rejoué depuis la seule capsule : 63 rails sortent
`Plan de roulement non estimable.`, 176 produisent un candidat.

## Runtime gelé

`src/geometry.js` `3343330e…`, `src/engine.js` `f7d3ea22…`,
`vendor/capture-core.js` `2bc4a70b…`, `vendor/lidar.js` `375f7dfb…` — inchangés,
référencés dans le manifeste et vérifiés par test.
