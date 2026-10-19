# Compteur des cuts appris par la GCV2 (depuis le début de la 5.0)

Généré par `node tools/compteur-gcv2.cjs` (D-188). **Un cut corrigé = un cut appris** (Mic). Les SKIP ne sont pas comptés. Aucune limite : on ne s'arrête pas à 1 000 ou 1 500 cuts (Mic).

**Cuts corrigés : 2 684** (dont 1 705 de plus de 5 mm, 835 de plus de 10 mm). Avec les cuts validés tels quels (694) et les cuts visités sans action d'au moins 0,6 s (1 880) : **5 258 cuts apprenables**.

**Utilisés comme exemples : 1 271** cuts corrigés (sur 2 138 corrigés des 11 sources dont l'apprentissage a écrit les identifiants) : ceux dont le nuage existe et que l'apprentissage a effectivement retenus. La règle de Mic (« un cut corrigé = un cut appris ») reste la colonne principale ; cette colonne dit combien de corrections ont réellement servi d'exemple (D-210, M5).

| File | Corrigés | Utilisés comme exemples | Validés tels quels | Visités sans action | Apprenables |
|---|---:|---:|---:|---:|---:|
| En apprentissage (en file) | 546 | — | 171 | 517 | 1 234 |
| Appris (GCV2 entraînée) | 2 138 | 1 271 | 523 | 1 363 | 4 024 |

| Projet | Partie | État | Cuts à l'Écho | Corrigés | Utilisés comme exemples | dont > 5 mm | dont > 10 mm | Validés tels quels | Visités sans action | SKIP (non comptés) | Sans référence |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 24 | appris | 263 | 180 | 29 | 154 | 106 | 14 | 20 | 0 | 49 |
| 1 | 12 | appris | 108 | 55 | 43 | 35 | 31 | 42 | 8 | 0 | 3 |
| 1 | 13 | appris | 224 | 74 | 50 | 38 | 29 | 57 | 75 | 1 | 17 |
| 1 | 29 | appris | 821 | 605 | 438 | 404 | 122 | 109 | 78 | 0 | 29 |
| 2 | 1 | appris | 765 | 340 | 259 | 232 | 166 | 87 | 192 | 6 | 140 |
| 2 | 10 | appris | 21 | 12 | 12 | 3 | 1 | 6 | 3 | 0 | 0 |
| 2 | 11 | appris | 546 | 77 | 65 | 40 | 25 | 26 | 224 | 3 | 216 |
| 1 | 14 | appris | 112 | 48 | 46 | 23 | 17 | 25 | 35 | 0 | 4 |
| 1 | 15 | appris | 524 | 107 | 86 | 35 | 9 | 27 | 356 | 2 | 32 |
| 1 | 16 | appris | 388 | 133 | 124 | 59 | 21 | 49 | 186 | 1 | 19 |
| 1 | 17 | appris | 795 | 507 | 119 | 428 | 198 | 81 | 186 | 0 | 21 |
| 2 | 6 | en-file | 431 | 152 | — | 68 | 32 | 30 | 196 | 5 | 48 |
| 2 | 7 | en-file | 960 | 394 | — | 186 | 78 | 141 | 321 | 1 | 103 |

Une partie lue en plusieurs Échos (sessions, reprises) compte chaque cut une fois, d'après son dernier état observé.
