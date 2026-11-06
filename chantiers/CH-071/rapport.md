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

## Temps : NON MESURÉ

Le banc (`tools/ch071-banc-temps.cjs` : Chromium, 15 répétitions, médiane, traversée comprise) est écrit, mais il n'a pas été lancé avant l'arrêt. Aucun chiffre n'est donné.

Observation seulement, sans valeur de banc : dans le banc de parité Node, avec deux processus en charge, la médiane par cas est de 0,008 ms en JS et 0,022 ms côté façade, décodage compris.

SUPPOSÉ : la plupart des fonctions resteront en JS. Ce sont des fonctions de quelques microsecondes, et la traversée VBA de l'état y domine. Le banc doit le dire.

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
