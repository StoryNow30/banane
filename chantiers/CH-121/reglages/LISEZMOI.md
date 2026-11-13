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
