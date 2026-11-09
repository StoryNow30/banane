# CH-083 — Rapport : charger dans la mémoire d'ESV les nœuds de la coupe suivante (D-314)

Étude : `etude.md`, faite sur le code de Potree 1.8, 1.8.2 et develop.

## Ce que dit le code de Potree (ÉTABLI)
- **Rien n'est jamais libéré.** `lru.freeMemory` ne libère que tant que `numPoints > Potree.pointLoadLimit`. Or `pointLoadLimit` n'existe pas dans `Potree.js`.
- **Un nœud préchargé n'entre pas dans la LRU.** Seuls les nœuds visibles y entrent (`touch`).
- **Le préchargement ne change pas le budget.** Visibilité et `pointBudget` lisent `nodeinfo.pointCount`, que le nœud soit chargé ou non.
- **Conclusion** : un nœud chargé hors de la vue reste en mémoire jusqu'à l'arrivée, et il ne peut faire sortir aucun nœud visible.

## Livré (branche `chantier/CH-083`)

### `src/prechauffage.js` : phase « mémoire »
Elle tourne en même temps que le préchauffage HTTP de CH-081, qui ne change pas.

**Ce qu'elle charge.** Elle appelle `node.load()`, la fonction même de Potree, sur un nœud :
- que Potree connaît, avec `nodeinfo.pointCount` > 0 ;
- que notre préchauffage HTTP vient de recevoir **en 200**. Le nœud est ensuite servi par le cache : aucune requête de plus au serveur.

Elle ne l'appelle jamais sur une frontière ni sur un échec. Un échec bloquerait `loading` et le compteur de Potree (CH-062).

**Quand elle charge.**
- Au plus 2 chargements à elle à la fois : Potree garde au moins 2 places sur 4.
- Seulement si Potree ne charge rien d'autre.
- Arrêt des lancements dès que Potree repart, que la coupe change ou qu'une capture commence (`annuler('capture')`). La veille ne compte plus nos chargements en vol comme « Potree qui repart ». Un `load()` déjà lancé finit seul.

**Plafonds.**
- 32 `load()` par opération ;
- 256 Mo décodés par vie de la page.

**Événement `prechauffage`.** Il porte :
- `memLances`, `memCharges`, `memEchecs`, `memRefuses`, `memEnVolFin` ;
- `memOctets` : octets de la géométrie décodée ;
- `tasAvantKo`, `tasApresKo` : `performance.memory`, Chromium.

Côté GPU, rien n'est monté avant l'affichage. Ensuite, la charge est celle que Potree aurait de toute façon.

### Autres fichiers
- **`src/prechauffage-anticipation.js`** : `prechauffage-vue` porte `limitePoints` (`Potree.pointLoadLimit`, null si absent).
- **`src/esv-observer.js`, `background.js`** : relais des nouveaux champs, en entiers bornés.
- **`src/settings.js`** : `prechauffer.memoire` = `{ actif: true, noeudsMax: 32, enVolMax: 2, octetsMax: 256 Mo }`, allumé pour le lot d'essai.
  - `memoire.actif:false` coupe cette phase seule ;
  - `actif:false` coupe tout ;
  - défaut du module : éteint.
- **`chantiers/CH-083/adapter-page.patch`, à appliquer par l'intégrateur.** Une ligne : `pointLoadLimit` est ajouté à `vue()`, en lecture seule. Sans le patch, `limitePoints` vaut null et le reste fonctionne.
- **Maquette** : modèle mémoire de Potree 1.8.2 (`eptMemoire=1`, forme commune), relu sur son code :
  - `load()` et `maxNodesLoading` 4 ;
  - décompression `eptDecode` ;
  - montée de 2 nœuds par image, enfants dans la même image ;
  - LRU touchée à chaque image, `freeMemory` avec `pointLoadLimit` ;
  - journal `ept-arrivee`, `ept-affiche` (« points affichés ») et `ept-libere`.
- **Outils** : `tests/esv-maquette/ch083-outils.cjs` et le banc `tools/ch083-banc.cjs` (sortie `banc.json`).

## Banc (maquette, saut de 50 coupes, latence 60 ms, décompression 40 ms, 15 répétitions, charge de départ 0,06 ; médiane / P90 ; ÉTABLI sur la maquette)
| Mode | Validation → points affichés | Nœuds de la boîte chargés à l'arrivée | Capture du cut en cours | Nœuds perdus par la coupe en cours | `load()` / chargés | Octets décodés | Tas JS avant → après |
|---|---|---|---|---|---|---|---|
| sans (HTTP seul, CH-081) | 1 173 / 1 191 ms | 5 / 56 | 2 152 ms | 0 | 0 | 0 | — |
| **avec (livré)** | **830 / 862 ms (−29 %)** | **33 / 56** | 2 179 ms | **0** | 28 / 28 | 448 Ko | 29,2 → 34,1 Mo |

- Le préchargement est borné par ce que le HTTP a servi : 32 nœuds par cible, coupés par la navigation (motif `coupe`, 15 sur 15). La boîte de la maquette a 56 nœuds, contre 14 à 17 sur ESV (étude de CH-081).
- La hausse du tas (environ 5 Mo) dépasse de loin les 448 Ko décodés : c'est le bruit des tampons et du ramasse-miettes (PROBABLE).

## Preuves
- **Essais rouges d'abord, puis verts** :

  | Essai | Branche | Tronc |
  |---|---|---|
  | `tests/ch083-memoire.test.cjs` | 7/7 | 6/7 en échec (l'essai « coupe en cours » passe trivialement sans la phase) |
  | `tests/ch083-relais.test.cjs` | 1/1 | 0/1 |
  | maquette `ch083-memoire` | 2/2 | 0/2 |

- **Maquette `ch083-memoire`** :
  - la coupe en cours garde tous ses nœuds (connus, chargés, montés, mêmes points dans la LRU) et rien n'est libéré ;
  - c'est vrai même avec `pointLoadLimit` égal aux points que la LRU tient déjà. Un nœud préchargé ne fait pas sortir un nœud visible.
- **Ajustements déclarés** :
  - `ch081-anticipation` et `ch081-prechauffage` : `limitePoints:null` ajouté à la vue attendue ;
  - garde `pose-lot-inchanges-4959` : commentaire CH-083. La ligne du patch tombe dans le retrait de la vue de CH-081 ; le module est dans la liste `PRECHAUFFAGE` ; les champs relayés sont dans les blocs de CH-077 de l'observateur et du service worker.
- **Régression ciblée** (ch077, ch080, ch081, ch083, garde, `choix-lot-clic-sw`, relecture, passe des différés, scans) : 243 essais, 242 réussis, 0 échec, 1 sauté.
- **verify complet** (`node tools/verify.cjs`, dans ma machine, sur 5eaedc9) : **3 322 essais, 3 315 réussis, 0 échec, 7 sautés**.
  - Corpus natif absent (mode partiel).
  - Géométrie inchangée, moteur égal à la baseline V4.6.0.
  - Les fichiers `audit/verification.*` ne sont pas versés.
- **Maquette complète** (`tests/esv-maquette/essais.cjs`) : 81 essais, **78 réussis, 0 échec, 3 sautés** (export réel absent), puis 7/7.
- **Parité de la relecture** (`tools/parite-relecture-sw.cjs`) contre le tronc (e4c64b0) : **relevés identiques** (SHA-256 9984fe77…).
- **Garde `pose-lot-inchanges-4959`** : verte sans le patch, et verte avec `chantiers/CH-083/adapter-page.patch` appliqué (12 réussis avec `ch077-adaptateur` et `ch080-adaptateur`, 1 sauté). Blocs déclarés :
  - (1) `src/prechauffage.js` : la phase mémoire, dans un module déjà déclaré (liste `PRECHAUFFAGE`) ;
  - (2) `src/prechauffage-anticipation.js` : `limitePoints`, même liste ;
  - (3) `src/esv-observer.js` et `background.js` : huit champs et `limitePoints` dans les listes du relais, à l'intérieur des blocs de CH-077, retirés pour comparer ;
  - (4) `src/settings.js` : la clé `memoire` dans `prechauffer`, dont la garde ne contrôle que `actif` et `rayonM` ;
  - (5) adaptateur : la ligne du patch, retirée avec la vue de CH-081.
- **Scans** :
  - `noms-modeles`, `scan-identite` et `lot-command-scan` : 20/20. Quatre motifs publics seulement : `ARIANE_MOTIFS_INTERDITS` est absente de ma machine.
  - Grep du diff contre le tronc : aucun nom de modèle, aucun UUID, aucune adresse.
- **Non touchés** : `engine`, `adapter-page` (hors du patch), `geometry*`, `gcv2*`, `lot-decision`, l'écriture dans ESV, `manifest.json`, la version, les attentes de la pose (CH-084). `garde-gcv2` et `parite-l1se-sw` ne sont pas lancés : aucun module de décision n'est touché.

## Reste SUPPOSÉ ou PROBABLE
- Le Potree d'ESV ne pose pas de `pointLoadLimit` (PROBABLE). `prechauffage-vue.limitePoints` le dira, une fois le patch appliqué.
- Gain sur ESV : SUPPOSÉ. À l'arrivée, il reste la montée de 2 nœuds par image, soit 14 nœuds ≈ 0,12 s.
- La clé de cache du `fetch` de Potree est la même que celle de notre `fetch` (déjà SUPPOSÉ par CH-080c). Sinon, `load()` refait la requête au serveur, comme Potree l'aurait faite à l'arrivée.
- La décompression faite pendant la pose et la validation tourne dans le travailleur de Potree. Le fil principal ne crée que la géométrie.

## Consigne terrain (Vision 8)
1. Appliquer `chantiers/CH-083/adapter-page.patch` (après celui de CH-081).
2. Dans `prechauffage`, lire :
   - `memLances`, `memCharges`, `memEchecs` (doit valoir 0), `memRefuses` ;
   - `memOctets`, `tasAvantKo` et `tasApresKo`, à suivre sur le lot.
3. Dans `prechauffage-vue`, lire `limitePoints` : null attendu.
4. Comparer la capture médiane des sauts de 2 coupes ou plus à celle de Vision 7 et à celle de la coupe voisine.
5. Au moindre doute, `memoire.actif:false`.
