# Candidate L1 sur les différés du lot : banc conjoint, prédictions scellées, test 10 (D-217, D-219) — 19 octobre 2026

Ce document ne contient que des numéros de parties, de lots et de cuts, des millimètres et des comptes. « 2:1 » veut dire : projet 2, partie 1.

La candidate L1 est déclarée en D-219. Elle n'est pas changée d'après les résultats. Les détails que D-219 n'écrit pas sont tranchés au § 2, **avant toute mesure** (ce paragraphe est déposé seul, dans un commit qui précède le premier calcul du banc).

## 1. La candidate L1 (rappel de D-219)

- **P2** : la GCV2 (hypothèses H0 à H6, paramètres figés) agit sur les différés du lot **sans le couloir de 45 mm** depuis la pose de départ ; τ, δ et l'écartement de la paire sont gardés. Une cible hors de la vue : on déplace la vue, puis on pose. La garde de paire du lot est éteinte. Les appuis de reprise sont élargis à 10 cuts.
- **Sous τ** : on **pose sans valider**. Le cut reste invalide (rouge) ; Mic repart d'une pose approchée. Exception : si la meilleure paire est à plus de 150 mm de la pose de départ, on ne pose rien.
- **Variante L1-v** (chiffrée, jamais activée sans décision écrite) : sous τ, on valide et on inscrit le cut aux verts à contrôler (hors cas à plus de 150 mm).
- **Inchangés** : le contrat d'écartement du moteur, τ, l'écartement de la paire, la géométrie (`src/geometry*.js`).

## 2. Détails tranchés avant la mesure

1. **Paramètres de la GCV2** : `datasets/gcv2-parametres-h6.json`, usage « lot » (SHA-256 `679015ef515547287fdb0fbdde4cdf5a015c8644ef6a170005d67a2ab6eee5f8`). La demande citait `datasets/gcv2-parametres.json`. Ce fichier ne connaît pas l'origine H6 (il a été appris avant H6, sur H0 à H5) : il ne peut pas noter les hypothèses H6 que L1 doit lire. Le fichier « h6 » est le seul appris avec H6, sur le jeu « lot » sans appui humain, et c'est lui que le diagnostic a utilisé pour chiffrer P1 et P2. Aucun réglage n'est changé.
2. **Meilleure paire** : le produit des scores à 10 mm des deux rails, sur toutes les paires d'hypothèses dont l'écartement tient (médiane de la partie ± 15 mm, ou contrat 1 420–1 470 mm), la paire de départ comprise. Pas de couloir, pas de contrôle de dévers (comme la variante « aucun couloir » du diagnostic).
3. **Poser et valider** : la meilleure paire est au-dessus de τ (seuil de la zone) et s'écarte d'au moins δ (seuil de la zone) de la pose de départ, en latéral ou en vertical, sur un rail au moins.
4. **Ne rien poser** : la paire de départ est la plus probable ; ou la meilleure paire s'écarte de moins de δ (déplacement inutile).
5. **Sous τ** (et à δ au moins) : poser sans valider, sauf si la paire est à plus de 150 mm de la pose de départ. Cette distance est mesurée en 3D, sur le pire des deux rails.
6. **L1-v** : sous τ, à 150 mm au plus : valider, et inscrire le cut aux verts à contrôler.
7. **Appuis** : une pose validée par la GCV2 devient un appui de la chaîne du lot et un voisin pour les cuts suivants (comme un premier passage). Une pose non validée n'est ni l'un ni l'autre.
8. **Options du lot sous L1** : garde de paire éteinte, et appuis à 10 cuts au plus au lieu de 3. Comme dans le diagnostic, ce seuil sert à la fois à la garde de continuité du premier passage et à la reprise depuis la voie (c'est le même réglage du code).
9. **Cible hors de la vue** (commande du lot, de tout étage, et poses de la GCV2) : si la cible tombe dans la vue élargie (`camerasLarges`), la vue est déplacée puis la pose est faite. Le banc compte ces déplacements et suppose qu'ils réussissent. Hors de la vue élargie : rien n'est posé.
10. **Contrôles de la commande** gardés pour les poses de la GCV2 : position relue à 0,01 mm, écartement admissible pour la commande du moteur.
11. **Règle « grappe de différés »** : gardée telle que chaque lot l'avait (active seulement en 2:8 et 2:9). Elle vaut aussi pour les poses validées de la GCV2.
12. **Zone** (PN, ADV, abords) : le moteur de zones du dépôt, rejoué dans l'ordre du lot, évalué avant la décision du cut. La zone ne dépend que des captures : elle est la même pour tous les profils.
13. **Rejeu par lot** : chaque lot est rejoué seul, du premier au dernier cut, avec les appuis de départ qu'il avait (lots de reprise). Le dénominateur est celui du lot réel (ses cuts traités). Une reprise réelle est donc rejouée comme si le lot précédent avait été celui d'aujourd'hui, avec ses cuts réels : c'est la définition de la base du diagnostic.
14. **Moteur** : la science de chaque cut est recalculée avec le moteur d'aujourd'hui, comme la test 10 le ferait. Un cut sans nuage garde son sort réel.
15. **Différé après L1** : un cut que le lot ne valide pas. Un cut « posé sans valider » reste un différé ; il est compté à part (« approché »).
16. **Jugement contre Mic** : les règles du diagnostic (Écho de la même séance, pose de départ vérifiée à 2 mm, nuage, cut non posé ensuite par un autre lot). Écart entre deux poses : le pire des deux rails, en 3D. Gain d'un cut = écart de la pose de départ à Mic − écart de la pose L1 à Mic (0 si L1 ne pose rien). **Rappel** : parmi les jugés dont la pose de départ est à plus de 10 mm de Mic, la part que L1 pose à 10 mm au plus.
17. **Base** : le sort réel de chaque cut dans le journal (inventaire du diagnostic). À côté, la **base rejouée** (le code d'aujourd'hui, sans L1) dit si le rejeu est fidèle.
18. **B1** (voisins de la liste d'ESV) : ignoré ; il n'était qu'en ombre dans tous les lots.

## 3. Résultats du banc conjoint (40 lots, mesurés après le § 2)

Rejeu causal conjoint (`tools/banc-differes.cjs`) des 40 lots de la base du diagnostic : 6 878 cuts traités, 1 367 différés réels (le contrôle retrouve les 1 367 de l'inventaire). La base rejouée (le code d'aujourd'hui sans L1) rend 1 366 différés : le rejeu est fidèle. 2:17 et 2:18 sont rejoués (taux) mais **aucune vérité** n'y est jointe (prédictions scellées, § 4). Synthèse complète : `fiches/L1_BANC_SYNTHESE.md`.

### 3.1 Taux de différés (un cut « posé sans valider » reste un différé)

| Groupe | Différés réels | L1 : différés (dont approchés) | Réduction L1 | L1-v : différés | Réduction L1-v |
|---|--:|--:|--:|--:|--:|
| total (40 lots) | 1 367 (19,9 %) | 343 (179), 5,0 % | −74,9 % | 146, 2,1 % | −89,3 % |
| projet 1 (26 lots) | 1 057 (19,2 %) | 168 (103), 3,0 % | −84,1 % | 58, 1,1 % | −94,5 % |
| projet 2 (14 lots) | 310 (22,6 %) | 175 (76), 12,8 % | −43,5 % | 88, 6,4 % | −71,6 % |

Sans compter les approchés comme différés, L1 laisse 164 cuts sans pose (−88,0 %). Le reste se concentre sur trois parties du projet 2 : 2:1 (127 → 83, dont 37 approchés), 2:17 (41 → 33, dont 13) et 2:18 (37 → 32, dont 9).

### 3.2 Contre Mic (différés réels jugés, Écho de la même séance : 282 ; D-220, toutes séances sans autre écriture : les mêmes 282)

| Groupe | Profil | Jugés | Posés (validés) | Départ médian | Erreur médiane | Gain médian (Q1–Q3) | ≤ 10 mm | ≤ 20 mm | Pire que le départ | Rappel |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| total | L1 | 282 | 232 (184) | 85,8 | 9,7 | 36,4 (0 – 72,2) | 51,4 % | 62,8 % | 18 | 136/272 |
| projet 1 | L1 | 111 | 107 (100) | 51,4 | 7,8 | 41,1 (25,7 – 69,4) | 64,9 % | 88,3 % | 5 | 64/102 |
| projet 2 | L1 | 171 | 125 (84) | 168,9 | 31,4 | 34,7 (0 – 75,7) | 42,7 % | 46,2 % | 13 | 72/170 |
| 2:1 | L1 | 127 | 82 (47) | 191,1 | 151,1 | 1 (0 – 123,7) | 32,3 % | 33,9 % | 13 | 41/127 |
| hors 2:1 | L1 | 155 | 150 (137) | 51,4 | 6,7 | 41,1 (25,9 – 70,4) | 67,1 % | 86,5 % | 5 | 95/145 |
| total | L1-v | 282 | 240 (240) | 85,8 | 10,2 | 36,9 (1,3 – 70,8) | 49,6 % | 60,6 % | 20 | 131/272 |
| hors 2:1 | L1-v | 155 | 152 (152) | 51,4 | 6,7 | 42,5 (27,2 – 70,4) | 67,7 % | 86,5 % | 5 | 96/145 |

Millimètres, pire des deux rails en 3D. Rappel : parmi les jugés à plus de 10 mm de Mic au départ, ceux que le profil pose à 10 mm au plus. La règle de D-220 n'ajoute aucun cut ici : hors 2:17 (sans vérité), les fichiers du diagnostic n'ont qu'un différé d'une autre séance avec une pose de Mic (1:15), et il est écarté par la règle de la pose de départ (vérifiée à 2 mm). Élargir les jugés demande de rejoindre les Échos plus tardifs, ce que ce banc ne fait pas.

**Poses à plus de 50 mm de Mic** (publiées dans la synthèse complète) : L1 **35** (30 posées sans valider, 5 validées), dont 33 en 2:1, plus 1:17 cut 2874 (sans valider, 122,6 → 56,5 mm) et 1:29 cut 8556 (validée, 0 → 58,3 mm). L1-v **48** (toutes validées), dont 45 en 2:1.

### 3.3 Où se perd le reste, motif par motif (L1)

| Raison L1 | Cuts |
|---|--:|
| posé sans valider (sous τ) | 179 |
| rien : la pose de départ est la plus probable | 91 |
| rien : meilleure paire à plus de 150 mm | 55 |
| rien : sous δ | 9 |
| sans nuage | 8 |
| commande refusée (écartement) | 1 |

Par motif réel du différé (réels → restants, dont approchés) : sans appui 879 → 241 (109) ; reprise sans minimum 221 → 34 (23) ; garde de paire 214 → 1 (1) ; hors vue 21 → 4 (0) ; reprise à plusieurs minima 12 → 0 ; règle grappe 6 → 0 ; autres 14 → 4.

### 3.4 Effets du rejeu conjoint sur ce que le lot posait déjà

Sous L1, la chaîne change (garde de paire éteinte, appuis à 10 cuts, poses validées de la GCV2 devenues appuis) : **59** cuts posés par le lot réel ne sont plus validés (28 sous L1-v), et **430** sont posés à plus de 1 mm de la pose réelle (médiane 3,4 mm). Ces cuts ne sont pas jugés ici contre Mic (ils étaient verts). La base rejouée n'en perd que 2 et n'en déplace aucun. Vues déplacées : 26 (L1), 23 (L1-v).

### 3.5 Lecture

- L1 atteint −84 % sur le projet 1 et −44 % sur le projet 2 ; L1-v −95 % et −72 %. La cible −90 % n'est atteinte que par L1-v sur le projet 1.
- Hors 2:1, les poses de L1 sont bonnes : erreur médiane 6,7 mm, 86,5 % à 20 mm, 5 poses à plus de 50 mm. **2:1 est le point faible** : 33 des 35 poses à plus de 50 mm, gain médian 1 mm.
- Ces chiffres ne changent pas la candidate (D-219).

## 5. Candidate de terrain « L1-s » (D-221) : détails tranchés avant la mesure

D-221 (après le § 3.4 : sous L1, 59 poses réelles ne sont plus validées et 430 cuts verts sont posés autrement) : la chaîne du lot ne doit pas changer.

1. **La chaîne est celle de la 4.9.5.9** : décision du lot avec ses options d'aujourd'hui (garde de paire allumée, appuis de reprise à 3 cuts), mêmes appuis, mêmes voisins. Tout cut que cette chaîne pose est posé exactement comme en 4.9.5.9 (mêmes commandes).
2. **Une pose L1-s n'est jamais un appui de la chaîne, ni un voisin** (ni pour la chaîne, ni pour la GCV2 des cuts suivants) : seules les poses de la chaîne d'aujourd'hui le sont. La mémoire de la règle « grappe » voit le lot de la 4.9.5.9 (une pose L1-s y reste un différé).
3. **Sur un cut que la chaîne d'aujourd'hui ne pose pas**, dans cet ordre, la première étape qui pose gagne :
   a. cible de la chaîne hors de la vue : la vue est déplacée (vue élargie), puis la pose de la chaîne est faite et validée ;
   b. la décision du lot est refaite avec les options de L1 (garde de paire éteinte, appuis à 10 cuts), mêmes appuis ; si elle pose (vue déplacée au besoin), pose validée ;
   c. la GCV2 (règle L1 : au-dessus de τ valider, sous τ poser sans valider, rien à plus de 150 mm), appuis de la chaîne d'aujourd'hui, options de L1, voisins = poses de la chaîne d'aujourd'hui.
   Une règle « grappe » active bloque les poses validées de a, b et c comme celles de la chaîne.
4. **Contrôle du banc** : sur les cuts que la base rejouée pose, L1-s doit poser à l'identique (compté : doit être 0).

