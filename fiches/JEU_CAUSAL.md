# Jeu causal de la GCV2 : corrections F1 à F5, porte unique rejouée sur 14 parties (19 octobre 2026)

Chantier `claude/50-jeu-causal` (depuis la fusion de H6 et de G1-c-prep, 7486b43). Réponse aux points F1 à F5 de l'audit externe (D-210), avec D-211 (références incertaines), D-212 (porte unique non tenue), D-213 (14 parties d'apprentissage), D-214 (banc des différés), D-216 (conclusion de H6 suspendue) et D-220 (jugement des différés sans contrainte de séance). Étude **hors ligne** : rien sous `src/` ne change, aucune action dans ESV.

Tous les chiffres sont des chiffres de **développement** : 14 parties d'apprentissage (1:12, 1:13, 1:14, 1:15, 1:16, 1:17, 1:24, 1:29, 2:1, 2:6, 2:7, 2:10, 2:11, 2:13), en validation croisée par partie. Les témoins 1:11 et 1:25 n'ont pas été lus ; 2:17, 2:18 et toute partie neuve non plus. Ces chiffres ne remplacent pas le jugement G1-c (protocole § 1 et § 2), qui reste fermé.

Les parties sont désignées par leur rang (« 2:1 » = projet 2, partie 1). Seuls des numéros de cut, des millimètres et des comptes figurent ici.

## 1. Ce qui a changé dans la fabrication du jeu

Le jeu causal est le mode par défaut de `tools/gcv2-jeu.cjs construire` (version `causal-1` dans l'entête du jeu ; `--non-causal` reproduit le jeu de H6). Principe : **tout ce qui entre dans une hypothèse, un trait ou la règle prudente est pris à l'instant de la décision du cut**.

| Point de l'audit | Avant (jeux de G1-b et de H6) | Jeu causal |
|---|---|---|
| **F1** (fuite par la fabrication des entrées) | les entrées des traits étaient calculées sur la partie entière | chaque entrée (zone, rôle, médiane, voisins, chaîne) est celle de l'instant du cut ; un essai de bout en bout le prouve par la vraie extraction (§ 2) |
| **F2** (dates des appuis humains) | une validation comptait avec sa dernière version | chaque validation est une **version datée** par la fin de sa visite, bornée par la dernière écriture ; une revalidation postérieure ne remplace pas la version connue avant |
| **F3** (jeu « lot » sans humain) | H4 retiré après déduplication (H6 l'avait déjà corrigé) | jeu « lot » **généré** sans appui humain, et en plus avec les poses du lot des **seuls cuts qui précèdent** (premier passage du lot) |
| **F4** (zones lues dans des nuages postérieurs) | surfaces PN et ADV de toute la partie, nuages des visites postérieures compris | surfaces lues sur l'entrée sans fuite ; mémoire des zones de l'extension (`src/regles-metier.js`) **arrêtée au cut** ; une zone qui s'ouvre après le cut n'existe pas encore. La mémoire lit les cuts que le lot lit (ses invalides) pour une partie traitée par le lot, comme la table d'avant ; tous les cuts visités pour une partie sans lot (d025494) |
| **F5** (médiane d'écartement) | une médiane par partie, dans l'entête | une **médiane par cut**, des seuls cuts déjà connus ; **la même** dans le jeu (trait de la GCV2) et dans le cas lu par la règle prudente exacte |
| **F6** (seuil de visite) | 0,8 s | **0,6 s** (comme G0 et le compteur de Mic) |
| poses de chaîne manquantes (D-212) | 27 cuts `crossing` sans la pose de la chaîne | la pose de la chaîne est **toujours** parmi les hypothèses dès qu'elle existe |
| références incertaines (D-211) | non détectées | lues dans la liste d'ESV du départ de partie (2:13 : **85 cuts**) ; retirées de la passe (ni calcul, ni appui, ni zone, ni médiane) et jamais exemples |
| parties (D-213) | 11 | **14** : 2:6, 2:7 et 2:13 en plus |

Outils touchés : `tools/gcv2-jeu.cjs` (mode causal, mode `rezoner`), `tools/relecture-autonome.cjs` (options `seuilVisiteS`, `causal`, `incertaines` ; sans option, sortie inchangée), `tools/gcv2-apprendre.cjs` (médiane de l'instant par cut, diagnostic de décision, retrait de H6 pour le banc, λ imbriqué à l'export), `tools/gcv2-evaluer.cjs` (V1+, cascade des pertes, banc des différés, test croisé entre projets), `tools/gcv2-empreintes.cjs` (pièces de la chaîne causale), `datasets/manifeste-parties.json` (2:6, 2:7, 2:13 en apprentissage).

**Mode `rezoner`.** La première version de F4 lisait, pour les parties traitées par le lot, tous les cuts visités par l'opérateur : la population d'entrée du détecteur dépendait alors de ses visites, ce qui n'est ni la table d'avant ni le terrain. Corrigé (d025494). Plutôt que de refaire 8 extractions complètes, `rezoner` recalcule zones, rôles et rupture de série d'un jeu déjà construit ; il redonne la construction complète **octet pour octet** (vérifié sur 2:13, construction complète contre rezonage, et par un essai synthétique).

## 2. Essais d'invariance et de contre-épreuve

Données synthétiques (`tests/helpers/jeu-causal-echo.cjs` : partie inventée, coordonnées fabriquées). L'essai central passe par la **vraie chaîne** : Écho écrit sur disque, lecture, extraction (`relecture-autonome extraire`), observateur, table, zones de l'instant, jeu de relecture, jeu « lot » et cas.

| Essai | Fichier | Ce qu'il prouve |
|---|---|---|
| invariance temporelle de bout en bout | `tests/gcv2-jeu-causal.test.cjs` | changer tout ce qui est postérieur à la décision du cut 5 (poses finales de l'opérateur, nuages des cuts suivants, capture prise après le geste, validation tardive d'un cut d'avant, revisite tardive) ne change **aucune ligne** des cuts 1 à 5, ni dans le jeu de relecture, ni dans le jeu « lot », ni dans le cas ; seules les étiquettes du cut 5 changent |
| invariance, usage lot | idem | les poses du lot des cuts suivants ne changent pas le jeu « lot » des cuts 1 à 5 (elles changent la relecture : le lot est fini) |
| appuis humains datés (F2) | idem | une revalidation postérieure ne remplace pas la version disponible avant ; une écriture tardive borne la date |
| usage lot (F3) | idem | seules les poses du lot des cuts qui précèdent ; une pose de départ déplacée par une main humaine n'est jamais une pose du lot |
| zones de l'instant (F4) | idem | une zone s'ouvre au cut qui la confirme, jamais avant ; un cœur de PN à venir ne change aucune zone d'avant |
| médiane causale (F5) | idem (premier essai) | la même médiane dans le cas (règle prudente) et dans le jeu (GCV2), cut par cut |
| références incertaines (D-211) | idem | détection par la liste d'ESV du départ ; le déplacement du lot ne compte pas ; un cut incertain ne sert ni au calcul, ni d'appui, ni à la zone, ni à la médiane, et n'est jamais un exemple |
| seuil de visite (F6) | idem | 0,6 s dans le jeu causal |
| chaîne | idem | la pose de la chaîne est une hypothèse même sans appui (`crossing`, premier cut) |
| **contre-épreuves** | `tests/gcv2-jeu-causal-contre.test.cjs` | l'essai n'est pas vide : une pose de départ **antérieure** change la médiane du cut 5 ; une validation antérieure change la relecture, jamais le jeu « lot » (octet pour octet) |
| `rezoner` | idem | rezoner un jeu abîmé redonne la construction complète, octet pour octet |
| cascade, banc des différés, diagnostic | `tests/gcv2-cascade.test.cjs` | chaque grosse correction tombe dans une seule case, dans l'ordre ; le banc compte les mauvaises voies avec la définition du protocole ; « GCV2 seule » retire les hypothèses qui ne viennent que de H6 ; le diagnostic dit quel garde-fou bloque une paire juste |

Chaque fichier tourne en moins de 20 s, même machine chargée (le fichier d'origine dépassait 20 s sous charge : il a été coupé en deux).

## 3. Les jeux des 14 parties

Hors dépôt (chemins relatifs et empreintes dans `datasets/gcv2-g1c-empreintes.json`). Construction une partie à la fois ; 1:17 depuis son Écho en 7z, extrait puis effacé.

| partie | cuts visités | avec nuage | référence et nuage (jugés) | hypothèses (relecture / lot) | références incertaines | Mic > 10 mm (avec nuage / sans) |
|---|--:|--:|--:|--:|--:|--:|
| 1:12 | 108 | 81 | 81 | 2 449 / 2 524 | 0 | 24 / 7 |
| 1:13 | 224 | 155 | 153 | 4 061 / 3 889 | 0 | 21 / 8 |
| 1:14 | 112 | 108 | 104 | 3 224 / 3 271 | 0 | 15 / 2 |
| 1:15 | 524 | 346 | 325 | 10 132 / 9 750 | 0 | 7 / 3 |
| 1:16 | 388 | 347 | 335 | 10 004 / 9 633 | 0 | 20 / 1 |
| 1:17 | 795 | 200 | 199 | 5 026 / 4 523 | 0 | 44 / 159 |
| 1:24 | 263 | 40 | 32 | 1 085 / 1 107 | 0 | 24 / 84 |
| 1:29 | 821 | 582 | 580 | 13 948 / 12 145 | 0 | 93 / 29 |
| 2:1 | 765 | 465 | 462 | 11 021 / 9 806 | 0 | 135 / 37 |
| 2:6 | 431 | 376 | 340 | 9 069 / 8 051 | 0 | 31 / 4 |
| 2:7 | 960 | 701 | 672 | 16 617 / 14 278 | 0 | 59 / 26 |
| 2:10 | 21 | 21 | 21 | 588 / 533 | 0 | 1 / 0 |
| 2:11 | 546 | 303 | 276 | 7 625 / 6 723 | 0 | 23 / 4 |
| 2:13 | 254 | 144 | 120 | 3 198 / 2 907 | 85 | 2 / 0 |
| **total** | **6 212** | **3 869** | **3 700** | | **85** | **499 / 364** |

Toutes les constructions : 0 erreur, 0 écart de la copie du moteur. **Contrôles de cohérence** : 1:16 (construite quelques minutes avant le commit 5c384ea) a été reconstruite avec le code final : jeu, jeu « lot » et cas identiques **octet pour octet** ; 2:13 construite en entier après d025494 = 2:13 rezonée, octet pour octet ; les 8 parties traitées par le lot (1:17, 1:24, 1:29, 2:1, 2:6, 2:7, 2:10, 2:11) ont été rezonées après d025494 ; les 5 parties sans lot (1:12 à 1:16) ne sont pas touchées par d025494 (la lecture des zones y reste « tous les cuts visités »).

Le registre de population (parcours complet visités → nuage → référence → retenus, par partie) est publié par l'évaluateur (`valider`) ; total : 3 438 références explicites, 2 009 implicites (visite sans action ≥ 0,6 s), 85 incertaines, 680 sans référence ; 60 cuts SKIP (35 avec référence explicite), 53 retenus.

## 4. Porte unique en développement : V1 et V1+

Validation croisée par partie (14 plis : chaque partie est jugée par un modèle appris sur les 13 autres), **λ imbriqué** (choisi dans chaque pli extérieur parmi 3, 30 et 300, sur ses seules parties d'apprentissage), évaluateur exact de G1-c-prep (`tools/gcv2-evaluer.cjs valider`) : règle prudente **réellement rejouée** sur les cas (avec la médiane de l'instant), porte unique du protocole § 3, inchangée. Variantes **telles que déclarées** : V1 (D-204, `datasets/gcv2-variantes.json`), V1+ (D-207, `datasets/gcv2-variantes-h6.json`, avec `--garde-voie`). Rien n'a été choisi d'après ces résultats.

Rappel de la porte : (1) 0 mauvaise voie (erreur finale > 50 mm, ou rail déplacé de plus de 45 mm en travers depuis la pose de départ) ; (2) borne haute de Wilson ≤ 9 % ; (3) 0 mauvaise pose ajoutée, appariée ; (4) justes ≥ règle prudente et erreur médiane par zone active ≤ règle prudente ; (5) par partie.

### 4.1 Issue

| variante | usage | actions | justes (règle) | abîmés (règle) | mauvaises voies | erreurs, Wilson haut | poses ajoutées | médiane par zone | **porte unique** |
|---|---|--:|--:|--:|--:|--:|--:|---|---|
| V1 | relecture | 180 | 130 (115) | 0 (3) | 0 | 5 (2,8 %), ≤ 6,3 % | 0 | pn 0 / 0 ; adv 0 / 0 ; abords 4,02 / 4,02 | **SUCCÈS (tenue)** |
| V1 | lot | 148 | 121 (115) | 2 (3) | 0 | 9 (6,1 %), ≤ 11,2 % | 2 | pn 0 / 0 ; adv 0 / 0 ; abords 4,02 / 4,02 | **ÉCHEC** |
| V1+ | relecture | | | | | | | | *calcul en cours* |
| V1+ | lot | | | | | | | | *calcul en cours* |

Lecture par condition :

- **V1, relecture : SUCCÈS (tenue)**. Mauvaises voies 0 ; Wilson 6,3 % (règle : 9 erreurs sur 145, 11,4 %) ; poses ajoutées : aucune ; médianes sur les cuts où l'une des deux agit : pn 3,09 contre 3,31 mm sur 82 cuts ; adv 3,82 contre 4,36 mm sur 48 cuts ; abords 4,12 contre 4,12 mm sur 62 cuts. Sensibilité (mêmes porte, sous-ensembles) : références explicites seulement : SUCCÈS (tenue) (0 ajoutée(s), Wilson 6,7 %) ; sans les cuts marqués SKIP par Mic : SUCCÈS (tenue) (0 ajoutée(s), Wilson 6,4 %) ; références explicites, sans SKIP : SUCCÈS (tenue) (0 ajoutée(s), Wilson 6,8 %).
- **V1, lot : ÉCHEC** (mauvaise pose ajoutée ; borne de Wilson > 9 %). Mauvaises voies 0 ; Wilson 11,2 % (règle : 9 erreurs sur 145, 11,4 %) ; poses ajoutées : 1:15 cut 7225 (pn, Mic 0, V1 12,5, règle 0) ; 1:16 cut 7419 (pn, Mic 0, V1 12,5, règle 0) ; médianes sur les cuts où l'une des deux agit : pn 2,46 contre 3,23 mm sur 64 cuts ; adv 4,28 contre 4,52 mm sur 34 cuts ; abords 4,12 contre 4,12 mm sur 62 cuts. Sensibilité (mêmes porte, sous-ensembles) : références explicites seulement : ÉCHEC (0 ajoutée(s), Wilson 9,8 %) ; sans les cuts marqués SKIP par Mic : ÉCHEC (2 ajoutée(s), Wilson 11,4 %) ; références explicites, sans SKIP : ÉCHEC (0 ajoutée(s), Wilson 10 %).
- **V1+, relecture** : calcul en cours.
- **V1+, lot** : calcul en cours.

### 4.2 Par zone (candidat | règle prudente | hasard)

Colonnes : actions / justes / abîmés / erreurs (> 10 mm de Mic) / mauvaises voies. « Hasard » : en espérance exacte, au même taux d'action que la GCV2 seule dans chaque zone, paire tirée parmi les paires permises (définition de G1-b).

**V1, relecture**

zone | cuts | Mic > 10 mm | V1 | règle prudente | hasard
---|--:|--:|---|---|---
pn | 438 | 71 | 77 / 60 / 0 / 1 / 0 | 56 / 52 / 2 / 2 / 0 | 86 / 5,8 / 31,3 / 44,3 / 0
adv | 932 | 150 | 41 / 22 / 0 / 0 / 0 | 27 / 15 / 1 / 3 / 0 | 49,5 / 0,9 / 17,1 / 25,2 / 3,2
abords | 1002 | 190 | 62 / 48 / 0 / 4 / 0 | 62 / 48 / 0 / 4 / 0 | 262,2 / 11,7 / 59,5 / 131,3 / 2,7
liste | 15 | 12 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0
hors | 1313 | 76 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 188,8 / 7,2 / 64 / 87 / 0
**total** | 3700 | 499 | 180 / 130 / 0 / 5 / 0 | 145 / 115 / 3 / 9 / 0 | 586,5 / 25,7 / 172 / 287,9 / 6

**V1, lot**

zone | cuts | Mic > 10 mm | V1 | règle prudente | hasard
---|--:|--:|---|---|---
pn | 438 | 71 | 58 / 56 / 2 / 2 / 0 | 56 / 52 / 2 / 2 / 0 | 59 / 4,2 / 22,4 / 33,7 / 0
adv | 932 | 150 | 28 / 17 / 0 / 3 / 0 | 27 / 15 / 1 / 3 / 0 | 34 / 0,9 / 12,5 / 16 / 0,4
abords | 1002 | 190 | 62 / 48 / 0 / 4 / 0 | 62 / 48 / 0 / 4 / 0 | 297,4 / 13,8 / 64,3 / 142,2 / 2,9
liste | 15 | 12 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0
hors | 1313 | 76 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 825,1 / 18 / 301,2 / 369,6 / 0,5
**total** | 3700 | 499 | 148 / 121 / 2 / 9 / 0 | 145 / 115 / 3 / 9 / 0 | 1215,5 / 36,8 / 400,4 / 561,5 / 3,8


### 4.3 Par partie et par projet

**V1, relecture**

partie | cuts | Mic > 10 mm | V1 | règle prudente | poses ajoutées | conditions ratées (publiées, condition 5)
---|--:|--:|---|---|--:|---
1:12 | 81 | 24 | 18 / 18 / 0 / 0 / 0 | 17 / 17 / 0 / 0 / 0 | 0 | médiane pn > référence
1:13 | 153 | 21 | 19 / 14 / 0 / 1 / 0 | 13 / 10 / 1 / 3 / 0 | 0 | médiane pn > référence
1:14 | 104 | 15 | 12 / 12 / 0 / 0 / 0 | 12 / 12 / 0 / 0 / 0 | 0 | —
1:15 | 325 | 7 | 9 / 4 / 0 / 0 / 0 | 7 / 4 / 0 / 0 / 0 | 0 | —
1:16 | 335 | 20 | 11 / 11 / 0 / 0 / 0 | 14 / 9 / 2 / 2 / 0 | 0 | —
1:17 | 199 | 44 | 5 / 3 / 0 / 1 / 0 | 5 / 3 / 0 / 1 / 0 | 0 | —
1:24 | 32 | 24 | 4 / 1 / 0 / 2 / 0 | 4 / 1 / 0 / 2 / 0 | 0 | —
1:29 | 580 | 93 | 42 / 38 / 0 / 1 / 0 | 43 / 38 / 0 / 1 / 0 | 0 | —
2:1 | 462 | 135 | 18 / 5 / 0 / 0 / 0 | 3 / 3 / 0 / 0 / 0 | 0 | —
2:6 | 340 | 31 | 16 / 11 / 0 / 0 / 0 | 12 / 8 / 0 / 0 / 0 | 0 | —
2:7 | 672 | 59 | 17 / 11 / 0 / 0 / 0 | 13 / 9 / 0 / 0 / 0 | 0 | —
2:10 | 21 | 1 | 2 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 | —
2:11 | 276 | 23 | 7 / 2 / 0 / 0 / 0 | 2 / 1 / 0 / 0 / 0 | 0 | —
2:13 | 120 | 2 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 | —
**projet 1** | 1809 | 248 | 120 / 101 / 0 / 5 / 0 | 115 / 94 / 3 / 9 / 0 | | 
**projet 2** | 1891 | 251 | 60 / 29 / 0 / 0 / 0 | 30 / 21 / 0 / 0 / 0 | | 

**V1, lot**

partie | cuts | Mic > 10 mm | V1 | règle prudente | poses ajoutées | conditions ratées (publiées, condition 5)
---|--:|--:|---|---|--:|---
1:12 | 81 | 24 | 18 / 18 / 0 / 0 / 0 | 17 / 17 / 0 / 0 / 0 | 0 | —
1:13 | 153 | 21 | 13 / 11 / 0 / 2 / 0 | 13 / 10 / 1 / 3 / 0 | 0 | —
1:14 | 104 | 15 | 12 / 12 / 0 / 0 / 0 | 12 / 12 / 0 / 0 / 0 | 0 | —
1:15 | 325 | 7 | 8 / 4 / 1 / 1 / 0 | 7 / 4 / 0 / 0 / 0 | 1 | mauvaise pose ajoutée
1:16 | 335 | 20 | 10 / 9 / 1 / 1 / 0 | 14 / 9 / 2 / 2 / 0 | 1 | mauvaise pose ajoutée
1:17 | 199 | 44 | 5 / 3 / 0 / 1 / 0 | 5 / 3 / 0 / 1 / 0 | 0 | —
1:24 | 32 | 24 | 4 / 1 / 0 / 2 / 0 | 4 / 1 / 0 / 2 / 0 | 0 | —
1:29 | 580 | 93 | 42 / 38 / 0 / 1 / 0 | 43 / 38 / 0 / 1 / 0 | 0 | —
2:1 | 462 | 135 | 5 / 4 / 0 / 1 / 0 | 3 / 3 / 0 / 0 / 0 | 0 | —
2:6 | 340 | 31 | 16 / 11 / 0 / 0 / 0 | 12 / 8 / 0 / 0 / 0 | 0 | —
2:7 | 672 | 59 | 12 / 8 / 0 / 0 / 0 | 13 / 9 / 0 / 0 / 0 | 0 | justes < référence
2:10 | 21 | 1 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 | —
2:11 | 276 | 23 | 3 / 2 / 0 / 0 / 0 | 2 / 1 / 0 / 0 / 0 | 0 | —
2:13 | 120 | 2 | 0 / 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 / 0 | 0 | —
**projet 1** | 1809 | 248 | 112 / 96 / 2 / 8 / 0 | 115 / 94 / 3 / 9 / 0 | | 
**projet 2** | 1891 | 251 | 36 / 25 / 0 / 1 / 0 | 30 / 21 / 0 / 0 / 0 | | 


## 5. Ce qui a changé par rapport à D-212 et D-216 (vérifiable)

D-212 : V1 **échouait** à la porte unique exacte sur les jeux de G1-b. D-216 : V1 la **tenait** dans H6. La question était : est-ce le jeu ou l'évaluateur qui a fait basculer la porte ? Réponse en quatre mesures, toutes relecture, V1, λ imbriqué :

| jeux | évaluateur | parties | issue | poses ajoutées | médiane PN (V1 contre règle, tous les cuts) |
|---|---|--:|---|---|---|
| G1-b (non causaux, 0,8 s) | exact (G1-c-prep, D-212) | 11 | **ÉCHEC** | 3 : 1:15 cut 5919 ; 1:16 cuts 7419, 7423 | 2,005 contre 1,808 mm |
| H6 (non causaux, 0,8 s) | porte de G1-b de `gcv2-apprendre` (H6, D-216) | 11 | « tenue » | non mesurée (cette porte n'apparie pas) | non mesurée |
| H6 (les mêmes) | **exact** (rejoué ici) | 11 | **ÉCHEC** | 2 : 1:15 cut 5919 ; 1:16 cut 7423 | 1,92 contre 1,808 mm |
| **causaux** (0,6 s) | exact | **14** | voir § 4 | voir § 4 | 0 contre 0 mm |

1. **H6 ne tenait pas la porte unique** : sa « porte tenue » venait de la porte de G1-b (sans appariement, sans médiane par zone), pas des jeux. Rejoué avec l'évaluateur exact sur les mêmes jeux de H6, V1 échoue pour les mêmes raisons que dans D-212 (2 des 3 mêmes poses ajoutées, médiane de PN au-dessus). La bascule de D-216 était donc un effet d'évaluateur. (Le rejeu de H6 a été fait en relecture seulement ; le lot a été arrêté au premier pli pour libérer le calcul.)
2. **Sur les jeux causaux**, les trois poses ajoutées de D-212 disparaissent en relecture : 1:15 cut 5919 (ADV ; la meilleure paire de V1 est maintenant « ne rien faire »), 1:16 cuts 7419 et 7423 (PN ; écart sous δ : V1 laisse). Au lot, 7419 revient (12,5 mm), et un cut nouveau apparaît : 1:15 cut 7225 (PN, Mic 0 ; V1 pose à 7,3 mm en relecture, à 12,5 mm au lot). La marge est donc mince : la porte tient ou tombe sur un ou deux cuts.
3. **La médiane par zone** passe de « 1,9 contre 1,8 » à « 0 contre 0 » : ce n'est pas V1 qui s'améliore, c'est la population. Au seuil de 0,6 s (F6), les visites sans action valent « bon » (Mic = 0) bien plus souvent : en PN, 251 des 438 cuts ont Mic = 0 (212 sur 458 dans les jeux de H6), et la médiane de tous les cuts tombe à 0 pour les deux méthodes. La condition 4b devient presque automatique avec la définition écrite (tous les cuts mesurables de la zone), **qui n'est pas changée**. Lecture complémentaire, publiée pour qu'on juge : sur les seules références explicites (validations de Mic), V1 reste sous la règle en PN (relecture 2,551 contre 2,574 mm ; lot 2,429 contre 2,574), en ADV (4,275 contre 4,41 ; 4,378 contre 4,41), égale aux abords ; et sur les cuts où l'une des deux méthodes agit, V1 est sous la règle en PN et en ADV (§ 4.1). La condition tiendrait donc aussi sous une lecture plus stricte, mais la définition actuelle ne la met plus à l'épreuve.
4. **Zones de l'instant** : des cuts changent de zone. Exemple vérifiable : 2:1 cut 2932 était en ADV pour G1-c-prep (la règle posait à 6,3 mm, V1 laissait le cut faux : pose « ajoutée » au lot de D-212) ; à l'instant de sa décision, l'ADV n'est pas encore connue : il est aux abords, la règle prudente le traite dans V1 comme dans la référence (6,3 mm). Ce n'est pas un réglage : c'est F4.
5. **Ce qui ne change pas** : les définitions de la porte, le protocole, les variantes, les paramètres de la GCV2 (seuls les jeux et le seuil de visite ont changé).

## 6. Banc des différés (D-214)

Tous les cuts **différés** par le lot dont Mic a posé la référence. Méthode : la GCV2 du pli, seule (sans variante), sur ces cuts ; mauvaise voie au sens du protocole § 3. **D-220 appliqué** : aucun filtre de séance ni de délai ; un différé est jugé dès que l'Écho a une référence de Mic et un nuage. Le contrôle « la pose de départ vue par l'Écho est celle du dernier lot » n'est fait que là où la liste d'ESV du départ existe (2:13, références incertaines) ; ailleurs, aucune autre écriture n'est connue entre le lot et la visite de Mic. Les parties sans lot (1:12 à 1:16) n'ont pas de différés.

### 6.1 Validation croisée par partie (GCV2 du pli)

**GCV2 seule du pli (avec H6, sans garde de série), relecture**

partie | différés jugés | sans nuage | > 10 mm | atteignables | actions | justes | abîmés | mauvaises voies | erreurs | erreur médiane (actions) | erreur finale médiane
---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:
1:17 | 10 | 26 | 8 | 9 | 2 | 2 | 0 | 0 | 0 | 4,1 | 62,7
1:24 | 9 | 31 | 9 | 9 | 0 | 0 | 0 | 0 | 0 | — | 100,4
1:29 | 28 | 7 | 25 | 26 | 11 | 11 | 0 | 0 | 0 | 4,3 | 34,2
2:1 | 104 | 23 | 104 | 68 | 7 | 4 | 0 | 2 | 3 | 5,5 | 190,4
2:6 | 10 | 1 | 10 | 10 | 4 | 4 | 0 | 0 | 0 | 3,7 | 44,6
2:7 | 15 | 6 | 15 | 15 | 4 | 3 | 0 | 0 | 1 | 3,1 | 71,8
2:11 | 10 | 2 | 9 | 9 | 4 | 3 | 0 | 0 | 1 | 6,6 | 49,2
**projet 1** | 47 | 64 | 42 | 44 | 13 | 13 | 0 | 0 | 0 | 4,3 | 50,2
**projet 2** | 139 | 32 | 138 | 102 | 19 | 14 | 0 | 2 | 5 | 4,3 | 161,7
**total** | 186 | 96 | 180 | 146 | 32 | 27 | 0 | 2 | 5 | 4,3 | 118,1

**GCV2 seule du pli (avec H6, sans garde de série), lot**

partie | différés jugés | sans nuage | > 10 mm | atteignables | actions | justes | abîmés | mauvaises voies | erreurs | erreur médiane (actions) | erreur finale médiane
---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:
1:17 | 10 | 26 | 8 | 7 | 0 | 0 | 0 | 0 | 0 | — | 62,7
1:24 | 9 | 31 | 9 | 6 | 0 | 0 | 0 | 0 | 0 | — | 100,4
1:29 | 28 | 7 | 25 | 26 | 13 | 13 | 0 | 0 | 0 | 4 | 10,6
2:1 | 104 | 23 | 104 | 34 | 5 | 3 | 0 | 0 | 2 | 5,5 | 190,4
2:6 | 10 | 1 | 10 | 10 | 5 | 5 | 0 | 0 | 0 | 4,1 | 28,4
2:7 | 15 | 6 | 15 | 15 | 5 | 4 | 0 | 0 | 1 | 3,5 | 71,8
2:11 | 10 | 2 | 9 | 8 | 2 | 2 | 0 | 0 | 0 | 3,2 | 63,6
**projet 1** | 47 | 64 | 42 | 39 | 13 | 13 | 0 | 0 | 0 | 4 | 50,2
**projet 2** | 139 | 32 | 138 | 67 | 17 | 14 | 0 | 0 | 3 | 3,9 | 161,7
**total** | 186 | 96 | 180 | 106 | 30 | 27 | 0 | 0 | 3 | 3,9 | 118,1


### 6.2 Test croisé entre projets

Apprendre sur toutes les parties d'un projet (λ par validation interne de ces seules parties ; un espion refuse toute lecture du projet jugé), juger les différés de l'autre.

*lot, GCV2 avec H6, sans garde de série : calcul en cours.*

*lot, GCV2 seule (sans H6) : calcul en cours.*

*lot, GCV2 avec H6 et garde-fou de voie : calcul en cours.*

*relecture, GCV2 avec H6, sans garde de série : calcul en cours.*


## 7. Cascade des pertes des grosses corrections (> 10 mm)

Chaque grosse correction de Mic (Mic exact > 10 mm, référence non incertaine) tombe dans **une** case, dans l'ordre du tableau. Lecture seule, aucun réglage. Zone = zone de l'instant.

**V1, relecture**

étape | total | pn | adv | abords | liste | hors | projet 1 | projet 2
---|--:|--:|--:|--:|--:|--:|--:|--:
grosses corrections (Mic > 10 mm) | 863 | 86 | 190 | 443 | 16 | 128 | 541 | 322
sans nuage (perdues d'avance) | 364 | 15 | 40 | 253 | 4 | 52 | 293 | 71
avec nuage, hors de la population du jeu (rail sans hypothèse de départ) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
avec nuage, aucune hypothèse à 10 mm (rappel manquant) | 52 | 2 | 38 | 9 | 1 | 2 | 6 | 46
atteignable, rouge (jamais touché) | 26 | 1 | 5 | 20 | 0 | 0 | 15 | 11
atteignable, différé (la variante ne le confie à personne) | 140 | 3 | 69 | 68 | 0 | 0 | 39 | 101
atteignable, zone « hors » ou « liste » (rien n'agit) | 85 | 0 | 0 | 0 | 11 | 74 | 41 | 44
atteignable, abords : la règle prudente n'agit pas | 41 | 0 | 0 | 41 | 0 | 0 | 32 | 9
GCV2 s'abstient : preuve de voie manquante (différé) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
GCV2 s'abstient : garde-fou d'écartement | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0
GCV2 s'abstient : garde-fou 45 mm latéral | 4 | 0 | 4 | 0 | 0 | 0 | 0 | 4
GCV2 s'abstient : garde-fou de dévers | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
GCV2 s'abstient : zone inactive dans le pli (aucun τ admissible) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
GCV2 s'abstient : sa meilleure paire est « ne rien faire » | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
GCV2 s'abstient : écart sous δ | 8 | 2 | 6 | 0 | 0 | 0 | 4 | 4
GCV2 s'abstient : probabilité sous τ | 7 | 2 | 5 | 0 | 0 | 0 | 4 | 3
autre (non classé) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
traitées (action de la variante) | 135 | 61 | 22 | 52 | 0 | 0 | 106 | 29
dont justes (≤ 10 mm de Mic) | 130 | 60 | 22 | 48 | 0 | 0 | 101 | 29
dont fausses (> 10 mm) | 5 | 1 | 0 | 4 | 0 | 0 | 5 | 0

**V1, lot**

étape | total | pn | adv | abords | liste | hors | projet 1 | projet 2
---|--:|--:|--:|--:|--:|--:|--:|--:
grosses corrections (Mic > 10 mm) | 863 | 86 | 190 | 443 | 16 | 128 | 541 | 322
sans nuage (perdues d'avance) | 364 | 15 | 40 | 253 | 4 | 52 | 293 | 71
avec nuage, hors de la population du jeu (rail sans hypothèse de départ) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
avec nuage, aucune hypothèse à 10 mm (rappel manquant) | 106 | 2 | 73 | 23 | 2 | 6 | 20 | 86
atteignable, rouge (jamais touché) | 23 | 1 | 5 | 17 | 0 | 0 | 12 | 11
atteignable, différé (la variante ne le confie à personne) | 100 | 3 | 36 | 61 | 0 | 0 | 34 | 66
atteignable, zone « hors » ou « liste » (rien n'agit) | 80 | 0 | 0 | 0 | 10 | 70 | 39 | 41
atteignable, abords : la règle prudente n'agit pas | 37 | 0 | 0 | 37 | 0 | 0 | 28 | 9
GCV2 s'abstient : preuve de voie manquante (différé) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
GCV2 s'abstient : garde-fou d'écartement | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0
GCV2 s'abstient : garde-fou 45 mm latéral | 3 | 0 | 3 | 0 | 0 | 0 | 0 | 3
GCV2 s'abstient : garde-fou de dévers | 2 | 2 | 0 | 0 | 0 | 0 | 2 | 0
GCV2 s'abstient : zone inactive dans le pli (aucun τ admissible) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
GCV2 s'abstient : sa meilleure paire est « ne rien faire » | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 1
GCV2 s'abstient : écart sous δ | 8 | 4 | 4 | 0 | 0 | 0 | 6 | 2
GCV2 s'abstient : probabilité sous τ | 10 | 3 | 7 | 0 | 0 | 0 | 4 | 6
autre (non classé) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0
traitées (action de la variante) | 128 | 56 | 20 | 52 | 0 | 0 | 102 | 26
dont justes (≤ 10 mm de Mic) | 121 | 56 | 17 | 48 | 0 | 0 | 96 | 25
dont fausses (> 10 mm) | 7 | 0 | 3 | 4 | 0 | 0 | 6 | 1


## 8. Limites

- **Développement, pas jugement.** Les 14 parties ont servi à choisir V1 (D-204) et à déclarer V1+ (D-207). Une porte tenue ici dit seulement que la candidate ne tombe pas sur ses propres parties ; elle ne remplace pas G1-c. **G1-c n'est pas ouvert** par ce chantier, et les empreintes réécrites ne le déclarent pas ouvert.
- **Marge mince.** La porte tient ou tombe sur un ou deux cuts de PN où Mic n'a rien corrigé (1:15 cut 7225 : V1 pose à 7,3 mm en relecture, à 12,5 mm au lot ; 1:16 cut 7419 : laissé en relecture, 12,5 mm au lot).
- **Wilson au lot.** Aux abords, V1 *est* la règle prudente (62 actions, 4 erreurs, les mêmes que la référence). La règle prudente seule ne tiendrait pas la condition 2 (9 erreurs sur 145, borne 11,4 %). Au lot, la part de la GCV2 dans V1 (PN et ADV) fait 86 actions et 5 erreurs. L'échec de Wilson au lot vient donc en bonne partie de ce que V1 hérite de la règle ; c'est un constat, pas une excuse : la porte est écrite pour V1 entière.
- **Condition 4b presque automatique** au seuil de 0,6 s (§ 5, point 3). Sa définition n'est pas changée ; la lecture sur les références explicites est publiée à côté.
- **D-220** : aucun filtre de séance ni de délai. Le contrôle « pose de départ de l'Écho = pose du dernier lot » n'est possible que là où la liste d'ESV du départ existe (2:13) ; ailleurs, il est supposé (aucune autre écriture connue).
- **Différés** : 2:1 pèse plus de la moitié des différés jugés ; 1:17 et 1:24 ont plus de différés sans nuage que jugés.
- **Hauteur apprise** figée, apprise sur 1:17, 1:24, 1:29 et 2:1 (audit V2) : la validation croisée reste un développement conditionnel.
- **Compteur de Mic** : non mis à jour ici. Les paramètres appris sur les 14 parties (`datasets/gcv2-parametres-causal.json`) existent ; 2:6, 2:7 et 2:13 peuvent passer « appris » au compteur sur décision de l'orchestrateur (D-213).
- **Hasard** : définition de G1-b (même taux d'action que la GCV2 seule, par zone, sur toutes les zones) ; il agit donc aussi hors zone, là où V1 n'agit pas.

## 9. Reproduire

```
# jeu d'une partie (exemple 2:13 ; parties sans lot : --sans-lot à la place de --journal)
node tools/gcv2-jeu.cjs construire --partie 2:13 --echo <Écho> --journal <journal du lot> --liste <liste d'ESV du départ> \
  --sortie jeu-2-13.jsonl --sortie-lot jeu-lot-2-13.jsonl --sortie-cas cas-2-13.jsonl
# zones seulement, sur un jeu déjà construit
node tools/gcv2-jeu.cjs rezoner --partie 2:13 --echo … --journal … --cas cas-2-13.jsonl --jeu jeu-2-13.jsonl --jeu-lot jeu-lot-2-13.jsonl \
  --sortie … --sortie-lot … --sortie-cas …
# porte unique, V1 (relecture ; --usage lot avec les jeu-lot-*)
node --max-old-space-size=6500 tools/gcv2-evaluer.cjs valider --jeu jeu-1-12.jsonl … --cas cas-1-12.jsonl … --usage relecture --lambdas 3,30,300 --variante V1
# V1+
… --variantes datasets/gcv2-variantes-h6.json --variante V1+ --garde-voie
# test croisé entre projets (banc des différés)
node tools/gcv2-evaluer.cjs croise --jeu jeu-lot-… --cas cas-… --usage lot --lambdas 3,30,300 [--garde-voie] [--sans-h6]
# paramètres appris sur le jeu causal
node tools/gcv2-apprendre.cjs exporter --jeu jeu-… --jeu-lot jeu-lot-… --lambdas 3,30,300 --date 2026-10-19 --sortie datasets/gcv2-parametres-causal.json
# empreintes
node tools/gcv2-empreintes.cjs ecrire --racine-jeux <dossier des jeux> --racine-cas <dossier des cas> --date 2026-10-19
```

Temps (un cœur) : 13 min pour 1:16, 24 min pour 2:7 ; une validation croisée de 14 plis ≈ 1 h 40 à 2 h par usage et par variante.
