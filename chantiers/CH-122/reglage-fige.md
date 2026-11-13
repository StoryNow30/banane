# CH-122 : réglages figés avant le jugement (13/11)

Poussés avant tout rejeu de jugement. Un réglage retouché après le jugement serait un nouveau réglage.

- **Patch** : `puce.patch` (`src/gcv2-l1.js` seul ; clés `puce:null`, `puceJeu:false` dans `LEVIERS_V4` ; coupées = code livré). Logique en fin de `deciderL1e` : candidats (paires d'hypothèses du nuage à un écartement plausible, au plus 40 par probabilité, paire de la test 13, sa correction, paire retenue par les règles livrées, 10 premières paires de la recherche recentrée), 45 traits (`PUCE_TRAITS`), probabilité d'être juste à 10 mm par le modèle figé, meilleur candidat validé si la probabilité atteint le seuil (et s'il est à δ au moins du départ : 8 mm en ADV, 2 en abords, 3 en PN), sinon rien.
- **Jeu d'apprentissage** : rejeu « jeu-livre » (code livré + `puceJeu`, décisions identiques au livré : 561 / 496 / 36 / 29 / 591, ÉTABLI), 847 cuts passés à la GCV2, 435 jugés, 12 821 candidats ; étiquette = candidat à 10 mm au plus de la pose finale (pire rail, 3D).
- **Modèle** : régression logistique L2 (`outils/apprendre.cjs`, `outils/puce-lib.cjs`), chaque cut pesant autant. Par pli, choisis par validation croisée INTERNE (un lot dehors parmi les lots d'apprentissage) : variante (distances en log ou non ; gardes de voie livrées sur les candidats ou non), λ (0,3 à 30) et seuil.
- **Validation croisée** : un modèle par lot réglable, appris sur les 5 autres (`modeles/A/puce-figeA-<lot>.json`, idem B) ; examen 0511 : appris sur les 6 réglables.
- **Deux critères de seuil, figés tous deux, jugés tous deux** (aucun choix après coup) :
  - **A** : le moins de fautes (10·(10–50) + 100·(> 50)) à différés au plus ceux du livré, sur les lots d'apprentissage ;
  - **B** : le plus de posés justes à fautes (10–50, > 50) au plus celles du livré, sur les lots d'apprentissage.
- **Prévision statique** (sans cascade, cuts de la GCV2 seulement, avant le rejeu) : `modeles/A/apprentissage-figeA.md`, `modeles/B/apprentissage-figeB.md`. Variantes essayées avant de figer, sur la même simulation hors pli (pour mémoire) : logistique simple critère coût du banc (presque tout différé), critères A et B, arbres boostés, log, gardes ; la sélection imbriquée a remplacé ce choix à la main.
- **Parité outil / module** : `outils/parite-modele.cjs` : 12 821 candidats, écart de probabilité 0, 0 cut au choix différent (ÉTABLI).
- **Jugement** : banc de CH-116, chaque lot rejoué avec le modèle de son pli (`BANC_LEVIERS={"puce":<modèle>}`).
