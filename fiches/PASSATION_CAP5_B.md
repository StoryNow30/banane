# Passation cap 5, agent B : recherche recentrée en ADV (leviers 2 et 3)

Branche `claude/50-l1-cap5b`, partie de 8cb7958 (cap 5, p2c). Tout est **coupé par défaut** : `LEVIERS_LIVRES` garde la v4b et l'extension ne change pas. Les essais `tests/gcv2-l1-cap5.test.cjs`, `tests/gcv2-l1-cap5b.test.cjs`, `tests/gcv2-l1.test.cjs` et `tests/gcv2-l1e.test.cjs` sont au vert. Le code est dans `src/gcv2-l1.js`, dans le bloc « Cap 5b » de `deciderL1e` et dans les fonctions `voieAbsolue`, `rechercheRecentree` et `pairesRecentrees`.

## 1. Diagnostic de départ

- **Levier 2** (rail à plus de 150 mm, absent des candidats). Le moteur ne lit les points qu'à ±180 mm de la pose de départ (`prepareFrame`, `|q1| < 0,18`) et ne cherche qu'à ±80 mm autour de ses centres. En ADV, les rails gauches à −200/−210 mm sont donc coupés : le moteur trouve un faux champignon tronqué vers −181/−189 mm. C'est la cause des poses à plus de 20 mm de p2c (2:17 9644 à 31 mm, 9552, fd 97).
- **Levier 3** (rail absent à moins de 150 mm). Même cause de fenêtre : la recherche est centrée sur 0 et sur la médiane des points, pas sur l'endroit où est le rail.
- **Voie de transport, faussée en ADV.** Elle utilise des décalages pris chacun depuis la pose de départ de son propre cut. Or ces poses de départ sautent d'un cut à l'autre en ADV (écartement de départ 1 411 à 1 500 mm), et les décalages ne sont alors plus comparables.

## 2. Leviers (tous dans `LEVIERS_LIVRES`, coupés)

| levier | défaut | rôle |
|---|---|---|
| `rechercheADV` | false | interrupteur de la décision recentrée |
| `rechercheDiag` | false | avec `diag`, écrit `l1.diag.voieAbs` et `l1.diag.recherche` (graines, cellules, paires, choix, `avant`, relances, ms) |
| `rechZones` | null (= ['adv']) | zones où la recherche joue |
| `voieAbsFenetre` | 6 | fenêtre en cuts de la voie absolue (3 voisins de chaque côté au plus) |
| `rechEcartMm` | 10 | écart maximal de la paire à l'écartement de référence de la liste |
| `rechVoieMaxMm` | 80 | écart maximal en travers au voisin validé le plus proche |
| `rechVoieParCutMm` | null | idem, par cut d'écart à ce voisin (b-r2 : 40) ; écarte 2:18 452, où l'opérateur change de voie |
| `rechHauteurMaxMm` | null | hauteur à cette valeur au plus du voisin OU de la pose de départ, rail par rail (b-r2 : 30) ; écarte f228 649 |
| `rechProcheMaxCuts` | 6 | le voisin le plus proche doit être à ce nombre de cuts au plus |
| `rechUniqueMm` | 15 | si une autre paire admise est à plus de 15 mm de la paire retenue : ambiguïté, donc rien |
| `rechMaxDeplMm` | 300 | plafond de déplacement (remplace les 150 mm sur ce chemin) |
| `rechRemplace`, `rechRemplaceMm` | false, 5 | une pose validée est remplacée par la paire recentrée si elle s'en écarte de plus de `rechRemplaceMm` (b-r2 : 12) |
| `rechContraMinMm`, `rechContraMaxMm` | null, 45 | pose « contredite » : une cellule forte trouvée autour d'elle en est à 20–45 mm ; elle est remplacée par la paire recentrée si elle existe |
| `rechContraRien` | false | pose contredite sans paire : rien (sinon, gardée) |
| `rechSansPaireRien` | false | pose validée en ADV sans paire recentrée : rien (non retenu ; tue les poses des nuages pauvres de 2:6, 2:7, 2:11) |
| `rechMinTop`, `rechMinFace`, `rechRatioMax` | 15, 6, 1,5 | filtre des cellules ; ces valeurs sont exactement « forte et compétitive » au sens du moteur (`qualifyStrong`, `inCompetitive`) |
| `rechDedupMm` | 5 | une graine à moins de cette distance d'une graine déjà cherchée n'est pas relancée |
| `rechOrdreGraines` | null (= d0, dd, proche, va, h0) | ordre des graines ; le défaut est celui de b-r2 (l'ordre change l'endroit où le moteur est relancé) |
| `rechArret` | false | arrêt à la première paire sûre et unique (coût) ; **non mesuré** |
| `rechGraineDecalMm` | 0 | graines décalées en travers (sensibilité à la fenêtre du moteur) ; **non mesuré** |
| `rechDiagLarge` | false | diag avec cellules larges (dessus ≥ 10, flanc ≥ 4, rapport ≤ 2) et 80 paires, pour la sensibilité hors ligne ; les décisions restent au filtre strict, mais les décalages peuvent bouger de 2 mm ou moins (fusion des cellules) |
| `rechEncadre`, `rechEncadreMaxCuts`, `rechEncadreSautMm`, `rechEncadreEcartMm` | false, 1, 15, 15 | toujours rien et un voisin validé à 1 cut de chaque côté : paire interpolée, accrochée à une cellule forte à 5 mm au plus, refusée si une cellule forte est entre 5 et 45 mm ; vise 2:17 9646 ; **non mesuré** (commit 89b9323) |

Mécanique :
- `rechercheRecentree` relance le moteur, sans le modifier, sur une capture dont la pose de départ du rail est translatée sur une graine (`O.translated`). Les fenêtres de ±180 et ±80 mm suivent alors la graine. On garde les cellules du réservoir qui passent le filtre, recalées par la convention et ramenées en décalages depuis la vraie pose de départ.
- `voieAbsolue` lit les positions de scène des voisins validés (chaîne et poses de la GCV2) dans le repère de la pose de départ du cut.
- Graines : paire de la test 13 (d0), paire retenue (dd), voisin le plus proche, voie ajustée, départ (h0).

## 3. Configurations mesurées (rejeu du banc, 9 lots, `juger.cjs`)

**b-r2**, mesurée sur 2335ed9 et reproduite à l'identique sur 8a7dc7a : 9 lots sur 9, 0 différence cut par cut (état, source, motif, décalages). Chaîne exacte sur 8a7dc7a et après :

```
{"diag":true,"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true},"rechercheDiag":true,"rechercheADV":true,"rechVoieParCutMm":40,"rechHauteurMaxMm":30,"rechContraMinMm":20,"rechContraMaxMm":45,"rechRemplace":true,"rechRemplaceMm":12,"rechContraRien":true}
```

Sur 2335ed9, `rechContraRien` n'existait pas : une pose contredite sans paire devenait rien d'office.

**b-r3**, commit 37460af : la chaîne de b-r2 avec `"rechContraRien":false`. Une pose contredite sans paire est gardée. Ce n'est qu'un repli.

| partie | posables v4b | p2c | b-r2 | b-r3 | b-r2 : jugées / ≤5 / ≤10 / 10–20 / >20 / MV | b-r3 : >20 |
|---|--:|--:|--:|--:|---|---|
| 2:19 | 3 | 3 | 2 | 2 | 236 / 196 / 235 / 1 / 0 / 0 | 0 |
| 2:17 | 18 | 18 | 6 | 5 | 35 / 25 / 34 / 1 / 0 / 0 | 1 (9646) |
| 2:18 | 18 | 17 | 12 | 12 | 23 / 17 / 21 / 2 / 0 / 0 | 0 |
| 2:11 | 3 | 2 | 2 | 2 | 9 / 3 / 7 / 2 / 0 / 0 | 0 |
| 2:20 fd7067f7 | 8 | 6 | 0 | 0 | 16 / 11 / 14 / 2 / 0 / 0 | 0 |
| 2:20 f228f6f9 | 2 | 1 | 1 | 1 | 175 / 134 / 172 / 3 / 0 / 0 | 0 |
| 2:6 | 3 | 2 | 3 | 2 | 8 / 4 / 6 / 2 / 0 / 0 | 0 |
| 2:7 | 2 | 2 | **3** | 2 | 18 / 10 / 14 / 3 / 1 (5684) / 0 | 2 (3220, 5684) |
| 2:13 | 0 | 0 | 0 | 0 | 0 | 0 |
| **total** | 57 | 51 | **29** | **26** | 520 / 400 (76,9 %) / 503 (96,7 %) / 16 / 1 / 0 | 3 |

- b-r3, sur l'ensemble : 523 jugées, ≤5 76,5 %, ≤10 96,2 %, 0 MV, 0 > 50.
- Verts changés : 0 partout. Pose à plus de 50 mm : 0 partout.
- `cv.cjs v4b,p2c,b-r1,b-r2` retient b-r2 pour les 9 parties. Ce n'est qu'un choix entre 4 configurations : **ce n'est pas encore une validation des seuils.**

Cuts gagnés par b-r2 contre v4b :
- 2:17 : 9527 9528 9553 9554 9556 9557 9641 9642 9643 9645 9647 9653 9689. Les témoins de danger 9527 et 9653 sont posés à 2 et 4 mm de l'opérateur.
- 2:18 : 14 90 199 200 298 299.
- fd : 94 à 100 et 148.
- 2:19 5293, 2:11 6455, f228 329.
- Poses de p2c à plus de 20 mm corrigées : 9552, 9644, 9652, fd 97.

Cuts perdus par b-r2 :
- 2:17 9646 et 2:7 3220 : contredites sans paire, elles deviennent rien.
- 2:6 4756 : pose de p2c à 12,8 mm, contredite en deuxième passe par une cellule d'un autre rail à 42 mm.

**Seule partie hors critère pour b-r2 : 2:7** (3 posables contre 2 en v4b). Elle garde aussi 5684 à 37 mm, une pose d'abords déjà présente dans v4b.

## 4. Ce qui a échoué

- **b-r1** (2335ed9, b-r2 sans `rechRemplace`) : **2 mauvaises voies en 2:17**, 9528 à 241 mm et 9556 à 159 mm. Mes nouvelles poses (9527, etc.) deviennent voisines de transport : la voie passe de « transport sûre » à « proche », et le veto-voie ne joue plus. Une paire de la test 13 sur l'autre voie de l'appareil est alors validée, alors que la paire recentrée, à 2,5 et 28 mm du voisin, était juste. Le remplacement (`rechRemplace` à 12 mm) les corrige. **Leçon : toute nouvelle pose change la voie des cuts suivants, et il faut rejouer en chaîne, pas seulement simuler.**
- Garde « dv ≤ 80 mm » seule : 2:18 452 posé sur la voie des voisins, mauvaise voie à 287 mm. L'opérateur y change de voie et la paire de la test 13 était la bonne. D'où `rechVoieParCutMm` (452 : 58 mm à 1 cut).
- Hauteur non bornée : f228 649 posé à 52 mm (cellule droite à −40 mm de hauteur). D'où `rechHauteurMaxMm`.
- `rechSansPaireRien` et une contradiction sans plafond (cellules à 130 mm, qui sont un autre rail) : 2:11, 2:7 et 2:13 passent au-dessus de v4b. Non retenus.
- Diagnostic hors ligne, parties 2:17, 2:18, fd : la voie ajustée par moindres carrés (`va.v`) extrapole mal en ADV. Le voisin le plus proche (`va.proche`) est la référence retenue.

## 5. Les trois cuts à poser juste (exigence : 2:7 ≤ 2 posables et 0 pose > 20 mm)

Sonde : `$S/b/probe.cjs PARTIE CUT [graines]`. Elle rend la capture, l'écartement de la paire de l'opérateur contre la référence, et les cellules recentrées au filtre large 8/3/3.

- **2:7 3220** (ADV) : l'opérateur est à 18/11 et 48/11, écartement 1 468,9 mm pour une référence de 1 435,4 mm (+33,5). Ses voisins 3219 et 3221 sont à −21/48 et −7/47 : le rail gauche de l'opérateur saute de 39 mm à ce seul cut. Le rail droit à 48,8 n'est pas fort (flanc 5). La seule cellule forte concurrente est à 170 mm. Aucune paire sûre n'est à l'écartement de référence, et une interpolation entre voisins se tromperait de 37 mm. Le rail gauche posé par la test 13 (−18,6) n'a aucun point de flanc, alors que des cellules fortes existent vers 13/−1 et 16–21/8.
- **2:7 5684** (abords, hors de la zone de la recherche) : l'opérateur est à −53/6 et −24/−4, écartement 1 470,8 mm pour une référence de 1 432,9 mm (+38). Le voisin 5685 a son rail droit à 21 : saut de 45 mm. La pose à 37 mm vient de la correction d'écartement de L1-e (anomalie de −32,5 mm), qui a déplacé le rail droit. La paire de la test 13, sans correction, était à environ 6 mm. Piste : une correction d'écartement contredite par une cellule forte annule la correction.
- **2:17 9646** : l'opérateur est à −203/2 et −150/−24, en continuité avec 9645 et 9647. Mais le moteur ne trouve **aucune cellule** pour le rail gauche, même au filtre large et avec une graine posée sur l'opérateur (fenêtre ou pente refusée), alors que le soutien de dessus est de 270 points et celui de flanc de 130. Piste codée, non mesurée : `rechEncadre` (89b9323). Interpolation entre 9645 et 9647, rail droit accroché à la cellule −150,2/−23,9 : environ 7 mm attendus, à mesurer.

## 6. Coût

- Banc, b-r2 contre p2c : 2:19 599 s au lieu de 116 s ; 2:17 414 s au lieu de 316 s ; f228 1 159 s au lieu de 633 s.
- Jusqu'à 5 relances du moteur par cut ADV décidé par la GCV2. Sur la capture d'essai, une relance prend 0,6 à 1,3 s.
- Lots réels : médiane de 4,0 s par cut (2:19 et 2:17), p90 de 7,5 s. Le surcoût par cut ADV est donc du même ordre que la durée d'un cut. **À réduire** :
  - `rechArret` ;
  - un `rechDedupMm` plus grand ;
  - éviter le calcul V4.6 inutile dans la relance (`scientificProposeBothAvecReservoir` calcule V4.6 et les deux rails).
- Le diag de b-d3 donnera `relances` et `ms` par cut.

## 7. Parité avec l'extension

- `tools/parite-l1se-sw.cjs` a reçu l'option `--leviers JSON` : elle appelle `reglerLeviers` dans le contexte du service worker.
- **Le service worker ne fait pas de deuxième passe** : la parité se fait sur une chaîne sans `deuxiemePasse`, et le rejeu de référence du banc avec la même chaîne.
- Dans `deciderDiffere`, la voie absolue lit `voisins` et `voisinsTransport`, que background.js passe déjà : pas de changement attendu côté service worker, mais **rien n'est encore mesuré**.
- Repère de durée : la parité de 2:19 a pris 4 369 s sans la recherche.

## 8. Rejeu depuis un commit poussé (cœurs 2 et 3 seulement)

`S=/tmp/claude-0/-home-user/cc0e4631-960e-5f55-b126-e7123e84b5ca/scratchpad`

Scripts de rejeu :
- `bash $S/b/run9.sh NOM 'LEVIERS'` : git archive du HEAD de `wt/C5b`, refusé si l'arbre est modifié ; écrit `c5/r-NOM/commit.txt` et `leviers.json`, puis rejoue les 9 lots sur les cœurs 2 et 3.
- `bash $S/b/run1s.sh NOM 'LEVIERS' PARTIE CŒUR` : un seul lot, depuis le même instantané.
- `bash $S/b/run8.sh NOM` : les 8 autres lots, après 2-17.

Analyse :
- `node $S/b/tableau.cjs NOM [REF]` : tableau par partie, avec les cuts gagnés et perdus.
- `node $S/b/cmp.cjs A.jsonl B.jsonl` : identité exacte cut par cut.
- `node $S/c5/cv.cjs v4b,p2c,NOM`.
- `node $S/b/rech2.cjs r.jsonl verite.json` : paires recentrées contre l'opérateur.
- `node $S/b/sim2.cjs NOM '{règle}'` : décision rejouée hors ligne sur un diag élargi.
- `node $S/b/cvsim.cjs NOM sens|loo` : sensibilité ±30 % et grille en une partie laissée de côté, hors ligne (non lancé).
- `bash $S/b/parite.sh NOM 2-17 2 ['LEVIERS_SW'] [-temoin]` : parité (non lancée).

## 9. Étapes restantes, dans l'ordre

1. **Sensibilité ±30 %.** Rejeu b-d3 = chaîne b-r2 + `"rechDiagLarge":true`, puis `cvsim.cjs b-d3 sens`. Seuils : rechVoieParCutMm 40, rechHauteurMaxMm 30, rechContra 20–45, rechRemplaceMm 12, rechUniqueMm 15, rechProcheMaxCuts 6, rechEcartMm 10, filtre 15/6/1,5. Pour la fenêtre de ±80/±180 du moteur : deux rejeux réels avec `rechGraineDecalMm` à ±24. Confirmer les points limites par des rejeux réels, à cause de l'effet de chaîne (voir b-r1). Signaler toute falaise (par exemple un MV qui apparaît à +10 %).
2. **Grille en une partie laissée de côté** : `cvsim.cjs b-d3 loo` (K × Z × RM × CMin), puis rejeu réel des seuils retenus.
3. **Poser juste 2:7 3220 et 5684, et 2:17 9646** (section 5) :
   - mesurer `rechEncadre` ;
   - essayer « correction d'écartement contredite : la correction est annulée » pour 5684 ;
   - pour 3220, aucune preuve sûre n'est connue : rien, compensé par un gain sur 2:7 (5576, 5901, voir l'agent A).
4. **Coût dans l'extension** : mesurer `rechArret` et `rechDedupMm` sans perdre de poses (sim2 émule l'arrêt), donner le temps par cut ADV et par lot.
5. **Parité** : `run1s.sh` d'une chaîne sans deuxième passe sur 2:17 et 2:19, puis `parite.sh` avec les mêmes leviers, plus un témoin négatif (service worker aux leviers livrés contre ce banc : il doit différer).


---

# Agent B3 (reprise) : b-r7, robustesse, coût

Les rejeux ci-dessous partent de commits poussés (`c5/r-NOM/commit.txt`). Commits : 182b8e3 (rechPaireTopMin, rechContraRatioMax), 117b17d (rechSauteProcheMm).

## 10. b-r4 reproduit, puis b-r7 et b-r7a

Chaîne **b-r7** = b-r4 avec : `rechHauteurMaxMm` 20 (30 avant), `rechContraMinMm` 22 (20), `anomalieNonCorrigeeVoieMm` 35, `rechPaireTopMin` 60, `rechContraRatioMax` 1,5. Chaîne **b-r7a** = b-r7 + `rechArret` + `rechSauteProcheMm` 2,5.

| partie | posables v4b → b-r7a | jugées | ≤5 | ≤10 | 10–20 | >20 | MV |
|---|---|--:|--:|--:|--:|--:|--:|
| 2:19 | 3 → 2 | 236 | 196 | 235 | 1 | 0 | 0 |
| 2:17 | 18 → 5 | 36 | 25 | 35 | 1 | 0 | 0 |
| 2:18 | 18 → 12 | 23 | 17 | 21 | 2 | 0 | 0 |
| 2:11 | 3 → 2 | 9 | 3 | 7 | 2 | 0 | 0 |
| 2:20 fd7067f7 | 8 → 0 | 16 | 11 | 13 | 3 | 0 | 0 |
| 2:20 f228f6f9 | 2 → 1 | 175 | 134 | 172 | 3 | 0 | 0 |
| 2:6 | 3 → 2 | 9 | 5 | 7 | 2 | 0 | 0 |
| 2:7 | 2 → 2 | 19 | 13 | 18 | 1 | 0 | 0 |
| 2:13 | 0 → 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| **total** | **57 → 26** | **523** | **404 (77,2 %)** | **508 (97,1 %)** | 15 | 0 | 0 |

0 pose à plus de 20 mm, 0 à plus de 50 mm, 0 verts changés. Cuts gagnés contre v4b : ceux de b-r4 (2:19 5293 ; 2:17 9527 9528 9553 9554 9556 9557 9641 9642 9643 9645 9647 9653 9689 ; 2:18 14 90 199 200 298 299 ; 2:11 6455 ; fd 94–100 et 148 ; f228 329 ; 2:6 3722 ; 2:7 5576) ; perdu : 2:7 3220. b-r7 est identique cut par cut à b-r4 (un seul motif change, f228 649, différé dans les deux cas). b-r7a est identique à b-r7 sauf 4 cuts de 2:17 déplacés de 3 mm au plus. `cv.cjs v4b,b-r4,b-r7a` retient b-r4 sur les 9 parties : **ce n'est qu'un choix entre configurations, pas une validation des seuils** (voir 11).

## 11. Robustesse : ce que les mesures ont montré

**Un plancher de preuve commun aux falaises Z et ratioMax.** Sur les paires listées par la recherche (b-d3, avec l'erreur contre l'opérateur, `b/pairerr2.cjs`) : parmi celles qui passent toutes les gardes de la chaîne (filtre 15/6/1,5, écartement, déplacement, travers, hauteur 20 mm, voisin à 6 cuts), 575 paires dans 448 cuts, **aucune à plus de 20 mm**, la plus faible a un dessus de 33 points. Avec la hauteur à 39 mm, une paire fausse passe : f228 649 (52 mm, dessus 29). Avec ratioMax à 1,95, 2:18 153 (31 mm, dessus 31). Les poses retenues de la chaîne ont 108 points de dessus au moins, les paires justes de 55 points. `rechPaireTopMin` = 60 est le centre géométrique de (31 ; 108) : ligne de défense indépendante de Z et de ratioMax. Les paires fausses viennent de 3 parties (2:6 4756 : 11 points ; 2:18 153 ; f228 649), mais le plancher repose sur 3 cuts : règle **peu validée**. Attention : sans les gardes de voie et de hauteur, des paires à fort dessus (200 à 300 points) sont fausses à plus de 50 mm (2:18, 20 paires non retenues) : le plancher ne remplace pas ces gardes.

**Hauteur (`rechHauteurMaxMm`).** Besoin réel des poses de la chaîne : 10,9 mm au plus (fd 100). Paire fausse de 649 : 33,5 mm. 20 est au centre ; la sensibilité ±30 % (14 à 26) reste dans (10,9 ; 33,5). Rejeu réel r6 (Z=20 et garde de voie 35) : 8 lots sur 8 identiques à b-r4 (f228 perdu au redémarrage).

**ratioMax.** Falaise vers le haut à 1,95 (2:18 153, 30,7 mm), couverte par le plancher. **Falaise vers le bas, invisible à la simulation hors ligne** : à 1,2 (rejeu b-r5), le détecteur de contradiction ne voit plus la cellule concurrente de 2:7 3220 (rapport entre 1,2 et 1,5), et 3220 est posé à 29 mm. Le rapport des cellules qui contredisent est donc découplé (`rechContraRatioMax`, 1,5 ici) du rapport de la paire (`rechRatioMax`).

**Contradiction (`rechContraMinMm`).** Fenêtre : 2:13 3533 est perdu si le seuil est 14,7 mm ou moins (une pose de v4b disparaît, 1 posable contre 0 : rejeu réel b-s-cmin14) ; 2:7 3220 n'est plus contredit à 31 mm ou plus. 22 est le centre ; ±30 % donne 15,4 à 28,6.

**Anomalie d'écartement non corrigée (`anomalieNonCorrigeePMin` 0,8).** Cuts gardés : 2:6 3722 (p 0,8195), 2:7 5576 (p 0,959), f228 329 (p 0,826). Refusés : 2:6 4756 (p 0,749, paire à 48 mm de l'opérateur), 2:18 153 (p 0,53), 2:7 5901 (p 0,56). Marge de p : 0,07 d'un côté, 0,02 de l'autre. **Garde de voie indépendante de p** (`anomalieNonCorrigeeVoieMm` 35) : écart en travers des deux rails au voisin validé le plus proche : gardés à 12,9, 29,8 et 30,2 mm ; refusés à 36,5 (649) et 40,6 mm (4756). Les deux gardes sont en ET : pour qu'une mauvaise pose passe, il faut que les deux seuils bougent. Les rejeux de sensibilité de p et de la voie sont au paragraphe 13.

## 12. Règles peu validées (à relire avant toute version)

| règle | cuts qui la fondent | limite connue |
|---|---|---|
| `corrigeValideZones` ['adv'] | 2:17, 2:18 et fd en ADV | contre-exemple fd7067f7 cut 49 (hors ADV) |
| `anomalieNonCorrigeePMin` 0,8 + voie 35 | 3 gardés, 3 refusés (4 parties) | falaise de p sans la garde de voie |
| `rechPaireTopMin` 60 | 3 paires fausses (3 parties), 0 sur ~650 | aucune paire fausse entre 31 et 45 points : le seuil n'est pas serré |
| `rechEncadre` | un seul cut posé (2:17 9646, 7,5 mm) | une pose |
| `rechContraMinMm` 22 | 2:13 3533 (bas), 2:7 3220 (haut) | deux cuts bornent la fenêtre |
| `rechRemplace` 12 mm | 10 poses (3 parties) | corrige les mauvaises voies de b-r1 (effet de chaîne) |
| `rechSauteProcheMm` 2,5 | 0 pose modifiée sur 105 sautées | la plus petite modifiée est à 3,7 mm |

## 14. Coût (rechArret et saut)

Relances du moteur sur les 9 lots : 2050 (b-r7) → 533 (b-r7a). Cuts cherchés : 523 → 416. Temps de recherche cumulé : 1411 s → 428 s. Temps de lot (mur, machine chargée, indicatif) : 2:19 550 → 218 s ; f228 1163 → 728 s ; 2:17 421 → 353 s ; 2:18 649 → 616 s. Repère sans recherche (p2c) : 2:19 116 s, f228 633 s.

Décomposition d'une relance (CPU, `b/cost.cjs`, 2:19 cut 5293) : 2020 ms dont V4.6 134 ms (7 %), A* 193 ms (10 %), reste 1499 ms. Éviter V4.6 ne rapporte donc presque rien (et il alimente le réservoir : le retirer changerait le résultat). Profil : la fonction `median` de `src/geometry-candidate-v1.js` (tri avec comparateur) fait plus de la moitié du CPU. Un tri numérique sans comparateur donne 950 ms par relance au lieu de 2020 (patch : `b/median-rapide.patch`), **mais `tests/pose-lot-inchanges-4959.test.cjs` épingle ce fichier octet pour octet : le patch n'est pas appliqué** (décision à prendre hors de ce cap).

## 15. Deuxième passe portable dans le service worker : plan (avant tout code)

**Ce que fait le banc** (`tools/banc-differes.cjs`, `deuxiemePasse`) : chaque différé de L1-se (source gcv2 ou lot) est mis de côté avec sa capture et sa science (`restes`). Après le dernier cut, jusqu'à 2 passes, dans l'ordre du lot : `deciderDiffere` avec les appuis de fin de lot (`E.anchors`, 40 au plus), TOUS les cuts posés par la chaîne (`E.valides`, avant ET après le cut), toutes les poses L1 (`voisinsTransport`, qui s'enrichit à chaque pose de la passe), les leviers de passe (`passe2Leviers`, ici `sansVoieRien`). Seule une décision « valider » compte ; elle est posée (commande `lot`) et validée. La passe s'arrête quand elle ne pose plus rien.

**Ce que fait le service worker** (`background.js`, `l1Commande`, `l1Voisins`) : un différé repart avec `nextWithoutDecision` et reste rouge ; `l1Voisins` ne lit que les cuts traités AVANT le cut ; la capture n'est pas gardée en mémoire ; rien ne revient sur un différé. Le moteur du lot (`src/engine.js`) est épinglé octet pour octet (`tests/pose-lot-inchanges-4959.test.cjs`), ainsi que `src/lot-decision.js` : la passe ne peut pas vivre dans la boucle du lot.

**Manière naturelle : une passe après le lot, calquée sur la relecture** (`relecturePlanifier`, `relectureLancer`, `relecturePasse`, `relectureCorriger`), qui existe déjà et fait presque tout : planification une fois par lot à sa fin naturelle, jeton de génération et arrêt, mode figé dans le lot (« coupée », « ombre », « corriger »), navigation `goToCut` avec preuve d'arrivée, `capture`, calcul, `applyInESV` avec relecture à 1 mm, restauration si la pose n'est pas conforme, intentions persistantes pour un redémarrage du service worker. Aucun changement d'architecture : un bloc nouveau dans `background.js` (fichier non épinglé), un réglage `lot.passeDifferes` (défaut éteint), le profil L1-se seulement.

**Étapes**
1. *Mémoire des différés* : pendant le lot, noter pour chaque différé L1-se `{cut, identité, zone, plages ADV}` (pas la capture : les nuages sont déjà gardés par `store.putCloud` et relus par `store.getCloud(lidarId)`, comme `observeLot`). Un différé de L1-se ne touche pas à ESV (plus aucune pose sans validation) : la capture refaite est celle de la première visite.
2. *Décision en ombre d'abord* (aucune écriture, aucune navigation : nuage relu du magasin) : pour chaque différé, dans l'ordre du lot, `deciderDiffere` avec les voisins de FIN de lot (tous les cuts posés du lot, même cadre de scène : `frameId` et `pageId` identiques, sinon le cut est laissé), le transport complet, les appuis de fin de lot, `passe2Leviers` réglés le temps de l'appel (`reglerLeviers` puis restauration dans `finally`), et jusqu'à 2 passes. On journalise ce que la passe poserait. C'est ce que mesure la parité (2:17, 2:19 contre le banc `b-r7a` avec deuxième passe).
3. *Écriture, seulement avec l'accord de Mic* : aller au cut (`goToCut`, chemin « pas » ou carte, preuve d'arrivée), `capture`, vérifier que la décision tient, `applyInESV` (clic `tout-recentre`), puis valider. **Point non résolu** : un différé est un cut rouge. La relecture valide des verts par Maj+Espace (le cut reste affiché, preuve par l'écriture « valid »), et sa garde refuse tout autre rôle ; le lot valide un rouge par « valider et suivant », ou Ctrl+Entrée seulement pour le dernier cut (`validerSurPlace`, preuve par le compteur « N on M »). Valider un rouge sur place, hors ordre, n'a jamais été joué dans ESV : il faut une preuve de terrain (un seul différé, Mic présent) avant toute écriture.
4. *Risque « pose sans validation »* : ESV n'enregistre pas une pose non validée. La passe ne pose que des décisions « valider » ; si la validation n'est pas prouvée, `restore` remet la pose (comme `relectureCorriger`). Aucun repli vers « valider et suivant ».
5. *Exclusion mutuelle avec la relecture* : une seule passe à la fois (`passeActive`). La passe des différés part la première ; la relecture ne corrige jamais un rouge.
6. *Parité* : `SimulatedESV` doit gérer `goToCut`, `capture`, `apply` et la validation sur place d'un cut rouge ; `tools/parite-l1se-sw.cjs` rejoue le lot puis la passe et compare avec le banc (`deuxiemePasse` 2).

**Coût attendu** : une capture et un calcul par différé et par passe (14 à 30 différés par lot ici), plus la navigation en mode écriture.

**Décision demandée à Mic avant l'étape 3** : valider un cut rouge sur place, hors ordre (Ctrl+Entrée ou autre geste), après une pose faite par Ariane ; sans cela la v5 ne peut livrer que le mode ombre de la passe.
