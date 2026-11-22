# CH-064 — Temps CPU par cut (06/11/2026)

**Conditions.** Banc `tools/ch064-banc-temps.cjs --nuages 200 --rep 15`, résultats dans `banc-temps.json` (tous les modules) et `banc-temps-gcv1.json` (GCV1, `--seulement gcv1`). Chromium 153 sous Linux, machine au repos, rien d'autre en parallèle, 200 nuages réels. On prend la médiane des 15 répétitions de chaque nuage, puis la médiane des nuages. Appels par cut et durée du lot : rejeu de l'export du 06/11, partie 13 (`banc-esv-export-06-11.json`).

## Par appel (ms ; médiane, p95 entre parenthèses)
| module | JS du tronc | JS élagué | WASM (façade complète) |
|---|---|---|---|
| V4.6 `proposeBoth` | 58,2 (93,7) | **12,5** (20,1) : CH-061 | 24,3 (43,5) ; dont cœur 23,3, encodage 0,7 |
| GCV1 `propose` (lab du lot) | 42,3 (76,3) | **13,0** (21,6) : CH-065, `geometrie-elaguee-lot` + `mediane-exacte` | 23,7 (41,2) |
| calage `calibrate` | **0,5** (0,9) | — | 1,0 (4,4) |
| `capture.point`, 1 000 appels | **< 0,1** | — | 26,3 : 26 µs de traversée par appel |

Les deux versions élaguées rendent la même sortie que le JS du tronc sur **200 nuages sur 200**. La comparaison porte sur les trames VBA, octet pour octet, dans Chromium ; le rappel du lab est remplacé par une marque (ÉTABLI).

## Par cut (ms) = appels par cut × médiane d'un appel
| module | appels / cut | JS du tronc | JS élagué | WASM |
|---|---|---|---|---|
| V4.6 | 3,4 | 197,9 | 42,5 | 82,6 |
| GCV1 | 2,5 | 105,8 | 32,5 | 59,3 |
| calage | 8,8 | 4,4 | 4,4 | 8,8 |
| **total** | | **308** | **79** | **151** |

Le WASM ne gagne plus sur aucun module de géométrie : le JS élagué va environ deux fois plus vite que lui (−229 ms par cut, −74 % par rapport au tronc). Ce total multiplie des médianes, alors que les cuts réels ne se répartissent pas comme les nuages : PROBABLE.

## Part du calcul dans un cut
- **Rejeu de la partie 13 (maquette, 24 cuts)** : 81,7 s en JS du tronc (médiane de 3 lots : 81,4 à 83,3 s), soit 3,40 s par cut. Les 308 ms de géométrie en font **9 %**, et le JS élagué les ramène à 2,3 %.
  - Le lot rejoué en WASM a duré 81,2 s, soit −0,5 s sur 24 cuts. On attendait −3,8 s, mais cet écart reste dans la dispersion des lots JS (1,9 s). Le rythme du rejeu n'est donc pas fixé par le calcul : une partie du calcul se fait sans doute pendant les attentes de la maquette (PROBABLE, non mesuré).
- **Terrain du 05/11** (journal analysé par CH-061, ÉTABLI) : 6 276 s pour 2 664 cuts (829 de lot, 1 835 relus), soit 2,36 s par cut ; 5 419 vues lues, soit 2,0 vues par cut.
- **Lecture LiDAR**, d'après les chiffres de CH-064-L (son banc, non remesurés ici) : 410 ms par vue à l'origine, 48 en JS élagué, 24 en WASM. À 2,0 vues par cut, cela fait 833, 98 et 49 ms par cut (PROBABLE).

| par cut (ms) | tronc | tout en JS élagué | tout en WASM | JS élagué + LiDAR en WASM |
|---|---|---|---|---|
| géométrie | 308 | 79 | 151 | 79 |
| lecture LiDAR | 833 | 98 | 49 | 49 |
| **total** | **1 141** | **177** | **200** | **128** |

**Lecture.** L'opérateur ressentira surtout l'élagage en JS : −964 ms par cut. Le Rust n'apporte en plus que la lecture LiDAR, soit −49 ms par cut, environ 2 % d'un cut de terrain de 2,36 s.

## Mémoire de A (une mesure, ÉTABLI)
Mesure faite après la capture de 500 000 points.
- **Réinstanciation** : la mémoire linéaire passe de 26,3 à 1,1 Mo, et le RSS des processus de rendu de 572 860 à 543 836 Ko (−28,3 Mo). La réinstanciation rend donc au système la mémoire du cœur.
- **Reste du RSS** : +124 Mo par rapport à l'état initial. C'est le tas JS de la page (7,8 → 168 Mo).
