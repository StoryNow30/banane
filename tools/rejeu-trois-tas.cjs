#!/usr/bin/env node
'use strict';
/*
 * rejeu-trois-tas.cjs — les trois tas de différés que la passe en ombre ne pose pas
 * (ambiguïté, dessus insuffisant, écartement hors contrat). Lecture seule.
 *
 *   node tools/rejeu-trois-tas.cjs classer --journal J.json [--journal J2.json]
 *   node tools/rejeu-trois-tas.cjs seuil --journal J.json --jointure TABLE.json --reglage 4.9.5.21 [--reglage 4.9.5.22]
 *
 * Le chemin des journaux et de la jointure (`tools/jointure-echo-orbite.cjs`) vient des arguments :
 * aucun chemin vers un dépôt de données n'est écrit ici.
 *
 * `seuil` ne mélange pas les populations. Sur les versions de réglage, parmi les seuils de probabilité
 * qui ne posent aucune paire à plus de 50 mm, il retient celui qui pose le plus (à égalité, le plus haut).
 * L'examen est le reste des versions. Une ambiguïté n'est jamais posée : la paire du moteur n'est pas résolue.
 * La paire notée est celle de la décision L1 avant les gardes de la passe (`l1.test13`), en millimètres
 * dans le repère profil de la pose de départ. L'écart est le pire des deux rails, en 3D, contre la pose
 * finale de l'opérateur quand la jointure la donne.
 */
const fs = require('node:fs');
const D = require('./diag-differes.cjs');
const C = require('./diag-differes-causes.cjs');

const TAS = ['ambiguite', 'dessus-insuffisant', 'ecartement-hors-contrat'];

function decalDe(p) {
  if (Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite)) return p;
  if (p && Array.isArray(p.decal) && p.decal.every(Number.isFinite)) return p.decal;
  return null;
}

function erreurPaire(paire, ecartHumain) {
  if (!paire || !ecartHumain) return null;
  const g = decalDe(paire.left), d = decalDe(paire.right);
  const eg = ecartHumain.gauche, ed = ecartHumain.droite;
  if (!g || !d || !eg || !ed || eg.repere !== 'profil' || ed.repere !== 'profil') return null;
  const un = (cell, r) => Math.hypot(r.longitudinalMm - cell[0], r.lateralMm - cell[1], r.verticalMm - cell[2]);
  if (![eg.longitudinalMm, eg.lateralMm, eg.verticalMm, ed.longitudinalMm, ed.lateralMm, ed.verticalMm].every(Number.isFinite)) return null;
  return Math.round(Math.max(un(g, eg), un(d, ed)) * 10) / 10;
}

function coupesDesJournaux(entrees) {
  const vus = new Map();
  for (const { journal } of entrees) {
    const passe = new Map();
    for (const e of journal && Array.isArray(journal.events) ? journal.events : []) {
      if (e.type !== 'passe-differes-ombre' || e.passe !== 1 || !e.identity || !Number.isInteger(e.identity.cut)) continue;
      const k = e.identity.part + ':' + e.identity.cut;
      if (!passe.has(k)) passe.set(k, e);
    }
    for (const L of D.lotsDuJournal(journal)) {
      if (L.traites < 5) continue;
      const ancien = vus.get(L.id);
      if (ancien && ancien.traites >= L.traites) continue;
      const coupes = [];
      for (const c of L.cuts) {
        if (c.pose || C.dejaVert(c)) continue;
        const pe = passe.get(L.partie + ':' + c.cut);
        const x = C.classer(c, null, pe ? { decision: pe.decision, motif: pe.motif, garde: pe.garde || null } : null);
        if (!TAS.includes(x.cause)) continue;
        const l1 = pe && pe.l1 || null;
        const t13 = l1 && l1.test13 || null;
        coupes.push({
          partie: L.partie, version: L.version || null, cut: c.cut, cause: x.cause,
          motifPasse: pe ? (pe.motif || null) : null,
          p: l1 && Number.isFinite(l1.p) ? l1.p : null,
          tau: l1 && Number.isFinite(l1.tau) ? l1.tau : null,
          zone: l1 && l1.zone || null,
          test13etat: t13 && t13.etat || null,
          paire: t13 && t13.paire || null,
        });
      }
      vus.set(L.id, { traites: L.traites, coupes });
    }
  }
  const coupes = [...vus.values()].flatMap(v => v.coupes).sort((a, b) => String(a.version).localeCompare(String(b.version)) || a.partie - b.partie || a.cut - b.cut);
  const lignes = [`Coupes ${coupes.length}.`];
  for (const cause of TAS) lignes.push(`- ${cause} : ${coupes.filter(c => c.cause === cause).length}.`);
  return { coupes, texte: lignes.join('\n') };
}

function resume(poses) {
  const plus50 = poses.filter(c => c.eMm > 50).length;
  const le20 = poses.filter(c => c.eMm <= 20).length;
  const le50 = poses.filter(c => c.eMm <= 50).length;
  return { poses: poses.length, le20, le50, plus50, cuts: poses.map(c => ({ partie: c.partie, cut: c.cut, eMm: c.eMm, p: c.p, cause: c.cause })) };
}

/* Seuil appris seulement sur `versionsReglage`. Une ambiguïté n'entre ni dans le réglage ni dans l'examen. */
function seuilHorsEchantillon(coupes, versionsReglage) {
  const reg = new Set(versionsReglage);
  const eligible = c => c.cause !== 'ambiguite' && c.eMm != null && Number.isFinite(c.p);
  const ambiguiteEcartees = coupes.filter(c => c.cause === 'ambiguite').length;
  const reglage = coupes.filter(c => reg.has(c.version) && eligible(c));
  const examen = coupes.filter(c => !reg.has(c.version) && eligible(c));
  const seuils = [...new Set(reglage.map(c => c.p)), Infinity].sort((a, b) => a - b);
  let choisi = { t: Infinity, n: 0 };
  for (const t of seuils) {
    const poses = reglage.filter(c => c.p + 1e-12 >= t);
    if (poses.some(c => c.eMm > 50)) continue;
    if (poses.length > choisi.n || (poses.length === choisi.n && t > choisi.t)) choisi = { t, n: poses.length };
  }
  const posReg = reglage.filter(c => c.p + 1e-12 >= choisi.t);
  const posEx = examen.filter(c => c.p + 1e-12 >= choisi.t);
  return { seuil: choisi.t, ambiguiteEcartees, reglage: resume(posReg), examen: resume(posEx), reglageDisponibles: reglage.length, examenDisponibles: examen.length };
}

function joindre(coupes, table) {
  const cle = new Map();
  for (const r of table || []) if (r && Number.isInteger(r.partie) && Number.isInteger(r.cut)) cle.set(r.partie + ':' + r.cut, r);
  return coupes.map(c => {
    const r = cle.get(c.partie + ':' + c.cut);
    const eMm = r && r.referenceHumaine === 'observee' ? erreurPaire(c.paire, r.ecartHumain) : null;
    const opMm = r && r.ecartHumain && Number.isFinite(r.ecartHumain.maxDist3dMm) ? Math.round(r.ecartHumain.maxDist3dMm * 10) / 10 : null;
    return { ...c, eMm, opMm };
  });
}

function lireJournal(f) {
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function texteSeuil(R) {
  const f = x => x === Infinity ? 'aucun' : String(x);
  const ligne = (nom, s) => `${nom} : ${s.poses} pose(s), ${s.le20} à 20 mm ou moins, ${s.le50} à 50 mm ou moins, ${s.plus50} à plus de 50 mm.`;
  return [
    `Seuil de probabilité retenu sur le réglage : ${f(R.seuil)}.`,
    `Ambiguïtés écartées (cut non résolu, jamais validé) : ${R.ambiguiteEcartees}.`,
    `Disponibles hors ambiguïté : réglage ${R.reglageDisponibles}, examen ${R.examenDisponibles}.`,
    ligne('réglage', R.reglage),
    ligne('examen', R.examen),
  ].join('\n');
}

function args(argv) {
  const o = { cmd: argv[0], journal: [], reglage: [] };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--journal') o.journal.push(argv[++i]);
    else if (k === '--jointure') o.jointure = argv[++i];
    else if (k === '--reglage') o.reglage.push(argv[++i]);
    else throw Error('argument inconnu : ' + k);
  }
  if (!o.journal.length) throw Error('Usage : classer|seuil --journal J.json [--jointure TABLE.json --reglage VERSION]');
  if (o.cmd === 'seuil' && (!o.jointure || !o.reglage.length)) throw Error('seuil demande --jointure et --reglage');
  return o;
}

function lancer(argv) {
  const a = args(argv);
  const entrees = a.journal.map(f => ({ journal: lireJournal(f) }));
  const base = coupesDesJournaux(entrees);
  if (a.cmd === 'classer') return base.texte;
  if (a.cmd !== 'seuil') throw Error('commande : classer ou seuil');
  const table = JSON.parse(fs.readFileSync(a.jointure, 'utf8')).table || [];
  const R = seuilHorsEchantillon(joindre(base.coupes, table), a.reglage);
  return texteSeuil(R);
}

module.exports = { TAS, decalDe, erreurPaire, coupesDesJournaux, seuilHorsEchantillon, joindre, texteSeuil, lancer };

if (require.main === module) {
  try { process.stdout.write(lancer(process.argv.slice(2)) + '\n'); }
  catch (e) { process.stderr.write(String(e.message || e) + '\n'); process.exitCode = 1; }
}
