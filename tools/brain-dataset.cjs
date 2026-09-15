#!/usr/bin/env node
'use strict';
/* Construction du jeu supervisé pour le cerveau de placement.
 *
 * Source : les sessions « Mes corrections » (banane-corrections-session-v4).
 * Chaque enregistrement porte, par rail :
 *   - `initial`          : la pose proposée par ESV avant tout geste ;
 *   - `corrected`        : la pose après le geste de l'opérateur ;
 *   - `displacementLocal`: le déplacement humain DANS LE REPÈRE PROFIL LOCAL.
 * C'est `displacementLocal` qui sert de cible : c'est la grandeur que le moteur
 * cherche à prédire, exprimée dans le même repère que sa propre sortie.
 *
 * Le nuage de points associé est retrouvé par `lidarCaptureId`, et c'est LUI qui
 * porte `profileContours` — l'enregistrement ne les a pas. Sans contour, le
 * moteur refuse de proposer (« Contour du profil absent »).
 *
 * RÈGLE DE FUITE : la correction humaine n'entre JAMAIS dans les entrées du
 * moteur ni dans les descripteurs. Elle n'existe que comme cible, et le banc
 * vérifie cette séparation (voir tests/brain-dataset.test.cjs).
 *
 * Unités : unités de scène. Elles ne sont PAS appelées millimètres :
 * `physicalCalibrationStatus` ne l'atteste pas.
 */
const fs = require('node:fs'), path = require('node:path');
const K = require('../src/core.js'), Geometry = require('../src/geometry.js');
const C = require('../vendor/capture-core.js');
const SIDES = ['left', 'right'];

const fini = v => Number.isFinite(v);
const vect3 = v => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(fini);

/* Descripteurs d'un rail, calculés UNIQUEMENT à partir de ce que le moteur voit :
 * le nuage découpé, ramené dans le repère profil local, et le contour initial. */
function descripteurs(points, visibles, rail) {
  const M = rail.sceneRelativeToProfileLocal;
  const contour = rail.profileContours?.reduce((a, b) =>
    (b.verticesSceneRelative?.length || 0) > (a?.verticesSceneRelative?.length || 0) ? b : a, null);
  if (!contour) return null;
  const sommets = contour.verticesSceneRelative.map(p => C.point(M, p));
  const signe = Math.sign(median(sommets.map(p => p[1])));
  if (!signe) return null;

  // Même convention que le moteur : u = latéral normalisé par le signe, z = vertical.
  const locaux = [];
  for (let i = 0; i < points.length; i++) {
    if (visibles?.[i] === false) continue;
    const p = points[i];
    if (!vect3(p)) continue;
    const q = C.point(M, p);
    locaux.push([signe * q[1], q[2], q[0]]);
  }
  if (!locaux.length) return null;

  const tete = sommets.map(p => [signe * p[1], p[2]]).filter(p => p[1] > -.04);
  const zTete = tete.length ? median(tete.map(p => p[1])) : null;
  const uTete = tete.length ? median(tete.map(p => p[0])) : null;

  // Bandes utiles, aux mêmes bornes que la qualification de la collecte.
  const table = locaux.filter(p => Math.abs(p[1]) <= .012);
  const face = locaux.filter(p => p[1] >= -.034 && p[1] <= -.009);
  const u = locaux.map(p => p[0]), z = locaux.map(p => p[1]), x = locaux.map(p => p[2]);

  return {
    points: locaux.length,
    pointsTable: table.length,
    pointsFace: face.length,
    uMedian: median(u), zMedian: median(z),
    uTableMedian: table.length ? median(table.map(p => p[0])) : null,
    zTableMedian: table.length ? median(table.map(p => p[1])) : null,
    uFaceMedian: face.length ? median(face.map(p => p[0])) : null,
    zFaceMedian: face.length ? median(face.map(p => p[1])) : null,
    uEcart: etendue(u), zEcart: etendue(z),
    spanLongitudinal: x.length ? Math.max(...x) - Math.min(...x) : 0,
    // Écart entre le nuage et le contour initial : le signal le plus direct
    // d'un décalage à corriger, et il ne suppose aucune connaissance de la cible.
    uContour: uTete, zContour: zTete,
    ecartTableZ: table.length && zTete !== null ? median(table.map(p => p[1])) - zTete : null,
    ecartFaceU: face.length && uTete !== null ? median(face.map(p => p[0])) - uTete : null,
  };
}
function median(a) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; }
function etendue(a) { if (a.length < 4) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length * .9)] - b[Math.floor(b.length * .1)]; }

/* Proposition du moteur gelé sur exactement la même entrée. */
function propositionMoteur(cloud, options) {
  const capture = {
    identity: cloud.identity,
    rails: cloud.rails,
    pointsSceneRelative: cloud.pointsSceneRelative,
    visibleByClipBoxes: cloud.visibleByClipBoxes,
    coordinateSystem: cloud.coordinateSystem,
  };
  try { return Geometry.proposeBoth(capture, options || {}); }
  catch (e) { return { left: null, right: null, erreur: e.message }; }
}

function construire(fichiers) {
  const lignes = [];
  const rejets = {};
  for (const fichier of fichiers) {
    const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    if (d.format !== 'banane-corrections-session-v4')
      throw Error('Format inattendu dans ' + fichier + ' : ' + d.format);
    const parId = new Map((d.clouds || []).map(c => [c.captureId, c]));
    const parVisite = new Map((d.clouds || []).map(c => [c.visitId, c]));
    for (const r of d.records || []) {
      const cloud = parId.get(r.lidarCaptureId) || parVisite.get(r.visitId);
      if (!cloud) { rejets['nuage-absent'] = (rejets['nuage-absent'] || 0) + 1; continue; }
      if (r.usableForTraining !== true) { rejets['non-utilisable'] = (rejets['non-utilisable'] || 0) + 1; continue; }
      const moteur = propositionMoteur(cloud);
      for (const side of SIDES) {
        const R = r.rails?.[side], railCloud = cloud.rails?.[side];
        if (!R || !railCloud) { rejets['rail-absent'] = (rejets['rail-absent'] || 0) + 1; continue; }
        if (!vect3(R.displacementLocal)) { rejets['cible-absente'] = (rejets['cible-absente'] || 0) + 1; continue; }
        const f = descripteurs(cloud.pointsSceneRelative || [], cloud.visibleByClipBoxes, railCloud);
        if (!f) { rejets['descripteurs-impossibles'] = (rejets['descripteurs-impossibles'] || 0) + 1; continue; }
        const p = moteur[side];
        lignes.push({
          // Provenance : ce qui permet de découper sans fuite entre blocs.
          session: r.sessionId, recordId: r.recordId, part: r.part, cut: r.cut, side,
          shape: r.shape, frameId: r.frameId, decision: r.operatorDecision ?? null,
          descripteurs: f,
          // Sortie du moteur gelé, telle quelle.
          moteur: p ? {
            statut: p.status, delta: p.delta, confiance: p.confidence,
            motifs: p.reasons || [], source: p.source,
            /* Les candidats RÉELLEMENT produits par le moteur, tels qu'il les
             * expose : la graine fine et sa meilleure alternative de grille
             * grossière. Le banc n'en invente aucun — on ne peut conclure
             * « candidat absent » que sur ce que le moteur montre. */
            candidats: p.metrics ? {
              graine: p.metrics.seed ?? null,                       // graine fine
              surface: p.metrics.surfaceIntersection ?? null,       // table × face active
              alternative: p.metrics.templateAmbiguity?.alternative ?? null, // meilleure de grille grossière
              separation: p.metrics.templateAmbiguity?.separation ?? null,
              rapportPerte: p.metrics.templateAmbiguity?.lossRatio ?? null,
              perteGabarit: p.metrics.templateLoss ?? null,
              residuel: p.metrics.residual ?? null,
              nTable: p.metrics.topCount ?? null, nFace: p.metrics.faceCount ?? null,
            } : null,
          } : { statut: 'absent', delta: null, confiance: 0, motifs: [moteur.erreur || 'proposition absente'], source: null, candidats: null },
          // CIBLE — jamais lue par le moteur ni par les descripteurs.
          cible: { deplacementLocal: R.displacementLocal.slice(0, 3),
            positionChangee: R.positionChanged === true,
            rotationChangee: R.rotationChanged === true },
        });
      }
    }
  }
  return { lignes, rejets };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const sortie = args[args.indexOf('--out') + 1];
  const entrees = args.filter(a => a.endsWith('.json') && a !== sortie);
  if (!entrees.length) { console.error('Usage : brain-dataset.cjs <corrections.json…> --out jeu.json'); process.exit(2); }
  const { lignes, rejets } = construire(entrees);
  const doc = { format: 'banane-brain-dataset-v1', builtAt: new Date().toISOString(),
    sources: entrees.map(f => path.basename(f)), rows: lignes.length, rejets, lignes };
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(doc));
  console.log(JSON.stringify({ rows: lignes.length, rejets }, null, 1));
}
module.exports = { construire, descripteurs, propositionMoteur, median };
