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
| visites | 679 |
| cuts distincts | 611 |
| parts | 1 et 8 |
| rails rejoués | **313** |
| cuts à deux rails rejoués | **76** |
| cuts avec référence humaine sur les deux rails | 219 |
| **cuts comparables** | **74** (part 1 : 38 · part 8 : 36) |

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
rail, 2 sans candidat exposé. La cause dominante est l'acquisition, pas la
géométrie : `longitudinal-coverage-insufficient` (510),
`engine-useful-point-count-below-minimum` (459),
`longitudinal-span-insufficient` (389), `roi-point-count-below-minimum` (194).

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

## Artefacts

- `tools/native-replay.cjs` — le banc, lecture seule ;
- `audit/native-replay-v4.6.json` — résultat par cut, format
  `banane-native-replay-v1` : candidats exposés, statut, `lossRatio`, décision
  moteur, mesure contre l'humain et classement, cut par cut.
