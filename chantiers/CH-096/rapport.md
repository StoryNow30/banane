# CH-096 — Rapport : quatre défauts du moteur et de l'adaptateur (audit du 10/11, D-319)

**Livré** (branche `chantier/CH-096`, partie de cfc8397 ; aucun fichier protégé modifié par l'exécutant) :
- `background.js` (non protégé, modifié directement) : défaut 1.
- `chantiers/CH-096/adapter-page.patch` : défauts 2 et 3. `chantiers/CH-096/core.patch` : défaut 4. Aucun patch du moteur, aucune empreinte du moteur à ré-épingler. Empreintes attendues après application : `src/adapter-page.js` `519663fc986b3cf9b60831d1226ac3c4139735efa98e928027aebe50c9c11616`, `src/core.js` `5df037118362b4ccce62c769ffede094241bf2f5feb6a44cca2cea831fc7faf6`.
- `tests/pose-lot-inchanges-4959.test.cjs` (modifiée directement, aucun autre chantier ne touche ces lignes) : les deux patchs sont déclarés (`sansCH096`, marque « CH-096 »), retirés en premier ; verte avec et sans les patchs.
- Essais `tests/ch096-1…4-*.test.cjs`, aide `tests/helpers/ch096.cjs` (patch appliqué à une copie tant que le tronc ne le porte pas ; `CH096_SANS_PATCH=1` rend le fichier sans patch, même une fois le tronc patché), `tests/helpers/page.cjs` (option `adapter`), `chantiers/CH-096/identite.cjs`.

**Par défaut** (ÉTABLI en vm, données synthétiques, sauf mention) :
1. **Archiver puis Reprendre après une validation non confirmée : corrigé, hors fichier protégé.** Reproduit dans le service worker (lot en ERROR, « Cannot read properties of null (reading 'rails') »). Remise d'étape de KI-052 étendue à « validate » quand il n'y a ni proposition, ni pose appliquée, ni intention, ni réconciliation. Choisie parce qu'elle suffit : pas de patch du moteur, et le refus « cut archivé encore affiché » passe avant. Au cut suivant : capture, pose, validation une fois par cut, rien de renvoyé sur le cut archivé, aucun SKIP. 6 essais, 2 rouges sans la correction. **Chemin F5** : non concerné et non modifié ; mesuré : reprise refusée (« ESV a été rechargé pendant une pose… lance un nouveau lot »), aucune commande, lot STOPPED. Le constat disait que le F5 remettait « capture » : ce n'est pas le cas pour l'étape « validate ».
2. **Arrêt pendant une pose recliquée : corrigé** (il était « non reproduit » : il l'est). ESV simulé qui pose à 3 mm, arrêt juste après le deuxième clic : un troisième clic partait. Avec le patch : 0 clic après l'arrêt, « Action interrompue. » ; sans arrêt, toujours trois clics puis le refus. 4 essais, 1 rouge sans patch. Fréquence sur ESV : non mesurée.
3. **`validerMajEspace` : corrigé.** 0 étape `maj-espace-*` postée avant ; avec le patch elles sortent (sur place : 2 ; navigation : 3). Frappes envoyées à ESV et résultat rendu identiques avec et sans patch (sur place, navigation, deux refus) ; option inconnue toujours refusée avant l'envoi. 6 essais, 3 rouges sans patch. Effet attendu : la relecture en « corriger » consigne 2 à 4 `adapter-progress` de plus par validation (journal seul).
4. **« Niveau de détail non stabilisé. » suivi d'une erreur de lecture : mécanisme corrigé, déclencheur réel toujours SUPPOSÉ.** Reproduit en faisant lever une lecture pendant l'attente : la page ne relisait pas la vue, le moteur passait en ERROR. Avec le patch (message reconnu par son début) : `capture-retry`, lot en pause reprenable, puis fini après Reprendre (3 poses, 3 validations, aucun SKIP). 4 essais, 3 rouges sans patch. `src/core.js` plutôt que l'adaptateur : le diagnostic de la lecture reste dans le message, et la page comme le moteur en profitent.

**Preuves d'ensemble** (ÉTABLI, machine de l'exécutant, arbre = branche + les deux patchs) :
- **Lot sans panne identique à l'octet, avec et sans** : moteur en vm, 4 combinaisons de CH-086 (`chantiers/CH-094/identite.cjs`, 7,3 Mo) ; service worker en vm, lot direct et arrêt puis reprise (`chantiers/CH-096/identite.cjs`) : 3 poses, 3 validations, aucun SKIP, mêmes événements.
- **Verify complet** : 3 442 essais, 3 436 réussis, 0 échec, 6 sautés ; « Geometry unchanged: true », « Engine matches V4.6.0 baseline: true » (essais de CH-084, CH-086, CH-091, CH-094 et garde de pose compris). Rien de `audit/*` n'est commité. L'essai du chemin F5, ajouté après, est passé à part (6 sur 6).
- **Parité de la relecture** (`tools/parite-relecture-sw.cjs`, tronc contre arbre patché) : relevés identiques, code 0.
- **Maquette ESV** : sur l'arbre patché, 88 essais, 85 réussis, 0 échec, 3 sautés ; puis 8 sur 8 ; code 0.

**Non fait, non couvert** :
- `tools/garde-gcv2.cjs`, `tools/parite-l1se-sw.cjs` : non lancés (corpus de `banane-data` absent ; aucun module de décision touché).
- Tout est en vm ou sur la maquette : rien n'est mesuré sur ESV réel (comportement réel : PROBABLE).
- Défaut 1, chemin F5 : laissé en refus. L'ouvrir (étape « validate » sans proposition parmi les étapes « libres ») demande une décision : une validation a été transmise sur ce cut.
- Défaut 4 : une lecture qui lève à CHAQUE image (caméra durablement invalide) devient elle aussi une pause reprenable au lieu d'une ERREUR ; rien n'est écrit dans les deux cas.
- Pas de rapport sur le hub : le chantier n'a pas de pull request ; l'état est envoyé à la session mère.

**Pour l'intégrateur** : `patch -p1 < chantiers/CH-096/adapter-page.patch` ; `patch -p1 < chantiers/CH-096/core.patch` ; contrôler les deux empreintes ci-dessus ; `node --test tests/ch096-*.test.cjs tests/pose-lot-inchanges-4959.test.cjs`.
