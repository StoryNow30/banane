#!/usr/bin/env node
'use strict';
/* CH-124 : ce que le levier d'ancre change entre deux rejeux, cut par cut, et le jugement de chaque refus contre la vérité (R3, R6).
 *   node chantiers/CH-124/outils/refus.cjs corpus --ref livre --nom N [--md F] [--csv F]
 *        rejeux du banc de CH-116 (CH116_TRAVAIL/rejeux/<nom>/<clé>.jsonl) ; vérité = pose finale du corpus (hors exclusions).
 *   node chantiers/CH-124/outils/refus.cjs garde  --ref N0 --nom N [--md F] [--csv F]
 *        rejeux de la garde d'octobre au banc (CH116_TRAVAIL/garde/<nom>/r-<lot>.jsonl) ; vérité = datasets/garde-gcv2/verites/.
 * Pour chaque lot : cuts identiques à la référence (état, pose, source, passe du profil L1-se ; les champs `ancre` et `ms` sont ignorés), cuts refusés par l'ancre
 * (source `ancre`), autres cuts changés (attendu : aucun, le refus est sans ricochet), cas où l'ancre se tait, par motif.
 * Chaque refus est jugé : « vraie correction » (pose refusée à plus de 50 mm de la vérité, pire rail 3D), « vraie faute » (à 10 mm au plus), « entre deux », « non jugé ».
 * Pour les poses gardées qui ont une vérité : écart en travers du milieu de la VÉRITÉ à l'axe (écart de la pose + différence des milieux en travers).
 * Sorties : numéros de cut, millimètres. */
const fs = require('node:fs'), path = require('node:path');
const Lb = require('./lib.cjs');
const SIDES = ['left', 'right'];
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut');
const pire = (a, b) => Math.max(...SIDES.map(s => Math.hypot(a[s][0] - b[s][0], a[s][1] - b[s][1], a[s][2] - b[s][2])));
const milieuLat = d => (d.left[1] + d.right[1]) / 2;
const cle = x => JSON.stringify({ e: x.etat, d: x.decal || null, s: x.source || null, p: x.passe2 ? (x.passe2.passe ?? true) : null });
const q = (v, p) => { const x = Lb.quantile(v, p); return x == null ? '-' : x.toFixed(1); };
function args(a) { const o = { mode: a[0] }; for (let i = 1; i < a.length; i++) { const k = a[i]; if (k === '--ref') o.ref = a[++i]; else if (k === '--nom') o.nom = a[++i]; else if (k === '--md') o.md = a[++i]; else if (k === '--csv') o.csv = a[++i]; else throw Error('option inconnue ' + k); } return o; }

function paires(o) {
  const W = Lb.travail(), out = [];
  if (o.mode === 'corpus') {
    const C = Lb.corpus();
    for (const e of Lb.entrees()) { const k = Lb.cle(e), a = path.join(W, 'rejeux', o.nom, k + '.jsonl'), b = path.join(W, 'rejeux', o.ref, k + '.jsonl'); if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
      const c = C.get(k) || new Map(); out.push({ lot: k, a, b, verite: cut => { const x = c.get(cut); return x && x.poseFinale && !x.exclu ? x.poseFinale : null; }, classe: cut => (c.get(cut) || {}).classe || null }); }
  } else if (o.mode === 'garde') {
    const base = JSON.parse(fs.readFileSync(path.join(Lb.RACINE, 'datasets', 'garde-gcv2', 'base-test18.json'), 'utf8'));
    for (const l of base.lots) { const a = path.join(W, 'garde', o.nom, `r-${l.nom}.jsonl`), b = path.join(W, 'garde', o.ref, `r-${l.nom}.jsonl`); if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
      const V = JSON.parse(fs.readFileSync(path.join(Lb.RACINE, 'datasets', 'garde-gcv2', 'verites', l.verite), 'utf8'));
      out.push({ lot: l.nom, a, b, verite: cut => V[cut] && V[cut].mic ? V[cut].mic : null, classe: () => null }); }
  } else throw Error('mode : corpus | garde');
  return out;
}
function main() {
  const o = args(process.argv.slice(2)); if (!o.ref || !o.nom) throw Error('--ref et --nom');
  const L = [], refus = [], gardees = [], csv = ['lot;cut;sort;origine;etage;ecartPoseAxeMm;ecartVeriteAxeMm;poseAVeriteMm;jugement;base'];
  let tId = 0, tAutres = 0, tCuts = 0; const muets = {}, autres = [];
  const veritesAxe = [];
  L.push(`# Refus d'ancre : rejeu « ${o.nom} » contre « ${o.ref} » (${o.mode})`, '', '| lot | cuts | identiques | refusés | autres changés | poses gardées avec ancre | ancre muette |', '|---|---|---|---|---|---|---|');
  for (const P of paires(o)) {
    const A = lire(P.a), B = new Map(lire(P.b).map(x => [x.cut, x])); let id = 0, nRef = 0, nAutres = 0, nGard = 0, nMuet = 0;
    for (const l of A) {
      const x = (l.profils || {})['L1-se'], yl = B.get(l.cut), y = yl && (yl.profils || {})['L1-se']; if (!x || !y) continue; tCuts++;
      const v = P.verite(l.cut), base = (l.profils || {}).base || null;
      if (v && l.ancreDepart && l.ancreDepart.ecartMm != null) veritesAxe.push({ lot: P.lot, cut: l.cut, ev: l.ancreDepart.ecartMm + milieuLat(v), pose: x.etat === 'pose' || x.source === 'ancre' });
      if (x.source === 'ancre') {
        nRef++; const d = x.decalRefuse, pv = v && d ? pire(d, v) : null, ev = v && d ? x.ancre.ecartMm + (milieuLat(v) - milieuLat(d)) : null;
        const jug = pv == null ? 'non jugé' : pv > 50 ? 'vraie correction' : pv <= 10 ? 'vraie faute' : 'entre deux';
        refus.push({ lot: P.lot, cut: l.cut, origine: x.origine, etage: x.etage, ecart: x.ancre.ecartMm, ev, pv, jug, base: base ? base.etat : null, etaitPose: y.etat === 'pose' });
        csv.push([P.lot, l.cut, 'refus', x.origine, x.etage, x.ancre.ecartMm, ev == null ? '' : ev.toFixed(1), pv == null ? '' : pv.toFixed(1), jug, base ? base.etat : ''].join(';'));
        if (y.etat !== 'pose') { nAutres++; autres.push(`${P.lot}/${l.cut} (refusé alors que la référence ne posait pas)`); }
        continue;
      }
      if (cle(x) === cle(y)) id++; else { nAutres++; autres.push(`${P.lot}/${l.cut} : ${y.etat} (${y.source || ''}) → ${x.etat} (${x.source || ''})`); }
      if (x.ancre && x.ancre.muet) { nMuet++; muets[x.ancre.muet] = (muets[x.ancre.muet] || 0) + 1; }
      else if (x.ancre && x.etat === 'pose') { nGard++; const pv = v && x.decal ? pire(x.decal, v) : null, ev = v && x.decal ? x.ancre.ecartMm + (milieuLat(v) - milieuLat(x.decal)) : null;
        gardees.push({ lot: P.lot, cut: l.cut, ecart: x.ancre.ecartMm, ev, pv });
        csv.push([P.lot, l.cut, 'pose', x.source || '', x.etage || '', x.ancre.ecartMm, ev == null ? '' : ev.toFixed(1), pv == null ? '' : pv.toFixed(1), '', base ? base.etat : ''].join(';')); }
    }
    tId += id; tAutres += nAutres; L.push(`| ${P.lot} | ${A.length} | ${id} | ${nRef} | ${nAutres} | ${nGard} | ${nMuet} |`);
  }
  L.push(`| **total** | ${tCuts} | ${tId} | ${refus.length} | ${tAutres} | ${gardees.length} | ${Object.values(muets).reduce((a, b) => a + b, 0)} |`, '');
  if (autres.length) L.push('Autres cuts changés : ' + autres.join(' ; '), '');
  L.push(`Ancre muette, par motif : ${Object.entries(muets).map(([k, n]) => `${k} ${n}`).join(', ') || 'aucun cas'}.`, '');
  const compte = j => refus.filter(r => r.jug === j).length;
  L.push(`## Les ${refus.length} refus, jugés contre la vérité`, `Vraies corrections (pose refusée à plus de 50 mm de la vérité) : **${compte('vraie correction')}** ; vraies fautes (à 10 mm au plus) : **${compte('vraie faute')}** ; entre deux : ${compte('entre deux')} ; non jugés : ${compte('non jugé')}.`, '',
    '| lot | cut | origine | étage | pose refusée − axe (mm) | vérité − axe (mm) | pose refusée à la vérité (mm) | jugement | profil base |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of refus) L.push(`| ${r.lot} | ${r.cut} | ${r.origine} | ${r.etage} | ${r.ecart} | ${r.ev == null ? '' : r.ev.toFixed(1)} | ${r.pv == null ? '' : r.pv.toFixed(1)} | ${r.jug} | ${r.base || ''} |`);
  const g = gardees.map(x => Math.abs(x.ecart)), gv = gardees.filter(x => x.ev != null), gj = gv.filter(x => x.pv <= 10), gf = gv.filter(x => x.pv > 50);
  L.push('', '## Les poses gardées', `Écart en travers de la pose à l'axe (|mm|) : n ${g.length}, médiane ${q(g, 0.5)}, q99 ${q(g, 0.99)}, max ${g.length ? Math.max(...g).toFixed(1) : '-'}.`,
    `Avec une vérité : ${gv.length} ; vérité − axe (|mm|) : médiane ${q(gv.map(x => Math.abs(x.ev)), 0.5)}, q99 ${q(gv.map(x => Math.abs(x.ev)), 0.99)}, max ${gv.length ? Math.max(...gv.map(x => Math.abs(x.ev))).toFixed(1) : '-'} ; au-delà de 40 mm : ${gv.filter(x => Math.abs(x.ev) > 40).length}.`,
    `Poses gardées justes (≤ 10 mm de la vérité) : ${gj.length} ; poses gardées à plus de 50 mm de la vérité (fautes que l'ancre ne refuse pas) : ${gf.length}${gf.length ? ' : ' + gf.map(x => `${x.lot}/${x.cut} (pose à ${x.pv.toFixed(0)} mm de la vérité, à ${x.ecart} mm de l'axe ; vérité à ${x.ev.toFixed(0)} mm de l'axe)`).join(' ; ') : ''}.`);
  const va = veritesAxe.map(x => Math.abs(x.ev)), loin = veritesAxe.filter(x => Math.abs(x.ev) > 40).sort((a, b) => Math.abs(b.ev) - Math.abs(a.ev));
  L.push('', '## La vérité contre l\'axe, tous les cuts jugés où l\'ancre parle (posés ou différés)', `n ${va.length} ; |vérité − axe| : médiane ${q(va, 0.5)}, q90 ${q(va, 0.9)}, q99 ${q(va, 0.99)}, max ${va.length ? Math.max(...va).toFixed(1) : '-'} ; au-delà de 40 mm : ${loin.length} ; au-delà de 75 mm : ${loin.filter(x => Math.abs(x.ev) > 75).length}.`,
    loin.length ? 'Au-delà de 40 mm : ' + loin.slice(0, 40).map(x => `${x.lot}/${x.cut} ${x.ev.toFixed(0)}`).join(' ; ') : '');
  const txt = L.join('\n') + '\n'; process.stdout.write(txt); if (o.md) fs.writeFileSync(o.md, txt); if (o.csv) fs.writeFileSync(o.csv, csv.join('\n') + '\n');
}
if (require.main === module) { try { main(); } catch (e) { process.stderr.write('refus : ' + (e.stack || e.message) + '\n'); process.exitCode = 1; } }
