# CH-049-A (suite) — le repli « stabilité » à 800 ms quand le compteur d'ESV reste bloqué

Données : journal Orbite, collection `2026-11-04_v5_lot-orbite-parties-6-15-et-echo`, volume 02 sur 19 (131 377 événements ; 9 865 lectures `capture-read`). Règle lue dans `src/adapter-page.js` (`attendreChargement`) : fin au « signal » si ≥ 3 images, `numNodesLoading` = 0 sur deux images de suite, mêmes nœuds, même vue ; sinon repli après 800 ms sans changement de la signature des nœuds.

## Mesuré (ÉTABLI, volume 02 seul : 6 parties de départ sur 10, pas les 19 volumes)
- 4 538 lectures finissent au repli ; 3 515 par « chargements » (compteur ≠ 0), 1 023 « hors-signal » (relectures et références, qui attendent toujours). Le chiffre 3 515 est celui de CH-049-E.
- Sur les 3 515 : le compteur est ≠ 0 pendant toute l'attente (3 515/3 515, bloqué à 1 pour 2 994, à 2 pour 506), la **vue** ne change jamais (3 515/3 515). Les **nœuds** ne changent jamais pendant l'attente pour **2 613 (74 %)** ; ils changent au moins une fois pour 902 (26 %) : 445 une fois, 209 deux, 248 trois ou plus.
- Pages concernées plus âgées que celles lues au signal (âge médian 1 599 s contre 668 s) : cohérent avec D-109 (le signal s'éteint avec l'âge de la page).
- Lectures au signal : 4 images en médiane (≈ 65 ms).
- Fréquence d'images estimée 62 par seconde (50 images pour 800 ms).

## Ce que ça donne pour une règle de remplacement
Règle essayée sur les chiffres : « nœuds et vue inchangés pendant Q ms, compteur bloqué à la même valeur » au lieu de 800 ms.
- Pour les 74 % sans aucun changement, la règle rend **exactement les mêmes nœuds** que le repli, quel que soit Q (ÉTABLI : rien ne change pendant les 800 ms). Gain par lecture ≈ 800 − Q : 600 ms à Q = 200, 300 ms à Q = 500. Sur le volume, 2 613 lectures : ≈ 1 570 s à Q = 200, ≈ 780 s à Q = 500, contre 13 515 s de temps de page cumulé sur les lectures (≈ 12 % et ≈ 6 %). Ce temps de page inclut autre chose que l'attente.
- Pour les 26 % où les nœuds changent, un Q court **rate** le changement : pour les 445 lectures à un seul changement (seul cas évaluable), le changement arrive après Q dans 435 cas à Q = 200, 386 à Q = 300, 50 à Q = 500. Les 457 lectures à plusieurs changements ne s'évaluent pas avec ces relevés (on n'a pas l'instant de chaque changement).
- **Aucun signal plus fiable n'existe dans ces relevés** : rien (nœuds, vue, compteur, niveau d'octree `niv`, points `pts`/budget) ne distingue à l'avance un compteur bloqué sans nouveau nœud d'un compteur bloqué avec nœud tardif. Q = 500 serait sans perte pour 89 % des cas à un changement ; la perte pour les autres est SUPPOSÉE et non mesurée.

## Conclusion et risque
- **Pas de patch livré** : la mesure ne prouve pas l'innocuité (457 lectures non évaluables, effet sur la décision non rejoué). Un Q court dégraderait la lecture dans environ un quart des lectures à compteur bloqué.
- Piste sûre à instruire : un patch **de diagnostic seul** dans `attendreChargement` (désactivé de toute décision) qui consigne `dernierChangementMs` (instant, depuis le début de l'attente, du dernier changement de signature des nœuds) et le nombre de changements. Le prochain lot donnerait la distribution exacte et trancherait Q ; il demande un essai maquette (`tests/esv-maquette`), que je n'ai pas écrit. Risque d'un tel patch : nul sur la lecture (aucune attente ni boucle ajoutée).
- Gain plausible si Q = 500 retenu après cette mesure : ≈ 300 ms par lecture à compteur bloqué sur 74 % de ces lectures. SUPPOSÉ tant que le diagnostic n'a pas tourné.
