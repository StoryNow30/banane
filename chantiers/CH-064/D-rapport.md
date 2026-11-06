# CH-064-D — Décision d'Ariane en Rust (`ariane-decision`) : rapport (06/11/2026)

Branche `chantier/CH-064-D`, partie de `chantier/CH-064`. Crate `ariane-rs/crates/ariane-decision` (jalons J1 à J3 ; J4 ouvert). Résultats bruts : `D-parite.json`, `D-banc-temps.json` (versés par `tools/ch064-d-verser.cjs`).

## 1. Ce qui est porté
| jalon | module JS du tronc | fonctions portées | reste JS (et pourquoi) |
|---|---|---|---|
| J1 | `relecture-critere` | `reglages`, `correctionPermise`, `juger` | constantes |
| J1 | `relecture-signal` | `reglage`, `lectureDe`, `creer`, `observer`, `recharge`, `bilan` (état `e` rendu, recopié par la façade) | — |
| J1 | `garde-apres-differe`, `garde-passe-appuis` | `reglage`, `voisinsDifferes`, `deplacementMm`, `appuiNormalCuts`, `juger` | — |
| J1 | `relecture-ombre` | `plage`, `selection`, `optionsSelection`, `ecartRail`, `poseCalculee`, `confiance`, `juger`, `skipOmbre`, `captureVide`, `duree` | — |
| J2 | `level-crossing` | `detect`, `edgeOf`, `positionAt`, `read` | `frameOf` (rend une fermeture) |
| J2 | `regles-metier` | `surface`, `railsDePlus`, `resumer`, `doitDifferer`, `evenement` | `creerMemoire`, `evaluer`, `noter`, `lignes` : mémoire à `Map`/`Set` (ne passe pas en VBA), tenue de comptes sans calcul |
| J3 | `gcv1-shadow` | `scientificProposeBoth`, `…AvecReservoir` | `configure`, `state`, `proposeBoth`, `toRuntimeRails` (état du module, orchestration) |
| J3 | `lot-decision` | `decideCut` (base et consignes en ombre) | `commandRails` (appelle `expectedPoses` du moteur), mémoire des appuis, caméras |
| J3 | `continuity-observer`, `hauteur-apprise`, `faux-vert-ombre` | `predict`, `translated` (internes), `evaluer` ×2 | — |
| J4 | `voie-b1-ecart`, `gcv2-l1`, `gcv2-l1e`, `gcv2-parametres-l1` (+ `voie-recentree`, `appuis-liste`, `recherche-large`) | **non portés** (≈ 1 900 lignes) | voir § 5 |

Façade de même API : `ariane-rs/coquille/facade-decision.js` (numéros 50 à 60 du cœur). Ce que le JS lit hors de ses arguments est résolu par la façade au moment de l'appel : état du module GCV1 (`Shadow.state()`), plafond du calage (`BananeSettings.conventionPlafond`), réglages globaux de `lot-decision.js`. Un `Shadow` qui n'est pas le module chargé (doublure d'essai) n'est pas envoyé : repli sur le JS, compté.

## 2. Parité (ÉTABLI)
Banc : `ariane-rs/parite/decision.cjs` (Node : `tools/ch064-parite.cjs --module decision` ; Chromium : `tools/ch064-d-chromium.cjs`). Cas : (a) **fixtures** : chaque appel venu des essais du tronc qui chargent ces modules, arguments clonés avant l'appel (`tools/ch064-d-fixtures.cjs`) ; (b) **réel** : entrées tirées des exports de banane-data des 04, 05 et 06/11 (journaux, listes d'ESV, verts à contrôler, 4 645 nuages ; décisions du lot rejouées **en chaîne**, comme le service worker) ; (c) **variantes** : chaque cas muté à graine fixe (une feuille remplacée par une valeur limite, ou retirée). Comparaison stricte (`Object.is`, ordre des clés, trous, exceptions), sortie ET arguments après l'appel.

| jalon | modules | Node 22 (cas / identiques) | Chromium 153 (cas / identiques) | mémoire linéaire WASM, haute eau |
|---|---|--:|--:|--:|
| J1 | critère, signal, deux gardes, relecture-ombre | 228 637 / 228 637 | 228 737 / 228 737 (dont 32 ne différant que par la charge d'un NaN) | 6,3 Mio |
| J2 | level-crossing, regles-metier | 88 416 / 88 416 | 87 865 / 87 865 | 6,0 Mio |
| J3 | gcv1-shadow, lot-decision, hauteur-apprise, faux-vert-ombre | 3 192 / 3 192 | 12 159 / 12 159 | 5,6 Mio |

Empreintes SHA-256 des sorties égales des deux côtés pour chaque banc (`D-parite.json`, avec l'empreinte des fichiers JS de référence). J3 : 167 appels de `decideCut` relevés dans les essais du tronc, 200 cuts réels décidés en chaîne (appuis compris), science GCV1 : 9 905 cas dans Chromium (nuages réels, fixtures et variantes). Aucune réinstanciation du cœur.

- **Replis.** Sur les fixtures et les cas réels, le cœur ne rend jamais « hors domaine » ; les seuls replis y sont les doublures de `Shadow` des essais. Les replis comptés viennent des variantes mutées (coercitions que le port laisse au JS : chaîne dans un calcul, matrice non numérique…).
- **NaN.** V8 dans Chromium rend des NaN non canoniques (mesuré : `0xFFFEFFFF_FFF6FFFF`), Rust le NaN canonique. La charge d'un NaN n'est pas observable en JS (`Object.is` les confond ; VBA ne la garantit pas) : l'empreinte Chromium les normalise des deux côtés et compte ces cas.

### Écarts trouvés et corrigés en route (ÉTABLI)
1. **`Number::toString` à égalité exacte** : 1 860 313 443 422 875,25 s'écrit « …875.2 » en V8 (ECMA-262 : chiffre pair) et « …875.3 » en Rust. Corrigé (`js::nombre_chaine`) ; sonde `tools/ch064-d-sonde-nombres.cjs` : 1 000 000 tirages dont une famille d'égalités exactes, 0 écart en Node 22 et dans Chromium 153. À verser dans `ariane-js`.
2. **`toFixed`** : à égalité exacte, ECMA-262 prend le plus grand, Rust arrondit au pair (`js::to_fixed`).
3. **`edgeOf`** exporté lisait aussi l'autre rail (le JS ne lit que le sien) : une exception levée par le port seul, sur une variante.
4. **Forme canonique VBA** : `ariane-geometrie` lit un tableau de nombres sous la forme `Nombres` ; un `Tableau` bâti en Rust y était un « delta invalide » (calage non appliqué). `js::canon`.
5. `Math.pow` (voie encadrée, `x**k`) est importé du moteur, comme les transcendantes (sonde du chef : les bits de `pow` diffèrent entre Rust et V8).

## 3. Temps et mémoire (Chromium 153, machine au repos, 15 répétitions)
Outil : `tools/ch064-d-banc-temps.cjs --rep 15 --natif`. Postes lourds : médiane par cas sur 15 répétitions, puis médiane et P90 des cas. Postes légers (≥ 100 cas) : l'horloge de la page ne descend pas sous 0,1 ms, on chronomètre 15 passages sur tous les cas (moyenne par cas de chaque passage, médiane et P90 des passages). « WASM » = façade complète : encodage VBA, traversée, calcul Rust, décodage. « Natif » = programme Rust (option B) : décodage VBA, calcul, encodage, même trame. ÉTABLI.

| poste (entrées réelles) | cas | JS du tronc, ms (méd. / P90) | Rust/WASM, ms (méd. / P90) | gain WASM | Rust natif, ms (méd. / P90) |
|---|--:|--:|--:|--:|--:|
| science GCV1 `scientificProposeBoth` (nuage complet) | 30 | 503,7 / 823,7 | 141,5 / 214,9 | ×3,6 | 155,5 / 214,0 |
| `decideCut`, chaîne tirée au hasard (presque tout en premier passage) | 30 | 1,1 / 3,2 | 1,0 / 2,8 | ≈ ×1 | 0,43 / 1,35 |
| `decideCut` qui relance la science (reprise, choix, différé avec appuis) | 30 | 597,1 / 665,4 | 176,4 / 205,7 | ×3,4 | 201,9 / 249,0 |
| `level-crossing.read` (points visibles) | 200 | 1,36 / 1,45 | 0,70 / 0,74 | ×1,9 | 0,23 / 0,62 |
| `regles-metier.surface` | 200 | 3,21 / 3,38 | 2,32 / 2,59 | ×1,4 | 0,82 / 2,54 |
| `relecture-critere.juger` | 200 | 0,0025 / 0,0035 | 0,046 / 0,066 | ×0,05 | 0,013 / 0,016 |
| `relecture-ombre.juger` | 200 | 0,0075 / 0,012 | 0,12 / 0,13 | ×0,06 | 0,035 / 0,041 |
| `relecture-ombre.selection` (partie) | 62 | 0,6 / 1,0 | 2,3 / 3,7 | ×0,26 | 1,48 / 2,16 |

- **Mémoire (ÉTABLI)** : mémoire linéaire du cœur WASM au plus haut 3,75 à 4,25 Mio sur tout le banc, aucune réinstanciation ; dans les bancs de parité (des centaines de milliers d'appels) 5,6 à 6,3 Mio. Programme natif : +3,2 Mo de RSS au-dessus du fichier de trames chargé (VmRSS 99,5 → 102,7 Mo, VmHWM 103,5 Mo, fichier compris). Le tas JS de la page n'est pas comparable poste à poste (il garde les entrées du banc) : non retenu.
- **Lecture** : le gain est dans la science GCV1 (gabarit, réservoir, A_STAR, calage : boucles sur les points) et donc dans toute décision qui la relance. Les fonctions de tenue de règles (critère, jugement, sélection) perdent en WASM : la traversée coûte plus que le calcul. Le natif ne bat pas le WASM sur la science (exp correctement arrondi en double-double, et encodage du nuage entier).

## 4. Gain par cut et par journée
Distribution des étages sur une chaîne de 600 cuts réels (même banc, ÉTABLI) : premier passage 296, choix 109, différé 105, reprise depuis la voie 50, passage à niveau 40. Une décision relance la science dans environ la moitié des cas (PROBABLE : les nuages des collections ne sont pas tous consécutifs).

- **Lot, par cut (PROBABLE)** : la science GCV1 tourne une fois par cut dans le lot Pilote (ÉTABLI : autant d'événements `gcv1-shadow-observed` que de `proposed` dans les journaux), soit −362 ms ; la relance par la décision, environ un cut sur deux, −421 ms × 0,5. Total ≈ **−0,57 s par cut du lot**, à rapporter à 2,3 à 6,7 s par cut (médiane par partie, CH-058) : **8,5 à 25 %**. Mesuré dans une page Chromium, pas dans le service worker (SUPPOSÉ équivalent : même V8).
- **Par journée (PROBABLE)** : 5 268 cuts du lot dans les journaux des 04, 05 et 06/11 (5 journaux), soit environ 1 760 par jour : ≈ **1 000 s (17 min) par journée**.
- **Relecture (SUPPOSÉ)** : le calcul n'y pèse que 7,8 % du temps d'un cut relu (CH-060) ; le gain y serait de l'ordre de 5 %, l'attente du chargement d'ESV (65 %) restant intacte.
- **Recommandation** : ne brancher (étape 4) que la science GCV1 et `decideCut` ; laisser en JS le critère, les jugements, la sélection, le signal et les gardes (plus lents en WASM, et sans enjeu de temps).

## 5. Reste à faire
- **J4** : `voie-b1-ecart` (orchestration autour de `decideCut`, mémoire à `Map`), `gcv2-l1` (1 028 lignes : hypothèses H0–H6, probabilités figées, règle L1/L1e), `gcv2-l1e`, et leurs dépendances non attribuées `voie-recentree`, `appuis-liste`, `recherche-large`. La partie lourde (science GCV1, décision du lot) est déjà portée ; le reste est surtout de la tenue de listes et de l'arithmétique.
- **Espace Cargo** : la crate n'est pas encore membre (`ariane-rs/Cargo.toml`) ni branchée dans `ariane-coeur` (bras `50..=99`) : décision du chef. Mes bancs tournent avec ces deux lignes en local, non versionnées.
- Proposés au chef pour les fondations : `nombre_chaine`, `to_fixed`, `canon`, `pow` importé.

## 6. Rejouer
- `cargo test -p ariane-decision` (13 essais) ; `cargo clippy -p ariane-decision --all-targets` : aucun avertissement.
- Fixtures : `node tools/ch064-d-fixtures.cjs` (≈ 7 min, tous les essais du tronc qui chargent ces modules). Données : clone de banane-data (`BANANE_DATA`), extrait mis en cache dans `ariane-rs/dist/`.
- Parité : `CH064D_MODULES=<modules> node tools/ch064-parite.cjs --module decision` (Node) et `node tools/ch064-d-chromium.cjs` (Chromium) ; variables `CH064D_VARIANTES`, `CH064D_GRAINE`, `CH064D_LOT_MAX`. Sonde des nombres : `tools/ch064-d-sonde-nombres.cjs [--chromium]`.
- Temps et mémoire : `node tools/ch064-d-banc-temps.cjs --rep 15 --natif` ; versement des résultats : `node tools/ch064-d-verser.cjs`.
- Tout suppose la crate membre de l'espace et le bras `50..=99` dans `ariane-coeur` (§ 5).
