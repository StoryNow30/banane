# Banane V4.5, lot 1 — banc du placement, hors ligne

Le moteur V4.4.3 est conservé **octet pour octet**. Ce lot ajoute seulement `tools/placement-lab.cjs`, ses tests et des résultats d'expérience. Il ne change ni l'extension installable, ni la collecte Natif, ni les actions ESV, ni les fenêtres, ni les seuils. Aucun entraînement n'est effectué.

## Reproduire

Node.js récent, sans dépendance téléchargée. Depuis la racine de cette archive :

```bash
node tools/verify.cjs
node tools/native-offline-evaluate.cjs --input CHEMIN/banane-native-v4-1789328681673.json --output audit/legacy.json --markdown audit/legacy.md --visual-dir audit/legacy-svg
node tools/placement-lab.cjs --input CHEMIN/banane-native-v4-1789328681673.json --out-dir audit/placement-run
```

Le témoin de 85 Mo est fourni séparément par Mic et **n'est pas inclus** dans l'archive du code. Les deux bancs vérifient les géométries déjà présentes dans le JSON : pas de connexion ESV, aucune navigation, aucune commande et aucune modification de paramètres. Comparez l'empreinte SHA-256 du témoin avec le manifeste avant de rapprocher les chiffres.

## Contrat d'entrée — par visite et par rail

`prepareVisit(record, clouds, observations)` ne lit que `identity`, `beforeEstablished`, `stateTransitions`, les états `native-visit-started` et `native-state-observed` de la même visite, `railSnapshots` et les morceaux LiDAR `clouds`. **Il ne lit ni `humanFinalReference`, ni `observedLabelCandidate`, ni `geometryEligibility`.** Les états, reliés à `eventSeq`, déterminent la borne *par rail* : position et matrices sont comparées séparément ; les transitions `rail-and-loaded-view-changed` comptent aussi. Un simple changement de caméra ne borne aucun rail. Un déplacement ou changement de matrice d'un seul côté laisse l'autre côté inchangé ; un changement impossible à attribuer borne prudemment les deux et garde son motif. On prend le premier snapshot qualifié, sauvegardé et acquis entièrement avant la borne du rail concerné. Lorsque aucun changement n'est observé, le banc ne prétend pas prouver qu'aucun geste n'a eu lieu. Détails et rejeu : `audit/V45_LOT1_BORNE_TEMPORELLE.md`.

Un rail est admis indépendamment de l'autre seulement si son identité complète (projet si connu, page, partie, cut, forme, frame), son côté, son état initial établi et son horodatage, sa matrice de profil, son repère de scène, sa transformation valide, son état de découpe, son ROI utile, les identifiants exacts des morceaux sauvegardés et la pose de chaque morceau sont concordants. Seuls les points dont `visibleByClipBoxes` vaut exactement `true` entrent dans le moteur ; les points hors découpe sont comptabilisés séparément. Les deux rails ne sont rapprochés que si identité et repère sont compatibles ; ils n'ont pas besoin d'être simultanés.

`capture` transmis à l'adaptateur moteur : identité, rail(s) avec profil et matrices observées, positions initiales, points scène relatifs de découpe vérifiée, drapeaux de visibilité, repère et identifiants de morceaux. Empreinte `inputHash` calculée sur cette entrée exacte ; acquisition, qualité, horodatage et nombre de points hors découpe restent disponibles pour le diagnostic. Une capture après changement de rail observé n'est **jamais** substituée à la capture avant correction. La chronologie des gestes peut néanmoins être plus fine que celle des états observés : ce garde-fou n'est pas une certification de l'absence de correction précoce non observée.

## Contrat de sortie — par moteur et par rail

L'interface `adapter = {id, parameters, run(prepared)}` permet d'exécuter un moteur géométrique futur ou un futur classeur de candidats sur **les mêmes entrées** ; seul l'adaptateur `reference` est fourni et exécuté. Le résultat inclut statut `candidate`/`unresolved`, delta dans le profil local initial, position proposée en scène relative si calculable, confiance **heuristique non calibrée**, motifs, diagnostics de surfaces et ambiguïté du template, version et paramètres du moteur et hashes des sources. Le moteur de référence expose sa meilleure alternative **de grille grossière** et sa graine fine dans `metrics.templateAmbiguity`, pas une liste exhaustive de candidats ; le banc ne simule pas des candidats inexistants. Le test compare directement l'adaptateur à `Geometry.proposeBoth` et aux entrées du banc historique.

La référence humaine ne devient visible qu'après exécution. Elle est **candidate, non revue** ; une seule intention `VALIDATE`, l'identité et l'`eventSeq` concordants, l'état complet capturé immédiatement avant cette intention, sa fraîcheur recalculée dans la fenêtre 0–1 500 ms et sa postériorité au snapshot sont requis. Un final à chronologie ou provenance incohérente est exclu. `SKIP`, intentions multiples ou absence de décision sont conservés mais exclus de la comparaison. `VALIDATE_NO_MOVEMENT` reste un label candidat positif, non un échec. Le score de différence est exprimé en **unités de scène**, jamais en millimètres certifiés lorsque `physicalCalibrationStatus` n'atteste pas une vérification indépendante. Aucun seuil d'acceptation métier ni apprentissage.

## Fichiers produits

- `manifest.json` : empreintes du témoin et des deux sources du moteur, méthode, paramètres, dénominateurs, exclusions, politique de sélection, statut « témoin connu de développement » ;
- `rails.json` : une ligne par visite avec résultats gauche/droite et paire, empreinte d'entrée, snapshot et provenance, position initiale, proposition, référence candidate, écarts si calculables et motif de refus ;
- `overlays.json` et `overlays/*.svg` : coupes Y latéral / Z vertical, nuage visible, points hors découpe, profil initial, proposition, finale candidate, axes et statut des unités.

Ces superpositions sont une vérification visuelle de la **cohérence interne des données exportées** ; sans ESV connecté, elles ne peuvent certifier à elles seules la fidélité au rendu réellement vu par Mic. Le témoin est connu et ne sera jamais revendiqué comme jeu de test indépendant. Le découpage entraînement/calibration/test futur doit être défini par blocs spatiaux indépendants, après accès à un chaînage ESV fiable et révision des labels.
