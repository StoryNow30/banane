# Vitesse de la relecture par phase (28/10/2026)

Outil : `tools/perf-relecture-phases.cjs` (essai `tests/perf-relecture-phases.test.cjs`, journal fictif). Données : dépôt `banane-data`, branche `claude/execute-prompt-00-18ra5a`, le journal de chaque volume 1 de lot du 18 au 26 octobre (22 journaux). Les échos et les archives 7z plus anciennes ne sont pas lus. Aucune passe en mode « ombre » : les 22 sont en « corriger ». La cible ombre du cahier (1,8 s, au moins 100 cuts) n’est donc pas mesurée au terrain. Les chiffres ci-dessous sont le mode « corriger », avec le nombre de corrections.

Le mur est `relecture-fin.dureeMs / cuts relus`, pauses explicites et trous de plus de 60 s retranchés. Ici, pauses 0 et trous 0 sur toutes les passes finies : le mur est la durée du journal. Les phases d’un cut viennent des commandes de sa fenêtre de temps (`adapter-result`), l’identité de ces commandes étant celle de la demande, souvent le cut d’avant. Sans commande, repli sur `durees`. Médiane, p90, moyenne. Part = médiane / somme des médianes.

## Ensemble, mode corriger

5 344 cuts à durées, 22 passes (une sans `relecture-fin` : partie 13 du 19/10, export en cours de passe, mur non calculé, 79 cuts).

| Phase | n | médiane | p90 | moyenne | part |
|---|---:|---:|---:|---:|---:|
| Attente de la page | 5 344 | 18 ms | 37 ms | 22 ms | 0,8 % |
| Lecture du nuage | 5 344 | 1,8 s | 4,4 s | 2,2 s | 81,5 % |
| Recapture | 5 344 | 0 ms | 0 ms | 26 ms | 0 % |
| Décision | 5 344 | 380 ms | 1,3 s | 541 ms | 17,6 % |
| Écriture | 5 344 | 0 ms | 0 ms | 58 ms | 0 % |
| Validation | 5 344 | 0 ms | 0 ms | 129 ms | 0 % |
| Attente de l’état de l’adaptateur | 5 344 | 0 ms | 0 ms | 0 ms | 0 % |
| Résidu (total du cut − phases) | 5 344 | 47 ms | 130 ms | 129 ms | |
| Total du cut | 5 344 | 2,8 s | 5,6 s | 3,1 s | |

**ÉTABLI.** La lecture du nuage est la phase. L’attente de page, l’écriture, la validation et la recapture sont des moyennes faibles parce que la plupart des cuts ne corrigent pas (médiane 0). Le résidu est le temps du cut qui n’est pas une commande journalisée (lectures d’état, liste). Le détail par cut est dans `depot-banane-data/CH-003/` (dépôt de transit : l’intégrateur le copie dans `banane-data` et le retire de cette branche avant la fusion).

## Passes

Version : champ `version` du journal. Quand le dossier dit autre chose, c’est noté. Points : médiane du nombre de points de la première capture du cut. « Hors cuts » : attentes `ADAPTER_BUSY` journalisées après le dernier cut (le refus qui arrête).

| Collection | Version | Partie | Issue | Relus | Corrigés | Points | Hors cuts | Par cut | Écart à 1,8 s |
|---|---|---:|---|---:|---:|---:|---|---:|---:|
| 2026-10-18 partie 10 | 4.9.5.7 | 10 | fin | 12 | 1 | 5 382 | 0 | 1,9 s | +0,1 s |
| 2026-10-18 partie 11 | 4.9.5.7 | 11 | fin | 144 | 17 | 5 537 | 0 | 1,80 s | +4 ms |
| 2026-10-19 partie 13 | 4.9.5.8 | 13 | sans fin | 79 | 10 | 5 550 | 0 | — | — |
| 2026-10-19 partie 17 | 4.9.5.9 (dossier 4.9.5.8) | 17 | fin | 241 | 27 | 20 680 | 0 | 3,0 s | +1,2 s |
| 2026-10-19 partie 18 | 4.9.5.8 | 18 | fin | 321 | 33 | 18 280 | 0 | 5,6 s | +3,8 s |
| 2026-10-19 partie 19 | 4.9.5.11 (dossier 4.9.5.8) | 19 | erreur | 156 | 7 | 7 895 | 0 | 2,9 s | +1,1 s |
| 2026-10-20 partie 19 | 4.9.5.13 | 19 | arrêt | 71 | 0 | 8 354 | 0 | 2,7 s | +0,9 s |
| 2026-10-20 partie 0, 1er lancement | 4.9.5.15 | 0 | erreur | 133 | 5 | 17 032 | 6 · 11,75 s | 5,3 s | +3,5 s |
| 2026-10-20 partie 0, 2e lancement | 4.9.5.15 | 0 | fin | 439 | 20 | 17 002 | 0 | 4,6 s | +2,8 s |
| 2026-10-21 partie 1 | 4.9.5.16 | 1 | fin | 12 | 0 | 5 856 | 0 | 2,2 s | +0,4 s |
| 2026-10-23 cache, partie 33 | 4.9.5.19 | 33 | fin | 393 | 32 | 15 499 | 0 | 3,0 s | +1,2 s |
| 2026-10-23 cache, partie 32 | 4.9.5.19 | 32 | fin | 30 | 2 | 5 373 | 0 | 2,3 s | +0,5 s |
| 2026-10-23 cache, partie 5 | 4.9.5.19 | 5 | fin | 281 | 18 | 5 380 | 0 | 1,4 s | −0,4 s |
| 2026-10-26 partie 26 (dans l’export de la 14) | 4.9.5.18 | 26 | arrêt | 593 | 39 | 5 254 | 0 | 1,9 s | +0,1 s |
| 2026-10-26 partie 14 | 4.9.5.18 | 14 | fin | 94 | 16 | 5 379 | 0 | 2,9 s | +1,1 s |
| 2026-10-26 partie 15 | 4.9.5.21 | 15 | fin | 133 | 11 | 5 362 | 0 | 1,9 s | +0,1 s |
| 2026-10-26 partie 16 | 4.9.5.21 | 16 | fin | 275 | 16 | 5 450 | 0 | 1,7 s | −0,1 s |
| 2026-10-26 partie 17 | 4.9.5.21 | 17 | fin | 159 | 11 | 5 274 | 0 | 1,9 s | +0,1 s |
| 2026-10-26 partie 18 | 4.9.5.21 | 18 | fin | 366 | 20 | 5 550 | 0 | 2,8 s | +1,0 s |
| 2026-10-26 partie 19 | 4.9.5.21 | 19 | fin | 154 | 24 | 5 387 | 0 | 2,1 s | +0,3 s |
| 2026-10-26 partie 20 | 4.9.5.21 | 20 | fin | 447 | 40 | 7 674 | 0 | 2,7 s | +0,9 s |
| 2026-10-26 partie 0 | 4.9.5.22 | 0 | fin | 811 | 100 | 12 000 | 0 | 4,6 s | +2,8 s |

Le lot de la partie 2 du 21/10 (4:2, test 18) est dans les journaux lus : aucune passe. **ÉTABLI.**

Parmi les passes finies d’au moins 100 cuts, deux sont sous 1,8 s (partie 5 : 1,4 s, 281 cuts, 18 corrigés ; partie 16 : 1,7 s, 275 cuts, 16 corrigés). La partie 11, la référence du cahier, est à 1,804 s (+4 ms, 144 cuts, 17 corrigés). **ÉTABLI.**

## Les 4,6 s de la partie 0 du 20/10 (test 15)

Les deux lancements sont en « corriger ». **ÉTABLI**, les deux `relecture-debut`.

Le second va au bout : 439 cuts, 20 corrigés, 4,616 s par cut, 0 pause, 0 trou. La moyenne des `totalMs` est 4,615 s : le mur est le temps des cuts, pas un trou entre eux. **ÉTABLI.**

| Phase | moyenne sur les 439 |
|---|---:|
| Lecture du nuage | 3,32 s |
| Décision | 1,09 s |
| Validation | 69 ms |
| Écriture | 31 ms |
| Attente de la page | 24 ms |
| Recapture, attente adaptateur | 0 |

Les 20 corrections durent 7,7 s en moyenne, les 419 visites 4,5 s. Ramener les corrections au coût d’une visite baisserait la moyenne d’environ 0,15 s. **ÉTABLI** : les corrections ne portent pas l’écart à 1,8 s.

Lecture par zone de cette passe : abords 3,37 s (142), ADV 3,24 s (253), hors zone 3,72 s (37), écartement 3,49 s (7). Aucun PN. **ÉTABLI** : l’ADV n’est pas plus lente que les autres zones de la même passe.

Aucun événement de reprise manuelle dans cette passe. **ÉTABLI.**

Le premier lancement : 133 cuts, 5 corrigés, 710 597 ms (11 min 51 s), 5,34 s par cut, puis arrêt. Six attentes `ADAPTER_BUSY` (250, 500, 1 000, 2 000, 4 000, 4 000 ms, somme 11,75 s), toutes après le dernier cut journalisé. La septième demande voit encore une capture en cours. 11,75 s / 133 = 0,09 s par cut de ce lancement. La passe finie de 439 cuts a 0 attente. **ÉTABLI** : ces attentes n’expliquent pas les 4,6 s. Le même arrêt, sans ces six lignes, existe sur la partie 19 du 19/10 (version de journal 4.9.5.11, 156 cuts, 2,9 s) : le mur y colle à la moyenne des cuts.

## Ce qui suit le nombre de points, et ce qui ne suit pas

Les passes à environ 5 400 points lisent le nuage en 1,1 à 1,5 s (partie 11 : médiane 5 537 points, lecture 1,34 s, décision 0,14 s). La passe à 4,6 s a 17 002 points et 3,32 s de lecture. La partie 0 du 26/10 a 12 000 points, 3,46 s de lecture, 4,6 s au mur, 100 corrigés. **PROBABLE** : une partie plus dense se lit plus longtemps. Ce n’est pas une loi : la partie 17 du 19/10 a 20 680 points et 1,71 s de lecture (mur 3,0 s, décision 0,92 s). **ÉTABLI** comme écart, cause non lue dans le journal.

La décision (`calculMs`, calcul synchrone après la capture) est 0,14 s sur la partie 11 et 1,09 s sur la passe à 4,6 s. Sur la partie 18 du 19/10 (mur 5,6 s, décision moyenne 2,05 s), la médiane vaut 1,55 s sur les 57 cuts à moins de 50 appuis en chaîne et 1,58 s sur les 264 cuts à 50 et plus. **ÉTABLI** sur cette passe : la longueur de la chaîne d’appuis ne porte pas ce coût. La partie 5 (chaîne médiane 129, décision médiane 0,10 s) non plus.

## Gain atteignable sans changer une décision

Aucun. Pas de `.patch`.

Sur une passe qui va au bout, l’attente d’adaptateur mesurée est 0. Sur l’incident du premier lancement, la capture dure encore à la septième demande, après les 11,75 s : remplacer la suite d’essais par l’attente d’un état, avec la même borne, attendrait le même temps. **ÉTABLI**, gain 0 sur cet incident.

Retirer l’attente de page, l’écriture, la validation et la recapture de la passe à 4,6 s laisserait environ 4,4 s, et ces attentes prouvent la navigation, la pose et l’écriture. Elles ne sont pas retirées. La lecture et la décision sont le nuage lu et le calcul qui tranche : les raccourcir changerait l’entrée de la décision. Écarté, sans rejeu.

Le gain qui reste est déjà dans les parties : à ~5 400 points, le mur « corriger » est 1,4 s (partie 5) et 1,7 s (partie 16), sous la cible, sans changement de code.
