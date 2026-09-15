# État du projet Banane

Date : 14 septembre 2026  
Version active de l'extension : **4.4.3 TEST** ; chantier hors ligne **V4.5 lot 1**  
Statut : développement expérimental, non qualifié pour la production.

Le lot 1 V4.5 fournit un banc **hors ligne**, pas une nouvelle extension ni un moteur entraîné. Le ZIP V4.4.3 fourni et le moteur restent inchangés. Le témoin natif contient 22 visites et 377 477 points. Après correction de la borne temporelle **par rail**, le banc admet 14 rails gauches et 12 droits (toutes visites), dont **7 propositions comparables à une finale candidate** (3 gauches et 4 droits). Trois rails droits supplémentaires deviennent admissibles (cuts 314, 332, 333) : le 332 n'a pas de finale comparable ; aux cuts 314 et 333, la gauche avait changé avant la capture droite, mais le droit n'avait pas encore changé. Les cinq comparaisons précédemment annoncées décrivent l'ancienne borne commune, désormais historique. **201 tests locaux réussis**, sans essai ESV. Voir `PLACEMENT_LAB.md` et `audit/V45_LOT1_BORNE_TEMPORELLE.md` ; les autres états V4.4.3 ci-dessous restent à valider sur Edge/ESV.

## Résultat actuel

Retour terrain V4.4.2 : le bouton flottant « Banane V4 · ouvrir » est toujours visible alors qu'une fenêtre Banane est ouverte. **L'affirmation de succès en conditions ESV de la V4.4.2 était prématurée.** La V4.4.3 remplace l'inférence fragile par recherche des URL de fenêtres par deux preuves locales : identifiants des fenêtres ouvertes et connexions vivantes des pages Banane (renouvelées après redémarrage du service worker). Le bouton est physiquement retiré du DOM dès l'ouverture et réinséré après fermeture de la dernière fenêtre. La réponse d'état arrivée en retard ne peut plus annuler la notification d'ouverture. La version « 4.4.3 » est affichée pour confirmer visuellement la mise à jour. Un essai Edge/ESV V4.4.3 reste nécessaire ; les tests de navigateur sont simulés.

La V4.4.2 préserve dès sa lecture un **instantané LiDAR par rail**, avec points visibles dans la zone, pose initiale, repère, identité, preuve de source et heure d'acquisition. Le bloc reçoit un acquittement de stockage avant que Banane ne l'associe à une décision humaine ; la réception tardive d'un résumé de capture ne retire pas une preuve déjà sauvée. Une contradiction ultérieure produit une révocation tracée, pas un effacement silencieux. L'audit reproductible du véritable export V4.4.1 compte 76 visites, 539 309 points exportés dont 297 185 visibles, mais **0 rail comparable** sous ce contrat ancien : ses 23 rails-visites détectés par filtrage exploratoire ne prouvent pas le stockage avant intention et ne deviennent pas des labels certifiés.

L'objectif « bouton flottant absent tant qu'une fenêtre Banane est ouverte » **n'a pas été atteint sur ESV en V4.4.2** ; la V4.4.3 implémente un correctif testé localement mais non encore certifié dans Edge. Cette synchronisation d'interface n'intercepte aucun geste de Mic et ne lance aucune commande native. Deux ZIP distincts, installable et source/tests, sont produits pour vérifier le même code.

Banane propose maintenant quatre parcours séparés : **Mode Natif**, **Mes corrections**, **Assisté** et **Pilotage automatique TEST**.

La V4.4 a ajouté le Mode Natif ; la V4.4.1 corrige la perte de points de sa collecte. Il observe le travail manuel déjà réalisé dans ESV sans envoyer de changement de caméra, sélection de rail, déplacement, validation, SKIP ou navigation. Les entrées clavier et souris sont relevées passivement dès `document_start` : elles ne sont ni bloquées, ni retardées volontairement, ni réémises vers ESV. Un clic Banane démarre la session ; aucun clic supplémentaire n'est requis entre les cuts.

Chaque visite possède son propre `visitId`, y compris lorsqu'un cut déjà vu est revisité. Pause ferme la période d'observation courante et Reprendre en crée une autre. `eventSeq` décrit la chronologie sans la confondre avec l'ordre spatial ESV. L'export distingue première observation, état initial établi par rail, dernier état, référence humaine candidate, toutes les intentions opérateur, effet observé, commande Banane — toujours absente — et confirmation serveur — non observée avec les preuves disponibles. Une période interrompue reçoit une clôture récupérée sans état final inventé.

La lecture Natif ne demande aucun niveau de détail supplémentaire et ne change pas la vue. L'audit de trois exports V4.4 démontre que la lecture séquentielle de nœuds avec budget de 300 ms laissait presque toutes les zones utiles non balayées : 115 captures, 114 limitées, seulement 4 points exportés alors que 103 captures avaient au moins une sonde dans une zone de rail. Le lecteur V4.4.1 priorise les nœuds diagnostiqués proches, puis lit uniquement les points déjà chargés avec 512 nœuds, 50 000 points par rail, 500 000 points inspectés et 1 800 ms maximum, par portions de 2 048. Les points sont sauvegardés progressivement et séparément gauche/droite. La file d'événements reste bornée à 128 éléments. En surcharge, la collecte passe à `DEGRADED`, puis `METADATA_ONLY`, conserve les motifs et compte les événements abandonnés.

Le nouveau contrat `banane-native-session-v2` conserve les captures partielles et les exclusions. Une zone non vide ne suffit pas à qualifier un exemple : couverture, transformations, pose initiale, repère, identité et référence humaine candidate doivent être compatibles. Un rail peut être analysé seul. Les exemples restent tous `usableForTraining:false`.

## Placement et pilote inchangés

La V4.4.3 ne modifie ni `src/geometry.js`, ni `vendor/capture-core.js`, ni `src/engine.js`, ni `vendor/lidar.js`. Leurs SHA-256 restent respectivement :

- `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` ;
- `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054` ;
- `2bf19ce7ecc800afccaf9b710bdce0745d4ed379e71e0b8457fca0cd5c5069f6`.
- `375f7dfb932143027e2c814f78bf3d66d5fbda5eb97f323735e3fd4932de6311`.

Les sécurités V4.3 restent actives : les quatre preuves après commande restent distinctes, une cible changée avant relecture devient `AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED`, un rail non résolu devient `PAUSED_UNRESOLVED_RAIL`, Pause est disponible dans Mes corrections et aucun SKIP automatique silencieux n'est autorisé.

## Banc hors ligne conservé

Le certificat V4.3 reconnaît 110 corrections humaines et 110 nuages, soit 1 314 278 points : 80 corrections des deux rails, 13 gauche seule, 4 droite seule et 13 validations sans mouvement. Le rejeu du moteur inchangé produit 68 cuts entièrement comparables et 47 rails non résolus. Il n'entraîne rien et n'ajuste aucun seuil.

Les résultats restent dans `audit/ingestion-certificate-v4.3.0.json`, `datasets/automatic/offline-evaluation-v4.3.0.json` et `OFFLINE_EVALUATION.md`. La portion V4.2 des cuts 9031 à 9047 reste réservée à l'évaluation finale et n'est utilisée pour aucun réglage.

## Données de référence

- `datasets/manual/banane-corrections-v4-1788961523204.json` : 47 cuts, 94 rails, 47 captures LiDAR, part 11, profil U50 ;
- SHA-256 : `94aca057eb9e92f55c30da81687723c625f6e23ee085f54c01112ea19c646ac9` ;
- résultats historiques : `datasets/automatic/geometry-evaluation-v4.1.0.json` et `datasets/automatic/geometry-evaluation-v4.2.0.json` ;
- référence originale préservée : `archive/banane-v4.0.0-original.zip`, SHA-256 `398d87e40a598fa1940544cbfadc2b56f20b99388bba17d6e3127f700c232ba0`.

## Limites bloquantes

- Le bouton a été vu **toujours visible** dans ESV avec la V4.4.2 ; la correction V4.4.3 n'est pas encore validée dans Edge. Aucun export pris avec la **4.4.3** n'existe encore : aucune paire géométrique réelle, comparaison du moteur, preuve visuelle dans ESV ou mesure de fluidité Edge/IndexedDB ne peuvent être certifiées.
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

Les archives V4.4.3 TEST installable et source/tests sont dans `releases/`. Le ZIP source/tests contient les trois JSON historiques V4.4 en lecture seule nécessaires pour reproduire les tests, mais **pas** le grand export V4.4.1 : son audit recalculé et son empreinte sont livrés et son rejeu nécessite que Mic fournisse ce fichier séparément. Le ZIP installable exclut tous les JSON Natif ; l'archive originale reste hors des deux ZIP. Protocole terrain : `NATIVE_GEOMETRY_ACCEPTANCE.md`.
