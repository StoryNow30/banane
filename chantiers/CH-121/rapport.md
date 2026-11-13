# CH-121 : ajustement fin de la pose sur le profil du rail (rapport, D-352)

Hors ligne. Aucun fichier du tronc changé : patchs éteints `ajustement-fin.patch` (`src/gcv2-l1.js`, crochet du banc, essais) et `sw-ajustement-fin.patch` (`background.js`). Cible écrite avant le premier rejeu (`cible.md`) ; réglages figés avant jugement (`reglages/`, quatre grilles, toutes consignées). Juge de CH-113, banc de CH-116. Sorties (numéros et mm) : `sorties/`.

## 1. Mesure (ÉTABLI ; rejeu livré = CH-116 à l'unité)
- Les 36 posés de 10 à 50 mm se partagent en deux familles. **Vertical** (~13) : rail au calage refusé (|dz| > 8 mm), posé brut, trop bas ; le calage relu à la pose prédit l'écart à 1-3 mm. **Latéral à un rail** (~15) : GCV2 en ADV. Détail : `sorties/mesure-livre-par-rail.csv`.
- **Défaut de fenêtre** : le calage de convention ne lit que les points à ±180 mm en travers de la pose de DÉPART d'ESV. 387 posés sur 3 425 ont un rail à plus de 150 mm de son départ (197 au-delà de 180 mm). Leur champignon sort de la fenêtre et n'est jamais calé (08/11b 231 : 212 mm, 0 point lu).
- **Octobre** (14/10 p17) : la bande de dessus y est deux fois plus épaisse (q90 − q50 : 7 mm contre 4 pour les rails refusés). Le 90e centile surévalue alors la hauteur (rapport 0,64 de CH-118). La médiane du dessus a le même décalage à l'opérateur dans les deux époques.

## 2. L'étage (`ajusterPoseFinale`, levier `ajustementFin` dans `LEVIERS_V4`, null)
En fin de chaîne, chaque rail seul, fenêtre centrée sur la pose. Vertical : médiane du dessus + c, si q90 − q10 ≤ 15 mm et 4 ≤ |dz| ≤ 13 mm. Latéral (option) : médiane du flanc − 2,6 mm, écartement borné. La commande est refaite par `commander`. Banc et service worker : voisin = pose écrite ; appui et transport = pose de la décision. Essais : 6/6 sur le patch, 0/6 sur le tronc (dont un essai de point fixe). Éteint = livré : 4 016 / 4 016.

## 3. Méthode, et ce qui a été écarté (dit tel quel)
- **Grille 1** (convention q90 + 1 relue à la pose) : écartée par la garde statique du 14/10 p17, 10 justes perdus. Cause : cliquet du q90, relu à une pose déjà calée. **Le 14/10 p17 est donc « vu ».**
- **Grille 2** : abandonnée. **Fuite** : c = 4,4 avait été lu sur tous les lots, 05/11 et lot tenu à l'écart compris. 05/11 a aussi été vu une fois dans la liste de mesure (11/5158).
- **Grilles 3 et 4** : c appris dans chaque pli sur les seuls lots d'apprentissage (5,0 sur les 6 réglables ; de 3,9 à 5,7 selon le pli) ; chaque lot jugé une fois.

## 4. Jugement « un lot dehors » (ÉTABLI au banc)
| | 6 lots réglables (≤ 10 hors > 50) | 7 lots, avec 05/11 | gagnés / perdus | nouv. > 50 | déplacés > 30 mm |
|---|---|---|---|---|---|
| livré | 295/330 = 89,4 % | 496/532 = 93,2 % | | | |
| grille 3 (vertical + latéral) | 311/331 = 94,0 % | 512/533 = **96,1 %** | 15 / 0 | 0 | 0 |
| grille 4 (vertical seul) | 307/330 = 93,0 % | 508/532 = **95,5 %** | 12 / 0 | 0 | 0 |
- Aj4, sur tous les lots : 124 poses de la chaîne déplacées, toutes en hauteur (médiane 9,1 mm, maximum 12,5). Sur 35 jugées, 30 vont vers le mieux et 4 vers le pire ; les pires restent ≤ 7,2 mm, dont 4 cuts validés tels quels par l'opérateur et montés de 7 mm. 11 passent sous 10 mm, 0 au-delà. Ricochets : 2 décisions changées (12/11 p23 5159, posé → différé ; 08/11b 6/131, différé → posé), non jugées.

## 5. Garde et parité
- **Garde des 11 lots d'octobre (`garde-gcv2 --rejouer`) : ROUGE pour les deux réglages** (éteint : retour 0).
  - Grille 3 : 23 reculs. Fautes du latéral (2-17 9803 à 24,2 mm, 2-20 288, 0-2310 4) et ricochet 0-2310 1372 (nouvelle pose à 60,2 mm).
  - Grille 4 : 16 reculs. Ricochet 0-2310 1372 (60,2 mm) et 13 ; vertical sur des poses GCV2 en ADV, 0-2310 4 (dégradé de 5,3 mm) et 193 (4,3) ; 53 verts changés (hauteur seule, médiane 8,8 mm, maximum 10,8).
- **Parité** (aj4, `parite-l1se-sw --passe`) : 06/11 p15 : 161/161, 0 ligne différente. PARITE_P23. Elle a trouvé deux défauts du patch du service worker, corrigés : l'appui d'une commande ajustée, et le journal de la passe.

## 6. Conclusion
- Cible écrite (≥ 95 % sur 7 lots, 0 juste dégradé, 0 déplacement > 30 mm, 0 nouvelle mauvaise voie) : **atteinte au banc de novembre** par les grilles 3 et 4. Elle n'est **pas tenue en garde** : octobre montre une nouvelle mauvaise voie par ricochet, et des dégradations sur des poses GCV2 en ADV.
- **Aucun réglage allumable.** Sous la règle actuelle (D-264 ; la garde compte tout déplacement d'un posé de la chaîne), le gain exige aussi une décision écrite de l'opérateur : 11 des 12 gains d'aj4 sont des poses de la chaîne.
- Pistes, à juger sur des lots neufs, parce qu'octobre a servi à les concevoir : étage sur les poses de la chaîne seulement, voisins = pose de la décision (les fautes d'octobre sont toutes sur des poses GCV2 ou des ricochets) ; fenêtre centrée sur la pose dans les lectures de soutien de la GCV2 (L1-e, H6) ; un étage latéral seulement avec une garde de paquet unique.
