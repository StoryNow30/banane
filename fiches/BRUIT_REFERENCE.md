# Le bruit de la référence humaine (mesure, chantier 50)

Toute la vérité terrain d'Ariane vient des corrections d'un seul opérateur, l'opérateur expert, observées par le mode Écho. Les seuils « juste à 5 mm » et « juste à 10 mm » supposent que cette référence est précise à mieux que cela. Une seconde relecture à l'aveugle est impossible dans ESV, et l'opérateur n'a rien à faire pour cette mesure : elle est faite sur les exports Écho qui existent déjà. Outil : `tools/bruit-reference.cjs`, essai : `tests/bruit-reference.test.cjs` (données synthétiques, bruits injectés connus). Rien sous `src/`, aucune requête ESV nouvelle.

Chiffres : exports Écho des 14, 15 et 16 octobre 2026, 8 sessions, 3 437 visites, 3 013 cuts, 2 209 cuts avec une validation. Intervalles à 95 % (bootstrap par cut ou par bloc de 20 cuts, Wilson pour les parts). Effectifs écrits à chaque ligne.

## Réponse courte

- **Le grain du clic ne compte pas** : 0,11 mm d'écart type par axe (0,16 mm par rail). Le grain est mesuré dans les données : **0,386 mm par pixel** [0,382 ; 0,390] (1 424 pas), ce qui confirme les 0,38 mm supposés. Le seuil de 5 mm vaut 23 fois l'écart type par rail de deux clics sur un même point.
- **Cuts validés deux fois : 39 sur 2 209 (1,8 %).** Quand la seconde validation vient 5 s ou plus après la première (19 paires), la pose est **identique à moins de 0,5 mm dans 79 % des cas** [57 ; 92], le plus grand changement est de 4,6 mm, aucun ne dépasse 5 mm. Quand elle vient moins de 5 s après (20 paires), c'est une rectification du même geste : 45 % changent de plus de 5 mm.
- **Cuts revus** : 234 revisites de cuts déjà validés, **95,7 % sans aucune action** [92,3 ; 97,7], 4 revisites seulement déplacent un rail (1,4 à 6,9 mm). Entre deux sessions (partie 29 seule) : 19 revisites, 16 sans action, 1 déplacement de 4,6 mm.
- **Débutant contre expert** (parties 12 et 13, 228 cuts traités par les deux) : l'expert laisse **41,7 % des cuts intacts** [35,5 ; 48,1], retouche 25,4 % de 1 à 5 mm, 5,7 % de 5 à 10 mm, et **23,7 % de 25 mm ou plus** (mauvais objet) [18,6 ; 29,6]. Cette mesure donne l'erreur du débutant, pas celle de l'expert.
- **Cohérence entre voisins** : écart type d'une pose autour d'une courbe lisse, **1,5 mm en latéral [1,4 ; 1,7] et 2,3 mm en vertical [2,0 ; 2,7]** par rail, 1 964 poses. C'est une **borne haute** (la géométrie réelle de la voie et les défauts des poses de départ conservées y passent aussi). Là où l'expert n'a rien touché (21 cuts), c'est 0,7 et 1,0 mm.
- **Fourchette retenue pour le bruit aléatoire d'une pose de référence : de 0,75 mm (pas de fin de réglage de l'opérateur) à 1,5 mm en latéral et 2,3 mm en vertical, par axe.** Le bruit varie d'une session à l'autre (vertical : 1,0 à 1,4 mm dans les parties du débutant, 2,0 à 2,1 en partie 29 et en partie 1 du second projet, 3,8 à 4,1 en parties 24 et 17).
- **Seuils.** Le seuil de **10 mm a un sens** : un bruit de 1 mm par axe déplace le taux « juste à 10 mm » de 2,4 points au plus (quatre parties), un bruit de 2 mm de 5,4 points au plus. Le seuil de **5 mm a un sens comme taux de partie, pas comme verdict d'un cut** : le taux observé est sous-estimé de 0,1 à 3,0 points (bruit de 1 mm), jusqu'à 8,5 points (bruit de 2 mm, partie 29). Les cuts mesurés entre 3,6 et 6,4 mm sont dans la zone grise : 42 % des cuts posés de la partie 29.
- **Ce qu'on ne sait pas mesurer** : un biais constant de l'expert (où il place le rail par rapport au vrai rail). Aucune source ci-dessous ne le voit.

## Mode d'emploi de l'outil

```
node tools/bruit-reference.cjs --jeu <étiquette>=<dossier ou fichiers Écho, séparés par des virgules> [--jeu …]
     [--debutant <étiquette>]… [--partie N] [--pixel-mm 0.38] [--seuils-jeu <jeu-*.jsonl>…]
     [--graine N] [--sortie bruit.json] [--sans-echantillons]
node tools/bruit-reference.cjs --reprendre bruit.json […]    (statistiques refaites sans relire les Échos)
```

Un « jeu » est un ou plusieurs exports Écho d'une même partie (plusieurs segments, plusieurs sessions). `--debutant` marque un jeu dont les poses de départ sont celles d'un débutant. Sans `--partie`, la partie la plus visitée de chaque jeu est retenue (les rechargements de page laissent des visites de partie 0). La sortie JSON ne contient ni coordonnée absolue ni identifiant : des numéros de partie et de cut, des écarts en millimètres. Graine fixe : deux lancements donnent les mêmes intervalles. L'outil réutilise la lecture et la règle D-143 de `tools/jointure-echo-orbite.cjs` (référence corrigée par l'écriture serveur) sans le modifier.

Durée : quelques minutes pour les six jeux (la partie 17 pèse 1,3 Go d'Écho), environ 1 minute en reprise.

## Les données

| Jeu | Départ des poses | Sessions | Visites | Cuts vus | Cuts avec validation |
|---|---|---:|---:|---:|---:|
| Partie 29 | Ariane et extraction ESV | 2 | 1 018 | 821 | 714 |
| Partie 24 | Ariane et extraction ESV | 2 (5 min, 1 h 36) | 328 | 300 | 225 |
| Partie 17 | Ariane et extraction ESV | 1 | 814 | 795 | 600 |
| Partie 1 du second projet | Ariane et extraction ESV | 1 | 885 | 765 | 442 |
| Partie 12 | **débutant** | 1 | 121 | 108 | 97 |
| Partie 13 | **débutant** | 1 | 271 | 224 | 131 |
| Total | | 8 | 3 437 | 3 013 | 2 209 |

Les exports de la partie 17 sont d'un format plus ancien : une seule référence par visite (aucun cut validé deux fois n'y est visible) et pas de relevé de pose par geste (source 6).

## 1. Les cuts validés deux fois

L'outil range les validations d'un cut dans l'ordre du temps (toutes visites, toutes sessions) et mesure l'écart entre deux validations consécutives, par rail, dans le repère profil de la première. Le comptage de la trace (11 cuts sur 714 en partie 29, soit 1,5 %) est retrouvé.

| Jeu | Cuts validés ≥ 2 fois | Part des cuts avec validation |
|---|---:|---:|
| Partie 29 | 11 | 1,5 % |
| Partie 24 | 9 | 4,0 % |
| Partie 17 | 0 | (format ancien) |
| Second projet, partie 1 | 7 | 1,6 % |
| Partie 12 | 6 | 6,2 % |
| Partie 13 | 6 | 4,6 % |
| Total | **39** | 1,8 % |

Dans la même visite : 28 paires. Dans deux visites d'une même session : 8. Dans deux sessions : 3 (toutes en partie 29).

| 39 paires (plus grand des deux rails, 3D) | Cuts | Part [IC 95 %] |
|---|---:|---|
| Identiques (moins de 0,5 mm) | 19 | 48,7 % [33,9 ; 63,8] |
| 0,5 à 1 mm | 1 | 2,6 % [0,4 ; 13,2] |
| 1 à 5 mm | 10 | 25,6 % [14,6 ; 41,1] |
| 5 à 10 mm | 6 | 15,4 % [7,2 ; 29,7] |
| 10 à 25 mm | 0 | 0 % [0 ; 9,0] |
| 25 mm ou plus | 3 | 7,7 % [2,6 ; 20,3] |

Les trois grands écarts (30,5 ; 37,8 ; 77,7 mm) tombent dans la même visite, 0,6 à 1,6 s après la première validation : soit une erreur de cible aussitôt rectifiée, soit une première référence périmée (le clic est appliqué après la touche, cas D-143, que la correction par l'écriture serveur ne répare que pour la dernière validation d'une visite).

**Le délai sépare deux situations.**

| | Paires | Identiques (< 0,5 mm) | Plus de 5 mm | Rails, 3D |
|---|---:|---|---|---|
| Rapprochées, moins de 5 s | 20 | 20,0 % (4/20) [8,1 ; 41,6] | 45,0 % (9/20) [25,8 ; 65,8] | 40 rails, médiane 0, P90 7,2, max 77,7 mm |
| Espacées, 5 s ou plus | 19 | **79,0 % (15/19) [56,7 ; 91,5]** | **0 % (0/19) [0 ; 16,8]** | 38 rails, médiane 0, P90 0,24, max 4,6 mm |

Parmi les 19 paires espacées, quatre ne sont pas identiques : 4,6 mm (partie 29), 1,2 et 0,8 mm (second projet), 1,0 mm (partie 12). Écart quadratique des paires espacées : 0,43 mm en latéral, 0,67 mm en vertical par axe, soit 0,31 et 0,47 mm par pose si chaque paire est un rejugement (écart divisé par √2).

Ce que cela dit. Une validation rapprochée est un geste de rectification (clic puis touche de validation, ou première référence périmée), pas une seconde mesure. Une relecture espacée laisse la pose telle quelle. Les 1,8 % de cuts concernés sont ceux dont l'opérateur doutait : la part des cuts dont la référence finale s'écarte de plus de 5 mm de la première validation est donc d'au moins 9/2 209 (0,4 %) ; au moins, parce que les exports de la partie 17 ne montrent qu'une référence par visite.

## 2. Les cuts revus

Un cut déjà validé, revu ensuite (autre visite, autre session) : ce que l'opérateur en fait. Les revisites ouvertes moins de 60 s après un rechargement de page ou aux captures vides sont écartées (7).

| Revisites de cuts déjà validés | Revisites (cuts) | Aucune action | Validation sans mouvement | Validation avec mouvement | Mouvement sans validation |
|---|---|---|---|---|---|
| Toutes | 234 (185) | **95,7 %** (224) [92,3 ; 97,7] | 2,6 % (6) [1,2 ; 5,5] | 1,3 % (3) [0,4 ; 3,7] | 0,4 % (1) [0,1 ; 2,4] |
| Cut corrigé avant | 186 | 95,2 % (177) [91,1 ; 97,4] | 2,7 % (5) | 1,6 % (3) | 0,5 % (1) |
| Autre session | 19 (dont 18 de cuts corrigés avant) | 84,2 % (16) [62,4 ; 94,5] | 10,5 % (2) [2,9 ; 31,4] | 5,3 % (1) [0,9 ; 24,6] | 0 % (0) [0 ; 16,8] |
| Même session | 215 | 96,7 % (208) [93,4 ; 98,4] | 1,9 % (4) | 0,9 % (2) | 0,5 % (1) |

Les quatre revisites qui déplacent un rail : 1,4 ; 4,5 ; 4,6 et 6,9 mm (médiane 4,55 mm). Sur les 224 revisites sans action, 29 durent 2 s ou plus (un vrai regard) ; les autres sont des survols.

Par jeu : partie 29, 155 revisites (98,1 % sans action) ; second projet, 46 (95,7 %) ; partie 13, 17 (94,1 %) ; partie 12, 4 ; partie 24, 6 ; partie 17, 6.

**Les sessions multiples.** Seule la partie 29 a des cuts vus dans deux sessions (20 cuts). La partie 24 a bien deux sessions (une de 5 minutes, une de 1 h 36, le 15 octobre) mais **aucun cut commun** : l'effectif de la revue entre sessions est donc de 19 revisites, tout en partie 29.

**Continuité.** La pose de départ d'une visite est celle où la visite précédente a laissé le rail, à 0,0 mm (partie 29 : 232 rails, de la dernière validation au début de la visite suivante, écart maximal 0). Sur l'ensemble des jeux il y a 4 ruptures de plus de 0,5 mm entre la fin d'une visite et le début de la suivante (7,4 ; 66,9 ; 29,0 et 0,9 mm), aucune entre deux sessions : en dehors de ces cas, rien d'autre que l'opérateur ne déplace les rails entre deux visites.

## 3. Débutant contre expert

Dans les parties 12 et 13 l'opérateur expert a corrigé des poses faites par un débutant : chaque cut visité a deux poses humaines, celle du débutant (pose de départ de la première visite) et la dernière validation de l'expert. 228 cuts ont une validation (97 en partie 12, 131 en partie 13) ; 104 cuts visités n'ont pas de validation et ne sont pas comptés.

| Écart débutant → expert (plus grand des deux rails) | Partie 12 (97) | Partie 13 (131) | Les deux (228), [IC 95 %] |
|---|---:|---:|---|
| Intact, moins de 0,5 mm | 40 (41,2 %) | 55 (42,0 %) | **41,7 %** [35,5 ; 48,1] |
| 0,5 à 1 mm | 0 | 2 | 0,9 % [0,2 ; 3,1] |
| 1 à 5 mm | 22 (22,7 %) | 36 (27,5 %) | 25,4 % [20,2 ; 31,5] |
| 5 à 10 mm | 4 (4,1 %) | 9 (6,9 %) | 5,7 % [3,4 ; 9,5] |
| 10 à 25 mm | 3 (3,1 %) | 3 (2,3 %) | 2,6 % [1,2 ; 5,6] |
| 25 mm ou plus (mauvais objet) | 28 (28,9 %) | 26 (19,9 %) | **23,7 %** [18,6 ; 29,6] |
| Plus de 5 mm / plus de 10 mm | 36,1 % / 32,0 % | 29,0 % / 22,1 % | 32,0 % / 26,3 % |

La distribution a deux étages et presque rien entre les deux : des retouches fines, ou un déplacement d'un coup de 25 à 45 mm. **Le réglage seul** (174 cuts de moins de 25 mm) : sur les 110 rails que l'expert a déplacés, |latéral| médian 1,1 mm [0,9 ; 1,5] (P90 4,8), |vertical| médian 2,5 mm [2,1 ; 2,8] (P90 4,8).

Ce que cela dit sur le bruit. Peu de chose, et c'est la limite de cette source :
- l'écart débutant-expert additionne l'erreur du débutant et le bruit de l'expert, sans moyen de les séparer. Les retouches fines du débutant sont plus petites que celles d'Ariane ou de l'extraction ESV (rails déplacés, cuts de moins de 25 mm : |latéral| médian 1,1 mm contre 2,0 [1,9 ; 2,1], |vertical| 2,5 mm contre 4,5 [4,4 ; 4,7]) : si le débutant était parfait, la médiane de la retouche serait celle du seul bruit de l'expert (0,67 σ pour un bruit gaussien), ce qui borne σ à 1,7 mm en latéral (1,13/0,67) et 3,6 mm en vertical (2,46/0,67). Borne très lâche, indépendante de celle des voisins ;
- **41,7 % des références sont la pose de départ elle-même** : l'expert n'a pas cliqué, la référence est la pose du débutant, acceptée dans sa tolérance. Pour ces cuts la précision de la référence est celle du poseur de départ, pas celle d'un clic de l'expert. Dans les jeux dont le départ est Ariane ou l'extraction ESV cette part est de 14,8 % (294 cuts sur 1 981) ;
- presque aucun cut n'est corrigé de 0,5 à 1 mm (8 sur 2 209, 0,4 %, dont 2 ici) : quand l'expert corrige, c'est de 1 mm ou plus. Sa tolérance est de l'ordre du millimètre ;
- 7 des 224 cuts de la partie 13 avaient aussi été posés par Ariane le 13 octobre (mêmes cuts, avant l'Écho) : 3 % de la population, non retirés.

## 4. Le grain du clic

Un clic tombe sur un pixel de q mm. L'erreur de quantification d'un axe est uniforme sur ± q/2, d'écart type q/√12. Un rail posé par un clic a deux axes (latéral, vertical).

| Pour q = 0,38 mm | Valeur |
|---|---:|
| Écart type par axe | 0,110 mm |
| Erreur maximale par axe | 0,190 mm |
| Écart type par rail (latéral + vertical) | 0,155 mm |
| Erreur maximale par rail | 0,269 mm |
| Écart entre deux clics sur le même point, par axe / par rail | 0,155 / 0,219 mm |
| Pointage à ± 1 pixel (main, bord flou), par axe | 0,219 mm (au plus 0,57) |
| Seuil de 5 mm en écarts types de deux clics sur un rail | 23 |
| Seuil de 10 mm | 46 |

**Mesure du grain dans les données.** `railPoseHistory` garde la pose du rail après chaque geste. Deux clics successifs tombent sur le réseau des pixels : un périodogramme de Rayleigh sur les pas de clic à clic (le premier pas part de la pose de départ, il n'est pas un clic) donne le pas du réseau.

| Jeu | Pas | Grain (deux axes) | Concentration R (sans réseau) |
|---|---:|---|---|
| Tous les jeux | 1 424 | **0,386 mm** [0,382 ; 0,390] | 0,51 (0,026) |
| Partie 29 | 634 | 0,386 mm [0,382 ; 0,390] | 0,55 (0,040) |
| Second projet | 496 | 0,386 mm [0,382 ; 0,390] | 0,55 (0,045) |
| Parties 12 et 13 | 99 | 0,388 mm [0,386 ; 0,407] | 0,59 (0,101) |
| Partie 24 | 195 | latéral 0,44 (vue plus large, réseau faible), vertical 0,386 | 0,26 (0,072) |

Le pas du réseau est de 0,388 mm en latéral et 0,384 mm en vertical (tous jeux) : le pixel de 0,38 mm est confirmé, avec un résidu de 0,07 mm autour du réseau. Le plancher dû au pixel reste donc de l'ordre de **0,1 à 0,15 mm par axe** (un peu plus en partie 24 où la vue est plus large). Il est négligeable devant 5 mm ; il n'explique rien du bruit observé plus bas.

## 5. Cohérence entre voisins

Sur sept cuts consécutifs tous référencés (un cut par mètre environ), la pose du cut central est comparée au polynôme de degré 2 ajusté sur ses six voisins, dans l'axe latéral (horizontal, perpendiculaire à la voie) et l'axe vertical. Le polynôme absorbe la géométrie lisse : courbes, changements de pente. Le résidu, divisé par √(1+h) (h : levier de l'ajustement), estime l'écart type d'une pose. Vérifié sur des voies synthétiques : un bruit de 1,5 mm injecté est retrouvé à 0,2 mm près sur 400 cuts (essai du dépôt), une courbe de 150 m de rayon sans bruit donne un résidu nul, et une simulation hors dépôt sur 5 000 cuts retrouve 1, 1,5 et 3 mm à 2 % près. Variante « voie droite » : fenêtres de 11 cuts dont la courbure est inférieure à 1/2 000 m, résidu contre une droite.

Écart type d'une pose, par rail, estimation robuste (1,4826 fois la médiane des résidus absolus), avec intervalle par blocs de 20 cuts :

| Jeu | Cuts centres | Poses | Latéral (mm) | Vertical (mm) |
|---|---:|---:|---|---|
| Partie 29 | 302 | 604 | 1,57 [1,40 ; 1,73] | 2,09 [1,76 ; 2,60] |
| Partie 24 | 73 | 146 | 2,03 [1,73 ; 2,60] | 3,83 [2,72 ; 4,96] |
| Partie 17 | 256 | 512 | 1,61 [1,42 ; 1,88] | 4,11 [3,35 ; 4,88] |
| Second projet, partie 1 | 232 | 464 | 1,61 [1,32 ; 1,92] | 1,99 [1,58 ; 2,44] |
| Partie 12 (débutant) | 49 | 98 | 0,91 [0,68 ; 1,18] | 1,03 [0,63 ; 1,24] |
| Partie 13 (débutant) | 70 | 140 | 0,91 [0,72 ; 1,12] | 1,44 [1,28 ; 1,79] |
| **Tous les jeux** | **982** | **1 964** | **1,52 [1,39 ; 1,66]** | **2,33 [2,01 ; 2,67]** |

Selon qui a posé les rails de la fenêtre (tous jeux) :

| Strate | Cuts | Poses | Latéral | Vertical |
|---|---:|---:|---|---|
| Aucun rail touché par l'expert | 21 | 26 | **0,67** [0,55 ; 1,06] | **0,97** [0,81 ; 1,37] |
| Mixte | 796 | 1 328 | 1,53 [1,38 ; 1,69] | 2,29 [1,98 ; 2,63] |
| Tous les rails touchés (poses cliquées par l'expert) | 430 | 610 | 1,54 [1,37 ; 1,75] | 2,47 [2,04 ; 3,12] |
| Voie droite (droite) | 196 | 392 | 1,40 [1,25 ; 1,69] | 1,69 [1,35 ; 2,24] |
| Milieu des deux rails | 982 | 982 | 1,11 [1,00 ; 1,27] | 2,04 [1,72 ; 2,47] |

Lectures :
- **C'est une borne haute.** Tout ce qui n'est pas lisse à l'échelle de 7 mètres y passe : défauts réels de la voie (joints, soudures), bruit des poses de départ que l'expert a gardées, bruit de l'expert. Là où l'expert n'a rien touché, le résidu est de 0,7 mm en latéral et 1,0 mm en vertical (21 cuts, surtout des poses du débutant) : la voie réelle est donc lisse à mieux que cela, à la précision de ces poses.
- L'écart entre les fenêtres cliquées (1,5 ; 2,5) et les fenêtres intactes (0,7 ; 1,0) n'est pas à mettre en entier au compte de l'expert : les cuts qu'il a dû corriger sont plus souvent des cuts difficiles (passages à niveau et aiguilles, d'après les rapports des parties 12, 13 et 29).
- Le milieu des deux rails a un résidu de 1,11 mm en latéral, soit 1,52/√2 : les erreurs des deux rails sont **indépendantes en latéral**. En vertical (2,04 contre 1,65 attendu), une part de l'erreur est commune aux deux rails (une hauteur commune au cut).
- Le bruit **change d'une session à l'autre** : vertical 4,1 mm en partie 17 (14 octobre), 3,8 en partie 24 (15 octobre), 2,1 en partie 29 (16 octobre, « relue avec soin »), 2,0 en partie 1 du second projet. Un seul chiffre pour toutes les sessions serait faux ; le sens est que la qualité de la référence verticale dépend de la séance.
- Les fenêtres se recouvrent : les intervalles sont calculés par blocs de 20 cuts, pas par fenêtre.

## 6. La cascade des clics (source ajoutée)

Pour 72 % des rails déplacés à la main, l'expert règle en un seul geste ; pour les autres, `railPoseHistory` montre les gestes successifs. Le dernier pas dit à quelle finesse il s'arrête de régler.

| Tous jeux avec relevés (5 jeux) | Effectif | Valeur [IC 95 %] |
|---|---:|---|
| Rails déplacés à la main | 2 147 | |
| Réglés en un seul geste | 1 553 | 72,3 % [70,4 ; 74,2] |
| Deux gestes / trois ou plus | 373 / 221 | |
| Dernier pas, 3D (rails à 2 gestes ou plus) | 594 rails, 495 cuts | médiane **1,21 mm** [1,15 ; 1,38], P90 3,83 [3,44 ; 4,09] |
| Dernier pas, latéral / vertical (valeurs absolues) | 594 | médiane 0,77 [0,67 ; 0,77] / 0,72 [0,60 ; 0,77] mm |
| Dernier pas sous 1 mm / sous 2 mm | 594 | 38,9 % [35,0 ; 42,9] / 72,0 % [68,3 ; 75,5] |

Le premier pas (rails à ≥ 2 gestes) a une médiane de 6,0 mm ; le dernier de 1,2 mm : l'opérateur converge, et s'arrête quand le dernier ajustement est de l'ordre du millimètre (0,75 mm par axe). C'est l'ordre de grandeur de sa tolérance de fin de réglage. Les rails réglés en un seul geste (72 %) n'ont pas de seconde observation : on n'y voit que le geste, accepté.

## Ce que chaque source mesure, et ce qu'elle ne mesure pas

| Source | Mesure | Valeur | Sens du chiffre | Limite principale |
|---|---|---|---|---|
| 1. Validations multiples, espacées | Rejugement avec la pose sous les yeux | 79 % identiques, 0 > 5 mm (19 paires) | Plutôt une borne basse du bruit | L'opérateur voit sa pose précédente (ancrage) ; 19 paires |
| 1. Validations multiples, rapprochées | Rectification de geste | 45 % > 5 mm (20 paires) | Pas une mesure de bruit | Ce sont des corrections volontaires |
| 2. Revues | Reprise d'un cut déjà validé | 4 déplacements sur 234 | Plutôt une borne basse | Même ancrage ; survols nombreux |
| 3. Débutant contre expert | Erreur du débutant (plus bruit expert) | 23,7 % de mauvais objet ; réglage 1 à 5 mm | Ne sépare pas les deux | 41,7 % des références sont la pose de départ |
| 4. Pixel | Grain du clic | 0,11 mm par axe | Plancher sûr | Sans rapport avec la précision visuelle |
| 5. Voisins | Dispersion autour d'une courbe lisse | 1,5 / 2,3 mm par axe | Borne haute | Voie réelle, poses de départ gardées, difficulté des cuts ; ne voit pas un biais lent |
| 6. Cascade des clics | Finesse de fin de réglage | 0,75 mm par axe (dernier pas) | Ordre de grandeur de la tolérance | 28 % des rails seulement ont plusieurs gestes |

**Fourchette retenue (par pose, par axe).** Bas : 0,75 mm (dernier pas ; relectures espacées 0,3 à 0,5 ; poses intactes 0,7 à 1,0). Haut : 1,5 mm en latéral, 2,3 mm en vertical (voisins, tous jeux) ; 1,6 et 2,1 en partie 29. En 3D par rail, de l'ordre de 1 à 2,8 mm. La vraie valeur est quelque part entre les deux, sans qu'on puisse la fixer avec ces données : les sources qui donnent le bas supposent que l'opérateur se juge lui-même sans ancrage, celle qui donne le haut ne sait pas retirer la géométrie réelle.

## Effet sur les seuils

L'outil ajoute à la référence d'un jeu d'apprentissage un bruit gaussien de σ mm par axe (latéral, vertical), indépendant par rail, **sur les seuls rails que l'opérateur a déplacés** (un rail laissé tel quel a pour référence la pose de départ, sans nouveau clic). Il refait les taux « juste à 5 mm » et « juste à 10 mm » (plus grand des deux rails, 3D). Au premier ordre, l'écart au taux observé est ce dont le taux observé est faussé par un bruit de référence de même écart type : le taux « sans bruit » est le taux observé moins cet écart. Cuts posés par Ariane, avec référence ; 200 tirages par σ.

| Jeu (cuts posés) | Taux observé 5 mm / 10 mm | σ = 0,5 | σ = 1 | σ = 1,5 | σ = 2 |
|---|---|---|---|---|---|
| Partie 29 (192) | 50,0 % / 96,4 % | −0,7 / −0,2 | **−3,0 / −1,2** | −5,5 / −2,8 | **−8,5 / −5,2** |
| Partie 17 (192) | 31,3 % / 75,5 % | +0,1 / −0,3 | −0,1 / −1,5 | −0,8 / −3,3 | −1,4 / −5,4 |
| Partie 24 (70) | 34,3 % / 70,0 % | 0,0 / −1,3 | −1,6 / −2,4 | −2,8 / −3,8 | −3,9 / −4,9 |
| Second projet (161) | 72,0 % / 93,8 % | −0,1 / +0,4 | −0,6 / +0,2 | −1,9 / −0,4 | −3,2 / −1,5 |

Écarts en points de pourcentage (5 mm / 10 mm). Part des rails déplacés par l'expert : 69 % (partie 29), 67 % (17), 69 % (24), 35 % (second projet). L'incertitude de la simulation est de 1 à 3 points (écart type d'un tirage), 0,1 à 0,2 point sur la moyenne.

**Cuts dans la zone grise** (mesure entre seuil ± σ√2, donc dont le côté du seuil peut changer), σ = 1 mm :

| Jeu | Autour de 5 mm | Autour de 10 mm |
|---|---|---|
| Partie 29 | 81 cuts sur 192 (42 %) | 18 (9 %) |
| Partie 17 | 44 sur 192 (23 %) | 35 (18 %) |
| Partie 24 | 15 sur 70 (21 %) | 10 (14 %) |
| Second projet | 30 sur 161 (19 %) | 7 (4 %) |

(σ = 2 mm : partie 29, 126 cuts autour de 5 mm (66 %), 37 autour de 10 mm (19 %).)

### Conclusion sur les seuils

- **10 mm : le seuil a un sens.** Avec un bruit de 1 mm par axe, le taux « juste à 10 mm » est faussé de 2,4 points au plus (quatre parties) ; avec 2 mm, de 5,4 points au plus. Le nombre de « faux verts » (au-delà de 10 mm) d'une partie change de 3 cuts sur 192 au plus pour un bruit de 1 mm (1,5 point en partie 17). Un faux vert à 11 mm se lit « à peu près 10 mm », pas « 11 ».
- **5 mm : le seuil a un sens pour un taux de partie, pas pour un cut.** Le taux observé est **sous-estimé** par le bruit (retirer le bruit l'augmente) : de 0,1 à 3,0 points si le bruit est de 1 mm par axe, de 1,4 à 8,5 points s'il est de 2 mm. La partie 29 est la plus sensible parce que ses erreurs se concentrent autour de 5 mm (50 % de ses cuts posés sont juste à 5 mm, et 42 % sont à moins de 1,4 mm du seuil). En lecture pratique : ne pas interpréter une différence de moins de 3 points sur ce taux entre deux parties, ni citer « juste à 5 mm » pour un cut isolé mesuré entre 3,6 et 6,4 mm. Deux versions d'Ariane jugées **sur les mêmes cuts avec la même référence** se comparent mieux que deux taux absolus : le même bruit pèse sur les deux (raisonnement, non mesuré).
- **L'ancrage ne joue pas à ces seuils.** Un cut laissé intact (14,8 % des cuts des jeux à départ Ariane ou ESV, 41,7 % chez le débutant) compte pour une erreur nulle alors que la vraie erreur peut aller jusqu'à environ 1 mm : cela peut faire paraître la pose de départ meilleure à 1 ou 2 mm, pas à 5 mm.
- **Le seuil ne dit pas la distance au vrai rail.** « Juste à 5 mm » veut dire « à 5 mm de la pose que l'opérateur expert valide », à 1 à 2 mm près.

## Doutes

- **Le biais n'est pas mesurable.** Tout ce qui précède est du bruit aléatoire autour de la cible de l'opérateur. S'il place le rail systématiquement à 2 mm de ce que serait la position vraie (convention de bord, hauteur du plan de roulement), aucune de ces mesures ne le verrait : il décalerait tous les taux dans le même sens. Seul indice : le sens des retouches verticales dépend de qui a posé le départ (il remonte les poses du débutant, il baisse celles d'Ariane en partie 29 : constat des rapports des parties 12 et 29, non refait ici), ce qui est compatible avec une cible stable de sa part, sans la prouver.
- **Les rejugements ne sont pas à l'aveugle.** L'opérateur voit sa pose précédente : l'accord des relectures espacées (79 %) mélange la précision et l'ancrage. Seule une relecture à l'aveugle séparerait les deux ; elle est impossible dans ESV.
- **39 cuts validés deux fois, 19 relectures espacées, 19 revisites entre sessions** : de petits effectifs (intervalles larges), et des cuts choisis par le doute de l'opérateur, pas au hasard.
- **La cohérence entre voisins est une borne haute et ne voit pas les dérives lentes** : un décalage de 3 mm sur dix cuts consécutifs est absorbé par le polynôme. Les fenêtres des parties 12 et 13 sont surtout des poses de débutant gardées par l'expert (0,9 et 1,0 à 1,4 mm), plus lisses que les poses cliquées.
- **Un opérateur, huit sessions en trois jours (14 au 16 octobre).** Le bruit vertical va de 1,0 à 4,1 mm selon la session : on ne sait pas si c'est la séance, la difficulté des cuts ou l'état des poses de départ. Aucune mesure d'un second expert.
- **Le modèle de la sensibilité** suppose un bruit gaussien indépendant par axe et par rail ; un bruit à queue lourde, ou commun aux deux rails (c'est le cas en vertical), ne serait pas le même. Les taux observés sont pris pour la vérité (déconvolution du premier ordre).
- **Parties 12 et 13** : l'écart débutant-expert n'est pas un bruit de l'expert. 7 cuts de la partie 13 ont aussi été posés par Ariane le 13 octobre.
- **Le grain de la partie 24** est moins net (le zoom a sans doute changé pendant la session : hypothèse) ; sans effet sur la conclusion.
- Les repères latéral et vertical des sources 1 à 3 sont ceux du profil du rail (incliné par le dévers) ; ceux de la source 5 sont l'horizontale et la verticale. La différence est de l'ordre du degré.

## Recherches sans résultat

Existe-t-il, dans le dépôt de données, des cuts relus par l'expert à deux dates différentes, ce qui donnerait un rejugement indépendant ? Non, au vu des collectes cherchées :
- partie 24 : la session d'observation du 23 septembre (176 cuts) et l'Écho du 15 octobre (300 cuts) n'ont **aucun cut commun** ;
- partie 12 : la relecture du 26 septembre et l'Écho du 16 octobre ont 12 cuts communs (hors cut 0), mais aucun n'a de validation aux deux dates (le cut 1 est validé en septembre seulement, les onze autres en octobre seulement) ;
- d'après l'index du dépôt de données, les autres parties de l'Écho (13, 17, 29, partie 1 du second projet) n'ont pas de collecte antérieure d'observation de l'opérateur.

## Fichiers et reproduction

- `tools/bruit-reference.cjs` : l'outil (lecture seule ; il importe `tools/jointure-echo-orbite.cjs`).
- `tests/bruit-reference.test.cjs` : 11 essais sur fixtures synthétiques (parties 97 à 99, cuts et coordonnées inventés) : formules du pixel, Wilson et bootstrap reproductible, validations multiples (même visite, deux visites, deux sessions), revues et rupture de continuité, jeu débutant, bruit latéral injecté retrouvé (voie droite et en courbe), grain du pixel retrouvé sur un réseau de clics (0,386 et 0,52 mm), sensibilité des seuils, ligne de commande et reprise.
- Les sorties complètes (JSON avec échantillons, texte) sont hors dépôt, comme celles de la jointure. Relance : `node tools/bruit-reference.cjs --jeu p29=<dossiers Écho de la partie 29> … --seuils-jeu <jeu-p29.jsonl> …`, une étiquette `--debutant` pour les parties 12 et 13.
