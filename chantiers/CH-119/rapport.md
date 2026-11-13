# CH-119 : choix de voie global sur la zone d'aiguillage (rapport, D-352)

Branche `chantier/CH-119`. Aucun fichier protégé touché sur la branche : `voie-globale.patch` (`src/gcv2-l1.js`, `tools/banc-differes.cjs`, essais) et `sw-voie-globale.patch` (`background.js`, essai VM), clé unique `voieGlobale` à `null`. Outils : `outils/` ; sorties (numéros et mm) : `sorties/`. Juge de CH-113, banc de CH-116. Cible écrite avant tout rejeu : `cible.md` (f5809b5).

## 1. Borne du levier (ÉTABLI)
- Rejeu livré refait sur mes captures : identique au banc-livre de CH-116 (29 posés > 50 mm, toutes en ADV). Les 29 sont la voie entière décalée de 125 à 315 mm, écartement normal.
- Bonne paire dans le pool : hypothèses H0-H6 seules 5/29 ; pool effectif (H + recherche recentrée, outil de CH-120 sur mes captures) 14/30. Sur les 16 restantes après le levier, 5 seulement l'ont (16/3959, 3968 ; 23/4675, 5132, 5210) : **avec le pool livré, ≤ 10 n'est pas atteignable par le choix seul** (terrain de CH-120).
- Loi des poses finales le long de la voie (`sorties/residus.md`), critère « deux rails » (min des rails), références à 1-2 cuts : résidu d'ordre 2 ≤ 22 / 44 / 60 / 83 mm à 1 / 2 / 3 / 4 cuts ; poses fausses ≥ 99 / 108 / 99 / 89 mm. Ordre 1 dans le repère du cut : vérité ≤ 41 / 46 / 55 mm, fausses ≥ 107 / 150 / 268. L'information est locale (≤ 3-4 cuts) ; un seul rail décalé de 30 à 40 mm arrive chez l'opérateur (défaut de rail), jamais les deux.
- **Aucune ancre indépendante de la voie** : la pose de départ d'ESV est sur la voie fausse dans les 29 cas (la pose fausse en est proche) ; la liste d'ESV exportée est l'instantané de fin de lot (ses lignes portent les poses d'Ariane, drapeau 3). La continuité dit « ne pas changer de voie », pas laquelle : même avec le futur de la zone, le prototype n'arrête que 12/29 (deux voies continues, autant de poses sur chacune) ; 5 racines n'ont aucune pose validée à 8 cuts avant (7260, 7423, 3694, 4672, 5132).

## 2. Le levier
Viterbi d'ordre 2 sur les poses validées du lot dans les 8 cuts précédents (chaîne et transport de la GCV2), lues dans le repère du cut ; transitions permises si les deux rails restent dans les tolérances mesurées (§ 1) ; la pose (chaîne, L1-s ou GCV2) est refusée si le meilleur chemin du passé proche, qui la saute, dépasse de plus de θ le meilleur chemin qui finit sur elle. Pose de la chaîne refusée : la GCV2 décide ; pose de la GCV2 refusée : différé. Rejetés au prototype : pools des cuts passés comme observations (biaisés vers la voie de départ d'ESV : 4/29 au lieu de 8/29) et remplacement par la paire du pool qui prolonge le chemin (sur les différés : 10 justes pour 10 mauvaises voies).

## 3. Jugement (banc de CH-116, validation croisée un lot dehors, `sorties/croise.md`)
Grille de 4 réglages figée avant (`grille.json`) ; coût du banc. Somme des 6 lots tenus à l'écart, contre le livré sur les mêmes lots :

| | > 50 mm | 10–50 | ≤ 10 | bons bloqués | différés |
|---|---|---|---|---|---|
| livré | 29 | 35 | 287 | 4 | 578 |
| voie globale (réglage choisi sur les 5 autres) | **16** | 30 | 302 | 11 | 589 |

- 0 nouvelle mauvaise voie ; aucun juste passé au-delà de 10 mm ; 7 bons bloqués nouveaux (23/5137-5139 après la racine fausse 5132-5133 ; 16/3970, 3971, 4517, 4518) pour 13 mauvaises voies retirées (critère ≤ 2 par gain tenu). 7 mauvaises voies sont reposées justes par la GCV2 après le refus (16/9266, 9267 ; 6/220, 360, 361 ; 23/3748, 3749), 6 différées.
- Examen 0511 : identique au livré. **Cible 1 (≤ 10) non atteinte ; cibles 2 à 5 tenues.**
- Réglage figé : D (`reglage-fige.json` : G 7, θ −0,35). Patch éteint = livré : 4 016 / 4 016 cuts identiques (ÉTABLI).
- Garde d'octobre : éteint, retour 0. Figé : GARDE_FIGE. Parité banc / SW (passe comprise) : PARITE.
- Tous les lots sont vus (D-347) : gain PROBABLE jusqu'à l'Écho ; examen vierge 12/11 p3-p4 non lu, à juger par CH-116.

## 4. Ce qui reste et ce que je propose
- 11 des 16 restantes : bonne paire absente du pool → générateurs de CH-120 à l'assemblage ; 5 racines sans aucune pose proche, hors de portée de toute continuité.
- 23/3747 et 16/4508 : après le refus, la GCV2 rechoisit H1+H2 sur la mauvaise voie (sa garde de voie absolue la refuse) alors que la bonne paire est dans le pool effectif. Variante à figer et juger plus tard : après un refus de la voie globale, choisir dans le pool effectif la paire qui prolonge le chemin du passé (seulement sur ces cuts refusés).
- Coût connu : une racine fausse non arrêtée fait refuser les poses justes qui la suivent (23/5137-5139).
