# Écho : la référence humaine suit l'écriture serveur de validation (D-143)

Branche `claude/50-echo-ref-ecriture`, partie de `claude/50-base`. Version du manifeste inchangée. `src/engine.js`, `DECISIONS.md` et le manifeste ne sont pas touchés. Observation seulement : aucune requête ESV nouvelle, aucun changement d'Orbite.

## Défaut

La « référence humaine » d'une visite validée est l'état de rails lu à la touche de validation. Si l'opérateur clique un rail quelques millisecondes avant la touche, ESV applique le déplacement **après** la touche : l'état lu est périmé et la référence ne bouge plus. Cas réel, cut 428 du second projet : clic 7 ms avant Maj+Espace, déplacement appliqué 11 ms après la touche, dernier état lu 25 ms avant la touche ; rail droit à 190 mm près, écartement de la référence à 1 631 mm au lieu de 1 441. Un cas sur 1 260 validations ; silencieux, parce que le test de fraîcheur ne regardait que l'âge de l'état.

L'écriture serveur de validation (PUT 2xx, avec les deux rails), rattachée à la visite par numéro de ligne, porte la bonne pose.

## Règle (`noteServerWriteNow`, `src/native-session.js`)

Quand une écriture de validation réussie arrive pour la ligne de la visite (rattachement `row-index` seulement, jamais par l'heure), postérieure à l'intention, et que ses rails diffèrent de plus de 1 mm (`settings.echo.ecritureReferenceSeuilM`) de `humanFinalReference` :

- la référence est remplacée : par `lastObserved` s'il concorde avec l'écriture à 1 mm près (`poseFrom: 'last-observed-state'`, matrices comprises), sinon par les positions de l'écriture (`poseFrom: 'write'` ; l'orientation du repère profil de l'ancienne référence est gardée, les rails portent `positionSource: 'validation-write'`) ;
- l'ancienne reste dans `humanFinalReferences`, marquée `supersededBy: 'validation-write'` ; la nouvelle y est ajoutée, avec `source: 'validation-write'`, `replacedByWrite` (écriture, écart par rail, origine de la pose) et `replaces` ; `humanFinalReferenceSource` vaut `validation-write` ;
- la classification est refaite (étiquette, déplacement humain, éligibilité). Une référence confirmée par l'écriture n'est plus jugée « pas fraîchement observée » ; son statut reste `candidate-observed`, le seul que lisent les outils en aval.

Ignorées : écritures en échec, « vu par l'opérateur » seul, d'une autre ligne, rattachées par l'heure, antérieures à l'intention, sans rails. Une visite sans validation (ou sautée) n'a pas de référence à corriger. La dernière écriture reçue fait foi : deux validations rapprochées dont la première écriture arrive après la seconde intention se corrigent à l'arrivée de la seconde écriture.

**Raison partielle** `rail-change-after-validate-intent` : un changement de rails observé dans les 150 ms (`settings.echo.changementApresIntentionMs`) qui suivent l'intention de validation. Elle reste sur la visite même après correction : elle dit que la référence lue à la touche a pu être périmée.

## Outil de jointure

`tools/jointure-echo-orbite.cjs` applique la même règle (même fonction pure, `referenceParEcriture`) aux exports déjà collectés, et ajoute au résumé `referencesCorrigees` et `ecartementsReferenceHorsPlage` (1 420–1 470 mm). Voir `fiches/JOINTURE_ECHO_ORBITE.md`.

## Essais

- `tests/echo-ref-ecriture.test.cjs` (11) : le cas du cut 428 sur données synthétiques (essai rouge d'abord : la référence reste périmée), dernier état concordant ou non, seuil de 1 mm, écritures ignorées, fenêtre de 150 ms, fraîcheur, écriture après la fermeture de la visite.
- `tests/jointure-echo-orbite-ecriture.test.cjs` (9) : la même règle côté outil.

## Doutes

- Joué sur des fixtures et sur les exports déjà collectés ; pas encore au terrain avec une Écho équipée du correctif.
- La fenêtre de 150 ms est un choix : sur le cas réel le déplacement arrive 11 ms après la touche.
- Si ESV écrit sa validation avant que le déplacement soit appliqué, l'écriture porterait elle aussi l'ancienne pose : rien ne le contredit alors.
