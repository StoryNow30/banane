# Compteur des cuts appris par la GCV2 (depuis le début de la 5.0)

Généré par `node tools/compteur-gcv2.cjs` (D-188). **Un cut corrigé = un cut appris** (l'opérateur). Les SKIP ne sont pas comptés. Aucune limite : on ne s'arrête pas à 1 000 ou 1 500 cuts (l'opérateur).

**Cuts corrigés : 6 761** (dont 4 485 de plus de 5 mm, 2 684 de plus de 10 mm). Avec les cuts validés tels quels (1 366) et les cuts visités sans action d'au moins 0,6 s (9 631) : **17 758 cuts apprenables**.

| File | Corrigés | Validés tels quels | Visités sans action | Apprenables |
|---|---:|---:|---:|---:|
| En apprentissage (en file) | 4 623 | 843 | 8 268 | 13 734 |
| Appris (GCV2 entraînée) | 2 138 | 523 | 1 363 | 4 024 |

| Projet | Partie | État | Cuts à l'Écho | Corrigés | dont > 5 mm | dont > 10 mm | Validés tels quels | Visités sans action | SKIP (non comptés) | Sans référence |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 24 | appris | 263 | 180 | 154 | 106 | 14 | 20 | 0 | 49 |
| 1 | 12 | appris | 108 | 55 | 35 | 31 | 42 | 8 | 0 | 3 |
| 1 | 13 | appris | 224 | 74 | 38 | 29 | 57 | 75 | 1 | 17 |
| 1 | 29 | appris | 821 | 605 | 404 | 122 | 109 | 78 | 0 | 29 |
| 2 | 1 | appris | 765 | 340 | 232 | 166 | 87 | 192 | 6 | 140 |
| 2 | 10 | appris | 21 | 12 | 3 | 1 | 6 | 3 | 0 | 0 |
| 2 | 11 | appris | 546 | 77 | 40 | 25 | 26 | 224 | 3 | 216 |
| 1 | 14 | appris | 112 | 48 | 23 | 17 | 25 | 35 | 0 | 4 |
| 1 | 15 | appris | 524 | 107 | 35 | 9 | 27 | 356 | 2 | 32 |
| 1 | 16 | appris | 388 | 133 | 59 | 21 | 49 | 186 | 1 | 19 |
| 1 | 17 | appris | 795 | 507 | 428 | 198 | 81 | 186 | 0 | 21 |
| 2 | 6 | en-file | 431 | 152 | 68 | 32 | 30 | 196 | 5 | 48 |
| 2 | 7 | en-file | 960 | 394 | 186 | 78 | 141 | 321 | 1 | 103 |
| 2 | 13 | en-file | 254 | 16 | 3 | 2 | 3 | 181 | 0 | 54 |
| 2 | 18 | en-file | 127 | 73 | 58 | 45 | 29 | 21 | 0 | 4 |
| 2 | 17 | en-file | 55 | 44 | 43 | 43 | 2 | 6 | 0 | 3 |
| 2 | 19 | en-file | 620 | 311 | 296 | 280 | 23 | 177 | 2 | 107 |
| 2 | 20 | en-file | 516 | 282 | 260 | 239 | 15 | 200 | 5 | 14 |
| 3 | 0 | en-file | 511 | 83 | 66 | 50 | 9 | 282 | 3 | 134 |
| 3 | 1 | en-file | 22 | 1 | 1 | 0 | 0 | 20 | 0 | 1 |
| 3 | 5 | en-file | 842 | 60 | 55 | 42 | 4 | 487 | 3 | 288 |
| 4 | 2 | en-file | 74 | 23 | 14 | 3 | 4 | 40 | 2 | 5 |
| ? (à confirmer) | 0 | en-file | 997 | 282 | 230 | 149 | 29 | 484 | 9 | 193 |
| ? (à confirmer) | 15 | en-file | 183 | 19 | 8 | 4 | 2 | 115 | 0 | 47 |
| ? (à confirmer) | 16 | en-file | 384 | 41 | 11 | 2 | 1 | 290 | 5 | 47 |
| ? (à confirmer) | 17 | en-file | 200 | 43 | 13 | 0 | 6 | 128 | 0 | 23 |
| ? (à confirmer) | 18 | en-file | 460 | 37 | 25 | 5 | 7 | 266 | 1 | 149 |
| ? (à confirmer) | 20 | en-file | 450 | 35 | 20 | 6 | 4 | 321 | 5 | 85 |
| ? (à confirmer) | 0 | en-file | 127 | 84 | 74 | 52 | 8 | 17 | 0 | 18 |
| ? (à confirmer) | 1 | en-file | 153 | 77 | 63 | 40 | 10 | 42 | 0 | 24 |
| ? (à confirmer) | 17 | en-file | 535 | 414 | 101 | 24 | 29 | 87 | 0 | 5 |
| ? (à confirmer) | 20 | en-file | 393 | 280 | 245 | 208 | 10 | 91 | 1 | 11 |
| ? (à confirmer) | 10 | en-file | 29 | 24 | 9 | 3 | 2 | 1 | 0 | 2 |
| ? (à confirmer) | 11 | en-file | 6 | 3 | 0 | 0 | 2 | 1 | 0 | 0 |
| ? (à confirmer) | 0 | en-file | 345 | 209 | 74 | 30 | 25 | 100 | 3 | 8 |
| ? (à confirmer) | 12 | en-file | 16 | 12 | 5 | 1 | 4 | 0 | 0 | 0 |
| ? (à confirmer) | 13 | en-file | 10 | 5 | 4 | 0 | 4 | 1 | 0 | 0 |
| ? (à confirmer) | 14 | en-file | 58 | 35 | 30 | 4 | 2 | 6 | 0 | 15 |
| ? (à confirmer) | 10 | en-file | 23 | 18 | 17 | 17 | 1 | 2 | 0 | 2 |
| ? (à confirmer) | 13 | en-file | 124 | 47 | 43 | 38 | 13 | 45 | 0 | 19 |
| ? (à confirmer) | 14 | en-file | 67 | 27 | 21 | 13 | 2 | 7 | 0 | 31 |
| ? (à confirmer) | 15 | en-file | 35 | 24 | 19 | 12 | 1 | 4 | 0 | 6 |
| ? (à confirmer) | 8 | en-file | 42 | 17 | 7 | 1 | 14 | 11 | 0 | 0 |
| ? (à confirmer) | 9 | en-file | 285 | 158 | 52 | 2 | 52 | 41 | 0 | 34 |
| ? (à confirmer) | 10 | en-file | 259 | 130 | 69 | 25 | 47 | 71 | 0 | 11 |
| ? (à confirmer) | 11 | en-file | 230 | 96 | 35 | 5 | 35 | 60 | 8 | 31 |
| ? (à confirmer) | 12 | en-file | 71 | 49 | 24 | 2 | 15 | 2 | 0 | 5 |
| ? (à confirmer) | 13 | en-file | 119 | 71 | 41 | 8 | 17 | 14 | 0 | 17 |
| ? (à confirmer) | 14 | en-file | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 2 |
| ? (à confirmer) | 15 | en-file | 67 | 43 | 33 | 21 | 8 | 13 | 0 | 3 |
| ? (à confirmer) | 16 | en-file | 94 | 52 | 46 | 32 | 14 | 23 | 0 | 5 |
| ? (à confirmer) | 3 | en-file | 2 | 1 | 1 | 1 | 1 | 0 | 0 | 0 |
| ? (à confirmer) | 4 | en-file | 29 | 8 | 6 | 2 | 6 | 11 | 0 | 4 |
| ? (à confirmer) | 6 | en-file | 72 | 45 | 40 | 35 | 7 | 11 | 0 | 9 |
| ? (à confirmer) | 1 | en-file | 508 | 50 | 36 | 26 | 6 | 313 | 2 | 137 |
| ? (à confirmer) | 1 | en-file | 137 | 11 | 8 | 2 | 0 | 105 | 1 | 20 |
| ? (à confirmer) | 15 | en-file | 228 | 33 | 27 | 11 | 1 | 152 | 1 | 41 |
| ? (à confirmer) | 16 | en-file | 1 391 | 191 | 144 | 91 | 32 | 1 063 | 10 | 95 |
| ? (à confirmer) | 17 | en-file | 295 | 24 | 19 | 14 | 5 | 173 | 6 | 87 |
| ? (à confirmer) | 0 | en-file | 456 | 24 | 15 | 7 | 8 | 410 | 3 | 11 |
| ? (à confirmer) | 2 | en-file | 352 | 16 | 14 | 5 | 2 | 259 | 3 | 72 |
| ? (à confirmer) | 22 | en-file | 6 | 0 | 0 | 0 | 0 | 4 | 0 | 2 |
| ? (à confirmer) | 4 | en-file | 299 | 20 | 17 | 9 | 4 | 205 | 2 | 68 |
| ? (à confirmer) | 21 | en-file | 2 | 0 | 0 | 0 | 0 | 1 | 0 | 1 |
| ? (à confirmer) | 23 | en-file | 346 | 63 | 63 | 57 | 24 | 85 | 1 | 173 |
| ? (à confirmer) | 3 | en-file | 203 | 12 | 7 | 0 | 0 | 139 | 0 | 52 |
| ? (à confirmer) | 6 | en-file | 33 | 14 | 10 | 6 | 10 | 5 | 0 | 4 |
| ? (à confirmer) | 8 | en-file | 5 | 5 | 1 | 1 | 0 | 0 | 0 | 0 |
| ? (à confirmer) | 9 | en-file | 4 | 1 | 1 | 1 | 2 | 0 | 0 | 1 |
| ? (à confirmer) | 10 | en-file | 32 | 7 | 5 | 3 | 12 | 11 | 0 | 2 |
| ? (à confirmer) | 11 | en-file | 42 | 19 | 16 | 10 | 14 | 3 | 0 | 6 |
| ? (à confirmer) | 12 | en-file | 27 | 5 | 2 | 1 | 3 | 16 | 0 | 3 |
| ? (à confirmer) | 13 | en-file | 10 | 4 | 1 | 1 | 2 | 3 | 0 | 1 |
| ? (à confirmer) | 14 | en-file | 12 | 4 | 0 | 0 | 1 | 6 | 0 | 1 |
| ? (à confirmer) | 15 | en-file | 6 | 4 | 1 | 0 | 2 | 0 | 0 | 0 |
| ? (à confirmer) | 16 | en-file | 27 | 9 | 2 | 0 | 3 | 11 | 0 | 4 |
| ? (à confirmer) | 17 | en-file | 43 | 22 | 8 | 2 | 8 | 12 | 0 | 1 |
| ? (à confirmer) | 18 | en-file | 36 | 17 | 6 | 4 | 15 | 1 | 0 | 3 |
| ? (à confirmer) | 25 | en-file | 450 | 49 | 35 | 21 | 12 | 287 | 7 | 95 |
| ? (à confirmer) | 26 | en-file | 218 | 17 | 14 | 9 | 8 | 154 | 4 | 35 |
| ? (à confirmer) | 27 | en-file | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| ? (à confirmer) | 32 | en-file | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| ? (à confirmer) | 3 | en-file | 2 | 1 | 1 | 1 | 1 | 0 | 0 | 0 |
| ? (à confirmer) | 4 | en-file | 18 | 1 | 1 | 0 | 2 | 9 | 1 | 5 |
| ? (à confirmer) | 5 | en-file | 17 | 1 | 1 | 0 | 0 | 15 | 0 | 1 |
| ? (à confirmer) | 6 | en-file | 185 | 32 | 30 | 25 | 10 | 83 | 4 | 56 |
| ? (à confirmer) | 7 | en-file | 476 | 76 | 71 | 45 | 9 | 302 | 9 | 80 |
| ? (à confirmer) | 8 | en-file | 41 | 6 | 5 | 3 | 0 | 5 | 0 | 30 |
| ? (à confirmer) | 9 | en-file | 51 | 0 | 0 | 0 | 0 | 44 | 3 | 4 |
| ? (à confirmer) | 10 | en-file | 96 | 5 | 5 | 3 | 0 | 55 | 4 | 32 |
| ? (à confirmer) | 12 | en-file | 29 | 3 | 3 | 0 | 1 | 19 | 0 | 6 |
| ? (à confirmer) | 13 | en-file | 220 | 52 | 49 | 45 | 8 | 120 | 1 | 39 |

Une partie lue en plusieurs Échos (sessions, reprises) compte chaque cut une fois, d'après son dernier état observé.
