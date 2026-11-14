#!/usr/bin/env node
'use strict';
/* CH-125, niveau 2 : le travers des poses de la GCV2, en simulation STATIQUE (hors ligne, lecture seule ; la mesure est refaite sur le nuage du cut à la
 * pose livrée, les décisions ne sont pas rejouées). Copie de la règle du patch flanc-source.patch (`flancSuivi` de estimateurs.cjs).
 *   node chantiers/CH-125/outils/travers-gcv2.cjs --rails DOSSIER --gabarit G.json [--rejeu REJEU_LIVRE] [--max 20] [--seuils 3,4,5,6,7,8] [--detail]
 * Pour chaque cut jugé posé par la GCV2 (hors mauvaises voies du livré) : le flanc de chaque rail est relu à sa pose ; s'il la contredit d'au moins T mm,
 * il est suivi et le rail prend sa place (borne `--max`). La paire mesurée garde son écartement dans le contrat (1 420 à 1 470 mm), ou ne s'en éloigne
 * pas plus que la paire livrée (écartement approché : écartement de départ + déplacements latéraux des deux rails).
 * Le SEUIL T est appris par pli : le plus petit entier de `--seuils` qui n'éloigne aucun cut des lots d'apprentissage de plus de 1 mm de la pose finale
 * de l'opérateur (pire rail). Chaque lot est jugé avec le T de son pli. Erreur d'un cut : pire rail, travers et hauteur ensemble, arrondie au dixième. */
const fs = require('node:fs'), path = require('node:path');
const R = require('./rails.cjs'), E = require('./estimateurs.cjs');
const a = process.argv.slice(2), o = { max: 20, seuils: [3, 4, 5, 6, 7, 8], detail: false };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--rejeu') o.rejeu = v(); else if (k === '--max') o.max = +v(); else if (k === '--seuils') o.seuils = v().split(',').map(Number); else if (k === '--detail') o.detail = true; else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), r1 = v => v == null || !Number.isFinite(v) ? '-' : (Math.round(v * 10) / 10).toFixed(1);
const rails = R.lire(o.rails, {}).filter(r => r.classeLot !== 'mauvaise-voie' && r.source === 'gcv2');
/* motif de la décision au rejeu livré (pour dire d'où vient la pose) */
const rej = new Map(), motif = r => { if (!o.rejeu) return ''; const f = path.join(o.rejeu, `${r.lot}-p${r.partie}-r${r.rang}.jsonl`); if (!rej.has(f)) { const m = new Map(); for (const s of fs.readFileSync(f, 'utf8').split('\n')) { if (!s) continue; const l = JSON.parse(s); if (l.type === 'cut') m.set(l.cut, l); } rej.set(f, m); }
  const l = rej.get(f).get(r.cut), p = l && l.profils && Object.values(l.profils)[0], l1 = p && p.l1 || {}; return (l1.motif || 'valider') + (l1.correction && l1.correction.appliquee ? ` (corrigé ${l1.correction.rail === 'left' ? 'g' : 'd'})` : ''); };
/* le flanc au seuil le plus bas : `premier` et `du` ne dépendent du seuil que par le déclenchement */
for (const r of rails) { r.dl = (r.finale[0] - r.livre[0]) * 1000; r.dv = (r.finale[1] - r.livre[1]) * 1000; r.f = E.flancSuivi(r.pts, gab, r.livre, { seuilMm: Math.min(...o.seuils), maxMm: o.max }); }
const cuts = new Map(); for (const r of rails) { const k = `${r.lot} ${r.partie}/${r.cut}`; if (!cuts.has(k)) cuts.set(k, { k, lot: r.lot, rails: [], motif: motif(r) }); cuts.get(k).rails.push(r); }
const hors = g => g < 1420 ? 1420 - g : g > 1470 ? g - 1470 : 0;
function mesurer(c, T) {
  const d = {}; let bouge = false;
  for (const r of c.rails) { const f = r.f; d[r.cote] = f && f.du !== null && Math.abs(f.premier) >= T && Math.abs(f.du) >= T ? f.du : 0; if (d[r.cote]) bouge = true; }
  if (bouge && c.rails.length === 2) { const g0 = c.rails[0].ecartementDepartMm + 1000 * (c.rails[0].livre[0] + c.rails[1].livre[0]), g1 = g0 + c.rails.reduce((s, r) => s + d[r.cote], 0);
    if (hors(g1) > hors(g0) + 1e-6) return { d: Object.fromEntries(c.rails.map(r => [r.cote, 0])), refus: `écartement ${r1(g0)} → ${r1(g1)}` }; }
  return { d, refus: null };
}
const err = (c, d) => Math.round(10 * Math.max(...c.rails.map(r => Math.hypot(r.dl - (d ? d[r.cote] : 0), r.dv)))) / 10;
const eloignes = (L, T) => L.filter(c => err(c, mesurer(c, T).d) > err(c, null) + 1).length;
const LOTS = R.LOTS_REGLABLES, tous = [...cuts.values()], Tpli = {};
for (const lot of [...LOTS, 'final']) { const appr = tous.filter(c => c.lot !== lot); Tpli[lot] = o.seuils.find(T => eloignes(appr, T) === 0) ?? null; }
const S = [`Travers des poses GCV2, simulation statique : ${tous.length} cuts jugés posés par la GCV2 (hors mauvaises voies du livré), borne ${o.max} mm.`, '',
  '## Sensibilité au seuil (tous les lots réglables ensemble)', '| seuil T (mm) | cuts déplacés | rapprochés (> 1 mm) | éloignés (> 1 mm) | ≤ 10 mm : gagnés | perdus |', '|---|---|---|---|---|---|'];
for (const T of o.seuils) { let dep = 0, m = 0, p = 0, g = 0, pe = 0; for (const c of tous) { const x = mesurer(c, T), e0 = err(c, null), e = err(c, x.d); if (Object.values(x.d).some(v => v)) dep++; if (e < e0 - 1) m++; if (e > e0 + 1) p++; if (e0 > 10 && e <= 10) g++; if (e0 <= 10 && e > 10) pe++; }
  S.push(`| ${T} | ${dep} | ${m} | ${p} | ${g} | ${pe} |`); }
S.push('', '## Seuil appris par pli, et jugement de chaque lot avec le seuil de son pli', '| lot tenu à l\'écart | T du pli | cuts GCV2 jugés | ≤ 10 mm livré | ≤ 10 mm mesuré | gagnés | perdus | déplacés | rapprochés | éloignés |', '|---|---|---|---|---|---|---|---|---|---|');
const tot = { n: 0, a: 0, b: 0, g: 0, p: 0, dep: 0, m: 0, e: 0 }, det = [];
for (const lot of LOTS) { const T = Tpli[lot], L = tous.filter(c => c.lot === lot), t = { n: L.length, a: 0, b: 0, g: 0, p: 0, dep: 0, m: 0, e: 0 };
  for (const c of L) { const x = T === null ? { d: null } : mesurer(c, T), e0 = err(c, null), e = err(c, x.d); if (e0 <= 10) t.a++; if (e <= 10) t.b++; if (e0 > 10 && e <= 10) t.g++; if (e0 <= 10 && e > 10) t.p++;
    const bouge = x.d && Object.values(x.d).some(v => v); if (bouge) t.dep++; if (e < e0 - 1) t.m++; if (e > e0 + 1) t.e++;
    if (bouge || x.refus) det.push(`| ${c.k} | ${c.motif} | ${c.rails.map(r => `${r.cote === 'left' ? 'g' : 'd'} ${r1(x.d[r.cote])} (opérateur ${r1(r.dl)}${r.f && r.f.depart === 'large' && x.d[r.cote] ? ', départ large' : ''})`).join(' ; ')} | ${e0} → ${e}${x.refus ? ' ; refus : ' + x.refus : ''} |`); }
  for (const k of Object.keys(tot)) tot[k] += t[k];
  S.push(`| ${lot} | ${T} | ${t.n} | ${t.a} | ${t.b} | ${t.g} | ${t.p} | ${t.dep} | ${t.m} | ${t.e} |`); }
S.push(`| **total** | final : ${Tpli.final} | ${tot.n} | ${tot.a} | ${tot.b} | ${tot.g} | ${tot.p} | ${tot.dep} | ${tot.m} | ${tot.e} |`);
S.push('', '## Cuts déplacés (seuil du pli) : déplacement latéral proposé par rail (mm, + vers le champignon) et retouche de l\'opérateur', '| cut | décision livrée | rails | erreur du cut (pire rail) |', '|---|---|---|---|', ...det);
process.stdout.write(S.join('\n') + '\n');
process.stdout.write('\n' + JSON.stringify({ maxMm: o.max, seuilMm: Tpli }) + '\n');
