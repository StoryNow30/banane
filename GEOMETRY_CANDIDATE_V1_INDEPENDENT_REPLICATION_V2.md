# Geometry Candidate V1 — Independent Replication V2

Commit documentaire : `finalize-gcv1-independent-replication-v2-audit-package`.

Mode : **audit indépendant**. Aucun merge, aucun tuning, aucun ESV, aucun moteur / loader / runtime / runner modifié.

**Verdict final : `REPLICATED`.**

---

## 1. Mode, périmètre, SHA de départ

Workspace de mesure : `/home/workdir/ws-gcv1-final`.

Clone algorithmique :

```
branch  infra-gcv1-replication-capsule-v1
HEAD    2366d483b643bf8415f3d8ecba35938ac4c1d02e
candidate base  0dbcb7a32825031c122a14ffc44e13dea629d785
```

Interdit et respecté : ancienne implémentation A_STAR / S1, JSON `86780db9…`, compteurs Grok antérieurs comme entrée, oracle humain comme critère de décision, modification de `run.cjs` / `geometry.js` / loader.

La confrontation n'a été ouverte **qu'après** le gel
`GEOMETRY_CANDIDATE_V1_REPLICATION_FREEZE.json`
(`confrontation.status = not-opened-at-freeze`, `frozenAt = 2026-09-17T19:33:30Z`).

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

## 3. Fichiers du paquet (cohérents)

| chemin | rôle |
|---|---|
| `GEOMETRY_CANDIDATE_V1_INDEPENDENT_REPLICATION_V2.md` | ce rapport (racine) |
| `audit/GEOMETRY_CANDIDATE_V1_INDEPENDENT_REPLICATION_V2.md` | même rapport |
| `GEOMETRY_CANDIDATE_V1_REPLICATION_FREEZE.json` | gel pré-confrontation (racine) |
| `audit/GEOMETRY_CANDIDATE_V1_REPLICATION_FREEZE.json` | même gel |
| `audit/geometry-candidate-v1-independent-replication-v2.json` | artefact de confrontation |

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

## 5. Capsule data — transfert privé

Repo `StoryNow30/banane-data`  
branche `transfer/gcv1-replication-dataset-239-v1`  
HEAD `239f36ddcc9372bc2421c65c276d4d118d86e60a`

| fichier | octets | SHA-256 |
|---|---:|---|
| archive reconstruite | 78956815 | `ae7a79ac5392e8a6a8289db4652b8bedd628cdce6002ba35b0ba1ce623e05d35` |

Fait — **437/437 PASS**. `totalBytes = 1064696197`.

## 6. Replay officiel (deux fois, même chemin absolu)

Runner : `replication/geometry-candidate-v1/run.cjs` — non modifié.

| item | valeur |
|---|---|
| assemblé | **239/239** |
| chunks | 293/293 |
| SHA run1 | `99db7e173004697755775dabce726cccae0bf97f28a6852a4cf01ab14c41c4b0` |
| SHA run2 | `99db7e173004697755775dabce726cccae0bf97f28a6852a4cf01ab14c41c4b0` |
| déterminisme | run1 == run2 |

## 7. Compteurs indépendants (sortie officielle seulement)

Source unique : replay officiel SHA `99db7e17…`.

| compteur | n |
|---|---:|
| lock | 239 = 63 failure + 176 control |
| v46 candidate | 176 |
| A_STAR candidate | 197 |
| NEXT candidate | 201 |
| publishedWeak | 0 |
| alreadyQualified | 197 |
| S1 evaluated / activated (`s1Activated`) | **42** |
| S1 réellement changed (`s1Changed`) | **4** |
| recoveries classV46Next | **25 = 23 A_STAR + 2 S1** |
| classV46Next UNCHANGED_UNRESOLVED | 38 |

Les deux nombres S1 ne se confondent pas : 42 rails ont activé l'évaluation S1 ; 4 rails seulement ont changé de publication.

## 8. Gel pré-confrontation

Fichier conservé tel quel (pas reconstruit après coup).

- `frozenAt` : `2026-09-17T19:33:30Z`
- SHA-256 fichier : `083060a0ffd02683fb6f9e945cc12ddc7a132ccd0f9b740cdd146cf940269887`
- `confrontation.status` : `not-opened-at-freeze`
- `verdictAtFreeze` : `pending-confrontation`
- `noHumanOracle` : true
- run1 = run2 = `99db7e173004697755775dabce726cccae0bf97f28a6852a4cf01ab14c41c4b0`
- 437/437 et 239/239 déjà mesurés dans le gel

Preuve d'antériorité : le gel porte `not-opened-at-freeze` et `pending-confrontation`. La confrontation rail-par-rail n'apparaît que dans l'artefact JSON et ce rapport, rédigés ensuite.

## 9. Confrontation (après gel)

Référence publiée : `audit/geometry-engine-next-v0-qualification.json` (head `bd22efc`).

Contrôle 239 clés lock dans `audit/geometry-engine-next-v0.json` (251 = 239 + 12 extras hors lock).

| test | résultat |
|---|---|
| ensemble `s1ChangedKeys` (4) | identique |
| ensemble RECOVERED (25) | identique, 23 A_STAR + 2 S1 |
| loss / top / face recoveries, S1 four, modifiedControls | identiques |
| audits 5146 et 154 | identiques |
| publishedWeak | 0 = 0 |
| décisions 239 vs lab NEXT V0 | **0 divergence** |

Divergences classées : **0**.

Oracle humain : fermé jusqu'au verdict algorithmique. Aucune relecture humaine nouvelle.

## 10. Verdict

`REPLICATED`

- 437/437 PASS
- 239/239 PASS
- déterminisme run1 == run2
- mêmes décisions rail par rail
- mêmes activations A_STAR
- mêmes activations S1 (4 changed)

Pas une intégration runtime. Pas un merge. Pas un ESV.

## 11. Historique des arrêts antérieurs (non final)

Les arrêts `INCONCLUSIVE` suivants restent dans l'historique Git uniquement. Ils ne sont plus l'état FINAL.

| commit | stopReason historique |
|---|---|
| `8364319` | capsule 2366d48 unresolved |
| `6ab2095` / `a3869c8` | freeze / rows vides |
| `5795cbe` | `DATASET_NOT_FULLY_MATERIALIZED_LOCALLY` |
| `704afec` | `DATA_CAPSULE_ARCHIVE_ABSENT` |
| racine avant ce commit | copies `INCONCLUSIVE` / `CAPSULE_REF_UNRESOLVED` |

## 12. Livrable — état FINAL

| item | valeur |
|---|---|
| capsule HEAD | `2366d483b643bf8415f3d8ecba35938ac4c1d02e` |
| candidate base | `0dbcb7a32825031c122a14ffc44e13dea629d785` |
| transfer HEAD | `239f36ddcc9372bc2421c65c276d4d118d86e60a` |
| SHA archive | `ae7a79ac5392e8a6a8289db4652b8bedd628cdce6002ba35b0ba1ce623e05d35` |
| 437/437 | PASS |
| 239/239 | PASS |
| tests capsule | 5/5 |
| SHA run1 = run2 | `99db7e173004697755775dabce726cccae0bf97f28a6852a4cf01ab14c41c4b0` |
| SHA freeze fichier | `083060a0ffd02683fb6f9e945cc12ddc7a132ccd0f9b740cdd146cf940269887` |
| divergences | 0 |
| verdict | `REPLICATED` |
