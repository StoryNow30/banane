# CH-084 — Étude : le cycle d'un saut +1 quand les points sont déjà chargés

**Demande de l'opérateur** : « même la pose, quand c'est déjà chargé, pourrait aller plus vite ». **Données** : `banane-data`, collections du 09/11 `vision6-essai` (V6, 109 cycles +1 exploitables) et `vision5-essai-prechauffage` (V5, 253). Source : les jalons `phase-timing-pli` de chaque visite (horloge `performance.now` du service worker et de la page), appariés visite à visite (même partie, coupe +1). « Déjà chargé » = les deux attentes d'images de la capture suivante < 100 ms : V6 36 cycles, V5 93 cycles. Les captures de la relecture (diagnostic `diag` présent) servent à lire la règle de fin d'attente. Scripts d'analyse hors dépôt (bloc-notes de la session), disponibles sur demande.

## Le cycle « déjà chargé » (médiane V5 / V6 ; P90 ; part du cycle), ÉTABLI

Cycle fin de capture → fin de capture suivante : **626 / 652 ms** (P90 1 281 / 1 181). Dont fin de capture → début de la suivante : 516 / 529 ms (82 %).

| Morceau | Méd. | P90 | Part | Nature |
|---|---|---|---|---|
| Transfert de la capture page → service worker | 14 / 26 | 22 | 2 % | orchestration |
| Stockage de la capture | 24 | 30 | 4 % | orchestration (écriture) |
| **Calcul** : analyse initiale (→ proposition) | 209 / 245 | 386 | 33 % | calcul |
| **Calcul** : analyse semée + lot (→ décision) | 30 / 35 | 410 | 5 % | calcul (semée seulement sur ~1 cut sur 4) |
| Décision → envoi de la pose | 44 / 38 | 51 | 7 % | orchestration (lecture d'état, écritures) |
| **Envoi de la pose à ESV** (`command:apply`) | 4 | 5 | 0,6 % | ESV |
| **Vérification de la pose** (relecture) | 17 / 15 | 21 | 3 % | ESV + Ariane |
| Lecture « après » + stockage | 44 / 40 | 51 | 7 % | orchestration (écriture) |
| Stockage → ordre de valider | 16 / 14 | 21 | 3 % | orchestration |
| **Validation + navigation** (`validateAndNext`, navigation observée) | 15 / 12 | 17 | 2 % | ESV |
| Navigation observée → accepté | 35 / 31 | 41 | 6 % | orchestration |
| **Attente de l'annonce d'ESV** (`railPairSelected`) | 0 | 0 | 0 % | non attendue : acceptation « navigation-only » 253/253 et 109/109 |
| Accepté → visite suivante ouverte → début capture | 64 / 59 | — | 10 % | orchestration |
| Capture suivante : sélection des deux vues | 19 | 25 | 3 % | ESV (2 images à caméra identique) |
| **Attente des images** (deux vues) | 86 / 100 | 95 / 108 | 14 % | état observé (règle « signal ») |
| Lecture LiDAR (Rust, deux vues) | 3 / 4 | 5 | 0,5 % | calcul |

Regroupé : calcul 253 / 275 ms (41 %) ; **pose 66 / 56 ms (10 %)**, dont 21 ms seulement chez ESV ; **validation 111 / 98 ms (16 %)**, dont 15 ms chez ESV ; orchestration d'Ariane (transferts, écritures, lectures d'état) ≈ 240 ms (≈ 38 %, somme des lignes « orchestration ») ; attente des images ≈ 90 ms.

## Attentes fixes : il n'y en a presque plus sur ce chemin (ÉTABLI)

- Pose, vérification, validation, navigation : aucune pause fixe. `src/engine.js` n'a ni `sleep` ni `setTimeout` ; les commandes de l'adaptateur rendent la main en 4 à 15 ms. Le « pose et validation 862 ms » de CH-078 n'existe plus.
- L'annonce d'ESV n'est plus attendue (acceptation sur navigation observée).
- Attente des images quand c'est chargé : règle « signal » (`attendreChargement`, `src/adapter-page.js`, **gelé**) : ≥ 3 images depuis le début, compteur de Potree à zéro, deux images de suite identiques. Relecture : fin en 25 ms médiane (4 images). C'est déjà un état observé ; seul le minimum de 3 images est fixe (≈ 16 ms par image).
- Une seule vraie pause fixe : le **repli « stabilité » 800 ms** (`P.stabiliteMs`, `src/settings.js` lu par `src/adapter-page.js` gelé) quand le compteur d'ESV reste ≠ 0. Sur les +1 : 9 vues sur 218 (V6) et 18 sur 506 (V5) dans la bande 790-840 ms (≈ 4 %, PROBABLE : repérées par la durée) ; en relecture, 29 cas sur 37 de repli n'ont vu **aucun** nœud bouger (ÉTABLI).

## Pistes, gains, risques

| Piste | Remplacement (règle 4.3) | Gain par cut / par lot | Risque | Fichier |
|---|---|---|---|---|
| 1. Écritures du service worker en parallèle (stockage de la capture, du « après », lectures d'état intermédiaires) | Preuve : jalon « stocké » de la même coupe et de la même opération avant la validation suivante, plus seulement avant l'ordre suivant ; délai 2 s ; arrêt motivé (pause « écriture non confirmée ») | 100 à 150 ms par cut, soit 35 à 50 s par lot de 335 (V5) (SUPPOSÉ : à confirmer par un profil Chrome de ces 240 ms) | Reprise après coupure : une pose validée sans « après » stocké. À garder : jamais valider avant pose relue et identique | `src/engine.js` (interdit à l'exécutant : intégrateur) |
| 2. Repli 800 → 600 ms quand rien ne bouge | Preuve : signature des nœuds inchangée 600 ms ET aucun nœud reçu ; délai inchangé 12 s ; arrêt « niveau de détail non stabilisé » | ≈ 8 ms par cut en moyenne ; 2 à 4 s par lot (PROBABLE). CH-078 : 0,4 % de lectures voient encore un nœud bouger à 600 ms | Lire une vue incomplète, donc une pose différente : garde GCV2, jugement Écho | `src/settings.js` + `src/adapter-page.js` (gelé, D-293) |
| 3. Minimum 3 → 2 images | Preuve inchangée (compteur à zéro, deux images identiques) | ≈ 30 ms par cut ; ≈ 10 s par lot V5 (SUPPOSÉ, 60 images/s) | Rendu pas encore à jour : même garde | `src/adapter-page.js` (gelé) |
| 4. Calcul (≈ 140 ms hors des étapes instrumentées de `facade-total`, SUPPOSÉ) | Pas une attente : profil, puis le moteur (D-300) | à mesurer | Parité au bit près | fichiers de géométrie, gelés ou interdits |

**Ce qui pèse vraiment sur un +1 n'est pas le « déjà chargé »** (ÉTABLI) : **seuls 36 % des +1 sont déjà chargés** (V6 36/109, V5 93/253). Les autres attendent ESV : excès médian 745 ms (V6) et 654 ms (V5) sur l'attente d'images, en tout **67 s par lot V6 et 144 s par lot V5**. Le préchauffage ne couvre pas le +1 (`sautMin` 2, D-311 ; motif « saut-court » 440 fois en V6). Un préchauffage du +1 pendant le calcul et la pose (≈ 500 ms disponibles) est le seul levier de l'ordre de la seconde (PROBABLE, borne haute : dépend du réseau et de ce que Potree redemande à l'arrivée). Il ajoute des requêtes vers ESV : décision de l'opérateur (D-311, D-312 point 2).

**Recommandation** : pour la pose et la validation elles-mêmes, il n'y a plus d'attente fixe à retirer (21 ms chez ESV). Le reste se partage entre le calcul (≈ 40 %) et les écritures d'Ariane (≈ 38 %). Proposé : (a) un profil Chrome ciblé des 240 ms d'orchestration avant toute modification (lecture seule, sans risque) ; (b) piste 1 confiée à l'intégrateur, si le profil la confirme ; (c) poser à l'opérateur la question du préchauffage du +1 (`sautMin` 1), qui vaut 10 fois les pistes 1 à 3 ; (d) pistes 2 et 3 seulement avec un accord écrit sur le fichier gelé : gain faible. Jamais de SKIP ; aucune piste ne valide un cut non résolu ; aucune ne retire la vérification de la pose ni l'identité (partie, coupe, opération).
