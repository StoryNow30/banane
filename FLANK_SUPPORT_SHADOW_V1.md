# Flank Support Shadow V1.3 — instrumentation hors ligne

Lot séparé, **lecture seule**. Aucun changement runtime, `geometry.js`, moteur,
Brain, Pair Arbitration, seuil, politique ou paramètre. Aucun seuil n'est choisi,
aucun candidat n'est fabriqué, aucun rail n'est déplacé, aucun gagnant n'est
désigné.

Objet : les abstentions du moteur gelé dont le **seul** motif est
`Flanc interne insuffisamment observé.` — chaîne citée mot pour mot depuis
`src/geometry.js`, où elle est produite par `faceCount < minFace`.

## Ce qui est rejoué, et à quelles conditions

Rails `comparable-candidate` uniquement, chunks nommés par
`geometryEligibility[side].chunkIds`, et **le snapshot exact** nommé par
`geometryEligibility[side].snapshotId`.

**Fail closed.** Si l'identifiant de snapshot est introuvable ou ambigu, le rail
est **refusé**. Le repli silencieux sur le dernier snapshot — présent dans
`tools/native-replay.cjs` — est supprimé : deux snapshots d'un même rail peuvent
porter des poses différentes, comme l'a montré le cut 1/2891, et un repli
déplacerait la pose de référence sans que personne ne le voie.

> **Constat, pas hypothèse : `failClosed` est vide.** Aucun rail de cette
> collecte n'est refusé pour cette raison. Le repli ne s'était donc **jamais
> déclenché**, et les chiffres du lot `native-replay` ne sont pas affectés
> rétroactivement. Le fail-closed est une garantie, pas une correction.

## Correction de cadrage — la session dégradée existe bien

V1 concluait que `0c58c033-f2e7-4aa5-ad8c-80b081a83932` était « absente ». C'était
vrai du **corpus historique de 679 visites seulement**, et j'ai généralisé à tort.
Cette session appartient à l'**archive finale complémentaire de 1 486 visites**,
que V1 n'avait pas rejouée. V1.1 rejoue les deux.

## Quatre corrections V1.1

1. **Ingestion tolérante.** Le banc ne suppose plus que tout `.json` porte
   `session`, `segment`, `records` et `dictionaries`. Le piège est réel : le
   bilan de l'archive finale porte le **bon** `format`
   (`banane-native-session-v3-compact`) et **n'a pas de `session`** — le format
   seul ne peut donc pas trancher. Chaque fichier écarté est rapporté avec son
   motif.
2. **Dégradation lue, pas déduite.** V1 déduisait « sans perte » de `visitStatus`
   et `lidarStatus`, qui décrivent la complétude d'une visite, **pas** la perte
   d'événements. V1.1 lit `metrics.dropped`, `metrics.degradationEvents`,
   `metrics.degradationPeak` et la cohérence de séquence `nextEventSeq` contre
   les événements exportés.
3. **`reliableObservation`.** Le statut brut `candidate-observed` est **conservé
   tel quel** ; un champ séparé applique le critère observationnel historique du
   projet, repris **verbatim** de `src/native-session.js` (`referenceReasons`).
   Aucun critère nouveau.
4. **`pointsUsed`.** V1 le laissait à `null` et rangeait à tort les points
   **retenus** sous `pointsInCapture`. V1.1 sépare `pointsSupplied` (fournis au
   moteur) et `pointsUsed` (retenus après filtrage de ROI).

## Deux corpus, gardés séparés

| | historical-original | final-complementary |
|---|---:|---:|
| visites | **679** | **1 486** |
| sessions | 3 | 8 |
| rails | 1 358 | 2 972 |
| fichiers ignorés | 0 | **2** |

Fichiers ignorés du corpus final :

| fichier | motif |
|---|---|
| `banane-bilan-v4-…-seg01.json` | `champ-manquant:session` *(format pourtant correct)* |
| `banane-journal-v4-…json` | `format-non-natif:banane-test-journal-v4` |

## Populations

| population | historique | final | combined-day |
|---|---:|---:|---:|
| `not-replayable` | 1 045 | 2 693 | 3 738 |
| **`flank-only`** | **169** | **114** | **283** |
| `engine-candidate` | 99 | 77 | 176 |
| `flank-with-others` | 24 | 24 | 48 |
| `other-abstention` | 19 | 2 | 21 |
| `no-candidate` | 2 | 62 | 64 |
| **`failClosed`** | **0** | **0** | **0** |

## Ancrage causal et contexte opposé — `flank-only`

| | historique | final | combined-day |
|---|---:|---:|---:|
| ancre trouvée | 152 / 169 | 87 / 114 | **239 / 283** |
| opposé non rejouable | 104 | 67 | 171 |
| opposé `flank-only` | 34 | 16 | 50 |
| opposé candidat | 23 | 14 | 37 |
| opposé sans candidat | 1 | 12 | 13 |
| opposé autre abstention | 7 | 5 | 12 |

## Post-hoc strict sur `flank-only`

Convention d'évaluation `≤ 0,010 unité de scène` — **métrique de banc
uniquement**, jamais un seuil runtime ni une calibration physique.

| verdict | historique | final | combined-day |
|---|---:|---:|---:|
| **seed satisfaisant** | **134** | **90** | **224** |
| **autre candidat satisfaisant** | **10** | **4** | **14** |
| — dont `surfaceIntersection` | 5 | 0 | **5** |
| — dont `alternative` | 5 | 4 | **9** |
| **aucun candidat satisfaisant** | **25** | **20** | **45** |

Les deux familles contribuent aux récupérations : **aucune préférence de famille
n'est codée**, et le partage 5 / 9 confirme qu'aucune ne domine.

### Les mêmes compteurs sur `reliableObservation` seul

**Identiques, aux mêmes rails** : 283 / 283 sur combined-day, 169 / 169 et
114 / 114 par corpus.

Ce n'est pas un oubli, c'est un **résultat structurel** : l'éligibilité
`comparable-candidate` de la collecte **exige déjà** tout le critère
observationnel — `src/native-session.js` refuse le statut dès qu'un
`referenceReason` subsiste. Tout rail rejouable est donc fiable par
construction. Le critère est néanmoins recalculé depuis les champs bruts, et il
**mord** sur la population entière (3 666 `candidate-observed` contre 3 576
fiables), ce qui prouve qu'il est réellement évalué et non recopié.

## Session dégradée `0c58c033-f2e7-4aa5-ad8c-80b081a83932`

Frontière déterminée par les **vraies** métadonnées :

| | valeur |
|---|---|
| dernier export sans perte | `…T13-18-15-auto-seg06.json` (segment 6), `maxVisitIndex` **245** |
| premier export dégradé | `…T13-25-47-seg01.json` |
| motifs | **`dropped=65`**, **`degradationEvents=2`**, **`degradationPeak=METADATA_ONLY`** |

| tranche | rails | dont `flank-only` |
|---|---:|---:|
| `before-last-lossless-snapshot` | **492** | **38** |
| `after-last-lossless-snapshot` | **288** | **1** |

`excludedFromCausalAnalysis` est vrai sur toute la tranche tardive : elle n'est
**jamais mélangée en silence** aux analyses causales. Une session sans aucune
perte porte `lossless-throughout`, jamais un `not-applicable` par défaut.

## combined-day — dédupliqué, jamais fusionné

Clé d'unicité `sessionId|visitId|side`. **Recouvrement : 0 ligne, 0 session
partagée** — les deux corpus sont disjoints (3 + 8 = 11 sessions). Aucune session
n'est recousue, aucune valeur n'est moyennée. Total : 2 165 visites, 4 330 rails.

## Le corpus historique est inchangé

V1.1 ajoute des champs et corrige l'ingestion ; elle ne touche **aucun** résultat
des 679 visites. Vérifié ligne à ligne contre l'artefact V1 : **0 ligne
divergente** sur population, candidats, verdict post-hoc et histoire causale.
Figé par test.

## V1.2 — correction causale minimale

Aucun résultat géométrique ne change. Une ligne dont
`degradation.excludedFromCausalAnalysis` est vrai :

- **garde** ses données descriptives et son post-hoc — on ne jette rien ;
- voit son `causalHistory.admissible` passer à **faux**, avec le motif
  `excluded-degraded-slice` ;
- n'entre dans **aucune** statistique d'ancre « propre » ;
- ne peut servir d'ancre à **aucune** ligne de l'analyse propre — celle-ci est
  calculée sur un vivier restreint, et non filtrée après coup, de sorte qu'un
  passé dégradé ne puisse pas s'y glisser.

La dégradation est donc désormais établie **avant** l'histoire causale. Elle ne
lit que des métadonnées d'export : ni géométrie, ni valeur humaine.

### Compteurs publiés séparément

| | descriptif | causal-clean |
|---|---|---|
| **historical-original** | 1 358 rails, 169 flank-only, 152 ancres | **identique** — 0 exclu |
| **final-complementary** | 2 972 rails, 114 flank-only, 87 ancres | 2 684 rails, 113 flank-only, **86** ancres — 288 exclus, dont 1 flank-only |
| **combined-day** | 4 330 rails, 283 flank-only, 239 ancres | 4 042 rails, 282 flank-only, **238** ancres |

Le second jeu ne corrige pas le premier : il répond à une autre question, sur un
sous-ensemble admissible.

### Les lignes antérieures à la frontière sont intactes

Vérifié, pas supposé : sur les **4 330** lignes, l'histoire causale descriptive
est **identique à V1.1**, 0 divergente. Et pour les **4 042** lignes admissibles,
l'ancre propre **égale** l'ancre descriptive.

C'est vrai par construction — une ligne dégradée a toujours un `visitIndex`
supérieur à la frontière, donc ne peut jamais précéder une ligne admissible — et
la propriété est verrouillée par test plutôt que laissée à la démonstration.

## V1.3 — le test de fraîcheur, aligné mot pour mot sur le runtime

**Ce que V1.1 faisait de trop.** Le critère annoncé « repris verbatim » ajoutait
`freshnessMs === undefined`. Le runtime, lui, teste exactement :

```js
freshnessMs === null || freshnessMs < 0 || freshnessMs > 1500
```

`undefined` n'y tombe pas — `undefined === null` est faux, et ses comparaisons le
sont aussi. Un critère présenté comme verbatim ne pouvait donc pas le contenir.
Le test est désormais identique au runtime, et publié tel quel dans
`runtimeTest`.

**La garde de banc est conservée, mais à part.** Une fraîcheur absente n'est pas
une fraîcheur nulle, et le runtime ne la voit pas. Elle est signalée dans
`benchGuards` — `freshness-undefined-not-seen-by-runtime` — avec
`benchGuardsAreNotRuntimeCriterion: true`, et n'entre dans aucun motif runtime.

**Effet exact sur tous les compteurs**, mesuré et non estimé :

| compteur | V1.1 | V1.3 | écart |
|---|---:|---:|---:|
| motif `human-final-reference-not-freshly-observed` | **664** | **210** | **−454** |
| rails portant la garde de banc | — | **454** | +454 |
| `validated-reference-not-observed` | 454 | 454 | 0 |
| `human-final-reference-missing` | 454 | 454 | 0 |
| `human-final-rail-state-missing` | 454 | 454 | 0 |
| `multiple-operator-intents-observed` | 72 | 72 | 0 |
| `decision-effect-not-observed` | 22 | 22 | 0 |
| **rails `reliableObservation`** | **3 576** | **3 576** | **0** |
| `candidate-observed` | 3 666 | 3 666 | 0 |

**Aucun verdict ne bouge.** Les 454 rails concernés portaient déjà d'autres
motifs — ce sont les mêmes 454 que `human-final-reference-missing`. Le correctif
déplace un compteur de motif, pas une décision : tous les compteurs post-hoc,
par corpus comme en combined-day, sont inchangés. Verrouillé par test.

## Artefacts et reproduction

- `tools/flank-support-shadow.cjs` — le banc ;
- `audit/flank-support-shadow-v1.json` — une ligne par rail, quatre blocs
  séparés : `decisionFeatures`, `causalHistory`, `oppositeRailContext`,
  `postHocEvaluation` ;
- `tests/flank-support-shadow.test.cjs` — tests, qui ne relisent jamais les
  collectes.

- `tests/flank-support-shadow.test.cjs` — **25 tests**.

Empreinte du contenu, horodatage exclu, **deux exécutions donnent la même** :
`23f71c19056fb38bc2c442cf35da87b9373f6a64276f161afcd8fa611a16eee7`.

```bash
node tools/flank-support-shadow.cjs \
  --corpus historical-original  <dossier-collecte-679> \
  --corpus final-complementary  <dossier-collecte-1486> \
  --output audit/flank-support-shadow-v1.json
node --test tests/flank-support-shadow.test.cjs
```
