# Candidate L1 sur les différés du lot : banc conjoint, prédictions scellées, test 10 (D-217, D-219) — 19 octobre 2026

Ce document ne contient que des numéros de parties, de lots et de cuts, des millimètres et des comptes. « 2:1 » veut dire : projet 2, partie 1.

La candidate L1 est déclarée en D-219. Elle n'est pas changée d'après les résultats. Les détails que D-219 n'écrit pas sont tranchés au § 2, **avant toute mesure** (ce paragraphe est déposé seul, dans un commit qui précède le premier calcul du banc).

## 1. La candidate L1 (rappel de D-219)

- **P2** : la GCV2 (hypothèses H0 à H6, paramètres figés) agit sur les différés du lot **sans le couloir de 45 mm** depuis la pose de départ ; τ, δ et l'écartement de la paire sont gardés. Une cible hors de la vue : on déplace la vue, puis on pose. La garde de paire du lot est éteinte. Les appuis de reprise sont élargis à 10 cuts.
- **Sous τ** : on **pose sans valider**. Le cut reste invalide (rouge) ; l'opérateur repart d'une pose approchée. Exception : si la meilleure paire est à plus de 150 mm de la pose de départ, on ne pose rien.
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
16. **Jugement contre l'opérateur** : les règles du diagnostic (Écho de la même séance, pose de départ vérifiée à 2 mm, nuage, cut non posé ensuite par un autre lot). Écart entre deux poses : le pire des deux rails, en 3D. Gain d'un cut = écart de la pose de départ à l'opérateur − écart de la pose L1 à l'opérateur (0 si L1 ne pose rien). **Rappel** : parmi les jugés dont la pose de départ est à plus de 10 mm de l'opérateur, la part que L1 pose à 10 mm au plus.
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

### 3.2 Contre l'opérateur (différés réels jugés, Écho de la même séance : 282 ; D-220, toutes séances sans autre écriture : les mêmes 282)

| Groupe | Profil | Jugés | Posés (validés) | Départ médian | Erreur médiane | Gain médian (Q1–Q3) | ≤ 10 mm | ≤ 20 mm | Pire que le départ | Rappel |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| total | L1 | 282 | 232 (184) | 85,8 | 9,7 | 36,4 (0 – 72,2) | 51,4 % | 62,8 % | 18 | 136/272 |
| projet 1 | L1 | 111 | 107 (100) | 51,4 | 7,8 | 41,1 (25,7 – 69,4) | 64,9 % | 88,3 % | 5 | 64/102 |
| projet 2 | L1 | 171 | 125 (84) | 168,9 | 31,4 | 34,7 (0 – 75,7) | 42,7 % | 46,2 % | 13 | 72/170 |
| 2:1 | L1 | 127 | 82 (47) | 191,1 | 151,1 | 1 (0 – 123,7) | 32,3 % | 33,9 % | 13 | 41/127 |
| hors 2:1 | L1 | 155 | 150 (137) | 51,4 | 6,7 | 41,1 (25,9 – 70,4) | 67,1 % | 86,5 % | 5 | 95/145 |
| total | L1-v | 282 | 240 (240) | 85,8 | 10,2 | 36,9 (1,3 – 70,8) | 49,6 % | 60,6 % | 20 | 131/272 |
| hors 2:1 | L1-v | 155 | 152 (152) | 51,4 | 6,7 | 42,5 (27,2 – 70,4) | 67,7 % | 86,5 % | 5 | 96/145 |

Millimètres, pire des deux rails en 3D. Rappel : parmi les jugés à plus de 10 mm de l'opérateur au départ, ceux que le profil pose à 10 mm au plus. La règle de D-220 n'ajoute aucun cut ici : hors 2:17 (sans vérité), les fichiers du diagnostic n'ont qu'un différé d'une autre séance avec une pose de l'opérateur (1:15), et il est écarté par la règle de la pose de départ (vérifiée à 2 mm). Élargir les jugés demande de rejoindre les Échos plus tardifs, ce que ce banc ne fait pas.

**Poses à plus de 50 mm de l'opérateur** (publiées dans la synthèse complète) : L1 **35** (30 posées sans valider, 5 validées), dont 33 en 2:1, plus 1:17 cut 2874 (sans valider, 122,6 → 56,5 mm) et 1:29 cut 8556 (validée, 0 → 58,3 mm). L1-v **48** (toutes validées), dont 45 en 2:1.

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

Sous L1, la chaîne change (garde de paire éteinte, appuis à 10 cuts, poses validées de la GCV2 devenues appuis) : **59** cuts posés par le lot réel ne sont plus validés (28 sous L1-v), et **430** sont posés à plus de 1 mm de la pose réelle (médiane 3,4 mm). Ces cuts ne sont pas jugés ici contre l'opérateur (ils étaient verts). La base rejouée n'en perd que 2 et n'en déplace aucun. Vues déplacées : 26 (L1), 23 (L1-v).

### 3.5 Lecture

- L1 atteint −84 % sur le projet 1 et −44 % sur le projet 2 ; L1-v −95 % et −72 %. La cible −90 % n'est atteinte que par L1-v sur le projet 1.
- Hors 2:1, les poses de L1 sont bonnes : erreur médiane 6,7 mm, 86,5 % à 20 mm, 5 poses à plus de 50 mm. **2:1 est le point faible** : 33 des 35 poses à plus de 50 mm, gain médian 1 mm.
- Ces chiffres ne changent pas la candidate (D-219).

## 4. Prédictions scellées (aucun Écho lu)

Fichiers JSON lignes hors dépôt (une ligne par cut traité : sort réel du lot et sa pose, décision de chaque profil, pose, hypothèse, probabilité, écart au départ, vue déplacée), deux copies, rejoués avec `--juger-partie-reservee`. Jugement plus tard, à l'arrivée de l'Écho : `node tools/banc-differes.cjs comparer --prediction <fichier> --echo <dossier de l'Écho>` ; résumé sans vérité : `resumer`.

| Partie, lot | Profils | SHA-256 |
|---|---|---|
| 2:17 bfb15534 | base, L1, L1-v | `755654149041e90724d9f694937feaa7aafaeddf837c9e9ee2793d1ad5c11f0d` |
| 2:18 eb1d9bc2 | base, L1, L1-v | `10e8f38a0d2d0c90d3f656d19649b5a3e2c8f44b95e7097b3cb9c676f31d9367` |
| 2:19 7f46bbc5 (partie 19 du 19/10, projet non confirmé) | base, L1, L1-v | `2c66542ba9cda418dd5c7f1ffbf3a983fca3c0ea70425db27aa6f6fc04918d8f` |
| 2:19 7f46bbc5 | base, L1-s | `26ed3e70deedb141e3e236dc1ee22adb43c739d889b9c806a28456fa1324f3ac` |
| 2:17 bfb15534 | base, L1-s | `e63c9c9d3f1d1132c32d1755aff00b538cee74b5ec41bba5808cb51aebdcc71e` |
| 2:18 eb1d9bc2 | base, L1-s | `9661afc63e35260a53026aec08db8787c56fcb35718caf80c5a8fefcd877e14c` |

### 4.1 Chiffres sans vérité

**2:17** (139 cuts, 41 différés réels, 32 en ADV) : L1 pose et valide 11, pose sans valider 13, laisse 17 (11 à plus de 150 mm) ; L1-v valide 31, laisse 10. Cuts posés par le lot : 94 sur 95 comparables à 2 mm près sous L1, 3 laissés.
**2:18** (214 cuts, 37 différés réels, 30 en ADV) : L1 valide 17, sans valider 4, laisse 16 ; L1-v valide 26, laisse 11. Cuts posés par le lot : 153 à 2 mm, 6 à plus de 10 mm (jusqu'à 42,2 mm), 12 laissés ; vue déplacée 9 fois.
**Sous L1-s** : 2:17 : valide 11, sans valider 14, laisse 16 (8 à plus de 150 mm, 8 départ le plus probable) ; les 98 cuts posés par le lot le sont à l'identique ; vue déplacée 4 fois. 2:18 : valide 12, sans valider 7, laisse 18 ; les 177 cuts posés par le lot à l'identique ; vue déplacée 6 fois.

**2:19** (348 cuts traités, 103 posés, 245 différés dont 243 en ADV, 1 aux abords, 1 sans nuage) :

| | L1 | L1-v | L1-s |
|---|--:|--:|--:|
| (a) différés posés et validés | 242 | 243 | 50 |
| (a) posés sans valider | 1 | 0 | 3 |
| (a) laissés | 2 | 2 | 192 (180 : paire à plus de 150 mm ; 10 : départ le plus probable) |
| (b) cuts posés par le lot, même pose à 2 mm / 5 / 10 mm | 71 / 72 / 73 | 71 / 72 / 73 | 103 / 103 / 103 |
| (b) posés autrement (> 10 mm) | 30 (20 à 34,3 mm, tous en ADV, étage « window ») | 30 | 0 (écart max 0,6 mm) |
| (b) laissés | 0 | 0 | 0 |
| (c) vue déplacée | 196 (174 différés, 22 posés) | 196 | 3 (cuts 5030 à 5032) |

Les 10 plus grands écarts sous L1 sur les cuts posés par le lot (tous en ADV) : 5049 (34,3 mm), 5209 (34,0), 5110 (33,6), 5244 (32,1), 5231 (31,5), 5095 (30,7), 5271 (30,3), 5062 (30,3), 5088 (29,4), 5101 (29,1).
Lecture : sous L1, presque tout vient de la chaîne changée (garde de paire éteinte, poses devenues appuis, vue déplacée), très peu de la GCV2 ; sous L1-s, sans ces appuis, la GCV2 trouve la plupart des paires à plus de 150 mm de la pose de départ et ne pose rien. L'Écho de l'opérateur dira lequel a raison.


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


## 6. Résultats du banc conjoint sous L1-s (40 lots, mesurés après le § 5)

Mêmes 40 lots, mêmes jugés (282, aucun pour 2:17, 2:18). Synthèse complète : `fiches/L1S_BANC_SYNTHESE.md`.

**Contrôle de D-221 : sur les 5 512 cuts que la base rejouée pose, L1-s en pose 0 autrement** (état et pose identiques à 0,001 mm). Poses réelles perdues : 2, déplacées de plus de 1 mm : 0 (les mêmes que la base rejouée).

| Groupe | Différés réels | L1-s : différés (dont approchés) | Réduction L1-s | (rappel L1) | (rappel L1-v) |
|---|--:|--:|--:|--:|--:|
| total | 1 367 (19,9 %) | 361 (189), 5,2 % | −73,6 % | −74,9 % | −89,3 % |
| projet 1 | 1 057 (19,2 %) | 168 (105), 3,0 % | −84,1 % | −84,1 % | −94,5 % |
| projet 2 | 310 (22,6 %) | 193 (84), 14,1 % | −37,7 % | −43,5 % | −71,6 % |

Sans compter les approchés, L1-s laisse 172 cuts sans pose (−87,4 %).

| Contre l'opérateur (282 jugés) | Posés (validés) | Départ médian | Erreur médiane | Gain médian (Q1–Q3) | ≤ 10 mm | ≤ 20 mm | Pire que le départ | Rappel |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| total | 219 (156) | 85,8 | 12,7 | 30,9 (0 – 64,5) | 127 | 155 | 21 | 118/272 |
| projet 1 | 106 (92) | 51,4 | 7,9 | 40,1 (24,4 – 69) | 73 | 95 | 6 | 65/102 |
| projet 2 | 113 (64) | 168,9 | 134,2 | 11,2 (0 – 55,2) | 54 | 60 | 15 | 53/170 |
| 2:1 | 71 (28) | 191,1 | 164,4 | 0 (0 – 44,4) | 21 | 24 | 15 | 21/127 |
| hors 2:1 | 148 (128) | 51,4 | 6,9 | 41 (25,4 – 69,5) | 106 | 131 | 6 | 97/145 |

**Poses à plus de 50 mm de l'opérateur : 43** (37 sans valider, 6 validées), dont 41 en 2:1 ; ailleurs 1:17 cut 2874 (sans valider, 122,6 → 56,5 mm) et 1:29 cut 8556 (validée, 0 → 58,3 mm).

Ce qui reste (361) : 189 approchés sous τ ; rien : départ le plus probable 98, paire à plus de 150 mm 46, sous δ 9 ; sans nuage 8 ; règle grappe 6 (+1 pose de la GCV2 bloquée) ; écartement refusé 4. Par motif réel : sans appui 879 → 301 (149 approchés) ; reprise sans minimum 221 → 47 (33) ; garde de paire 214 → 2 ; hors vue 21 → 0.

Lecture : sur le projet 1, L1-s fait aussi bien que L1 (−84 %, erreur médiane 7,9 mm) sans toucher un seul cut vert. Sur le projet 2, il fait moins bien (−38 % contre −44 %), et 2:1 reste mauvais (gain médian 0, 41 des 43 poses à plus de 50 mm). Ces chiffres ne changent pas la candidate (D-221).

## 7. Premier jugement contre un Écho : partie 2:17 (Écho du 20/10/2026, 8 h 28 à 8 h 32)

Prédictions scellées avant lecture de l'Écho (SHA-256 vérifiés inchangés : L1/L1-v 755654…1f0d, L1-s e63c9c…71e). 41 différés, tous jugés (cuts 9521 à 9843 ; 0 non jugé). Détail par cut : `fiches/jugements/2-17-*.json`.

| Profil | Posés (validés) | Erreur médiane (départ 146,9) | Gain médian | ≤ 10 mm | Posés à plus de 50 mm | dont validés |
|---|--:|--:|--:|--:|--:|--:|
| L1 | 24 (11) | 115,8 mm | 0 | 14 | 5 | 1 |
| L1-s | 25 (11) | 119,1 mm | 19,3 | 14 | 7 | 1 |
| L1-v | 31 (31) | 92,0 mm | 32,6 | 12 | 13 | 13 |

Par zone (L1-s) : abords 9 cuts, erreur médiane 3,9 mm (6 à 10 mm ou moins) ; ADV 32 cuts, erreur médiane 133,2 mm (8 à 10 mm ou moins, 22 à plus de 50 mm).

Lecture : bonne en abords, mauvaise en ADV, comme en 2:1. L1-v valide 13 poses fausses de plus de 50 mm (par exemple 9523 à 9526 : 50 à 121 mm, alors que L1-s pose 9523 à 9525 à moins de 4 mm) : le gain de rappel de L1-v est payé par des validations fausses, ce qui en fait un mauvais candidat de terrain en l'état. Une seule pose validée fausse pour L1 et L1-s (9556, 158,5 mm).

## 8. Deuxième jugement : partie 2:18 (Écho du 20/10/2026, 8 h 39 à 8 h 47)

Prédictions scellées inchangées (L1/L1-v 10e8f3…9367, L1-s 9661af…e14c). 37 différés prédits, **32 jugés** ; 5 non jugés faute d'Écho de l'opérateur sur ces cuts (« sansMic »), la séance n'ayant pas encore tout couvert. Détail : `fiches/jugements/2-18-*.json`.

| Profil | Posés (validés) | Erreur médiane (départ 159,9) | Gain médian | ≤ 10 mm | Posés à plus de 50 mm | dont validés |
|---|--:|--:|--:|--:|--:|--:|
| L1 | 19 (17) | 9,5 mm | 53,5 | 16 | 0 | 0 |
| L1-s | 17 (12) | 23,9 mm | 10,8 | 12 | 1 | 0 |
| L1-v | 23 (23) | 7,0 mm | 103,1 | 18 | 1 | 1 |

Les médianes portent sur les 32 jugés (un non posé garde son erreur de départ). Sur les cuts posés : L1, 19 sur 19 à 20 mm ou moins ; L1-s, 15 sur 17 ; L1-v, 22 sur 23. Presque tout est en ADV (29 cuts sur 32).

Lecture : l'inverse de 2:17. Ici les trois profils posent juste, y compris en ADV, et L1-v valide 23 poses dont une seule est fausse. Cumul 2:17 + 2:18 (73 jugés) : L1-v valide 54 poses dont 14 fausses (26 %), L1 28 dont 1, L1-s 23 dont 1. Le profil L1-v n'est donc pas écarté, mais ses validations fausses se concentrent sur une partie (2:17, cuts 9523 à 9653) ; il reste à comprendre ce qui distingue 2:17.

## 9. Premier lot réel de la GCV2 sous test 13 (L1-s) : partie 2:19, 20/10/2026 8 h 49 à 9 h 08

Source : export Orbite de 5 volumes archivé dans `banane-data` (`2026-10-20_v4.9.5.13_partie-19`), journal du lot (`lotProfil` L1-s, extension 4.9.5.13). Aucun Écho de cette partie à ce jour : **rien n'est jugé**, seulement ce que le lot a fait.

Départ de la partie : 5 306 validés, 248 invalides (le lot scellé du § 4 partait de 351 invalides : 103 cuts ont été validés entre-temps). Cuts proposés au lot : 248 (de 4863 à 5553). Décisions de la GCV2 journalisées : 241.

| Résultat du lot | Cuts |
|---|--:|
| Validés (dont 34 validés par la GCV2, 7 par la chaîne du lot) | 41 |
| Posés sans valider (GCV2, sous τ : 8 abords/ADV de 4863 à 4920 et 5164, 5293, 5483) | 9 |
| Laissés en différé | 198 (80 %) |

Motifs des 241 décisions : `plus-de-150-mm` 191, `valider` 34, `poser-sans-valider` 9, `départ le plus probable` 7. Chaîne du lot : `no-anchor` dans 226 cas sur 241. Les 191 « plus de 150 mm » : meilleure paire à 159–192 mm du départ (médiane 174,5 mm), de probabilité médiane 0,30 (aucune au-dessus de τ = 0,49), toutes ou presque en ADV (cuts 5030 à 5288), hypothèse H1+H2 dans 172 cas. Les 34 validés : écart médian 172,7 mm, probabilité médiane 0,55.

Bande de la prédiction scellée (192 laissés sur 245) contre le réel (198 sur 248) : les totaux concordent. Cut par cut, sur les 245 différés prédits : 163 laissés des deux côtés, 14 validés des deux côtés, 3 posés sans valider des deux côtés ; 35 prédits posés mais laissés, 27 prédits laissés mais validés, 3 autres. L'accord cut par cut est donc de 180 sur 245 (73 %), pas parfait : la chaîne et les voisins validés ont changé entre le lot scellé et celui-ci.
