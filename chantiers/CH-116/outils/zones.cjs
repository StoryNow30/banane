#!/usr/bin/env node
'use strict';
/* CH-116 : concordance des zones (R5 de chantiers/AUDIT_GCV21.md). Hors ligne, lecture seule.
 *   CH116_TRAVAIL=… node chantiers/CH-116/outils/zones.cjs [--rejeu livre] [--lots …] [--corpus C.jsonl …] [--csv Z.csv]
 * Trois définitions de la zone d'un cut (pn, adv, abords) :
 *  - « banc »  : zone du rejeu (tools/banc-differes.cjs, mémoire des zones évaluée AVANT le cut, sur les seules captures du lot rejouées) ;
 *  - « lot »   : zone du service worker à la décision, lue au journal (événement `regles-metier-ombre`, portée `cut`, du lot) ;
 *  - « fin »   : zone de fin de lot = union des plages de contrôle (`advControle`, `pnControle`) de tous les événements du lot ; c'est ce que montrent
 *                les « verts à contrôler » (vérifié sur 12/11 p4 : mêmes cinq plages ADV).
 * Sorties : matrices de passage par lot, cuts qui changent, et les zones des mauvaises voies du ou des corpus donnés. */
const fs = require('node:fs'), path = require('node:path');
const RACINE = path.join(__dirname, '..', '..', '..');
const D = require(path.join(RACINE, 'tools', 'diag-differes.cjs'));
const { LOTS, cle, travail } = require('./lots.cjs');
const a = process.argv.slice(2), o = { rejeu: 'livre', lots: null, corpus: [], csv: null };
for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i]; if (k === '--rejeu') o.rejeu = v(); else if (k === '--lots') o.lots = v().split(','); else if (k === '--corpus') o.corpus.push(v()); else if (k === '--csv') o.csv = v(); else throw Error('option inconnue ' + k); }
const dans = (pl, c) => pl.some(([x, y]) => c >= x && c <= y);
const journaux = new Map();
const journal = f => { if (!journaux.has(f)) { journaux.clear(); journaux.set(f, JSON.parse(fs.readFileSync(f, 'utf8'))); } return journaux.get(f); };
const zoneSW = z => !z ? null : z.pn ? 'pn' : z.adv ? 'adv' : 'abords';
const MV = new Map();
for (const f of o.corpus) for (const l of fs.readFileSync(f, 'utf8').split('\n').filter(Boolean)) { const c = JSON.parse(l); if (c.classe === 'mauvaise-voie' && !c.exclu) MV.set(`${c.lot}-p${c.partie}-r${c.rang}:${c.cut}`, c); }
const lignesCsv = ['cle;cut;banc;lot;fin'], parLot = {}, chg = [], mv = [];
for (const e of LOTS) {
  if (o.lots && !o.lots.includes(e.lot)) continue;
  const k = cle(e), fm = path.join(travail(), 'meta', k + '.json'), fr = path.join(travail(), 'rejeux', o.rejeu, k + '.jsonl');
  if (!fs.existsSync(fm) || !fs.existsSync(fr)) continue;
  const m = JSON.parse(fs.readFileSync(fm, 'utf8')), j = journal(m.journal);
  const ev = (j.events || []).filter(x => x && x.type === 'regles-metier-ombre' && x.batchId === m.lotId && x.portee === 'cut' && x.zone && x.identity);
  const sw = new Map(); for (const x of ev) sw.set(x.identity.cut, zoneSW(x.zone));   /* le dernier événement du cut fait foi */
  const adv = [], pn = []; for (const x of ev) { if (Array.isArray(x.zone.advControle)) adv.push(x.zone.advControle); if (Array.isArray(x.zone.pnControle)) pn.push(x.zone.pnControle); }
  const fin = c => dans(pn, c) ? 'pn' : dans(adv, c) ? 'adv' : 'abords';
  const R = fs.readFileSync(fr, 'utf8').split('\n').filter(Boolean).map(s => JSON.parse(s)).filter(x => x.type === 'cut');
  const t = (parLot[e.lot] = parLot[e.lot] || { cuts: 0, sansZoneBanc: 0, sansEvenement: 0, bancLot: {}, bancFin: {}, lotFin: {} });
  for (const l of R) {
    t.cuts++;
    const zb = l.zone || null, zl = sw.has(l.cut) ? sw.get(l.cut) : null, zf = fin(l.cut);
    if (!zb) t.sansZoneBanc++; if (!zl) t.sansEvenement++;
    const inc = (M, x, y) => { const kk = `${x || '—'}→${y || '—'}`; M[kk] = (M[kk] || 0) + 1; };
    inc(t.bancLot, zb, zl); inc(t.bancFin, zb, zf); inc(t.lotFin, zl, zf);
    if ((zb && zl && zb !== zl) || (zb && zb !== zf)) chg.push(`${k} ${l.cut} banc ${zb || '—'} / lot ${zl || '—'} / fin ${zf}`);
    lignesCsv.push([k, l.cut, zb || '', zl || '', zf].join(';'));
    const c = MV.get(`${k}:${l.cut}`); if (c) mv.push({ id: `${e.lot} ${e.partie}/${l.cut}`, zb, zl, zf, mm: c.ecart.pire3d });
  }
}
const fmt = M => Object.entries(M).sort((x, y) => y[1] - x[1]).map(([kk, v]) => `${kk} ${v}`).join(', ');
const out = [`Concordance des zones (rejeu « ${o.rejeu} »)`, ''];
for (const [l, t] of Object.entries(parLot)) {
  const diff = M => Object.entries(M).filter(([kk]) => { const [x, y] = kk.split('→'); return x !== y; }).reduce((s, [, v]) => s + v, 0);
  out.push(`- ${l} : ${t.cuts} cuts ; banc ≠ lot : ${diff(t.bancLot)} ; banc ≠ fin : ${diff(t.bancFin)} ; lot ≠ fin : ${diff(t.lotFin)} (sans zone au banc ${t.sansZoneBanc}, sans événement du lot ${t.sansEvenement})`,
    `    banc→lot : ${fmt(t.bancLot)}`, `    banc→fin : ${fmt(t.bancFin)}`);
}
if (mv.length) {
  out.push('', `Mauvaises voies du corpus (${mv.length}) : zone banc / lot / fin`);
  for (const x of mv) out.push(`  ${x.id} (${x.mm} mm) : ${x.zb} / ${x.zl} / ${x.zf}`);
  const c = k => mv.filter(x => x[k] === 'adv').length;
  out.push(`  en ADV : banc ${c('zb')}, lot ${c('zl')}, fin ${c('zf')} sur ${mv.length}`);
}
if (o.csv) fs.writeFileSync(o.csv, lignesCsv.join('\n') + '\n');
process.stdout.write(out.join('\n') + '\n');
if (process.env.CH116_ZONES_CHANGEMENTS) process.stdout.write('\n' + chg.join('\n') + '\n');
