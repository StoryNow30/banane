# Relecture Natif de la partie 9 — premier lot de validation jugé (26/09)

**Relecture** : Natif 4.7.19, 25/09 14:49–15:07 UTC, 548 visites, 521 cuts
distincts (7–8550), une page ESV (`frameId` 46e5663b). Quatre vidages
automatiques, 15 segments ; le dossier d'origine s'appelle « LOT PART 8 NATIV »,
mais toutes les visites sont en partie 9. Archives : banane-data,
`collections/2026-09-25_v4.7.19_/relecture p9/` (5 × 7z, 80 Mo) ; extraction
contrôlée : `benchmarks/partie-9-2026-09-25/extraire.py` (dossier `relecture`).

**Lots jugés** : Pilote 4.7.18 (346 cuts, 0–8539) et 4.7.19 (85 cuts, sur les
différés du précédent) ; `audit/lot-4718-p9-2026-09-25.md`,
`audit/lot-4719-p9-2026-09-25.md`. Rapports : `audit/acceptance-p9-2026-09-26-4718-relecture.json`,
`audit/acceptance-p9-2026-09-26-4719-relecture.json`. Repère : translation
vérifiée cut par cut (4.7.18 : 140/151 ; 4.7.19 : 76/76).

**La partie 9 reste une partie de validation** : ce bilan mesure les règles
telles qu'elles étaient ; aucun réglage n'est calé dessus (§4).

## 1. Couverture de la relecture

L'opérateur a relu la partie de 7 à 8065, puis de 8503 à 8550 : **151 des 346
cuts du lot 4.7.18** sont revus. Sautés : 8066–8502 (160 cuts du lot, de 8254 à
8502), 5151–5192 (22) et 13 cuts épars. Lot 4.7.19 : 76 des 85 cuts revus. Les passages très brefs (touche répétée, moins
de 0,5 s) ne valent pas acceptation (D-040) : 8 cuts appliqués.

Relecture **ciblée de fait** (D-048) : C4 et C2 ne portent que sur les cuts
jugés, sans extrapolation. Pour un C4 évaluable (80 % des appliqués jugés),
il faudrait relire au moins 144 des 196 appliqués non jugés.

## 2. Le jugement : ce que le Pilote a posé

| | Lot 4.7.18 | Lot 4.7.19 |
|---|---|---|
| Appliqués (C1) | 262 / 346 (75,7 %) | 14 / 85 |
| Jugés | 66 (42 acceptés sans retouche, 24 validés) | 11 |
| **Faux** (> 10 mm, D-038) | **2** : 4903 (12,3 mm), 7523 (19,9 mm) | **0** |
| C2 latéral, médiane / p90 | 0 / 4,2 mm (max 9,1) | 0 / 3,6 mm (max 4,6) |
| C2 vertical, médiane / p90 | 0 / 7,6 mm (max 19,9) | 0 / 6,6 mm (max 8,1) |
| C3 | 26 refusées, 0 appliquée hors contrat | 18 refusées, 0 |

Décision sur le lot (consignée par le Pilote) : 3 faux sur 69 jugés — les deux mêmes et 4892
(10,3 mm ; le Pilote l'a posé à 9,8 mm). **Les trois faux sont des premiers
passages du moteur, faux en vertical, rail trop bas.** Lot 4.7.19 : 9 des 12
cuts de passage à niveau jugés (8472–8474 non relus), 0 faux, pire 8,1 mm
(3970) : le lecteur d'ornière et la voie qu'il amorce tiennent.

### Le biais vertical

Sur les 27 rails appliqués que l'opérateur a retouchés, **24 ont été relevés**
(médiane : rail 4,9 mm trop bas). 16 de ces 27 rails sont dans deux passages à
niveau (3968–3977, 4890–4903), tous relevés ; ailleurs, 8 sur 11.

Sur les parties de réglage relues (31, 34, 2, 3), les retouches verticales
sont équilibrées (5/5, 8/6, 5/5, 3/1, 0/4, 4/2 relevés/abaissés), et les faux
des passages à niveau de la partie 2 (772, 773) sont latéraux. Le biais est
donc propre à la partie 9, et surtout à ses passages à niveau : **hypothèse**
(les points de chaussée tirent le dessus du rail vers le bas), pas un calage.

## 3. Les différés : ce que la relecture dit de chaque levier

Rejeu du lot 4.7.18 aux règles 4.7.20 (« appliquer », appuis = cuts posés),
jugé par la relecture, sous plusieurs hypothèses (banane-data,
`travail/2026-09-26_relecture-p9/scenarios.cjs`). « Décidés » : positions que
la décision sur le lot commanderait ; jugés contre la dernière visite validée.

| Hypothèse | Décidés / 346 | Faux / jugés | Faux ajoutés | Décisions de S0 retirées |
|---|---|---|---|---|
| **S0** règles 4.7.20, un passage, même page | 278 (80,3 %) | 3 / 69 | — | — |
| **S1** + voisins validés, garde livrée (D-054) | 289 (83,5 %) | 4 / 80 | 7889 | 6 : 3971, 4890–4891, 4900–4902 |
| **S1b** + voisins validés en dernier recours | 295 (85,3 %) | 4 / 84 | 7889 | aucune |
| **S2** + vue corrigée (décentrage, D-049) | 297 (85,8 %) | 4 / 87 | 8516 ¹ | aucune |
| S3 = S1 + S2 | 308 (89,0 %) | 5 / 98 | 7889, 8516 ¹ | les 6 de S1 |
| **S3b** = S1b + S2 | **314 (90,8 %)** | 5 / 102 | 7889, 8516 ¹ | aucune |

Les trois faux de S0 (4892, 4903, 7523, premiers passages, verticaux) sont
dans toutes les lignes. ¹ 8516 est un défaut de la relecture (§3.1) : faux
réels de S3b, 4 sur 102. En S0, S1 et S1b, 8504–8506 sont décidés mais hors
de la vue : posés, 3 de moins (S0 : 275, ce que les deux lots ont posé sur le
terrain).

### 3.1 La fin de partie hors de la vue (KI-051, D-043, D-049)

Avec une vue corrigée, la voie ne s'arrête plus à 8506 : **8507–8526, 19 cuts
décidés, 18 jugés, 17 justes (0,8 à 6,4 mm)**. Le 18e, 8516, est compté faux à 158 mm,
mais c'est la relecture qui est en défaut : l'opérateur n'y a corrigé que le
rail gauche ; le droit est resté sur la pose de départ d'ESV, à 155 mm de ses
voisins 8515 et 8517, corrigés, eux. Au-delà de 8526, la voie perd ses deux
appuis (8525 sans minimum qualifié) et le reste de la fin est différé.

C'est le levier le plus sûr : **+19 cuts (5,5 points de couverture), aucun faux
réel**, sur des positions que la voie trouve déjà et qu'il ne manque que de
cliquer. Troisième cas mesuré après les parties 33 et 2 (cahier 4.9, §1.2), et
le premier jugé par une relecture sur toute sa longueur.

### 3.2 Les voisins validés (D-054)

La relecture donne la pose, à l'ouverture, de 360 cuts validés avant le lot
(hors des deux lots, dans 0–8541). Utilisés comme appuis, garde telle que
livrée (±5 cuts, 8 mm, 3 voisins cohérents) : **+17 décidés**, 14 justes et
**1 faux (7889, 20,2 mm)** sur 15 jugés ; mais **6 cuts perdus** au passage à
niveau 4890–4902 et à 3971, que le moteur ou le lecteur posaient juste (0,3 à
9,2 mm).

L'étude prend aussi pour voisins 8540–8549, jamais validés (pose d'ESV à 18–20
cm) : aucun n'entre dans une décision (8537–8539 restent différés).

Pourquoi les pertes : **un voisin validé n'est pas un voisin juste**. La relecture a
corrigé 62 de ces 360 cuts validés, 18 de plus de 10 mm et 5 de plus de 30 mm.
Ils sont groupés : 3027–3039, 4895–4904 (rail gauche à 31–34 mm, quatre cuts
cohérents entre eux), 7487–7488. La garde écarte un voisin faux et isolé
(partie 19, 9219) ; elle ne voit pas un groupe faux et cohérent.

« Dernier recours » (S1b) : les voisins ne servent qu'à un cut qui serait
sinon différé ; ils ne peuvent plus retirer une décision prise sans eux.
Résultat : **295 (85,3 %), 4 faux sur 84, aucune décision retirée** ; les 17
gains restent, 7889 compris. 7889 : rail gauche à 20,2 mm en latéral, droit à
10,3 mm en vertical, dans une zone où l'opérateur a aussi retouché 7890 et le
voisin validé 7892 (rail droit) ; la pose de départ d'ESV y était à 4 et 10 cm.

Réserve : cette variante est née de la lecture de la partie 9. L'adopter
consomme la partie 9 pour cette règle ; elle doit être confirmée sur un lot de
réglage relu et sur la prochaine partie neuve.

### 3.3 Ce qui reste

En S3b, 32 cuts restent différés :

- **14 en fin de partie** (8525, 8527–8539) : la voie perd ses appuis ;
- **5 dans 5182–5186**, non relus ;
- **13 isolés** : sans appui (952, 6077, 6197, 6925), sans minimum qualifié
  près de la prédiction (2358, 3067, 3685, 7279, 7459, 7864, 7865), chaussée
  du passage à niveau (2972), garde d'écartement (7867). La 4.7.19 en a posé
  deux (2358, 2972) en repassant sur une nouvelle capture : une seconde
  passe en reprend une partie.

## 4. Comment le cerveau apprend de cette relecture

Une relecture fournit une étiquette par cut : la pose validée par l'opérateur.
Le cerveau (moteur, calage de convention, décision sur le lot) ne lit jamais
celle du cut qu'il décide ; il apprend par trois voies, chacune avec sa garde :

1. **Règles et curseurs** (décision sur le lot) : le banc
   (`tools/choice-anchor-study.cjs`) rejoue chaque règle sur les parties de
   réglage ; une règle ne change que si elle gagne sans faux (C5).
2. **Calage** (`src/placement-convention.js`, `tools/convention-fit.cjs`) :
   deux constantes ajustées sur les rails validés, validées en retenant une
   session à la fois. Le biais vertical de la partie 9 (§2) en est le
   candidat, s'il se confirme ailleurs.
3. **Voisins** (D-054) : en ligne, dans la page, les poses validées autour du
   cut deviennent des appuis sous garde. La partie 9 montre qu'il faut aussi
   se garder des groupes faux (§3.2).

**Proposition : rotation réglage / validation.** Chaque partie neuve est
d'abord une partie de validation : elle mesure la version telle qu'elle est,
et ce résultat est consigné AVANT tout réglage. Ensuite seulement elle entre
au banc de réglage, et la partie neuve suivante devient la validation. Le
cerveau apprend de chaque relecture sans jamais noter sa copie avec ses
propres réponses. Pour la partie 9 : ce document consigne la mesure de la
4.7.20 ; elle peut passer au réglage si la direction le décide.

**Qualité des étiquettes** (INDEX de banane-data : « une correction humaine
Natif doit être qualifiée avant tout usage comme vérité d'entraînement »).
Cette relecture en montre trois défauts, que le banc doit filtrer :

- un rail validé sans être corrigé (8516, rail droit à 155 mm) ;
- des passages de moins de 0,5 s, qui ne jugent rien ;
- des plages sautées (8066–8503), qui laissent C4 sans dénominateur.

## 5. Suites

- **Opérateur** : relire 8066–8503 et 5151–5192 (une visite d'au moins 0,5 s
  par cut, les deux rails vérifiés) ; revoir le rail droit de 8516 ; dire qui
  a validé les cuts hors lot de la partie 9 avant le 25/09 (opérateur, autre
  équipe, ESV).
- **Direction** : D-049 (décentrer la caméra) avancé en 4.8 ? ; D-054 en
  « dernier recours » ; rotation réglage / validation, et statut de la
  partie 9.
- **Banc** : le biais vertical aux passages à niveau, à chercher sur les
  parties de réglage ; pas de calage sur la partie 9.
