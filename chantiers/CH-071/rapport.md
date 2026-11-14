# CH-071 — Rust : files (lot 300–349) — rapport (06/11/2026, arrêt sur ordre de l'opérateur)

Branche `chantier/CH-071`. Crate `ariane-rs/crates/ariane-file`, façade `ariane-rs/coquille/facade-file.js`. Les fichiers JS sont lus, jamais modifiés.

## Fonctions portées (34)

| N° | Module | Fonctions |
|---|---|---|
| 300–312 | `file-parties` | `planifier`, `transition`, `reprise`, `repriseDe`, `completerBilan`, `relire`, `classerLot`, `registreAjouter`, `entreeRegistre`, `alertes`, `vue`, `actif`, `terminal` |
| 315–318 | `file-prioritaire` | `classe`, `apprendreTaux`, `ordonner`, `plages` |
| 320–323 | `serie-captures-vides` | `reglage`, `creer`, `observer`, `bilan` |
| 330–342 | `raison-correction` | `lireFrappe`, `estTouchePossible`, `autreGeste`, `delaiDeGrace`, `derniereValidation`, `nouvelEtat`, `finir`, `appuyer`, `heriter`, `resumeSeries`, `appliquer`, `effacer`, `vue` |

La façade (mêmes API que les modules) fait à la place du cœur ce que la VBA ne transporte pas :
- **Identités** : un état rendu tel quel reste l'objet reçu ; la série poussée est l'objet rendu ; la raison posée est l'objet rendu ; `ordonner(...).taux` est l'objet de taux reçu.
- **Écritures en place** : le cœur rend un journal ordonné (`[0, clé, v]`, `[1, clé, v]` sur la collante, `[2, v]` pour un push), et la façade l'applique sur l'objet d'origine.
- **Ce que la façade fournit au cœur** :
  - `Object.freeze` du réglage ;
  - `Date.parse` dans `derniereValidation`, passé en entrée par la façade ;
  - les chaînes du `Set` `jugesDeja`.
- **Ce que le cœur rend hors domaine**, la façade rejouant alors le JS :
  - un objet comparé par identité ;
  - une coercition de chaîne ;
  - une clé héritée (`toString`, `__proto__`, `Array.prototype.at`…) ;
  - un tri sur une partie NaN ;
  - une tranche coupant une paire de substitution.

Le cœur ne rend jamais l'exception du JS : sur ces entrées, la façade rejoue le JS, qui lève lui-même.

Règles du cœur respectées :
- `ariane_js::nombre::nombre_en_chaine`, `cle_same_value_zero`, `round`, `max`, `min`, `trier_nombres` ;
- `Valeur::canonique` sur chaque rendu ;
- aucun `unsafe`, `unwrap`, `expect` ni `panic` hors des essais ;
- clippy pedantic `-D warnings` propre, en natif et en WASM ;
- `cargo test` : 17 essais, au moins un par fonction publique.

## Cas comparés et écarts (ÉTABLI)

| Source | Cas |
|---|---:|
| Relevé : 136 fichiers d'essais du tronc (tous ceux qui chargent ces modules, service worker compris), lancés sous crochet (`tools/ch071-relever.cjs`), appels distincts | 47 914 |
| Réel `banane-data` (collections du 04 au 06/11) | 261 984 |
| Variantes à graine fixe (une feuille remplacée par une valeur limite) | 143 739 |

Les cas réels couvrent :
- les registres, vues, bilans et fins de lot ;
- la machine rejouée sur les vraies suites d'événements de la file ;
- les points des captures d'un lot ;
- les événements de l'opérateur, intentions et identités des exports Écho.

Résultats de parité :
- **Node 22.23** (`parite-node.json`) : 453 637 identiques sur 453 637, empreintes SHA-256 égales.
- **Chromium 153** (`parite-chromium.json`, `tools/ch071-parite-chromium.cjs`) : 453 637 identiques sur 453 637, empreintes égales. **0 écart.**

La comparaison est stricte (`ch064-comparer`, exceptions comprises) et porte sur trois choses : le rendu, les arguments **après** l'appel, et les identités garanties par le JS (état reçu, alias de la série, raison posée, réglage gelé, collante et `series` gardées en place).

Répartition des appels :

| Origine | Appels |
|---|---:|
| Servis par le cœur | 451 202 |
| Replis hors domaine (variantes seulement) | 1 349 |
| Replis d'écriture (objet non extensible ou non objet) | 1 086 |

Le relevé seul passe à 100 % par le cœur, sans repli.

Écart trouvé puis corrigé en cours de route : `v.at` lu sur un tableau ou une chaîne rend `Array.prototype.at`. Il est désormais hors domaine (667 variantes concernées, 0 après correction).

`tools/ch071-essais-ecritures.cjs`, demandé par l'intégrateur : 5 essais sur 5.
- Après chaque pas, l'objet d'origine est égal à celui du JS, alias compris.
- Le contrôle négatif voit bien un journal non appliqué.

Haute eau de la mémoire linéaire sur toute la parité : 8 912 896 octets, 0 réinstanciation (ÉTABLI).

## Temps (ÉTABLI, mesuré le 09/11/2026)

Banc `tools/ch071-banc-temps.cjs` : Chromium Chrome/153.0.0.0, 15 répétitions mesurées (après 2 de chauffe), 3000 appels par répétition, médiane et p90 du temps par appel, traversée JS ↔ WASM et codec VBA compris, machine sans autre charge pendant le banc (cœur construit avec les bras 250..=299 et 300..=349 ; `node --max-old-space-size=8000`, le premier lancement avec le tas par défaut du pilote Node ayant manqué de mémoire). Fichier brut : `chantiers/CH-071/banc-temps.json`.

| Fonction | Cas | JS médiane / p90 (µs) | WASM médiane / p90 (µs) | WASM ÷ JS |
|---|---:|---:|---:|---:|
| parties.actif | 295 | 0.092 / 0.123 | 33.498 / 43.112 | 362.33 |
| parties.alertes | 6 | 0.467 / 0.733 | 28.500 / 32.600 | 61.07 |
| parties.classerLot | 59 | 0.266 / 0.332 | 25.856 / 30.309 | 97.25 |
| parties.completerBilan | 6 | 7.867 / 10.767 | 47.867 / 58.167 | 6.08 |
| parties.planifier | 7 | 0.300 / 0.533 | 24.209 / 27.606 | 80.78 |
| parties.registreAjouter | 93 | 2.053 / 3.030 | 163.441 / 225.155 | 79.62 |
| parties.relire | 12 | 1.900 / 3.200 | 38.433 / 43.533 | 20.23 |
| parties.reprise | 13 | 6.427 / 8.558 | 58.375 / 71.895 | 9.08 |
| parties.repriseDe | 1 | 0.167 / 0.333 | 35.233 / 45.833 | 211.4 |
| parties.terminal | 2 | 0.033 / 0.100 | 34.133 / 42.333 | 1024 |
| parties.transition | 300 | 6.433 / 7.067 | 66.933 / 74.800 | 10.4 |
| parties.vue | 60 | 0.200 / 0.300 | 41.667 / 44.600 | 208.33 |
| prioritaire.apprendreTaux | 14 | 0.764 / 0.930 | 28.439 / 31.495 | 37.22 |
| prioritaire.classe | 9 | 0.266 / 0.333 | 23.686 / 26.580 | 89 |
| prioritaire.ordonner | 18 | 2.262 / 2.695 | 49.035 / 59.647 | 21.68 |
| prioritaire.plages | 1 | 0.667 / 1.000 | 26.000 / 29.333 | 39 |
| raison.appliquer | 300 | 0.967 / 1.100 | 52.167 / 67.767 | 53.97 |
| raison.appuyer | 300 | 0.133 / 0.200 | 30.867 / 38.967 | 231.5 |
| raison.autreGeste | 14 | 0.100 / 0.166 | 24.950 / 27.641 | 250.33 |
| raison.delaiDeGrace | 21 | 0.100 / 0.133 | 22.711 / 25.142 | 227.33 |
| raison.derniereValidation | 300 | 0.167 / 0.200 | 19.133 / 79.100 | 114.8 |
| raison.effacer | 300 | 0.800 / 0.933 | 57.067 / 138.733 | 71.33 |
| raison.estTouchePossible | 4 | 0.167 / 0.233 | 25.667 / 30.167 | 154 |
| raison.finir | 25 | 0.133 / 0.200 | 26.467 / 29.700 | 198.5 |
| raison.heriter | 120 | 0.100 / 0.133 | 32.433 / 41.000 | 324.33 |
| raison.lireFrappe | 300 | 0.133 / 0.200 | 26.867 / 29.433 | 201.5 |
| raison.nouvelEtat | 5 | 0.167 / 0.267 | 33.967 / 35.333 | 203.8 |
| raison.resumeSeries | 32 | 0.266 / 0.465 | 25.266 / 28.324 | 95 |
| raison.vue | 12 | 0.467 / 0.867 | 42.500 / 47.133 | 91.07 |
| serie.bilan | 4 | 0.033 / 0.067 | 22.533 / 23.200 | 676 |
| serie.creer | 6 | 0.333 / 0.400 | 31.667 / 34.967 | 95 |
| serie.observer | 37 | 0.132 / 0.165 | 28.873 / 32.630 | 219 |
| serie.reglage | 5 | 0.267 / 0.333 | 27.233 / 28.500 | 102.12 |

Résultat : les 33 fonctions sont plus lentes côté WASM, de ×6.08 à ×1024 ; aucun repli pendant le banc. **Toutes restent en JS** (règle « gain seulement »). Haute eau du cœur pendant le banc : 2359296 octets, 0 réinstanciation.

Relevé refait le 09/11 (`tools/ch071-relever.cjs`) : 138 essais du tronc, 59 360 appels, 47 914 uniques, aucun essai en échec. Essai du plafond (`tools/ch071-essais-plafond.cjs`, 2 sur 2) : haute eau ordinaire 2 359 296 octets ; au plafond, trappe, repli hors domaine, résultat identique au JS, appel suivant servi par une instance neuve (1 réinstanciation).

## Ce qui reste en JS et pourquoi

| Ce qui reste | Pourquoi |
|---|---|
| Constantes (`MOTIFS`, `SEUILS`, `TAUX_DEFAUT`, `CATALOGUE`…) | Exposées telles quelles par la façade. |
| `taux` | Interne, non exporté. |
| Tout appel hors domaine | Rejoué en JS (voir plus haut). |

Le reste dépend du banc de temps : une fonction plus lente en WASM reste en JS.

## État de reprise (arrêt du 06/11, ordre de l'opérateur)

**Fait et poussé :**
- crate, façade, relevé, adaptateur `ariane-rs/parite/file.cjs` ;
- parité Node et Chromium ;
- essai des écritures en place ;
- `chantiers/CH-071/branchement-coeur.patch` : dépendance, bras `300..=349 => ariane_file::appeler`, ligne de `Cargo.lock`. Il est à appliquer par le chef ; il n'est pas appliqué sur la branche.

**À faire, dans l'ordre :**
1. `git apply chantiers/CH-071/branchement-coeur.patch && node tools/ch064-construire.cjs`, copier `ariane-rs/dist/ariane-coeur.wasm` hors du dépôt, puis `git checkout ariane-rs/crates/ariane-coeur ariane-rs/Cargo.lock`.
2. `node tools/ch071-relever.cjs` : le relevé vit dans `ariane-rs/target/`, non suivi ; à refaire sur une machine neuve.
3. `CH071_WASM=<copie> node --max-old-space-size=8000 --test tools/ch071-essais-plafond.cjs` : haute eau ordinaire, puis trappe à 256 Mio, repli JS identique et appel suivant servi. Écrit, **pas encore lancé**.
4. Machine au repos : `CH071_WASM=<copie> node tools/ch071-banc-temps.cjs --json chantiers/CH-071/banc-temps.json`, puis remplir la section « Temps » et la liste de ce qui reste en JS.
5. « PRÊT CH-071 <sha> » à l'intégrateur.
