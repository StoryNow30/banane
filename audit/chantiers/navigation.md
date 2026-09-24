# Navigation ESV et reprise des différés — chantier 1

Branche isolée depuis a74c225. Aucun branchement dans le Pilote.

## Fait

`src/adapter-page.js` expose `previousWithoutDecision` et `repriseGuard` sans
appelant dans le Pilote. La première exige source/cible explicites, opération
unique, bouton DOM présent et non désactivé ; elle refuse les identifiants
connus de VALIDATE, de suivant et de sélection des rails. Elle contrôle le
libellé part/cut avant et après le clic, puis l'identité complète et le
`frameId` du cut atteint. Une absence ou différence après clic rend
`reconcileRequired:true`, jamais une confirmation. Aucun SKIP, VALIDATE,
KeyboardEvent ni appel de fonction interne ESV n'est ajouté. `goToCut` n'est
pas émetteur faute de chemin DOM observé.

La garde exige un cut inscrit dans la liste propre des différés, une identité
compatible, l'absence d'incertitude et un état DOM « non validé » explicite.
Tout voisin, cut validé, statut inconnu ou repère changé est en lecture seule.
Le simulateur `tests/fixtures.cjs` et `tests/reprise-navigation.test.cjs`
couvrent bouton absent/désactivé, cible inattendue, repère différent,
validation, doublon et annulation.

## Vérifié

Commandes exécutées sur les fichiers de la branche :

```sh
node --test tests/gcv1-defer-export.test.cjs tests/reprise-navigation.test.cjs
node tools/verify.cjs
```

La première commande : 19 tests, 19 réussis. Banc complet : 651 tests,
649 réussis, 0 échec, 2 ignorés faute de corpus privé ; géométrie inchangée
et moteur conforme à la baseline V4.6.0 selon `tools/verify.cjs`. Les tests ne démontrent pas la
sémantique d'un bouton ESV réel ; `AssumedPrevious` et `AssumedValidation`
sont des doublures.

## Supposé et limites

Le vrai bouton précédent, sa fonction, un indicateur fiable « déjà validé »,
le retour au cut N et les durées ESV restent inconnus. La valeur
`navigation.inspection: 'verified-dom-button-no-decision'` n'est qu'une
assertion fournie par le banc ou un futur appelant : **ce n'est pas une preuve
d'inspection ESV**. `validationControl` est également un paramètre de banc,
sans sélecteur attesté. Aucun appelant de production ne fournit ces valeurs,
et la garde n'est pas intégrée aux chemins existants de proposition/application.
Il faudra une preuve terrain, des tests contre ESV et une décision avant tout
branchement. Même au retour nominal, `serverConfirmed:false` demeure.

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

Le cut cible peut porter un `frameId` distinct de celui de départ. Le clic
n'est donc pas bloqué sur cette différence préalable ; l'observation complète
après le clic doit correspondre à l'identité cible. Si ESV reconstruit un
nouveau repère lors de la revisite, l'identité logique part/cut peut être
bonne, mais la reprise reste fermée jusqu'à recapture et raccord des ancres.

## Questions à la direction et recommandation

Vérifier les quatre relevés de l'opérateur (boutons, gestes, réseau, noms et
chaînes d'appel) ; établir le statut DOM « déjà validé », le comportement de
retour et l'éventuelle saisie du numéro de cut. Décider D2 avant toute
intégration. Si la carte nécessite un appel de fonction ESV interne, faire
trancher ce nouveau chemin et KI-026 avant tout code émetteur : symbole non
documenté, `disabled` inaccessible, changement silencieux possible après une
mise à jour. Recommandation : garder la reprise inactive tant que les chemins
DOM, l'état validé et les repères ne sont pas établis.
