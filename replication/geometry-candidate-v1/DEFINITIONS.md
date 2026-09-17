# Geometry Candidate V1 — définitions exactes

Aucune paraphrase opérationnelle. Les extraits sont les fonctions exécutées par `run.cjs` via `pinned/`. Chemins relatifs à `pinned/`.

Coordonnées : **unités de scène**. U = latéral profil-local signé (`sign * q[1]`), Z = `q[2]`. Ce n’est pas du millimètre.

---

## 1. Population des points pour la médiane U

`prepareFrame` (`tools/no-support-generator-lab-v1.cjs`) construit `frame.points` :

- transformation `sceneRelativeToProfileLocal` ;
- `u = sign * q[1]`, `z = q[2]` ;
- boîte d’acceptation par défaut `{ lat: 0.18, z: 0.10, x: 0.5 }` — **plus large que searchY/searchZ** ; ce n’est pas la fenêtre de recherche.

`hypothesesA` (`tools/u-hypothesis-lab-v1.cjs`) :

```
function hypothesesA(points) {
  const u = median(points.map(p => p[0]));
  return Number.isFinite(u) ? [{ u: round6(u), source: 'median-all', score: points.length }] : [];
}
```

`median` : tri croissant ; n impair → élément central ; n pair → moyenne des deux centraux.

**Seed A_STAR** (`tools/face-aware-arbitration-v1.cjs` `aStarLab`) :

```
const hA = U.hypothesesA(frame.points);
const uMed = hA[0] && Number.isFinite(hA[0].u) ? hA[0].u : frame.uMedian;
return { uSeeds: [uMed], replaceOrigin: false, recenterWindow: true };
```

Une seule graine : médiane U de **tous** les `frame.points`. Pas la nappe haute. Pas un histogramme.

---

## 2. replaceOrigin:false

Dans `src/geometry.js` `propose` :

```
const uCenters=[0];
if(lab){
  if(Array.isArray(lab.uSeeds)){
    const seeds=lab.uSeeds.filter(u=>Number.isFinite(u));
    if(seeds.length){
      if(lab.replaceOrigin)uCenters.length=0;
      for(const u of seeds)if(!uCenters.some(c=>Math.abs(c-u)<1e-9))uCenters.push(u);
    }
  }
```

`replaceOrigin:false` ⇒ **on ne vide pas** `[0]`. Les graines s’ajoutent. A_STAR cherche donc autour de **0 et uMedian**.

---

## 3. recenterWindow:true

Recherche : pour chaque `cu` de `uCenters`, `search(cu, 0, searchY, searchZ, grid, true)`.

`searchY = 0.08`, `searchZ = 0.04`, `grid = 0.003` (DEFAULTS, pas un searchY global).

La fenêtre s’applique dans le **repère profil-local (U,Z)** du rail, pas en scène brute.

Après intersection des nappes, la fenêtre de publication :

```
let uWindowOk=Math.abs(surfaceU)<=cfg.searchY+.01;
if(lab&&lab.recenterWindow)uWindowOk=uCenters.some(cu=>Math.abs(surfaceU-cu)<=cfg.searchY+.01);
```

`recenterWindow:true` : `|surfaceU - cu| ≤ searchY + 0.01` pour **au moins un** centre (0 ou uMedian).  
`|surfaceZ| ≤ searchZ + 0.01` reste centré sur **0** (Z n’est pas recentré).

`replaceOrigin:false` + `recenterWindow:true` : l’origine du profil reste 0 ; la fenêtre U est acceptée autour de 0 **ou** de la médiane.

---

## 4. Grille et raffinement

```
function search(cu,cz,ry,rz,step,retain=false){
  for(let u=cu-ry;u<=cu+ry+1e-10;u+=step)
    for(let z=cz-rz;z<=cz+rz+1e-10;z+=step){
      const score=loss(topAnchors,u,z)+loss(faceAnchors,u,z)+1e-7*(Math.abs(u)+Math.abs(z));
      if(retain)coarse.push({loss:score,u,z});
      if(score<best.loss)best={loss:score,u,z};
    }
}
```

Puis `search(best.u,best.z,.004,.004,.001)` (pas de `retain` : raffinement hors pool coarse).

Loss template : médiane des distances² aux ancres tête/flanc, plafond 0.025², plus `1e-7*(|u|+|z|)`.

---

## 5. Candidate pool (S1)

`onCoarse` capture la grille coarse. `reducePool` (`face-aware-arbitration-v1.cjs`) conserve, dédupliqués par `round6(u)+','+round6(z)` :

- min-loss global du coarse ;
- min-loss parmi `topRows ≥ minTop` ;
- **local minima** 8-voisinage grille (`localMinima`, pas 0.02) ;
- extras : coarse-best, astar-published, engine-published ;
- si dense STRONG (`topRows≥15`) : local-min STRONG + min-loss STRONG ;
- si dense PARTIAL : local-min PARTIAL + min-loss PARTIAL.

Le pool est trié par **loss croissante**. S1 n’utilise que ce pool réduit, pas tout le coarse.

---

## 6. STRONG

```
function qualifyStrong(c) {
  return c.topRows >= G.DEFAULTS.minTop
      && c.faceCount >= G.DEFAULTS.minFace
      && !c.slopeLimited
      && c.windowOk;
}
```

`minTop=15`, `minFace=6`. `slopeLimited` vient de `robustLine` (pente clampée à ±0.5). `windowOk` : intersection dans la fenêtre recentrée.

`alreadyQualified(astar)` pour S1 (publication A_STAR, pas le pool) :

```
astar.status === 'candidate'
&& topRows >= 15 && faceCount >= 6 && !slopeLimited
```

Pas de test `windowOk` ici : un candidat publié l’a déjà passé.

PARTIAL_FACE = `3 ≤ faceCount < 6`. WEAK_FACE = `faceCount < 3`. **S1 ne publie ni PARTIAL ni WEAK.**

---

## 7. Lmin, loss/Lmin, zéros

```
function lminOf(pool, astar) {
  let m = null;
  for (const c of pool || []) {
    if (Number.isFinite(c.loss) && (m == null || c.loss < m)) m = c.loss;
  }
  if (m == null && Number.isFinite(astar?.loss)) m = astar.loss;
  return m;
}

function lossRatio(loss, lmin) {
  if (!Number.isFinite(loss) || !Number.isFinite(lmin)) return Infinity;
  if (lmin <= 0) return loss <= 0 ? 1 : Infinity;
  return loss / lmin;
}

function inCompetitive(c, lmin) {
  return Number.isFinite(c?.loss) && lossRatio(c.loss, lmin) <= RATIO;
}
```

`RATIO = G.DEFAULTS.minTemplateLossRatio = 1.5`.

Si `Lmin ≤ 0` : loss ≤ 0 → ratio 1 (compétitif) ; loss > 0 → Infinity (hors set).

Competitive set : `loss / Lmin ≤ 1.5`. Hors set : ignoré par S1.

---

## 8. Clustering spatial

```
function spatialClusters(cells, sep = SEP) {
  // union-find ; union si hypot(u,z) < sep
}
```

`SEP = G.DEFAULTS.alternativeSeparation = 0.02`. Seuil **strictement inférieur** (`< 0.02`).

Uniquement sur les cellules **STRONG et compétitives**.

- 1 cluster STRONG → `pickMinLoss` (min loss du cluster) → publication si STRONG admissible ;
- \>1 cluster → `AMBIGUOUS`, `changed: false`, `activated: true`, pick null ;
- 0 STRONG compétitif → motif A_STAR conservé, `changed: false`, `activated: true`.

Si A_STAR déjà STRONG : **aucun arbitrage**, `activated: false`.

---

## 9. Composition Candidate V1

`analyseAssembled` publie **S1** (`policies.S1`), jamais S2.

S2 existe dans le fichier pinned mais `COMPOSITION.excluded = ['S2']`.

---

## 10. Loader 239/239

Dataset : `StoryNow30/banane-data` branche `infra/materialized-native-v46-v1` @ `d541686d3a98569125cdbdb261ef121c9f533d6a`, chemin `datasets/native-v4.6-2026-09-16`.

`loadShardedDocument` saute `clouds` / `events` / `rails` à la lecture records. Rails hydratés à la demande (`ensureRailsDictionary`). Chunks : `loadNeededChunks` puis `loadNeededChunksComplete` :

1. shards `array-shards` clouds ;
2. `exactDoc.clouds` ;
3. objets shards dont le JSON contient l’id ;
4. **repli** : parcours des fichiers `root-object*` ou `*clouds*.json` (nuages inline dans des shards racine — règle des 18 anciens « absents »).

`run.cjs` **s’arrête** si `assembled !== 239`.

Lock : `pinned/audit/rsf-population-v1.json` (63 failures + 176 controls). Identités seulement.

Visite : dernier stamp par `visitId`. Clé : `sessionId|visitId|part|cut|side`.
