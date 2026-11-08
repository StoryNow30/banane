/* CH-078 — lecture des exports d'une collection de banane-data (zips « lot »). Aucun identifiant n'est écrit en sortie : les scripts n'impriment que des agrégats.
 * Usage interne : const L = require('./lib-zips.cjs'); L.journal(dossierCollection) ; L.corpus(dossierCollection, (nuage)=>{...}) */
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const lots = dir => fs.readdirSync(path.join(dir, 'raw')).filter(f => /ariane-lot-.*\.zip$/.test(f)).sort().map(f => path.join(dir, 'raw', f));
const entrees = zip => cp.execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
const lire = (zip, nom) => JSON.parse(cp.execFileSync('unzip', ['-p', zip, nom], { maxBuffer: 1 << 30 }).toString('utf8'));
/* Le journal du lot : un seul fichier « ariane-journal-v4-*.json » par collection (volume 1). */
function journal(dir) {
  for (const z of lots(dir)) for (const n of entrees(z)) if (/^ariane-journal-v4-.*\.json$/.test(n)) return lire(z, n);
  throw new Error('journal absent : ' + path.basename(dir));
}
/* Le corpus : segments « ariane-gcv1-corpus-*-segNN.json », répartis sur les volumes ; on rend les nuages un segment à la fois. */
function corpus(dir, f) {
  let n = 0;
  for (const z of lots(dir)) for (const nom of entrees(z)) if (/^ariane-gcv1-corpus-.*\.json$/.test(nom)) { const seg = lire(z, nom); for (const c of seg.clouds || []) { f(c); n++; } }
  return n;
}
const mediane = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const quantile = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
const r = (v, d = 0) => v === null || v === undefined ? null : Math.round(v * 10 ** d) / 10 ** d;
module.exports = { lots, journal, corpus, mediane, quantile, r };
