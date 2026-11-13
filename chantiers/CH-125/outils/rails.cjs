'use strict';
/* CH-125 : lecture des rails extraits par extraire-rails.cjs (hors dépôt) et gabarit du champignon. Hors ligne. */
const fs = require('node:fs'), path = require('node:path');
const N = require('./nuage.cjs');
const LOTS_REGLABLES = ['0411', '0611', '0811a', '0811b', '1111', '1211'];
function lire(dossier, { lots = LOTS_REGLABLES, juges = true } = {}) {
  const out = [];
  for (const f of fs.readdirSync(dossier).filter(f => /\.jsonl$/.test(f)).sort()) {
    if (!lots.some(l => f.startsWith(l + '-'))) continue;
    for (const s of fs.readFileSync(path.join(dossier, f), 'utf8').split('\n')) {
      if (!s) continue; const r = JSON.parse(s); if (juges && !r.juge) continue;
      const b = Buffer.from(r.points, 'base64'); r.pts = new Float32Array(b.buffer, b.byteOffset, b.length / 4); delete r.points;
      out.push(r);
    }
  }
  return out;
}
/* Gabarit U50 lu une fois dans une capture (le même pour tous les rails du corpus : contrôlé par la largeur). */
let _gab = null;
function gabaritDe(captureRail) { return N.Conv.template(captureRail); }
/* Gabarit analytique tiré du contour (dessus z(u), flanc u(z)), au pas de 0,5 mm, sauvé/relu en JSON hors dépôt pour éviter de recharger une capture. */
function gabarit(fichier) {
  if (_gab) return _gab;
  const g = JSON.parse(fs.readFileSync(fichier, 'utf8')), STEP = 0.0005;
  _gab = { largeur: g.largeur, tops: g.tops, faces: g.faces, contour: g.contour,
    topAt: u => u < 0 || u > g.largeur ? null : g.tops[Math.round(u / STEP)] ?? null,
    faceAt: z => z > 0 || z < -0.04 ? null : g.faces[Math.round(-z / STEP)] ?? null };
  return _gab;
}
function sauverGabarit(rail, fichier) {
  const t = N.Conv.template(rail), STEP = 0.0005, tops = [], faces = [];
  for (let u = 0; u <= t.width + 1e-9; u += STEP) tops.push(t.topAt(u));
  for (let z = 0; z >= -0.04 - 1e-9; z -= STEP) faces.push(t.faceAt(z));
  fs.writeFileSync(fichier, JSON.stringify({ largeur: t.width, tops, faces, contour: N.contour(rail) }));
}
module.exports = { lire, gabarit, sauverGabarit, gabaritDe, LOTS_REGLABLES };
