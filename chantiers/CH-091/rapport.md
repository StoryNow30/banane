# CH-091 — Rapport : reprise après un arrêt du service worker entre la capture « avant » et l'analyse

**Livré** (branche `chantier/CH-091`, partie de 40df88a) :
- `chantiers/CH-091/engine.patch` pour `src/engine.js` et `chantiers/CH-091/engine-baseline.patch` pour `audit/v4.6.0-engine-baseline.json` (empreinte `27885e11…2efa`, l'ancienne gardée sous `previousHashCH091`). L'exécutant n'a modifié ni l'un ni l'autre fichier.
- Essais : `tests/ch091-arret-sw-capture-avant.test.cjs`, quatre `tests/ch091-arrets-coupe-*.test.cjs`, aide `tests/helpers/ch091.cjs` (le patch est appliqué à une copie du moteur tant que le tronc ne le porte pas).
- `tests/pose-lot-inchanges-4959.test.cjs` déclare les deux patchs (retirés à l'envers avant ceux de CH-086).

**Cause** (ÉTABLI) : `begin()` sauvegarde `before-captured` (collection `READY_FOR_AFTER`, nuage stocké) avant que `run()` ne sauvegarde `step=analyze`. Un arrêt entre les deux laisse l'étape `capture` avec un avant déjà enregistré ; à la reprise, `run()` rappelle `begin()`, qui refuse.

**Correction** : nouvelle méthode `captureAvantDejaFaite`, appelée par `run()` seulement, à l'étape `capture`, sans intention, sans pose, sans proposition.
- Même cible, mêmes rails, nuage relu du stockage : la capture est gardée (événement `capture-avant-reprise`), le lot passe à l'analyse.
- Nuage absent, ou avant resté inachevé (`BEFORE_CAPTURED` avec un nuage noté, ligne 236) : la référence au nuage est retirée, `begin()` refait la lecture.
- Cible différente, rails modifiés : comportement d'avant. `begin()` hors lot : inchangé. Aucune commande nouvelle vers ESV, aucun SKIP.

**Preuves** (ÉTABLI, machine de l'exécutant) :
- **Rouge d'abord** : sans le patch, 10 rouges sur 14 ; avec, 17 sur 17 (après découpage en un fichier par variante, 8 à 10 s chacun).
- **Instant visé** (une fois par coupe, ESV qui relit et « navigation seule ») : pause reprenable après `init()`, puis lot terminé ; commandes identiques à celles d'un lot sans arrêt ; aucune seconde lecture LiDAR de la coupe interrompue, aucun nuage en plus.
- **Arrêt après chacune des 60 écritures confirmées du lot** (2 coupes), 4 variantes (magasin FIFO ou état en avance ; ESV qui relit ou navigation seule), 38 états durables distincts rejoués par variante : 0 reprise en ERREUR, 0 pose ou validation en double, 0 validation sans pose, 0 SKIP, tout ce que l'état porte est dans IndexedDB. 26 ou 29 reprises menées au bout avec les commandes du lot sans arrêt ; les autres (9 ou 6 en pause, 2 « état final manquant », 1 sans lot) sont des pauses motivées par une intention de pose ou de validation durable, ou une validation transmise non acceptée, et n'envoient rien.
- **Cas voisins** : nuage absent, avant inachevé (lot terminé, mêmes commandes) ; rails modifiés, cible changée (reprise refusée, aucune commande) ; capture manuelle (refus gardé).
- **Garde de pose** `tests/pose-lot-inchanges-4959` et `tests/geometry-brain` : verts avec et sans les patchs ; `tests/ch086-*` 15 sur 15 avec.
- **Parité de la relecture** (`tools/parite-relecture-sw.cjs`, tronc contre copie patchée) : relevés identiques, code 0.
- **Verify complet** (copie de travail, les deux patchs appliqués) : 3 396 essais, 3 388 réussis, 0 échec, 8 sautés ; « Engine matches V4.6.0 baseline: true ». Un premier passage était rouge sur mon seul fichier d'essai (délai de 20 s dépassé sous charge), d'où le découpage.
- **Maquette ESV** : 83 essais, 80 réussis, 0 échec, 3 sautés ; puis 7 sur 7.

**Pas fait** :
- `tools/garde-gcv2.cjs` et `tools/parite-l1se-sw.cjs` : non lancés (aucun module de décision touché ; les lots archivés sont hors de ce dépôt).
- Un lot déjà tombé en ERREUR sur ce défaut avant la correction n'est pas réparé au redémarrage (l'état ERREUR ne se reprend pas) : hors ticket.
- Arrêt simulé sur écritures confirmées seulement, moteur en vm ; pas d'arrêt réel du service worker dans un navigateur (comportement sur ESV : PROBABLE).
- Pas de rapport sur le hub : le chantier n'a pas de pull request.

**Pour l'intégrateur** :
1. `patch -p1 < chantiers/CH-091/engine.patch` ;
2. `patch -p1 < chantiers/CH-091/engine-baseline.patch` ;
3. `node --test tests/ch091-*.test.cjs tests/ch086-*.test.cjs tests/pose-lot-inchanges-4959.test.cjs tests/geometry-brain.test.cjs`.
