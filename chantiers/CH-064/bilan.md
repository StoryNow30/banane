# CH-064 — Bilan de l'étape 5, pour décision de l'opérateur (06/11/2026)

Les faits seulement ; la recommandation sur le paquet est portée par l'intégrateur. Mesures dans Chromium 153, machine au repos, nuages et journaux réels (détail et fichiers : `temps-par-cut.md`, `banc-temps*.json`, `banc-shadow.json`, `appels-shadow-p13.json`, `L-rapport.md`). « Élagué » : le JS réécrit sans changer de résultat (CH-061, CH-065), identique au tronc sur 200 nuages sur 200.

## 1. Temps de calcul par cut de lot (ms) — par appel ÉTABLI, par cut PROBABLE (appels × médianes)
| | JS du tronc | tout en JS élagué | tout en WASM | JS élagué + LiDAR en WASM |
|---|--:|--:|--:|--:|
| géométrie (V4.6 3,4 appels, GCV1 2,5, calage 8,8) | 308 | 79 | 151 | 79 |
| lecture LiDAR (2,0 vues ; chiffres de L : 410 / 48 / 24 ms par vue) | 833 | 98 | 49 | 49 |
| science GCV1 `scientificProposeBoth` (0,21 appel par cut, rejeu de la partie 13, ÉTABLI) | 18 | ≈ 10 | ≈ 5 | ≈ 10 |
| **total** | **≈ 1 160** | **≈ 187** | **≈ 205** | **≈ 138** |

- **Par appel** (ms) : V4.6 58,2 / 12,5 / 24,3 ; GCV1 42,3 / 13,0 / 23,7 ; `scientificProposeBoth` 491 / 280 / **145** ; LiDAR rapide (L) 280,6 / 36,9 / 19,1.
- La mesure de D (713 contre 152 ms) était par appel, sur une machine chargée. Au repos : 491 ms en JS, 145 ms en WASM. Le lot ne l'appelle que 5 fois sur 24 cuts.
- **Relecture** : `relectureCalculer` (`background.js:3734`) appelle `scientificProposeBoth` à chaque cut relu (lu dans le code, non rejoué). Cela ferait 491 / 280 / 145 ms par cut relu (SUPPOSÉ : nombre d'appels non mesuré en relecture).

## 2. Part du terrain
- Cut de lot : 2,82 s en médiane le 05/11 (CH-061) ; 2,36 s par cut sur toute la journée (6 276 s, 2 664 cuts, ÉTABLI) ; rejeu de la partie 13 : 3,40 s par cut.
- La géométrie du tronc fait **9 %** d'un cut rejoué, 2,3 % une fois élaguée. Le lot rejoué en WASM a duré 0,5 s de moins sur 24 cuts (−3,8 s attendus). Cet écart reste dans la dispersion des lots JS (1,9 s) : le calcul se fait en partie pendant les attentes (PROBABLE).
- Estimation de L (PROBABLE) : lecture −354 ms par cut de lot, ≈ −1 010 s par jour.

## 3. Gain propre au Rust contre gain de l'élagage JS
- **Élagage JS : ≈ −970 ms par cut de lot** (géométrie −229, LiDAR −735), sans Rust.
- **Rust en plus de l'élagage : ≈ −49 ms par cut de lot**, sur la seule lecture LiDAR, soit ≈ 2 % d'un cut de terrain et ≈ −72 s par jour (L). Sur la géométrie, le WASM est plus lent que le JS élagué (V4.6 24,3 contre 12,5 ms ; GCV1 23,7 contre 13,0).
- **Seul autre poste où le Rust gagne nettement** : `scientificProposeBoth`, −135 ms par appel face au JS élagué. Dans le lot, c'est ≈ −5 ms par cut. En relecture, ce serait −135 ms par cut relu si l'appel est bien unique par cut (SUPPOSÉ, à rejouer).

## 4. Levier séparé, hors Rust : les pauses de la lecture « référence » (décision de l'opérateur)
- **Ce que c'est.** 133 pauses `setTimeout(0)` par vue, ≈ 554 ms par vue (L). Elles n'attendent pas ESV : c'est le plancher des minuteries imbriquées.
- **Combien.** Le 05/11 : **277 captures sur 2 711 (10,2 %), 553 vues** (journal du lot, ÉTABLI).
- **Dans quels cas.** C'est l'échantillon de surveillance de D-091 (règle `echantillon`, consignée sur chaque capture). Le choix est fait par `lectureDuCut` dans `src/adapter-page.js`, sur le numéro du cut. 87 % des captures suivent ce tirage tel que je le recalcule ; la cause des autres n'est pas établie.
- **Gain** si la lecture « référence » passait aussi par `yieldToPage` : ≈ −1,1 s par capture en référence, ≈ −0,11 s par capture en moyenne, ≈ −306 s le 05/11 (PROBABLE).
- **Raison de les garder** : D-091 garde un cut sur dix « en référence pour surveiller la qualité », comme témoin du comportement d'avant, et prévoit de réduire ou supprimer cet échantillon « avec le temps et la confiance ». Le réglage se trouve dans `src/adapter-page.js:311` (pause passée seulement en rapide), la pause par défaut dans `vendor/lidar.js:167` : deux fichiers gelés. Non codé.

## 5. Coût de maintenance
- **Deux implémentations à tenir au bit près.** Environ 11 500 lignes de Rust : chef 2 772, L 592, D 3 412, E 4 767 ; J4 en plus. S'y ajoutent les coquilles et les façades en JS, et les bancs de parité.
- **Chaque changement du tronc** dans un module porté demande le même changement en Rust, puis la parité sur le corpus réel, en Node et dans Chromium. Les outils `tools/ch064-*` en tiennent la liste ; `tools/ch064-essais.cjs --rapide` les passe en quelques minutes.
- **Dépendance au moteur.** Les fonctions transcendantes sont importées du moteur JS (elles changent d'une version de V8 à l'autre) ; `hypot`, `round`, `max`, `min` et `Number::toString` sont réécrits pour suivre V8.
- **Taille.** Le cœur passe de 280 Ko à 882 Ko avec la décision de D. Le module LiDAR fait 39 Ko.
- **Défauts trouvés par les essais du Rust**, tous corrigés :
  - pathologie mémoire de dlmalloc : un ramasse-miettes complet à chaque croissance ;
  - mémoire fixe héritée par le cœur d'une dépendance ;
  - trappe LiDAR qui faisait échouer le cut ;
  - clés NaN chez D (signalé à D).

## 6. Ce qui serait prêt à remplacer le JS (prêt = parité au bit sur le corpus réel ET rejeu d'un lot réel identique)
| module | parité réelle | rejeu identique | état |
|---|---|---|---|
| V4.6, GCV1, calage, jauge, capture-core | oui (tous les nuages réels, Node et Chromium) | oui : partie 13, 76 commandes octet pour octet | prêt techniquement ; plus lent que le JS élagué pour V4.6 et GCV1 |
| lecture LiDAR (boucle de `capture()`) | oui : 9 316 sur 9 316 (L) ; trappe reprise | non : la maquette ne passe pas par la copie WASM | rejeu à faire |
| décision J1–J3 (D), état et journal (E) | parité annoncée par les équipes, sur leurs branches | non | pas fusionnés |
| J4 (CH-068), lots 200 à 549 | — | — | à faire (inventaire : 56,5 % du calcul pur porté ou en cours, en octets) |

Le JS reste la production ; rien du Rust n'est dans le paquet.
