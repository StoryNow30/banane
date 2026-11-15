# CH-127 : gTE, éteint = tronc (ÉTABLI, 15/11)

Patch recalé `gTE-generateurs-tronc.patch` (16d79edc…) appliqué, clés du réglage absentes, contre le tronc N. Ligne entière, hors durées.

```
garde : TOTAL : 2362 comparés, 2362 identiques, 0 différents, 0 d'un seul côté
corpus : TOTAL : 4016 comparés, 4016 identiques, 0 différents, 0 d'un seul côté
```

Leviers du réglage jugé : `{"genMinTop":10,"genMinFace":3,"genRatioMax":3,"genSnapMm":25,"genMaxHyp":8,"genMaxDeplMm":300,"genDedupMm":10,"genSourcesMax":4,"genVoieFenetre":12,"genMaxGraines":8,"genTronques":true,"genEcartement":true}` (communs + gTE de `CH-120/reglages-figes.json`).
