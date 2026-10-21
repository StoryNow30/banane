# Intégration de la version complète (rôle « INTÉGRATION »), 21 octobre 2026

Branche `claude/50-test17` (nom gardé), depuis `claude/50-apprentissage-3-0` (d344fe1). Worktree `wt/T17I`. Brief : `scratchpad/t17/INTEGRATION.md`.
**Numérotation (consigne de l'orchestrateur, 21/10 11 h UTC)** : la 4.9.5.17 « 4.9.5 test 17 (UI) » est un paquet UI seule livré à part (`claude/50-t17-ui-seule`, non repris ici). Cette intégration COMPLÈTE est la **4.9.5.18, « 4.9.5 test 18 (L1-e6) »**, paquet `ariane-4.9.5-test.18.zip`, consigne `consignes/seance-terrain-4.9.5-test-18-2026-10-21.md`.
Marqueurs : **[mesuré]** = lancé ici ; **[lu]** = lu dans le code ; **[non prouvé]**.

## 1. Fusions

| Ordre | Branche | Tête fusionnée | Commit de fusion | Conflits |
|---|---|---|---|---|
| 1 | `claude/50-t17-uiport` | eff912c | cd8ff8c | aucun |
| 2 | `claude/50-t17-passe2` | 806a302 | 980edda | `background.js`, `dispatch` : bloc « deuxième passe en écriture » puis garde de la relecture en pause (résolution prévue par UIPORT § 3) |
| 3 | `claude/50-t17-sanspose` | 76870be | 7e62ff1 | `background.js`, `passeDiffOmbre` (signature de passe2) : code de passe2 gardé, `voieListe` ajoutée à l'appel de la décision de la passe |
| 4 | `claude/50-t17-ui-seule` (correctifs seulement, cherry-pick) | a4feac9, 7d42a8a, 275b0fb, 2b14ebc, 419c489, 9c645d5 | 604f975, a12abe7, 41bb716, d14eacc, 2ffa996, a9e850f | 7d42a8a : `src/ui5.js`, essais ; l'état « p2 » (retiré pour le paquet UI seule) est GARDÉ ici, il passe devant « Relecture en cours », essai de cohabitation. 9c645d5 : sans sa consigne, son CHANGELOG ni sa D-237 |
| 5 | `claude/50-t17-fautes` | — | — | attendue (échéance 12 h 15 UTC) |

Leviers : `LEVIERS_V6` = `rechHauteurMaxMm` 25 (757d5a3), preuve de SANSPOSE (9 lots avec et sans passe : 0 cut changé ; 3:0 avec passe : sans pose 9 → 6, > 50 mm 5 → 3). `rechListeResMm` reste coupé (2 poses, 3:0 seule).

## 2. Exigences (brief a à l)

- b. Interrupteur [mesuré] : case « Deuxième passe des différés en fin de lot (écrit dans ESV) » dans « Règles et choix du prochain lot » (panneau d'avant) et ligne « Deuxième passe (écrit dans ESV) » des Réglages du nouveau panneau (clic sur la case d'origine). Gardé par l'action EXISTANTE `choix-lot` (clé `banane51PasseDifferes`, pas figé dans le scope) ; absente = allumée, `false`/autre valeur/stockage illisible = coupée ; lue à la fin du lot, à la relance et avant chaque cut écrit (coupée pendant l'écriture : arrêt avant le cut suivant). Essais `passe-differes-interrupteur-sw` (3, quatre mutations rouges), `passe-differes-panneau` (3), `ui5-panneau`, `ui5-rendu`, `choix-lot-*` (forme de `choix-lot-etat` mise à jour explicitement).
- c. Message [mesuré, captures] : panneau d'avant, ligne `#passe-differes-ligne` sous les commandes du lot (« La deuxième passe travaille, ne touche à rien dans ESV · cut N · k posé sur m. « Arrêter la deuxième passe » l'arrête avant le cut suivant. »), bouton « Arrêter le lot » renommé « Arrêter la deuxième passe » et visible pendant l'écriture (avant : caché, lot clos : aucun moyen d'arrêter la passe depuis le panneau), « Nouveau lot » caché ; après : issue en une ligne, « Relancer la deuxième passe » si arrêtée avec des poses décidées qui restent (avant : action `passe-differes-ecrire` sans bouton, donc le cas courant « lot arrêté sur une pose non validée » n'écrivait jamais). Nouveau panneau : pastille et ligne de UIPORT, plus l'état de la palette. Aucun message nouveau au service worker.
- d. Garde partagée : `passeDiffEcrire` refuse déjà une relecture `en-cours` ou `en-pause` (repris par passe2, 806a302) [lu]. Essai de fusion de UIPORT repris (`tests/passe-differes-relecture-pause.test.cjs`, adapté au montage de 806a302 : lot 111 à 113) : vert ; mutation (garde réduite à `en-cours`) : cet essai et `lot-profil-passe-differes-ecriture-refus-sw` rougissent [mesuré].

## 3. Journal

- 11 h 05 UTC : worktree, fusions 1 et 2.
- 11 h 30 : interrupteur, message, relance, version 4.9.5.18 (chaînes, `version-49514`, empreinte `pose-lot-inchanges-4959`), captures (script hors dépôt `scratchpad/t17/nav/captures.cjs`, 16 captures, 0 erreur de page), D-232 à D-237.

## 4. Écarts constatés sur les branches reçues

- `claude/50-t17-passe2` 806a302 : `tests/pose-lot-inchanges-4959.test.cjs` ROUGE (réglages : `passeDifferesDefaut` exporté au premier niveau de `src/settings.js` change l'empreinte) [mesuré sur wt/T17C]. Corrigé ici : la clé est écartée explicitement et l'essai vérifie qu'elle est l'objet `lot.passeDifferes`.
- passe2 : aucun bouton du panneau ne lançait `passe-differes-ecrire` ni n'arrêtait une passe en écriture (le bouton « Arrêter » est caché lot clos) : corrigé (c).
- UIPORT : l'essai de fusion `passe-differes-relecture-pause` visait le montage de 14822b3 (lot 111 à 115) ; adapté au montage de 806a302 (111 à 113).
- 11 h 30 : sanspose fusionnée, Z25 livré ; parité 2:19 lancée sur 0afe390 (instantané `scratchpad/t17/snapI-0afe390`, cœur 1, sortie `scratchpad/t17/parI/`) ; verify préalable lancé sur 757d5a3 (`scratchpad/t17/verify-757d5a3.out`).
- 11 h 45 : correctifs de UI-SEULE repris (tableau § 1) ; essais ciblés (93 fichiers) lancés sur a9e850f.
