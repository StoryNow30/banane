# Prochaines tâches — après la 4.7.0

## A. Fermer réellement la 4.7.0

Le checkpoint `6ead46f` est complet côté code, tests, paquet et documentation.
Deux conditions du contrat de fermeture restent ouvertes, et **aucune ne peut
être produite par le dépôt** :

1. **QA indépendante** du checkpoint final.
2. **Contrôle Edge court** sur le seul runtime modifié depuis le paquet
   réellement smoké : ouvrir le panneau, lancer un lot Pilote GCV1 en demandant
   « Mettre le lot en pause » pour la faible confiance, et vérifier que la ligne
   de politique effective annonce « tenter la proposition expérimentale » et
   nomme le choix qui ne s'applique pas. Aucun chemin de commande n'a changé —
   `engine`, `gauge`, `gcv1-shadow`, `geometry`, `geometry-candidate-v1`,
   `adapter-page` et `gcv1-export` sont identiques octet pour octet au
   checkpoint `5e6d0e8` — donc un smoke complet n'est pas nécessaire.

Tant que ces deux points ne sont pas faits, écrire `PASS_BANANE_47_FINAL` serait
faux. Le tag `v4.7.0` et tout merge dans `main` attendent la même décision.

## B. Candidats 4.8

Périmètre annoncé : accélération du Pilote, nouvelle UI, recherche scientifique
supplémentaire. Rien de tout cela n'entre dans une correction 4.7.

### Dettes ouvertes, chiffrées, prêtes à être instruites

| Sujet | Source | Ce qui est déjà établi |
|---|---|---|
| Réconciliation d'une application partielle | KI-030 | La boucle séquentielle date de `569c9a5`. Le comportement actuel est caractérisé par `tests/ki030-partial-apply.test.cjs` : état partiel réel, aucune décision ensuite, fermeture par `reconcileRequired`, restauration effective. Un correctif doit traiter la réconciliation, pas élargir un garde. |
| Arbitrage de paire hors contrat | KI-032, `GAUGE_PAIR_ARBITRATION_STUDY` | Sur les 10 cuts hors contrat du lot réel, **0 sur 10** admettent un couple admissible dont les deux cellules restent dans le competitive set (`loss/lmin ≤ 1,5`). Les récupérer exige de relâcher un critère scientifique, pas une règle d'écartement. |
| Lever l'abstention d'ambiguïté A_STAR | KI-031, `CORPUS_V2_NATIF.md` | Coût mesuré sur 116 rails : une abstention de plus, une erreur > 50 mm de moins, aucune erreur nouvelle. Lever l'abstention demande une **observation supplémentaire**, pas une règle de priorité. |
| Sérialiser les entrées concurrentes de `run()` | KI-029 | Deux `resume()` simultanés produisent deux captures puis `ERROR`, sans aucune navigation. |
| Clé d'archivage des captures incomplètes | KI-028 | `archivePending()` utilise une clé aléatoire : une reprise peut archiver deux fois la même capture. Sans conséquence observée sur le report. |
| Revérifier les symboles ESV | KI-026 | `#O2N3DCutNextInvalid3DRail`, `buttonNextInvalidCut`, `loadNextInvalidCut` sont internes et non documentés. À revérifier par inspection à **chaque** mise à jour ESV constatée : un changement de sémantique à identifiant constant ne serait vu que comme cela. |

### Ce qui reste interdit sans élément nouveau

- Rouvrir les audits fermés : GCV1 239, external24, S1 complet, Gauge complet,
  les 56 applications de la partie 15, l'étude support adaptive, No-Support
  Generator, Brain V2, pair arbitration V2.
- Retuner les seuils scientifiques, les pools, les clusters ou la confidence.
- Choisir un écartement cible. L'intervalle `[1405, 1470]` est un critère
  d'**admissibilité** ; « le candidat le plus proche de 1435 » ne doit jamais
  être implémenté.

### Données

Les lots terrain déjà ouverts et analysés sont **DEVELOPMENT /
REGRESSION_CONSUMED** : ils ne peuvent plus servir de holdout aveugle pour
revendiquer la généralisation d'un moteur. Les exemples `usableForTraining:false`
ne deviennent pas des données d'entraînement sans revue d'éligibilité explicite,
et aucune correction humaine ne doit fuir dans l'entrée moteur.

Le dernier lot Auto + Natif validé par l'opérateur pourra servir aux travaux
scientifiques 4.8 une fois la 4.7 fermée.

## C. Vérifications terrain encore ouvertes, indépendantes de 4.7

Elles concernent le Mode Natif et traînent depuis la 4.4 : couverture réelle du
lecteur LiDAR, fluidité Edge/Potree/IndexedDB mesurée et non simulée,
récupération IndexedDB après interruption. Protocole dans
`NATIVE_GEOMETRY_ACCEPTANCE.md`. `serverConfirmationStatus: not-observed` reste
attendu — aucun accusé serveur ESV exploitable n'est disponible.
