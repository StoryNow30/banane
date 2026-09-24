# Rapport d’acceptation — lots Pilote

Règles : faux si latéral OU vertical, valeurs brutes (D-038) au-delà de 10 mm ; dénominateur : cuts DISTINCTS du lot ; sans entrée, différés, refusés, sans décision au dénominateur ; revisite ≠ nouveau cut ; référence : dernière visite validée de la relecture, règles strictes referenceFor ; lue après coup, jamais en entrée moteur ; unités : unités de scène × 1000 (mm), étalonnage physique non vérifié ; écartement : [1405, 1470] mm, admissibilité seulement.

## Lot « pilote-p19-4.7.6 »

Version 4.7.6 · lot c6e24847-cf33-4429-9da1-abb1d2386a79 (STOPPED), partie 19, cuts 9019–9408, politique « defer ».
Relecture : 3 segment(s), 174 visites, nuages déclarés tous présents : oui. Repère : frameId différent (Pilote fcb5a152-1cb4-474d-8f25-bb1aaf132304 ; relecture 53b71338-d711-4130-878b-a527605453b6), translation [737962.3069,6762384.6692,86.8741] vérifiée sur 29/29 cuts ; utilisable : oui.
Décision sur le lot : REJOUÉE hors ligne (corpus + diagnostic), pas une observation terrain.
Contrôle journal : 15 traités et 14 différés au journal ; 15 appliqués et 14 différés (refus d’écartement et absence de points compris) recalculés.

| Cut | Pilote | Motifs | Écartement mm | Relecture | Pire erreur mm | Décision sur le lot |
|---|---|---|---|---|---|---|
| 9019 | applied |  | 1437,7 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9033 (exclu) | applied |  | 1428,1 | — | — | first-pass |
| 9036 | applied |  | 1436,3 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9043 | applied |  | 1437,6 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9044 | deferred | left:ambiguity | — | jugé (visite 25) | départ 46,79 | choice · 2,81 mm |
| 9045 | applied |  | 1434,6 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9046 | applied |  | 1434,2 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9047 | applied |  | 1454,1 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9048 | deferred | left:ambiguity | — | jugé (visite 29) | départ 45,28 | deferred |
| 9049 | gauge-rejected | left:gauge-out-of-contract right:gauge-out-of-contract | 1305,6 | jugé (visite 30) | départ 45,36 | deferred |
| 9050 | deferred | left:ambiguity | — | référence-non-stricte left:human-final-candidate-missing right:human-final-candidate-missing | — | deferred |
| 9051 | applied |  | 1433,1 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9052 | gauge-rejected | left:gauge-out-of-contract right:gauge-out-of-contract | 1286,1 | référence-non-stricte left:multi-intent-reference-ambiguous right:multi-intent-reference-ambiguous | — | window |
| 9218 | gauge-rejected | left:gauge-out-of-contract right:gauge-out-of-contract | 1304,9 | jugé (visite 34) | départ 43,35 | deferred |
| 9220 | deferred | left:ambiguity | — | jugé (visite 36) | départ 39,24 | deferred |
| 9221 | applied |  | 1436,7 | jugé (visite 37) | 0 | first-pass · 0,47 mm |
| 9229 | applied |  | 1434,7 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9230 | applied |  | 1433,2 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9231 | applied |  | 1434,7 | référence-non-stricte left:human-final-candidate-missing right:human-final-candidate-missing | — | first-pass |
| 9234 | applied |  | 1442,2 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9235 | applied |  | 1437,2 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9241 (exclu) | deferred | right:ambiguity | — | — | — | deferred |
| 9242 | gauge-rejected | left:gauge-out-of-contract right:gauge-out-of-contract | 1311,4 | jugé (visite 58) | départ 35,67 | deferred |
| 9315 | deferred | right:ambiguity | — | jugé (visite 97) | départ 33,21 | deferred |
| 9316 | deferred | right:ambiguity | — | jugé (visite 98) | départ 36,95 | deferred |
| 9317 | gauge-rejected | left:gauge-out-of-contract right:gauge-out-of-contract | 1470,8 | référence-non-stricte left:multi-intent-reference-ambiguous right:multi-intent-reference-ambiguous | — | deferred |
| 9344 | applied |  | 1436,2 | relu-sans-validation (pose inchangée) | — | first-pass |
| 9405 | deferred | left:flank right:minTop | — | relu-sans-validation (pose inchangée) | — | deferred |
| 9406 | no-input — différé-sans-point-lidar | left:input right:input | — | relu-sans-validation (pose inchangée) | — | deferred |
| 9407 | other — atteint-sans-décision:lot-arrêté-sur-ce-cut |  | — | pose-du-pilote-inconnue | — | — |

## Par partie

### Partie 19 — non déclaré (aucune configuration) (lots : pilote-p19-4.7.6)

C1 à C4 sont rapportés ensemble ; C1 seul n’est pas un résultat (§14 G).

**Lot incomplet** (pilote-p19-4.7.6 : STOPPED) : C1 est rapporté, mais ne compte pas pour l’objectif, fixé sur des lots complets (D-038).

| Critère | Mesure |
|---|---|
| C1 — couverture | **14 appliqués / 28 cuts distincts = 50 %** · différés 7 · refusés par l’écartement 5 · sans entrée 1 · autres 1 · cuts revisités 0 (comptés une fois) |
| C4 — faux | **non évaluable** : 7,1 % des appliqués jugés, seuil 80 % · **0 faux sur 1 appliqués jugés** (latéral OU vertical > 10 mm, valeurs brutes) · appliqués non jugés : 13 |
| C2 — erreur des rails appliqués jugés (2 rails), médiane / p90 | latéral 0 / 0 (max 0) mm · vertical 0 / 0 (max 0) mm · plancher : P2 non mesuré |
| C3 — paires hors contrat | refusées pendant le lot : 5 (9049 : 1305,6 mm LOW_INVALID ; 9052 : 1286,1 mm LOW_INVALID ; 9218 : 1304,9 mm LOW_INVALID ; 9242 : 1311,4 mm LOW_INVALID ; 9317 : 1470,8 mm HIGH_INVALID) · appliquées hors contrat : **0** |
| Décision sur le lot | 16 appliqués / 28 = 57,1 % · **0 faux sur 2 jugés** · faux que le Pilote n’a pas faits : aucun · gagnés : 9044, 9052 · perdus : aucun |

Sans entrée ou sans décision : 9406 (différé-sans-point-lidar), 9407 (atteint-sans-décision:lot-arrêté-sur-ce-cut).

Non jugeables : relu-sans-validation — 14 cuts dont 12 appliqués (9019, 9036, 9043, 9045, 9046, 9047, 9051, 9229, 9230, 9234, 9235, 9344, 9405, 9406) ; référence-non-stricte — 4 cuts dont 1 appliqués (9050, 9052, 9231, 9317) ; pose-du-pilote-inconnue — 1 cuts dont 0 appliqués (9407).

Différés relus : écart entre la pose de départ et la pose humaine (pire rail, mm) : 9044 : 46,79 ; 9048 : 45,28 ; 9049 : 45,36 ; 9218 : 43,35 ; 9220 : 39,24 ; 9242 : 35,67 ; 9315 : 33,21 ; 9316 : 36,95.

Exclus, comptés à part : 9033 (applied) — demande de l’opérateur : référence humaine fondée sur une information absente des données ; 9241 (deferred) — demande de l’opérateur : référence humaine fondée sur une information absente des données.

## Total

### Toutes parties

C1 à C4 sont rapportés ensemble ; C1 seul n’est pas un résultat (§14 G).

**Lot incomplet** (pilote-p19-4.7.6 : STOPPED) : C1 est rapporté, mais ne compte pas pour l’objectif, fixé sur des lots complets (D-038).

| Critère | Mesure |
|---|---|
| C1 — couverture | **14 appliqués / 28 cuts distincts = 50 %** · différés 7 · refusés par l’écartement 5 · sans entrée 1 · autres 1 · cuts revisités 0 (comptés une fois) |
| C4 — faux | **non évaluable** : 7,1 % des appliqués jugés, seuil 80 % · **0 faux sur 1 appliqués jugés** (latéral OU vertical > 10 mm, valeurs brutes) · appliqués non jugés : 13 |
| C2 — erreur des rails appliqués jugés (2 rails), médiane / p90 | latéral 0 / 0 (max 0) mm · vertical 0 / 0 (max 0) mm · plancher : P2 non mesuré |
| C3 — paires hors contrat | refusées pendant le lot : 5 (9049 : 1305,6 mm LOW_INVALID ; 9052 : 1286,1 mm LOW_INVALID ; 9218 : 1304,9 mm LOW_INVALID ; 9242 : 1311,4 mm LOW_INVALID ; 9317 : 1470,8 mm HIGH_INVALID) · appliquées hors contrat : **0** |
| Décision sur le lot | 16 appliqués / 28 = 57,1 % · **0 faux sur 2 jugés** · faux que le Pilote n’a pas faits : aucun · gagnés : 9044, 9052 · perdus : aucun |

Sans entrée ou sans décision : 9406 (différé-sans-point-lidar), 9407 (atteint-sans-décision:lot-arrêté-sur-ce-cut).

Non jugeables : relu-sans-validation — 14 cuts dont 12 appliqués (9019, 9036, 9043, 9045, 9046, 9047, 9051, 9229, 9230, 9234, 9235, 9344, 9405, 9406) ; référence-non-stricte — 4 cuts dont 1 appliqués (9050, 9052, 9231, 9317) ; pose-du-pilote-inconnue — 1 cuts dont 0 appliqués (9407).

Différés relus : écart entre la pose de départ et la pose humaine (pire rail, mm) : 9044 : 46,79 ; 9048 : 45,28 ; 9049 : 45,36 ; 9218 : 43,35 ; 9220 : 39,24 ; 9242 : 35,67 ; 9315 : 33,21 ; 9316 : 36,95.

Exclus, comptés à part : 9033 (applied) — demande de l’opérateur : référence humaine fondée sur une information absente des données ; 9241 (deferred) — demande de l’opérateur : référence humaine fondée sur une information absente des données.

