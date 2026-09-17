# Running Surface Failure Replication V2 — exécution capsule RSF V1

Lot séparé, lecture seule. Aucun runtime modifié. Aucun seuil. Aucun merge.

Branche d’exécution : `lab-running-surface-failure-replication-v2-capsule`  
Parent / base capsule : `52d4f529557641dd34d1c2296722e937c48702d0` (`infra/research-capsule-rsf-v1`)  
Traceur V2 porté depuis : `4e7a546a1e5394686deb6c61fa691a601632554f`

Le traceur analytique est `independentTrace` de Running Surface Failure Replication V2.  
Ce n’est pas `G.propose`. Les résultats q1–q9 ne sont pas produits par le traceur embarqué de `banane-capsule.cjs`.

`captureFromPayload` sert uniquement d’adaptateur : concaténation des `chunks.points` et de `visibleByClipBoxes` dans l’ordre des `chunkRefs`, et `rails[side] = railInitialState`. Aucune métrique Running Surface n’y est calculée.

Unités de scène. Formulation verticale retenue :

> désaccord vertical relatif observé entre nuage transformé et pose/placement de profil

Aucune cause physique n’est déduite.

## Commandes

```bash
node tools/banane-capsule.cjs verify rsf-v1
node tools/banane-capsule.cjs summary rsf-v1
node tools/running-surface-failure-replication-v2.cjs \
  --output audit/running-surface-failure-replication-v2-capsule.json
node --test tests/running-surface-failure-replication-v2-capsule.test.cjs
```

## Vérification préalable

`verify rsf-v1` : `{ ok: true, rails: 239, failures: 63, controls: 176, shards: 6, deterministicSha256: a8bb638f63e415ddf5bfede627f869a564c8af9afd68c556c2af2f943dcbdbb9 }`

`summary rsf-v1` : 239 rails, 9 sessions, 403436 points, historical 100 / final 139, left 125 / right 114.

SHA-256 des shards recalculés localement, égaux au manifeste :

| shard | octets | SHA-256 |
|---|---:|---|
| rails-000.jsonl | 5 280 872 | `7253da0ad4bf63199649dfb5c90f581c1d6aeab068143b36cfd10ad25946a239` |
| rails-001.jsonl | 5 962 472 | `b32366e305cb317e75ba4731d0d9086b58a0bce042af01e60764c28a6a2e2975` |
| rails-002.jsonl | 4 968 615 | `d3cafcb430f3c74c12edc07e59ae59c491135bc3411f3b0a50edb143ccf51f4a` |
| rails-003.jsonl | 5 493 319 | `aa04d063425faaaf5006a95617a2ed9831a9a9852ffacf4e3559f4f3e8d877b6` |
| rails-004.jsonl | 6 306 525 | `e48eaeb8b3852663ec7511668699e231581b0248681ed40bcdadc6005467820a` |
| rails-005.jsonl | 5 792 640 | `765bc97479e81f599b4d4fa6fe4fd3b1a0c3af20c0713003aa96486d5aeb8936` |

239 payloads chargés. SHA de chaque payload recalculé par `loadRails`. Scan humain récursif (`HUMAN_KEYS` + filet `human|operator|oracle|truth|trainingtarget`) : **0 fuite** sur 239 rails. Le mot `final` d’archive / provenance n’est pas traité comme référence humaine.

Lock d’identité avec le CGD du dépôt : 63/63 clés `sessionId|visitId|side` identiques, 0 manquant, 0 surnuméraire.

## Runtime gelé

| fichier | SHA-256 |
|---|---|
| `src/geometry.js` | `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` |
| `src/engine.js` | `f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3` |
| `vendor/capture-core.js` | `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054` |
| `vendor/lidar.js` | `375f7dfb932143027e2c814f78bf3d66d5fbda5eb97f323735e3fd4932de6311` |

Aucun de ces fichiers n’est modifié par ce lot.

## Validation du traceur

Comparaison `independentTrace` ↔ `G.propose`, tolérance numérique préexistante `1e-12` / `1e-15`, **aucune tolérance ajoutée après observation**.

| banc | rails comparés | divergences |
|---|---:|---:|
| incidents versionnés | 10 | 0 |
| controls capsule | 176 | 0 |
| failures capsule | 63 | 0 |
| total capsule | 239 | 0 |

Sur la capsule : les 63 failures sont `unresolved` avec raison `Plan de roulement non estimable.` Les 176 controls sont `candidate`.

`field63Traced = 63`  
`controlsTraced = 176`

## Familles exclusives — 63 failures

Priorité exclusive, un rail = une famille :

1. `aucun-placement-supporté-dans-espace-exploré`
2. `support-perdu-après-raffinement`
3. `support-ailleurs-loss-supérieure`
4. `support-présent-au-best-refined`
5. `autre-observé`

| # | question | famille exclusive | n |
|---|---|---|---:|
| q1 | aucun placement exploré avec `topRows.length >= 3` | `aucun-placement-supporté-dans-espace-exploré` | **56** |
| q2 | support ailleurs, loss supérieure au placement retenu | `support-ailleurs-loss-supérieure` | **5** |
| q3 | support au coarse puis perdu après raffinement | `support-perdu-après-raffinement` | **2** |
| q4 | support au refined best | `support-présent-au-best-refined` | **0** |
| q5 | autre mécanisme observable | `autre-observé` | **0** |
| | somme | | **63** |

Motifs multi-label (non exclusifs) : none 56 ; perdu-après-raffinement 2 ; ailleurs-loss-supérieure 7 ; support-au-refined-best 0. Les 2 rails q3 portent aussi le motif « ailleurs / loss supérieure ».

Les 7 rails hors q1 :

| part/cut/côté | session | famille exclusive | topC | topR | slice |
|---|---|---|---:|---:|---|
| 1/5098/L | 3876864f | perdu-après-raffinement | 3 | 2 | hors session dégradée |
| 1/5406/L | d9ccb545 | ailleurs-loss-supérieure | 2 | 2 | hors session dégradée |
| 2/228/R | 0c58c033 | ailleurs-loss-supérieure | 2 | 1 | before-last-lossless |
| 2/742/R | 0c58c033 | ailleurs-loss-supérieure | 2 | 2 | before-last-lossless |
| 2/826/R | 0c58c033 | ailleurs-loss-supérieure | 2 | 2 | before-last-lossless |
| 2/839/R | 0c58c033 | perdu-après-raffinement | 3 | 2 | before-last-lossless |
| 2/2335/R | 0c58c033 | ailleurs-loss-supérieure | 2 | 2 | before-last-lossless |

## Signature verticale

Médianes en unités de scène.

| grandeur | 63 failures | 176 controls |
|---|---|---|
| refined best.z | min −0.044 / médiane −0.037 / max 0.034 | min −0.015 / médiane −0.003 / max 0.020 |
| médiane z du nuage local | min −0.091 / médiane 0.0069 / max 0.015 | min −0.069 / médiane −0.0067 / max 0.020 |
| zCloudMedian − best.z | min −0.125 / médiane 0.043 / max 0.057 | min −0.071 / médiane −0.0041 / max 0.0044 |
| fraction de grille `topRows >= 3` | min 0 / médiane 0 / max 0.179 | min 0.075 / médiane 0.311 / max 0.586 |
| topRows coarse | min 0 / médiane 0 / max 3 | min 14 / médiane 41 / max 137 |
| topRows refined | min 0 / médiane 0 / max 2 | min 15 / médiane 41.5 / max 137 |
| refined.z sur la borne `searchZ` | 2 | 0 |

Les 176 controls sont tous classés `support-présent-au-best-refined`.

## Témoins

Sélection **avant** toute lecture des métriques géométriques à comparer, pool = 176 controls capsule, aucun humain.

1. même session + même côté + cut le plus proche  
2. même session + même côté  
3. même côté dans une session saine (hors 3876864f et hors 0c58c033)

Effectifs obtenus : **46 / 0 / 17**, 0 non apparié, 14 témoins distincts.  
Les 17 failures de la session 3876864f n’ont aucun control dans cette session → palier 3.

Ce 46 / 0 / 17 est un résultat mesuré sur la capsule, pas une cible de réglage.

## Population

Failures : right 58 / left 5 ; final 62 / historical 1.  
Controls : left 120 / right 56 ; final 77 / historical 99.

Signe observé : failures `right:-1` = 58, `left:+1` = 5 ; controls `left:+1` = 120, `right:-1` = 56. Aucun bug miroir n’est affirmé.

Sessions failures : `d9ccb545` 35, `3876864f` 17, `0c58c033` 10, `92dbb85e` 1.

Session `3876864f` : 17 failures, 0 control.

Session `0c58c033` (frontière lossless verrouillée visitIndex 245, source Flank Support Shadow V1.1) :

- failures : 10, toutes `visitIndex < 245` (before-last-lossless), 0 en queue dégradée ;
- controls : 40 = 34 avant frontière + 6 en queue.

Grappe part 1 / droite / cuts 5083–5276 : **50 / 50** tracés, sessions `3876864f` + `d9ccb545`, archive final, famille exclusive unique `aucun-placement-supporté-dans-espace-exploré`.

## Tests

`node --test tests/running-surface-failure-replication-v2-capsule.test.cjs` : **8 / 8**.

Couverture : hashes gelés, traceur ≠ `propose`, capsule 239/63/176 + SHA, incidents 10/10, lock CGD, témoins sans humain, 63+176 tracés, familles exclusives somme 63, clés humaines absentes des blocs `HUMAN_FREE`.

Aucune assertion n’impose un compteur de famille particulier autre que la somme exclusive = 63.

## Artefact

`audit/running-surface-failure-replication-v2-capsule.json`  
SHA déterministe (`sha256Covers`, `generatedAt` exclu) :

`761cd9204b6d99a1cba4e968f531369440b3be36aa341c325d9c9954c41723c7`

Chaque failure publie identité, famille, motifs, coarse/refined, best.z, médiane z nuage, delta vertical relatif, fraction de grille supportée, nearest supported placement, session / côté / contexte de dégradation.

## Limites

- Parité RAW ↔ capsule non rejouée ici : les archives `.7z` ne sont pas dans ce clone. La capsule est la source des 239 payloads.
- `loadRails` est utilisé comme chargeur ; le SHA de payload et le scan humain sont ceux de la capsule + un rescan local.
- Frontière 0c58c033 visitIndex 245 : fait de projet déjà verrouillé (ombre V1.1), pas un seuil choisi dans ce lot.
- Les familles exclusives suivent l’ordre publié ci-dessus. Un rail q3 peut aussi porter le motif « ailleurs / loss supérieure ».
- Aucune comparaison n’est faite dans ce rapport avec un autre lot Running Surface.
