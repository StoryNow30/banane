# Geometry Candidate V1 — réplication indépendante

Lot d'audit. Branche `lab-geometry-candidate-v1-independent-replication`.
Aucun merge, aucun changement runtime, aucun ESV, aucun retuning.

**Verdict : `INCONCLUSIVE`.**

La spec source `GEOMETRY_CANDIDATE_V1_SPEC.md` (branche
`lab-geometry-engine-next-v0-qualification`, tip `0dbcb7a`, base `0f6846f`)
n'est pas sur `StoryNow30/banane`. Le candidat a été relu depuis la consigne
du lot. La reproductibilité algorithmique vis-à-vis du lab Grok n'est donc
pas démontrable au mot près. Les gates Grok ne sont pas forcées.

---

## 1. Mode, périmètre, SHA de départ

- Mode : **audit indépendant** + implémentation hors runtime.
- Base code : `3256d8b329bfa9a9ab13a6b93f2ac78d786f9096`
  (`lab-flank-support-shadow`).
- Spec demandée : introuvable (404 sur le ref `0dbcb7a` et sur le nom de branche).
- Données déclarées : `StoryNow30/banane-data`
  `infra/materialized-native-v46-v1` `@d541686d3a98569125cdbdb261ef121c9f533d6a`.
- Données utilisées : Research Capsule RSF V1
  `infra/research-capsule-rsf-v1` `@52d4f529557641dd34d1c2296722e937c48702d0`
  (payloads extraits des mêmes archives Native ; 7z hors Git).
- Hors périmètre : `src/geometry.js`, `src/engine.js`, Brain, Pair Arbitration,
  seuils V4.6.

## 2. Contrats lus

- `src/geometry.js` SHA-256 `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53`
- `vendor/capture-core.js` SHA-256 `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054`
- Consigne de lot (A_STAR + SUPPORT_FALLBACK_15 + S1)
- Capsule `data/capsules/rsf-v1/manifest.json` : 239 = 63 + 176
- `GEOMETRY_PROTOTYPE_V1.md` — contexte, pas contrat du candidat V1

## 3. Fichiers produits (uniquement ceux-là)

| chemin | rôle |
|---|---|
| `tools/geometry-candidate-v1-independent-replication.cjs` | implémentation indépendante |
| `audit/geometry-candidate-v1-independent-replication.json` | sortie gelée |
| `tests/geometry-candidate-v1-independent-replication.test.cjs` | garde-fous d'artefact |
| `GEOMETRY_CANDIDATE_V1_INDEPENDENT_REPLICATION.md` | ce rapport |

Aucun fichier runtime modifié.

## 4. Code indépendant — lecture de la spec

Lecture **déclarée**, pas extraite d'un harness Grok.

### A_STAR

- médiane U des points du cadre local
- `replaceOrigin: false` — le nuage reste dans le repère profil
- `recenterWindow: true` — la grille coarse est centrée sur cette médiane, pas sur 0
- `searchY = 0.08`, `searchZ = 0.04`, `grid = 0.003` (DEFAULTS gelés)
- `minTop = 15`, `minFace = 6`
- raffinement ±0.004 pas 0.001 autour du coarse, comme V4.6
- primitives : `G.median`, `G.robustLine`, `G.DEFAULTS`, même loss gabarit que `propose`

### SUPPORT_FALLBACK_15

Si le min de loss raffiné a `topRows < 15`, retenir la cellule coarse de plus
faible loss qui a `topRows >= 15`, puis raffiner autour.

### S1

- `minTemplateLossRatio = 1.5` conservé (abstention V4.6 inchangée)
- intervention seulement si le gagnant A_STAR (+ fallback) n'est pas STRONG
- ensemble compétitif : `loss / Lmin <= 1.5`
- clusters à séparation `alternativeSeparation = 0.02` (DEFAULTS, pas un seuil nouveau)
- publication STRONG uniquement
- abstention si plusieurs clusters STRONG
- jamais PARTIAL / WEAK publié

**Hypothèse** — la séparation 0.02 n'est pas écrite dans la consigne ; elle
reproduit `DEFAULTS.alternativeSeparation` déjà gelé. Statut : non vérifiée
contre la spec absente.

## 5. Population

| | n |
|---|---:|
| rails assemblés | **239 / 239** |
| RSF (`cohort=failure`) | 63 |
| contrôles | 176 |
| manquants fail-closed | 0 |
| nuages inline / shards | capsule, 6 jsonl |

Source capsule = extraits des archives

- historique 34 509 008 o SHA `32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0`
- finale 56 657 500 o SHA `7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66`

Les 7z Native ne sont pas dans ce workspace (registry data, hors Git).
Fail-closed : on ne prétend pas avoir relu les 7z ; on a relu les payloads
capsule dont le manifeste ancre ces SHA.

## 6. SHA de sortie (gel avant oracle / avant confrontation Grok)

```
sha256 = 86780db9dc6aae85e2d9be58ecb1af2ff46dee6d7f19216369817f2e79a83909
covers = format, specInterpreted, population, beforeOracle, identities-status-uz-s1
generatedAt = 2026-09-17T16:11:25.308Z
```

Reproductible :

```bash
node tools/geometry-candidate-v1-independent-replication.cjs
# BANANE_CAPSULE_RAILS doit pointer sur les 6 jsonl rsf-v1
```

## 7. Résultats avant oracle

Unités : scène. Calibration physique : non vérifiée indépendamment.

### V4.6 (`G.propose` gelé, aucun option)

| | n |
|---|---:|
| RSF toujours unresolved | 63 |
| contrôles publiés | 176 |

### Candidat V1 (lecture indépendante)

| | n | gate Grok (après gel seulement) |
|---|---:|---|
| rails traités | 239 | 239/239 |
| recoveries (RSF → candidate) | **23** | 25 |
| contrôles publiés | **167** | 176/176 |
| contrôles perdus | **9** | 0 |
| PARTIAL/WEAK publiés | **0** | 0 |
| activations S1 | **0** | 4 |
| changement A_STAR (statut ou u/z) | **199** | 154 |
| responsable A_STAR | 238 | — |
| responsable SUPPORT_FALLBACK_15 | 1 | — |
| responsable S1 | 0 | — |
| STRONG avec \|u\| > 0.08 | **24** (23 recoveries + 1 contrôle) | aucun far STRONG |

Les 23 recoveries ont toutes `|u| ∈ [0.111, 0.178]`. Ce n'est pas un
déplacement de quelques millimètres dans la fenêtre d'origine : la fenêtre
recentrée sur la médiane U globale a quitté l'origine profil.

Cut **5146** (RSF) : alternative calculée (`lossRatio = 12.20`, donc hors
ensemble compétitif 1.5). Candidat unresolved pour pente limitée
(`slopeLimited`). V4.6 : `Plan de roulement non estimable.`

Cuts **102 / 103 / 105** : absents de la population 239.

S1 : 190 rails `gagnant-deja-strong`, 49 `aucun-cluster-strong`, 0 abstention
multi-cluster, 0 substitution.

## 8. Confrontation après gel (lab Grok)

Les chiffres Grok viennent de la consigne du lot, pas d'un JSON Grok versionné
sur le dépôt public (introuvable au même titre que la spec).

| gate | Grok | Loki | écart |
|---|---:|---:|---|
| 239/239 | 239 | 239 | non |
| recoveries | 25 | 23 | **−2** |
| contrôles publiés | 176 | 167 | **−9** |
| PARTIAL/WEAK | 0 | 0 | non |
| S1 | 4 | 0 | **−4** |
| changement A_STAR | 154 | 199 | **+45** |
| far STRONG | 0 | 24 (\|u\|>0.08) | **oui** |
| 5146 alternative valide | déclaré | alternative présente, ratio 12.2, non publié | lecture différente |

Aucune divergence n'a été « corrigée » pour coller.

### Lecture des écarts (hypothèses, non vérifiées)

1. **Recentage sur la médiane U de tout le cadre local** déplace la grille
   hors de `[-0.08, +0.08]`. V4.6 cherche depuis 0. Grok peut avoir pris la
   médiane **dans** la fenêtre d'origine, ou rejeté `|u| > searchY`.
   La consigne interdit tout seuil nouveau ; elle ne dit pas si le recentage
   est borné.
2. **S1 à 0** : dès que le gagnant recentré est déjà STRONG, S1 ne s'ouvre
   pas. Les 23 recoveries sont dans ce cas. Sans recentage lointain, S1
   aurait peut-être vu 4 substitutions — non mesuré, non forcé.
3. **9 contrôles perdus** : recentage + règle STRONG_ONLY. Liste :

   - `d9ccb545-25db-4262-b383-794ab3272ec7|4d8bebfa-2004-477f-9cae-0664f1bda9f0|1|6653|right`
   - `d9ccb545-25db-4262-b383-794ab3272ec7|189f0ea3-e544-4ccb-8384-ffa49fef87df|1|7902|right`
   - `92dbb85e-9534-4de6-83c5-289d3ecdf766|422d57b2-2330-433c-9db6-1fd8f1fa60ed|1|1041|left`
   - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|2221968e-80c7-4676-9d5c-05d7542b7e6a|1|2731|right`
   - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|fbb902d4-c847-4327-9565-ea6a1acd0361|1|2894|left`
   - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|left`
   - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right`
   - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|535d4fa5-1b6d-461a-aca1-838041795cef|8|9655|right`
   - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|61e3bf2a-9475-4812-9465-695a372ac88c|8|9657|right`

## 9. Oracle humain

Après gel uniquement. Unités de scène. **Non exécuté ici** : pas de visionneuse
3D dans ce workspace, interdiction d'inventer une qualification.

Rails à relire en scène (demande du lot) :

- les 23 recoveries (toutes `|u| > 0.11`)
- les 9 contrôles perdus
- cut 5146 (alternative + pente limitée)
- cut 154 (contrôle, A_STAR déjà STRONG)
- cuts 102 / 103 / 105 : hors population
- « 154 changement A_STAR » : compteur, pas un cut
- quatre interventions S1 Grok : **0** de notre côté, rien à montrer

Sans cette relecture, la qualité géométrique post-hoc reste non jugée.

## 10. Verdict — trois plans séparés

| plan | statut | pourquoi |
|---|---|---|
| Reproductibilité algorithmique vs spec écrite | **INCONCLUSIVE** | spec `0dbcb7a` absente du dépôt public |
| Reproductibilité vs gates Grok | **NOT_REPLICATED** | 23≠25, 167≠176, 0≠4 S1, 199≠154, far STRONG |
| Qualité géométrique post-hoc | **INCONCLUSIVE** | oracle scène non fait ; recoveries toutes lointaines |
| Généralisation | **non concluable** | interdiction explicite depuis les mêmes 239 rails |

Verdict de lot retenu : **`INCONCLUSIVE`**.

On ne généralise pas. On ne merge pas. On ne touche pas le runtime.

## 11. Tests

```bash
node --test tests/geometry-candidate-v1-independent-replication.test.cjs
```

8 tests : hashes gelés, spec sans retuning, population 239, baseline V4.6,
SHA sortie, 0 PARTIAL/WEAK, compteurs avant oracle, 63 identités RSF.

## 12. Limites — skill banane-engineer

- La spec demandée n'est pas un contrat versionné local. Elle a été lue
  comme consigne. C'est une **hypothèse de contrat**, étiquetée comme telle.
- Les 7z Native n'ont pas été retéléchargés. Parité RAW↔CAPSULE non
  rejouée dans ce lot.
- `clusterSeparation = 0.02` et le raffinement ±0.004 / 0.001 viennent de
  `geometry.js` gelé, pas d'une phrase de la consigne S1.
- Un test d'artefact n'est pas une preuve de justesse géométrique.
- Aucune image, aucun RMS physique, aucun calage mm.
- Interdiction respectée : pas de nouveau seuil ajouté pour « retrouver 25
  recoveries » ou « 4 S1 ».

## 13. Commandes de reproduction

```bash
git rev-parse HEAD
# base du lot :
# 3256d8b329bfa9a9ab13a6b93f2ac78d786f9096

sha256sum src/geometry.js vendor/capture-core.js
# 3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53  src/geometry.js
# 2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054  vendor/capture-core.js

BANANE_CAPSULE_RAILS=/chemin/rsf-v1/rails \
  node tools/geometry-candidate-v1-independent-replication.cjs \
  /tmp/out.json

node --test tests/geometry-candidate-v1-independent-replication.test.cjs
```

Le SHA `86780db9…` doit se retrouver si l'entrée capsule et le runtime gelé
sont identiques. `generatedAt` est hors `sha256Covers`.
