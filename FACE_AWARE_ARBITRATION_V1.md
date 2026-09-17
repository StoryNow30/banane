# Face-Aware Arbitration V1

Lot **EXPÉRIMENTAL**. Branche `lab-face-aware-arbitration-v1`. Aucun merge. A_STAR figé.

- Branche : `lab-face-aware-arbitration-v1`
- HEAD : `(après commit)`
- Base : `f25f337`
- Lab amont : `93b75ed`
- Commande : `node tools/face-aware-arbitration-v1.cjs`
- Tests : `node tests/face-aware-arbitration-v1.test.cjs`

**Statut du lot : `INCONCLUSIVE`.**

- A_STAR hash : `e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f` **figé**
- searchY **0.08** · searchZ **0.04** · minFace **6** · minTop **15**
- Baseline géométrie inchangée : **oui**
- Durée : 23.0 s

## Question

Parmi les candidats déjà générés par A_STAR, le moteur peut-il préférer une solution géométriquement mieux soutenue plutôt que le simple minimum de loss ?

## Réponse

A_STAR figé. Arbitrage sur le pool déjà produit, sans nouvelle génération U. 9644 : loss-first choisit face=0 (loss 0.000005284494460869998) ; A et C restaurent le témoin face=24 sans règle spécifique. 22 partialFace : population C (13 STRONG proche, 5 sans STRONG, 4 STRONG lointain à loss ×≫1.5). A publie 17/22 et 3/5 insuffisants ; témoins perdus 0, sauts >10 mm 0. B est REGRESSIVE (41 témoins perdus par front de Pareto non unique). C n’auto-publie pas PARTIAL_FACE. Lot INCONCLUSIVE : le mécanisme 9644 est réel, mais les 22 ne forment pas une population uniformément sélectionnable. Pas un correctif de production.

**Ce lot ne baisse pas minFace. Il n’élargit pas searchY.**

## Variantes

| id | statut | 51 → candidate | 22 publiés | 5 publiés | 9644 | témoins perdus | >grille | >10 mm |
|---|---|---:|---:|---:|---|---:|---:|---:|
| LOSS_FIRST | NEUTRAL | 22 | 0 | 0 | false | 1 | 2 | 0 |
| A support-qualified | PROMISING | 43 | 17 | 3 | true | 0 | 2 | 0 |
| B Pareto | REGRESSIVE | 18 | 11 | 1 | false | 41 | 0 | 0 |
| C face-tiers | PROMISING | 43 | 17 | 3 | true | 0 | 2 | 0 |

A : lexicographique STRONG (top≥15 ∧ face≥6 ∧ fenêtre ∧ pente) puis loss. Pas de baisse de seuil.
C : STRONG publiable ; PARTIAL abstention explicite ; WEAK ne gagne pas à la loss.

## Cas 9644 D

Hardcodé comme exception : **non**.

- témoin moteur : status=candidate face=24 loss=0.000006912582134672503 seed=[-0.02100000000000004,-0.006]
- A_STAR : motif=flank face=0 loss=0.000005284494460869998 seed=[-0.007950000000000026,-0.008]
- min-loss du pool : u=0.00795 face=0 tier=WEAK_FACE loss=0.000005284494460869998
- STRONG dans le pool compact : **11** (dense 159)
- ratio loss témoin / min-loss : 1.308
- pourquoi loss-first : A_STAR publie une maille à face=0 dont la loss (0.000005284494460869998) est inférieure au témoin face=24 (0.000006912582134672503). Le témoin reste dans le pool ; ce n’est pas une exception 9644.

| politique | status | motif | face du pick |
|---|---|---|---:|
| LOSS_FIRST | unresolved | flank | 0 |
| A | candidate | candidate | 24 |
| B | unresolved | ambiguity | — |
| C | candidate | candidate | 24 |

## 22 partialFace

Population descriptive : **C** (A sélectionnable / B ambiguë / C sous-populations).

- n = 22
- STRONG proche (kind A) : 13
- sans STRONG, plusieurs PARTIAL (kind B) : 5
- STRONG lointain, loss ×≫1.5 (kind C) : 4
- A auto-publie 17/22 — dont les kind C, sans filtre de ratio. Ne pas transformer automatiquement PARTIAL_FACE.

- cut 5083 kind=B loss-face=5 strong=0 gap=— dist=0.000
- cut 5084 kind=B loss-face=3 strong=0 gap=— dist=0.000
- cut 5085 kind=A loss-face=4 strong=1 gap=3.99e-5 dist=0.007
- cut 5088 kind=A loss-face=4 strong=4 gap=3.08e-6 dist=0.004
- cut 5089 kind=A loss-face=3 strong=1 gap=2.86e-4 dist=0.016
- cut 5091 kind=B loss-face=4 strong=0 gap=— dist=0.000
- cut 5093 kind=A loss-face=5 strong=4 gap=2.17e-5 dist=0.006
- cut 5094 kind=A loss-face=4 strong=2 gap=4.91e-5 dist=0.011
- cut 5111 kind=A loss-face=5 strong=4 gap=1.11e-5 dist=0.007
- cut 5112 kind=C loss-face=3 strong=1 gap=1.80e-4 dist=0.028
- cut 5114 kind=C loss-face=3 strong=1 gap=2.10e-4 dist=0.032
- cut 5120 kind=A loss-face=4 strong=4 gap=4.19e-5 dist=0.006
- cut 5121 kind=A loss-face=4 strong=2 gap=2.63e-5 dist=0.010
- cut 5124 kind=C loss-face=4 strong=1 gap=1.21e-4 dist=0.023
- cut 5129 kind=A loss-face=4 strong=2 gap=5.97e-5 dist=0.009
- cut 5130 kind=A loss-face=4 strong=2 gap=6.31e-5 dist=0.011
- cut 5133 kind=C loss-face=3 strong=1 gap=9.24e-5 dist=0.023
- cut 5135 kind=A loss-face=5 strong=4 gap=2.86e-5 dist=0.011
- cut 5164 kind=A loss-face=3 strong=2 gap=5.15e-5 dist=0.010
- cut 5226 kind=B loss-face=3 strong=0 gap=— dist=0.000
- cut 5261 kind=A loss-face=4 strong=2 gap=6.23e-5 dist=0.010
- cut 425 kind=B loss-face=3 strong=0 gap=— dist=0.000

Ne pas transformer automatiquement PARTIAL_FACE en candidate.

## 5 flancs insuffisants

- cut 5090 nStrong=4 STRONG_FACE présent dans le pool — abstention non forcée par absence
- cut 5113 nStrong=1 STRONG_FACE présent dans le pool — abstention non forcée par absence
- cut 5125 nStrong=6 STRONG_FACE présent dans le pool — abstention non forcée par absence
- cut 5151 nStrong=0 aucune géométrie STRONG_FACE ; abstention acceptable
- cut 5240 nStrong=0 aucune géométrie STRONG_FACE ; abstention acceptable

Abstention acceptable s’il n’existe aucune géométrie suffisamment soutenue.

## Gel

Variante `A` retenue pour post-hoc : figé pour lecture ; post-hoc humain non exécuté dans ce lot ; A_STAR inchangé

Oracle humain interdit pendant génération, arbitrage, choix des règles et des seuils.

## Exceptions 836 / 756

- cut 756 left `hors-U+Z` A_STAR=rsf
- cut 836 left `hors-Z` A_STAR=rsf

Ne pas transformer ce laboratoire en version Banane.
