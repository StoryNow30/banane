# Banane V4 TEST 4.4.3 — 13 septembre 2026

## 4.5.0 — 15 septembre 2026

Première version officielle de la série V4.5. Le moteur de placement reste gelé
octet pour octet ; `tools/verify.cjs` continue de le contrôler.

**Collecte.** La dégradation du collecteur redevient réversible : auparavant un
seul échec d'envoi faisait basculer définitivement en `METADATA_ONLY`, où toute
capture LiDAR est refusée, et le reste de la session perdait sa géométrie. Les
refus légitimes de la session (cut changé, identifiant déjà utilisé, visite
inconnue) ne sont plus comptés comme des pannes de transport. La file d'envoi ne
se fige plus sur un élément fautif : réessais bornés, puis mise à l'écart avec
la cause. Profondeur de file portée de 128 à 512.

**Lecteur.** L'évaluation de couverture était quadratique précisément dans les
cas qui ne se qualifient jamais, mangeant le budget de lecture. Accumulateur
incrémental : 197 ms à 30 ms sur 32 000 points. Deux tampons conservant chaque
point retenu ont été supprimés.

**Export.** Le mur des 64 Mo est levé : plus aucune concaténation en une chaîne
unique, format compact sans perte (61 à 67 % de gain mesuré, équivalence moteur
démontrée au bit près), segmentation budgétée sur le poids réel du fichier, et
vidage automatique pendant la collecte pour que rien ne soit perdu si la session
s'interrompt. `tools/merge-segments.cjs` refusionne les segments.

**Interface.** Bloc « Santé de la collecte » en direct dans la fenêtre Natif, et
réglages de collecte consultables depuis l'interface.

**Réglages.** Tous les paramètres de collecte et d'export sont réunis dans
`src/settings.js`, avec leur unité, leur raison d'être et la mesure de terrain
qui les a fixés. Les seuils géométriques restent dans le moteur gelé.

- Régression confirmée par Mic : le bouton flottant de V4.4.2 ne disparaît pas dans ESV malgré l'ouverture de Banane ; succès simulé non assimilé à une validation terrain.
- Fenêtres enregistrées explicitement et pages connectées par un canal de présence vivant, renouvelé après reprise du service worker ; plus de déduction depuis la recherche d'onglets d'extension par URL.
- Bouton retiré du DOM pendant l'ouverture de Banane et remis après fermeture de la dernière fenêtre ; réponses de statut tardives ignorées. Libellé de version 4.4.3 visible pour faciliter le contrôle d'installation.
- Nouveaux tests couvrant le filtre URL vide, deux fenêtres, les réponses en retard et la reconnexion ; moteur de placement, pilote et collecte Natif géométrique inchangés.

# Banane V4 TEST 4.4.2 — 13 septembre 2026

- Audit reproductible de l'export réel V4.4.1 : 76 visites, 539 309 points dont 297 185 dans le clipping, 0 rail comparable prouvé ; les anciens exports ne sont pas promus.
- Checkpoint LiDAR par rail sauvegardé avant événement acquitté, avec acquisitions datées, pose/source/clipping vérifiés et révocation explicite en cas de contradiction.
- Le lecteur distingue chargement de nœuds Potree et changement de caméra ; le banc hors ligne ne transmet au moteur que les points effectivement visibles, sans référence finale en entrée.
- Bouton flottant Banane masqué lorsqu'une fenêtre Banane est ouverte, restauré après fermeture de toutes les fenêtres ; comportement testé aussi avec deux panneaux.
- Archive source avec tests reproductibles en plus du ZIP installable ; algorithme de placement et pilote figés. Résultat réel ESV V4.4.2 encore inconnu.

# Banane V4 TEST 4.4.1 — 13 septembre 2026

- Perte LiDAR reproduite sur trois exports V4.4 : 685 558 points lus, seulement 4 conservés ; les nœuds éloignés épuisaient le temps avant ceux des zones utiles.
- Nouveau lecteur Natif passif qui priorise les nœuds proches des rails sans changer de vue, borné et découpé en sauvegardes progressives ; causes d'absence de points explicites.
- Observations gauche/droite autonomes (repère, matrices, pose, instant et cut) ; interruption et changement de cible consignés sans fusionner les géométries.
- Qualification par rail et par paire sur couverture, densité, transformation et association à la référence ; labels candidats, jamais automatiquement entraînables.
- Chronologie `event_seq`, intentions multiples conservées, revisites et pauses distinctes, clôture récupérée sans inventer un état final.
- Banc hors ligne et superpositions SVG prêts pour un nouvel export ESV ; sur les trois anciens exports, zéro exemple qualifié et aucune amélioration de précision démontrable.
- 170 tests réussis ; moteur, pilote et lecteur LiDAR partagé inchangés. La fluidité ESV réelle et les preuves visuelles restent à vérifier avec Mic.

# Banane V4 TEST 4.4.0 — 11 septembre 2026

- Nouveau **Mode Natif** dans une fenêtre dédiée : Démarrer, Pause/Reprendre, Terminer et exporter.
- Observation clavier/souris passive dès `document_start`, sans blocage, retard volontaire ni réémission vers ESV.
- Aucune commande de caméra, sélection de rail, déplacement, validation, SKIP ou navigation accessible au collecteur Natif.
- Une visite distincte à chaque affichage, y compris les retours sur le même cut ; périodes séparées après Pause/Reprendre.
- Export `banane-native-session-v1` séparant état initial/final observé, intention, effet, commande Banane absente et confirmation serveur non observée.
- Provenance `native-passive-observation` séparée ; aucune visite n'est versée automatiquement à l'entraînement.
- Lecture limitée aux points déjà chargés dans la vue courante, découpée et bornée ; aucun LOD ni changement de vue demandé.
- File de collecte bornée avec niveaux `FULL`, `DEGRADED` et `METADATA_ONLY`, pertes comptées et panne durable visible une seule fois.
- Sauvegarde progressive des événements, visites et LiDAR ; reprise après interruption sans continuité inventée.
- Exclusion de collecte concurrente avec Mes corrections, l'assisté ou le pilote.
- Mesure de fluidité hors ESV ajoutée dans `audit/native-fluidity-v4.4.0.json`.
- 158 tests réussis. Géométrie, lecteur de géométrie et pilote inchangés par empreinte SHA-256.

# Banane V4 TEST 4.3.0 — 10 septembre 2026

- Séparation stricte des preuves `commandSent`, `afterObserved`, `serverConfirmed` et `navigationObserved`.
- Blocage explicite `AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED` lorsqu'une navigation précède la relecture après commande.
- Pause `PAUSED_UNRESOLVED_RAIL` sur rail non résolu, sans validation partielle ni avancement ; actions explicites de réessai, reprise manuelle, SKIP ou arrêt.
- SKIP automatique silencieux désactivé ; toute incertitude de rail/données privilégie Pause.
- Bouton Pause restauré dans Mes corrections, avec reprise sur le même cut sans décision native.
- Quatre labels humains explicites, dont `VALIDATE_NO_MOVEMENT` comme label positif.
- Identité étendue et événements de changement de cut ; préparation de `previousCutId`, `nextCutId`, `sequenceIndex` et geominfo, sans intégrer le voisinage au moteur.
- États de clôture non confirmés et listes exactes des cuts concernés.
- Banc hors ligne reproductible sur 110 corrections humaines, certificat d'ingestion des quatre exports et rapport de métriques par version et label.
- Géométrie et seuils de proposition inchangés.

# Banane V4 TEST 4.2.1 — 10 septembre 2026

- Seuil inférieur métier définitivement fixé à 1 410 mm.
- Moins de 1 410 mm : SKIP ; de 1 410 à moins de 1 430 mm : validation avec tolérance.
- Ancienne hypothèse de seuil inférieur supprimée du cadrage, de la structure vérifiable et des tests.
- Retour d'essai de Mic sur les interruptions fréquentes du pilote 4.1 enregistré comme problème connu.
- Aucun calcul géométrique, aucun assouplissement de garde-fou et aucun correctif du pilote automatique dans cette version.

# Banane V4 TEST 4.2.0 — 10 septembre 2026

- `Shift + Backspace` reconnu dans Mes corrections comme décision opérateur `SKIP`, distincte de `VALIDATE`.
- État avant, LiDAR disponible et état final des deux rails conservés avant l'envoi de la commande.
- SKIP exporté avec `usableForTraining: false` et sans motif d'écartement inventé.
- Relais unique du raccourci au gestionnaire clavier ESV ; aucune substitution par « prochain cut invalide ».
- Navigation observée avant préparation automatique du cut suivant ; absence de navigation signalée sans réémission.
- Scénario validation → SKIP → validation, trois captures, répétitions clavier et reprise après erreur couverts par les tests.
- Aucun nouveau bouton, aucun SKIP automatique et aucun changement fonctionnel du pilote automatique.
- Règle d'écartement ajoutée au cadrage ; ancien chevauchement de seuil consigné comme contradiction bloquant son automatisation.

# Banane V4 TEST 4.1.0 — 10 septembre 2026

- Placement du champignon fondé sur le recalage du gabarit U50 complet, avec plans de roulement et flanc interne obligatoires comme preuves de support.
- Détection de minima concurrents distants ; une ambiguïté géométrique ne reçoit plus une confiance artificiellement élevée.
- Refus d'un déplacement latéral supérieur à 60 mm lorsqu'il n'est pas soutenu par le second rail.
- Analyse reproductible des 47 corrections : erreur moyenne 7,59 → 4,12 mm sur les rails acceptés ; maximum 78,04 → 11,43 mm ; trois erreurs supérieures à 70 mm refusées.
- Couverture publiée avec la précision : 76 rails sur 94 et 29 cuts complets sur 47 restent proposables.
- Structure pure de lecture et classification d'écartement ajoutée, sans sélecteur ESV ni action SKIP supposés.
- Documents de gouvernance, datasets séparés, archive originale et répertoire de releases instaurés.

# Banane V4 TEST 4.0.0 — 9 septembre 2026

- Accueil sombre ; fenêtres séparées Pilotage automatique et Mes corrections ; essai assisté optionnel.
- Session de corrections avec Démarrer puis Terminer et télécharger. Plus de boutons avant/après par cut dans cette fenêtre.
- Préparation des deux vues LiDAR et retour au rail gauche ; état visible dans ESV.
- Interception active uniquement en session, installée au chargement de la page. Sauvegarde de l’après avant transmission unique de la validation native demandée par l’opérateur.
- Reconnaissance de Shift + Espace, du bouton natif et d’Entrée, annoncée dans le titre du bouton ESV exporté.
- Accusé de sauvegarde explicite, contrôle de cible, doublons empêchés, arrêt et reprise testés.
- Dernier cut modifié conservé à la fin ; cut préparé mais inutilisé écarté ; changements de part admis dans la même page.
- Export de session contenant références, LiDAR et événements. Provenance manuelle distincte des résultats automatiques.
- Relance des lectures LiDAR instables sans déplacement de rail ; trois tentatives par vue et budget global. Reprise du lot sans annulation manuelle de capture.
- Si le LiDAR reste indisponible pendant une session manuelle, conservation de la correction avec marqueur incomplet, puis poursuite du workflow opérateur.
- Refus de propositions sans deux surfaces suffisamment observées ou avec pente forcée. Calcul des autres positions conservé.
- Activités automatique, assistée et correction manuelle incompatibles empêchées de s’exécuter simultanément.
- Stockage V3 et sources originales conservés. Aucun entraînement automatique et aucune preuve serveur ajoutés.

# Correctif V3 TEST 3.0.1 — 9 septembre 2026

Incident de référence : part 24 / cut 7460, journal réel fourni par Mic.

- Refus d’un lancement exigeant une preuve serveur indisponible **avant toute écriture**.
- Conservation de la cause d’arrêt dans le lot ; une erreur d’actualisation apparaît
  séparément et ne remplace plus cette cause.
- Actualisation du panneau sans attente bloquante et sans accumulation de requêtes.
- Archivage d’une ancienne validation incertaine au lancement d’un autre cut ;
  conservation des références et absence de second envoi sur le cut en attente.
- Clôture répétée sans erreur trompeuse ; conservation d’une capture manuelle distincte.
- Navigation reconnue par le libellé du cut sans exiger les objets du prochain rail
  en fin de lot. Un lot plus long attend leur disponibilité ou se met en pause.
- Accusés de réception et étapes de commande dans le journal ; une expiration de
  lecture seule n’envoie plus de demande d’annulation à l’adaptateur.
- Vérification de la version de l’adaptateur à la connexion ; indication de reconnexion.
- Schéma de stockage inchangé. Algorithme géométrique et corpus initial inchangés.

Le journal réel sert de fixture de reprise. Aucun chargement Edge de ce correctif
ni nouvelle exécution ESV n’ont été réalisés ici.

# Changements V3 TEST 3.0.0 — 9 septembre 2026

Base : sources V2.4.2 disponibles. Le correctif historique de capture était déjà
présent ; les originaux sont préservés et ses 32 tests sont repris sans changement.

- Réutilisation exacte de `capture-core.js` et `lidar.js` dans `vendor/`.
- Fenêtre dédiée réouvrable par l’icône Edge et par un bouton dans ESV.
- Machines distinctes de collecte et de lot, persistance de l’état et des nuages.
- Identité fondée sur page, part, cut, U50 et repère ; correspondance gauche/droite
  indépendante de l’ordre des objets et de leurs translations.
- Lecture depuis deux vues puis fusion des points identiques, avec provenance.
- Première méthode géométrique sans ML : recalage au contour et estimation
  robuste de l’intersection des surfaces du champignon ; score explicite.
- Modes Observation, Assisté et Automatique TEST dans le même moteur.
- Application par commandes ESV issues des anciennes sources et clic canvas
  projeté, contrôlée par relecture ; restauration avant tentative de validation.
- Lot sans acceptation individuelle, périmètre explicite, choix pause/ignorance/
  tentative à faible confiance, pause et arrêt, prévention des doublons.
- Archivage avant commande de validation ; distinction explicite entre navigation
  observée et enregistrement serveur, qui reste non confirmé.
- Reprise interrompue avec réconciliation et clôture d’un résultat incertain.
- Exports des références, du journal et de tous les nuages acquis.
- Audit du corpus et évaluation reproductible sur des cuts séparés de ceux du réglage.

Les tests ont notamment conduit à verrouiller les doubles lancements de lot,
préserver l’étape après une application vérifiée, remettre les métadonnées des
captures V3 en cohérence avec leurs références et accepter les messages émis par
la fenêtre d’extension même lorsqu’elle possède un identifiant d’onglet.

Les essais dans Edge/ESV restent non exécutés. Aucun statut « production » ni
confirmation serveur n’est ajouté. Le paquet n’altère pas les sources V2.4.2.
# Banane V4.5 lot 1 — expérimentation hors ligne (14 septembre 2026)

- Source V4.4.3 copiée dans un chantier dédié ; extension installable, moteur, pilote et collecte inchangés.
- Banc de placement `tools/placement-lab.cjs` : admission de snapshots LiDAR persistés avant premier changement de rail observé, entrée sans finale humaine, contrat d'adaptateur pour variantes futures, résultats et superpositions par rail.
- Le témoin V4.4.3 retrouve 22 visites / 377 477 points ; cinq comparaisons strictes au lieu des sept historiques (captures droites des cuts 314 et 333 postérieures au premier changement observé).
- Sept tests du banc ajoutés : 195/195 tests locaux ; aucun entraînement ni essai ESV réel dans ce lot. Rapport et limites dans `audit/V45_LOT1_RAPPORT.md`.
# Banane V4.5 lot 1 — correctif de borne temporelle

- Attribution des transitions de rail gauche/droit depuis les états natifs exportés et leur `eventSeq`, y compris déplacement associé à changement de vue ; caméra seule exclue de la borne ; incertitude de côté ou repère exclue prudemment avec motif.
- Référence finale candidate vérifiée contre l'état avant `VALIDATE`, le même événement et une fraîcheur recalculée de 0 à 1 500 ms ; aucune finale n'entre dans l'entrée du moteur.
- Même témoin V4.4.3 : 314, 332 et 333 droits nouvellement admis ; 332 sans finale comparable ; 7 comparaisons candidates au total. 201/201 tests, moteur et collecte inchangés. Rapport : `audit/V45_LOT1_BORNE_TEMPORELLE.md`.
