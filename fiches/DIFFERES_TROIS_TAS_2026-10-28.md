# Les trois tas qui restent, 28/10/2026 (CH-008)

Les 43 cuts que la passe en ombre ne pose pas : ambiguïté 15, dessus insuffisant (`minTop`) 15, écartement hors contrat 13. Population de `fiches/DIFFERES_CAUSES_2026-10-28.md` : 1 344 cibles, 79 différés (5,9 %), versions 4.9.5.21 (parties 17 et 18 : 4 cuts), 4.9.5.22 (partie 0 : 23), 4.9.5.23 (partie 1 : 16). Les 28 « poserait » n'y sont pas. Rien n'est appliqué. Niveaux : ÉTABLI, PROBABLE, SUPPOSÉ.

Outil des comptes de journal et du seuil hors échantillon : `node tools/rejeu-trois-tas.cjs` (essai `tests/rejeu-trois-tas.test.cjs`, 5/5, journal fictif). Le réservoir du moteur est rejoué à part, sur le nuage de chaque cut, hors dépôt : la fenêtre livrée est ±80 mm en travers et ±40 mm en hauteur. L'écart est le pire des deux rails, en 3D, contre la dernière validation de l'opérateur (jointure Écho, base = première visite). Repère de scène : résidu médian 0,0 mm sur les cinq parties. ÉTABLI.

## Ce que chaque couche aurait fait

Les 43 ont une validation observée (31 deux rails, 7 gauche seul, 2 droit seul, 3 étiquette « intentions multiples »). L'écart de l'opérateur au départ va de 13,2 à 172,7 mm (un seul cut, partie 1 cut 6606, est à 20 mm ou moins).

| Couche | Ce qu'elle propose sur les 43 | Qualification |
|---|---|---|
| Passe en ombre | 43 « rien ». Motifs : `depart-le-plus-probable` 19, `sans-approche` 12, `sans-voie` 5, `recherche-adv-contredite-rien` 2, et un de `anomalie-non-corrigee`, `plus-de-150-mm`, `sous-delta`, `veto-voie`, `commande:gauge-HIGH_INVALID`. | ÉTABLI, lu dans `passe-differes-ombre` passe 1 |
| GCV2, paire L1 avant les gardes (`l1.test13`) | 23 paires notées, 20 fois aucune (le départ gagne). Sur les 23 : 4 à 10 mm ou moins, 7 à 20 mm ou moins, 14 à 50 mm ou moins, **9 à plus de 50 mm**. | ÉTABLI |
| Réservoir du moteur, cellule la plus proche de l'opérateur, tout dessus | 7 à 10 mm ou moins, 12 à 20, 25 à 50, **18 à plus de 50 mm**. Ces 18 n'ont pas la pose dans la fenêtre. | ÉTABLI, rejeu |
| Même réservoir, cellule forte (15 dessus, 6 flanc), la plus proche | 33 cuts en ont une des deux côtés : 7 à 10 mm, 14 à 50 mm, **19 à plus de 50 mm**. | ÉTABLI |
| Cellule forte de perte minimale (la règle « prendre la mieux ajustée ») | 33 cuts : **0 à 10 mm, 5 à 50 mm, 28 à plus de 50 mm**. Là où une bonne cellule existe, ce n'est pas la moins chère (11 des 14 « oracle ≤ 50 mm » passent au-dessus de 50 mm). | ÉTABLI |
| Voie prédite | 0 posable sur les 43 (raison `differe`, aucune pose). | ÉTABLI, jointure |
| Mémoire des différés (G1) | 0 événement `memoire-differes-ombre`. La passe tourne avant l'Écho : elle ne voit aucune correction. Contrefactuel « l'opérateur a déjà corrigé les cuts précédents de la série » sur les 78 différés jugés des cinq parties : 67 têtes de série (abstention), 11 suites, dont **7 à plus de 50 mm**. | ÉTABLI pour l'absence et les 11 ; le contrefactuel n'est pas l'état de la passe |
| Voisins de la liste (B1, ombre) | 36 « pose ajoutée », 5 sans page, 2 « aucun ». La pose elle-même n'est pas dans le journal : aucun millimètre. | ÉTABLI pour le compte ; l'écart est non mesuré |

`sans-approche` est le refus de L1-e : une paire sous τ (« poser sans valider ») devient « rien », parce que les poses approchées jugées autrefois restaient souvent à plus de 50 mm (`src/gcv2-l1e.js`). Ce n'est pas une validation. τ est celui de la zone (0,44 ou 0,49 dans ces événements). `depart-le-plus-probable` : la pose de départ a le meilleur score, δ et τ ne sont pas atteints. `sans-voie` : une validation sans voie sûre est annulée (`sansVoieRien`). `anomalie-non-corrigee` : l'écartement s'écarte de la référence et le nuage ne soutient pas le rail déplacé. `recherche-adv-contredite-rien` : la recherche recentrée contredit la paire. `veto-voie` : la paire s'écarte de la droite des voisins au-delà du veto. `plus-de-150-mm` : sous τ et à plus de 150 mm du départ. `sous-delta` : le déplacement est sous δ (8 mm). `gauge-HIGH_INVALID` : la commande refuse l'écartement, au-dessus du contrat 1 420–1 470 mm.

## Les 43 cuts

« Paire L1 » : écart de la paire `test13` à l'opérateur, ou « — » s'il n'y en a pas. « Réservoir » : écart de la cellule la plus proche, pire rail, tout dessus. « Hors fenêtre » : l'écart de l'opérateur dépasse ±80 mm en travers ou ±40 mm en hauteur sur un rail ; une cellule au bord de la fenêtre peut rester proche (partie 18, cut 7646 : hors fenêtre, réservoir à 1,8 mm).

| Partie | Cut | Version | Tas | Opérateur (mm) | Passe | p | Paire L1 (mm) | Réservoir (mm) | Hors fenêtre |
|---|--:|---|---|--:|---|--:|--:|--:|---|
| 17 | 5962 | 4.9.5.21 | ambiguïté | 49,6 | recherche-adv-contredite-rien | 0,8847 | 8,9 | 2,8 | non |
| 18 | 6390 | 4.9.5.21 | ambiguïté | 78,1 | anomalie-non-corrigee | 0,5494 | 35,9 | 10,8 | non |
| 18 | 6599 | 4.9.5.21 | écartement | 48,1 | sans-approche | 0,0185 | 5,1 | 5,7 | non |
| 18 | 7646 | 4.9.5.21 | écartement | 94,0 | recherche-adv-contredite-rien | 0,2361 | 42,2 | 1,8 | un rail |
| 0 | 507 | 4.9.5.22 | ambiguïté | 146,7 | depart-le-plus-probable | 0,0005 | — | 75,2 | un rail |
| 0 | 517 | 4.9.5.22 | dessus | 133,4 | sans-approche | 0,0081 | 65,3 | 26,3 | un rail |
| 0 | 561 | 4.9.5.22 | écartement | 140,6 | sans-approche | 0,0047 | 24,1 | 21,5 | un rail |
| 0 | 639 | 4.9.5.22 | dessus | 133,7 | depart-le-plus-probable | 0,0024 | — | 23,2 | un rail |
| 0 | 717 | 4.9.5.22 | écartement | 156,5 | sans-voie | 0,0027 | 28,5 | 97,2 | un rail |
| 0 | 1227 | 4.9.5.22 | ambiguïté | 151,9 | sans-approche | 0,001 | 79,5 | 66,4 | un rail |
| 0 | 1336 | 4.9.5.22 | écartement | 126,9 | depart-le-plus-probable | 0 | — | 12,5 | un rail |
| 0 | 1619 | 4.9.5.22 | dessus | 162,1 | depart-le-plus-probable | 0 | — | 54,6 | un rail |
| 0 | 2319 | 4.9.5.22 | dessus | 172,7 | depart-le-plus-probable | 0,0209 | — | 63,3 | un rail |
| 0 | 2326 | 4.9.5.22 | dessus | 156,0 | sans-approche | 0,004 | 74,1 | 70,1 | un rail |
| 0 | 2476 | 4.9.5.22 | écartement | 133,4 | sans-voie | 0,1027 | 17,1 | 54,0 | un rail |
| 0 | 2531 | 4.9.5.22 | ambiguïté | 162,4 | plus-de-150-mm | 0,0068 | 32,4 | 112,6 | un rail |
| 0 | 2723 | 4.9.5.22 | ambiguïté | 157,8 | depart-le-plus-probable | 0 | — | 70,3 | un rail |
| 0 | 2730 | 4.9.5.22 | ambiguïté | 124,1 | sans-approche | 0,0286 | 91,2 | 20,7 | un rail |
| 0 | 2754 | 4.9.5.22 | écartement | 100,8 | depart-le-plus-probable | 0,0002 | — | 21,2 | un rail |
| 0 | 2790 | 4.9.5.22 | ambiguïté | 138,3 | sans-voie | 0,0368 | 16,6 | 52,6 | un rail |
| 0 | 4077 | 4.9.5.22 | ambiguïté | 109,1 | depart-le-plus-probable | 0,5225 | — | 50,1 | un rail |
| 0 | 4426 | 4.9.5.22 | dessus | 140,9 | sans-voie | 0,2514 | 20,1 | 49,3 | un rail |
| 0 | 5805 | 4.9.5.22 | dessus | 158,6 | depart-le-plus-probable | 0,0001 | — | 60,8 | un rail |
| 0 | 5809 | 4.9.5.22 | ambiguïté | 109,5 | sans-approche | 0,0022 | 44,7 | 6,9 | un rail |
| 0 | 8768 | 4.9.5.22 | ambiguïté | 125,0 | depart-le-plus-probable | 0,0005 | — | 19,8 | un rail |
| 0 | 9315 | 4.9.5.22 | ambiguïté | 137,5 | depart-le-plus-probable | 0 | — | 53,6 | un rail |
| 0 | 9764 | 4.9.5.22 | dessus | 92,7 | depart-le-plus-probable | 0,0681 | — | 10,9 | un rail |
| 1 | 1339 | 4.9.5.23 | écartement | 98,6 | depart-le-plus-probable | 0,1015 | — | 42,0 | un rail |
| 1 | 1415 | 4.9.5.23 | écartement | 78,4 | sans-approche | 0,0013 | 60,6 | 9,4 | un rail |
| 1 | 1868 | 4.9.5.23 | ambiguïté | 149,6 | sans-approche | 0,0013 | 67,1 | 75,3 | un rail |
| 1 | 1884 | 4.9.5.23 | écartement | 138,0 | depart-le-plus-probable | 0 | — | 60,1 | un rail |
| 1 | 2069 | 4.9.5.23 | écartement | 117,6 | depart-le-plus-probable | 0 | — | 37,5 | un rail |
| 1 | 2151 | 4.9.5.23 | écartement | 110,4 | commande:gauge-HIGH_INVALID | 0,3184 | — | 57,8 | un rail |
| 1 | 3032 | 4.9.5.23 | dessus | 126,1 | sans-approche | 0,0632 | 92,4 | 37,7 | un rail |
| 1 | 3224 | 4.9.5.23 | dessus | 126,8 | sans-approche | 0,0055 | 84,3 | 30,2 | un rail |
| 1 | 3826 | 4.9.5.23 | dessus | 133,9 | sans-approche | 0,0119 | 79,9 | 29,0 | un rail |
| 1 | 3835 | 4.9.5.23 | ambiguïté | 93,0 | depart-le-plus-probable | 0,0133 | — | 20,5 | un rail |
| 1 | 4544 | 4.9.5.23 | dessus | 167,9 | depart-le-plus-probable | 0 | — | 78,3 | un rail |
| 1 | 4556 | 4.9.5.23 | dessus | 158,8 | depart-le-plus-probable | 0 | — | 35,4 | un rail |
| 1 | 4788 | 4.9.5.23 | écartement | 54,5 | sans-voie | 0,852 | 4,1 | 5,4 | non |
| 1 | 4876 | 4.9.5.23 | ambiguïté | 103,5 | veto-voie | 0,027 | 10,0 | 57,9 | un rail |
| 1 | 6606 | 4.9.5.23 | dessus | 13,2 | sous-delta | 0,9125 | 13,2 | 7,8 | non |
| 1 | 8673 | 4.9.5.23 | dessus | 107,4 | depart-le-plus-probable | 0,0577 | — | 10,6 | un rail |

Les trois étiquettes « intentions multiples » sont les parties 17 cut 5962, 18 cuts 6390 et 7646 : l'écart reste celui de la dernière validation, avec cette réserve. ÉTABLI.

## Règles candidates, hors échantillon, toutes écartées

Le réglage est une version, l'examen les autres. Une ambiguïté n'est jamais validée : le moteur ne l'a pas résolue, et Ariane ne valide pas un cut non résolu. Les patches sont dans `chantiers/CH-008/propositions/`, non appliqués. `src/` est inchangé.

**1. Valider sous τ si p ≥ seuil** (`sous-tau-probabilite.patch`, `src/gcv2-l1e.js`). Le seuil est le plus bas qui, sur le réglage, ne pose aucune paire à plus de 50 mm, hors ambiguïté.

- Réglage 4.9.5.21 (2 paires) : seuil 0,0185, 2 poses, 0 à plus de 50 mm. Examen 4.9.5.22 et 4.9.5.23 : **5 poses, dont 1 à plus de 50 mm** (partie 1, cut 3032, 92,4 mm). Budget D-223 non tenu (1/5).
- Réglage 4.9.5.22 et 4.9.5.23 (12 paires) : seuil 0,1027, 4 poses, 0 à plus de 50 mm. Examen 4.9.5.21 : **1 pose** (partie 18, cut 7646, 42,2 mm), 0 à plus de 50 mm. Une pose ne démontre pas un taux ; elle ne retire pas les 11 cuts qui manquent sous 3 %.

Le seuil qui tient dans un sens ne tient pas dans l'autre. Écartée. Sur les cuts déjà posés par le lot, cette fonction ne s'exécute que pour un différé : 0 régression de ce fait. ÉTABLI sur le code, non rejoué sur les 12 lots de la garde.

**2. Recherche recentrée à 5 dessus et 3 flanc** (`recherche-dessus-5.patch`, `rechMinTop` 15 → 5 et `rechMinFace` 6 → 3). Sur les 43, la cellule à 5 dessus et 3 flanc la moins chère est à plus de 50 mm pour **37 cuts sur 41** qui en ont une des deux côtés (1 seule à 10 mm ou moins). Baisser le seuil ne choisit pas la bonne cellule. Écartée. Cette recherche sert aussi dans le lot : l'effet sur les cuts déjà posés n'a pas été rejoué. Non mesuré, et les essais qui figent les leviers livrés échouent sur la copie (voir plus bas).

**3. Ne plus préserver l'ambiguïté** (`ambiguite-publier.patch`, `preserveAmbiguity` rend faux). Publier le placement au lieu de laisser le cut non résolu. Sur les 15 ambiguïtés, la cellule la plus proche du réservoir est déjà à plus de 50 mm pour **9**. Les 6 autres ne sont pas choisies par la perte minimale : sur les 14 cuts, tous tas, où une cellule forte est à 50 mm ou moins de l'opérateur, la moins chère dépasse 50 mm pour 9. La règle validerait un cut que le moteur laisse non résolu. Écartée.

Aucune des trois ne fait passer les 79 différés sous 3 % (40 différés au plus). Avec les 28 « poserait » non écrits, on reste à 51 (3,8 %). Sans eux, à 79 (5,9 %). Le gain mesuré hors échantillon qui tienne les deux sens est nul.

## Garde et parité, sur une copie

Copie de travail avec les trois patches, essais figés : **10 réussis, 6 échecs** sur 16 (`tests/gcv1-s1-ambiguity.test.cjs`, `tests/gcv2-l1-cap5.test.cjs`, `tests/gcv2-l1e.test.cjs`). Les échecs sont l'ambiguïté qui doit rester préservée, les leviers livrés (`rechMinTop` 15) et « plus de pose sans validation ». ÉTABLI.

Parité de relecture (`tools/parite-relecture-sw.cjs`, dépôt non patché contre la copie) : **5 relectures, tous les champs identiques**. Les patches ne touchent pas la relecture. ÉTABLI.

Garde (`tools/garde-gcv2.cjs`) sur les 12 lots et parité L1-se avec `--passe` : **non faites**. Elles rejouent les lots archivés hors dépôt et un rejeu de référence du banc, qui ne sont pas dans cette session. Les patches ne sont pas sur la branche. Que la garde des 12 lots serait rouge est SUPPOSÉ, déduit des 6 échecs d'essais, pas mesuré.

## Ce qui reste non mesuré

- L'écart des 36 « pose ajoutée » de B1 : la position n'est pas journalisée.
- L'effet de chaîne des patches 2 et 3 sur les cuts déjà posés par le lot (garde non rejouée).
- Une recherche au-delà de ±80 mm en travers : 18 cuts n'ont déjà aucune cellule à 50 mm ou moins dans la fenêtre ; élargir la fenêtre n'a pas été mesuré, et la passe recentrée a déjà refusé ces cuts.
