# CH-127 : corpus de v4BS-sd sous N, et décision (ÉTABLI, 15/11)

Rejeu : patchs recalés, `BANC_ZONES=journal`, `BANC_PASSE_PLAFOND=10`, `BANC_LEVIERS` = passe livrée + `CH-123/leviers-v4BS-sd.json`. Référence : tronc N, mêmes réglages.

## Tableau standard (banc.cjs juger)
| | posés jugés | ≤ 10 | 10–50 | > 50 | différés |
|---|---|---|---|---|---|
| tronc N | 539 | 503 | 36 | 0 | 603 |
| N + v4BS-sd | 546 | 510 | 36 | 0 | 596 |

## v4 contre N (corpus)

Cuts comparés : 4016 ; identiques (profil L1-se : état, pose, source, passe, refus) : 4007 ; changés : 9.

| type | cuts |
|---|---|
| pose nouvelle (différé → posé) | 7 |
| pose GCV2 déplacée | 2 |

Poses nouvelles : 9 (N a jugé 9, muet 0, sans ancre 0) ; jugées : 9 ; à 10 mm au plus : 9 ; 10 à 50 mm : 0 ; au-delà de 50 mm : 0 ; sans vérité : 0.
Différés du tronc reposés justes : 7.
Refus de N en plus : 0 ; en moins : 0.

## Règle (§ 4 du ticket), sur ce jeu seul

- (a) poses nouvelles à plus de 50 mm : **0**
- (b) poses nouvelles jugées à plus de 10 mm : **0 sur 9**
- (c) justes du tronc passés au-delà de 10 mm : **0** ; justes perdus : **0**
- (c) compensation par groupe (reposés justes ≥ 3 × justes perdus) : 1111 3/0 ; 1211 0/0 ; 0411 4/0 ; 0511 0/0 ; 0611 0/0 ; 0811a 0/0 ; 0811b 0/0
- (d) poses de la chaîne déplacées ou perdues : **0**

## Cuts changés

| lot | cut | type | référence | réglage | réf. → vérité (mm) | réglage → vérité (mm) | déplacement (mm) | N | refus N |
|---|---|---|---|---|---|---|---|---|---|
| 0411-p14-r1 | 7827 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 3.3 |  | jugé |  |
| 0411-p15-r1 | 463 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 5.2 |  | jugé |  |
| 0411-p15-r1 | 470 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 2.6 |  | jugé |  |
| 0411-p15-r1 | 472 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 4.7 |  | jugé |  |
| 0511-p10-r1 | 2005 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.8 | 2.1 | 2.5 | jugé |  |
| 0511-p12-r1 | 9335 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.2 | 2.9 | 5.3 | jugé |  |
| 1111-p15-r1 | 5109 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 5.5 |  | jugé |  |
| 1111-p16-r1 | 5846 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 2.8 |  | jugé |  |
| 1111-p16-r1 | 5847 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 1.4 |  | jugé |  |

Lecture : les deux « poses GCV2 déplacées » (0511 p10/2005, p12/9335) sont des cuts que le tronc pose dans la passe et que v4BS-sd pose dès la première passe, un peu autrement (1,8 → 2,1 mm et 5,2 → 2,9 mm) : comptées comme poses nouvelles, toutes deux justes. Aucun refus de N en plus ou en moins ; N a jugé les 9 poses nouvelles (aucune ne tient seulement là où N se tait).

## Décision selon la règle écrite d'avance (garde + corpus réunis)
- (a) 0 pose nouvelle au-delà de 50 mm ; (b) 0 sur 9 au-delà de 10 mm ; (c) 0 juste dégradé, 0 juste perdu ; (d) 0 pose de la chaîne déplacée.
- **v4BS-sd est PROPOSÉ** : 7 différés reposés justes (cible écrite : 7, fourchette 4 à 9). Gain PROBABLE seulement : octobre est vu et sa garde n'a aucune puissance ici (0 cut touché) ; le juge reste l'examen vierge (CH-116, par l'intégrateur).
