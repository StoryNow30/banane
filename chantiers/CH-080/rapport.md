# CH-080 — Rapport : préchauffer la coupe suivante quand elle est éloignée (D-309)

**Livré** (branche `chantier/CH-080`) :
- `src/prechauffage.js` : source de la coupe suivante, seuil `sautMin`, événement enrichi de `saut` et `source` ;
- `src/esv-observer.js` : la demande `voisins` rend au plus UNE ligne de plus (`loin`), et le relais garde `saut` et `source` ;
- `background.js` : la cible est jointe aux captures de la relecture et de la passe des différés, jamais à celles du lot ; le relais suit ;
- `src/settings.js` : `sautMin: 11` ;
- `chantiers/CH-080/adapter-page.patch`, **à appliquer par l'intégrateur** ;
- maquette : option `saut` ; banc `tools/ch080-banc.cjs` (sortie `banc.json`).

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

## Seuil : `sautMin` = 11 (PROBABLE)
- Sous 11 coupes, la sélection n'a trouvé aucun nœud à demander, dans 447 cas sur 447 du lot.
- Capture médiane (cuts non différés) : 0,62 s pour la voisine ; 2,6 à 3,2 s de 11 à 50 coupes ; 5,3 s au-delà de 200.
- Clé absente du réglage : 1, soit le comportement de CH-077.

**Piste suivante, non traitée ici.** Les sauts de 2 à 10 coupes prennent 1,2 à 2,5 s. Potree y charge 4 nœuds en médiane que le cube de 0,75 m autour des rails ne voit pas (la sélection les trouvait tous déjà chargés).

## Banc (maquette, saut de 50 coupes, latence 60 ms par nœud, 15 répétitions, charge 0,41 ; médiane / P90, ÉTABLI sur la maquette)
| Mode | Validation → aucun chargement | Chaîne de la coupe suivante | Servis par le cache | Requêtes au serveur | Capture du cut en cours |
|---|---|---|---|---|---|
| sans (fenêtre ±10) | 789 / 804 ms | 667 / 683 ms | 0 / 32 | 32 | 2 292 / 2 378 ms |
| avec | **728 / 735 ms (−8 %)** | 602 / 608 ms | 2 / 32 | 32 (+0) | 2 251 / 2 284 ms |

- Prédiction juste 15 fois sur 15.
- Le gain est petit parce que seuls les nœuds dont la hiérarchie est lue peuvent être demandés. Pour une zone lointaine, ce sont les deux étages du haut ; frontière : 2 sous-arbres.

## Requêtes en plus par lot (estimation sur la collection du 09/11, SUPPOSÉ)
- Environ 114 préchauffages : 68 sauts de 11 coupes ou plus dans le lot, 46 dans la relecture.
- Au banc : 2 nœuds (130 Ko) par préchauffage, soit environ 230 requêtes et 15 Mo par lot. Le lot en a chargé 2 581 (760 Mo).
- C'est 0 de plus si Potree redemande ces nœuds, comme au banc. Plafond dur : 114 × 24 nœuds.

## Preuves
- **Essais rouges d'abord** (tronc), puis verts :
  - `ch080-prechauffage` 7/7 ;
  - `ch080-observateur` 5/5 (3 rouges sur le tronc) ;
  - `ch080-adaptateur` 4/4 (dont le tronc sans patch : `sans-suivante`) ;
  - `ch080-service-worker` 2/2 (rouges sur le tronc).
- **Restent verts** : `ch077-*`, `choix-lot-clic-sw`, `relecture*`, `lot-profil-passe-differes-*`, `noms-modeles`, `scan-identite` (quatre motifs publics seulement : `ARIANE_MOTIFS_INTERDITS` est absente), `lot-command-scan`.
- **Garde `pose-lot-inchanges-4959`** 6/6 : le bloc CH-080 de `esv-observer.js` est déclaré et retiré pour comparer.
- **`parite-relecture-sw`** contre le tronc (95c96e5) : seules les commandes différaient, et elles sont identiques une fois le champ `prechauffage` retiré (46 captures). Ce seul champ est neutralisé dans l'outil, avec l'accord de l'intégrateur ; relevés identiques.
- **Maquette** `essais.cjs` : 72 réussis, 2 sautés (export réel absent), 0 échec, puis 7/7.
- **Ajustements déclarés** :
  - `ch077-adaptateur` et la séance de maquette de CH-077 forcent `sautMin:1`, car leur cas est la voisine ;
  - l'option `saut` de la maquette ne touche pas les ancres de `tools/relecture-maquette.cjs`.
- **Non lancées** : `garde-gcv2` et `parite-l1se-sw`. Aucun module de décision n'est touché, et ces deux outils demandent un corpus réel.

## Ce qui reste SUPPOSÉ
- Part des nœuds d'une coupe lointaine dont la hiérarchie est déjà connue dans Potree. Sur la maquette, seulement les deux étages du haut.
- Gain réel sur ESV.
- Même clé de cache entre le XHR de Potree et le `fetch` du préchauffage (déjà SUPPOSÉ dans CH-077).

## Consigne d'essai terrain
1. Appliquer `adapter-page.patch`. Le réglage livré (`sautMin: 11`) reste allumé dans le cadre de D-307 et D-309.
2. Lire les événements `prechauffage` :
   - répartition de `source` : `b1-fenetre` doit être rare ;
   - `saut` ;
   - `noeuds` et `frontiere` pour les sauts de 11 coupes ou plus.
3. Comparer à « Vision 5 » la capture médiane des sauts de 11 coupes ou plus. Dans `prechauffage-bilan`, lire `juste` et `servisCache`.
4. Si `frontiere` domine et `noeuds` reste près de 0, la hiérarchie bride le gain. Lire la hiérarchie demanderait une nouvelle décision.
