# Rapport CH-158 — Relecture : garder toute l'ADV et reboucher les trous de 1 à 3 après le filtre

## Ce qui a été fait
1. **`src/relecture-filtre-liste.js`** :
   - Passage du défaut `DEFAULTS.zonesExclues` à `Object.freeze(['pn', 'adv'])`.
   - Les cuts en zone `adv` (y compris les verts géométriquement lisses sur la liste) ne sont plus écartés par `filtrerSelection`. Les verts lisses en zone `abords` restent filtrables sous les mêmes gardes absolues qu'avant (rôle non vert, différé et sa marge, alerte garde-voie, liste « À contrôler », zone `ecartement`).
2. **`src/relecture-ombre.js`** :
   - Ajout de `reboucherSelection(sel0, filtree, cfg)` appelée dans `selection()` juste après `F.filtrerSelection(...)`.
   - Réapplication des deux règles D-284 en ne réintégrant **que des cuts présents dans `sel0`** (la sélection de `selectionBase`) :
     - Voisins d'isolés : pour chaque cut conservé après le filtre, ses voisins immédiats à `±isole.marge` (défaut 1) présents dans `sel0` sont réintégrés.
     - Trous de 1 à `trouMaxCuts` (défaut 3) : tout trou de 1 à 3 cuts entre deux cuts retenus après l'étape précédente est rebouché avec les cuts correspondants de `sel0` (et le motif `'trou'` est ajouté à la plage concernée).
   - Recalcul cohérent de `plages`, `cuts` (avec réindexation `plage`), `parZone`, `total`, `traverses`, `tempsEstimeS`, conservation de `horsPlafond` de `sel0`, et mise à jour de `filtresListe` pour n'y laisser que les cuts définitivement écartés.
   - Sans `tableListe` ou lorsque le filtre est désactivé (`actif: false`), `selection()` retourne `sel0` sans aucune modification (identité stricte des octets JSON).
3. **Vérification de `background.js`** :
   - Dans `relectureEntree(b)` (L3905–3910), `zonesADV` est alimenté par les événements `regles-metier-ombre` du lot et transmis à `selection()`. Comme `adv` figure désormais dans `zonesExclues`, une ADV toute verte couverte par `zonesADV` reste intégralement ouverte en relecture sans modification de `background.js`.
4. **Essais (`tests/ch158-relecture-adv-et-trous.test.cjs` et `tests/ch152-relecture-filtre-et-confiance.test.cjs`)** :
   - Écriture des essais rouges avant le correctif, puis validation au vert après le correctif.
   - Mise à jour de `tests/ch152-relecture-filtre-et-confiance.test.cjs` pour refléter `zonesExclues: ['pn', 'adv']`, la conservation des verts lisses d'ADV dans `filtrerSelection`, et le maintien de la plage `zonesADV: [[5, 12]]` dans `O.selection`.
   - Création de `tests/ch158-relecture-adv-et-trous.test.cjs` couvrant la conservation de l'ADV, le filtrage des abords lisses, le rebouchage des trous de 1 à 3 et des cuts isolés limité à `sel0`, la cohérence de `filtresListe` et des compteurs, ainsi que l'identité JSON stricte sans table ou filtre coupé.

## Ce qui n'a pas été fait (conformément au ticket)
- Aucun changement dans `src/placement-convention.js`, ni dans les modules protégés (`src/engine.js`, `src/geometry*.js`, `src/gcv2*.js`, `src/lot-decision.js`, `manifest.json`).
- Pas d'exécution de `tools/verify.cjs` (réservé à l'intégrateur une fois par version).
- Pas de rejoue sur l'export v6 (travail hors dépôt).
- Pas de fusion dans `ariane6`, pas de publication de paquet.

## Essais lancés et résultats
Commande exécutée depuis `/home/opencode/wt-CH-158` :
```
node --test tests/ch152-relecture-filtre-et-confiance.test.cjs tests/ch158-relecture-adv-et-trous.test.cjs tests/relecture-ombre.test.cjs
```
Résultat (ÉTABLI) : **39 essais exécutés, 39 réussis, 0 échec** (code de sortie 0).

## Précisions ou doutes
- **Définition des cuts couverts lors du rebouchage après filtre** : `reboucherSelection` évalue l'isolement et les trous de 1 à 3 entre les cuts effectivement **visités** (`filtree.cuts`), sans compter les poses du lot (`traverses`, qui ne sont pas visitées en 3D lorsque `relireCutsDuLot` vaut `false`), et ne réintègre que des cuts présents dans `sel0.cuts`. Ainsi, un cut visité encadré par une pose traversée d'un côté et un vert filtré de l'autre récupère bien son voisin vert dans `sel0`, évitant tout cut visité isolé.
- Aucun trou détecté sur l'alimentation de `zonesADV` dans `background.js`.
