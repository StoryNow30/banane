# Running Surface Failure Replication V2

Lot séparé, lecture seule.  
Branche `lab-running-surface-failure-replication-v2`.  
Parent exact `3256d8b329bfa9a9ab13a6b93f2ac78d786f9096`.  
Référence moteur V4.6 `src/engine.js`  
`f7d3ea2232199b1c994caed1805f7463bceed96b23b68a055b4b23ca88272dd3`.

Aucun runtime modifié. Aucun seuil choisi. Aucun correctif.  
Le traceur n’est pas `G.propose`.  
Branche Claude `lab-running-surface-failure-v1` non consultée. Rien n’est mergé.

## Commande

```bash
node tools/running-surface-failure-replication-v2.cjs \
  --output audit/running-surface-failure-replication-v2.json
node --test tests/running-surface-failure-replication-v2.test.cjs
```

Si l’artefact JSON manque, les tests le régénèrent via `build()`.  
Données prévues par le dépôt : CGD, ombre Flank Support, corpus d’incidents versionné, hashes gelés.

Les archives Natif **ne sont pas dans le clone**. Le banc les cherche dans :

- `BANANE_NATIVE_DIR` / `BANANE_NATIVE_HISTORICAL` / `BANANE_NATIVE_FINAL`
- `datasets/native-v46/` et `datasets/native/reference/Banane/`
- `/tmp/native-v46/`

Archives attendues, non présentes ici :

| archive | octets | SHA-256 |
|---|---:|---|
| `banane-native-v4.6-2026-09-16.7z` (historique) | 34 509 008 | `32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0` |
| `banane-native-v4.6-2026-09-16-final.7z` (complément) | 56 657 500 | `7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66` |

Statut mesuré sur ce clone : **63 / 63 `archives-natives-absentes-du-clone`**.  
0 rail rejoué avec nuage. 0 fail-closed de snapshot/chunk (aucune visite n’a été assemblée).  
Les compteurs de paysage (q1–q5) restent `null`, pas zéro.

## Traceur

Recopie mécanique hors ligne. Constantes uniquement depuis `G.DEFAULTS` et les littéraux de `geometry.js` :

- recherche grossière `searchY=0.08`, `searchZ=0.04`, `grid=0.003` ;
- raffinement `±0.004` pas `0.001` ;
- `topRows` : `u+.012 … u+width-.012` et `|z−best.z| < topBand(0.012)` ;
- `robustLine` exige `length >= 3` — porte « Plan de roulement non estimable. ».

Deux champs séparés, jamais fusionnés : `templateLoss` et `topSupportCount`.  
Assemblage Natif : `exactSnapshot` fail-closed (aucun repli sur le dernier snapshot), chunks nommés seulement.

Familles exclusives, dans cet ordre, **uniquement après rejeu** :

1. `aucun-placement-supporté-dans-espace-exploré`
2. `support-perdu-après-raffinement`
3. `support-ailleurs-loss-supérieure`
4. `support-présent-au-best-refined`
5. `autre-observé`

Sans nuage la famille publiée est `untraced`. Ce n’est pas un mécanisme.

## Validation du traceur

Sur les 10 rails du corpus d’incidents versionné : **10/10 identiques au moteur**, 0 divergence. Aucune tolérance n’a été ajoutée pour masquer un écart.

| cut | côté | moteur | signe | pts retenus | top coarse | top refined |
|---|---|---|---:|---:|---:|---:|
| 182 | L | candidate | +1 | 779 | 289 | 296 |
| 182 | R | candidate | −1 | 1077 | 335 | 344 |
| 199 | L | candidate | +1 | 1263 | 310 | 302 |
| 199 | R | candidate | −1 | 852 | 342 | 341 |
| 202 | L | candidate | +1 | 960 | 283 | 290 |
| 202 | R | candidate | −1 | 633 | 331 | 332 |
| 200 | L | candidate | +1 | 695 | 289 | 290 |
| 200 | R | unresolved (pente hors domaine) | −1 | 1029 | 26 | 26 |
| 207 | R | candidate | −1 | 721 | 327 | 323 |
| 207 | L | unresolved (roulement insuffisamment observé) | +1 | 87 | 17 | 14 |

Aucun de ces 10 rails n’atteint la porte `robustLine == null` (`topRows < 3`).  
207 L a encore 14 points après raffinement : assez pour estimer une droite, pas assez pour `minTop=15`. Ce n’est **pas** le motif des 63.

## Population des 63

Reconstituée depuis le CGD du dépôt, un rail à la fois. Le 64e no-candidate (`Intersection hors de la fenêtre expérimentale.`, 8/9656 G) est hors périmètre.

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
| rejoués avec nuage | **0** |
| fail-closed snapshot/chunk | **0** |
| archive absente | **63** |

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

Ce palier décrit une stratégie d’appariement. Il ne mesure pas le paysage de recherche des 63.

## Réponses

### 1. Combien des 63 n’ont aucun placement de la grille explorée avec `topRows.length >= 3` ?

**Non mesuré sur les 63** (`field63Traced = 0`, `count = null`).  
Laboratoire incidents : **0 / 10**.

### 2. Combien ont un placement supporté ailleurs, avec une loss supérieure au best ?

**Non mesuré sur les 63.**  
Incidents : le voisin supporté le plus proche est le best lui-même (dLoss numérique ≈ 0).

### 3. Combien avaient du support au coarse best puis le perdent au raffinement ?

**Non mesuré sur les 63.**  
Incidents : **0 / 10**. 207 L passe de 17 à 14 topRows — toujours `>= 3`.

### 4. Combien possèdent un voisin supporté ?

**Non mesuré sur les 63.**  
Incidents : **10 / 10**.

### 5. Distributions (best.z, coarse, refined, médiane z locale, Δz, distance aux bornes, fraction de grille)

Toutes les statistiques des 63 ont `n = 0`. Aucun chiffre n’est inventé.  
Incidents seulement : le laboratoire n’exhibe pas `topRows < 3` ; il ne représente pas les 63.

### 6. Comparaison échec / témoin `engine-candidate`

Stratégie ci-dessus, sans humain.  
Appariement : 46 / 0 / 17.  
Comparaison géométrique coarse/refined/grille : **non mesurée** (nuages absents des deux côtés de la paire).  
L’ombre donne le statut moteur du témoin (`engine-candidate`) et, pour les 63, l’absence de métriques exposées (`engineExposedMetrics: false` dans le CGD).

### 7. Droite / gauche

Terrain : 58 right / 5 left. Concentration, pas une preuve de miroir.  
Incidents : signe `+1` à gauche, `−1` à droite, cohérent avec `Math.sign(median(y local))`.  
**Aucune preuve directe d’un bug de signe ou de miroir.** `mirrorBugClaimed = false`.

### 8. Les trois sessions

| session | n échecs | engine-candidate dans l’ombre | remarque |
|---|---:|---:|---|
| `d9ccb545` | 35 | présents (palier 1) | part 1, surtout droite |
| `3876864f` | 17 | **0** | 17 no-candidate + 6 flank-only + 3 flank-with-others + 26 not-replayable |
| `0c58c033` | 10 | présents | tous `before-last-lossless-snapshot` |
| `92dbb85e` | 1 | présents | historique, cut 326 right |

La session 17/17 se distingue objectivement par l’absence totale d’`engine-candidate`. Aucune cause capteur n’est déduite.

### 9. Grappe part 1 / droite / cuts 5083–5276

**50** rails d’identité, 50 cuts distincts, min 5083 max 5276.  
Sessions : 34 × `d9ccb545` + 16 × `3876864f`.  
Paysage : non retracé. Famille publiée : `untraced` × 50.

## Accord vertical

Le bloc `verticalAgreement` est câblé (`formulation: désaccord vertical relatif observé`).  
Sur ce clone tous les champs numériques sont nuls faute de nuage. Aucune cause physique n’est énoncée.

## Limites

- Collecte Natif hors Git : questions 1–5 sur les 63 restent ouvertes.
- Le laboratoire incidents n’exhibe pas le motif `topRows < 3`.
- `propose` n’expose ni `best` ni `metrics` sur les 63 : le traceur ne les invente pas.
- Unités de scène, non calibrées indépendamment.
- `postHocEvaluation` est isolé et vide de toute référence humaine opératoire.
- Hashes runtime vérifiés contre les fichiers du dépôt.
- Ce lot ne propose aucun patch, aucune valeur de `searchZ` / `topBand` / `grid`.

## Livraison

Fichiers ajoutés seulement :

- `tools/running-surface-failure-replication-v2.cjs`
- `tests/running-surface-failure-replication-v2.test.cjs`
- `RUNNING_SURFACE_FAILURE_REPLICATION_V2.md`
- `audit/running-surface-failure-replication-v2.json`

SHA déterministe de l’artefact (hors `generatedAt` / `sha256`) :  
`bbaa2084c29c9e5aa889d950c27b452456692839e08d61ba6ad763a1f09d48ad`

Tests dédiés : 8 / 8.  
Hashes : geometry `3343330e…`, capture-core `2bc4a70b…`, lidar `375f7dfb…`, engine V4.6 `f7d3ea22…`.

Confirmations :

- aucun runtime modifié ;
- aucun seuil choisi ;
- aucun correctif appliqué ;
- aucune branche Claude consultée ;
- aucun merge.
