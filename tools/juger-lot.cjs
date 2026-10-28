#!/usr/bin/env node
'use strict';
/*
 * juger-lot.cjs — le tableau standard d'un lot, jugé contre l'Écho (CH-011). Lecture seule.
 *
 *   node tools/juger-lot.cjs <dossier-d-export> [--echo <dossier>]... [--partie N]... [--json fichier.json]
 *
 * Le dossier d'export contient les archives du lot (journal `ariane-journal-v4-*.json`) ; chaque `--echo` est un
 * dossier d'export de l'Écho (répétable). Aucun chemin n'est écrit ici ; sans `--partie`, toutes les parties dont le
 * journal porte un lot sont jugées. Reprend la logique des analyses `p15`, `p1617`, `p182019` et `p01` de banane-data
 * (outils/analyse-lots) ; les compteurs et les intervalles viennent de tools/precision-poses.cjs.
 *
 * Définitions (chaque chiffre dit sa population) :
 *   - cible : cut qui a reçu une décision du lot (gcv1-shadow-observed du dernier lot de la partie) ; le cut de départ
 *     déjà vert (capture abandonnée « depart-sur-vert » dans les 30 s du départ) n'est pas une cible ;
 *   - posé : cible dont la ligne a reçu une écriture de validation 2xx pendant le lot (du départ à 5 s après l'arrêt du lot : avant la
 *     relecture, avant le lot suivant d'un journal cumulé) ; différé : cible sans cette écriture ;
 *   - sans Écho : posé que l'Écho n'a pas visité ;
 *   - jugé : posé vu par l'Écho dont l'écart est connu, de deux sortes :
 *       corrigé  = l'opérateur a validé une pose ; écart = pire rail, 3D, entre la pose d'Ariane et cette validation ;
 *       contrôlé, bon = visite d'au moins 0,8 s, aucun rail déplacé de 0,5 mm ou plus, aucune validation : correction
 *         nulle (règle `--visite-sans-action-bonne` de tools/jointure-echo-orbite.cjs). Ce choix ne vaut QUE si l'Écho
 *         tournait sur ce cut : un posé jamais visité reste « sans Écho », il n'est pas supposé bon ;
 *   - non jugé : posé vu par l'Écho sans validation et sans visite assez longue ou immobile, ou dont le repère de scène
 *     n'est pas calibré (l'écart ne serait pas mesuré contre la pose d'Ariane) ;
 *   - > 20 mm, > 50 mm : pire rail, 3D, parmi les jugés ; mauvaise voie : pire écart latéral de plus de 100 mm (lecture p01) ;
 *   - passe en ombre (passe 1 seule, à part, jamais additionnée au lot) : « poserait » jugés contre la validation de
 *     l'opérateur, « rien », refus de la garde (décision « rien » dont la garde a bloqué).
 */
const fs = require('node:fs'), path = require('node:path');
const J = require('./jointure-echo-orbite.cjs');
const Voie = require('../src/voie-recentree.js');
const Poses = require('./precision-poses.cjs');

const FORMAT = 'ariane-juger-lot-v1';
const MAUVAISE_VOIE_LAT_MM = 100;
const DEPART_VERT_S = 30;
const FIN_APRES_ARRET_S = 5;
const GRAINE = 20261028;

const fini = v => Number.isFinite(v);
const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
const arr = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const coteLat = (c) => c && c.repere === 'profil' && fini(c.lateralMm) ? Math.abs(c.lateralMm) : null;

function partiesDuJournal(journal) {
  const s = new Set();
  for (const e of journal.events) if (e.type === 'batch-started' && e.identity && Number.isInteger(e.identity.part)) s.add(e.identity.part);
  return [...s].sort((a, b) => a - b);
}

/* Le dernier lot de la partie et sa fenêtre : du départ à la relecture ou au lot suivant. */
function lotDe(journal, partie) {
  const ev = journal.events.filter(e => instant(e) !== null).sort((a, b) => instant(a) - instant(b));
  const departs = ev.filter(e => e.type === 'batch-started' && e.batch && e.batch.id);
  const mien = departs.filter(e => e.identity && e.identity.part === partie).pop();
  if (!mien) return null;
  const B = mien.batch.id, t0 = instant(mien);
  let fin = Infinity;
  const suivant = departs.find(e => instant(e) > t0 && e.batch.id !== B);
  if (suivant) fin = instant(suivant);
  /* Le dernier cut est validé sur place jusqu'à ~2 s après l'arrêt, parfois après le début de la relecture : la fenêtre
   * se ferme FIN_APRES_ARRET_S après l'arrêt. Les écritures de la relecture ne portent que sur des cuts déjà posés. */
  const arret = ev.find(e => e.type === 'batch-stopped-at-end' && instant(e) > t0);
  if (arret) fin = Math.min(fin, instant(arret) + FIN_APRES_ARRET_S * 1000);
  else {
    const rel = ev.find(e => e.type === 'relecture-debut' && e.batchId === B);
    if (rel) fin = Math.min(fin, instant(rel));
  }
  return { ev, B, t0, fin };
}

function ciblesDe(lot, partie) {
  const cibles = new Set();
  for (const e of lot.ev) if (e.type === 'gcv1-shadow-observed' && e.batchId === lot.B && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut)) cibles.add(e.identity.cut);
  for (const e of lot.ev) {
    if (e.type === 'capture-abandoned' && e.reason === 'depart-sur-vert' && e.identity && e.identity.part === partie
      && instant(e) >= lot.t0 && instant(e) <= lot.t0 + DEPART_VERT_S * 1000) cibles.delete(e.identity.cut);
  }
  return cibles;
}
function posesDe(lot, cibles) {
  const poses = new Set();
  for (const e of lot.ev) {
    if (e.type !== 'esv-observation' || e.kind !== 'write') continue;
    const t = instant(e);
    if (t < lot.t0 || t >= lot.fin) continue;
    const ok = Number.isInteger(e.status) && e.status >= 200 && e.status < 300;
    const valide = e.body && e.body.ExtractionStatus === 'valid' && e.body.TreatedByOperator === true;
    if (ok && valide && cibles.has(e.rowIndex)) poses.add(e.rowIndex);
  }
  return poses;
}

function indexLignes(journal, echo, partie) {
  if (!echo) return new Map();
  const { table } = J.joindre(echo.records, journal, {
    partie, base: 'auto', poses: false, visiteSansActionBonne: true, sessions: echo.sessions || [],
    pagesPerdues: echo.pagesPerdues || [], capturesParVisite: echo.capturesParVisite || {}, evenementsEcho: echo.evenements || [],
  });
  const m = new Map();
  for (const l of table) if (l.partie === partie) m.set(l.cut, l);
  return m;
}
/* Etat d'un posé : sans-echo | corrige | controle | non-juge | repere (non calibré). */
function etatPose(ligne) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  if (ligne.referenceHumaine !== 'observee') return { etat: 'non-juge' };
  if (ligne.regleVisiteBon) return { etat: 'controle', mm: 0, lat: 0 };
  if (typeof ligne.base !== 'string' || !ligne.base.startsWith('ariane')) return { etat: 'repere' };
  const mm = ligne.ecartHumain && ligne.ecartHumain.maxDist3dMm;
  if (!fini(mm)) return { etat: 'non-juge' };
  const lats = ['gauche', 'droite'].map(c => coteLat(ligne.ecartHumain[c])).filter(fini);
  return { etat: 'corrige', mm, lat: lats.length ? Math.max(...lats) : null };
}
function etatOmbre(ligne, decal) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  if (ligne.referenceHumaine !== 'observee' || ligne.regleVisiteBon) return { etat: 'non-juge' };
  const mm = Voie.ecartPose(decal, J.micDepuisDepart(ligne));
  return fini(mm) ? { etat: 'juge', mm } : { etat: 'non-juge' };
}

function ombreDe(lot, partie, lignes) {
  const derniers = new Map();
  for (const e of lot.ev) {
    if (e.type !== 'passe-differes-ombre' || e.passe !== 1 || !e.identity || e.identity.part !== partie) continue;
    if (e.batchId ? e.batchId !== lot.B : instant(e) < lot.t0) continue;
    derniers.set(e.identity.cut, e);
  }
  const o = { passe1: derniers.size, poserait: 0, rien: 0, refusGarde: 0, juges: 0, sansEcho: 0, nonJuges: 0 };
  const mm = [];
  for (const e of derniers.values()) {
    if (e.decision === 'rien') {
      o.rien++;
      if ((e.garde && e.garde.bloque === true) || e.motif === 'garde-appuis') o.refusGarde++;
      continue;
    }
    if (e.decision !== 'poserait') continue;
    o.poserait++;
    const d = e.decal;
    const et = d && Array.isArray(d.left) && Array.isArray(d.right)
      ? etatOmbre(lignes.get(e.identity.cut), { left: d.left.slice(0, 3), right: d.right.slice(0, 3) }) : { etat: 'non-juge' };
    if (et.etat === 'juge') { o.juges++; mm.push(et.mm); }
    else if (et.etat === 'sans-echo') o.sansEcho++;
    else o.nonJuges++;
  }
  return { o, mm };
}

function analyser(entree, graine = GRAINE) {
  const { partie, journal, echo } = entree;
  const lot = lotDe(journal, partie);
  const base = { partie, version: entree.version || journal.version || null, lotTrouve: !!lot };
  if (!lot) {
    return { ...base, cibles: 0, poses: 0, differes: 0, sansEcho: 0, nonJuges: 0, repereNonCalibre: 0, juges: 0, dontCorriges: 0, dontControles: 0,
      plusDe20mm: 0, plusDe50mm: 0, mauvaiseVoie: 0, precision: Poses.compter([], { graine }),
      ombre: { passe1: 0, poserait: 0, rien: 0, refusGarde: 0, juges: 0, sansEcho: 0, nonJuges: 0, plusDe20mm: 0, plusDe50mm: 0, precision: Poses.compter([], { graine }) }, _mm: [], _mmO: [] };
  }
  const cibles = ciblesDe(lot, partie), poses = posesDe(lot, cibles);
  const lignes = indexLignes(journal, echo, partie);
  const r = { ...base, cibles: cibles.size, poses: poses.size, differes: cibles.size - poses.size, sansEcho: 0, nonJuges: 0, repereNonCalibre: 0,
    juges: 0, dontCorriges: 0, dontControles: 0, plusDe20mm: 0, plusDe50mm: 0, mauvaiseVoie: 0 };
  const mm = [];
  for (const cut of poses) {
    const et = etatPose(lignes.get(cut));
    if (et.etat === 'sans-echo') r.sansEcho++;
    else if (et.etat === 'non-juge') r.nonJuges++;
    else if (et.etat === 'repere') { r.repereNonCalibre++; r.nonJuges++; }
    else {
      r.juges++; mm.push(et.mm);
      if (et.etat === 'controle') r.dontControles++; else r.dontCorriges++;
      if (et.mm > 20) r.plusDe20mm++;
      if (et.mm > 50) r.plusDe50mm++;
      if (fini(et.lat) && et.lat > MAUVAISE_VOIE_LAT_MM) r.mauvaiseVoie++;
    }
  }
  const { o, mm: mmO } = ombreDe(lot, partie, lignes);
  o.plusDe20mm = mmO.filter(x => x > 20).length;
  o.plusDe50mm = mmO.filter(x => x > 50).length;
  o.precision = Poses.compter(mmO, { graine: graine + 1 });
  return { ...r, precision: Poses.compter(mm, { graine }), ombre: o, _mm: mm, _mmO: mmO };
}

const SOMMES = ['cibles', 'poses', 'differes', 'sansEcho', 'nonJuges', 'repereNonCalibre', 'juges', 'dontCorriges', 'dontControles', 'plusDe20mm', 'plusDe50mm', 'mauvaiseVoie'];
const SOMMES_O = ['passe1', 'poserait', 'rien', 'refusGarde', 'juges', 'sansEcho', 'nonJuges', 'plusDe20mm', 'plusDe50mm'];

function juger(entrees, options = {}) {
  const graine = options.graine || GRAINE;
  const parties = entrees.map(e => analyser(e, graine));
  const total = { parties: parties.map(p => p.partie) };
  for (const k of SOMMES) total[k] = parties.reduce((a, p) => a + p[k], 0);
  total.precision = Poses.compter(parties.flatMap(p => p._mm), { graine });
  total.ombre = {};
  for (const k of SOMMES_O) total.ombre[k] = parties.reduce((a, p) => a + p.ombre[k], 0);
  total.ombre.precision = Poses.compter(parties.flatMap(p => p._mmO), { graine: graine + 1 });
  const pub = ({ _mm, _mmO, ...reste }) => reste;
  return {
    format: FORMAT, graine, mauvaiseVoieLatMm: MAUVAISE_VOIE_LAT_MM,
    definition: 'Posé = écriture de validation 2xx pendant le lot. Jugé = validation de l\'opérateur contre la pose d\'Ariane (pire rail, 3D) ou contrôlé, bon (visite sans geste, seulement si l\'Écho a visité le cut). Passe en ombre à part.',
    parties: parties.map(pub), total,
  };
}

const virgule = v => v === null || v === undefined ? '—' : String(v).replace('.', ',');
const pc = (k, n) => n ? `${k}/${n} (${virgule(arr(100 * k / n, 1))} %)` : `${k}/0`;
function bloc(titre, p) {
  const L = [titre];
  L.push(`  cibles ${p.cibles}, posés ${p.poses} sur ${p.cibles} cibles, différés ${p.differes} sur ${p.cibles}`);
  L.push(`  sur ${p.poses} posés : sans Écho ${p.sansEcho}, non jugés ${p.nonJuges}` + (p.repereNonCalibre ? ` (dont repère non calibré ${p.repereNonCalibre})` : '') + `, jugés ${p.juges}`);
  L.push(`  sur ${p.juges} jugés : corrigés par l'opérateur ${p.dontCorriges}, contrôlé, bon ${p.dontControles}`);
  const pr = p.precision;
  if (pr.n) {
    const ic = pr.icMediane || [null, null];
    L.push(`  écart (pire rail, 3D) : médiane ${virgule(pr.medianeMm)} mm [${virgule(ic[0])} ; ${virgule(ic[1])}], max ${virgule(pr.maxMm)} mm`);
  } else L.push('  écart : aucun posé jugé');
  L.push(`  > 20 mm : ${pc(p.plusDe20mm, p.juges)} ; > 50 mm : ${pc(p.plusDe50mm, p.juges)} ; mauvaise voie (latéral > ${MAUVAISE_VOIE_LAT_MM} mm) : ${pc(p.mauvaiseVoie, p.juges)}`);
  const o = p.ombre;
  L.push(`  passe en ombre (à part) : passe 1 sur ${o.passe1} différés, « poserait » ${o.poserait}, « rien » ${o.rien} dont refus de la garde ${o.refusGarde}`);
  L.push(`  sur ${o.poserait} « poserait » : jugés ${o.juges}, sans Écho ${o.sansEcho}, non jugés ${o.nonJuges}` + (o.juges
    ? ` ; médiane ${virgule(o.precision.medianeMm)} mm, max ${virgule(o.precision.maxMm)} mm, > 20 mm ${pc(o.plusDe20mm, o.juges)}, > 50 mm ${pc(o.plusDe50mm, o.juges)}` : ''));
  return L;
}
function texte(r) {
  const L = ['Tableau standard d\'un lot, jugé contre l\'Écho. Écart = pire rail, 3D, pose d\'Ariane contre la validation de l\'opérateur.',
    'Règle « contrôlé, bon » : un posé que l\'opérateur a regardé sans le corriger (visite d\'au moins 0,8 s, aucun rail déplacé de 0,5 mm ou plus, aucune validation)',
    'compte à 0 mm seulement si l\'Écho tournait sur ce cut ; un posé que l\'Écho n\'a pas visité reste « sans Écho », il n\'est pas supposé bon.'];
  for (const p of r.parties) {
    L.push('', ...bloc(`Partie ${p.partie}` + (p.version ? ` · ${p.version}` : '') + (p.lotTrouve ? '' : ' · aucun lot dans le journal'), p));
  }
  if (r.parties.length > 1) L.push('', ...bloc(`Total (parties ${r.total.parties.join(', ')})`, r.total));
  else L.push('', `Total : la partie ${r.total.parties.join(', ')} seule.`);
  return L.join('\n');
}

const USAGE = 'Usage : node tools/juger-lot.cjs <dossier-d-export> [--echo <dossier>]... [--partie N]... [--json fichier.json]';
function lireArguments(argv) {
  const a = { dossier: null, echo: [], parties: new Set(), json: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--echo') a.echo.push(argv[++i]);
    else if (k === '--partie') a.parties.add(Number(argv[++i]));
    else if (k === '--json') a.json = argv[++i];
    else if (k.startsWith('--')) throw Error(`Argument inconnu : ${k}. ${USAGE}`);
    else if (a.dossier === null) a.dossier = k;
    else throw Error(`Un seul dossier d'export attendu. ${USAGE}`);
  }
  if (!a.dossier) throw Error(`dossier d'export manquant. ${USAGE}`);
  for (const p of a.parties) if (!Number.isInteger(p)) throw Error('--partie attend un entier');
  return a;
}
/* Un dossier Écho peut être la collection entière : on descend jusqu'aux dossiers qui portent des archives ou des exports. */
function dossiersEcho(racines) {
  const out = [];
  const marche = (dir) => {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (ents.some(e => e.isFile() && (/\.zip(\.\d{3})?$/i.test(e.name) || /^(ariane|banane)-.*\.json(\.gz)?$/i.test(e.name)))) out.push(dir);
    for (const e of ents) if (e.isDirectory()) marche(path.join(dir, e.name));
  };
  for (const r of racines) marche(r);
  return out.length ? out : racines;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv);
  const journal = Poses.lireJournalDir(a.dossier);
  const echo = a.echo.length ? Poses.lireEcho(dossiersEcho(a.echo)) : null;
  const parties = a.parties.size ? [...a.parties].sort((x, y) => x - y) : partiesDuJournal(journal);
  const r = juger(parties.map(partie => ({ partie, journal, echo })));
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
module.exports = { analyser, juger, partiesDuJournal, lireEcho: Poses.lireEcho, lireArguments, dossiersEcho, executer, texte, FORMAT };
