# Geometry Engine Next V0 — Qualification

Lot **EXPÉRIMENTAL**. Branche `lab-geometry-engine-next-v0-qualification`. Aucun merge. Moteur inchangé.

- HEAD : `bd22efc`
- Base : `0f6846f` (lab NEXT V0 `9e40ad2`)
- Commande : `node tools/geometry-engine-next-v0-qualification.cjs`
- Tests : `node tests/geometry-engine-next-v0-qualification.test.cjs`

**Verdict : `PROMOTE_TO_GEOMETRY_CANDIDATE_V1`.**

- Aucun bloqueur dur.
- Limites : pas de vrai holdout

## Parité

| | |
|---|---|
| 239/239 | **oui** |
| mismatches | **0** |
| S1 keys | 5088, 5146, 2894, 9644 |
| hashes A_STAR / composition | `e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f` / `0ea0824fb9e0b763d575ee95784475632f7fe2fd18e684b68e9f765106b6b27a` |
| baseline inchangée | **oui** |

Aucune qualification n’est lue si la parité échoue.

## 5146 — contrat pente

**VALID_ALTERNATIVE.** S1 choisit une géométrie STRONG compétitive, minTop/minFace tenus, pente non limitée.

- A_STAR slopeLimited : **true**
- NEXT slopeLimited : **false**
- distinct de A_STAR : **true**

S1 n’a pas été modifié. Si CONTRACT_BYPASS : KEEP_IN_LAB, pas de correctif ici.

## Cut 154 gauche

S1 activé : **false** (attendu false). Déjà STRONG : **true**.

| | V4.6 | A_STAR / NEXT |
|---|---|---|
| u | -0.083 | -0.112697 |
| z | 0.016 | 0.011 |
| loss | 0.00015169004461001244 | 0.0000028707797549213115 |
| top / face | 16 / 6 | 51 / 7 |
| slopeLimited | false | false |
| residual top | 0.0016154081597451204 | 0.001954516494818013 |

- hypot V4.6 ↔ NEXT : **0.030115**
- oracle : **QUALIFIED**
- hypot V4.6 ↔ humain : **0.033985**
- hypot NEXT ↔ humain : **0.004551**
- verdict brut : **IMPROVED** · au pas de grille 3 mm : **IMPROVED**

Aucun seuil nouveau n’est dérivé de 154.

## 25 recoveries

n = **25**. Mécanisme A_STAR=23 S1=2.
Exposed 24 / non-exposed 1.

Distribution NEXT ↔ humain (unités de scène) :

| ≤0.010 | 0.010–0.020 | 0.020–0.050 | >0.050 | médiane |
|---:|---:|---:|---:|---:|
| 22 | 3 | 0 | 0 | 0.007039 |

| cut | side | exposé | mécanisme | V4.6 | u | z | NEXT↔humain | oracle | slopeLimited |
|---|---|---|---|---|---:|---:|---:|---|---|
| 5087 | right | oui | A_STAR | Plan de roulement non estimable. | -0.172489 | 0.013 | 0.008468 | QUALIFIED | false |
| 5088 | right | oui | S1 | Plan de roulement non estimable. | -0.170032 | 0.02 | 0.009203 | QUALIFIED | false |
| 5096 | right | oui | A_STAR | Plan de roulement non estimable. | -0.174856 | 0.013 | 0.011178 | QUALIFIED | false |
| 5098 | left | non | A_STAR | Plan de roulement non estimable. | 0.111053 | 0.001 | 0.008304 | QUALIFIED | false |
| 5098 | right | oui | A_STAR | Plan de roulement non estimable. | -0.171309 | 0.01 | 0.010891 | QUALIFIED | false |
| 5103 | right | oui | A_STAR | Plan de roulement non estimable. | -0.159532 | 0.014 | 0.006558 | QUALIFIED | false |
| 5110 | right | oui | A_STAR | Plan de roulement non estimable. | -0.166021 | 0.013 | 0.001886 | QUALIFIED | false |
| 5115 | right | oui | A_STAR | Plan de roulement non estimable. | -0.176612 | 0.011 | 0.009476 | QUALIFIED | false |
| 5116 | right | oui | A_STAR | Plan de roulement non estimable. | -0.177548 | 0.012 | 0.009207 | QUALIFIED | false |
| 5119 | right | oui | A_STAR | Plan de roulement non estimable. | -0.165732 | 0.009 | 0.001875 | QUALIFIED | false |
| 5122 | right | oui | A_STAR | Plan de roulement non estimable. | -0.163749 | 0.009 | 0.002267 | QUALIFIED | false |
| 5126 | right | oui | A_STAR | Plan de roulement non estimable. | -0.170639 | 0.01 | 0.006049 | QUALIFIED | false |
| 5127 | right | oui | A_STAR | Plan de roulement non estimable. | -0.169976 | 0.014 | 0.007762 | QUALIFIED | false |
| 5134 | right | oui | A_STAR | Plan de roulement non estimable. | -0.160441 | 0.009 | 0.002043 | QUALIFIED | false |
| 5137 | right | oui | A_STAR | Plan de roulement non estimable. | -0.159806 | 0.009 | 0.004035 | QUALIFIED | false |
| 5139 | right | oui | A_STAR | Plan de roulement non estimable. | -0.162173 | 0.007 | 0.004652 | QUALIFIED | false |
| 5146 | right | oui | S1 | Plan de roulement non estimable. | -0.156118 | 0.014 | 0.002316 | QUALIFIED | false |
| 5149 | right | oui | A_STAR | Plan de roulement non estimable. | -0.165817 | 0.014 | 0.00535 | QUALIFIED | false |
| 5165 | right | oui | A_STAR | Plan de roulement non estimable. | -0.151915 | 0.014 | 0.002858 | QUALIFIED | false |
| 5211 | right | oui | A_STAR | Plan de roulement non estimable. | -0.171972 | 0.02 | 0.009346 | QUALIFIED | false |
| 5265 | right | oui | A_STAR | Plan de roulement non estimable. | -0.174891 | 0.004 | 0.008524 | QUALIFIED | false |
| 5266 | right | oui | A_STAR | Plan de roulement non estimable. | -0.174107 | 0.004 | 0.007039 | QUALIFIED | false |
| 5276 | right | oui | A_STAR | Plan de roulement non estimable. | -0.163633 | -0.001 | 0.010196 | QUALIFIED | false |
| 427 | right | oui | A_STAR | Plan de roulement non estimable. | -0.168533 | 0.012 | 0.007961 | QUALIFIED | false |
| 326 | right | oui | A_STAR | Plan de roulement non estimable. | -0.16553 | 0.014 | 0.006865 | QUALIFIED | false |

## Controls modifiés (NEXT ≠ V4.6 au-delà de la maille, ou S1)

n = **13**. Gross (>0.010 vs V4.6) : **1**.

| cut | side | hypot vs V4.6 | ΔU | ΔZ | responsable | V4.6↔humain | NEXT↔humain | verdict |
|---|---|---:|---|---|---|---:|---:|---|
| 5194 | right | 0.003144 | ΔU 0.000939 | ΔZ 0.003 | A_STAR | 0.007292 | 0.006955 | IMPROVED |
| 6653 | left | 0.006498 | ΔU -0.006498 | ΔZ 0 | A_STAR | 0.006472 | 0.005133 | IMPROVED |
| 154 | left | 0.030115 | ΔU -0.029697 | ΔZ -0.005 | A_STAR | 0.033985 | 0.004551 | IMPROVED |
| 1246 | left | 0.007517 | ΔU -0.006364 | ΔZ 0.004 | A_STAR | 0.011402 | 0.003994 | IMPROVED |
| 2076 | right | 0.004376 | ΔU 0.001774 | ΔZ -0.004 | A_STAR | 0.007196 | 0.01067 | REGRESSED |
| 2749 | left | 0.003111 | ΔU 0.000825 | ΔZ 0.003 | A_STAR | 0.003074 | 0.004831 | REGRESSED |
| 2894 | left | 0 | ΔU 0 | ΔZ 0 | C | 0.011272 | 0.011272 | EQUIVALENT |
| 3018 | left | 0.00304 | ΔU 0.000492 | ΔZ -0.003 | A_STAR | 0.000107 | 0.003142 | REGRESSED |
| 8576 | left | 0.005268 | ΔU 0.004874 | ΔZ -0.002 | A_STAR | 0.008062 | 0.011598 | REGRESSED |
| 9401 | left | 0.00312 | ΔU -0.000857 | ΔZ -0.003 | A_STAR | 0.002219 | 0.003891 | REGRESSED |
| 9546 | right | 0.004025 | ΔU 0.000444 | ΔZ -0.004 | A_STAR | 0.00176 | 0.005267 | REGRESSED |
| 9644 | right | 0 | ΔU 0 | ΔZ 0 | C | 0.12989 | 0.12989 | EQUIVALENT |
| 9653 | right | 0.003004 | ΔU -0.000145 | ΔZ -0.003 | A_STAR | 0.002987 | 0.004877 | REGRESSED |

Un control resté `candidate` n’est pas ipso facto conservé géométriquement.

## 102 / 103 / 105

Pas de Pair Arbitration supplémentaire. Alternative = STRONG du competitive set déjà produit.

| vi | cut | side | V4.6 | NEXT | V4.6↔humain | NEXT↔humain | classe |
|---|---|---|---|---|---:|---:|---|
| 103 | 822 | left | candidate | candidate | 0.004618 | 0.004618 | UNCHANGED_CORRECT |
| 102 | 744 | left | candidate | candidate | 0.004243 | 0.004826 | UNCHANGED_CORRECT |
| 102 | 744 | right | candidate | candidate | 0.001907 | 0.00191 | UNCHANGED_CORRECT |
| 100 | 731 | right | unresolved | unresolved | — | — | ABSTENTION |
| 101 | 732 | left | unresolved | unresolved | — | — | ABSTENTION |
| 101 | 732 | right | unresolved | unresolved | — | — | ABSTENTION |
| 103 | 733 | left | unresolved | unresolved | — | — | ABSTENTION |
| 101 | 2368 | left | unresolved | unresolved | — | — | ABSTENTION |
| 102 | 2369 | right | unresolved | unresolved | — | — | ABSTENTION |
| 105 | 2372 | right | unresolved | unresolved | — | — | ABSTENTION |
| 106 | 2373 | right | unresolved | unresolved | — | — | ABSTENTION |
| 104 | 5203 | left | unresolved | unresolved | — | — | ABSTENTION |
| 107 | 5206 | left | unresolved | unresolved | — | — | ABSTENTION |
| 102 | 821 | right | unresolved | unresolved | — | — | ABSTENTION |
| 105 | 824 | right | unresolved | unresolved | — | — | ABSTENTION |

WORSENED : **0**.

## Exposition

- DEVELOPMENT_EXPOSED = 53+53 des lots No-Support / U / A_STAR / Face-Aware / Competitive Support.
- Geometry Prototype V1 a déjà rejoué 221/239 : **pas un holdout aveugle**.

Geometry Prototype V1 a assemblé 221/239. NOT_DIRECTLY_USED_FOR_TUNING n’est pas un holdout aveugle. 53+53 DEVELOPMENT_EXPOSED = No-Support, U Hypothesis, Recentering, Face-Aware, Competitive Support.

| groupe | n | recoveries | controls modifiés | médiane NEXT↔humain |
|---|---:|---:|---:|---:|
| DEVELOPMENT_EXPOSED | 106 | 24 | 5 | 0.006548 |
| NOT_DIRECTLY_USED | 133 | 1 | 8 | 0.004585 |

## Contribution S1 (4 rails)

### 5088 right

- rôle : failure
- A_STAR : flank (slopeLimited=false)
- S1 : Un cluster STRONG compétitif ; min-loss du cluster.
- NEXT : status=candidate face=6 top=40 slopeLimited=false slope=0.012744739993788879
- oracle : QUALIFIED NEXT↔humain=0.009203 V4.6↔humain=—
- verdict post-hoc : IMPROVED

### 5146 right

- rôle : failure
- A_STAR : slope (slopeLimited=true)
- S1 : Un cluster STRONG compétitif ; min-loss du cluster.
- NEXT : status=candidate face=9 top=39 slopeLimited=false slope=-0.035960785870258055
- oracle : QUALIFIED NEXT↔humain=0.002316 V4.6↔humain=—
- verdict post-hoc : IMPROVED

### 9644 right

- rôle : control
- A_STAR : flank (slopeLimited=false)
- S1 : Un cluster STRONG compétitif ; min-loss du cluster.
- NEXT : status=candidate face=24 top=91 slopeLimited=false slope=-0.005239907572746699
- oracle : QUALIFIED NEXT↔humain=0.12989 V4.6↔humain=0.12989
- verdict post-hoc : EQUIVALENT

### 2894 left

- rôle : control
- A_STAR : flank (slopeLimited=false)
- S1 : Un cluster STRONG compétitif ; min-loss du cluster.
- NEXT : status=candidate face=8 top=46 slopeLimited=false slope=-0.18851254204854395
- oracle : QUALIFIED NEXT↔humain=0.011272 V4.6↔humain=0.011272
- verdict post-hoc : EQUIVALENT


S1 reste un fallback rare. 5088 et 5146 sont des recoveries RSF. 9644 et 2894 restaurent le témoin V4.6 (A_STAR les avait perdus) : ce n’est pas un alignement oracle.

## Doctrine

- Aucun nouveau seuil, aucun retuning oracle, aucune action ESV.
- Unités de scène uniquement (×10⁻³ non calibré, pas des millimètres).
- Ne pas merger. Si PROMOTE : spécification figée, réplication indépendante ensuite.

## Réponse

Parité 239/239 PASS. 5146 VALID_ALTERNATIVE. 154 S1=false oracle=QUALIFIED brut=IMPROVED grille=IMPROVED. 25 recoveries : médiane 0.007039 ; ≤0.010 : 22/25. Controls modifiés 13 dont gross 1. 102/103/105 WORSENED 0. S1 conservateur=true (4 rails). Verdict PROMOTE_TO_GEOMETRY_CANDIDATE_V1. Pas une intégration runtime.
