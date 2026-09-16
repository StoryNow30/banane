#!/usr/bin/env node
'use strict';
/* Running Surface Failure Lab V1 — HORS LIGNE, LECTURE SEULE.
 *
 * Question unique : pourquoi la recherche choisit-elle un placement `best`
 * autour duquel moins de trois points permettent ensuite d'estimer le plan de
 * roulement ?
 *
 * CE LOT NE CORRIGE RIEN. Aucun runtime, `geometry.js`, moteur, Brain, Pair
 * Arbitration, seuil, DEFAULT ou politique n'est modifié. Aucun rayon, aucun
 * seuil opérationnel n'est choisi. Aucune hypothèse n'est adoptée.
 *
 * TRACEUR SECONDAIRE, PAS LE MOTEUR
 * ---------------------------------
 * `G.propose` n'expose pas `best` quand il abandonne avant de construire ses
 * métriques. Le diagnostic exige donc un traceur hors ligne qui rejoue les
 * étapes internes. Ce traceur est une INSTRUMENTATION : il n'est jamais
 * considéré comme faisant autorité.
 *
 * Il réduit sa surface de divergence en appelant directement les fonctions
 * exportées par le moteur gelé — `G.median`, `G.robustLine` — et
 * `C.point` de `capture-core`. Ne sont reproduits que les fragments que le
 * moteur n'exporte pas : filtrage local, ancres, fonction de perte, boucles de
 * recherche. L'accumulation flottante des boucles (`u += step`) est reproduite
 * TELLE QUELLE, car remplacer `u += step` par `u0 + i*step` donnerait une
 * grille différente au dernier bit.
 *
 * VÉRIFICATION OBLIGATOIRE. Sur chaque rail où `G.propose` publie assez
 * d'informations, le traceur est confronté au moteur sur : points locaux
 * retenus, ancres, coarse best, refined best, seed, topRows, ajustement du
 * plan de roulement, et motif de sortie. Toute divergence non expliquée fait
 * ÉCHOUER le banc — `verification.unexplainedDivergences` doit rester vide.
 *
 * RÉFÉRENCE HUMAINE. Aucun champ humain n'entre dans la reconstruction du
 * paysage de recherche, le choix du `best`, la détection du support supérieur
 * ou la taxonomie des échecs. Elle n'apparaît qu'après coup, dans
 * `postHocEvaluation`, et reste observationnelle.
 *
 * UNITÉS de scène, jamais des millimètres.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const G = require('../src/geometry.js');
const N = require('./native-replay.cjs');
const F = require('./flank-support-shadow.cjs');

const ROOT = path.resolve(__dirname, '..');
const FAILURE_REASON = 'Plan de roulement non estimable.';
const TOLERANCE_ORACLE = 0.010;
/** `robustLine` rend `null` en dessous de trois lignes : c'est LA condition étudiée. */
const MIN_ROWS_FOR_LINE = 3;

const norm = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ========================= TRACEUR — miroir du moteur gelé =================
 * Chaque bloc porte la ligne de `src/geometry.js` qu'il reproduit. Aucune
 * valeur humaine n'est lue ici.                                             */

/**
 * Rejoue `propose` en conservant ses états intermédiaires.
 *
 * Renvoie `{ exit, ... }` où `exit` est le motif que le moteur aurait rendu, et
 * les champs déjà calculés au moment de cette sortie. La structure suit
 * exactement l'ordre du moteur : un abandon laisse `null` tout ce qui n'avait
 * pas encore été construit, jamais une valeur reconstituée après coup.
 */
function trace(capture, side, cfg = G.DEFAULTS) {
  const rail = capture.rails?.[side];
  const out = { exit: null, sign: null, pointsLocal: null, width: null,
                topAnchors: null, faceAnchors: null, coarseBest: null, alternative: null,
                templateLossRatio: null, refinedBest: null, seed: null,
                topRowsAtRefined: null, top: null, coarseLandscape: null };
  if (!capture.pointsSceneRelative?.length) return { ...out, exit: 'Aucun point LiDAR disponible.' };
  const contour = rail.profileContours?.reduce(
    (a, b) => (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a, null);
  if (!contour) return { ...out, exit: 'Contour du profil absent.' };
  const shape = contour.verticesSceneRelative.map(p => C.point(rail.sceneRelativeToProfileLocal, p));
  const sign = Math.sign(G.median(shape.map(p => p[1])));
  if (!sign) return { ...out, exit: 'Sens du profil ambigu.' };
  out.sign = sign;
  const vertices = shape.map(p => [sign * p[1], p[2]]), head = vertices.filter(p => p[1] > -0.04);
  if (head.length < 6) return { ...out, exit: 'Contour de champignon non reconnu.' };
  const points = [];
  for (let i = 0; i < capture.pointsSceneRelative.length; i++) {
    if (capture.visibleByClipBoxes?.[i] === false) continue;
    if (!Array.isArray(capture.pointsSceneRelative[i])
        || !capture.pointsSceneRelative[i].every(Number.isFinite)) continue;
    const q = C.point(rail.sceneRelativeToProfileLocal, capture.pointsSceneRelative[i]);
    if (q.every(Number.isFinite) && Math.abs(q[0]) <= 0.5 && Math.abs(q[1]) < 0.18 && Math.abs(q[2]) < 0.10)
      points.push([sign * q[1], q[2], q[0]]);
  }
  out.pointsLocal = points.length;
  if (points.length < 8) return { ...out, exit: 'Trop peu de points autour du champignon.' };
  const width = Math.max(...head.filter(p => p[1] > -0.012).map(p => p[0]));
  out.width = width;
  if (!(width > 0.025 && width < 0.12)) return { ...out, exit: 'Dimensions du profil hors du domaine testé.' };
  const topAnchors = [];
  for (let u = 0.012; u < width - 0.012; u += 0.006) {
    const near = head.filter(p => Math.abs(p[0] - u) < 0.004);
    if (near.length) topAnchors.push([u, Math.max(...near.map(p => p[1]))]);
  }
  const faceAnchors = [];
  for (let z = -0.014; z >= -0.033; z -= 0.004) {
    const near = head.filter(p => Math.abs(p[1] - z) < 0.004);
    if (near.length) faceAnchors.push([Math.min(...near.map(p => p[0])), z]);
  }
  out.topAnchors = topAnchors.length; out.faceAnchors = faceAnchors.length;
  if (topAnchors.length < 3 || faceAnchors.length < 3)
    return { ...out, exit: 'Surfaces du profil non identifiées.' };

  const loss = (anchors, u, z) => G.median(anchors.map(a => {
    let b = 0.025 * 0.025;
    for (const p of points) {
      const d = (p[0] - u - a[0]) ** 2 + (p[1] - z - a[1]) ** 2;
      if (d < b) b = d;
    }
    return b;
  }));

  let best = { loss: Infinity, u: 0, z: 0 };
  const coarse = [];
  /* L'accumulation `u += step` est celle du moteur : la reproduire à
   * l'identique est indispensable pour que la grille coïncide au dernier bit. */
  const search = (cu, cz, ry, rz, step, retain = false) => {
    for (let u = cu - ry; u <= cu + ry + 1e-10; u += step)
      for (let z = cz - rz; z <= cz + rz + 1e-10; z += step) {
        const score = loss(topAnchors, u, z) + loss(faceAnchors, u, z) + 1e-7 * (Math.abs(u) + Math.abs(z));
        if (retain) coarse.push({ loss: score, u, z });
        if (score < best.loss) best = { loss: score, u, z };
      }
  };
  search(0, 0, cfg.searchY, cfg.searchZ, cfg.grid, true);
  const coarseBest = { ...best };
  let alternative = null;
  for (const candidate of coarse) {
    if (Math.hypot(candidate.u - coarseBest.u, candidate.z - coarseBest.z) < cfg.alternativeSeparation) continue;
    if (!alternative || candidate.loss < alternative.loss) alternative = candidate;
  }
  const templateLossRatio = alternative && coarseBest.loss > 0 ? alternative.loss / coarseBest.loss : Infinity;
  search(best.u, best.z, 0.004, 0.004, 0.001);
  out.coarseBest = coarseBest; out.alternative = alternative;
  out.templateLossRatio = Number.isFinite(templateLossRatio) ? templateLossRatio : null;
  out.refinedBest = { ...best };
  out.seed = [sign * best.u, best.z];

  /** Lignes du plan de roulement pour un placement donné — `geometry.js:78`. */
  const topRowsAt = (u, z) => points.filter(p =>
    p[0] > u + 0.012 && p[0] < u + width - 0.012 && Math.abs(p[1] - z) < cfg.topBand).map(p => [p[0], p[1]]);
  const rows = topRowsAt(best.u, best.z);
  out.topRowsAtRefined = rows.length;
  out.topRowsAtCoarse = topRowsAt(coarseBest.u, coarseBest.z).length;
  /* Où sont réellement les points locaux, et la bande du plan de roulement
   * peut-elle seulement les atteindre ? Purement descriptif : l'enveloppe est
   * celle que la grille du moteur balaie, aucune nouvelle borne n'est posée.
   * `|p[1] − z| < topBand` avec `|z| ≤ searchZ` ⇒ la bande ne couvre jamais
   * au-delà de `searchZ + topBand` en valeur absolue. */
  const reachZ = cfg.searchZ + cfg.topBand;
  const zs = points.map(p => p[1]).sort((a, b) => a - b);
  const us = points.map(p => p[0]).sort((a, b) => a - b);
  const qq = (arr, t) => arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * t))];
  out.localPointGeometry = {
    zMin: zs[0], zP25: qq(zs, 0.25), zMedian: qq(zs, 0.5), zP75: qq(zs, 0.75), zMax: zs[zs.length - 1],
    uMin: us[0], uMedian: qq(us, 0.5), uMax: us[us.length - 1],
    reachableZAbs: reachZ,
    pointsWithinReachableZ: points.filter(p => Math.abs(p[1]) < reachZ).length,
    pointsOutsideReachableZ: points.filter(p => Math.abs(p[1]) >= reachZ).length,
    total: points.length,
  };
  out.coarseLandscape = { grid: coarse, topRowsAt };
  const top = G.robustLine(rows);
  if (!top) return { ...out, exit: FAILURE_REASON };
  out.top = { count: top.count, residual: top.residual, slope: top.slope,
              slopeLimited: top.slopeLimited, intercept: top.intercept };
  /* Le traceur s'arrête ici : au-delà, le moteur publie ses métriques et
   * redevient sa propre source de vérité. */
  return { ...out, exit: 'au-dela-du-point-etudie' };
}

/* ===================== VÉRIFICATION traceur contre moteur ================== */

const near = (a, b, tol = 1e-9) => a === null || b === null || a === undefined || b === undefined
  ? a === b : Math.abs(a - b) <= tol;

/**
 * Confronte le traceur au moteur sur tout ce que le moteur publie.
 *
 * Les champs comparés dépendent de l'endroit où le moteur s'est arrêté : un
 * abandon précoce ne publie rien à comparer, et c'est dit plutôt que masqué.
 */
function verifyAgainstEngine(tr, proposal) {
  const checks = [], add = (name, a, b, ok) => checks.push({ name, tracer: a, engine: b, ok });
  const reason = proposal.status === 'candidate' ? null : (proposal.reasons || []).join(' ');
  const m = proposal.metrics ?? null;

  /* motif de sortie — comparable dans tous les cas */
  const tracerSaysFailure = tr.exit === FAILURE_REASON;
  const engineSaysFailure = reason === FAILURE_REASON;
  add('exitReason', tr.exit, reason ?? '(candidate)', tracerSaysFailure === engineSaysFailure);
  if (tr.exit !== 'au-dela-du-point-etudie' && !tracerSaysFailure)
    add('earlyExitMatches', tr.exit, reason, tr.exit === reason);

  if (!m) return { comparable: checks.length, checks, divergences: checks.filter(c => !c.ok) };

  /* le moteur a publié ses métriques : tout devient comparable */
  add('pointsLocal', tr.pointsLocal, m.points, tr.pointsLocal === m.points);
  add('seedY', tr.seed?.[0], m.seed?.[0], near(tr.seed?.[0], m.seed?.[0]));
  add('seedZ', tr.seed?.[1], m.seed?.[1], near(tr.seed?.[1], m.seed?.[1]));
  add('templateLoss', tr.refinedBest?.loss, m.templateLoss, near(tr.refinedBest?.loss, m.templateLoss));
  add('coarseBestLoss', tr.coarseBest?.loss, m.templateAmbiguity?.coarseBestLoss,
      near(tr.coarseBest?.loss, m.templateAmbiguity?.coarseBestLoss));
  add('alternativeLoss', tr.alternative?.loss ?? null, m.templateAmbiguity?.alternativeLoss ?? null,
      near(tr.alternative?.loss ?? null, m.templateAmbiguity?.alternativeLoss ?? null));
  const altEngine = m.templateAmbiguity?.alternative ?? null;
  const altTracer = tr.alternative ? [tr.sign * tr.alternative.u, tr.alternative.z] : null;
  add('alternativeY', altTracer?.[0] ?? null, altEngine?.[0] ?? null,
      near(altTracer?.[0] ?? null, altEngine?.[0] ?? null));
  add('alternativeZ', altTracer?.[1] ?? null, altEngine?.[1] ?? null,
      near(altTracer?.[1] ?? null, altEngine?.[1] ?? null));
  add('lossRatio', tr.templateLossRatio, m.templateAmbiguity?.lossRatio ?? null,
      near(tr.templateLossRatio, m.templateAmbiguity?.lossRatio ?? null, 1e-9));
  if (proposal.top) {
    add('topRows', tr.topRowsAtRefined, proposal.top.count, tr.topRowsAtRefined === proposal.top.count);
    add('topResidual', tr.top?.residual, proposal.top.residual, near(tr.top?.residual, proposal.top.residual));
    add('topSlope', tr.top?.slope, proposal.top.slope, near(tr.top?.slope, proposal.top.slope));
  }
  if (m.faceCount !== undefined && proposal.face)
    add('faceCount', proposal.face.count, m.faceCount, proposal.face.count === m.faceCount);
  return { comparable: checks.length, checks, divergences: checks.filter(c => !c.ok) };
}

/* ===================== PAYSAGE DE SUPPORT LOCAL ===========================
 * Descriptif seulement. Aucun rayon, aucun seuil n'est retenu : la grille est
 * celle du moteur, et les distances sont publiées brutes.                   */

/**
 * Où, sur la grille du moteur, existe-t-il assez de lignes pour ajuster le plan
 * de roulement — et à quel prix en perte ?
 *
 * La grille EST celle de la recherche grossière : aucune résolution nouvelle
 * n'est introduite. `MIN_ROWS_FOR_LINE = 3` n'est pas un choix : c'est la
 * condition de `robustLine`, citée.
 */
function supportLandscape(tr) {
  if (!tr.coarseLandscape || !tr.refinedBest) return null;
  const { grid, topRowsAt } = tr.coarseLandscape;
  const b = tr.refinedBest;
  let supported = 0, nearest = null, bestLossSupported = null;
  const rowsByPoint = [];
  for (const g of grid) {
    const n = topRowsAt(g.u, g.z).length;
    rowsByPoint.push(n);
    if (n < MIN_ROWS_FOR_LINE) continue;
    supported++;
    const d = Math.hypot(g.u - b.u, g.z - b.z);
    if (!nearest || d < nearest.distance) nearest = { u: g.u, z: g.z, distance: d, loss: g.loss, topRows: n };
    if (!bestLossSupported || g.loss < bestLossSupported.loss)
      bestLossSupported = { u: g.u, z: g.z, loss: g.loss, topRows: n, distance: d };
  }
  /* distribution locale : anneaux successifs d'un pas de grille, exposés bruts */
  const step = G.DEFAULTS.grid, rings = [];
  for (let k = 1; k <= 8; k++) {
    const inner = (k - 1) * step, outer = k * step;
    let count = 0, withRows = 0, maxRows = 0;
    for (let i = 0; i < grid.length; i++) {
      const d = Math.hypot(grid[i].u - b.u, grid[i].z - b.z);
      if (d <= inner || d > outer + 1e-12) continue;
      count++;
      if (rowsByPoint[i] >= MIN_ROWS_FOR_LINE) withRows++;
      if (rowsByPoint[i] > maxRows) maxRows = rowsByPoint[i];
    }
    rings.push({ ring: k, radiusFrom: inner, radiusTo: outer, gridPoints: count,
                 pointsWithEnoughRows: withRows, maxTopRows: maxRows });
  }
  const sorted = rowsByPoint.slice().sort((a, b2) => a - b2);
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
  return {
    gridPoints: grid.length,
    gridPointsWithEnoughRows: supported,
    fractionWithEnoughRows: supported / grid.length,
    topRowsDistributionOverGrid: { min: sorted[0], p25: q(0.25), median: q(0.5), p75: q(0.75),
                                   max: sorted[sorted.length - 1] },
    nearestSupportedPlacement: nearest && { ...nearest,
      lossDelta: nearest.loss - tr.refinedBest.loss,
      lossRatioToBest: tr.refinedBest.loss > 0 ? nearest.loss / tr.refinedBest.loss : null },
    lowestLossSupportedPlacement: bestLossSupported && { ...bestLossSupported,
      lossDelta: bestLossSupported.loss - tr.refinedBest.loss,
      lossRatioToBest: tr.refinedBest.loss > 0 ? bestLossSupported.loss / tr.refinedBest.loss : null },
    localRings: rings,
    minRowsForLine: MIN_ROWS_FOR_LINE,
    minRowsIsEngineCondition: 'robustLine rend null en dessous de 3 lignes',
    gridIsEngineGrid: true, noRadiusChosen: true,
  };
}

/** Proximité du placement retenu avec les bornes de recherche du moteur. */
function boundProximity(tr, cfg = G.DEFAULTS) {
  if (!tr.refinedBest) return null;
  const b = tr.refinedBest, c = tr.coarseBest;
  return {
    searchY: cfg.searchY, searchZ: cfg.searchZ,
    refinedU: b.u, refinedZ: b.z,
    marginToBoundY: cfg.searchY - Math.abs(b.u), marginToBoundZ: cfg.searchZ - Math.abs(b.z),
    coarseAtBoundY: Math.abs(c.u) >= cfg.searchY - cfg.grid / 2,
    coarseAtBoundZ: Math.abs(c.z) >= cfg.searchZ - cfg.grid / 2,
    refinementShift: Math.hypot(b.u - c.u, b.z - c.z),
    refinementShiftU: b.u - c.u, refinementShiftZ: b.z - c.z,
    refinementLossGain: c.loss - b.loss,
  };
}

/* ===================== HYPOTHÈSES — testées, jamais adoptées ===============
 * Chaque drapeau dit si une observation est COMPATIBLE avec une hypothèse. Un
 * drapeau vrai n'est pas une conclusion.                                    */

const HYPOTHESES = [
  'minimum-dans-zone-sans-support-superieur',
  'raffinement-quitte-une-zone-supportee',
  'best-colle-a-une-borne-de-recherche',
  'aucun-placement-supporte-sur-toute-la-grille',
  'voisin-supporte-a-perte-quasi-egale',
  'minima-concurrents',
];

function hypothesisFlags(tr, land, bounds) {
  if (!land || !bounds) return null;
  return {
    'minimum-dans-zone-sans-support-superieur':
      tr.topRowsAtRefined < MIN_ROWS_FOR_LINE && land.gridPointsWithEnoughRows > 0,
    'raffinement-quitte-une-zone-supportee':
      tr.topRowsAtCoarse >= MIN_ROWS_FOR_LINE && tr.topRowsAtRefined < MIN_ROWS_FOR_LINE,
    'best-colle-a-une-borne-de-recherche': bounds.coarseAtBoundY || bounds.coarseAtBoundZ,
    'aucun-placement-supporte-sur-toute-la-grille': land.gridPointsWithEnoughRows === 0,
    'voisin-supporte-a-perte-quasi-egale': Boolean(land.nearestSupportedPlacement)
      && land.nearestSupportedPlacement.lossRatioToBest !== null
      && land.nearestSupportedPlacement.lossRatioToBest < 1.05,
    'minima-concurrents': tr.templateLossRatio !== null
      && tr.templateLossRatio < G.DEFAULTS.minTemplateLossRatio,
    note: 'compatibilité observée, jamais une conclusion ni une règle',
  };
}

/* ===================== FAMILLES D'ÉCHEC — descriptives ==================== */

const FAILURE_FAMILIES = [
  'aucun-support-nulle-part-sur-la-grille',
  'raffinement-a-quitte-le-support',
  'support-ailleurs-a-perte-quasi-egale',
  'support-ailleurs-mais-perte-nettement-superieure',
  'non-classe',
];

/**
 * Famille d'un échec. Purement descriptive et EXCLUSIVE : elle range, elle ne
 * prescrit rien. Le seuil 1,05 sert à SÉPARER deux familles d'observation et
 * n'est ni un paramètre moteur ni une valeur proposée ; il est publié comme
 * convention de description du banc.
 */
const FAMILY_SEPARATION_RATIO = 1.05;
function failureFamily(tr, land) {
  if (!land) return 'non-classe';
  if (land.gridPointsWithEnoughRows === 0) return 'aucun-support-nulle-part-sur-la-grille';
  if (tr.topRowsAtCoarse >= MIN_ROWS_FOR_LINE) return 'raffinement-a-quitte-le-support';
  const n = land.nearestSupportedPlacement;
  if (!n || n.lossRatioToBest === null) return 'non-classe';
  return n.lossRatioToBest < FAMILY_SEPARATION_RATIO
    ? 'support-ailleurs-a-perte-quasi-egale'
    : 'support-ailleurs-mais-perte-nettement-superieure';
}

/* ===================== FRONTIÈRE — l'humain entre ici seulement ============ */

function postHocEvaluation(visit, side, rail, tr, tol = TOLERANCE_ORACLE) {
  const ref = visit.humanFinalReference;
  const base = { humanStatus: ref?.status ?? 'absent', tolerance: tol, toleranceIsEvaluationOnly: true };
  if (!ref || ref.status !== 'candidate-observed' || !rail)
    return { ...base, qualified: false, humanDeltaLocal: null };
  const a = rail.profileOriginSceneRelative, b = ref.state?.rails?.[side]?.profileOriginSceneRelative;
  if (!a || !b) return { ...base, qualified: false, humanDeltaLocal: null };
  const human = N.move(rail.sceneRelativeToProfileLocal, [b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  /* Ce que le placement interne du traceur AURAIT donné, mesuré après coup et
   * sans avoir influencé quoi que ce soit en amont. */
  const seed = tr.seed ? [0, tr.seed[0], tr.seed[1]] : null;
  return { ...base, qualified: true, humanDeltaLocal: human,
           unpublishedSeedError: seed ? norm(seed, human) : null,
           unpublishedSeedWithinTolerance: seed ? norm(seed, human) <= tol : null,
           note: 'le seed du traceur n’a JAMAIS été publié par le moteur sur ces rails ; '
               + 'cette mesure est une observation après coup, pas une récupération' };
}

/* ------------------------------------------------------------------ pilote */

const tally = (list, key) => {
  const m = {};
  for (const x of list) { const k = String(key(x)); m[k] = (m[k] || 0) + 1; }
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const quantiles = v => {
  const a = v.filter(Number.isFinite).sort((x, y) => x - y);
  if (!a.length) return null;
  const q = p => a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))];
  return { n: a.length, min: a[0], p25: q(0.25), median: q(0.5), p75: q(0.75), max: a[a.length - 1] };
};

function buildRows(corpora) {
  const shadow = JSON.parse(fs.readFileSync(path.join(ROOT, 'audit/flank-support-shadow-v1.json')));
  const pop = new Map(shadow.rows.map(r => [
    `${r.corpus}|${r.decisionFeatures.sessionId}|${r.decisionFeatures.visitId}|${r.decisionFeatures.side}`,
    { population: r.population, degradation: r.degradation, admissible: r.causalHistory.admissible }]));
  const rows = [];
  for (const { name, dir } of corpora) {
    const corpus = F.readCorpus(dir);
    const visits = F.readVisitsOf(corpus);
    const needed = new Set();
    for (const v of visits) for (const s of ['left', 'right']) {
      const el = v.geometryEligibility?.[s];
      if (el?.status === 'comparable-candidate') for (const id of el.chunkIds ?? []) needed.add(id);
    }
    const chunks = F.readChunksOf ? F.readChunksOf(corpus, needed) : (() => {
      const out = new Map();
      for (const e of corpus.exports) {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, e.file)));
        for (const c of raw.clouds ?? []) {
          if (c.format !== 'banane-native-lidar-chunk-v1') continue;
          if (!needed.has(c.chunkId) || out.has(c.chunkId)) continue;
          out.set(c.chunkId, { points: c.pointsSceneRelative, visible: c.visibleByClipBoxes ?? null });
        }
        if (out.size === needed.size) break;
      }
      return out;
    })();
    for (const visit of visits) for (const side of ['left', 'right']) {
      const key = `${name}|${visit.sessionId}|${visit.visitId}|${side}`;
      const meta = pop.get(key);
      if (!meta) continue;
      /* population étudiée + population témoin, et rien d'autre */
      const studied = meta.population === 'no-candidate';
      const control = meta.population === 'engine-candidate';
      if (!studied && !control) continue;
      const r = F.replayRailExact(visit, side, chunks);
      if (!r.replayed) continue;
      const proposal = r.proposal;
      const reason = proposal.status === 'candidate' ? null : (proposal.reasons || []).join(' ');
      if (studied && reason !== FAILURE_REASON) continue;   // le 64ᵉ sort ailleurs : hors population
      const capture = (() => {
        const pts = [], vis = [];
        for (const id of visit.geometryEligibility[side].chunkIds ?? []) {
          const c = chunks.get(id);
          for (let i = 0; i < c.points.length; i++) { pts.push(c.points[i]); vis.push(c.visible ? c.visible[i] : true); }
        }
        return { rails: { [side]: r.rail }, pointsSceneRelative: pts, visibleByClipBoxes: vis };
      })();
      const tr = trace(capture, side);
      const verification = verifyAgainstEngine(tr, proposal);
      const land = supportLandscape(tr);
      const bounds = boundProximity(tr);
      rows.push({
        cohort: studied ? 'failure' : 'control',
        corpus: name,
        key: { sessionId: visit.sessionId, visitId: visit.visitId, visitIndex: visit.visitIndex,
               part: visit.identity.part, cut: visit.identity.cut, side,
               snapshotId: visit.geometryEligibility[side].snapshotId },
        engineObserved: {
          status: proposal.status, exitReason: reason,
          pointsSupplied: capture.pointsSceneRelative.length,
          publishedMetrics: Boolean(proposal.metrics),
          topCount: proposal.top?.count ?? null, faceCount: proposal.metrics?.faceCount ?? null,
          seed: proposal.metrics?.seed ?? null,
        },
        diagnosticTrace: {
          isSecondaryInstrumentation: true,
          sign: tr.sign, pointsLocal: tr.pointsLocal, width: tr.width,
          topAnchors: tr.topAnchors, faceAnchors: tr.faceAnchors,
          coarseBest: tr.coarseBest && { u: tr.coarseBest.u, z: tr.coarseBest.z, loss: tr.coarseBest.loss },
          refinedBest: tr.refinedBest && { u: tr.refinedBest.u, z: tr.refinedBest.z, loss: tr.refinedBest.loss },
          unpublishedSeed: tr.seed,
          templateLossRatio: tr.templateLossRatio,
          topRowsAtCoarseBest: tr.topRowsAtCoarse ?? null,
          topRowsAtRefinedBest: tr.topRowsAtRefined,
          topFit: tr.top, exit: tr.exit,
          localPointGeometry: tr.localPointGeometry ?? null,
          boundProximity: bounds,
          verification,
        },
        localSupportLandscape: land,
        hypotheses: hypothesisFlags(tr, land, bounds),
        failureFamily: studied ? failureFamily(tr, land) : null,
        sessionSideContext: { sessionId: visit.sessionId, side, part: visit.identity.part,
                              cut: visit.identity.cut, visitStatus: visit.status,
                              lidarStatus: visit.lidarStatus ?? null },
        degradationContext: meta.degradation,
        causallyAdmissible: meta.admissible,
        postHocEvaluation: postHocEvaluation(visit, side, r.rail, tr),
      });
    }
  }
  return rows;
}

function summarise(rows) {
  const fail = rows.filter(r => r.cohort === 'failure');
  const ctl = rows.filter(r => r.cohort === 'control');
  const divergences = rows.flatMap(r => r.diagnosticTrace.verification.divergences
    .map(d => ({ key: r.key, ...d })));
  const cohortStats = list => ({
    rails: list.length,
    bySide: tally(list, r => r.key.side),
    bySession: tally(list, r => r.key.sessionId),
    byPart: tally(list, r => r.key.part),
    sign: tally(list, r => r.diagnosticTrace.sign),
    pointsLocal: quantiles(list.map(r => r.diagnosticTrace.pointsLocal)),
    topAnchors: quantiles(list.map(r => r.diagnosticTrace.topAnchors)),
    faceAnchors: quantiles(list.map(r => r.diagnosticTrace.faceAnchors)),
    width: quantiles(list.map(r => r.diagnosticTrace.width)),
    refinedU: quantiles(list.map(r => r.diagnosticTrace.refinedBest?.u)),
    refinedZ: quantiles(list.map(r => r.diagnosticTrace.refinedBest?.z)),
    refinedLoss: quantiles(list.map(r => r.diagnosticTrace.refinedBest?.loss)),
    refinementShift: quantiles(list.map(r => r.diagnosticTrace.boundProximity?.refinementShift)),
    topRowsAtCoarse: quantiles(list.map(r => r.diagnosticTrace.topRowsAtCoarseBest)),
    topRowsAtRefined: quantiles(list.map(r => r.diagnosticTrace.topRowsAtRefinedBest)),
    gridFractionWithSupport: quantiles(list.map(r => r.localSupportLandscape?.fractionWithEnoughRows)),
    coarseAtBoundY: tally(list, r => r.diagnosticTrace.boundProximity?.coarseAtBoundY),
    coarseAtBoundZ: tally(list, r => r.diagnosticTrace.boundProximity?.coarseAtBoundZ),
    localZMedian: quantiles(list.map(r => r.diagnosticTrace.localPointGeometry?.zMedian)),
    localZMin: quantiles(list.map(r => r.diagnosticTrace.localPointGeometry?.zMin)),
    localZMax: quantiles(list.map(r => r.diagnosticTrace.localPointGeometry?.zMax)),
    fractionOfPointsWithinReachableZ: quantiles(list.map(r => {
      const g = r.diagnosticTrace.localPointGeometry;
      return g ? g.pointsWithinReachableZ / g.total : null;
    })),
  });
  const bySideDetail = side => {
    const f = fail.filter(r => r.key.side === side), c = ctl.filter(r => r.key.side === side);
    return { failure: f.length ? cohortStats(f) : null, control: c.length ? cohortStats(c) : null };
  };
  return {
    rails: rows.length,
    cohorts: { failure: fail.length, control: ctl.length },
    verification: {
      railsCompared: rows.length,
      checksRun: rows.reduce((a, r) => a + r.diagnosticTrace.verification.comparable, 0),
      railsWithPublishedMetrics: rows.filter(r => r.engineObserved.publishedMetrics).length,
      unexplainedDivergences: divergences,
      tracerAgreesWithEngine: divergences.length === 0,
    },
    failure: cohortStats(fail),
    control: cohortStats(ctl),
    bySide: { left: bySideDetail('left'), right: bySideDetail('right') },
    failureFamilies: tally(fail, r => r.failureFamily),
    failureFamiliesBySession: Object.fromEntries(FAILURE_FAMILIES.map(f =>
      [f, tally(fail.filter(r => r.failureFamily === f), r => r.key.sessionId)])),
    hypothesisCompatibility: Object.fromEntries(HYPOTHESES.map(h =>
      [h, fail.filter(r => r.hypotheses?.[h] === true).length])),
    nearestSupported: {
      present: fail.filter(r => r.localSupportLandscape?.nearestSupportedPlacement).length,
      distance: quantiles(fail.map(r => r.localSupportLandscape?.nearestSupportedPlacement?.distance)),
      lossDelta: quantiles(fail.map(r => r.localSupportLandscape?.nearestSupportedPlacement?.lossDelta)),
      lossRatio: quantiles(fail.map(r => r.localSupportLandscape?.nearestSupportedPlacement?.lossRatioToBest)),
    },
    lowestLossSupported: {
      lossRatio: quantiles(fail.map(r => r.localSupportLandscape?.lowestLossSupportedPlacement?.lossRatioToBest)),
      distance: quantiles(fail.map(r => r.localSupportLandscape?.lowestLossSupportedPlacement?.distance)),
    },
    degradation: tally(fail, r => r.degradationContext?.slice ?? 'inconnue'),
    causallyAdmissible: tally(fail, r => r.causallyAdmissible),
    note: 'aucun seuil opérationnel, aucun rayon, aucune règle, aucune hypothèse adoptée',
  };
}

function main() {
  const args = process.argv.slice(2), corpora = [];
  for (let i = 0; i < args.length; i++) if (args[i] === '--corpus') corpora.push({ name: args[i + 1], dir: args[i + 2] });
  const out = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
  if (!corpora.length) { console.error('usage : --corpus <nom> <dossier> [--corpus …] [--output f.json]'); process.exit(2); }
  const frozen = N.assertFrozenEngine();
  const rows = buildRows(corpora);
  /* le paysage porte une fermeture non sérialisable : on la retire avant sortie */
  for (const r of rows) if (r.localSupportLandscape) delete r.localSupportLandscape.topRowsAt;
  const summary = summarise(rows);
  const body = {
    format: 'banane-running-surface-failure-lab-v1',
    nature: 'laboratoire hors ligne, lecture seule — aucune correction, aucun seuil, aucune règle',
    question: 'pourquoi la recherche choisit-elle un best autour duquel moins de trois points '
            + 'permettent ensuite d’estimer le plan de roulement ?',
    studiedExit: FAILURE_REASON,
    engine: { version: '4.6.0', geometryMethod: G.DEFAULTS.method, parameters: G.DEFAULTS,
              frozenHashes: frozen, calledWithoutOptions: true },
    tracer: { role: 'instrumentation secondaire, jamais le moteur',
              reusesFromEngine: ['G.median', 'G.robustLine', 'C.point'],
              reproduces: ['filtrage local', 'ancres', 'fonction de perte', 'boucles de recherche'],
              floatAccumulationPreserved: true,
              verifiedAgainstEngine: true },
    minRowsForLine: MIN_ROWS_FOR_LINE,
    hypotheses: HYPOTHESES, failureFamilies: FAILURE_FAMILIES,
    familySeparationRatio: { value: FAMILY_SEPARATION_RATIO,
      role: 'convention de DESCRIPTION du banc pour séparer deux familles',
      isNotAnEngineParameter: true, isNotProposed: true },
    units: 'scene-units; physicalCalibrationStatus: not-independently-verified; never millimetres',
    humanFreeBlocks: ['engineObserved', 'diagnosticTrace', 'localSupportLandscape',
                      'sessionSideContext', 'degradationContext'],
    humanBlock: 'postHocEvaluation',
    corpora: corpora.map(c => ({ name: c.name, directory: path.resolve(c.dir) })),
    summary, rows,
  };
  const hashed = { format: body.format, engine: body.engine, tracer: body.tracer,
                   summary: body.summary, rows: body.rows };
  body.sha256 = crypto.createHash('sha256').update(JSON.stringify(hashed)).digest('hex');
  body.sha256Covers = ['format', 'engine', 'tracer', 'summary', 'rows'];
  body.generatedAt = new Date().toISOString();
  if (out) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(body, null, 1)); }
  console.log(JSON.stringify(summary, null, 1));
  console.log('sha256 :', body.sha256);
  if (!summary.verification.tracerAgreesWithEngine) {
    console.error('DIVERGENCE TRACEUR/MOTEUR — le banc échoue.');
    process.exit(1);
  }
  if (out) console.log('écrit :', out);
}

module.exports = { FAILURE_REASON, MIN_ROWS_FOR_LINE, HYPOTHESES, FAILURE_FAMILIES,
                   FAMILY_SEPARATION_RATIO, trace, verifyAgainstEngine, supportLandscape,
                   boundProximity, hypothesisFlags, failureFamily, postHocEvaluation,
                   buildRows, summarise, quantiles, tally };
if (require.main === module) main();
