#!/usr/bin/env node
'use strict';
/* CH-123 : par où passent les poses qu'un réglage ajoute ou change (motif de la décision L1-e, origines de la paire), jugées contre le corpus.
 *   node chantiers/CH-123/outils/portes.cjs REJEU_REF REJEU_REGLAGE CSV_JUGER_REGLAGE  (rejeux : dossiers du banc ; CSV : banc.cjs juger --csv)
 * Une ligne par cut dont l'état ou la pose change ; puis le compte par motif et classe (juste, 10-50, plus-50, non jugé). Lecture seule. */
const fs = require('node:fs'), path = require('node:path');
const [A, B, CSV] = process.argv.slice(2);
const lire = f => new Map(fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(JSON.parse).filter(x => x.type === 'cut').map(x => [x.cut, x]));
const J = new Map(fs.readFileSync(CSV, 'utf8').trim().split('\n').slice(1).map(l => l.split(';')).map(c => [`${c[0]}:${c[1]}`, { mm: c[5], classe: c[6] || 'non-jugé' }]));
const cpt = {};
for (const f of fs.readdirSync(A).filter(f => f.endsWith('.jsonl'))) {
  const a = lire(path.join(A, f)), b = lire(path.join(B, f)), cle = f.replace('.jsonl', '');
  for (const [cut, x] of a) {
    const p = x.profils['L1-se'], q = b.get(cut) && b.get(cut).profils['L1-se']; if (!q) continue;
    if (JSON.stringify([p.etat, p.decal]) === JSON.stringify([q.etat, q.decal])) continue;
    const l = q.l1 || {}, j = J.get(`${cle}:${cut}`) || { classe: 'non-jugé' };
    const motif = q.etat === 'pose' ? (q.source === 'gcv2' ? (l.motif || 'valider-t13') : 'chaine:' + q.etage) : 'differe';
    const orig = q.etat === 'pose' && l.hypothese ? l.hypothese : '';
    const chg = p.etat === 'pose' ? (q.etat === 'pose' ? 'pose→pose' : 'pose→differe') : 'differe→pose';
    console.log(`${cle} ${cut} ${x.zone} ${chg} ${motif} ${orig} p=${l.p ?? ''} ${j.classe} ${j.mm || ''}`);
    const k = `${chg} | ${motif} | ${j.classe}`; cpt[k] = (cpt[k] || 0) + 1;
  }
}
console.log('\n| changement | motif | classe | cuts |\n|---|---|---|---|');
for (const [k, v] of Object.entries(cpt).sort()) console.log(`| ${k.split(' | ').join(' | ')} | ${v} |`);
