# Geometry Engine Next V0

Lot **EXPÉRIMENTAL**. Branche `lab-geometry-engine-next-v0`. Aucun merge. Pas d’intégration runtime. Pas d’ESV.

- Branche : `lab-geometry-engine-next-v0`
- HEAD : `9e40ad2`
- Base : `a97373e` (Competitive Support V1, lab `2ac4e6a`)
- Commande : `node tools/geometry-engine-next-v0.cjs`
- Tests : `node tests/geometry-engine-next-v0.test.cjs`

**Statut du lot : `INCONCLUSIVE`.**

## Composition figée

- Nom : `GEOMETRY_ENGINE_NEXT_V0`
- Hash composition : `0ea0824fb9e0b763d575ee95784475632f7fe2fd18e684b68e9f765106b6b27a`
- A_STAR hash : `e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f` **figé** — médiane U, replaceOrigin false, fenêtre recentrée, searchY **0.08**, searchZ **0.04**, minTop **15**, minFace **6**
- S1 : `SUPPORT_FALLBACK_15` — minTemplateLossRatio **1.5** (constante V4.6, pas un nouveau seuil)
- S2 **exclu** de NEXT V0 (comparaison du lot amont seulement)
- Baseline géométrie inchangée : **oui**
- Durée : 53.7 s

Ce n’est **pas** encore un candidat d’intégration.

## Gate de parité 53+53

| comparaison | n | mismatches | pass |
|---|---:|---:|---|
| A_STAR vs Competitive Support V1 | 106 | 0 | true |
| S1 vs Competitive Support V1 | 106 | 0 | true |

- 9644 restauré : **true**
- 5088 : candidate face=6
- 2894 : A_STAR flank → NEXT candidate
- 5 insufficient publiés : **0/5**
- 5146 : A_STAR `slope` slopeLimited=true → NEXT `candidate` slopeLimited=false
- far S1 : **0** · PARTIAL/WEAK publiés : **0** · déjà-STRONG déplacés : **0**
- sauts A_STAR >10 mm hérités : **1** · sauts S1 nouveaux : **0**

Parité PASS. Replay 239 autorisé.

## Population 239/239

- Source lock : `data/capsules/rsf-v1/manifest.json @ infra/research-capsule-rsf-v1`
- Assemblés : **239 / 239**
- Ignorés : **0**
- Chunks : 293/293 (lecteur complet, nuages inline)
- Failures RSF : 63 · témoins : 176

Aucun rail fail-closed.

## Ablation V4.6 / A_STAR / A_STAR+S1

| cohorte | n | V4.6 pub. | A_STAR pub. | NEXT pub. | récup. NEXT | perdus NEXT | dépl. NEXT | >10 mm |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 239 | 239 | 176 | 197 | 201 | 25 | 0 | 11 | 1 |
| 63 RSF | 63 | 0 | 23 | 25 | 25 | 0 | 0 | 0 |
| 176 témoins | 176 | 176 | 174 | 176 | 0 | 0 | 11 | 1 |
| DEVELOPMENT_EXPOSED | 106 | 53 | 74 | 77 | 24 | 0 | 4 | 0 |
| NOT_DIRECTLY_USED | 133 | 123 | 123 | 124 | 1 | 0 | 7 | 1 |

S1 n’est pas « plus de candidates ⇒ meilleur ». Contribution marginale de S1 après A_STAR : changements S1 = 4, déjà-STRONG déplacés = 0, PARTIAL/WEAK publiés = 0, far = 0.

Saut >10 mm hérités d’A_STAR (S1 inactif) : cut 154 left hypot=0.030115.


## Classes V4.6 → NEXT

- `UNCHANGED_GOOD` : **165**
- `UNCHANGED_UNRESOLVED` : **38**
- `RECOVERED` : **25**
- `LOST` : **0**
- `MOVED` : **10**
- `NEW_AMBIGUITY` : **0**
- `NEW_ABSTENTION` : **0**
- `DIFFERENT_CANDIDATE` : **1**

## Attribution des écarts (A A_STAR seul / B S1 / C les deux / D autre)

A=34 B=2 C=2 D=0 inchangés=201

NEXT V0 ≈ A_STAR + fallback rare.

## Mauvais placements connus (visite 102 / 103 / 105)

Cohorte séparée, **pas** un sous-ensemble RSF. Aucun retuning.

- n = 17 (primaires 102/103/105 : 8)
- améliorés vs humain (post-hoc) : 0
- aggravés : 0

- vi 103 cut 822 left CANDIDATE_BASELINE → SAME_STRUCTURE_NEXT hypotV46=0.004618 hypotNEXT=0.004618
- vi 102 cut 744 left CANDIDATE_BASELINE → SAME_STRUCTURE_NEXT hypotV46=0.004243 hypotNEXT=0.004826
- vi 102 cut 744 right CANDIDATE_BASELINE → SAME_STRUCTURE_NEXT hypotV46=0.001907 hypotNEXT=0.00191
- vi 103 cut 733 left UNRESOLVED_BASELINE → ABSTENTION_NEXT hypotV46=— hypotNEXT=—
- vi 102 cut 2369 right UNRESOLVED_BASELINE → ABSTENTION_NEXT hypotV46=— hypotNEXT=—
- vi 105 cut 2372 right UNRESOLVED_BASELINE → ABSTENTION_NEXT hypotV46=— hypotNEXT=—
- vi 102 cut 821 right UNRESOLVED_BASELINE → ABSTENTION_NEXT hypotV46=— hypotNEXT=—
- vi 105 cut 824 right UNRESOLVED_BASELINE → ABSTENTION_NEXT hypotV46=— hypotNEXT=—

## Development exposure

Les 53+53 des labs No-Support / U / A_STAR / Face-Aware / Competitive sont DEVELOPMENT_EXPOSED. Le complément du lock 239 n’est pas un holdout aveugle : Geometry Prototype V1 a déjà parcouru le lock (221 assemblés alors).

Ce n’est **pas** un faux holdout.

## Oracle humain (Phase B, après gel)

Oracle ouvert seulement après gel. Aucun retuning.
Références : disponibles 239 · absentes 0 · ambiguës 0.
Paires mesurables : 176. Médiane V4.6 0.005 · NEXT 0.005 unités de scène (×10⁻³ non calibré, pas des millimètres).
Améliorés 35 · dégradés 41.
Bandes NEXT ≤10 / 10–20 / >20 (unités de scène) : 159 / 12 / 5.

## Performance

- médiane 51.2 ms/rail
- p95 340.0 ms
- max 871.9 ms
- pool moyen 40.0 · competitive 2.3
- S1 activé 42 · changé 4

## Gate Geometry Candidate

NEXT V0 n’est un futur Geometry Candidate que si : replay complet, témoins non dégradés, pas d’explosion de déplacements, pas de publication non supportée, mauvais placements non aggravés, récupération réelle, S1 n’altère pas les A_STAR STRONG, perf acceptable, métriques exposées séparées, oracle jamais en réglage.

**Verdict : `INCONCLUSIVE`.** Pas un merge. Pas un runtime.

## Réponse

Parité 53+53 : A_STAR PASS, S1 PASS. Couverture 239/239. 9644 restauré=true (pas une exception). S1 : activations 42, changements 4 (5088, 5146, 9644, 2894). Ablation 176 témoins : V4.6 perdus NEXT=0 A_STAR=2 ; RSF récupérés NEXT=25 A_STAR=23. Attribution des écarts A/B/C/D = 34/2/2/0. A_STAR héritage : 1 saut >10 mm (S1 nouveaux=0). far S1=0. Cohorte 102/103/105 : améliorés 0, aggravés 0 (seuil 3 mm). Lot INCONCLUSIVE comme Geometry Candidate : pas une conclusion de production.

Ne pas transformer ce laboratoire en version Banane.
