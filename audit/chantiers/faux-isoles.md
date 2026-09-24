# Chantier 2 — faux isolés du premier passage

Base de code `a74c225`, branche `chantier-48/faux-isoles`. Analyse hors ligne des cinq sessions publiques de `banane-data`, branche `claude/banane-47-gate-audit-vaktr1`. Aucun fichier `src/`, moteur, module de décision, dépôt de données, validation ni navigation ESV n'a été modifié. Le cahier (§7, amendement n°9), D-038 et les exclusions opérateur ont préséance ; aucune contradiction constatée avec cette consigne.

## Fait et vérifié : reproduire avant d'analyser

Les archives 7z de `collections/2026-09-23_v4.7.6_/` et `collections/2026-09-23_v4.7.7_/` ont été décompressées en cinq dossiers séparés (`../sessions/p19`, `p20-long`, `p20-court`, `p22`, `p24`), selon les attributions d'entrées de `manifest.json`. Dans cet environnement sans exécutable `7z`, extraction avec `libarchive.so.13` par un utilitaire temporaire ; les JSON extraits et les relevés intermédiaires ne sont pas déposés dans Banane. La fusion des segments est faite en mémoire par `merge-segments.cjs` à chaque commande ci-dessous.

Commande exacte, exécutée séparément pour limiter la mémoire ; remplacer `pXX` par chaque libellé de la liste :

```sh
node --max-old-space-size=8000 tools/lot-choice-study.cjs --input ../sessions/p19=p19 --variant B --chain guarded --sides both --json ../repro-p19.json
node --max-old-space-size=8000 tools/lot-choice-study.cjs --input ../sessions/p20-long=p20-long --variant B --chain guarded --sides both --json ../repro-p20-long.json
node --max-old-space-size=8000 tools/lot-choice-study.cjs --input ../sessions/p20-court=p20-court --variant B --chain guarded --sides both --json ../repro-p20-court.json
node --max-old-space-size=8000 tools/lot-choice-study.cjs --input ../sessions/p22=p22 --variant B --chain guarded --sides both --json ../repro-p22.json
node --max-old-space-size=8000 tools/lot-choice-study.cjs --input ../sessions/p24=p24 --variant B --chain guarded --sides both --json ../repro-p24.json
```

Sortie vérifiée, ramenée aux champs pertinents (la sortie intégrale contient aussi `byStage`) :

| Session | Cuts distincts | Jugés | Pose ESV seule, justes/faux | Lot, justes/faux | Couverture tous cuts |
|---|---:|---:|---:|---:|---:|
| P19 relecture | 168 | 25 | 11/0 | 19/0 | 35,1 → 50,0 % |
| P20 longue | 312 | 188 | 87/7 | **108/4** | 48,4 → 55,1 % |
| P20 courte | 56 | 52 | 31/0 | 31/0 | 57,1 → 57,1 % |
| P22 | 10 | 8 | 0/0 | 4/0 | 10,0 → 50,0 % |
| P24 | 176 | 119 | 70/0 | 92/0 | 47,2 → 63,1 % |
| **Total** | **722** | **392** | **199/7** | **254/4** | **45,2 → 56,0 %** |

L'exécution de P20 longue imprime exactement : `241 (first-pass, 40.5 mm) · 407 (second-pass-window, 143.8 mm) · 409 (first-pass, 140.5 mm) · 983 (first-pass, 15 mm)`. La comparaison de `JSON.stringify(summary)` à la variante B/guarded/both/15 de `audit/lot-choice-2026-09-23.json` rend `true`. La règle d'arrêt de l'étape 1 n'est pas déclenchée.

Le dénominateur prend tous les *cuts distincts* à première observation avec pose ESV établie, y compris sans entrée, refus et différés. Les revisites ne s'ajoutent pas. P19 exclut explicitement 9033 et 9241 : deux premières observations, à la demande de l'opérateur ; aucune autre exclusion manuelle. C'est un diagnostic sur des collectes Natif et une relecture, **pas** une mesure de couverture C1 sur un lot Pilote complet de validation.

## Relevé par cut et frontière anti-fuite

`tools/isolated-wrong-study.cjs` refait, pour **chaque cut appliqué** (404 sur 722), la capture qualifiée avant geste et la publication scientifique, puis reconstruit la paire et exige que son écartement soit admissible. Pour les seconds passages, les ancres viennent des positions reconstruites des cuts appliqués du lot ; jamais de la pose humaine. La référence humaine est appelée **après** la proposition pour vérifier le statut et l'erreur 2D brute ; chaque valeur arrondie doit coïncider avec le banc. Le relevé `audit/chantiers/faux-isoles.json` donne une ligne à chaque cut et, par rail appliqué : voie de publication, ratio de pertes du meilleur et du second minimum A_STAR, points de dessus/flanc du fit, points sous gabarit lus par le calage, statut du calage, densité locale, visibilité, déplacement latéral/vertical depuis ESV, écartement de paire et écart à la droite des ancres lorsqu'elle existe. `null` veut dire non calculable et n'est pas remplacé par zéro. Dans ces captures retenues, `gatherInput` ne conserve que les points de visibilité prouvée : cette variable est donc constante, et ne discrimine aucun cas.

Commande de recalcul, une session à la fois, puis agrégation des cinq JSON intermédiaires :

```sh
node --max-old-space-size=8000 tools/isolated-wrong-study.cjs --input ../sessions/p20-long=p20-long --baseline ../repro-p20-long.json --json ../signals-p20-long.json
node tools/isolated-wrong-study.cjs --input ../sessions/p24=p24 --baseline ../repro-p24.json --json ../signals-p24.json
node tools/isolated-wrong-study.cjs --input ../sessions/p19=p19 --baseline ../repro-p19.json --json ../signals-p19.json
node tools/isolated-wrong-study.cjs --input ../sessions/p22=p22 --baseline ../repro-p22.json --json ../signals-p22.json
node tools/isolated-wrong-study.cjs --input ../sessions/p20-court=p20-court --baseline ../repro-p20-court.json --json ../signals-p20-court.json
node tools/isolated-wrong-study.cjs --combine ../signals-p20-long.json ../signals-p24.json ../signals-p19.json ../signals-p22.json ../signals-p20-court.json --json audit/chantiers/faux-isoles.json
```

Sortie de l'agrégation : `{"totals":{"cuts":722,"judged":392,"right":254,"wrong":4}, ...}`. Les quatre erreurs brutes vérifiées sont respectivement **40,55 ; 143,78 ; 140,47 ; 14,99 mm** (l'arrondi à un dixième donne le relevé du banc). Le critère de jugement du nouveau script est strictement `> 10 mm` sur la valeur brute.

| Cut | Passage et support pertinent | Calage | Depuis ESV, pire signal notable | Paire et continuité |
|---|---|---|---|---|
| **241** | gauche S1, dessus/flanc 167/14 ; droite A_STAR, 27/79 | **droite hors domaine**, dz +8,54 mm ; gauche appliqué | droite vertical −41 mm | 1432,16 mm ; garde 3,6 mm |
| **409** | gauche S1, 20/6 ; droite A_STAR, 43/27 | **gauche hors domaine**, dz +8,77 mm | gauche latéral −138,60 mm | 1432,08 mm ; **sans ancre** |
| **407** | second passage depuis **409** ; gauche A_STAR à flanc partiel, 16/4 | appliqué sur les deux rails | gauche latéral −149,36 mm | 1424,07 mm ; garde 15,54 mm |
| **983** | deux A_STAR directs, dessus/flanc 113/8 et 127/10 | appliqué sur les deux rails | déplacements latéraux −27,74 et +38,26 mm | 1435,13 mm ; garde 3,9 mm |

La formulation ancienne de KI-043 sur 241 ne localisait pas le rail en cause : **son rail droit erroné de 40,55 mm est publié par A_STAR**, tandis que son rail gauche est repêché par S1 ; le calage hors domaine concerne le droit. Il faut donc raisonner au niveau de la **paire**, et non imposer que S1 et l'échec du calage soient sur le même côté.

## Gardes évaluées, sans déplacer de rail

Une garde signifie seulement « différer ce cut ». Les colonnes sont **faux arrêtés / justes perdus** sur les cuts appliqués et jugés de la simulation existante, sans recalcul d'un lot où des ancres seraient retirées ; les cuts appliqués sans référence sont conservés dans `unjudgedStopped` du JSON. Les règles ont été formulées sur P20 longue ; elles sont ensuite appliquées **telles quelles** à P24, P19, P22 et P20 courte. Les seuils 30 mm de continuité et [1405,1470] mm d'admissibilité restent intacts. La règle à 100 mm est un témoin de coût, pas un seuil proposé.

| Règle | P20 longue (construction) | P24 | P19 | P22 | P20 courte | Total |
|---|---:|---:|---:|---:|---:|---:|
| **S1 sur un rail ET calage hors domaine sur l'un des deux** | **2/0** | 0/0 | 0/0 | 0/0 | 0/0 | **2/0** |
| S1 et calage hors domaine sur le *même* rail | 1/0 | 0/0 | 0/0 | 0/0 | 0/0 | 1/0 |
| Tout calage hors domaine | 2/3 | 0/4 | 0/0 | 0/0 | 0/0 | 2/7 |
| Tout S1 | 2/10 | 0/9 | 0/5 | 0/1 | 0/0 | 2/25 |
| Tout flanc partiel | 1/4 | 0/18 | 0/0 | 0/1 | 0/0 | 1/23 |
| Premier passage sans ancre | 1/3 | 0/10 | 0/0 | 0/0 | 0/1 | 1/14 |
| Translation latérale ESV > 100 mm | 2/13 | 0/10 | 0/0 | 0/4 | 0/29 | 2/56 |

**Proposition de règle à soumettre en amendement, non à intégrer ici :** différer la paire si l'un des rails est publié par S1 et si le calage de convention signale `shift-out-of-domain` pour au moins un des deux rails. Elle arrête directement 241 et 409 sans perdre de cut juste mesuré dans ces cinq sessions. Elle a une raison physique : une paire cumule un repêchage d'ambiguïté et un échec du déplacement de convention, même si ces indices portent sur deux rails distincts. Sur P24, P19, P22 et P20 courte, elle ne se déclenche **jamais** : ce résultat n'est pas une démonstration hors échantillon de sensibilité ou de sûreté. Le domaine hors entraînement doit être éprouvé par des lots nouveaux.

**407** ne satisfait pas directement cette règle : flanc partiel gauche, calage appliqué. Dans le rejeu observé, sa seule ancre est **409**. Si la nouvelle garde diffère 409 et si aucune autre ancre n'apparaît après recalcul du lot, le chemin ayant publié 407 n'existe plus. Le gain indirect n'est **pas compté** parmi les deux faux directement arrêtés : une nouvelle simulation de l'ordre et des ancres est nécessaire avant d'affirmer qu'il est différé. Une garde générale du flanc partiel arrête directement 407, mais perd 4 justes sur la construction et 19 sur les autres sessions ; elle n'est pas recommandée.

**983** reste faux sous la garde proposée. Il présente un A_STAR direct sur les deux rails, un calage appliqué, un écartement admissible et un écart de continuité de seulement 3,9 mm. Parmi 77 premiers passages jugés ayant eux aussi deux A_STAR directs, deux calages appliqués et aucun flanc partiel dans P20 longue, 983 est le seul faux ; limiter le flanc droit à ≤ 10 points toucherait **15 justes** du même groupe. Le ratio du second minimum ou le déplacement ESV ajusté pour ce seul cas serait du surajustement. Aucune règle mesurée ici ne justifie « zéro faux ».

## Tests et limites

Vérifié : `node --test tests/isolated-wrong-study.test.cjs` → **2/2 réussis**. `node tools/verify.cjs` → **646 tests, 644 réussis, 0 échec, 2 ignorés** ; banc partiel faute des trois fichiers du corpus privé attendus, conformément à la procédure. Le rapport du banc complet a été produit localement sans conserver ses changements de génération dans le commit. Les assertions intégrées au relevé vérifient pour chaque cut appliqué la présence de l'entrée, l'admissibilité de la paire, la référence et l'erreur du banc.

**Supposé, non vérifié :** que le retrait de 409 suffirait à différer 407 dans un lot recalculé ; que les résultats Natif/relecture prédisent un lot Pilote complet ; que l'opérateur redonnerait exactement les mêmes références à une date différente. Les quatre positifs sont tous dans la même session P20 longue. Les sessions tenues à l'écart n'ont **aucun positif**. Leur absence de perte mesurée pour la garde étroite ne prouve pas sa généralisation. Le plancher P2 de reproductibilité humaine sur 30 cuts reste à obtenir et doit accompagner toute promesse de précision à 10 mm.

## Questions pour la direction

1. Lancer un rejeu contrefactuel de la garde proposée **avec recalcul des ancres et des deux passages**, pour savoir si 407 est réellement différé et combien de cuts changent de trajectoire ?
2. Examiner 983 à nouveau, en aveugle et indépendamment, puis rechercher un signal de support réellement distinctif avant de poser un seuil ; accepter explicitement qu'aucune règle 0 faux ne soit démontrée ici ?
3. Tester cette garde en observation sur les futurs lots Pilote F1/F3 de parties inédites, avec bilan C1 à dénominateur complet, C2 et C4, avant toute activation ?
