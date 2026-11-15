# CH-127 : garde d'octobre de B' sous N, et décision (ÉTABLI, 15/11)

Patch `Bprime-puce-tronc.patch`, modèle `CH-122/modeles/B/puce-figeB-0511.json` (sha256 fd0262cc…, appris sur les 6 lots réglables). Garde du banc : `garde d'octobre au banc, réglage « Bp » : retour 1 ; 30 recul(s) dont 24 RÉEL(S) et 6 « verts changés » ; rejeux 861 s`.

## Décision selon la règle écrite d'avance (`cible.md`, arrêt à la garde, R1)
- N refuse 6 poses de B' (0-2310-lot1 1135 ; lot2 1328, 1329, 1331, 1332, 1334), posées à 143-214 mm de la vérité : les mauvaises voies nouvelles de CH-122 ne passent plus.
- **(a) violé** : une pose nouvelle à 101,3 mm de la vérité (0-2310-lot1/1366, passe) que N a JUGÉE et laissée passer : son milieu est à 13,4 mm de l'axe. N ne la voit pas : l'erreur n'est pas en travers de la voie relevée.
- **(c) violé** : 32 justes du tronc passent au-delà de 10 mm (jusqu'à 35,6 mm ; 20 sur 2-20-f228f6f9, 7 sur 2-19), et 18 justes sont perdus en différé, non compensés (reglage-9 : 3 reposés justes pour 3 perdus ; terrain du 23/10 : 2 pour 15).
- (b) 43 poses nouvelles sur 380 jugées au-delà de 10 mm (11,3 %, au-dessus d'une sur dix) ; (d) tenu (0 pose de la chaîne touchée). N a jugé 395 des 397 poses nouvelles (muet 2, « bout de liste »).
- **B' reste ÉCARTÉ.** Corpus non rejoué (les comptes de (a) et (c) ne peuvent que croître).
- Cause, mesurée : comme à CH-122, la puce déplace des poses justes de la GCV2 de 10 à 35 mm (modèle appris en novembre, régime d'octobre différent) ; ces écarts sont bien en deçà des 75 mm de N.

## Bp contre N (garde)

Cuts comparés : 2362 ; identiques (profil L1-se : état, pose, source, passe, refus) : 1906 ; changés : 456.

| type | cuts |
|---|---|
| pose GCV2 déplacée | 383 |
| autre (état ou source, pose égale) | 36 |
| pose nouvelle (différé → posé) | 14 |
| pose GCV2 perdue | 23 |

Poses nouvelles : 397 (N a jugé 395, muet 2, sans ancre 0) ; jugées : 380 ; à 10 mm au plus : 337 ; 10 à 50 mm : 42 ; au-delà de 50 mm : 1 ; sans vérité : 17.
Différés du tronc reposés justes : 5.
Refus de N en plus : 6 (0-2310-lot1/1135 pose refusée à 178.1 mm de la vérité ; 0-2310-lot2/1328 pose refusée à 213.6 mm de la vérité ; 0-2310-lot2/1329 pose refusée à 175.1 mm de la vérité ; 0-2310-lot2/1331 pose refusée à 150.8 mm de la vérité ; 0-2310-lot2/1332 pose refusée à 143.2 mm de la vérité ; 0-2310-lot2/1334 pose refusée à 195.7 mm de la vérité) ; en moins : 0.

## Règle (§ 4 du ticket), sur ce jeu seul

- (a) poses nouvelles à plus de 50 mm : **1** : 0-2310-lot1/1366 101.3 mm
- (b) poses nouvelles jugées à plus de 10 mm : **43 sur 380** : 2-6/4756 16.6 mm ; 2-7/5901 12.1 mm ; 2-11/6456 11.0 mm ; 2-17/9652 11.1 mm ; 2-17/9653 10.6 mm ; 2-18/153 34.7 mm ; 2-18/292 13.5 mm ; 2-18/467 30.8 mm ; 2-19/5034 32.1 mm ; 2-19/5040 34.9 mm ; 2-19/5141 24.3 mm ; 2-19/5155 23.1 mm ; 2-19/5246 26.1 mm ; 2-19/5279 19.5 mm ; 2-19/5285 24.7 mm ; 2-20-f228f6f9/371 13.0 mm ; 2-20-f228f6f9/392 18.5 mm ; 2-20-f228f6f9/400 23.9 mm ; 2-20-f228f6f9/410 27.1 mm ; 2-20-f228f6f9/414 19.0 mm ; 2-20-f228f6f9/418 16.7 mm ; 2-20-f228f6f9/426 23.1 mm ; 2-20-f228f6f9/433 22.7 mm ; 2-20-f228f6f9/437 21.4 mm ; 2-20-f228f6f9/440 23.6 mm ; 2-20-f228f6f9/441 18.1 mm ; 2-20-f228f6f9/444 21.4 mm ; 2-20-f228f6f9/447 26.3 mm ; 2-20-f228f6f9/449 23.9 mm ; 2-20-f228f6f9/458 23.8 mm ; 2-20-f228f6f9/467 22.4 mm ; 2-20-f228f6f9/468 23.0 mm ; 2-20-f228f6f9/470 26.0 mm ; 2-20-f228f6f9/480 30.7 mm ; 2-20-f228f6f9/488 29.9 mm ; 2-20-f228f6f9/493 35.6 mm ; 3-0/797 17.7 mm ; 0-2310-lot1/193 19.2 mm ; 0-2310-lot1/216 39.2 mm ; 0-2310-lot1/941 29.8 mm ; 0-2310-lot1/1133 11.2 mm ; 0-2310-lot1/1366 101.3 mm ; 0-2310-lot2/1357 17.0 mm
- (c) justes du tronc passés au-delà de 10 mm : **32** : 2-17/9652 2.6 → 11.1 mm ; 2-17/9653 3.3 → 10.6 mm ; 2-18/292 5.9 → 13.5 mm ; 2-19/5034 5.6 → 32.1 mm ; 2-19/5040 6.3 → 34.9 mm ; 2-19/5141 0.5 → 24.3 mm ; 2-19/5155 2.5 → 23.1 mm ; 2-19/5246 3.1 → 26.1 mm ; 2-19/5279 3.1 → 19.5 mm ; 2-19/5285 4.0 → 24.7 mm ; 2-20-f228f6f9/371 2.8 → 13.0 mm ; 2-20-f228f6f9/392 3.6 → 18.5 mm ; 2-20-f228f6f9/400 4.6 → 23.9 mm ; 2-20-f228f6f9/410 4.2 → 27.1 mm ; 2-20-f228f6f9/414 2.3 → 19.0 mm ; 2-20-f228f6f9/418 5.1 → 16.7 mm ; 2-20-f228f6f9/426 3.9 → 23.1 mm ; 2-20-f228f6f9/437 7.9 → 21.4 mm ; 2-20-f228f6f9/440 7.2 → 23.6 mm ; 2-20-f228f6f9/441 5.7 → 18.1 mm ; 2-20-f228f6f9/444 4.8 → 21.4 mm ; 2-20-f228f6f9/447 2.8 → 26.3 mm ; 2-20-f228f6f9/449 4.6 → 23.9 mm ; 2-20-f228f6f9/458 4.9 → 23.8 mm ; 2-20-f228f6f9/467 2.4 → 22.4 mm ; 2-20-f228f6f9/468 7.0 → 23.0 mm ; 2-20-f228f6f9/470 4.2 → 26.0 mm ; 2-20-f228f6f9/480 5.1 → 30.7 mm ; 2-20-f228f6f9/488 3.2 → 29.9 mm ; 2-20-f228f6f9/493 3.5 → 35.6 mm ; 0-2310-lot1/193 0.5 → 19.2 mm ; 0-2310-lot1/941 0.8 → 29.8 mm ; justes perdus : **18** : 2-17/9553 (5.3 mm → differe/gcv2) ; 2-18/204 (2.0 mm → differe/gcv2) ; 2-18/205 (1.5 mm → differe/gcv2) ; 0-2310-lot1/51 (0.5 mm → differe/gcv2) ; 0-2310-lot1/52 (0.4 mm → differe/gcv2) ; 0-2310-lot1/1137 (6.6 mm → differe/gcv2) ; 0-2310-lot1/1138 (5.4 mm → differe/gcv2) ; 0-2310-lot1/1139 (0.4 mm → differe/gcv2) ; 0-2310-lot2/1119 (1.9 mm → differe/gcv2) ; 0-2310-lot2/1122 (4.7 mm → differe/gcv2) ; 0-2310-lot2/1166 (3.1 mm → differe/gcv2) ; 0-2310-lot2/1167 (5.7 mm → differe/gcv2) ; 0-2310-lot2/1168 (9.7 mm → differe/gcv2) ; 0-2310-lot2/1169 (2.3 mm → differe/gcv2) ; 0-2310-lot2/1171 (2.2 mm → differe/gcv2) ; 0-2310-lot2/1172 (5.8 mm → differe/gcv2) ; 0-2310-lot2/1173 (5.4 mm → differe/gcv2) ; 0-2310-lot2/1174 (4.1 mm → differe/gcv2)
- (c) compensation par groupe (reposés justes ≥ 3 × justes perdus) : reglage-9 3/3 NON ; partie-3:0 0/0 ; terrain-partie-0-23-10 2/15 NON
- (d) poses de la chaîne déplacées ou perdues : **0**

## Cuts changés

| lot | cut | type | référence | réglage | réf. → vérité (mm) | réglage → vérité (mm) | déplacement (mm) | N | refus N |
|---|---|---|---|---|---|---|---|---|---|
| 2-6 | 3399 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.6 | 7.7 | 2.1 | jugé |  |
| 2-6 | 3433 | autre (état ou source, pose égale) | differe/gcv2 | differe/gcv2 |  |  |  |  |  |
| 2-6 | 3722 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 2.0 | 2.2 | jugé |  |
| 2-6 | 4654 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 2.3 | 1.9 | jugé |  |
| 2-6 | 4725 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 16.5 | 5.0 | 21.5 | jugé |  |
| 2-6 | 4756 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 16.6 |  | jugé |  |
| 2-7 | 3220 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 8.7 |  | jugé |  |
| 2-7 | 4413 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 4.2 | 1.8 | jugé |  |
| 2-7 | 4724 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 2.3 | 1.9 | jugé |  |
| 2-7 | 4766 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 11.3 | 3.7 | 14.7 | jugé |  |
| 2-7 | 5576 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 9.0 | 6.9 | 2.1 | jugé |  |
| 2-7 | 5638 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.5 | 2.3 | 2.4 | jugé |  |
| 2-7 | 5821 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.5 | 4.5 | 3.1 | jugé |  |
| 2-7 | 5901 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 12.1 |  | jugé |  |
| 2-11 | 6455 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.2 | 8.0 | 1.1 | jugé |  |
| 2-11 | 6456 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 11.9 | 11.0 | 5.6 | jugé |  |
| 2-11 | 6457 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.7 | 3.0 | 4.0 | jugé |  |
| 2-11 | 7320 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 6.3 |  | jugé |  |
| 2-11 | 7419 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.5 | 4.5 | 3.4 | jugé |  |
| 2-11 | 8284 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.3 | 4.6 | 1.0 | jugé |  |
| 2-11 | 8292 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 6.6 | 6.6 | 0.2 | jugé |  |
| 2-13 | 3533 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 18.5 | jugé |  |
| 2-17 | 9552 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 5.4 | 5.6 | 0.3 | jugé |  |
| 2-17 | 9553 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 5.3 |  |  |  |  |
| 2-17 | 9554 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 2.6 | 2.6 | 0.0 | jugé |  |
| 2-17 | 9556 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 3.3 | 2.7 | 0.8 | jugé |  |
| 2-17 | 9557 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 4.2 | 4.0 | 0.7 | jugé |  |
| 2-17 | 9648 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.5 | 3.0 | 6.7 | jugé |  |
| 2-17 | 9649 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.6 | 1.8 | 6.9 | jugé |  |
| 2-17 | 9650 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.4 | 2.8 | 4.7 | jugé |  |
| 2-17 | 9651 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.0 | 3.3 | 5.7 | jugé |  |
| 2-17 | 9652 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.6 | 11.1 | 9.5 | jugé |  |
| 2-17 | 9653 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.3 | 10.6 | 9.2 | jugé |  |
| 2-18 | 14 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 7.1 | muet : bout-de-liste |  |
| 2-18 | 36 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 8.8 | jugé |  |
| 2-18 | 37 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 10.1 | jugé |  |
| 2-18 | 38 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 5.2 | jugé |  |
| 2-18 | 88 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 6.5 | 6.9 | 0.4 | jugé |  |
| 2-18 | 153 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 34.7 |  | jugé |  |
| 2-18 | 195 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 12.8 | 7.6 | 12.9 | jugé |  |
| 2-18 | 198 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 9.6 | 4.6 | 6.9 | jugé |  |
| 2-18 | 199 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 4.4 | 4.3 | 0.2 | jugé |  |
| 2-18 | 200 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 1.8 | 2.2 | 0.8 | jugé |  |
| 2-18 | 204 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 2.0 |  |  |  |  |
| 2-18 | 205 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 1.5 |  |  |  |  |
| 2-18 | 206 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 10.2 |  |  |  |  |
| 2-18 | 292 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.9 | 13.5 | 15.3 | jugé |  |
| 2-18 | 298 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 2.9 | 2.8 | 0.6 | jugé |  |
| 2-18 | 323 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 2.4 | 2.9 | jugé |  |
| 2-18 | 452 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 3.1 | 3.4 | 0.6 | jugé |  |
| 2-18 | 467 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 10.5 | 30.8 | 41.3 | jugé |  |
| 2-19 | 4864 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 3.1 | 2.0 | jugé |  |
| 2-19 | 5031 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 2.8 | 2.7 | jugé |  |
| 2-19 | 5032 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.6 | 2.3 | 1.8 | jugé |  |
| 2-19 | 5034 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.6 | 32.1 | 26.5 | jugé |  |
| 2-19 | 5035 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.2 | 2.6 | 5.8 | jugé |  |
| 2-19 | 5037 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.0 | 1.9 | 4.7 | jugé |  |
| 2-19 | 5038 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.6 | 1.4 | 6.4 | jugé |  |
| 2-19 | 5040 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.3 | 34.9 | 28.7 | jugé |  |
| 2-19 | 5041 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.1 | 3.1 | 4.0 | jugé |  |
| 2-19 | 5042 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.6 | 4.6 | 2.3 | jugé |  |
| 2-19 | 5043 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.4 | 3.3 | 4.0 | jugé |  |
| 2-19 | 5044 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 1.9 | 3.6 | jugé |  |
| 2-19 | 5045 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.1 | 2.1 | 2.7 | jugé |  |
| 2-19 | 5046 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.0 | 1.3 | 5.2 | jugé |  |
| 2-19 | 5047 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.3 | 1.5 | 5.4 | jugé |  |
| 2-19 | 5048 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.3 | 2.1 | 5.6 | jugé |  |
| 2-19 | 5050 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.6 | 0.8 | 4.7 | jugé |  |
| 2-19 | 5051 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.8 | 6.2 | 5.8 | jugé |  |
| 2-19 | 5052 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.2 | 2.7 | 4.2 | jugé |  |
| 2-19 | 5053 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 2.0 | 5.2 | jugé |  |
| 2-19 | 5054 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.9 | 2.1 | 7.1 | jugé |  |
| 2-19 | 5055 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.0 | 2.6 | 5.0 | jugé |  |
| 2-19 | 5056 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.6 | 3.0 | 4.6 | jugé |  |
| 2-19 | 5057 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.4 | 1.2 | 4.4 | jugé |  |
| 2-19 | 5058 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.2 | 3.6 | 2.1 | jugé |  |
| 2-19 | 5063 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.4 | 2.6 | 3.1 | jugé |  |
| 2-19 | 5064 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.2 | 3.7 | 2.2 | jugé |  |
| 2-19 | 5065 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 2.5 | 1.4 | jugé |  |
| 2-19 | 5066 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 0.5 | 2.5 | jugé |  |
| 2-19 | 5067 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.6 | 2.7 | 3.1 | jugé |  |
| 2-19 | 5068 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 2.4 | 1.6 | jugé |  |
| 2-19 | 5069 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.8 | 5.3 | 4.0 | jugé |  |
| 2-19 | 5072 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 2.3 | 1.6 | jugé |  |
| 2-19 | 5073 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.4 | 2.5 | 1.9 | jugé |  |
| 2-19 | 5074 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.6 | 1.6 | 4.5 | jugé |  |
| 2-19 | 5075 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 3.7 | 3.6 | jugé |  |
| 2-19 | 5076 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.4 | 2.2 | 7.5 | jugé |  |
| 2-19 | 5077 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.5 | 1.1 | 5.8 | jugé |  |
| 2-19 | 5078 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.5 | 1.8 | 6.0 | jugé |  |
| 2-19 | 5079 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 2.1 | 6.2 | jugé |  |
| 2-19 | 5080 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.9 | 2.6 | 4.1 | jugé |  |
| 2-19 | 5081 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 2.2 | 2.0 | jugé |  |
| 2-19 | 5083 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.0 | 4.1 | 3.1 | jugé |  |
| 2-19 | 5086 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.3 | 2.3 | 1.1 | jugé |  |
| 2-19 | 5087 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.9 | 1.3 | 1.6 | jugé |  |
| 2-19 | 5090 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.4 | 2.7 | 2.9 | jugé |  |
| 2-19 | 5091 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.9 | 1.4 | 3.7 | jugé |  |
| 2-19 | 5092 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.6 | 3.0 | 2.2 | jugé |  |
| 2-19 | 5097 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.7 | 2.3 | 3.5 | jugé |  |
| 2-19 | 5098 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 2.8 | 3.3 | jugé |  |
| 2-19 | 5102 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 3.9 | 4.1 | jugé |  |
| 2-19 | 5104 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 3.2 | jugé |  |
| 2-19 | 5106 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.6 | 4.5 | 4.6 | jugé |  |
| 2-19 | 5107 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.9 | 2.9 | 1.2 | jugé |  |
| 2-19 | 5111 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.9 | 1.6 | 1.9 | jugé |  |
| 2-19 | 5113 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.5 | 3.5 | 3.5 | jugé |  |
| 2-19 | 5116 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.8 | 2.9 | 3.1 | jugé |  |
| 2-19 | 5117 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 2.4 | 3.8 | jugé |  |
| 2-19 | 5118 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.7 | 2.1 | 2.0 | jugé |  |
| 2-19 | 5119 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 1.6 | 1.6 | jugé |  |
| 2-19 | 5120 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.7 | 2.8 | 1.9 | jugé |  |
| 2-19 | 5121 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 1.6 | jugé |  |
| 2-19 | 5123 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.2 | 0.6 | 1.4 | jugé |  |
| 2-19 | 5125 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 2.3 | 1.0 | jugé |  |
| 2-19 | 5127 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 1.5 | 4.6 | jugé |  |
| 2-19 | 5128 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 2.0 | 2.8 | jugé |  |
| 2-19 | 5129 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.4 | 1.8 | 1.6 | jugé |  |
| 2-19 | 5130 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.6 | 2.1 | 2.5 | jugé |  |
| 2-19 | 5132 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.1 | 5.2 | 2.2 | jugé |  |
| 2-19 | 5133 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 1.2 | 2.1 | jugé |  |
| 2-19 | 5135 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.1 | 3.9 | 2.1 | jugé |  |
| 2-19 | 5137 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.4 | 2.6 | 2.6 | jugé |  |
| 2-19 | 5139 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.2 | 3.7 | 2.5 | jugé |  |
| 2-19 | 5140 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.1 | 3.1 | 2.5 | jugé |  |
| 2-19 | 5141 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.5 | 24.3 | 24.4 | jugé |  |
| 2-19 | 5143 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 0.9 | 1.5 | jugé |  |
| 2-19 | 5145 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.6 | 1.5 | 1.4 | jugé |  |
| 2-19 | 5148 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 3.5 | 1.8 | jugé |  |
| 2-19 | 5149 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.3 | 3.2 | 2.9 | jugé |  |
| 2-19 | 5151 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 2.1 | 1.2 | jugé |  |
| 2-19 | 5152 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.8 | 0.9 | 2.7 | jugé |  |
| 2-19 | 5153 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 1.7 | 1.0 | jugé |  |
| 2-19 | 5155 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 23.1 | 22.0 | jugé |  |
| 2-19 | 5156 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 1.3 | 1.4 | jugé |  |
| 2-19 | 5161 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.4 | 3.2 | 2.5 | jugé |  |
| 2-19 | 5162 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 1.5 | 3.2 | jugé |  |
| 2-19 | 5164 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 2.6 | 1.7 | jugé |  |
| 2-19 | 5165 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 2.6 | 2.6 | 0.2 | jugé |  |
| 2-19 | 5166 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 2.3 | 2.4 | 0.2 | jugé |  |
| 2-19 | 5170 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.5 | 1.9 | 2.0 | jugé |  |
| 2-19 | 5171 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.3 | 2.1 | 2.5 | jugé |  |
| 2-19 | 5172 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 2.3 | 2.0 | jugé |  |
| 2-19 | 5173 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.7 | 1.7 | 1.3 | jugé |  |
| 2-19 | 5175 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 1.7 | 1.5 | jugé |  |
| 2-19 | 5181 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.3 | 1.2 | 1.2 | jugé |  |
| 2-19 | 5183 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 2.6 | 3.1 | jugé |  |
| 2-19 | 5184 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.9 | 3.9 | 4.0 | jugé |  |
| 2-19 | 5185 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.7 | 1.6 | 1.7 | jugé |  |
| 2-19 | 5186 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 1.7 | 1.3 | jugé |  |
| 2-19 | 5187 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.9 | 2.3 | 2.5 | jugé |  |
| 2-19 | 5188 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.9 | 1.9 | 1.2 | jugé |  |
| 2-19 | 5190 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.4 | 2.1 | 1.7 | jugé |  |
| 2-19 | 5193 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 2.0 | 2.3 | jugé |  |
| 2-19 | 5194 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.2 | 2.4 | 2.2 | jugé |  |
| 2-19 | 5195 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.9 | 2.9 | 1.1 | jugé |  |
| 2-19 | 5198 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 2.6 | 1.0 | jugé |  |
| 2-19 | 5200 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 0.4 | 3.8 | jugé |  |
| 2-19 | 5202 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.6 | 1.1 | 3.7 | jugé |  |
| 2-19 | 5203 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 3.9 | 1.2 | jugé |  |
| 2-19 | 5204 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 0.8 | 2.3 | jugé |  |
| 2-19 | 5207 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.9 | 4.0 | 2.9 | jugé |  |
| 2-19 | 5208 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.8 | 2.0 | 4.8 | jugé |  |
| 2-19 | 5210 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.4 | 3.0 | 2.6 | jugé |  |
| 2-19 | 5211 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.5 | 3.1 | 4.5 | jugé |  |
| 2-19 | 5212 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.4 | 2.9 | 3.2 | jugé |  |
| 2-19 | 5213 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.4 | 1.9 | 6.5 | jugé |  |
| 2-19 | 5214 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.0 | 0.5 | 6.2 | jugé |  |
| 2-19 | 5215 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.8 | 1.2 | 4.9 | jugé |  |
| 2-19 | 5218 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.8 | 3.0 | 1.6 | jugé |  |
| 2-19 | 5219 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 1.6 | 3.8 | jugé |  |
| 2-19 | 5223 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.4 | 1.5 | 1.1 | jugé |  |
| 2-19 | 5224 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.4 | 0.9 | 1.1 | jugé |  |
| 2-19 | 5225 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.2 | 1.4 | 2.4 | jugé |  |
| 2-19 | 5228 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 2.1 | 1.1 | jugé |  |
| 2-19 | 5230 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.4 | 1.8 | 4.5 | jugé |  |
| 2-19 | 5233 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.7 | 2.5 | 1.6 | jugé |  |
| 2-19 | 5236 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.0 | 2.9 | 2.3 | jugé |  |
| 2-19 | 5237 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.0 | 3.8 | 3.5 | jugé |  |
| 2-19 | 5238 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.8 | 3.8 | 1.8 | jugé |  |
| 2-19 | 5240 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.5 | 2.6 | 4.9 | jugé |  |
| 2-19 | 5241 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.6 | 1.3 | 4.1 | jugé |  |
| 2-19 | 5242 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.3 | 2.0 | 3.8 | jugé |  |
| 2-19 | 5243 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 3.7 | 1.6 | jugé |  |
| 2-19 | 5245 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.5 | 0.9 | 1.2 | jugé |  |
| 2-19 | 5246 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 26.1 | 28.3 | jugé |  |
| 2-19 | 5248 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 3.2 | 1.6 | jugé |  |
| 2-19 | 5250 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 1.2 | 1.7 | jugé |  |
| 2-19 | 5253 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.9 | 0.7 | 1.5 | jugé |  |
| 2-19 | 5254 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.8 | 1.8 | 1.6 | jugé |  |
| 2-19 | 5255 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.5 | 4.5 | 1.1 | jugé |  |
| 2-19 | 5258 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 1.7 | 1.5 | jugé |  |
| 2-19 | 5259 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 2.1 | 2.6 | jugé |  |
| 2-19 | 5260 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 1.9 | 1.3 | jugé |  |
| 2-19 | 5261 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 1.9 | 2.6 | jugé |  |
| 2-19 | 5262 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 2.6 | 1.7 | jugé |  |
| 2-19 | 5263 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 2.6 | 2.2 | jugé |  |
| 2-19 | 5264 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 1.8 | 1.3 | jugé |  |
| 2-19 | 5265 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 2.2 | 3.2 | jugé |  |
| 2-19 | 5266 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.0 | 2.1 | 3.2 | jugé |  |
| 2-19 | 5267 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.6 | 2.0 | 1.6 | jugé |  |
| 2-19 | 5269 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.2 | 2.5 | 1.6 | jugé |  |
| 2-19 | 5270 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 2.2 | 1.6 | jugé |  |
| 2-19 | 5273 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.0 | 5.1 | 3.3 | jugé |  |
| 2-19 | 5274 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.1 | 2.5 | 2.9 | jugé |  |
| 2-19 | 5275 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 2.7 | 1.0 | jugé |  |
| 2-19 | 5277 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 1.5 | 1.6 | jugé |  |
| 2-19 | 5279 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 19.5 | 21.7 | jugé |  |
| 2-19 | 5282 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 1.6 | 1.1 | jugé |  |
| 2-19 | 5284 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.8 | 4.6 | 1.2 | jugé |  |
| 2-19 | 5285 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.0 | 24.7 | 20.7 | jugé |  |
| 2-19 | 5286 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 2.9 | 4.6 | jugé |  |
| 2-19 | 5287 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.6 | 1.3 | 1.2 | jugé |  |
| 2-19 | 5288 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 2.6 | 2.4 | jugé |  |
| 2-19 | 5289 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.0 | 8.4 | 8.0 | jugé |  |
| 2-19 | 5290 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.2 | 2.5 | 2.5 | jugé |  |
| 2-19 | 5291 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.2 | 2.6 | 2.0 | jugé |  |
| 2-19 | 5292 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.0 | 1.9 | 1.9 | jugé |  |
| 2-20-fd7067f7 | 49 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 4.3 | 3.8 | 0.6 | jugé |  |
| 2-20-fd7067f7 | 101 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.7 | 3.7 | 9.5 | jugé |  |
| 2-20-fd7067f7 | 288 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.7 | 5.2 | 5.8 | jugé |  |
| 2-20-fd7067f7 | 289 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 1.6 | 4.6 | jugé |  |
| 2-20-fd7067f7 | 290 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.0 | 3.6 | 4.5 | jugé |  |
| 2-20-fd7067f7 | 291 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 2.0 | 2.1 | jugé |  |
| 2-20-f228f6f9 | 291 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.4 | 2.0 | 4.6 | jugé |  |
| 2-20-f228f6f9 | 292 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.5 | 1.9 | 3.0 | jugé |  |
| 2-20-f228f6f9 | 293 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.4 | 1.6 | 3.8 | jugé |  |
| 2-20-f228f6f9 | 294 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 1.6 | 3.1 | jugé |  |
| 2-20-f228f6f9 | 295 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.7 | 1.9 | 3.9 | jugé |  |
| 2-20-f228f6f9 | 296 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.5 | 1.6 | 6.1 | jugé |  |
| 2-20-f228f6f9 | 297 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.4 | 1.3 | 4.3 | jugé |  |
| 2-20-f228f6f9 | 298 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.9 | 3.0 | 3.1 | jugé |  |
| 2-20-f228f6f9 | 299 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 1.8 | 3.6 | jugé |  |
| 2-20-f228f6f9 | 300 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 1.1 | 4.2 | jugé |  |
| 2-20-f228f6f9 | 301 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.1 | 1.6 | 3.8 | jugé |  |
| 2-20-f228f6f9 | 304 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.9 | 2.8 | 5.2 | jugé |  |
| 2-20-f228f6f9 | 305 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 0.9 | 1.9 | jugé |  |
| 2-20-f228f6f9 | 307 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.3 | 2.0 | 1.3 | jugé |  |
| 2-20-f228f6f9 | 308 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.5 | 4.5 | 3.0 | jugé |  |
| 2-20-f228f6f9 | 309 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 1.2 | 4.0 | jugé |  |
| 2-20-f228f6f9 | 311 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 3.6 | 1.8 | jugé |  |
| 2-20-f228f6f9 | 312 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 2.1 | 2.6 | jugé |  |
| 2-20-f228f6f9 | 313 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 2.3 | 2.7 | jugé |  |
| 2-20-f228f6f9 | 314 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 0.9 | 3.5 | jugé |  |
| 2-20-f228f6f9 | 316 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.8 | 2.1 | 1.9 | jugé |  |
| 2-20-f228f6f9 | 317 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.9 | 2.6 | 2.6 | jugé |  |
| 2-20-f228f6f9 | 318 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 2.1 | 2.8 | jugé |  |
| 2-20-f228f6f9 | 319 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 1.7 | 3.9 | jugé |  |
| 2-20-f228f6f9 | 320 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 4.2 | 2.1 | jugé |  |
| 2-20-f228f6f9 | 321 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 1.7 | 3.4 | jugé |  |
| 2-20-f228f6f9 | 322 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.5 | 2.7 | 8.1 | jugé |  |
| 2-20-f228f6f9 | 323 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.4 | 2.0 | 5.3 | jugé |  |
| 2-20-f228f6f9 | 324 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.7 | 2.1 | 3.0 | jugé |  |
| 2-20-f228f6f9 | 325 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.5 | 1.6 | 2.0 | jugé |  |
| 2-20-f228f6f9 | 327 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.6 | 2.1 | 1.4 | jugé |  |
| 2-20-f228f6f9 | 328 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.6 | 1.7 | 2.0 | jugé |  |
| 2-20-f228f6f9 | 330 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 2.4 | 3.8 | jugé |  |
| 2-20-f228f6f9 | 331 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 2.2 | 3.1 | jugé |  |
| 2-20-f228f6f9 | 332 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.1 | 1.8 | 3.9 | jugé |  |
| 2-20-f228f6f9 | 333 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 3.3 | 3.8 | jugé |  |
| 2-20-f228f6f9 | 334 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 1.8 | 3.3 | jugé |  |
| 2-20-f228f6f9 | 335 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 1.1 | 3.8 | jugé |  |
| 2-20-f228f6f9 | 336 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.4 | 3.6 | 5.4 | jugé |  |
| 2-20-f228f6f9 | 337 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 1.8 | 1.8 | jugé |  |
| 2-20-f228f6f9 | 338 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.0 | 2.5 | 1.8 | jugé |  |
| 2-20-f228f6f9 | 339 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.6 | 2.6 | 3.0 | jugé |  |
| 2-20-f228f6f9 | 340 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 2.4 | 2.6 | jugé |  |
| 2-20-f228f6f9 | 341 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 2.5 | 2.5 | jugé |  |
| 2-20-f228f6f9 | 342 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.6 | 1.6 | 1.7 | jugé |  |
| 2-20-f228f6f9 | 343 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 2.9 | 4.1 | jugé |  |
| 2-20-f228f6f9 | 344 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 2.9 | 4.6 | jugé |  |
| 2-20-f228f6f9 | 345 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 2.8 | 4.4 | jugé |  |
| 2-20-f228f6f9 | 346 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 3.8 | 2.5 | jugé |  |
| 2-20-f228f6f9 | 348 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.7 | 1.6 | 2.2 | jugé |  |
| 2-20-f228f6f9 | 349 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.7 | 3.8 | 1.2 | jugé |  |
| 2-20-f228f6f9 | 350 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.5 | 1.6 | 1.5 | jugé |  |
| 2-20-f228f6f9 | 351 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.3 | 1.3 | 1.6 | jugé |  |
| 2-20-f228f6f9 | 352 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 2.9 | 2.4 | jugé |  |
| 2-20-f228f6f9 | 354 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.2 | 3.5 | 2.5 | jugé |  |
| 2-20-f228f6f9 | 355 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.4 | 1.4 | 5.2 | jugé |  |
| 2-20-f228f6f9 | 356 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.8 | 2.0 | 8.3 | jugé |  |
| 2-20-f228f6f9 | 357 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.7 | 0.4 | 5.6 | jugé |  |
| 2-20-f228f6f9 | 361 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.1 | 0.6 | 5.4 | jugé |  |
| 2-20-f228f6f9 | 364 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.7 | 4.7 | 3.9 | jugé |  |
| 2-20-f228f6f9 | 365 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 1.6 | 3.7 | jugé |  |
| 2-20-f228f6f9 | 366 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.8 | 1.2 | 5.0 | jugé |  |
| 2-20-f228f6f9 | 367 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.2 | 2.3 | 6.4 | jugé |  |
| 2-20-f228f6f9 | 368 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.8 | 2.4 | 7.8 | jugé |  |
| 2-20-f228f6f9 | 369 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.5 | 1.2 | 8.6 | jugé |  |
| 2-20-f228f6f9 | 370 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.2 | 3.1 | 9.6 | jugé |  |
| 2-20-f228f6f9 | 371 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 13.0 | 14.1 | jugé |  |
| 2-20-f228f6f9 | 372 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.7 | 1.2 | 2.9 | jugé |  |
| 2-20-f228f6f9 | 373 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.3 | 1.6 | 2.3 | jugé |  |
| 2-20-f228f6f9 | 374 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.0 | 1.4 | 2.1 | jugé |  |
| 2-20-f228f6f9 | 375 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.3 | 2.3 | 1.2 | jugé |  |
| 2-20-f228f6f9 | 376 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 1.9 | 2.2 | jugé |  |
| 2-20-f228f6f9 | 379 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.7 | 2.1 | 3.7 | jugé |  |
| 2-20-f228f6f9 | 381 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.1 | 4.0 | 4.8 | jugé |  |
| 2-20-f228f6f9 | 384 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.5 | 4.3 | 1.4 | jugé |  |
| 2-20-f228f6f9 | 389 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.2 | 2.8 | 2.4 | jugé |  |
| 2-20-f228f6f9 | 391 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 2.3 | 1.9 | jugé |  |
| 2-20-f228f6f9 | 392 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 18.5 | 15.4 | jugé |  |
| 2-20-f228f6f9 | 393 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.2 | 3.5 | 5.6 | jugé |  |
| 2-20-f228f6f9 | 394 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 2.6 | 4.1 | jugé |  |
| 2-20-f228f6f9 | 398 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.7 | 4.1 | 4.2 | jugé |  |
| 2-20-f228f6f9 | 399 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.9 | 3.5 | 2.9 | jugé |  |
| 2-20-f228f6f9 | 400 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.6 | 23.9 | 28.5 | jugé |  |
| 2-20-f228f6f9 | 401 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 4.4 | 1.9 | jugé |  |
| 2-20-f228f6f9 | 402 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.7 | 3.7 | 2.1 | jugé |  |
| 2-20-f228f6f9 | 404 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.8 | 0.8 | 1.1 | jugé |  |
| 2-20-f228f6f9 | 405 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.2 | 1.9 | 2.8 | jugé |  |
| 2-20-f228f6f9 | 406 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.1 | 9.7 | 12.2 | jugé |  |
| 2-20-f228f6f9 | 407 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.2 | 6.0 | 1.1 | jugé |  |
| 2-20-f228f6f9 | 408 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 2.1 | 4.3 | jugé |  |
| 2-20-f228f6f9 | 409 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.0 | 2.6 | 3.2 | jugé |  |
| 2-20-f228f6f9 | 410 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.2 | 27.1 | 28.6 | jugé |  |
| 2-20-f228f6f9 | 411 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.0 | 4.6 | 1.1 | jugé |  |
| 2-20-f228f6f9 | 414 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.3 | 19.0 | 20.8 | jugé |  |
| 2-20-f228f6f9 | 417 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.1 | 2.1 | 2.8 | jugé |  |
| 2-20-f228f6f9 | 418 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.1 | 16.7 | 21.3 | jugé |  |
| 2-20-f228f6f9 | 419 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 3.2 | 2.8 | jugé |  |
| 2-20-f228f6f9 | 422 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.9 | 1.1 | 1.1 | jugé |  |
| 2-20-f228f6f9 | 426 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 23.1 | 19.3 | jugé |  |
| 2-20-f228f6f9 | 427 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.9 | 7.7 | 3.4 | jugé |  |
| 2-20-f228f6f9 | 428 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 12.3 | 6.4 | 6.4 | jugé |  |
| 2-20-f228f6f9 | 429 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.7 | 2.6 | 7.7 | jugé |  |
| 2-20-f228f6f9 | 430 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.5 | 4.0 | 5.4 | jugé |  |
| 2-20-f228f6f9 | 433 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 10.9 | 22.7 | 23.8 | jugé |  |
| 2-20-f228f6f9 | 437 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.9 | 21.4 | 29.2 | jugé |  |
| 2-20-f228f6f9 | 440 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.2 | 23.6 | 17.8 | jugé |  |
| 2-20-f228f6f9 | 441 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.7 | 18.1 | 23.7 | jugé |  |
| 2-20-f228f6f9 | 444 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.8 | 21.4 | 26.1 | jugé |  |
| 2-20-f228f6f9 | 446 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.6 | 2.9 | 1.6 | jugé |  |
| 2-20-f228f6f9 | 447 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.8 | 26.3 | 29.1 | jugé |  |
| 2-20-f228f6f9 | 449 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.6 | 23.9 | 28.0 | jugé |  |
| 2-20-f228f6f9 | 450 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.7 | 9.5 | 5.0 | jugé |  |
| 2-20-f228f6f9 | 451 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.5 | 2.9 | 1.2 | jugé |  |
| 2-20-f228f6f9 | 452 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.6 | 2.2 | 3.2 | jugé |  |
| 2-20-f228f6f9 | 453 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.7 | 3.5 | 2.8 | jugé |  |
| 2-20-f228f6f9 | 454 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 3.7 | 2.7 | jugé |  |
| 2-20-f228f6f9 | 455 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 1.3 | 1.2 | jugé |  |
| 2-20-f228f6f9 | 456 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.4 | 1.9 | 2.5 | jugé |  |
| 2-20-f228f6f9 | 458 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.9 | 23.8 | 28.6 | jugé |  |
| 2-20-f228f6f9 | 459 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.0 | 4.1 | 5.9 | jugé |  |
| 2-20-f228f6f9 | 464 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 1.9 | 4.0 | jugé |  |
| 2-20-f228f6f9 | 465 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.1 | 2.2 | 6.6 | jugé |  |
| 2-20-f228f6f9 | 467 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 22.4 | 24.8 | jugé |  |
| 2-20-f228f6f9 | 468 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.0 | 23.0 | 28.1 | jugé |  |
| 2-20-f228f6f9 | 470 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.2 | 26.0 | 27.1 | jugé |  |
| 2-20-f228f6f9 | 471 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.5 | 0.8 | 2.2 | jugé |  |
| 2-20-f228f6f9 | 472 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.3 | 3.0 | 4.6 | jugé |  |
| 2-20-f228f6f9 | 473 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 2.9 | 2.8 | jugé |  |
| 2-20-f228f6f9 | 474 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.2 | 2.4 | 3.2 | jugé |  |
| 2-20-f228f6f9 | 475 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.5 | 2.9 | 2.8 | jugé |  |
| 2-20-f228f6f9 | 476 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.3 | 4.5 | 3.1 | jugé |  |
| 2-20-f228f6f9 | 477 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.9 | 2.3 | 2.8 | jugé |  |
| 2-20-f228f6f9 | 480 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.1 | 30.7 | 28.1 | jugé |  |
| 2-20-f228f6f9 | 483 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.7 | 1.4 | 2.4 | jugé |  |
| 2-20-f228f6f9 | 484 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.4 | 2.9 | 4.4 | jugé |  |
| 2-20-f228f6f9 | 485 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.1 | 2.1 | 2.3 | jugé |  |
| 2-20-f228f6f9 | 488 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.2 | 29.9 | 32.8 | jugé |  |
| 2-20-f228f6f9 | 493 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.5 | 35.6 | 34.2 | jugé |  |
| 2-20-f228f6f9 | 494 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 7.7 | 3.1 | 5.0 | jugé |  |
| 2-20-f228f6f9 | 495 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.2 | 1.3 | 2.6 | jugé |  |
| 2-20-f228f6f9 | 496 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.0 | 2.0 | 2.9 | jugé |  |
| 2-20-f228f6f9 | 497 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.7 | 1.4 | 2.3 | jugé |  |
| 2-20-f228f6f9 | 498 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.2 | 2.8 | 3.2 | jugé |  |
| 2-20-f228f6f9 | 499 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 4.4 | 3.7 | jugé |  |
| 2-20-f228f6f9 | 502 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.3 | 1.5 | 3.9 | jugé |  |
| 2-20-f228f6f9 | 503 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.7 | 1.5 | 5.4 | jugé |  |
| 2-20-f228f6f9 | 504 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 5.8 | 1.2 | 5.1 | jugé |  |
| 2-20-f228f6f9 | 506 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.9 | 1.2 | 2.1 | jugé |  |
| 2-20-f228f6f9 | 507 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.2 | 1.1 | 3.9 | jugé |  |
| 2-20-f228f6f9 | 508 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 6.1 | 2.5 | 5.6 | jugé |  |
| 2-20-f228f6f9 | 509 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.7 | 2.4 | 8.0 | jugé |  |
| 2-20-f228f6f9 | 510 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 10.1 | 4.2 | 6.0 | jugé |  |
| 2-20-f228f6f9 | 511 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 9.7 | 1.9 | 9.9 | jugé |  |
| 2-20-f228f6f9 | 515 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 3.5 | 3.5 | 0.1 | jugé |  |
| 2-20-f228f6f9 | 649 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 4.6 |  | jugé |  |
| 3-0 | 97 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 5.2 | jugé |  |
| 3-0 | 496 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 15.5 | jugé |  |
| 3-0 | 777 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 1.6 | jugé |  |
| 3-0 | 778 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 4.0 | jugé |  |
| 3-0 | 779 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 7.4 | jugé |  |
| 3-0 | 797 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 10.3 | 17.7 | 12.0 | jugé |  |
| 3-0 | 884 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  |  |  | jugé |  |
| 3-0 | 1461 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 |  |  |  |  |  |
| 0-2310-lot1 | 4 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 1.0 | 7.8 | 8.7 | muet : bout-de-liste |  |
| 0-2310-lot1 | 51 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 0.5 |  |  |  |  |
| 0-2310-lot1 | 52 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 0.4 |  |  |  |  |
| 0-2310-lot1 | 166 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 1.8 | jugé |  |
| 0-2310-lot1 | 167 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 19.1 | 3.9 | 20.3 | jugé |  |
| 0-2310-lot1 | 168 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 |  |  | 0.5 | jugé |  |
| 0-2310-lot1 | 169 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 9.0 | 9.0 | 1.5 | jugé |  |
| 0-2310-lot1 | 170 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 3.9 | 3.2 | 0.7 | jugé |  |
| 0-2310-lot1 | 193 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.5 | 19.2 | 18.8 | jugé |  |
| 0-2310-lot1 | 197 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 6.7 | 6.8 | 0.9 | jugé |  |
| 0-2310-lot1 | 198 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 8.0 | 8.0 | 0.1 | jugé |  |
| 0-2310-lot1 | 200 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 0.5 | 0.4 | 0.1 | jugé |  |
| 0-2310-lot1 | 216 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 42.9 | 39.2 | 8.8 | jugé |  |
| 0-2310-lot1 | 289 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 20.6 |  |  |  |  |
| 0-2310-lot1 | 291 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 8.4 | 3.7 | 11.7 | jugé |  |
| 0-2310-lot1 | 292 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.2 | 4.3 | 2.1 | jugé |  |
| 0-2310-lot1 | 293 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 1.4 | 5.1 | jugé |  |
| 0-2310-lot1 | 294 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 1.2 | 4.2 | jugé |  |
| 0-2310-lot1 | 295 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 4.8 | 4.6 | 0.1 | jugé |  |
| 0-2310-lot1 | 296 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 5.4 | 5.4 | 0.0 | jugé |  |
| 0-2310-lot1 | 750 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 2.8 | 2.7 | 0.6 | jugé |  |
| 0-2310-lot1 | 906 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 |  |  | 5.4 | jugé |  |
| 0-2310-lot1 | 907 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 4.5 | 4.5 | 0.2 | jugé |  |
| 0-2310-lot1 | 940 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.1 | 1.4 | 3.1 | jugé |  |
| 0-2310-lot1 | 941 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.8 | 29.8 | 29.9 | jugé |  |
| 0-2310-lot1 | 942 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 7.1 | 7.1 | 0.1 | jugé |  |
| 0-2310-lot1 | 943 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 1.8 | 1.8 | 0.2 | jugé |  |
| 0-2310-lot1 | 955 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 9.0 | 9.9 | 8.9 | jugé |  |
| 0-2310-lot1 | 956 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.2 | 2.0 | 2.0 | jugé |  |
| 0-2310-lot1 | 957 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.3 | 1.2 | 1.3 | jugé |  |
| 0-2310-lot1 | 958 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.4 | 2.1 | 3.7 | jugé |  |
| 0-2310-lot1 | 1131 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 1.2 |  | jugé |  |
| 0-2310-lot1 | 1132 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 4.7 | 4.7 | 0.0 | jugé |  |
| 0-2310-lot1 | 1133 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 11.2 |  | jugé |  |
| 0-2310-lot1 | 1135 | autre (état ou source, pose égale) | differe/gcv2 | differe/ancre<gcv2 |  |  |  |  | +1 |
| 0-2310-lot1 | 1137 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 6.6 |  |  |  |  |
| 0-2310-lot1 | 1138 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 5.4 |  |  |  |  |
| 0-2310-lot1 | 1139 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 0.4 |  |  |  |  |
| 0-2310-lot1 | 1176 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 0.6 | 3.2 | 3.6 | jugé |  |
| 0-2310-lot1 | 1350 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.9 | 6.0 | 6.3 | jugé |  |
| 0-2310-lot1 | 1356 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  |  |  | jugé |  |
| 0-2310-lot1 | 1360 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  |  |  | jugé |  |
| 0-2310-lot1 | 1366 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 101.3 |  | jugé |  |
| 0-2310-lot1 | 1370 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 3.8 |  | jugé |  |
| 0-2310-lot1 | 1375 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 3.4 | 3.0 | 1.0 | jugé |  |
| 0-2310-lot1 | 1376 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 2.5 | 2.5 | 3.1 | jugé |  |
| 0-2310-lot2 | 293 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 1.4 | 5.1 | jugé |  |
| 0-2310-lot2 | 297 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 3.6 | 3.3 | 0.5 | jugé |  |
| 0-2310-lot2 | 906 | pose GCV2 déplacée | pose/gcv2 | pose/gcv2 | 4.3 | 3.8 | 5.4 | jugé |  |
| 0-2310-lot2 | 907 | autre (état ou source, pose égale) | pose/gcv2 | pose/gcv2 | 4.5 | 4.5 | 0.2 | jugé |  |
| 0-2310-lot2 | 1119 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 1.9 |  |  |  |  |
| 0-2310-lot2 | 1122 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 4.7 |  |  |  |  |
| 0-2310-lot2 | 1123 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 14.0 |  |  |  |  |
| 0-2310-lot2 | 1166 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 3.1 |  |  |  |  |
| 0-2310-lot2 | 1167 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 5.7 |  |  |  |  |
| 0-2310-lot2 | 1168 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 9.7 |  |  |  |  |
| 0-2310-lot2 | 1169 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 2.3 |  |  |  |  |
| 0-2310-lot2 | 1170 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 47.0 |  |  |  |  |
| 0-2310-lot2 | 1171 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 2.2 |  |  |  |  |
| 0-2310-lot2 | 1172 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 5.8 |  |  |  |  |
| 0-2310-lot2 | 1173 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 5.4 |  |  |  |  |
| 0-2310-lot2 | 1174 | pose GCV2 perdue | pose/gcv2 | differe/gcv2 | 4.1 |  |  |  |  |
| 0-2310-lot2 | 1328 | autre (état ou source, pose égale) | differe/gcv2 | differe/ancre<gcv2 |  |  |  |  | +1 |
| 0-2310-lot2 | 1329 | autre (état ou source, pose égale) | differe/gcv2 | differe/ancre<gcv2 |  |  |  |  | +1 |
| 0-2310-lot2 | 1331 | autre (état ou source, pose égale) | differe/gcv2 | differe/ancre<gcv2 |  |  |  |  | +1 |
| 0-2310-lot2 | 1332 | autre (état ou source, pose égale) | differe/gcv2 | differe/ancre<gcv2 |  |  |  |  | +1 |
| 0-2310-lot2 | 1333 | autre (état ou source, pose égale) | differe/ancre<gcv2 | differe/ancre<gcv2 |  |  |  |  |  |
| 0-2310-lot2 | 1334 | autre (état ou source, pose égale) | differe/gcv2 | differe/ancre<gcv2 |  |  |  |  | +1 |
| 0-2310-lot2 | 1357 | pose nouvelle (différé → posé) | differe/gcv2 | pose/gcv2 |  | 17.0 |  | jugé |  |
