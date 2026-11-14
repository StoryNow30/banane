# Fidélité du banc selon la liste (CH-116, 14/11, audit demandé par l'intégrateur)
Arbre fed03f7, livré (`BANC_LEVIERS={"ancre":null,"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true}}`, `BANC_PASSE_PLAFOND=10`, zones par défaut du banc), corpus (24 lots-parties, 4 016 cuts). Deux rejeux qui ne diffèrent QUE par la liste donnée au banc (`--liste`, lue par tout ce qui lit la liste : référence d'écartement de la GCV2, voie de liste) :
- `v18-exp` : liste exportée de la partie (dernier instantané) ;
- `v18-dep` : liste du départ reconstituée par `chantiers/CH-124/outils/liste-depart.cjs` (origin/chantier/CH-124), cuts du lot remis INVALIDES (`CH116_LISTES`).

## Résultats (ÉTABLI)
- `v18-dep` contre `v18-exp` : **4 016/4 016 cuts identiques** (état, étage, source, raison, décalages) ; 0 changement d'état ; 0 pose déplacée de plus de 0,05 mm (`deplacements-dep-contre-exp.md`).
- Tableau standard : identique, 0 changement (`juger-v18-dep-contre-v18-exp.txt`) : 566 posés jugés, 501 ≤ 10, 36 entre 10 et 50, 29 > 50, 567 différés (226 jugés), reposés 25 justes / 1 faux, bons bloqués 4.
- Fidélité au lot réel, les deux rejeux : décisions identiques 3 975/4 016 (99,0 %) ; poses à 1 mm 3 312/3 421 (96,8 %). Même chiffre que `livre-passe-fidele` (tronc), lui aussi identique cut par cut à `v18-exp` à 0,05 mm.
- Poses à 0,05 mm du lot réel : 1/3 421, pour les deux. Ce n'est pas un écart de liste : entre la pose écrite au journal du lot réel et la pose du banc il y a un plancher (3 394 poses comparées : min 0,057 mm, médiane 0,45, 90 % à 0,59 ; 3 311 à 1 mm au plus). La tolérance de 0,05 mm ne se mesure qu'entre deux rejeux, pas contre le lot réel.

## Pourquoi les deux listes donnent le même banc
Sur 06/11 p15, les 143 lignes qui diffèrent entre les deux listes sont les cuts du lot : exportée « valide, drapeau 3 » (posé par Ariane), départ corrigé « invalide, sans drapeau ». PROBABLE (d'après le résultat, code des lecteurs non relu) : les lecteurs de la liste écartent l'une et l'autre ; seule la reconstitution d'avant le correctif (« valide, sans drapeau ») les fait entrer. Mesure à l'appui : parité (a) p15 avec cette ancienne reconstitution, 7 cuts posés GCV2 qu'aucun des deux rejeux d'ici ne pose (tous différés au lot réel ; `../parite-v18/parite-a-fed03f7.md`).

## Conclusion
Pour le livré (ancre coupée), la liste exportée et la liste du départ corrigée sont équivalentes sur tout le corpus : aucun cut, aucune pose, aucun chiffre du tableau ne change ; aucun des deux rejeux n'est plus fidèle que l'autre au lot réel. Le défaut du banc (liste exportée) n'est pas changé. Pour l'ancre (qui lit la liste du départ elle-même), la question reste celle de CH-124.
