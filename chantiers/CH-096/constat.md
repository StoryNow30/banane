# CH-096 : constat de l'audit du 10/11 (extraits du rapport « moteur, adaptateur, modules de décision »)

Numéros de ligne : tronc au 10/11, avant CH-091 et CH-094 pour `src/engine.js` (décalés depuis de quelques dizaines de lignes : retrouve le code par son texte).

### 1. « Archiver le résultat interrompu » puis « Reprendre » après une VALIDATION non confirmée : lot en ERROR — CASSÉ, ÉTABLI (reproduit, moteur seul)
- `src/engine.js:287-313` (`closeUncertain`), `:987` (`Object.values(this.s.proposal.rails)`), `:1206` (`resume`) ; `background.js:1441-1444` (correctif KI-052).
- Ce qui ne va pas : `closeUncertain` arrête le lot (`STOPPED`), efface la proposition et `applied`, mais laisse l'étape du lot. KI-052 a corrigé le cas « apply » dans le service worker (`step==='apply'&&!proposal` → `capture`). Le cas « validate » n'est pas couvert : quand la validation n'a pas rendu de résultat (« VALIDATE transmis, résultat non confirmé : le cut n'a pas changé », résultat ambigu), le lot est en `ERROR` avec `reconcileRequired` ; l'opérateur archive, passe au cut suivant, clique « Reprendre » ; la boucle repart à l'étape « validate » sans proposition et lève « Cannot read properties of null (reading 'rails') » : lot en `ERROR`, non reprenable, message brut.
- Preuve : script hors dépôt, état d'après archivage `STOPPED / validate / proposition null`, puis `resume()` → `ERROR | Cannot read properties of null (reading 'rails')`, aucune commande envoyée à la page. Côté service worker : la seule remise d'étape hors rechargement est `:1444`, limitée à « apply » (aucune occurrence de `step==='validate'` dans `background.js`). Après un F5, `rebaserLot` (`background.js:1143`) remet « capture » : le défaut ne touche que la reprise sans rechargement.
- Correction proposée : étendre la remise de KI-052 à « validate » quand il n'y a ni proposition ni `applied` (service worker, hors fichier protégé), ou remettre l'étape dans `closeUncertain` (protégé).
- Change une décision de pose ou de validation : non (rien n'est envoyé ; le cut archivé reste bloqué en écriture).

### 4. Arrêt demandé pendant une pose recliquée : un clic de pose de plus peut partir — CASSÉ (chemin étroit), ÉTABLI par lecture
- `src/adapter-page.js:651-682` (`clickPosition`), `:677` ; `:328-330` (`waitFor`).
- Ce qui ne va pas : `.catch(e=>{if(dernier)return {s:dernier,ok:false};throw e;})`. Dès le deuxième essai (`dernier` non nul : premier clic posé à plus de 1 mm), toute erreur de l'attente est avalée, y compris « Action interrompue. » (drapeau `cancelled`, posé par « Arrêter »). La boucle passe à l'essai suivant et émet un nouveau `click` sans relire `cancelled`.
- Conséquence : un clic de pose après l'arrêt (rail déplacé d'un demi-pixel de plus), puis l'erreur « État à réconcilier ». Le moteur met le cut en réconciliation ; aucune validation ne suit. Non reproduit ; fréquence non mesurée (seulement quand le premier clic manque la cible de plus de 1 mm).
- Correction proposée : ne rattraper que le délai de l'attente, ou relire `cancelled` avant chaque essai.
- Change une décision : non.

### 5. `validerMajEspace` : les quatre étapes `maj-espace-*` ne sortent jamais de la page — CASSÉ (journal seulement), ÉTABLI
- `src/adapter-page.js:1199` (signature `(identity,scope={},options={},progress=()=>{})`), `:1656` (`methods[action](...args,progress)`), `background.js:3889` (`call('validerMajEspace',identity,scope)` : deux arguments).
- `progress` arrive dans `options` (une fonction : le contrôle « option inconnue » ne voit rien) et `progress` reste la fonction vide par défaut. `maj-espace-before-command`, `-command-returned`, `-navigation-observed`, `-next-geometry-unavailable` ne sont jamais postées.
- Correction proposée : même dépaquetage que `apply` et `amenerDansLaVue` (`typeof a3==='function'`).
- Change une décision : non (la validation de la relecture n'est pas touchée).

### 6. Capture : une attente non stabilisée dont une lecture a levé devient une erreur définitive — CASSÉ, mécanisme ÉTABLI, déclencheur SUPPOSÉ
- `src/core.js:22-31` ; `src/adapter-page.js:328-330`, `:448-466`, `:510`, `:525` ; `src/engine.js:1041`.
- `transientCaptureError` reconnaît « Niveau de détail non stabilisé. » par égalité EXACTE. Les deux attentes rendent `'Niveau de détail non stabilisé.'+(derniere?' '+derniere.message:'')` ; `derniere` / `last` ne sont jamais remis à zéro après une lecture réussie. Une seule lecture en échec pendant les 12 s suffit : message suffixé, non « passager », relancé tel quel (`:525`), lot en `ERROR` au lieu de la pause reprenable.
- Ce qui peut lever dans la lecture (`loadedSignature`, `sceneEsv`) : `vendor/capture-core.js` (quaternion de caméra non unitaire, matrice non finie ou singulière). Rare a priori : SUPPOSÉ, non mesuré.
- Correction proposée : tester le préfixe, ou ne pas suffixer.
- Change une décision : non.

