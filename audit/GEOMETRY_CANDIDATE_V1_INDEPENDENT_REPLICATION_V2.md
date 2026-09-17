# Geometry Candidate V1 — Independent Replication V2

Retry `retry-with-frozen-data-capsule`.

Mode : **audit indépendant**. Aucun merge, aucun tuning, aucun ESV, aucun moteur / loader / runtime modifié.

**Verdict : `INCONCLUSIVE`.**

Arrêt fail-closed avant extraction data, avant replay, avant confrontation.

`stopReason` : `DATA_CAPSULE_ARCHIVE_ABSENT`.

## Capsule algorithmique — OK

- HEAD `2366d483b643bf8415f3d8ecba35938ac4c1d02e`
- candidate base `0dbcb7a32825031c122a14ffc44e13dea629d785`
- geometry `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503`
- baseline `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53`
- capture-core `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054`
- contracts.test.cjs **5/5 PASS**

## Capsule data — absente de cet environnement

Attendu : `GCV1_REPLICATION_DATASET_239_V1.7z` SHA-256 `ae7a79ac5392e8a6a8289db4652b8bedd628cdce6002ba35b0ba1ce623e05d35` (78 956 815 o), manifeste 437 fichiers.

Sondes : find local négatif ; grok-files ls / = `.tmp/ gc-v1/ gcv1-v2/` ; stat archive rc 1 ; releases GitHub tag `gcv1-replication-dataset-239-v1` 404 sur banane et banane-data ; code search 0 hit.

Aucun accès shards banane-data. Aucun loader alternatif. `run.cjs --dataset` non lancé.

## Gel

SHA-256 canonique : `4cdd04d749277e9ffce82688af10200edaba84129fd93dc225c58204e565d37e`

239/239 non mesuré. SHA run1/run2 null. Confrontation non ouverte. Oracle fermé.
