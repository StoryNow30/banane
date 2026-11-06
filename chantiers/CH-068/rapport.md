# CH-068 — Rapport : décision en Rust, tranche J4 (06/11/2026)

Branche `chantier/CH-068` (fusion de `chantier/CH-064` ; `chantier/CH-064-D` n'avait pas avancé depuis aafbea8). Crate `ariane-rs/crates/ariane-decision`, même forme que J1 à J3 : `appeler(fonction, &Valeur) -> Result<Valeur, Echec>`, un bras par numéro dans `lib.rs`, façade `ariane-rs/coquille/facade-decision.js`, banc `ariane-rs/parite/decision.cjs`.

## Fonctions portées (ÉTABLI : code et parité ci-dessous)
| N° | Module JS (lu, non modifié) | Fonctions portées | Restent en JS (raison) |
|---|---|---|---|
| 61 | `src/appuis-liste.js` | bordsCorps, mesurerT, noterRepere, resumeRepere, lireReponse, accord, appuis, compter, regle, comparer, resumeDecision | politique (reçoit une fonction) ; comparer(d,d) sur le même objet (l'identité ne traverse pas) |
| 62 | `src/gcv2-l1e.js` | referenceEcartement, signe, corriger, decider (4/4) | corriger avec un `soutien` fonction (repli de format) |
| 63 | `src/voie-recentree.js` | localMm, poseMm, vueNecessaire, camerasLarges, geste, traceMoteur, confiances, profondeur, predictionDe, mesures, regle, enRegle, verdictPrudent, completer, recentrer, appuisDepuisDecalage, choisirDansLePool, ecartPose, juger, memoireSerie | creerMemoire, series (rendent un `Map`) ; noterDecisionReelle, appuisOmbre, doitRecalculer, evaluerDiffere (mémoire à `Map` et fonctions de la page) ; evaluerEcho |
| 64 | `src/voie-b1-ecart.js` | lignesDeTable, repereDepuisLigne, ecartementReference, railTrouve, solutionsEcartement, poseMmDe, ecartPoses, **evaluer** | relancerDepuis, sourceEcart (reçoivent une fonction ; portées en interne pour evaluer), creerMemoire |
| 65 | `src/recherche-large.js` | reglage, graines, grainesUtiles, grainesPics, decalage, relance, cellules, paires, decider, resumer (10/10) | — |

**Non porté : GCV2 L1 (`src/gcv2-l1.js`, 1 028 lignes, 44 fonctions, modèle figé).** Hors de portée de cette session si l'on veut le bit près. Son port demande `hypothesesDuCut`, `deciderL1`, `deciderL1e`, `deciderDiffere`, le codage du modèle (`coder`, `modeleFige`) et `commander`. Je propose une tranche J5 dédiée, qui pourra s'appuyer sur `voie-recentree`, `gcv2-l1e`, `appuis-liste` et le moteur à réservoir, déjà portés.

Moteur GCV1 et mémoire : `recentrer`, `evaluer` et `recherche-large` reçoivent l'état du module GCV1 chargé et les réglages globaux, comme `decideCut` (J3). La mémoire de l'ombre de `evaluer`, qui contient un `Map`, voyage en paires et la façade y recopie la mémoire rendue. Le `ms` de `recherche-large.decider` est une horloge : la façade le mesure autour de l'appel, et le banc fige `Date.now` des deux côtés.

## Parité (0 écart exigé)
Banc `tools/ch064-parite.cjs --module decision` (cœur WASM en Node), avec trois sources de cas :
- les fixtures relevées dans les 36 essais du tronc qui chargent ces modules (`tools/ch064-d-fixtures.cjs`) ;
- des variantes à graine fixe (`tools/ch064-d-cas.cjs`) ;
- des cas réels de banane-data (`tools/ch064-d-reel-j4.cjs`) : instantanés de la liste d'ESV, nuages des 04 au 06/11, et décision du lot en chaîne.

| Corpus | Cas | Identiques | Replis (hors domaine) |
|---|---|---|---|
| appuis-liste, fixtures + 40 variantes | 1 640 | 1 640 | 34 |
| gcv2-l1e, fixtures + 40 variantes | 574 | 574 | 10 |
| appuis-liste + gcv2-l1e, réels (3 000 nuages) + 4 variantes | 125 347 | 125 347 | 722 |
| voie-recentree, fixtures + 30 variantes | 6 696 | 6 696 | 1 035 |
| voie-recentree, chaîne réelle (200 nuages) | 8 901 | 8 900 → corrigé | 438 |
| voie-b1-ecart, fixtures + 30 variantes | 310 | 310 | 35 |
| recherche-large, fixtures + 20 variantes | 1 596 | 1 596 | 296 |
| RÉSULTATS_FINAUX | | | |

Les replis viennent surtout des variantes (chaînes ou objets glissés dans des matrices, coercitions que le port refuse) : la façade rejoue alors le JS, à l'identique.

## Écarts trouvés et corrigés (tous des défauts, aucune tolérance)
1. **J3, `lot.rs`** : le JS `science.rails[side].next.status` lève quand un rail `ok` n'a pas de `next`, alors que le Rust le lisait sans erreur. Trouvé par `recentrer`, corrigé : ce cas est désormais hors domaine, et la façade rejoue le JS.
2. **J4 et J3** : `slice(0, undefined)` garde tout le tableau en JS, alors que le Rust en tirait 0 élément (`cellulesMax`, `K`, `appuis` et `lot.rs` `plus_proches`). Corrigé par `j4::fin_slice`.
3. **Banc** : `muter` supprimait un indice d'un `Float64Array` et plantait sur certaines variantes. Corrigé : ces tableaux typés sont traités comme des tableaux.

Hors correctifs, seule modification de J3 : `decide_cut_r` / `decide_cut_base_r`, qui exposent le moteur relancé, et `etat_globaux`.

## Règles du cœur
- Pas d'état statique, donc rien sur le tas d'un appel à l'autre : l'arène est remise à zéro par le cœur.
- Nombres en texte par `ariane_js::nombre::nombre_en_chaine` (`j4::texte`) ; clés de nombres par `cle_same_value_zero`.
- Aucun `unsafe`. Dans les modules J4, `unwrap`, `panic` et l'indexation sont interdits par `deny`.
- Clippy `-D warnings` propre sur l'espace et sur la cible wasm32. Mes modules sont au pedantic ; J1 à J3 ne le sont pas (environ 400 avertissements sous `[lints] workspace = true`). Question posée au chef, et `Cargo.toml` de la crate laissé tel quel.
- `cargo test` : 19/19, dont 6 essais J4 dont les attendus viennent du JS du tronc.

## Ce qui reste
- gcv2-l1 (voir plus haut).
- Les fonctions à `Map` ou à fonction de la page listées dans le tableau des fonctions portées.
- Le banc de temps et de mémoire J4 (`tools/ch064-d-banc-temps.cjs`), non lancé : la machine n'était pas au repos.
