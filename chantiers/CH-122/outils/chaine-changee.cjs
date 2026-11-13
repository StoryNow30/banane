#!/usr/bin/env node
'use strict';
/* CH-122 (R3 de l'audit 1) : poses de la CHAÎNE du rejeu de référence changées par un réglage (différées, déplacées de plus de 1 mm, ou remplacées par
 * la GCV2), comptées à part : combien, combien jugées, vers le mieux ou le pire (juge de CH-113).
 *   CH116_TRAVAIL=… node chantiers/CH-122/outils/chaine-changee.cjs --ref jeu-livre --nom pucev2B */
const fs = require('node:fs'), path = require('node:path'), P = require('./puce-lib.cjs'), { travail } = require('../../CH-116/outils/lots.cjs');
const a = process.argv.slice(2), opt = k => a[a.indexOf(k) + 1], W = travail();
const C = new Map(); for (const l of P.lireJsonl(process.env.CH116_CORPUS || path.join(W, 'corpus.jsonl'))) C.set(`${l.lot}-p${l.partie}-r${l.rang}:${l.cut}`, l);
const R = path.join(W, 'rejeux', opt('--ref')), N = path.join(W, 'rejeux', opt('--nom'));
const t = { changees: 0, differees: 0, deplacees: 0, jugees: 0, mieux: 0, pire: 0, egal: 0, justeVersFaute: 0, fauteVersJuste: 0, liste: [] };
const cl = e => e === null ? 'differe' : e <= 10 ? 'juste' : e <= 50 ? '10-50' : '>50';
for (const f of fs.readdirSync(R).filter(f => f.endsWith('.jsonl'))) {
  if (!fs.existsSync(path.join(N, f))) continue;
  const k = f.slice(0, -6), A = new Map(P.lireJsonl(path.join(N, f)).filter(l => l.type === 'cut').map(l => [l.cut, l]));
  for (const r of P.lireJsonl(path.join(R, f)).filter(l => l.type === 'cut')) {
    const x = r.profils['L1-se'], y = A.get(r.cut) && A.get(r.cut).profils['L1-se'];
    if (!y || x.etat !== 'pose' || x.source === 'gcv2' || !x.decal) continue;
    const pose = y.etat === 'pose' && y.decal, dep = pose ? P.pire(x.decal, y.decal) : null;
    if (pose && dep <= 1) continue;
    t.changees++; if (pose) t.deplacees++; else t.differees++;
    const c = C.get(`${k}:${r.cut}`), v = c && c.poseFinale && !c.exclu ? c.poseFinale : null;
    if (!v) continue;
    t.jugees++; const e0 = P.pire(x.decal, v), e1 = pose ? P.pire(y.decal, v) : null;
    const k0 = cl(e0), k1 = cl(e1);
    if (k0 === 'juste' && k1 !== 'juste') t.justeVersFaute += k1 === 'differe' ? 0 : 1;
    if (k0 !== 'juste' && k1 === 'juste') t.fauteVersJuste++;
    const rang = { juste: 0, differe: 1, '10-50': 2, '>50': 3 };
    if (rang[k1] < rang[k0]) t.mieux++; else if (rang[k1] > rang[k0]) t.pire++; else t.egal++;
    t.liste.push(`${k.split('-')[0]} ${k.split('-')[1]}/${r.cut} : ${k0} ${e0.toFixed(1)} → ${k1}${e1 !== null ? ' ' + e1.toFixed(1) : ''}`);
  }
}
process.stdout.write(`Poses de la chaîne changées : ${t.changees} (différées ${t.differees}, déplacées ${t.deplacees}) ; jugées ${t.jugees} : vers le mieux ${t.mieux}, le pire ${t.pire}, égal ${t.egal} (juste → faute ${t.justeVersFaute}, faute → juste ${t.fauteVersJuste})\n` + t.liste.map(s => '  ' + s).join('\n') + '\n');
