# Diagnostic exhaustif des différés du lot (cap « différés −90 % », D-217) — 19 octobre 2026

Étude **hors ligne, en lecture seule**. Aucun réglage n'est changé, aucun comportement de terrain non plus. L'outil est `tools/diag-differes.cjs` (sous-commandes `inventaire`, `motifs`, `gains`, `gardes`, `pistes`, et les étapes `lots`, `extraire`, `mic`, `joindre-mic`), avec ses essais dans `tests/diag-differes.test.cjs`. Le plan des lots est dans `datasets/diag-differes-plan.json`. Le rejeu causal réutilise `tools/gcv2-predire-differes.cjs`, repris de `claude/50-differes-2-17`.

Ce document ne contient que des numéros de parties, de lots et de cuts, des millimètres et des comptes. On écrit « 2:1 » pour la partie 1 du projet 2. Les écarts à l'opérateur n'ont été lus que pour les parties prévues. **2:17 et 2:18 : aucun Écho lu.** 2:18 est une partie réservée ; seul son journal a été inventorié (motifs). Aucune hypothèse ni aucune GCV2 n'a été calculée dessus.

## 0. En bref

| Question | Réponse |
|---|---|
| **Base** | 40 lots, 6 878 cuts traités, **1 367 différés** (34,2 par lot). Taux moyen non pondéré **22,4 %**, taux médian 16,0 %, taux pondéré **19,9 %**. |
| Base par projet | Projet 1 : 24,2 % non pondéré, 19,2 % pondéré, 40,7 différés par lot. Projet 2 : 19,1 % et 22,6 %, 22,1 différés par lot. |
| Base par famille | 4.9.0.x : 24,6 % et 19,4 %. 4.9.5.x : 18,8 % et 21,4 %. |
| Cible −90 % | Environ 2,2 % de différés par lot, soit **137 différés au plus sur la base** (3 à 4 par lot). |
| **Où naissent les différés** | **64 % « sans appui »** : le moteur ne résout pas les deux rails (648 n'en ont qu'un, 159 ont une paire hors contrat, 72 n'en ont aucun) et le lot n'a pas de cut posé à 3 cuts au plus pour reprendre depuis la voie. Ensuite : reprise sans minimum qualifié 16 %, garde de paire 16 %, cible hors de la vue 1,5 %. Les autres gardes du lot (écartement bas, écartement voisin, continuité) ne créent presque aucun différé. |
| Zone | 72 % aux abords, 26 % en ADV, 3 % au PN (zone à l'instant de la décision). |
| **Pose de départ** | **79 % des différés partent de l'écartement par défaut d'ESV (1 500 mm).** À l'Écho, le différé coûte à l'opérateur **86 mm** en médiane : 51 mm en projet 1, 191 mm en 2:1. |
| **Rappel atteignable** (282 différés jugés) | Une hypothèse à **10 mm : 62 %** ; 20 mm : 71 % ; 50 mm : 79 %. **94 %** des différés ont une hypothèse plus proche de l'opérateur que la pose de départ. **Perdus d'avance** (toutes les hypothèses à plus de 50 mm) : **21 %**, presque tous en 2:1 (57 sur 60). Hors 2:1 : rappel à 10 mm de **86 %**, 2 % perdus d'avance. |
| **La GCV2 seule** (meilleure paire, sans garde-fou ni seuil) | Plus proche que le départ dans 76 % des cas ; à 10 mm dans 44 % ; à plus de 50 mm dans 34 % (64 % en 2:1, 7 % en projet 1). Hors échantillon (2:6, 2:7) : **78 % à 10 mm, 6 % à plus de 50 mm**. |
| **Garde-fous les plus coûteux** | (1) Le **couloir de 45 mm depuis la pose de départ** appliqué aux différés : 665 poses empêchées ; sur 80 jugées, 52 justes et 4 mauvaises. (2) La **règle « jamais les différés »** (V1) : 238 poses empêchées ; sur 54 jugées, 43 justes et 1 mauvaise. (3) La **garde de paire du lot (D-044)** : 211 différés créés ; sur 36 jugés, 19 justes et **0 mauvaise**. |
| **Les gardes qui protègent** | Le contrat d'écartement du moteur : éteint, il donne 13 poses à plus de 50 mm sur 14. Le seuil τ : il retire 66 poses à plus de 50 mm contre 15 justes. L'écartement de la paire de la GCV2. |
| **−90 % est-il atteignable ?** | **−74 % sans risque notable, −90 % avec un risque concentré sur 2:1.** Première étape : la GCV2 sur les différés, sans le couloir de 45 mm mais avec τ, δ et l'écartement, complétée par trois gardes du lot levées et la vue déplacée. Elle évite **74,1 %** de la base ; sur 164 jugés, 74 % sont à 10 mm et **3 % à plus de 50 mm**. Pour aller à **89,9 %**, on valide aussi la meilleure paire sous τ et on l'inscrit aux verts à contrôler. Les poses à plus de 50 mm montent alors à 20 % des jugés, mais 49 sur 51 sont en **2:1** ; hors 2:1, elles restent à **1,3 %**. |

## 1. Méthode et définitions

- **Lecture seule.** Aucun réglage n'est changé, aucun comportement de terrain non plus : tout est rejoué hors ligne sur les exports archivés dans banane-data. Les archives sont extraites une à une dans le dossier de travail, lues, puis effacées.
- **Lot** : une exécution d'Orbite (un identifiant de lot) sur une partie. Un journal exporté peut contenir plusieurs lots, et le même lot peut se trouver dans plusieurs exports : on garde la copie qui a le plus de décisions.
- **Cuts traités** : les cuts distincts que le lot a décidés avant la relecture qui le suit. **Posé** : la dernière décision du lot sur le cut est suivie d'une validation du lot. **Différé** : traité et non posé.
- **Base** : tous les lots, sauf deux sortes. Les **remplacés** : lots dont tous les cuts sont repris par un lot suivant ; il n'y en a qu'un, le premier lot de 2:17, arrêté puis relancé. Les **fragments** : lots de moins de 5 cuts ou restes de journaux tronqués (1:14, 2:8 bis, 2:21).
- **Reprise** : lot déclaré « Reprise », ou lot dont la moitié au moins des cuts étaient des différés d'un lot précédent de la même partie.
- **Motif** : lu dans la décision du lot (étage, raison, commande) et dans la science du moteur consignée avec elle (statut et motif de chaque rail, garde d'écartement de paire). Il dit **l'étage qui a refusé** :
  - le moteur : rails non résolus, sans appui pour reprendre ;
  - la chaîne du lot : une garde, ou la reprise et le choix ;
  - la commande : cible hors de la vue ;
  - la validation ;
  - une règle métier.
- **Zone** : celle du moteur de zones du dépôt (`src/regles-metier.js`) **à l'instant de la décision**, rejoué sur les captures du lot dans l'ordre du lot :
  - PN avec ses marges, puis ADV avec ses marges ;
  - sinon « abords » : un différé et ses voisins sont des abords par définition ;
  - la zone « hors » ne peut donc pas contenir un différé.

  La zone connue en fin de lot est donnée à côté.
- **Rejeu causal** (`tools/gcv2-predire-differes.cjs`, réutilisé) : à l'instant de la décision et avec cela seulement. Il prend :
  - les voisins validés par le lot avant cet instant ;
  - la chaîne d'appuis du lot ;
  - la médiane d'écartement des poses validées avant ;
  - les hypothèses H0 à H6 de `tools/gcv2-jeu.cjs` (famille « lot », aucun appui humain) ;
  - la voie de référence de la série et ses preuves.

  Aucune pose de l'opérateur n'entre dans le calcul.
- **GCV2** : paramètres figés de `datasets/gcv2-parametres-h6.json` (usage « lot », appris avec H6), rien n'est réentraîné. Ces paramètres ont été appris sur 11 parties (1:12 à 1:17, 1:24, 1:29, 2:1, 2:10, 2:11). Sur ces parties, le choix de la GCV2 est donc **dans l'échantillon**. 2:6, 2:7 et 2:13 sont hors échantillon.
- **Contrefactuels du lot** : la décision du lot est rejouée sur la même capture, avec la même science et les mêmes appuis (`L.decideCut` et ses options), **une garde éteinte à la fois**, puis toutes ensemble.
- **L'opérateur** : sa pose finale dans l'Écho, lue comme dans `gcv2-predire-differes comparer` (dernière validation, ou « visité sans action »). Le différé est **jugé** seulement si trois conditions sont réunies :
  - la pose de départ de l'Écho est celle du lot (écartement à 2 mm près) ;
  - le cut a un nuage ;
  - aucun lot ne l'a posé ensuite (reprise).

  Écart entre deux poses : le pire des deux rails, en 3D.
- **Ce que le différé coûte** : l'écart de la pose de départ à la pose de l'opérateur. **Rappel atteignable à X mm** : chaque rail a une hypothèse à X mm au plus de l'opérateur (choix par un oracle). **Meilleure hypothèse de la GCV2** : la paire la plus probable selon la GCV2, sans garde-fou ni seuil (ce que poserait « poser la meilleure hypothèse »). **Perdu d'avance** : même l'oracle est à plus de 50 mm.

**Parties jugées.** Seuls les Échos de la **même séance** que le lot servent au jugement : 1:17, 1:24, 1:29, 2:1, 2:6, 2:7, 2:11 et 2:13. 2:10 n'a aucun différé.
- **Non utilisables** (aucun différé jugé, départ jamais vérifié) :
  - 1:13 et 1:15 : leur Écho est une autre séance (partie d'un opérateur débutant corrigée par l'opérateur). Leurs cuts n'ont pas la même pose de départ que le lot (0 et 1 pose retrouvées).
  - 1:12, 1:14, 1:16 : pas de lot Orbite.
  - **Témoin 1:25** : son Écho du 29/09 porte sur un autre état d'ESV (81 cuts) ; il ne contient qu'un des différés du lot du 15/10, sans pose. Il est lu et marqué, mais il ne juge rien.
  - **Témoin 1:11** : aucun lot Orbite 4.9.
  - 1:24 : l'opérateur n'a revisité que 40 des 106 différés.
- **Au total : 282 différés jugés** (1:17 36, 1:24 40, 1:29 35, 2:1 127, 2:6 11, 2:7 21, 2:11 12). 2:13 n'en apporte aucun : 1 seul différé y a une pose de l'opérateur, et sa pose de départ n'est pas celle du lot.
- **Hors échantillon.** Les paramètres de la GCV2 ont été appris sur 1:17, 1:24, 1:29, 2:1 et 2:11. Les chiffres du **choix** de la GCV2 y sont donc dans l'échantillon. Seuls **2:6 et 2:7** (32 différés jugés) sont hors échantillon. Le rappel atteignable, lui, ne dépend d'aucun apprentissage.

**Fidélité du rejeu.** 1 300 des 1 322 différés calculés retrouvent le même étage que le lot (98,3 %). Les 22 autres sont signalés : le rejeu ne connaît pas les voisins de la liste d'ESV (B1) ni l'ordre exact des appuis. 8 différés n'ont pas de nuage. Aucune erreur de calcul.

## 2. Inventaire des lots (étape 1)

### Lots (44)

| Partie | Version | Début (UTC) | Lot | Rôle | Clic | Relecture | Règle | Invalides au départ | Traités | Posés | Différés | Taux |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| 1:7 | 4.9.0.2 | 2026-10-07 07:33 | d7a70bfb | premier | standard | — | — | — | 156 | 121 | 35 | 22,4 % |
| 1:8 | 4.9.0.2 | 2026-10-07 08:03 | 2ac21e81 | premier | standard | — | — | — | 53 | 36 | 17 | 32,1 % |
| 1:9 | 4.9.0.2 | 2026-10-07 08:19 | 8571894e | premier | standard | — | — | — | 29 | 29 | 0 | 0 % |
| 1:10 | 4.9.0.2 | 2026-10-07 08:29 | 906ae6cb | premier | standard | — | — | — | 28 | 26 | 2 | 7,1 % |
| 1:3 | 4.9.0.3 | 2026-10-12 11:52 | a7a4869f | premier | standard | — | — | — | 192 | 174 | 18 | 9,4 % |
| 1:3 | 4.9.0.3 | 2026-10-12 12:29 | c714cd0e | reprise | standard | — | — | — | 18 | 9 | 9 | 50 % |
| 1:5 | 4.9.0.4 | 2026-10-12 17:29 | 61f64c44 | premier | standard | — | — | — | 301 | 253 | 48 | 15,9 % |
| 1:5 | 4.9.0.4 | 2026-10-12 18:35 | a37b41c3 | reprise | standard | — | — | — | 48 | 11 | 37 | 77,1 % |
| 1:7 | 4.9.0.8 | 2026-10-13 06:50 | c0fcbde6 | premier | standard | — | — | — | 112 | 95 | 17 | 15,2 % |
| 1:8 | 4.9.0.8 | 2026-10-13 07:36 | fea42296 | premier | standard | — | — | — | 217 | 178 | 39 | 18 % |
| 1:9 | 4.9.0.8 | 2026-10-13 08:08 | 7a4a8b4d | premier | standard | — | — | — | 160 | 139 | 21 | 13,1 % |
| 1:10 | 4.9.0.8 | 2026-10-13 08:46 | 42181659 | premier | standard | — | — | — | 187 | 148 | 39 | 20,9 % |
| 1:10 | 4.9.0.8 | 2026-10-13 09:28 | 2bafdf25 | reprise | standard | — | — | — | 38 | 15 | 23 | 60,5 % |
| 1:13 | 4.9.0.9 | 2026-10-13 11:51 | 2536b3ae | premier | standard | — | — | — | 138 | 119 | 19 | 13,8 % |
| 1:13 | 4.9.0.9 | 2026-10-13 12:03 | fd27a74c | reprise | standard | — | — | — | 19 | 6 | 13 | 68,4 % |
| 1:14 | 4.9.0.9 | 2026-10-13 13:30 | 5f051f89 | fragment | standard | — | — | — | 1 | 0 | 1 | 100 % |
| 1:15 | 4.9.0.9 | 2026-10-13 14:04 | 733d2df4 | premier | standard | — | — | — | 138 | 125 | 13 | 9,4 % |
| 1:17 | 4.9.0.12 | 2026-10-14 06:27 | 0067c40a | premier | standard | — | — | 267 | 268 | 232 | 36 | 13,4 % |
| 1:18 | 4.9.0.12 | 2026-10-14 07:02 | 4d0dc2e8 | premier | standard | — | — | 422 | 421 | 385 | 36 | 8,6 % |
| 1:23 | 4.9.0.13 | 2026-10-14 12:02 | 17f523f1 | premier | standard | — | — | 661 | 621 | 471 | 150 | 24,2 % |
| 1:24 | 4.9.0.15 | 2026-10-15 06:54 | a983cf09 | premier | standard | — | — | 514 | 515 | 409 | 106 | 20,6 % |
| 1:26 | 4.9.0.16 | 2026-10-15 08:35 | 3b2324ae | premier | standard | — | — | 370 | 370 | 311 | 59 | 15,9 % |
| 1:25 | 4.9.0.16 | 2026-10-15 09:03 | 1f2b5184 | premier | standard | — | — | 485 | 454 | 381 | 73 | 16,1 % |
| 1:27 | 4.9.0.17 | 2026-10-15 10:00 | c39db398 | premier | standard | — | — | 523 | 358 | 289 | 69 | 19,3 % |
| 1:27 | 4.9.0.17 | 2026-10-15 10:35 | 19fac227 | premier | standard | — | — | — | 235 | 129 | 106 | 45,1 % |
| 1:28 | 4.9.0.20 | 2026-10-15 15:26 | 7ea118aa | premier | standard | — | — | — | 188 | 151 | 37 | 19,7 % |
| 1:29 | 4.9.5.3 | 2026-10-16 06:18 | 44eec69a | premier | standard | — | — | 244 | 245 | 210 | 35 | 14,3 % |
| 2:1 | 4.9.5.3 | 2026-10-16 08:52 | c20f7ede | premier | standard | — | — | 351 | 351 | 224 | 127 | 36,2 % |
| 2:2 | 4.9.5.3 | 2026-10-16 11:20 | 1a809ccf | premier | standard | — | — | 88 | 89 | 61 | 28 | 31,5 % |
| 2:3 | 4.9.5.3 | 2026-10-16 11:34 | d2bd2292 | premier | standard | — | — | 38 | 38 | 37 | 1 | 2,6 % |
| 2:4 | 4.9.5.3 | 2026-10-16 13:27 | 264300fb | premier | standard | — | — | 55 | 55 | 48 | 7 | 12,7 % |
| 2:6 | 4.9.5.3 | 2026-10-16 13:36 | 9f97a998 | premier | standard | — | — | 83 | 83 | 72 | 11 | 13,3 % |
| 2:7 | 4.9.5.3 | 2026-10-16 13:42 | 00e47936 | premier | standard | — | — | 151 | 151 | 130 | 21 | 13,9 % |
| 2:8 | 4.9.5.6 | 2026-10-17 07:57 | a12fef63 | premier | gauche-recentre | — | grappe active | 31 | 31 | 29 | 2 | 6,5 % |
| 2:8 | 4.9.5.6 | 2026-10-17 08:01 | 41d35cb0 | fragment | gauche-recentre | — | grappe active | 31 | 1 | 1 | 0 | 0 % |
| 2:9 | 4.9.5.6 | 2026-10-17 08:04 | 76575d74 | premier | tout-recentre | — | grappe active | 41 | 42 | 29 | 13 | 31 % |
| 2:9 | 4.9.5.6 | 2026-10-17 08:14 | 957bf699 | reprise | tout-recentre | — | grappe active | 41 | 14 | 7 | 7 | 50 % |
| 2:10 | 4.9.5.7 | 2026-10-18 07:37 | 91b36b65 | premier | tout-recentre | corriger | — | 9 | 9 | 9 | 0 | 0 % |
| 2:11 | 4.9.5.7 | 2026-10-18 07:39 | c224afa5 | premier | tout-recentre | corriger | — | 131 | 131 | 119 | 12 | 9,2 % |
| 2:13 | 4.9.5.8 | 2026-10-19 10:40 | c8d56eab | premier | gauche-recentre | corriger | — | 21 | 22 | 19 | 3 | 13,6 % |
| 2:21 | 4.9.5.8 | 2026-10-19 11:48 | 7e0bfdf8 | fragment | gauche-recentre | corriger | — | 32 | 1 | 0 | 1 | 100 % |
| 2:18 | 4.9.5.8 | 2026-10-19 11:52 | eb1d9bc2 | premier | gauche-recentre | corriger | — | 214 | 214 | 177 | 37 | 17,3 % |
| 2:17 (projet non confirmé) | 4.9.5.9 | 2026-10-19 12:57 | 990020c6 | remplacé | standard | corriger | — | 139 | 8 | 0 | 8 | 100 % |
| 2:17 (projet non confirmé) | 4.9.5.9 | 2026-10-19 12:59 | bfb15534 | premier | tout-recentre | corriger | — | — | 139 | 98 | 41 | 29,5 % |

### Base des taux de différés

| Groupe | Lots | Traités | Posés | Différés | Taux moyen (non pondéré) | Taux médian | Taux pondéré | Différés par lot |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| Base : tous les lots (hors remplacés et fragments) | 40 | 6878 | 5511 | 1367 | 22,4 % | 16 % | 19,9 % | 34,2 |
| Premiers lots d'une partie | 35 | 6741 | 5463 | 1278 | 16,9 % | 15,2 % | 19 % | 36,5 |
| Lots de reprise | 5 | 137 | 48 | 89 | 61,2 % | 60,5 % | 65 % | 17,8 |
| projet 1 | 26 | 5509 | 4452 | 1057 | 24,2 % | 17 % | 19,2 % | 40,7 |
| projet 2 | 14 | 1369 | 1059 | 310 | 19,1 % | 13,8 % | 22,6 % | 22,1 |
| 4.9.0.x | 25 | 5264 | 4242 | 1022 | 24,6 % | 18 % | 19,4 % | 40,9 |
| 4.9.5.x | 15 | 1614 | 1269 | 345 | 18,8 % | 13,9 % | 21,4 % | 23 |
| projet 1, 4.9.0.x | 25 | 5264 | 4242 | 1022 | 24,6 % | 18 % | 19,4 % | 40,9 |
| projet 1, 4.9.5.x | 1 | 245 | 210 | 35 | 14,3 % | 14,3 % | 14,3 % | 35 |
| projet 2, 4.9.5.x | 14 | 1369 | 1059 | 310 | 19,1 % | 13,8 % | 22,6 % | 22,1 |
| version 4.9.0.12 | 2 | 689 | 617 | 72 | 11 % | 11 % | 10,4 % | 36 |
| version 4.9.0.13 | 1 | 621 | 471 | 150 | 24,2 % | 24,2 % | 24,2 % | 150 |
| version 4.9.0.15 | 1 | 515 | 409 | 106 | 20,6 % | 20,6 % | 20,6 % | 106 |
| version 4.9.0.16 | 2 | 824 | 692 | 132 | 16 % | 16 % | 16 % | 66 |
| version 4.9.0.17 | 2 | 593 | 418 | 175 | 32,2 % | 32,2 % | 29,5 % | 87,5 |
| version 4.9.0.2 | 4 | 266 | 212 | 54 | 15,4 % | 14,8 % | 20,3 % | 13,5 |
| version 4.9.0.20 | 1 | 188 | 151 | 37 | 19,7 % | 19,7 % | 19,7 % | 37 |
| version 4.9.0.3 | 2 | 210 | 183 | 27 | 29,7 % | 29,7 % | 12,9 % | 13,5 |
| version 4.9.0.4 | 2 | 349 | 264 | 85 | 46,5 % | 46,5 % | 24,4 % | 42,5 |
| version 4.9.0.8 | 5 | 714 | 575 | 139 | 25,5 % | 18 % | 19,5 % | 27,8 |
| version 4.9.0.9 | 3 | 295 | 250 | 45 | 30,5 % | 13,8 % | 15,3 % | 15 |
| version 4.9.5.3 | 7 | 1012 | 782 | 230 | 17,8 % | 13,9 % | 22,7 % | 32,9 |
| version 4.9.5.6 | 3 | 87 | 65 | 22 | 29,1 % | 31 % | 25,3 % | 7,3 |
| version 4.9.5.7 | 2 | 140 | 128 | 12 | 4,6 % | 4,6 % | 8,6 % | 6 |
| version 4.9.5.8 | 2 | 236 | 196 | 40 | 15,5 % | 15,5 % | 16,9 % | 20 |
| version 4.9.5.9 | 1 | 139 | 98 | 41 | 29,5 % | 29,5 % | 29,5 % | 41 |

Net par partie (après reprises) : 1162 différés sur 6666 cuts traités, 17,4 % (moyenne des parties 15,2 %).

- **Lots exclus de la base** :
  - 2:17 (990020c6) est remplacé : arrêté après 8 cuts, puis relancé.
  - 1:14, 2:8 bis et 2:21 sont des fragments de 1 cut chacun.
  - Le lot de 1:1 du 13/10 manque dans les journaux exportés : le journal « p1 et p13 » ne contient que la partie 13.
- **Reprises** : 5 lots, à 61 % de différés en moyenne. Ce sont les différés qui résistent une seconde fois.
- **1:27 19fac227** est une suite (le premier lot s'était arrêté au cut 535), pas une reprise.
- **Clic et réglages** : les lots 4.9.0.x et 4.9.5.3 sont des lots standard. Le clic « Tout recentré » ou « Variante : rail gauche recentré » apparaît en 4.9.5.6. La règle « grappe de différés » n'est active qu'en 2:8 et 2:9 (6 différés). La relecture « corriger » existe depuis 4.9.5.7.

## 3. Motifs des différés (étape 2)

#### Base complète (inventaire, 1367 différés)

| Motif | Différés | Projet 1 | Projet 2 | Part |
|---|--:|--:|--:|--:|
| sans-appui | 879 | 658 | 221 | 64,3 % |
| reprise-sans-minimum | 221 | 165 | 56 | 16,2 % |
| garde-de-paire | 214 | 212 | 2 | 15,7 % |
| hors-vue | 21 | 0 | 21 | 1,5 % |
| reprise-plusieurs-minima | 12 | 12 | 0 | 0,9 % |
| regle-grappe | 6 | 0 | 6 | 0,4 % |
| reprise-repere | 4 | 4 | 0 | 0,3 % |
| choix-hors-contrat | 3 | 2 | 1 | 0,2 % |
| ecartement-voisin | 3 | 1 | 2 | 0,2 % |
| pose-non-validee | 3 | 2 | 1 | 0,2 % |
| ecartement-bas | 1 | 1 | 0 | 0,1 % |

B1 en ombre (voisins validés de la liste d'ESV comme appuis) : consigné pour 933 différés, calculé pour 932, il en aurait posé 435 (sans-appui 346, reprise-sans-minimum 75, reprise-plusieurs-minima 4, reprise-repere 3, choix-hors-contrat 2, ecartement-voisin 2, regle-grappe 2, pose-non-validee 1).
Étage : moteur 879, chaine 458, commande 21, regle-metier 6, validation 3. « Sans appui » selon le moteur : 1 rail(s) résolu(s) 648, paire hors contrat 159, 0 rail(s) résolu(s) 72.

#### Différés calculés (1330 : 1322 avec nuage, 8 sans nuage, 0 erreurs ; rejeu au même étage que le lot : 1300/1322)

| Motif | Différés | PN | ADV | Abords | Sans nuage |
|---|--:|--:|--:|--:|--:|
| sans-appui | 861 | 8 | 232 | 621 | 8 |
| garde-de-paire | 214 | 17 | 9 | 188 | 0 |
| reprise-sans-minimum | 209 | 6 | 84 | 119 | 0 |
| hors-vue | 15 | 2 | 13 | 0 | 0 |
| reprise-plusieurs-minima | 12 | 0 | 0 | 12 | 0 |
| regle-grappe | 6 | 0 | 6 | 0 | 0 |
| reprise-repere | 4 | 1 | 0 | 3 | 0 |
| choix-hors-contrat | 3 | 1 | 1 | 1 | 0 |
| pose-non-validee | 3 | 0 | 0 | 3 | 0 |
| ecartement-voisin | 2 | 0 | 1 | 1 | 0 |
| ecartement-bas | 1 | 0 | 0 | 1 | 0 |

##### projet 1 (1057)

| Motif | Différés | PN | ADV | Abords |
|---|--:|--:|--:|--:|
| sans-appui | 658 | 3 | 82 | 573 |
| garde-de-paire | 212 | 17 | 8 | 187 |
| reprise-sans-minimum | 165 | 4 | 49 | 112 |
| reprise-plusieurs-minima | 12 | 0 | 0 | 12 |
| reprise-repere | 4 | 1 | 0 | 3 |
| choix-hors-contrat | 2 | 1 | 1 | 0 |
| pose-non-validee | 2 | 0 | 0 | 2 |
| ecartement-bas | 1 | 0 | 0 | 1 |
| ecartement-voisin | 1 | 0 | 0 | 1 |

##### projet 2 (273)

| Motif | Différés | PN | ADV | Abords |
|---|--:|--:|--:|--:|
| sans-appui | 203 | 5 | 150 | 48 |
| reprise-sans-minimum | 44 | 2 | 35 | 7 |
| hors-vue | 15 | 2 | 13 | 0 |
| regle-grappe | 6 | 0 | 6 | 0 |
| garde-de-paire | 2 | 0 | 1 | 1 |
| choix-hors-contrat | 1 | 0 | 0 | 1 |
| ecartement-voisin | 1 | 0 | 1 | 0 |
| pose-non-validee | 1 | 0 | 0 | 1 |

Zone à l'instant de la décision : abords 949, adv 346, pn 35 ; zone connue en fin de lot : abords 983, adv 299, pn 48.
Moteur : rails résolus 0 → 280, 1 → 793, 2 → 257 ; paire hors contrat 198 ; motifs des rails candidate 1307, flank 461, gauge-out-of-contract 396, ambiguity 177, slope 158, minTop 87, ? 51, rsf 17, window 6.
Pose de départ : 1047 à l'écartement par défaut d'ESV (1 500 mm), 275 autres (médiane 1424,9 mm).
Voie de série : existe pour 544, sûre pour 234, absente pour 778 ; écart latéral du départ à la voie : médiane 74,1 mm, 381 au-delà de 45 mm, 142 au-delà de 100 mm ; motifs sans-support-local 229, appuis-contradictoires 124, appui-trop-loin 67, voie-concurrente-au-depart 58, rupture-de-serie 5.
Hypothèses présentes (au moins un rail) : H1 1306, H2 1307, H3 389, H4 485, H5 861, H6 768, aucuneHorsH0 18, medianeParRail 14.
Contexte : 554 sans aucun cut validé à 10 cuts au plus, 15 sans appui de chaîne.
Relecture après le lot : 5 lots relus (93 différés) ; différés visités par la relecture : 86, corrigés : 0.

**Lecture.**
- **« Sans appui » est le premier gisement : 879 des 1 367 différés.** C'est d'abord un **défaut du moteur** :
  - le plus souvent, un seul rail est résolu (l'autre est refusé : flanc, pente, points du dessus) ;
  - ou bien la paire est hors du contrat d'écartement, presque toujours parce que la pose de départ est à 1 500 mm.
- C'est aussi un **défaut de la chaîne** : il faut un cut posé à 3 cuts au plus pour reprendre depuis la voie. 554 différés n'ont aucun cut validé par le lot à 10 cuts au plus : ce sont des grappes d'invalides.
- **La pose de départ par défaut d'ESV (1 500 mm) est la cause racine commune.** On la trouve sous 79 % des différés, sous 88 % des « sans appui à un rail » et sous 76 % des « garde de paire ».
- **Voie de série** : elle existe pour 544 différés et n'est sûre que pour 234. L'écart latéral médian entre la pose de départ et la voie est de 74 mm : 381 différés sont au-delà de 45 mm, 142 au-delà de 100 mm.
- **H6** est présente pour 768 différés, **H5** (rail complété par l'écartement médian) pour 861.
- **B1** (voisins validés de la liste d'ESV pris comme appuis, en ombre dans le journal) a été consigné pour 933 différés. Il en aurait **posé 435** (choix 300, reprise 123, premier passage 12). Ces poses ne sont pas consignées : on ne peut pas les juger.
- **La relecture après le lot ne touche jamais un différé.** Elle en visite 86 sur 93 et n'en corrige aucun : elle les refuse par la règle « commande » (le lot ne les pose pas) ou « rôle ». Elle n'agit que sur les verts.

## 4. Ce que chaque différé aurait pu recevoir (étape 3)

Différés avec une pose de l'opérateur : 284 ; jugés (pose de départ vérifiée, cut calculé) : 282 ; non jugés : sansNuage 0, poseParUnAutreLot 0, departDifferent 2, sansReferenceMic 112.

| Groupe | Jugés | Départ (médiane, mm) | Rappel 10 mm | Rappel 20 mm | Rappel 50 mm | Meilleure hyp. améliore le départ | Toutes > 50 mm | GCV2 seule améliore | GCV2 seule ≤ 10 mm | GCV2 seule > 50 mm | Gain médian GCV2 (mm) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| **Échos de la même séance** | 282 | 85,8 | 62,1 % | 70,6 % | 78,7 % | 94,3 % | 21,3 % | 76,2 % | 44 % | 33,7 % | 39,3 |
| motif sans-appui | 180 | 120,2 | 49,4 % | 58,3 % | 70 % | 93,9 % | 30 % | 71,1 % | 33,3 % | 44,4 % | 37 |
| motif reprise-sans-minimum | 48 | 52,8 | 72,9 % | 85,4 % | 89,6 % | 91,7 % | 10,4 % | 72,9 % | 64,6 % | 22,9 % | 30,4 |
| motif garde-de-paire | 36 | 70,8 | 94,4 % | 100 % | 100 % | 100 % | 0 % | 97,2 % | 72,2 % | 0 % | 64,5 |
| motif hors-vue | 11 | 205,3 | 100 % | 100 % | 100 % | 100 % | 0 % | 100 % | 36,4 % | 18,2 % | 186,9 |
| motif reprise-repere | 3 | 6,7 | 66,7 % | 66,7 % | 66,7 % | 66,7 % | 33,3 % | 66,7 % | 33,3 % | 66,7 % | 1,5 |
| motif reprise-plusieurs-minima | 2 | 34 | 100 % | 100 % | 100 % | 100 % | 0 % | 100 % | 50 % | 0 % | 20 |
| motif choix-hors-contrat | 1 | 71,8 | 100 % | 100 % | 100 % | 100 % | 0 % | 100 % | 100 % | 0 % | 68,8 |
| motif ecartement-voisin | 1 | 73,2 | 100 % | 100 % | 100 % | 100 % | 0 % | 100 % | 0 % | 0 % | 52,3 |
| zone adv | 162 | 161,8 | 47,5 % | 56,2 % | 66 % | 93,2 % | 34 % | 67,3 % | 30,2 % | 52,5 % | 36,6 |
| zone abords | 111 | 51,4 | 84,7 % | 92,8 % | 97,3 % | 95,5 % | 2,7 % | 89,2 % | 65,8 % | 5,4 % | 40,7 |
| zone pn | 9 | 191,1 | 44,4 % | 55,6 % | 77,8 % | 100 % | 22,2 % | 77,8 % | 22,2 % | 44,4 % | 42,2 |
| projet 2 | 171 | 168,9 | 48,5 % | 56,1 % | 66,7 % | 94,2 % | 33,3 % | 68,4 % | 28,7 % | 50,9 % | 37,7 |
| projet 1 | 111 | 51,4 | 82,9 % | 92,8 % | 97,3 % | 94,6 % | 2,7 % | 88,3 % | 67,6 % | 7,2 % | 40,9 |
| partie 2:1 | 127 | 191,1 | 33,1 % | 41,7 % | 55,1 % | 92,1 % | 44,9 % | 62,2 % | 15 % | 63,8 % | 36,8 |
| partie 1:24 | 40 | 79,4 | 80 % | 92,5 % | 97,5 % | 95 % | 2,5 % | 92,5 % | 55 % | 2,5 % | 63,6 |
| partie 1:17 | 36 | 69,4 | 77,8 % | 88,9 % | 94,4 % | 94,4 % | 5,6 % | 83,3 % | 72,2 % | 11,1 % | 59,2 |
| partie 1:29 | 35 | 40,6 | 91,4 % | 97,1 % | 100 % | 94,3 % | 0 % | 88,6 % | 77,1 % | 8,6 % | 34 |
| partie 2:7 | 21 | 59,6 | 100 % | 100 % | 100 % | 100 % | 0 % | 100 % | 90,5 % | 0 % | 52,2 |
| partie 2:11 | 12 | 53,5 | 100 % | 100 % | 100 % | 100 % | 0 % | 66,7 % | 41,7 % | 33,3 % | 9,8 |
| partie 2:6 | 11 | 48,4 | 72,7 % | 90,9 % | 100 % | 100 % | 0 % | 81,8 % | 54,5 % | 18,2 % | 35,9 |
| GCV2 hors échantillon (2:6, 2:7, 2:13) | 32 | 52 | 90,6 % | 96,9 % | 100 % | 100 % | 0 % | 93,8 % | 78,1 % | 6,3 % | 44,3 |
| GCV2 dans l'échantillon | 250 | 105,3 | 58,4 % | 67,2 % | 76 % | 93,6 % | 24 % | 74 % | 39,6 % | 37,2 % | 37,4 |
| Échos d'une autre séance (1:13, 1:15) | 0 | — | — | — | — | — | — | — | — | — | — |
| Témoin 1:25 | 0 | — | — | — | — | — | — | — | — | — | — |

Origine de l'hypothèse la plus proche de l'opérateur (par rail) : H2 217, H1+H2 133, H6 68, H1 40, H0 31, H3 24, H5 21, H4 9, H3+H4 7, H2+H6 3, H1+H2+H4 2, H1+H2+H6 2. H6 présente pour 163 des 282 différés jugés.
V1+ telle que déclarée agit sur 38 des 282 différés jugés (28 à 10 mm, 0 à plus de 50 mm).

**Lecture.**
- **Hors 2:1, le gisement est presque entièrement atteignable** :
  - projet 1 : rappel à 10 mm de 83 %, à 50 mm de 97 % ;
  - 2:6, 2:7, 2:11 : de 73 à 100 % à 10 mm ;
  - 95 % des différés ont une hypothèse plus proche de l'opérateur que le départ.
- **2:1 est un cas à part** : la voie entière est décalée de 130 à 250 mm (D-206), et le départ médian est à 191 mm de l'opérateur. 45 % de ses différés sont perdus d'avance : aucune hypothèse n'est à 50 mm.
- **D'où vient l'hypothèse la plus proche** : H2 (cellules du réservoir) et H1 (A*), puis H6 (68 rails), H3, H5, H4.
- **V1+ telle que déclarée** n'agit que sur 38 des 282 jugés (28 à 10 mm, 0 à plus de 50 mm). C'est sûr, mais cela ne réduit presque rien.

## 5. Coût de chaque garde-fou (étape 4)

Lot (chaîne de décision rejouée, une garde éteinte à la fois ; « premier » : garde qui a refusé dans le journal ; « seul » : l'éteindre seule suffit à poser) :

| Garde | Premier | Seul | Seul et premier | Jugés | ≤ 10 mm | ≤ 20 mm | > 50 mm | Améliore le départ | Gain médian (mm) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| contrat d'écartement du moteur (1 420–1 470 mm, paire hors contrat) | 195 | 38 | 38 | 14 | 0 | 0 | 13 | 4 | -34 |
| appuis à 3 cuts au plus (« sans appui » : pas de reprise depuis la voie) | 702 | 72 | 26 | 13 | 11 | 13 | 0 | 13 | 41,2 |
| garde de paire (rail repêché par S1 et calage hors domaine, D-044) | 214 | 211 | 211 | 36 | 19 | 34 | 0 | 34 | 64,4 |
| garde de continuité (30 mm de la voie) | 0 | 14 | 0 | 6 | 3 | 3 | 3 | 4 | 22,4 |
| garde d'écartement voisin (20 mm) | 2 | 7 | 1 | 2 | 2 | 2 | 0 | 2 | 68,5 |
| garde d'écartement bas (1 420 mm, D-060) | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| seuil de points du minimum choisi (paire sous le seuil : 5 dessus, 3 flanc) | 166 | 46 | 37 | 14 | 5 | 8 | 3 | 10 | 31,4 |
| fenêtre du choix (15 mm en travers, 20 mm en hauteur, minimum unique) | 12 | 62 | 0 | 9 | 4 | 7 | 1 | 6 | 21,6 |
| voie encadrée (appuis des deux côtés) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |
| lecture de l'ornière au PN (dernier recours) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |

Différés que la décision rejouée pose déjà (la commande ou la validation a manqué, ou le rejeu diffère du lot) : 41 (hors-vue 14, reprise-sans-minimum 13, regle-grappe 6, reprise-plusieurs-minima 5, pose-non-validee 3).
Toutes les gardes du lot éteintes ensemble : 581 poses de plus ; jugées 138, 49 à 10 mm, 68 à plus de 50 mm.

Commande et validation (la pose existait) :

| Garde | Différés | Avec pose rejouée | Jugés | ≤ 10 mm | ≤ 20 mm | > 50 mm | Améliore le départ | Gain médian (mm) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| cible hors de la vue d'ESV (commande) | 15 | 14 | 11 | 11 | 11 | 0 | 11 | 199,9 |
| règle métier « grappe de différés » | 6 | 6 | 0 | 0 | 0 | 0 | 0 | — |
| pose commandée, validation non constatée | 3 | 3 | 0 | 0 | 0 | 0 | 0 | — |
| commande non relue (autre) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — |

GCV2 sur les différés (« seul » : levé seul depuis la variante stricte ; « refuse » : ce qu'il retire quand tout le reste est ouvert) :

| Garde-fou | Seul | Jugés | ≤ 10 mm | ≤ 20 mm | > 50 mm | Améliore le départ | Gain médian (mm) | Refuse (tout ouvert) | dont ≤ 10 mm | dont > 50 mm |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| règle « jamais les différés » (V1) : les différés traités comme les verts (45 mm depuis le départ) | 238 | 54 | 43 | 49 | 1 | 47 | 30,6 | 0 | — | — |
| preuve de voie de série (H6 : appuis, accord, proximité, support, concurrente, rupture) | 158 | 29 | 13 | 20 | 3 | 25 | 70,5 | 0 | — | — |
| support local des deux rails (preuve de voie) | 67 | 11 | 3 | 7 | 1 | 9 | 36,8 | 0 | — | — |
| 45 mm en travers depuis la pose de départ (couloir des verts) | 665 | 80 | 52 | 70 | 4 | 76 | 69,9 | 254 | 12 | 33 |
| τ (seuil de probabilité par zone) | 217 | 58 | 3 | 5 | 24 | 46 | 26,6 | 277 | 15 | 66 |
| δ (déplacement minimal par zone) | 9 | 3 | 1 | 1 | 2 | 0 | 0 | 18 | 1 | 7 |
| écartement de la paire (médiane ± 15 mm ou contrat) | 18 | 6 | 0 | 0 | 5 | 2 | -7,1 | 67 | 0 | 22 |

Classement par poses justes évitées (≤ 10 mm de l'opérateur), puis par rapport « justes évitées / mauvaises (> 50 mm) évitées » :

| Rang | Étage | Garde | Justes évitées | Mauvaises évitées | Différés concernés |
|---|--:|--:|--:|--:|--:|
| 1 | GCV2 | 45 mm en travers depuis la pose de départ (couloir des verts) | 52 | 4 | 665 |
| 2 | GCV2 | règle « jamais les différés » (V1) : les différés traités comme les verts (45 mm depuis le départ) | 43 | 1 | 238 |
| 3 | lot | garde de paire (rail repêché par S1 et calage hors domaine, D-044) | 19 | 0 | 211 |
| 4 | GCV2 | preuve de voie de série (H6 : appuis, accord, proximité, support, concurrente, rupture) | 13 | 3 | 158 |
| 5 | lot | appuis à 3 cuts au plus (« sans appui » : pas de reprise depuis la voie) | 11 | 0 | 72 |
| 6 | commande | cible hors de la vue d'ESV (commande) | 11 | 0 | 15 |
| 7 | lot | seuil de points du minimum choisi (paire sous le seuil : 5 dessus, 3 flanc) | 5 | 3 | 46 |
| 8 | lot | fenêtre du choix (15 mm en travers, 20 mm en hauteur, minimum unique) | 4 | 1 | 62 |
| 9 | GCV2 | support local des deux rails (preuve de voie) | 3 | 1 | 67 |
| 10 | lot | garde de continuité (30 mm de la voie) | 3 | 3 | 14 |
| 11 | GCV2 | τ (seuil de probabilité par zone) | 3 | 24 | 217 |
| 12 | lot | garde d'écartement voisin (20 mm) | 2 | 0 | 7 |
| 13 | GCV2 | δ (déplacement minimal par zone) | 1 | 2 | 9 |
| 14 | lot | contrat d'écartement du moteur (1 420–1 470 mm, paire hors contrat) | 0 | 13 | 38 |
| 15 | lot | garde d'écartement bas (1 420 mm, D-060) | 0 | 0 | 0 |
| 16 | lot | voie encadrée (appuis des deux côtés) | 0 | 0 | 0 |
| 17 | lot | lecture de l'ornière au PN (dernier recours) | 0 | 0 | 0 |
| 18 | commande | règle métier « grappe de différés » | 0 | 0 | 6 |
| 19 | commande | pose commandée, validation non constatée | 0 | 0 | 3 |
| 20 | commande | commande non relue (autre) | 0 | 0 | 0 |
| 21 | GCV2 | écartement de la paire (médiane ± 15 mm ou contrat) | 0 | 5 | 18 |

Relecture après le lot (elle ne touche jamais un différé) : 2:10 (corriger, 12 relus, 0 des 0 différés visités, 0 corrigés) ; 2:11 (corriger, 144 relus, 5 des 12 différés visités, 0 corrigés ; refus : commande 3, role 2) ; 2:13 (corriger, 79 relus, 3 des 3 différés visités, 0 corrigés ; refus : role 1, commande 1, seuil 1) ; 2:18 (corriger, 321 relus, 37 des 37 différés visités, 0 corrigés ; refus : commande 23, role 14) ; 2:17 (corriger, 241 relus, 41 des 41 différés visités, 0 corrigés ; refus : commande 29, role 12).

**Lecture.**
- **Lot.** Les gardes du lot créent peu de différés à elles seules, sauf la **garde de paire** : 211 différés, tous « premiers » ; éteinte, 34 des 36 jugés sont à 20 mm et aucun à plus de 50 mm. Les gardes d'écartement bas, d'écartement voisin et de continuité sont presque toujours masquées par d'autres refus. La **voie encadrée** et l'**ornière** ne refusent rien : ce sont des aides.
- **« Sans appui à 3 cuts »** : élargir à 10 cuts reprend 72 différés (11 justes sur 13 jugés, 0 mauvais).
- **Contrat d'écartement du moteur** : à garder. Éteint, il donne 13 poses à plus de 50 mm sur 14 jugées, avec la pose de départ à 1 500 mm.
- **GCV2.** Le **couloir de 45 mm depuis le départ** a deux visages :
  - avec τ, il empêche 665 actions, dont 52 justes contre 4 mauvaises ;
  - quand tout le reste est ouvert, il retire 33 poses à plus de 50 mm contre 12 justes.

  Le **seuil τ** est le garde-fou qui protège le plus (66 mauvaises retirées contre 15 justes quand tout est ouvert). **δ** et l'**écartement** coûtent peu et protègent.
- **Preuve de voie de série (H6).** Elle bloque 158 actions (13 justes, 3 mauvaises sur 29 jugées). Le **support des deux rails** seul en bloque 67.
- **Classement.** Il compte les poses justes évitées, puis le rapport « justes / mauvaises évitées » ; il est en tête du tableau ci-dessus.
- **Relecture** : elle n'a aucun effet sur les différés (§ 3).

## 6. Pistes structurelles chiffrées (étape 5)

Base : 1367 différés ; calculés avec nuage : 1322.

| Piste | Poses | Différés évités (% de la base) | Jugés | ≤ 10 mm | ≤ 20 mm | > 50 mm | Améliore le départ | Pire que le départ | Gain médian (mm) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| (a) poser sans valider : meilleure hypothèse de la GCV2, sans garde-fou ni seuil, cut laissé invalide | 1296 | 0 % (94,8 % approchés) | 274 | 123 | 157 | 88 (32,1 %) | 215 | 44 | 40,4 |
| (b) valider et inscrire aux verts à contrôler : même pose, validée | 1296 | 94,8 % | 274 | 123 | 157 | 88 (32,1 %) | 215 | 44 | 40,4 |
| (b') idem, écartement de paire gardé | 1229 | 89,9 % | 250 | 128 | 164 | 53 (21,2 %) | 218 | 23 | 44,4 |
| (b'') idem, couloir de 45 mm depuis le départ et écartement gardés, sans τ ni δ | 545 | 39,9 % | 135 | 61 | 72 | 29 (21,5 %) | 113 | 13 | 29,2 |
| GCV2 V1+ telle que déclarée (voie de série sûre, τ, δ) | 210 | 15,4 % | 38 | 27 | 35 | 0 (0 %) | 38 | 0 | 51,9 |
| GCV2 V1+ sans preuve de voie (τ, δ gardés) | 368 | 26,9 % | 67 | 40 | 55 | 3 (4,5 %) | 63 | 4 | 58,5 |
| GCV2 aux règles des verts (45 mm, τ, δ, écartement) | 314 | 23 % | 72 | 57 | 66 | 1 (1,4 %) | 65 | 6 | 30,6 |
| GCV2 sans couloir de 45 mm, τ, δ et écartement gardés | 979 | 71,6 % | 152 | 110 | 135 | 5 (3,3 %) | 141 | 10 | 41,2 |
| (c) lot : contrat d'écartement du moteur (1 420–1 470 mm, paire hors contrat) éteinte seule | 38 | 2,8 % | 14 | 0 | 0 | 13 (92,9 %) | 4 | 10 | -34 |
| (c) lot : appuis à 3 cuts au plus (« sans appui » : pas de reprise depuis la voie) éteinte seule | 72 | 5,3 % | 13 | 11 | 13 | 0 (0 %) | 13 | 0 | 41,2 |
| (c) lot : garde de paire (rail repêché par S1 et calage hors domaine, D-044) éteinte seule | 211 | 15,4 % | 36 | 19 | 34 | 0 (0 %) | 34 | 2 | 64,4 |
| (c) lot : garde de continuité (30 mm de la voie) éteinte seule | 14 | 1 % | 6 | 3 | 3 | 3 (50 %) | 4 | 1 | 22,4 |
| (c) lot : garde d'écartement voisin (20 mm) éteinte seule | 7 | 0,5 % | 2 | 2 | 2 | 0 (0 %) | 2 | 0 | 68,5 |
| (c) lot : garde d'écartement bas (1 420 mm, D-060) éteinte seule | 0 | 0 % | 0 | 0 | 0 | 0 (—) | 0 | 0 | — |
| (c) lot : seuil de points du minimum choisi (paire sous le seuil : 5 dessus, 3 flanc) éteinte seule | 46 | 3,4 % | 14 | 5 | 8 | 3 (21,4 %) | 10 | 4 | 31,4 |
| (c) lot : fenêtre du choix (15 mm en travers, 20 mm en hauteur, minimum unique) éteinte seule | 62 | 4,5 % | 9 | 4 | 7 | 1 (11,1 %) | 6 | 3 | 21,6 |
| (c) lot : toutes les gardes du lot éteintes ensemble | 581 | 42,5 % | 138 | 49 | 67 | 68 (49,3 %) | 80 | 55 | 21 |
| (c+) toutes les gardes du lot éteintes, puis la GCV2 sans garde-fou sur le reste | 1303 | 95,3 % | 278 | 108 | 144 | 115 (41,4 %) | 192 | 74 | 34,5 |
| (d) rails hors de la vue : la pose du lot, si la caméra est déplacée | 14 | 1 % | 11 | 11 | 11 | 0 (0 %) | 11 | 0 | 199,9 |
| (d') toute pose déjà décidée par le lot mais non commandée ou non validée | 41 | 3 % | 14 | 13 | 13 | 0 (0 %) | 13 | 1 | 198,4 |
| (c*) lot : union des gardes gardeDePaire, appuisLarges, ecartementVoisin, choixFenetre éteintes une à une | 332 | 24,3 % | 57 | 35 | 53 | 1 (1,8 %) | 52 | 5 | 59,7 |
| (f) combinaison : (c*), puis la pose déjà décidée (caméra déplacée), puis la meilleure paire de la GCV2 (écartement gardé), validée et inscrite aux verts à contrôler | 1229 | 89,9 % | 250 | 128 | 167 | 51 (20,4 %) | 214 | 27 | 44,6 |
| (g) combinaison prudente : GCV2 sans couloir (τ, δ, écartement gardés), sinon (c*), sinon la pose déjà décidée (caméra déplacée) | 1013 | 74,1 % | 164 | 121 | 147 | 5 (3 %) | 153 | 10 | 44,4 |
| (g+) (g), puis la meilleure paire de la GCV2 (écartement gardé) sur le reste, validée et inscrite aux verts à contrôler | 1229 | 89,9 % | 250 | 132 | 167 | 51 (20,4 %) | 218 | 23 | 44,6 |
| (f, sans 2:1) même combinaison, hors partie 2:1 | 1129 | 82,6 % | 150 | 100 | 130 | 2 (1,3 %) | 138 | 10 | 42,1 |
| (e) cuts sans nuage (8, soit 0,6 % de la base) : rien à calculer | 0 | 0 % | 0 | — | — | — | — | — | — |

Par groupe de parties jugées (≤ 10 mm / > 50 mm / améliore / jugés) :

| Piste | projet 1 | 2:1 | projet 2 sans 2:1 | hors échantillon (2:6, 2:7) |
|---|--:|--:|--:|--:|
| (a) poser sans valider : meilleure hypothèse de la GCV2, sans garde-fou ni seuil, cut laissé invalide | 74 / 7 / 98 / 109 | 19 / 75 / 79 / 121 | 5 / 4 / 8 / 12 | 25 / 2 / 30 / 32 |
| (b) valider et inscrire aux verts à contrôler : même pose, validée | 74 / 7 / 98 / 109 | 19 / 75 / 79 / 121 | 5 / 4 / 8 / 12 | 25 / 2 / 30 / 32 |
| (b') idem, écartement de paire gardé | 75 / 2 / 100 / 107 | 20 / 51 / 76 / 100 | 7 / 0 / 10 / 11 | 26 / 0 / 32 / 32 |
| (b'') idem, couloir de 45 mm depuis le départ et écartement gardés, sans τ ni δ | 42 / 0 / 61 / 68 | 5 / 29 / 25 / 39 | 3 / 0 / 5 / 6 | 11 / 0 / 22 / 22 |
| GCV2 V1+ telle que déclarée (voie de série sûre, τ, δ) | 23 / 0 / 32 / 32 | 0 / 0 / 2 / 2 | — | 4 / 0 / 4 / 4 |
| GCV2 V1+ sans preuve de voie (τ, δ gardés) | 31 / 1 / 43 / 45 | 2 / 2 / 10 / 12 | 0 / 0 / 1 / 1 | 7 / 0 / 9 / 9 |
| GCV2 aux règles des verts (45 mm, τ, δ, écartement) | 42 / 0 / 44 / 50 | 3 / 1 / 6 / 7 | 2 / 0 / 4 / 4 | 10 / 0 / 11 / 11 |
| GCV2 sans couloir de 45 mm, τ, δ et écartement gardés | 72 / 1 / 86 / 93 | 9 / 4 / 19 / 23 | 4 / 0 / 7 / 7 | 25 / 0 / 29 / 29 |
| (c) lot : contrat d'écartement du moteur (1 420–1 470 mm, paire hors contrat) éteinte seule | — | 0 / 8 / 3 / 8 | 0 / 3 / 0 / 3 | 0 / 2 / 1 / 3 |
| (c) lot : appuis à 3 cuts au plus (« sans appui » : pas de reprise depuis la voie) éteinte seule | 6 / 0 / 8 / 8 | 2 / 0 / 2 / 2 | — | 3 / 0 / 3 / 3 |
| (c) lot : garde de paire (rail repêché par S1 et calage hors domaine, D-044) éteinte seule | 17 / 0 / 32 / 34 | — | 1 / 0 / 1 / 1 | 1 / 0 / 1 / 1 |
| (c) lot : garde de continuité (30 mm de la voie) éteinte seule | — | 2 / 3 / 3 / 5 | — | 1 / 0 / 1 / 1 |
| (c) lot : garde d'écartement voisin (20 mm) éteinte seule | — | 1 / 0 / 1 / 1 | — | 1 / 0 / 1 / 1 |
| (c) lot : garde d'écartement bas (1 420 mm, D-060) éteinte seule | — | — | — | — |
| (c) lot : seuil de points du minimum choisi (paire sous le seuil : 5 dessus, 3 flanc) éteinte seule | 1 / 1 / 4 / 5 | 0 / 2 / 0 / 2 | 3 / 0 / 2 / 3 | 1 / 0 / 4 / 4 |
| (c) lot : fenêtre du choix (15 mm en travers, 20 mm en hauteur, minimum unique) éteinte seule | 4 / 0 / 6 / 8 | 0 / 1 / 0 / 1 | — | — |
| (c) lot : toutes les gardes du lot éteintes ensemble | 25 / 5 / 41 / 50 | 14 / 41 / 29 / 55 | 4 / 6 / 3 / 10 | 6 / 16 / 7 / 23 |
| (c+) toutes les gardes du lot éteintes, puis la GCV2 sans garde-fou sur le reste | 64 / 10 / 92 / 109 | 25 / 81 / 80 / 125 | 4 / 8 / 4 / 12 | 15 / 16 / 16 / 32 |
| (d) rails hors de la vue : la pose du lot, si la caméra est déplacée | — | 11 / 0 / 11 / 11 | — | — |
| (d') toute pose déjà décidée par le lot mais non commandée ou non validée | 0 / 0 / 0 / 1 | 12 / 0 / 12 / 12 | — | 1 / 0 / 1 / 1 |
| (c*) lot : union des gardes gardeDePaire, appuisLarges, ecartementVoisin, choixFenetre éteintes une à une | 26 / 0 / 43 / 47 | 3 / 1 / 3 / 4 | 1 / 0 / 1 / 1 | 5 / 0 / 5 / 5 |
| (f) combinaison : (c*), puis la pose déjà décidée (caméra déplacée), puis la meilleure paire de la GCV2 (écartement gardé), validée et inscrite aux verts à contrôler | 67 / 2 / 96 / 107 | 28 / 49 / 76 / 100 | 7 / 0 / 10 / 11 | 26 / 0 / 32 / 32 |
| (g) combinaison prudente : GCV2 sans couloir (τ, δ, écartement gardés), sinon (c*), sinon la pose déjà décidée (caméra déplacée) | 74 / 1 / 89 / 96 | 18 / 4 / 28 / 32 | 4 / 0 / 7 / 7 | 25 / 0 / 29 / 29 |
| (g+) (g), puis la meilleure paire de la GCV2 (écartement gardé) sur le reste, validée et inscrite aux verts à contrôler | 74 / 2 / 100 / 107 | 25 / 49 / 76 / 100 | 7 / 0 / 10 / 11 | 26 / 0 / 32 / 32 |
| (f, sans 2:1) même combinaison, hors partie 2:1 | 67 / 2 / 96 / 107 | — | 7 / 0 / 10 / 11 | 26 / 0 / 32 / 32 |

Courbe : meilleure paire de la GCV2 (écartement gardé) validée au-dessus d'un seuil de score ; en dessous, pose approchée laissée invalide :

| Couverture visée | Seuil de score | Validés (% de la base) | Jugés | ≤ 10 mm | ≤ 20 mm | > 50 mm | Pire que le départ | Gain médian (mm) |
|---|--:|--:|--:|--:|--:|--:|--:|--:|
| 50 % | 0,7938 | 50 % | 108 | 86 | 101 | 5 (4,6 %) | 7 | 38,9 |
| 60 % | 0,7207 | 60 % | 125 | 96 | 114 | 6 (4,8 %) | 9 | 39,2 |
| 70 % | 0,5483 | 70 % | 151 | 109 | 133 | 7 (4,6 %) | 10 | 41 |
| 80 % | 0,1589 | 80 % | 180 | 122 | 152 | 11 (6,1 %) | 10 | 44,2 |
| 90 % | 0 | 89,9 % | 250 | 128 | 164 | 53 (21,2 %) | 23 | 44,4 |
| 95 % | 0 | 89,9 % | 250 | 128 | 164 | 53 (21,2 %) | 23 | 44,4 |

Les gardes « sûres » de (c\*) ont été choisies d'après ce diagnostic (0 ou 1 pose à plus de 50 mm sur les jugés). C'est une sélection après coup, à confirmer sur des parties neuves. L'union des contrefactuels pris un à un n'est pas le rejeu de leur combinaison.

## 7. Ordre de priorité pour approcher −90 %

1. **La GCV2 agit sur les différés sans le couloir de 45 mm depuis le départ, avec τ, δ et l'écartement de la paire** (piste « GCV2 sans couloir »).
   - Effet : **−71,6 %** de différés. Sur 152 jugés, 72 % à 10 mm, **3,3 % à plus de 50 mm**, gain médian de 41 mm.
   - Hors échantillon (2:6, 2:7) : 25 à 10 mm et 0 au-delà de 50 mm sur 29.
   - C'est le levier principal. Il lève à la fois la règle « jamais les différés » (V1), le couloir de 45 mm et les preuves de voie de série, qui coûtent le plus de poses justes. Il garde les trois garde-fous qui protègent.
2. **Compléter par la commande et la chaîne du lot** (piste g) :
   - **déplacer la vue** pour les cibles hors de la vue : 21 différés de la base, 15 calculés, 11 sur 11 jugés à 10 mm ;
   - **éteindre la garde de paire du lot (D-044)** : 211 différés à elle seule, 0 pose à plus de 50 mm sur 36 jugés, gain médian de 64 mm ; ce sont des différés du projet 1 (212 sur 214), donc à mesurer sur le projet 2 ;
   - **élargir les appuis de la reprise** de 3 à 10 cuts : 72 différés, 11 justes sur 13, 0 mauvais.

   Ensemble avec le point 1 : **−74,1 %**, 74 % à 10 mm, 3 % à plus de 50 mm.
3. **Pour le reste (sous τ), séparer poser et valider.** Poser la meilleure paire de la GCV2 (écartement gardé) **sans la valider** : le différé reste, mais l'opérateur part d'une pose approchée. Sur les jugés, elle améliore la pose de départ dans 87 % des cas (piste a/b').
   - **La valider en l'inscrivant aux verts à contrôler** porte l'effet à **−89,9 %** (piste g+).
   - Mais ces 16 points de plus sont les cas difficiles : environ la moitié des jugés y sont à plus de 50 mm, presque tous en 2:1.
   - Un seuil de score choisit lesquels valider (courbe : 80 % de couverture pour 6 % de poses à plus de 50 mm).
4. **Passer B1 en actif** (voisins validés de la liste d'ESV comme appuis) : il aurait posé 435 différés. **Il doit d'abord consigner sa pose**, pour qu'on la juge.
5. **Garder** le contrat d'écartement du moteur (éteint, il donne 13 mauvaises poses sur 14), le seuil τ (ou un seuil de score équivalent) et l'écartement de la paire.
6. **Attaquer la cause racine** : la pose de départ à 1 500 mm se trouve sous 79 % des différés. Une hypothèse « paire recentrée à l'écartement de la partie » dès le moteur (H5 étendue aux deux rails) toucherait la plupart des « sans appui ». C'est à mesurer sur le banc, ce n'est pas chiffré ici.

**Ce qui est hors de portée.**
- **2:1** et les voies décalées de plus de 150 mm : 21 % des jugés sont perdus d'avance, aucune hypothèse n'atteint l'opérateur. Il faudrait une fenêtre de recherche plus large du moteur (± 180 mm aujourd'hui) ou une H6 sans preuve. Toute pose y est risquée.
- **Les cuts sans nuage** : 8, rien à calculer.
- **2:18** (37 différés) : réservée, non calculée ; la base la compte.
- **La précision** : même avec la meilleure piste, la pose n'est à 10 mm de l'opérateur que dans 51 % des jugés (67 % en projet 1). −90 % de différés ne veut pas dire −90 % de travail : les verts à contrôler resteront à relire.

## 8. Ce qui a surpris

- **La cause racine est la pose de départ à 1 500 mm**, plus que n'importe quelle garde : 79 % des différés partent de là. Le moteur y voit une paire hors contrat, ou un seul rail.
- **Les gardes du lot ne sont presque pas en cause**, sauf la garde de paire : le différé naît dans le moteur, avant la chaîne.
- **La relecture visite les différés mais n'en corrige aucun**, par construction.
- **La GCV2 fait mieux hors échantillon (2:6, 2:7) que dans l'échantillon**, parce que 2:1 pèse 127 des 250 jugés dans l'échantillon.
- **V1+ est très sûre et ne sert presque à rien** : 15 % de la base, 0 mauvaise voie.

## 9. Doutes

- **Peu de jugés hors échantillon** (32) ; 2:1 pèse 45 % des jugés. Les parts « à plus de 50 mm » dépendent beaucoup de ce mélange.
- **Les combinaisons du lot** sont des unions de contrefactuels pris un à un, pas des rejeux conjoints.
- **Les pistes ont été regardées sur les mêmes données que celles qui les jugent** : avant toute activation, il faut un jugement sur des parties neuves (protocole de D-217).
- **Le rejeu ne connaît pas B1** : 22 différés n'arrivent pas au même étage que le lot.
- **Écartement ≤ 2 mm** : c'est le seul contrôle de la pose de départ, il est faible.
- 1:24 n'a que 40 différés sur 106 revisités par l'opérateur.

## 10. Données (hors dépôt)

Dans le dossier de travail de la session (`…/scratchpad/diag/`) :
- `cuts/cuts-P-N-LOT.jsonl` : une ligne par différé (37 fichiers, 1 330 différés) ;
- `mic/mic-*.json` : poses de l'opérateur de 2:1, 2:7 et du témoin 1:25 ;
- `lots/*.lots.json` : lots de chaque journal ;
- `inventaire.json`, `motifs.json`, `gains.json`, `gardes.json`, `pistes.json`, et les tables `*.md`.

Commande type : `node tools/diag-differes.cjs gains --cuts cuts-1-17-0067c40a.jsonl --cuts … --inventaire inventaire.json --md gains.md`.
