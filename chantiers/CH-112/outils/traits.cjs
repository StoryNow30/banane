#!/usr/bin/env node
'use strict';
/* CH-112 : traits hors ligne, par cut posé par le lot, pour séparer la mauvaise voie de la bonne en zone d'aiguillage.
 *   node traits.cjs --jointure p16.json --journal journal.json --liste liste.json --partie 16 --csv sortie.csv [--json sortie.json]
 * Étiquette : écart 3D du pire rail entre la pose d'Ariane et la pose finale de l'opérateur (référence de la jointure
 * avec « visité sans action = bon ») ; un cut posé vu sans action et sans référence compte pour 0 (accepté).
 * Sauts : position de chaque rail du cut par rapport à la droite des mêmes rails de deux cuts valides voisins de la liste
 * d'ESV (latéral = horizontal perpendiculaire à la voie, vertical = écart en z) :
 *  - « av » : deux cuts valides précédents (extrapolation, causal) ;
 *  - « bi » : le cut valide précédent et le suivant (interpolation, hors ligne).
 * Sortie : numéros de cut et millimètres seulement. */
const fs = require('node:fs');
const { lireListe } = require('./liste.cjs');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const partie = Number(arg('partie'));
const jt = JSON.parse(fs.readFileSync(arg('jointure'), 'utf8')).table.filter(r => r.partie === partie);
const liste = lireListe(arg('liste')).cuts;
const ev = JSON.parse(fs.readFileSync(arg('journal'), 'utf8')).events.filter(e => e.identity?.part === partie);
const parCut = new Map();
for (const e of ev) { const c = e.identity.cut; if (!parCut.has(c)) parCut.set(c, []); parCut.get(c).push(e); }
const dernier = (c, t, f = () => true) => (parCut.get(c) || []).filter(e => e.type === t && f(e)).sort((a, b) => a.timestamp < b.timestamp ? -1 : 1).at(-1);
const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : '';

/* Écart (latéral signé, vertical) en mm du point p à la droite (a,b), dans le plan horizontal. */
function ecartDroite(a, b, p) {
  const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.hypot(dx, dy);
  if (n < 1e-6) return null;
  const ux = dx / n, uy = dy / n, px = p[0] - a[0], py = p[1] - a[1];
  const s = px * ux + py * uy; // abscisse le long de (a,b)
  const lat = ux * py - uy * px; // positif à gauche du sens a→b
  const z = a[2] + (b[2] - a[2]) * (s / n);
  return { lat: lat * 1000, vert: (p[2] - z) * 1000 };
}
const valide = (i, exclure) => i >= 0 && i < liste.length && liste[i] && liste[i].statut === 0 && liste[i].gauche && !exclure.has(i);
function voisins(i, sens, k, exclure = new Set()) {
  const out = []; for (let j = i + sens; j >= 0 && j < liste.length && out.length < k && Math.abs(j - i) <= 30; j += sens) if (valide(j, exclure)) out.push(j);
  return out;
}
function saut(i, a, b, pose) {
  const res = {};
  for (const [c, k] of [['g', 'gauche'], ['d', 'droite']]) {
    const e = ecartDroite(liste[a][k], liste[b][k], pose[k]);
    res[c] = e;
  }
  return res;
}
const lignes = [];
for (const r of jt) {
  if (r.classe !== 'posee') continue;
  const c = r.cut;
  const err = r.ecartHumain ? r.ecartHumain.maxDist3dMm : (r.dansEcho ? 0 : null);
  const o = { cut: c, errMm: err, ref: r.ecartHumain ? r.referenceHumaine : (r.dansEcho ? 'vu-sans-action' : 'hors-echo') };
  /* Pose d'Ariane : rails observés après application (dernier `applied-verified` du cut), coordonnées de scène = monde. */
  const av0 = dernier(c, 'applied-verified');
  const rl = av0?.observed?.rails;
  const pose = rl?.left?.positionSceneRelative && rl?.right?.positionSceneRelative ? { gauche: rl.left.positionSceneRelative, droite: rl.right.positionSceneRelative } : null;
  if (pose && liste[c]?.gauche) o.listeDiffMm = r1(Math.max(...[0, 1, 2].map(k => Math.abs(pose.gauche[k] - liste[c].gauche[k]) * 1000), ...[0, 1, 2].map(k => Math.abs(pose.droite[k] - liste[c].droite[k]) * 1000)));
    const dep = r.arianeDeplacement || {};
  o.depG = r1(dep.gauche?.dist3dMm); o.depD = r1(dep.droite?.dist3dMm); o.depLatG = r1(dep.gauche?.lateralMm); o.depLatD = r1(dep.droite?.lateralMm);
  const rm = dernier(c, 'regles-metier-ombre', e => e.portee === 'cut');
  o.adv = rm?.zone?.adv || ''; o.advRails = rm?.surface?.advRails ?? ''; o.flushPct = rm?.surface?.flushPct ?? ''; o.quadMin = rm?.surface?.quadMin ?? '';
  o.grappe = rm?.zone?.grappe?.active ? 1 : 0; o.pn = rm?.zone?.pn ? 1 : 0; o.ecartement = r1(rm?.reel?.ecartementMm);
  const gv = dernier(c, 'garde-voie-ombre');
  o.gardeVoisMm = r1(gv?.ecartAuVoisinageMm); o.gardeMotif = gv?.motif || '';
  const b1 = dernier(c, 'b1-ombre');
  o.b1Regle = b1?.regle || ''; o.b1Chg = b1?.changement || ''; o.b1Ecart = r1(b1?.ecartPoseMm); o.stage = b1?.reel?.stage || '';
  const ga = dernier(c, 'garde-apres-differe-ombre'); o.voisinsDifferes = ga ? (ga.voisinsDifferes || []).length : '';
  const pr = dernier(c, 'proposed');
  const sh = dernier(c, 'gcv1-shadow-observed');
  for (const [s, k] of [['G', 'left'], ['D', 'right']]) {
    const rr = pr?.proposal?.rails?.[k]; o['conf' + s] = rr?.confidence ?? '';
    o['nStrong' + s] = rr?.gcv1?.nStrongCompetitive ?? ''; o['nClu' + s] = rr?.gcv1?.nClusters ?? '';
    const as = sh?.shadow?.rails?.[k]?.astar;
    o['lossRatio' + s] = as?.lossRatio ? Math.round(as.lossRatio * 100) / 100 : '';
    o['altMm' + s] = as?.alternative && as?.delta ? r1(Math.hypot(as.alternative[0] - as.delta[1], as.alternative[1] - as.delta[2]) * 1000) : '';
    o['jaugeAvant'] = r1(sh?.shadow?.rails?.left?.pairGauge?.beforeMm);
  }
  if (pose) {
    const ex = new Set([c]);
    const av = voisins(c, -1, 2, ex), ap = voisins(c, 1, 1, ex);
    if (av.length === 2) { const s = saut(c, av[1], av[0], pose); o.avLatG = r1(s.g?.lat); o.avLatD = r1(s.d?.lat); o.avVertG = r1(s.g?.vert); o.avVertD = r1(s.d?.vert); o.avDist = c - av[0]; }
    if (av.length >= 1 && ap.length === 1) { const s = saut(c, av[0], ap[0], pose); o.biLatG = r1(s.g?.lat); o.biLatD = r1(s.d?.lat); o.biVertG = r1(s.g?.vert); o.biVertD = r1(s.d?.vert); o.biDist = ap[0] - av[0]; }
  }
  lignes.push(o);
}
const cols = [...new Set(lignes.flatMap(o => Object.keys(o)))];
const csv = [cols.join(';'), ...lignes.map(o => cols.map(k => o[k] ?? '').join(';'))].join('\n') + '\n';
if (arg('csv')) fs.writeFileSync(arg('csv'), csv);
if (arg('json')) fs.writeFileSync(arg('json'), JSON.stringify(lignes));
console.error(`partie ${partie} : ${lignes.length} cuts posés`);
