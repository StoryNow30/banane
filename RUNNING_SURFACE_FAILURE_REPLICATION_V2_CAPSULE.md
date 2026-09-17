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

SHA-256 des shards recalculés localement, égaux au manifeste.

239 payloads chargés. Scan humain : 0 fuite / 239. Lock CGD : 63/63.

Runtime gelé : geometry `3343330e…`, engine `f7d3ea22…`, capture-core `2bc4a70b…`, lidar `375f7dfb…`.

`field63Traced = 63`. `controlsTraced = 176`. Incidents 10/10, capsule 239/239, 0 divergence.

Familles exclusives : q1=56, q2=5, q3=2, q4=0, q5=0, somme 63.
Témoins capsule : 46 / 0 / 17.
Tests : 8/8.
Artefact SHA `761cd9204b6d99a1cba4e968f531369440b3be36aa341c325d9c9954c41723c7`.

Rapport détaillé : même fichier, sections Validation / Familles / Signature verticale / Témoins / Population / Limites ci-dessous et dans artifacts/pair-lab.
