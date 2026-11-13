#!/usr/bin/env node
'use strict';
/* CH-125 : mesure par rail, avant tout rejeu d'une variante (hors ligne, lecture seule ; simulation STATIQUE : la mesure est refaite sur le nuage du
 * cut à la pose livrée, les décisions ne sont pas rejouées).
 *   node chantiers/CH-125/outils/mesure.cjs --rails DOSSIER --gabarit G.json [--lots …] [--variantes a,b] [--csv PAR-RAIL.csv] [--detail]
 * Erreur = pose finale de l'opérateur − pose (mm ; travers orienté vers le champignon, hauteur vers le haut). Par zone et par étage : rails, médiane et
 * 90e centile des valeurs absolues, part au-delà de 5 mm ; par cut : pire rail (travers et hauteur), part à 10 mm au plus.
 * Les mauvaises voies du livré (> 50 mm) sont hors de la mesure de précision (comptées à part). Les constantes d'une variante (décalages de convention)
 * sont APPRISES PAR PLI : pour juger un lot, sur les rails des autres lots réglables seulement. */
const fs = require('node:fs');
const R = require('./rails.cjs'), V = require('./variantes.cjs'), N = require('./nuage.cjs');
const a = process.argv.slice(2), o = { lots: R.LOTS_REGLABLES, variantes: null, detail: false };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rails') o.rails = v(); else if (k === '--gabarit') o.gabarit = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--variantes') o.variantes = v().split(','); else if (k === '--csv') o.csv = v(); else if (k === '--detail') o.detail = true; else throw Error('option inconnue ' + k); }
const gab = R.gabarit(o.gabarit), rails = R.lire(o.rails, { lots: o.lots });
const med = N.mediane, q = N.quantile, r1 = v => v == null || !Number.isFinite(v) ? '' : Math.round(v * 10) / 10, pc = (k, n) => n ? (100 * k / n).toFixed(1) + ' %' : '-';
const noms = o.variantes || Object.keys(V.VARIANTES);

/* Mesures brutes par rail (une fois), puis constantes par pli, puis poses. */
const ctx = { gab };
for (const r of rails) r.m = {};
const lots = [...new Set(rails.map(r => r.lot))];
const res = {}; /* nom → Map(cléRail → pose) */
for (const nom of noms) {
  const v = V.VARIANTES[nom]; if (!v) throw Error('variante inconnue ' + nom);
  for (const r of rails) r.m[nom] = v.mesurer(r, ctx);
  res[nom] = new Map(); const consts = {};
  for (const lot of lots) {
    const appr = rails.filter(r => r.lot !== lot && r.classeLot !== 'mauvaise-voie'), k = v.apprendre ? v.apprendre(appr, nom) : {};
    consts[lot] = k;
    for (const r of rails.filter(r => r.lot === lot)) res[nom].set(r, v.poser(r, r.m[nom], k));
  }
  res[nom].consts = consts;
}
const erreur = (r, pose) => [(r.finale[0] - pose[0]) * 1000, (r.finale[1] - pose[1]) * 1000];
const horsMV = rails.filter(r => r.classeLot !== 'mauvaise-voie');

function tableauRails(nom, grouper, titre) {
  const G = new Map();
  for (const r of horsMV) { const g = grouper(r); if (!G.has(g)) G.set(g, []); G.get(g).push(erreur(r, res[nom].get(r))); }
  const out = [titre, '| groupe | rails | travers : médiane | p90 | > 5 mm | biais | hauteur : médiane | p90 | > 5 mm | biais |', '|---|---|---|---|---|---|---|---|---|---|'];
  const L = (g, e) => { const al = e.map(x => Math.abs(x[0])), av = e.map(x => Math.abs(x[1]));
    return `| ${g} | ${e.length} | ${r1(med(al))} | ${r1(q(al, .9))} | ${pc(al.filter(x => x > 5).length, e.length)} | ${r1(med(e.map(x => x[0])))} | ${r1(med(av))} | ${r1(q(av, .9))} | ${pc(av.filter(x => x > 5).length, e.length)} | ${r1(med(e.map(x => x[1])))} |`; };
  for (const [g, e] of [...G.entries()].sort()) out.push(L(g, e));
  out.push(L('**tous**', [...G.values()].flat()));
  return out.join('\n');
}
/* Par cut : pire rail (2D travers-hauteur ; le longitudinal est nul), classe à 10 mm, contre la pose livrée. */
function parCut(nom) {
  const C = new Map();
  for (const r of rails) { const k = `${r.lot}:${r.partie}:${r.rang}:${r.cut}`, e = erreur(r, res[nom].get(r)), e0 = erreur(r, r.livre), d = Math.hypot((res[nom].get(r)[0] - r.livre[0]) * 1000, (res[nom].get(r)[1] - r.livre[1]) * 1000);
    const c = C.get(k) || { lot: r.lot, partie: r.partie, cut: r.cut, zone: r.zone, etage: r.etage, source: r.source, classeLot: r.classeLot, mm: 0, mm0: 0, depl: 0 };
    c.mm = Math.max(c.mm, Math.hypot(e[0], e[1])); c.mm0 = Math.max(c.mm0, Math.hypot(e0[0], e0[1])); c.depl = Math.max(c.depl, d); C.set(k, c); }
  /* arrondi au dixième avant de classer, comme le banc de CH-116 */
  for (const c of C.values()) { c.mm = Math.round(c.mm * 10) / 10; c.mm0 = Math.round(c.mm0 * 10) / 10; }
  return [...C.values()];
}
function bilanCuts(nom) {
  const C = parCut(nom), T = {};
  const add = (g, c) => { const t = (T[g] = T[g] || { cuts: 0, mv: 0, a10: 0, a10ref: 0, gagnes: [], perdus: [], deplaces: 0, plus50: [] }); t.cuts++;
    if (c.mm0 > 50) { t.mv++; return; }
    if (c.mm0 <= 10) t.a10ref++; if (c.mm <= 10) t.a10++;
    if (c.mm0 > 10 && c.mm <= 10) t.gagnes.push(`${c.partie}/${c.cut} ${r1(c.mm0)}→${r1(c.mm)}`); if (c.mm0 <= 10 && c.mm > 10) t.perdus.push(`${c.partie}/${c.cut} ${r1(c.mm0)}→${r1(c.mm)}`);
    if (c.mm > 50) t.plus50.push(`${c.partie}/${c.cut}`); if (c.depl > 0.5) t.deplaces++; };
  for (const c of C) add(c.lot, c);
  for (const c of C) add('**total**', c);
  const out = ['| lot | cuts jugés | mauvaises voies du livré | ≤ 10 mm livré | ≤ 10 mm variante | gagnés | perdus | cuts déplacés > 0,5 mm |', '|---|---|---|---|---|---|---|---|'];
  for (const [g, t] of Object.entries(T)) out.push(`| ${g} | ${t.cuts} | ${t.mv} | ${t.a10ref}/${t.cuts - t.mv} (${pc(t.a10ref, t.cuts - t.mv)}) | ${t.a10}/${t.cuts - t.mv} (${pc(t.a10, t.cuts - t.mv)}) | ${t.gagnes.length} | ${t.perdus.length} | ${t.deplaces} |`);
  const t = T['**total**'];
  if (o.detail) { for (const [g, x] of Object.entries(T)) { if (g === '**total**') continue; if (x.gagnes.length) out.push(`${g} gagnés : ${x.gagnes.join(' ; ')}`); if (x.perdus.length) out.push(`${g} PERDUS : ${x.perdus.join(' ; ')}`); } }
  if (t && t.plus50.length) out.push(`au-delà de 50 mm (hors mauvaises voies du livré) : ${t.plus50.join(' ')}`);
  return out.join('\n');
}
const S = [`Mesure statique par rail, lots ${lots.join(', ')} : ${rails.length} rails jugés (${horsMV.length} hors mauvaises voies du livré).`, ''];
for (const nom of noms) {
  S.push(`# Variante « ${nom} » : ${V.VARIANTES[nom].texte}`, '');
  const K = res[nom].consts; if (Object.values(K).some(k => Object.keys(k).length)) S.push('Constantes apprises par pli (lot tenu à l\'écart → valeurs) : ' + Object.entries(K).map(([l, k]) => `${l} → ${Object.entries(k).map(([n, v]) => `${n} ${typeof v === 'number' ? r1(v) : JSON.stringify(v)}`).join(', ')}`).join(' ; '), '');
  S.push(tableauRails(nom, r => r.zone || '?', 'Par zone :'), '');
  S.push(tableauRails(nom, r => `${r.source}${r.passe ? '-passe' : ''} / ${r.etage}`, 'Par origine de la pose (source / étage) :'), '');
  S.push('Par cut (pire rail), contre le livré :', bilanCuts(nom), '');
}
process.stdout.write(S.join('\n') + '\n');
if (o.csv) {
  const L = ['lot;partie;cut;cote;zone;source;etage;ref;classeLot;' + noms.map(n => `${n}_lat;${n}_vert`).join(';')];
  for (const r of rails) L.push([r.lot, r.partie, r.cut, r.cote, r.zone, r.source, r.etage, r.ref, r.classeLot, ...noms.flatMap(n => erreur(r, res[n].get(r)).map(r1))].join(';'));
  fs.writeFileSync(o.csv, L.join('\n') + '\n');
}
