# Mode Natif

Le Mode Natif observe le travail manuel dans ESV sans le piloter : aucun
changement de caméra, aucune sélection de rail, aucun déplacement, aucun
`VALIDATE`, aucun `SKIP`, aucune navigation. Il n'a pas changé depuis la série
4.4 et la 4.7.0 ne le modifie pas.

Le détail ci-dessous date de cette série et est conservé tel quel : les numéros
de version qu'il cite sont ceux de l'époque, pas ceux de la version installée.

La 4.4.2 reprend le lecteur passif de la 4.4.1 et enregistre un checkpoint immuable qualifié **par rail** dès que les points visibles, la pose initiale et la couverture sont suffisants. Elle conserve les dates d'acquisition et l'acquittement de stockage indépendamment de la réception des événements et du résumé final de lecture. Un chargement de nœud Potree sans mouvement de caméra n'interrompt plus automatiquement la capture ; une incompatibilité de pose, de source ou de clipping est motivée et une contradiction ultérieure révoque la preuve. Un checkpoint gauche ne dépend pas de la disponibilité du droit. Le rejeu hors ligne utilise seulement les points dans le clipping, sans donner la référence finale au moteur. L'ancien export V4.4.1 n'est pas promu rétroactivement : 0 rail comparable prouvé.

Le masquage V4.4.2 a échoué sur la capture d'écran de Mic. La V4.4.3 retire le bouton flottant du DOM pendant la présence d'une fenêtre Banane et le remet seulement après fermeture de toutes ; présence indiquée par fenêtres ouvertes et pages connectées, non par filtre URL des onglets. Cette gestion d'interface n'affecte pas les gestes ni les commandes ESV et reste à vérifier dans Edge.

## But et passivité

Le Mode Natif observe le travail manuel de Mic dans ESV afin de constituer des exemples humains. Il ne change jamais la caméra, la sélection, les rails ou le cut et n'envoie ni `VALIDATE`, ni `SKIP`. Les gestes ESV ne sont ni bloqués, ni retardés volontairement, ni réémis.

Le moteur de placement et le pilote automatique sont inchangés. Le lecteur corrigé est réservé au Mode Natif et ne demande aucun point supplémentaire à Potree : il lit seulement les buffers déjà chargés.

## Cycle

1. **Démarrer** crée une session, une période et une visite.
2. Chaque changement de cut ferme la visite et en ouvre une autre. Un retour reçoit un nouveau `visitId`.
3. **Pause** ferme la période sans décision. **Reprendre** ouvre une nouvelle période et une nouvelle visite sans inventer ce qui s'est passé pendant la pause.
4. **Terminer** attend la sauvegarde en cours, clôt la session et prépare l'export.

`eventSeq`/`event_seq` donne l'ordre exact des événements de collecte. Cet ordre n'est jamais présenté comme l'ordre spatial ESV. Les visites sont qualifiées comme première observation, revisite, continuation après pause ou revisite inter-session lorsqu'une identité complète permet de le démontrer.

Après un redémarrage, une période ouverte devient `INTERRUPTED_RECOVERED`. Son heure de fin peut rester inconnue et aucun état final n'est inventé.

## Collecte géométrique

La V4.4 lisait les nœuds dans leur ordre Potree avec un budget de 300 ms. L'audit des trois exports a montré que 114 captures sur 115 atteignaient une limite et que des sondes trouvaient pourtant la zone utile dans 103 captures. La V4.4.1 classe d'abord les nœuds par proximité diagnostique avec les rails, puis les lit par portions.

| Ressource | Limite V4.4.1 |
|---|---:|
| File d'événements | 128 |
| Captures par visite/vue ou pose distincte | 8 |
| Nœuds déjà chargés | 512 |
| Points conservés par rail | 50 000 |
| Points inspectés | 500 000 |
| Budget de lecture | 1 800 ms |
| Restitution au navigateur | 2 048 points |
| Sauvegarde progressive | 2 048 points par portion |

Gauche et droite sont sauvegardés séparément avec identité, matrices, position, vue et temps. Leur observation simultanée n'est pas obligatoire. Une paire n'est formée que si l'identité, le repère et les poses initiales sont compatibles. Un rail valide reste analysable seul.

Un changement de cible, de pose ou de vue pendant la lecture arrête explicitement la tentative. Les portions déjà sauvegardées restent attachées à l'ancienne cible ; elles ne sont jamais ajoutées au nouveau cut. Aucun nouvel essai identique n'est lancé aveuglément.

Chaque résumé trace séparément les points disponibles, sondés, lus, transformés, retenus, sauvegardés et exportés. Une lecture complète vide, une limite vide, une interruption, une transformation invalide, un lecteur indisponible et une surcharge portent des statuts différents.

## Référence et éligibilité

Une visite distingue :

- `firstObserved` : première vision de la visite ;
- `beforeEstablished` et `beforeEstablishedByRail` : premier état immuable établi pour chaque rail ;
- `lastObserved` : dernier état réellement lu ;
- `humanFinalReference` : état candidat observé avant une intention `VALIDATE`.

Toutes les intentions sont séquencées. Plusieurs intentions terminales rendent la référence ambiguë. `SKIP`, `PASS_NO_DECISION`, `VALIDATE_NO_MOVEMENT` et les validations avec mouvement restent distincts. Une validation sans mouvement est un signal positif candidat, pas une certitude géométrique.

Un rail n'est `comparable-candidate` que si ses points sont sauvegardés, sa transformation est valide, la zone utile est suffisamment couverte, sa pose correspond à l'état initial et la référence humaine est fraîche, compatible et suivie d'un effet de navigation observé. Un nuage seulement non vide ne suffit pas.

`usableForOfflineEvaluationByRail` autorise uniquement le rejeu hors ligne. `usableAsNativeReference` exige une paire compatible. `usableForTraining` reste toujours `false` jusqu'à une revue et une promotion explicites hors ESV.

`serverConfirmationStatus: not-observed` est normal dans ce mode ; il reste séparé de l'intention et de la navigation.

## Rejeu et validation

`tools/native-offline-evaluate.cjs` reconstruit l'entrée depuis l'état initial et les portions géométriques, lance le moteur actuel sans ESV, puis lit seulement ensuite la référence humaine pour mesurer l'erreur. Il peut produire jusqu'à six SVG montrant points, profil initial, référence candidate et proposition dans un même repère.

Le protocole de session réelle et la commande complète figurent dans `NATIVE_GEOMETRY_ACCEPTANCE.md`. Les trois anciens exports donnent zéro exemple qualifié : ils précèdent le nouveau contrat et servent uniquement à démontrer la perte. Une nouvelle courte session ESV est donc indispensable.
