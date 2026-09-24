# Super cerveau — ce qui bloque encore, et les appuis validés

**24 septembre 2026.** Étude hors ligne, sans changement de l'extension. Suite de
l'amendement n°9 (décider sur le lot) : pourquoi la décision sur le lot laisse
encore des cuts différés, et quel levier les reprend.

## 1. Sur le banc Natif : le premier blocage est l'absence d'appui

`tools/deferred-diagnosis.cjs`, cinq sessions (parties 22, 20 courte, 19
relecture, 24, 20 longue), un seul passage dans l'ordre des visites, appuis =
cuts retenus par la décision elle-même, comme `observeLot` :

| | Cuts |
|---|---|
| Cuts distincts | 722 |
| Appliqués | 385 |
| Sans entrée (capture Natif absente avant le premier geste) | 116 |
| **Différés** | **221** |

Rails ou cuts bloquants, par cause (un cut peut compter deux rails) :

| Cause | Nombre |
|---|---|
| **Aucun appui à ±3 cuts** | **88** — en deux passages : 65 auraient un appui à ≤ 3 cuts, 13 à 4–5, 6 à 6–10, 4 au-delà |
| Repère impossible, et à la vraie position les points n'arrivent qu'après le premier geste | 43 |
| Repère impossible, nuage pauvre même plus tard | 12 |
| Repère impossible, sans référence humaine | 14 |
| Prédiction juste, mais aucun minimum du moteur à 5 mm de la vérité (minima à 5–13 mm, peu de points) | 22 |
| Prédiction juste, bon minimum sous le seuil de points (dessus < 15 ou flanc < 3) | 11 |
| Prédiction décalée de plus de 15 mm (dont 6 où le moteur avait la bonne position) | 29 |
| Pas de minimum qualifié, sans référence humaine | 33 |

Les « repère impossible » viennent surtout du banc : il capture avant le
premier geste de l'opérateur, alors que le Pilote recentre la vue sur chaque
rail et attend la stabilité du détail LiDAR (`src/lod-signature.js`). Sur le
lot Pilote de la partie 19, un seul cut manque de points.

## 2. Sur le vrai lot Pilote : 8 des 12 restes sont sans appui

Lot Pilote 4.7.6 de la partie 19 (28 cuts distincts, D-038), décision sur le
lot rejouée par `tools/acceptance-report.cjs --rejeu-lot` : 16 appliqués, 0
faux sur 2 jugés. Des 12 cuts laissés, **8 le sont faute d'appui**.

La raison est structurelle : le Pilote enchaîne les cuts **non validés**
d'ESV (`loadNextInvalidCut`), qui saute tous les autres : 30 cuts sur les
389 numéros de la zone 9019–9407 sont passés par le lot, 92 % ne l'ont pas été.
Le Pilote ne s'appuie que sur ses propres cuts appliqués, clairsemés, et
jamais sur les cuts validés qui les entourent.

## 3. Les voisins déjà validés comme appuis

`tools/validated-anchors-study.cjs` rejoue la même décision en ajoutant comme
appuis les cuts voisins hors du lot, avec leur pose lue dans la relecture
(état ESV) et ramenée dans le repère du Pilote :

| Appuis | Décision sur le lot | Faux / jugés | Cuts gagnés (erreur du pire rail) |
|---|---|---|---|
| Cuts du lot seuls | 16 / 28 (57 %) | 0 / 2 | 9044 (2,8 mm), 9052 |
| + tous les voisins hors du lot | 19 / 28 (68 %) | 0 / 4 | + 9050, 9242 (1,1), 9316 (4,3) |
| **+ voisins non retouchés à la relecture** | **22 / 28 (79 %)** | **0 / 7** | + 9218 (3,4), 9220 (3,1), 9315 (0,9) |

```sh
node tools/validated-anchors-study.cjs --lot "DOSSIER_P19=pilote-p19-4.7.6" [--stables]
```
Relevés : `audit/validated-anchors-p19-2026-09-24.json`,
`audit/validated-anchors-p19-stables-2026-09-24.json`.

Restent : 9049 et 9317 (paires hors contrat, dont 9317 à 1 470,8 mm : le
contrat ne bouge pas), 9048 et 9405 (pas de minimum qualifié), 9406 (aucun
point), 9407 (lot arrêté dessus).

## 4. Limites — à lire avant tout chiffre

- **« Hors du lot » ne veut pas dire « validé ».** Le cut 9219, sauté par le
  Pilote, avait une pose fausse de 40 à 55 mm, corrigée à la relecture (sans
  doute un SKIP antérieur). Pris pour appui, il fausse la prédiction de ses
  voisins : c'est le risque KI-047. Le filtre « non retouchés à la
  relecture » lit l'avenir ; sur le terrain, il faudra lire le **statut réel**
  de chaque voisin dans ESV.
- Un seul lot Pilote, 7 cuts jugés : c'est une direction, pas une preuve.
  Les collectes F1 diront si elle tient.
- La relecture de la partie 19 a jugé peu de cuts appliqués (validation
  manquante) ; F1 corrige ce point.

## 5. Ce qu'il faut pour en faire un levier du Pilote

1. **Lire le statut et les rails des voisins dans ESV** : par un indicateur de
   la page, par les données de la carte, ou par une visite en lecture seule du
   voisin (S puis Z, chantier 1). C'est l'objet de l'inspection d'ESV.
2. **Une garde sur les appuis validés** : deux appuis qui se contredisent (par
   exemple de part et d'autre du cut) écartent la prédiction ; à régler hors
   ligne sans créer de faux.
3. **Les appuis validés dans `src/lot-decision.js`**, en observation d'abord
   (comme la 4.7.8), avec leur provenance consignée.
