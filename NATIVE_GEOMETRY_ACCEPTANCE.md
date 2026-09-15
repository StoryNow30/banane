# Validation terrain de la collecte géométrique Natif

Version préparée : **4.4.3 TEST**. Le premier retour de Mic sur la V4.4.2 confirme que le bouton « Banane V4 · ouvrir » **restait visible** pendant l'ouverture d'une fenêtre : son masquage n'était pas validé. Le correctif V4.4.3 nécessite un essai ESV réel. Les tests locaux ne remplacent ni Edge, ni Potree, ni IndexedDB. L'audit du vrai export V4.4.1 est dans `audit/native-v4.4.1-real-audit.json` : 76 visites, 539 309 points exportés dont 297 185 visibles, mais zéro rail comparable prouvé. Il ne faut pas requalifier ces données anciennes.

## Défaut reproduit sur les trois exports V4.4

Les trois fichiers audités contiennent 426 visites et 115 captures LiDAR sauvegardées. Le traçage recalcule :

| Étape | Points |
|---|---:|
| Disponibles dans les buffers déclarés | 67 206 881 |
| Sondes diagnostiques lues | 38 675 |
| Lus par le balayage | 685 558 |
| Transformés avec des valeurs finies | 685 558 |
| Retenus dans les zones des rails | 4 |
| Sauvegardés puis exportés | 4 |

Dans 103 captures sur 115, une sonde légère trouvait pourtant au moins un point dans une zone de rail. Dans 114 captures, le balayage s'arrêtait sur une limite de ressources ; 1 595 nœuds sur 2 275 n'étaient jamais balayés.

La cause démontrée est l'ordre du lecteur V4.4 : il balayait les nœuds Potree dans leur ordre d'arrivée avec seulement 300 ms. Des nœuds éloignés consommaient le budget avant les nœuds dont les sondes montraient une proximité avec les rails. Ensuite, lorsque zéro point avait été retenu, le statut `no-points` masquait parfois la limite de ressources.

Le rapport reproductible est `audit/native-geometry-loss-v4.4.0.md`. La commande est :

```sh
node tools/audit-native-geometry.cjs
```

## Correctifs à contrôler

Le lecteur Natif 4.4.1 est séparé du lecteur du moteur et du pilote. Il reste en lecture seule.

La 4.4.2 stocke pendant l'acquisition, rail par rail, un instantané qualifié et acquitté avec identité, pose, source, clipping et instant d'acquisition. Une fin de capture arrivée après le geste ne peut effacer ce checkpoint valide ; une vraie contradiction enregistre sa révocation. Le moteur hors ligne ne consomme que les points réellement visibles et ignore le final humain en entrée. Pour le bouton, la V4.4.3 remplace la recherche fragile d'onglets par la présence des fenêtres ouvertes et des pages Banane connectées, puis retire le bouton du DOM.

- Il sonde d'abord légèrement les nœuds déjà chargés, puis lit en priorité ceux qui sont proches d'une zone de rail.
- Il conserve gauche et droite séparément, avec matrices, position, identité, vue et horodatage propres.
- Un rail disponible peut être sauvegardé même si l'autre manque.
- Les points sont enregistrés par portions avant la fin de la lecture.
- Un changement de cut, de pose du rail ou de vue termine explicitement la capture en cours ; les points déjà sauvegardés restent associés à l'ancienne cible et ne sont jamais mélangés avec la nouvelle.
- Les statuts distinguent lecture complète vide, limite de ressources vide, interruption, transformation invalide, absence de rail et surcharge du collecteur.

Une capture non vide ne suffit pas. Chaque rail doit aussi satisfaire les contrôles de transformation, d'association avec l'état initial, de densité et de couverture longitudinale. La paire gauche/droite peut provenir de deux instants différents si l'identité et le repère sont compatibles.

## Session ESV demandée à Mic

1. Charger la 4.4.3 dans le dossier Edge déjà utilisé, recharger l'extension puis complètement la page ESV. Quand tout est fermé, le bouton doit dire « Banane 4.4.3 · ouvrir ». Ouvrir Banane : son panneau doit dire « V4.4.3 · TEST » et le bouton doit disparaître immédiatement. Ouvrir si possible un second panneau ; vérifier qu'il ne revient qu'après fermeture des deux. Si « Banane V4 · ouvrir » est encore visible, vérifier d'abord qu'une ancienne copie de l'extension n'est pas active.
2. Pendant deux minutes avec Natif inactif, noter si rotation, sélection des rails, pointage et navigation sont fluides.
3. Démarrer Natif et visiter un cut avec gauche et droite normalement chargés. Effectuer une correction puis valider dans ESV.
4. Visiter un cut pendant lequel un seul rail est momentanément disponible. Continuer sans attendre Banane.
5. Passer rapidement sur deux cuts, puis revenir sur le premier.
6. Sur un autre cut, cliquer **Pause**, continuer ou attendre dans ESV, puis **Reprendre**. La reprise doit créer une nouvelle période et une nouvelle visite du même cut.
7. Terminer et télécharger le JSON. Refaire brièvement le même parcours avec Natif inactif pour comparer la sensation de fluidité.

Banane ne doit demander aucun clic entre les cuts. Une commande, une sélection, un mouvement de caméra ou une navigation attribuable à Banane invalide le test.

## Analyse après réception du JSON

```sh
node tools/native-offline-evaluate.cjs \
  --input /chemin/banane-native-v4-....json \
  --output audit/native-offline-evaluation-v4.4.2-real.json \
  --markdown audit/native-offline-evaluation-v4.4.2-real.md \
  --visual-dir audit/native-visual-proofs-v4.4.2-real
```

Le rapport donnera le nombre d'exemples exploitables à gauche, à droite et en paire, les motifs de perte, les rails non résolus et les erreurs face à la référence humaine candidate. Les SVG superposeront, dans le repère du profil initial : les points exportés, le profil initial, la référence humaine candidate et la proposition du moteur.

L'entrée du moteur est construite et empreintée avant la lecture de la position humaine finale. Modifier seulement cette position finale ne change ni l'empreinte de l'entrée ni la proposition ; ce comportement est testé automatiquement.

## État avant essai terrain

| Contrôle | État |
|---|---|
| Cause de la perte V4.4 | Démontrée sur les trois exports |
| Correctif de priorité et sauvegarde progressive | Implémenté et testé sur buffers simulés |
| Même buffers vus par lecteur historique et lecteur passif | Testé sans appeler sélection ou navigation |
| G/D, rail seul, navigation rapide, revisite, pause et interruption | Testés localement |
| Rejeu moteur sans fuite de la référence | Testé localement |
| Checkpoint V4.4.2 avant intention | Tests Node réussis ; contrôle Edge attendu |
| Bouton flottant V4.4.2 | **Échec confirmé par Mic dans ESV** |
| Bouton flottant V4.4.3 | Correctif testé localement ; **nouvel essai Edge attendu** |
| Session Edge/ESV 4.4.3 et preuves visuelles réelles | **En attente du JSON de Mic** |
| Fluidité WebGL/Potree réelle | **En attente du parcours comparatif de Mic** |

`serverConfirmationStatus: not-observed` est normal en Natif et n'est pas compté comme une erreur de collecte. Tous les exemples restent `usableForTraining: false` ; leur statut maximal est une candidature à l'analyse ou à une revue humaine.
