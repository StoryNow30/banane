# CH-060 — La relecture est longue : où part le temps par cut (rapport, 06/11/2026)

Données : journaux des lots du 04/11 (Constellation 0-4 le matin, Orbite 6-15, Constellation 0-7 le soir) et du 05/11 (8-12). Au total, 28 relectures, 8 242 cuts relus et 19 997 s.
Outil : `tools/ch060-relecture-temps.cjs`. Il relie les champs `durees` de `relecture-ombre` aux étapes `adapter-progress` de la capture par l'heure de la demande, car l'identité des étapes a un cut de retard.
Agrégats : `agregats.json`, sans identifiant ni coordonnée. Essais : `tests/ch060-outils.test.cjs`.

## 1. Décomposition d'un cut relu (ÉTABLI, part du temps)
| | navigation | sélection des rails | **attente du niveau de détail** | lecture des points | calcul | correction | avant capture, transfert, entre deux cuts |
|---|--:|--:|--:|--:|--:|--:|--:|
| 28 relectures | 1,2 % | 3,7 % | **64,9 %** | 10,5 % | 7,8 % | 8,4 % | 1,6 % |
| p0 du 04/11 soir (3,5 s/cut) | 0,8 % | 3 % | **77 %** | 8 % | 7,2 % | 3,2 % | ≈ 1 % |
| p1 du 04/11 soir (1,4 s/cut) | 1,5 % | 6 % | 64 % | 11 % | 4,4 % | 12 % | ≈ 2 % |
| p11 du 05/11 (3,0 s/cut) | 0,9 % | 3 % | **80 %** | 7 % | 2,7 % | 5,2 % | ≈ 1 % |

**Cuts lents (≥ 3 s).** 2 694 cuts, soit 61 % du temps. Ils ont trois causes :
- **Signal de fin de chargement d'ESV éteint** : 894 cuts lents. Sur les 1 915 cuts relus signal éteint, toutes les vues finissent au repli de 800 ms par rail.
- **Cuts de « référence »** : 775 cuts. C'est un cut sur dix, tiré par numéro de cut, lu sans le signal. Ils prennent 5,3 s en moyenne, contre 2,1 s pour une lecture rapide.
- **Corrections** : 685 cuts, avec +2,2 s par cut corrigé.

La zone, le rôle et l'arrivée par pas ou par saut n'expliquent rien. Le signal, lui, dépend de la page :
- les 28 chargements de page commencent avec le signal vivant ;
- 10 le perdent, avec le compteur `numNodesLoading` bloqué à 1 ou 2 (D-109). La première lecture au repli arrive 47 à 737 s après le chargement, 47 à 96 s dans 6 cas sur 10 ;
- le signal ne revient qu'au rechargement suivant de la page (changement de partie).

Une relecture se fait donc presque toujours entièrement avec le signal (1,1 à 2 s par cut) ou entièrement sans (3 à 4 s par cut). Les parties lentes du tableau de l'intégrateur (p0 du soir, p11 du 05/11) sont exactement celles-là. Le temps par cut ne monte pas dans la journée.

## 2. Leviers classés (rejeu des 4 journaux, sans rien changer à ce qui est jugé)
| # | Levier | Gain mesuré | Statut |
|---|---|--:|---|
| 1 | **Signal éteint → recharger ESV au point de reprise, puis reprendre.** Détection : 8 lectures rapides de suite au repli. Le maximum dans une page saine est de 3 ; il atteint 6 en fin de page mourante. | **3 495 s (17,5 %)**, borne haute. Les 8 relectures touchées gagnent 26 à 50 % ; p11 du 05/11 : 25 → 14 min. | **Codé**, réglage `relectureSignalEteint` à `actif:false` |
| 2 | Cuts de référence lus en rapide pendant la relecture | 2 760 s (13,8 %) | Change la lecture : **décision de l'opérateur**, non codé |
| 3 | Ligne de base du compteur bloqué : un compteur resté à n compte comme « libre » (`src/adapter-page.js`) | Comme le levier 1, sans rechargement | Fichier interdit, non livré. Risque : 62 lectures au repli sur 4 760 ont vu un nœud changer sans que le compteur monte |
| 4 | Pas groupés sans capture, ordre de visite | Moins de 245 s, car toute la navigation fait 1,2 % | Nul (ÉTABLI) |
| 5 | Deuxième lecture d'un cut déjà relu | 0 doublon sur 8 242 | Nul (ÉTABLI) |
| 6 | Préchargement en lecture seule des points | Au plus ≈ 10 % de la capture (CH-049-E) | Nul ici : le temps est dans l'attente, pas dans le réseau |
| 7 | Calcul (7,8 %) | La durée ne dépend pas de la longueur de la chaîne (médiane plate de 0 à 400 appuis) | Pas de levier sûr |

**Hypothèses du levier 1 (SUPPOSÉ).**
- Un rechargement coûte 20 s.
- Le signal tient après le rechargement. ÉTABLI : il tient au début de chaque page. Mais une page sur trois le reperd. Décision de l'intégrateur (06/11) : **1 rechargement au plus par relecture** ; si le signal ne revient pas, la passe continue au repli, sans boucle (essai `tests/relecture-signal-eteint-sans-retour.test.cjs`).
- **Coût mesuré d'un rechargement, maquette seulement** : 3,2 s de la détection à la reprise, 5,1 s sans cut relu. Le vrai ESV recharge plus lentement (changement de partie : 9 à 16 s, CH-058), d'où les 20 s retenues (SUPPOSÉ).

**Ce qu'un rechargement risque, et ce qui le borne.**
- Aucun cut à moitié fait : la pause se prend au point de reprise, après le journal du cut, jamais entre une pose et sa validation. Les « vu » des derniers cuts sont attendus avant la pause.
- Pas de pose en attente : la reprise passe par les contrôles de « Reprendre » (aucune pose d'Ariane non validée affichée, rien d'incertain, Écho et Correction inactifs).
- Le cut affiché est perdu : la relecture repart par la carte au cut suivant de sa liste. Un cut corrigeable n'est posé qu'atteint par les boutons d'ESV (règle existante).
- ESV peut rouvrir une autre partie (après « suivant-dernier », il affiche d'abord la partie 0 ; pour un F5, SUPPOSÉ pareil) : Ariane ne change jamais de partie elle-même. Elle attend que la partie du lot s'affiche ; sinon, au bout de 90 s, la passe reste en pause avec la consigne F5 habituelle.

**Essais du levier 1.**
- Essais rouges d'abord (4 sur 7 rouges avant le branchement), puis `tests/relecture-signal-eteint.test.cjs`, `-rechargement` et `-sans-retour` : 8 essais, 13, 14 et 7 s.
- Les 63 fichiers `relecture-*` restent verts.
- Parité `tools/parite-relecture-sw.cjs` contre le tronc (5f9572b) : relevés identiques.
- Maquette (`tests/esv-maquette/relecture-signal-eteint.test.cjs`, 69 s ; suite maquette complète : 66 réussis, 2 sautés, 0 échec) : compteur bloqué, pause au cut 74, page rechargée, reprise seule 2,1 s plus tard, lectures au signal ensuite, 62 cuts relus une fois chacun, aucun SKIP.

**Réglage coupé** : un seul événement `relecture-signal-eteint` (« detecte / aucune »), rien d'autre.

## 3. Volume (mesure seule : la marge de 30 et les plafonds sont des règles métier)
Verts relus, en pourcentage de corrigés. « Proposé » est identique : toutes ces passes sont en « corriger ». Données d'avant D-284.

| Distance au cœur de l'ADV | 0 | 1 | 2 | 3 | 4-5 | 6-10 | 11-18 | 19-25 | 26-29 | 30 | > 30 (trou enchaîné) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| relus | 115 | 145 | 175 | 188 | 398 | 964 | 1 279 | 910 | 508 | 126 | 108 |
| corrigés | 33 % | 25,5 % | 18,9 % | 14,9 % | 7 % | 5,3 % | 3,8 % | 9,8 % | 15,7 % | 7,1 % | 2,8 % |

- **ADV.** La remontée entre 19 et 29 cuts est mesurée, sans explication (PROBABLE : l'autre bout de l'aiguille, hors des alertes du lot).
- **Abords.** 5,8 % de corrigés : grappe 9,2 %, cut isolé 5,7 %, autour du différé 1,6 %. Par distance au cut du lot le plus proche : 1 cut 6,3 %, 2 cuts 4,2 %, 3 cuts 4,1 %.
- **Autres zones.** PN 12,6 %, écartement 26,3 %, « à contrôler » 0 % (zone jamais corrigée, D-180 ; verdict « je corrigerais » sur 43,7 % des cuts).
- **« Abords à 70-76 » : c'est un PLAFOND, pas un hasard** (`plafondParZone.abords = 70`, D-180). Au-delà de 70 restent les cuts « À contrôler », que le plafond n'écarte jamais.
- **Ce qui est laissé hors plafond, non relu, sur les 4 journaux :**
  - 559 plages « cut isolé » (1 687 cuts couverts, environ 1 100 verts) ;
  - 20 grappes (274 cuts) ;
  - 31 « autour du différé » (86 cuts).

  C'est PROBABLEMENT la cause des cuts isolés non vérifiés relevés par l'opérateur. Au taux mesuré des isolés (5,7 %), cela ferait environ 60 corrections non faites (SUPPOSÉ, extrapolé). Les relire coûterait environ 2,1 s par cut, soit 40 min sur ces journaux. Le levier 1 en paierait la plus grande part.

## 4. Lever le plafond des abords (rejeu de la sélection réelle, sans rien activer)
Outil : `tools/ch060-plafond-abords.cjs`. Il rejoue `selection` sur les cuts du lot et les zones PN et ADV de chaque relecture. Au plafond de 70, il retrouve 69 ou 70 cuts d'abords, contre 70 mesurés (l'écart vient des cuts « À contrôler », absents du journal).
- **Sans plafond : +1 686 cuts relus sur les 28 relectures.** Ce sont des verts et des abords de différés : les posés sont traversés.
  - Temps ajouté au rythme mesuré de chaque page : **77 min**. Avec le levier 1 (pages éteintes au rythme d'une page saine) : **48 min**.
  - Le plus lourd : Orbite p10 du 04/11, +376 cuts, 22,9 min (11,3 min avec le levier 1) ; p11 du 05/11, +270 cuts, 13,5 min (5,7) ; p12 du 05/11, +203 cuts, 7,7 min. Le détail par partie est dans `plafond-abords.json`.
- **Grappes plus grandes** (`grappe.trouCuts`, 5 aujourd'hui, sans plafond) : cuts relus en plus de 5 : 10 → +261, 20 → +1 119, 40 → +4 483.

## Limites
- Le banc et la maquette ne sont pas le poste de l'opérateur.
- Après un rechargement par Ariane, le comportement du vrai ESV (partie affichée, signal) est SUPPOSÉ. La reprise passe par les contrôles de « Reprendre » (partie du lot affichée, ESV qui répond) et reste en pause à la moindre réserve.
- Le levier 1 demande que la pause et la reprise de la relecture soient allumées (réglage de l'opérateur). Sinon : un événement seulement.
