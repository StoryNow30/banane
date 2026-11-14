# CH-123 : rapport (14/11/2026)

Les cuts où la bonne voie manque au pool de la GCV2, hors du terrain de CH-120. Banc de CH-116 : 4 016 cuts, 24 lots-parties, zones du lot (`BANC_ZONES=journal`), deuxième passe éteinte. Tout est ÉTABLI au banc, sauf mention. Sorties : `banane-data/outils/analyse-lots/CH-123/sorties/v4/`, `banane-data/outils/analyse-lots/CH-123/sorties/rappel/`.

## 1. Réglages jugés
Figés avant tout rejeu (`reglages-figes-v4.json`, abe4302). Dans les deux, les hypothèses générées ne décident que les cuts que le pool d'avant laisse sans pose, et elles ne nourrissent pas les cuts suivants.
- **v4BS-sd** : la voie balayée en travers (±80, ±160, ±240 mm), en abords et PN ; un rail n'entre que s'il fait paire à 10 mm de l'écartement de référence, et seulement si le pool n'a pas déjà une telle paire.
- **v4ABS-sd** : le même, plus les cellules du réservoir écartées par les filtres, toutes zones.

Patchs : `base/generateurs-ch120-7d7dcd1.patch` puis `hors-pool-v4.patch`. Les générateurs de CH-120 y restent coupés : toute pose nouvelle vient des clés de CH-123.

## 2. Résultats
| | livré | v4BS-sd | v4ABS-sd |
|---|---|---|---|
| Bonne paire au pool, sur 747 cuts jugés | 618 | 628 | 636 |
| Cuts sortis de la classe A | | 0 | 0 |
| Cuts touchés | | 14 | 35 |
| Poses nouvelles (différé → posé) | | 9 | 11 |
| dont ≤ 10 mm / 10–50 / > 50 / non jugée | | 9 / 0 / 0 / 0 | 9 / 1 / 0 / 1 |
| Décisions changées hors des cuts touchés | | 0 | 0 |
| Poses de la chaîne déplacées ou perdues, sur 2 797 | | 0 | 0 |
| Poses de la GCV2 déplacées ou perdues, sur 626 | | 0 | 0 |
| Posés jugés ≤ 10 mm / 10–50 / > 50 | 496 / 36 / 29 | 505 / 36 / 29 | 505 / 37 / 29 |
| Différés ; bons bloqués | 593 ; 4 | 584 ; 4 | 582 ; 4 |
| Coût standard, 6 lots réglables ; examen 0511 | 3 850 ; 23 | 3 843 ; 21 | 3 851 ; 21 |

- Les 9 poses de v4BS-sd sont à 1,4 à 5,5 mm de la pose finale : 6 en abords, 3 en PN, aucune en ADV (04/11 : 4 ; 11/11 : 3 ; 05/11 : 2).
- v4ABS-sd ajoute 3 poses en ADV (2,9 mm, 4,8 mm, une non jugée), en perd une, et pose 11/11 p16/5847 à 10,1 mm au lieu de 1,4 mm.
- Éteint = livré : 4 016 cuts sur 4 016.

## 3. Validation croisée « un lot dehors » (`banane-data/outils/analyse-lots/CH-123/sorties/v4/croise-v4.md`, `couts-v4.md`)
Choix entre livré, v4BS-sd et v4ABS-sd. Somme des lots tenus à l'écart : 301 justes contre 295, 36 poses de 10 à 50 mm contre 35, 29 mauvaises voies contre 29, 573 différés contre 580. **Coût 3 853 contre 3 850 : pas de gain au coût standard.** Cause unique : le 11/11 tenu dehors choisit v4ABS-sd, qui y fait la pose à 10,1 mm. Examen 0511 (réglage choisi sur les 6 lots : v4BS-sd) : 203 justes contre 201, aucune faute nouvelle. Réserve : 0511 a été affiché dans des jugements d'avant v4, il n'est plus « jamais vu ».

## 4. Contre la cible (`cible.md`)
| Point | Cible | Mesuré |
|---|---|---|
| Rappel | 43 des 128 en A, 0 sorti | 10 (BS), 18 (ABS), 0 sorti : **non atteint** |
| Nouvelle mauvaise voie ; juste dégradé ; bons bloqués | 0 ; 0 ; pas plus | 0 ; 0 ; 4 contre 4 : tenu |
| Gain croisé | coût plus bas, 3 cuts nets | **non tenu** (3 853 contre 3 850) ; v4BS-sd seul : +7 justes, 0 faute |
| Éteint = livré | 4 016 | 4 016 : tenu |
| Garde d'octobre | retour 0 | retour 0, mais 0 cut nouvellement posé en octobre : verte, sans puissance sur les poses nouvelles |
| Parité banc / service worker | identique | 04/11 p15, passe comprise : 70 lignes sur 70, réglage allumé comme éteint (un seul lot-partie) |

## 5. Pourquoi le rappel reste bas (`banane-data/outils/analyse-lots/CH-123/sorties/v4/rappel-par-cause.md`)
- 23 des 128 cuts sont posés au livré, dont 15 des 16 mauvaises voies de la liste : un réglage « seulement les différés » n'y touche pas. C'est le prix de la garde verte (v3, sans cette règle, était rouge).
- 10 cuts de mon terrain sont hors de portée : nuage vide ou moteur aveugle à la vérité (04/11 p14/5340 ; 05/11 p9/8726, p10/8780 ; 06/11 p13/2744, 2747, p15/8407, p16/3407 ; 08/11 p4/1115, 1116 ; 11/11 p16/4899).
- Rail hors de la fenêtre mais porté par le nuage, mon terrain : 7 cuts sur 27 entrent par le balayage. Cellules écartées ou tronquées : 7 sur 17 par l'appariement, 2 décidés.
- 228 cuts changent de zone entre le banc et le lot, dont 143 d'abords vers ADV, où le balayage ne joue pas (effet sur le nombre de poses non mesuré à part).
- Sans la règle des différés, mes réglages allaient à +22 (v2E60), ceux de CH-120 étendus à +50, mais avec des fautes ou une garde rouge (mesures de la session d'avant, zones du banc, `passation.md`).

## 6. Axe de CH-124 (mesure seule, `banane-data/outils/analyse-lots/CH-123/sorties/v4/axe-ch124-*.md`)
Les 9 poses de v4BS-sd ont leur milieu à 4,7 mm de l'axe en médiane, 6,9 mm au plus ; la pose de départ d'ESV de ces cuts est à 50-126 mm. L'outil redonne au dixième les valeurs publiées par CH-124 (11 cuts contrôlés).

## 7. Service worker (`hors-pool-v4-sw.patch`)
Même branchement que le banc : la pose d'un cut touché n'est pas voisine de transport, au lot, dans la deuxième passe, et dans l'état de la passe relu après un redémarrage. Deux essais, rouges sans le patch, verts avec ; 13 fichiers d'essais voisins verts sur la copie patchée. Parité (`parite-l1se-sw --passe`, zones du lot, `banane-data/outils/analyse-lots/CH-123/sorties/v4/parite-0411-p15.txt`) sur 04/11 p15, 70 cuts : réglage allumé, 70 lignes sur 70 identiques, les trois cuts touchés posés des deux côtés ; éteint, 70 sur 70. **Limite** : sans le patch du service worker, ce lot-partie donne aussi 70 sur 70. Les trois poses n'y changent aucun cut suivant : la parité ne distingue donc pas le branchement, que seuls les deux essais prouvent. Non fait : 11/11 p16 (deux poses touchées voisines, environ 40 min par passage), où un réglage d'avant montrait des ricochets.

## 8. Proposition
- **v4BS-sd seul à l'examen vierge** (CH-116). Écarter v4ABS-sd est un choix fait après avoir vu les lots : le gain reste PROBABLE jusqu'à l'examen. Rien ne s'allume avant.
- Le gisement est petit : 9 cuts sur 4 016. La suite du rappel passe par une ancre (CH-124), pas par ce terrain.
- **Non fait** : l'effet avec la passe livrée (`BANC_PASSE_PLAFOND=10`) ; une partie des 9 cuts pourrait être posée de toute façon par la passe. La garde d'octobre n'a pas été relancée depuis la fusion du tronc : le code de décision n'a pas changé. `parite-relecture-sw`, la maquette ESV et le `verify` complet ne sont pas lancés : le patch du service worker n'est pas appliqué au dépôt.
