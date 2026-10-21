# Test 17, rôle « fautes » : les poses fausses de la partie 3:0

Branche `claude/50-t17-fautes`, depuis `claude/50-apprentissage-3-0` (d344fe1). Cette fiche est écrite au fil de l'eau (mémoire de travail) ; l'état est en tête.

## État

- Rejeu de 3:0 avec diagnostic (`diag`, `rechercheDiag`, journal seulement) : 337 cuts, **0 décision différente** du rejeu de l'examen (r-v5) ; mêmes 22 poses jugées, 4 à plus de 50 mm.
- Cause de chacune des quatre poses fausses de la v5 mesurée (§ 1).
- Garde de voie absolue écrite, coupée, avec essai (§ 2). À mesurer sur les 10 lots.

## 1. Causes mesurées (3:0, jeu avec la règle « visité sans action = bon »)

Les valeurs sont en millimètres dans le repère profil de la pose de départ du cut. `voie absolue` : poses des voisins validés (chaîne et GCV2) lues dans ce repère (`voieAbsolue`) ; `dFit` : écart en travers de la pose à la droite ajustée des voisins (en 0) ; `dProche` : au voisin le plus proche ; `dist` : cuts jusqu'à ce voisin ; `n` : voisins par rail ; `résidu` : résidu de la droite.

| cut | pose v5 (gauche / droite, travers) | opérateur | chemin de la pose | dFit | dProche | dist | n | résidu |
|---|---|---|---|---:|---:|---:|---|---|
| 794 | 82 / 26, `recherche-adv-remplace`, p 0,03 | −74 / −122 | arrêt de la recherche après la graine de la test 13 | 207 | 67 | 5 | 2, 2 | aucun (2 points) |
| 846 | 26 / 80, test 13 valide (H1+H2, p 0,63) | 187 / 230 | paire validée, jamais confrontée aux voisins | 110 | 233 | 4 | 3, 3 | 3,1 / 2,9 |
| 847 | 8 / 0, test 13 valide (H0+H1+H2, p 0,81) | 219 / 205 | départ d'ESV validé | 155 | 363 | 5 | 2, 2 | aucun |
| 869 | −110 / −57, `sous-tau-coherent` (p 0,33) | 107 / 153 | sous τ, écartement et soutien seuls | 39 | 115 | 2 | 3, 3 | 55 / 63 |

Les 19 autres poses de la GCV2 de 3:0 : dFit 29 au plus, dProche 22 au plus (hors le cut 17, abords, sans vérité : 81 à 6 cuts), résidu 7,4 au plus, dist 3 au plus. Sur les 9 anciens lots (508 poses de la GCV2) : dFit 72 au plus, résidu 25,2 au plus.

Ce que les chiffres montrent :
- **846 et 847** : la pose est un vrai rail du nuage (soutien de 253 à 258 points de dessus), mais celui de la voie de départ d'ESV, pas celui de l'opérateur ; les voisins (droite ajustée) disent à 110 et 155 mm ailleurs. La recherche recentrée, en 846, trouve bien la paire de l'opérateur (190 / 235, à 4 mm de lui) mais la refuse : sa hauteur est à 21,8 mm du départ et du voisin, la limite est de 20 (`rechHauteurMaxMm`).
- **794** : la recherche s'arrête (`rechArret`) à la première paire « sûre et unique », trouvée dès la graine de la test 13, avant d'avoir cherché autour des voisins ; la paire retenue est à 67 mm du voisin le plus proche (permis : 80 mm, 40 mm par cut).
- **869** : les voisins ne s'accordent pas (résidu 55 et 63 mm, contre 25 mm au plus ailleurs) car les verts 864 et 867 de la chaîne sont eux-mêmes faux : la voie ne tranche pas, et la pose repose sur l'écartement et le soutien, que n'importe quelle paire de rails à 1,45 m satisfait.
