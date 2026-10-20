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
Lecture : sous L1, presque tout vient de la chaîne changée (garde de paire éteinte, poses devenues appuis, vue déplacée), très peu de la GCV2 ; sous L1-s, sans ces appuis, la GCV2 trouve la plupart des paires à plus de 150 mm de la pose de départ et ne pose rien. L'Écho de Mic dira lequel a raison.


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

| Contre Mic (282 jugés) | Posés (validés) | Départ médian | Erreur médiane | Gain médian (Q1–Q3) | ≤ 10 mm | ≤ 20 mm | Pire que le départ | Rappel |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| total | 219 (156) | 85,8 | 12,7 | 30,9 (0 – 64,5) | 127 | 155 | 21 | 118/272 |
| projet 1 | 106 (92) | 51,4 | 7,9 | 40,1 (24,4 – 69) | 73 | 95 | 6 | 65/102 |
| projet 2 | 113 (64) | 168,9 | 134,2 | 11,2 (0 – 55,2) | 54 | 60 | 15 | 53/170 |
| 2:1 | 71 (28) | 191,1 | 164,4 | 0 (0 – 44,4) | 21 | 24 | 15 | 21/127 |
| hors 2:1 | 148 (128) | 51,4 | 6,9 | 41 (25,4 – 69,5) | 106 | 131 | 6 | 97/145 |

**Poses à plus de 50 mm de Mic : 43** (37 sans valider, 6 validées), dont 41 en 2:1 ; ailleurs 1:17 cut 2874 (sans valider, 122,6 → 56,5 mm) et 1:29 cut 8556 (validée, 0 → 58,3 mm).

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

Prédictions scellées inchangées (L1/L1-v 10e8f3…9367, L1-s 9661af…e14c). 37 différés prédits, **32 jugés** ; 5 non jugés faute d'Écho de Mic sur ces cuts (« sansMic »), la séance n'ayant pas encore tout couvert. Détail : `fiches/jugements/2-18-*.json`.

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

## 10. Deuxième lot réel sous test 13 (L1-s), jugé contre l'Écho : partie 2:20, 20/10/2026

Sources :

- l'export Orbite de 10 volumes archivé dans `banane-data` (`2026-10-20_v4.9.5.13_partie-20`), profil du lot L1-s, extension 4.9.5.13 ;
- l'Écho de l'opérateur archivé à part (`2026-10-20_v4.9.5.13_echo-partie-20`), de 12 h 08 à 12 h 32 : 536 visites sur 516 cuts, tous les segments présents.

Jugement par cut : `fiches/jugements/2-20-lot-reel-echo-20261020.json`. Ce fichier contient des décalages en mm depuis la pose de départ de l'Écho, aucune coordonnée absolue.

Méthode, celle du § 9 complétée de la vérité :

- **Pose de l'opérateur** : `micDepuisEcho`. La correction se mesure par la norme maximale des décalages des deux rails, jamais par l'écartement de départ.
- **Cut validé par le lot** : la pose de départ de l'Écho est la pose du lot (écartement identique à 0,5 mm près pour les 57 cuts de la GCV2). La correction de l'opérateur est donc l'erreur de la pose.
- **Cut laissé** : la pose de départ est celle d'ESV (1 500 mm). L'erreur de la paire que la GCV2 proposait, sans la poser, se mesure dans le même repère.

### 10.1 Ce que les lots ont fait

Deux lots L1-s se sont succédé sur la partie :

- **lot fd7067f7** : de 10 h 13 à 10 h 26, cuts 0 à 320 ;
- **lot f228f6f9** : de 10 h 27 à 12 h 02, cuts 289 à 3793. Il a repris 32 différés du premier lot et s'est arrêté sur une page ESV sans réponse, après le dernier cut.

L'audit du serveur concorde à l'unité (0 écart) :

| Moment | Valides | Invalides |
|---|--:|--:|
| Départ du premier lot | 5 124 | 379 |
| Fin du premier lot | 5 212 | 291 |
| Fin du second lot | 5 370 | 133 |

| Issue finale des 379 cuts invalides au départ | Cuts |
|---|--:|
| Validés par la chaîne du lot (sans la GCV2) | 189 (84 + 105) |
| Validés par la GCV2 (« valider ») | 57 (4 + 53), 56 en ADV |
| Posés sans valider (GCV2 sous τ, premier lot) | 3 (cuts 95, 100, 148) |
| Laissés en différé | 130 (34 %) |

Décisions de la GCV2 journalisées :

- premier lot : 46, dont `départ le plus probable` 25, `plus-de-150-mm` 13, `valider` 4, `poser-sans-valider` 4 ;
- second lot : 177, dont `plus-de-150-mm` 122, `valider` 54 (une refusée par ESV, écartement trop grand, cut 417).

Les 130 laissés sont presque tous en ADV (128), entre les cuts 0 et 515. Leurs motifs : `plus-de-150-mm` 127 (meilleure paire à 171,3 mm médians du départ, probabilité médiane 0,25), `départ le plus probable` 2, `valider` refusé par ESV 1.

Toutes les décisions de la GCV2 portent sur un cut capturé : aucune pose sans nuage.

### 10.2 Contre l'opérateur

| Groupe | Cuts | Jugés | Correction médiane | ≤ 10 mm | 10–20 | 20–50 | > 50 mm |
|---|--:|--:|--:|--:|--:|--:|--:|
| Validés par la GCV2 | 57 | 56 | 22,8 mm (q90 30,9, max 35,5) | 9 | 9 | 38 | 0 |
| Validés par la chaîne | 189 | 159 | 0 mm (q90 30,4, max 34,6) | 109 | 9 | 41 | 0 |
| Laissés : paire proposée, non posée | 130 | 128 | 23,1 mm | 14 | 24 | 90 | 0 |
| Posés sans valider (erreur de la pose) | 3 | 3 | 87,6 mm | 1 | 0 | 0 | 2 |

Parmi les 159 cuts de la chaîne jugés, 89 ont été jugés par « visite sans action = bon ». Les laissés ont tous été validés par l'opérateur, à 191,8 mm médians de la pose d'ESV.

**Budgets de D-223 sur les 215 validations jugées (GCV2 et chaîne).** Les trois budgets chiffrés sont tenus :

- mauvaise voie validée : 0 (budget 1 %) ;
- validée à plus de 50 mm : 0 (budget 3 %) ;
- pose sans preuve du nuage : 0.

En revanche, **79 validations sur 215 (37 %) sont à 20–50 mm** de l'opérateur : 38 de la GCV2 et 41 de la chaîne, ces dernières toutes dans le second lot (cuts 386 à 505, et 326). D-223 ne chiffre pas cette bande ; c'est le défaut de qualité de ce lot.

**Cause, la même qu'en 2:19 : des paires trop larges.**

- L'erreur est sur un seul rail, en travers : 23,1 mm médians (q90 30,9) pour les validées de la GCV2, 22,7 mm pour les paires des laissés. L'autre rail est juste à ± 1 mm. En 2:19, c'était l'autre rail du repère (−27 mm).
- **Écartements posés** :

  | Cuts | Écartement posé |
  |---|--:|
  | Validés par la GCV2 | 1 459,9 mm médians (q10 1 439,8, q90 1 465,5) |
  | Chaîne, à plus de 20 mm de l'opérateur | 1 464,5 mm médians |
  | Chaîne que l'opérateur garde à 10 mm près | 1 436,4 mm médians |

- La médiane des voisins (`gMedMm`) est à 1 461 mm et confirme la paire trop large. Dans le second lot, la chaîne du lot, guidée par les mêmes voisins, a fait la même erreur.

### 10.3 Comparaison avec 2:19 (lot réel, § 9, jugé contre son Écho)

| | 2:19 | 2:20 |
|---|--:|--:|
| Cuts du lot | 248 | 379 (2 lots) |
| Laissés en différé | 198 (80 %) | 130 (34 %) |
| Validés par la GCV2 (jugés) | 34 (33) | 57 (56) |
| dont ≤ 10 mm / 20–50 / > 50 | 1 / 31 / 0 | 9 / 38 / 0 |
| Correction médiane des validés de la GCV2 | 26,9 mm | 22,8 mm |
| Validés par la chaîne à 20–50 mm | 2 sur 7 | 41 sur 159 |
| Paires des laissés : médiane, ≤ 10 mm, > 50 mm | 28,9 mm, 0 sur 190, 0 | 23,1 mm, 14 sur 128, 0 |

**Lecture.** Le taux de différés est plus bas, parce que la chaîne a validé beaucoup plus de cuts (189 contre 7), mais **ce n'est pas un progrès de la GCV2**. La cause est la même : paires trop larges d'environ 25 mm en ADV, puis refus « plus de 150 mm » de paires qui n'étaient fausses que d'un rail. En 2:20, le défaut gagne la chaîne du lot.

### 10.4 Correction des « posés sans valider » du § 9 et de `L1_APPRENTISSAGE`

Une pose sans validation **ne reste pas dans ESV**. À l'arrivée de l'opérateur dans l'Écho, ESV montrait la pose d'origine, pas celle du lot : écartement 1 500 mm, ou 1 406,1 et 1 373,3 mm pour deux cuts. C'est le cas des 9 cuts de 2:19 comme des 3 de 2:20.

La mesure « 8 sur 9 à plus de 50 mm » de 2:19 (`L1_APPRENTISSAGE`, § 1) était donc la correction de l'opérateur depuis la pose d'ESV, et non l'erreur de la pose. Dans le bon repère, l'erreur des 9 poses de 2:19 est :

- à 10 mm au plus : 4 (1,8 ; 3,1 ; 7,9 ; 8,2) ;
- de 10 à 20 mm : 2 (10,1 ; 10,4) ;
- de 20 à 50 mm : 1 (42,1) ;
- à plus de 50 mm : 2 (118,5 ; 171,8).

En 2:20, l'erreur des 3 poses est 1,4, 87,6 et 118,5 mm.

Sur les 12 poses des deux parties : 5 à 10 mm, 2 de 10 à 20, 1 de 20 à 50, 4 à plus de 50 mm. Le retrait des poses approchées en L1-e reste justifié, puisqu'une pose sur trois est mauvaise, mais il ne change rien dans ESV : la pose disparaît de toute façon.

### 10.5 Ce que la test 14 (L1-e) aurait fait sur ces deux lots

Le rejeu tient seulement des mesures. La partie 2:20 est **hors apprentissage** : les seuils de L1-e sont figés depuis 2:19.

- **Commande** : `tools/banc-differes.cjs rejouer --profils base,L1-s,L1-se`, avec le code de la test 14 (`claude/50-l1-apprentissage`, 045f338, sans modification).
- **Liste d'ESV** : instantané de 10 h 27, celui du lot.
- **Vérité** : celle du § 10.2.
- **Limite** : le second lot est rejoué depuis l'état réel laissé par le premier.

| Profil rejoué | Différés finals | GCV2 : poses jugées | ≤ 10 mm | 10–20 | 20–50 | > 50 mm | Cuts de la chaîne changés |
|---|--:|--:|--:|--:|--:|--:|--:|
| Réel (test 13) | 133 (dont 3 posés sans valider) | 55 | 9 | 8 | 38 | 0 | — |
| L1-s rejoué | 132 (dont 3 approchés) | 54 | 9 | 6 | 39 | 0 | 0 |
| **L1-se (test 14)** | **40** | 146 | **142** | 4 | **0** | **0** | 0 |

Différés finals = différés du premier lot que le second n'a pas repris, plus ceux du second ; un approché (posé sans valider) reste invalide et compte comme différé.

Différés de L1-se par motif :

- premier lot : 42 différés (`départ le plus probable` 24, `plus-de-150-mm` 13 dont 2 sans soutien du nuage, `sans-approche` 4, chaîne 1) ;
- second lot : 30, tous `plus-de-150-mm`, dont 5 avec anomalie d'écartement non soutenue par le nuage.

La correction d'écartement s'applique à 133 cuts du second lot, sur une référence médiane de 1 435,3 mm.

**Ce qui reste hors de portée de L1-e :** les **42 validations de la chaîne à 20–50 mm** du second lot (cuts 326 à 505). L1-e ne corrige que les décisions de la GCV2, pas la chaîne, qui fait la même erreur d'écartement.

**Raisons tapées dans l'Écho (indicatif).** Une seule raison est utilisée, « PN », sur 18 cuts : 8 validés par la chaîne du lot, 10 hors des cuts du lot. Aucune raison n'est tapée sur un cut de la GCV2.
