#!/usr/bin/env node
'use strict';
/*
 * CH-042 piste 5 : pour chaque cut JUGÉ posé par la chaîne (table de extraire-table.cjs), relance le moteur gelé sur le nuage capturé du lot
 * (corpus gcv1) et écrit, par rail, les CELLULES CANDIDATES (minima locaux de la grille, comme `lot-decision.candidatesOf`, calage de convention
 * appliqué comme dans `chooseRail`), avec la vérité et la pose dans le même repère (profil de la pose de départ, mm, [lat, vert]).
 *   node nuage-candidats.cjs --table T.jsonl --lot <dossier> [--lot …] --sortie N.jsonl
 * Lecture seule ; aucune vérité n'entre dans le moteur. La sortie porte des numéros de cut : hors dépôt.
 */
const fs = require('node:fs'), path = require('node:path');
const RAC = path.join(__dirname, '..', '..', '..');
const V = require(path.join(RAC, 'tools', 'lire-volumes.cjs'));
const Sh = require(path.join(RAC, 'src', 'gcv1-shadow.js'));
const L = require(path.join(RAC, 'src', 'lot-decision.js'));
const Convention = require(path.join(RAC, 'src', 'placement-convention.js'));
const a = { lot: [] }; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i += 2) { const k = av[i].replace(/^--/, ''); if (k === 'lot') a.lot.push(av[i + 1]); else a[k] = av[i + 1]; }
const SIDES = ['left', 'right'];
const r2 = v => Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
const table = fs.readFileSync(a.table, 'utf8').trim().split('\n').map(l => JSON.parse(l)).filter(x => x.geste && ['first-pass', 'window', 'choice', 'crossing'].includes(x.etage));
const parCut = new Map(table.map(x => [x.cut, x])), parCapture = new Map(table.filter(x => x.captureId).map(x => [x.captureId, x]));
const partie = table.length ? table[0].partie : null;
const out = [], vus = new Set();
let fichiers = 0;
for (const d of a.lot) for (const e of V.entrees(d)) {
  if (!/gcv1-corpus/.test(e.nom)) continue;
  fichiers++;
  let doc = JSON.parse(e.lire());
  for (const c of doc.clouds || []) {
    const x = (c.captureId && parCapture.get(c.captureId)) || (!parCapture.size && c.cut !== undefined && (c.identity ? c.identity.part === partie : c.part === partie) ? parCut.get(c.cut) : null);
    if (!x || vus.has(x.cut)) continue;
    if (!c.rails || !c.rails.left || !c.rails.right || !Array.isArray(c.pointsSceneRelative) || !c.pointsSceneRelative.length) continue;
    const capture = { identity: c.identity || { part: partie, cut: x.cut }, rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: Array.isArray(c.visibleByClipBoxes) ? c.visibleByClipBoxes : c.pointsSceneRelative.map(() => true) };
    let science = null; try { science = Sh.scientificProposeBothAvecReservoir(capture); } catch (err) { out.push({ cut: x.cut, erreur: String(err.message || err).slice(0, 100) }); vus.add(x.cut); continue; }
    const ligne = { nom: x.nom, cut: x.cut, geste: x.geste, mm: x.mm, etage: x.etage, points: c.pointsSceneRelative.length, rails: {} };
    for (const s of SIDES) {
      const sr = science.rails[s], verite = [x.deplacement[s][1] + x.err[s][1], x.deplacement[s][2] + x.err[s][2]], pose = [x.deplacement[s][1], x.deplacement[s][2]];
      const r = { ok: !!(sr && sr.ok), statut: sr && sr.next ? sr.next.status : null, verite: verite.map(r2), pose: pose.map(r2), candidats: [] };
      if (sr && sr.ok) {
        const cands = L.candidatesOf(capture, s, science) || [];
        for (const k of cands) {
          const cal = Convention.calibrate(capture, s, k.delta), delta = cal.applied ? cal.delta : k.delta;
          r.candidats.push({ rank: k.rank, lat: r2(delta[1] * 1000), vert: r2(delta[2] * 1000), latBrut: r2(k.delta[1] * 1000), vertBrut: r2(k.delta[2] * 1000), loss: k.loss, top: k.top, face: k.face, cal: cal.applied ? 1 : (cal.reason === 'shift-out-of-domain' ? -1 : 0) });
        }
        /* La cellule publiée par le moteur (après convention) et le pool du réservoir (vue par la GCV2). */
        if (sr.next && Array.isArray(sr.next.delta)) r.publie = [r2(sr.next.delta[1] * 1000), r2(sr.next.delta[2] * 1000)];
        const pool = sr._reservoir && sr._reservoir.pool || [];
        r.pool = pool.slice(0, 40).map(p => ({ lat: r2(sr._reservoir.sign * p.u * 1000), vert: r2(p.z * 1000), loss: p.loss, top: p.topRows ?? null, face: p.faceCount ?? null, tags: p.tags || [] }));
        r.lmin = sr._reservoir ? sr._reservoir.lmin : null;
      }
      ligne.rails[s] = r;
    }
    out.push(ligne); vus.add(x.cut);
  }
  doc = null;
}
fs.writeFileSync(a.sortie, out.map(o => JSON.stringify(o)).join('\n') + '\n');
console.log(`${table.length ? table[0].nom : a.table} : ${fichiers} fichiers de corpus, ${table.length} cuts jugés de la chaîne, ${out.length} nuages traités (${out.filter(o => o.erreur).length} erreurs)`);
