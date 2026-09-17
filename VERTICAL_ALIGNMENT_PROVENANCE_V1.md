# VERTICAL ALIGNMENT PROVENANCE LAB V1

Branche: `lab-vertical-alignment-provenance-v1-richard`
Base scientifique: `infra/research-capsule-rsf-v1` @ `52d4f529557641dd34d1c2296722e937c48702d0`
Données: `StoryNow30/banane-data` @ `d541686d3a98569125cdbdb261ef121c9f533d6a` / `datasets/native-v4.6-2026-09-16`
Artefact déterministe (hors `generatedAt`): `5c024a41779665fc8ad394cfe7462e41239eaea97b0162122f3c8daafd3c1202`

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

Le z médian du contour en coordonnées profile-local est le même objet géométrique sur les 239 rails (étendue 2.9103830e-10). L’écart nuage–contour se réduit donc au z local du nuage, décalé d’une constante de gabarit. Ce n’est pas un second observable indépendant.

Médiane des médianes rail, z local indépendant: failures=-0.12671925, controls=-0.13808559, différence=0.011366343.
Médiane des médianes rail, z profile-local fourni: failures=-0.12671925, controls=-0.13808559, différence=0.011366343.
Médiane de l’écart médian nuage–contour: failures=-0.021848251, controls=-0.033214593, différence=0.011366343.
Médiane seed.z: failures=-0.043000000, controls=-0.0030000000, différence=-0.040000000.
Médiane topRows: failures=0.0000000, controls=41.500000.

40/63 failures ont un z local médian dans l’IQR des controls. Les distributions de z local se recouvrent. L’écart de médianes 0.011 n’est pas une séparation de cohortes.

Le z scène brut ne se compare pas d’un rail à l’autre (médianes 71.133750 vs 80.955812) : les origines scène diffèrent selon le site (session f938b9f8 vers ~740 unités d’origine). Après passage en profile-local, cette échelle disparaît.

Sous-groupes engine (failures, topRows de CAP.trace, contexte RSF non redémontré): topRows=0 : 55 ; topRows∈{1,2} : 8 ; topRows≥3 : 0. Séparation engine (topRows 0–2 vs ≥15) déjà établie par RSF V1 ; elle n’est pas relocalisée ici comme cause.

## Chunks

Distribution du nombre de chunks par rail: {"1":188,"2":48,"3":3}. Rails multi-chunks: 51. Médiane concaténée hors enveloppe des médianes par chunk: 0. La concaténation n’introduit pas une relation absente des chunks.

## Continuité et gauche/droite

Paires gauche/droite au même visit dans le registre: 21 (dont 2 mixtes control/failure, 1 failure/failure). Aucune paire ne partage un chunk (intersection vide) : les nuages gauche et droit sont des acquisitions distinctes. frameId, pageId et sourceFile coïncident. Déplacement d’origine médian 1.4327196 (largeur de voie observée, pas un saut de pose). Angle d’axe z constant 0.10008342 rad sur les paires mesurées.

Les déplacements d’origine entre voisins du registre atteignent >1000 unités lorsque des visites non sélectionnées s’intercalent. Ce n’est pas une trajectoire physique visit-à-visit. La continuité publiée est celle du registre 239, pas celle de la session Native complète.

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

- session 3876864f : 17 rails, 17 failures, 0 control. Presque tout à droite, cuts 5083–5106, seed.z typiquement à la borne de recherche, topRows=0. Aucun témoin interne n’est inventé.
- session d9ccb545 : 54 rails (35 failures, 19 controls), même fichier, même frame, origines ~71. Les failures occupent les visitIndex bas (0–190, essentiellement côté droit) ; les controls les visitIndex plus élevés. Témoin intra-session réel, mais pas au même visitIndex.
- session 0c58c033 : 50 rails (10 failures, 40 controls). visitIndex du registre : 0…315. Autour de 245, le registre contient 224 (failure, gap≈0, seed.z=+0.034, topRows=0), 226 (control), 231 gauche control / droite failure, 257 control. La frontière RSF à 245 n’est pas un saut de z local unique dans ce sous-ensemble.
- session 92dbb85e : 1 failure parmi 31 controls. Gap nuage–contour ≈ −0.001 (nuage presque sur le gabarit) et topRows=0, seed.z à la borne. L’écart médian nuage–contour ne prédit pas cet échec.
- cluster part 1 / right / cuts 5083–5276 : 56 rails (sessions 3876864f + d9ccb545).
- paires mixtes même visit : 0c58c033 visit 63 (gauche control topRows=43, droite failure topRows=2, gaps comparables) et visit 231 (gauche control gap≈−0.048, droite failure gap≈−0.122). Même visit, même source, nuages distincts, issues engine distinctes.

## Hypothèses A–G

- **A** — COMPATIBLE: The relative vertical relation is measured on captured scene coordinates versus the profile pose. That does not isolate the LiDAR coordinates themselves as a causal source.
- **B** — CONTREDIT: Every referenced chunk of every rail carries points that independently exhibit the scene/profile vertical relation; concatenation is not the introduction point.
- **C** — CONTREDIT: The independently inverted profileLocalToSceneRelative mapping agrees with the provided sceneRelativeToProfileLocal z on all 239 rails inside the a priori numerical envelope. The implementation of that transform does not introduce the disagreement.
- **D** — COMPATIBLE: The disagreement is observable in the scene-relative relation between the cloud and the profile pose. That is compatible with pose/cloud inconsistency without identifying which side is causal.
- **E** — COMPATIBLE: Materialized chunks and snapshots carry acquisition, capture and snapshot timestamps and recorded associationStatus. Recorded contemporaneity is not independent proof of physical association; E remains compatible, not demonstrated.
- **F** — CONTREDIT: The relative vertical cloud/profile offset is measurable at identity pose, before coarse/refined search, on all 239 rails. Engine search cannot be the sole introduction of that offset. This does not claim that the offset separates failures from controls, nor that it is the cause of the 63 unresolved rails.
- **G** — COMPATIBLE: Acquisition, pose, recorded association, upstream scene construction and calibration remain jointly compatible because they are not separable as unique physical causes.

Lecture : A et D restent ouvertes parce que le z local est une relation nuage/pose, pas un verdict sur lequel des deux est fautif. B et C sont fermées comme *points d’introduction*. F est fermée comme *introduction unique par la recherche* : l’offset existe déjà à la pose d’identité. F n’est pas une explication des 63 unresolved. E n’est pas observée : associationStatus=`same-target-and-rail-pose` sur 239/239, mêmes captureId/visitId, snapshotId = chunkId, deltas d’horloge enregistrement de l’ordre de 0–1 s et recouvrants entre cohortes. G reste le résidu non séparable (acquisition, pose, calibration, chaîne capteur→scène).

## Provenance disponible

- timestamps présents sur 239/239 rails (champs matérialisés chunk/snapshot/eligibility).
- associationStatus: {"same-target-and-rail-pose":239}.
- contradictions d’association directe: 0.
- delta médian (fin d’acquisition − snapshot.acquiredThrough) failures=0.0000000 ms, controls=0.0000000 ms.
- delta médian (capturedAt − viewObservedAt) failures=520.00000 ms, controls=437.00000 ms.
- captureId, chunkId, snapshotId, frameId, viewEpochId, sourceStatus, associationStatus sont lus lorsqu’ils existent.
- sourceStatus nuage: reference-version-and-matrix-stable-through-checkpoint (enregistré, non vérifié indépendamment).
- coordinateSystem.physicalCalibrationStatus: not-independently-verified ; units: metres-observed-not-independently-calibrated.

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

La source causale reste `unknown` rail par rail. Les données présentes ne démontrent ni un LiDAR fautif, ni une pose profil fautive, ni un décalage temporel, ni une association incorrecte, ni un snapshot incorrect, ni une transformation amont fautive. Elles ne démontrent pas non plus que l’offset nuage–gabarit à la pose d’identité *est* la cause des 63 « Plan de roulement non estimable. ».

## INDEPENDENT_REPLICATION_CONFRONTATION

Pair : `lab-vertical-alignment-provenance-replication-v1` @ `7a6555b8389ae584abef70bc757feac9940f784e` (`VERTICAL_ALIGNMENT_PROVENANCE_REPLICATION_V1.md`).
Statut : **PARTIELLEMENT CONCORDANT**.

Loki tool file at that HEAD is the literal string "see-file" (MCP truncation). Confrontation uses the published markdown and tests only. Session-level tables are not in that report.

### Différence de définition

La différence apparente SCENE_PROFILE_RELATION × 239 vs coarse-search-offset-while-local-near-plane 40/63 n’est pas une contradiction de mesure. C’est premier-stade-où-l’offset-existe vs premier-stade-où-une-séparation-de-cohorte-apparaît.

- Richard demande : premier stade où l’offset nuage/profil existe (sans seuil).
- Loki demande : premier stade où un |Δ| de cohortes dépasse 0.015, puis familles à 0.030.

### Phénomènes reproduits

- Population 63 failures + 176 controls, exit « Plan de roulement non estimable. »
- Association : 0 contradiction / 239 des deux côtés
- coarse.z médian failures -0.040000000 vs Richard -0.040000000 ; controls -0.0010000000 vs -0.0010000000
- refined.z médian failures -0.043000000 vs Richard -0.043000000 ; controls -0.0030000000 vs -0.0030000000
- Z scène − origine profil Loki (-0.12660000 / -0.14050000) ≈ z local indépendant Richard (-0.12671925 / -0.13808559)
- Calibration : metres-observed-not-independently-calibrated / not-independently-verified

### Différences méthodologiques

- Loki lit la géométrie depuis la capsule RSF ; Richard relit la vue matérialisée (parité payload 239/239, donc mêmes points si la parité tient).
- Loki n’appelle pas G.propose ; Richard observe seed/coarse/refined via CAP.trace. Les z coarse/refined publiés coïncident malgré cela.
- Loki publie un seuil 0.015 (stade) et 0.030 (familles). Richard n’en définit aucun pour localiser le premier stade.
- Loki mesure zLocalHeadWindow (fenêtre « tête »). Richard mesure la médiane du nuage visible entier et l’écart au gabarit. Ce n’est pas le même observable local.

### Différences de définition

- Richard firstObservedStage = existence de la relation nuage/pose à l’identité, sur les 239 rails.
- Loki firstStageAbove015 = premier |Δ| de médianes de cohortes ≥ 0.015. Son z local tête |Δ|=0.0136 < 0.015, puis coarse |Δ|=0.039 → coarse-search-z.
- Le |Δ| de z local indépendant Richard vaut 0.0114 < 0.015, puis |Δ| coarse 0.039. Appliquée aux différences de cohortes, la règle 0.015 de Loki désignerait aussi coarse-search comme premier stade séparateur.
- Les familles Loki 40 / 10 / 13 partitionnent les 63 failures. Richard 40/63 dans l’IQR de z local des controls est un autre cut. Les deux « 40 » ne sont pas identifiés comme les mêmes rails.

### Contradictions réelles

Aucune contradiction réelle identifiée sur les quantités publiées qui se recouvrent (coarse.z, refined.z, association 0/239, Z scène−origine ≈ z local indépendant).

Sessions 0c58c033 / d9ccb545 / 3876864f : Le rapport Loki à 7a6555b ne publie pas 0c58c033, d9ccb545, 3876864f. Pas de confrontation de grain session.

Proxy des familles Loki 0.030 appliqué à ( |gap Richard|, |coarse.z| ) : {"local-transformed-already-offset":10,"coarse-search-offset-while-local-near-plane":41,"no-large-offset":12} contre Loki 40 / 10 / 13. Proxy only. Richard gap (full-cloud median vs contour) is not Loki zLocalHeadWindow. Counts are not an identity of the same 40 rails.

Loki n’a pas publié A–G. Son tableau (local tête près du plan, gros z à coarse pour 40 failures, association 0/239) est compatible avec C CONTREDIT, E non observée, et avec F CONTREDIT au sens « la recherche n’introduit pas l’offset d’existence ». Il n’est pas une affirmation que coarse.z cause les 63 RSF.

## STATUT DU CHANTIER

**CLOSED**

Mesures indépendantes 239/239 terminées, runtime gelé, confrontation documentaire Loki faite. Les pistes moteur-critiques que ce lab peut fermer (transform, chunks, anomalie verticale globale, association manifeste) sont fermées. Le résidu est PROVENANCE_GAP hors chemin critique moteur. causalSource reste unknown. Pas de merge.

Pistes fermées comme explication principale des RSF :
- **bug scene→profile transform** — FERMÉE comme explication principale des RSF. C CONTREDIT. Inverse indépendant ≡ z fourni 239/239. Loki : |Δ| local tête 0.0136 sous le seuil 0.015.
- **bug de concaténation chunks** — FERMÉE comme explication principale des RSF. B CONTREDIT. 51 rails multi-chunks ; médiane concaténée dans l’enveloppe par chunk 51/51. Loki n’a pas testé B ; la fermeture repose sur Richard.
- **simple anomalie verticale globale** — FERMÉE comme explication principale des RSF. L’offset nuage/profil à l’identité existe des deux côtés et ne sépare pas les cohortes (40/63 failures dans l’IQR control). Loki : 40/63 already local-near-plane sous seuil 0.030.
- **association manifestement incorrecte** — FERMÉE comme explication principale des RSF. 0 contradiction d’identifiants / 239 chez Richard et chez Loki. associationStatus=same-target-and-rail-pose partout. E n’est pas OBSERVÉ.

Pistes non fermées (hors chemin critique moteur) :
- **origine physique LiDAR** — NON DÉMONTRÉE / NON TESTABLE comme cause. A COMPATIBLE. Relation nuage/pose, pas isolat capteur.
- **origine physique pose** — NON DÉMONTRÉE / NON TESTABLE comme cause. D COMPATIBLE. Non séparable du nuage.
- **chaîne capteur→scène** — PROVENANCE_GAP. sourceStatus enregistré, chaîne versionnée absente.
- **synchronisation physique des horloges** — PROVENANCE_GAP. Timestamps présents et cohérents ; pas de preuve d’horloge commune indépendante.

## Fichiers consultés

Commit banane-data: `d541686d3a98569125cdbdb261ef121c9f533d6a`. Manifest SHA-256: `1f84dbd8f18eefd2181738dc2d19b26edf58a944f1017816f45f2fc36c926a27`.
Index/sources: 9. Fichiers nuage consultés: 278.
