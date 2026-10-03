# V1 — cartographie avant reconstruction

Base Git vérifiée : `042aee649bc25b89c46a26def481f87f46d047ac` ; cahier distinct : `18a355eb02a00b20b2adaeb1d84648854664972e`. Archive locale : 567 fichiers identiques au Git, `base-integrity.json`. Aucun patch V1 accessible retrouvé : reconstruction autorisée par `00_REPRISE.md:16`. Aucun original perdu n'est recréé sous son nom historique.

| Étape | Source stable | Ce qui est attesté / lacune |
|---|---|---|
| Navigation | `src/engine.js:118-125` | Cible effectivement relue, identité complète ; pas heure de début du chargement navigateur |
| Avant | `src/engine.js:140-150` | Capture LiDAR enregistrée ; phase actuelle commence après lecture et stockage |
| Proposition | `src/engine.js:162-172` | Lecture capture, façade et événements inclus ; pas calcul géométrique pur |
| Décision | `background.js:549-603` | Shadow, observeLot, commandLot et événement durable ; pas acquittement ESV |
| Pose | `src/engine.js:248-257` | Application puis relecture sous tolérance existante ; ni nouvelle pose ni nouvelle commande à ajouter |
| Après | `src/engine.js:151-161` | `adapter.state`, pas seconde acquisition LiDAR. Bornes propres manquantes dans ancien D5 |
| Validation | `src/engine.js:750-811` | Acceptation locale après contrôles ; preuve serveur seulement si déclarée par chemin actuel |
| Suivant | `background.js:66-78`, `src/engine.js:123` | Réponse combinée peut déjà porter nextIdentity avant validation-accepted : chevauchement à publier |
| Science V4.6 | `src/gcv1-shadow.js:29,406,486,570`, `src/geometry-brain.js:81-97` | Paire complète distincte des mono-rails scientifiques. Envelopper dépendances accessibles, aucune suppression |
| Arrêts | `src/engine.js:935-989`, `background.js:109-122,525-538` | Causes et prises manuelles ; KI-069 conservé, cas terrain posé non résolu par V1 |
| Horloges | `src/bridge.js:19`, `tools/perf-lot.cjs:39` | Page wall clock et SW wall clock actuels ; nouvelle horloge SW monotone par démarrage, aucune soustraction inter-contextes |

Cause racine constatée avant correctif : `tools/perf-lot.cjs:125-163` ne décompose que les chaînes complètes validées, jointes par numéro de coupe ; visites et différés/extrémités ne démontrent donc pas la porte 100 %. `tools/reducteur-exports-core.js:63-64` efface les événements : un tel export ne permet pas les nouvelles mesures. Pas de V2 engagé.

Le J1 historique utilise par défaut 4.8.0 (`tools/portes-j1.cjs:28-61`). Son vert sera complété par une comparaison de toutes les propriétés de validation/jeux avec le relevé frais 4.8.6, dans le même ordre. Un J1 seul ne couvre pas les imports navigateur ni la science initiale : tests VM des imports de production et enveloppes transparentes requis (relecture V4 `RAPPORT.md:18-22`).

Contraintes : moteur et géométrie inchangés ; aucun panneau U1, ESV réel ou essai sur ordinateur ; données privées hors dépôt ; aucun push/publication. Corpus verify natif absent à ce stade : ses trois fichiers seront listés ; deux tests sautés ne valent pas réussis. Le J1 complet constitue une preuve distincte.
