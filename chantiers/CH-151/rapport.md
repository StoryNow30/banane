# CH-151 — Rapport

**Branche** : `chantier/CH-151` · **Décisions** : D-380, D-381 · **Périmètre** : lot D4 + D3.

## Livré

- **D4a — Capture rapide partout** : `pilote.modeRapide` vaut désormais `'toujours'`. Les réglages `repliCourt`, `imagesMin`, les pièces rapides et le clic du lot restent inchangés. Les règles historiques `echantillon` et `echantillon50` restent rejouables explicitement dans les essais et les outils.
- **D4b — Pose rapide en relecture et 2e passe** : `poserPuisVerifier` transmet `{ clicHumain: 'gauche-recentre', selectionImage: true }`. Dans l’adaptateur, cette option explicite utilise `selectImage` uniquement hors déplacement de vue. Le rail droit n’est posé en direct que s’il est visible (`directeVisible` + `horsVueClic`) ; le lot par défaut conserve le chemin `tel-quel`. Le retrait du patch est déclaré dans `chantiers/CH-151/adapter-pose-rapide.patch` et contrôlé par `tests/pose-lot-inchanges-4959.test.cjs`.
- **D4c — Constellation et filtre D1** : lorsque le lot quitté laisse `deferred.length - ecritesPasse > 0`, le changement de partie commence par `suivant-dernier`, puis `lien` en repli, sans tenter `invalide-suivant`. À zéro différé restant, l’ordre historique est conservé. `relectureEntree` fournit maintenant la table décompactée de `liste-memoire.js` lorsqu’elle est concordante avec le lot, ainsi que les alertes `garde-voie-ombre` du lot ; `relecture-debut` consigne `filtresListe` et `filtresListeCompte`.
- **D3 — Aucun flash ni attente inutile** : `correctionOuvrir` sur le cut déjà affiché rend `deja-affiche` sans pause/reprise d’Écho ni `goToCut`. En relecture, une pose déjà égale à la cible à `0,0005` près rend `deja-conforme`, sans `apply`, sans Maj+Espace et sans intention incertaine ; ce cas n’est compté ni corrigé ni refusé.

## Vérifications (ÉTABLI)

- Essai rouge constaté avant implémentation sur les 7 scénarios de `tests/ch151-d4-d3-fluidite.test.cjs`, puis **7/7 au vert**.
- Commande complète demandée : **227 essais réussis, 0 échec, 1 ignoré** (corpus Natif privé absent, ignoré déclaré par l’essai).
- Maquette Chromium, chemins navigateur modifiés : **2/2 au vert** (`lot-signal-eteint`, `relecture-signal-eteint`).
- Contrôles complémentaires : **50/50 au vert** (CH-152, CH-058, `background.test.cjs`, CH-148).
- Garde d’empreinte : le lot reste identique octet pour octet après retrait déclaré du seul patch D4b ; l’empreinte `GOLDEN.clic.empreinteCommandes` est verte. `git diff --check` est propre.

Le banc simulé vérifie `selectImage` en **moins de 100 ms** sur la pose droite et **moins de 150 ms** sur le repli, contre 320 ms mesurés avant le patch dans le même scénario. Aucun nouveau chiffre de durée sur le vrai ESV n’est revendiqué ici : le gain terrain reste à confirmer à la prochaine session.
