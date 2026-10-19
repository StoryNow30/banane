# B3 — Transitions du lot (C01) : rapport

Branche `claude/49-b3-transitions`, base `claude/49-test-12` (4.9.0.12, version inchangée). Décision : D-102. Panneau non touché.

## Ce qui change

Un coordinateur dans `background.js` : `TRANSITIONS_LOT` (9 noms) et `coordinateurLot.transition(nom, f)`.
`transition` appelle `f` tout de suite et rend son résultat tel quel (aucune attente ajoutée). Il note le nom dans
`coordinateurLot.journal` (en mémoire seulement, 64 entrées, jamais exporté). `src/engine.js` n'est pas modifié.

| Transition | Point d'entrée unique |
|---|---|
| `demarrage` | « Démarrer » : corps déplacé sans modification dans `demarrerLot(args)` |
| `pause` | « Pause » (`engine.pause`) |
| `arret` | « Arrêter » (`engine.stop` + fin relevée) |
| `reprise` | « Reprendre » (`reprendreLot`, verrou `repriseEnCours`) |
| `rechargement` | F5 : `retablirApresRechargement`, appelé au début de chaque reprise |
| `cut-suivant` | enveloppe `adapter.validateAndNext` (validation sur place du dernier cut comprise) |
| `differe` | enveloppe `engine.deferUnresolved` ; départ d'ESV après un différé (`departApresDiffere`) |
| `fin-de-lot` | `closeAtExit` (corps renommé `clore`), dernier cut du lot borné (analyse, pose), `finApresDiffere`, fin naturelle de la boucle, SKIP du dernier cut |
| `erreur` | refus ou échec d'une action du panneau (avis + enregistrement) |

## Essais ajoutés : `tests/b3-transitions.test.cjs` (9)

D'abord rouges (commit `52669e2`) : le comportement actuel est vérifié (états, événements, poses), puis l'ordre des noms.
Ensuite, la refactorisation est faite sans modifier les attendus. Le seul changement dans l'essai : une copie du tableau
lu dans le contexte vm (comparaison entre contextes).

1. liste des 9 noms ; un point `transition('<nom>'` par nom ; un nom inconnu est refusé ;
2. lot borné : `demarrage → cut-suivant → fin-de-lot` (pose au dernier cut, non validée) ;
3. fin naturelle V4.6 : `demarrage → cut-suivant → cut-suivant → fin-de-lot` ;
4. pause puis reprise : `… pause → reprise → rechargement → fin-de-lot` (même page, aucun rattachement) ;
5. arrêt pendant un cut : `demarrage → cut-suivant → arret` ;
6. F5 puis reprise : `… differe → reprise → rechargement → cut-suivant → fin-de-lot` (lot rattaché) ;
7. dernier cut différé, ESV quitte la page : `demarrage → differe → differe → reprise → fin-de-lot` (pas de rechargement) ;
8. dernier cut validé sur place : `demarrage → cut-suivant → fin-de-lot` ;
9. refus au démarrage : `demarrage → erreur`, message gardé dans l'avis.

## Résultat de verify

`flock /tmp/lourd.lock node tools/verify.cjs` : 1 501 essais, 1 499 réussis, **0 échec**, 2 sautés (corpus privé absent,
mode partiel ; ils sont aussi sautés sur la base). Base : 1 492 essais (+9). Géométrie inchangée, moteur conforme à
sa baseline. Les essais existants (reprise, pause, arrêt, F5, banc de placement) n'ont pas été modifiés.

## Risques restants

- Conflit de fusion avec toute autre modification de `background.js` (risque déjà noté dans le cahier, § 10). Le gros de
  ce diff est le déplacement du corps de « Démarrer » ; il est sans modification.
- `rechargement` est noté à chaque reprise, même sans F5 (la fonction regarde d'abord si la page a changé). C'est
  l'ordre réel ; le journal ne dit pas si le lot a été rattaché (l'événement `batch-rebased-after-reload` le dit).
- `erreur` couvre toutes les actions du panneau, pas seulement celles du lot.
- Les transitions imbriquées (par exemple `cut-suivant` puis `fin-de-lot` dans la validation sur place) sont notées
  dans l'ordre d'entrée, sans profondeur.
- Banc complet (`--full`, avec corpus) non lancé ici : il faut le poste de travail.

## Constats

Aucune transition qui me semble boguée dans les cas joués : `fiches/B3_CONSTATS.md` n'est donc pas créé. Remarque
sans correction : « Reprendre » juste après « Pause », pendant que le cut finit, est refusé (« Attends la fin de
l'action en cours ») ; c'est le comportement voulu du moteur.
