# Candidate Generation Diagnostics V1

Lot séparé, **lecture seule**, branche `lab-candidate-generation-diagnostics-v1`,
base exacte `2be69e41cee6501fe5084f46236c42423bd33715` (Flank Support Shadow V1.1).

Aucun runtime, `src/geometry.js`, `src/engine.js`, Brain, Pair Arbitration,
seuil, DEFAULT, politique ou règle Flank Recovery. Aucun candidat ajouté.
Aucun paramètre réglé. Aucun « meilleur seuil ».

La convention `≤ 0.010` reste une **métrique d'évaluation post-hoc** en unités
de scène, jamais une cote physique ni un seuil runtime.

## Ce qui est lu

Les deux corpus du shadow V1.1 : 679 + 1 486 visites, snapshot exact, chunks
nommés, fail-closed, ingestion tolérante, corpus séparés.

| | historical-original | final-complementary |
|---|---:|---:|
| visites | **679** | **1 486** |
| sessions | 3 | 8 |
| `no-candidate` | **2** | **62** |
| `flank-only` sans candidat satisfaisant | **25** | **20** |

Session dégradée `0c58c033-f2e7-4aa5-ad8c-80b081a83932` : final uniquement.
Tranche `after-last-lossless-snapshot` descriptive seulement.

## Réponses

### 1. Pourquoi les 62 no-candidate n'ont-ils produit aucun candidat ?

Les 62 rails du corpus final s'arrêtent tous à `Plan de roulement non estimable.`
Portes 1–7 passées, recherche de gabarit lancée, `robustLine(topRows)` = null.
`metrics` non publié.

Historique : 1× même motif (1/326 right) + 1× `Intersection hors de la fenêtre expérimentale.` (8/9656 left).

### 2. Combien par étape observée ?

| étape | historique | final |
|---|---:|---:|
| `running-surface-not-estimable` | 1 | **62** |
| `intersection-outside-experimental-window` | 1 | 0 |
| portes 1–7 | 0 | 0 |

### 3. Hausse 2 → 62 concentrée ou générale ?

**Concentrée.** 3 sessions / 8 : `d9ccb545…` 35, `3876864f…` 17, `0c58c033…` 10.
Cuts part 1 adjacents 5083–5106 puis 5110–5276. Pas une cause physique démontrée.

### 4. Session dégradée ?

**10 / 62**, tous `before-last-lossless-snapshot`. **0** after-last-lossless.

### 5. Asymétrie ?

Finale : **57 right / 5 left**, 52 part 1 / 10 part 2.
`pointsSupplied` médiane 1515, comparable aux engine-candidate. Pas une capture vide.

### 6. Les 45 flank-only sans bon candidat : génération ou abstention ?

**0 / 45 n'a arrêté la génération.** Trois familles présentes. 36 / 45 : surface = seed (`faceCount = 0`).

### 7. Sous-problèmes géométriques observés (pas une rustine)

1. Plan de roulement non estimable après ROI + gabarit (63 rails).
2. Intersection hors fenêtre (1 historique, 8/9656 G).
3. Effondrement surface → seed si `faceCount = 0` (36/45).
4. Grappe part 1 / rail droit / cuts 5083–5276 (52/62).

## Reproduction

```bash
node tools/candidate-generation-diagnostics.cjs \
  --shadow audit/flank-support-shadow-v1.json \
  --output audit/candidate-generation-diagnostics-v1.json
node --test tests/candidate-generation-diagnostics.test.cjs
```

Hashes runtime inchangés (`geometry.js` `3343330e…`, `engine.js` `f7d3ea22…`).
Rien n'est mergé.
