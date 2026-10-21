# Intégration de la version complète (rôle « INTÉGRATION »), 21 octobre 2026

Branche `claude/50-test17` (nom gardé), depuis `claude/50-apprentissage-3-0` (d344fe1). Worktree `wt/T17I`. Brief : `scratchpad/t17/INTEGRATION.md`.
**Numérotation (consigne de l'orchestrateur, 21/10 11 h UTC)** : la 4.9.5.17 « 4.9.5 test 17 (UI) » est un paquet UI seule livré à part (`claude/50-t17-ui-seule`, non repris ici). Cette intégration COMPLÈTE est la **4.9.5.18, « 4.9.5 test 18 (L1-e6) »**, paquet `ariane-4.9.5-test.18.zip`, consigne `consignes/seance-terrain-4.9.5-test-18-2026-10-21.md`.
Marqueurs : **[mesuré]** = lancé ici ; **[lu]** = lu dans le code ; **[non prouvé]**.

## 1. Fusions

| Ordre | Branche | Tête fusionnée | Commit de fusion | Conflits |
|---|---|---|---|---|
| 1 | `claude/50-t17-uiport` | eff912c | cd8ff8c | aucun |
| 2 | `claude/50-t17-passe2` | 806a302 | 980edda | `background.js`, `dispatch` : bloc « deuxième passe en écriture » puis garde de la relecture en pause (résolution prévue par UIPORT § 3) |
| 3 | `claude/50-t17-fautes` | — | — | attendue (échéance 12 h 15 UTC) |
| 4 | `claude/50-t17-sanspose` | — | — | attendue |

## 2. Exigences (brief a à l)

- d. Garde partagée : `passeDiffEcrire` refuse déjà une relecture `en-cours` ou `en-pause` (repris par passe2, 806a302) [lu]. Essai de fusion de UIPORT repris (`tests/passe-differes-relecture-pause.test.cjs`, adapté au montage de 806a302 : lot 111 à 113) : vert ; mutation (garde réduite à `en-cours`) : cet essai et `lot-profil-passe-differes-ecriture-refus-sw` rougissent [mesuré].

## 3. Journal

- 11 h 05 UTC : worktree, fusions 1 et 2.
