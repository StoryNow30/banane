# CH-098 : rapport — qui retient la mémoire de la page pendant un lot long

**Verdict : sur la maquette, Ariane ne retient rien coupe après coupe dans la page (ÉTABLI). La montée de 0,66 Mo/cut vue sur le terrain ne vient pas de ce que la maquette reproduit : sa cause reste SUPPOSÉE du côté d'ESV, de Potree ou des outils de développement du navigateur. Rien n'est corrigé ; le relevé de console est livré.**

## Protocole
- `tools/ch098-memoire.cjs` : l'extension du dépôt chargée dans Chromium, l'hôte d'ESV routé vers la maquette en mode mémoire de Potree (`ept=1&eptHier=1&eptForme=commun&eptPas=7&eptMemoire=1`, LRU bornée à 300 000 points : sur le terrain, Potree garde un nombre stable de points). Le lot Orbite est lancé par le panneau, puis vient la relecture en ombre. Toutes les 50 coupes chargées, deux ramasse-miettes forcés puis `Runtime.getHeapUsage`, par le protocole de débogage, dans la page et dans le service worker. Référence : la même maquette sans extension, parcourue avec « valider et suivant ».
- Instantané du tas au début et à la fin, résumé par constructeur ; chemins de rétention par `tools/ch098-retenants.cjs`. Une seule page Chromium à la fois, sur une machine au repos.

## Courbes (tas après ramasse-miettes, Mo ; ÉTABLI sur la maquette)
| Coupes chargées | 0 | 50 | 100 | 150 | 200 | 250 | Pente 50→200 |
|---|---|---|---|---|---|---|---|
| Page, avec extension (lot) | 36,5 | 46,0 | 53,4 | 60,7 | 68,0 | 76,0 | **0,147 Mo/cut** |
| Page, sans extension | 31,9 | 38,6 | 45,9 | 53,2 | 60,5 | 67,7 | **0,146 Mo/cut** |
| Service worker (lot) | 2,6 | 6,8 | 7,9 | 9,1 | 10,3 | 11,3 | 0,023 Mo/cut |

- 2e passage avec extension (202 coupes, instantané) : 40,7 → 62,8 Mo entre 50 et 202 coupes, soit 0,145 Mo/cut.
- Relecture après le lot (388 visites, 655 chargements en tout) : page 77,9 → 97,5 Mo, soit 0,05 Mo par visite (des coupes déjà vues, déjà dans le cache de la maquette). Service worker à plat : 12,1 → 12,4 Mo.
- Géométries de Potree stables pendant le lot : 147 nœuds portent une géométrie, 2,2 Mo.

## Le retenant
- **Dans la maquette (ÉTABLI, instantané sans extension)** : son propre cache des nœuds par coupe, `cacheNoeuds` dans `tests/esv-maquette/esv-maquette.js` (« nœuds gardés en cache ensuite »), avec les positions des points (105 à 125 Ko par coupe) et les contours des rails (14,8 Mo pour la partie). C'est toute la pente de la maquette. Il n'existe pas sur ESV.
- **Ariane dans la page (ÉTABLI)** : même pente qu'en son absence, à 0,001 Mo/cut près. Entre les instantanés, ce qu'il y a en plus avec l'extension est un coût fixe, payé une fois à l'injection et non par coupe : code compilé +1,5 Mo, sources des scripts +1,4 Mo, tampons +1,8 Mo (module wasm compris). Les chemins de rétention des tableaux sont identiques avec et sans extension. La lecture du code va dans le même sens : les structures de page d'Ariane sont bornées (anneau de l'observateur, `ecrituresValides` à 16, `clesEchec` à 64, `bloques` et `volNous` vidés au-delà de 64, `propres` et `nosCles` remis à zéro au-delà de 2 000 et 4 000). Une seule ne l'est pas : `invokedOperations` (`src/adapter-page.js`, ligne 35), soit une entrée de quelques dizaines d'octets par opération, invisible à cette échelle.
- **Service worker** : +0,023 Mo/cut pendant le lot (le journal du lot, tenu en mémoire), à plat pendant la relecture. C'est un autre processus : il ne compte pas dans le tas de la page que lit la garde `tasMaxMo`.
- **Outils de développement (ÉTABLI sur la maquette, SUPPOSÉ sur le terrain)** : quand le domaine réseau du protocole de débogage est ouvert, le navigateur garde les données des requêtes de la page (`NetworkResourcesData`, `XHRReplayData` : 1 465 entrées, 0,5 Mo ici). Si la console (F12) reste ouverte pendant un lot sur ESV, les réponses des nœuds de points pourraient y être gardées (non mesuré).

## Ce qui reste SUPPOSÉ pour ESV réel
- Que la montée de 0,66 Mo/cut vienne d'ESV ou de Potree (caches, géométries hors LRU, rendu) : elle existe aussi en Écho sans lot (450 Mo après 17 min), et Ariane n'y ajoute rien sur la maquette. Le relevé de console est fait pour trancher : la géométrie des nœuds, les nœuds de scène, `renderer.info.memory`, les objets de scène et le DOM, comparés au tas entre deux collages.
- Que la console ouverte y contribue : à vérifier en fermant F12 entre les deux collages.

## Relevé de console (livré)
`chantiers/CH-098/releve-console.js` : à coller au début, puis à la fin d'un lot, dans la même page sans la recharger. Il est en lecture seule (aucune requête, aucun clic, aucun appel à ESV ni à Potree) et n'écrit que sa propre variable. Il ne rend que des nombres et, au second collage, l'écart avec le premier. Essai : `node --test tests/ch098-releve-console.test.cjs` (2/2, dans une vm, page gelée : toute écriture lèverait).

## `tasMaxMo` (non touché ; décision de l'intégrateur et de l'opérateur)
La garde coupe le préchauffage à cause d'une mémoire que le préchauffage ne retient pas (sur la maquette, la phase mémoire ne laisse pas de géométrie hors LRU). Chiffres du ticket : 570 Mo au départ, +0,66 Mo/cut ; 1 536 Mo sont atteints après environ 1 460 coupes, et la limite du navigateur est à 4 192 Mo. Deux voies à peser :
1. garder sur la **montée depuis le début du lot** (Δ tas) plutôt que sur le tas absolu ;
2. relever le seuil absolu vers 2 560 Mo, soit 61 % de la limite, ce qui laisse 1 630 Mo de marge.

Avant l'une ou l'autre, il faut le relevé de console du terrain.

## Fichiers
`tools/ch098-memoire.cjs` (banc), `tools/ch098-retenants.cjs` (chemins de rétention), `chantiers/CH-098/releve-console.js`, `tests/ch098-releve-console.test.cjs`. Aucun fichier protégé n'est modifié et aucun patch n'est livré. Le verify et la maquette complets n'ont pas été relancés : il n'y a pas de correction.
