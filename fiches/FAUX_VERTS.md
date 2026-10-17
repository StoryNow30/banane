# Faux verts : causes, signaux, ombre (chantier 5.0, 16 octobre 2026)

Un **faux vert** est un cut qu'Ariane a posé et validé (vert) et que l'opérateur a corrigé de plus de 10 mm (3D, plus grand des deux rails, repère profil ; même définition que `G0_APPRENTISSAGE_V1.md`). Ce chantier cherche **pourquoi** ils existent, quels signaux **disponibles au moment de la décision** les trahissent, et propose une règle simple qui **diffère** un cut suspect au lieu de le valider. La règle est livrée **en ombre** : elle est consignée, son chemin d'activation est coupé.

Conventions : **[V]** vérifié (mesuré sur les lots et l'Écho, ou relu dans la science du cut) ; **[S]** supposé. Aucun identifiant de projet, aucune coordonnée absolue : numéros de partie et de cut, millimètres, comptes. Les projets sont désignés par leur rang (« 1:17 » = projet 1, partie 17 ; « 2:1 » = projet 2, partie 1).

## 1. Réponses en bref

| Question | Réponse |
|---|---|
| **Combien, où ?** | 85 faux verts : 47 (1:17), 21 (1:24), 7 (1:29), 10 (2:1). **52 sont hors de la zone de contrôle de l'opérateur** (à plus de 3 cuts d'un différé, hors PN et ADV) : 38, 8, 6 et **0**. Sur le second projet, les 10 sont dans une zone qu'il contrôle (ADV 2, PN 405–409). [V] |
| **Cause dominante** | **La hauteur du rail** (« convention verticale ») : 70 sur 85, dont 49 des 52 qui échappent au contrôle. 44 sont vérifiés dans la science du cut (le calage de convention, appliqué ou refusé, explique la correction), 26 supposés. [V] pour les comptes |
| **Mauvais minimum ?** | **Jamais** sur ces 85 : la pose de l'opérateur n'est jamais un autre minimum de la grille du moteur. Pour 81 sur 85, elle tombe sur le **même** minimum que la pose d'Ariane, décalée surtout en hauteur. [V] |
| **Autres causes** | Voie décalée 4 (bonne pose hors de la fenêtre de recherche du moteur, vérifiée 4 fois) ; flanc partiel 2 ; nuage pauvre 1 (supposé) ; autre 8 (aiguilles, zone d'ADV, ornière d'un PN, cas mixte). Pose d'extraction validée en place : 0. |
| **Signaux** | Aucun signal ne sépare bien. Meilleures AUC (1:17 / 1:24 / 1:29 / 2:1) : épaisseur du dessus 0,63 / 0,72 / 0,70 / 0,52 ; points du dessus (peu) 0,62 / 0,78 / 0,66 / 0,65 ; confiance (basse) 0,63 / 0,76 / 0,56 / 0,76. En validation croisée par partie, à 5 % de bons verts différés, aucun signal ne se transporte d'une partie à l'autre. |
| **Règle** | « Hauteur ambiguë » : un même rail avec un **calage vertical d'au moins 11 mm** (appliqué ou refusé) **et** un **dessus épais d'au moins 14 mm** → différer. Sur les 4 parties : **7 faux verts évités, 3 bons verts différés en plus, net +4** (en échantillon). En validation croisée : **1 évité, 1 différé, net 0**. Elle est petite et ne réduit presque rien : c'est le meilleur compromis trouvé, pas une solution. |
| **Ombre sans effet** | Prouvé : essais octet pour octet, et rejeu des 4 lots réels (1 380 cuts) : **décisions et commandes identiques** avec et sans l'ombre ; chemin ouvert pour l'essai seulement, il ne fait que différer (17 cuts), **0 pose ajoutée**. [V] |
| **Le vrai levier** | La pose verticale, pas le différé : sur le premier projet, l'opérateur **descend** le rail d'autant plus que la bande du dessus est épaisse (corrélation −0,31 à −0,59). Une correction « a + b × épaisseur » apprise sur les autres parties ferait passer les faux verts de **85 à 66** (26 corrigés, 7 nouveaux). C'est une pose différente : **mesure seulement**, à passer en ombre et à décider avec l'opérateur. [V] mesure hors ligne, [S] effet au terrain |

## 2. Données et méthode

| Partie | Version du lot | Posés avec référence | Faux verts | Jeu | Lot |
|---|---|--:|--:|---|---|
| 1:17 | 4.9.0.12 | 192 | 47 | jeu G0 enrichi | lot 4.9.0.12 (journal et corpus) |
| 1:24 | 4.9.0.15 | 70 | 21 | jeu G0 refait après la jointure par cadre (D-152) | lot 4.9.0.15 (deux pages) |
| 1:29 | 4.9.5.3 | 198 | 7 | jeu G0 enrichi | lot 4.9.5.3 |
| 2:1 | 4.9.5.3 | 161 | 10 | jeu E5 du second projet (4 SKIP retirés) | lot 4.9.5.3 |

- « Avec référence » : validation observée par l'Écho, ou visite sans action d'au moins 0,8 s (règle de l'opérateur, D-138, durcie par D-152). Mêmes comptes que G0 et D-141 (10 sur 161).
- **Outil** : `tools/faux-verts.cjs` (essai `tests/faux-verts.test.cjs`, fixtures synthétiques).
  - `extraire` relit, pour chaque cut posé, la science du cut **dans le journal du lot** (proposition du moteur, ombre GCV1 complète avec le calage de convention, décision sur le lot) et rejoue sur le nuage ce qui n'y est pas : bandes de points du dessus et du flanc à la pose posée, écart à la voie des cuts posés **avant** lui dans le lot, verdict de l'ombre (le même module que l'extension). Ce sont les **signaux** : ils ne lisent jamais la référence humaine (essai anti-fuite, vérifié par mutation : une fuite volontaire fait échouer l'essai).
  - Pour les faux verts seulement, il relit la **grille du moteur** autour de la pose de l'opérateur : minima locaux calés comme le moteur les aurait publiés, minimum le plus proche de chaque pose, perte du gabarit à la pose de l'opérateur, fenêtre de recherche. C'est le **diagnostic** de la typologie.
  - `etudier` fait la typologie, les AUC, la validation croisée par partie et le bilan de la règle ; `preuve` rejoue un lot avec et sans l'ombre.
- **Fidélité du rejeu** : le calage de convention recalculé par les modules de la base 5.0 sur les nuages des lots retrouve celui du journal à 0,15 mm près sur 454 rails sur 455 (1:17), 171/171 (1:24), 364/367 (1:29) [V]. Le rejeu de la décision sur le lot retrouve l'étage du journal pour 267/268, 482/515, 242/245 et 342/352 cuts [V].
- **Zone de contrôle** de l’opérateur (fiche de méthode de la partie 29, audit 5.0 I7) : à 3 cuts au plus d'un différé du lot, ou dans un PN ou une zone d'ADV notés. Les zones ne sont connues que pour 1:29 et 2:1 : pour 1:17 et 1:24, seule la distance aux différés compte (le nombre de faux verts hors contrôle y est donc un **maximum**).
- **Validation croisée par partie** : apprendre sur trois parties (chacune pèse autant), juger sur la quatrième, jamais la même des deux côtés.

## 3. Typologie

### 3.1 Règles de classement (rail le plus corrigé, dans cet ordre)

1. **Autre — ornière d'un PN** : cut posé par l'étage « crossing » de la décision (règles métier, hors de ce chantier).
2. **Voie décalée** : correction de 50 mm ou plus, ou pose de l'opérateur hors de la fenêtre de recherche du moteur (±80 mm autour de ses centres). **Vérifiée** si la grille recentrée sur la pose de l'opérateur y a un minimum net (à 8 mm au plus, rapport de perte ≤ 1,5) : la bonne pose existait, le moteur ne la cherchait pas là.
3. **Pose d'extraction validée en place** : pose d'Ariane et pose brute du moteur à 2 mm au plus de la pose d'extraction d'ESV.
4. **Mauvais minimum** : la pose de l'opérateur est à 5 mm au plus d'un **autre** minimum local de la grille (rapport de perte ≤ 3) que celui qu'Ariane a choisi.
5. **Autre — aiguille** : à 3 cuts au plus d'une aiguille notée par l'opérateur (1:29 : 6638, 8003 ; 2:1 : 136, 287, 320, 552, 616, 626, 2932, 3012, 5520, 5591, 6159, 6160).
6. **Convention verticale** : correction surtout verticale (plus de 7 mm, plus que la latérale).
   - calage **refusé** (décalage hors des 8 mm, rail posé brut) : **vérifiée** si la pose calée (brute + décalage mesuré) tombe à 5 mm au plus de l'opérateur, dans le même sens (« l'opérateur applique le décalage ») ;
   - calage **appliqué** : **vérifiée** si la pose brute (avant calage) était plus proche de l'opérateur d'au moins 3 mm (« la pose brute était plus juste ») ;
   - sinon **supposée** : « dessus ambigu (hors calage) », « calage refusé, correction non expliquée », ou calage non relu (étage reprise ou choix).
7. **Flanc partiel** : flanc du candidat publié sous 6 points (3 à 5 acceptés depuis la 4.7.4). Vérifié : c'est un compte.
8. **Nuage pauvre** : moins de 60 points autour du champignon, ou moins de 15 points de dessus, ou moins de 3 points de flanc à la pose. Supposé.
9. **Autre** : le reste (zone d'ADV ou de PN, cas mixte).

Annotation **ricochet** : cut posé par reprise ou par choix dont un appui a lui-même été corrigé de plus de 5 mm (6 cas : 1:17 5990, 1:24 2173, 5692, 5718, 1:29 302, 2:1 584).

### 3.2 Tableau par partie (vérifiés / supposés ; entre parenthèses, hors zone de contrôle)

| Cause | 1:17 | 1:24 | 1:29 | 2:1 | Total |
|---|---|---|---|---|---|
| Convention verticale | 29 V / 17 S (37) | 11 V / 8 S (7) | 4 V / 1 S (5) | — | **44 V / 26 S (49)** |
| — calage refusé, l'opérateur applique le décalage | 21 V | 1 V | 1 V | — | 23 V |
| — calage appliqué, la pose brute était plus juste | 8 V | 10 V | 3 V | — | 21 V |
| — calage refusé, correction non expliquée | 9 S | 2 S | — | — | 11 S |
| — dessus ambigu (hors calage) | 7 S | 1 S | 1 S | — | 9 S |
| — calage non relu (reprise ou choix) | 1 S | 5 S | — | — | 6 S |
| Voie décalée | — | 1 V (1) | — | 3 V | **4 V (1)** |
| Flanc partiel | — | — | 1 V (1) | 1 V | **2 V (1)** |
| Nuage pauvre | — | 1 S | — | — | **1 S** |
| Mauvais minimum | 0 | 0 | 0 | 0 | **0** |
| Pose d'extraction validée en place | 0 | 0 | 0 | 0 | **0** |
| Autre | 1 S mixte (1) | — | 1 S aiguille | 1 V ornière PN, 3 S aiguille, 2 S zone d'ADV | **1 V / 7 S (1)** |
| **Total** | **47 (38)** | **21 (8)** | **7 (6)** | **10 (0)** | **85 (52)** |

### 3.3 Ce que la relecture de la science du cut montre [V]

- **La pose de l'opérateur n'est pas un autre candidat du moteur.** Pour 81 faux verts sur 85, elle est la plus proche du **même** minimum de la grille que la pose d'Ariane ; pour 76, le gabarit y colle moins bien (perte plus de 2 fois la meilleure de la grille). L'opérateur ne pose pas « où le gabarit colle le mieux » : il pose selon sa convention de hauteur. 72 corrections sur 85 sont surtout verticales.
- **Premier projet : une affaire de hauteur.** Partie 1:17 (4.9.0.12, 23 % de rails à calage refusé) : le rail refusé est posé brut, l'opérateur le remonte presque exactement du décalage mesuré (21 cas vérifiés, à 0,3 à 5 mm près). Parties 1:24 et 1:29 : le calage appliqué monte le rail au 90e centile des points du dessus, l'opérateur le pose plus bas (13 cas où la pose brute était plus juste). Les deux sens coexistent : 4732, 4733, 4750 et 4751 (1:17) sont refusés, mais l'opérateur les **descend** de 12 à 20 mm.
- **L'épaisseur du dessus explique une part du sens** : sur les rails jugés du premier projet, la correction verticale de l'opérateur baisse quand la bande des points du dessus s'épaissit (corrélation −0,31 à −0,59 selon la partie et le calage). Sur le second projet, aucun lien (0,04). Les histogrammes relus (1:29, cuts 296, 465, 1710) montrent une bande de 10 à 15 mm, parfois à deux modes : le calage prend le haut, l'opérateur pose plus bas.
- **Voie décalée** (4 cas, tous vérifiés) : 2:1 299, 302, 315, en zone d'ADV 2 (bonne pose à 140–280 mm de la pose d'Ariane : Ariane a posé sur la voie voisine, D-141) ; 1:24 5760 (bonne pose à 97 mm de la pose d'extraction, juste au-delà du bord de la grille ; la pose brute d'Ariane est au bord, à 80 mm). Dans les quatre cas, la grille recentrée sur l'opérateur a son meilleur minimum à 0,4–6,6 mm de lui.
- **Aiguilles et zone d'ADV** (2:1 319, 584, 586, 628, 5590 ; 1:29 8004) : la pose de l'opérateur est loin de tout minimum du gabarit (perte 3 à 340 fois la meilleure) : le profil d'appareil de voie ne ressemble pas au gabarit. Tous sont dans la zone que l'opérateur contrôle.

## 4. Signaux du moment de la décision

### 4.1 Par cause : quel signal la trahit (AUC, toutes parties, faux verts de la cause contre tous les bons verts)

| Cause | Signal | AUC |
|---|---|--:|
| Convention verticale (70) | épaisseur du dessus à la pose | **0,81** |
| | décalage vertical du calage, `|dz|` | **0,79** |
| | calage refusé ; points du dessus sous le gabarit | 0,70 ; 0,70 |
| | écart de dévers à la voie des posés précédents | 0,67 |
| Voie décalée (4) | marge au bord de la fenêtre de recherche (faible) | **0,96** |
| | `flushPct` ; écart vertical à la voie des posés précédents | 0,89 ; 0,86 |
| | écart latéral à la pose d'extraction | 0,74 |
| Autre (8) | marge entre les deux meilleurs candidats (faible) | 0,82 |
| | écart à la voie prédite par les appuis | 0,76 |
| Flanc partiel (2), nuage pauvre (1) | trop peu de cas pour une AUC | — |

Lecture : les signaux d'une cause la reconnaissent assez bien **parmi les faux verts**, mais les bons verts portent les mêmes valeurs : une épaisseur de 14 mm ou un calage de 10 mm sont courants sur des rails que l'opérateur ne touche pas. La voie décalée est bien vue (bord de fenêtre), mais elle ne compte que 4 cas, tous sauf un en zone de contrôle.

### 4.2 Par partie (faux verts > 10 mm contre les autres posés avec référence)

| Signal (sens du risque) | 1:17 | 1:24 | 1:29 | 2:1 | Signe stable |
|---|--:|--:|--:|--:|---|
| `|dz|` du calage (haut) | 0,71 | 0,53 | 0,66 | 0,54 | oui |
| épaisseur du dessus (haut) | 0,63 | 0,72 | 0,70 | 0,52 | presque (nul en 2:1) |
| points du dessus à la pose (bas) | 0,62 | 0,78 | 0,66 | 0,65 | oui |
| confiance du moteur (basse) | 0,63 | 0,76 | 0,56 | 0,76 | oui |
| lignes du dessus du candidat (bas) | 0,62 | 0,63 | 0,56 | 0,65 | oui |
| saut d'écartement / posé précédent (haut) | 0,60 | 0,56 | 0,61 | 0,68 | oui |
| marge entre les deux meilleurs candidats (basse) | 0,59 | 0,65 | 0,48 | 0,75 | non |
| candidats forts compétitifs (haut) | 0,57 | 0,55 | 0,61 | 0,61 | oui |
| écart à la voie prédite par les appuis (haut) | 0,53 | 0,46 | — | 0,74 | non |
| écart vertical à la voie des posés précédents (haut) | 0,43 | 0,51 | 0,34 | 0,68 | non |
| écart à la pose d'extraction, vertical (haut) | 0,63 | 0,79 | 0,54 | 0,47 | non |
| flanc partiel accepté | 0,50 | 0,40 | 0,50 | 0,51 | non |
| pose à 2 mm de la pose d'extraction | 0,47 | 0,52 | 0,48 | 0,58 | non |

La table complète (29 signaux, aussi à plus de 5 mm) est dans la sortie de l'outil (hors dépôt). La voie des posés précédents ne voit pas les faux verts verticaux du premier projet : ils viennent **en séries** (1:17 : 2413–2443, 4732–4751, 5981–5990, 7532–7577), et des voisins faux de la même façon ne trahissent pas le suivant.

### 4.3 Validation croisée par partie : rappel à taux fixe de bons verts différés

Seuil d'un signal appris sur trois parties (taux moyen de bons verts différés au plus 5 % ou 10 %), jugé sur la quatrième. Les quatre meilleurs, cumul sur les 4 parties jugées (85 faux verts, 536 bons verts) :

| Budget | Signal | Évités | Bons verts différés | Par partie (évités / faux verts, bons différés) |
|---|---|--:|--:|---|
| 5 % | points du dessus (bas) | 22 | 30 | 1:17 0/47 (0) ; **1:24 20/21 (24)** ; 1:29 1/7 (3) ; 2:1 1/10 (3) |
| 5 % | épaisseur du dessus | 12 | 20 | 6/47 (10) ; 6/21 (5) ; 0/7 (5) ; 0/10 (0) |
| 5 % | saut d'écartement | 12 | 20 | 6/47 (6) ; 3/21 (3) ; 0/7 (7) ; 3/10 (4) |
| 5 % | `|dz|` du calage | 10 | 18 | 5/47 (8) ; 5/21 (8) ; 0/7 (2) ; 0/10 (0) |
| 10 % | épaisseur du dessus | 26 | 51 | 12/47 (29) ; 14/21 (13) ; 0/7 (9) ; 0/10 (0) |
| 10 % | points du dessus (bas) | 22 | 34 | 0/47 (0) ; 20/21 (28) ; 1/7 (3) ; 1/10 (3) |
| 10 % | points du dessus sous le gabarit | 18 | 35 | 7/47 (13) ; 8/21 (12) ; 3/7 (10) ; 0/10 (0) |

Aucun signal ne tient d'une partie à l'autre : le meilleur cumul à 5 % vient presque entièrement de 1:24 (lot à nuages plus maigres). Les bilans nets sont tous négatifs (−8 à −25). Les règles à deux signaux (OU) apprises de la même façon font 8/85 à 5 % et 16/85 à 10 % (essai exploratoire). C'est le constat de G0 (8 % à 5 % des cuts, M6 11 %), avec d'autres signaux.

## 5. La règle « hauteur ambiguë » (ombre `faux-vert-ombre`)

**Règle** : un même rail porte **|dz| ≥ 11 mm** (décalage vertical mesuré par le calage de convention sur le rail publié par le moteur, appliqué ou refusé) **et** une **épaisseur du dessus ≥ 14 mm** (90e moins 10e centile des écarts verticaux des points du dessus au gabarit, à la pose décidée) → **différer**. Sinon valider. Avec la convention livrée (plafond coupé), `|dz| ≥ 11` ne se rencontre que sur des rails **refusés** : la règle dit « le moteur pose brut un rail dont le dessus est épais et que le calage voulait déplacer de plus de 11 mm ».

Pourquoi celle-ci : c'est la meilleure en bilan net parmi les règles lisibles essayées (seuils seuls, OU et ET de deux signaux) ; elle suit le mécanisme principal de la typologie ; elle diffère très peu de cuts. Grille des seuils (cumul des 4 parties, faux verts évités / bons verts différés) : |dz| ≥ 11 et épaisseur ≥ 13 à 15 mm : **7 / 3 (net +4, le meilleur)** ; ≥ 12 et ≥ 10 : 3 / 0 ; ≥ 10 et ≥ 15 : 8 / 7 ; ≥ 8 et ≥ 18 : 5 / 3 ; ≥ 8 et ≥ 14 : 15 / 22 ; ≥ 8 et ≥ 10 : 38 / 93.

### 5.1 Bilan par partie

| Partie | Faux verts | Évités | dont hors zone de contrôle | Bons verts différés en plus | Posés sans référence différés | Bilan net |
|---|--:|--:|--:|--:|--:|--:|
| 1:17 | 47 | 2 | 0 sur 38 | 1 sur 145 | 0 | +1 |
| 1:24 | 21 | 5 | 2 sur 8 | 1 sur 49 | 1 | +4 |
| 1:29 | 7 | 0 | 0 sur 6 | 1 sur 191 | 0 | −1 |
| 2:1 | 10 | 0 | 0 sur 0 | 0 sur 151 | 0 | 0 |
| **Total** | **85** | **7** | **2 sur 52** | **3 sur 536** | **1** | **+4** |

- Ces chiffres sont **mesurés** [V] sur les parties qui ont servi à choisir les seuils : ils sont **en échantillon**. Pour une partie neuve, ils sont **supposés**.
- **Validation croisée** [V] (seuils appris sur les trois autres parties, critère : meilleur bilan net) : 1:17 0/47 évités, 0 différé ; 1:24 1/21, 0 ; 1:29 0/7, 1 ; 2:1 0/10, 0. **Cumul : 1 évité, 1 bon vert différé, net 0.** Les seuils appris changent beaucoup d'une partie à l'autre (|dz| de 8 à 12 mm, épaisseur de 10 à 20 mm) : la règle n'est pas stable.
- **Sur les lots entiers** (rejeu, tous les cuts posés, avec ou sans référence) [V] : l'ombre dirait « différer » sur 3 cuts (1:17, 1,3 % des posés au rejeu), 13 (1:24, 3,4 %), 1 (1:29, 0,5 %) et 0 (2:1).
- Un faux vert hors contrôle se trouve à un cut d'un nouveau différé (1:24) : en contrôlant ce différé, l'opérateur le verrait peut-être [S].

### 5.2 Où elle vit

- `src/faux-vert-ombre.js` : module pur (signaux, verdict). Il ne lit que la capture, la science du cut et la décision.
- `src/lot-decision.js`, `decideCut` : la décision qui pose reçoit une clé `fauxVertOmbre` (signaux par rail, verdict, rails suspects, seuils), **copie ajoutée après** la décision de base, dans un `try` (une panne ne change rien). Elle est consignée avec la décision dans l'événement `gcv1-shadow-observed` (champ `lotObservation`) ; rien n'est ajouté au service worker, sauf le chargement du module avant `lot-decision.js`.
- `src/settings.js`, réglage `fauxVertOmbre = { actif: true, differer: false, dzMinMm: 11, epaisseurMinMm: 14 }` : actif **pour consigner seulement** ; une ligne dans la liste des réglages du panneau.
- **Chemin d'activation, coupé** : `commandRails` passe par `fauxVertActivation`. Il ne s'ouvre que si `differer` vaut `true` (livré à `false`, épinglé par les essais). Ouvert, il ne fait qu'une chose : une commande qui allait **poser** (positions du lot, ou paire du moteur aux deux rails résolus) devient un **différé** (deux abstentions, motif `faux-vert-ombre`), et le cut ne devient pas appui. Il ne crée jamais de pose, ne déplace aucune position, ne touche pas un cut déjà différé.
- Réglages figés : `datasets/reglages-figes.json`, entrée `fauxVertOmbre` (date, valeurs, parties qui ont servi : 1:17, 1:24, 1:29, 2:1, toutes d'apprentissage au manifeste).

## 6. Preuve « ombre sans effet »

- **Essais** `tests/faux-vert-ombre.test.cjs` (captures versionnées de `tests/corpus`) : décision identique octet pour octet avec et sans le réglage (premier passage et reprise depuis la voie, cinq réglages) ; commande identique tant que le chemin est coupé, même avec une ombre « différer » ou fausse ; ouvert pour l'essai, le chemin ne fait que différer un cut que la commande allait poser, laisse un cut déjà différé tel quel et n'en fait pas un appui ; l'ombre ne modifie rien de ce qu'elle lit ; une panne de l'ombre laisse la décision de base ; seuls le module, `lot-decision.js` et `settings.js` nomment l'ombre ; `src/engine.js` ne la connaît pas ; le module est chargé avant `lot-decision.js`. L'essai P8 (`ombre-verticale-4954`) tient désormais l'ombre à l'écart pour ne juger que P8.
- **Rejeu des quatre lots réels** (`tools/faux-verts.cjs preuve`) : chaque cut redécidé dans l'ordre du lot avec les réglages livrés, puis sans le réglage [V] :

| Lot | Cuts redécidés | Décisions identiques (hors clé) | Commandes identiques | Ombres consignées | Verdict « différer » | Chemin ouvert (essai) : différés en plus / poses ajoutées |
|---|--:|--:|--:|--:|--:|---|
| 1:17 | 268 | 268 | 268 | 232 | 3 | 3 / **0** |
| 1:24 | 515 | 515 | 515 | 383 | 13 | 13 / **0** |
| 1:29 | 245 | 245 | 245 | 213 | 1 | 1 / **0** |
| 2:1 | 352 | 352 | 352 | 238 | 0 | 0 / **0** |

- `src/engine.js` n'est pas touché.

## 7. Le vrai levier : la hauteur, pas le différé

Les faux verts qui échappent à l'opérateur sont presque tous des erreurs de **hauteur** de quelques millimètres au-dessus du seuil, sur des cuts qui ressemblent à leurs voisins justes. Différer ne peut pas les trier sans différer beaucoup de bons verts. En revanche, leur **sens** est en partie prévisible :

Correction verticale = a + b × épaisseur du dessus, par groupe de rails (calage appliqué, calage refusé), apprise sur les trois autres parties, appliquée à la quatrième (mesure, `etudier`, section « levier vertical ») [V] :

| Partie | Faux verts avant → après | Corrigés | Nouveaux | Corrigés de plus de 5 mm avant → après | Modèle « appliqué » appris (a ; b) |
|---|---|--:|--:|---|---|
| 1:17 | 47 → 33 | 18 | 4 | 132 → 114 | 4,3 ; −0,67 |
| 1:24 | 21 → 20 | 3 | 2 | 46 → 40 | 3,0 ; −0,45 |
| 1:29 | 7 → 2 | 5 | 0 | 96 → 80 | 3,4 ; −0,51 |
| 2:1 | 10 → 11 | 0 | 1 | 45 → 44 | 3,8 ; −0,55 |
| **Total** | **85 → 66** | **26** | **7** | **319 → 278** | |

- Les modèles appris se ressemblent d'une partie à l'autre pour les rails calés (a ≈ 3 à 4 mm, b ≈ −0,5) : un rail au dessus fin (6 mm) ne bouge presque pas (+0,4 mm), un rail au dessus épais (16 mm) descend de 4,6 mm.
- Ce n'est **pas** livré : c'est une pose différente, et la porte « aucune mauvaise pose ajoutée » n'est pas tenue (7 nouveaux faux verts). Suite proposée : une ombre « P8 bis » qui **consigne** la pose qu'aurait donnée cette correction (comme P8 pour les rails refusés), puis une mesure sur des parties neuves, et la décision de l'opérateur.
- **Fait** (17 octobre 2026) : `HAUTEUR_APPRISE.md`. Avec une enveloppe prudente (moitié de la droite sur les rails calés, plafond de 5 mm), le modèle donne 85 → 61 en validation croisée, sans nouveau faux vert, et il est consigné en ombre (`hauteurApprise`).

## 8. Doutes et limites

- **Seuil de 10 mm et bruit de la référence** : la plupart des faux verts du premier projet sont des corrections verticales de 10 à 20 mm, au bout d'une distribution continue (sur le premier projet, 48 à 69 % des posés sont corrigés de plus de 5 mm). Le grain de l'opérateur est de 2 à 4 mm (D-134) : une part de ces faux verts tient au seuil autant qu'à Ariane [S].
- **Versions** : 1:17 et 1:24 sont des lots de la 4.9.0 (23 % de calages refusés), 1:29 et 2:1 de la 4.9.5.3 (5 %). La cause dominante change avec la version (refusés en 1:17, appliqués en 1:24 et 1:29). Les signaux et la règle ne se transportent pas d'une version à l'autre.
- **Effectifs** : 7 faux verts en 1:29, 10 en 2:1 ; les AUC par cause de moins de 10 cas (voie décalée, autre) sont fragiles.
- **Seuils de la typologie** (5 mm, 3 mm, 8 mm, rapports 1,5 et 3) : choisis par moi, une fois, avant le décompte final. Changer 5 mm en 4 ou 6 mm déplace quelques cas entre « vérifié » et « supposé », pas la cause dominante [S].
- **Zones de contrôle** : connues seulement pour 1:29 et 2:1 ; pour 1:17 et 1:24, les 46 « hors contrôle » sont un maximum (PN et ADV inconnus).
- **La règle** a été choisie en lisant les quatre parties : elle est d'apprentissage. Son effet sur une partie neuve ne se jugera qu'en ombre, sur une partie réservée, avec les réglages figés de `datasets/reglages-figes.json`.
- **Rejeu de la preuve** : les appuis sont les cuts posés du lot, dans l'ordre du lot, aux poses d'Ariane ; l'étage rejoué concorde avec le journal pour 1 333 cuts sur 1 380. La preuve porte sur l'égalité avec et sans l'ombre, pas sur la fidélité au lot.
- **Bande du dessus** : calculée avec les mêmes fonctions que le calage de convention, à la pose posée. Pour un cut posé par reprise ou par choix, `dz` est celui de la proposition du moteur sur la capture, pas celui de la pose reprise.

## 9. Rejouer

```
node tools/faux-verts.cjs extraire --partie 1:29 --jeu jeu-p29e.jsonl --journal ariane-journal-v4-….json --corpus seg01.json … --sortie cas-29.jsonl
node tools/faux-verts.cjs extraire --partie 2:1 --aiguilles 136,287,320,552,616,626,2932,3012,5520,5591,6159,6160 --jeu … --journal … --corpus … --sortie cas-p2-1.jsonl
node tools/faux-verts.cjs etudier --cas cas-17.jsonl --cas cas-24.jsonl --cas cas-29.jsonl --cas cas-p2-1.jsonl --json etude.json
node tools/faux-verts.cjs preuve --partie 1:29 --jeu … --journal … --corpus … --json preuve-29.json
```

Sous `nice -n 10`, avec le verrou des rejeux lourds ; compter une à deux minutes par partie pour `extraire` et 5 à 15 minutes pour `preuve`. Les jeux, lots et sorties restent hors dépôt (données de terrain).
