# M6 — poses à relire : cohérence aux voisins et score de suspicion (plan 5.0, idée 8)

Outil hors ligne `tools/coherence-voisins.cjs`. Sur un journal Orbite (`ariane-journal-v4-*.json`) et, au choix, le bilan et une table de la jointure Écho ↔ Orbite, il calcule pour chaque rail posé par Ariane l'écart à l'interpolation linéaire de ses voisins posés, un score de suspicion par cut et une liste « à relire ». Lecture seule, aucune dépendance, rien sous `src/`, **aucune coordonnée en sortie** (millimètres et numéros de cut seulement). Essai : `tests/coherence-voisins.test.cjs` (fixture synthétique inventée, moins d'une seconde).

## Mode d'emploi

```
node tools/coherence-voisins.cjs --journal <journal> [--bilan <bilan>] [--partie N] [--fenetre 3]
     [--seuil-relire 15] [--seuil-zone 10] [--zone-min 3] [--seuil-score 1.2 | --sans-score] [--part-max 0.05]
     [--jointure table.json [--corrige-mm 10]] [--sortie out.json] [--csv out.csv]
```

- Entrée : le journal ; `--bilan` ajoute les comptes de clôture (terminés, différés, complétés à la main, interrompus). `--jointure` prend le JSON de `tools/jointure-echo-orbite.cjs` (lancé avec `--partie N` sur la même partie) et mesure la liste contre la vérité terrain.
- Sortie texte : résumé (médiane, P90, max par axe, cuts > 10/15/20 mm, zones, cuts signalés et part des cuts posés, bande d'écartement), zones, validation. `--sortie` : JSON `ariane-coherence-voisins-v1` (résumé, zones, validation, table par cut). `--csv` : une ligne par cut.
- Table par cut : voisins retenus, écart par rail (latéral, vertical, longitudinal, 3D), plus grand écart, écartement posé, excès hors bande, signaux (S1, convention refusée avec raison et `dzMm`, confiance), termes du score, score, drapeaux `ecart`, `zone`, `score`.

## Définitions

- **Cut posé par Ariane** : `validation-accepted` ou `applied-verified` au journal, pose = état corrigé du record (comme la jointure).
- **Voisins** : le plus proche cut posé avant et le plus proche après, dans ±3 numéros, **dans le même repère de scène** (`frameId` : il change à chaque rechargement de la page ESV). Garde en plus : un segment voisin avant → après de plus de 2,5 m par numéro de cut est une rupture de repère (cut sans voisins). Sans voisin de chaque côté : « sans voisins », pas d'écart (le score ne porte que sur les autres termes).
- **Écart** : pose − interpolation linéaire par numéro de cut, par rail. Repère profil local : longitudinal = tangente horizontale voisin avant → voisin après (moyenne des deux rails), latéral = perpendiculaire horizontale, vertical = haut de la scène ; tangente < 20 mm : écart en distance 3D seule (repère « 3D »). Écart d'un cut = plus grand |latéral| ou |vertical| des deux rails.
- **Liste « à relire »** : cuts > 15 mm ; zones = suites d'au moins 3 cuts posés successifs (écart de numéro ≤ 3) à plus de 10 mm ; cuts de score ≥ 1,2 plafonnés aux 5 % meilleurs scores de la partie.
- **Score** (poids fixés a priori, en unités du seuil 15 mm) : écart voisins / 15 + excès hors bande d'écartement / 10 + 0,5 si un rail est repêché par S1 (`confidenceStatus` = `non-calibrated-s1-selection` ou `changed`) + 0,5 · min(1,5 ; |dz| / 10) si une convention est refusée (`applied` faux avec raison) + 0,5 · max(0 ; 60 − confiance min) / 60. Bande d'écartement = p5–p95 des écartements posés de la partie (distance 3D entre les deux rails).

## Retrouver la première mesure (test 15, lot de 409 cuts posés)

| | idée 8 | outil |
|---|---:|---:|
| rails avec deux voisins | 356 | 356 (178 cuts) |
| latéral médiane / P90 / max (mm) | 1,8 / 4,4 / 12,2 | 1,8 / 4,4 / 12,2 |
| vertical médiane / P90 / max (mm) | 3,0 / 9,6 / 34,3 | 3,0 / 9,5 / 34,2 |
| cuts > 15 mm / > 20 mm | 11 / 5 | 10 / 5 |
| zone | une zone de ~80 cuts, rail gauche, vertical | 3 zones (12 cuts) étalées sur ~60 numéros de cut, 34 mm au pire |

Sans la séparation par repère de scène, deux cuts voisins d'un rechargement donnent un écart de 934 mm : d'où le `frameId` et la garde de rupture. La différence d'un cut > 15 mm (10 contre 11) vient sans doute d'une règle d'arrondi ou de bord de l'essai manuel.

## Résultats sur la partie 17 (vérité terrain Écho)

Journal de 268 cuts : 232 posés (192 avec référence humaine à l'Écho). Cuts posés que Mic a corrigés de plus de 10 mm (distance 3D, plus grand des deux rails, même définition que la jointure) : **47**. Seuls 115 des 232 cuts posés ont des voisins à ±3 (117 sans) ; 16 des 47 corrigés n'ont pas de voisins.

| Liste | cuts | part des posés | corrigés dedans | rappel |
|---|---:|---:|---:|---:|
| règle du cahier (> 15 mm ∪ zones) | 2 | 0,9 % | 1 / 47 | 2,1 % |
| score ≥ 1,2, plafond 5 % | 7 | 3,0 % | 2 / 47 | 4,3 % |
| liste complète (défaut) | 8 | 3,5 % | 3 / 47 | 6,4 % |

Courbe du score (rappel de plus de 10 mm ; hasard = part des cuts) :

| seuil | cuts | part des posés | rappel |
|---:|---:|---:|---:|
| 1,61 | 2 | 0,9 % | 0 / 47 = 0,0 % |
| 1,32 | 5 | 2,2 % | 1 / 47 = 2,1 % |
| 1,25 | 7 | 3,0 % | 2 / 47 = 4,3 % |
| 1,16 | 12 | 5,2 % | 5 / 47 = 10,6 % |
| 1,11 | 17 | 7,3 % | 7 / 47 = 14,9 % |
| 1,06 | 23 | 9,9 % | 9 / 47 = 19,1 % |
| 0,98 | 35 | 15,1 % | 14 / 47 = 29,8 % |
| 0,89 | 46 | 19,8 % | 20 / 47 = 42,6 % |
| 0,67 | 70 | 30,2 % | 28 / 47 = 59,6 % |
| 0,45 | 116 | 50,0 % | 40 / 47 = 85,1 % |

AUC du score 0,71 (voisins 0,60 ; convention 0,70 ; confiance 0,62 ; bande 0,52 ; S1 0,50, deux cuts seulement). Parmi les 192 cuts posés avec référence : 92 ont une convention refusée, dont 35 (38 %) corrigés de plus de 10 mm, contre 12 sur 100 (12 %) quand la convention est appliquée.

**La cible du cahier (≥ 60 % des corrigés dans ≤ 5 % des cuts) n'est pas atteinte** : à 5 % des cuts le rappel est de 10,6 %, soit 2,2 fois le hasard ; 60 % de rappel demande environ 30 % des cuts (score ≥ 0,67). Les corrections de Mic restent petites (maximum 20 mm, médiane 5 mm en 3D) et surtout verticales ; les voisins posés par Ariane partagent le même biais, donc la cohérence aux voisins ne les voit pas (AUC 0,60). Les voisins n'existent d'ailleurs que pour la moitié des cuts.

**Seuil proposé** : score ≥ 1,2, plafonné aux 5 % meilleurs scores, avec la règle du cahier (> 15 mm, zones) en plus. C'est le plus bas seuil qui tient dans 5 % sur la partie 17 (11 cuts à 1,17, 4,7 %). La liste est un outil de priorité (2 fois le hasard), pas un détecteur ; une liste à 30 % ne se relit plus.

## Les quatre lots 4.9 (résumé seul, réglages par défaut)

| lot | cuts posés | avec voisins | latéral méd / P90 / max (mm) | vertical méd / P90 / max (mm) | cuts > 15 / > 20 mm | zones (cuts) | cuts signalés |
|---|---:|---:|---|---|---|---|---:|
| p24 (test 15) | 409 | 178 | 1,8 / 4,4 / 12,2 | 3,0 / 9,5 / 34,2 | 10 / 5 | 3 (12) | 24 (5,9 %) |
| p24b | 311 | 125 | 1,7 / 4,9 / 15,5 | 1,2 / 8,2 / 24,3 | 4 / 1 | 1 (3) | 16 (5,1 %) |
| p17t (2 parties) | 692 | 322 | 1,7 / 4,9 / 15,5 | 1,8 / 8,4 / 28,5 | 15 / 5 | 5 (15) | 40 (5,8 %) |
| p17u | 418 | 134 | 2,0 / 5,4 / 11,0 | 1,0 / 5,9 / 15,7 | 1 / 0 | 0 | 20 (4,8 %) |

Cuts avec rail repêché par S1 : 37, 16, 35, 38 ; avec convention refusée : 120, 62, 188, 57. Le lot p17t porte une partie de 311 cuts posés à la bande d'écartement identique à celle de p24b (même partie rejouée ou reprise).

## Limites

- **Un seul Écho** (partie 17) valide le score ; les poids sont fixés a priori et le seuil 1,2 se lit sur cette courbe : sans second Écho, pas de contrôle indépendant. Les lots p24, p24b, p17t, p17u n'ont pas d'Écho exploitable ici.
- **La moitié des cuts n'a pas de voisins** (50 à 70 % selon le lot) : différés, trous du lot, bords de repère. Un cut sans voisins n'est jugé que par S1, convention, confiance et bande. Élargir la fenêtre (`--fenetre 5` ou 8) gagne 10 à 25 cuts sur la partie 17 sans changer le constat.
- Les voisins viennent des seuls cuts posés par Ariane au journal. Les voisins validés de la liste (via T) ne sont pas lus : le journal ne les porte pas.
- Le terme |graine − intersection| (idée 3) n'est pas dans le score : le journal ne consigne pas l'intersection.
- Interpolation par numéro de cut (pas de ~1 m, 95 % entre 0,95 et 1,05 m sur le lot p24) ; vertical = haut de la scène, sans l'inclinaison du profil (quelques degrés au plus). Le signe du latéral dépend du sens de numérotation.
- La « pose d'Ariane » est la pose au moment de la validation : un déplacement humain antérieur y est déjà compté. La bande d'écartement est apprise sur les écartements posés eux-mêmes (pas sur les lignes valides de la liste), donc p5 et p95 laissent toujours 10 % de cuts hors bande par construction.
- Le score d'un lot où beaucoup de conventions sont refusées monte partout (13,7 % des cuts au-dessus de 1,2 sur p24 sans plafond) : d'où le plafond de 5 %.
- Ne pas en faire une pose automatique (D-098 à D-100) : un cut juste entouré de deux faux est signalé à tort.
