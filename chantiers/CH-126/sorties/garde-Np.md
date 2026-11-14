# CH-126 : garde d'octobre de N+ (ÉTABLI, 14/11) — VERTE selon le ticket

Réglage : `ancre-reprise-tronc.patch`, `BANC_LEVIERS={"ancre":{"reprise":true}}` (leviers de la base en plus). Références : N (tronc sans réglage) et E (`ancre:null`, retour 0).

## Conditions 1 et 2 : N+ contre N (`outils/np-contre-n.cjs`)
```
Refus de N : 13 ; refus de N+ : 13 ; reposés par N+ : 7
Refus d'un seul côté : 0
Cuts non refusés changés (ricochets) : 0
Refus restés différés dont le profil (hors reprise) diffère de N : 0
```

## Condition 3 : les reprises contre la vérité d'octobre (détail : `garde-Np-refus.md`)

| lot | cut | pose de N | pose refusée à la vérité (mm) | reprise à la vérité (mm) | reprise − axe (mm) |
|---|---|---|---|---|---|
| 2-18 | 203 | différé | 236.3 | 2.1 | -5.9 |
| 2-18 | 451 | différé | 247.1 | 2.2 | -4.9 |
| 3-0 | 843 | différé | 125.5 | 12.3 | 5.4 |
| 3-0 | 861 | différé | 165.8 | 5.2 | -10.7 |
| 3-0 | 864 | différé | 166.6 | 3.8 | -10.4 |
| 0-2310-lot1 | 199 | différé | 153.3 | 4.6 | 10.2 |
| 0-2310-lot1 | 201 | différé | 225.2 | 5.1 | 16 |

Reprises posées : 7 sur 13 refus ; à 10 mm au plus : 6 ; de 10 à 50 mm : 1 (3-0 843, 12,3 mm) ; au-delà de 50 mm : **0**. Restés différés : 6 (départ le plus probable 5, sans approche 1).

Garde du banc : `garde d'octobre au banc, réglage « Np » : retour 1 ; 8 recul(s) dont 2 RÉEL(S) et 6 « verts changés » ; rejeux 1271 s` ; les reculs restants sont les 6 refus laissés sans pose (N : 13).
