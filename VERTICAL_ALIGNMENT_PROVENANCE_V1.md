# VERTICAL ALIGNMENT PROVENANCE LAB V1

Branche: `lab-vertical-alignment-provenance-v1-richard`
Base scientifique: `infra/research-capsule-rsf-v1` @ `52d4f529557641dd34d1c2296722e937c48702d0`
Données: `StoryNow30/banane-data` @ `d541686d3a98569125cdbdb261ef121c9f533d6a` / `datasets/native-v4.6-2026-09-16`
Artefact déterministe (hors `generatedAt`): `ae1331eeb9a540896ef4f4059ede592f912d2da65ce5aca36fc9293a27bb9c0a`

## Portée

239 rails: 63 failures (« Plan de roulement non estimable. ») et 176 controls.
La capsule RSF V1 est le registre d’identités. Toutes les poses, matrices, chunks et timestamps mesurés sont relus de la vue matérialisée. Aucun humain, aucun correctif moteur, aucun tuning, aucun millimètre.

Parité payload matérialisé ↔ capsule: **239 / 239** (mismatches=0).

## Runtime gelé

- `src/geometry.js`: `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` match=true
- `src/engine.js`: `f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3` match=true
- `vendor/capture-core.js`: `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054` match=true
- `vendor/lidar.js`: `375f7dfb932143027e2c814f78bf3d66d5fbda5eb97f323735e3fd4932de6311` match=true

## Tolérances numériques (a priori)

```json
{
  "affine": 1e-12,
  "orthogonality": 1e-10,
  "unitScale": 1e-10,
  "inversePivotFactor": 128,
  "floatingPointEnvelopeFactor": 128,
  "matrixAgreement": 1e-9
}
```

## Audit de transformation

Projection indépendante (inverse affine de `profileLocalToSceneRelative`) équivalente au z fourni par `sceneRelativeToProfileLocal`: **239/239**.

La projection indépendante n’appelle pas `C.point`. Si shear ou échelle non unitaire existent, le z local est la 3e composante de l’inverse, pas un produit scalaire sur un axe normalisé.

## Premier stade observable

- `SCENE_PROFILE_RELATION`: 239

## Formulation scientifique supportée

Le désaccord vertical relatif préexiste au calcul des coordonnées profile-local et n’est pas introduit par l’implémentation de cette transformation.

Cela ne démontre toujours pas: LiDAR fautif, pose fautive, snapshot fautif, association fautive, timing fautif, transformation amont fautive.

## Failures vs controls

Médiane des médianes rail, z local indépendant: failures=-0.12671925, controls=-0.13808559, différence=0.011366343.
Médiane des médianes rail, z profile-local fourni: failures=-0.12671925, controls=-0.13808559, différence=0.011366343.
Médiane de l’écart médian nuage–contour: failures=-0.021848251, controls=-0.033214593, différence=0.011366343.
Médiane seed.z: failures=-0.043000000, controls=-0.0030000000, différence=-0.040000000.
Médiane topRows: failures=0.0000000, controls=41.500000.

Sous-groupes engine (failures, topRows, contexte RSF non redémontré): topRows<3 = 63, topRows≥3 = 0.

## Chunks

Distribution du nombre de chunks par rail: {"1":188,"2":48,"3":3}. Les statistiques par chunk sont calculées avant concaténation. Aucun seuil d’anomalie n’est défini.

## Continuité et gauche/droite

Paires gauche/droite au même visit dans le registre: 21. Les contextes rail-par-rail publient origine, angles d’axes, delta de matrice, sources/chunks et deltas de distributions. La continuité est limitée aux visites présentes dans ces 239 rails.

## Sessions

- `79d9a4ae-4c1e-4a41-8346-22d9fad681e1`: failures=0, controls=2
- `ba703239-af3c-48eb-b830-c31e821bd730`: failures=0, controls=11
- `3876864f-a864-4678-b7b0-3feecc4af418`: failures=17, controls=0
- `d9ccb545-25db-4262-b383-794ab3272ec7`: failures=35, controls=19
- `0c58c033-f2e7-4aa5-ad8c-80b081a83932`: failures=10, controls=40
- `d740630a-819c-489e-9c5e-f5a51e62e77a`: failures=0, controls=5
- `92dbb85e-9534-4de6-83c5-289d3ecdf766`: failures=1, controls=31
- `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f`: failures=0, controls=26
- `f938b9f8-e2d7-47c6-bb08-5b00f3debe05`: failures=0, controls=42

## Cas de contrôle

- session 3876864f… : 17 rails in register (failures=17, controls=0). No internal control is invented.
- session d9ccb545… : 54 rails.
- session 0c58c033…: 50 rails in the 239-register; visitIndex values are published numerically (no jump threshold). The degradation boundary cited at visitIndex 245 is a frozen RSF context; the register’s nearest selected visits are listed in the JSON.
- cluster part 1 / right / cuts 5083–5276: 56 rails.

## Hypothèses A–G

- **A** — COMPATIBLE: The relative vertical relation is measured on captured scene coordinates versus the profile pose. That does not isolate the LiDAR coordinates themselves as a causal source.
- **B** — CONTREDIT: Every referenced chunk of every rail carries points that independently exhibit the scene/profile vertical relation; concatenation is not the introduction point.
- **C** — CONTREDIT: The independently inverted profileLocalToSceneRelative mapping agrees with the provided sceneRelativeToProfileLocal z on all 239 rails inside the a priori numerical envelope. The implementation of that transform does not introduce the disagreement.
- **D** — COMPATIBLE: The disagreement is observable in the scene-relative relation between the cloud and the profile pose. That is compatible with pose/cloud inconsistency without identifying which side is causal.
- **E** — COMPATIBLE: Materialized chunks and snapshots carry acquisition, capture and snapshot timestamps and recorded associationStatus. Recorded contemporaneity is not independent proof of physical association; E remains compatible, not demonstrated.
- **F** — CONTREDIT: The relative vertical relation, and the failure/control separation in that relation, are observable before coarse/refined search. Engine search cannot be its sole introduction point.
- **G** — COMPATIBLE: Acquisition, pose, recorded association, upstream scene construction and calibration remain jointly compatible because they are not separable as unique physical causes.

## Provenance disponible

- timestamps présents sur 239/239 rails (champs matérialisés chunk/snapshot/eligibility).
- contradictions d’association directe: 0.
- captureId, chunkId, snapshotId, frameId, viewEpochId, sourceStatus, associationStatus sont lus lorsqu’ils existent.

## PROVENANCE_GAP

Recorded timestamps and associationStatus exist on the materialized chunks and snapshots, so a raw absence of time fields is not the gap. The remaining gap is the lack of an independent physical binding between LiDAR acquisition, profile pose, and the upstream scene transform. Causal source therefore stays unknown.

Champs encore insuffisants pour une cause physique:
- independent verification that recorded acquisition clocks and pose clocks share a physical time base
- upstream sensor-to-scene transform chain with version and timestamp (beyond the recorded sourceStatus claim)
- independent physical calibration of scene units (coordinateSystem.physicalCalibrationStatus is not-independently-verified)

Instrumentation minimale à ajouter lors d’une future collecte Native:
- Persist an explicit association event {lidarAcquisitionId, poseStateId, sharedClockTimestamp, transformChainVersion} at collection time
- Persist the sensor-to-scene transform chain (matrices + versions + timestamps), not only the scene-relative cloud
- Persist a pose-state timestamp distinct from export storedAt
- Record an independently verified unit/calibration status rather than metres-observed-not-independently-calibrated

## Causes non démontrées

La source causale reste `unknown` rail par rail. Les données présentes ne démontrent ni un LiDAR fautif, ni une pose profil fautive, ni un décalage temporel, ni une association incorrecte, ni un snapshot incorrect, ni une transformation amont fautive.

## Fichiers consultés

Commit banane-data: `d541686d3a98569125cdbdb261ef121c9f533d6a`. Manifest SHA-256: `1f84dbd8f18eefd2181738dc2d19b26edf58a944f1017816f45f2fc36c926a27`.
Index/sources: 9. Fichiers nuage consultés: 278.
