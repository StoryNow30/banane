# CH-142 — lot A2 : l'ancre muette sur le terrain

**Méthode.** Mesure seule, aucun code d'Ariane livré. Pour chaque lot-partie des exports V18, V19, V19.1 et V20 (V15 en comparaison), le script lit la liste d'ESV **dans le même export de lot** que le journal, la décompacte avec `src/liste-memoire.js` et applique `src/ancre-trajectoire.js` (`lignes`, `preparer`, `axe`) à chaque cut, sans recopier aucun seuil. Quatre causes, dans l'ordre du ticket : `liste-absente`, `liste-courte` (< 100 lignes utilisables), `cut-hors-liste` (ligne absente ou bout de liste), `voie-courante-insuffisante` (lignes intactes ou sens non établi). Une cause par cut, la première qui s'applique. Populations : **visité** = cut lu (`before-captured` ou `proposed`) ; **posé** = cut validé (`validation-accepted`) ; le pourcentage principal porte sur les **posés**, parce que c'est là que l'ancre doit s'établir pour protéger une pose.

| lot | cuts visités | cuts posés | muets (posés) | % muet (posés) | liste-absente | liste-courte | cut-hors-liste | voie-courante-insuffisante |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| V18 | 1 418 | 1 361 | 13 | 1,0 % | 0 | 0 | 13 | 0 |
| V19.1 | 836 | 750 | 18 | 2,4 % | 0 | 0 | 11 | 7 |
| V19 | 125 | 123 | 46 | 37,4 % | 1 | 0 | 2 | 43 |
| V20 | 808 | 791 | 9 | 1,1 % | 0 | 0 | 9 | 0 |
| **total V18 à V20** | **3 187** | **3 025** | **86** | **2,8 %** | **1** | **0** | **35** | **50** |
| V15 (comparaison) | 831 | 784 | 10 | 1,3 % | 0 | 0 | 10 | 0 |

Sur les **visités**, le total principal est 92 muets sur 3 187 (2,9 %) ; l'écart avec les posés est fait de cuts lus mais non validés.

**Contrôle ÉTABLI.** Les posés comptés retombent exactement sur les « validés » des NOTES de lots : V18 1 361, V19.1 750, V15 784. Le découpage des populations n'invente donc pas de cuts.

## 1. La réponse : 2,8 %, et ce n'est pas « les listes manquent »

- **Les listes sont présentes** : 39 des 40 lots-parties portent leur liste d'ESV ; aucun des 5 lots n'en est dépourvu ; aucune liste n'a moins de 100 lignes utilisables. `liste-courte` ne se déclenche pas une fois. Le seul lot-partie sans liste est `V19 p1`, et il ne pèse **qu'un cut** (le cut 1, en tête de lot) — `liste-absente` = 1 cut sur 4 018.
- **`cut-hors-liste` est structurel** : sur les 58 cuts `cut-hors-liste` (population visitée), 43 ont un cut ≤ 5 et les 15 autres sont à 60 lignes ou moins de la fin de la liste ; aucun au milieu. Le module exige 20 m de part et d'autre (`a + w + margeM`), donc les extrémités d'une partie sont toujours muettes.
- **Le seul trou réel est le sens** : les 50 `voie-courante-insuffisante` sont toutes des mutes `sens` (`rapportSens` 1,031 en V19 p3 ; 1,032 en V19.1 p4), jamais un manque de lignes de voie courante. Elles sont concentrées : 43 cuts en **V19 p3** (2485–2502, 2583–2593, 2632–2645) et 7 en **V19.1 p4** (8645–8651). **Tous ces cuts ont été posés et écrits** malgré l'ancre muette : c'est la seule population où l'ancre n'a rien protégé alors qu'elle aurait dû.

## 2. Les lots les plus touchés

**V19 est seul en tête** (37,4 %, 46 des 86 mutes principaux), parce qu'il s'arrête tôt en p3, précisément dans la zone de sens faible. Sans V19, les trois autres lots font **40 muets sur 2 902 posés (1,4 %)**. Viennent ensuite V19.1 (2,4 %, dont 8 sur 55 en p4) puis V18 (1,0 %), V20 (1,1 %) et V15 (1,3 %). Le classement par lot est donc trompeur si l'on ne voit pas que le mutisme est **local**, pas réparti : une zone de quelques centaines de cuts peut porter presque tout le total.

## 3. Ce que la mesure ne dit pas

- Les causes de mutisme **hors liste** ne sont pas mesurées : `calage-ligne`, `calage-lot` et `pose` (la pose de départ de la capture ne se cale pas) demandent les captures et l'ordre du lot. Sur V18, la NOTE du lot compte 66 décisions non jugées sur 1 418, quand les quatre causes ci-dessus en déclarent 14 sur les mêmes cuts ; l'écart (52) relève d'autres motifs (calage, pose, absence de décision) et n'est pas ventilé ici.
- La liste de l'export est le **dernier instantané** de la partie, pas forcément celle chargée au moment du cut : une liste absente de l'export ne prouve pas que la page ne l'avait pas (PROBABLE).
- Les Échos ne sont pas une population : seuls les journaux de lot comptent. Les cuts jamais visités ne sont pas comptés.
- La Vision 21 n'existe pas encore dans `collections/` ; aucune archive `.7z` de lot dans les cinq collections lues.

**Conséquence pour l'ordre (D-357), en une phrase.** L'ancre ne se tait que sur 2,8 % des cuts posés, dont l'essentiel est structurel (bouts de liste) ou concentré dans une seule zone de sens faible : le mutisme n'est pas le chantier prioritaire — **B (un seul code de décision) reste premier, et dans C, C1/C2 (génération et choix de voie par l'axe) passent avant C5 (ancre moins muette)**.

**Pointers** : `banane-data/outils/analyse-lots/CH-142/` (`NOTE.md` pour le protocole et les trois commandes, `mesure-ancre-muette.cjs`, `sorties/tableau.md`, `sorties/detail.csv`, `sorties/resume.json`).
