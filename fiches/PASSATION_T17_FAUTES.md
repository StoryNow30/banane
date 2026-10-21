# Test 17, rôle « fautes » : les poses fausses de la partie 3:0

Branche `claude/50-t17-fautes`, depuis `claude/50-apprentissage-3-0` (d344fe1). Tout ce qui est nouveau est un **levier coupé** (`null`) dans `LEVIERS_V4` : la v5 livrée est inchangée à l'octet près (essai `tests/gcv2-l1-cap5.test.cjs`). Mesures : rejeu du banc (`tools/banc-differes.cjs`) sur les 9 anciens lots et 3:0, `juger.cjs`, vérité de l'opérateur (3:0 : jeu avec la règle « visité sans action = bon »). Partie 3:1 : jamais lue.

## 1. Causes mesurées des quatre poses fausses (3:0, v5 livrée)

Millimètres, repère profil de la pose de départ du cut. `dFit` : écart en travers de la pose à la droite ajustée des voisins validés (voie absolue, `voieAbsolue`) ; `dProche` : au voisin le plus proche ; `dist` : cuts jusqu'à lui ; `résidu` : résidu de la droite.

| cut | pose v5 | opérateur | chemin | dFit | dProche | dist | résidu |
|---|---|---|---|---:|---:|---:|---|
| 794 | 82 / 26 | −74 / −122 | `recherche-adv-remplace`, p 0,03 : la recherche s'arrête (`rechArret`) à la première paire « sûre et unique », trouvée dès la graine de la test 13 | 207 | 67 | 5 | 2 voisins, aucun |
| 846 | 26 / 80 | 187 / 230 | test 13 valide (H1+H2, p 0,63), jamais confrontée aux voisins | 110 | 233 | 4 | 3 / 3 |
| 847 | 8 / 0 | 219 / 205 | départ d'ESV validé (H0+H1+H2, p 0,81) | 155 | 363 | 5 | aucun |
| 869 | −110 / −57 | 107 / 153 | `sous-tau-coherent` (p 0,33) : écartement et soutien seuls | 39 | 115 | 2 | 55 / 63 |

- **846 et 847** : la pose est un vrai rail du nuage (253 à 258 points de dessus) mais celui de la voie de départ d'ESV ; en ADV les deux voies sont des rails, seuls les voisins disent laquelle. En 846 la recherche recentrée trouve la paire de l'opérateur (à 4 mm de lui) et la refuse : sa hauteur est à 21,8 mm du départ, limite 20.
- **869 et 865** (865 : posé par la deuxième passe, p 0,0058, motif `branche`) : les voisins posés sont eux-mêmes faux. **La cause commune est le bloc 843–870 : les verts de la chaîne 843, 861, 864, 867 (125 à 167 mm) sont posés avant la GCV2 et empoisonnent la voie des voisins** (résidus de la droite 55 à 132 mm contre 25 au plus ailleurs). En 865, `branche` ne repose que sur la géométrie des voisins et un soutien minimal (rail droit : 29 points de dessus, 3 de flanc ; les cinq autres poses `branche` des 10 lots : 51 et plus).

## 2. Leviers (coupés), essais `tests/gcv2-l1-fautes.test.cjs`

1. **Garde de voie absolue**, dans `deciderL1e` (un seul bloc, juste avant `const diag`, sur toute pose validée quel qu'en soit le chemin) :
   - `vetoVoieAbsMm` : pose à plus de X mm en travers de la droite ajustée des voisins (voie absolue, voisin le plus proche à `rechProcheMaxCuts` cuts au plus) : rien (`veto-voie-absolue`). Valeur essayée : 100.
   - `voieIncoherenteMm` : voisins qui ne s'accordent pas (résidu de la droite au-delà de X) : rien (`voie-incoherente`). Valeur essayée : 40.
2. **Contre-expertise des poses de la chaîne** (change des VERTS) : `contreChaineZones` (zones, essayé `["adv"]`), `contreChaineVoieMm` (préfiltre : la GCV2, coûteuse, ne décide que si la pose de la chaîne est à plus de X mm de la voie des voisins, nearest ou droite ; essayé 60), `contreChaineMm` (essayé 50). Fonctions `ecartAVoie` et `contreChaine` (src/gcv2-l1.js) ; branchées dans le banc seulement (`tools/banc-differes.cjs`, bloc « Contre-expertise » avant `let out`). Si la GCV2, décidant sur le même cut avec l'état d'avant lui, valide une paire à plus de 50 mm d'un rail de la pose de la chaîne, la chaîne n'est pas posée (ni pose, ni appui) et le cut passe à la GCV2 comme un différé. **Pas branché dans le service worker** (`l1CommandeCoeur`, `background.js` : il rend aujourd'hui la commande de la chaîne telle quelle) : à faire seulement si Mic dit oui.

## 3. Mesures (juger.cjs, 10 lots : 9 anciens + 3:0 ; « sans pose » = cuts posables laissés sans pose)

Sans deuxième passe (v5 livrée = base a3-bd3s pour les 9 anciens, rejeu de l'examen pour 3:0) :

| configuration | sans pose | jugées | ≤5 | ≤10 | 10–20 | >20 | >50 | mauvaise voie | verts changés |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| v5 livrée | 40 | 555 | 423 | 532 | 19 | 4 | 4 | 4 | 0 |
| garde seule (veto 100 + incohérence 40) | 3:0 : 19 au lieu de 15 | 3:0 : 26 au lieu de 30 | | | | 0 | 0 | 0 | 0 |
| garde veto 100 + contre-expertise (adv, 60, 50) | **34** | **560** | 428 | 541 | 19 | **0** | **0** | **0** | 6 |

- Garde seule en 3:0 : exactement les quatre poses fausses (794, 846, 847 : veto ; 869 : incohérence) repassent au rouge, rien d'autre ne change (4 cuts sans pose de plus, tous posés faux avant : gain de sûreté). Sur 4 des 9 anciens lots (2:6, 2:13, 2:17, 2:19) : 0 décision différente. Les 5 autres (2:7, 2:11, 2:18, f228, fd7067f7) : non rejoués avec la garde seule (la garde veto seule est couverte par la configuration suivante, qui n'a aucune décision différente hors 2:18) ; hors rejeu, aucune des 521 poses de la GCV2 des anciens lots (avec et sans deuxième passe) n'est au-delà de dFit 72 ni de résidu 25,2 (mais 129 poses n'ont pas de voie absolue consignée : preuve partielle).
- Veto + contre-expertise : 8 anciens lots sur 9 **0 décision différente** (2:6, 2:7, 2:11, 2:13, 2:17, 2:19, f228, fd7067f7). 2:18 : 203 et 451 (verts de la chaîne à 236 et 247 mm de l'opérateur) corrigés à 2,1 et 2,2 mm ; effet de cascade : 204 passe de 2,0 à 11,5 mm (`consensus`), 205 à 206 et 452 à 454 deviennent des poses de la chaîne (1 à 3 mm). 3:0 : 794 → rien ; 843, 861, 864, 867 (125 à 167 mm) → 12, 7, 4, 7 mm ; 846, 847, 869 → 5, 8, 3 mm ; 844, 845, 848, 862, 865, 866, 870 posés (1 à 8 mm pour ceux qui ont une vérité) : sans pose 15 → 9.
- Plages de seuils, ESTIMÉES hors rejeu d'après les écarts mesurés (la cascade peut les déplacer de peu) : `vetoVoieAbsMm` de 73 à 109 (maximum des anciens : 72 ; minimum des fautes : 110), `contreChaineMm` de 48 à 125 (le plus grand écart d'un vert juste : 47 ; le plus petit d'un vert faux : 128), `contreChaineVoieMm` jusqu'à 91 (toutes les fautes de la chaîne sont à 92 mm et plus de la voie de leurs voisins).

Avec la deuxième passe (`deuxiemePasse` 2, `passe2Leviers` `sansVoieRien`) :

| configuration | 3:0 sans pose | jugées | >50 | mauvaise voie | note |
|---|--:|--:|--:|--:|---|
| 3:0 passe 2 seule | 9 | 36 | 5 | 5 | 794, 846, 847, 865, 869 faux |
| 3:0 passe 2 + garde (veto 100 + incohérence 40) | 13 | 32 | **0** | **0** | 846, 847, 869 → rien ; 865 → rien (`sans-approche`, par cascade : la garde seule l'aurait refusé, résidu 132) ; 794 reposé à 3,2 mm ; 797 passe de 8,4 à 10,3 mm |
| 3:0 passe 2 + veto + contre-expertise | non mesuré | | | | rejeu tué par le coordinateur (mémoire) |

Les 9 anciens lots avec passe 2 + garde ne sont pas rejoués (machine saturée, échéance) : voir « non prouvé ».

## 4. Verts faux de la chaîne (843, 861, 864, 867) : la GCV2 peut les signaler et les corriger

Mesure (la GCV2 refaite en ombre sur chaque pose de la chaîne en ADV, sans rien changer) : 3:0, 151 verts de la chaîne en ADV (100 avec vérité) ; l'ombre valide une paire à plus de 10 mm de la chaîne pour 13 cuts, dont **843, 861, 864 (ombre à 12, 7, 4 mm de l'opérateur, la chaîne à 125, 166, 167)** ; 867 : l'ombre ne dit « rien » (`sous-delta`) mais la voie des voisins le met à 92 mm (dProche). Les autres écarts (11 à 15 mm) sont des cuts que la chaîne a bien posés (0 à 10 mm) et que l'ombre pose à 10–14 mm : le seuil de 50 mm les laisse intacts. 2:18, 152 verts en ADV : 203 et 451 ombre à 2 mm, aucun autre écart au-delà de 46 mm. Préfiltre : toutes les fautes de la chaîne sont à plus de 92 mm de la voie de leurs voisins (nearest ou droite) ; 8 verts sur 151 en 3:0 et 4 sur 152 en 2:18 passent à 60 mm, donc le coût de la GCV2 est celui de 5 % des verts en ADV (mesuré, sans préfiltre : 2:18 passe de 607 s à 2 255 s sous charge).

- **Signaler** (liste « verts à contrôler », sans toucher à un vert) : possible et sans risque ; la liste actuelle (`src/verts-a-controler.js`) exclut par construction les cuts du lot (`!setLot.has`), donc les verts posés par Ariane ne sont dans aucune liste. Ajouter les verts de la chaîne en ADV contredits (contre-expertise ci-dessus) demande de passer `posees` et la GCV2 au module : **non fait**.
- **Corriger** : le levier `contreChaine*` (§ 2). Les 6 verts qu'il change sur les 10 lots (843, 861, 864, 867, 203, 451) étaient tous faux de plus de 125 mm et finissent à 2–12 mm ; aucun vert juste n'est changé. Mais 5 des 6 vivent dans un seul bloc de 3:0 : **question pour Mic** (§ 5).
- Constat hors périmètre, mesuré : en f228 (2:20) la chaîne est à 17–35 mm de l'opérateur sur environ 48 verts d'ADV que l'ombre pose à 1–11 mm. Un seuil de contre-expertise à 15–20 mm les corrigerait ; non essayé (change des dizaines de verts).

## 5. Questions pour Mic

1. Autoriser la contre-expertise des poses de la chaîne en ADV (levier `contreChaineZones` `["adv"]`, seuil 50 mm) ? Elle change des verts : à vérifier avec la preuve du § 3 (6 verts, 6 fausses poses de 125 à 247 mm corrigées, 0 vert juste changé) et à brancher dans `background.js`.
2. Mettre les verts de la chaîne contredits dans la liste « verts à contrôler » (sans les changer) ?

## 6. Non prouvé, limites

- 3:0 est en apprentissage : seules ses quatre fautes (et 865) motivent les seuils ; les 9 anciens lots n'ont **aucune** faute de ce genre (sauf 203 et 451 de 2:18). Aucune validation croisée possible pour la garde (une seule partie fautive) : les seuils sont donnés avec leurs plages de stabilité (§ 3), entre le maximum des anciens lots et le minimum des fautes.
- `voieIncoherenteMm` (40) est tendu : en passe 2, il refuserait 797 (posé juste à 8,4 mm, résidu 76 / 68) ; sans lui 869 reste faux en l'absence de contre-expertise. Seuil de 40 pris entre 25,2 (maximum des anciens) et 55 (869).
- Garde seule (avec `voieIncoherenteMm`) pas rejouée sur 2:7, 2:11, 2:18, f228, fd7067f7 ; aucun des 9 anciens lots rejoué avec la deuxième passe et un de mes leviers.
- La contre-expertise et la garde ne sont pas dans le service worker (parité banc/extension non vérifiée).
- Fichiers : `src/gcv2-l1.js` (4 blocs : 5 leviers, `ecartAVoie`, `contreChaine`, garde avant `const diag`), `tools/banc-differes.cjs` (bloc « Contre-expertise », `!contre &&`, `if (contre) g = contre`), `tests/gcv2-l1-fautes.test.cjs`, `tests/gcv2-l1-cap5.test.cjs` (une ligne). Pour la fusion avec la branche « sans pose » : mes leviers sont sur leur propre ligne de `LEVIERS_V4` ; la garde est un bloc isolé juste avant `const diag`.
