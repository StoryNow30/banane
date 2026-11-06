# CH-064-E — État, journal, listes (rapport)

Crate `ariane-rs/crates/ariane-etat`, binaire `wasm32-unknown-unknown`, sans dépendance Cargo (le formatage des nombres reprend Ryū, Apache 2.0 ou Boost, dans `src/ryu/`). La crate est son propre espace tant que le chef ne l'a pas ajoutée au sien. Branchement prévu, une ligne dans `ariane-coeur` : `100 => ariane_etat::appeler(entree)`. Mémoire linéaire plafonnée à 512 Mio (`--max-memory`), et relâchée par réinstanciation de l'instance (la coquille).

Référence : le JavaScript de cette branche. Chromium du banc : Chrome/156. 15 répétitions après 3 d'échauffement, médiane et P90 (indice `floor(p·n)`).

## Parité (ÉTABLI)

`node tools/ch064-e-parite.cjs --corpus` : **IDENTIQUE**, 0 écart.

| Module | Ce qui a été rejoué |
|---|---|
| `etat-morceaux` | synthèse, puis `decouper` sur la session de 31 segments Écho |
| `journal-index` (pur) | index des clés sur 5 journaux (champs lus : identifiant, type, session) |
| `correction-liste` | `construire` et `couverture` sur ces 5 journaux, projection des champs lus |
| `liste-memoire` (pur) | `decompacter` des 64 instantanés réels, plus synthèse |
| `verts-a-controler` | `lignesDeInstantane` sur ces 64 instantanés ; `liste` sur la partie synthétique des essais |
| `dataset` | assemblage sur 31 segments, visites réduites aux champs lus par `dataset` |

Contrôle en plus, un journal de 36 983 événements : `construire` sur l'événement entier et sur la projection donnent le même objet. L'adaptateur `ariane-rs/parite/etat.cjs` rejoue la synthèse (5 cas, Node).

## Temps dans Chromium (ÉTABLI)

Journal réel aminci, 36 983 événements. Une traversée = encodage VBA, appel, décodage.

| Module | JS médiane | JS P90 | WASM médiane | WASM P90 |
|---|---:|---:|---:|---:|
| `correction-liste` (`construire`) | 129,9 ms | 134,8 ms | 253,5 ms | 262,9 ms |
| `liste-memoire` (`decompacter`, un instantané) | 0,3 ms | 1,1 ms | 2,8 ms | 4,1 ms |
| `etat-morceaux` (`decouper`, une session) | 1,4 ms | 1,6 ms | 3,7 ms | 5,0 ms |

Le WASM est plus lent : la traversée coûte plus que le calcul. Sur ce journal, l'écart médian de la liste de corrections est **+124 ms**. Un cut du lot dure 2,3 à 6,7 s (CH-058, médianes par partie) : 124 ms, c'est 2 à 5 % d'un cut, dans le sens d'un surcoût, pas d'un gain. La liste se construit une fois par lot, pas par cut. La lecture IndexedDB que l'index évite reste en JavaScript (CH-058 : jusqu'à 4,8 s en fin de journée) ; ce port ne la remplace pas.

## Mémoire (ÉTABLI)

| | Avant | Au plus haut | Après |
|---|---:|---:|---:|
| Linéaire WASM, banc (36 983 événements) | 1 114 112 o (1,06 Mio) | 70 713 344 o (67,4 Mio) | 1 114 112 o après réinstanciation |
| Linéaire WASM, corpus entier | — | 460 324 864 o (439 Mio) | 9 568 256 o (9,125 Mio), 15 réinstanciations |
| Tas JS (banc, tas utile) | 83 254 372 o | — | 120 629 200 o (la charge reste en JS) |
| RSS natif, un appel `construire` | — | HWM 112 728 Kio | RSS 109 384 Kio |

Le plafond 512 Mio n'a pas été atteint. Après réinstanciation, la mémoire linéaire revient à la taille d'une instance neuve : elle ne s'accumule pas d'un appel à l'autre.

## Lecture

Ces modules sont des lectures et des assemblages. Une fois les données en JavaScript, les porter en WASM les ralentit. Ils ne sont pas à brancher dans le chemin d'un cut. La parité est tenue, la mémoire est bornée.
