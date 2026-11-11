# CH-110 — Rendre à Potree les places de chargement perdues sur une erreur d'ESV (rapport, 11/11/2026)

Décisions : D-342 (cause), D-343 (accord écrit de l'opérateur). Base : tronc `claude/50-test17` à 8fbc381.

## 0. Comment Potree gère un échec (ÉTABLI d'après le dépôt ; rien de mesuré sur ESV ici)
- Sources : `chantiers/CH-062/rapport.md` §0, `chantiers/CH-083/etude.md`, `chantiers/CH-080/rapport.md` (lecture du code de Potree 1.8 / 1.8.2).
- Nœud d'ESV : `PointCloudCopcGeometryNode` (forme « commun », `key` tableau [d,x,y,z], ni `url()` ni `filename()`).
- `load()` sort si `loaded`, `loading`, ou `numNodesLoading >= maxNodesLoading` (4). Sinon `loading = true`, `++numNodesLoading`. Seul `doneLoading` fait `loaded = true` et `--`.
- Statut ≠ 200 : un `console.log` seulement. Le nœud garde `loading`, le compteur garde +1, `load()` ne repart jamais. Au 4e échec, plus aucun chargement.
- La maquette (`tests/esv-maquette/esv-maquette.js`, mode `eptMemoire`) reprend ce modèle. Essai de fidélité ci-dessous.

## 1. Ce qui est livré
- **`chantiers/CH-110/adapter-page.patch`** (fichier protégé, à appliquer par l'intégrateur). Pour chaque requête `ept-data` en échec vue par l'observateur des ressources (statut 0 ou ≥ 400, clé lue dans le chemin) :
  - attente de `attenteMs`, puis recherche du nœud par les clés de ses ancêtres ;
  - s'il est `loading` sans être `loaded`, compteur entier > 0, moins de `essaisParNoeud` remises : `loading = false`, compteur −1. Potree le redemande de lui-même ;
  - sinon rien n'est touché ; motif `plafond`, `introuvable`, `etat` ou `compteur-zero` ;
  - une remise en attente par nœud au plus : une remise répond à un échec, jamais deux ;
  - ligne de base CH-062 : compteur effectif = brut − (échecs − places rendues) ; la clé rendue quitte `clesEchec` ;
  - un événement `potree-place-rendue` par cas : motif, profondeur, statut, essai, avant, après, rendues, épisode, cut, `pageMs`. Ni clé ni adresse (intégrateur).
  - Rien d'autre n'est écrit : ni vue, ni caméra, ni rails, ni pose, ni validation ; aucun SKIP.
- **Réglage** `lot.reparationPotree` = `{actif:true, essaisParNoeud:2, attenteMs:1000}` (`src/settings.js`), allumé (D-343). Éteint : aucune remise, aucun événement.
- **Relais** : `src/esv-observer.js` (liste blanche) et `chantiers/CH-110/background.patch` (normalisation du service worker ; `background.js` est le fichier de CH-109, l'intégrateur l'applique après lui).

## 2. Preuves
- **Rouge d'abord** (commit 2821775) : `tests/esv-maquette/ch110-place-rendue.test.cjs` rouge sans patch. `tests/ch110-place-rendue.test.cjs` : 6 sur 7 rouges sans patch (seul « éteint » passe). `tests/ch110-sw-relais.test.cjs` : 2 sur 2 rouges sans patch.
- **Maquette**, vrai Chromium, 5/5 :
  - fidélité, tronc tel quel : 4 échecs → compteur à 4, plus aucune requête de nœud, 2 captures en échec (« niveau de détail non stabilisé ») ;
  - réparation : 4 remises, compteur 4→3→2→1→0, chaque nœud redemandé une fois, coupe suivante affichée, capture au signal, aucun `ligne-base-repli` ;
  - 8 échecs sur 4 nœuds : essais 1 puis 2 par nœud, 3 requêtes par nœud, tout chargé, compteur à 0 ;
  - éteinte : comme le tronc ;
  - préchauffage allumé, un de nos `load()` en échec : place rendue, nœud redemandé, préchauffage reparti après sa pause sans « réseau occupé ».
- **Vm**, 8/8 : attente avant la remise, jamais deux remises pour un échec, plafond, introuvable, déjà chargé, plus en cours, compteur à 0 ou absent, statut 200, épisodes, éteint, relais de l'observateur.
- **Service worker**, 2/2 : événement rangé, champs réduits, ni clé ni adresse.
- **Voisins sur une copie patchée** (vm) : `lot-signal-ligne-de-base`, `ch077-adaptateur`, `ch083-memoire`, `ch085-voie-potree`, `ch088-*`, `ch089-pause-serveur`, `ch092-prechauffage-*`, `releves-4953-adapter`, `releves-4953-observateur`, `t951-diag-signal`, `series-sans-points`, `serie-captures-vides`, `esv-observer*`, `pose-lot-inchanges-4959`, `v3-turbo`, `ch062-outils` : verts. Maquette : voir §4.
- **Gardes ajustées** : `lot-signal-ligne-de-base` retire CH-110 avant de vérifier que le tronc porte CH-062 ; `pose-lot-inchanges-4959` déclare la clé `reparationPotree` et retire le relais. `ch095-outils` coupe la réparation par défaut : ses essais prouvent la panne elle-même.
- **Défaut trouvé par l'essai vm de CH-062, corrigé** : l'observateur peut livrer ses entrées dès `observe()`. Les constantes de la réparation sont déclarées avant lui.
- Fichiers protégés (`engine`, `adapter-page`, `geometry*`, `gcv2*`, `lot-decision`, `manifest`, `background.js`) : diff vide contre 8fbc381. `garde-gcv2` et parité non lancées : aucun module de décision touché, pas de corpus de rejeu dans cette session.

## 3. Ce que la maquette ne prouve pas
- Le vrai Potree d'ESV : le modèle d'échec est celui de CH-062 et CH-083, lu dans le code, pas mesuré ici. SUPPOSÉ : remettre `loading = false` suffit pour que le vrai `load()` reparte ; aucun autre état n'est laissé par l'échec.
- Les points des captures de la maquette viennent du scénario, pas de l'arbre EPT : « la coupe s'affiche » est lu au journal `ept-affiche` de la maquette.
- Un serveur qui refuse durablement : chaque nœud est redemandé 2 fois au plus, puis reste bloqué comme aujourd'hui (rechargement CH-062 en filet).
- À mesurer à la prochaine séance : le nombre d'événements `rendue` et `plafond` par page, et la disparition des « cuts sans point » après un 502.

## 4. Maquette voisine sur la copie patchée
Vrai Chromium, copie du dépôt avec les deux patchs appliqués :
- `ch095-noeud-bloque` 4/4, `ch095-hierarchies` 2/2, `lot-signal-eteint` 1/1, `relecture-signal-eteint` 1/1, `diagnostic-repli` 5/5, `serie-captures-vides` 1/1, `ch083-memoire` 2/2, `ch077-prechauffage` 3/3, `ch088-loin` 1/1 ;
- `ch110-place-rendue` 5/5, sur le dépôt comme sur la copie patchée. L'essai de fidélité coupe la réparation : sur la copie patchée, le réglage livré l'allumait (corrigé).
- Vm sur la copie patchée : `ch110-place-rendue`, `ch110-sw-relais`, `lot-signal-ligne-de-base`, `pose-lot-inchanges-4959` : 20/20.
