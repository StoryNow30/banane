# CH-053-M — Modèle (T3) : choisir la voie quand le moteur n'a pas la bonne hypothèse (05/11/2026)

Session senior, branche `chantier/CH-053-M` (depuis `chantier/CH-053`). Tout en OMBRE, hors ligne : aucun réglage ni règle activés, aucun fichier interdit touché. Données : `banane-data`, collections du 04/11 (apprentissage : parties 10, 13, 14, 15, D-281) et du 05/11 (examen : parties 8 à 12, réservées, jugées une fois, paramètres figés). ÉTABLI = compté par un outil ; PROBABLE = indices concordants ; SUPPOSÉ = non mesuré.

## 1. Point de départ et diagnostic (ÉTABLI)
- Jeux `gcv2-jeu` reconstruits sur les quatre parties d'apprentissage : 45 différés jugés corrigés de plus de 10 mm ; une paire à 10 mm existe pour **19 sur 45 (42,2 %) à l'usage lot** (CH-051 disait 48 % : c'est 30/62 sur toutes les grosses corrections), 30 sur 45 avec les voisins humains de l'Écho.
- Les 26 manqués sont trois séries de voie décalée de 60 à 150 mm (10 : 4213-4229 ; 14 : 4131-4133 ; 15 : 443-472), surtout en passage à niveau : le moteur trouve UN rail et, pour l'autre, accroche une structure à 60-70 mm (contre-rail) ; la paire sort du contrat et le cut est différé. La pose d'ESV d'une ligne invalide est un gabarit à 1 500 mm, pas une approximation du rail. Les voisins validés du lot n'existent pas (séries entières différées) ; les ombres mémoire de série et voie prédite n'ont donc aucun appui (abstention « no-anchor »).
- Information qui PERMET de choisir la voie, mesurée : (a) les lignes valides de la liste d'ESV autour du cut (B1, D-095), prédiction puis moteur relancé ; (b) le rail que le moteur a trouvé plus l'écartement de référence des lignes valides non touchées (L1-e), le moteur relancé sur la paire complétée, de chaque côté ; (c) le nuage seul (balayage à ±250 mm à l'écartement de référence) : trouve la voie mais choisit mal dans les passages à niveau (une mauvaise voie à 121 mm, partie 15).

## 2. Code livré (ombre, essais verts, aucun fichier interdit)
`tools/rejeu-voie-predite.cjs` : lecture par partie d'un lot de plusieurs parties ; captures vides du lot complétées par le nuage de l'Écho (session ou segments, union des blocs de toutes les visites autour de la pose de départ) ; lignes B1 et référence d'écartement lues dans l'instantané compact de la liste (`--liste-esv`) ; deux sources de voie hors appui : **« ecart »** (complément par l'écartement) et **« balayage »** ; variantes `ecart-serie`, `balayage-serie`, `b1-ecart-serie`… `tests/rejeu-voie-predite.test.cjs` : +4 essais (balayage retrouve une voie unique à 230 mm, s'abstient devant deux voies ; complément d'un rail hors fenêtre ; lecture par partie et instantané). `chantiers/CH-053/M-synthese.cjs` : synthèse et validation croisée par partie.

## 3. Mesure en apprentissage (10, 13, 14, 15 ; 45 différés jugés > 10 mm ; ÉTABLI)
| source (seconde chance sur les seuls différés) | posés | justes ≤ 10 mm | faux 10-50 mm | > 50 mm |
|---|--:|--:|--:|--:|
| témoin (le lot rejoué) | 1 | 1 | 0 | 0 |
| liste d'ESV seule (B1, série) | 24 | 22 (48,9 %) | 2 | 0 |
| complément par l'écartement seul | 28 | 23 (51,1 %) | 5 | 0 |
| balayage seul | 27 | 21 | 6 | **1** (15/472, 121 mm) |
| **liste d'ESV puis complément (`b1-ecart-serie`)** | 33 | **28 (62,2 %)** | 5 | 0 |
| plafond (appuis = poses de l'opérateur, jamais une règle) | 27 | 22 | 5 | 0 |

- **Validation croisée par partie** (variante choisie sur les trois autres : à chaque fois `b1-ecart-serie`, appliquée à la quatrième) : **28/45 justes = 62,2 % [48 ; 75]**, 5 faux de 10,8 à 31 mm (10/4221, 10/4224, 10/4228, 13/5808, 15/469), **0 pose à plus de 50 mm sur 33 posées [0 ; 10]**. Sur tous les différés jugés (55) : 37 justes (67,3 % [54 ; 78]), 0 > 50 mm sur 42 [0 ; 8].
- **Rappel atteignable après** (une source au moins pose à 10 mm) : **31/45 = 68,9 % [54 ; 80]** (10 : 7/14 ; 13 : 13/18 ; 14 : 6/8 ; 15 : 5/5), contre 19/45 avant. La cible de 70 % n'est pas franchie : il manque un cut, et l'intervalle couvre 54 à 80 %.
- Ce qui reste hors d'atteinte (14) : 7 en partie 10 (aucun rail trouvé sur le nuage de l'Écho, 384 à 5 000 points), 5 en partie 13, 2 en partie 14. Données manquantes : des nuages du LOT sur ces séries (le lot n'avait aucun point, D-283 y remédie), un Écho des posés voisins.
- Fidélité du témoin (ÉTABLI) : 393/397, 111/122, 67/69 décisions identiques au lot réel (parties 10, 14, 15) ; la partie 13 est rejouée sur le nuage de l'Écho (le lot n'en avait pas) : 88 captures complétées.

## 4. Examen (parties réservées 8 à 12 du 05/11, une seule lecture, paramètres figés ; ÉTABLI)
- **Posés d'Ariane jugés (à part, priorité) :** 831 posés, 229 jugés (184 validations + 45 « contrôlé, bon »). À 10 mm **227/229 (99,1 %)**, > 20 mm 0, **> 50 mm 0/229 (0 % [0 ; 1,7])**, mauvaise voie 0, sous 5 mm 197/229 (86,0 % [80,9 ; 89,9]). Sans les 18 validations sans mouvement de moins de 1,5 s : 166, à 10 mm 164/166 (98,8 % [95,7 ; 99,7]), > 50 mm 0 [0 ; 2,3]. **D-223 (≤ 3 % à plus de 50 mm) et « 90 % à 10 mm » sont DÉMONTRÉS sur les posés jugés.** Réserve : couverture 229/831 (27,6 %) ; sur tous les posés, D-223 n'est tenu qu'au plancher (`juger-lot` : « ne tranche pas ») ; l'échantillon est celui que l'opérateur a visité, pas un tirage (biais possible, PROBABLE).
- **T3 sur l'examen :** 28 différés jugés, 22 corrigés de plus de 10 mm. Nature différente de l'apprentissage : 17 des 34 différés réels viennent de la **garde « après un différé »** (D-268), pas d'une abstention du moteur ; le rappel « avant » (`gcv2-jeu`, usage lot) y est déjà 20/22. Règle figée `b1-ecart-serie` : **14/22 justes (63,6 % [43 ; 80]), 0 faux, 0 > 50 mm sur 14 posées [0 ; 22]** ; sur les 28 : 19 justes (70,4 % [52 ; 84]), 0 faux. Le témoin rejoué (lot sans la garde) en pose 9/22 : la part propre aux sources nouvelles est de 5 cuts (parties 10 et 12), tous justes.

## 5. Ce que je propose, et ce que cela coûterait
1. **Rien n'est à activer aujourd'hui.** Le gain mesuré est net (19 → 31 atteignables, 28 posés justes en validation croisée, 0 > 50 mm sur 33 puis 14 posées) mais le budget D-223 sur ces poses reste indémontrable à ces effectifs (bornes hautes 10 % et 22 %). Proposition : brancher `b1-ecart` **en ombre dans l'extension** (événement par cut différé, comme `voie-predite-ombre`), avec déplacement de la vue, et le juger sur deux lots avec Écho des différés ; décision d'écriture ensuite, plafonnée (D-259).
2. Le **balayage** ne doit pas être activé : une mauvaise voie sur 27 poses (passage à niveau).
3. La garde « après un différé » coûte 17 différés sur 34 sur l'examen, dont au moins 9 que le lot aurait posés juste : à chiffrer par CH-053-S ou l'intégrateur (hors de mon périmètre).
4. Coût en décision si activé : la seconde chance ne joue que sur un cut déjà différé ; le prix est 0,3 à 1 s par cut différé (relances du moteur) et un geste de vue ; aucune pose sans preuve du nuage (le moteur qualifie la paire relancée).

Jeux dérivés (chez moi, à verser dans `banane-data` par l'intégrateur ; reproductibles par les commandes du § 6) : jeux `gcv2-jeu` des 9 parties (jsonl), détails du rejeu par cut (`--detail`), tables de jointure 8-12, cache moteur. Dans le dépôt : `M-synthese-apprentissage.json`, `M-synthese-examen.json`, `M-juger-lot-examen.json` (agrégats, numéros de cut, millimètres ; aucune coordonnée).

## 6. Reproduire
`gcv2-jeu construire --partie 11:P --echo <Écho> --journal <journal>` (12:P `--juger-partie-reservee` pour l'examen) ; `rejeu-voie-predite --partie 11:P --corpus <segments> --journal <journal> --jointure tableP.json --liste-esv <instantané> --echo <segments Écho> --variantes temoin,b1-ecart-serie,…` ; `chantiers/CH-053/M-synthese.cjs --detail P=… --grosses jeuP.jsonl`.
