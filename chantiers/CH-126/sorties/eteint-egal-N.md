# CH-126 : éteint = N (ÉTABLI, 14/11)

Patch `ancre-reprise-tronc.patch` (6506fd38…) appliqué, `ancre.reprise` faux (BANC_LEVIERS sans réglage d'ancre : N du tronc), contre le tronc sans patch. Comparaison de la ligne entière du rejeu, tous profils, sans les champs de durée (`outils/identiques.cjs`).

## Garde d'octobre (12 lots, leviers de la base)
```
r-0-2310-lot1.jsonl : 535 comparés, 535 identiques, 0 différents
r-0-2310-lot2.jsonl : 91 comparés, 91 identiques, 0 différents
r-2-11.jsonl : 131 comparés, 131 identiques, 0 différents
r-2-13.jsonl : 22 comparés, 22 identiques, 0 différents
r-2-17.jsonl : 139 comparés, 139 identiques, 0 différents
r-2-18.jsonl : 214 comparés, 214 identiques, 0 différents
r-2-19.jsonl : 248 comparés, 248 identiques, 0 différents
r-2-20-f228f6f9.jsonl : 281 comparés, 281 identiques, 0 différents
r-2-20-fd7067f7.jsonl : 130 comparés, 130 identiques, 0 différents
r-2-6.jsonl : 83 comparés, 83 identiques, 0 différents
r-2-7.jsonl : 151 comparés, 151 identiques, 0 différents
r-3-0.jsonl : 337 comparés, 337 identiques, 0 différents
TOTAL : 2362 comparés, 2362 identiques, 0 différents, 0 d'un seul côté
```

## Corpus (zones du journal, passe fidèle, plafond 10)
```
0411-p10-r1.jsonl : 397 comparés, 397 identiques, 0 différents
0411-p13-r1.jsonl : 153 comparés, 153 identiques, 0 différents
0411-p14-r1.jsonl : 122 comparés, 122 identiques, 0 différents
0411-p15-r1.jsonl : 70 comparés, 70 identiques, 0 différents
0511-p10-r1.jsonl : 218 comparés, 218 identiques, 0 différents
0511-p11-r1.jsonl : 226 comparés, 226 identiques, 0 différents
0511-p12-r1.jsonl : 130 comparés, 130 identiques, 0 différents
0511-p8-r1.jsonl : 157 comparés, 157 identiques, 0 différents
0511-p9-r1.jsonl : 126 comparés, 126 identiques, 0 différents
0511-p9-r2.jsonl : 8 comparés, 8 identiques, 0 différents
0611-p13-r1.jsonl : 353 comparés, 353 identiques, 0 différents
0611-p15-r1.jsonl : 161 comparés, 161 identiques, 0 différents
0611-p16-r1.jsonl : 431 comparés, 431 identiques, 0 différents
0811a-p3-r1.jsonl : 21 comparés, 21 identiques, 0 différents
0811a-p4-r1.jsonl : 95 comparés, 95 identiques, 0 différents
0811b-p6-r1.jsonl : 73 comparés, 73 identiques, 0 différents
0811b-p6-r2.jsonl : 150 comparés, 150 identiques, 0 différents
1111-p15-r1.jsonl : 105 comparés, 105 identiques, 0 différents
1111-p16-r1.jsonl : 421 comparés, 421 identiques, 0 différents
1111-p17-r1.jsonl : 46 comparés, 46 identiques, 0 différents
1211-p0-r1.jsonl : 109 comparés, 109 identiques, 0 différents
1211-p1-r1.jsonl : 42 comparés, 42 identiques, 0 différents
1211-p2-r1.jsonl : 91 comparés, 91 identiques, 0 différents
1211-p23-r1.jsonl : 311 comparés, 311 identiques, 0 différents
TOTAL : 4016 comparés, 4016 identiques, 0 différents, 0 d'un seul côté
```

## N du tronc contre le livré sans ancre (corpus, `outils/refus.cjs`) : reproduit CH-124 N-zjp

| **total** | 4016 | 3979 | 35 | 0 | 3 | 3385 | 28 |
Autres cuts changés : 1111-p16-r1/4510 (refusé alors que la référence ne posait pas) ; 1211-p23-r1/3736 : differe (gcv2, non écrite : plafond) → pose (gcv2, à 3 mm de la vérité) ; 1211-p23-r1/5285 : differe (gcv2, non écrite : plafond) → pose (gcv2, à 10 mm de la vérité)
Vraies corrections (pose refusée à plus de 50 mm de la vérité) : **30** ; vraies fautes (à 10 mm au plus) : **0** ; entre deux : 0 ; non jugés : 5.

Garde N du tronc : `garde d'octobre au banc, réglage « N » : retour 1 ; 9 recul(s) dont 3 RÉEL(S) et 6 « verts changés » ; rejeux 464 s` (13 cuts laissés sans pose = 13 refus, base à resceller, comme CH-124).
