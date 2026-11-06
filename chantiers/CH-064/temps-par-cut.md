# CH-064 — Temps CPU par cut (06/11/2026)

Banc : `tools/ch064-banc-temps.cjs --nuages 200 --rep 15` (`banc-temps.json`). Chromium 153 sous Linux, machine au repos, rien d'autre en parallèle. 200 nuages réels ; médiane des 15 répétitions par nuage, puis médiane des nuages. Appels par cut : rejeu de l'export du 06/11, partie 13 (`banc-esv-export-06-11.json`).

## Par appel (ms ; médiane, p95 entre parenthèses)
| module | JS du tronc | JS élagué (CH-061) | WASM (façade complète) |
|---|---|---|---|
| V4.6 `proposeBoth` | 58,2 (93,7) | **12,5** (20,1) | 24,3 (43,5) ; dont cœur 23,3, encodage 0,7 |
| GCV1 `propose` | 42,7 (77,8) | — (non élagué par CH-061) | **23,7** (41,8) |
| calage `calibrate` | **0,5** (0,9) | — | 1,0 (4,4) |
| `capture.point`, 1 000 appels | **< 0,1** (sous la résolution) | — | 26,3 : 26 µs de traversée par appel |

JS élagué identique au JS du tronc sur **200 nuages sur 200** : trames VBA identiques octet pour octet, comptées dans Chromium (ÉTABLI).

## Par cut (ms) = appels par cut × médiane d'un appel
| module | appels / cut | JS du tronc | JS élagué | WASM |
|---|---|---|---|---|
| V4.6 | 3,4 | 197,9 | 42,5 | 82,6 |
| GCV1 | 2,5 | 106,8 | 106,8 (JS) | 59,3 |
| calage | 8,8 | 4,4 | 4,4 (JS) | 8,8 |
| **total** | | **309,1** | **153,7** | **150,7** |

Meilleur assemblage mesuré : V4.6 élagué en JS, GCV1 en WASM, calage en JS, soit **106,2 ms par cut** (−203 ms, −66 %). Le total multiplie des médianes ; la distribution des cuts réels diffère de celle des nuages : PROBABLE.

## Lecture
- Pour V4.6, le JS élagué de CH-061 bat le WASM (12,5 contre 24,3 ms) : porter V4.6 en Rust n'apporte rien face à lui.
- GCV1 gagne en WASM (−19 ms par appel, −47 ms par cut), faute de version élaguée. Un élagage JS de GCV1 n'a pas été essayé.
- Les appels courts perdent en WASM (calage ×2, `capture.point` 26 µs par appel) : il ne faut pas porter un appel fin.
- **Mémoire rendue par la réinstanciation** (une mesure, ÉTABLI) : après la capture de 500 000 points, la mémoire linéaire passe de 26,3 à 1,1 Mo, et le RSS des processus de rendu de 572 860 à 543 836 Ko (−28,3 Mo). La réinstanciation rend donc bien au système la mémoire du cœur : l'objection de B (A-contre-B) tombe. Le reste du RSS (+124 Mo par rapport à l'état initial) est le tas JS de la page (7,8 → 168 Mo).
