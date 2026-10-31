#!/usr/bin/env node
'use strict';
/*
 * correction-liste.cjs — CH-028 : rejoue hors ligne la liste de cuts à corriger (src/correction-liste.js) sur un export de lot, et, si un Écho
 * est donné, la juge contre les corrections de l'opérateur. Lecture seule, aucune donnée écrite hors de `--json`.
 *
 *   node tools/correction-liste.cjs <dossier d'export du lot> [--partie N]... [--echo <dossier>]... [--json sortie.json] [--relecture-hors-lot]
 *
 * Sans `--partie`, toutes les parties dont le journal porte un lot. Avec Écho, pour chaque posé jugé (définitions de tools/juger-lot.cjs :
 * corrigé = validation de l'opérateur, écart pire rail 3D à la pose d'Ariane ; contrôlé bon = visite immobile d'au moins 0,8 s, écart 0) :
 *   - précision de la liste à s mm : parmi les cuts « à corriger » jugés, part dont l'écart dépasse s ;
 *   - rappel à s mm : parmi les posés jugés dont l'écart dépasse s, part que la liste porte ;
 *   - seuils 2, 10, 20, 50 mm ; intervalles de Wilson à 95 %. Les cuts non jugés (sans Écho) ne comptent ni pour ni contre.
 * Réserve écrite : l'Écho visite surtout les zones difficiles (CH-015 § 4) ; ces chiffres ne sont pas ceux de toute la partie.
 */
const fs = require('node:fs');
const Poses = require('./precision-poses.cjs');
const J = require('./jointure-echo-orbite.cjs');
const L = require('../src/correction-liste.js');

const SEUILS = [2, 10, 20, 50];
const fini = Number.isFinite;
function wilson(k, n) { if (!n) return null; const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [+((c - m) / d).toFixed(3), +((c + m) / d).toFixed(3)]; }

function lireArguments(v) {
  const o = { lot: null, parties: [], echo: [], json: null, relectureHorsLot: false };
  for (let i = 0; i < v.length; i++) {
    const a = v[i];
    if (a === '--partie') o.parties.push(Number(v[++i]));
    else if (a === '--echo') o.echo.push(v[++i]);
    else if (a === '--json') o.json = v[++i];
    else if (a === '--relecture-hors-lot') o.relectureHorsLot = true;
    else if (a.startsWith('--')) throw Error('argument inconnu : ' + a);
    else o.lot = a;
  }
  if (!o.lot) throw Error('dossier d’export du lot manquant');
  return o;
}

/* Écart jugé par cut (même lecture que CH-015 predicteurs-valider.cjs). */
function ecartsJuges(journal, echo, partie) {
  const { table } = J.joindre(echo.records, journal, { partie, base: 'auto', poses: false, visiteSansActionBonne: true, sessions: echo.sessions || [],
    pagesPerdues: echo.pagesPerdues || [], capturesParVisite: echo.capturesParVisite || {}, evenementsEcho: echo.evenements || [] });
  const m = new Map();
  for (const l of table) {
    if (l.partie !== partie || !l.dansEcho || l.referenceHumaine !== 'observee') continue;
    if (l.regleVisiteBon) m.set(l.cut, { mm: 0, corrige: false });
    else if (typeof l.base === 'string' && l.base.startsWith('ariane') && l.ecartHumain && fini(l.ecartHumain.maxDist3dMm)) m.set(l.cut, { mm: l.ecartHumain.maxDist3dMm, corrige: true });
  }
  return m;
}

function juger(liste, ecarts, posesCount) {
  const aCorriger = new Set(liste.entrees.filter(e => e.groupe === 'corriger').map(e => e.cut));
  const jugesListe = [...aCorriger].filter(c => ecarts.has(c));
  const tous = [...ecarts.entries()];
  const out = { posesJuges: tous.length, listesJuges: jugesListe.length, listesSansEcho: aCorriger.size - jugesListe.length, seuils: {}, parSignal: {} };
  for (const s of SEUILS) {
    const k = jugesListe.filter(c => ecarts.get(c).mm > s).length, faux = tous.filter(([, x]) => x.mm > s), kr = faux.filter(([c]) => aCorriger.has(c)).length;
    out.seuils[s] = { precision: { k, n: jugesListe.length, part: jugesListe.length ? +(k / jugesListe.length).toFixed(3) : null, ic: wilson(k, jugesListe.length) },
      rappel: { k: kr, n: faux.length, part: faux.length ? +(kr / faux.length).toFixed(3) : null, ic: wilson(kr, faux.length) } };
  }
  for (const sig of L.SIGNAUX.filter(x => x !== 'differe')) {
    const c = liste.entrees.filter(e => e.signaux.includes(sig)).map(e => e.cut), j = c.filter(x => ecarts.has(x));
    out.parSignal[sig] = { listes: c.length, juges: j.length, plus10: j.filter(x => ecarts.get(x).mm > 10).length, plus20: j.filter(x => ecarts.get(x).mm > 20).length, plus50: j.filter(x => ecarts.get(x).mm > 50).length };
  }
  out.coutPartDesPoses = posesCount ? +(aCorriger.size / posesCount).toFixed(3) : null;
  return out;
}

function executer(o) {
  const journal = Poses.lireJournalDir(o.lot);
  const parties = o.parties.length ? o.parties : [...new Set(journal.events.filter(e => e.type === 'batch-started' && e.identity && Number.isInteger(e.identity.part)).map(e => e.identity.part))].sort((a, b) => a - b);
  const echo = o.echo.length ? Poses.lireEcho(o.echo) : null;
  const res = [];
  for (const partie of parties) {
    const liste = L.construire(journal.events, { partie, relectureHorsLot: o.relectureHorsLot, population: true });
    const r = { partie, trouve: liste.trouve, comptes: liste.comptes, cuts: liste.entrees.map(e => ({ cut: e.cut, groupe: e.groupe, signaux: e.signaux })) };
    if (echo && liste.trouve) { const P = new Set(liste.population.poses), E = ecartsJuges(journal, echo, partie); for (const c of [...E.keys()]) if (!P.has(c)) E.delete(c); r.jugement = juger(liste, E, liste.comptes.poses); }
    res.push(r);
  }
  return { format: 'ariane-correction-liste-mesure-v1', version: L.VERSION, parties: res };
}

function texte(out) {
  const v = x => x === null || x === undefined ? '—' : String(x).replace('.', ',');
  const l = [];
  for (const r of out.parties) {
    if (!r.trouve) { l.push(`Partie ${r.partie} : aucun lot`); continue; }
    const c = r.comptes;
    l.push(`Partie ${r.partie} : ${c.cibles} cibles, ${c.poses} posés, ${c.differes} différés · liste : ${c.aCorriger} à corriger, ${c.aPoser} à poser`);
    l.push('  par signal : ' + Object.entries(c.parSignal).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(', '));
    const J2 = r.jugement;
    if (J2) {
      l.push(`  Écho : ${J2.posesJuges} posés jugés ; à corriger jugés ${J2.listesJuges}, sans Écho ${J2.listesSansEcho} ; coût ${v(J2.coutPartDesPoses)} des posés`);
      for (const [s, x] of Object.entries(J2.seuils)) l.push(`  > ${s} mm : précision ${x.precision.k}/${x.precision.n} (${v(x.precision.part)} IC ${JSON.stringify(x.precision.ic)}) · rappel ${x.rappel.k}/${x.rappel.n} (${v(x.rappel.part)} IC ${JSON.stringify(x.rappel.ic)})`);
      l.push('  par signal (listés / jugés / > 10 / > 20 / > 50 mm) : ' + Object.entries(J2.parSignal).filter(([, x]) => x.listes).map(([k, x]) => `${k} ${x.listes}/${x.juges}/${x.plus10}/${x.plus20}/${x.plus50}`).join(', '));
    }
  }
  return l.join('\n');
}

if (require.main === module) {
  const o = lireArguments(process.argv.slice(2)), out = executer(o);
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(out, null, 1));
  console.log(texte(out));
}
module.exports = { executer, texte, juger, lireArguments };
