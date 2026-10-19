# RM-2 : les marges de zone de la relecture (19 octobre 2026)

Chantier RM-2 du projet Ariane (règles métier 5.0). Étude **hors ligne** : jusqu'où élargir l'entrée et la sortie des zones d'ADV et de PN, et la règle de chaînage, pour que les grosses corrections de Mic tombent dans la zone plus sa marge, sans doubler les cuts à relire.

**État : proposées, non figées.** Rien n'est branché. `src/engine.js`, `src/regles-metier.js`, `datasets/reglages-figes.json` et le comportement par défaut de `tools/relecture-autonome.cjs` sont intacts (un essai le vérifie) ; la proposition est dans un fichier séparé, `datasets/marges-zones-proposees.json`.

Conventions : les parties sont désignées par leur rang (« 1:12 » = projet 1, partie 12). Seuls des numéros de cut, des millimètres et des comptes figurent ici. Règle D-195, corrigée par D-197 : les marges se choisissent sur les onze parties d'apprentissage ; les témoins (1:11 et 1:25) ne règlent rien.

## 1. En bref

| Question | Réponse |
|---|---|
| **But** | Aucune correction de Mic de plus de 10 mm hors zone + marge, sans doubler les cuts à relire. |
| **Grosses corrections hors zone, apprentissage** | **54 sur 741 avant, 11 après** (marges proposées). Validation par partie laissée de côté : **20**. |
| **Cuts à relire, apprentissage** | **4 969 avant, 5 930 après (× 1,19)**. Pire partie : 1:17, × 1,50 (588 → 884). Validation par partie laissée de côté : 6 472 (× 1,30). Aucune partie ne double. |
| **But atteint ?** | **Non : 11 restent** (§ 7), et 20 en validation. Aller plus loin coûte des centaines de cuts pour une ou deux corrections (§ 8). |
| **D'où vient le gain** | Les marges d'ADV et de PN seules rattrapent **7 des 43** corrections rattrapées (54 → 47, + 276 cuts). Les **36 autres viennent de la marge autour de la liste « À contrôler »** (47 → 11, + 685 cuts), presque toutes en 1:17 et 1:29 (§ 3, § 4). |
| **Marges proposées** | ADV : **40 cuts avant** la première alerte (30 livré), 30 après ; **chaînage** : deux plages d'ADV séparées de 40 cuts au plus se relient, et une alerte à 30 cuts au plus de la zone la prolonge (livré : 0 et 10). PN : marges inchangées (4 et 6), mais **un cœur de chaussée seul ouvre une zone**. Liste « À contrôler » : **7 cuts** de part et d'autre de chaque vert listé (0 livré). Abords du lot : inchangés. |
| **Notes de Mic** | Il commence une ADV 13 à 31 cuts avant la première alerte (livré : 30, proposé : 40) ; il termine 11 à 22 cuts après la dernière (une fois 78) ; il enchaîne les zones proches. Le chaînage proposé reproduit sa pratique (2:11 : 8309 contre 8290 avant, 8322 maintenant), à + 47 cuts, sans correction de plus. |
| **PN pris pour ADV (1:16)** | Les alertes d'ADV de ce passage sont à 20 cuts et plus de la zone du PN, pas dans le PN ; c'est la marge de la plage qui mord sur le PN, sans coût. Une règle « ignorer les alertes près d'un PN » économise 16 cuts sur 1:16 et se dégrade en validation (22 au lieu de 19) : **non retenue**. |
| **Témoins** | Lus une fois, marges figées : **1:11 : 64 → 60 sur 103** hors zone, cuts 181 → 209 ; **1:25 : 0 → 0 sur 21**, cuts 205 → 264. Rapporté tel quel (§ 9). |

## 2. Méthode

### 2.1 Données

- **Cas** (`ariane-relecture-autonome-cas-v1`) et **tables de zones** (`ariane-verts-table-v1`) de RM-4 pour 1:12, 1:13, 1:17, 1:24, 1:29, 2:1, 2:10, 2:11, et les fichiers déjà extraits de 1:14, 1:15 et 1:16. Le format est décrit dans `fiches/RM4_ABSTENTIONS.md` § 2. Rien n'a été réextrait pour l'apprentissage.
- **Zones refaites sans le plafond de 8 zones de la mémoire de l'ombre** : cette mémoire ne garde que les huit dernières zones, ce qui avait fait perdre des PN (1:16) et des zones d'ADV (2:1) aux tables de RM-4. Les 66 grosses corrections hors zone de RM-4 deviennent **54** avec les zones complètes : c'est le « avant » de cette fiche.
- **Notes de Mic** : `datasets/marges-zones-notes-de-mic.json` reprend les zones dont il a noté le début et la fin (parties 1:15, 1:16, 2:11). La partie 1:14 n'a que des PN corrigés ; 2:10 est « RAS ».

### 2.2 Définitions

- **Grosse correction** : cut visité par Mic avec une référence, dont la correction (le pire des deux rails, en 3D) dépasse 10 mm.
- **Hors zone + marge** : le cut n'est pas dans la sélection de la relecture (`selection` de `tools/relecture-autonome.cjs`) : ni dans un PN avec ses marges, ni dans une plage d'ADV avec ses marges, ni dans les abords des rouges et des différés du lot, ni dans la liste « À contrôler ».
- **Cuts à relire** : cuts de la sélection qui ne sont pas des rouges du lot (verts jamais passés par le lot, plus cuts posés par le lot à revoir). Les rouges sont à corriger de toute façon : ils ne comptent pas.
- **Livré** : les marges actuelles (PN 4 avant et 6 après ; ADV 30 et 30, plage prolongée tant que les alertes se suivent à 10 cuts ; liste sans marge ; abords : grappe 3, isolé 1, différé 2, trou 5).

### 2.3 Procédure de choix

- Les marges ne font que **grandir** par rapport au livré (une marge plus petite perdrait ce qui est couvert aujourd'hui). Elles se choisissent groupe par groupe (ADV, PN, liste, abords : toutes les combinaisons du groupe, les autres tenus), deux tours, en minimisant

  `grosses corrections hors zone + cuts à relire / 200 + 1000 × Σ parties max(0, cuts après / cuts avant − 1,75)`.

  Le prix (200) est le nombre de cuts de plus qu'on accepte de relire pour rattraper une grosse correction ; le plafond (1,75) interdit de s'approcher du double sur une partie.
- **Chaînage imposé, non cherché** : `trou = 30` et `relier = 40` viennent des notes de Mic (§ 5), pas du critère ci-dessus, qui n'y voit aucune différence de corrections. L'ajustement libre, sans imposer le chaînage, donne les mêmes 11 grosses corrections hors zone et 5 883 cuts (× 1,18), 19 en validation ; le chaînage coûte donc 47 cuts (0,8 %) et une validation de plus.
- **Validation par partie laissée de côté** : la même procédure refaite sans la partie k, mesurée sur k (le chaînage imposé reste imposé : il n'a pas été cherché sur les données).

## 3. Par partie : avant et après

Grosses corrections de Mic hors zone + marge, et cuts à relire. « Avant » : marges livrées. « Après » : marges proposées (§ 4). « Sans k » : marges choisies sans la partie k, mesurées sur k.

| Partie | Mic > 10 mm | Hors zone avant | Hors zone après | Hors zone sans k | Cuts à relire avant | après | × | sans k | × |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1:12 | 31 | 1 | 0 | 1 | 115 | 149 | 1,30 | 138 | 1,20 |
| 1:13 | 29 | 0 | 0 | 0 | 299 | 336 | 1,12 | 336 | 1,12 |
| 1:14 | 17 | 0 | 0 | 0 | 115 | 129 | 1,12 | 129 | 1,12 |
| 1:15 | 10 | 3 | 3 | 3 | 344 | 380 | 1,10 | 470 | 1,37 |
| 1:16 | 21 | 0 | 0 | 0 | 485 | 566 | 1,17 | 566 | 1,17 |
| 1:17 | 203 | 35 | 5 | 7 | 588 | 884 | 1,50 | 744 | 1,27 |
| 1:24 | 108 | 1 | 0 | 0 | 1 111 | 1 172 | 1,05 | 1 672 | 1,50 |
| 1:29 | 122 | 7 | 1 | 2 | 747 | 961 | 1,29 | 1 079 | 1,44 |
| 2:1 | 172 | 0 | 0 | 0 | 700 | 753 | 1,08 | 753 | 1,08 |
| 2:10 | 1 | 0 | 0 | 0 | 21 | 25 | 1,19 | 25 | 1,19 |
| 2:11 | 27 | 7 | 2 | 7 | 444 | 575 | 1,30 | 560 | 1,26 |
| **total** | **741** | **54** | **11** | **20** | **4 969** | **5 930** | **1,19** | **6 472** | **1,30** |

Lectures :

- **Le gain est concentré, et il vient de la liste.** 1:17 (35 → 5) et 1:29 (7 → 1) en font 36 sur 43. Dans ces deux parties, la marge de 7 cuts autour de la liste « À contrôler » rattrape à elle seule les 30 corrections gagnées en 1:17 (35 → 5 ; 595 → 884 cuts) et 5 des 6 gagnées en 1:29 (6 → 1 ; 769 → 961). 1:17 n'a ni PN ni plage d'ADV relevés : les zones n'y servent à rien. Sans 1:17 : 19 → 6 grosses corrections hors zone, 4 381 → 5 046 cuts (× 1,15). 1:17 est de plus une partie dont l'Écho a presque perdu ses nuages (RM-4 § 3).
- **Cinq parties n'ont aucune grosse correction hors zone, avant comme après** (1:13, 1:14, 1:16, 2:1, 2:10) : l'élargissement n'y rattrape rien et coûte entre 8 % et 19 %.
- **Validation** : 20 contre 11 en apprentissage. Les parties qui perdent sont celles dont le gain tient à une marge que les autres parties ne justifient pas : 1:17 (7 : sans elle, les autres parties choisissent une marge de liste de 4), 2:11 (7 : l'avant d'ADV descend à 35, et les cinq corrections de 6415 à 6419 retombent hors zone), 1:29 (2 : alerte seule, avant 30), 1:12 (1 : cœur seul), 1:15 (3, inchangé). Le coût en cuts est lui aussi plus lourd sans k (× 1,30) : 1:24 passe à × 1,50 parce que les autres parties choisissent un isolé à 3 cuts.
- **Aucune partie ne double** : × 1,50 au pire en apprentissage comme en validation.

Zones relevées, par partie (PN, plages d'ADV, cœurs de chaussée seuls) : 1:12 (6, 0, 1), 1:13 (6, 4, 0), 1:14 (6, 0, 0), 1:15 (3, 5, 2), 1:16 (12, 5, 3), 1:17 (0, 0, 1), 1:24 (0, 0, 0), 1:29 (4, 3, 0), 2:1 (1, 15, 3), 2:10 (1, 0, 0), 2:11 (4, 5, 2).

## 4. Marges proposées (proposées, non figées)

Fichier : `datasets/marges-zones-proposees.json` (format `ariane-marges-zones-proposees-v1`, état « proposées, non figées »).

| Marge | Livré | Proposé | Effet si on la retire (les autres tenues) : hors zone / cuts |
|---|--:|--:|---|
| ADV, cuts avant la première alerte | 30 | **40** | 17 / 5 779 (contre 11 / 5 930) |
| ADV, cuts après la dernière alerte | 30 | 30 | — (40 : + 155 cuts, 0 correction) |
| ADV, alerte seule ouvre une zone | non | non | — (oui : + 159 cuts, 0 correction) |
| ADV, trou toléré entre alertes (cuts) | 10 | **30** | 11 / 5 911 (19 cuts de moins, aucune correction de plus) |
| ADV, chaînage : relier deux plages séparées de (cuts) | 0 | **40** | 11 / 5 902 (28 cuts de moins, aucune correction de plus) |
| PN, cuts avant / après | 4 / 6 | 4 / 6 | — (avant 6 : + 39 cuts ; après 8 : + 49 ; 0 correction) |
| PN, un cœur de chaussée seul ouvre une zone | non | **oui** | 12 / 5 877 |
| Liste « À contrôler », cuts de part et d'autre | 0 | **7** | 47 / 5 245 |
| Abords du lot (grappe, isolé, différé, trou) | 3, 1, 2, 5 | inchangés | — (isolé 2 : 9 hors zone, + 448 cuts) |
| ADV, alertes ignorées près d'un PN (cuts) | aucune | aucune | essayé, non retenu (§ 6) |

Par groupe, à partir du livré (les autres groupes au livré) : ADV 48 hors zone / 5 189 cuts ; PN 53 / 5 031 ; liste 18 / 5 664 ; abords 54 / 4 969. **La liste fait l'essentiel du gain (54 → 18 pour + 695 cuts) ; l'ADV vient ensuite (→ 48 pour + 220).** Les deux se cumulent : 11 pour + 961.

**La marge de la liste est le levier principal et le moins sûr.** Elle repose sur 1:17 (35 corrections hors zone → 5) et 1:29 ; sans 1:17, les autres parties en choisissent 4. Elle reste proposée parce que Mic l'a demandée (2:11 : « tu as oublié de contrôler l'avant et l'après de cet isolé »), mais le cut isolé qu'il cite (7177) n'est pas dans la liste et n'est pas rattrapé (§ 7).

## 5. Ce que disent les notes de Mic

Zones notées (marges de Mic comprises) confrontées aux plages d'ADV et de PN, livrées et proposées. Les écarts sont ceux du début et de la fin de la plage par rapport à Mic (négatif : la plage commence plus tôt ou finit plus tôt que Mic).

| Partie | Zone de Mic | Cuts de Mic dans la sélection, livré → proposé | Plage livrée (écart début / fin) | Plage proposée (écart début / fin) |
|---|---|--:|---|---|
| 1:15 | ADV 5889–6081, aiguille 5944 | 144 → 145 sur 193 | 5890–6033 (+1 / −48) | 5880–6033 (−9 / −48) |
| 1:15 | ADV 7036–7232, aiguille 7079 | 145 → 145 sur 197 | 7008–7163 (−28 / −69) | 6998–7163 (−38 / −69) |
| 1:16 | ADV 8735–8785, aiguille 8751 | 51 → 51 sur 51 | 8718–8804 (−17 / +19) | 8708–8804 (−27 / +19) |
| 2:11 | ADV 6362–6480, aiguille 6456 | 56 → 66 sur 119 | 6425–6488 (+63 / +8) | 6415–6488 (+53 / +8) |
| 2:11 | ADV 7299–7456, aiguille 7390 | 123 → 158 sur 158 | 7288–7349 puis 7388–7470 | 7278–7470 (−21 / +14) |
| 2:11 | ADV 8229–8309 | 68 → 81 sur 81 | 8223–8289 (−6 / −20) | 8213–8322 (−16 / +13) |
| 1:15 | PN 144–160, 7598–7614 | 17 → 17, 7 → 7 | 144–162, 7598–7609 | inchangées |
| 1:16 | PN 1678–1702 | 24 → 24 sur 25 | 1679–1703 (+1 / +1) | inchangée |

(En 1:15, le petit PN 6169–6173 (5 cuts) n'est pas relevé : aucun cœur de chaussée dans les cas ; le PN 8137–8151 n'a aucun cut dans la table.)

- **Début d'ADV.** Mic commence 31 cuts avant la plage détectée en 1:15 (5889 pour 5920), 13 en 1:16 (8735 pour 8748), 19 et 24 en 2:11 (7299 pour 7318, 8229 pour 8253). Le livré (30) couvre ces débuts, à un cut près en 1:15 ; seul le début de 2:11 6362, sans alerte, lui échappe (ci-dessous). Mais les grosses corrections de 2:11 vont jusqu'à 40 cuts avant la plage (6415 à 6419 pour 6455) : d'où **40 avant**, pas plus (50 : + 164 cuts, aucune correction de plus).
- **Fin d'ADV.** Mic finit 11 à 22 cuts après la dernière alerte (8785 pour 8774 ; 6480 pour 6458 ; 7456 pour 7440 ; 8309 pour 8292) et, une fois, 78 (6081 pour 6003). Le livré (30 après la dernière alerte confirmée) est assez large, **sauf quand une alerte isolée suit la zone** : en 2:11, les alertes 8283 et 8292 sont à 24 et 33 cuts de la plage 8253–8259, au-delà du trou de 10. La plage s'arrêtait à 8289 pour 8309 chez Mic. Avec un trou de 30, elle va à 8322. **La marge d'après reste à 30.**
- **Chaînage.** En 2:11, Mic contrôle 7299 à 7385 d'un seul tenant (« autre zone d'ADV proche »), alors que les deux plages sont séparées de 38 cuts, puis jusqu'à 7456 ; il fait de même de 6362 à 6480. Relier à 40 cuts reproduit le premier passage et la fin du second (7299–7456 ; 8229–8309). **Aucune grosse correction n'y est rattrapée** (aucune entre 7320 et 7389) : c'est un choix de méthode, pas un gain mesuré, qui coûte 47 cuts au total (+ 28 pour le chaînage, + 19 pour le trou).
- **2:11, 6362–6424.** La première zone de ce passage n'a **aucune alerte** dans les cas : Mic y trouve un cœur d'ADV au cut 6391 et le contrôle de 6362 à 6424 parce que la seconde zone est proche. La plage proposée commence à 6415 ; le cut 6391 (19 mm) reste hors zone. Seul un avant de 64 cuts le rattraperait (70 : 10 hors zone au lieu de 11, + 504 cuts).
- **Aiguilles.** Les aiguilles de Mic (5944, 7079, 8751, 6456, 7390, 1778) sont toutes dans une plage livrée.

## 6. Le PN pris pour une ADV (1:16, PN 1678–1702)

Faits, mesurés sur les cas :

- Le PN est relevé en 1683–1697 (cœurs de chaussée), zone de contrôle 1679–1703.
- Les alertes d'ADV vont de **1723 à 1749 puis de 1770 à 1784** : la première est à 26 cuts de la fin des cœurs du PN et à 20 de sa zone de contrôle. Aucune alerte ne tombe dans la zone d'un PN, ni en 1:16 ni dans les autres parties sauf 2:1 (9 alertes).
- La plage livrée 1693–1814 commence **dans** le PN, par sa seule marge de 30 cuts. Mic visite sans interruption de 1717 à 1813 (les cuts 1703 à 1716 ne sont pas visités), avec des corrections allant jusqu'à 11 mm et l'aiguille au cut 1778, au milieu du second paquet d'alertes (1770–1784). **L'ADV est réelle ; ce qui est pris pour un PN, c'est le début de la plage.**
- Marge proposée (40 avant) : 1683–1814. Le chevauchement avec le PN ne coûte rien (union des deux zones) ; les 97 cuts de 1704 à 1814 qui sont dans la table sont tous à relire, dont 2 grosses corrections (1775 et 1777).

Règle essayée : **ignorer les alertes d'ADV à N cuts au plus d'une zone de PN** (N de 0 à 30). Résultat sur l'apprentissage, toutes autres marges tenues :

| N | Hors zone | Cuts à relire |
|--:|--:|--:|
| aucune (livré) | 11 | 5 930 |
| 0 | 11 | 5 930 |
| 10 | 11 | 5 921 |
| 20 | 11 | 5 914 |
| 30 | 14 | 5 780 |

À N = 20, la règle économise 16 cuts, tous en 1:16 (566 → 550), en deux endroits : le début de la plage 1683–1814 (l'alerte 1723 est exactement à 20 cuts de la zone du PN) et la fin de la plage 8708–8804, où un cœur de chaussée isolé (8782) fait ignorer les dernières alertes (8773–8774) ; la plage finit alors à 8783 pour 8785 chez Mic. Choisie par la procédure (option `--avec-pn-ignore`), elle donne 11 hors zone et 5 867 cuts en apprentissage, mais **22 en validation au lieu de 19** (1:16 sans k passe à 3 grosses corrections hors zone ; ces chiffres sont ceux de l'ajustement libre, sans chaînage imposé). Un gain de 16 cuts sur un seul cas, une perte à la validation : **non retenue**. La proposition laisse les alertes d'ADV comme elles sont.

## 7. Ce qui reste hors zone (11)

| Partie | Cut (mm) | Contexte |
|---|---|---|
| 1:15 | 6500 (12), 6501 (17), 6904 (16) | À plus de 130 cuts de toute alerte ; aucun cut du lot ; pas de liste à moins de 170 cuts ; un cœur de chaussée isolé à 16 cuts de 6904. |
| 1:17 | 163 (12), 2202 (13), 4820 (15), 4821 (22), 4822 (19) | À 2 à 7 cuts d'un rouge du lot, mais hors de ses abords (isolé : 1 cut). |
| 1:29 | 2181 (10) | À 3 cuts d'un rouge du lot ; à 136 cuts de la liste. |
| 2:11 | 6391 (19) | Cœur d'ADV sans alerte (§ 5). |
| 2:11 | 7177 (18) | Isolé de Mic : à 47 cuts d'un cut du lot et à 122 de la liste. |

Les rattraper par des marges coûte cher : **isolé à 2 cuts : 9 hors zone (− 2) pour + 448 cuts ; à 3 : 7 pour + 947 ; à 5 : 6 pour + 1 872 ; à 7 : 5 pour + 2 661.** Une seule marge n'arrive à zéro.

## 8. Sensibilité

**Au prix** (chaînage imposé, plafond 1,75) :

| Prix (cuts par correction) | Hors zone (appr.) | Cuts à relire | Hors zone sans k | Cuts sans k | Marges qui changent |
|--:|--:|--:|--:|--:|---|
| 20 | 23 | 5 223 (× 1,05) | 36 | 5 261 | liste 3 |
| 50 | 15 | 5 479 (× 1,10) | 22 | 5 484 | avant 40, liste 4 |
| 100 | 14 | 5 532 (× 1,11) | 20 | 6 005 | + cœur seul |
| **200** | **11** | **5 930 (× 1,19)** | **20** | **6 472** | avant 40, cœur seul, liste 7 |
| 500 | 8 | 6 628 (× 1,33) | 17 | 6 521 | + avant 45, alerte seule, isolé 2 |
| 1 000 | 8 | 6 628 (× 1,33) | 18 | 6 464 | idem |

200 est le coude : au-delà, 3 corrections de plus coûtent 700 cuts et la validation n'y gagne que 3. À 100 : 14 hors zone en apprentissage (3 de plus) pour 398 cuts de moins, et la même validation (20) : **le prix est le choix à discuter**.

**Au plafond** (prix 200) : 1,25 → 20 hors zone et 5 646 cuts ; 1,5 → 11 et 5 990 ; 1,75 et 1,9 → 11 et 5 930. Le plafond ne mord qu'à 1,25 ; à 1,75 le pire est 1,50.

## 9. Les témoins

Marges figées (celles du § 4), appliquées une fois, sans réglage :

| Partie | Mic > 10 mm | Hors zone avant | Hors zone après | Cuts à relire avant | après | × |
|---|--:|--:|--:|--:|--:|--:|
| 1:11 | 103 | 64 | 60 | 181 | 209 | 1,15 |
| 1:25 | 21 | 0 | 0 | 205 | 264 | 1,29 |
| **total** | **124** | **64** | **60** | **386** | **473** | **1,23** |

Lecture, sans rien en tirer pour les marges : **la proposition ne résout pas 1:11** (60 grosses corrections sur 103 restent hors zone, 4 de moins qu'avec les marges livrées), et elle ne fait rien perdre sur 1:25 (aucune hors zone avant, aucune après) au prix de 59 cuts de plus. Je n'ai pas cherché pourquoi : un témoin ne règle rien. **Cette ligne est celle qui compte pour la généralisation.**

Transparence : les témoins ont été lus **deux fois**. Une première lecture, faite par erreur avant d'avoir figé le chaînage, donnait 1:11 : 64 → 60 et 1:25 : 0 → 0 (cuts 181 → 205 et 205 → 246). Le chaînage (trou 30, relier 40) a été ajouté ensuite à partir des notes de Mic seules, pas du résultat des témoins ; la seconde lecture, ci-dessus, est celle des marges proposées. Les comptes de grosses corrections sont identiques.

## 10. Limites

- **Un seul prix, un seul plafond.** Ils sont un choix de méthode (§ 8), pas une mesure.
- **Le gain tient à 1:17 et 1:29.** Ailleurs, l'élargissement coûte des cuts sans rattraper de correction. Une marge différente par type de partie (avec lot, sans lot) n'a pas été essayée : onze parties ne le permettent pas.
- **Le « coût » est un nombre de cuts, pas un temps.** Il ne distingue pas un cut déjà vu par le lot d'un vert jamais ouvert.
- **Le chaînage est imposé** : sa validation par partie laissée de côté ne le met pas à l'épreuve.
- **Les zones de Mic notées sont peu nombreuses** (onze sur trois parties) ; les débuts et fins qu'elles donnent confirment les ordres de grandeur (13 à 31 avant, 11 à 22 après), pas une valeur exacte.
- **Les alertes d'ADV et les cœurs de PN** viennent du nuage lu par les règles métier à la version courante ; une version qui les change change aussi ces marges.

## 11. Rejouer

Entrées : les cas et les tables de zones de chaque partie (`tools/relecture-autonome.cjs extraire` puis `table`, voir `fiches/RM4_ABSTENTIONS.md` § 2.1). Les parties d'apprentissage seules sont acceptées par `etudier` ; un témoin est refusé.

```
# choix des marges (une minute environ), avec le chaînage lu dans les notes de Mic
node tools/marges-zones.cjs etudier \
  --partie 1:12 --cas CAS_1_12.jsonl --table TABLE_1_12.json  … (les onze parties d'apprentissage) \
  --fixer adv.trou=30 --fixer adv.gap=40 \
  --json etude.json --proposition datasets/marges-zones-proposees.json --date 2026-10-19

# même chose en laissant la procédure chercher le chaînage ; ajouter --avec-pn-ignore pour essayer la règle du § 6
# (options : --prix 200, --plafond 1.75)

# zones notées par Mic, avec la proposition
node tools/marges-zones.cjs notes --proposition datasets/marges-zones-proposees.json \
  --partie 1:15 … --partie 1:16 … --partie 2:11 …

# témoins, marges figées (à ne faire qu'une fois, sans régler)
node tools/marges-zones.cjs juger --proposition datasets/marges-zones-proposees.json \
  --partie 1:11 --cas … --table … --partie 1:25 --cas … --table … --juger-partie-reservee

# essai sans donnée de terrain
node tools/marges-zones.cjs essai
node --test tests/marges-zones.test.cjs
```

Fichiers :

- `tools/marges-zones.cjs` : l'outil (étude, jugement, notes, essai).
- `datasets/marges-zones-proposees.json` : la proposition, « proposées, non figées ».
- `datasets/marges-zones-notes-de-mic.json` : les zones notées par Mic.
- `tests/marges-zones.test.cjs` : l'essai (partie inventée, refus des témoins, ombre).

Pour figer plus tard : une décision écrite, puis la lecture de la proposition par `src/regles-metier.js` et `datasets/reglages-figes.json`, avec l'essai d'équivalence habituel. Rien de cela n'est fait ici.
