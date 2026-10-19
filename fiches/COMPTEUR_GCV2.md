# Compteur des cuts appris par la GCV2 (depuis le début de la 5.0)

Généré par `node tools/compteur-gcv2.cjs` (D-188). **Un cut corrigé = un cut appris** (Mic). Les SKIP ne sont pas comptés. Aucune limite : on ne s'arrête pas à 1 000 ou 1 500 cuts (Mic).

**Cuts corrigés : 1 783** (dont 1 091 de plus de 5 mm, 559 de plus de 10 mm). Avec les cuts validés tels quels (472) et les cuts visités sans action d'au moins 0,6 s (1 373) : **3 628 cuts apprenables**.

| File | Corrigés | Validés tels quels | Visités sans action | Apprenables |
|---|---:|---:|---:|---:|
| En apprentissage (en file) | 1 783 | 472 | 1 373 | 3 628 |
| Appris (GCV2 entraînée) | 0 | 0 | 0 | 0 |

| Projet | Partie | État | Cuts à l'Écho | Corrigés | dont > 5 mm | dont > 10 mm | Validés tels quels | Visités sans action | SKIP (non comptés) | Sans référence |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 24 | en-file | 263 | 180 | 154 | 106 | 14 | 20 | 0 | 49 |
| 1 | 12 | en-file | 108 | 55 | 35 | 31 | 42 | 8 | 0 | 3 |
| 1 | 13 | en-file | 224 | 74 | 38 | 29 | 57 | 75 | 1 | 17 |
| 1 | 29 | en-file | 821 | 605 | 404 | 122 | 109 | 78 | 0 | 29 |
| 2 | 1 | en-file | 765 | 340 | 232 | 166 | 87 | 192 | 6 | 140 |
| 2 | 10 | en-file | 21 | 12 | 3 | 1 | 6 | 3 | 0 | 0 |
| 2 | 11 | en-file | 546 | 77 | 40 | 25 | 26 | 224 | 3 | 216 |
| 1 | 14 | en-file | 112 | 48 | 23 | 17 | 25 | 35 | 0 | 4 |
| 1 | 15 | en-file | 524 | 107 | 35 | 9 | 27 | 356 | 2 | 32 |
| 1 | 16 | en-file | 388 | 133 | 59 | 21 | 49 | 186 | 1 | 19 |
| 2 | 6 | en-file | 431 | 152 | 68 | 32 | 30 | 196 | 5 | 48 |

Une partie lue en plusieurs Échos (sessions, reprises) compte chaque cut une fois, d'après son dernier état observé.
