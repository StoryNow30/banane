# CH-094 — Rapport : après une pause « écriture non confirmée », Reprendre repasse la porte

**Livré** (branche `chantier/CH-094`, partie de 72fcd10 ; `src/engine.js` non modifié par l'exécutant, accord D-318) :
- `chantiers/CH-094/engine.patch` : `porteEcritures` tient aussi quand l'état garde `fenetreEcritures` sans fenêtre ouverte (`fenetreRestee`). Avant l'intention de pose, de différé ou de validation, la liste est réécrite dans `delaiMs` (événements, visites, puis l'état sans la liste), et `ecritures-fond-reprises` le consigne avec le motif ; sinon la même pause `ECRITURE_NON_CONFIRMEE`, sans commande. `resume()` n'est pas modifié : la boucle reprend à l'étape de la pause et rencontre la porte. Une reprise abandonnée sur délai ne touche plus l'état quand elle finit.
- `chantiers/CH-094/engine-baseline.patch` : nouvelle empreinte `4df724ff…`, l'ancienne gardée sous `previousHashCH094` (`27885e11…`, le moteur avec CH-091).
- `chantiers/CH-094/garde-de-pose.patch` : `tests/pose-lot-inchanges-4959.test.cjs` déclare les patchs de CH-094 (retirés d'abord, puis CH-091, puis CH-086). Livré en patch et non modifié sur la branche, parce que CH-091 touche les mêmes lignes.
- Essais : `tests/ch092-moteur-reprise-apres-porte.test.cjs` (marque `todo` retirée de 1a, 1b, 1c), `tests/ch094-reprise-apres-ecriture-refusee.test.cjs` (7 essais), `tests/helpers/ch094.cjs` (applique les patchs à une copie du moteur tant que le tronc ne les porte pas), `chantiers/CH-094/identite.cjs`.

**Base et ordre d'application** : tronc, puis les deux patchs de CH-091 (`origin/chantier/CH-091`, 2990f66), puis les trois de CH-094. `engine.patch` s'applique aussi au tronc seul (blocs disjoints de ceux de CH-091, vérifié par `git apply --check`) ; les deux autres exigent CH-091 d'abord.

**Preuves** (ÉTABLI, en vm, données synthétiques) :
- **Rouge d'abord** : sans le patch (`CH094_SANS_PATCH=1`), 1a, 1b, 1c rouges et 6 des 7 essais de CH-094 rouges ; avec le patch, 4 sur 4 et 7 sur 7.
- **Voisin du rapport CH-092 : reproduit**, il n'est plus SUPPOSÉ. Une reprise abandonnée sur délai, qui finit pendant la fenêtre du cut suivant, efface la liste de cette fenêtre ; la porte suivante passe alors à tort : dans l'essai, la pose du cut 102 partait avec 5 événements du cut 101 absents d'IndexedDB. Avec le patch : pause, aucune pose. L'essai reste rouge si on retire du patch cette seule partie.
- **Ni perte ni doublon** : après réparation et Reprendre, les six commandes du lot, une fois chacune, aucun SKIP ; tous les événements de l'état sont dans IndexedDB ; `validation-accepted` des cuts 100, 101, 102 une fois chacun ; l'état durable ne porte plus la liste.
- **Stockage toujours en panne** : deux Reprendre de suite donnent deux pauses motivées, aucune commande, la liste gardée (mémoire et état durable) ; même chose après un redémarrage du service worker pendant la panne ; une pose à la main après Arrêter est refusée (`ECRITURE_NON_CONFIRMEE`).
- **Lot sans panne de stockage** : commandes vers ESV, appels, événements, visites, état final et lot identiques à l'octet, avec et sans le patch, dans les 4 combinaisons de CH-086 (ESV qui relit ou navigation seule ; FIFO ou état en avance).
- **Sur tronc + CH-091 + CH-094** : essais de CH-086 (15), de CH-091, de CH-092, garde de pose et `geometry-brain` verts (73 essais ciblés, 0 rouge) ; garde de pose verte aussi sans les patchs (branche telle quelle).
- **Parité de la relecture** (`tools/parite-relecture-sw.cjs`, tronc contre tronc + CH-091 + CH-094) : relevés identiques, code 0.
- **Verify complet** (même arbre, machine de l'exécutant) : en cours au moment de ce commit ; résultat ajouté au commit suivant.

**Non fait, et pourquoi** :
- `tools/garde-gcv2.cjs` et `tools/parite-l1se-sw.cjs` : ils demandent le corpus de `banane-data`, absent de cette session ; aucun module de décision n'est touché (diff vide hors `src/engine.js`).
- Maquette ESV : non relancée, aucun chemin navigateur ne change.
- Aucun rapport sur le hub : le chantier n'a pas de pull request ; l'état est envoyé à la session mère.

**À signaler, hors CH-094** (observé, non corrigé) :
- Un lot dont la porte « sortie-du-lot » échoue après le dernier cut garde son état de fin (pas de pause) et sa liste ; la liste est réécrite à la prochaine porte (lot suivant, pose à la main) ou par `init()`.
- Si IndexedDB refuse aussi l'événement `ecritures-fond-reprises`, `init()` lève : le montage de l'essai 5a laisse passer cet événement.
- Comme avant : un événement de la liste sorti des 150 derniers de l'état n'est plus réécrit.
