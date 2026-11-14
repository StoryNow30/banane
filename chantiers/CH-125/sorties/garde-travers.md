# CH-125 : garde d'octobre du travers (levier `flancSource`, seuil 5 mm, borne 20 mm, propagation « A ») — 14/11

Réglage `reglages/travers.json`, patch `flanc-source.patch`, rejeux du banc de CH-116 (`banc.cjs garde`, 12 lots, réglages de la base scellée). Référence : le rejeu à l'éteint `ch125-eteint` (identique à la base scellée : retour 0).

## Verdict de la garde : ROUGE (retour 1). Le réglage est écarté (R1), et la variante « pose écrite » n'est pas rejouée : des cuts TOUCHÉS sont dégradés, la mesure elle-même est en cause (règle écrite avant le rejeu, `reglages/LISEZMOI.md`).
```
garde d'octobre au banc, réglage « ch125-travers » : retour 1 ; 13 recul(s) dont 13 RÉEL(S) et 0 « verts changés » ; rejeux 1451 s
  réel : reglage-9, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 507 sur 510
  réel : reglage-9, sansPasse : 1 cut(s) nouvellement à plus de 20 mm (2-17 9803 29.08 mm)
  réel : reglage-9, sansPasse : 5 cut(s) dégradé(s) de plus de 2 mm (2-17 9652 11.26 mm, 2-17 9803 29.08 mm, 2-20-fd7067f7 288 4.6 mm, 2-20-f228f6f9 512 12.22 mm, 2-20-f228f6f9 515 11.56 mm)
  réel : reglage-9, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 513 sur 518 ; hors de la liste des pertes acceptées : 2-17 9652, 2-20-f228f6f9 512, 2-20-f228f6f9 515
  réel : reglage-9, avecPasse : 1 cut(s) nouvellement à plus de 20 mm (2-17 9803 29.08 mm)
  réel : reglage-9, avecPasse : 5 cut(s) dégradé(s) de plus de 2 mm (2-17 9652 11.26 mm, 2-17 9803 29.08 mm, 2-20-fd7067f7 288 4.6 mm, 2-20-f228f6f9 512 12.22 mm, 2-20-f228f6f9 515 11.56 mm)
  réel : reglage-9, GCV2 dans le lot : 1 cut(s) nouvellement à plus de 20 mm (2-17 9803 29.08 mm)
  réel : reglage-9, GCV2 dans le lot : 5 cut(s) dégradé(s) de plus de 2 mm (2-17 9652 11.26 mm, 2-17 9803 29.08 mm, 2-20-fd7067f7 288 4.6 mm, 2-20-f228f6f9 512 12.22 mm, 2-20-f228f6f9 515 11.56 mm)
  réel : terrain-partie-0-23-10, sansPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 90 sur 92
  réel : terrain-partie-0-23-10, sansPasse : 2 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 10.22 mm, 0-2310-lot1 193 12.55 mm)
  réel : terrain-partie-0-23-10, avecPasse : cuts à ≤ 10 mm en base encore à ≤ 10 mm : 104 sur 106 ; hors de la liste des pertes acceptées : 0-2310-lot1 4, 0-2310-lot1 193
  réel : terrain-partie-0-23-10, avecPasse : 2 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 10.22 mm, 0-2310-lot1 193 12.55 mm)
  réel : terrain-partie-0-23-10, GCV2 dans le lot : 2 cut(s) dégradé(s) de plus de 2 mm (0-2310-lot1 4 10.22 mm, 0-2310-lot1 193 12.55 mm)
  signalé : reglage-9, avecPasse : cuts laissés sans pose 12 → 14
  signalé : terrain-partie-0-23-10, avecPasse : cuts laissés sans pose 79 → 83
  signalé : terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (pose > 50 mm 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
  signalé : terrain-partie-0-23-10, GCV2 dans le lot : budget D-223 DÉPASSÉ EN BASE (mauvaise voie 5/105, 4.8 %, borne haute de Wilson 10.7 %) : connu (D-250), à corriger ; la garde bloque toute hausse
```

## Jugement contre la vérité d'octobre (R6 étendue) : chaque cut changé, pose de base, pose nouvelle, vérité (`outils/oct-poses.cjs`)
Lots d'octobre de la garde : 2362 cuts, 2227 posés par le profil L1-se à l'éteint ; 60 cut(s) changé(s) par le réglage (51 touché(s) par la mesure, 9 par ricochet).

### Cuts TOUCHÉS par la mesure : 51 cut(s) changé(s)
- poses déplacées de plus de 0.5 mm : 51 (médiane 7.4 mm, maximum 16.8) ; jugées contre la vérité : 48 (dont 2 « visité sans action »)
- rapprochées 35, éloignées 5, égales 8 ; médiane de l'écart 7.1 → 4.1 mm
- dont poses RETOUCHÉES par l'opérateur (écart de base > 2 mm) : 45, rapprochées 35, éloignées 2 ; poses validées telles quelles (écart de base ≤ 2 mm) : 3, déplacées de 5.3, 10.5, 13.1 mm
- dégradées de plus de 2 mm : 4 : 2-17 9803 18.7→29.1 ; 2-20-fd7067f7 288 0.7→4.6 ; 0-2310-lot1 4 1.0→10.2 ; 0-2310-lot1 193 0.5→12.6
- justes passés au-delà de 10 mm : 2 : 0-2310-lot1 4 1.0→10.2 ; 0-2310-lot1 193 0.5→12.6 ; gagnés : 6 : 2-7 4766 11.3→4.2 ; 2-18 195 12.8→2.8 ; 2-18 206 10.2→0.8 ; 2-20-f228f6f9 428 12.3→8.2 ; 3-0 797 10.3→2.9 ; 0-2310-lot2 1123 14.0→2.3
- états changés : 0
- poses nouvelles jugées à plus de 10 mm : 0

### RICOCHETS (cuts non touchés) : 9 cut(s) changé(s)
- poses déplacées de plus de 0.5 mm : 9 (médiane 3.4 mm, maximum 9.6) ; jugées contre la vérité : 9 (dont 0 « visité sans action »)
- rapprochées 1, éloignées 3, égales 5 ; médiane de l'écart 3.5 → 6.8 mm
- dont poses RETOUCHÉES par l'opérateur (écart de base > 2 mm) : 9, rapprochées 1, éloignées 3 ; poses validées telles quelles (écart de base ≤ 2 mm) : 0, déplacées de - mm
- dégradées de plus de 2 mm : 3 : 2-17 9652 2.6→11.3 ; 2-20-f228f6f9 512 3.2→12.2 ; 2-20-f228f6f9 515 3.5→11.6
- justes passés au-delà de 10 mm : 3 : 2-17 9652 2.6→11.3 ; 2-20-f228f6f9 512 3.2→12.2 ; 2-20-f228f6f9 515 3.5→11.6 ; gagnés : 0
- états changés : 0
- poses nouvelles jugées à plus de 10 mm : 0

### Chaque cut changé : pose de base, pose nouvelle, vérité
| cut | zone | source, motif | touché | état | déplacement (mm) | écart à la vérité : base → nouvelle (mm) | vérité |
|---|---|---|---|---|---|---|---|
| 2-6 3505 | abords | gcv2, sous-tau-coherent | flanc | pose | 5.2 | 5.8 → 4.2 | validation |
| 2-7 4766 | adv | gcv2 | flanc | pose | 12.4 | 11.3 → 4.2 | validation |
| 2-11 6456 | adv | gcv2 | flanc | pose | 9.8 | 11.9 → 10.0 | validation |
| 2-13 3533 | adv | gcv2 | flanc | pose | 15.2 | - → - | aucune |
| 2-17 9649 | adv | gcv2, ecartement-corrige | flanc | pose | 8.1 | 5.6 → 6.5 | validation |
| 2-17 9650 | adv | gcv2, ecartement-corrige | flanc | pose | 5.6 | 5.4 → 1.9 | validation |
| 2-17 9651 | adv | gcv2, ecartement-corrige | flanc | pose | 6.2 | 4.0 → 3.6 | validation |
| 2-17 9652 | adv | gcv2, recherche-adv | ricochet | pose | 9.6 | 2.6 → 11.3 | validation |
| 2-17 9653 | adv | gcv2, recherche-adv | ricochet | pose | 0.5 | 3.3 → 3.8 | validation |
| 2-17 9803 | adv | gcv2, recherche-adv | flanc | pose | 10.5 | 18.7 → 29.1 | validation |
| 2-18 195 | adv | gcv2, ecartement-corrige | flanc | pose | 15.0 | 12.8 → 2.8 | validation |
| 2-18 198 | adv | gcv2, ecartement-corrige | flanc | pose | 9.8 | 9.6 → 4.7 | validation |
| 2-18 206 | adv | gcv2, ecartement-corrige | flanc | pose | 10.9 | 10.2 → 0.8 | validation |
| 2-19 4863 | abords | gcv2, sous-tau-coherent | flanc | pose | 5.2 | 7.9 → 4.0 | validation |
| 2-19 5030 | abords | gcv2, ecartement-corrige | flanc | pose | 5.9 | 6.0 → 3.3 | validation |
| 2-19 5035 | adv | gcv2 | flanc | pose | 5.5 | 8.2 → 3.3 | validation |
| 2-19 5054 | adv | gcv2, ecartement-corrige | flanc | pose | 6.8 | 5.9 → 1.8 | validation |
| 2-19 5076 | adv | gcv2, ecartement-corrige | flanc | pose | 7.4 | 8.4 → 2.5 | validation |
| 2-19 5077 | adv | gcv2, ecartement-corrige | flanc | pose | 5.6 | 6.5 → 0.9 | validation |
| 2-19 5213 | adv | gcv2, ecartement-corrige | flanc | pose | 5.5 | 7.4 → 2.2 | validation |
| 2-19 5214 | adv | gcv2, ecartement-corrige | flanc | pose | 5.6 | 6.0 → 0.7 | validation |
| 2-20-fd7067f7 101 | adv | gcv2, ecartement-corrige | flanc | pose | 7.5 | 6.7 → 3.2 | validation |
| 2-20-fd7067f7 288 | adv | gcv2 | flanc | pose | 5.3 | 0.7 → 4.6 | validation |
| 2-20-f228f6f9 296 | adv | gcv2, ecartement-corrige | flanc | pose | 5.0 | 6.5 → 1.6 | validation |
| 2-20-f228f6f9 322 | adv | gcv2, consensus | flanc | pose | 7.3 | 6.5 → 2.9 | validation |
| 2-20-f228f6f9 363 | adv | gcv2 | flanc | pose | 7.5 | 8.0 → 3.3 | validation |
| 2-20-f228f6f9 365 | adv | gcv2, voie-voisins | ricochet | pose | 3.4 | 2.2 → 1.6 | validation |
| 2-20-f228f6f9 367 | adv | gcv2, voie-voisins | ricochet | pose | 3.4 | 5.2 → 5.2 | validation |
| 2-20-f228f6f9 368 | adv | gcv2, voie-voisins | ricochet | pose | 3.4 | 6.8 → 6.8 | validation |
| 2-20-f228f6f9 369 | adv | gcv2, voie-voisins | ricochet | pose | 1.5 | 8.5 → 8.5 | validation |
| 2-20-f228f6f9 428 | adv | gcv2, ecartement-corrige | flanc | pose | 7.5 | 12.3 → 8.2 | validation |
| 2-20-f228f6f9 429 | adv | gcv2, ecartement-corrige | flanc | pose | 10.0 | 8.7 → 5.1 | validation |
| 2-20-f228f6f9 433 | adv | gcv2, recherche-adv-remplace | flanc | pose | 5.0 | 10.9 → 10.9 | validation |
| 2-20-f228f6f9 440 | adv | gcv2 | flanc | pose | 7.0 | 7.2 → 7.2 | validation |
| 2-20-f228f6f9 441 | adv | gcv2 | flanc | pose | 6.8 | 5.7 → 4.7 | validation |
| 2-20-f228f6f9 444 | adv | gcv2 | flanc | pose | 7.6 | 4.8 → 3.0 | validation |
| 2-20-f228f6f9 468 | adv | gcv2 | flanc | pose | 7.3 | 7.0 → 4.7 | validation |
| 2-20-f228f6f9 480 | adv | gcv2 | flanc | pose | 5.4 | 5.1 → 2.8 | validation |
| 2-20-f228f6f9 503 | adv | gcv2 | flanc | pose | 5.3 | 5.7 → 4.2 | validation |
| 2-20-f228f6f9 509 | adv | gcv2 | flanc | pose | 7.9 | 8.7 → 2.7 | validation |
| 2-20-f228f6f9 511 | adv | gcv2, voie-voisins | flanc | pose | 7.6 | 9.7 → 7.3 | validation |
| 2-20-f228f6f9 512 | adv | gcv2, voie-voisins | ricochet | pose | 9.2 | 3.2 → 12.2 | validation |
| 2-20-f228f6f9 515 | adv | gcv2, voie-voisins | ricochet | pose | 8.1 | 3.5 → 11.6 | validation |
| 3-0 496 | abords | gcv2 | flanc | pose | 12.3 | - → - | aucune |
| 3-0 779 | adv | gcv2, ecartement-corrige | flanc | pose | 8.3 | - → - | aucune |
| 3-0 797 | adv | gcv2, branche | flanc | pose | 10.3 | 10.3 → 2.9 | validation |
| 3-0 842 | adv | gcv2, recherche-adv | flanc | pose | 6.4 | 11.3 → 11.4 | validation |
| 3-0 858 | adv | gcv2, branche | flanc | pose | 9.2 | 11.6 → 11.6 | validation |
| 0-2310-lot1 4 | abords | gcv2 | flanc | pose | 10.5 | 1.0 → 10.2 | visité sans action |
| 0-2310-lot1 167 | abords | gcv2, branche | flanc | pose | 5.4 | 19.1 → 18.7 | validation |
| 0-2310-lot1 193 | adv | gcv2 | flanc | pose | 13.1 | 0.5 → 12.6 | visité sans action |
| 0-2310-lot1 289 | adv | gcv2, ecartement-corrige | flanc | pose | 8.1 | 20.6 → 20.6 | validation |
| 0-2310-lot1 293 | adv | gcv2, ecartement-corrige | flanc | pose | 6.0 | 4.3 → 1.8 | validation |
| 0-2310-lot1 294 | adv | gcv2, ecartement-corrige | flanc | pose | 5.7 | 4.3 → 1.8 | validation |
| 0-2310-lot1 996 | adv | gcv2 | flanc | pose | 10.9 | 6.8 → 6.3 | validation |
| 0-2310-lot2 293 | adv | gcv2, ecartement-corrige | flanc | pose | 6.0 | 4.3 → 1.8 | validation |
| 0-2310-lot2 902 | adv | gcv2, ecartement-corrige | flanc | pose | 6.0 | 6.4 → 4.3 | validation |
| 0-2310-lot2 1122 | adv | gcv2, recherche-adv | ricochet | pose | 2.0 | 4.7 → 4.7 | validation |
| 0-2310-lot2 1123 | adv | gcv2, ecartement-corrige | flanc | pose | 15.5 | 14.0 → 2.3 | validation |
| 0-2310-lot2 1170 | adv | gcv2, ecartement-corrige | flanc | pose | 16.8 | 47.0 → 47.0 | validation |

### Cuts nommés d'avance
- 2-17 9803 : CHANGÉ, touché ; état pose ; écart à la vérité 18.7 → 29.1 mm (validation)
- 2-20-fd7067f7 288 : CHANGÉ, touché ; état pose ; écart à la vérité 0.7 → 4.6 mm (validation)
- 0-2310-lot1 4 : CHANGÉ, touché ; état pose ; écart à la vérité 1.0 → 10.2 mm (visité sans action)

## Lecture (ÉTABLI, sur ces 12 lots)
- **Cuts touchés** : 51, dont 48 jugés. 35 rapprochés de la vérité, 5 éloignés, 8 égaux ; médiane de l'écart 7,1 → 4,1 mm ; 6 passent sous 10 mm, **2 justes passent au-delà** (0-2310-lot1 4 et 193). Sur les 45 poses que l'opérateur avait retouchées : 35 rapprochées, 2 éloignées. Les 3 poses qu'il avait validées telles quelles sont déplacées de 5,3, 10,5 et 13,1 mm.
- **Les trois cuts nommés d'avance** (ceux que le latéral de CH-121 avait dégradés) sont tous touchés et dégradés : 2-17 9803 (18,7 → 29,1 mm), 2-20-fd7067f7 288 (0,7 → 4,6), 0-2310-lot1 4 (1,0 → 10,2). Le seuil de 5 mm, le suivi du flanc et la garde du flanc propre ne les protègent pas.
- **Ricochets** (propagation « A ») : 9 poses déplacées sur des cuts non touchés, dont 3 justes passés au-delà de 10 mm (2-17 9652, 2-20-f228f6f9 512 et 515, poses « voie-voisins » qui suivent le voisin mesuré). Aucun état changé.

## Diagnostic a posteriori, lu au journal de la mesure (`l1.flanc` des rejeux ; octobre est donc « vu » pour le travers)
| cuts touchés jugés | cuts | rapprochés | éloignés | justes perdus | gagnés |
|---|---|---|---|---|---|
| tous | 48 | 35 | 5 | 2 | 6 |
| paire corrigée par l'écartement de la liste (motifs « ecartement-corrige » et « valider » corrigé), les deux rails mesurés | 34 | 28 | 2 | 1 | — |
| paire non corrigée (« valider ») | 4 | 2 | 2 | 1 | — |
| « recherche-adv » (cellules déjà mesurées) | 2 | 0 | 1 | 0 | — |
| déplacement de 10 mm au plus | 37 | 28 | 2 | 0 | 1 |
| déplacement de plus de 10 mm | 11 | 7 | 3 | 2 | 5 |
- Mesure restreinte, après coup, au SEUL rail que la correction d'écartement a déplacé : 29 cuts déplacés et jugés, 22 rapprochés, 2 éloignés, 2 gagnés, 1 juste perdu (0-2310-lot1 193 : rail ramené à l'écartement de la liste, validé tel quel à 0,5 mm ; le flanc lu, 122 points, est à 13,1 mm). La restriction ne suffit donc pas.
- Une borne « à 10 mm de la référence de la liste, ou pas plus loin qu'avant » bloquerait 8 cuts, dont 6 rapprochés et 5 des 6 gagnés : le vrai écartement s'écarte de la liste de plus de 10 mm là où la mesure gagne. Mauvaise garde.
- Les fautes (4, 193, 288) sont des poses justes où le nuage porte, à 5 à 13 mm, une autre face dense et aucun point là où la convention attend le flanc (part d'appui de 0 à 9 %). Aucun critère local essayé ici ne les distingue des 35 vraies corrections.
