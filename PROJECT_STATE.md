# État du projet Banane

Date : 22 septembre 2026  
Version active de l'extension : **4.7.1 TEST** (build de mesure ; release officielle **4.7.0**, tag `v4.7.0`)  
Statut : développement expérimental, non qualifié pour la production.

## État 4.7.0

La 4.7.0 consolide le Pilote GCV1 et ferme la chaîne runtime. Elle ne retouche pas le placement : `src/geometry.js` et `src/geometry-candidate-v1.js` gardent leurs empreintes gelées, et `src/engine.js` reste conforme à la baseline déclarée `audit/v4.6.0-engine-baseline.json`. **Aucun gain de résolution n'est revendiqué** : le gain est la continuité du traitement et l'identification fiable des cas à revoir.

**Différer un rail non résolu.** En Pilote TEST, un cut réellement non résolu par GCV1 est quitté par une navigation sans décision — le chemin natif de Maj+Z — sans correction, sans `VALIDATE`, sans `SKIP`. Le cut est enregistré une fois comme `DEFERRED_UNRESOLVED` et compté à part de `processed` et `skipped`. La politique est figée à la création du lot ; un lot antérieur à 4.7 garde la pause historique. Le protocole durable interdit le double envoi et le rejeu après redémarrage : une commande dont l'émission reste incertaine n'est jamais renvoyée.

**Garde d'écartement de paire, deux étages indépendants.** Contrat admissible `[1405, 1470] mm`. Dans GCV1, une paire publiée hors contrat rend les **deux** rails non résolus, motif `gauge-out-of-contract`, sans repli V4.6. Dans le moteur, un dernier garde recalcule l'écartement prévu avant toute commande et refuse d'agir hors contrat, quel que soit le moteur d'origine. L'intervalle est un critère d'**admissibilité**, jamais une fonction d'optimisation vers une valeur cible.

**Origine terrain.** Sur la partie 15, 10 des 56 applications observées produisaient un écartement hors contrat, entre 1 503,5 et 1 564,0 mm, appliquées puis validées. Chaque rail était individuellement plausible ; c'est la paire qui était fausse, et la confiance seule ne les détectait pas. Ces dix cas sont rejoués par `tests/gauge-pair-gate.test.cjs` depuis leurs valeurs réelles.

**Banc au HEAD** : 550 tests, 548 réussis, 0 échec, 2 ignorés faute du corpus Natif privé, absent du clone public. Un test ignoré n'est pas un test réussi. Le placement est inchangé depuis 4.4.0 (SHA-256).

Les limites connues, chiffrées et justifiées, sont dans `KNOWN_ISSUES.md`. Les plus structurantes pour 4.7 : aucune transaction commune entre le stockage Banane et l'effet ESV (KI-025), dépendance à des symboles ESV internes non documentés (KI-026), et application séquentielle des deux rails sans restauration automatique (KI-030), caractérisée par `tests/ki030-partial-apply.test.cjs` et fermée par `reconcileRequired`.

## Historique V4.4 — conservé comme preuve

Retour terrain V4.4.2 : le bouton flottant « Banane V4 · ouvrir » est toujours visible alors qu'une fenêtre Banane est ouverte. **L'affirmation de succès en conditions ESV de la V4.4.2 était prématurée.** La V4.4.3 remplace l'inférence fragile par recherche des URL de fenêtres par deux preuves locales : identifiants des fenêtres ouvertes et connexions vivantes des pages Banane (renouvelées après redémarrage du service worker). Le bouton est physiquement retiré du DOM dès l'ouverture et réinséré après fermeture de la dernière fenêtre. La réponse d'état arrivée en retard ne peut plus annuler la notification d'ouverture. La version « 4.4.3 » est affichée pour confirmer visuellement la mise à jour. Un essai Edge/ESV V4.4.3 reste nécessaire ; les tests de navigateur sont simulés.

La V4.4.2 préserve dès sa lecture un **instantané LiDAR par rail**, avec points visibles dans la zone, pose initiale, repère, identité, preuve de source et heure d'acquisition. Le bloc reçoit un acquittement de stockage avant que Banane ne l'associe à une décision humaine ; la réception tardive d'un résumé de capture ne retire pas une preuve déjà sauvée. Une contradiction ultérieure produit une révocation tracée, pas un effacement silencieux. L'audit reproductible du véritable export V4.4.1 compte 76 visites, 539 309 points exportés dont 297 185 visibles, mais **0 rail comparable** sous ce contrat ancien : ses 23 rails-visites détectés par filtrage exploratoire ne prouvent pas le stockage avant intention et ne deviennent pas des labels certifiés.

L'objectif « bouton flottant absent tant qu'une fenêtre Banane est ouverte » **n'a pas été atteint sur ESV en V4.4.2** ; la V4.4.3 implémente un correctif testé localement mais non encore certifié dans Edge. Cette synchronisation d'interface n'intercepte aucun geste de Mic et ne lance aucune commande native. Deux ZIP distincts, installable et source/tests, sont produits pour vérifier le même code.

Banane propose maintenant quatre parcours séparés : **Mode Natif**, **Mes corrections**, **Assisté** et **Pilotage automatique TEST**.

La V4.4 a ajouté le Mode Natif ; la V4.4.1 corrige la perte de points de sa collecte. Il observe le travail manuel déjà réalisé dans ESV sans envoyer de changement de caméra, sélection de rail, déplacement, validation, SKIP ou navigation. Les entrées clavier et souris sont relevées passivement dès `document_start` : elles ne sont ni bloquées, ni retardées volontairement, ni réémises vers ESV. Un clic Banane démarre la session ; aucun clic supplémentaire n'est requis entre les cuts.

Chaque visite possède son propre `visitId`, y compris lorsqu'un cut déjà vu est revisité. Pause ferme la période d'observation courante et Reprendre en crée une autre. `eventSeq` décrit la chronologie sans la confondre avec l'ordre spatial ESV. L'export distingue première observation, état initial établi par rail, dernier état, référence humaine candidate, toutes les intentions opérateur, effet observé, commande Banane — toujours absente — et confirmation serveur — non observée avec les preuves disponibles. Une période interrompue reçoit une clôture récupérée sans état final inventé.

La lecture Natif ne demande aucun niveau de détail supplémentaire et ne change pas la vue. L'audit de trois exports V4.4 démontre que la lecture séquentielle de nœuds avec budget de 300 ms laissait presque toutes les zones utiles non balayées : 115 captures, 114 limitées, seulement 4 points exportés alors que 103 captures avaient au moins une sonde dans une zone de rail. Le lecteur V4.4.1 priorise les nœuds diagnostiqués proches, puis lit uniquement les points déjà chargés avec 512 nœuds, 50 000 points par rail, 500 000 points inspectés et 1 800 ms maximum, par portions de 2 048. Les points sont sauvegardés progressivement et séparément gauche/droite. La file d'événements reste bornée à 128 éléments. En surcharge, la collecte passe à `DEGRADED`, puis `METADATA_ONLY`, conserve les motifs et compte les événements abandonnés.

Le nouveau contrat `banane-native-session-v2` conserve les captures partielles et les exclusions. Une zone non vide ne suffit pas à qualifier un exemple : couverture, transformations, pose initiale, repère, identité et référence humaine candidate doivent être compatibles. Un rail peut être analysé seul. Les exemples restent tous `usableForTraining:false`.

## Placement et pilote inchangés

Trois fichiers restent **gelés à la référence 4.4.0** et sont vérifiés octet
pour octet par `tools/verify.cjs` contre `audit/v4.4.0-frozen-engine-hashes.json`,
qui n'est pas modifiable :

- `src/geometry.js` — `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` ;
- `vendor/capture-core.js` — `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054` ;
- `vendor/lidar.js` — `375f7dfb932143027e2c814f78bf3d66d5fbda5eb97f323735e3fd4932de6311`.

`src/geometry-candidate-v1.js`, la science GCV1, est figé de la même façon à
`77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503`.

**`src/engine.js` n'est plus gelé à 4.4.0** : il a été dégelé sur décision
explicite en V4.6.0 pour les défauts 4 et 9 d'`AUDIT_PILOTE.md`, puis
**ré-épinglé** sur une baseline déclarée, `audit/v4.6.0-engine-baseline.json`.
Sa valeur en 4.7.0 est `be15576321f7a1bf7b0c727281b7f8a882eeea254382c83cf96590220740da33`.
Le contrôle reste aussi strict : toute dérive non déclarée du moteur fait
échouer le banc, et la baseline doit recopier à l'identique les empreintes
historiques 4.4.0, si bien qu'elle ne peut pas servir à assouplir le gel par la
bande. *(La valeur `2bf19ce7…` que ce document annonçait auparavant est celle de
l'époque 4.4.3 ; elle est périmée depuis V4.6.0.)*

Les sécurités V4.3 restent actives : les quatre preuves après commande restent distinctes, une cible changée avant relecture devient `AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED`, Pause est disponible dans Mes corrections et aucun SKIP automatique silencieux n'est autorisé.

Le traitement d'un rail non résolu, lui, **a changé en 4.7** : `PAUSED_UNRESOLVED_RAIL` reste le comportement des lots en politique `pause` et de tous les lots antérieurs à 4.7, mais les nouveaux lots Pilote GCV1 diffèrent le cut par défaut. Dans les deux cas, aucune correction partielle n'est appliquée et aucune décision ESV n'est émise.

## Banc hors ligne conservé

Le certificat V4.3 reconnaît 110 corrections humaines et 110 nuages, soit 1 314 278 points : 80 corrections des deux rails, 13 gauche seule, 4 droite seule et 13 validations sans mouvement. Le rejeu du moteur inchangé produit 68 cuts entièrement comparables et 47 rails non résolus. Il n'entraîne rien et n'ajuste aucun seuil.

Les résultats restent dans `audit/ingestion-certificate-v4.3.0.json`, `datasets/automatic/offline-evaluation-v4.3.0.json` et `OFFLINE_EVALUATION.md`. La portion V4.2 des cuts 9031 à 9047 reste réservée à l'évaluation finale et n'est utilisée pour aucun réglage.

## Données de référence

- `datasets/manual/banane-corrections-v4-1788961523204.json` : 47 cuts, 94 rails, 47 captures LiDAR, part 11, profil U50 ;
- SHA-256 : `94aca057eb9e92f55c30da81687723c625f6e23ee085f54c01112ea19c646ac9` ;
- résultats historiques : `datasets/automatic/geometry-evaluation-v4.1.0.json` et `datasets/automatic/geometry-evaluation-v4.2.0.json` ;
- référence originale préservée : `archive/banane-v4.0.0-original.zip`, SHA-256 `398d87e40a598fa1940544cbfadc2b56f20b99388bba17d6e3127f700c232ba0`.

## Limites bloquantes

- **Époque V4.4.x, jamais reprise.** Le bouton a été vu **toujours visible** dans ESV avec la V4.4.2 ; le correctif V4.4.3 n'a jamais reçu de contrôle dédié dans Edge et KI-023 reste ouverte. Aucun export pris avec la **4.4.3** n'existe : aucune paire géométrique réelle, comparaison du moteur, preuve visuelle dans ESV ou mesure de fluidité Edge/IndexedDB ne peut être certifiée pour cette version.
- Les versions des attributs Potree sont contrôlées, mais une mutation en place des points sans mise à jour de version/source n'est pas décelable par référence seule ; vérifier sur ESV. La cohérence des matrices n'établit pas une calibration physique indépendante des unités.

- Les trois premiers exports audités proviennent de la V4.4.0 ; **un export V4.4.1 supplémentaire a été fourni et audité** (76 visites, 539 309 points, mais 0 rail comparable prouvé selon le contrat temporel). Aucune visualisation de couple géométrique réel ni mesure instrumentée de fluidité WebGL/Potree n'est disponible ; les tests Node ne les remplacent pas.
- Aucun état ESV fiable observé ne permet de nommer un cut « vert » ou « rouge » dans l'export Natif. Les visites sont conservées sans inventer cette information.
- L'identifiant projet, l'ordre spatial, le chaînage, la geominfo brute et le contexte voie/aiguillage/passage à niveau restent non observés.
- La valeur d'écartement affichée par ESV n'est pas récupérée de manière vérifiable ; aucune décision automatique n'est activée.
- Aucun accusé serveur ESV exploitable n'est disponible. Le Mode Natif ne transforme donc jamais une intention clavier en validation serveur confirmée.
- Une lecture Natif peut devenir partielle si l'opérateur change de cut, de caméra ou de rail pendant la lecture ; Banane conserve alors le motif sans réessayer aveuglément. Les points déjà sauvés restent liés à l'ancienne visite.
- Les anciens exports V4.4 ne contiennent aucun exemple éligible sous le nouveau contrat. Le banc V4.4.1 peut les ingérer mais ne calcule aucune précision inventée : 0 rail et 0 paire comparables. Une nouvelle session est nécessaire.
- Une visite Natif potentiellement comparable reste dans un corpus distinct. `usableAsNativeReference` décrit sa candidature après contrôle ; `usableForTraining` reste faux et aucun mélange automatique avec `explicit-manual-session` n'est effectué.

## Livraison

Les archives 4.7.0 TEST installable et source/tests se construisent avec `tools/package.py` (voir `README.md`). Pour que l'empreinte SHA-256 du ZIP soit reproductible, l'archive doit être construite depuis un export propre du commit — `git archive <commit>` — et non depuis un répertoire de travail, dont les dates de fichiers dépendent du clone. Le ZIP source/tests contient les trois JSON historiques V4.4 en lecture seule nécessaires pour reproduire les tests, mais **pas** le grand export V4.4.1 : son audit recalculé et son empreinte sont livrés et son rejeu nécessite que Mic fournisse ce fichier séparément. Le ZIP installable exclut tous les JSON Natif ; l'archive originale reste hors des deux ZIP. Protocole terrain : `NATIVE_GEOMETRY_ACCEPTANCE.md`.
