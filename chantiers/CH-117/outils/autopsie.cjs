#!/usr/bin/env node
'use strict';
/* CH-117 — autopsie des mauvaises voies (hors ligne, lecture seule).
 * Entrées : un rejeu du banc (`tools/banc-differes.cjs rejouer`, profil L1-se, de préférence avec
 * BANC_LEVIERS='{"diag":true,"contreChaineZones":["adv","abords","pn"]}' : la GCV2 donne alors son avis, sans effet, sur les poses de la chaîne),
 * la vérité d'Écho (`tools/garde-gcv2.cjs verite`), et le journal du lot (événements `b1-ombre` : appuis réels de la chaîne).
 *
 *   node chantiers/CH-117/outils/autopsie.cjs --rejeu R.jsonl --verite V.json [--journal J.json] [--profil L1-se] [--seuil 50] [--csv sortie.csv] [--tous]
 *
 * Par cut posé jugé à plus de `seuil` mm (pire rail, 3D) : étage et motif, appuis, ce que la vérité demandait (décalage latéral de la pose de
 * l'opérateur depuis la pose de départ d'ESV), la pose prise, le pool d'hypothèses de la GCV2 (la plus proche de la vérité, rail par rail),
 * la voie des voisins vue par la GCV2 (et son écart à la vérité), les voisins posés plus tôt (jugés). Des mm et des numéros de cut seulement. */
const fs = require('node:fs');
const args = process.argv.slice(2); const o = { profil: 'L1-se', seuil: 50, tous: false };
for (let i = 0; i < args.length; i++) { const k = args[i], v = () => args[++i];
  if (k === '--rejeu') o.rejeu = v(); else if (k === '--verite') o.verite = v(); else if (k === '--journal') o.journal = v(); else if (k === '--profil') o.profil = v();
  else if (k === '--seuil') o.seuil = Number(v()); else if (k === '--csv') o.csv = v(); else if (k === '--tous') o.tous = true; else throw Error('option inconnue ' + k); }
const SIDES = ['left', 'right'];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ecart = (d, m) => Math.max(...SIDES.map(s => dist(d[s], m[s])));
const r1 = v => v == null || !Number.isFinite(v) ? '' : Math.round(v * 10) / 10;
const L = fs.readFileSync(o.rejeu, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(l => l.type === 'cut');
const V0 = JSON.parse(fs.readFileSync(o.verite, 'utf8')); const V = V0.verite || V0;
const appuisReels = new Map();
if (o.journal) { const j = JSON.parse(fs.readFileSync(o.journal, 'utf8'));
  for (const e of j.events || []) if (e && e.type === 'b1-ombre' && e.identity && e.reel) appuisReels.set(e.identity.cut, e.reel); }
const poseDe = l => { const x = l.profils && l.profils[o.profil]; return x && x.etat === 'pose' && x.decal ? x : null; };
const juge = new Map();
for (const l of L) { const x = poseDe(l), v = V[l.cut]; if (x && v && v.mic) juge.set(l.cut, ecart(x.decal, v.mic)); }
const lignes = [['cut', 'zone', 'errMm', 'source', 'etage', 'motifL1', 'p', 'tau', 'raisonChaine', 'appuisReels', 'validesListe', 'verLatG', 'verLatD', 'poseLatG', 'poseLatD',
  'nHypG', 'nHypD', 'poolG', 'poolD', 'voieSrc', 'voieDist', 'voieLatG', 'voieLatD', 'voieVsVerite', 'ombreMotif', 'ombreErrMm', 'voisinsAvant'].join(';')];
for (const l of L) {
  const x = poseDe(l), v = V[l.cut]; if (!x || !v || !v.mic) continue;
  const err = juge.get(l.cut); if (!o.tous && !(err > o.seuil)) continue;
  const l1 = x.l1 || x.ombre || null, dg = l1 && l1.diag, mic = v.mic;
  const pool = s => dg && dg.hyps && dg.hyps[s] ? Math.min(...dg.hyps[s].map(h => Math.hypot(h[0] - mic[s][1], h[1] - mic[s][2]))) : null;
  const vv = dg && dg.voieVal; const vsv = vv ? Math.max(...SIDES.map(s => Math.abs(vv[s][0] - mic[s][1]))) : null;
  const ombreErr = x.ombre && x.ombre.paire ? ecart(x.ombre.paire, mic) : null;
  const avant = L.filter(m => m.cut < l.cut && m.cut >= l.cut - 6 && poseDe(m)).map(m => m.cut + (juge.has(m.cut) ? '@' + Math.round(juge.get(m.cut)) : '@?') + ':' + (poseDe(m).source === 'gcv2' ? 'g' : poseDe(m).etage[0])).join(' ');
  const ar = appuisReels.get(l.cut);
  lignes.push([l.cut, l.zone, r1(err), x.source, x.etage, l1 ? l1.motif || '' : '', l1 ? l1.p ?? '' : '', l1 ? l1.tau ?? '' : '', x.raison || (l1 && l1.chaine ? l1.chaine.reason : '') || '',
    ar ? (ar.anchorsUsed || []).join(',') : '', ar && ar.validatedAnchors ? ar.validatedAnchors.join(',') : '',
    r1(mic.left[1]), r1(mic.right[1]), r1(x.decal.left[1]), r1(x.decal.right[1]),
    l1 && l1.nHyp ? l1.nHyp.left : '', l1 && l1.nHyp ? l1.nHyp.right : '', r1(pool('left')), r1(pool('right')),
    dg ? dg.voie || '' : '', dg ? dg.voieProcheDist ?? '' : '', vv ? r1(vv.left[0]) : '', vv ? r1(vv.right[0]) : '', r1(vsv),
    x.ombre ? x.ombre.motif || x.ombre.etat || '' : '', r1(ombreErr), avant].join(';'));
}
const out = lignes.join('\n') + '\n';
if (o.csv) fs.writeFileSync(o.csv, out); else process.stdout.write(out);
