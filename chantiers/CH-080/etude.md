# CH-080 — Étude : préchauffer la coupe suivante quand elle est éloignée (D-309)

Mesures : script sur le journal du lot « Vision 5 » du 09/11 (`banane-data`, collection `2026-11-09_v5_vision5-essai-prechauffage`), instantané de la liste de la partie (9 994 lignes, 9 985 valides en fin de lot). Rien de ces données n'est versé ici.

## (a) Pourquoi `sans-suivante` 990 fois — ÉTABLI
Le préchauffage demande à l'observateur une **fenêtre de ±10 lignes** (`voisinsB1`, `fenetre:10`, plafond `voisinsMax:10`) et y prend la première ligne non validée après le cut courant.
- **932 / 990 pendant la relecture** : elle relit des cuts déjà valides ; la suivante qu'elle visite est choisie par le service worker (`sel.cuts[ci+1]`), pas par ESV, et la fenêtre ne contient aucune ligne non valide. Les 626 « voisines » sont là (la relecture « corriger » va au cut d'avant puis fait un pas).
- **58 pendant le lot** : 54 sauts de plus de 10 coupes (31 de 11 à 50, 10 de 51 à 200, 13 au-delà), hors de la fenêtre ; 3 retours en arrière (passe des différés, reprise). Aucune voisine du lot en `sans-suivante`.
- Les 717 `aucun-noeud` : sauts de 1 à 10 coupes, prédiction faite, tous les nœuds connus de la zone déjà chargés (447 dans le lot : 404 voisines, 43 de 2 à 10).

## (b) Où Ariane connaît la coupe suivante, et sa position
- **Lot** : ESV choisit (« cut invalide suivant », après validation ou différé). Règle : première ligne non valide après le cut courant dans la liste d'ESV. Vérifiée sur 507 / 513 passages du lot (statuts reconstitués : instantané de fin moins les validations du lot) ; les 6 écarts sont le départ, une reprise après rechargement et la passe des différés. PROBABLE (statuts reconstitués).
- **Relecture et passe des différés** : le service worker tient la liste exacte (`relecturePasse` : `sel.cuts`, passe : liste à écrire). ÉTABLI à la lecture du code.
- **Position** : la table B1 de l'observateur (mémoire de la page) a les 9 994 lignes et leurs six bords monde, tenue à jour à chaque validation. Seule la fenêtre de réponse la bride.

## (c) Comment la faire parvenir à la page
- **Lot : rien ne part du service worker.** Les commandes du lot doivent rester identiques à l'octet (`tests/choix-lot-clic-sw.test.cjs`). La page demande à l'observateur `suivante` (balayage de la table, une seule ligne rendue : indice, statut, bords). Source `liste-esv`.
- **Relecture et passe** : le service worker ajoute `prechauffage:{part, cut, source, op}` (op = identifiant d'opération du service worker) à l'argument de SA capture (pas celle du lot) ; le patch de l'adaptateur le passe à `apresCapture` ; la page vérifie la partie, demande à l'observateur la ligne `cible` (une ligne rendue) et rejette tout indice hors table. Sources `relecture`, `passe-differes`.
- **Dernier recours** : fenêtre B1 (`b1-fenetre`) si la page n'a ni l'une ni l'autre.
- L'opération du préchauffage garde son identité {partie, coupe, prédite, op} et son annulation au début de chaque capture (règle 4.2). Événement `prechauffage` enrichi de `saut` (entier) et `source` (liste fermée). Patch de l'adaptateur : `chantiers/CH-080/adapter-page.patch` (transmet `expected.prechauffage` et l'option de la requête à l'observateur).

## (d) À partir de quel saut — seuil proposé `sautMin: 11`
Durée jusqu'à la capture reçue, cuts non différés (phase-timing-pli), et nœuds de points chargés par Potree par visite (médianes) :

| Saut | Cuts | Capture | Nœuds chargés |
|---|---|---|---|
| 1 | 258 | 0,62 s | 1 |
| 2 à 10 | 32 | 1,2 à 2,5 s | 4 |
| 11 à 50 | 18 | 2,6 à 3,2 s | 7,5 |
| 51 à 200 | 6 | 4,4 s | 10,5 |
| > 200 | 10 | 5,3 s | 15 |

En dessous de 11, le préchauffage de CH-077 a trouvé **0 nœud à demander dans 447 cas sur 447** : rien à gagner avec la sélection actuelle. À 11 et au-delà, la zone de la coupe n'est pas chargée. Seuil 11 (PROBABLE). Les sauts de 2 à 10 restent lents (4 nœuds chargés par Potree que la sélection au cube de 0,75 m ne voit pas) : hors de ce chantier, noté au rapport.

## Coût estimé (collection du 09/11)
Environ 68 sauts ≥ 11 dans le lot et 46 dans la relecture, soit ~114 préchauffages. À 6 nœuds (banc, rayon 0,75) : ~700 requêtes, à comparer aux 2 581 nœuds chargés par Potree pendant le lot ; 0 en plus si Potree les redemande, +27 % au pire. Plafond dur : 114 × 24 nœuds (8 Mo chacun au plus). SUPPOSÉ jusqu'au terrain.
