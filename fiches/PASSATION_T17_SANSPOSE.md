# Test 17, rôle « sans pose » : les 15 cuts que la v5 laisse sans pose en 3:0

Branche `claude/50-t17-sanspose` (depuis `claude/50-apprentissage-3-0`, d344fe1). Aucun réglage livré n'est changé : tout est mesuré par `BANC_LEVIERS`. Un seul levier nouveau, `rechListeResMm`, coupé par défaut. Rejeux : banc `tools/banc-differes.cjs`, jugement `juger.cjs L1-se`, vérité `verite-3-0.json` (56 cuts, validations seules). 3:0 est en apprentissage : **tout chiffre ci-dessous sur 3:0 est un chiffre d'apprentissage**, et les deux seuils retenus (25 mm, 6 mm) viennent de 3:0 seule.

## 1. Cause réelle des 15 cuts (la vérité a un nuage utilisable partout)

Sonde (`probe30`) : à la position de l'opérateur, le nuage donne une cellule forte sur les deux rails pour les 13 cuts qui ont une vérité (dessus 150 à 300, flanc 18 à 102). Aucun n'est de type (b) « rail absent ». Les causes sont des gardes ou des voisins :

| Cut | Zone | Cause (chiffres) |
|---|---|---|
| 116, 663 | abords | graine : seul le départ est cherché (aucun voisin posé à 6 cuts ou moins), le rail est à 106 et 77 mm : hors de la fenêtre du moteur |
| 222, 598 | abords | idem (graines d0 + départ) ; la cellule de la vérité n'est pas dans la fenêtre |
| 229 | abords | paire trouvée à 12 mm de la vérité, refusée par la hauteur : 23,0 mm contre 20 |
| 448 | abords | paire trouvée à 5,7 mm, refusée : aucun voisin posé à 6 cuts ou moins (la voie de la liste, 3 voisins de chaque côté, résidu 4,9 mm, est à 7 mm de la vérité) |
| 797 | ADV | pose existante contredite (22 mm) ; l'écartement de la vérité est à 16,7 mm de la référence (> 15) |
| 845 | ADV | paire à 0,5 mm de la vérité, refusée par la seule hauteur : 22,6 mm contre 20 |
| 848 | ADV | pose contredite sans paire : la paire juste est refusée à 187 mm du voisin le plus proche, lui-même faux (847) |
| 844, 866, 870 | ADV | la voie des voisins est fausse : voisins posés à 1 cut à 70 à 230 mm de l'opérateur (843, 846, 847, 861, 864, 865, 867, 869 sont des poses fausses de 125 à 217 mm). La paire juste existe (866 : 5,9 mm ; 844 : 4,6 mm) mais est à 112 et 120 mm du voisin |
| 865 | ADV | idem ; la deuxième passe le pose faux (branche, 165,6 mm) |
| 862, 884 | ADV | **pas de vérité : non jugeable**. Même contexte (voisins faux à 1 cut) |

## 2. Deuxième passe seule (outil du banc de cap 5b, `deuxiemePasse` 2, `sansVoieRien`)

15 → 9 cuts sans pose. 6 poses : 116 (4,7 mm), 222 (3,2), 598 (7,9), 663 (3,6), 797 (8,4) justes ; **865 posé faux à 165,6 mm (mauvaise voie)**. Restent : 229, 448, 844, 845, 848, 862, 866, 870, 884.

## 3. Règles essayées (3:0, validations seules, avec / sans deuxième passe)

| Configuration | Sans pose | Jugées | ≤ 10 mm | > 50 mm = mauvaise voie | Médiane |
|---|--:|--:|--:|---|--:|
| v5 | 15 | 22 | 14 | 4 (794, 846, 847, 869) | 6,3 |
| v5 + 2e passe | 9 | 28 | 19 | 5 (+ 865) | 6,3 |
| Z25 | 12 | 25 | 18 | 2 (794, 869) | 5,7 |
| Z25 + 2e passe | 6 | 31 | 23 | 3 (794, 865, 869) | 5,7 |
| Z25 + liste | 10 | 27 | 20 | 2 | 5,6 |
| Z25 + liste + 2e passe | **5** | 32 | 24 | 3 (794, 865, 869) | 5,6 |

Verts de la chaîne changés : 0 partout. Z25 = `rechHauteurMaxMm` 25 (existant, 20 livré). Liste = `rechListeResMm` 6 (nouveau).

- **Z25** pose 229 (12,0), 845 (0,5), 848 (3,3) et **remplace deux poses fausses de la GCV2 : 846 (161 → 5,4 mm) et 847 (211 → 7,6 mm)**, parce que la paire juste n'était refusée que par la hauteur (22 à 23 mm exigés). La pose juste de 845 redonne un bon voisin à 846 et 847. Z30 donne exactement le même résultat que Z25 sur 3:0 (0 cut différent, avec liste et deuxième passe) : plateau de 25 à 30 sur 3:0. Borne haute connue : f228f6f9 649, paire fausse à 33,5 mm.
- **Liste** (`rechListeResMm`, coupé) : sans voisin posé à `rechProcheMaxCuts` cuts ou moins, en abords seulement, la voie de la liste d'ESV (voisins valides des deux côtés, résidu 6 mm au plus) sert de voisin le plus proche (graine, travers à 20 mm, hauteur). Pose 448 (5,6 mm) et 598 (5,0) dès la première passe. Câblage extension : `background.js` passe désormais `voieListe` à `deciderDiffere` (lot et passe en ombre) ; sans effet tant que le levier est coupé. Précision de la voie de la liste au banc : en abords avec voisins des deux côtés et résidu ≤ 9 mm, erreur ≤ 18 mm sur 9 cuts ; 38 mm à résidu 11,7 (2:7 5684) ; en ADV elle est fausse (103 mm sur 870) ; d'un seul côté elle extrapole mal (jusqu'à 129 mm). D'où abords, deux côtés, résidu.

## 4. Les 10 lots

Rejeux complets des 9 anciens lots, comparés cut par cut aux références `a3-bd3s` (sans passe) et `a3-bd3` (avec passe) : **Z25, Z25 + passe, Z25 + liste, Z25 + liste + passe : 0 cut différent sur les 9 lots**, donc 0 vert changé, 0 pose à plus de 20 mm, 0 mauvaise voie, mêmes 25 cuts sans pose sans passe et 12 avec. Conséquence honnête : les anciens lots ne servent pas à la **validation croisée** de ces deux seuils (ils ne passent jamais par là) ; ils prouvent l'absence de régression, pas le gain. Le gain n'est mesuré que sur 3:0 (5 cuts pour Z25, 2 pour la liste).

## 5. Ce qui reste différé après Z25 + liste + deuxième passe (5 cuts, tous en ADV)

844, 866, 870 : la voie des voisins posés est fausse (poses fausses 843, 861, 864, 865, 867, 869) ; poser avec elle serait une pose sans preuve, la paire juste existe mais ne passe que si le voisin le plus proche est juste. 862 et 884 : sans vérité, même contexte. Piste non réalisée (non essayée, donc non prouvée) : un vote entre voisins (la voie du plus grand groupe de voisins qui s'accordent, rien en cas d'égalité) ; elle dépend des poses fausses, traitées par la branche `claude/50-t17-fautes`.

## 6. Recommandation

Allumer `rechHauteurMaxMm` 25 : seul changement qui retire des poses fausses (4 → 2 mauvaises voies sans passe) et des différés, 0 effet sur les 9 lots. Garder `rechListeResMm` coupé tant qu'un second lot ne l'a pas exercé (2 poses, 3:0 seule, seuil 6 pris sur le cut 448). Z25 + deuxième passe garde 865 faux (165,6 mm) : à traiter par la branche des fautes.

## 7. Outils (hors dépôt, dans le scratchpad `t17b/`)

`run30.sh` et `run9.sh` (rejeux depuis un instantané git d'un commit), `cmp2.cjs`, `cmp9.cjs`, `an1.cjs`, `guards.cjs`, `probe30.cjs`, `hreq.cjs`, `vl.cjs`.
