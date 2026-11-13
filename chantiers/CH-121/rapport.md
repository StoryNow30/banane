# CH-121 : ajustement fin de la pose sur le profil du rail (rapport, D-352)

Hors ligne. Aucun fichier du tronc changé : patch éteint `ajustement-fin.patch` (`src/gcv2-l1.js`, crochet du banc, essais) et `sw-ajustement-fin.patch` (`background.js`). Cible écrite avant le premier rejeu (`cible.md`, f302d6a) ; réglages figés avant jugement (`reglages/`). Juge de CH-113, banc de CH-116. Sorties (numéros et mm) : `sorties/`.

## 1. Mesure (ÉTABLI, rejeu livré = CH-116 à l'unité : 561 jugés, 496 ≤ 10, 36 de 10-50, 29 > 50)
- Deux familles dans les 36 posés de 10 à 50 mm : **vertical** (~13 : rail dont le calage est refusé, |dz| > 8 mm, posé brut, trop bas ; le calage relu à la pose prédit l'écart à 1-3 mm) et **latéral à un rail** (~15, GCV2 en ADV). Mesure par rail : `sorties/mesure-livre-par-rail.csv`.
- **Défaut de fenêtre** : le calage de convention (`bandOffsets`) ne lit que les points à ±180 mm en travers de la pose de DÉPART d'ESV. 387 posés sur 3 425 ont un rail à plus de 150 mm de son départ (197 à plus de 180 mm, dont 155 de la GCV2) : leur champignon est hors fenêtre, ils ne sont jamais calés et paraissent « sans flanc » (11/08b 231 : 212 mm, 0 point lu ; 60 points de flanc dans une fenêtre centrée sur la pose).
- **Octobre** (14/10 p17, lot Pilote retéléchargé, GCV1 d'aujourd'hui : 380 / 384 rails au même dz) : bande de points du dessus deux fois plus épaisse (q90 − q50 : 5,5 mm contre 3,0 en novembre ; 7 contre 4 pour les refusés). Le 90e centile y surévalue la hauteur, d'où le rapport 0,64 de CH-118 ; la médiane du dessus a le même décalage à l'opérateur dans les deux époques.

## 2. L'étage (`ajusterPoseFinale`, levier `ajustementFin` dans `LEVIERS_V4`, null)
En fin de chaîne, sur toute pose de L1-se dans la vue courante, chaque rail seul, fenêtre centrée sur la pose : vertical = médiane du dessus + c, si l'épaisseur q90 − q10 ≤ 15 mm et 4 ≤ |dz| ≤ 13 mm ; latéral = convention (médiane du flanc − 2,6 mm), 4 ≤ |du| ≤ 12 mm, écartement de la paire dans [1 425, 1 475] et changé de 25 mm au plus ; commande refaite par `commander` (écartement admissible, vue), sinon rien. Banc : voisin = pose ajustée, appui et transport = pose de la décision, comme le service worker (voisins relus dans `records`). Service worker : en tout dernier dans `commandLot` (une commande « engine » ajustée devient « lot ») et dans la passe, après la garde A. Essai `tests/ch121-ajustement-fin.test.cjs` : rouge sur le tronc (0/6), vert sur le patch (6/6), dont un essai de point fixe.

## 3. Méthode, et ce qui a été écarté (dit tel quel)
- Grille 1 (convention q90 + 1 relue à la pose) : **écartée par la garde statique du 14/10 p17** avant tout jugement au banc : 10 justes perdus. Mécanisme établi (753, 4737, 5129) : relu à une pose déjà calée, le q90 remonte encore de 5 à 7 mm, parce que la bande suit la pose et y fait entrer des points hauts (cliquet). Le 14/10 p17 est donc « vu ».
- Grille 2 : **abandonnée** sans jugement : c = 4,4 avait été lu sur tous les lots, 05/11 et lot tenu à l'écart compris (fuite). 05/11 a aussi été vu une fois dans la liste de mesure (11/5158).
- Grille 3 (jugée) : structure a priori (défauts du patch), **c appris dans chaque pli** sur ses lots d'apprentissage (5,0 sur les 6 réglables ; 3,9 à 5,7 par pli). Chaque lot jugé une seule fois.

## 4. Jugement « un lot dehors » (ÉTABLI au banc ; gain PROBABLE jusqu'à l'examen vierge)
| | posés jugés ≤ 10 mm hors > 50 | livré | gagnés / perdus | justes passés > 10 | nouv. > 50 | déplacés > 30 mm |
|---|---|---|---|---|---|---|
| 6 lots réglables (chacun par son pli) | 311 / 331 = **94,0 %** | 295 / 330 = 89,4 % | 15 / 0 | 0 | 0 | 0 |
| 05/11, examen (aj3-final, c = 5,0) | 201 / 202 | 201 / 202 | 0 / 0 | 0 | 0 | 0 |
| **7 lots** | 512 / 533 = **96,1 %** | 496 / 532 = 93,2 % | 15 / 0 | 0 | 0 | 0 |
- Gagnés : vertical 11 (12/11 p0 119, 136 ; p1 3780, 6511 ; p2 8684 ; p23 5134, 5135, 5136, 5141, 5149 ; 06/11 13/8012), latéral 3 (11/11 p16 5854, 5856 ; 06/11 16/9260), les deux 1 (06/11 16/9237). Décisions changées par ricochet : 2 (12/11 p23 5285 différé → posé juste à 3,2 mm ; 08/11b p6 131 différé → posé à 1,7 mm de la pose du lot réel, non jugé). 296 posés déplacés de plus de 0,5 mm, au plus 13 mm par axe (bornes).
- Éteint = livré : 4 016 / 4 016 cuts identiques (patch final).

## 5. Garde et parité
GARDE_PARITE

## 6. Cible et suite
- Cible écrite (≥ 95 % sur 7 lots, 0 juste dégradé, 0 déplacement > 30 mm, 0 nouvelle mauvaise voie) : **atteinte au banc** (96,1 %) ; sur les 6 lots réglables seuls, 94,0 %.
- Restent hors de portée de l'étage : les latéraux de 11 à 20 mm sans flanc lisible dans la bande (08/11b 228, 231, 232 ; 06/11 9181 ; 12/11 p23 5193), les poses de 28 à 40 mm (11/11 62, 4496, 1675 ; 12/11 1/3778, 2/7782) : autre voie ou autre rail, pas un ajustement.
- À tenter ensuite : la même fenêtre centrée sur la pose dans les lectures de soutien de la GCV2 (L1-e, H6) ; un latéral à plus grande portée avec garde de paquet unique (essayé en statique : 4 gagnés / 2 perdus, non retenu).
