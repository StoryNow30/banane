# U Recentering Stabilization V1

Lot **EXPÉRIMENTAL**. Branche `lab-u-recentering-stabilization-v1`. Aucun merge, aucun searchY global.

- Branche : `lab-u-recentering-stabilization-v1`
- HEAD : `(après commit)`
- Base : `d1b2bb8`
- Lab amont : `04a4932`
- Commande : `node tools/u-recentering-stabilization-v1.cjs`
- Tests : `node tests/u-recentering-stabilization-v1.test.cjs`

**Statut du lot : `INCONCLUSIVE`.** Gate 1 : **PASS**.

- Géométrie baseline : `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` inchangée **oui**
- searchY **0.08** · searchZ **0.04**
- Durée : 24.7 s

## Phase 0 — Comptabilité 51/51

22 candidate + 27 flank + 1 rsf (2269) + 1 slope (5146) = 51

| motif A | n |
|---|---:|
| candidate | 22 |
| flank | 27 |
| rsf | 1 |
| slope | 1 |
| **somme** | **51** |

Fermée : **oui**.

- 51e rail (omis par 22+27+1) : cut **5146 D** — motif `slope`. Plan de roulement présent (topRows fort, face=6) mais pente saturée.
- 1 RSF restant : cut **2269 G** — médiane U contaminée.

Aucun résultat ci-dessous n’est publié sans cette clôture.

## Phase 1 — A_ORIGIN_PRESERVE

Seule modification : `replaceOrigin: false`. Médiane U, fenêtre recentrée, searchY/Z inchangés.

| | A (replaceOrigin true) | A_ORIGIN_PRESERVE |
|---|---:|---:|
| candidate | 22 | 22 |
| flank | 27 | 27 |
| rsf | 1 | 1 |
| slope | 1 | 1 |
| témoins tenus | 51 | 52 |
| témoins perdus | 2 | 1 |
| déplacés > grille | 5 | 4 |
| déplacés > 10 mm | 0 | 0 |

### Témoins 2731 / 9644

2731 D **récupéré**. Sous A (`replaceOrigin: true`) la grille décalée manque la maille d’origine (loss ×10, face=0). Sous A_ORIGIN_PRESERVE, `uCenters` contient 0 **et** la médiane : le delta baseline est retrouvé (face=6, loss identique au témoin).

9644 D **encore perdu, compris**. La médiane U est déjà dans searchY de l’origine (`uCenters = [0, ≈0,005]`). min-loss choisit une maille voisine à face=0 dont la loss (5,3e-6) est **meilleure** que le témoin baseline (6,9e-6). Ce n’est pas un effet de remplacement d’origine.

Récupérés : **1** (2731). Encore perdu compris : **1** (9644). Nouveaux perdus : **0**.

- `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right` compris=true — min-loss a choisi un placement à flanc insuffisant (face=0) ; le placement retenu a une loss inférieure au témoin baseline (0.000005284494460869998 < 0.000006912582134672503) : l’origine est dans la fenêtre, replaceOrigin n’est pas la cause

## Gate 1

**PASS** — A_STAR autorisé

- perte témoin comprise (origine déjà dans la fenêtre ; min-loss préfère un cell sans flanc) : f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right
- témoins A perdus récupérés : 06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|2221968e-80c7-4676-9d5c-05d7542b7e6a|1|2731|right
- les 22 recoveries A sont conservées

Recoveries A conservées : **22**. Perdues : **0**. Nouvelles : **0**.

## Phase 2 — A_STAR

Figé.

- id : `A_STAR`
- hash : `e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f`
- source : `A_ORIGIN_PRESERVE`
- searchY 0.08 searchZ 0.04 grid 0.003
- minTop 15 minFace 6
- lab.replaceOrigin **false**
- lab.recenterWindow **true**
- uSeed : median-U of engine-local points

Ne plus modifier ce recentrage dans ce lot.

## Phase 3 — 27 flancs

Population : 27 rails (A_STAR motif=flank). Les 22 candidates ne sont pas retouchées.

| seau | n | définition |
|---|---:|---|
| A absent | 0 | aucune structure de flanc dans le nuage local |
| B insuffisant | 5 | 1–2 points / clairsemé sous robustLine |
| C seuil | 22 | 3 ≤ faceCount < minFace=6, flanc observable |
| D ambigu | 0 | placements concurrents |
| E autre | 0 | pente, fenêtre, autre |

Seau B : cut 5090, cut 5113, cut 5125, cut 5151, cut 5240.
Seau C : cut 5083 (face 5), cut 5084 (face 3), cut 5085 (face 4), cut 5088 (face 4), cut 5089 (face 3), cut 5091 (face 4), cut 5093 (face 5), cut 5094 (face 4), cut 5111 (face 5), cut 5112 (face 3), cut 5114 (face 3), cut 5120 (face 4), cut 5121 (face 4), cut 5124 (face 4), cut 5129 (face 4), cut 5130 (face 4), cut 5133 (face 3), cut 5135 (face 5), cut 5164 (face 3), cut 5226 (face 3), cut 5261 (face 4), cut 425 (face 3).

Variante justifiée testée : **partialFaceKeep-on-A_STAR** — **non figée**, pas A_STAR.
Seau C majoritaire ou substantiel : tester partialFaceKeep (conserver si top≥15 et face∈[3,6)), sans baisser minFace global, sans retoucher les 22. Mesure : 21/27 deviennent candidates ; témoins perdus additionnels 1.

Ne pas baisser minFace/minTop globalement.

## Post-hoc des 22 candidates figées

Oracle humain **après** gel. Jamais dans la médiane, jamais dans A_STAR.

n = 22

| | n |
|---|---:|
| référence disponible | 22 |
| absente | 0 |
| moteur unresolved vs ref | 0 |
| écart ≤ 10 mm | 19 |
| écart ≤ 20 mm | 3 |
| écart > 20 mm | 0 |

Médiane de l’écart (disponibles) : **7.0 mm**.

Rails 10–20 mm : cut 5096 (11.2 mm), cut 5098 (10.9 mm), cut 5276 (10.2 mm).

Cohérence de paire mesurable : 0 · autre rail candidate : 0.
rail opposé absent du capture pour les 22 (toutes à droite) ; cohérence de paire non mesurable

Aucun retuning après ces chiffres.

## Réponse

Comptabilité 51 = 22 candidate + 27 flanc + 1 RSF (2269) + 1 pente (5146). Gate 1 PASS : A_ORIGIN_PRESERVE conserve les 22 recoveries A, récupère le témoin 2731, comprend la perte 9644 (min-loss, origine déjà dans la fenêtre), 0 saut > 10 mm. A_STAR figé (médiane U, replaceOrigin=false, fenêtre recentrée, searchY=0.08). 27 flancs : A 0 / B 5 / C 22 / D 0 / E 0. partialFaceKeep (non figé) : 21/27 candidates, 1 témoin perdu de plus. Post-hoc 22 : 19 ≤ 10 mm, 3 ≤ 20 mm, 0 > 20 mm ; aucun retuning. Lot INCONCLUSIVE : les 22 ne sont pas déclarées correctes, 27 restent, minFace n’est pas baissé.

## Exceptions 836 / 756 (hors méthode)

- cut 756 left `hors-U+Z` A=rsf PRESERVE=rsf
- cut 836 left `hors-Z` A=rsf PRESERVE=rsf

Ne pas transformer ce laboratoire en version Banane.
