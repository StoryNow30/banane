# Corpus V2 Natif — procédure de collecte d'oracles humains pour GCV1

Date : 21 septembre 2026. Ce document est une **procédure**, pas une livraison
de code. Il conclut une vérification : les primitives du Mode Natif déjà
livrées suffisent à collecter le Corpus V2. **Aucune nouvelle collecte n'est
codée**, et aucune stratégie géométrique nouvelle n'est proposée ici.

## 1. Pourquoi ce corpus

Les études GCV1 disponibles reposent sur deux ensembles très inégaux :

| Ensemble | Rails exploitables | Oracle humain | Rôle |
|---|---:|---|---|
| `tests/corpus` (partie 23, profil U50) | 20 | `explicit-before-after`, 10 paires | seul HOLDOUT indépendant |
| corpus GCV1 de découverte (parties 3, 7, 9) | 96 | 18 rails seulement, via session Natif | DÉCOUVERTE |

Un HOLDOUT de 20 rails sur **une seule partie et un seul profil** ne permet ni
de stratifier, ni de mesurer une non-dégradation ailleurs. C'est la limite qui a
clos les deux dernières études : le phénomène visé par le support LiDAR
adaptatif était absent du HOLDOUT (0/20), et le défaut S1 n'a qu'une seule
occurrence mesurable sur 116 rails. Les deux verdicts sont corrects, et les
deux sont limités par le volume d'oracles, pas par la méthode.

## 2. Verdict de suffisance — chaque donnée requise existe déjà

| Donnée requise | Champ existant | Source |
|---|---|---|
| État BEFORE du rail, immuable | `record.beforeEstablishedByRail[side].rail`, `immutable:true` | `src/native-session.js:94` |
| BEFORE consommé par le moteur | `record.beforeEstablished.rails[side]` | `tools/native-offline-evaluate.cjs:52` |
| LiDAR **avant** correction | `record.lidarChunkIds`, `geometryCaptures[id].sides[side].chunkIds` ; la pose du chunk est contrôlée égale au BEFORE, sinon `chunk-does-not-match-initial-rail-pose` | `tools/native-offline-evaluate.cjs:26` |
| Correction humaine finale | `record.humanFinalReference.state`, `.status`, `.association.freshnessMs` | `src/native-session.js:156` |
| Déplacement Y/Z en repère profil local | `humanDelta(initialRail, humanFinal.rails[side])` ; même grandeur que `displacementLocal` | `tools/native-offline-evaluate.cjs:46`, `src/core.js:32` |
| Rail gauche / droite | traité par côté partout (`SIDES`) | `src/native-session.js` |
| Signe de Z | composante `[2]` de `humanDelta` | dérivé |
| Densité / appui LiDAR | `pointsRetained` et `pointsSaved` par rail ; `engineInput[side].points` ; `railSnapshots[side][].qualification` (`native-visible-roi-v1`) | `src/native-session.js:208`, `src/native-lidar.js:173` |
| Profil et partie | `record.identity` = `pageId, part, cut, shape, frameId, projectId` | `src/core.js:8` |
| Étiquette humaine | `record.observedLabelCandidate` : `VALIDATE_CORRECTED_BOTH / _LEFT_ONLY / _RIGHT_ONLY / _NO_MOVEMENT`, `SKIP`, `PASS_NO_DECISION`, `AMBIGUOUS_MULTIPLE_INTENTS` | `src/native-session.js:290` |
| Preuve de passivité | `source:'native-passive-observation'` ; `safety:{nativeCommandSent:false, navigationAction:false}` | `src/native-session.js:60`, `tools/native-offline-evaluate.cjs:69` |
| Réserve d'usage | `usableForTraining:false` + `trainingExclusionReason` | `src/native-session.js:307` |

**Conclusion : rien à coder côté page.** Ce qui manque n'est pas une primitive,
c'est un **manifeste** (§5) et la discipline de collecte (§3).

## 3. Procédure de collecte — passive par construction

1. Démarrer le Mode Natif **avant** que l'opérateur ouvre le cut à corriger.
   L'observation n'envoie aucune commande : `nativeStart` installe un
   observateur, et aucun `apply`, `VALIDATE`, `SKIP` ou `navigate` n'existe dans
   cette voie. Banane ne doit **rien afficher** qui suggère une position : le
   Pilote GCV1 reste éteint pendant une collecte d'oracle.
2. L'opérateur travaille normalement. L'état BEFORE est figé **par rail** au
   premier état observé et n'est jamais réécrit (`immutable:true`) ; une
   correction qui arrive après ne peut donc pas se substituer au BEFORE.
3. La correction humaine n'est retenue que si elle est observée **fraîchement**
   à l'intention `VALIDATE` : `freshnessMs` non nul, positif et ≤ 1 500 ms,
   sinon `human-final-reference-not-freshly-observed`. Un état arrivé après
   l'entrée opérateur est marqué `candidate-timing-uncertain` et exclu.
4. Un `SKIP`, deux intentions, une navigation non observée ou un rail manquant
   excluent l'exemple, avec le motif nommé — jamais silencieusement.
5. Une session d'essai ou une mauvaise cible se jette avec `discard()`, qui
   supprime nuages, visites et événements. **Ne jamais réparer un enregistrement
   à la main.**
6. Exporter la session. Si le fichier est au format
   `banane-native-session-v3-compact`, le réhydrater d'abord par
   `src/native-export.js` → `expand()`, par exemple avec
   `node tools/export-compact.cjs --expand COMPACT.json --out SESSION.json`.
   Fournir ensuite `SESSION.json` à
   `node tools/native-offline-evaluate.cjs --input SESSION.json --output RAPPORT.json`.
   Le replay attend les `records` et `clouds` réhydratés, pas les références
   internées du format compact. Si l'export comprend plusieurs segments,
   `tools/merge-segments.cjs` les réhydrate via `expand()` pendant la fusion ;
   son fichier fusionné est l'entrée du replay. L'appariement strict
   `K.pairCorpus` refuse toute paire dont les rails de capture ne sont pas à la
   pose `initial` de la référence.

Ce qu'un oracle **n'est jamais** : un état laissé par Banane, un journal
automatique, une navigation, une position V4.6 ou GCV1. Cette règle est déjà
matérialisée : `usableForTraining` reste faux et
`trainingExclusionReason` vaut `native-reference-requires-explicit-review`
jusqu'à revue humaine explicite.

## 4. Frontière anti-fuite

Elle est déjà écrite dans le code et doit rester intacte :
`buildEngineInput()` **n'a pas d'argument humain final**
(`tools/native-offline-evaluate.cjs:21`). L'entrée moteur est construite, puis
les propositions calculées, et seulement ensuite la référence humaine est lue
pour la comparaison. Toute étude du Corpus V2 doit passer par cette fonction,
ou par une fonction qui respecte le même ordre, et le rapport doit continuer à
porter `humanFinalPositionsProvidedToEngine:false`.

## 5. Manifeste — ce qui reste à produire, hors ligne

Un fichier par lot de collecte, écrit **avant toute analyse**, une ligne par
rail :

```
{ "format":"banane-corpus-v2-manifest-v1", "generatedAt":"…",
  "source":{ "file":"…", "sha256":"…", "nativeSessionId":"…" },
  "rows":[ { "recordId":"…", "visitId":"…", "side":"left",
             "part":23, "cut":2857, "shape":"U50", "projectId":"…",
             "humanLabel":"VALIDATE_CORRECTED_BOTH",
             "displacementLocal":[0,0.0257,0.0009], "zSign":"+",
             "pointsRetained":194, "engineInputPoints":…,
             "eligibility":"comparable-candidate", "exclusionReasons":[],
             "split":"DEVELOPMENT" } ] }
```

Règle de partition, à déclarer avec le manifeste et jamais après :

- La partition est **par partie**, pas par rail ni par cut. Deux cuts voisins
  d'une même partie partagent la voie, la pose et souvent le défaut : les
  répartir des deux côtés de la frontière ferait fuir le HOLDOUT.
- `tests/corpus` (partie 23) **reste HOLDOUT** et ne change pas de statut.
- Les parties 3, 7 et 9 restent **DÉCOUVERTE** : elles ont déjà servi à former
  des hypothèses et ne peuvent plus prouver une généralisation.
- Toute partie nouvellement collectée est affectée à l'ouverture du manifeste,
  par une règle écrite, et son affectation n'est plus modifiable. Un HOLDOUT
  regardé est un HOLDOUT dépensé.

Objectifs de volume, comme **objectifs de collecte** et non comme seuils
scientifiques : au moins deux parties et deux profils distincts de ceux déjà
tenus, et un effectif par strate (côté × signe de Z) comparable aux 20 rails de
la partie 23, faute de quoi une non-dégradation ne sera pas mesurable par
strate. Ces nombres ne conditionnent aucun calcul et ne deviennent jamais un
paramètre du moteur.

## 6. Ce qui n'est pas collecté, et pourquoi

`topRows`, `faceCount`, `loss`, `lossRatio`, les clusters STRONG et le nombre
d'hypothèses concurrentes sont des **sorties de moteur**, recalculables à tout
moment depuis l'entrée BEFORE. Les collecter figerait une version du moteur
dans le corpus et rendrait le corpus non rejouable après un changement de
science. Le corpus ne contient que des observations et la correction humaine.
