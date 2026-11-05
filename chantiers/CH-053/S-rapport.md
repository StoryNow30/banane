# CH-053-S — rapport : rendement humain (cible T2) — branche `chantier/CH-053-S`

Données : `banane-data`, collections du 04/11 (lot Orbite parties 6-15 et jointures ; Écho manuel parties 10-13-14-15, union des cinq zips). Outil : `tools/file-prioritaire.cjs` (`simuler`, `file`, `echantillon`), module pur `src/file-prioritaire.js` (non branché), essais `tests/file-prioritaire.test.cjs` (22 verts). Aucune donnée réelle dans le dépôt : chiffres agrégés. Aucun réglage actif changé, aucun fichier interdit touché.

## Verdict
**×2 hors d'atteinte par l'ordre seul si un saut entre cuts non voisins coûte ce qu'il a coûté le 04/11 ; atteint (×2,0) seulement si un saut ne coûte rien.** Au saut mesuré (6 s), le meilleur ordre simulé donne **×1,8** (tête de file parcourue en balayage). Ce que la séance doit confirmer : le coût réel d'un saut quand la liste mène au cut en un geste (SUPPOSÉ ≤ 1 s, jamais mesuré).

## Mesure de départ (ÉTABLI, rejoué à l'identique)
134 références, 82 paires qualifiées, 50 informatives (37 %). 249 cuts visités (302 visites), 596 s de visite, 649 s au mur (581 + 68) : **5,0 informatifs par minute de visite, 4,6 au mur**. Le temps ne se perd pas dans les cuts informatifs (234 s pour 50) mais dans le reste : 114 cuts survolés (moins de 1,5 s au total, 92 s) et 63 verts avec référence dont 13 informatifs.

## Simulation (ÉTABLI comme calcul sur ce jeu ; PROBABLE comme prédiction)
Seuls les cuts visités ont un résultat connu : la simulation range ces 249 cuts. Les taux de classe de chaque partie sont appris SANS elle (validation croisée par partie). Rendement attendu = part informative / coût de visite de la classe.

| Classe (lisible avant la visite) | cuts | informatifs | s | par minute |
|---|---|---|---|---|
| D-contrat (écartement hors contrat, deux rails) | 8 | 7 | 29,8 | 14,1 |
| vert fort (score ≥ 2, verts à contrôler) | 10 | 5 | 21,1 | 14,2 |
| D-sanspoints (capture du lot vide) | 46 | 25 | 172 | 8,7 |
| vert moyen / faible | 22 / 68 | 2 / 1 | 36 / 88 | 3,3 / 0,7 |
| D-points (le lot avait des points) | 11 | 4 | 95,5 | 2,5 |
| vert non scoré (parties 14, 15) / posé d'Ariane | 70 / 14 | 5 / 1 | 130 / 24 | 2,3 / 2,5 |

| Ordre | saut 0 s | saut 6 s (mesuré) | saut 12 s |
|---|---|---|---|
| actuel (5,0/min) | ×1 | ×1 | ×1 |
| file complète (tous les différés + verts forts, 75 cuts, 41 inf.) | ×1,54 | ×1,12 | ×0,78 |
| tête de file par rendement (64 cuts, 37 inf. = 74 %) | ×2,0 | ×1,42 | ×0,96 |
| **tête de file en balayage (partie par partie, ordre des cuts)** | ×2,0 | **×1,80** | ×1,36 |
| borne haute (informatifs seuls) | 12,8/min | 19,3/min | — |

Saut : 21 transitions non voisines sur 301, 7,6 s de visite en moyenne contre 1,6 s pour un cut voisin (ÉTABLI) ; le surcoût de 6 s est une moyenne confondue avec la classe (PROBABLE). La file se présente donc en plages, dans l'ordre des cuts ; la classe décide de l'entrée, pas de l'ordre (option `--ordre balayage`).

## Ce qui limite le gain (à ne pas cacher)
1. **Le gain de la tête vient d'une classe qui va disparaître** : 25 des 37 informatifs sont des D-sanspoints, victimes du blocage de chargement (CH-051 § 2), que la garde allumée (D-283) fait disparaître. Sans eux, la tête (D-contrat + verts forts) rend 14/min mais ne compte que 18 cuts, moins d'une minute de travail par lot (PROBABLE). Offre du 04/11 : 364 D-sanspoints, 9 D-contrat, 12 D-points (ÉTABLI).
2. Verts scorés seulement sur les parties 10 et 13 (instantané de la liste d'ESV dans l'export) : les 70 verts de 14 et 15 sont écartés par prudence, 5 informatifs perdus. Le score sépare bien sur la partie 13 (score ≥ 2 : 4 informatifs sur 9 vus ; < 1 : 1 sur 67 ; AUC 0,88 sur 7 positifs : petit échantillon).
3. Biais de sélection : l'opérateur n'a pas visité tout le lot ; la part informative d'une classe est mesurée sur ses cuts visités.
4. « Désaccord entre voie du moteur et voie voisine » : non mesurable ici, l'ombre de voie s'est abstenue sur les 64 différés jugés (ÉTABLI). Non inclus.
5. Pertes de qualification (52 références sur 134, dont 31 corrigées de plus de 10 mm, donc 81 informatifs si toutes étaient qualifiées) : causes comptées, par cut : checkpoint non qualifié 36, points utiles insuffisants 30, couverture longitudinale 29, ROI 24 ; **« geste avant la capture » seulement 5**. Attendre ou changer l'ordre ne les récupère pas : levier de CH-053-C.

## Étiquetage (voir S-regle-etiquetage.md)
Règle « validation sans mouvement en moins de 1,5 s hors apprentissage » : 10 références retirées (5 qualifiées, 0 informative) ; 134 → 124 références, apprenables 82 → 77, **informatifs 50 inchangés**, part informative 37,3 → 40,3 %, taux apprenables 61,2 → 62,1 % (ÉTABLI). Écho allumé : partie 10, la liste d'ESV donne 319 des 337 différés « valides, traités » sans aucune référence Écho (ÉTABLI) ; sur les 19 références obtenues, 10 informatives (53 %) : si les 319 avaient été sous Écho au même rendement, ~170 informatives de plus (SUPPOSÉ).

## À confirmer en séance
Coût réel d'un saut via la liste ; part informative des D-points et des verts forts sur un lot sans blocage ; premières références des verts scorés en parties 14-15 (instantané de la liste à joindre à l'export).

## Livrables
`src/file-prioritaire.js`, `tools/file-prioritaire.cjs`, `tests/file-prioritaire.test.cjs`, `chantiers/CH-053/S-protocole-seance-echo.md`, `chantiers/CH-053/S-regle-etiquetage.md`. Aucun changement d'interface : la file est un format de liste (`part, cut, groupe, signaux, details, rang`, celui de `src/correction-liste.js`) ; son branchement dans le panneau ou l'Aurore reste à décider (livré non branché).
