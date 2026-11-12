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
