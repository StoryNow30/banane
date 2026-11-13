# CH-121 : réglages figés avant jugement (13/11)

Écrits et poussés avant le premier rejeu de l'un d'eux. `grille.json` : le patch (empreinte), les 7 réglages de l'étage (`ajustementFin`, src/gcv2-l1.js), le coût et la règle d'égalité de la validation croisée « un lot dehors ».

Ce qui a été regardé AVANT de figer (mise au point, à dire dans le rapport) :
- simulation statique de l'étage sur les posés jugés des 6 lots réglables (04, 06, 08a, 08b, 11, 12/11), au total (pas de jugement par lot tenu à l'écart) ;
- 05/11 (examen) : vu une fois, dans la liste des posés de 10 à 50 mm de la mesure (cut 11/5158), avant d'être exclu de tous les affichages ; la constante c = 4,4 mm a été lue sur les rails refusés de tous les lots de novembre (05/11 compris : peu de rails) et sur octobre ;
- 14/10 p17 (garde) : forme du nuage des rails et simulation statique de la règle verticale (q50 + c) ; le seuil d'épaisseur `epMax` = 15 mm est posé a priori (bande de dessus du gabarit : ±12 mm ; les quatre cuts de CH-118 ont 19 à 21 mm).

Un réglage retouché après jugement sera un nouveau réglage (`aj-H`…), figé et poussé comme ceux-ci.

## Grille 1 écartée, grille 2 (13/11, avant tout jugement au banc)
- La grille 1 (`grille.json`, aj-A à aj-G) n'a été jugée par aucun rejeu du banc (arrêtée avant la fin du premier). La garde statique du 14/10 p17 (`outils/oct-garde.cjs`, vraie fonction du patch) la rejette : aj-A et aj-D font passer 10 justes au-delà de 10 mm. Mécanisme ÉTABLI sur 753, 4737, 5129 : refaite à une pose déjà calée, la convention verticale (q90 + 1) remonte encore de 5 à 7 mm, parce que la bande de ±12 mm suit la pose et que des points hauts y entrent (cliquet).
- Grille 2 (`grille-v2.json`, aj-H à aj-N) : vertical = médiane du dessus + c, pour tout rail ; essai de point fixe ajouté (l'étage réappliqué ne bouge plus). Le 14/10 p17 a servi à écarter la grille 1 : il n'est plus une garde jamais vue pour ce levier (il reste rapporté). Ont été vus, en statique, AVANT de figer la grille 2 : aj-H, aj-I, aj-J, aj-K sur le 14/10 p17 (0 juste perdu, 0 cut au-delà de 20 mm) et sur le total des 6 lots réglables (21 gagnés / 0 perdu ; aj-K : 14 / 0). La garde de pose des 11 lots d'octobre (`garde-gcv2 --rejouer`) n'a été vue par aucune des deux grilles.

## Grille 2 abandonnée, grille 3 (13/11, avant tout jugement au banc)
- La constante c = 4,4 de la grille 2 avait été lue sur les rails refusés de TOUS les lots de novembre, lot tenu à l'écart et examen 05/11 compris : c'est une fuite (rappel de l'intégrateur, D-352). Recalculée sur les 6 lots réglables seuls, elle vaut 5,0 ; par pli, de 3,9 (1211 tenu à l'écart) à 5,7.
- Grille 3 (`grille-v3.json`) : structure de l'étage figée a priori (valeurs par défaut du patch), c appris dans chaque pli sur ses lots d'apprentissage (`outils/c-par-pli.cjs`). Chaque lot réglable n'est rejoué et jugé qu'une fois, avec le c de son pli ; 05/11 une fois, avec c = 5,0 (`aj3-final`, le réglage proposé).
- Vu avant de figer : la garde statique du 14/10 p17 (déjà vue) avec c = 3,9, 5,0, 5,7 : 0 juste perdu, 0 cut au-delà de 20 mm dans les trois cas. Aucun lot de novembre n'a été jugé avec un c de pli.

## Grille 3 refusée par la garde d'octobre, grille 4 (vertical seul)
- Grille 3 jugée (cible des 7 lots atteinte au banc), puis garde de pose des 11 lots d'octobre ROUGE (retour 1) ; éteint : retour 0. Fautes nouvelles ÉTABLIES : latéral de l'étage sur des poses GCV2 en ADV (2-17 9803 à 24,2 mm, 2-20 288 dégradé de 4,6, 0-2310 4 à 9,98) ; ricochet 0-2310 1372 (posé par la passe à 60,2 mm) ; 90 verts changés (déplacements des cuts posés par la base, comptés recul par construction).
- Grille 4 (`grille-v4.json`) : même structure, latéral coupé, mêmes c par pli. Vu avant de figer : rien de novembre avec ce réglage ; en statique, l'ensemble des 6 lots (vertical seul, c = 4,4 : 14 gagnés / 0 perdu) avait été vu pendant la mise au point.

## Grille 4 refusée par la garde, grille 5 (13/11, avant tout rejeu ; accord de l'intégrateur)
- Grille 4 jugée (7 lots 95,5 %, 12 / 0) puis garde d'octobre ROUGE : ricochet 0-2310 1372 (60,2 mm) et 13, vertical sur des poses GCV2 en ADV (0-2310 4, 193), 53 verts changés.
- Grille 5 (`grille-v5.json`) : vertical seul, poses de la chaîne seulement, voisins = pose de la décision. **Sa structure est tirée de la garde d'octobre : cette garde n'est plus un jugement indépendant pour aj5.** Jugement indépendant : plis de novembre, examen vierge neuf chez CH-116, séance Écho.
- Patch changé (deux clés `seulChaine`, `voisinsDecision`, lues par les crochets du banc et du service worker) : éteint refait.
