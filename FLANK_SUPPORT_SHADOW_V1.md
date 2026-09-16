# Flank Support Shadow V1 — instrumentation hors ligne

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

## Population — 1358 rails

| population | rails |
|---|---:|
| `not-replayable` (éligibilité `excluded`) | 1045 |
| **`flank-only`** — motif exactement celui étudié | **169** |
| `engine-candidate` | 99 |
| `flank-with-others` — flanc **joint** à un autre motif | 24 |
| `other-abstention` | 19 |
| `no-candidate` | 2 |

313 rails rejoués, conforme au lot précédent. `flank-with-others` est séparé à
dessein : `geometry.js` joint ses motifs par un espace, et un rail qui manque
aussi de plan de roulement n'est pas le même objet d'étude.

Les 169 `flank-only` : **88 droite / 81 gauche**, **137 part 1 / 32 part 8**.

## Distributions brutes — aucun seuil retenu

| grandeur | n | p10 | médiane | p90 |
|---|---:|---:|---:|---:|
| `faceCount` | 169 | 0 | **3** | 5 |
| `faceSpanBins` | 169 | 1 | 2 | 3 |
| `topCount` | 169 | 29 | 43 | 60 |
| `lossRatio` | 169 | 2,47 | 8,05 | 22,50 |
| seed↔surface ×10⁻³ | 169 | 0,00 | 1,86 | 6,15 |
| seed↔alternative ×10⁻³ | 169 | 19,24 | 22,36 | 61,21 |

À titre de repère factuel, `minFace` vaut **6** dans les DEFAULTS de
`geometry.js` — **non modifié, et aucune autre valeur n'est proposée ici**.

## Continuité strictement causale

Ancre = même session, même page, même frame, même part, **même côté**,
`visitIndex` **strictement antérieur**, et moteur réellement `candidate`.
**Une abstention n'est jamais une ancre**, même répétée à l'identique : une suite
d'abstentions stables ne prouve rien sur le placement.

Ancre trouvée pour **152 / 169** rails `flank-only`.

| écart à l'ancre | p10 | médiane | p90 |
|---|---:|---:|---:|
| `cutGap` | 1 | 16 | 336 |
| `visitIndexGap` | 1 | 9 | 46 |
| distance ancre→seed ×10⁻³ | 1,41 | 7,07 | 48,77 |
| distance ancre→surfaceIntersection ×10⁻³ | 1,78 | 7,07 | 49,04 |
| distance ancre→alternative ×10⁻³ | 14,32 | 23,09 | 61,33 |

**Aucune fenêtre maximale n'est retenue.** `windowChosen` vaut `null` sur chaque
ligne. Les valeurs 1/2/3/5/10/20/40 déjà regardées ailleurs sont du
développement, pas des seuils à promouvoir — les écarts sont livrés bruts.

## Rail opposé — exposé, jamais déplacé

| état de l'opposé | rails `flank-only` |
|---|---:|
| `opposite-not-replayable` | 104 |
| `opposite-flank-only` | 34 |
| `opposite-candidate` | 23 |
| `opposite-other-abstention` | 7 |
| `opposite-no-candidate` | 1 |

`railMoved: false` sur chaque ligne. Ces états servent à évaluer **plus tard**
une architecture de type `lock-resolved-rail` ; le shadow n'en évalue aucune.

## Évaluation post hoc — après coup, et seulement après

La référence humaine n'entre que dans `postHocEvaluation`, une fois les trois
autres blocs construits. Convention d'évaluation `≤ 0,010 unité de scène` :
**métrique de banc uniquement**, jamais un seuil runtime, jamais une calibration
physique, jamais un millimètre.

| verdict sur les 169 `flank-only` | rails |
|---|---:|
| **seed satisfaisant** | **134** |
| seed insuffisant, **autre candidat** satisfaisant | **10** |
| aucun candidat exposé satisfaisant | 25 |
| référence absente / ambiguë / non qualifiable | 0 |

Les 10 récupérations se répartissent **5 `surfaceIntersection` / 5 `alternative`**
— exactement l'observation qui interdit de coder une préférence de famille. Le
shadow expose les trois familles et n'en privilégie aucune.

> **Lecture, strictement descriptive.** Sur 169 rails où le moteur s'abstient
> faute d'appui de flanc, son propre `seed` tombe déjà sous la convention
> d'évaluation dans 134 cas. C'est une observation sur une population **non
> indépendante de l'humain** (voir la limite ci-dessous), et **aucune conclusion
> opérationnelle n'en est tirée ici** : ni seuil, ni score, ni règle.

### Limite d'échantillonnage, reprise du lot précédent

L'éligibilité de la collecte dépend en partie de la disponibilité de la référence
humaine. Les 313 rails rejoués ne sont donc **pas un échantillon indépendant**,
et aucun taux mesuré ici ne doit être extrapolé aux 611 cuts.

## Anomalie — la session dégradée annoncée n'existe pas

La consigne nomme `0c58c033-f2e7-4aa5-ad8c-80b081a83932` comme session signalant
des événements perdus. **Elle est absente de la collecte.** Les trois sessions
présentes sont `f938b9f8…`, `92dbb85e…` et `06c77393…`.

Vérifié en outre sur ces trois : `dropped = 0`, `sendFailures = 0`,
`degradationEvents = 0`, `degradationPeak = FULL`, et **aucun trou de séquence
d'événements** (`nextEventSeq` égale le nombre d'événements exportés). Aucune
perte n'est donc constatée.

Le mécanisme de marquage est néanmoins **implémenté et testé** : chaque ligne
porte une tranche, et lorsqu'une session dégradée est présente, la frontière est
le dernier snapshot explicitement sans perte, avec
`before-last-lossless-snapshot` / `after-last-lossless-snapshot` et
`excludedFromCausalAnalysis` sur la tranche tardive. Ici, les 1358 lignes portent
`not-applicable` — **jamais un mélange silencieux**.

## Artefacts et reproduction

- `tools/flank-support-shadow.cjs` — le banc ;
- `audit/flank-support-shadow-v1.json` — une ligne par rail, quatre blocs
  séparés : `decisionFeatures`, `causalHistory`, `oppositeRailContext`,
  `postHocEvaluation` ;
- `tests/flank-support-shadow.test.cjs` — 15 tests, qui ne relisent jamais la
  collecte.

Empreinte du contenu, horodatage exclu, **deux exécutions donnent la même** :
`7548e6eba4bed2e45540deb7b97658a9b6420c2297b6297185c648395d1211e1`.

```bash
node tools/flank-support-shadow.cjs <dossier-collecte> --output audit/flank-support-shadow-v1.json
node --test tests/flank-support-shadow.test.cjs
```
