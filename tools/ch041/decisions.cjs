#!/usr/bin/env node
'use strict';
/* CH-041 — DÉCISIONS DE LA RECHERCHE LARGE, hors ligne, cut par cut, sur les posés RÉELS d'un lot (capture du corpus + pose réelle du lot), avec le temps
 * de calcul de chaque appel. Lecture seule des exports (banane-data) ; sortie JSON lignes HORS DÉPÔT (millimètres dans le repère profil de la pose de
 * départ, numéros de cut, comptes ; jamais une coordonnée de scène).
 *   node tools/ch041/decisions.cjs --partie P:N --journal J.json --corpus C.json [--corpus …] --sortie R.jsonl [--lot ID] [--reglage JSON] [--max N]
 * Réglage : `lot.rechercheLarge` de src/settings.js avec `actif:true`, puis les clés de `--reglage` (JSON) par-dessus. C'est la « décision de référence »
 * du protocole (chantiers/CH-041/JOURNAL.md § 0.4) quand `--reglage` est vide ; une décision candidate sinon. Les captures sont lues un fichier de corpus
 * à la fois (mémoire bornée). */
const fs = require('node:fs'), path = require('node:path');
const B = require('../banc-differes.cjs');
const D = require('../diag-differes.cjs');
const RL = require('../../src/recherche-large.js');
const S = require('../../src/settings.js');
const SIDES = ['left', 'right'];
const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
function args(argv) {
  const o = { corpus: [], reglage: {}, max: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i], v = () => { const x = argv[++i]; if (x === undefined) throw Error('valeur manquante après ' + k); return x; };
    if (k === '--partie') { const m = /^(\d+):(\d+)$/.exec(v()); if (!m) throw Error('--partie PROJET:PARTIE'); o.projet = Number(m[1]); o.partie = Number(m[2]); }
    else if (k === '--journal') o.journal = v(); else if (k === '--corpus') o.corpus.push(v()); else if (k === '--sortie') o.sortie = v(); else if (k === '--lot') o.lot = v();
    else if (k === '--reglage') o.reglage = JSON.parse(v()); else if (k === '--max') o.max = Number(v());
    else throw Error('argument inconnu : ' + k);
  }
  if (!Number.isInteger(o.partie) || !o.journal || !o.corpus.length || !o.sortie) throw Error('usage : --partie P:N --journal J --corpus C… --sortie R.jsonl [--lot ID] [--reglage JSON]');
  return o;
}
/* Les lots de la partie (tous, dans l'ordre, ou celui de --lot) : cuts posés avec capture et pose réelle. */
function cutsPoses(journal, partie, lotId) {
  const lots = D.lotsDuJournal(journal).filter(x => x.partie === partie && (!lotId || x.id.startsWith(lotId))).sort((a, b) => Date.parse(a.debut || 0) - Date.parse(b.debut || 0));
  if (!lots.length) throw Error('aucun lot de la partie ' + partie);
  const out = [];
  for (const L of lots) {
    const R = B.lotReel(journal, partie, L.id);
    for (const c of R.lot.cuts) {
      if (!c.pose || !c.captureId) continue;
      const p = R.poseReelle.get(c.cut); if (!p) continue;
      out.push({ lot: L.id.slice(0, 8), cut: c.cut, captureId: c.captureId, positions: p.corrigee, stage: c.stage, commande: c.commande ? c.commande.action : null });
    }
  }
  return out;
}
function decider(cap, positions, R) {
  const capture = { rails: cap.rails, pointsSceneRelative: cap.pointsSceneRelative, visibleByClipBoxes: cap.visibleByClipBoxes };
  const t0 = process.hrtime.bigint(), d = RL.decider({ capture, positions, R }), ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const res = RL.resumer(d), pose = {};
  for (const s of SIDES) { const x = RL.decalage(cap.rails[s], positions[s]); pose[s] = x ? [r1(x[1]), r1(x[2])] : null; }
  const ecart = p => p ? Math.max(...SIDES.map(s => Math.hypot(p[s][0] - pose[s][0], p[s][1] - pose[s][1]))) : null;
  return { ...res, ms: Math.round(ms), nPoints: cap.pointsSceneRelative.length, pose, ecartMeilleure: r1(ecart(res.meilleure)), ecartConcurrente: r1(ecart(res.concurrente)), ...(d.porte ? { porte: d.porte } : {}) };
}
function main(argv) {
  const a = args(argv), journal = JSON.parse(fs.readFileSync(a.journal, 'utf8'));
  const R = RL.reglage({ ...S.lot.rechercheLarge, actif: true, ...a.reglage }); if (!R.ok) throw Error('réglage : ' + R.raison);
  const cuts = cutsPoses(journal, a.partie, a.lot).slice(0, a.max), voulu = new Map(cuts.map(c => [c.captureId, c]));
  process.stderr.write(`partie ${a.projet}:${a.partie} : ${cuts.length} cuts posés avec capture ; réglage ${JSON.stringify(a.reglage)}\n`);
  fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true });
  const out = fs.openSync(a.sortie, 'w');
  fs.writeSync(out, JSON.stringify({ entete: true, format: 'ariane-ch041-decisions-v1', partie: `${a.projet}:${a.partie}`, module: RL.VERSION, reglage: R, cuts: cuts.length, date: new Date().toISOString() }) + '\n');
  let n = 0; const t0 = Date.now();
  for (const f of a.corpus) {
    let doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const c of doc.clouds || []) {
      const w = c && voulu.get(c.captureId); if (!w || !c.rails || !Array.isArray(c.pointsSceneRelative)) continue;
      const cap = { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: Array.isArray(c.visibleByClipBoxes) ? c.visibleByClipBoxes : c.pointsSceneRelative.map(() => true) };
      let r; try { r = decider(cap, w.positions, R); } catch (e) { r = { etat: 'erreur', message: String(e && e.message || e).slice(0, 120) }; }
      fs.writeSync(out, JSON.stringify({ lot: w.lot, cut: w.cut, stage: w.stage, commande: w.commande, ...r }) + '\n');
      voulu.delete(c.captureId); n++;
      if (n % 25 === 0) process.stderr.write(`  ${n}/${cuts.length} (${Math.round((Date.now() - t0) / 1000)} s)\n`);
    }
    doc = null;
  }
  fs.closeSync(out);
  process.stderr.write(`fini : ${n} décisions, ${cuts.length - n} captures absentes, ${Math.round((Date.now() - t0) / 1000)} s → ${a.sortie}\n`);
}
module.exports = { cutsPoses, decider, args };
if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { console.error('decisions : ' + e.message); process.exitCode = 1; } }
