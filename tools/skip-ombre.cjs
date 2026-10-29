#!/usr/bin/env node
'use strict';
/*
 * skip-ombre.cjs — les cuts « à SKIP » détectés en ombre dans un journal d'export, comparés aux SKIP de l'opérateur (CH-016).
 * Lecture seule : aucun fichier écrit (sauf --json), aucune commande ESV.
 *
 *   node tools/skip-ombre.cjs <dossier-d-export> [--echo <dossier>]... [--partie N]... [--json fichier.json]
 *
 * Le journal porte la détection de deux façons : les événements `skip-ombre` (src/skip-ombre.js) et le champ `skipOmbre` des
 * événements `relecture-ombre` (déjà consigné par la relecture en ombre). Un cut (partie, cut) est « signalé » si l'un de ses
 * événements porte une raison. L'Écho dit ce que l'opérateur a fait : un cut dont une visite finit en SKIP
 * (`observedLabelCandidate:'SKIP'`) est un cut à SKIP de l'opérateur.
 *
 * Précision et rappel se calculent sur les cuts ÉVALUÉS par le détecteur ET vus par l'Écho (population dite, jamais plus large) :
 *   précision = signalés qui sont SKIP / signalés vus ; rappel = SKIP signalés / SKIP vus.
 * Sans Écho, ou sans aucun SKIP de l'opérateur dans l'Écho, la mesure est « non mesuré » : aucun chiffre inventé.
 */
const fs = require('node:fs'), path = require('node:path');

const FORMAT = 'ariane-skip-ombre-v1';
const cle = (part, cut) => `${part}:${cut}`;
const entier = v => Number.isInteger(v);

/* Détections du journal : une par cut, signalée si un événement porte une raison. */
function detectionsDe(journal, parties) {
  const m = new Map();
  for (const e of journal.events || []) {
    if (!e || !e.identity || !entier(e.identity.part) || !entier(e.identity.cut)) continue;
    let raison;
    if (e.type === 'skip-ombre') raison = e.raison ?? null;
    else if (e.type === 'relecture-ombre' && e.skipOmbre) raison = e.skipOmbre.raison ?? null;
    else continue;
    if (parties && !parties.has(e.identity.part)) continue;
    const k = cle(e.identity.part, e.identity.cut), c = m.get(k) || { part: e.identity.part, cut: e.identity.cut, raison: null };
    if (raison && !c.raison) c.raison = raison;
    m.set(k, c);
  }
  return m;
}
/* Cuts vus par l'Écho, et ceux où l'opérateur a fait SKIP (au moins une visite finie en SKIP). */
function echoDe(echo, parties) {
  const vus = new Set(), skips = new Set();
  for (const r of (echo && echo.records) || []) {
    const i = r && r.identity;
    if (!i || !entier(i.part) || !entier(i.cut) || (parties && !parties.has(i.part))) continue;
    const k = cle(i.part, i.cut);
    vus.add(k);
    if (r.observedLabelCandidate === 'SKIP') skips.add(k);
  }
  return { vus, skips };
}
const ordre = (a, b) => a.part - b.part || a.cut - b.cut;

function analyser({ journal, echo = null, parties = null }) {
  const filtre = parties && parties.length ? new Set(parties) : null;
  const det = detectionsDe(journal, filtre);
  const liste = [...det.values()].sort(ordre);
  const signales = liste.filter(c => c.raison);
  const parRaison = {};
  for (const c of signales) parRaison[c.raison] = (parRaison[c.raison] || 0) + 1;
  const r = { format: FORMAT, evalues: liste.length, signales: signales.length, parRaison,
    cutsSignales: signales.map(c => ({ part: c.part, cut: c.cut, raison: c.raison })) };
  const nonMesure = (motif, extra = {}) => ({ etat: 'non-mesure', motif, skipsOperateur: 0, precision: null, rappel: null, ...extra });
  if (!echo) { r.mesure = nonMesure('aucun Écho fourni'); return r; }
  const { vus, skips } = echoDe(echo, filtre);
  const vusEvalues = liste.filter(c => vus.has(cle(c.part, c.cut)));
  const skipsVus = vusEvalues.filter(c => skips.has(cle(c.part, c.cut)));
  if (!skipsVus.length) { r.mesure = nonMesure('aucun SKIP de l\'opérateur parmi les cuts évalués et vus par l\'Écho', { vus: vusEvalues.length, skipsOperateur: 0 }); return r; }
  const sig = vusEvalues.filter(c => c.raison);
  const vp = sig.filter(c => skips.has(cle(c.part, c.cut))).length;
  r.mesure = { etat: 'mesure', vus: vusEvalues.length, skipsOperateur: skipsVus.length, vraisPositifs: vp, fauxPositifs: sig.length - vp,
    manques: skipsVus.length - vp, precision: sig.length ? vp / sig.length : null, rappel: vp / skipsVus.length,
    signalesHorsEcho: signales.length - sig.length };
  return r;
}

const pc = v => v === null || v === undefined ? '—' : String(Math.round(v * 1000) / 10).replace('.', ',') + ' %';
function texte(r) {
  const L = [`SK en ombre (D-172, D-241) : ${r.evalues} cuts évalués, ${r.signales} signalés. Ariane n'envoie aucun SKIP.`];
  const raisons = Object.keys(r.parRaison).sort().map(k => `${k} ${r.parRaison[k]}`);
  if (raisons.length) L.push(`  par raison : ${raisons.join(', ')}`);
  for (const c of r.cutsSignales) L.push(`  partie ${c.part}, cut ${c.cut} : ${c.raison}`);
  const m = r.mesure;
  if (m.etat === 'mesure') {
    L.push(`Mesure contre l'opérateur (cuts évalués et vus par l'Écho : ${m.vus}) : SKIP de l'opérateur ${m.skipsOperateur}, vrais positifs ${m.vraisPositifs}, faux positifs ${m.fauxPositifs}, manqués ${m.manques}.`);
    L.push(`  précision ${m.vraisPositifs}/${m.vraisPositifs + m.fauxPositifs} (${pc(m.precision)}), rappel ${m.vraisPositifs}/${m.skipsOperateur} (${pc(m.rappel)})` + (m.signalesHorsEcho ? ` ; ${m.signalesHorsEcho} signalés non vus par l'Écho, hors mesure` : ''));
  } else L.push(`Précision et rappel : non mesuré (${m.motif}). Aucune conclusion.`);
  return L.join('\n');
}

const USAGE = 'Usage : node tools/skip-ombre.cjs <dossier-d-export> [--echo <dossier>]... [--partie N]... [--json fichier.json]';
function lireArguments(argv) {
  const a = { dossier: null, echo: [], parties: [], json: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--echo') a.echo.push(argv[++i]);
    else if (k === '--partie') a.parties.push(Number(argv[++i]));
    else if (k === '--json') a.json = argv[++i];
    else if (k.startsWith('--')) throw Error(`Argument inconnu : ${k}. ${USAGE}`);
    else if (a.dossier === null) a.dossier = k;
    else throw Error(`Un seul dossier d'export attendu. ${USAGE}`);
  }
  if (!a.dossier) throw Error(`dossier d'export manquant. ${USAGE}`);
  for (const p of a.parties) if (!entier(p)) throw Error('--partie attend un entier');
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv);
  const Poses = require('./precision-poses.cjs'), Juger = require('./juger-lot.cjs');
  const journal = Poses.lireJournalDir(a.dossier);
  const echo = a.echo.length ? Poses.lireEcho(Juger.dossiersEcho(a.echo)) : null;
  const r = analyser({ journal, echo, parties: a.parties });
  if (a.json) {
    const abs = path.resolve(a.json);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(r, null, 1));
  }
  sortie(texte(r));
  return r;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { analyser, detectionsDe, echoDe, lireArguments, executer, texte, FORMAT };
