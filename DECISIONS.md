# Décisions techniques

## D-035 - Bilan des curseurs du cahier 4.8, §8 (critère C5)

Date : 23 septembre 2026. Source : `audit/brain-audit-2026-09-22.json` (moteur
4.7.6, 385 cuts, parties 13, 18, 19, 20), rails abstenus jugés contre la
validation humaine ; « juste au premier rang » signifie que le meilleur minimum
de la grille était à 10 mm ou moins de la pose humaine.

| Curseur | Valeur retenue | Coût mesuré | Décision |
|---|---|---|---|
| `minFace` | 6, avec flanc partiel 3–5 points si le dessus est bien vu | Voir D-031 | **Desserré** en 4.7.5 (D-031). Reste : 60 rails abstenus pour flanc, 27 sur 41 jugés justes au premier rang, avec moins de 3 points de flanc. Pas de nouveau desserrage sans une autre preuve (continuité de voie, D-033). |
| `minTop` | 15 | 15 rails abstenus ; sur 13 jugés, 7 justes au premier rang, 3 à un rang suivant, 3 absents | **Conservé.** Desserrer publierait au mieux 7 justes pour 6 douteux ; aucun bilan de desserrage n'est encore mesuré. Bilan incomplet, à instruire. |
| Competitive set `loss/lmin` (ambiguïté) | 1,5 | 13 rails abstenus ; sur 12 jugés, 7 justes au premier rang, 5 faux au premier rang | **Conservé.** Desserrer publierait 5 rails faux sur 12. Le classement doit venir d'une autre information (continuité de voie), pas d'un seuil plus lâche. |
| Pente hors domaine | inchangée | 10 rails abstenus ; sur 7 jugés, 6 justes au premier rang | **Conservé**, hors liste du §8. Coût réel, gain de desserrage non mesuré. |
| Garde d'ambiguïté S1 | active | KI-031 : une abstention de plus, une erreur > 50 mm de moins | **Conservé.** |
| Seuil de confiance | neutralisé en Pilote GCV1 | 0 cut mis en pause sur 74 (KI-033) | **Conservé.** |
| Fenêtre de fraîcheur de la référence | 1 500 ms | 9 rails sans référence sur 477 qualifiés, contre 145 faute de validation | **Conservée.** Ce n'est pas elle qui prive le banc de références, c'est l'absence de validation (KI-039). |

Le contrat d'écartement n'est pas un curseur (cahier §8) : inchangé.

## D-034 - A1 redéfini deux fois ; A2 écarté de la 4.8

Date : 22 septembre 2026 (cahier 4.8, amendements n°1 et n°4). Le score de
justesse pour classer des hypothèses (A1 d'origine) est sans objet : le
classement déterministe retrouve le meilleur couple admissible 17 fois sur 17.
Le modèle d'abstention qui l'a remplacé est lui aussi sans objet : aucun cut
appliqué n'est faux sur 76 jugés. A1 devient le calage de convention (D-032).
L'inférence embarquée (A2) est écartée de la 4.8 : entrée alors affamée, service
worker MV3 détruit après une trentaine de secondes d'inactivité ; réouverture
par amendement seulement.

## D-033 - Continuité de voie : étudiée, pas activée

Date : 22 septembre 2026 (cahier 4.8, amendement n°3). Dans les appareils de
voie, recentrer la recherche du moteur gelé sur la position prédite par les cuts
voisins appliqués donne 12 cuts justes, 0 faux et 6 différés sur 19 avec des
voisins des deux côtés (7 justes, 0 faux en passage unique). Une seule partie,
un seul jour : outil `tools/continuity-study.cjs`, rien dans l'extension.
Préalables à toute activation : mesure sur au moins deux autres parties avec
appareils de voie, puis observation dans le Pilote sans application.
L'écartement des cuts voisins ne peut servir que de garde, jamais de cible.

## D-032 - Calage de convention des rails publiés (4.7.6)

Date : 22 septembre 2026 (cahier 4.8, amendement n°4). Le moteur pose le gabarit
au milieu de la bande de points LiDAR, l'opérateur en enveloppe : rail 2,8 mm
trop bas, écartement 4,5 mm trop large en médiane. `src/placement-convention.js`
cale chaque rail publié : dessus au 90e centile des points + 1,0 mm, flanc à la
médiane des points − 2,6 mm, pas de correction latérale sous 6 points de flanc,
pas de calage sous 15 points de dessus ni au-delà de 8 mm. Appliqué après S1 et
avant la garde d'écartement ; A_STAR, S1 et seuils inchangés. Hors ligne, chaque
session retenue à tour de rôle : latéral médian 2,39 → 1,60 mm, vertical
2,83 → 1,13 mm, écartement 4,67 → 2,34 mm ; aucune décision de cut changée.

**Validation.** La relecture Natif d'un lot Pilote est ancrée : l'opérateur part
du placement proposé et ne retouche qu'au-delà de sa tolérance (KI-034, KI-035).
La mesure qui fait foi est une collecte Natif indépendante — l'opérateur pose
depuis l'état ESV, sans proposition — sur une partie non utilisée pour
l'ajustement, rejouée hors ligne calage actif puis coupé
(`tools/brain-audit.cjs --convention on|off`). Retour 4.7.5 si le calage y est
plus loin de l'humain que le placement brut, en médiane latérale ou verticale,
ou s'il rend faux au-delà de 10 mm un cut que le placement brut n'aurait pas
rendu faux.

## D-031 - Flanc partiel dans le Pilote (4.7.5)

Date : 22 septembre 2026, décision de la direction (cahier 4.8, amendement n°3).
Un rail dont le dessus a au moins 15 points et le flanc 3 à 5 points peut être
publié, sans pente hors domaine, rapport de perte ≥ 1,5, deux rails exigés,
écartement dans le contrat. Option de laboratoire existante `partialFaceKeep`,
fichier gelé intact. Bilan, moteur réel sur cinq collectes : cuts appliqués
56 → 113, 72 jugés, 0 faux au-delà de 10 mm, pire rail 6,5 mm. Dérogation au
§1.5 (P2) pour cette seule règle. Retour 4.7.4 au premier cut appliqué en flanc
partiel trouvé faux au-delà de 10 mm.

## D-030 - Le Pilote ne lit pas « comme le Natif »

Date : 22 septembre 2026 (cahier 4.8, amendement n°2). Le Pilote lit déjà tous
les points chargés dans la zone après stabilisation du niveau de détail. Le gain
de résolution mesuré venait de l'entrée du banc, pas de la lecture ; le chantier
envisagé est annulé.

## D-029 - Entrée du banc : lecture complète de la pose de départ

Date : 22 septembre 2026 (cahier 4.8, amendement n°2). Le banc donne au moteur
l'instantané qualifié plus la suite de la même lecture — même capture, même
côté, même pose — acquise avant la première action humaine. La frontière
anti-fuite (D-026) est inchangée. `first-snapshot` reste disponible pour
comparer ; l'évaluateur historique 4.4 n'est pas modifié.

## D-028 - Collecte Natif au rythme réel (4.7.2 à 4.7.4)

Date : 22 septembre 2026. La lecture Natif n'est plus interrompue par un
mouvement de caméra ; elle lit par tranches de temps avec accès direct aux
buffers ; la garde se réduit à l'identité du cut et à la pose des rails ; une
relecture n'est relancée que pour de nouveaux nœuds chargés tant que la pose
n'est pas qualifiée (4.7.2). La fin de session reste sous la limite de message
de 64 MiB et une modification de la découpe ESV relance la lecture (4.7.3). Plus
aucune lecture après un déplacement de rail par l'opérateur, qui ne nourrirait
jamais le moteur (4.7.4, `collector.captureAfterOperatorRailChange`). Le
placement et le Pilote ne sont pas touchés par ces trois versions.

## D-4.7c - Autorisation d'opération, finalisation déterministe, export par opération

Date : 21 septembre 2026, correctif post red-team Astra.

**Autorisation portée par l'opération (D1).** Une navigation sans décision n'est dispatchée que si son autorisation est encore valide au moment de l'appel, et le contrôle est relu sans qu'aucun `await` ne le sépare de l'appel — le moteur étant mono-tâche, rien ne peut s'intercaler. `stop()` et `pause()` posent l'état du lot et la révocation SYNCHRONEMENT, avant tout `await`. La révocation ne vaut que tant que `dispatchedAt` est absent ; une fois la commande transmise, elle est enregistrée comme demandée après coup et n'autorise à affirmer aucune non-émission. Dans la page, `cancelledOperations` et `invokedOperations` sont corrélés à l'identifiant d'opération et ne sont jamais vidés par une autre requête, contrairement au drapeau global `cancelled` que chaque entrée de l'adaptateur remet à faux. Le résultat ne dépend donc pas de l'ordre d'arrivée du `cancel` et de la requête. Une opération déjà invoquée ne peut pas l'être une seconde fois, et le second appel rend `commandInvoked: 'unknown'` : il n'a pas cliqué, mais l'opération a pu agir.

**Finalisation réparable (D3).** L'événement `defer-finalized` porte un `eventId` déterministe dérivé de l'`operationId` et un `timestamp` figé sur l'instant de finalisation déjà persisté. Réémis après une interruption, il est identique et reste un seul événement logique — le stockage le déduplique par sa clé, le journal en mémoire aussi. Une finalisation durable retrouvée sans son événement est réparée à partir de l'intention durable et de l'entrée deferred de la MÊME opération : aucune commande ESV, aucun second deferred, et aucun champ relu depuis `s.proposal` ou `s.lidarId`, qui décrivent déjà un autre cut au moment d'une reprise.

**Un `deferral` vient d'une seule opération (D4).** L'export regroupe les événements différés par `operationId`, choisit explicitement une opération — finalisation durable unique, sinon intention encore persistée, sinon opération unique — et n'agrège que les siens. L'ordre du tableau et l'ordre lexical des UUID n'entrent jamais dans ce choix : `store.all('events')` rend les événements par clé aléatoire, pas par chronologie. À timestamp égal dans une même opération et pour un même type, l'identifiant sert de départage reproductible entre événements équivalents, jamais de chronologie. Une ambiguïté réelle est publiée telle quelle (`DEFER_AMBIGUOUS`, motif, identifiants en présence) plutôt que résolue arbitrairement, et un événement historique sans `operationId` n'en reçoit jamais un après coup.

**Priorité de la décision opérateur (D2).** La clôture automatique de borne ne s'applique qu'à un lot encore en marche. Un STOP ou une PAUSE demandés pendant la navigation conservent le résultat deferred acquis et l'état opérateur ; la borne atteinte est consignée et sera constatée à la reprise explicite.

## D-4.7 - Différer un unresolved GCV1 par navigation sans décision

Date : 20 septembre 2026. En Pilote TEST, un cut dont GCV1 n'a pas résolu au moins un rail peut être quitté sans décision : aucune application de rail, aucun VALIDATE, aucun SKIP. La politique `unresolvedPolicy` est figée dans le scope du lot à sa création — `defer` par défaut pour un nouveau lot Pilote GCV1, `pause` si l'opérateur le choisit, `pause` pour un lot antérieur qui n'a pas le champ. Ni un redémarrage ni un changement du réglage d'interface ne convertit un lot en cours.

La branche `defer` exige une proposition GCV1 attribuée sans ambiguïté au cut courant, une capture LiDAR référencée, et au moins un rail portant `status: unresolved` avec `source: geometry-candidate-v1-abstention`. Une proposition absente, d'une autre identité, un repli hors GCV1, un delta manquant sans abstention ou une erreur technique gardent leur diagnostic et leur pause : `missing === true` ne suffit jamais à lui seul. Les politiques de faible confiance et l'admissibilité des candidates S1 à confiance non calibrée ne changent pas.

Un différé est une issue du **pilote**, pas une résolution scientifique. `batch.deferred` est une collection distincte de `processed`, `skipped`, `paused`, `interrupted` et `manuallyCompleted` ; elle n'est jamais comptée comme une validation, et un lot qui en contient ne peut pas finir sur « Terminé confirmé ». L'enregistrement `banane-deferred-unresolved-v1` porte `decision: DEFERRED_UNRESOLVED`, `usableForTraining: false`, `trainingExclusionReason: gcv1-unresolved-deferred`, et conserve les statuts GCV1 des deux rails tels quels. Les champs `bananeValidated`, `validationCommandSent`, `skipCommandSent` et `applyCommandSent` décrivent les commandes Banane de cette opération — `commandScope: banane-operation-only` — et non un audit rétroactif de tout ce qu'ESV a connu de ce cut.

## D-4.7b - La commande de navigation utilisée, et l'équivalence Maj+Z observée

Date : 20 septembre 2026. `nextWithoutDecision` clique `O2N3DCutNextInvalid3DRail`, relevé dans les sources V2–V2.4.2 et câblé depuis la V3 ; le chemin SKIP ne passe pas par lui (D-4.4 ci-dessous). L'inspection directe du JavaScript ESV chargé dans Edge, le 20 septembre 2026, établit que ce bouton et le raccourci Maj+Z atteignent **la même fonction native** : le gestionnaire clavier contient `e.shiftKey && 90 == e.which ? t.buttonNextInvalidCut()` et le bouton est câblé par `$("#O2N3DCutNextInvalid3DRail").click(function(){ t.buttonNextInvalidCut() })`, `buttonNextInvalidCut()` appelant `loadNextInvalidCut("positive")`. Les chemins décisionnels sont séparés dans le même code : `buttonValidateRail()` et `buttonValidateRailAndNext()` passent par `railPairUpdated(…, "valid", …)`, `buttonSkipRail()` par `railPairUpdated(…, "skipped", …)`. Le contrat « navigation sans décision » est donc observé, pas supposé, et la preuve retournée porte `shortcutEquivalence.established: true` avec les deux chemins, la source et la date.

Cette preuve vient de l'observation du code chargé, **pas d'une documentation du fournisseur**. `buttonNextInvalidCut`, `loadNextInvalidCut` et l'identifiant DOM restent des symboles internes non publiés, susceptibles de changer à une mise à jour d'ESV : la preuve le dit par `source` et `stability`, et KI-026 tient la limite de maintenance. Aucun `KeyboardEvent` « Z » n'est synthétisé pour autant, bien qu'un gestionnaire clavier soit maintenant observé : le défaut 6 d'`AUDIT_PILOTE.md` rappelle qu'un événement dispatché ne prouve pas sa prise en compte, alors que le bouton expose sa présence et son état `disabled` avant l'action.

La corrélation disponible est celle du bridge — une requête, une réponse, un `operationId` que Banane transporte et qu'ESV ne renvoie pas — plus un contrôle d'identité complète, de page et de part effectué **dans la page**, juste avant l'action. Une navigation manuelle concurrente pendant cette fenêtre reste hors de portée, et le champ `correlation` le dit plutôt que de l'omettre. `commandInvoked` vaut `true` seulement après le retour de l'appel, `false` seulement sur un refus antérieur au clic, et `unknown` partout ailleurs : une incertitude n'est jamais rendue comme un `false` rassurant.

## D-4.4.3 - Fenêtres réellement vivantes plutôt que filtre URL

Date : 13 septembre 2026. Le retour ESV contredit la validation simulée V4.4.2. La présence de Banane est désormais définie par les fenêtres créées et les connexions vivantes de ses cinq pages, sans se fier au filtrage d'onglets par URL d'extension. Ces connexions se rétablissent après arrêt/reprise du service worker. Pour écarter également une règle CSS ESV et les réponses asynchrones obsolètes, le bouton flottant est retiré physiquement du DOM puis réinséré, et les mises à jour plus anciennes sont ignorées. La notification provenant de Banane n'observe ni ne modifie les commandes de Mic dans ESV.

## D-4.4.2 - Preuves acquittées avant les intentions et interface discrète

Date : 13 septembre 2026. Chaque instantané de rail issu des seuls points visibles conserve son identité, sa fenêtre d'acquisition, la pose initiale et les preuves de source/repère. La sauvegarde du bloc est acquittée avant l'événement de checkpoint. La qualification temporelle s'appuie sur l'acquisition plutôt que sur l'arrivée tardive du message de fin ; une contradiction ultérieure révoque explicitement l'instantané. Les exports V4.4.1 ne sont jamais requalifiés rétroactivement. L'ouverture du panneau Banane masque le bouton flottant dans ESV jusqu'à fermeture de la dernière fenêtre, sans action ESV. Aucune modification du moteur de placement.

## D-001 - Préserver la référence originale

Date : 10 septembre 2026.  
La V4.0 d'origine est conservée dans `archive/` et exclue des modifications et du paquet installable.

## D-002 - Placement par gabarit U50 soutenu par les surfaces

Date : 10 septembre 2026.  
La translation proposée utilise le minimum affiné du recalage du contour complet du champignon. Les ajustements du plan de roulement et du flanc interne restent obligatoires comme preuves de support et sont conservés comme diagnostics. Motif : sur les 47 corrections, l'intersection seule était moins proche des pointages humains et pouvait sélectionner des surfaces parasites de passage à niveau.

## D-003 - Refuser l'ambiguïté plutôt que gonfler la confiance

Date : 10 septembre 2026.  
Un second bassin de recalage distant d'au moins 20 mm rend la proposition non applicable lorsque son coût est inférieur à 1,5 fois le meilleur coût. Un déplacement latéral supérieur à 60 mm est également refusé si l'autre rail ne fournit pas au moins 40 mm de soutien latéral. Ces seuils sont des barrières de sécurité expérimentales, évaluées sur les 47 cuts et le corpus historique; ils ne sont pas une règle métier ESV.

## D-004 - Ne pas activer de correction propre à la part 11

Date : 10 septembre 2026.  
Une correction médiane apprise sur les 47 cuts réduit encore l'erreur, mais elle n'est pas intégrée au moteur. Le projet ESV n'étant pas observable, une part numérotée 11 pourrait appartenir à un autre projet. Une calibration ne pourra être appliquée qu'avec une identité de dataset vérifiable et une évaluation sur des portions indépendantes.

## D-005 - Ne pas reconstruire l'écartement ESV par hypothèse

Date : 10 septembre 2026.  
La distance entre origines de profils ou un calcul LiDAR ne remplace pas la valeur ESV sans preuve d'équivalence. `src/gauge.js` fournit uniquement un parseur et une classification pure testables; aucun sélecteur DOM, aucune lecture ESV et aucune action SKIP ne sont inventés.

## D-006 - Séparer sécurité et couverture

Date : 10 septembre 2026.  
Les métriques publient simultanément l'erreur des propositions acceptées et leur couverture. Une baisse d'erreur obtenue par davantage de refus ne doit jamais être présentée seule.

## D-007 - Représenter la décision opérateur explicitement

Date : 10 septembre 2026.  
Les exports de Mes corrections distinguent `operatorDecision: VALIDATE` de `operatorDecision: SKIP`. Un SKIP conserve la paire avant/finale et le LiDAR disponible, mais il est exclu de l'entraînement par `usableForTraining: false` et `trainingExclusionReason: operator-skip`. Aucun motif d'écartement n'est déduit du raccourci.

## D-008 - Relayer le SKIP natif sans le remplacer par une navigation

Date : 10 septembre 2026.  
Après sauvegarde acquittée, `Shift + Backspace` est relayé une fois au gestionnaire clavier ESV. Le chemin manuel SKIP n'appelle pas `O2N3DCutNextInvalid3DRail`. Banane observe ensuite le changement d'identité du cut. Sans navigation dans le délai, la session passe en erreur avec résultat incertain et ne réémet pas la commande.

## D-009 - Ne pas automatiser la règle d'écartement en 4.2

Date : 10 septembre 2026.  
Le seuil inférieur est fixé à 1 410 mm : en dessous, SKIP ; de 1 410 à moins de 1 430 mm, validation avec tolérance. La valeur ESV n'étant pas encore observable de manière fiable, la 4.2 enregistre uniquement la décision humaine. Le pilote automatique et son interface ne reçoivent aucune logique SKIP liée à l'écartement.

**Révisé en 4.7 — voir D-027.** La borne basse passe à 1 405 mm et l'issue « SKIP » disparaît : le mot « définitivement » de la rédaction d'origine ne tient plus.

## D-027 - Contrat d'écartement 1 405 / 1 430 / 1 470, sans SKIP automatique

Date : 21 septembre 2026.  
Contrat opérateur en vigueur : sous 1 405 mm `LOW_INVALID`, de 1 405 à moins de 1 430 mm `TOLERANCE` (admissible), de 1 430 à 1 470 mm inclus `NOMINAL` (admissible), au-delà `HIGH_INVALID`. Les trois bornes n'existent qu'à un endroit, `src/gauge.js`.

Deux changements par rapport à D-009. La borne basse passe de 1 410 à **1 405 mm**. Et un hors-contrat n'est **jamais** un SKIP : c'est une **abstention**. Le module d'écartement ne rend plus aucune issue décisionnelle, et aucune voie automatique ne peut dériver un SKIP d'une mesure — le SKIP reste une décision de l'opérateur seul. Ce que D-009 refusait d'automatiser était la *décision* ; ce que 4.7 automatise est le *refus d'agir*, qui n'est pas la même chose.

Contrairement à D-009, la règle est désormais **appliquée** au runtime, sur l'écartement **prévu** après application des deltas — jamais sur l'état avant, qui est précisément ce que Banane corrige. Deux étages : la composition GCV1 rend les deux rails abstenus, et `Engine.apply()` refuse de commander. Ce dernier étage est global à tous les modes, parce que le contrat est une contrainte physique de la voie et non une règle propre à GCV1.

## D-010 - Différer le correctif de couverture du pilote automatique

Date : 10 septembre 2026.  
Mic rapporte que le pilote 4.1 s'interrompt beaucoup plus souvent que le 4.0 lorsqu'un des deux rails ne reçoit aucune proposition. Aucun seuil géométrique ni comportement du pilote n'est modifié avant l'analyse des corrections récentes par Terra. Ce retour est conservé comme régression d'usage à mesurer, pas comme preuve suffisante pour desserrer immédiatement les garde-fous.

## D-011 - Quatre preuves indépendantes après commande

Date : 10 septembre 2026.  
`commandSent`, `afterObserved`, `serverConfirmed` et `navigationObserved` ne sont jamais déduits les uns des autres. Une navigation ne confirme ni l'état final ni l'enregistrement serveur. Une cible changée avant relecture met le lot en pause avec une anomalie explicite.

## D-012 - Pause par défaut sur proposition incomplète

Date : 10 septembre 2026.  
Un rail non résolu conserve l'identité, l'avant, le LiDAR, la proposition partielle, les motifs et confiances. Le pilote se met en pause sur le même cut et n'envoie aucune validation partielle. Le SKIP n'est possible que par action explicite de l'opérateur.

## D-013 - Les validations sans mouvement sont positives

Date : 10 septembre 2026.  
Une décision `VALIDATE` avec deux positions inchangées devient `VALIDATE_NO_MOVEMENT`. Les quatre catégories humaines sont mutuellement exclusives et les deux rails avant/après restent exportés.

## D-014 - Banc hors ligne sans apprentissage

Date : 10 septembre 2026.  
Le banc appelle la géométrie pure sur les nuages et états initiaux, puis compare au résultat humain. Il n'accède pas à ESV, n'envoie aucune commande et ne modifie ni modèle ni seuil. Le build du moteur et ses paramètres sont empreintés dans chaque résultat.

## D-015 - Ne pas intégrer le voisinage au moteur principal

Date : 10 septembre 2026.  
L'ordre réel, les voisins verts, la geominfo et le contexte de voie manquent. `previousCutId`, `nextCutId`, `sequenceIndex` et la structure geominfo sont préparés, mais la continuité ne peut devenir qu'un futur signal secondaire de baisse de confiance ou de pause.

## D-016 - Isoler un Mode Natif strictement passif

Date : 11 septembre 2026.  
Le Mode Natif possède sa propre page, sa machine de session et sa provenance. Son adaptateur n'expose à l'observateur que des lectures et la sauvegarde. Les chemins `apply`, sélection gauche/droite, `next`, `VALIDATE` et `SKIP` ne lui sont pas fournis. Les autres modes sont bloqués tant que sa session est ouverte.

## D-017 - Observer l'entrée dès le chargement sans la capturer

Date : 11 septembre 2026.  
Le script `document_start` relève les événements fiables et les décrit dans un message interne. Il n'appelle jamais `preventDefault`, `stopPropagation` ou `stopImmediatePropagation` pour Natif et ne fabrique aucun événement clavier ou souris. Cette position précoce permet de conserver l'intention même si un gestionnaire ESV ultérieur interrompt sa propre propagation.

## D-018 - Séparer visites et périodes d'observation

Date : 11 septembre 2026.  
Une nouvelle identité affichée ferme la visite active et en ouvre une autre. Un retour sur le même cut crée également un nouveau `visitId`. Pause ferme la période ; Reprendre crée un nouvel `observationPeriodId`. `visitIndex` décrit seulement l'ordre d'observation et ne renseigne jamais `sequenceIndex`, `previousCutId` ou `nextCutId` ESV sans preuve dédiée.

## D-019 - Borner et dégrader la collecte

Date : 11 septembre 2026.  
La file réelle est limitée à 128 événements. La lecture de la vue courante cède la main tous les 512 points et se limite à 512 nœuds, 60 000 points conservés, 1 200 000 inspectés et 300 ms. Une surcharge réduit d'abord la collecte puis passe en métadonnées seules ; les compteurs et motifs sont exportés. Une panne durable produit un signal visible unique.

## D-020 - Ne pas mélanger une observation Natif avec un label explicite

Date : 11 septembre 2026.  
`native-passive-observation` reste séparé de `explicit-manual-session`. Un geste clavier est une intention observée, pas une confirmation serveur. Même lorsqu'une visite respecte les critères de cohérence et reçoit `usableAsNativeReference:true`, elle conserve `usableForTraining:false` jusqu'à une revue et une promotion explicites hors session ESV.

## D-021 - Geler le placement et le pilote en V4.4

Date : 11 septembre 2026.  
Le chantier V4.4 porte uniquement sur la collecte native. `src/geometry.js`, `vendor/capture-core.js` et `src/engine.js` sont inchangés octet pour octet par rapport à la V4.3. Les résultats du banc hors ligne V4.3 restent donc la référence du moteur.

## D-022 - Corriger la perte de points sans toucher au moteur

Date : 13 septembre 2026.  
L'audit des trois exports V4.4 a démontré que la lecture séquentielle des nœuds Potree épuisait presque toujours ses 300 ms avant la zone utile, malgré des sondes dans la ROI. Le lecteur historique `vendor/lidar.js` reste inchangé. Un lecteur réservé au Natif classe les nœuds déjà chargés par sondes et distance, puis lit par portions avec des limites explicites. Aucun clic de sélection, déplacement de caméra, commande native ni navigation ne lui est accessible.

## D-023 - Sauvegarder des observations par rail sans associer des cibles différentes

Date : 13 septembre 2026.  
La gauche et la droite possèdent leurs propres portions LiDAR durables, matrices, poses, identité, vue et horodatage. Un rail qualifié est analysable seul. Une paire peut unir des observations non simultanées si leur identité, repère et poses initiales sont compatibles. Tout changement pendant lecture est rapporté ; aucun état du nouveau cut n'est incorporé à l'ancien.

## D-024 - Séparer candidature géométrique et promotion d'entraînement

Date : 13 septembre 2026.  
Un nuage non vide ne suffit pas : couverture utile, transformation numérique, pose initiale, chunks sauvegardés, intention unique et référence humaine compatible sont vérifiés. `VALIDATE_NO_MOVEMENT` reste distinct de SKIP et du simple passage ; plusieurs intentions restent ambiguës. `usableForOfflineEvaluationByRail` et `usableAsNativeReference` désignent uniquement des candidats ; `usableForTraining:false` reste invariable.

## D-025 - Chronologie et récupération sans fiction

Date : 13 septembre 2026.  
`eventSeq` est monotone par session et distinct de la séquence spatiale ESV. Une période interrompue récupérée indique une fin d'heure inconnue et n'invente pas de dernier état. Les événements et portions sont sauvegardés avant l'export final ; les pertes et plafonds sont tracés.

## D-026 - Rejeu hors ligne à frontière anti-fuite

Date : 13 septembre 2026.  
Le banc Natif reconstruit l'entrée du moteur depuis les portions géométriques et l'état initial, génère les propositions puis seulement compare à la position humaine finale. Les anciens exports V4.4 restent des preuves de panne, pas un nouveau jeu comparable. Aucune amélioration de précision n'est annoncée sans essai ESV 4.4.1 et comparaison sur les mêmes cuts.
