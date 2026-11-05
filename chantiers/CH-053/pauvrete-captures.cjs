#!/usr/bin/env node
'use strict';
/*
 * pauvrete-captures.cjs — CH-053-C : pourquoi une capture n'atteint pas la couverture qualifiée, et ce que la piste « reclasser »
 * peut récupérer. Hors ligne, lecture seule, mode léger (les points ne sont pas lus), agrégats seulement.
 *
 *   node chantiers/CH-053/pauvrete-captures.cjs --echo <dossier|fichiers|volumes zip …> [--coupure 2031-05-01T08:00:00Z] [--json sortie.json]
 *
 * Deux familles de captures v2 (par rail) :
 *   A. CLIP_CHANGED          : points retenus au total (`pointsRetained`), sauvegardés (`checkpointedPoints`), donc PERDUS = retenus − sauvegardés ;
 *                              borne haute de la piste 2 = rails dont les points perdus atteignent le minimum de la couverture
 *                              (128 points ; la répartition longitudinale n'est pas dans l'export : c'est une BORNE HAUTE, pas un gain).
 *   B. fin normale (sans terminaison) mais couverture non qualifiée : raisons de couverture, points retenus vs visibles pour le moteur
 *                              (l'écart = points cachés par la découpe), points perdus au filtre de découpe par bande (`clipLoss`),
 *                              points lus vs disponibles (budget), nœuds utiles.
 * `--coupure` sépare les captures commencées avant/après un instant (comparer avant/après un correctif, ex. CH-049-A).
 */
const fs = require('node:fs');
const { mergeFiles } = require('../../tools/merge-segments.cjs');
const { entreesEcho } = require('../../tools/taux-apprenables.cjs');

const MIN_POINTS = 128;
const q = (v, p) => { const a = v.filter(Number.isFinite).sort((x, y) => x - y); if (!a.length) return null; const at = (a.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at); return Math.round((a[lo] + (a[hi] - a[lo]) * (at - lo)) * 10) / 10; };
const stat = v => ({ n: v.length, p10: q(v, .1), mediane: q(v, .5), p90: q(v, .9) });
const compte = (xs, f) => xs.reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m; }, {});

function analyser(clouds, { coupure = null } = {}) {
  const caps = clouds.filter(c => c && c.format === 'banane-native-lidar-capture-v2' && c.railObservations);
  const groupes = coupure ? { avant: caps.filter(c => Date.parse(c.startedAt) < Date.parse(coupure)), apres: caps.filter(c => Date.parse(c.startedAt) >= Date.parse(coupure)) } : { toutes: caps };
  const sortie = {};
  for (const [nom, liste] of Object.entries(groupes)) {
    const rails = liste.flatMap(c => Object.values(c.railObservations).map(o => ({ c, o })));
    const A = rails.filter(({ c }) => c.termination && c.termination.code === 'CLIP_CHANGED');
    const perdus = A.map(({ o }) => (o.pointsRetained || 0) - (o.checkpointedPoints || 0));
    const B = rails.filter(({ c, o }) => !(c.termination && c.termination.code) && o.coverage && o.coverage.status !== 'qualified-candidate');
    sortie[nom] = {
      captures: liste.length, rails: rails.length,
      A_clipChanged: {
        rails: A.length, pointsRetenus: stat(A.map(({ o }) => o.pointsRetained || 0)), pointsSauvegardes: stat(A.map(({ o }) => o.checkpointedPoints || 0)), pointsPerdus: stat(perdus),
        dureeCaptureMs: stat(A.map(({ c }) => Date.parse(c.completedAt) - Date.parse(c.startedAt))),
        railsSansAucunPointSauvegarde: A.filter(({ o }) => !(o.checkpointedPoints > 0)).length,
        bornehauteRecuperableParReclassement: A.filter(({ o }) => !((o.checkpointedPoints || 0) > 0) && (o.pointsRetained || 0) >= MIN_POINTS).length,
        qualification: 'borne haute (retenus ≥ 128 et rien de sauvegardé) ; répartition longitudinale et visibilité après reclassement NON dans l\'export',
      },
      B_finNormaleNonQualifiee: {
        rails: B.length, raisonsCouverture: compte(B.flatMap(({ o }) => o.coverage.exclusionReasons || ['aucune']), x => x),
        pointsRetenus: stat(B.map(({ o }) => o.pointsRetained || 0)), pointsVisiblesPourLeMoteur: stat(B.map(({ o }) => o.pointsVisibleForEngine ?? o.coverage.pointsInRoi ?? 0)),
        railsOuLaDecoupeCacheLaMajorite: B.filter(({ o }) => (o.pointsRetained || 0) > 0 && (o.pointsVisibleForEngine ?? 0) < 0.5 * o.pointsRetained).length,
        pointsLusParCapture: stat(B.map(({ c }) => c.trace && c.trace.pointsRead)), pointsDisponiblesParCapture: stat(B.map(({ c }) => c.trace && c.trace.pointsAvailableInBuffers)),
        railsSansAucunPointRetenu: B.filter(({ o }) => !(o.pointsRetained > 0)).length,
        statutsCapture: compte(B, ({ c }) => c.status),
        perteAuFiltreDeDecoupe: { nearFaceDropped: stat(B.map(({ o }) => o.clipLoss && o.clipLoss.nearFaceDropped)), nearTopDropped: stat(B.map(({ o }) => o.clipLoss && o.clipLoss.nearTopDropped)), inRoiDropped: stat(B.map(({ o }) => o.clipLoss && o.clipLoss.inRoiDropped)) },
      },
      finsDeCapture: compte(liste, c => (c.termination && c.termination.code) || 'sans-fin-anormale'),
    };
  }
  return sortie;
}

function main() {
  const argv = process.argv.slice(2), opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const iE = argv.indexOf('--echo'), chemins = [];
  if (iE >= 0) for (let i = iE + 1; i < argv.length && !argv[i].startsWith('--'); i++) chemins.push(argv[i]);
  if (!chemins.length) { console.error('Usage : --echo <…> [--coupure ISO] [--json sortie.json]'); process.exit(1); }
  const { merged } = mergeFiles(entreesEcho(chemins), { leger: true });
  const res = analyser(merged.clouds || [], { coupure: opt('--coupure') });
  console.log(JSON.stringify(res, null, 1));
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(res, null, 1));
}
if (require.main === module) main();
module.exports = { analyser };
