# CH-090 : étude — pourquoi une coupe voisine attend encore, préchauffage en marche

Sources : lots « Vision 8 » (partie 13) et « Vision 9 » (partie 14) de `banane-data` ; script rejouable `banane-data/outils/analyse-lots/attente-voisines.cjs`. Tout est ÉTABLI (lu au journal ou dans le code) sauf mention.

## 1. Où part le temps d'une capture +1
| | Vision 8 | Vision 9, préchauffage en marche | Vision 9, préchauffage arrêté |
|---|---|---|---|
| Captures +1 | 39 | 15 | 57 |
| Capture médiane | 114 ms | 470 ms | 688 ms |
| Lectures (une par rail) déjà chargées à l'arrivée | 81 % | 48 % | 45 % |
| Attente médiane d'une lecture qui charge | 241 ms | 378 ms | 483 ms |
| dont chargement des nœuds par Potree | 2,1 s sur 4,2 s | 4,3 s sur 5,7 s | 39,5 s sur 40,0 s |
| Points par capture (médiane) | 6 994 | 18 780 | 16 188 |

- Sélection de la vue (≈ 10 ms par rail) et lecture des points (≈ 2 ms) ne pèsent rien. La queue de stabilité après le dernier nœud non plus (≈ 9 ms en Vision 9).
- **Toute l'attente est du chargement de nœuds par Potree** : en général UN nœud qui manque par vue, environ 400 ms (attente du serveur ≈ 105 ms, le reste en décodage ; PROBABLE pour la répartition).

## 2. Pourquoi le nœud manque alors que le préchauffage tourne
- Par opération +1 (Vision 9, avant l'arrêt) : **7 nœuds candidats** (médiane, pour les 2 coupes suivantes), **2 lancés**, 1,4 chargé ; l'opération dure 595 ms puis est coupée par le changement de coupe (19 opérations sur 22). Vision 8 : 4 candidats, 2 lancés, 1 chargé.
- Cause : `memoire.enVolMax: 2`. Le préchauffage ne lance que 2 chargements à la fois, dans une fenêtre d'environ 600 ms : sa capacité (2 à 3 nœuds par coupe) est sous le besoin d'une partie dense (≈ 3,5 nœuds nouveaux par coupe). La densité compte donc, mais par ce biais : plus de nœuds nouveaux par coupe (niveau 12 présent en partie 14, 11 au plus en partie 13).
- La prédiction n'est pas en cause : 22 bilans sur 22 justes.

## 3. Défaut caché trouvé en passant : le plafond de 256 Mo vaut pour toute la vie de la page
- `memoire.octetsMax` (256 Mo décodés) est compté par `memOctetsLot`, jamais remis à zéro (`src/prechauffage.js`). Au plafond, plus aucun lancement, sans message.
- Mesuré : 1,5 Mo par nœud ; le lot « Vision 8 » (53 cuts + 218 relus) a consommé **212 Mo sur 256**. Le préchauffage s'éteint donc après environ 330 coupes, jusqu'au prochain F5. Sur un vrai lot (plusieurs centaines de coupes, page jamais rechargée), il ne tourne plus pour la suite.
- La mémoire d'ESV, elle, ne grossit pas : Potree libère lui-même les vieux nœuds (points en mémoire ≤ 4,0 millions dans les deux lots, sa limite `pointLoadLimit`).

## 4. Correction proposée (réglages du préchauffage, fichiers non protégés)
1. `enVolMax` 2 → 4 (la limite de Potree lui-même) : capacité doublée. Risque : au changement de coupe, les 4 places de Potree peuvent être prises par nos chargements pendant ≤ 400 ms ; ce sont les nœuds de la coupe d'arrivée.
2. Plafond de 256 Mo compté par opération et non plus par vie de la page ; garde ajoutée : aucun lancement si le tas JS dépasse un seuil (à fixer, 1,5 Go proposé ; mesuré 340 à 900 Mo sur les deux lots).
3. Attendu (SUPPOSÉ tant que non mesuré sur le terrain) : part des lectures déjà chargées de 48 % vers celle de Vision 8 (81 %) ou mieux, soit une capture +1 médiane sous 200 ms en partie dense.
