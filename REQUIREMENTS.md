# Exigences métier confirmées

Dernière mise à jour : 13 septembre 2026.

## Ajouts V4.4.2

Retour V4.4.2 : le bouton est demeuré visible après ouverture ; l'exigence 4 n'était **pas** vérifiée en ESV. La V4.4.3 doit le retirer du DOM dès l'ouverture d'une fenêtre Banane, détecter aussi les fenêtres déjà ouvertes après reprise du service worker et le restaurer seulement après fermeture de toutes les fenêtres. Une ancienne réponse de statut ne doit pas contredire une notification plus récente. Le libellé de version affiché doit permettre à Mic de vérifier quelle édition est réellement chargée.

1. En Natif, une portion de points qualifiée doit être associée à son rail, à la pose initiale, à l'identité du cut, au repère, à la source, au clipping et à son heure **d'acquisition**, puis stockée avant l'intention humaine de référence ; l'heure de réception d'un message n'est pas l'heure d'acquisition.
2. Une fin de lecture perturbée après un instantané déjà stocké ne l'invalide pas rétroactivement ; une vraie contradiction de pose ou de repère laisse une trace de révocation. Gauche et droite restent éligibles indépendamment.
3. Le rejeu hors ligne ne reçoit que les points visibles selon le clipping prouvé et jamais la position humaine finale en entrée ; les exports antérieurs sans preuve temporelle de stockage ne sont pas promus.
4. Lorsque Banane ouvre une ou plusieurs fenêtres, le bouton flottant d'ouverture dans la fenêtre ESV disparaît ; il réapparaît uniquement après leur fermeture complète. Aucune entrée opérateur n'est bloquée.
5. Ce chantier ne modifie pas le moteur, le pilote, les seuils ni le caractère strictement passif du Natif.

## Placement des rails

1. Banane travaille actuellement sur le profil U50 observé dans ESV.
2. Une proposition automatique doit provenir du nuage LiDAR et de la géométrie du profil; l'état corrigé humain ne doit jamais être lu par le moteur de proposition.
3. Une position non soutenue, ambiguë ou non finie ne doit pas devenir une proposition applicable.
4. Le mode assisté exige une acceptation explicite avant déplacement.
5. Le mode automatique reste limité aux données et lots déclarés TEST.
6. Les corrections humaines et les résultats automatiques gardent des provenances distinctes.

## Écartement du champignon

La règle communiquée pour la décision après placement du champignon est :

| Écartement | Décision métier annoncée |
|---|---|
| `< 1 410 mm` | SKIP |
| `1 410 à < 1 430 mm` | Validation autorisée avec tolérance |
| `1 430 à 1 470 mm` inclus | Validation autorisée |
| `> 1 470 mm` | SKIP |

1. Cette règle vaut sur tous les cuts, passages à niveau ou non.
2. Le seuil inférieur confirmé et unique est **1 410 mm**.
3. À cette étape, Banane n'exécute jamais SKIP à partir d'une mesure : la décision reste exclusivement prouvée par `Shift + Backspace` de l'opérateur.
4. Les 47 corrections historiques ne contiennent pas la valeur ESV : leur conformité d'écartement reste **non évaluée**.
5. Une valeur absente ou illisible ne doit être transformée ni en zéro, ni en conformité, ni en décision ou motif SKIP.

## Collecte manuelle

1. La paire avant/après doit appartenir au même cut, à la même part, à la même page et au même repère.
2. L'après doit être sauvegardé avant la transmission de la décision demandée par l'opérateur.
3. Une capture sans LiDAR peut être conservée comme incident, mais ne doit pas être déclarée exploitable pour l'entraînement.
4. `Shift + Espace`, Entrée ou le bouton natif prouvent `VALIDATE`; `Shift + Backspace` prouve `SKIP`.
5. Un SKIP conserve l'avant, le LiDAR disponible et l'état final des deux rails, mais porte `usableForTraining: false`.
6. La capture durable précède une seule transmission de la commande ESV. Ensuite Banane observe la navigation et prépare le cut suivant.
7. Une commande transmise sans navigation observée devient incertaine et ne doit jamais être répétée automatiquement.
8. La fermeture d'une session ne doit inventer aucune décision supplémentaire.
9. Aucun bouton SKIP, aucun déclenchement automatique de SKIP et aucun changement fonctionnel du pilote automatique ne sont introduits dans la branche 4.2.
10. Pause ne valide ni ne skippe, préserve le cut actif et reprend sur cette même identité. Son événement est distinct de `VALIDATE`, `SKIP` et `STOP`.
11. Une validation humaine sans déplacement est un label positif `VALIDATE_NO_MOVEMENT`, jamais une erreur ou une correction incomplète.

## Exécution et preuves

1. Une action exporte séparément `commandSent`, `afterObserved`, `serverConfirmed` et `navigationObserved`.
2. Un cut ne peut être terminé après commande sans relecture de l'état et contrôle de la même identité.
3. Si la cible change avant cette relecture, le statut est `AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED` et l'avancement silencieux est interdit.
4. Un rail `unresolved` impose `PAUSED_UNRESOLVED_RAIL`; aucune validation partielle n'est envoyée. Les seules suites explicites sont réessayer, reprise manuelle, SKIP opérateur ou arrêt.
5. En incertitude de rail ou de données, le comportement par défaut est Pause. Un SKIP explicite conserve ses preuves mais n'est jamais un exemple positif d'entraînement.
6. Une absence de réponse adaptateur clôt ou suspend avec la liste des cuts non confirmés, jamais avec une réussite inventée.

## Mode Natif V4.4.1

1. Le Mode Natif est un observateur : Banane n'y envoie aucun changement de caméra, sélection de rail, déplacement, `VALIDATE`, `SKIP` ou navigation.
2. Les événements clavier et souris sont observés sans `preventDefault`, sans arrêt de propagation, sans attente imposée à l'opérateur et sans événement clavier ou souris synthétique.
3. Le capteur d'entrée est chargé à `document_start`. Il transmet uniquement une observation interne à Banane ; ce message interne n'est pas un événement réémis vers ESV.
4. Chaque visite reçoit un identifiant différent, y compris les retours sur le même cut. L'ordre des visites n'est pas une preuve de voisinage ou de séquence spatiale ESV.
5. Chaque capture conserve l'identité, le repère, les positions disponibles et l'horodatage. Gauche et droite sont des observations séparées ; leur simultanéité n'est pas exigée, mais leur association requiert une compatibilité vérifiée.
6. L'état observé, l'intention opérateur, l'effet observé, une éventuelle commande et la confirmation serveur sont des faits séparés. Une touche ne confirme ni l'effet ESV ni le serveur.
7. La lecture LiDAR porte uniquement sur les points déjà chargés dans la vue courante. Elle ne demande pas de LOD, ne sélectionne pas de rail et ne change pas la caméra.
8. La lecture est découpée, bornée et sauvegardée progressivement. L'export trace séparément points disponibles, sondés, lus, transformés, retenus, sauvegardés et exportés.
9. Lecture complète vide, capture annulée, changement de cible/pose/vue, transformation invalide, limite de ressources et surcharge sont des résultats distincts. Une erreur n'entraîne pas de répétition aveugle.
10. Pause n'envoie aucune décision. Reprendre ouvre une nouvelle période et n'invente aucune continuité pendant la pause.
11. Le Mode Natif, Mes corrections, l'assisté et le pilote ne peuvent pas collecter ou écrire concurremment.
12. Première observation, état initial établi par rail, dernier état observé et référence humaine finale candidate restent distincts. Une séquence d'intentions multiple est ambiguë et ne devient jamais silencieusement une référence validée.
13. Un nuage non vide ne suffit pas. L'éligibilité par rail exige couverture de la zone utile, transformation valide, identité et pose initiale compatibles, points durablement sauvegardés et référence candidate associée. Un rail peut rester analysable lorsque l'autre manque.
14. `SKIP`, passage sans décision, validation sans mouvement et validation avec mouvement sont des catégories distinctes. `VALIDATE_NO_MOVEMENT` est un signal positif candidat, pas une preuve que le champignon est parfaitement placé.
15. Une visite peut devenir `usableAsNativeReference` après les contrôles de paire. `usableForTraining:false` reste obligatoire tant qu'elle n'a pas été examinée et promue explicitement.
16. La provenance `native-passive-observation` reste distincte de `explicit-manual-session` et des données automatiques.
17. `eventSeq` donne l'ordre de collecte sans devenir un ordre spatial. Revisites, continuations après pause et revisites inter-session restent distinguées lorsqu'elles sont démontrables.
18. Une interruption récupérée clôt explicitement la période avec une heure de fin éventuellement inconnue et n'invente aucun état final.
19. La V4.4.1 ne change ni l'algorithme de placement, ni ses seuils, ni le fonctionnement du pilote automatique.

## Évaluation hors ligne

1. Le moteur de proposition doit pouvoir être rejoué sans ESV, navigation ni commande native sur les états initiaux et LiDAR humains.
2. Les résultats conservent version, méthode, paramètres et hash du moteur, identité complète, proposition, référence humaine, erreurs locales, confiance, label et motif d'exclusion.
3. Le corpus actuel représente 110 cuts décisionnels, pas 1 314 278 exemples indépendants. Il sert aux régressions, calibrations et comparaisons, pas à revendiquer un modèle généraliste.
4. V4.0 et V4.2 restent distinguées. Les cuts V4.2 9031–9047 sont réservés à l'évaluation finale d'une stratégie figée.
5. Aucun gain de précision ne peut être annoncé sans comparaison sur les mêmes cuts, états initiaux et jeu de test.
6. Le voisinage n'est pas une règle de correction. Les champs de séquence et geominfo sont préparés uniquement comme support futur.
7. Le rejeu Natif construit et empreinte l'entrée moteur avant de lire la référence humaine finale. Il produit des résultats par rail et par paire et conserve les motifs d'exclusion.

## Points non confirmés

Les éléments suivants ne sont pas confirmés : formule exacte de l'écartement ESV, source et fraîcheur de sa valeur, effet serveur de SKIP et valeur affichée ou interne faisant foi. SKIP n'est pas équivalent à la navigation « prochain cut invalide ».
