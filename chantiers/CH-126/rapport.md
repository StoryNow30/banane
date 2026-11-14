# CH-126 : rapport — N+ (reprise d'un cut refusé par l'ancre) : **non retenu, N reste seul** (14/11)

Réglage et règle de décision : ceux de CH-124 (`reglage-fige-reprise.md`, figés avant tout rejeu), non retouchés. Cible écrite avant le premier rejeu : `cible.md` (219ffcc).

## Ce qui a été rejoué (tout ÉTABLI, banc de CH-116)
| étape | résultat | où |
|---|---|---|
| patch | figé `8c63f7f2…` ne s'applique plus (contexte aj5) ; régénéré contexte seul `6506fd38…`, mêmes lignes ; essais 15/15 | `cible.md`, `ancre-reprise-tronc.patch` |
| éteint = N | garde 2 362 / 2 362 identiques ; corpus 4 016 / 4 016 (ligne entière) | `sorties/eteint-egal-N.md` |
| N du tronc | reproduit CH-124 : 35 refus, 30 vraies corrections, 0 faute, 5 non jugés | `sorties/N-zjp-refus.md` |
| garde d'octobre de N+ | mêmes 13 refus, 0 autre cut changé ; 7 reprises : 6 ≤ 10 mm, 1 à 12,3 mm (3-0 843), 0 > 50 mm : **verte** | `sorties/garde-Np.md` |
| corpus de N+ | mêmes 35 refus, 0 ricochet, 0 reprise dans la passe ; 13 reprises : 10 jugées, 9 ≤ 10 mm, 1 à 10,9 mm (1211-p23 3748), 0 > 50 mm, 3 sans vérité | `sorties/corpus-Np.md` |
| tableau standard (N → N+) | ≤ 10 mm 503 → 512 ; 10–50 36 → 37 ; > 50 0 → 0 ; différés 603 → 590 | `sorties/corpus-N*-tableau.txt` |

## Décision, selon la règle écrite d'avance (§ 4)
Garde et corpus réunis : **17 reprises jugées, 0 au-delà de 50 mm, 2 au-delà de 10 mm** (12,3 et 10,9 mm). La règle demande au plus une sur dix (1,7 pour 17). **2 > 1,7 : la règle n'est pas tenue, N+ n'est pas proposé. N reste seul.** L'étape 5 (examen vierge, incrément du service worker, parité) n'est pas faite.

Ce que N+ aurait rendu, pour mémoire et sans l'annoncer comme un gain (R2) : 15 refus reposés à 10 mm au plus (6 en octobre, 9 sur le corpus) ; cible écrite : 8 sur le corpus (fourchette 4 à 14). Les deux reprises au-delà de 10 mm restent proches (12,3 et 10,9 mm) : aucune n'est une mauvaise voie.

## Pourquoi les refus restent différés (corpus, 22)
« Départ le plus probable » 13 (sur le pool restreint, la GCV2 garde la pose de départ et ne valide pas), « sans approche » 7, « plus de 150 mm » 2. La reprise ne pose jamais à plus de 17 mm de l'axe (contrôle final à 75 mm jamais atteint).

## Ce qu'il faudrait tenter ensuite (nouveau réglage, à figer et juger entièrement)
- Rien dans le réglage n'a été choisi sur ces résultats. Toute variante (ex. une garde de plus sur la reprise) serait un **nouveau réglage**, à déclarer comme tel, avec une garde d'octobre neuve et un examen vierge : la mesure ci-dessus l'a déjà vu.
- La puissance est faible (17 reprises jugées) ; la règle se joue sur un cut à 10,9 mm.

## Non mesuré
- Fidélité au service worker (pas d'incrément écrit). Examens vierges : non lus, non extraits.
