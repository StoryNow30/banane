#!/usr/bin/env node
'use strict';
/* CH-117 — tableau standard d'un rejeu contre un témoin (hors ligne, lecture seule).
 *   node chantiers/CH-117/outils/comparer.cjs --temoin T.jsonl --rejeu R.jsonl --verite V.json [--temoin … --rejeu … --verite …] [--profil L1-se] [--csv changes.csv] [--nom LOT]
 * Juge unique (celui de CH-113) : pire rail, distance 3D, juste ≤ 10 mm, mauvaise voie > 50 mm.
 * Par lot : posés, jugés, ≤ 10, 10-50, > 50, différés ; mauvaises voies retirées, ajoutées ; justes perdus (différés), justes dégradés (> 10 mm) ;
 * différés de plus ; cuts changés (état ou pose à plus de 1 mm). Des comptes, des mm et des numéros de cut. */
const fs = require('node:fs');
const a = process.argv.slice(2), T = [], R = [], V = [], N = []; let profil = 'L1-se', csv = null;
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i];
  if (k === '--temoin') T.push(v()); else if (k === '--rejeu') R.push(v()); else if (k === '--verite') V.push(v()); else if (k === '--nom') N.push(v());
  else if (k === '--profil') profil = v(); else if (k === '--csv') csv = v(); else throw Error('option inconnue ' + k); }
if (!T.length || T.length !== R.length || R.length !== V.length) throw Error('--temoin --rejeu --verite, autant de chaque');
const SIDES = ['left', 'right'];
const dist = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
const ecart = (d, m) => Math.max(...SIDES.map(s => dist(d[s], m[s])));
const lire = f => new Map(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(l => l.type === 'cut').map(l => [l.cut, l]));
const pose = l => { const x = l && l.profils && l.profils[profil]; return x && x.etat === 'pose' && x.decal ? x.decal : null; };
const classe = e => e == null ? null : e <= 10 ? 'juste' : e <= 50 ? 'moyen' : 'faux';
const r1 = v => v == null ? '' : Math.round(v * 10) / 10;
const lignes = ['lot;cut;zone;temoin_etat;temoin_mm;rejeu_etat;rejeu_mm;motif'];
const tot = {};
const out = [];
for (let k = 0; k < T.length; k++) {
  const t = lire(T[k]), r = lire(R[k]), v0 = JSON.parse(fs.readFileSync(V[k], 'utf8')), ver = v0.verite || v0, nom = N[k] || R[k];
  const s = { cuts: 0, poses: 0, juges: 0, juste: 0, moyen: 0, faux: 0, differes: 0, temoinFaux: 0, temoinDifferes: 0, fauxRetires: [], fauxAjoutes: [], justesPerdus: [], justesDegrades: [], changes: 0, nonJugesNouveaux: 0 };
  for (const [cut, lr] of r) {
    const lt = t.get(cut); s.cuts++;
    const pr = pose(lr), pt = pose(lt), m = ver[cut] && ver[cut].mic;
    const er = pr && m ? ecart(pr, m) : null, et = pt && m ? ecart(pt, m) : null;
    if (pr) { s.poses++; if (er != null) { s.juges++; s[classe(er)]++; } } else s.differes++;
    if (!pt) s.temoinDifferes++; else if (et != null && et > 50) s.temoinFaux++;
    const change = !!pr !== !!pt || (pr && pt && ecart(pr, pt) > 1);
    if (!change) continue;
    s.changes++;
    if (et > 50 && !(er > 50)) s.fauxRetires.push(cut);
    if (er > 50 && !(et > 50)) s.fauxAjoutes.push(cut);
    if (et != null && et <= 10 && !pr) s.justesPerdus.push(cut);
    if (et != null && et <= 10 && er > 10) s.justesDegrades.push(cut + '@' + Math.round(er));
    if (pr && !pt && er == null) s.nonJugesNouveaux++;
    const x = lr.profils[profil]; const motif = x && (x.vetoChaine ? 'veto-chaine' : x.l1 ? x.l1.motif : x.source) || '';
    lignes.push([nom, cut, lr.zone, pt ? 'pose' : 'differe', r1(et), pr ? 'pose' : 'differe', r1(er), motif].join(';'));
  }
  out.push({ nom, ...s });
  for (const [kk, vv] of Object.entries(s)) tot[kk] = Array.isArray(vv) ? (tot[kk] || []).concat(vv.map(c => nom + ':' + c)) : (tot[kk] || 0) + vv;
}
const fmt = s => `posés ${s.poses} · jugés ${s.juges} · ≤10 ${s.juste} · 10-50 ${s.moyen} · >50 ${s.faux} (témoin ${s.temoinFaux}) · différés ${s.differes} (témoin ${s.temoinDifferes}, ${s.differes - s.temoinDifferes >= 0 ? '+' : ''}${s.differes - s.temoinDifferes})` +
  ` · changés ${s.changes} · faux retirés [${s.fauxRetires.join(' ')}] · faux ajoutés [${s.fauxAjoutes.join(' ')}] · justes perdus [${s.justesPerdus.join(' ')}] · justes > 10 mm [${s.justesDegrades.join(' ')}] · nouveaux posés non jugés ${s.nonJugesNouveaux}`;
for (const s of out) console.log(s.nom + ' : ' + fmt(s));
if (out.length > 1) console.log('TOTAL : ' + fmt(tot));
if (csv) fs.writeFileSync(csv, lignes.join('\n') + '\n');
