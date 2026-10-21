# Passation du cap 5, agent A3 (nuit du 20 au 21/10, suite d'A2)

Branche `claude/50-l1-cap5`. Aucun code nouveau dans cette passation : les leviers sont ceux d'A2 (`voisinsCoherents`, `rechVoisinsMin`, `rechZones`, `rechEcartMm`), tous coupés par défaut. L'extension reste la v4b.

## 1. Palier mesuré : a3-p15 (commit 9ac23f4, 9 lots, `juger.cjs`)

Chaîne (b-r4 + zones ADV et abords + voisins cohérents + `rechEcartMm` à 15) :

```
{"diag":true,"rechZones":["adv","abords"],"voisinsCoherents":true,"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true},"rechercheDiag":true,"rechercheADV":true,"rechVoieParCutMm":40,"rechHauteurMaxMm":30,"rechContraMinMm":20,"rechContraMaxMm":45,"rechRemplace":true,"rechRemplaceMm":12,"rechEcartMm":15,"rechContraRien":true,"corrigeValideZones":["adv"],"rechEncadre":true,"anomalieNonCorrigeePMin":0.8}
```

| Partie | v4b | b-r4 | a3-p15 | jugées / ≤5 / ≤10 / 10–20 / >20 / MV (a3-p15) |
|---|--:|--:|--:|---|
| 2:19 | 3 | 2 | 2 | 236 / 196 / 235 / 1 / 0 / 0 |
| 2:17 | 18 | 5 | 1 | 40 / 28 / 38 / 2 / 0 / 0 |
| 2:18 | 18 | 12 | 4 | 28 / 21 / 26 / 2 / 0 / 0 |
| 2:11 | 3 | 2 | 2 | 9 / 3 / 7 / 2 / 0 / 0 |
| 2:20 fd7067f7 | 8 | 0 | 0 | 16 / 12 / 14 / 2 / 0 / 0 |
| 2:20 f228f6f9 | 2 | 1 | 1 | 175 / 134 / 172 / 3 / 0 / 0 |
| 2:6 | 3 | 2 | 2 | 9 / 5 / 7 / 2 / 0 / 0 |
| 2:7 | 2 | 2 | 2 | 19 / 13 / 18 / 1 / 0 / 0 |
| 2:13 | 0 | 0 | 0 | 0 |
| total | 57 | 26 | 14 | 532 / 412 (77,4 %) / 517 (97,2 %) / 15 / 0 / 0 |

0 > 50 mm, 0 mauvaise voie, 0 vert changé. Cuts gagnés sur b-r4 : 2:17 9521 9522 9526 9803 ; 2:18 36 37 38 61 88 204 205 452. Aucun cut perdu. Témoins : 9527 à 2,1 mm, 9653 à 3,3 mm.

Reproductibilité : a3-p15 reproduit cut par cut a2-p15 (2:18) et a2-p12/a2-p15 (2:7, f228) : 0 décision différente.

## 2. Réserves

- 2:18 36, 37 et 38 n'ont pas de vérité opérateur : posées, non jugées.
- 2:17 9803 est posée à 18,7 mm (cellule forte du nuage, opérateur à 18 mm de là).
- `rechEcartMm` : 10 → 12 est appuyé par deux parties (2:17 9803 ; 2:18 61 et 205). 12 → 15 ne l'est que par 2:18 (88, 36). Paires avec voie (dv ≤ 40) dans la bande 12–15 mm : 1 bonne (88), 1 à 18 mm (9803), 1 à 39 mm (467, non posée car ambiguë). Le repli a2-p12 (12) donne 26 → 16 avec 2:18 à 6 différés.
- `rechVoisinsMin:2` (a3-p16, 2:17 2:18 2:19) : 2:18 perd la pose 90 de b-r4 et ne gagne pas 88 : écarté.

## 3. Différés restants, diagnostic

| Cut | Raison |
|---|---|
| 2:19 4919 4920 | aucun voisin posé à moins de 28 cuts : pas de voie ; le nuage donne des cellules fortes à 1–3 mm de l'opérateur, mais aucune autre preuve |
| 2:17 9790 | vérité à −77 mm en hauteur, aucune cellule gauche |
| 2:18 153 | rail droit : 121 points de dessus, 0 de flanc à la vérité ; aucune cellule |
| 2:18 467 | rail droit : flanc 7 ; la cellule la plus proche est à 27 mm |
| 2:18 408 409 | nuage presque vide (2 502 et 892 points) |
| 2:11 7320 | l'opérateur est à +27 mm de l'écartement de référence, voie voisine contradictoire |
| 2:11 8292 | sous-delta |
| f228 649 | l'opérateur est à +24,5 mm de l'écartement de référence ; cellules du rail droit toutes aussi fortes entre −3 et 16 mm |
| 2:6 3433 4756 | rail droit sans cellule au point de la vérité |
| 2:7 3220 | l'opérateur est à +34 mm de l'écartement de référence ; le rail gauche saute de 39 mm à ce seul cut |
| 2:7 5901 | rail droit sans cellule (flanc 3) |

## 4. Outils (dans le scratchpad, hors dépôt)

`a3lst.cjs` (différés posables), `a3diag.cjs` (diagnostic par cut), `a3gain.cjs CONFIG REF` (gagnés et perdus avec l'erreur de chacun), `a3pairs.cjs` et `a3band.cjs` (paires par bande de |dg|), `a3grille.sh` (variantes sur 2:17 et 2:18).

## 5. Sur la base robuste b-r7a (fusion 7593a87)

La branche contient maintenant `claude/50-l1-cap5b` jusqu'à 117b17d (b-r7a : `rechHauteurMaxMm` 20, `rechContraMinMm` 22, `anomalieNonCorrigeeVoieMm` 35, `rechPaireTopMin` 60, `rechContraRatioMax` 1,5, `rechArret`, `rechSauteProcheMm` 2,5). Tous les leviers des deux agents sont coupés. Dans `rechSauteProcheMm`, la voie absolue est calculée avec les voisins cohérents quand `voisinsCoherents` est actif.

Reproduction : le code fusionné rejoue b-r7a avec 0 décision différente sur 2:17 (139), 2:18 (214), 2:7 (151) et 2:6 (83) (`c5/r-a3-r7rep`).

| Configuration (snapshot 7593a87) | Chaîne | Posables | Jugées / ≤5 / ≤10 / 10–20 / >20 / MV |
|---|---|--:|---|
| b-r7a | voir `c5/r-b-r7a/leviers.json` | 26 | 523 / 404 / 508 / 15 / 0 / 0 |
| a3-p15r7 | b-r7a + `rechZones` ["adv","abords"], `voisinsCoherents`, `rechEcartMm` 15 | 15 | 531 / 411 / 515 / 16 / 0 / 0 |
| a3-bd2 | a3-p15r7 + `branche`, `brancheDernier`, `brancheVertMm` 60, `brancheExtrapCuts` 2 | 12 | 534 / 411 (77,0 %) / 517 (96,8 %) / 17 / 0 / 0 |

- Contre a3-p15 (sur b-r4), le plancher `rechPaireTopMin` 60 retire la pose 88 (cellule droite à 46 points) et la pose 49 de fd7067f7 revient à 13,6 mm (`recherche-adv-remplace` perdu).
- `brancheDernier` (code, coupé) : la branche rail par rail passe après la recherche recentrée et ne joue que s'il ne reste rien. Elle regagne 88 (6,5 mm), gagne 467 (10,5 mm) en 2:18 et 8292 (6,6 mm) en 2:11. Placée avant la recherche (a2-p3), elle dégradait 9553 et 199 (5 à 15 mm).
- Différés restants de a3-bd2 : 2:19 4919 4920 ; 2:17 9790 ; 2:18 153 408 409 ; 2:11 7320 ; f228 649 ; 2:6 3433 4756 ; 2:7 3220 5901.
