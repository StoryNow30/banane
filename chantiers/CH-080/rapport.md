# CH-080 — Rapport : préchauffer la coupe suivante quand elle est éloignée (D-309)

**Livré** (branche `chantier/CH-080`) :
- `src/prechauffage.js` : source de la coupe suivante, seuil `sautMin`, lecture de la hiérarchie EPT de la zone lointaine (`hierarchie`), événement enrichi de `saut`, `source`, `hierarchies` et `deduits` ;
- `src/esv-observer.js` : la demande `voisins` rend au plus UNE ligne de plus (`loin`), et le relais garde `saut` et `source` ;
- `background.js` : la cible est jointe aux captures de la relecture et de la passe des différés, jamais à celles du lot ; le relais suit ;
- `src/settings.js` : `sautMin: 11`, `hierarchie: true`, `hierarchiesMax: 8` ;
- `chantiers/CH-080/adapter-page.patch`, **à appliquer par l'intégrateur** ;
- maquette : options `saut` (N coupes validées entre deux coupes à faire) et `eptHier` (hiérarchie lue dans des fichiers `ept-hierarchy`, pas de 2 niveaux, comme Potree 1.8) ; banc `tools/ch080-banc.cjs` (sortie `banc.json`).

## Cause du `sans-suivante` (ÉTABLI, script sur le journal du 09/11)
Le préchauffage ne recevait qu'une fenêtre de ±10 lignes de la table B1.
- 932 fois sur 990 pendant la relecture. Elle relit des cuts déjà valides, et c'est le service worker qui choisit le suivant.
- 58 fois pendant le lot, dont 54 sauts de plus de 10 coupes.

Détail dans `etude.md`.

## Source retenue
- **Lot** : première ligne non validée après le cut dans TOUTE la liste d'ESV (source `liste-esv`). Cette règle prédit 507 passages du lot sur 513. PROBABLE : les statuts au moment du passage sont reconstitués. Rien ne part du service worker : les commandes du lot restent identiques à l'octet (`choix-lot-clic-sw` vert).
- **Relecture** (`relu`) et **passe des différés** (`passe-differes`) : le service worker joint `prechauffage` {part, de, cut, source, op} à SA capture. La page n'accepte cette cible que si `part` et `de` sont ceux de cette capture ; sinon `indice-perime` et rien n'est demandé. Le nom `relu` vient de la règle R7 : aucune chaîne « relecture » ne part vers la page.
- **Dernier recours** : la fenêtre B1 (`b1-fenetre`), quand l'adaptateur ou l'observateur n'a pas CH-080.
- Les plafonds ne changent pas (24 nœuds, 8 Mo, 2 en vol). L'annulation au début de chaque capture et l'identité d'opération sont celles de CH-077.

## Hiérarchie de la zone lointaine (étape demandée par l'intégrateur)
- Pour une coupe lointaine, Potree ne connaît que le haut de l'arbre. Les nœuds de frontière (`numPoints` −1, sans enfants connus) cachent le reste.
- Le préchauffage lit d'abord le fichier de hiérarchie de chaque frontière de la zone : `<ept.url>ept-hierarchy/<clé>.json`, l'adresse et la requête de `loadHierarchy` de Potree 1.8 (fetch GET, cache par défaut).
- Il en **déduit** les clés de la zone : arithmétique D-X-Y-Z, et boîte de la frontière coupée en deux à chaque niveau, jusqu'à `niveauMax`. Les sous-hiérarchies de la zone (−1) sont lues au tour suivant.
- Il demande ensuite les données, du moins profond au plus profond.
- Rien n'est greffé à l'arbre de Potree. Le fichier et les clés vivent dans la fermeture de l'opération et sont oubliés avec elle.
- Les fichiers de hiérarchie comptent dans `noeudsMax` et `octetsMax`, avec au plus `hierarchiesMax` (8) fichiers par opération. L'annulation est la même que pour les données.

## Seuil : `sautMin` = 11 (PROBABLE)
- Sous 11 coupes, la sélection n'a trouvé aucun nœud à demander, dans 447 cas sur 447 du lot.
- Capture médiane (cuts non différés) : 0,62 s pour la voisine ; 2,6 à 3,2 s de 11 à 50 coupes ; 5,3 s au-delà de 200.
- Clé absente du réglage : 1, soit le comportement de CH-077.

**Piste suivante, non traitée ici.** Les sauts de 2 à 10 coupes prennent 1,2 à 2,5 s. Potree y charge 4 nœuds en médiane que le cube de 0,75 m autour des rails ne voit pas (la sélection les trouvait tous déjà chargés).

## Banc (maquette, hiérarchie en fichiers, saut de 50 coupes, latence 60 ms par requête, 15 répétitions, charge 0,36 ; médiane / P90, ÉTABLI sur la maquette)
| Mode | Validation → aucun chargement | Chaîne de la coupe suivante | Nœuds servis par le cache | Hiérarchies servies par le cache | Requêtes de données au serveur | Capture du cut en cours |
|---|---|---|---|---|---|---|
| sans (fenêtre ±10) | 798 / 829 ms | 676 / 705 ms | 0 / 32 | 0 / 10 | 32 | 2 250 / 2 392 ms |
| avec, hiérarchie éteinte | 802 / 814 ms | 674 / 691 ms | 2 / 32 | 0 / 10 | 32 | 2 256 / 2 433 ms |
| **avec (livré)** | **551 / 569 ms (−31 %)** | **423 / 446 ms (−37 %)** | **10 / 32** | **6 / 10** | 38 (+6) | 2 259 / 2 322 ms |

- Prédiction juste 15 fois sur 15.
- Préchauffage livré : 8 fichiers de hiérarchie lus, 34 nœuds déduits et 16 demandés. Le plafond de 24 est atteint (`plafond-noeuds`), pour 1 Mo.
- Coût par saut : 6 nœuds de données et 2 fichiers de hiérarchie que Potree ne redemande pas. C'est le prix de la zone de 0,75 m, plus large que ce que Potree charge (marge de 0,5 m).
- Sans la hiérarchie, seuls les nœuds déjà connus sont demandés (frontière 3) : −0 %.

## Requêtes en plus par lot (estimation sur la collection du 09/11, SUPPOSÉ)
- Environ 114 préchauffages : 68 sauts de 11 coupes ou plus dans le lot, 46 dans la relecture.
- Au taux du banc (24 requêtes, dont 8 inutiles) : environ 2 700 requêtes demandées, dont environ 900 que Potree ne redemandera pas. Le lot a chargé 2 581 nœuds.
- En octets, avec environ 290 Ko par nœud sur le terrain : environ 200 Mo de plus par lot, à comparer aux 760 Mo du lot.
- Plafond dur : 114 × 24 requêtes et 8 Mo par préchauffage.
- Si c'est trop, `rayonM` plus petit ou `hierarchiesMax` plus bas réduisent la part inutile. C'est à mesurer sur le terrain.

## Preuves
- **Essais rouges d'abord** (tronc), puis verts :
  - `ch080-prechauffage` 10/10 (dont 3 de la hiérarchie, rouges sur le module sans hiérarchie) ;
  - `ch080-observateur` 5/5 (3 rouges sur le tronc) ;
  - `ch080-adaptateur` 4/4 (dont le tronc sans patch : `sans-suivante`) ;
  - `ch080-service-worker` 2/2 (rouges sur le tronc).
- **Restent verts** : `ch077-*`, `choix-lot-clic-sw`, `relecture*`, `lot-profil-passe-differes-*`, `noms-modeles`, `scan-identite` (quatre motifs publics seulement : `ARIANE_MOTIFS_INTERDITS` est absente), `lot-command-scan`.
- **Garde `pose-lot-inchanges-4959`** 6/6 : le bloc CH-080 de `esv-observer.js` est déclaré et retiré pour comparer.
- **`parite-relecture-sw`** contre le tronc (95c96e5) : seules les commandes différaient, et elles sont identiques une fois le champ `prechauffage` retiré (46 captures). Ce seul champ est neutralisé dans l'outil, avec l'accord de l'intégrateur ; relevés identiques.
- **Maquette** `essais.cjs` : 73 réussis, 2 sautés (export réel absent), 0 échec, puis 7/7. `ch080-prechauffage` (maquette) 3/3 : sans correctif, `sans-suivante` et 0 en cache ; hiérarchie éteinte, 2 au plus ; livré, au moins 5 nœuds et 1 hiérarchie servis par le cache.
- **Ajustements déclarés** :
  - `ch077-adaptateur` et la séance de maquette de CH-077 forcent `sautMin:1`, car leur cas est la voisine ;
  - l'option `saut` de la maquette ne touche pas les ancres de `tools/relecture-maquette.cjs`.
- **Non lancées** : `garde-gcv2` et `parite-l1se-sw`. Aucun module de décision n'est touché, et ces deux outils demandent un corpus réel.

## Ce qui reste SUPPOSÉ
- Forme réelle des fichiers de hiérarchie d'ESV : pas entre deux fichiers, taille. Au-delà de 20 000 clés, la fin d'un fichier est ignorée.
- `n.ept.url` présent dans le Potree d'ESV ; sinon, l'adresse est déduite de `url()` (`…/ept-data/` → `…/ept-hierarchy/`).
- Gain réel sur ESV, et part des requêtes inutiles.
- Même clé de cache entre le XHR de Potree et le `fetch` du préchauffage (déjà SUPPOSÉ dans CH-077).

## Consigne d'essai terrain
1. Appliquer `adapter-page.patch`. Le réglage livré (`sautMin: 11`) reste allumé dans le cadre de D-307 et D-309.
2. Lire les événements `prechauffage` :
   - répartition de `source` : `b1-fenetre` doit être rare ;
   - `saut` ;
   - `hierarchies`, `deduits`, `noeuds` et `frontiere` pour les sauts de 11 coupes ou plus.
3. Comparer à « Vision 5 » la capture médiane des sauts de 11 coupes ou plus. Dans `prechauffage-bilan`, lire `juste` et `servisCache`.
4. Si `hierarchies` vaut 0 alors que `frontiere` est positif, l'adresse de la hiérarchie n'a pas été trouvée. `hierarchie:false` coupe cette étape seule.
