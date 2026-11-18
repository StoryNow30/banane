# CH-064 — Étape 1 : architecture, outillage, carte des modules, banc de parité (plan soumis à l'intégrateur, 06/11/2026)

Base : tronc `claude/50-test17` à e833dc7. CH-061 n'a rien poussé sur sa branche à cette heure (ticket seul) ; son seul chiffre connu est celui de D-291 (géométrie 34,9 ms JS contre 22,4 ms Rust/WASM, identité bit à bit sur 865 nuages). Je ne m'appuie que sur lui et sur mes propres mesures, ci-dessous.

## 1. Constat qui fixe l'architecture : les mathématiques de Rust ne sont pas celles de V8 (ÉTABLI)
Sonde `tools/ch064-sonde-math.cjs` (résultat : `chantiers/CH-064/sonde-math.json`) : 200 000 tirages par fonction à graine fixe, entrées à l'échelle des nuages, divergences au bit près (`Object.is`) contre `Math.*` :

| fonction (appels dans `src/`) | hypot (55) | round (120) | max (190) | min (91) | log10 (1) | pow (3) | sin (1) | cos (2) | log (2) | log1p (1) | exp (5) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| std Rust contre Node 22 (V8 12.4) | 70 072 | 52 320 | 71 491 | 71 317 | 29 831 | 8 599 | 1 508 | 1 775 | 1 452 | 114 | 0 |
| std Rust contre Chromium 153 | 70 072 | 52 320 | 71 491 | 71 317 | 534 | 20 453 | 5 593 | 5 392 | 12 517 | 13 067 | 18 686 |
| portage `ariane-js` (Node et Chromium) | **0** | **0** | **0** | **0** | — | — | — | — | — | — | — |

- `round` diffère par définition (JS : demi vers +∞ ; Rust : demi loin de zéro), `max`/`min` par NaN et −0, `hypot` par algorithme (V8 : mise à l'échelle par le maximum et somme compensée). Les portages des algorithmes de V8 : 0 divergence (et 0 sur 1 000 000 tirages pour hypot et round dans une première sonde).
- **Les transcendantes de V8 changent d'une version à l'autre** : Node 22 et Chromium 153 ne donnent pas les mêmes bits (`exp` : identique à Rust dans Node, 18 686 écarts dans Chromium). Conséquences : (a) la référence de parité est **Chromium**, pas Node ; (b) `sin`, `cos`, `exp`, `log`, `log10`, `log1p`, `pow` sont **appelés en JS par import WASM** : identiques par construction au navigateur qui exécute, quelle que soit sa version (16 appels dans `src/`, hors boucles chaudes à vérifier module par module).
- Conséquence générale : un portage « naturel » ne serait PAS identique. Tout le code Rust passe par la couche de **sémantique JS** (`ariane-js`) ; l'usage direct de `f64::hypot`, `round`, `min`, `max`, `sin`… est interdit dans les crates métier (garde `clippy.toml`, `disallowed-methods`). `+ − × ÷ √`, `floor`, `ceil`, `trunc`, `abs` sont exacts en IEEE 754 des deux côtés : identiques à ordre d'opérations égal ; aucune contraction FMA.

## 2. Architecture cible
```
 Page ESV (monde MAIN)      Service worker                       Panneau
 adapter-page, lidar.js ──► background.js, engine.js (gelé) ◄──► panel.js, ui5, signal-rendu
 (DOM, Potree : JS)         │ appelle BananeGeometry3, lot…   │   (DOM : JS)
                            ▼ façades JS de même API           ▼
                         coquille JS (ariane-rs/coquille/) : codec, mémoire, erreurs
                            ▼ un seul point d'appel : appel(n°, octets) → octets
                         ariane-coeur.wasm (Rust) : capture, géométrie, lot, GCV, relecture, état, export
```
- **Façades de même API.** `engine.js` lie `BananeGeometry3` et les autres globales au chargement. La construction expérimentale (étape 4) remplace la globale par une façade JS qui appelle le WASM, avec la MÊME signature et les MÊMES objets rendus : aucun fichier de production modifié, bascule module par module, retour au JS en une ligne.
- **Chargement synchrone dans le service worker.** `importScripts` est synchrone et les modules sont appelés de façon synchrone (`propose` rend une valeur, pas une promesse). Le binaire est donc embarqué en base64 dans un `.js` et compilé par `new WebAssembly.Module(octets)` (permis dans un worker). Coût du démarrage à mesurer (poste « démarrage du SW » de CH-061).
- **Un seul binaire** `ariane-coeur.wasm`, sans dépendance externe (pas de `wasm-bindgen`) : ABI écrite à la main (`allouer`, `liberer`, `appel(fonction, ptr, long) → ptr`), reproductible, auditable, petit. `panic = "abort"` : une panique devient une exception JS et la coquille réinstancie le module.
- **Ce qu'impose Chrome (à décider par l'opérateur à l'étape 4, pas avant)** : le manifeste devra porter `content_security_policy.extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"` (Chrome ≥ 103, le paquet exige 111). Dans la page ESV (monde MAIN), c'est la CSP d'ESV qui s'applique : si elle refuse `wasm-unsafe-eval`, la lecture du LiDAR ne peut pas être en WASM dans la page (SUPPOSÉ, à vérifier sur la maquette puis en séance ; repli : lecture en JS, filtrage en WASM dans le SW).
- **Mémoire.** La mémoire linéaire WASM grandit et ne rend jamais : un gros nuage fixe le plafond du SW. Parade prévue : tas d'appel remis à zéro après chaque appel, réinstanciation au-delà d'un seuil ; mesuré par module.
- **Non-déterminisme** (`Math.random` ×6, `Date.now`, `performance.now`) : jamais tiré en Rust, toujours passé en entrée par la coquille.

## 3. Format des échanges JS ↔ WASM : « valeurs binaires Ariane » (VBA)
JSON ne suffit pas à l'identité : il perd `−0` à l'écriture, `NaN`, `±Infinity`, `undefined` (et la différence clé absente / clé à `undefined`, que conservent IndexedDB et `structuredClone`). Format retenu : arbre étiqueté binaire, petit-boutiste, ordre des clés conservé.
- étiquettes : `undefined`, `null`, `false`, `true`, `f64` (8 octets, bits exacts), `chaîne` (UTF-8 ; une chaîne JS à surrogat isolé est REFUSÉE avec erreur, jamais altérée), `tableau`, `objet` (clés ordonnées), `trou` (tableau creux), **`bloc f64 n×k`** (tableau homogène de tableaux de k nombres, ex. `pointsSceneRelative` : copié d'un bloc, lu en Rust comme `&[[f64;3]]`), `bloc u8` (booléens/visibilités), `erreur` (type + message : la coquille relance `Error(message)` identique).
- côté Rust : `enum Valeur` + lecture sans copie des blocs ; côté JS : encodeur/décodeur (~200 lignes) dans `ariane-rs/coquille/vba.js`.
- Le coût de traversée est mesuré à part (encodage, copie, décodage), sur les objets réels (enregistrements et nuages des exports), en Node ET dans Chromium. Repli JSON conservé pour le débogage.

## 4. Espace Cargo et outillage
```
ariane-rs/                       (exclu du paquet : tools/package.py ligne 45, déjà fait par e833dc7)
  Cargo.toml                     espace, profil release opt-level 3, lto, panic=abort, codegen-units=1
  clippy.toml                    méthodes interdites (f64::hypot, round, min, max, sin, cos, powf, ln…)
  crates/ariane-js               sémantique JS : Math de V8 (hypot, round, max/min avec NaN et −0, transcendantes),
                                 tri stable avec comparateur JS, formatage des nombres (toString, toFixed), clés ordonnées
  crates/ariane-vba              format d'échange (§ 3)
  crates/ariane-capture … (§ 5)  un crate par groupe de modules
  crates/ariane-coeur            cdylib : ABI et table des fonctions exportées
  coquille/                      chargeur WASM (Node, SW, page), codec VBA, façades par module
  parite/<module>.cjs            adaptateur de banc par module : entrées, appel JS, appel Rust
tools/ch064-construire.cjs       cargo build --release --target wasm32-unknown-unknown → dist/ (non versionné) + .wasm.js base64
tools/ch064-parite.cjs           banc de parité générique (§ 6)
tools/ch064-sonde-math.cjs       sonde du § 1
tools/ch064-suivi.cjs            cible mouvante : empreinte du fichier JS de référence de chaque port ; signale tout port dont le JS a bougé
tools/ch064-essais.cjs           lanceur unique (cargo test, construction, sonde, VBA, parités) ; RIEN dans tests/ (décision de l'intégrateur, § E)
```
Rien de généré n'est versionné (binaire et base64 refaits par l'outil). Dépendances Rust : aucune (si un crate devient nécessaire, ex. formatage `ryu-js`, je le dis avant de l'ajouter).

## 5. Carte des modules JS → crates, et ordre de portage
Mesuré sur le tronc (lignes ; « impur » = appels `chrome`, DOM, horloge, hasard comptés par motif) :

| ordre | crate | modules JS | lignes | raison de l'ordre |
|---|---|---|---|---|
| 0 | `ariane-js`, `ariane-vba` | (fondations) | — | prérequis de tout le reste |
| 1 | `ariane-capture` | `vendor/capture-core.js` | 155 | pur ; utilisé par 15 modules |
| 2 | `ariane-geometrie` | `geometry`, `geometry-candidate-v1`, `placement-convention`, `gauge` | 640 | pur ; seul gain déjà mesuré (D-291) ; prototype CH-061 |
| 3 | `ariane-lot` | `level-crossing`, `hauteur-apprise`, `faux-vert-ombre`, `continuity-observer`, `brain`, `geometry-brain`, `lot-decision` | 1 338 | pur ; dépend de 1-2 ; décision du lot |
| 4 | `ariane-gcv` | `gcv1-shadow`, `gcv2-l1`, `gcv2-l1e`, `gcv2-parametres-l1`, `voie-recentree`, `recherche-large`, `voie-b1-ecart`, `appuis-liste`, `regles-metier`, `garde-*`, `serie-captures-vides` | 3 011 | pur (2 appels horloge à passer en entrée) ; garde GCV2 et parités L1SE en plus du banc |
| 5 | `ariane-relecture` | `relecture-critere`, `relecture-signal`, `relecture-ombre`, `verts-a-controler`, `carte-relecture` (logique) | 672 | pur ; parité `tools/parite-relecture-sw.cjs` en plus |
| 6 | `ariane-etat` | `etat-morceaux`, `journal-index` (index), `correction-liste`, `file-parties`, `file-prioritaire`, `historique-parties`, `part-summary-49`, `raison-correction`, `phase-pli` | 1 541 | logique pure séparable des appels IndexedDB (restent en JS) |
| 7 | `ariane-export` | `native-export`, `gcv1-export`, `zip-writer` (en-têtes, CRC), `export-cache` (logique) | 1 125 | exports octet pour octet ; la compression reste `CompressionStream` (JS) |
| 8 | `ariane-lidar` | `vendor/lidar.js` (décodage), `native-lidar` (couverture), `merge-clouds`, `lod-signature`, `native-reconstruction` | 934 | dernier : son lieu d'exécution dépend de la CSP d'ESV (§ 2) ; 81 % du temps de relecture est l'attente du chargement ESV (CH-003), pas du calcul |
| 9 | `ariane-session` | `native-session`, `manual-session`, `core`, `settings` (validation) | 1 839 | après le reste : très lié au journal et à l'orchestration |

**Reste en JavaScript** (6 147 lignes de `src/` et tout `background.js`, `panel.*`) : `engine.js` (gelé, orchestrateur asynchrone, ne fait qu'appeler les façades), `adapter-page`, `bridge`, `esv-observer`, `early-input`, `native-page`, `manual-page`, `gestes-vue`, `deplacement-vue` (page ESV, DOM, Potree), `ui5`, `signal-rendu`, `panel*` (DOM), `storage`, `liste-memoire` (IndexedDB, `chrome.storage`), `relecture-pause`, `perf-phase` (horloge, minuteries). Raison : ce sont des appels d'API du navigateur ; les porter ne ferait qu'ajouter une traversée. `background.js` (492 Ko) garde l'orchestration ; ses parties pures pourront être extraites en module plus tard, par un ticket du tronc (je n'y touche pas).

## 6. Banc de parité générique (`tools/ch064-parite.cjs`)
`node tools/ch064-parite.cjs --module <nom> --corpus <dossier banane-data> [--moteur node|chromium] [--json sortie]`
- l'adaptateur `ariane-rs/parite/<nom>.cjs` fournit : `entrees(corpus)` (cas tirés des exports réels ET des fixtures des essais JS existants), `js(cas)`, `rs(cas, coeur)` ;
- comparaison stricte, sans normalisation : arbre complet, ordre des clés, `Object.is` sur chaque nombre (−0, NaN), clé absente ≠ `undefined`, trous, tableaux typés, exceptions (type + message) ; pour un écart numérique, le chemin et la distance en ulp ;
- sortie : cas, identiques, 20 premiers écarts, empreintes SHA-256 des sorties sérialisées en VBA des deux côtés (égales = identité), temps par cas (médiane, p95, échauffement exclu), mémoire (tas JS et mémoire WASM) ;
- Chromium : même banc, même paquet de code, chargé dans `/opt/pw-browsers/chromium` par Playwright ; c'est la référence (§ 1 : la V8 de Chromium n'est pas celle de Node) ; l'identité est exigée sur les DEUX ;
- un module n'est déclaré « identique » que si le banc rend 100 % sur tout le corpus des collections du 04/11 et du 05/11 et sur les fixtures, en Node et dans Chromium, et si les essais JS du module passent contre la façade WASM.

## 7. Ce que je fais pendant ta relecture (outillage seulement, aucun module porté)
`ariane-js` (hypot, round, max/min de V8 avec essais), `ariane-vba` + `coquille/vba.js` (aller-retour identique sur les enregistrements réels, coût mesuré), `ariane-coeur` minimal, `tools/ch064-construire.cjs`, `tools/ch064-parite.cjs` éprouvé sur une fonction témoin (aller-retour identité), lanceur `tools/ch064-essais.cjs`. Données : clone sparse de `banane-data` hors dépôt (5 collections du 04 et du 05/11, 66 zips, 750 Mo). Puis jalon « ÉTAPE 1 CH-064 <sha> ».

## Réponses de l'intégrateur (06/11) et compléments au plan
Validé : ordre du § 5, VBA (sous condition : spécification écrite, `chantiers/CH-064/vba.md`, et aller-retour sans perte prouvé sur TOUS les enregistrements réels), transcendantes importées du JS, Chromium comme référence et Node contrôlé en plus. **Changement** : rien dans `tests/` (le verify de production ne dépend ni de cargo ni du binaire). Les essais Rust sont dans `ariane-rs/` (`cargo test`), les bancs dans `tools/ch064-*`, et un lanceur `tools/ch064-essais.cjs` que l'intégrateur lance à part, à chaque étape. Le § 4 est corrigé en ce sens.

### A. Ce qu'apporte CH-061 (ca08c48) et ce que j'en reprends
- Ses mesures (Chromium 153) : le seul gain net propre au langage est la **lecture LiDAR** (196 → 18 ms par vue ; 45 ms en JS réécrit) ; géométrie 34,9 → 22,4 ms, mais 9,4 ms en JS élagué contre 8,4 en Rust élagué ; JSON, deflate, CRC, IndexedDB : Rust **perd ou fait jeu égal** ; traversée d'une chaîne UTF-8 de 75 Mo : 379 ms à l'encodage. Je les tiens pour la base de comparaison et je refais chaque mesure sur mes ports, dans les trois variantes (JS d'origine, même algorithme en JS, Rust).
- Je réutilise ses outils, cités par leur chemin sur sa branche : `bancs/nuages.cjs` (lecture des nuages réels dans les zips), `bancs/charger-sw.cjs` (chaîne de modules du SW en vm), `bancs/banc-csp.cjs` (vraie extension MV3), `bancs/parite-geometrie.cjs` (865 nuages). Je les copie dans `tools/ch064-*` quand j'en ai besoin, avec leur origine en tête de fichier.
- **Conséquence sur le périmètre** : les postes JSON, deflate, IndexedDB, `chrome.storage` et la sérialisation de l'état **sortent du portage** (restent en JS), sauf preuve contraire par banc. Les crates `ariane-export` et `ariane-etat` du § 5 se limitent à la logique pure ; chaque port doit montrer que sa traversée ne mange pas son gain, sinon il n'est pas branché.

### B. Où tourne chaque module, sous quelle CSP
| lieu | modules (crates) | CSP qui s'applique | état |
|---|---|---|---|
| service worker | capture, géométrie, lot, GCV, relecture, logique de l'état et du journal | celle de l'extension (`manifest.json`) | refusé sous la CSP MV3 par défaut (CH-061, ÉTABLI) ; passe avec `'wasm-unsafe-eval'` : **décision de l'opérateur**, à l'étape 4 seulement |
| page ESV, monde MAIN et monde isolé | lecture LiDAR (`ariane-lidar`) | **celle d'ESV** (les deux mondes, CH-061, ÉTABLI) | inconnue (SUPPOSÉ) ; refusé sous `script-src 'self'`, accepté sans CSP ou avec `'wasm-unsafe-eval'` |
| panneau | aucun (DOM) | celle de l'extension | sans objet |
Repli si ESV refuse : la lecture des tampons Potree reste en JS dans la page (version en tableaux typés, CH-061 : 45 ms), et rien d'autre ne change ; le gain Rust de la lecture est alors perdu (≈ 27 ms par vue).

### C. Mesurer la CSP réelle d'ESV sans rien écrire (étape 1 bis, à faire tôt)
Par ordre de préférence :
1. **Relevé manuel par l'opérateur, aucun code** : outils de développement de Chrome sur une page `rails_validation`, onglet Réseau, document principal, en-têtes de réponse `Content-Security-Policy` et `Content-Security-Policy-Report-Only`, plus une éventuelle balise `<meta http-equiv="Content-Security-Policy">`. Il recopie le texte. Il n'y a aucune requête de plus et aucune donnée du projet dans le texte (vérifier qu'aucune adresse interne n'y figure avant de le verser dans le dépôt).
2. **Patch en lecture seule de l'observateur, à proposer à l'intégrateur** (`chantiers/CH-064/patch-releve-csp.patch`, jamais appliqué par moi) : dans `src/esv-observer.js` (monde MAIN, `document_start`), (a) lire la balise `meta` CSP si elle existe ; (b) écouter passivement `securitypolicyviolation` (l'événement porte `originalPolicy`, la politique entière, et `disposition`) ; (c) consigner dans le journal un événement `csp-releve` (texte de la politique, `wasm-unsafe-eval` présent ou non, `report-uri` ou `report-to` présents ou non). Aucun essai de compilation : c'est un essai refusé qui pourrait déclencher l'envoi d'un rapport de violation à ESV, donc une requête. Il est exclu sans décision.
3. **Essai actif** (compiler un module vide de 8 octets dans la page) : seulement si 1 et 2 ne disent rien et si la politique relevée n'a ni `report-uri` ni `report-to` ; décision de l'opérateur.

### D. Borner la mémoire linéaire
Fait établi (CH-061) : une instance WASM ne rend jamais sa mémoire (769 Mo réservés après un JSON de 75 Mo). La parade, à **mesurer** à l'étape 2 avant d'être retenue :
- **Plafond dur** : mémoire maximale déclarée à l'édition des liens (`-C link-arg=--max-memory=…`, valeur fixée par la mesure de l'étape 2). Une allocation au-delà échoue proprement, la coquille rend une erreur et la façade se replie sur le JS, avec un événement de journal.
- **Réinstanciation** : le `WebAssembly.Module` compilé est gardé, et l'`Instance` est recréée quand `memory.buffer.byteLength` dépasse un seuil après un appel. L'ancienne mémoire n'est alors plus référencée et redevient collectable (PROBABLE, à mesurer : tas du SW avant, pendant et après, par CDP). Le coût de l'instanciation est à mesurer (la compilation, 6,3 ms chez CH-061, n'est pas refaite).
- **Pas d'état durable dans le WASM** : chaque appel est une fonction pure, entrée et sortie ; l'état de la session reste en JS. La réinstanciation ne perd donc rien.
- **Postes exclus** : tout ce qui manipule le journal entier ou l'export (dizaines de Mo) reste en JS (§ A).
- Mesure par module : mémoire linéaire avant et après, haute eau, et tas JS (encodage VBA compris).

### E. Essais et lanceur
`cargo test` dans `ariane-rs/` (essais unitaires et de parité sur fixtures embarquées) ; `tools/ch064-essais.cjs` lance, dans l'ordre : `cargo test`, la construction WASM, la sonde numérique (Node et Chromium), l'aller-retour VBA sur le corpus réel, et la parité de chaque module porté. Il rend un JSON de synthèse et sort en échec à la première divergence.
