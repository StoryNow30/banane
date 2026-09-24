# Navigation ESV et reprise des différés — chantier 1

Branche isolée depuis a74c225. Aucun branchement dans le Pilote.

## Inventaire provisoire

| Chemin | État |
|---|---|
| Suivant sans décision | Vérifié par inspection ESV du 20/09 : `#O2N3DCutNextInvalid3DRail` → `buttonNextInvalidCut()` → `loadNextInvalidCut("positive")`. |
| Précédent | Supposé : KeyS est suivi de −1 dans 36 gestes sur 38, mais le bouton DOM et sa fonction restent inconnus. |
| Suivant différé | Supposé : la fonction `positive` est connue, mais sa sélection des cuts différés reste à vérifier. |
| Précédent différé | Supposé : ni bouton ni `loadNextInvalidCut("negative")` établis. |
| Aller au cut N | Supposé : 25 sauts lointains après 125 clics carte ; bouton ou champ et fonction inconnus. |

Une navigation lit d'abord le libellé `#O2N3DCutDescription` (part/cut), puis l'identité complète par `snapshot()` (pageId, part, cut, shape, frameId, projectId). Un libellé nouveau ne vaut ni confirmation serveur ni statut validé. Aucune donnée d'inspection privée ou code ESV n'est versé dans le dépôt public.

La reprise envisagée parcourt les différés propres au lot, en ordre inverse si un bouton précédent non validé est vérifié, sinon en arrière avec lecture seule des voisins validés. Une cible déjà validée, absente de la liste des différés ou de statut inconnu reste en lecture seule. Le compteur « Différés : N » compte les cuts distincts encore sans décision, jamais les revisites. Après une incertitude, arrêt, réconciliation explicite et aucun rejeu. Ancres des deux côtés uniquement dans un repère compatible, sans correction humaine dans le moteur.

Pour 100 cuts dont 40 différés, compter conditionnellement 40 navigations si le bouton saute les validés, près de 100 s'il traverse tous les cuts. Avec les hypothèses de 1 s/navigation et 8 s/cut retraité : 360 à 420 s, hors décisions et délais. Ce ne sont pas des temps mesurés.

Questions pour la direction : vérifier les quatre relevés de l'opérateur (boutons, gestes, réseau, noms et chaînes d'appel) ; établir le statut DOM « déjà validé » et le comportement de retour ; décider D2 avant toute intégration. Si la carte nécessite un appel de fonction ESV interne, faire trancher ce nouveau chemin et KI-026 avant tout code émetteur. Recommandation : garder la reprise inactive tant que les chemins DOM et les repères ne sont pas établis.
