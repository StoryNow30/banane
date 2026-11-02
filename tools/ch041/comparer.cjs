#!/usr/bin/env node
'use strict';
/* CH-041 — COMPARER une décision candidate à la décision de référence, cut par cut, contre les critères écrits (chantiers/CH-041/JOURNAL.md § 0.5).
 *   node tools/ch041/comparer.cjs --reference R.jsonl --candidat C.jsonl [--juges J.jsonl] [--titre T]
 * Sorties (texte, aucun numéro de cut) : accord des états ; fautes différées par la référence conservées ; poses justes (fine, acceptation) différées en
 * plus ; temps par cut (médiane, moyenne, P90, total) des deux ; relances ; porte (fermée / ouverte) et ce que la référence dit des cuts fermés ; par étage. */
const fs = require('node:fs');
const { med, q } = require('./cycle-lot.cjs');
const lire = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(l => !l.entete);
function args(argv) { const o = {}; for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (k === '--reference') o.reference = argv[++i]; else if (k === '--candidat') o.candidat = argv[++i]; else if (k === '--juges') o.juges = argv[++i]; else if (k === '--titre') o.titre = argv[++i]; else throw Error('argument inconnu ' + k); } if (!o.reference || !o.candidat) throw Error('usage : --reference R.jsonl --candidat C.jsonl [--juges J.jsonl]'); return o; }
const pc = (k, n) => n ? `${k}/${n} (${(100 * k / n).toFixed(1).replace('.', ',')} %)` : `${k}/0`;
const moy = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const r0 = v => v === null || v === undefined ? '—' : String(Math.round(v));
function temps(L) { const ms = L.map(l => l.ms).filter(Number.isFinite); return `médiane ${r0(med(ms))} ms, moyenne ${r0(moy(ms))} ms, P90 ${r0(q(ms, .9))} ms, max ${r0(Math.max(...ms))} ms, total ${r0(ms.reduce((a, b) => a + b, 0) / 1000)} s ; relances médiane ${r0(med(L.map(l => l.cellules && l.cellules.relances)))}, total ${L.reduce((a, l) => a + ((l.cellules && l.cellules.relances) || 0), 0)}`; }
function comparer(ref, cand, juges) {
  const R = new Map(ref.map(l => [l.lot + ':' + l.cut, l])), J = new Map((juges || []).map(j => [j.cut, j]));
  const paires = cand.map(c => ({ c, r: R.get(c.lot + ':' + c.cut) })).filter(x => x.r && x.r.etat !== 'erreur' && x.c.etat !== 'erreur');
  const n = paires.length, accord = paires.filter(x => x.c.etat === x.r.etat);
  const desaccords = paires.filter(x => x.c.etat !== x.r.etat);
  const lignes = [`cuts comparés ${n} (référence ${ref.length}, candidat ${cand.length})`,
    `(a) accord des états : ${pc(accord.length, n)} ; désaccords : référence → candidat : ${JSON.stringify(Object.fromEntries([...desaccords.reduce((m, x) => { const k = x.r.etat + '→' + x.c.etat; m.set(k, (m.get(k) || 0) + 1); return m; }, new Map())]))}`];
  if (juges) {
    const g = x => J.get(x.c.cut) && J.get(x.c.cut).geste;
    const fautesRef = paires.filter(x => g(x) === 'faute' && x.r.etat === 'differer'), fautesGardees = fautesRef.filter(x => x.c.etat === 'differer');
    const justes = paires.filter(x => g(x) === 'fine' || g(x) === 'acceptation'), justesRef = justes.filter(x => x.r.etat === 'differer').length, justesCand = justes.filter(x => x.c.etat === 'differer').length;
    lignes.push(`(b) fautes différées par la référence ${fautesRef.length} (fautes jugées ${paires.filter(x => g(x) === 'faute').length}) : conservées par le candidat ${pc(fautesGardees.length, fautesRef.length)}`);
    lignes.push(`(c) poses justes différées : référence ${pc(justesRef, justes.length)}, candidat ${pc(justesCand, justes.length)} ; en plus : ${justesCand - justesRef} (${(100 * (justesCand - justesRef) / (justes.length || 1)).toFixed(2).replace('.', ',')} point)`);
    for (const k of ['faute', 'moyenne', 'fine', 'acceptation', null]) { const P = paires.filter(x => (g(x) || null) === k); if (P.length) lignes.push(`  geste ${k || 'non jugé'} : ${P.length} ; référence différer ${P.filter(x => x.r.etat === 'differer').length}, candidat différer ${P.filter(x => x.c.etat === 'differer').length}, désaccords ${P.filter(x => x.c.etat !== x.r.etat).length}`); }
  }
  lignes.push(`(d) temps référence : ${temps(paires.map(x => x.r))}`, `    temps candidat  : ${temps(paires.map(x => x.c))}`);
  const fermes = paires.filter(x => x.c.porte && x.c.porte.ouverte === false), ouverts = paires.filter(x => x.c.porte && x.c.porte.ouverte === true);
  if (fermes.length || ouverts.length) {
    lignes.push(`porte : fermée ${pc(fermes.length, n)}, ouverte ${pc(ouverts.length, n)} ; référence sur les fermés : ${JSON.stringify(Object.fromEntries([...fermes.reduce((m, x) => { m.set(x.r.etat, (m.get(x.r.etat) || 0) + 1); return m; }, new Map())]))}`);
    lignes.push(`  temps candidat sur les fermés : ${temps(fermes.map(x => x.c))}`);
    if (ouverts.length) lignes.push(`  temps candidat sur les ouverts : ${temps(ouverts.map(x => x.c))} ; référence sur les mêmes : ${temps(ouverts.map(x => x.r))}`);
    const parEtage = new Map(); for (const x of paires) { const k = x.c.stage || '?'; if (!parEtage.has(k)) parEtage.set(k, { n: 0, fermes: 0, differer: 0 }); const e = parEtage.get(k); e.n++; if (x.c.porte && x.c.porte.ouverte === false) e.fermes++; if (x.r.etat === 'differer') e.differer++; }
    lignes.push(`  par étage de la décision du lot (n, porte fermée, référence différer) : ${[...parEtage].map(([k, e]) => `${k} ${e.n}/${e.fermes}/${e.differer}`).join(' ; ')}`);
  }
  if (desaccords.length) lignes.push(`désaccords, détail (référence motif → candidat motif, écart meilleure mm) : ${desaccords.map(x => `${x.r.motif}→${x.c.motif} (${x.r.ecartMeilleure}→${x.c.ecartMeilleure})`).join(' ; ')}`);
  return lignes.join('\n');
}
if (require.main === module) { try { const a = args(process.argv.slice(2)); process.stdout.write((a.titre ? a.titre + '\n' : '') + comparer(lire(a.reference), lire(a.candidat), a.juges ? lire(a.juges) : null) + '\n'); } catch (e) { console.error('comparer : ' + e.message); process.exitCode = 1; } }
module.exports = { comparer, lire };
