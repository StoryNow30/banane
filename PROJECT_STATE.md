# État du projet Banane

Date : 24 septembre 2026  
Version active de l'extension : **4.7.18 TEST** (un appui est un cut posé, D-052 ; « Réessayer » refusé après déplacement manuel des rails ; interface « La ligne » complète ; décision sur le lot appliquée, reprise appui jusqu'à 15 mm, garde d'écartement voisin 20 mm, choix à 5 points de dessus, garde de continuité sans repli sur la paire retirée, garde de paire ; D-041 à D-052 ; « Observer seulement » = 4.7.9 ; release officielle **4.7.0**, tag `v4.7.0`)
Statut : développement expérimental, non qualifié pour la production.

## État 4.7.18

Un appui est un cut posé (KI-057, D-052) : la décision ne s'appuie plus que sur
des cuts commandés, appliqués et validés. Mesure (`audit/appui-pose-2026-09-24.md`) :
Natif inchangé ; lots Pilote, 434 décisions commandables au lieu de 436, 207
justes au lieu de 209, faux inchangé (1) ; les deux cuts perdus (partie 2 : 115,
116) n'avaient d'appuis que grâce au défaut. « Réessayer » refusé après
déplacement manuel des rails (KI-055). Version de création du lot consignée
(I1). C5 au rapport d'acceptation (KI-056). Intégrés : relecture 4.7.16,
chantier 5 (matrice d'acceptation, 44 exigences), chantier 7 (faux sans appui :
observer, D-051).

Avant une candidate 4.8.0-rc : un lot neuf, complet, relu, sous la 4.7.18 ; le
seuil C4 de sortie ; P2 ; la définition d'un lot complet ; le contrôle visuel
dans Edge (§14 H).

## État 4.7.17

Interface « La ligne » complète (chantier B) : dernière commande en trois
étapes, écartement dans l'Assisté, pastilles d'onglets, « Nouveau lot »,
tiroir « Détails ». Deuxième vague de chantiers lancée (consignes 5, 6, 7 :
tests d'acceptation, relecture 4.7.13–4.7.16, faux sans appui). Rapport de
sortie en brouillon (`audit/rapport-sortie-4.8.md`, `tools/sortie-report.cjs`) :
C3 et C5 tenus ; C1 et C4 sans lot de validation (toutes les parties relues ont
servi au réglage) ; C2 non publiable sans P2.

## État 4.7.16

Garde d'écartement voisin à 20 mm et choix à 5 points de dessus, validés par
la direction (D-050) : sur 6 sessions Natif et 5 lots Pilote relus, 711
décidés au lieu de 690, +13 justes, −1 faux (7026), aucun juste perdu. À
confirmer sur le premier lot 4.7.16 relu.

## État 4.7.15

Bilan des curseurs de la décision sur le lot (C5, D-047,
`audit/curseurs-lot-2026-09-24.md`) : sur 652 cuts décidés et 489 jugés,
`chainMm` à 15 mm gagne 4 justes sans faux ni juste perdu ; il est desserré,
les autres curseurs sont conservés avec leur coût mesuré. Filtres du choix mesurés : `minTop` du choix à 5 gagne 11 justes sans faux (retenu en 4.7.16). Relecture
ciblée des prochains lots (D-048).

Lots 4.7.14 de la partie 2, relecture ciblée (110–138) : pose de départ d'ESV
décalée (1500 mm, 60–200 mm des rails) ; 2 faux sur 11 jugés, dont 114 à
207,6 mm (premier passage sans appui, KI-054) ; la 4.7.15 l'aurait différé et
aurait placé 115 et 116 justes (`audit/cas-decalage-esv-p2-2026-09-24.md`) —
corrigé en 4.7.18 : ces deux gains s'appuyaient sur des cuts hors de la vue
(KI-057).

Garde d'écartement voisin mesurée (`audit/ecartement-voisin-2026-09-24.md`) :
à 20 mm, le faux 7026 est retiré, +2 justes, aucun perdu ; l'aide au choix et
la cible ne changent aucun cut. Garde à 20 mm et `minTop` du choix à 5
activés en 4.7.16 (D-050). Cahier 4.9 ouvert en brouillon (D-049).

## État 4.7.14

Relecture indépendante de la 4.7.12 (chantier 3) intégrée : un défaut
bloquant (KI-053) et la reprise sur cut archivé (KI-052) corrigés ; questions
ouvertes à la direction dans D-046.

Premier lot 4.7.12 (partie 35, sans relecture, jamais vue) : 203 cuts traités
sur 233 (87 %), dont 32 placés par la décision sur le lot (28 choix,
4 reprises depuis la voie) ; 30 différés (21 moteur, 8 écartement, 1 sans
entrée), dont 3 hors de la vue (8951–8953) ; aucune erreur, aucun déclenchement
de la garde de paire, aucun cas KI-053 ; parité du rejeu 233/233
(`audit/acceptance-p35-2026-09-24-sans-relecture.json`). Pas de relecture
(non enregistrée, D-048).

## État 4.7.13

Interface « La ligne » intégrée (D-045). Amendement n°10 au cahier. Partie 34
relue : 1 faux sur 71, que la garde de paire de la 4.7.12 arrête.

## État 4.7.12

Lots 4.7.10–4.7.11 : partie 33 sans relecture (20/21 puis 65/83, arrêts
KI-051 puis caméra) ; **partie 34 relue** (jamais vue) : 73/96 (76 %), 1 faux
sur 71 jugés (1834, 26,5 mm, premier passage du moteur), 0 faux sur les 14
cuts jugés placés par la décision sur le lot ; avec la garde de paire de la
4.7.12, 0 faux sur 71. Chantier 2 intégré, garde de paire active (D-044).
Interface retenue : « La ligne » (D-045). En attente : relectures des parties 33
et 34, P2, lots complets.

## État 4.7.11

Premier lot 4.7.10 (partie 33) : 20 cuts traités, 0 différé, placements jugés
très bons par l'opérateur (relecture à venir) ; arrêt au cut 8089 sur une cible
hors de la vue d'ESV (KI-051), corrigé en 4.7.11 : la décision sur le lot ne
commande que dans la vue, sinon le cut est différé.

## État 4.7.10

Lot 2 de la partie 31 (4.7.9, relu) : Pilote 47 cuts sur 78, 0 faux sur 45
jugés ; décision sur le lot 72 sur 78, 1 faux sur 69 (7026, choix à un seul
appui, KI-050). La direction accepte ce faux (D-042) : la 4.7.10 applique la
décision sur le lot dans le Pilote, avec un réglage « Observer seulement » qui
rend la 4.7.9. Toutes les données relues, par étape
(`audit/choix-un-appui-2026-09-24.md`) : reprise depuis la voie 0 faux sur 36,
choix à deux appuis 0 sur 23, à un appui 1 sur 19. Prochaine mesure : lots
4.7.10 relus, faux des cuts placés par la décision comptés à part.

## État 4.7.9

Premier lot Pilote 4.7.8 (partie 31, jamais vue) : Pilote 35 cuts sur 51
(68,6 %), décision sur le lot rejouée 43 sur 51 (84,3 %) ; hors 5 cuts sans
nuage ESV et le cut d'arrêt, 35 et 43 sur 45 ; justesse en attente de la
relecture. Ce lot a révélé KI-048 (le choix par la voie privé de sa grille dans
l'extension, observation seulement), corrigé en 4.7.9, et KI-049 (nuage ESV non
chargé). Partie 30 (Natif 4.7.7, jamais vue) : décision sur le lot 81,9 % des
cuts distincts, 0 faux sur 57 jugés. Étude des appuis validés (voisins déjà
validés, avec garde de cohérence) : partie 19, 57 → 79 %, 0 faux
(`audit/appuis-valides-2026-09-24.md`).

## État 4.7.8

Audits à mi-parcours, interne et indépendant (`audit/mi-parcours/`) : les deux
concluent que l'objectif de 90 % n'est pas démontré, et fixent un objectif
intermédiaire de 80 % des cuts distincts de lots Pilote, 0 faux (D-037, D-038).
Phase 0 (`tools/lot-choice-study.cjs`) : décider sur le lot, sans position
humaine, fait passer la couverture de 45 % à 56 % sur 722 cuts, 7 faux → 4, le
choix par la voie n'en créant aucun ; insuffisant seul pour 80 %. La 4.7.8
observe cette décision dans le Pilote, sans l'appliquer (amendement n°9,
D-039), pour la mesurer sur des lots réels. Plan jusqu'à la 4.8 :
`PLAN_4.8.md`.

## État 4.7.7

Un export Natif de l'opérateur sur la partie 22 montre sa logique : les cuts précédents disent où chercher et quel champignon est le bon, les points disent où poser. La 4.7.7 observe cette logique en Natif sans rien changer au travail : à la fin de chaque première visite, `src/continuity-observer.js` calcule la proposition que GCV1 aurait faite en partant de la droite des cuts voisins déjà validés (appuis fiables et antérieurs, points pris à la pose ESV avant le premier geste, sans doublon) et la consigne dans la visite, jamais appliquée ni affichée (D-036). L'étude hors ligne qui l'a motivée a été relue par un modèle indépendant ; ses défauts (références trop lâches, points comptés deux fois, ancres ordonnées par numéro) sont corrigés et ses chiffres remplacés au §7.8 de l'amendement n°7 de `BANANE_4.8_CAHIER.md` (KI-045).

## État 4.7.6

Audit du cerveau de placement sur 385 cuts et sept sessions (`AUDIT_CERVEAU_4.7.5.md`, `tools/brain-audit.cjs`) : le banc reproduit 23 décisions Pilote sur 23 ; aucun cut appliqué n'est faux (0 sur 76 jugés, P5 mesuré) ; mais tous les placements sont biaisés par rapport à la validation humaine — rail 2,8 mm trop bas, écartement 4,5 mm trop large — parce que le moteur pose le gabarit au milieu de la bande de points et l'opérateur en enveloppe. Le modèle d'abstention A1 n'a rien à apprendre ; A1 devient un calage à deux constantes (`src/placement-convention.js`), appliqué au rail publié avant la garde d'écartement. Validé en retenant chaque session : latéral médian 2,39 → 1,60 mm, vertical 2,83 → 1,13 mm, écartement 4,67 → 2,34 mm, aucun rail au-delà de 10 mm. Quand le moteur s'abstient, la bonne position figure parmi ses minima locaux pour 88 % des rails. Amendement n°4 de `BANANE_4.8_CAHIER.md`.

## État 4.7.5

La 4.7.5 active dans le Pilote la règle « flanc partiel », décidée par la direction le 22/09 : un rail dont le dessus est bien observé mais le flanc intérieur réduit à 3–5 points peut être publié ; rapport de perte, exigence des deux rails et garde d'écartement inchangés, fichier gelé `geometry-candidate-v1.js` intact. Mesuré avec le moteur réel sur les cinq collectes : cuts appliqués 56 → 113, 72 jugés contre relecture humaine, 0 faux au-delà de 10 mm (pire 6,5 mm) ; taux de résolution hors ligne 79 % (partie 19) et 77 % (partie 20). La classe restante — appareils de voie et contre-rails, où la pose ESV est à 62–115 mm du rail — fait l'objet d'une étude hors ligne par continuité de voie (`tools/continuity-study.cjs` : 12 cuts justes, 0 faux, 6 différés sur 19 en second passage, une seule partie). Détail, règle d'arrêt et chantier 4.8 « contexte de voie » : amendement n°3 de `BANANE_4.8_CAHIER.md`.

## État 4.7.4

La 4.7.4 allège les collectes Natif : plus de lecture LiDAR après un déplacement de rail par l'opérateur (42 % des points de la collecte 4.7.3, jamais utilisés par le moteur). Le banc passe à l'entrée « lecture complète de la pose de départ » : taux de résolution 50 % (partie 19) et 74 % (partie 20), contre 17 % et 50 % avec le seul premier instantané. Détail et corrections de constats antérieurs : amendement n°2 de `BANANE_4.8_CAHIER.md`. La proposition « flanc partiel » pour le Pilote était alors en attente de décision (tranchée en 4.7.5).

## État 4.7.3

Première collecte 4.7.2 mesurée (105 visites, 20,8/min) : sur les visites de moins d'une seconde, 79 % / 73 % des rails ont un instantané initial qualifié, contre 5 % / 4 % en 4.7.1. La 4.7.3 corrige la fin de session (le panneau recevait toute la session en un message, au-delà de la limite de 64 MiB) et relance la lecture quand ESV modifie sa boîte de découpe, première cause des rails restés sans instantané.

## État 4.7.2

La 4.7.2 réoptimise la capture du mode Natif ; elle ne touche ni au placement ni au Pilote. Sur les exports du 22/09, la lecture était arrêtée par tout mouvement de caméra (378 captures sur 491 au lot 3), ces arrêts épuisaient le budget de captures par visite, et le lecteur plafonnait à ~106 000 points/s à cause de pauses de 16 ms. Corrections : lecture par tranches de temps avec accès direct au buffer prouvé par sondes, caméra consignée sans arrêter la lecture, garde réduite à l'identité et aux rails, relances limitées aux nouveaux nœuds chargés, service worker sans relecture intégrale de la base. Banc (code à froid) : premier instantané qualifié ~205 ms → ~35 ms, capture complète 1 816 ms → ~80 ms, points retenus identiques. Le gain terrain reste à mesurer sur la prochaine collecte (`closureSummary.captureHealth`).

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
