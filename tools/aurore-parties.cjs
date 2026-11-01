#!/usr/bin/env node
'use strict';
/*
 * aurore-parties.cjs — CH-035 : mesures hors ligne de l'Aurore entre les parties d'une Constellation. Lecture seule ; rien n'est écrit hors de `--json`.
 *
 *   node tools/aurore-parties.cjs liste <dossier d'export d'une file> [--json sortie.json]
 *     Rejoue la liste de l'Aurore (src/correction-liste.js) pour chaque partie de la file (ordre des départs de lot, une liste par partie, comme le
 *     service worker la construit depuis le bilan de la file) et le parcours (`parcours`, ordre partie puis cut) : combien de cuts, de combien de
 *     parties, et la forme (cuts par partie) que l'essai de la maquette rejoue.
 *
 *   node tools/aurore-parties.cjs traverse --echo <dossier Écho A> --echo <dossier Écho B> [--json sortie.json]
 *     Deux séances Écho RÉELLES de deux parties différentes sont fondues en UNE séance (même identifiant de session, `visitIndex` continu), comme
 *     l'est une Aurore qui traverse les parties. Pour chaque partie, la table de tools/jointure-echo-orbite.cjs (Écho seul, `joindre`) est calculée
 *     sur la séance fondue et sur la séance d'origine : elles doivent être identiques cut par cut (étiquette, référence, écarts), ce qui prouve que
 *     la jointure, donc tools/juger-lot.cjs qui l'appelle, lit une séance multi-parties sans changement.
 */
const fs = require('node:fs'), path = require('node:path');
const CL = require('../src/correction-liste.js');
const J = require('./jointure-echo-orbite.cjs');

function journalDe(dossier) {
  const f = fs.readdirSync(dossier).filter(n => /^ariane-journal-v4-.*\.json$/.test(n)).sort();
  if (!f.length) throw Error('Aucun journal ariane-journal-v4-*.json dans ' + dossier);
  const events = [];
  for (const n of f) { const d = JSON.parse(fs.readFileSync(path.join(dossier, n), 'utf8')); events.push(...(d.events || [])); }
  return events;
}
function liste(dossier) {
  const ev = journalDe(dossier), vus = new Set(), parties = [];
  for (const e of ev.filter(e => e && e.type === 'batch-started' && e.identity && Number.isInteger(e.identity.part)).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))))
    if (!vus.has(e.identity.part)) { vus.add(e.identity.part); parties.push(e.identity.part); }
  const listes = parties.map(p => { const l = CL.construire(ev, { partie: p }); return { partie: p, batchId: l.batchId, entrees: l.entrees, lignes: l.entrees.map(x => ({ part: x.part, cut: x.cut, statut: 'a-faire' })) }; });
  const P = CL.parcours(listes, { partieAffichee: parties.at(-1) });
  return { version: CL.VERSION, parcours: P.version, parties: listes.map(l => ({ partie: l.partie, cuts: l.entrees.length, aCorriger: l.entrees.filter(e => e.groupe === 'corriger').length, aPoser: l.entrees.filter(e => e.groupe === 'poser').length })),
    total: P.ordre.length, partiesAvecCuts: listes.filter(l => l.entrees.length).length, ordre: P.ordre, premier: P.suivant };
}
/* Une ligne de la table, entière (classe, visites, étiquette, statut, référence humaine, écarts) : rien n'y dépend de l'identifiant de séance. */
const cle = l => JSON.stringify(l);
function traverse(dossiers) {
  if (dossiers.length !== 2) throw Error('traverse : deux --echo attendus.');
  const E = dossiers.map(d => J.lireEcho([d]));
  const sess = E.map(e => [...new Set(e.records.map(r => r.nativeSessionId))]);
  if (sess.some(s => s.length !== 1)) throw Error('traverse : chaque Écho doit porter une seule séance.');
  const partiesDe = e => [...new Set(e.records.map(r => r.identity && r.identity.part).filter(Number.isInteger))];
  const P = E.map(partiesDe);
  if (P.some(p => p.length !== 1) || P[0][0] === P[1][0]) throw Error('traverse : deux séances d’une partie chacune, de parties différentes.');
  /* Fusion : la séance B devient la suite de la séance A (même session, visitIndex continus, une période de plus). */
  const maxA = Math.max(...E[0].records.map(r => r.visitIndex).filter(Number.isInteger));
  const fondus = [...E[0].records, ...E[1].records.map(r => ({ ...r, nativeSessionId: sess[0][0], visitIndex: Number.isInteger(r.visitIndex) ? r.visitIndex + maxA + 1 : r.visitIndex }))];
  const sessions = [{ id: sess[0][0], debut: E[0].sessions[0].debut, rang: 0 }];
  const parPartie = P.map((p, i) => {
    const opt = e => ({ partie: p[0], sansJournal: true, poses: false, visiteSansActionBonne: true, base: 'auto' });
    const seul = J.joindre(E[i].records, { events: [], records: [] }, { ...opt(), sessions: E[i].sessions, pagesPerdues: E[i].pagesPerdues, capturesParVisite: E[i].capturesParVisite, evenementsEcho: E[i].evenements });
    const fondu = J.joindre(fondus, { events: [], records: [] }, { ...opt(), sessions, pagesPerdues: [...E[0].pagesPerdues, ...E[1].pagesPerdues].map(x => ({ ...x, session: sess[0][0] })), capturesParVisite: { ...E[0].capturesParVisite, ...E[1].capturesParVisite }, evenementsEcho: [...E[0].evenements, ...E[1].evenements] });
    const a = seul.table.map(cle), b = fondu.table.filter(l => l.partie === p[0]).map(cle);
    const diff = a.filter((x, k) => x !== b[k]).length + Math.abs(a.length - b.length);
    return { partie: p[0], cutsSeul: a.length, cutsFondu: b.length, lignesDifferentes: diff, autresPartiesDansLaTable: fondu.table.filter(l => l.partie !== p[0]).length };
  });
  return { visites: fondus.length, sessions: 1, parties: P.map(p => p[0]), parPartie, identiques: parPartie.every(x => x.lignesDifferentes === 0 && x.cutsSeul > 0) };
}
function principal(argv) {
  const [cmd, ...r] = argv, o = { echo: [], json: null, pos: [] };
  for (let i = 0; i < r.length; i++) { if (r[i] === '--echo') o.echo.push(r[++i]); else if (r[i] === '--json') o.json = r[++i]; else o.pos.push(r[i]); }
  const out = cmd === 'liste' ? liste(o.pos[0]) : cmd === 'traverse' ? traverse(o.echo) : null;
  if (!out) { console.error('Usage : node tools/aurore-parties.cjs liste <dossier> | traverse --echo A --echo B [--json f]'); process.exit(2); }
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(out, null, 1));
  const { ordre, ...court } = out; console.log(JSON.stringify(court, null, 1));
}
if (require.main === module) principal(process.argv.slice(2));
module.exports = { liste, traverse };
