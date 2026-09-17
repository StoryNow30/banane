# Competitive Support Arbitration V1

Lot **EXPÉRIMENTAL**. Branche `lab-competitive-support-arbitration-v1`. Aucun merge. A_STAR figé.

- Branche : `lab-competitive-support-arbitration-v1`
- HEAD : `2ac4e6a`
- Base : `8d98f68`
- Lab amont : `2ec9443`
- Commande : `node tools/competitive-support-arbitration-v1.cjs`
- Tests : `node tests/competitive-support-arbitration-v1.test.cjs`

**Statut du lot : `PROMISING`.**

- A_STAR hash : `e46dfc2b5610bedd5052750fba054956c2b07127781f142563e0bdd4c292a58f` **figé**
- searchY **0.08** · searchZ **0.04** · minFace **6** · minTop **15**
- minTemplateLossRatio **1.5** (constante V4.6, pas un nouveau seuil)
- Baseline géométrie inchangée : **oui**
- Durée : 24.8 s

## Parité A_STAR

La correction hypothesesA du lot Face-Aware concernait le harness (uMedian d’index vs médiane figée). A_STAR (hash, searchY/Z, minFace, replaceOrigin) n’a pas été modifié.

| comparaison | n | mismatches | pass |
|---|---:|---:|---|
| Face-Aware vs A_ORIGIN_PRESERVE | 106 | 0 | true |
| lot courant vs Face-Aware | 106 | 0 | true |

Aucune arbitration n’est interprétée si la parité échoue.

## Question

Le support géométrique peut-il servir de critère de secours, uniquement parmi des candidats encore compétitifs en loss (ratio ≤ 1,5) ?

## Réponse

Parité A_STAR : harness Face-Aware vs A_ORIGIN_PRESERVE PASS ; lot courant vs Face-Aware PASS. Le décalage uMedian d’index du lot précédent était un bug de harness, pas une modification d’A_STAR. Aucun nouveau seuil : minTemplateLossRatio=1.5. 9644 : Lmin face=0 ; témoin face=24 ratio=1.308 ; S1 restaure=true. 22 : A(compétitif)=1 B(hors set)=16 C(aucun)=5 D(plusieurs)=0 ; S1 publie 1/22 et 0/5. S1 : +2 candidates, témoins perdus 0, déjà-STRONG déplacés 0, far publiés 0, activation-sur-STRONG 0. S2 statut PROMISING. Lot PROMISING au sens du gate (9644, témoins, pas de far). Pas une intégration runtime.

**Ce lot ne baisse pas minFace. Il n’élargit pas searchY. Il n’introduit pas de constante nouvelle.**

## Variantes

| id | statut | 51 → candidate | 22 publiés | 5 publiés | 9644 | témoins perdus | déjà-STRONG déplacés | far publiés | activation-sur-STRONG |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|
| S1 fallback | PROMISING | 24 | 1 | 0 | true | 0 | 0 | 0 | 0 |
| S2 ranking | PROMISING | 24 | 1 | 0 | true | 0 | 0 | 0 | 0 |

S1 : si A_STAR est déjà STRONG, ne rien changer. Sinon, STRONG du competitive set ; un cluster → min-loss ; plusieurs → ambiguïté ; zéro → motif inchangé.
S2 : même gate, rang faceCount puis topRows puis loss dans un cluster unique. Ne force pas si plusieurs clusters.

## Cas 9644 D

Hardcodé comme exception : **non**.

- Lmin : 0.000005284494460869998
- A_STAR : motif=flank face=0 loss=0.000005284494460869998
- témoin : face=24 loss=0.000006912582134672503 ratio=1.3080876866950994
- dans le competitive set : **true**
- STRONG compétitifs / clusters : 2 / 1
- A_STAR publie face=0 à Lmin ; le témoin face=24 a un ratio 1.308 ≤ 1.5 donc entre dans le competitive set.

| politique | status | motif | face | activé | changé |
|---|---|---|---:|---|---|
| S1 | candidate | candidate | 24 | true | true |
| S2 | candidate | candidate | 24 | true | true |

## 22 partialFace

Population : **B** — A compétitif / B STRONG hors set / C aucun STRONG / D plusieurs clusters.

- n = 22
- A : 1 · B : 16 · C : 5 · D : 0

- cut 5083 kind=C faceA=5 nStrong=0 nComp=0 clusters=0 ratioS=— S1=flank
- cut 5084 kind=C faceA=3 nStrong=0 nComp=0 clusters=0 ratioS=— S1=flank
- cut 5085 kind=B faceA=4 nStrong=1 nComp=0 clusters=0 ratioS=10.33 S1=flank
- cut 5088 kind=A faceA=4 nStrong=4 nComp=1 clusters=1 ratioS=1.47 S1=candidate
- cut 5089 kind=B faceA=3 nStrong=1 nComp=0 clusters=0 ratioS=32.05 S1=flank
- cut 5091 kind=C faceA=4 nStrong=0 nComp=0 clusters=0 ratioS=— S1=flank
- cut 5093 kind=B faceA=5 nStrong=4 nComp=0 clusters=0 ratioS=2.88 S1=flank
- cut 5094 kind=B faceA=4 nStrong=2 nComp=0 clusters=0 ratioS=8.75 S1=flank
- cut 5111 kind=B faceA=5 nStrong=4 nComp=0 clusters=0 ratioS=4.64 S1=flank
- cut 5112 kind=B faceA=3 nStrong=1 nComp=0 clusters=0 ratioS=19.79 S1=flank
- cut 5114 kind=B faceA=3 nStrong=1 nComp=0 clusters=0 ratioS=94.44 S1=flank
- cut 5120 kind=B faceA=4 nStrong=4 nComp=0 clusters=0 ratioS=11.96 S1=flank
- cut 5121 kind=B faceA=4 nStrong=2 nComp=0 clusters=0 ratioS=7.36 S1=flank
- cut 5124 kind=B faceA=4 nStrong=1 nComp=0 clusters=0 ratioS=19.67 S1=flank
- cut 5129 kind=B faceA=4 nStrong=2 nComp=0 clusters=0 ratioS=25.36 S1=flank
- cut 5130 kind=B faceA=4 nStrong=2 nComp=0 clusters=0 ratioS=13.37 S1=flank
- cut 5133 kind=B faceA=3 nStrong=1 nComp=0 clusters=0 ratioS=16.42 S1=flank
- cut 5135 kind=B faceA=5 nStrong=4 nComp=0 clusters=0 ratioS=6.11 S1=flank
- cut 5164 kind=B faceA=3 nStrong=2 nComp=0 clusters=0 ratioS=9.61 S1=flank
- cut 5226 kind=C faceA=3 nStrong=0 nComp=0 clusters=0 ratioS=— S1=flank
- cut 5261 kind=B faceA=4 nStrong=2 nComp=0 clusters=0 ratioS=18.74 S1=flank
- cut 425 kind=C faceA=3 nStrong=0 nComp=0 clusters=0 ratioS=— S1=flank

Ne pas transformer automatiquement PARTIAL_FACE en candidate.

## 5 flancs insuffisants

- cut 5090 nStrong=4 nComp=0 STRONG hors competitive set ; abstention
- cut 5113 nStrong=1 nComp=0 STRONG hors competitive set ; abstention
- cut 5125 nStrong=6 nComp=0 STRONG hors competitive set ; abstention
- cut 5151 nStrong=0 nComp=0 aucun STRONG ; abstention acceptable
- cut 5240 nStrong=0 nComp=0 aucun STRONG ; abstention acceptable

Abstention si le seul STRONG est hors competitive set.

## Gel

Variante `S1` : figé pour lecture ; post-hoc humain non exécuté ; A_STAR inchangé ; constante 1.5 déjà gelée

Oracle humain interdit pendant génération, arbitrage, choix des règles.

## Exceptions 836 / 756

- cut 756 left `hors-U+Z` A_STAR=rsf
- cut 836 left `hors-Z` A_STAR=rsf

Ne pas transformer ce laboratoire en version Banane.
