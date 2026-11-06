# CH-061 — Ariane en Rust : gains réels, poste par poste (rapport, 06/11/2026)

**Méthode.** Prototypes Rust compilés en WebAssembly brut (`rust/`, rustc 1.97, cible `wasm32-unknown-unknown`, sans wasm-bindgen ; dépendances : `miniz_oxide`, `serde_json`). Bancs dans un vrai Chromium 153 (`/opt/pw-browsers/chromium`), sur données réelles de `banane-data` (journal de lot du 05/11, nuages capturés du corpus GCV1). Chaque variante est comparée à **trois** références : le JS d'origine, le **même algorithme réécrit en JS** (tableaux typés, sans allocation) et le Rust. C'est la seule façon de séparer ce qui revient au langage de ce qui revient au code.

## 1. Où part le temps (journal du 05/11, 829 cuts de lot et 1 835 cuts relus, 6 276 s de cuts) — ÉTABLI
- **Cut de lot** : 2,82 s en médiane, dont capture 1,93 s (attente du niveau de détail d'ESV, puis lecture), analyse 212 ms (dont géométrie 73 ms ; le reste : messages, lecture du nuage dans IndexedDB, journal).
- **Lecture des points** (boucle par point de `vendor/lidar.js`, dans la page ESV) : 190 ms par vue en mode rapide (4 867 vues, 954 s), 819 ms en mode référence (552 vues, 471 s). Soit **23 % des 6 276 s**. Tout le reste est l'attente d'ESV (65 % de la relecture selon CH-060), la navigation, IndexedDB et les messages.

## 2. Tableau poste par poste (Chromium, médianes à chaud ; fichiers dans `resultats/`)
| Poste | JS aujourd'hui | Même algorithme en JS | Rust/WASM | Part de la journée | Gain réel pour l'opérateur |
|---|--:|--:|--:|--:|---|
| **Lecture LiDAR, rapide** (505 000 pts/vue, 19 nœuds, points réels + remplissage ; `banc-lidar.json`) | **196,5 ms**/vue (terrain : 190) | 45,3 ms | **18,3 ms** (copie du tampon : 0,8 ms) | 15,2 % | JS : −734 s/jour ; **Rust : −865 s/jour** (≈ −345 ms/cut). PROBABLE (rapport du banc appliqué au terrain) |
| Lecture LiDAR, référence (pauses `setTimeout(0)`) | 769 ms (terrain : 819) | 612 ms | 580 ms | 7,5 % | Rust : −116 s/jour. **Les 4 ms par pause du navigateur font ≈ 560 ms** : c'est un réglage de pause, pas un langage |
| **Géométrie** (façade `proposeBoth`, 300 nuages ; `banc-geometrie.json`) | **34,9 ms**/nuage (terrain : 73) | 36,1 ms ; **élagué : 9,4 ms** | 22,4 ms ; SIMD 20,4 ; **élagué : 8,4 ms** | 1,4 % | JS élagué : −66 s/jour ; Rust élagué : −68 s/jour. Le gain vient de l'**élagage** (points triés, fenêtre de 26 mm), pas de Rust |
| Décision du lot, GCV2, relecture-ombre (calcul) | 70 ms/cut relu (calcul, total 154 s) | non prototypé | non prototypé | 2,5 % | Au plus ≈ −120 s/jour s'il se comporte comme la géométrie. SUPPOSÉ |
| État, `save()` (état réel du journal, 2,1 Mo) | `JSON.stringify` 13,4 ms, `structuredClone` 7,6 ms ; `save()` 6-7 ms après CH-059 | — | aucun accès à `chrome.storage` : sérialisation par Chrome (C++) | < 1 % | **Nul.** Le gain réel était dans CH-059 (146 → 7 ms) |
| Journal, index, IndexedDB | lecture de session 0,8-0,9 s après CH-058 | — | aucun accès à IndexedDB hors JS | — | **Nul.** Le gain réel était dans CH-058 (4,8 s → 0,001 s par étape) |
| Export : JSON de 75 Mo (`banc-export.json`) | parse 318 + stringify 597 ms | — | serde_json 718 ms + traversée 259 ms = 976 ms ; **sortie non identique** | export | **Perte** (+61 ms) |
| Export : deflate de 75 Mo | `CompressionStream` 1 097 ms, 13,8 Mo | — | miniz_oxide niv. 6 : 1 827 ms, 14,1 Mo ; niv. 1 : 440 ms mais 21,5 Mo | export | **Perte** (le deflate de Chrome est déjà natif) |
| CRC-32 de 75 Mo | 177 ms | — | 174 ms | export | Nul |
| Démarrage du service worker (`banc-demarrage.json`) | 47 scripts (1,48 Mo) évalués en 24 ms ; tas 2,4 Mo | — | module de 134 Ko : compilation 6,3 ms, mémoire initiale 1,1 Mo | — | Nul. La construction de l'index (0,6-3,4 s, CH-058) est d'IndexedDB |

**Total mesuré (lecture rapide, lecture référence, géométrie), sur la journée du 05/11** :
- réécriture **ciblée en JS** : −896 s, soit **14,3 %** du temps des cuts ;
- réécriture **ciblée en Rust** : −1 049 s, soit **16,7 %** ;
- **part propre à Rust : −153 s, soit 2,4 %**, presque toute sur la lecture rapide (45 → 18 ms par vue).

Une réécriture complète n'ajoute rien de mesurable : les 83 % restants sont l'attente d'ESV, IndexedDB, les messages Chrome et le code natif du navigateur (PROBABLE).

## 3. Mémoire — ÉTABLI sauf mention
- **Page ESV** : 598 Mo de tas en médiane, 1,49 Go au maximum (`memMo` du journal). C'est Potree, pas Ariane : aucun langage côté Ariane n'y change rien.
- **Une capture** (5 372 points retenus) : 579 Ko de tas JS, environ 108 octets par point (tableaux de tableaux). En tableaux typés : environ 24 octets par point, **dans les deux langages**. C'est un changement de format, d'export et de parité, pas de langage.
- **Panneau** (835 Mo le 05/11) : dû aux lectures complètes d'IndexedDB, déjà corrigé par CH-058 (214 → 60 Mo au banc).
- **Coût de WASM** : 1,1 Mo de mémoire linéaire au départ. Cette mémoire **ne rend jamais rien** au système : après l'aller-retour JSON de 75 Mo, 769 Mo restent réservés jusqu'à la mort du service worker. Pour une réécriture qui manipule le journal ou l'export, c'est une **perte nette de RAM**.

## 4. Traversée JS ↔ WASM — ÉTABLI
- Appel vide : 5,6 ns, contre 2 ns pour un appel JS.
- Copie de 8 Mo dans la mémoire WASM : 0,8 ms.
- Chaîne UTF-8 de 75 Mo : 379 ms pour l'encoder, 244 ms pour la décoder. **C'est elle qui tue serde_json.**
- Conclusion : WASM gagne sur des boucles numériques longues alimentées par un tampon (le LiDAR) ; il perd dès qu'il faut traverser des objets ou des chaînes.

## 5. Ce qui ne peut pas être en Rust dans l'extension — ÉTABLI (`banc-csp.json`, vraie extension MV3)
- **Service worker** : WebAssembly est **refusé** sous la CSP MV3 par défaut. Il faut `'wasm-unsafe-eval'` dans `content_security_policy.extension_pages` de `manifest.json` (fichier interdit à un exécutant : décision de l'intégrateur).
- **Page ESV**, où tourne la lecture du LiDAR : le monde MAIN **et le monde isolé** suivent la CSP de la page. Sous `script-src 'self'`, WASM est refusé ; sans CSP, ou avec `'wasm-unsafe-eval'`, il passe. **La CSP réelle d'ESV n'est pas mesurée ici** (SUPPOSÉ inconnue). Une lecture en lecture seule des en-têtes de réponse d'ESV la tranche. Sans elle, le seul poste où Rust gagne vraiment est inaccessible.
- **Toujours en JS, par nature** :
  - objets Potree et Three.js, matrices, boutons et DOM d'ESV (`adapter-page.js`, 1 546 lignes, et les modules de page : 3 070 lignes) ;
  - `chrome.*` (storage, messages, téléchargements), IndexedDB, `CompressionStream` ;
  - le panneau (3 233 lignes d'interface).
- Rust y passerait par une colle JS (wasm-bindgen ou web-sys), sans gain.

## 6. Réécriture complète contre réécriture ciblée — SUPPOSÉ (estimation, pas une mesure)
- **Complète** : environ 24 000 lignes de JS (`src/`, `background.js`, panneau).
  - Au moins 6 300 lignes ne quittent pas le JS (page : 3 070 ; panneau : 3 233), plus l'essentiel de `background.js` (4 483 lignes, surtout `chrome.*` et messages).
  - Les 3 700 lignes de décision et de géométrie, puis l'Engine, devraient prouver l'**identité au bit** contre 3 166 essais et la garde, sur 618 fichiers d'essai écrits pour le JS.
  - Elle demande `'wasm-unsafe-eval'` et une CSP d'ESV favorable.
  - Gain mesurable au-delà de la ciblée : environ 0 %.
- **Ciblée** : deux noyaux suffisent à prendre 100 % du gain mesuré.
  - Lecture LiDAR : environ 150 lignes, plus la colle.
  - `search` de la géométrie : environ 60 lignes.
  - Prototypes faits ici, en moins d'une journée de travail d'agent.

## 7. Risques
- **Identité des poses au millimètre** : ÉTABLIE ici pour les deux noyaux.
  - Géométrie : même SHA-256 des sorties sur **865 nuages réels**, 1 730 rails (1 082 candidats), cinq variantes (`parite-geometrie.json`).
  - Lecture : sortie de `capture()` identique champ par champ sur 8 nuages × 3 variantes.
  - Conditions : même ordre des opérations flottantes, pas de FMA, et un **`Math.hypot` reproduit à l'identique de V8**. `f64::hypot` de Rust (libm) n'est pas garanti au dernier bit.
  - Toute fonction transcendante (`exp`, `atan2`, `pow` non entier) devrait être portée de la même façon (fdlibm de V8) : risque fort sur une réécriture complète.
- **Preuve de non-régression** : la parité ne vaut que sur les entrées essayées. Un noyau ciblé se garde par un essai de parité sur le corpus réel (outil livré). Une réécriture complète doit reconstruire la garde GCV2, la parité de la relecture et la maquette.
- **Écart connu du prototype de lecture** : le budget de 15 s (`maxMillis`) y est contrôlé par tranche de 4 096 points, et non à chaque point.
- **Mesure** : banc sur la machine d'essai, pas sur le poste de l'opérateur. Les rapports de vitesse valent (PROBABLE), pas les chiffres absolus. La scène de lecture est factice autour de points réels, aux volumes du terrain.

## 8. Recommandation
1. **Ne pas réécrire Ariane en Rust.** Le gain propre au langage est de 2,4 % de la journée, sur un seul poste, et il n'est atteignable que si la CSP d'ESV le permet. Partout ailleurs (état, journal, export, démarrage), Rust est nul ou perd, en temps comme en RAM.
2. **Prendre les 14 % en JS, sans Rust**, par deux réécritures ciblées. Ce sont des modules interdits aux exécutants : décision de l'intégrateur, avec garde et parité.
   - La boucle de lecture de `vendor/lidar.js` sur le tampon Float32, comme le fait déjà le chemin rapide de `native-lidar.js` : −290 ms par cut.
   - L'élagage exact de `search` dans `src/geometry.js` : −25 à −55 ms par cut.
   - Les prototypes et leurs essais de parité sont prêts (`bancs/`).
3. **Si l'opérateur veut le dernier facteur 2,5 sur la lecture** : vérifier la CSP d'ESV, puis brancher le seul noyau Rust de lecture, derrière un réglage coupé et un repli JS. −53 ms de plus par cut.
4. **Hors Rust, à trancher** : les pauses `setTimeout(0)` de la lecture « référence » coûtent environ 570 ms par vue, soit ≈ 310 s sur le 05/11 (PROBABLE : 552 vues × écart banc entre pauses et calcul). Elles font partie du protocole de comparaison : décision de l'opérateur.

## Reproduire
Voir `bancs/LISEZMOI.md`. Données : `BANANE_DATA=<clone de banane-data>` ; binaires WASM reconstruits par `cargo build` (non versionnés).
