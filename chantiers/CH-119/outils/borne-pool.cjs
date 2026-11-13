#!/usr/bin/env node
'use strict';
/* CH-119 : borne du levier « choix de voie global » (mesure 1 du ticket). Hors ligne, lecture seule.
 *   CH116_TRAVAIL=… CH116_CORPUS=… node chantiers/CH-119/outils/borne-pool.cjs --nom pool [--csv SORTIE.csv]
 * Pour chaque cut ADV du rejeu (patch banc-pool.patch, CH119_POOL=1) qui a une vérité au corpus (pose finale de l'opérateur, cut jugé) :
 * la bonne paire est-elle dans le pool de la GCV2 (les deux rails à 10 mm, 3D, au plus), son rang parmi les paires permises (écartement :
 * médiane ± 15 mm ou contrat 1 420–1 470, comme `meilleurePaire`) classées par produit des probabilités, et la plus proche hypothèse par rail.
 * Sorties : comptes et numéros de cut seulement. */
const fs = require('node:fs'), path = require('node:path');
const { LOTS, cle, travail } = require('../../CH-116/outils/lots.cjs');
const SIDES = ['left', 'right'];
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s));
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const fini = v => typeof v === 'number' && Number.isFinite(v);
const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
const nom = opt('--nom') || 'pool', csv = opt('--csv');
const corpus = new Map(lire(process.env.CH116_CORPUS || path.join(travail(), 'corpus.jsonl')).map(l => [`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l]));
const jugeable = c => c && c.poseFinale && (!c.exclu || /^d285-/.test(c.exclu));
function analyse(l, c) {
  const P = l.pool, v = c.poseFinale, out = { G0: P.G0, gMed: P.gMed };
  const proche = {};
  for (const s of SIDES) { let b = null; P.rails[s].forEach((h, i) => { const e = d3(h.d, v[s]); if (!b || e < b.e) b = { e, i }; }); proche[s] = b; }
  out.procheL = proche.left.e; out.procheR = proche.right.e;
  const paires = [];
  P.rails.left.forEach((hl, i) => P.rails.right.forEach((hr, j) => {
    const g = fini(P.G0) && fini(hl.g) && fini(hr.g) ? P.G0 + (hl.g - P.G0) + (hr.g - P.G0) : null;
    const permise = fini(g) && ((fini(P.gMed) && Math.abs(g - P.gMed) <= 15) || (g >= 1420 && g <= 1470)) || (i === P.i0.left && j === P.i0.right);
    paires.push({ i, j, g, permise, v: (hl.p ?? 0) * (hr.p ?? 0), e: Math.max(d3(hl.d, v.left), d3(hr.d, v.right)) });
  }));
  const perm = paires.filter(p => p.permise).sort((x, y) => y.v - x.v);
  const bonnes = paires.filter(p => p.e <= 10), bonnesPerm = perm.filter(p => p.e <= 10);
  out.bonneDansPool = bonnes.length > 0; out.bonnePermise = bonnesPerm.length > 0;
  out.rang = bonnesPerm.length ? perm.indexOf(bonnesPerm[0]) + 1 : null; out.nPermises = perm.length;
  out.meilleure = perm[0] ? Math.round(perm[0].e * 10) / 10 : null;
  out.pBonne = bonnesPerm.length ? bonnesPerm[0].v : null; out.pMeilleure = perm[0] ? perm[0].v : null;
  out.e50 = paires.some(p => p.e <= 50);
  return out;
}
const lignes = [];
for (const e of LOTS) {
  const f = path.join(travail(), 'rejeux', nom, cle(e) + '.jsonl'); if (!fs.existsSync(f)) continue;
  for (const l of lire(f).filter(x => x.type === 'cut' && x.zone === 'adv')) {
    const c = corpus.get(`${cle(e)}:${l.cut}`), x = (l.profils || {})['L1-se'] || {};
    if (!jugeable(c)) continue;
    const pose = x.etat === 'pose' && x.decal ? x.decal : null, mm = pose ? Math.max(d3(pose.left, c.poseFinale.left), d3(pose.right, c.poseFinale.right)) : null;
    const r = { cle: cle(e), lot: e.lot, partie: e.partie, cut: l.cut, etat: x.etat, source: x.source || '', mm: mm == null ? null : Math.round(mm * 10) / 10, sortLot: c.sortLot };
    if (l.pool && !l.pool.erreur) Object.assign(r, analyse(l, c)); else r.sansPool = l.pool ? l.pool.erreur : 'absent';
    lignes.push(r);
  }
}
const cl = r => r.mm == null ? 'differe' : r.mm <= 10 ? 'juste' : r.mm <= 50 ? '10-50' : 'plus-50';
const groupes = {};
for (const r of lignes) { const k = cl(r); (groupes[k] = groupes[k] || []).push(r); }
const pc = (n, d) => d ? `${n}/${d} (${(100 * n / d).toFixed(0)} %)` : '0/0';
console.log(`Cuts ADV jugés du rejeu « ${nom} » : ${lignes.length} (sans pool : ${lignes.filter(r => r.sansPool).length})`);
console.log('| classe au rejeu | cuts | bonne paire dans le pool | permise | 1re des permises | rang 2-3 | une paire à 50 mm |\n|---|---|---|---|---|---|---|');
for (const k of ['juste', '10-50', 'plus-50', 'differe']) {
  const g = (groupes[k] || []).filter(r => !r.sansPool), n = g.length;
  console.log(`| ${k} | ${n} | ${pc(g.filter(r => r.bonneDansPool).length, n)} | ${pc(g.filter(r => r.bonnePermise).length, n)} | ${pc(g.filter(r => r.rang === 1).length, n)} | ${pc(g.filter(r => r.rang >= 2 && r.rang <= 3).length, n)} | ${pc(g.filter(r => r.e50).length, n)} |`);
}
console.log('\nMauvaises voies du rejeu (> 50 mm) :');
for (const r of (groupes['plus-50'] || [])) console.log(`  ${r.lot} ${r.partie}/${r.cut} ${r.mm} mm (${r.source}) : bonne paire ${r.bonneDansPool ? (r.bonnePermise ? 'permise rang ' + r.rang + '/' + r.nPermises : 'non permise') : 'absente'} ; plus proche hyp. G ${r.procheL?.toFixed(0)} D ${r.procheR?.toFixed(0)} mm`);
if (csv) fs.writeFileSync(csv, Object.keys(lignes[0]).join(';') + '\n' + lignes.map(r => Object.keys(lignes[0]).map(k => r[k] ?? '').join(';')).join('\n') + '\n');
