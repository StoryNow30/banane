# Examen des cinq poses fausses de la deuxième passe, partie 0 du 23/10 (brouillon)

Lecture seule : aucun dépôt touché, aucun commit. Tronc lu : `claude/50-test17` à `e17078e` (copie de `src/`, `tools/`, `background.js` hors dépôt, sous `scratchpad/passe5/tree`). Données : journaux et corpus des deux lots de la partie 0 (export du cache du 23/10, export du lot 2), rejeux de T21a (`scratchpad/parT21a/base`), ombre du terrain (`scratchpad/go25/j1`, `j2`). Niveaux : ÉTABLI (mesuré ou lu dans le code), PROBABLE, SUPPOSÉ. Millimètres dans le repère profil de la pose de départ d'ESV ; « écart » = pire des deux rails, 3D, contre la pose finale de l'opérateur (juge de `tools/juger.cjs`).

## 0. En bref

1. **Les cinq poses sont des poses d'un voisin faux, suivi de proche en proche.** Quatre viennent de la « recherche recentrée » (`rechercheADV`), une (1331) de la « branche » en dernier recours. Chacune choisit la paire de cellules du nuage la plus proche de la droite des voisins déjà posés. Les voisins sont des poses fausses de la GCV2 dans le lot, de 135 à 289 mm (lever `sous-tau-coherent`), ou des poses de la passe elle-même. Les cinq paires sont à 27 à 92 mm de la pose de départ, avec un écartement plausible (1424 à 1441 mm), alors que l'opérateur a déplacé les deux rails ensemble de 140 à 265 mm. [ÉTABLI pour les chiffres ; la chaîne de causes : ÉTABLI en fenêtre de rejeu, PROBABLE sur le lot entier]
2. **Ce n'est pas un état propre au banc.** 1135 est décidée à l'identique (0,0 mm) par l'ombre du terrain ; 1328 a été écrite par le lot 2 du terrain lui-même, à 0,4 mm de la pose du banc (212 mm faux) ; 1329, 1331, 1332 n'ont pas été observées au terrain (la passe du lot 2 s'est arrêtée au cut 945), mais elles reposent sur les mêmes appuis faux (1325 et 1328, écrits) [1135, 1328 : ÉTABLI ; 1329, 1331, 1332 : PROBABLE].
3. **Avec le correctif, la passe n'aurait rien écrit sur cette partie, et pas pour une bonne raison.** Le premier « poserait » de chaque lot demande de déplacer la vue (282 au lot 1, 901 au lot 2) ; l'écriture s'arrête au premier refus. Les seules poses écrivables sont celles dont la cible est déjà dans la vue, c'est-à-dire proches du départ : au banc, 5 sur 9 sont fausses [ÉTABLI].
4. **Garde proposée** : « pose à moins de 100 mm de la pose de départ et aucune pose de la chaîne normale à 4 cuts ou moins : rien ». Elle arrête les cinq, et bloque 0 des 14 bonnes poses du banc, 0 des 57 bonnes de l'ombre du terrain, 2 des 27 bonnes des 12 lots rejoués. Seuils choisis sur ces données (voir § 4).
5. **Verdict** : pas telle quelle. Livrable avec la garde, ou, plus sûr, en ombre persistante d'abord (§ 5).

## 1. Les cinq cuts

Banc de T21a, code du tronc, recette livrée (2 passes, `sansVoieRien`). Pose et vérité en [latéral ; vertical] par rail (G gauche, D droit), mm.

| Cut | Lot, étape | Motif (hypothèses, p, paires) | Zone | Pose de la passe G ; D | Pose finale de l'opérateur G ; D | Écart G / D | Écartement : départ → pose → opérateur (réf.) |
|---|---|---|---|---|---|---|---|
| 1135 | lot 1, passe 1 | recherche ADV (H1+H2, 0,42, 88) | ADV | [−48,0 ; +2,5] ; [−12,5 ; +0,8] | [−174,0 ; +8,9] ; [−160,8 ; −22,7] | 126 / 150 | 1459,4 → 1423,8 → 1446,7 (1436,5) |
| 1328 | lot 2, passe 1 | recherche ADV (H0+H2, 0,27, 162) | abords | [+1,9 ; −1,3] ; [−22,6 ; −15,6] | [−170,5 ; +113,4] ; [−213,7 ; +77,2] | 207 / 212 | 1415,8 → 1441,0 → 1449,3 (1438,6) |
| 1329 | lot 2, passe 2 | recherche ADV (H2, 0,055, 28) | abords | [+49,4 ; −22,0] ; [−14,4 ; −42,4] | [−140,1 ; +81,2] ; [−229,7 ; +54,6] | 216 / 236 | 1362,6 → 1429,6 → 1445,3 (1438,9) |
| 1331 | lot 2, passe 1 | **branche** (H0+H2, 0,082, 54) | abords | [+70,0 ; −15,8] ; **[0 ; 0]** | [−142,6 ; +77,0] ; [−227,2 ; +49,2] | 232 / 233 | 1361,4 → 1432,2 → 1439,6 (1438,9) |
| 1332 | lot 2, passe 1 | recherche ADV (H2, 0,21, 136) | abords | [+90,0 ; −19,4] ; [+40,1 ; +4,5] | [−153,2 ; +86,9] ; [−223,5 ; +37,9] | 265 / 266 | 1378,3 → 1429,3 → 1441,9 (1438,9) |

Tous « dans la vue » (aucun déplacement de vue demandé). Écartements exacts (`ecartementDecal` sur le nuage du cut). [ÉTABLI]

**Pourquoi la passe pose là** (code : `src/gcv2-l1.js`, `deciderDiffere` ; tronc `background.js`, `passeDiffOmbre`) :

- Le moteur seul ne tranche pas (« rien », p sous τ = 0,44 à 0,49). La recherche recentrée relance le moteur autour de graines (la paire de la test 13, le voisin posé le plus proche, la voie ajustée sur les voisins, la pose de départ), retient la paire de cellules fortes à ≤ 15 mm de l'écartement de référence, **la plus proche en travers du voisin validé le plus proche** (≤ 6 cuts, ≤ 80 mm en travers, ≤ 40 mm par cut d'écart), unique, ≤ 25 mm en hauteur **« du voisin OU de la pose de départ »**. Un « rien » devient « valider ». La « branche » (1331) prend, rail par rail, l'hypothèse la plus proche de la voie géométrique ; son rail droit est tombé sur la pose de départ elle-même (0 ; 0). [ÉTABLI, lu dans le code]
- Les voisins qui portent la voie : 1135 suit **1134**, posée par le lot à 1 cut (« sous-tau-coherent », 135 mm faux) ; 1328 suit **1325** (3 cuts, « sous-tau-coherent », 220 mm faux) et **1333** (289 mm faux) ; 1329, 1331, 1332 suivent 1328 puis leurs propres poses (voie « transport » de la passe). Le plus proche appui de la chaîne normale est à 5 cuts pour 1135 (1140) et à 24 à 28 cuts pour les quatre autres (1356). Le lot 2 du banc n'a que 3 poses de la chaîne normale et 21 poses de la GCV2 ; celui du terrain 2 et 9. Un lot de reprise démarre sans appui (`lotReprise` absent du journal du lot 2). [ÉTABLI]
- La dérive est visible : rail gauche de la passe à +1,9, +49,4, +70,0, +90,0 mm sur 1328, 1329, 1331, 1332, alors que la vérité varie de −170 à −140 à −153 mm. [ÉTABLI]
- Le nuage ne départage pas : aux poses de la passe, le dessus du rail compte 19 à 138 points ; aux poses de l'opérateur, 135 à 216 (4 cuts du lot 2) ; seuils du moteur : 5 points de dessus, 3 de flanc. Au cut 1328 (rejeu de fenêtre sans voisin), aucune hypothèse du moteur n'est à moins de 100 mm de la vraie pose (travers des hypothèses : gauche −43 à +56 mm, droit −52 à +75 mm ; vérité −171 et −214 mm) : seules des graines venues des voisins peuvent l'atteindre. [ÉTABLI, rejeu de fenêtre avec diagnostic]
- L'écartement n'arrête rien : les cinq poses sont à 2 à 13 mm de la référence (réf. 1437 à 1439 mm), sous le seuil de 15 mm. La passe a « réparé » un écartement de départ trop étroit (1361 à 1416 mm pour 1328 à 1332) en déplaçant peu les rails. [ÉTABLI]
- Pour 1135 le code signalait lui-même une voie douteuse (`appuis-contradictoires`, résidu d'ajustement 27 mm) ; la recherche a validé quand même, et la garde de voie absolue (> 100 mm en travers, résidu > 40 mm) ne s'est pas déclenchée. [ÉTABLI en fenêtre]

**Ce qu'on sait du décalage d'environ 200 mm des poses de départ d'ESV sur les différés**

- Mesuré contre l'opérateur (pire rail, 3D) : lot 1 du terrain, 90 différés : médiane 216 mm, 77 à 150 mm ou plus, 10 à moins de 100 mm ; lot 2, 78 différés : médiane 221 mm, 73 à 150 mm ou plus, 2 à moins de 100 mm. Banc : 112 et 88 différés jugeables, médianes 206 et 217 mm. [ÉTABLI]
- C'est un bloc de cuts voisins, de signe constant, qui varie doucement : de 1119 à 1138 le latéral du rail gauche passe de −171 à −247 mm puis revient à −145 mm vers 1141, et le départ redevient juste d'un coup entre 1143 (−113 mm) et 1144 (0 mm). Côté gauche aux cuts 286 à 297, 901 à 911, 1119 à 1138, 1325 à 1334 ; côté droit aux cuts 939 à 955, 1162 à 1175. [ÉTABLI]
- Aux cuts 1328 à 1334 s'ajoute un écart vertical de +38 à +113 mm ; il n'existe pas en 1119 à 1138 (−23 à +15 mm). [ÉTABLI]
- **Cause du décalage : non établie.** Hypothèse SUPPOSÉE : le départ suit la voie principale pendant que le rail dévie dans l'ADV. Ce que les données disent : ces rails sont hors de portée du moteur seul (voir plus haut), seuls les voisins justes y mènent.

## 2. Banc, terrain, ou les deux ?

Le journal du terrain a `passe-differes-ombre` pour le lot 1 en entier (90 décisions : 59 « poserait », 31 « rien ») et pour le lot 2 en partie (24 décisions : 2 « poserait », 22 « rien », jusqu'au cut 945 ; l'ordre est celui des cuts).

| Cut | Banc (lot, passe, écart) | Ombre du terrain, lot 1 | Ombre du terrain, lot 2 | Écrit au terrain |
|---|---|---|---|---|
| 1135 | 1, passe 1, 150 mm | poserait, **identique** (0,0 mm), 150 mm ; vue dans | non décidé (hors des 24) | non (voir § 2.2) |
| 1328 | 2, passe 1, 212 mm | poserait **juste** (2,7 mm), vue à déplacer | non atteint | **oui, par le lot 2, en cours de lot : même pose à 0,4 mm, 212 mm faux** |
| 1329 | 2, passe 2, 236 mm | poserait juste (5,1 mm), vue à déplacer | non atteint | non ; différé en cours de lot (`recherche-adv-contredite-rien`) |
| 1331 | 2, passe 1, 233 mm | poserait juste (5,7 mm), à déplacer | non atteint | non ; différé (`veto-voie-absolue`) |
| 1332 | 2, passe 1, 266 mm | poserait juste (8,2 mm), à déplacer | non atteint | non ; différé (`sans-approche`) |

Autres poses de la passe au banc (14 bonnes) : au lot 1, 671, 750, 1350 identiques à l'ombre du terrain (≤ 0,6 mm) ; 1137 et 1168 : « rien » au terrain (`plus-de-150-mm`) ; 1375 non décidé. Au lot 2, les huit bonnes poses (290, 901, 1119, 1122, 1166 à 1169) sont retrouvées par l'ombre du lot 1 du terrain à 0,0 à 2,1 mm près (sauf 1168 : « rien ») ; 901 est aussi « poserait », identique, dans l'ombre du lot 2. [ÉTABLI]

**Ensemble de l'ombre du terrain contre le banc** :

- Lot 1 : sur 59 « poserait », 55 sont des poses que le banc fait dans le lot (50 avec vue élargie supposée, 5 dans la vue) et 4 des poses de la passe (identiques à moins de 1 mm). Sur 31 « rien », 24 sont des différés du banc, 5 des poses du lot au banc, 2 des poses de la passe au banc. [ÉTABLI]
- Lot 2 (24 décisions) : 16 « rien / différé » dans les deux ; 1 pose identique (901) ; 7 écarts, tous dans le même sens : le banc pose (290 par la passe, 291, 292, 293, 297, 903, 907 dans le lot, tous à 2,9 à 7,4 mm de l'opérateur), le terrain dit « rien » ou « poserait ». [ÉTABLI]
- Jugement de l'ombre du terrain contre l'opérateur : lot 1, 36 à ≤ 5 mm, 21 à 5–10 mm, 1 à 11,6 mm (1174), 1 à 150 mm (1135) ; lot 2, 2 à ≤ 5 mm (901, 903). Les « bonnes » comptées plus bas : 57 au lot 1 (≤ 10 mm). [ÉTABLI]

### 2.1 Ce que le banc a de propre

Au lot 2, le banc pose 1333 dans le lot (« sous-tau-coherent », 289 mm faux) ; le terrain l'a refusée (`veto-voie-absolue`). Le banc laisse 1328 différé dans le lot (la passe la pose), le terrain l'a posée dans le lot. L'autre appui faux (1325, `sous-tau-coherent`) est identique : même paire au banc et au terrain. L'hypothèse du banc d'une vue élargie qui se déplace ne joue pas pour les cinq (toutes « dans la vue »). [ÉTABLI]

### 2.2 Aurait-elle été écrite ? Ce que l'ordre et la vue changent

L'écriture suit l'ordre des décisions, une pose à la fois, et **s'arrête au premier refus** (`passeDiffEcrire`) ; `passeDiffPoser` refuse toute cible qui demande de déplacer la vue. J'ai recalculé la vue exigée, sur le nuage de chaque cut, pour les 59 « poserait » du lot 1, les 2 du lot 2 et les 19 poses du banc : l'accord avec le champ `vue` du banc est de 19 sur 19, et sur la partie 33 le calcul donne le même résultat que le terrain (7396 dans la vue, écrit ; 8020 à déplacer, « cible hors de la vue »). [ÉTABLI]

- Ombre du terrain, lot 1 : 50 poses à déplacer, 9 dans la vue (671, 750, 906, 907, 909, 910, 911, 1135, 1350). Le premier « poserait » est **282, à déplacer** : la passe, une fois persistante, n'aurait écrit **aucune pose** ; 1135 n'est jamais atteinte. Lot 2 : le premier « poserait » est 901, à déplacer : aucune pose non plus. [ÉTABLI]
- Banc, lot 1 : l'ordre est 671, 750, **1135**, puis 1137 (à déplacer) : trois écritures, dont une à 150 mm. Banc, lot 2 : 290 (à déplacer) en premier : aucune. [ÉTABLI]
- Les poses écrivables (dans la vue) sont celles proches du départ. Partie 0, banc : 9 écrivables, 4 bonnes, **5 fausses**. Ombre du terrain, lot 1 : 9 écrivables, 8 bonnes, 1 fausse (1135). Les 10 autres lots rejoués : 14 poses écrivables sur 15 jugées, toutes bonnes à 10,5 mm près, aucune à plus de 50 mm. Le risque est donc concentré dans les ADV et les lots de reprise, pas général. [ÉTABLI]

Pour 1329, 1331, 1332 : si la passe du lot 2 avait fini, elle aurait travaillé avec les appuis 1325 et 1328 (faux, écrits) et sans appui de la chaîne normale à moins de 24 cuts, comme au banc. Que la passe du terrain les eût écrites est **PROBABLE, non observé** : l'ombre du lot 2 s'arrête au cut 945. La passe persistante en ombre sur un second lot de reprise trancherait.

## 3. Motif commun

| Hypothèse du texte de la demande | Verdict |
|---|---|
| Voie décalée d'une voie | **Non.** Les décalages sont de 140 à 265 mm, pas d'un entre-voie. Ce sont des paires de rails cohérentes mais déplacées ensemble, à plausible écartement. [ÉTABLI] La nature de l'objet que le nuage soutient à la fausse place n'est pas établie. [SUPPOSÉ : l'autre branche de l'ADV] |
| Écartement changé | **Pas discriminant.** Écartement de la pose à 2 à 13 mm de la référence pour les cinq ; il a changé de +25, +67, +71, +51 et −36 mm par rapport au départ, mais le départ était trop étroit (1361 à 1416 mm) pour quatre. [ÉTABLI] |
| ADV | **Oui, nécessaire.** Zone ADV (1135) ou abords d'ADV (quatre) : la recherche recentrée ne tourne que là. Mais les 10 autres lots rejoués y font 15 poses de passe sans faute grave. [ÉTABLI] |
| Peu d'appui | **Oui, c'est le cœur.** Voisins posés par la GCV2 seulement, faux (1134, 1325, 1333) ; aucun appui de la chaîne normale à moins de 24 cuts (quatre) ou 5 cuts (1135). Lot de reprise sans appui de départ. [ÉTABLI] |
| Autres | Près du départ : 27 à 92 mm, contre 200 à 226 mm pour les 10 bonnes poses « à déplacer » du banc (les 4 bonnes « dans la vue » : 44, 113, 158, 197 mm). Hauteur « du voisin ou du départ ». Soutien du nuage minimal (5/3 points). p faible (0,055 à 0,42) : non discriminant, les bonnes ont p de 0 à 0,57. [ÉTABLI] |

**Mécanisme** : la pose de la passe est dictée par ses graines, donc par ses voisins ; un voisin faux entraîne le suivant (la tolérance est de 40 mm par cut). Les trois voisins faux de départ sont des poses « sous-tau-coherent » de la GCV2 dans le lot (3 des 5 poses à plus de 50 mm de la colonne « GCV2 dans le lot » de T21a : 1134, 1325, 1333). **Rejeux de fenêtre** (copie du banc filtrée sur des cuts, hors dépôt, ~2 min chacun ; reproduction partielle, voir limites) :

- Lot 1, cuts 1100 à 1150 : la fenêtre reproduit 1134 (135,1 mm) et 1135 (même pose, 150,2 mm). Lever `sousTauCoherentMm` coupé : 1135 devient **juste (4,0 mm)**, et 1131 à 1138 sont posées à 1,2 à 10,0 mm. [ÉTABLI en fenêtre]
- Lot 2, cuts 1300 à 1345 : la fenêtre reproduit des poses fausses de 252 à 289 mm (1329, 1332, 1333, 1334 ; les cuts ne sont pas exactement ceux du rejeu entier, l'état diffère). Lever coupé : **aucune pose** dans la fenêtre. [ÉTABLI en fenêtre ; sur le lot entier PROBABLE]

## 4. Gardes proposées (rien n'est codé)

Comptes sur 19 poses de passe de la partie 0 au banc (14 bonnes ≤ 10 mm, 5 fausses > 50 mm), 59 poses de l'ombre du terrain (57 bonnes ≤ 10 mm du lot 1 ; 1 à 11,6 mm ; 1 fausse), et les 38 poses de passe des 12 lots rejoués (34 jugées : 27 bonnes, 2 entre 10 et 50 mm, 5 fausses).

| Garde | Fausses arrêtées | Bonnes bloquées : banc (14) | terrain (57) | 12 lots (27) | Niveau |
|---|---|---|---|---|---|
| **A. Près du départ sans appui normal** : D < 100 mm (déplacement du pire rail par rapport au départ) **et** aucune pose de la chaîne normale (première passe, fenêtre, choix) à ≤ 4 cuts, alors « rien » | **5/5** (D et plus proche appui : 1328 27 mm, 28 cuts ; 1135 48 mm, 5 ; 1329 54 mm, 27 ; 1331 72 mm, 25 ; 1332 92 mm, 24) | **0** | **0** (1350 : D 43,8 mais appui à 1 cut) | **2** (9521, 9522 du lot « 2-17 » de la base de T21a, appui à 7 et 8 cuts) | ÉTABLI sur ces données ; seuils choisis après coup : 4 cuts est juste (1135 est à 5) ; avec 6 cuts, 4/5. SUPPOSÉ généralisable. |
| A0. Variante simple : D < 100 mm seul | 5/5 | 1 (1350) | 1 (1350) | 6 (1350, 6455, 9521, 9522, 88, 148) | ÉTABLI ; coûte 6 bonnes sur 15 poses des autres lots. À éviter. |
| **B. Cadre par la liste d'ESV** : si la liste a des cuts valides des deux côtés à ≤ 6 cuts d'écart (drapeaux « traité/vu » ignorés), la pose reste à ≤ 25 mm de leur interpolation, en travers et en hauteur ; sinon, rien à vérifier | 4/5 (1328, 1329, 1331, 1332 : 190 à 269 mm en travers, 87 à 116 mm en hauteur) ; 1135 sans voisin dans la liste | **0** (290, 901, 1119 : 5 à 7 mm ; 671, 750, 1350 : 2 à 6 mm) | **0** (applicable à 3 poses sur 61) | non mesuré | ÉTABLI sur ces cuts ; la liste donne la vraie voie à 2 à 7 mm pour les quatre. Applicable à peu de poses : complément, pas garde unique. Piège : les voisins « valides » de la liste peuvent être des poses fausses du lot (5 sur 105 > 50 mm). |
| **C. Cause** : ne pas laisser les poses `sous-tau-coherent` servir d'appui, de voisin ou de transport à la passe (ou couper le lever) | 5/5 en fenêtre (1135 devient juste ; lot 2 : 0 pose) | non mesuré sur le lot entier | non mesuré | le lever fait 21 poses sur les 12 lots : 14 bonnes, 3 fausses | PROBABLE. Touche la GCV2 dans le lot (priorité 1 de D-250) ; à mesurer par la garde de T21a avant tout. |
| D. Plafond d'écriture `ecritureMax` (réglage existant) | 0 (borne le nombre, pas la qualité) | — | — | — | ÉTABLI. Au banc lot 1 : 671, 750, **1135** sont les 3 premières écritures. |

Lecture : A est la seule garde qui arrête les cinq et ne bloque presque aucune bonne pose sur ce qu'on a mesuré ; B coûte zéro et rattrape les quatre du lot 2 avec une preuve indépendante des poses de la GCV2 ; C traite la cause. Rien de tout cela n'est rejoué sur les 12 lots avec la garde en place (rejeu lourd interdit ici) : l'effet de A et de B sur les autres colonnes de la garde de T21a est un calcul sur les sorties existantes, pas un rejeu.

## 5. Verdict

**La passe persistante ne peut pas aller au terrain telle quelle.** [ÉTABLI pour le risque ; PROBABLE pour l'ampleur]

- La persistance elle-même ne dégrade rien : c'est l'écriture qui expose. Sur cette partie, la passe n'aurait rien écrit, mais pour une raison fortuite (l'ordre et la vue). Là où le premier « poserait » est dans la vue, les écritures sont les poses proches du départ, et au banc 5 sur 9 sont fausses (150 à 266 mm) et **validées dans ESV : le cut n'est plus rouge pour l'opérateur** (faux verts).
- Hors ADV et lots de reprise, les 10 autres lots rejoués montrent une passe propre (13 bonnes sur 15 jugées, 0 à plus de 50 mm, 14 poses écrivables). La valeur est réelle ; elle justifie une garde plutôt qu'un abandon.
- **Option conseillée** : livrer la persistance avec `ecriture` coupée (ombre persistante). Coût : aucun risque d'écriture ; gain : l'ombre complète du lot 2 (trancher 1329, 1331, 1332), et des poses à contrôler pour la liste de 60 que T21a ne peut pas former (1 cut disponible). Puis ouvrir l'écriture avec la garde A (et B si on veut) après passage de la garde de T21a (rejeu des 12 lots : tenir 0 pose à plus de 50 mm en colonne « avec passe », bonnes poses de la passe : critère proposé, pas plus de 2 perdues sur 27, ce que la garde A mesure aujourd'hui).
- Si l'écriture doit rester allumée : garde A au minimum, `ecritureMax` bas (10) pour borner, et un contrôle a posteriori des cuts écrits (T21a) dès les premières parties.

## 6. Limites, ce qui n'est pas établi

- Les rejeux de fenêtre ne reproduisent pas l'état du lot entier ; ils montrent le phénomène (poses fausses près du départ, nées d'un voisin « sous-tau-coherent »), pas la liste exacte des cuts du lot 2.
- Je n'ai pas observé la passe du lot 2 du terrain au-delà du cut 945.
- La vue exigée est calculée sur le nuage du lot ; la passe recapture le cut au moment d'écrire. Accord vérifié sur la partie 33 (un cut écrit, un refus) et 19 poses du banc ; pas sur plus de cas du terrain.
- Les seuils de la garde A (100 mm, 4 cuts) sont fixés sur 5 fausses poses d'une seule partie ; un second lot de reprise est à mesurer.
- Le décalage d'environ 200 mm des poses de départ d'ESV n'a pas d'explication établie.
- Disque : extractions temporaires supprimées à la fin.

## 7. Reproduire

Scripts (hors dépôt) sous `scratchpad/passe5/scripts` : `cinq.py` (tableau des 19 poses de la passe au banc), `terrain.py` (décisions de l'ombre du terrain), `vue.cjs` (vue exigée par pose), `liste.cjs` et `liste-voisins.cjs` (voie de la liste d'ESV, drapeaux ignorés avec `IGNORER_DRAPEAUX=1`), `ecartement.cjs` (écartement exact), `soutien.cjs` (points de dessus et de flanc), `tous-lots.py` (12 lots), `extraire-fenetre.cjs`, `lire-fen.py`, `lire-fen1.py`. Rejeux de fenêtre : copie de `tools/banc-differes.cjs` avec un filtre `BANC_FENETRE=a-b` sur les cuts du lot, leviers de la recette livrée dans `BANC_LEVIERS` (`sousTauCoherentMm: null` pour la coupure). Aucune modification du dépôt.
