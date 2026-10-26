# Tableau de bord 5.0 — B-min (famille sans Écho)

Produit par `node tools/tableau-bord.cjs` le 2026-10-26 sur les collectes archivées (lecture seule). Famille **sans Écho** seulement (cahier v2 § 4, indicateurs lisibles dans un export de lot seul) ; **avec Écho : non produit** (aucun Écho complet joint par cet outil ; B complet ensuite). Chaque chiffre dit sa population ; réglage, examen et terrain ne se mélangent pas.

Définitions : **posés lot** = validations du lot hors cuts écrits par la passe ; **écrits passe** = `passe-differes-ecriture` « ecrit » avec écriture de validation 2xx observée ou liste d'ESV postérieure (jamais `serverConfirmed`, fiche H) ; **différés lot** = état du lot (les cuts de la passe y restent, D-238) ; **sans pose** = différés lot − écrits passe. Temps : `tools/perf-lot.cjs` (cycle hors silences de plus de 60 s). Relecture : `relecture-fin.dureeMs / cuts relus`, pauses non retranchées.

## Par version et population

| Version | Population | Lots | Cuts | Sans pose (Wilson 95 %) | Différés lot | Écrits passe (source) | Cycle médian des lots | Relecture ms/cut |
|---|---|---|---|---|---|---|---|---|
| 4.9.0.12 | terrain | 2 | 689 | 72 (10,4 % ; 8,4 % – 13 %) | 72 | 0 (sans-objet) | 3,96 s | — |
| 4.9.0.13 | terrain | 1 | 621 | 150 (24,2 % ; 21 % – 27,7 %) | 150 | 0 (sans-objet) | 3,99 s | — |
| 4.9.0.15 | terrain | 1 | 515 | 106 (20,6 % ; 17,3 % – 24,3 %) | 106 | 0 (sans-objet) | 3,15 s | — |
| 4.9.0.16 | terrain | 2 | 824 | 132 (16 % ; 13,7 % – 18,7 %) | 132 | 0 (sans-objet) | 2,90 s | — |
| 4.9.0.17 | terrain | 2 | 593 | 175 (29,5 % ; 26 % – 33,3 %) | 175 | 0 (sans-objet) | 2,79 s | — |
| 4.9.0.20 | terrain | 1 | 188 | 37 (19,7 % ; 14,6 % – 25,9 %) | 37 | 0 (sans-objet) | 2,49 s | — |
| 4.9.0.3 | terrain | 2 | 210 | 27 (12,9 % ; 9 % – 18,1 %) | 27 | 0 (sans-objet) | 10,25 s | — |
| 4.9.0.8 | terrain | 5 | 714 | 139 (19,5 % ; 16,7 % – 22,5 %) | 139 | 0 (sans-objet) | 5,66 s | — |
| 4.9.0.9 | terrain | 4 | 296 | 46 (15,5 % ; 11,9 % – 20,1 %) | 46 | 0 (sans-objet) | 3,97 s | — |
| 4.9.5.11 | terrain | 2 | 351 | 248 (70,7 % ; 65,7 % – 75,2 %) | 248 | 0 (sans-objet) | 1,73 s | 2,88 s (156 relus) |
| 4.9.5.13 | reglage | 3 | 659 | 372 (56,4 % ; 52,6 % – 60,2 %) | 372 | 0 (sans-objet) | 5,58 s | 2,65 s (71 relus) |
| 4.9.5.15 | reglage | 1 | 337 | 29 (8,6 % ; 6,1 % – 12,1 %) | 29 | 0 (sans-objet) | 4,56 s | 4,62 s (439 relus) |
| 4.9.5.16 | examen | 1 | 10 | 0 (0 % ; 0 % – 27,8 %) | 0 | 0 (sans-objet) | 4,96 s | 2,18 s (12 relus) |
| 4.9.5.18 | terrain | 1 | 70 | 2 (2,9 % ; 0,8 % – 9,8 %) | 2 | 0 (evenements) | 1,59 s | — |
| 4.9.5.19 | terrain | 6 | 903 | 191 (21,2 % ; 18,6 % – 23,9 %) | 192 | 1 (manquant+evenements) | 2,46 s | 2,31 s (704 relus) |
| 4.9.5.3 | reglage | 2 | 234 | 32 (13,7 % ; 9,9 % – 18,7 %) | 32 | 0 (sans-objet) | 2,53 s | — |
| 4.9.5.3 | terrain | 5 | 778 | 198 (25,4 % ; 22,5 % – 28,6 %) | 198 | 0 (sans-objet) | 2,39 s | — |
| 4.9.5.6 | terrain | 4 | 88 | 22 (25 % ; 17,1 % – 35 %) | 22 | 0 (sans-objet) | 2,09 s | — |
| 4.9.5.7 | reglage | 1 | 131 | 12 (9,2 % ; 5,3 % – 15,3 %) | 12 | 0 (sans-objet) | 2,35 s | 1,80 s (144 relus) |
| 4.9.5.7 | terrain | 1 | 9 | 0 (0 % ; 0 % – 29,9 %) | 0 | 0 (sans-objet) | 2,45 s | 1,87 s (12 relus) |
| 4.9.5.8 | reglage | 2 | 236 | 40 (16,9 % ; 12,7 % – 22,3 %) | 40 | 0 (sans-objet) | 5,39 s | 5,62 s (321 relus) |
| 4.9.5.8 | terrain | 1 | 1 | 1 (100 % ; 20,7 % – 100 %) | 1 | 0 (sans-objet) | — | — |
| 4.9.5.9 | reglage | 1 | 139 | 41 (29,5 % ; 22,5 % – 37,5 %) | 41 | 0 (sans-objet) | 3,92 s | 3,00 s (241 relus) |
| 4.9.5.9 | terrain | 1 | 8 | 8 (100 % ; 67,6 % – 100 %) | 8 | 0 (sans-objet) | 2,52 s | — |

## Une ligne par lot archivé lisible

| Début (UTC) | Lot | Partie | Version | Population | Poste | Cuts | Posés lot | Écrits passe (source) | Différés lot | Sans pose | Cycle médian / p90 | Cycle V1 médian | Capture médiane | Analyse médiane | Relecture |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-12 11:52 | a7a4869f | 3 | 4.9.0.3 | terrain | — | 192 | 174 | 0 (sans-objet) | 18 | 18 (9,4 %) | 9,25 s / 11,85 s | 8,31 s | 4,62 s | 881 ms | — |
| 2026-10-12 12:29 | c714cd0e | 3 | 4.9.0.3 | terrain | — | 18 | 9 | 0 (sans-objet) | 9 | 9 (50 %) | 11,24 s / 12,71 s | 9,52 s | 4,85 s | 1,11 s | — |
| 2026-10-13 06:50 | c0fcbde6 | 7 | 4.9.0.8 | terrain | — | 112 | 95 | 0 (sans-objet) | 17 | 17 (15,2 %) | 3,98 s / 7,65 s | 3,64 s | 2,68 s | 469 ms | — |
| 2026-10-13 07:36 | fea42296 | 8 | 4.9.0.8 | terrain | — | 217 | 178 | 0 (sans-objet) | 39 | 39 (18 %) | 5,66 s / 8,10 s | 5,46 s | 3,68 s | 628 ms | — |
| 2026-10-13 08:08 | 7a4a8b4d | 9 | 4.9.0.8 | terrain | — | 160 | 139 | 0 (sans-objet) | 21 | 21 (13,1 %) | 5,86 s / 8,28 s | 5,62 s | 3,74 s | 824 ms | — |
| 2026-10-13 08:46 | 42181659 | 10 | 4.9.0.8 | terrain | — | 187 | 148 | 0 (sans-objet) | 39 | 39 (20,9 %) | 5,17 s / 7,93 s | 5,02 s | 3,22 s | 542 ms | — |
| 2026-10-13 09:28 | 2bafdf25 | 10 | 4.9.0.8 | terrain | — | 38 | 15 | 0 (sans-objet) | 23 | 23 (60,5 %) | 5,83 s / 8,74 s | 5,38 s | 4,05 s | 469 ms | — |
| 2026-10-13 11:51 | 2536b3ae | 13 | 4.9.0.9 | terrain | — | 138 | 119 | 0 (sans-objet) | 19 | 19 (13,8 %) | 3,25 s / 6,67 s | 3,04 s | 1,11 s | 842 ms | — |
| 2026-10-13 12:03 | fd27a74c | 13 | 4.9.0.9 | terrain | — | 19 | 6 | 0 (sans-objet) | 13 | 13 (68,4 %) | 4,77 s / 6,42 s | 4,43 s | 2,44 s | 782 ms | — |
| 2026-10-13 13:30 | 5f051f89 | 14 | 4.9.0.9 | terrain | — | 1 | 0 | 0 (sans-objet) | 1 | 1 (100 %) | — | — | — | — | — |
| 2026-10-13 14:04 | 733d2df4 | 15 | 4.9.0.9 | terrain | — | 138 | 125 | 0 (sans-objet) | 13 | 13 (9,4 %) | 3,97 s / 6,63 s | 3,72 s | 1,40 s | 900 ms | — |
| 2026-10-14 06:27 | 0067c40a | 17 | 4.9.0.12 | terrain | — | 268 | 232 | 0 (sans-objet) | 36 | 36 (13,4 %) | 3,94 s / 6,87 s | 3,37 s | 1,90 s | 912 ms | — |
| 2026-10-14 07:02 | 4d0dc2e8 | 18 | 4.9.0.12 | terrain | — | 421 | 385 | 0 (sans-objet) | 36 | 36 (8,6 %) | 3,99 s / 7,92 s | 3,51 s | 821 ms | 1,11 s | — |
| 2026-10-14 12:02 | 17f523f1 | 23 | 4.9.0.13 | terrain | — | 621 | 471 | 0 (sans-objet) | 150 | 150 (24,2 %) | 3,99 s / 6,28 s | 3,17 s | 696 ms | 717 ms | — |
| 2026-10-15 06:54 | a983cf09 | 24 | 4.9.0.15 | terrain | — | 515 | 409 | 0 (sans-objet) | 106 | 106 (20,6 %) | 3,15 s / 5,75 s | 2,82 s | 1,91 s | 228 ms | — |
| 2026-10-15 08:35 | 3b2324ae | 26 | 4.9.0.16 | terrain | — | 370 | 311 | 0 (sans-objet) | 59 | 59 (15,9 %) | 2,16 s / 5,05 s | 1,82 s | 1,01 s | 232 ms | — |
| 2026-10-15 09:03 | 1f2b5184 | 25 | 4.9.0.16 | terrain | — | 454 | 381 | 0 (sans-objet) | 73 | 73 (16,1 %) | 3,65 s / 5,93 s | 3,19 s | 2,00 s | 236 ms | — |
| 2026-10-15 10:00 | c39db398 | 27 | 4.9.0.17 | terrain | — | 358 | 289 | 0 (sans-objet) | 69 | 69 (19,3 %) | 3,34 s / 5,57 s | 2,98 s | 2,05 s | 177 ms | — |
| 2026-10-15 10:35 | 19fac227 | 27 | 4.9.0.17 | terrain | — | 235 | 129 | 0 (sans-objet) | 106 | 106 (45,1 %) | 2,24 s / 5,11 s | 1,84 s | 1,07 s | 200 ms | — |
| 2026-10-15 15:26 | 7ea118aa | 28 | 4.9.0.20 | terrain | — | 188 | 151 | 0 (sans-objet) | 37 | 37 (19,7 %) | 2,49 s / 5,54 s | 2,12 s | 1,19 s | 231 ms | — |
| 2026-10-16 06:18 | 44eec69a | 29 | 4.9.5.3 | terrain | poste-12eb57 | 245 | 210 | 0 (sans-objet) | 35 | 35 (14,3 %) | 2,03 s / 4,79 s | 1,76 s | 1,15 s | 153 ms | — |
| 2026-10-16 08:52 | c20f7ede | 1 | 4.9.5.3 | terrain | poste-12eb57 | 351 | 224 | 0 (sans-objet) | 127 | 127 (36,2 %) | 2,57 s / 5,45 s | 2,10 s | 675 ms | 468 ms | — |
| 2026-10-16 11:20 | 1a809ccf | 2 | 4.9.5.3 | terrain | poste-12eb57 | 89 | 61 | 0 (sans-objet) | 28 | 28 (31,5 %) | 2,36 s / 5,43 s | 1,86 s | 450 ms | 359 ms | — |
| 2026-10-16 11:34 | d2bd2292 | 3 | 4.9.5.3 | terrain | poste-12eb57 | 38 | 37 | 0 (sans-objet) | 1 | 1 (2,6 %) | 2,41 s / 5,84 s | 2,14 s | 494 ms | 533 ms | — |
| 2026-10-16 13:27 | 264300fb | 4 | 4.9.5.3 | terrain | poste-12eb57 | 55 | 48 | 0 (sans-objet) | 7 | 7 (12,7 %) | 2,39 s / 5,58 s | 2,01 s | 466 ms | 478 ms | — |
| 2026-10-16 13:36 | 9f97a998 | 6 | 4.9.5.3 | reglage | poste-12eb57 | 83 | 72 | 0 (sans-objet) | 11 | 11 (13,3 %) | 2,57 s / 6,24 s | 2,07 s | 466 ms | 439 ms | — |
| 2026-10-16 13:42 | 00e47936 | 7 | 4.9.5.3 | reglage | poste-12eb57 | 151 | 130 | 0 (sans-objet) | 21 | 21 (13,9 %) | 2,49 s / 5,83 s | 2,06 s | 460 ms | 438 ms | — |
| 2026-10-17 07:57 | a12fef63 | 8 | 4.9.5.6 | terrain | poste-12eb57 | 31 | 29 | 0 (sans-objet) | 2 | 2 (6,5 %) | 1,77 s / 5,39 s | 1,67 s | 742 ms | 226 ms | — |
| 2026-10-17 08:01 | 41d35cb0 | 8 | 4.9.5.6 | terrain | poste-12eb57 | 1 | 1 | 0 (sans-objet) | 0 | 0 (0 %) | 7,80 s / 7,80 s | 51,65 s | 3,75 s | 292 ms | — |
| 2026-10-17 08:04 | 76575d74 | 9 | 4.9.5.6 | terrain | poste-12eb57 | 42 | 29 | 0 (sans-objet) | 13 | 13 (31 %) | 2,41 s / 5,32 s | 2,34 s | 809 ms | 248 ms | — |
| 2026-10-17 08:14 | 957bf699 | 9 | 4.9.5.6 | terrain | poste-12eb57 | 14 | 7 | 0 (sans-objet) | 7 | 7 (50 %) | 1,61 s / 4,14 s | 1,53 s | 407 ms | 223 ms | — |
| 2026-10-18 07:37 | 91b36b65 | 10 | 4.9.5.7 | terrain | poste-12eb57 | 9 | 9 | 0 (sans-objet) | 0 | 0 (0 %) | 2,45 s / 5,96 s | 2,41 s | 904 ms | 336 ms | corriger, 12 relus, 1,87 s/cut |
| 2026-10-18 07:39 | c224afa5 | 11 | 4.9.5.7 | reglage | poste-12eb57 | 131 | 119 | 0 (sans-objet) | 12 | 12 (9,2 %) | 2,35 s / 5,37 s | 2,18 s | 596 ms | 391 ms | corriger, 144 relus, 1,80 s/cut |
| 2026-10-19 10:40 | c8d56eab | 13 | 4.9.5.8 | reglage | poste-719464 | 22 | 19 | 0 (sans-objet) | 3 | 3 (13,6 %) | 4,92 s / 6,91 s | 4,79 s | 1,08 s | 1,51 s | — |
| 2026-10-19 11:48 | 7e0bfdf8 | 21 | 4.9.5.8 | terrain | poste-719464 | 1 | 0 | 0 (sans-objet) | 1 | 1 (100 %) | — / — | — | 684 ms | 292 ms | — |
| 2026-10-19 11:52 | eb1d9bc2 | 18 | 4.9.5.8 | reglage | poste-719464 | 214 | 177 | 0 (sans-objet) | 37 | 37 (17,3 %) | 5,85 s / 9,01 s | 5,27 s | 1,51 s | 1,53 s | corriger, 321 relus, 5,62 s/cut |
| 2026-10-19 12:57 | 990020c6 | 17 | 4.9.5.9 | terrain | poste-719464 | 8 | 0 | 0 (sans-objet) | 8 | 8 (100 %) | 2,52 s / 4,00 s | 2,44 s | 1,43 s | 836 ms | — |
| 2026-10-19 12:59 | bfb15534 | 17 | 4.9.5.9 | reglage | poste-719464 | 139 | 98 | 0 (sans-objet) | 41 | 41 (29,5 %) | 3,92 s / 6,36 s | 3,60 s | 1,16 s | 908 ms | corriger, 241 relus, 3,00 s/cut |
| 2026-10-19 18:02 | 09d28ada | 19 | 4.9.5.11 | terrain | poste-12eb57 | 3 | 0 | 0 (sans-objet) | 3 | 3 (100 %) | 1,15 s / 1,15 s | 1,08 s | 716 ms | 270 ms | — |
| 2026-10-19 18:03 | 7f46bbc5 | 19 | 4.9.5.11 | terrain | poste-12eb57 | 348 | 103 | 0 (sans-objet) | 245 | 245 (70,4 %) | 2,31 s / 5,13 s | 1,71 s | 574 ms | 258 ms | corriger, 156 relus, 2,88 s/cut |
| 2026-10-20 06:49 | 79b34f68 | 19 | 4.9.5.13 | reglage | poste-719464 | 248 | 41 | 0 (sans-objet) | 207 | 207 (83,5 %) | 3,98 s / 7,53 s | 3,06 s | 831 ms | 696 ms | corriger, 71 relus, 2,65 s/cut |
| 2026-10-20 08:13 | fd7067f7 | 20 | 4.9.5.13 | reglage | poste-719464 | 130 | 88 | 0 (sans-objet) | 42 | 42 (32,3 %) | 5,58 s / 9,96 s | 5,43 s | 1,91 s | 1,18 s | — |
| 2026-10-20 08:27 | f228f6f9 | 20 | 4.9.5.13 | reglage | poste-719464 | 281 | 158 | 0 (sans-objet) | 123 | 123 (43,8 %) | 6,29 s / 12,06 s | 5,84 s | 1,04 s | 1,27 s | — |
| 2026-10-20 17:07 | 41a5791f | 0 | 4.9.5.15 | reglage | poste-719464 | 337 | 308 | 0 (sans-objet) | 29 | 29 (8,6 %) | 4,56 s / 7,66 s | 4,25 s | 2,61 s | 555 ms | corriger, 439 relus, 4,62 s/cut |
| 2026-10-21 06:55 | 94365229 | 1 | 4.9.5.16 | examen | poste-719464 | 10 | 10 | 0 (sans-objet) | 0 | 0 (0 %) | 4,96 s / 7,20 s | 4,83 s | 898 ms | 1,88 s | corriger, 12 relus, 2,18 s/cut |
| 2026-10-21 16:14 | 75a49ee0 | 2 | 4.9.5.18 | terrain | poste-12eb57 | 70 | 68 | 0 (evenements) | 2 | 2 (2,9 %) | 1,59 s / 5,34 s | 1,50 s | 739 ms | 202 ms | — |
| 2026-10-23 06:37 | 8976f5f6 | 29 | 4.9.5.19 | terrain | poste-12eb57 | 1 | 0 | 0 (manquant) | 1 | 1 (100 %) | — | — | — | — | — |
| 2026-10-23 07:07 | 84f69ae1 | 33 | 4.9.5.19 | terrain | poste-12eb57 | 201 | 184 | 1 (evenements) | 17 | 16 (8 %) | 2,44 s / 5,79 s | 2,30 s | 1,02 s | 455 ms | corriger, 393 relus, 2,96 s/cut |
| 2026-10-23 07:41 | 5b365973 | 32 | 4.9.5.19 | terrain | poste-12eb57 | 14 | 14 | 0 (evenements) | 0 | 0 (0 %) | 2,46 s / 5,67 s | 2,41 s | 1,57 s | 402 ms | corriger, 30 relus, 2,26 s/cut |
| 2026-10-23 08:03 | b2897aef | 0 | 4.9.5.19 | terrain | poste-12eb57 | 535 | 444 | 0 (evenements) | 91 | 91 (17 %) | 2,70 s / 6,34 s | 2,32 s | 857 ms | 425 ms | — |
| 2026-10-23 09:48 | ad4f26e6 | 5 | 4.9.5.19 | terrain | poste-12eb57 | 61 | 58 | 0 (evenements) | 3 | 3 (4,9 %) | 1,57 s / 5,17 s | 1,50 s | 707 ms | 273 ms | corriger, 281 relus, 1,40 s/cut |
| 2026-10-23 12:41 | e177081f | 0 | 4.9.5.19 | terrain | poste-12eb57 | 91 | 11 | 0 (evenements) | 80 | 80 (87,9 %) | 3,83 s / 7,59 s | 3,53 s | 968 ms | 318 ms | — |

## Exports lus

Empreinte SHA-256 du journal lu (12 premiers caractères ici ; complète dans `datasets/tableau-bord/<version>.json`).

- a7a4869f : `2026-10-12_v4.9.0.3_partie-3` / ariane-journal-v4-1791808917490.json, 90b41f8c7f49
- c714cd0e : `2026-10-12_v4.9.0.3_partie-3` / ariane-journal-v4-1791808917490.json, 90b41f8c7f49
- c0fcbde6 : `2026-10-13_v4.9.0.8_parties-7-8-9-10` / ariane-journal-v4-1791875300432.json, 594fdacfb7de
- fea42296 : `2026-10-13_v4.9.0.8_parties-7-8-9-10` / ariane-journal-v4-1791878823432.json, dd379be95fad
- 7a4a8b4d : `2026-10-13_v4.9.0.8_parties-7-8-9-10` / ariane-journal-v4-1791880203112.json, 6f523bcc5893
- 42181659 : `2026-10-13_v4.9.0.8_parties-7-8-9-10` / ariane-journal-v4-1791884517706.json, a6370ec3b6df
- 2bafdf25 : `2026-10-13_v4.9.0.8_parties-7-8-9-10` / ariane-journal-v4-1791884517706.json, a6370ec3b6df
- 2536b3ae : `2026-10-13_v4.9.0.9_parties-1-13-15` / ariane-journal-v4-1791894890784.json, c8883bbdc44b
- fd27a74c : `2026-10-13_v4.9.0.9_parties-1-13-15` / ariane-journal-v4-1791894890784.json, c8883bbdc44b
- 5f051f89 : `2026-10-13_v4.9.0.9_parties-1-13-15` / ariane-journal-v4-1791901195854.json, 1eed54682120
- 733d2df4 : `2026-10-13_v4.9.0.9_parties-1-13-15` / ariane-journal-v4-1791901195854.json, 1eed54682120
- 0067c40a : `2026-10-14_v4.9.0.12_partie-17` / ariane-journal-v4-1791961043712.json, 5c41b8dee20e
- 4d0dc2e8 : `2026-10-14_v4.9.0.12_partie-17` / ariane-journal-v4-1791963286943.json, ef3757768ae2
- 17f523f1 : `2026-10-14_v4.9.0.13_partie-23` / ariane-journal-v4-1791982131061.json, d539a84781c0
- a983cf09 : `2026-10-15_v4.9.0.15_partie-24` / ariane-journal-v4-1792049294982.json, 21910fd416a7
- 3b2324ae : `2026-10-15_v4.9.0.16_parties-25-26` / ariane-journal-v4-1792057530100.json, 3e9c3de6fc49
- 1f2b5184 : `2026-10-15_v4.9.0.16_parties-25-26` / ariane-journal-v4-1792057530100.json, 3e9c3de6fc49
- c39db398 : `2026-10-15_v4.9.0.17_parties-25-27` / ariane-journal-v4-1792061427006.json, edb56bc44767
- 19fac227 : `2026-10-15_v4.9.0.17_parties-25-27` / ariane-journal-v4-1792061427006.json, edb56bc44767
- 7ea118aa : `2026-10-15_v4.9.0.20_parties-24-28` / ariane-journal-v4-1792078612873.json, 235008f6588d
- 44eec69a : `2026-10-16_v4.9.5.3_partie-29` / ariane-journal-v4-1792132356833.json, f93ae7e424cf
- c20f7ede : `2026-10-16_v4.9.5.3_projet2-partie-1` / ariane-journal-v4-1792142304288.json, 312f7ed9a791
- 1a809ccf : `2026-10-16_v4.9.5.3_projet2-parties-2-3-4-6-7` / ariane-journal-v4-1792161778844.json, cf20e47c8617
- d2bd2292 : `2026-10-16_v4.9.5.3_projet2-parties-2-3-4-6-7` / ariane-journal-v4-1792161778844.json, cf20e47c8617
- 264300fb : `2026-10-16_v4.9.5.3_projet2-parties-2-3-4-6-7` / ariane-journal-v4-1792161778844.json, cf20e47c8617
- 9f97a998 : `2026-10-16_v4.9.5.3_projet2-parties-2-3-4-6-7` / ariane-journal-v4-1792161778844.json, cf20e47c8617
- 00e47936 : `2026-10-16_v4.9.5.3_projet2-parties-2-3-4-6-7` / ariane-journal-v4-1792161778844.json, cf20e47c8617
- a12fef63 : `2026-10-17_v4.9.5.6_projet2-parties-8-9` / ariane-journal-v4-1792225071995.json, f4204aa08569
- 41d35cb0 : `2026-10-17_v4.9.5.6_projet2-parties-8-9` / ariane-journal-v4-1792225071995.json, f4204aa08569
- 76575d74 : `2026-10-17_v4.9.5.6_projet2-parties-8-9` / ariane-journal-v4-1792225071995.json, f4204aa08569
- 957bf699 : `2026-10-17_v4.9.5.6_projet2-parties-8-9` / ariane-journal-v4-1792225071995.json, f4204aa08569
- 91b36b65 : `2026-10-18_v4.9.5.7_partie-11` / ariane-journal-v4-1792309835373.json, a985d89d0232
- c224afa5 : `2026-10-18_v4.9.5.7_partie-11` / ariane-journal-v4-1792309835373.json, a985d89d0232
- c8d56eab : `2026-10-19_v4.9.5.8_partie-13` / ariane-journal-v4-1792406709537.json, 8629fcfa6125
- 7e0bfdf8 : `2026-10-19_v4.9.5.8_partie-18` / ariane-journal-v4-1792414318712.json, f91a5ee9afbe
- eb1d9bc2 : `2026-10-19_v4.9.5.8_partie-18` / ariane-journal-v4-1792414318712.json, f91a5ee9afbe
- 990020c6 : `2026-10-19_v4.9.5.8_partie-17-lot-15h51` / ariane-journal-v4-1792417863622.json, ff6b32b4d92b
- bfb15534 : `2026-10-19_v4.9.5.8_partie-17-lot-15h51` / ariane-journal-v4-1792417863622.json, ff6b32b4d92b
- 09d28ada : `2026-10-19_v4.9.5.8_partie-19` / ariane-journal-v4-1792436184174.json, caa5c3775228
- 7f46bbc5 : `2026-10-19_v4.9.5.8_partie-19` / ariane-journal-v4-1792436184174.json, caa5c3775228
- 79b34f68 : `2026-10-20_v4.9.5.13_partie-19` / ariane-journal-v4-1792480320045.json, 529e823fd456
- fd7067f7 : `2026-10-20_v4.9.5.13_partie-20` / ariane-journal-v4-1792490690375.json, 4ce62e0fe469
- f228f6f9 : `2026-10-20_v4.9.5.13_partie-20` / ariane-journal-v4-1792490690375.json, 4ce62e0fe469
- 41a5791f : `2026-10-20_v4.9.5.15_partie-0` / ariane-journal-v4-1792523191328.json, 9733b11b7e09
- 94365229 : `2026-10-21_v4.9.5.16_partie-1` / ariane-journal-v4-1792565854118.json, 3e5ca5cc1847
- 75a49ee0 : `2026-10-21_v4.9.5.18_partie-2` / ariane-journal-v4-1792599532571.json, ae710197093d
- 8976f5f6 : `2026-10-23_cache-tests-18-19_export-18-volumes` / ariane-journal-v4-1792755744027.json, a85ba3e93bf8
- 84f69ae1 : `2026-10-23_cache-tests-18-19_export-18-volumes` / ariane-journal-v4-1792755744027.json, a85ba3e93bf8
- 5b365973 : `2026-10-23_cache-tests-18-19_export-18-volumes` / ariane-journal-v4-1792755744027.json, a85ba3e93bf8
- b2897aef : `2026-10-23_cache-tests-18-19_export-18-volumes` / ariane-journal-v4-1792755744027.json, a85ba3e93bf8
- ad4f26e6 : `2026-10-23_cache-tests-18-19_export-18-volumes` / ariane-journal-v4-1792755744027.json, a85ba3e93bf8
- e177081f : `2026-10-23_v4.9.5.19_partie-0-lot-2` / ariane-journal-v4-1792759693947.json, c8407b3963f0

## Archives non lues (76)

Archives 7z : aucun décompresseur sur cette machine ; leurs lots n'ont pas de ligne.

- `2026-09-23_v4.7.6_` : 10 archive(s)
- `2026-09-23_v4.7.7_` : 2 archive(s)
- `2026-09-24_v4.7.10_` : 3 archive(s)
- `2026-09-24_v4.7.11_` : 6 archive(s)
- `2026-09-24_v4.7.7_` : 1 archive(s)
- `2026-09-24_v4.7.8_` : 3 archive(s)
- `2026-09-24_v4.7.9_` : 4 archive(s)
- `2026-09-25_v4.7.18_` : 6 archive(s)
- `2026-09-25_v4.7.19_` : 10 archive(s)
- `2026-09-26_v4.7.20_` : 3 archive(s)
- `2026-09-26_v4.7.21_` : 1 archive(s)
- `2026-09-28_v4.8.0_` : 1 archive(s)
- `2026-09-29_lots-20-25-33-reduits` : 1 archive(s)
- `2026-09-29_v4.8.5.1_` : 2 archive(s)
- `2026-10-07_v4.9.0.2_lots-7-10` : 12 archive(s)
- `2026-10-12_v4.9.0.4_partie-5` : 3 archive(s)
- `2026-10-14_v4.9.0.12_partie-17` : 7 archive(s)
- `2026-10-15_v4.9.5.1_echo` : 1 archive(s)
