# CH-064-E — État, journal, listes (rapport)

Crate `ariane-rs/crates/ariane-etat`, membre de l'espace, binaire propre `wasm32-unknown-unknown` et bras `100..=149` du cœur. Sans dépendance Cargo. Les chiffres décimaux viennent de Ryū 1.0.18 (Ulf Adams, 2018 ; port Rust de David Tolnay), fichiers `common.rs`, `d2s.rs`, `d2s_full_table.rs`, `d2s_intrinsics.rs`. Licence d'amont au choix Apache 2.0 ou Boost 1.0 ; licence choisie pour cette copie : Apache 2.0. Mémoire linéaire du binaire propre plafonnée à 512 Mio, et relâchée par réinstanciation de l'instance.

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

## Qualité (ÉTABLI)

`cargo clippy -p ariane-etat --offline --no-deps --all-targets -- -W clippy::pedantic -D warnings` sort sans avertissement. Les conversions d'une longueur de tableau en `f64`, qui recopient `array.length`, sont nommées en tête de crate.

La surface publique est celle de l'ABI et du binaire de mesure : `appeler`, `parse_json`, `executer`, et les cinq symboles `vba_reserver`, `vba_liberer`, `vba_resultat`, `vba_liberer_resultat`, `vba_appel`. Le reste est `pub(crate)`. `cargo test -p ariane-etat` : 17 essais, dont un essai par fonction encore publique.

Chaque bloc `unsafe` porte un commentaire `// SÛRETÉ :` qui dit l'invariant (pointeur issu de l'allocation, taille, une seule libération ; pour Ryū, écriture dans deux `u64` locaux puis `assume_init`, indice borné avant `get_unchecked`).

La copie de Ryū reste locale. Une question est posée au chef pour n'en garder qu'une, dans `ariane-js`, déjà porteur de `Number.prototype.toString`. `ariane-js` n'est pas modifié en attendant.

## Lecture

Ces modules sont des lectures et des assemblages. Une fois les données en JavaScript, les porter en WASM les ralentit. Ils ne sont pas à brancher dans le chemin d'un cut. La parité est tenue, la mémoire est bornée.
