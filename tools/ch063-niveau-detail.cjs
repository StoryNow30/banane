#!/usr/bin/env node
'use strict';
/* CH-063, piste 2 : niveau de détail suffisant.
 *
 * Question : si Ariane cessait d'attendre ESV à un niveau de détail moins profond, la pose calculée serait-elle identique, au millimètre,
 * à celle d'aujourd'hui ? On le rejoue hors ligne sur les nuages réels (`ariane-gcv1-corpus-*.json`).
 *
 * Chaque point d'une capture garde sa source (`pointSources[i] = [nœud, rang]`) et chaque nœud la boîte de son nœud d'octree
 * (`reportedPotreeGeometryNodeBoundingBox`). La boîte d'un nœud de niveau n mesure exactement celle de la racine divisée par 2^n :
 * le niveau se lit sans le nom du nœud. Dans Potree, un niveau AJOUTE des points à ceux des niveaux plus hauts, sans en retirer.
 * La vue qu'Ariane lirait si elle s'arrêtait au niveau L est donc exactement le sous-ensemble des points de niveau ≤ L (PROBABLE :
 * vrai si, à cet instant, tous les nœuds de niveau ≤ L de la vue sont chargés).
 *
 * Pour chaque capture : moteur d'aujourd'hui (`scientificProposeBothAvecReservoir`, puis `toRuntimeRails`, comme le service worker)
 * sur le nuage complet, puis sur le nuage coupé à (niveau maximal − d) ; on compare, rail par rail, le statut, la confiance et le
 * décalage proposé (mm, repère profil). Aucune coordonnée ni identifiant n'est écrit : des comptes et des millimètres relatifs.
 *
 * Usage : node tools/ch063-niveau-detail.cjs --corpus C.json [--corpus …] [--coupes 1,2,3] [--sortie R.json] */
const fs = require('fs');
const SIDES = ['left', 'right'];

function niveauxDesNoeuds(capture) {
  const boites = (capture.nodes || []).map(n => n.reportedPotreeGeometryNodeBoundingBox || n.reportedGeometryBoundingBox || null);
  const cote = b => b && Array.isArray(b.min) && Array.isArray(b.max) ? b.max[0] - b.min[0] : NaN;
  const racine = Math.max(...boites.map(cote).filter(Number.isFinite));
  return boites.map(b => { const v = Math.log2(racine / cote(b)), n = Math.round(v); return Number.isFinite(v) && Math.abs(v - n) < 1e-6 ? n : null; });
}
function niveauxDesPoints(capture) {
  const nv = niveauxDesNoeuds(capture);
  return (capture.pointSources || []).map(s => Array.isArray(s) && Number.isInteger(s[0]) ? nv[s[0]] ?? null : null);
}
/* Le nuage coupé : les points de niveau ≤ max (ordre d'origine gardé). Un point sans niveau connu rend la coupe illisible (null). */
function couper(capture, niveaux, max) {
  if (niveaux.length !== capture.pointsSceneRelative.length || niveaux.some(v => v === null)) return null;
  const pts = [], vis = [], vb = Array.isArray(capture.visibleByClipBoxes) ? capture.visibleByClipBoxes : null;
  niveaux.forEach((v, i) => { if (v <= max) { pts.push(capture.pointsSceneRelative[i]); vis.push(vb ? vb[i] : true); } });
  return { identity: capture.identity, rails: capture.rails, pointsSceneRelative: pts, visibleByClipBoxes: vis };
}
function poser(Sh, cap) {
  try { const r = Sh.toRuntimeRails(Sh.scientificProposeBothAvecReservoir(cap)); return Object.fromEntries(SIDES.map(s => [s, { statut: r[s].status, confiance: r[s].confidence ?? null, delta: Array.isArray(r[s].delta) ? r[s].delta.slice(0, 3) : null }])); }
  catch (e) { return { erreur: String(e && e.message || e).slice(0, 80) }; }
}
/* Écart entre deux poses : par rail, même statut, même confiance, et l'écart maximal du décalage (mm). Une erreur d'un seul côté = différent. */
function comparer(a, b) {
  if (a.erreur || b.erreur) return { identique: !!(a.erreur && b.erreur), mmMax: a.erreur && b.erreur ? 0 : null, statut: !!(a.erreur && b.erreur), confiance: !!(a.erreur && b.erreur) };
  let mm = 0, statut = true, confiance = true;
  for (const s of SIDES) {
    if (a[s].statut !== b[s].statut) statut = false;
    if (a[s].confiance !== b[s].confiance) confiance = false;
    if (a[s].delta && b[s].delta) mm = mm === null ? null : Math.max(mm, ...a[s].delta.map((v, i) => 1000 * Math.abs(v - b[s].delta[i])));
    else if (!!a[s].delta !== !!b[s].delta) mm = null;
  }
  /* mmMax null : un décalage présent d'un seul côté (pas comparable ; jamais compté « identique »). */
  return { identique: statut && confiance && mm === 0, mmMax: mm, statut, confiance };
}
function etudier(capture, coupes, Sh) {
  const niveaux = niveauxDesPoints(capture);
  if (!niveaux.length || niveaux.some(v => v === null)) return { lisible: false };
  const max = Math.max(...niveaux), parNiveau = {};
  for (const v of niveaux) parNiveau[v] = (parNiveau[v] || 0) + 1;
  const complet = poser(Sh, capture), out = { lisible: true, max, points: niveaux.length, parNiveau, candidat: !complet.erreur && SIDES.every(s => complet[s].statut === 'candidate'), coupes: {} };
  for (const d of coupes) {
    const c = couper(capture, niveaux, max - d);
    const p = poser(Sh, c);
    out.coupes[d] = { points: c.pointsSceneRelative.length, ...comparer(complet, p) };
  }
  return out;
}
const q = (s, x) => { if (!s.length) return null; const i = (s.length - 1) * x, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const r2 = x => x === null || !Number.isFinite(x) ? x : Math.round(x * 100) / 100;
function agreger(lignes, coupes) {
  const ok = lignes.filter(l => l.lisible), A = { captures: lignes.length, lisibles: ok.length, niveauMax: {}, coupes: {} };
  for (const l of ok) A.niveauMax[l.max] = (A.niveauMax[l.max] || 0) + 1;
  for (const d of coupes) {
    const c = ok.map(l => l.coupes[d]).filter(Boolean), mm = c.filter(x => x.statut).map(x => x.mmMax).filter(Number.isFinite).sort((a, b) => a - b);
    const cand = ok.filter(l => l.candidat).map(l => l.coupes[d]);
    const partPts = ok.map(l => l.coupes[d].points / l.points).sort((a, b) => a - b);
    A.coupes[d] = { n: c.length, identiques: c.filter(x => x.identique).length, statutChange: c.filter(x => !x.statut).length, confianceChange: c.filter(x => !x.confiance).length,
      differentes: c.filter(x => !x.identique).length,
      memeStatutSousDemiMm: c.filter(x => x.statut && Number.isFinite(x.mmMax) && x.mmMax < 0.5).length,
      memeStatutAu1mmOuPlus: c.filter(x => x.statut && Number.isFinite(x.mmMax) && x.mmMax >= 1).length,
      candidats: cand.length, candidatsIdentiques: cand.filter(x => x.identique).length,
      mmMemeStatut: { n: mm.length, mediane: r2(q(mm, .5)), p90: r2(q(mm, .9)), max: r2(mm.length ? mm[mm.length - 1] : null) }, partDesPointsGardes: { mediane: r2(q(partPts, .5)) } };
  }
  return A;
}
module.exports = { niveauxDesNoeuds, niveauxDesPoints, couper, comparer, etudier, agreger };

if (require.main === module) {
  const a = { corpus: [], coupes: [1, 2, 3], sortie: null };
  const v = process.argv.slice(2);
  for (let i = 0; i < v.length; i++) { if (v[i] === '--corpus') a.corpus.push(v[++i]); else if (v[i] === '--coupes') a.coupes = v[++i].split(',').map(Number); else if (v[i] === '--sortie') a.sortie = v[++i]; else throw Error('argument inconnu : ' + v[i]); }
  const Sh = require('../src/gcv1-shadow.js'), lignes = [], vus = new Set();
  for (const f of a.corpus) {
    let doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const c of doc.clouds || []) {
      if (!c || vus.has(c.captureId) || !Array.isArray(c.pointsSceneRelative) || !c.rails) continue;
      vus.add(c.captureId);
      lignes.push({ statut: c.status, ...etudier(c, a.coupes, Sh) });
    }
    doc = null;
  }
  const A = agreger(lignes, a.coupes);
  const sortie = JSON.stringify({ format: 'ariane-ch063-niveau-detail-v1', corpus: a.corpus.length, ...A, lignes }, null, 0);
  if (a.sortie) fs.writeFileSync(a.sortie, sortie + '\n');
  process.stdout.write(JSON.stringify(A) + '\n');
}
