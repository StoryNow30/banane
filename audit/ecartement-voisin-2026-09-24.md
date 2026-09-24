# Garde d'écartement voisin — mesure (24/09)

**Demande de la direction** (24/09, après le cas de la partie 2, KI-054) :
l'écartement des cuts voisins doit servir à écarter un cut suspect, et
peut-être à aider le choix du champignon. Mesure pour la 4.8.

**Règle mesurée** (`src/lot-decision.js`, options inactives par défaut) :
l'écartement d'une paire est comparé à la médiane de celui des 3 appuis les
plus proches, à 10 cuts au plus. Au-delà du seuil :

- un premier passage du moteur est retiré et repris depuis la voie (comme par
  la garde de continuité) ; sans appui de position, le cut est différé ;
- une reprise depuis la voie est écartée, le choix est tenté ;
- un choix est écarté : le cut est différé.

Variantes : **garde seule** à 10, 12, 15 et 20 mm ; **garde et aide au choix**
à 12 et 15 mm (quand plusieurs minima sont près de la prédiction, les paires
trop loin de l'écartement des voisins sont éliminées ; s'il en reste une seule,
elle est retenue) ; **cible**, pour la mesure seulement (la paire la plus
proche de l'écartement des voisins, interdite par le cahier 4.8, §7 et §3.6).

**Banc** : 6 sessions Natif et **5 lots Pilote relus** (parties 19, 31 deux
fois, 34, et la partie 2 de la 4.7.14), un seul passage, appuis recalculés,
règles de la 4.7.15. Faux : latéral ou vertical > 10 mm (D-038). Outils :
`tools/choice-anchor-study.cjs --option gaugeGuardMm=…`,
`tools/cursor-sweep.cjs`. Relevé : `audit/ecartement-voisin-2026-09-24.json`.

## Résultats

Base (4.7.15) : 690 cuts décidés, 507 justes, **5 faux** — 398, 402, 983
(partie 20), 7026 (partie 31), 137 (partie 2).

| Variante | Décidés | Justes | Faux | Lecture |
|---|---|---|---|---|
| Garde 20 mm | 691 | +2 | **−1** | retire **7026** ; gagne 9048 et 9049 (partie 19) ; aucun juste perdu |
| Garde 15 mm | 691 | +3 | **−1** | retire 7026 ; gagne 9048, 9049 en Natif et dans le lot Pilote de la partie 19 ; perd 9047 (juste à 0,5 mm) |
| Garde 12 mm | 688 | +2 | −1 | retire 7026 et 398, mais **400 devient faux** (250 mm) par ricochet ; perd 7025 et 9047 |
| Garde 10 mm | 671 | **−11** | −2 | trop serrée : 15 cuts justes perdus, 400 faux par ricochet |
| Garde et aide au choix, 15 mm | 691 | +3 | −1 | **identique à la garde seule** : l'élimination n'a tranché aucun cut |
| Garde et aide au choix, 12 mm | 688 | +2 | −1 | identique à la garde seule |

| Cible (mesure seulement) | 690 | 0 | 0 | **aucun cut changé** |

La cible et l'aide au choix ne changent rien pour la même raison : sur tout le
banc, le cas où elles agissent — plusieurs minima du moteur à 15 mm au plus de
la prédiction, avec un écartement de référence — ne s'est jamais présenté. La
fenêtre de ±15 mm autour de la voie a déjà levé l'ambiguïté ; il ne reste rien
à trancher par l'écartement. La règle du cahier (écartement jamais cible) ne
coûte donc aucun cut sur ces données, et continue de protéger la mesure de
l'écartement, qui est une donnée livrée.

## Lecture

1. **La garde retire le faux 7026**, choix à un seul appui toléré jusqu'ici
   (KI-050, D-042) : c'est le premier correctif mesuré de ce type de faux. À 15
   et 20 mm, elle ne touche ni 398 et 402 (premiers passages sans appui de
   position, écartement proche de celui des voisins ; à 12 mm, 398 est retiré
   mais 400 devient faux), ni 983 (écartement normal, rail gauche décalé), ni
   137 (saut de 6 mm).
2. **À 20 mm, aucun juste n'est perdu** ; à 15 mm, 9047 est écarté alors qu'il
   est juste : l'écartement y change réellement, de 15 à 20 mm (partie 19,
   appareils de voie — le surécartement que le §3.6 demandait de prévoir). À
   12 mm et en dessous, la garde écarte des cuts justes et, par ricochet, en
   rend un autre faux.
3. **L'aide au choix n'apporte rien sur ces données** : quand plusieurs minima
   sont près de la prédiction, l'élimination par l'écartement n'a résolu aucun
   cut. Elle n'est pas proposée.
4. Sur la partie 2, le faux de 207,6 mm du cut 114 est déjà évité par la
   4.7.15 (`chainMm`, KI-054) ; la garde est un filet de plus pour les cas sans
   appui de position.

## Proposition

**Activer la garde seule à 20 mm** (4.7.16), sur décision de la direction :
retire le faux 7026, +2 justes, aucun juste perdu ; marge sur le surécartement
(9047 change de 15 à 20 mm). Pas d'aide au choix, pas de cible. La décision
consignerait `gaugeGuardMm` ; le rejeu des lots antérieurs resterait sans garde.

