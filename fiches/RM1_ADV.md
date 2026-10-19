# RM-1 — le détecteur « rail de plus » sur les parties d'apprentissage (19/10/2026)

Mission : comprendre pourquoi le détecteur figé (`fiches/DETECTION_ADV.md`, réglages `reglesMetier.valeurs.adv`, version `adv-rail-de-plus-v1`) ne voit pas la première ADV de la partie 11 du projet 2 (**2:11**, cut 6391, zone de Mic 6362–6424), le rejouer sur toutes les parties d'apprentissage qui ont des ADV notées, et mesurer en ombre toute variante qui reprendrait cette zone.

**Rien n'est changé.** Aucun réglage figé modifié, aucun code ajouté, `src/engine.js` intact, la pose ne bouge pas, le détecteur reste en ombre. Cette fiche ne contient que des mesures.

## 1. En bref

| | Résultat |
|---|---|
| **La première ADV de 2:11** | **Vue à l'Écho, pas au lot.** À l'Écho, le cœur du cut 6391 donne une alerte, et la plage 6360–6488 couvre les 63 cuts de la zone de Mic. Au lot, **aucun des 63 cuts de la zone n'est lu** : le lot n'a décidé que 131 cuts d'une partie de plus de 9 500, rien entre le 5545 et le 6435. Le détecteur n'a rien à regarder. |
| **Cause** | Une cause de lecture, pas de forme : ni seconde alerte trop loin, ni forme du cœur, ni voie qui diverge hors de la fenêtre, ni écartement. Le cut 6391 est un vert que le lot n'a pas touché (Mic : « la pose est mauvaise »). |
| **Rappel par zone (détecteur figé)** | **Écho : 16/16 zones de Mic, 26/26 points clés. Lot : 10/11 zones, 17/18 points clés** (le manquant : le cœur 6391 de 2:11). |
| **Plages sans ADV** | Écho : 1 (1:16, 4006–4071, non classée). Lot : 3, toutes dans des parties sans liste d'ADV de Mic (1:17 ×2, 1:24 ×1), comme au § 6 de la fiche d'origine. |
| **Alertes en PN** | **0 sur 663 cuts de PN** des 15 rejeux (Écho 0/540, lot 0/123). |
| **Variantes** | 9 mesurées (et une combinaison), en ombre, sur les mêmes 15 rejeux. **Aucune ne tient la porte tout en reprenant la zone manquée.** Deux la tiennent sans la reprendre (gain au cut seulement, non codées). |
| **Témoins 1:11 et 1:25** | **Non lues** : Mic n'a noté aucune ADV sur ces deux parties, et aucune variante n'est figée. |
| **Réglages** | Aucun modifié. Deux candidats « proposé, non figé » au § 7. |

## 2. La vérité utilisée

Zones et points clés tels que Mic les a notés (« marge comprise »). Sources : les notes de Mic des collections `2026-10-18_v4.9.5.7_echo-partie-10` (parties 10 et 11 du second projet) et `2026-10-18_v4.9.5.7_echo-partie-14` (parties 14 à 16 du premier), `NOTES.md` de l'Écho de 2:11 (Mic y confirme que « 4458 » est le PN 4558), et le § 2 de `fiches/DETECTION_ADV.md` pour 1:13, 1:29 et 2:1.

Statut vérifié avec `tools/manifeste-parties.cjs` : 1:12, 1:13, 1:14, 1:15, 1:16, 1:17, 1:24, 1:29, 2:1, 2:10 et 2:11 sont en **apprentissage**. 1:11 et 1:25 sont les **témoins** (`estTemoin`) : réservées, elles ne règlent rien.

| Partie | Zones d'ADV de Mic | Points clés | PN de Mic |
|---|---|---|---|
| 1:13 | 4644–4713 ; 4911–4963 | 4682 ; 4935 | 6 PN (fiche d'origine) |
| 1:14 | aucune (« que des PN que j'ai corrigés ») | — | liste non donnée |
| 1:15 | 5889–6081 ; 7036–7232 (« zone d'ADV + PN à proximité ») | aiguille 5944, cœur 6017 ; aiguille 7079, fin d'aiguille 7111 | 144–160, 6169–6173, 7598–7614, 8137–8151 |
| 1:16 | 8735–8785 ; **aiguille 1778 sans zone notée** | 8751 ; 1778 | 1678–1702 ; Mic arrête de noter les PN |
| 1:29 | 6558–6678 ; 7954–8066 | 6638 ; 8003 | 4 PN |
| 2:1 | 116–165 ; 271–670 ; 2911–3036 ; 5496–6185 | 12 aiguilles | 405–409 |
| **2:10** | aucune (« RAS ») | — | 4118–4135 |
| **2:11** | **6362–6424** ; 6425–6480 ; 7299–7385 ; 7386–7456 ; 8229–8309 | **cœur 6391** ; aiguille 6456 ; *aucune* (« on reste sur la même voie ») ; 7390 ; 8257 | 7 PN reconnus par Ariane, que Mic valide (« le reste c'est très bien » ; 4558–4581, 5528–5551, 7476–7488, 8369–8391, 8785–8805, 9176–9196, 9568–9586) |
| 1:12, 1:17, 1:24 | pas de liste d'ADV | — | 1:12 : 6 PN |

Choix faits pour ce qui n'est pas dit :
- **1:16, aiguille 1778** : Mic note l'aiguille, pas la zone. Zone **dérivée** : du cut qui suit son PN (1703) à l'aiguille plus 30 cuts (1808). Elle compte pour les points clés, pas pour les zones de Mic (1 zone notée en 1:16, pas 2), et ses alertes ne sont comptées ni en noyau, ni en marge, ni hors zone.
- **2:11, 7299–7385** : aucun point clé. Le noyau n'existe pas pour cette zone, qui ne compte que par ses marges.
- **Cœurs et fins d'aiguille** (6391, 6017, 7111) comptent comme points clés ; le noyau est à ±10 cuts d'un point clé, comme dans l'outil.
- **PN** : liste de Mic, plus les zones PN qu'Ariane reconnaît (1:14, 1:16, 1:17, 1:24 n'ont pas de liste complète).

## 3. Le détecteur figé, rejoué

Même module que l'extension (`src/regles-metier.js`), même règle de zone, **mêmes numéros qu'au § 6 de la fiche d'origine** là où les parties sont les mêmes (1:29, 2:1, 1:13, 1:12 : identiques à un cut de PN près). Lot : dans l'ordre du lot ; Écho : dans l'ordre des cuts. Contrôles :
- le recodage rapide qui a servi aux variantes donne **le même nombre de rails de plus que le module sur les 3 901 captures** des 15 rejeux, sans écart ;
- l'outil `tools/regles-metier.cjs` rejoué en entier sur l'Écho de 2:11, 1:13, 1:15 et 1:16 donne les mêmes plages, les mêmes zones retrouvées, les mêmes cuts couverts.

| Partie | Source | Zones de Mic retrouvées | Points clés couverts | Plages sans ADV | Cuts des zones de Mic dans une plage | Cuts des plages hors zones de Mic | Alertes : noyau · marge · PN · hors zone |
|---|---|--:|--:|---|--:|--:|---|
| 1:13 | Écho | 2/2 | 2/2 | 0 | 123/123 | 65 | 10/33 · 16/50 · 0/66 · 0/5 |
| 1:14 | Écho | pas d'ADV | — | 0 | — | 0 | — · — · 0/104 · 0/4 |
| **1:15** | Écho | **2/2** | **4/4** | 0 | 272/390 | 28 | 17/53 · 39/186 · 0/22 · 1/80 |
| **1:16** | Écho | **1/1** | **2/2** | **1** (4006–4071) | 51/51 | 224 | 4/20 · 7/24 · 0/131 · 7/90 |
| 1:29 | Écho | 2/2 | 2/2 | 0 | 222/234 | 62 | 21/30 · 42/110 · 0/52 · 0/398 |
| 2:1 | Écho | 4/4 | 12/12 | 0 | 715/1266 | 107 | 39/144 · 94/276 · — · 0/19 |
| 2:10 | Écho | pas d'ADV | — | 0 | — | 0 | — · — · 0/18 · 0/3 |
| **2:11** | Écho | **5/5** | **4/4** | 0 | 339/358 | 73 | 15/70 · 46/136 · 0/72 · 1/24 |
| 1:12 | Écho | pas d'ADV | — | 0 | — | 0 | — · — · 0/75 · 0/7 |
| 1:29 | lot | 2/2 | 2/2 | 0 | 187/234 | 28 | 22/22 · 11/11 · 0/26 · 1/186 |
| 2:1 | lot | 4/4 | 12/12 | 0 | 764/1266 | 102 | 72/94 · 172/254 · — · 0/3 |
| **2:11** | lot | **4/5** | **3/4** | 0 | 239/358 | 39 | 12/17 · 14/25 · 0/78 · 0/11 |
| 2:10 | lot | pas d'ADV | — | 0 | — | 0 | — · — · 0/8 · 0/1 |
| 1:17 | lot | pas de liste | — | 2 (4526–4589, 5463–5531) | — | 133 | 17 alertes hors liste sur 268 |
| 1:24 | lot | pas de liste | — | 1 (8272–8360) | — | 89 | 6 alertes hors liste sur 515 |
| **Total** | Écho | **16/16** | **26/26** | 1 | 1 722/2 422 | 559 | 106/350 · 244/782 · **0/540** · 9/630 |
| **Total** | lot | **10/11** | **17/18** | 3 | 1 190/1 858 | 391 | 106/133 · 197/290 · **0/123** · 24/973 |

Lecture :
- **Au niveau de la zone**, le détecteur retrouve toutes les zones notées à l'Écho et toutes sauf une au lot. Les trois parties nouvelles (1:15, 1:16, 2:11) sont à 100 % à l'Écho.
- **Aucune alerte en PN**, sur les 663 cuts de PN des 15 rejeux.
- **Alertes hors zone** : à l'Écho, 9, dont **7 sont la plage non classée de 1:16** (cuts 4030 à 4041), une en 1:15 (7393), une en 2:11 (7576). Au lot, 24, dont 23 dans les parties sans liste (1:17, 1:24) et une en 1:29 (8087, déjà au § 6).
- **1:16, plage 4006–4071** : un rail de 7 cm côté extérieur, 7 alertes (4030, 4036 à 4041), aucun PN reconnu. Mic n'a noté que l'aiguille 1778 et la zone 8735–8785 en disant qu'il arrête de noter les PN. **À faire confirmer par Mic** (appareil non noté ? objet voisin ?). Elle n'est pas comptée comme une fausse zone nouvelle : elle est déjà là avec les réglages figés.
- **Les cuts non couverts** viennent d'abord des cuts sans capture. Dans les zones de Mic, le détecteur ne peut juger que les cuts lus :

| Partie | Source | Cuts des zones de Mic | cuts lus | dont avec alerte |
|---|---|--:|--:|--:|
| 1:13 | Écho | 123 | 83 | 26 |
| 1:15 | Écho | 390 | 239 | 56 |
| 1:16 | Écho | 51 | 44 | 11 |
| 1:29 | Écho | 234 | 140 | 63 |
| 2:1 | Écho | 1 266 | 420 | 133 |
| 2:11 | Écho | 358 | 206 | 61 |
| 1:29 | lot | 234 | 33 | 33 |
| 2:1 | lot | 1 266 | 348 | 244 |
| 2:11 | lot | 358 | 42 | 26 |

Zone par zone pour les trois parties nouvelles (cuts de la zone de Mic dans une plage) : 1:15, 144/193 (5889–6081, plage 5890–6033) et 128/197 (7036–7232, plage 7008–7163) ; 1:16, 51/51 ; 2:11 à l'Écho, 63/63, 56/56, 68/87, 71/71, 81/81 ; 2:11 au lot, **0/63**, 56/56, 52/87, 69/71, 62/81.
- **1:15, ce qui manque** : l'Écho n'a aucun nuage de 6004 à 6085 ; et la zone de Mic va 121 cuts au-delà de la fin d'aiguille 7111 (jusqu'à 7232, avec un PN proche : surface plate de 7220 à 7228) quand la plage s'arrête à 30 cuts après la dernière alerte (7133).

## 4. Pourquoi la première ADV de 2:11 n'est pas vue au lot

**Les faits, cut par cut.**
- Le lot de 2:11 a décidé 131 cuts. Dans la zone de Mic (6362–6424) il n'en a **aucun** ; le dernier avant elle est le **5545**, le suivant le **6435**, puis 6455, 6456, 6457, 6458.
- Le cut 6391 est un vert que la pose d'ESV avait mal placé : le lot ne l'a ni décidé ni capturé. Aucun cut du lot n'est à moins de 44 cuts du cœur (6435 après, 5545 avant : 846 cuts plus tôt).
- Le 6435 est une alerte, seule : la suivante est au 6455, **20 cuts** plus loin (confirmation : 3 cuts au plus). Il appartient d'ailleurs à la zone de l'ADV 2 (6425–6480), pas à celle du cœur.
- Les plages d'Ariane au lot sont 6425–6488, 7288–7350, 7388–7470, 8223–8290 : ce sont celles que les notes de la collection de 2:11 donnent pour « zones d'ADV d'Ariane ».

**À l'Écho, la même zone est vue.** Mic a lu 51 des 63 cuts de la zone. Le cut 6390 est une alerte non confirmée, **le 6391 une alerte (rail de plus du côté gauche, de 5 à 14 cm)**, puis 6394, 6407, 6411, 6412, 6414 et 6418. Plage : 6360–6488. Le cœur (6391) et les 63 cuts de la zone de Mic sont couverts. La plage se soude à celle de l'ADV 2 (6425–6480) : à l'Écho, les deux ADV ne forment qu'une plage.

**Les hypothèses du brief, une à une.**

| Hypothèse | Verdict | Preuve |
|---|---|---|
| Seconde alerte trop loin | **Pas la cause.** Au lot il n'y a pas de seconde alerte à chercher : l'alerte voisine (6435) est celle de l'ADV 2. À l'Écho, 6390 et 6391 se suivent. | Écart de confirmation porté à 20 : la plage s'ouvre en 6405 et ne couvre pas le 6391 (§ 6). |
| Forme du cœur | **Pas la cause de l'oubli**, mais elle coûte des alertes à l'Écho. Au 6391, le côté droit est un plateau haut de près de 30 cm qui englobe la tête (la tête et le rail qui la rejoint) : seul le côté gauche donne l'alerte. Aux cuts 6392 à 6396, le rail de plus est en deux morceaux discontinus. | Profils des cuts 6385–6400 : 4 cuts sur 15 sont « non bordé » ou « pris pour un contre-rail ». |
| Voie divergente hors de la fenêtre de ±40 cm | **Réelle mais sans effet ici.** La capture ne contient rien au-delà de ±40 cm de chaque rail (bornes à −40 et +40 cm aux quantiles 10, 50 et 90 % des captures de quatre parties) : 36 % des cuts du noyau à l'Écho n'ont « rien de haut hors de la tête ». | Fenêtre portée à 50, 60 ou 70 cm : seul le rejet « touche le bord » disparaît (variante « bord relâché », § 6). |
| Écartement | **Hors sujet.** Le détecteur ne le lit pas. Il ne se transporte pas d'une partie à l'autre (AUC 0,29 à 0,82, § 3 de la fiche d'origine). | — |

**Conclusion : la zone n'est pas atteignable avec les cuts que le lot lit.** Ce n'est pas un seuil à ajuster. Pour qu'une plage s'ouvre autour du 6391 il faut y avoir lu au moins deux cuts à 3 cuts l'un de l'autre. Essai sur l'Écho de 2:11 (les cuts lus sont ceux du lot plus un cut sur *pas*, sans toucher aux seuils) :

| Un cut lu tous les… | Le cœur 6391 est couvert |
|---|---|
| 1 cut (tout l'Écho) | oui (plage 6360–6488) |
| 2 cuts | 1 décalage sur 2 |
| 3 cuts | 2 décalages sur 2 |
| 4, 5, 8, 10, 15, 20 cuts | jamais (plage 6402, 6405 ou 6423 au mieux, ou aucune) |

C'est une mesure de principe, pas un réglage : lire un cut sur trois partout reviendrait à capturer plus de 3 000 cuts au lieu des 131 du lot, avec une commande de capture de plus vers ESV, donc un changement du lot : hors du cadre de cette mission.

## 5. Causes des cuts du noyau sans alerte (toutes parties, détecteur figé)

Cause = le candidat qui va le plus loin dans la chaîne des conditions, sur les deux côtés du cut. Noyau : ±10 cuts d'un point clé.

| Cause | Écho (350 cuts) | Lot (133 cuts) |
|---|--:|--:|
| **Alerte** | 106 (30 %) | 106 (80 %) |
| Rien de haut hors de la tête (l'appareil n'est pas dans la fenêtre) | 127 (36 %) | 0 |
| Non bordé (rampe, voisin haut) | 43 (12 %) | 13 (10 %) |
| Pris pour un contre-rail de courbe | 25 (7 %) | 4 (3 %) |
| Haut mais discontinu seulement | 13 (4 %) | 0 |
| Trop étroit (< 3 cm) | 13 (4 %) | 0 |
| Touche le bord de la fenêtre | 12 (3 %) | 1 (1 %) |
| Collé à la tête | 4 (1 %) | 8 (6 %) |
| Sans creux à moins de 5 cm | 5 (1 %) | 0 |
| Surface plate (PN) / trop large | 2 (1 %) | 1 (1 %) |

- Au lot, les cuts lus sont ceux que le lot a décidés, souvent près de l'appareil : 80 % d'alertes dans le noyau. À l'Écho, Mic lit aussi des cuts loin de l'appareil (36 % sans rien de haut), d'où 30 %.
- Les marges (782 cuts à l'Écho, 290 au lot) ont la même répartition : 42 % « rien de haut » à l'Écho, 68 % d'alertes au lot, 10 % « collé à la tête » au lot.

## 6. Les variantes, en ombre

Chaque variante est une **option** : sans elle, le comportement reste le comportement figé, octet pour octet (aucune n'est codée dans le module). Mesure sur les 15 rejeux du § 3, mêmes rôles de cuts, même règle de zone.

La porte (brief) :
- **P1** aucune fausse zone nouvelle sur les parties d'apprentissage (plage sans ADV de plus, parties sans liste comprises, par prudence) ;
- **P2** rappel et fausses alertes du § 6 inchangés ou meilleurs (zones, points clés, cuts couverts, plages sans ADV, alertes hors zone, alertes en PN) ;
- **P0** reprendre la zone manquée : le cœur 6391 de 2:11 couvert au lot.

| Variante | Source | Zones | Points clés | Cuts des zones | Plages sans ADV | Alertes noyau | marge | PN | hors zone | 6391 au lot |
|---|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| **Figé** | Écho | 16/16 | 26/26 | 1 722/2 422 | 1 | 106/350 | 244/782 | 0 | 9 | — |
| | lot | 10/11 | 17/18 | 1 190/1 858 | 3 | 106/133 | 197/290 | 0 | 24 | non |
| Écart de confirmation 6 | Écho | 16/16 | 26/26 | 1 723/2 422 | 1 | 106/350 | 244/782 | 0 | 9 | |
| | lot | 10/11 | 17/18 | 1 190/1 858 | **4** | 106/133 | 197/290 | 0 | 24 | non |
| Écart de confirmation 10 | Écho | 16/16 | 26/26 | 1 733/2 422 | 1 | 106/350 | 244/782 | 0 | 9 | |
| | lot | 10/11 | 17/18 | 1 209/1 858 | **4** | 106/133 | 197/290 | 0 | 24 | non |
| Écart de confirmation 20 | Écho | 16/16 | 26/26 | 1 733/2 422 | 1 | 106/350 | 244/782 | 0 | 9 | |
| | lot | 11/11 (20 cuts sur 63) | 17/18 | 1 229/1 858 | **4** | 106/133 | 197/290 | 0 | 24 | non |
| Écart 20 + marge avant 45 | Écho | 16/16 | 26/26 | 1 784/2 422 | 1 | 106/350 | 244/782 | 0 | 9 | |
| | lot | 11/11 | **18/18** | 1 290/1 858 | **4** | 106/133 | 197/290 | 0 | 24 | **oui** |
| Marges 40 / 40 | Écho | 16/16 | 26/26 | 1 812/2 422 | 1 | 106/350 | 244/782 | 0 | 9 | |
| | lot | 11/11 (cœur non) | 17/18 | 1 275/1 858 | 3 | 106/133 | 197/290 | 0 | 24 | non |
| Bord de fenêtre relâché | Écho | 16/16 | 26/26 | 1 732/2 422 | 1 | **121/350** | 264/782 | 0 | 9 | |
| | lot | 10/11 | 17/18 | 1 192/1 858 | 3 | 109/133 | 200/290 | 0 | 24 | non |
| Mi-hauts fusionnés, 70 % continus | Écho | 16/16 | 26/26 | 1 725/2 422 | 1 | **120/350** | 248/782 | 0 | 9 | |
| | lot | 10/11 | 17/18 | 1 190/1 858 | 3 | 110/133 | 201/290 | 0 | 24 | non |
| Mi-hauts fusionnés, 60 % continus | Écho | 16/16 | 26/26 | 1 736/2 422 | 1 | 139/350 | 256/782 | 0 | 9 | |
| | lot | 10/11 | 17/18 | 1 220/1 858 | 3 | 117/133 | 203/290 | 0 | **27** | non |
| Plateau collé à la tête (≥ 14 cm) | Écho | 16/16 | 26/26 | 1 740/2 422 | 1 | 123/350 | 259/782 | 0 | **10** | |
| | lot | 10/11 | 17/18 | 1 210/1 858 | 3 | 112/133 | 206/290 | 0 | **26** | non |

Définitions :
- **Écart de confirmation** : deux alertes à *n* cuts au plus ouvrent la zone (figé : 3).
- **Marge avant** : cuts à contrôler avant la première alerte (figé : 30).
- **Bord de fenêtre relâché** : un rail de plus qui va jusqu'au bord des points capturés (±40 cm) n'est plus rejeté ; il lui faut toujours un creux à 5 pas.
- **Mi-hauts fusionnés** : la suite de pas hauts compte aussi les pas mi-hauts (hauts mais discontinus le long de la voie), jusqu'à 22 cm, avec 3 pas continus au moins et la part indiquée de pas continus. C'est la réponse à la forme du cœur et de la voie qui diverge (rail oblique, vu en pointillé).
- **Plateau collé à la tête** : plateau haut qui contient la tête, de 14 à 30 cm, élargi d'un seul côté (cœur, aiguille collée).

Verdicts :

| Variante | P0 (6391 au lot) | P1 (fausse zone) | P2 (§ 6) | Verdict |
|---|---|---|---|---|
| Écarts de confirmation 6, 10, 20 | non | **1:17, plage 5077–5143 de plus** | — | écartée |
| Écart 20 + marge avant 45 | **oui** | **1:17, plage de plus** | cuts de plages hors zones de Mic : 665 au lieu de 391 au lot, 804 au lieu de 559 à l'Écho (+70 % et +44 %) | **écartée** : reprend la zone au prix d'une plage de plus et de 70 % de cuts de plus dans les plages hors zones de Mic, réglée sur un seul cas |
| Marges 40 / 40 | non | tenue | cuts de plages hors zones de Mic : 587 au lieu de 391 | écartée |
| Bord de fenêtre relâché | non | tenue | tenue (aucune alerte de plus hors zone ou en PN) | **tient P1 et P2, ne reprend pas la zone** |
| Mi-hauts fusionnés, 70 % | non | tenue | tenue | **tient P1 et P2, ne reprend pas la zone** |
| Mi-hauts fusionnés, 60 % | non | tenue | 3 alertes de plus hors zone en 1:17 | écartée |
| Plateau collé à la tête | non | tenue | 1 alerte de plus hors zone à l'Écho, 2 au lot | écartée |

Combinées, « bord relâché » et « mi-hauts 70 % » donnent un noyau de 134/350 à l'Écho (figé : 106) et 113/133 au lot (figé : 106), sans plage de plus, sans alerte de plus hors zone ni en PN. Même avec cette combinaison, **le cœur 6391 reste non vu au lot** : il n'y a pas de capture à lire.

**Conclusion sur les variantes : aucune ne reprend la zone manquée en tenant la porte.** La seule qui la reprend (écart 20, marge avant 45) échoue sur P1 et sur le coût, et elle est réglée sur un seul cas. Les deux qui tiennent la porte améliorent la lecture *des cuts déjà lus* (le noyau passe de 30 % à 34–38 % à l'Écho), ce que la mission ne demande pas : au niveau de la zone, rien ne change. **Aucun code n'est ajouté.**

## 7. Réglages proposés (proposé, non figé)

Aucun réglage figé n'est modifié. `datasets/reglages-figes.json` est intact.

Deux candidats, **proposé, non figé**, à reprendre si le gain au niveau du cut devient utile (par exemple pour la liste des verts à contrôler) ; ils ne sont pas codés :
- `bord relâché` : ne pas rejeter un rail de plus qui touche le bord des points capturés. Noyau : +15 à l'Écho, +3 au lot ;
- `mi-hauts fusionnés` à 70 % continus, 3 pas continus au moins, 22 cm au plus. Noyau : +14 à l'Écho, +4 au lot.

Avant de les figer, ils doivent passer une partie jamais apprise. Les témoins 1:11 et 1:25 n'ont pas d'ADV notées : ils ne peuvent pas servir à cela.

## 8. Les témoins 1:11 et 1:25

**Non lues.** La consigne : les lire une fois, à la fin, variante figée, *si elles ont des ADV notées*. Ni les notes de leurs collections ni les fiches n'en donnent de la main de Mic (la fiche de la relecture ne cite que des zones d'ADV *reconnues par Ariane* sur ces deux parties). Sans vérité, la lecture n'aurait rien à juger. Aucune variante n'étant figée, les témoins restent intacts pour la prochaine comparaison de réglages. Si Mic note des ADV sur 1:11 ou 1:25, il faudra les lire alors, une seule fois, avec le détecteur figé.

## 9. Limites et doutes

- **Écho et lot ne sont pas la même mesure.** À l'Écho, le détecteur voit les cuts que Mic a visités (souvent près de l'appareil, souvent partiels) ; au lot, ceux que le lot a décidés. La plage de zone d'ADV de 2:11 de l'Écho est un *plafond* de ce qu'une lecture dense verrait, pas ce qu'Ariane peut faire aujourd'hui.
- **Petits effectifs.** 16 zones de Mic à l'Écho, 11 au lot ; une seule zone manquée. Les gains « au cut » des deux variantes tenantes reposent sur 350 cuts de noyau.
- **Plage 4006–4071 de 1:16** : inconnue (§ 3). Si Mic dit que c'est un appareil, le total des zones notées de 1:16 passe de 1/1 à 2/2, sans autre changement.
- **Zone dérivée de 1:16** (1703–1808) : choisie à partir de la fin du PN et de l'aiguille, pas de Mic.
- **Zone sans aiguille de 2:11 (7299–7385)** : l'outil `tools/regles-metier.cjs` exige un point clé par zone (`--adv a-b:point`). On y met le premier cut de la zone ; les comptes de noyau de l'outil diffèrent alors de ceux de ce tableau (22/81 au lieu de 15/70 pour 2:11 à l'Écho). Plages, zones et cuts couverts sont identiques.
- **Journaux du lot de 2:11** : les journaux intermédiaires d'une session précédente n'étaient plus sur le disque ; le rejeu du lot de 2:11 par l'outil complet n'a pas été refait. Le rejeu rapide y concorde cut par cut avec le module (131 cuts, 0 écart).
- **Extractions** : une partie à la fois, supprimées ensuite. Les caches de travail (captures déjà ramenées au repère de chaque rail) restent hors dépôt.

## 10. Rejouer

Les entrées (Échos, lots, journaux) restent hors dépôt. Un fichier de jeu vide suffit pour les zones d'ADV (`--jeu`).

```
node tools/regles-metier.cjs echo --partie 2:11 --echo "dossier de l'Écho" --jeu jeu-vide.jsonl \
     --pn 4558-4581,5528-5551,7476-7488,8369-8391,8785-8805,9176-9196,9568-9586 \
     --adv 6362-6424:6391,6425-6480:6456,7299-7385:7299,7386-7456:7390,8229-8309:8257 --sortie echo-2-11.json
node tools/regles-metier.cjs echo --partie 1:15 --echo "dossier de l'Écho" --jeu jeu-vide.jsonl \
     --pn 144-160,6169-6173,7598-7614,8137-8151 --adv 5889-6081:5944+6017,7036-7232:7079+7111 --sortie echo-1-15.json
node tools/regles-metier.cjs echo --partie 1:16 --echo "dossier de l'Écho" --jeu jeu-vide.jsonl \
     --pn 1678-1702 --adv 8735-8785:8751,1703-1808:1778 --sortie echo-1-16.json
node tools/regles-metier.cjs lot --partie 2:11 --journal J.json --corpus VOLUME01.zip --corpus VOLUME02.zip --jeu jeu-vide.jsonl \
     --pn … --adv … --sortie lot-2-11.json
node tools/regles-metier.cjs rapport echo-2-11.json echo-1-15.json …        (table « Zones d'ADV »)
```

- Les autres parties : lignes de commande du § 12 de `fiches/DETECTION_ADV.md`, zones du § 2 ci-dessus.
- Dans la table « Zones d'ADV » de l'outil, la zone dérivée de 1:16 compte comme une zone de Mic ; ce tableau la compte à part.
- Les variantes ont été mesurées avec des scripts hors dépôt (recodage du détecteur sur des captures ramenées au repère du rail, concordant avec le module sur chaque cut). Aucun n'est livré : aucune variante ne l'exige.
- Pour toute variante future : la comparer aux 15 rejeux du § 3, avec la porte du § 6, puis seulement ensuite lire 1:11 et 1:25 si Mic en a noté des ADV.
