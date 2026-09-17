# Geometry Candidate V1 — Independent Replication V2

Commit demandé : `final-retry-via-private-transfer-branch`.

Mode : **audit indépendant**. Aucun merge, aucun tuning, aucun ESV, aucun moteur / loader / runtime / runner modifié.

**Verdict : `REPLICATED`.**

---

## 1. Mode, périmètre, SHA de départ

Workspace de mesure : `/home/workdir/ws-gcv1-final`.

Clone algorithmique :

```
branch  infra-gcv1-replication-capsule-v1
HEAD    2366d483b643bf8415f3d8ecba35938ac4c1d02e
candidate base  0dbcb7a32825031c122a14ffc44e13dea629d785
working tree    clean (detached at origin/infra-gcv1-replication-capsule-v1)
```

Interdit et respecté : ancienne implémentation A_STAR / S1, JSON `86780db9…`, compteurs Grok antérieurs comme entrée, oracle humain comme critère de décision, modification de `run.cjs` / `geometry.js` / loader.

La confrontation n'a été ouverte **qu'après** le gel
`GEOMETRY_CANDIDATE_V1_REPLICATION_FREEZE.json` (`confrontation.status = not-opened-at-freeze`).

## 2. Contrats lus

- `replication/geometry-candidate-v1/REPLICATION_CAPSULE_MANIFEST.json`
- `replication/geometry-candidate-v1/HASH_PROVENANCE.md`
- `replication/geometry-candidate-v1/GEOMETRY_CANDIDATE_V1_SPEC.md`
- `replication/geometry-candidate-v1/candidate-v1-config.json`
- `replication/geometry-candidate-v1/run.cjs`
- `replication/geometry-candidate-v1/contracts.test.cjs`
- `replication/geometry-candidate-v1/pinned/tools/materialized-native.cjs`
- manifeste data `GCV1_REPLICATION_DATASET_239_MANIFEST.json`
- consigne Loki « FINAL RETRY — PRIVATE DATA TRANSFER »

Après gel uniquement :

- `audit/geometry-engine-next-v0-qualification.json` (Candidate V1 publié, head `bd22efc`)
- `audit/geometry-engine-next-v0.json` (lab 239+12 extras, head `9e40ad2`)

## 3. Fichiers produits (uniquement ceux-là)

| chemin | rôle |
|---|---|
| `audit/GEOMETRY_CANDIDATE_V1_INDEPENDENT_REPLICATION_V2.md` | ce rapport |
| `audit/GEOMETRY_CANDIDATE_V1_REPLICATION_FREEZE.json` | gel avant confrontation (inchangé) |
| `audit/geometry-candidate-v1-independent-replication-v2.json` | artefact de confrontation |
| `audit/geometry-candidate-v1-replay-run1.json` | sortie officielle run1 = run2 |

Aucun fichier de la capsule algorithmique modifié.

## 4. Capsule algorithmique

| contrôle | obtenu |
|---|---|
| HEAD | `2366d483b643bf8415f3d8ecba35938ac4c1d02e` |
| candidate base | `0dbcb7a32825031c122a14ffc44e13dea629d785` présent |
| `pinned/src/geometry.js` | `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503` |
| `pinned/src/geometry-baseline.js` | `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` |
| `pinned/vendor/capture-core.js` | `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054` |
| A_STAR | `e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f` |
| COMPOSITION | `0ea0824fb9e0b763d575ee95784475632f7fe2fd18e684b68e9f765106b6b27a` |
| `contracts.test.cjs` | **5/5 PASS** |

```
node replication/geometry-candidate-v1/contracts.test.cjs
# pass 5 fail 0
```

## 5. Capsule data — transfert privé

Repo `StoryNow30/banane-data`  
branche `transfer/gcv1-replication-dataset-239-v1`  
HEAD `239f36ddcc9372bc2421c65c276d4d118d86e60a`

| fichier | octets | SHA-256 |
|---|---:|---|
| `.7z.001` | 33554432 | `a29edd160b5fba48820008fed5d2db012997b52295139075a88c6180c29d1698` |
| `.7z.002` | 33554432 | `eb8d548f19e406085581e6197bf599c5db1a0c2e9df371fd7a88c343f60ab0f7` |
| `.7z.003` | 11847951 | `0df0b7e92e82e8eb4dbd52c7c94befb3bba1af61cc99e29c8bb13180188a992b` |
| manifeste | 114657 | `659a74d742b0d2d7e53aa34557aa955d3b4413e1f382ca2c3f0720d33e120619` |
| archive reconstruite | 78956815 | `ae7a79ac5392e8a6a8289db4652b8bedd628cdce6002ba35b0ba1ce623e05d35` |

Extraction vers
`/home/workdir/ws-gcv1-final/data/gcv1-replication-dataset-239-v1/datasets/native-v4.6-2026-09-16`.

Fait — 437/437 fichiers, taille et SHA-256 identiques au manifeste.  
Fait — `totalBytes = 1064696197`.

## 6. Replay officiel (deux fois, même chemin absolu)

```
NODE_OPTIONS=--max-old-space-size=4096 \
node replication/geometry-candidate-v1/run.cjs \
  --dataset /home/workdir/ws-gcv1-final/data/gcv1-replication-dataset-239-v1/datasets/native-v4.6-2026-09-16 \
  --out /home/workdir/ws-gcv1-final/out/geometry-candidate-v1-replay-run1.json
```

Run 2 : même commande, `--out …-run2.json`.

| item | valeur |
|---|---|
| assemblé | **239/239** |
| chunks | 293/293 |
| SHA run1 | `99db7e173004697755775dabce726cccae0bf97f28a6852a4cf01ab14c41c4b0` |
| SHA run2 | `99db7e173004697755775dabce726cccae0bf97f28a6852a4cf01ab14c41c4b0` |
| déterminisme | run1 == run2 |

`run.cjs` n'a pas été modifié.

## 7. Compteurs indépendants (sortie officielle seulement)

Source unique : `geometry-candidate-v1-replay-run1.json`.

| compteur | n |
|---|---:|
| lock | 239 = 63 failure + 176 control |
| v46 candidate | 176 |
| A_STAR candidate | 197 |
| NEXT candidate | 201 |
| publishedWeak | 0 |
| alreadyQualified | 197 |
| s1Activated | 42 |
| s1Changed | 4 |
| classV46Next RECOVERED | 25 |
| classV46Next UNCHANGED_UNRESOLVED | 38 |
| classV46Next UNCHANGED_GOOD | 165 |
| classV46Next MOVED | 10 |
| classV46Next DIFFERENT_CANDIDATE | 1 |
| attribution UNCHANGED / A / B / C | 201 / 34 / 2 / 2 |
| NEXT motifs candidate / flank / rsf / minTop | 201 / 29 / 8 / 1 |

Les 4 `s1Changed` :

- `5088 right` failure, A_STAR flank → NEXT candidate (attribution B)
- `5146 right` failure, A_STAR slope → NEXT candidate (attribution B)
- `2894 left` control, A_STAR flank → NEXT = V4.6 candidate (attribution C)
- `9644 right` control, A_STAR flank → NEXT = V4.6 candidate (attribution C)

0 rail `alreadyQualified` n'est déplacé par S1.

## 8. Confrontation (après gel)

Référence publiée : `audit/geometry-engine-next-v0-qualification.json`  
(head `bd22efc`, hashes geometry / A_STAR / composition identiques à la capsule).

Contrôle rail-par-rail complémentaire : les 239 clés du lock dans
`audit/geometry-engine-next-v0.json` (251 = 239 lock + 12 extras hors lock).

| test | résultat |
|---|---|
| ensemble `s1ChangedKeys` (4) | identique, 0 manquant, 0 extra |
| ensemble RECOVERED (25) | identique, mécanismes 23 A_STAR + 2 S1 |
| loss / top / face des 25 recoveries | identiques bit-à-bit au publié |
| loss / top / face des 4 S1 | identiques bit-à-bit au publié |
| loss / top / face des 13 modifiedControls | identiques bit-à-bit au publié |
| audit 5146 | V4.6 unresolved / A_STAR slope / NEXT candidate / S1 changed |
| audit 154 | S1 inactif, alreadyQualified, loss NEXT `2.8707797549213115e-06` |
| publishedWeak | 0 = 0 |
| décisions 239 vs lab `geometry-engine-next-v0.json` | **0 divergence** (status, motif, S1, class, attribution, loss/support si candidate) |

Divergences classées : **0**.

Les 12 extras `known-bad-extra` du fichier lab ne sont pas dans le lock 239 ; hors périmètre du runner officiel.

Oracle humain : lu seulement comme champ publié déjà figé dans la qualification. Aucun verdict de ce lot ne s'appuie sur une relecture humaine nouvelle.

## 9. Verdict

`REPLICATED`

Conditions exigées, toutes mesurées :

- 437/437
- 239/239
- déterminisme run1 == run2
- mêmes décisions rail par rail (239/239 vs artefact lab NEXT V0)
- mêmes activations A_STAR (197 candidats ; 25 recoveries dont 23 A_STAR)
- mêmes activations S1 (4 clés, 2 recoveries S1)

Pas une intégration runtime. Pas un merge. Pas un ESV.

## 10. Livrable demandé — état

| item | valeur |
|---|---|
| capsule HEAD | `2366d483b643bf8415f3d8ecba35938ac4c1d02e` |
| candidate base | `0dbcb7a32825031c122a14ffc44e13dea629d785` |
| transfer branch HEAD | `239f36ddcc9372bc2421c65c276d4d118d86e60a` |
| SHA archive | `ae7a79ac5392e8a6a8289db4652b8bedd628cdce6002ba35b0ba1ce623e05d35` |
| 437/437 | PASS |
| 239/239 | PASS |
| tests capsule | 5/5 |
| SHA run1 | `99db7e173004697755775dabce726cccae0bf97f28a6852a4cf01ab14c41c4b0` |
| SHA run2 | `99db7e173004697755775dabce726cccae0bf97f28a6852a4cf01ab14c41c4b0` |
| divergences | 0 |
| verdict | `REPLICATED` |
