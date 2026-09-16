# Running Surface Failure Replication V1

Lot séparé, lecture seule.  
Branche `lab-running-surface-failure-replication-v1`.  
Parent exact `3256d8b329bfa9a9ab13a6b93f2ac78d786f9096`.  
Référence moteur V4.6 `src/engine.js`  
`f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3`.

Aucun runtime modifié. Aucun seuil choisi. Aucun correctif.  
Le traceur n’est pas `G.propose`.  
Branche Claude `lab-running-surface-failure-v1` non consultée. Rien n’est mergé.

## Commande

```bash
node tools/running-surface-failure-replication.cjs \
  --output audit/running-surface-failure-replication-v1.json
node --test tests/running-surface-failure-replication.test.cjs
```

Si l’artefact JSON manque, les tests le régénèrent via `build()`.  
Données prévues par le dépôt : CGD, ombre Flank Support, corpus d’incidents versionné, hashes gelés.  
`datasets/native/` est volontairement absent du clone (README du dépôt) : le paysage des 63 rails terrain n’est donc pas rejoué ici. Le banc le dit au lieu d’inventer des compteurs. Si les exports Natif sont remis dans `datasets/native/reference/Banane/`, le même outil retrace les visites qu’il sait joindre.

## Traceur

Recopie mécanique. Constantes uniquement depuis `G.DEFAULTS` et les littéraux de `geometry.js` :

- recherche grossière `searchY=0.08`, `searchZ=0.04`, `grid=0.003` ;
- raffinement `±0.004` pas `0.001` ;
- `topRows` : `u+.012 … u+width-.012` et `|z−best.z| < topBand(0.012)` ;
- `robustLine` exige `length >= 3` — porte « Plan de roulement non estimable. ».

Deux champs séparés, jamais fusionnés : `templateLoss` et `topSupportCount`.

## Validation du traceur

Sur les 10 rails du corpus d’incidents versionné : **10/10 identiques au moteur**, 0 divergence. Aucune tolérance n’a été ajoutée pour masquer un écart.

| cut | côté | moteur | signe | pts retenus | top coarse | top refined | face refined |
|---|---|---|---:|---:|---:|---:|---:|
| 182 | L | candidate | +1 | 779 | 289 | 296 | 58 |
| 182 | R | candidate | −1 | 1077 | 335 | 344 | 66 |
| 199 | L | candidate | +1 | 1263 | 310 | 302 | 56 |
| 199 | R | candidate | −1 | 852 | 342 | 341 | 57 |
| 202 | L | candidate | +1 | 960 | 283 | 290 | 56 |
| 202 | R | candidate | −1 | 633 | 331 | 332 | 52 |
| 200 | L | candidate | +1 | 695 | 289 | 290 | 66 |
| 200 | R | unresolved (pente hors domaine) | −1 | 1029 | 26 | 26 | 24 |
| 207 | R | candidate | −1 | 721 | 327 | 323 | 48 |
| 207 | L | unresolved (roulement insuffisamment observé) | +1 | 87 | 17 | 14 | 10 |

Aucun de ces 10 rails n’atteint la porte `robustLine == null` (`topRows < 3`).  
207 L a encore 14 points après raffinement : assez pour estimer une droite, pas assez pour `minTop=15`. Ce n’est **pas** le motif des 63.

## Population des 63

Reconstituée depuis le CGD du dépôt, un rail à la fois. Le 64e no-candidate (intersection hors fenêtre, 8/9656 G) est hors périmètre.

| | n |
|---|---:|
| total `Plan de roulement non estimable.` | **63** |
| historical-original | 1 (`92dbb85e` part 1 cut 326 right) |
| complément dit « final » | 62 |
| `d9ccb545…` | 35 |
| `3876864f…` | **17** |
| `0c58c033…` (session dégradée) | 10 |
| right / left | **58 / 5** |
| part 1 / part 2 | 53 / 10 |
| `lossless-throughout` | 53 |
| `before-last-lossless-snapshot` | 10 (les 10 de `0c58c033`, pas la queue dégradée) |

## Témoins — méthode publiée

Aucun matching sur une référence humaine.

1. même session + même côté + cut le plus proche parmi `engine-candidate` ;
2. sinon même session + même côté (non utilisé : le palier 1 absorbe ces cas) ;
3. sinon même côté dans une session saine (ni dégradée, ni la session 17/17).

Résultat sur l’ombre du dépôt :

- **46 / 63** palier 1 ;
- **0** palier 2 ;
- **17 / 63** palier 3 — exactement les 17 de `3876864f`. Cette session n’offre **aucun** `engine-candidate` (aucun côté) ;
- 0 échec sans témoin ;
- 14 témoins distincts.

## Réponses

### 1. Combien des 63 ont un coarse best déjà non supporté ?

**Non mesuré sur les 63** (captures absentes du clone).  
Laboratoire incidents : **0 / 10** à la porte `topRows < 3`, coarse comme refined.

### 2. Combien perdent le support uniquement après raffinement ?

**Non mesuré sur les 63.**  
Incidents : **0 / 10**. 207 L passe de 17 à 14 topRows — toujours `>= 3`.

### 3. Combien possèdent un placement supporté voisin ?

**Non mesuré sur les 63.**  
Incidents : **10 / 10** ont au moins un placement exploré avec `topRows >= 3` (souvent le best lui-même).

### 4. Combien n’en possèdent aucun dans l’espace exploré ?

**Non mesuré sur les 63.**  
Incidents : **0 / 10**.

### 5. Distribution de la différence de loss best ↔ voisin supporté

Incidents seulement, descriptive, **pas une règle de sélection** :

| | dLoss |
|---|---|
| n | 10 |
| min | ≈ 0 (bruit −3.6e-20) |
| médiane | ≈ 0 |
| max | ≈ 5.2e-21 |

Sur ce laboratoire le voisin supporté le plus proche est le best (ou une maille numériquement équivalente). Rien n’est transféré aux 63.

### 6. Les échecs forment-ils plusieurs familles internes ?

Au niveau **identité**, oui, trois grappes disjointes :

- `d9ccb545` 35, surtout rail droit part 1, témoins locaux palier 1 ;
- `3876864f` 17/17, zéro candidat moteur dans la session, témoins palier 3 ;
- `0c58c033` 10, session dégradée, tous **avant** le dernier snapshot sans perte.

Au niveau **paysage de recherche**, une famille unique n’est pas démontrée : les 63 n’ont pas été retracés.

### 7. Asymétrie droite/gauche — signature géométrique mesurable ?

- Terrain : 58 right / 5 left. Concentration, pas une preuve de miroir.
- Incidents : signe `+1` à gauche, `−1` à droite, cohérent avec `Math.sign(median(y local))` puis `sign * q[1]`.
- Best.u des incidents n’est pas collé à une seule borne ; 182 R / 199 R s’approchent de `u ≈ −0.045` sans être sur le bord `±0.08`.
- **Aucune preuve directe d’un bug de signe ou de miroir.** Une telle conclusion est refusée.

### 8. La session 17/17 se distingue-t-elle objectivement ?

**Oui, sans déduire de cause capteur.**

Ombre de `3876864f` : 17 no-candidate, 6 flank-only, 3 flank-with-others, 26 not-replayable, **0 engine-candidate**.  
Les 17 témoins tombent donc au palier 3.  
`d9ccb545` a 19 engine-candidate ; `0c58c033` en a 40 ; l’historique `92dbb85e` en a 31.

### 9. Mécanisme à prototyper ensuite

`selection-par-perte-de-gabarit-sans-contrainte-de-support-de-roulement`

Nom seulement. Aucune valeur, aucun patch.  
Contrôle déjà écrit dans `geometry.js` : la grille minimise `loss(topAnchors)+loss(faceAnchors)`, puis `robustLine(topRows)` est évalué seulement autour de `best`. Le support de roulement n’entre pas dans le choix du best.

## Limites

- Collecte Natif hors Git : questions 1–4 sur les 63 restent ouvertes.
- Le laboratoire incidents n’exhibe pas le motif `topRows < 3`.
- `propose` n’expose ni `best` ni `metrics` sur les 63 : le traceur ne peut pas les inventer sans nuage.
- Unités de scène, non calibrées indépendamment.
- `postHocEvaluation` est isolé et vide de toute référence humaine opératoire.
- Hashes runtime vérifiés contre les fichiers du dépôt.

## Livraison

Fichiers ajoutés seulement :

- `tools/running-surface-failure-replication.cjs`
- `tests/running-surface-failure-replication.test.cjs`
- `RUNNING_SURFACE_FAILURE_REPLICATION_V1.md`
- `audit/running-surface-failure-replication-v1.json`

SHA déterministe de l’artefact (hors `generatedAt` / `sha256`) :  
`e3ea2ff0eac6ec496410ba8e55680f58235e15307bf1c118fd0ba176bf640bcd`

Tests dédiés : 7 / 7.  
Hashes : geometry `3343330e…`, capture-core `2bc4a70b…`, lidar `375f7dfb…`, engine V4.6 `f7d3ea22…`.
