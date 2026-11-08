# CH-075 — typage limité, reprise du 08/11/2026

**ÉTABLI.** Le seul module annoté est `src/appuis-liste.js`, qui relit les échanges de la page et ramène les appuis du monde à la scène. Types distincts dans `types/ch075.d.ts` : mètres, millimètres, scène, monde, coupe, partie et opération. Les frontières non fiables sont relues ; aucune erreur résiduelle du vérificateur strict, aucune correction fonctionnelle. Le vérificateur n'établit pas la justesse des règles métier.

`npm ci --ignore-scripts && npm run typage` vérifie le périmètre sans émettre de code. Les cas négatifs doivent être rejetés à chaque ligne attendue, y compris un mélange d'unités transmis à la fonction réelle. TypeScript 5.9.3 est une dépendance de développement ; le paquet installable exclut ses recettes et `node_modules`, l'archive source garde les recettes. Les annotations seules sont dans le commit `3675893f`, après l'infrastructure `58ad81dc`.

**Identité du calcul.** `node tools/typage-ch075.cjs --origine` contrôle le texte historique au tronc `5699f68` (SHA-256 `966d52431947b3c8710ede1c866f141a32620c3e969308a480a878f072d60d02`) et l'arbre syntaxique avant/après (SHA-256 `f1c7c1cbd7a52009c8662abb0b42b59a47cbc28dcc0dd81338c55d164a5d2b0e`). Seules les annotations et leurs parenthèses neutres sont écartées. Les essais refusent notamment une précédence changée, une directive stricte modifiée, une chaîne optionnelle regroupée autrement, une déclaration ou un opérateur changé. Les empreintes gelées historiques ne sont pas réécrites.

**Contrôles de cette reconstruction.** Les 17 essais ciblés (typage, appuis, gel pose/moteur et paquet) réussissent, sans échec ni omission. Les 13 essais des gardes d'identité et de noms réussissent. Le scan public passe ; les deux variables de motifs confidentiels sont absentes, leur contrôle reste donc non effectué. Les essais rouges du vérificateur absent et de l'exclusion du paquet absente ont été conservés localement avant correction.

Le verify de cette reconstruction (`CHROMIUM=/usr/bin/chromium BANANE_TEST_TIMEOUT_MS=30000 node tools/verify.cjs`) termine avec le code 0 : **3 209 réussites sur 3 211, aucun échec ni annulation, deux omissions pour le corpus Natif privé absent**. Il vérifie aussi la syntaxe de 80 fichiers runtime et confirme les empreintes gelées de géométrie et du moteur. Le délai est celui déjà réglable du banc ; son défaut reste à 20 s. Les fichiers `audit/verification.*` sont ceux produits par cette exécution. Ce banc est partiel, les omissions ne sont pas des réussites.

Les recettes du panneau utilisent son vrai HTML et ses scripts par HTTP local, avec une API Chrome simulée : elles n'attestent pas un chargement réel de l'extension. La découverte de Playwright et de `CHROMIUM` est partagée. Ces changements de recettes sont séparés (`6deee823`). Les cinq fichiers navigateur modifiés ont été exécutés avec `CHROMIUM=/usr/bin/chromium` : 17 essais réussis, aucun échec, annulation ou omission (29,84 s).

**Limite de preuve.** Les changements non poussés de la première session et ses journaux ont disparu lors du renouvellement de l'environnement. La trace conversationnelle rapporte une maquette interrompue : 35 réussites, 13 échecs de montage, 10 annulations dans le premier groupe, trois fichiers suivants non lancés. Ce résultat historique ne vaut pas exécution de cette reconstruction. Aucune maquette complète réussie ni validation sur ESV réel n'est revendiquée.

Le blocage externe reste établi : la politique administrée `ExtensionInstallBlocklist: ["*"]` interdit le chargement de l'extension. Elle n'est ni modifiée ni contournée. Le chantier est sauvegardé sur sa branche ; **pas d'intégration au tronc ni de paquet** avant les preuves requises.

**SUPPOSÉ.** Le prochain module devra être choisi après inventaire de ses frontières ; aucune estimation de couverture globale ou de gain métier n'est déduite de ce premier périmètre.

## Module 2 : `src/file-parties.js` et `src/file-prioritaire.js`

### Inventaire des frontières (avant toute annotation)

**ÉTABLI** (lecture du code du tronc fusionné, rien n'est encore annoté ni mesuré à l'exécution).

**`src/file-parties.js`** (301 lignes, machine à états pure, enveloppe UMD ; exporte `BananeFileParties` gelé). Frontières :
- **Entrées non fiables, relues champ par champ** : l'état gardé dans `chrome.storage.local` (`relire`), le registre gardé (`registreAjouter`, `entreeRegistre`), le sélecteur de parties d'ESV (`planifier` : `status`, `parts[].part`), le constat de redémarrage (`reprise`), l'état du lot lu au moteur (`classerLot`). Ce sont les points où une valeur brute devient un numéro de partie ou de coupe : `entier(v)` rend `number|null`, c'est là qu'une marque devra être posée, une fois, par assertion locale.
- **Événements** (`transition(etat, ev)`, `ev.type` ouvert) : portent `part`, `vers` (partie), `lotId`, `issue`, `motif`, `detail`. Le plan (`plan`, `changement.vers`) est une liste de numéros de partie ; `k` et `rang` sont des indices dans le plan : ni partie ni coupe, ils resteront `number` simple.
- **Coupes** : seules `cuts()` et le registre (`poses`, `passe`, `valides`, `corriges[].cut`) manipulent des numéros de coupe.
- **Identifiant d'opération** : la machine ne porte que `lotId` (identifiant du lot, texte), pas d'identifiant d'opération au sens de la règle 4.2. Décision proposée : `lotId` reste `string` simple, le type `Operation` n'est pas appliqué à un identifiant de lot (SUPPOSÉ : deux notions distinctes ; à confirmer par l'intégrateur).
- **Appelants** (non modifiables, hors périmètre) : `background.js` (pilote `file*`, lignes ~4026 à ~4280, via `FPm()`), `src/ui5.js` et `panel.js` (lecture de `vue()`), `src/settings.js` (commentaire seul). `background.js` n'est pas un fichier interdit aux exécutants par `CLAUDE.md`, mais il n'est pas dans le périmètre du ticket : il n'est ni typé ni modifié ; la frontière avec lui reste de forme libre (états et événements `object`).
- **Sorties** : `{etat, actions, ignore?, refus?}`, `vue(e)` (forme lue par le panneau), registre persistant.

**`src/file-prioritaire.js`** (100 lignes, pur, exporte `ArianeFilePrioritaire` ; l'en-tête dit qu'il « n'est branché nulle part » : aucun appelant dans `src/` ni `background.js`, ÉTABLI par recherche). Appelants : `tools/file-prioritaire.cjs` (outil de simulation), `tests/file-prioritaire.test.cjs`. Frontières :
- **Entrée** : candidats `{part, cut, source, motif?, score?}` (partie et coupe) ; observations d'apprentissage `{classe, informatif, avecTraits?, coutS}` ; options (`taux`, `jugesDeja`, `ordre`, `critere`, `plancherParMin`).
- **Sortie** : entrées `{part, cut, groupe, signaux, details, rang}`, même forme que `src/correction-liste.js` (non typé ici).
- Pas d'unités métriques, pas de repères, pas d'identifiant d'opération : seuls `Partie` et `Coupe` s'appliquent. `coutS` est en secondes : pas de type marqué, il n'existe pas dans `types/ch075.d.ts` (à n'ajouter que si un mélange secondes/millisecondes apparaît).

**Types** : `Partie`, `Coupe` existants réutilisés ; aucun ajout prévu à ce stade. **Plan** : `tsconfig.ch075.json` et `tools/typage-ch075.cjs` passent d'un fichier à trois (empreintes d'origine par fichier, le tronc `5699f68` n'étant plus la base pour les nouveaux fichiers : base à fixer au tronc fusionné), puis annotations en un commit par fichier, puis cas négatifs partie/coupe et coupe/opération.
