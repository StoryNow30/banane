# CH-143 — lot A4 : ce qui pèse le plus à l'opérateur

**Ticket :** `chantiers/CH-143.md`. **Branche :** `chantier/CH-143`, partie du tronc `ariane6`.
**Plan :** `fiches/PLAN_ARIANE_6.md`, lot A4 (D-357). **Mesure seule : aucun code livré.**
**Outils :** `banane-data/outils/analyse-lots/CH-143/` (`NOTE.md`, `mesure-ce-qui-pese.cjs`,
`sorties/resume.json`, `sorties/tableau.md`).

## Les trois chiffres

Sur **72 lots** de huit collections (Vision 15 → Vision 21), un lot = un `batchId`, exports lus tels
quels et dédoublonnés :

1. **Durée des lots : 8,2 h** (médiane 2 min, moyenne 6,8 min), pour 8 299 cuts posés et 490 différés.
2. **Cuts posés à la main : 0.** Aucun `finsLot.main` non vide ; à part, 83 cuts écrits par la seconde
   passe (ce ne sont pas des poses à la main).
3. **Relecture : 6,4 h actives** (somme du temps par cut, pauses exclues) pour **21 524 cuts relus**
   dont 2 166 corrigés (10,1 %) ; **7,1 h** en temps mural, pauses et absences comprises.

Par cut relu : médiane **598 ms** (P90 2 213 ms), décomposée en navigation 22 ms, capture 259 ms,
calcul 211 ms.

## Ce que le chiffre de relecture veut dire

Le lot mesuré est la passe de pose ; **la relecture vient après lui**, séquentiellement (lot 29 du
19/11 : fin 07:34:21, relecture finie 07:59:51, lot 30 à 08:00:02). La relecture coûte donc **78,1 %
du temps de pose**, et l'ensemble posé + relu vaut **14,6 h, dont 43,9 % de relecture**. C'est le plus
gros bloc de temps mesuré.

Un cut corrigé coûte **2 026 ms** contre **552 ms** pour un cut seulement visité (3,7 fois). Mais les
visites représentent **78,6 %** du temps de relecture (301 min sur 384) : le gisement est dans les
visites, pas seulement dans les corrections.

## Ce que ces chiffres ne disent pas

- Le temps de l'opérateur **hors Ariane** (regarder ESV, réfléchir, corriger à la main) n'est pas
  mesuré : 6,4 h est ce que la machine voit.
- Le temps mural contient les pauses ; l'actif les exclut. Les deux ne se confondent pas.
- « 0 posé à la main » est un état de fin de lot, pas la preuve d'une absence d'intervention.
- Dix lots n'ont aucune relecture active (sept du 29/10, parties 25, 6 et 34) : versions antérieures ou
  relecture non lancée — ils comptent dans les durées de lot, pas dans la relecture.
- Les 8 299 cuts posés ne sont pas tout le parcours : seuls les lots exportés sont là.

## Conséquence pour le lot D

**Le lot D s'ouvre** : la relecture est le premier poste **réductible** (6,4 h, 78,1 % du temps de
pose et 43,9 % du total posé + relu ; la pose, 8,2 h, reste le plus gros bloc mais c'est le travail
lui-même), et il devra d'abord supprimer des **visites** (78,6 % du temps), pas seulement accélérer
des corrections.
