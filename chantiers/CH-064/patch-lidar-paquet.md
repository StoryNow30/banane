# CH-064, étape 6 a — Lecture LiDAR en Rust dans le paquet : note du patch (D-296) — PRÊT

**Patch** : `chantiers/CH-064/patch-lidar-paquet.patch`, base du tronc **c30acbb** (s'applique aussi sur **b529227**, qui n'ajoute que `DECISIONS.md`), 11 fichiers ; identique à l'arbre essayé. Coquille et module de `chantier/CH-064` à **65036e1**. `manifest.json` est intact : le WASM tourne dans la page ESV, qui n'a ni en-tête ni balise CSP (relevé de l'opérateur, PROBABLE).

## Ce que fait le patch
- **Fichiers de page fabriqués**, jamais écrits à la main (`tools/rust-lidar-paquet.cjs --construire`, contrôlé par `--verifier`) :
  - `vendor/ariane-lidar.js` : la coquille, copie conforme de `ariane-rs/crates/ariane-lidar/js/lidar-wasm.js` ;
  - `vendor/ariane-lidar-wasm.js` : le module `ariane_lidar.wasm` en base64, avec son SHA-256 et sa taille ;
  - `vendor/lidar-rust.js` : la variante de `vendor/lidar.js` (même texte, plus une branche et la file des captures), sous `BananeLidarRust`. **`vendor/lidar.js` n'est pas modifié.**
- `src/lidar-rust.js` : le chargeur. Il compile le module une fois, puis installe le noyau. Il ne lève jamais : sans module, si la page refuse la compilation, ou si l'arène est désaccordée, il n'y a pas de noyau, et la raison est dite.
- `background.js` : les quatre fichiers sont ajoutés à `PAGE_FILES` après `vendor/lidar.js`. L'étape `rust` de la page devient l'événement de journal `rust`.
- `src/adapter-page.js` : il lit par la variante si `BananeSettings.rust.lidar` est vrai et que le noyau est chargé, sinon par `vendor/lidar.js`. Après chaque lecture, l'étape `rust` donne `servi`, `repli`, `raison`, `tranchesWasm`, `tranchesRejouees` et `noeudsOrigine` (par raison).
- `src/settings.js` : `rust: { lidar: true }`, allumé par défaut (D-296) ; `false` rend la lecture d'origine.
- `tools/package.py` : le paquet refuse de se construire si les fichiers fabriqués ne sont pas à jour.
- Essais : `tests/rust-lidar.test.cjs` (nouveau) et `tests/pose-lot-inchanges-4959.test.cjs` (déclaration du patch et fonction de retrait).

## Replis (la sortie de `capture()` reste identique au bit près à celle de `vendor/lidar.js`)
- **Nœud non éligible** : la boucle d'origine. C'est le cas d'un nœud indexé, normalisé, Float16, aux réglages non numériques, ou dont l'accesseur n'est pas authentifié.
- **Accesseurs.** La lecture directe du tableau n'est prise que dans deux cas :
  - sans accesseur `getX`, `getY`, `getZ` (cas de la maquette) ;
  - avec des accesseurs **authentifiés comme ceux de three.js r124**. Il faut alors à la fois : une valeur lue par descripteur ; un texte exact, dans la liste blanche ; l'identité avec l'instantané pris au chargement et avec le `THREE` courant ; les sondes comme seconde garde.

  Tout autre accesseur ne reçoit aucun appel de la coquille, et le nœud passe par la boucle d'origine.
- **Trappe du module, ou tranche refusée** : instance neuve, état d'avant l'appel rendu, tranche rejouée par le noyau JS équivalent. Les tranches suivantes repartent dans le WASM.
- **Captures simultanées** : une file les sérialise sur tout leur parcours. Le journal du 05/11 n'en montre aucune (2 711 captures, ÉTABLI).

## Limites assumées
- **Liste blanche** : three.js r124, relevé dans le source de Potree 1.8.0 à 1.8.2. ESV charge Potree 1.8.0 (relevé de CH-062). Si ESV n'expose pas `THREE` en global, ses accesseurs ne sont pas authentifiés : le Rust ne sert pas, et l'événement `rust` dit « accesseur inconnu ». Le relevé de l'opérateur (`typeof THREE`, `THREE.REVISION`, `THREE.BufferAttribute.prototype.getX.toString()`) le tranchera.
- **`Function.prototype.toString`** : une page qui le réécrirait avant l'injection, pour se faire passer pour three.js, sort de ce modèle. ESV n'a aucune raison de le faire.
- **`Date.now`** : l'horloge du budget de 15 s est lue avant chaque tranche (au plus 4 096 points), pas avant chaque point. Le résultat ne diffère que si ce budget est atteint (connu depuis CH-061).

## Preuves
| preuve | résultat |
|---|---|
| parité de L, corpus entier (4 647 captures réelles du 04 au 06/11, 9 294 vues, 4,29 milliards de points, 22 cas synthétiques), sur 65036e1 | **Node : 9 316 / 9 316**, 1 131 019 tranches au noyau (`L/parite-node.json`) ; **Chromium 153 : 4 600 captures identiques** (passe arrêtée par la limite de temps de 2 h : `L/parite-chromium-avancement.txt`), puis les 47 dernières et les 22 cas synthétiques, **116 / 116** (`L/parite-chromium-fin.json`) |
| essais LiDAR (audits de la PR n° 25 : P1, P2, P3, 01846d1, 53c7885, 906ec78, 1f78142 ; trappe) | 15/15 |
| `tests/rust-lidar.test.cjs`, `pose-lot-inchanges-4959` sur c30acbb + patch | 6/6 et 6/6 |
| essais du tronc qui lisent l'adaptateur, le service worker ou les réglages (122 fichiers, base 82a8312) | 796/796 |
| parité de la relecture (`tools/parite-relecture-sw.cjs`, contre le tronc intact) | identique (relevés SHA-256 9984fe77…) |
| rejeu de la partie 13, tronc contre tronc patché (base 82a8312, coquille d'avant 65036e1) | 76 commandes identiques octet pour octet, 18 cuts posés de chaque côté, seule différence l'événement `rust` (un par cut) |
| rejeu de la partie 13 avec le paquet final (c30acbb + patch) | non refait (consigne d'économie de l'intégrateur). Depuis le rejeu ci-dessus, seule la règle des accesseurs a changé ; les attributs de la maquette n'en ont pas : ils passent par le même chemin direct |
| maquette complète au repos (c30acbb + patch) | **73 / 74** (2 sautés) ; seul échec : `correction-signal` |
| `correction-signal` seul, au repos, 4 fois de chaque côté (c30acbb) | avec le patch : 2 échecs sur 4 ; sans le patch : 2 échecs sur 4. Instable sans le patch aussi (ÉTABLI). Sur les deux séries : 3 sur 8 de chaque côté |
| lot de 3 cuts sur la maquette | 6 lectures servies par le Rust, sans repli |

Parité L1se : non lancée. Elle demande des données de lot précises, et le patch ne touche aucun fichier de décision.
