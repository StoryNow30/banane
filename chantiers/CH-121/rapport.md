# CH-121 : ajustement fin de la pose sur le profil du rail (rapport, D-352)

Hors ligne. Aucun fichier du tronc n'a changé. Patchs éteints : `ajustement-fin.patch` (`src/gcv2-l1.js`, crochet du banc, essais) et `sw-ajustement-fin.patch` (`background.js`). La cible a été écrite avant le premier rejeu (`cible.md`). Cinq grilles de réglages, chacune figée avant jugement et consignée (`reglages/LISEZMOI.md`). Juge de CH-113, banc de CH-116. Sorties (numéros et mm) : `sorties/`.

## 1. Mesure (ÉTABLI ; rejeu livré = CH-116 à l'unité)
- Les 36 posés de 10 à 50 mm forment deux familles :
  - **vertical** : rail au calage refusé (|dz| > 8 mm), posé brut, trop bas ;
  - **latéral à un rail** : poses de la GCV2 en ADV.
- **Défaut de fenêtre** : le calage ne lit que les points à ±180 mm de la pose de DÉPART d'ESV. 387 posés sur 3 425 ont un rail à plus de 150 mm de ce départ ; leur champignon sort de la fenêtre (08/11b 231 : 0 point lu).
- **Octobre** : la bande du dessus y est deux fois plus épaisse, et le 90e centile surévalue la hauteur. La médiane du dessus garde le même décalage à l'opérateur aux deux époques.

## 2. L'étage (`ajusterPoseFinale`, levier `ajustementFin` dans `LEVIERS_V4`, null)
- **Étage final**, rail par rail, fenêtre centrée sur la pose. Vertical : médiane du dessus + c (épaisseur ≤ 15 mm, 4 ≤ |dz| ≤ 13 mm). Commande refaite par `commander`.
- **Réglage proposé, `aj5`** : vertical seul ; poses de la chaîne seulement (`seulChaine`) ; voisins de la GCV2 à la pose de la décision (`voisinsDecision`) ; c = 5,0.
- **Essais** : 6/6 sur le patch, 0/6 sur le tronc. Éteint = livré : 4 016 / 4 016 cuts.

## 3. Méthode, et ce qui a été écarté (dit tel quel)
- **Grille 1** (q90 relu à la pose) : écartée par la garde statique du 14/10 p17, à cause d'un cliquet. Ce lot est donc vu.
- **Grille 2** : **fuite**, c avait été lu sur tous les lots, 05/11 compris ; 05/11 a aussi été vu une fois dans la liste de mesure (11/5158). Abandonnée sans jugement.
- **Grille 3** (vertical + latéral) : 7 lots à 96,1 %. Refusée par la garde des 11 lots d'octobre : fautes du latéral, et un ricochet à 60 mm (0-2310 1372).
- **Grille 4** (vertical seul, toutes les poses) : 7 lots à 95,5 %. Refusée par la même garde : ricochet 1372, et dégradations de poses GCV2 en ADV.
- **Grille 5** (aj5) : **sa structure est tirée de la garde d'octobre.** Cette garde n'est donc plus un jugement indépendant pour aj5 ; elle a été refaite pour la cohérence. Le jugement indépendant d'aj5 passe par les plis de novembre (c appris par pli), puis par l'examen vierge neuf de CH-116 et par la séance Écho.

## 4. aj5 : jugement « un lot dehors » (ÉTABLI au banc ; gain PROBABLE jusqu'à l'Écho)
| | ≤ 10 mm hors > 50 | livré | gagnés / perdus | nouv. > 50 | déplacés > 30 mm | décisions changées |
|---|---|---|---|---|---|---|
| 6 lots réglables | 306/330 = **92,7 %** | 89,4 % | 11 / 0 | 0 | 0 | 0 |
| 7 lots, avec 05/11 | 507/532 = **95,3 %** | 93,2 % | 11 / 0 | 0 | 0 | 0 |
- **Gagnés** : 12/11 p0 119, 136 ; p1 3780, 6511 ; p2 8684 ; p23 5134, 5135, 5136, 5141, 5149 ; 06/11 9237.
- **Aucun ricochet** : 0 décision d'état changée sur tous les lots (vérifié mécaniquement).
- **Poses déplacées** : 124 poses de la chaîne, toutes en hauteur (médiane 9,1 mm, maximum 12,5) ; aucune pose GCV2 ni L1-s. Sur 35 jugées : 30 mieux, 1 égale, 4 pire. Les 4 pires restent ≤ 7,2 mm : ce sont des cuts que l'opérateur avait validés tels quels, relevés de 7 mm.

## 5. Garde et parité (aj5)
- **Garde des 11 lots d'octobre** (non indépendante) : retour 1, et ses seuls reculs sont **53 « verts changés »**, des poses de la chaîne relevées de 8,8 mm en médiane, 10,8 au maximum. Aucune autre faute : rien de nouveau au-delà de 20 ou 50 mm, rien de dégradé de plus de 2 mm, 0 décision changée. Éteint : retour 0.
- **Parité** (`parite-l1se-sw --passe`) : 06/11 p15 : 161/161 identiques. 12/11 p23 : 311 rejoués, passe identique (11 + 4 poses), 15 lignes différentes (ADV, 5077-5086 et 5268-5273), toutes **identiques à l'éteint** (même parité sans aj5 : les 15 mêmes) : écart banc / service worker antérieur au levier, aj5 hors de cause (ÉTABLI) ; aucune ne porte sur un cut ajusté. Elle a trouvé et fait corriger deux défauts du patch du service worker : l'appui d'une commande ajustée, et le journal de la passe.

## 6. Conclusion
- **Cible écrite** (≥ 95 % sur 7 lots, 0 juste dégradé, 0 déplacement > 30 mm, 0 nouvelle mauvaise voie) : atteinte au banc par aj5 (95,3 %). Sur les 6 lots réglables seuls : 92,7 %.
- **Allumage** : aj5 n'a pas de faute mesurée en garde. Il déplace en revanche, par construction, des poses validées par la chaîne, ce que la règle actuelle compte comme recul (D-264, garde). **Il faut une décision écrite de l'opérateur**, puis l'examen vierge (CH-116) et une séance Écho.
- **Pistes** : la fenêtre centrée sur la pose dans les lectures de soutien de la GCV2 (L1-e, H6) ; un latéral protégé contre les flancs d'ADV mal lus (les fautes d'aj3).
