# CH-127 : rapport — trois réglages « poser plus » rejugés sous N (15/11)

Tronc `claude/50-test17` à 49f7004 (Vision 18, N allumé). Réglages pris tels que figés, non retouchés. Cible et règle écrites et poussées avant tout rejeu : `cible.md` (fa9e621). Banc de CH-116 ; corpus en zones du journal et passe fidèle (plafond 10) ; garde d'octobre au banc, jugée cut par cut contre la vérité d'octobre (`outils/comparer.cjs`). Tout est ÉTABLI au banc, sauf mention.

## Recalage (contexte seul)
Les trois patchs ont été recalés par `git apply -3`. Seul écart déclaré : la ligne qui ferme `LEVIERS_V4` (`ajustementFin:null});` → `,` au lieu de `rechListeZones:null});` → `,`). Aucune ligne de logique n'a changé ; les autres lignes `+`/`-` sont identiques (empreintes dans `cible.md`). Les essais ciblés sont verts.

## Références et éteints
- Tronc N : garde « 9 reculs dont 3 réels » (les 13 refus, comme CH-126) ; corpus 503 justes / 36 de 10 à 50 mm / 0 au-delà de 50 mm, 603 différés (comme CH-124).
- Éteint = tronc pour les trois réglages : garde 2 362 sur 2 362, corpus 4 016 sur 4 016, ligne entière (`sorties/*-eteint.md`).

## Résultats (garde d'abord, R1)
| | v4BS-sd (CH-123) | gTE (CH-120) | B' (CH-122) |
|---|---|---|---|
| garde : cuts changés / poses nouvelles jugées | 0 / 0 | 222 / 141 | 456 / 380 |
| garde : refus de N en plus | 0 | 3 (139-189 mm de la vérité) | 6 (143-214 mm) |
| (a) pose nouvelle au-delà de 50 mm | 0 | 0 | **1** (101 mm, N l'a jugée à 13 mm de l'axe) |
| (b) poses nouvelles au-delà de 10 mm | 0 sur 9 | 8 sur 141 | **43 sur 380** |
| (c) justes du tronc au-delà de 10 mm | 0 | **4** (10,1 à 11,6 mm) | **32** (10,6 à 35,6 mm) |
| (c) justes perdus, compensation | 0 | 6 ; reglage-9 : 0 pour 3, **non compensés** | 18, **non compensés** |
| (d) poses de la chaîne touchées | 0 | 0 | 0 |
| corpus | 9 cuts changés : 7 différés reposés justes (2,6 à 5,5 mm), 2 poses de la passe posées dès la 1re passe (restées justes) ; justes 503 → 510, différés 603 → 596 | non rejoué | non rejoué |
| N a jugé les poses nouvelles | 9 sur 9 | 146 sur 146 | 395 sur 397 |
| **décision** | **proposé, PROBABLE** | **écarté** | **écarté** |

Contre la cible écrite : v4BS-sd 7 reposés justes (cible : 7) ; gTE et B' écartés par (c), comme attendu. Pour B', (a) est aussi violé, ce que la cible n'avait pas prévu.

## Ce que montre la mesure
- N fait ce qu'on lui demandait : toutes les mauvaises voies nouvelles de gTE et de B' en travers de la voie sont refusées (9 sur 9). Mais les trois de gTE étaient des cuts que le tronc posait justes : les refuser ne rend pas la pose juste, le cut devient un juste perdu.
- Ce qui écarte gTE et B', ce sont des dégradations de 10 à 35 mm des poses justes de la GCV2 (déplacements dans la voie). N ne juge qu'au-delà de 75 mm de l'axe : il ne peut pas les voir. La pose B' à 101 mm passe N : son erreur n'est pas en travers de la voie.
- v4BS-sd n'agit que sur des cuts que le tronc diffère, et ne nourrit pas les cuts suivants : aucun ricochet, aucune pose existante touchée. Le gain est petit (7 cuts sur 4 016) ; la garde d'octobre n'a ici aucune puissance (0 cut touché).

## Suite
- Assemblage (§ 5) : sans objet, un seul réglage passe.
- v4BS-sd (§ 6) : j'ai demandé à l'intégrateur son jugement unique sur les examens vierges par CH-116 (patchs `v4BS-sd-*-tronc.patch`, leviers `CH-123/leviers-v4BS-sd.json`, tronc N). L'incrément du service worker (`CH-123/hors-pool-v4-sw.patch`, à recaler) et la parité ne viennent qu'après. Rien n'est annoncé comme gain avant l'examen (R2).
- gTE, B' : toute variante (par exemple interdire de déplacer une pose juste de la GCV2) serait un nouveau réglage, à figer et juger sur des données non vues. Octobre est maintenant vu deux fois pour eux.

## Non fait
Corpus de gTE et de B' (arrêt à la garde, règle écrite d'avance) ; validation croisée de la puce (sans objet) ; examens vierges (non lus, non extraits) ; service worker et parité.

Sorties par cut : `sorties/*-par-cut.csv` ; détail : `sorties/*.md`.
