# Rejeu terrain Natif V4.6 — lecture seule

Lot séparé. Aucune modification de Pair Arbitration V1, de ses deux artefacts,
du moteur, de `geometry.js` ou du Brain. Aucun réglage, aucun entraînement,
aucun nouveau candidat. Unités de scène, jamais converties en millimètres.

## Provenance

Collecte `2026-09-16-native-v4.6` de `StoryNow30/banane-data`, archive
`banane-native-v4.6-2026-09-16.7z`, SHA-256
`32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0` — **vérifié
au téléchargement**, taille 34 509 008 octets conforme au manifest.

Deux pièges de lecture, constatés sur les données :

1. Les exports sont cumulatifs, mais le segment le plus complet d'une session
   n'est **pas** celui d'indice le plus élevé : les fichiers sans `auto-` sont
   des exports manuels postérieurs. Critère correct : l'horodatage.
   Contrôle : 176 + 232 + 271 = **679 visites**, exactement le manifest.
2. Les nuages sont **libérés** au fil des segments : aucun segment ne les porte
   tous. Il faut l'union des chunks sur les 18 fichiers.

Recoupements avec le manifest : **679 visites**, **611 cuts distincts**,
**3 sessions**, **76 paires exploitables** (`closureUsablePairs: 76`). Tous
retrouvés indépendamment.

## Ce qui est rejoué

Le choix du snapshot n'est pas le nôtre : pour chaque visite et chaque rail,
`geometryEligibility[side]` nomme son statut et ses `chunkIds`. Seuls les rails
`comparable-candidate` sont rejoués, avec exactement les chunks nommés.
`propose` est appelé **sans options** — donc sur ses DEFAULTS. Les empreintes de
`geometry.js`, `capture-core.js` et `lidar.js` sont vérifiées au démarrage ; le
rejeu refuse de tourner sur une géométrie altérée.

## Trois étages strictement séparés

| étage | fonction | lit l'humain ? |
|---|---|---|
| 1. décision moteur | `replayRail` / `replayCut` | **non** |
| 2. mesure | `measureCut` | oui — première et seule entrée |
| 3. interprétation | `classify` | ne lit que les sorties 1 et 2 |

L'étage 1 a rendu son résultat avant que l'étage 2 s'exécute : la référence
humaine ne peut pas l'influencer.

## Couverture

| | valeur |
|---|---:|
| visites | 679 — part 1 : **503** · part 8 : **176** |
| cuts distincts | 611 — part 1 : **474** · part 8 : **137** |
| parts | 1 et 8 |
| rails rejoués | **313** |
| cuts à deux rails rejoués | **76** |
| cuts avec référence humaine sur les deux rails | 219 |
| **cuts rejouables en paire** | **76** |
| **cuts scorables** | **74** (part 1 : 38 · part 8 : 36) |
| non scorables parmi les rejouables en paire | **2** |

**`76 = 74 + 2`**, vérifié par test. Les deux prédicats sont exportés et testés,
aucun compteur n'est posé sans lui :

- `pairReplayable` : `engine.rails.left.replayed && engine.rails.right.replayed` ;
- `scorable` : `interpretation.classe !== 'non-qualifiable'`.

Les **2 non scorables** sont rejouables en paire mais la géométrie n'expose
aucun candidat d'un côté :

| cut | côté sans candidat | candidats de l'autre côté |
|---|---|---|
| **part 1 / cut 326** | **droit** | seed, surfaceIntersection, alternative |
| **part 8 / cut 9656** | **gauche** | seed, surfaceIntersection, alternative |

## Classement descriptif des 74 cuts comparables

| classe | cuts |
|---|---:|
| moteur correct | **7** |
| moteur s'abstient, bon candidat exposé | **40** |
| mauvaise famille alors qu'une autre exposée est meilleure | **0** |
| un rail résolu devrait changer pour améliorer la paire | **1** |
| aucun candidat exposé satisfaisant | **26** |
| *non qualifiable* | *605* |

Motifs de non-qualification : 442 cuts sans aucun rail rejouable, 161 à un seul
rail, 2 sans candidat exposé.

### Compteurs canoniques `geometryEligibility[side].reasons`

Statuts, sur **1358 rails** (2 × 679) : `comparable-candidate` **313**,
`excluded` **1045**.

**Un rail exclu porte plusieurs motifs à la fois.** La somme des motifs
(**2647** occurrences) dépasse donc le nombre de rails exclus (1045), et le résumé
machine le déclare explicitement (`multiLabelled: true`) pour qu'on ne lise pas
625 comme un nombre de rails.

| motif | occurrences |
|---|---:|
| `qualified-stored-snapshot-missing` | 625 |
| `validated-reference-not-observed` | 270 |
| `human-final-reference-missing` | 270 |
| `human-final-rail-state-missing` | 270 |
| `checkpoint-not-qualified` | 226 |
| `capture-used-a-different-rail-pose-than-initial-state` | 197 |
| `engine-useful-point-count-below-minimum` | 177 |
| `longitudinal-coverage-insufficient` | 171 |
| `geometry-acquired-after-operator-intent` | 168 |
| `longitudinal-span-insufficient` | 151 |
| `roi-point-count-below-minimum` | 70 |
| `human-final-reference-not-freshly-observed` | 38 |
| `multiple-operator-intents-observed` | 8 |
| `decision-effect-not-observed` | 6 |

### Limite d'échantillonnage — à ne pas passer sous silence

Trois de ces motifs (`human-final-reference-missing`,
`human-final-rail-state-missing`, `human-final-reference-not-freshly-observed`)
portent sur la **disponibilité de la référence humaine**. La porte d'éligibilité
de la collecte en dépend donc, et **les 313 rails rejoués ne sont pas un
échantillon indépendant de l'humain**. L'étage 1 ne lit aucune valeur humaine —
c'est vérifié sur les clés, récursivement — mais le *choix des cuts qu'il voit*
n'est pas neutre. Aucun taux mesuré ici ne doit être extrapolé à la population
complète des 611 cuts.

**Lecture.** Sur les 74 cuts comparables, le moteur place correctement 7 cuts et
s'abstient 40 fois alors qu'un candidat exposé est bon — c'est la même signature
que le corpus hors ligne, à une échelle plus sévère. 26 cuts n'ont aucun
candidat exposé satisfaisant : ni Pair Arbitration ni aucune politique
d'arbitrage ne peut les corriger, puisque le bon placement n'est pas produit.

## Socle d'ancrage local — parts 1 et 8

Mesure de faisabilité, pas un réglage : `R = 5` et `minBase = 5` sont ceux déjà
figés par Pair Arbitration V1, repris tels quels.

| part | cuts | cuts à deux rails rejoués | `lossRatio ≥ 5` des deux côtés | socle de 5 ? |
|---:|---:|---:|---:|---|
| 1 | 503 | 39 | **3** (744, 2891, 3018) | **non** |
| 8 | 176 | 37 | **5** (8580, 9391, 9540, 9542, 9667) | **oui, tout juste** |

### Le cut 1/2891 est doublement singulier, et fragile

Le cut **part 1 / cut 2891** est à la fois l'**unique** représentant de la classe
« rail résolu à changer pour améliorer la paire » et l'**un des trois seuls**
socles d'ancrage de la part 1. Il a **deux revisites** :

| visitIndex | éligibilité G / D | label opérateur | classe |
|---:|---|---|---|
| 230 | `comparable-candidate` / `comparable-candidate` | `VALIDATE_CORRECTED_RIGHT_ONLY` | rail résolu à changer |
| 232 | `excluded` / `excluded` | `VALIDATE_CORRECTED_RIGHT_ONLY` | non qualifiable |

**Les deux références humaines se contredisent.** Mesuré dans la collecte brute :

| grandeur | valeur |
|---|---|
| écart des références humaines **gauches** | **0** (exactement) |
| écart des références humaines **droites** | **9,850551563793×10⁻³ unité de scène** |
| entre les **fins** de visite (dernières observations) | **5,893 s** (≈ 5,9 s) |
| entre les **débuts** de visite | **13,110 s** (≈ 13,1 s) |
| visite intercalée | visitIndex 231 — **part 1 / cut 2892**, label `PASS_NO_DECISION` |

Le rail gauche est identique au chiffre près, cohérent avec le label
« RIGHT_ONLY ». Le rail droit, lui, diffère de **98,5 % de la convention
d'évaluation (10×10⁻³)** entre deux observations du même cut séparées par une
visite d'un autre cut.

Les unités restent des unités de scène : `9,850551563793×10⁻³` n'est pas un
millimètre et n'est pas converti.

**Conséquence, énoncée sans l'atténuer.** L'unique cas « rail résolu à changer »
repose sur une référence humaine qu'une seconde observation du même cut
contredit presque à hauteur de toute la tolérance. **Ce cas est explicitement
qualifié de non robuste** et ne doit pas servir de preuve.

**Ce qui ne change pas pour autant.** Le cut reste **compté mécaniquement** :
la taxonomie garde son `1`, et `settled = 3` pour la part 1 garde 2891 dans les
trois socles d'ancrage. La politique d'ancrage historique n'est pas retouchée —
on ne retire pas un cut du décompte parce qu'il dérange. Il est **marqué
ambigu**, rien de plus. Verrouillé par test.

## Une agrégation citée et NON reproductible : `58 / 15 / 1`

Le triplet `58 / 15 / 1` a une somme correcte (74), mais **aucune partition des
74 cuts scorables ne le produit**. Dix partitions ont été essayées et sont
verrouillées par test : classe, part, nombre de rails résolus, récupérabilité
sous tolérance, moteur sous tolérance, label opérateur, `lidarStatus`,
`visitStatus`, session, meilleure famille par rail. Les plus proches sont
`visitStatus` (57 / 17) et « meilleure famille par rail » (62 / 9 / 3).

**Il n'est donc pas figé.** Un test échoue si une future agrégation le reproduit :
il faudra alors la documenter plutôt que la déclarer irreproductible.

**C'est le résultat opérationnel le plus important.** Le problème d'absence
d'ancre sur une part nouvelle, documenté et laissé ouvert par Pair Arbitration
V1, est confirmé sur le terrain : la part 1 — la plus grande de la collecte,
503 visites — **n'atteint pas le socle minimal**. La part 8 l'atteint exactement,
sans aucune marge. Aucun réglage n'est proposé ici : ce chantier reste séparé.

## Réserve

Les références humaines sont fiables au sens **observationnel** uniquement. Le
manifest les marque `usableForTraining: false` sur 679 visites sur 679, motif
`native-reference-requires-explicit-review`. Elles ne sont promues en vérité
d'entraînement à aucun moment, et n'entrent dans aucune décision de l'étage 1.

`commandSentByBanane` est **faux sur les 679 visites** : la collecte est une
observation passive. Le rejeu calcule donc ce que le moteur *aurait* proposé, et
ne constate pas ce qu'il a fait.

## Correction de consolidation — deux anomalies reproduites par l'audit indépendant

1. **Total des occurrences de motifs.** Le rapport annonçait **2657** ; la valeur
   correcte est **2647**. C'était une erreur d'addition dans la prose : le champ
   calculé de l'artefact valait déjà 2647. Aucun compteur individuel n'a été
   touché — les 14 sont verrouillés un par un par test.
2. **`anchorFeasibility[].cuts = 503 / 176` était faux sémantiquement** : ce sont
   des **visites**. Le champ ambigu a été **supprimé** plutôt que renommé, pour
   qu'aucun lecteur ne le retrouve, et remplacé par `visits` (503 / 176) et
   `distinctCuts` (474 / 137) explicites. Un test balaie récursivement les deux
   artefacts et échoue si un champ nommé `cut`/`cuts`/`distinctCuts` vaut encore
   503 ou 176 à tort.

Une troisième anomalie a été trouvée en vérifiant : l'artefact livré était
allégé par une commande **ad hoc hors de l'outil**, donc non reproductible par
une commande. L'allègement (`engine.initialRails`, 53 Mo contre 1,7 Mo) est
désormais **dans l'outil**, déclaré par le champ `slimmed` de l'artefact et
testé. Vérifié : hors `anchorFeasibility`, `generatedAt` et `collection`, les
`rows` et le `summary` régénérés sont **identiques** au blob précédent
`c56fe5b032788019cd6a09161c23354fd185d962`.

## Artefacts

- `tools/native-replay.cjs` — le banc, lecture seule ;
- `audit/native-replay-v4.6.json` — résultat par cut, format
  `banane-native-replay-v1` : candidats exposés, statut, `lossRatio`, décision
  moteur, mesure contre l'humain et classement, cut par cut ;
- `audit/native-replay-v4.6-summary.json` — résumé machine, format
  `banane-native-replay-summary-v1`, **recalculé depuis le seul artefact**, sans
  relire la collecte : compteurs, prédicats, les 74 `{part, cut, classe}`, la
  taxonomie, les compteurs canoniques de motifs, les cuts revisités et la
  faisabilité du socle ;
- `tests/native-replay.test.cjs` — 12 tests de cohérence indépendants, qui
  recalculent tout depuis l'artefact comme le ferait un tiers n'ayant que le
  dépôt.

Reproduire le résumé et les tests, sans l'archive de 34 Mo :

```bash
node -e "const M=require('./tools/native-replay.cjs');\
 const a=require('./audit/native-replay-v4.6.json');\
 console.log(JSON.stringify(M.consolidate(a).counts))"
node --test tests/native-replay.test.cjs
```
