# CH-079 — Rapport (D-308) : cuts validés faux, garde de voie et serrage en ombre

**Données :** lots et Écho du 04 au 08/11 (jointure `tools/jointure-echo-orbite.cjs`), 4 413 cuts posés lus aux journaux, dont 312 jugés par l'Écho. Rien de ces données n'est dans ce dépôt.

## Constat refait (ÉTABLI)
Identique au ticket. Mauvaise voie : cuts 220, 360, 361 à 174, 156, 156 mm de l'opérateur ; écartement d'Ariane 1 458 à 1 463 mm, opérateur 1 432 à 1 437 mm. Imprécision : 142, 143, 221, 228, 231, 232 à 9,7 ; 5,1 ; 9,2 ; 11,1 ; 17,1 ; 11,9 mm. Précision utile : 220, 360, 361 sont des poses du moteur (premier passage, choix) ; les six autres sont **différés par le lot puis posés par la décision L1-e (zone ADV)**.

## Garde de voie (`src/garde-voie-ombre.js`)
- Réglage : voisins = lignes valides à ±20 cuts, **quels que soient les drapeaux** (dans un lot, les voisins sont ses propres cuts validés) ; au moins 5 voisins, sinon aucune pause ; seuil **15 mm** (écartement posé contre médiane des voisins).
- Pourquoi 15 : c'est le plus grand seuil qui attrape les trois (écart au voisinage 15,5 ; 22,0 ; 23,5 mm). 18 mm manque le 220 ; 12 mm double les pauses (89).
- **Pauses qu'elle aurait faites (ÉTABLI) : 46 sur 4 413 cuts posés (1,0 %).** Sur les 312 jugés : 3 justes (220, 360, 361) ; 2 autres justes en fait (écartement 1 428, fautes de 18,8 et 20,7 mm) ; **3 fausses** (fautes 0 ; 4,8 ; 8,8 mm, soit 3 sur 283 cuts jugés bons, 1,1 %) ; 38 non jugées (inconnu).
- Limites : marge de 220 mince (15,45 contre 15 mm), **trois cas positifs seulement** (PROBABLE fragile). Elle n'attrape **pas** les 7 mauvaises voies du 06/11 (D-292) : leur écartement est normal, c'est la paire entière qui est décalée. Un critère absolu (écartement > 1 455 mm : 31 pauses, 3/3, 3 fausses) donne le même résultat mais est calé sur ces trois cas.

## Serrage (`src/serrage-lot-ombre.js`)
- Résultat négatif en général (ÉTABLI) : sur 302 cuts jugés, médiane opérateur − Ariane de l'écartement **0,00 mm** ; desserrer vers la référence : fautes > 10 mm 19 → 17, médiane 3,27 → 3,17 mm.
- Le serrage vient de la décision L1-e : sa correction vise la référence de la liste (1 437 mm) alors que l'opérateur pose 1 441 à 1 453 mm en ADV. Le module ne s'applique donc qu'aux poses L1-e (le branchement l'impose).
- Sur les 186 jugés posés par L1 : fautes > 10 mm **15 → 11**, médiane 3,35 → 3,02 mm, 15 cuts mieux, 7 pires. Par zone : abords (140) 4 → 2 fautes ; **ADV (42) 10 → 9 fautes mais médiane 3,83 → 5,10 mm (pire)**. Sur les autres cuts du lot (116) : 4 → 6 fautes (pire). Sur les six cas : 11,1 ; 17,1 ; 11,9 → 5,6 ; 13,9 ; 8,6 mm, les six s'améliorent.
- Un desserrage constant (+2 à +8 mm) ou une cible constante (1 438 à 1 443 mm) est pire.

## Livrables
`src/garde-voie-ombre.js`, `src/serrage-lot-ombre.js` (purs, sans effet) ; `tests/ch079-garde-serrage.test.cjs` (12 essais synthétiques) ; `tests/ch079-cas-controle.test.cjs` + `tools/ch079-extraire-corpus.cjs` ; corpus de 9 cuts dans `banane-data` (`collections/2026-11-08_v5_vision-echo/ch079-cas-controle/`, commit ace2914) ; `chantiers/CH-079/branchement.patch` (service worker, réglages, essai `ch079-ombre-sw`, filtres d'événements des essais). Le rejeu est fidèle à 0,2 mm pour 220, 360, 361 ; les six cuts L1-e ne sont pas rejouables en entier (état du lot absent d'un petit corpus) : leur pose enregistrée sert de témoin.

## Preuves
Garde de pose : verte avec les modules déclarés ; diff des fichiers de décision (`engine`, `adapter-page`, `geometry*`, `gcv2*`, `lot-decision`, `manifest.json`) vide. Parité de la relecture avec le patch sur une copie : commandes, appels, états identiques ; seul diffère le type d'événement nouveau `garde-voie-ombre` (à ajouter à ses neutralisations). **Non rejoués (SUPPOSÉ) :** `tools/garde-gcv2.cjs` et `tools/parite-l1se-sw.cjs` exigent des lots archivés et un rejeu du banc hors dépôt, absents de cette session ; les décisions sont inchangées par construction (aucun fichier de décision touché ; essai « mêmes décisions octet pour octet » avec et sans ombre, y compris sur une pose L1-e).

## Ce qui reste SUPPOSÉ
Les 312 cuts jugés sont choisis par l'opérateur (biais) ; en mesure, les voisins sont la liste prise après le lot, limitée aux cuts précédents (en direct : mémoire du lot, même contenu) ; trois positifs pour la garde.

## Recommandation (à l'opérateur)
- **Garde : oui en ombre** (déjà le cas dans le patch). Passer à la pause demande un nouvel accord ; au vu des chiffres (≈ 1 pause pour 100 cuts, trois vraies attrapées, une fausse pour une centaine de cuts justes jugés), c'est raisonnable après **un ou deux lots de plus jugés par l'Écho** pour confirmer la marge à 15 mm.
- **Serrage : ne pas écrire.** Gain modeste sur L1 (15 → 11 fautes), nul ou négatif ailleurs et en ADV ; à garder en ombre, appelé sur les poses L1-e seulement.
