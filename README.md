# Banane V4 TEST — 4.7.0

La V4 sépare les tâches dans des fenêtres sombres. Le nouveau **Mode Natif** observe le travail manuel dans ESV sans le piloter. **Mes corrections** conserve le workflow guidé avec capture avant la décision. **Pilotage automatique** gère les lots TEST. L’**assisté** sert à essayer une proposition sur un seul cut.

La **4.7.0** consolide le Pilote GCV1 et ferme la chaîne runtime. Trois apports :

- **Différer un rail non résolu.** En Pilote TEST, un cut que GCV1 ne résout pas peut être quitté par une navigation sans décision — aucune correction appliquée, aucun `VALIDATE`, aucun `SKIP` — et le lot continue. Le cut est enregistré une fois comme `DEFERRED_UNRESOLVED`, pour revue. Ce n'est ni une validation, ni un SKIP, ni une résolution : un rail non résolu le reste.
- **Garde d'écartement de paire.** Un couple de rails dont l'écartement prévu sort du contrat ferroviaire n'est plus appliqué. Deux défenses indépendantes : une abstention scientifique dans GCV1, et un dernier garde dans le moteur qui refuse de commander avant tout envoi.
- **Exports de diagnostic** du Pilote GCV1, avec la provenance exacte et les statuts scientifiques conservés.

Le placement lui-même n'est pas retouché : `src/geometry.js` et `src/geometry-candidate-v1.js` gardent les empreintes gelées. Aucun gain de résolution n'est revendiqué — le gain est la continuité du traitement et l'identification fiable des cas à revoir. Voir `CHANGELOG.md`, `KNOWN_ISSUES.md` et `TEST_REPORT.md`.

## Mettre à jour Banane

1. Termine l’activité en cours et conserve un export complet des données et des LiDAR.
2. Décompresse **banane-v4.7.0-test.zip**. Copie son contenu **dans le même dossier que l’extension déjà chargée dans Edge**, en remplaçant les fichiers. Cela conserve l’identité de l’extension et son stockage. Les fichiers du ZIP sont directement à sa racine. L'autre ZIP, **banane-v4.7.0-source-tests.zip**, sert uniquement à reproduire l'audit et les tests : ne l'installe pas dans Edge.
3. Dans `edge://extensions`, clique sur **Recharger** sur la carte de Banane.
4. **Recharge la page ESV.** Cette étape installe le capteur des commandes avant les scripts ESV.
5. Clique sur Banane, puis **Mes corrections**. Avec un seul onglet ESV ouvert, la connexion se fait automatiquement. S’il y en a plusieurs, choisis le bon dans **Connexion à ESV**.

Le panneau doit afficher **V4.7.0 · TEST**. Après fermeture de toutes les fenêtres Banane, le bouton au bas d'ESV doit afficher **Banane 4.7.0 · ouvrir**. Si tu vois encore un numéro plus ancien, recharge l'extension puis la page ESV et vérifie qu'une ancienne copie de Banane n'est pas chargée en parallèle. Pour une première installation, charge dans Edge le dossier contenant `manifest.json` avec **Charger l’extension non empaquetée**.

## Mode Natif : Banane observe, Mic travaille dans ESV

1. Ouvre le premier cut dans ESV, puis **Mode Natif** dans Banane.
2. Clique sur **Démarrer l’observation**.
3. Travaille normalement dans ESV. Aucun clic Banane n'est demandé entre les cuts.
4. Utilise **Pause** si nécessaire. **Reprendre** ouvre une nouvelle période d'observation sans supposer ce qui s'est passé pendant la pause.
5. Clique sur **Terminer et télécharger**, puis envoie le fichier **banane-native-v4-…json**.

Le Mode Natif n'envoie aucun changement de caméra, sélection de rail, déplacement, `VALIDATE`, `SKIP` ou navigation. Les gestes clavier et souris sont observés passivement dès le chargement de la page : Banane ne les bloque pas, ne les retarde pas volontairement et ne les réémet pas vers ESV.

Le petit bouton flottant « Banane » au bas de la page ESV **doit** disparaître dès qu'une fenêtre Banane est ouverte. Il revient seulement lorsque toutes les fenêtres Banane ont été fermées. Il ne touche pas aux commandes ESV.

Chaque affichage d'un cut constitue une visite distincte. Un retour sur un ancien cut reçoit donc un nouveau `visitId`. L'ordre de ces visites n'est pas présenté comme la séquence spatiale ESV. L'export distingue l'état observé, l'intention `VALIDATE` ou `SKIP` éventuellement reconnue, l'effet ensuite observé et la confirmation serveur, qui reste `not-observed`.

Le LiDAR Natif est celui déjà chargé dans la vue courante. Banane ne demande pas un autre niveau de détail et ne change pas de vue. Le lecteur passif examine d'abord les nœuds utiles pour chaque rail, enregistre les points par portions et conserve séparément les observations gauche/droite avec leurs repères et instants. La V4.4.2 acquitte le stockage d'un instantané qualifié avant de le rapprocher d'une intention ; une fin de lecture tardive ne détruit pas cette preuve, mais une contradiction est enregistrée. Une lecture interrompue ou limitée conserve ses portions déjà enregistrées et son motif, sans mélanger deux cuts. La lecture cède fréquemment la main ; la file bornée peut passer à `DEGRADED` ou `METADATA_ONLY`. Une panne durable produit un avertissement visible unique.

Les données portent `source: native-passive-observation`. Un exemple géométrique candidat exige un nuage assez dense et couvrant la zone utile, un repère valide, une association au bon rail et une référence humaine cohérente ; gauche peut être candidat même si droite manque. Même un candidat reste `usableForTraining: false` jusqu'à une revue explicite. Les SKIP, passages sans décision et intentions contradictoires sont conservés sans devenir des références certaines. Ces données ne sont jamais mélangées automatiquement aux sessions `explicit-manual-session`.

## Mes corrections : deux clics Banane par session

1. Ouvre le premier cut souhaité dans ESV et clique sur **Démarrer l’enregistrement**.
2. Attends le message **Cut … prêt** dans ESV. Banane lit les deux vues, puis revient sur le gauche.
3. Fais tes corrections habituelles : rail gauche, `d`, rail droit, puis **Shift + Espace** pour `VALIDATE` ou **Shift + Retour arrière** pour `SKIP`.
4. Continue sur les cuts de ton choix. Banane conserve tes positions finales et le LiDAR disponible avant de transmettre une seule fois la commande native, observe la navigation, puis prépare automatiquement le cut suivant. Le compteur indique les cuts enregistrés.
5. Quand tu as fini, clique sur **Terminer et télécharger**. Envoie le fichier **banane-corrections-v4-…json**. Il contient les références, les points LiDAR et le journal de cette session.

Le bouton **Pause** interrompt la collecte sans valider ni skipper. **Reprendre** vérifie l'identité et les rails, puis repart sur ce même cut.

Tu n’as plus à cliquer sur « avant », « après » ou « annuler » entre les cuts. L’export final contient toute la session, pas seulement son dernier cut.

Le bouton de validation ESV et la touche **Entrée**, annoncée par ce bouton dans les données observées, restent reconnus comme `VALIDATE`. Les zones de saisie restent disponibles normalement. Aucun bouton SKIP n’est ajouté et aucun SKIP n’est automatique.

Un cut `SKIP` reste une donnée utile : l’avant, le LiDAR disponible, l’état final des deux rails et `operatorDecision: SKIP` sont exportés. Il porte `usableForTraining: false` et `trainingExclusionReason: operator-skip`. Le raccourci prouve la décision, pas son motif ; aucune valeur d’écartement n’est inventée lorsqu’ESV ne l’a pas fournie de manière fiable.

La préparation peut prendre quelques secondes par cut. Le pointage est suspendu pendant cette lecture pour préserver l’état initial. Si le LiDAR reste instable après les tentatives prévues, tu peux continuer tes corrections : l’exemple est conservé sans LiDAR, signalé incomplet et exclu des références utilisables pour l’entraînement.

Si tu quittes un cut par une autre commande avant la validation capturée, l’exemple est signalé incomplet. Banane ne reconstitue pas un « après » supposé. Les changements de part dans la même page restent possibles ; chaque paire conserve sa propre identité de cut et de repère.

**Terminer** conserve également les corrections du dernier cut modifié, sans envoyer une validation supplémentaire. Un cut préparé mais non corrigé à la fin ne devient pas une référence manuelle artificielle.

Fermer la fenêtre laisse la session active. En cas d’interruption, les données déjà conservées restent disponibles. **Reprendre l’enregistrement** conserve la même session et ses références précédentes. Après rechargement de la page, reconnecte ESV.

## Premier essai : deux ou trois cuts

Démarre une session dans **Mes corrections**, corrige deux ou trois cuts avec ton workflow habituel, puis clique sur **Terminer et télécharger**. Vérifie que le compteur suit tes validations et envoie le JSON final. Il n’est pas nécessaire de relancer un lot automatique pour vérifier cette collecte.

## Pilotage automatique

1. Ouvre le premier cut du lot TEST dans ESV, puis **Pilotage automatique**.
2. Indique **Premier cut** et **Dernier cut**. La part est celle affichée dans ESV.
3. Clique sur **Démarrer le lot TEST**. **Pause**, **Reprendre** et **Arrêter** pilotent le lot.
4. **Télécharger le bilan et les LiDAR** donne le fichier complet de diagnostic.

Un rail non résolu ne produit jamais de validation partielle : le cut entier est concerné, jamais un seul rail.

**Lorsqu’un rail n’est pas résolu**, deux comportements, réglables avant le lancement :

- **Continuer et le différer** — défaut des nouveaux lots Pilote GCV1. Banane quitte le cut par une navigation sans décision et poursuit le lot. Le cut est compté dans **Différés : N**, jamais dans les cuts traités. Aucune correction, aucun `VALIDATE`, aucun `SKIP` n’est envoyé sur ce cut.
- **Mettre le lot en pause** — comportement historique, toujours disponible. Les actions proposées sont réessayer, reprise manuelle, SKIP explicite ou arrêt.

La politique est **figée à la création du lot** : ni un redémarrage, ni un changement du réglage ne convertit un lot déjà lancé. Un lot lancé avant la 4.7 garde la pause historique.

Un couple de rails dont l’écartement prévu sort du contrat est refusé avant toute commande, et le cut suit le même chemin : ni correction, ni décision. Le panneau affiche la **politique effective** du lot, y compris lorsqu’elle diffère du réglage choisi.

« Tenter » permet une proposition de faible indice, mais ne crée pas de position lorsque la géométrie est non estimable. Aucun SKIP ni entraînement automatique ne se lance.

Une lecture perturbée par le chargement Potree est recommencée jusqu’à trois fois par vue, avec une limite totale de 60 secondes pour la capture. Les lectures rejetées ne sont pas fusionnées. Si ces tentatives échouent en mode automatique, le lot se met en pause ; **Reprendre** relit le même état initial, sans bouton d’annulation et sans retraiter les cuts précédents.

Le bouton natif ESV passe au prochain cut non validé : les numéros peuvent sauter, et Banane n’invente aucun cut intermédiaire. Un saut de 549 à 552 enregistre 549, et 550 comme 551 n’entrent dans aucun compteur. La navigation observée ne constitue pas une preuve d’enregistrement serveur. Une validation déjà transmise n’est pas automatiquement renvoyée après un résultat incertain ; une navigation sans décision non plus.

## Essai assisté

Depuis l’accueil, ouvre **Essayer une proposition avec l’assisté**.

- **Proposer pour ce cut** lit le LiDAR et calcule une proposition.
- **Appliquer cette proposition** réalise le déplacement choisi ; **Ignorer cette proposition** l’écarte.
- **Revenir aux positions initiales** est disponible sur le même cut, avant validation.

La validation reste ton action dans ESV. Le mode assisté ne constitue pas une référence manuelle indépendante. Pour fournir tes pointages de référence, utilise **Mes corrections**.

## Ce qui est conservé

Les anciennes données V3 utilisent le même stockage. Les nouvelles paires manuelles portent `source: explicit-manual-session`, un `manualSessionId`, un identifiant de visite et un lien explicite vers leur LiDAR. Les résultats automatiques portent une autre provenance. Une paire sans LiDAR est marquée `usableForTraining: false`.

Les positions « après » sont prises à la décision, puis enregistrées avant la commande native. `VALIDATE` utilise le bouton ESV observé ; `SKIP` relaie `Shift + Backspace` au gestionnaire clavier ESV et n’appelle jamais « prochain cut invalide ». Des contrôles d’identité et de poses empêchent la transmission sur un cut ou un état différent. Les doubles appuis, répétitions clavier et relâchements ne doivent pas ajouter de commande.

Le capteur de commandes est déclaré à `document_start`, avant les scripts de la page ; il reste inactif hors d’une session de corrections. Les commandes sont relayées par un canal propre au document. Une absence d’accusé explicite empêche l’envoi ; une commande déjà transmise mais sans navigation met la session en erreur et n’est jamais répétée automatiquement.

## Vérifications reproductibles

Aucune dépendance n’est nécessaire pour charger l’extension. Pour les tests : Node.js 22 ou plus récent et Python 3.

```sh
node tools/verify.cjs
node tools/results.cjs
python3 tools/package.py
python3 tools/package.py --source --output releases/banane-v4.7.0-source-tests.zip
```

Le banc des quatre exports externes se lance séparément avec la commande documentée dans `OFFLINE_EVALUATION.md`. Les JSON de référence, volumineux et en lecture seule, ne sont pas intégrés au ZIP ; le certificat contient leurs noms et empreintes.

Pour auditer les trois anciennes sessions Natif et préparer la vérification sur un nouveau JSON ESV, voir `NATIVE_GEOMETRY_ACCEPTANCE.md`. Les anciennes captures n'ont aucun couple géométrique qualifié ; elles ne prouvent donc ni récupération effective dans ESV après ce correctif ni amélioration du moteur.

Les sorties et empreintes sont dans `audit/verification.txt` et `audit/verification.json`. Les tests couvrent les machines de session et de lot, les événements d’entrée, le pont de messages, l’export et les transformations. Le stockage y est simulé ; le cycle réel d’IndexedDB, l’installation Edge et le fonctionnement dans ESV ne sont pas remplacés par ces tests.

Dans l'espace de développement, `tests/corpus/` conserve le corpus manuel initial et `tests/incidents/` les fichiers réels de diagnostic. Ces fixtures volumineuses ne sont pas nécessaires à l'installation Edge et sont exclues du ZIP installable ; leurs résultats et preuves de vérification y restent documentés.

Le profil pris en charge reste le U50 observé dans ESV. La V4 réutilise le lecteur et les commandes déjà disponibles ; aucune API serveur supposée n’est ajoutée.
