# CH-074 — Rapport : décision en Rust, tranche J5 (gcv2-l1) (06/11/2026, arrêt avant la parité L1se de la copie)

Branche `chantier/CH-074` : fusion de `chantier/CH-068` (déjà incluse), puis de `chantier/CH-064` (cde76dd) et de `chantier/CH-064-D` (0677207), sans conflit. Crate `ariane-rs/crates/ariane-decision`, module `l1.rs` (numéro 66, aiguillage 50–99), même forme que J1 à J4. Aucun fichier de `src/`, `tests/`, `manifest.json` ni du paquet n'est touché (diff vide).

## Fonctions portées (ÉTABLI)
`src/gcv2-l1.js` (lu, non modifié) : 32 fonctions sur 36 exportées — decalage, variante, decalageDepuisDepart, decalagesH6, hypothesesDuCut, transfo, accords, brut, coder, soutienRail, modeleFige, probas, casDuDiffere, ecartementPaire, meilleurePaire, deciderL1, deciderL1e (et deciderL1Ref interne), positionsDe, ecartementDecal, ramenerRail, corrigerDecal, ordreRails, corrigerPoseChaine, ecartAVoie, contreChaine, voieDeListe, voieGeometrique, deciderDiffere, resumer, voieAbsolue, rechercheRecentree, pairesRecentrees.

Restent en JS (raison) : `avecRupture` (reçoit un `Map` ; portée en interne pour `deciderDiffere`) ; `reglerLeviers`, `leviersActifs` (état du module : la façade envoie les leviers en vigueur avec chaque appel) ; `commander` (reçoit `expectedPoses`, fonction du moteur) ; le diagnostic `LEVIERS.diag` (journal seulement, horloge) et `coder` avec `out` : hors domaine, la façade rejoue le JS. `src/gcv2-parametres-l1.js` n'a pas eu besoin de port (lu en entrée par `modeleFige`).

Appuis du cœur : moteur GCV1 à réservoir (`shadow.rs`), `decideCut` (`lot.rs`, nouvelle entrée `decide_cut_parts` qui ne recopie pas la capture, et trois accès aux voisins sous `L.DEFAULTS`), hauteur apprise, calage, `predictionDe`, L1-e (`l1e.rs`), `sig4` (`large.rs`). Les `Float64Array` (coefficients du modèle figé, probabilités, traits `x.n`) ne passent pas en VBA : ils voyagent en tableaux sur des chemins connus et la façade les rétablit en sortie ; ailleurs, l'entrée est refusée (repli).

## Parité (0 écart exigé)
Banc `CH064D_MODULES=gcv2L1 node tools/ch064-parite.cjs --module decision`, cœur WASM en Node (cible `wasm32-unknown-unknown` installée). Sources : fixtures relevées dans les 15 essais du tronc qui chargent gcv2-l1 (leviers en vigueur relevés avec chaque appel) ; cas RÉELS relevés par le crochet des fixtures pendant un rejeu du banc (`tools/banc-differes.cjs`, profils base et L1-se) sur le lot archivé 2-17 de banane-data (2 019 appels) ; cas DÉRIVÉS (`tools/ch074-cas-l1.cjs` : les fonctions internes rejouées sur les entrées intermédiaires de chaque `deciderDiffere`, dont `voieDeListe` sur une liste synthétique) ; variantes à graine fixe.

| Corpus | Cas | Identiques | Replis (hors domaine / format) |
|---|---|---|---|
| fixtures | 262 | 262 | 8 / 0 |
| fixtures + 20 variantes | 5 502 | 5 502 | 686 / 0 |
| fixtures + réel 2-17 + dérivés + 4 variantes | 63 485 | 63 485 | 3 202 / 3 579 |

## Écarts trouvés et corrigés (tous des défauts, aucune tolérance)
1. `hypothesesDuCut` avec `seul.decision` absente (ou `chaine.v`) : le JS lève, le Rust rendait. Désormais hors domaine (2 cas sur 29 085, variantes).
2. Banc : l'horloge `ms` du diagnostic (rejoué en JS des deux côtés) ; `Date.now` figé pour gcv2-l1 comme pour recherche-large.

## Garde et parités du service worker
- Garde GCV2 (`garde-gcv2.cjs comparer --base base-test18 --rejouer`, 12 lots de banane-data, JS du tronc) : **retour 0**, signalements déjà connus en base (pertes acceptées D-252, budget D-223 dépassé en base).
- Copie du dépôt sur le cœur branché (`tools/ch074-copie-wasm.cjs` : service worker de la construction séparée, module gcv2L1 ; copie seulement) :
  - `parite-relecture-sw` tronc contre copie : relevés identiques (SHA-256 9984fe77…). La relecture n'appelle jamais gcv2-l1 (compteur du cœur : 0) : elle ne prouve rien sur le port.
  - `parite-l1se-sw --passe`, lot 2-19 (248 cuts), rejeu du banc avec la recette de la passe livrée : **tronc** : 248 cuts rejoués, 1 ligne différente du banc (cut 5036 : même pose, 0 mm ; source `l1s-vue` au banc, `l1s-chaine` au service worker : préexistant au tronc, sans lien avec le port). **Copie : NON MESURÉE** (premier passage tué par manque de mémoire, en parallèle de la garde ; second passage arrêté sur l'ordre d'arrêt de l'opérateur du 06/11 au soir).

## Règles du cœur
Aucun état statique (arène remise à zéro par le cœur). Nombres en texte par `ariane_js::nombre`, clés de nombres par `cle_same_value_zero`. Seuls `unsafe` : les imports `js_log1p`, `js_log10`, avec `// SÛRETÉ :`. `unwrap`, `panic`, indexation interdits par `deny` dans `l1.rs`. `cargo clippy --all-targets -- -D warnings` propre (module au pedantic, cible wasm32 comprise) ; `-W clippy::pedantic` sur l'espace bute sur `ariane-js` (hors de ma portée). `cargo test` : 21/21, dont 19 attendus relevés sur le JS du tronc (natif : log1p et log10 de la bibliothèque, non garantis identiques à V8 ; le WASM prend ceux du moteur JS).

## État de reprise (arrêt du 06/11, ordre de l'opérateur)
Tout le code et les outils sont poussés. Il manque la seule parité L1se de la copie, condition du PRÊT. Pour reprendre (hors dépôt, rien n'y est versé) :
1. Clone sparse de banane-data dans `/home/user/data/banane-data` (branche de pilotage, collections des 12 lots de la base test18 et `collections/2026-11-0*`) ; lots extraits dans `BANANE_LOTS=/home/user/data/lots/<nom>/` (journal, liste, corpus nommés par la base).
2. Rejeu de référence : `BANC_LEVIERS='{"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true}}' node tools/banc-differes.cjs rejouer --partie 2:19 … --lot 79b34f68 --profils base,L1-se --liste … --sortie r-2-19-passe.jsonl` (194 s).
3. `node tools/ch074-copie-wasm.cjs /home/user/data/copie-wasm`, puis, SEUL sur la machine (environ 1 h, 2,3 Go) : `node /home/user/data/copie-wasm/tools/parite-l1se-sw.cjs … --racine /home/user/data/copie-wasm --passe`. Attendu : sortie identique à celle du tronc (même ligne 5036), et `ARIANE_RS_COMPTEURS` (sortie d'erreur) avec `gcv2L1.coeur` > 0.
4. Puis « PRÊT CH-074 <sha> ».

## Ce qui reste
- Les fonctions laissées au JS (ci-dessus). Les cas réels ne couvrent qu'un lot (2-17) ; les autres lots de la base sont dans `BANANE_LOTS` hors dépôt pour un relevé plus large.
- Banc de temps de J5 non lancé (machine non au repos).
