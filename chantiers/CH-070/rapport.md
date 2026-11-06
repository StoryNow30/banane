# CH-070 — Rapport : ariane-session (lot 250–299) — 06/11/2026

Branche `chantier/CH-070`. Crate `ariane-rs/crates/ariane-session` (membre de l'espace, lints de l'espace), façade `ariane-rs/coquille/facade-session.js`, bancs `ariane-rs/parite/session-*.cjs`, lanceur `tools/ch070-essais.cjs`. Aucun fichier de `src/`, `tests/`, `vendor/` ni des crates `ariane-js`, `ariane-vba`, `ariane-coeur` n'est modifié. Deux propositions au chef : `coeur-aiguillage.patch` (bras `250..=299` et dépendance, appliqué hors dépôt par `tools/ch070-construire.cjs` pour les bancs) et `ariane-js-date-json.patch` (modules `date` et `json` ; s'applique, 15 essais verts, clippy propre).

## Fonctions portées (numéros du cœur)
- **part-summary-49, entier** : 250 `projectEvent`, 251 `summarize`, 252 `fromJournal`, 253 `contextOf`, 254 `deferKind`.
- **historique-parties** : 260 `finDe`, 261 `ficheFin`, 262 `ajouterFin`, 263 `historique`.
- **native-session** : 270 `poseEqual`, 271 `referenceParEcriture`, 272 `railDelta` (interne), 273 `visitRelation`, 274 `redactedEvent`, 275 `mergeMetrics`, 276 `accountQuality`, 277 `health`, 278 `exportAdvice`, 279 `chooseGeometry`, 280 `classify`, 281 `referenceFromWrite`. Méthodes à `this` : la façade passe l'état lu et recopie en place ; les identités gardées par le JS restent gardées (`degradationLevels`, `quality` et `metrics.quality`, `geometryEligibility`, `humanFinalReferences` et `humanFinalReference`), et le banc le vérifie.
- **core** : 285 `expectedPoses`, 286 `pairCorpus`. **native-reconstruction** : 290 à 294. **esv-observer** : 296 `voisins`, pour la mesure seulement.
- **js_extra.rs** (sémantique JS, à rapatrier dans `ariane-js`) : `Date.parse`, `JSON.parse` et `JSON.stringify`, `K.clone`, `localeCompare`, comparaison UTF-16. Les nombres passent par `nombre_en_chaine`, les clés de carte par `cle_same_value_zero`, et la sortie par `Valeur::canonique`.

## Domaines (ÉTABLI, mesuré)
- **`Date.parse`** : forme ISO stricte avec décalage, ou date seule. C'est la seule forme des journaux réels : 363 956 dates relevées. Une heure sans décalage (heure locale), une minuscule, un champ hors plage ou l'année −000000 sont hors domaine : V8 passe alors à son analyseur hérité, qui accepte « 0003-13 ». Seule la chaîne vide rend NaN.
- **`localeCompare`** : la locale du moteur passe en entrée. Ordre ASCII vérifié (100 000 paires, Node et Chromium) : en, fr (FR, CA, BE, CH), de, es, it, nl, pt, sv, tr, pl. Le danois, le tchèque, le lituanien et l'estonien divergent : JS.
- Ailleurs, toute entrée où le JS lèverait en cours de modification, convertirait une chaîne ou un objet, ou comparerait des identités d'objets est hors domaine, et le JS est rejoué.

## Parité (ÉTABLI, `essais.json`, verdict VERT, 0 écart)
Cas : relevé des entrées dans 84 essais du tronc (`tools/ch070-relever.cjs`), exports réels de banane-data (04 au 06/11 : bilans, exports Écho, instantanés de liste), variantes à graine fixe.

| Banc | Cas identiques (Node / Chromium) | Servis par le cœur |
|---|---|---|
| Date.parse | 290 008 / 290 008 | 124 246 |
| historique | 1 158 / 1 158 (aussi en fr-FR) | 1 149 |
| native-session | 65 547 / 65 547 | 51 551 |
| core | 4 081 / 4 081 | 3 038 |
| voisins | 2 461 / 2 461 | 2 461 |
| native-reconstruction | 18 455 / 18 455 | 18 078 |
| part-summary-49 | 1 652 / 1 624 (aussi en fr-FR) | 1 553 |

Sur les données réelles, tout est servi par le cœur, sauf le bilan ENTIER (85 Mo, 94 000 événements) : il dépasse le plafond de 256 Mio et le cœur rend la main au JS proprement. Le chemin du panneau, avec les événements projetés, passe bien par le cœur. Les replis viennent des variantes et des données de test des essais.

## Temps (Chromium 153, au repos, 15 répétitions, médiane par appel, traversée comprise ; `banc-temps.json`)
Résolution de l'horloge de la page : 0,1 ms. « < 0,1 » signifie sous la résolution, sur un appel unique.

| Fonction | JS (ms) | WASM (ms) | Rapport |
|---|---|---|---|
| reconstruireCut | 3,44 | 2,40 | **0,70 : plus rapide** |
| expectedPoses | 0,018 | 0,042 | 2,3 |
| voisins | 0,57 | 2,93 | 5,2 |
| summarize (panneau) | 0,6 | 8,2 | 14 |
| classify / chooseGeometry / referenceFromWrite | 0,022 / 0,006 / 0,005 | 2,38 / 1,43 / 2,35 | 108 / 238 / 494 |
| accountQuality / visitRelation | 0,002 / 0,002 | 0,42 / 0,25 | ≈ 200 / 124 |
| historique, ficheFin, ajouterFin, health, exportAdvice, mergeMetrics, projectEvent, redactedEvent, poseEqual, referenceParEcriture | < 0,1 | 0,01 à 1,6 | plus lent |

## Ce qui reste en JS, et pourquoi
- **Toutes les fonctions sauf `reconstruireCut`** : elles sont plus lentes en WASM (chiffres ci-dessus). Leur travail tient en quelques microsecondes en JS, alors que l'entrée (enregistrement de visite, session, historique) traverse en entier à chaque appel. Elles restent en JS ; le port est prêt et identique si la traversée disparaît un jour (état tenu dans le cœur).
- **`voisins`** : 5,2 fois plus lent, et la table vit dans la page d'ESV (monde principal, politique de sécurité d'ESV, cœur non chargé).
- **La couverture recalculée de `native-reconstruction`** (`couvertureDansRepere`, dépend de `native-lidar`) et **`lireFins` / `noterFin`** (stockage) : non portés.
- SUPPOSÉ : la cache par liste d'`exportAdvice` (WeakMap) n'est jamais périmée, c'est-à-dire que les listes ne font que croître ou sont remplacées. Le port recalcule l'ensemble à chaque appel.

Seul candidat au remplacement : `reconstruireCut`, 30 % plus rapide. Il est utilisé hors ligne : gain faible, décision à l'opérateur.
