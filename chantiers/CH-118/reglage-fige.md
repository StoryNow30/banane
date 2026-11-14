# CH-118 : réglage figé avant tout jugement (12/11, avant d'ouvrir un lot non vu)

Appris sur : Échos du 12/11 contre les lots des 11/11 (parties 15, 16, 17) et 12/11 (parties 0, 1, 2, 23). Rien d'autre n'a été lu pour ce levier.

## Levier « domaine étendu du calage de convention » (étage : `src/placement-convention.js`)
- Réglage `conventionDomaineEtendu`, **éteint par défaut** (`null`) : sans lui, le code rend la même chose qu'avant, à l'octet près.
- Allumé (`{ dzMaxMm: 13 }`) : un rail dont le calage est refusé seulement parce que |dz| dépasse `maxShiftMm` (8 mm), avec |du| ≤ 8 mm et |dz| ≤ 13 mm, reçoit le calage entier (du et dz). Le motif reste `shift-out-of-domain`, pour que la garde de paire (D-044) le lise toujours ; une clé `domaineEtendu: true` le signale.
- Inchangé : |du| > 8 mm (refusé, posé brut) ; |dz| > 13 mm (refusé) ; rails déjà dans le domaine ; plafond P1 (`conventionPlafond`), qui garde la priorité s'il est allumé.

## Jugement (lots non vus : Échos du 05 au 10/11, garde GCV2 scellée), critères écrits avant
1. Au moins 98 % des posés jugés à 10 mm ou moins (référence du ticket) ; médiane de l'écart des justes en baisse.
2. Aucun posé passé au-delà de 20 mm, aucune nouvelle mauvaise voie (> 50 mm), aucun cut dégradé de plus de 5 mm sans être compté et expliqué.
3. Acceptations (validation sans mouvement, visite sans action) déplacées de plus de 2 mm : au plus 0,5 point des jugés (CH-042, critère 3).
4. Effet sur la garde de paire et les appuis (ricochet) mesuré au banc du vrai code ; posés et différés comptés.
5. Lecture séparée des rails refusés posés à la pose brute (ceux que le levier touche) : vertical de l'opérateur − dz.

## Séparateur (c), réglé sur la partie 17 du 14/10 seulement, figé ici avant de juger sur novembre (12/11, demande de l'intégrateur)
- Règle : le domaine étendu ne s'applique pas à un rail dont le calage compte **plus de 20 points de flanc** (`faceN > 20`) ; il reste refusé, posé brut, comme aujourd'hui.
- Choix sur octobre (simulation statique `outils/simuler.cjs`, ricochet ignoré ; seuils 12 à 99 essayés) : `faceN ≤ 20` est le seuil le plus haut sans posé passé au-delà de 20 mm et avec le moins de perdus pour un gain net égal : ≤ 10 mm 145 → 162 sur 192, 19 gagnés, 2 perdus, 5 dégradés de plus de 5 mm, 2 justes à 2 mm déplacés. Sans séparateur : 4 passés au-delà de 20 mm. Lecture (SUPPOSÉ) : beaucoup de points de flanc = bande polluée (contre-rail, objet voisin), le calage y monte à tort.
- Jugement : lots des 05 au 12/11 (05/11 p8-12, 06/11 p13-16, 08/11 p3, p4, p6, 11/11 p15-17, 12/11 p0, p1, p2, p23), critères inchangés : aucun posé au-delà de 20 mm, aucune nouvelle mauvaise voie, gain net à 10 mm. Les 11 et 12/11 ont servi à régler dz ≤ 13 mm, pas ce séparateur.
