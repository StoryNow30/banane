# CH-086 — Rapport : écritures après la validation en fond (piste 1 de CH-084)

**Livré** (branche `chantier/CH-086`, partie de 0fb3777) :
- `chantiers/CH-086/engine.patch` pour `src/engine.js`, appliqué par l'intégrateur (fichier interdit à l'exécutant).
- `chantiers/CH-086/engine-baseline.patch`, qui ré-épingle `audit/v4.6.0-engine-baseline.json`. Le verify exige cette empreinte du moteur ; l'ancienne empreinte est gardée sous `previousHashCH086`.
- Réglage `ecrituresApresValidation: {enFond: true, delaiMs: 2000}` (`src/settings.js`), allumé pour le lot d'essai ; `background.js` le passe au moteur. `enFond:false`, ou réglage absent : chemin d'avant (aucune fenêtre ouverte, prouvé).

**Ce qui change** : au retour de la commande de validation (navigation observée), la visite (`putRecord`), `validation-observation`, `validation-accepted` et les sauvegardes qui suivent partent sans être attendus. Elles gardent le même ordre et le même contenu ; la capture du cut suivant démarre pendant qu'elles courent.

La porte « stocké » est tenue :
- avant l'intention de pose, l'intention de différé et l'intention de validation ;
- à la sortie du lot.

Toutes les écritures de la fenêtre doivent y être confirmées dans les 2 s. Sinon, une seule reprise (visites et événements réécrits, puis l'état complet). Si la reprise échoue aussi : pause motivée `ECRITURE_NON_CONFIRMEE`, sans commande ni SKIP. Les écritures d'avant une commande (intention de pose, `validation-intent`) restent attendues. `gcv1-shadow-observed` sans sauvegarde : non fait (reprise après F5 non prouvée).

**Preuves** (ÉTABLI) :
- **Rouge d'abord** : `tests/ch086-*.test.cjs` donnent 13 rouges sur le tronc (moteur sans le patch), puis 15 sur 15 verts avec le patch (4 fichiers, 6 à 12 s chacun).
- **Avec et sans le réglage** : commandes à ESV, poses, validations, événements, visites et état final identiques. Comparaison faite après renumérotation des identifiants, dans 4 combinaisons : ESV qui relit ou « navigation seule » ; magasin FIFO ou chrome.storage en avance sur IndexedDB.
- **Porte** : au moment où une pose part vers ESV, aucune écriture n'est en vol, et l'état durable porte l'intention de pose.
- **Arrêt du service worker** : simulé après chaque écriture confirmée de la fenêtre, soit 30 points par variante et 4 variantes ; 18 ou 19 reprises complètes par variante, une par état durable distinct. Résultats :
  - rien de perdu : tout événement ou visite que l'état porte est dans IndexedDB après `init()`, qui a réécrit des écritures de la fenêtre dans 23 à 26 cas ;
  - une intention de validation durable donne `reconcileRequired` et la pause ;
  - jamais de pose ni de validation en double, aucun SKIP, aucun cut compté sans sa validation.
- **Pannes** :
  - visite refusée en continu : pause `ECRITURE_NON_CONFIRMEE` avant la pose suivante ; la visite reste recopiée dans l'état ;
  - refus une seule fois : la reprise passe et le lot continue, mêmes commandes ;
  - état plus lent que le délai : pause, aucune pose suivante.
- **Garde `tests/pose-lot-inchanges-4959`** : blocs CH-086 déclarés (les deux patchs retirés à l'envers avant l'empreinte), 6 sur 6, avec et sans les patchs.
- **Parité de la relecture** (`tools/parite-relecture-sw.cjs` contre le tronc) : relevés identiques, code 0.
- **Modules de décision** : aucun touché.
- **Banc maquette** (`chantiers/CH-086/banc.cjs`, 15 lots allumés et 15 éteints, alternés, 10 cuts ; `banc-releve.json`) :
  - **une seule signature dans les 30 lots** : commandes du lot, journal de la maquette (poses au nm, rails choisis, cuts chargés), écritures au serveur ;
  - seul écart : le `goToCut` de la relecture qui suit, présent dans 13 relevés allumés et 12 éteints. Le banc fige le journal avant ou après son départ ; même constat que CH-084 ;
  - lot médian 23 719 ms allumé contre 23 787 ms éteint ; écart médian par paire −924 ms par lot (8 validations) ; cut moyen 2 929 contre 2 963 ms. Ces chiffres sont bruités (écart par paire de −1 323 à +2 288 ms) : gain PROBABLE.
  - Sur la maquette, chrome.storage est local et rapide. Le gain sur ESV dépend du coût réel des écritures, ≈ 240 ms d'orchestration par cut d'après CH-084 : 60 à 80 ms par cut attendus (SUPPOSÉ).
- **Verify complet** (machine de l'exécutant, les deux patchs appliqués) : 3 360 essais, 3 353 verts, 0 rouge, 7 sautés ; « Engine matches V4.6.0 baseline: true ». Un premier passage sans le ré-épinglage de la baseline était rouge : `geometry-brain` (empreinte du moteur), d'où `engine-baseline.patch`. `typage-ch075` était rouge aussi, faute de l'objet git 5699f68 dans le clone peu profond : il passe une fois l'historique approfondi.
- **Maquette complète** : 82 essais, 79 verts, 0 rouge, 3 sautés ; puis 7 sur 7. Rien de `audit/*` n'est commité.

**À signaler, hors CH-086** (mesuré, présent aussi réglage éteint) : un arrêt du service worker entre la sauvegarde de `before-captured` et celle de `step=analyze` fait passer la reprise en `ERROR` (« Capture avant déjà ouverte »). Aucune commande n'est envoyée.

**Pour l'intégrateur** :
1. `patch -p1 < chantiers/CH-086/engine.patch` ;
2. `patch -p1 < chantiers/CH-086/engine-baseline.patch` ;
3. essais `node --test tests/ch086-*.test.cjs tests/pose-lot-inchanges-4959.test.cjs tests/geometry-brain.test.cjs`.
