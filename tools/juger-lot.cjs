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
 *   - cible : cut qui a reçu une décision du lot (gcv1-shadow-observed des lots de la dernière exécution de la partie) ; le cut de départ
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
/* CH-030 (D-269, D-270, D-223) : gestes de l'opérateur et budget. */
const FINE_MM = 10, MOYENNE_MM = 50, SOUS_MM = 5, PLAFOND_D223 = 0.03;

const fini = v => Number.isFinite(v);
const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
const arr = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const coteLat = (c) => c && c.repere === 'profil' && fini(c.lateralMm) ? Math.abs(c.lateralMm) : null;

function partiesDuJournal(journal) {
  const s = new Set();
  for (const e of journal.events) if (e.type === 'batch-started' && e.identity && Number.isInteger(e.identity.part)) s.add(e.identity.part);
  return [...s].sort((a, b) => a - b);
}

/* Les lots de la dernière exécution de la partie, chacun avec sa fenêtre (du départ à la relecture ou au lot suivant).
 * Une exécution = les départs consécutifs de la même partie, sans départ d'une autre partie entre eux : une reprise de file
 * sur la même partie (second lot, parfois fermé au départ sur un vert) en fait partie, un lot d'une exécution antérieure
 * (une autre partie s'est intercalée) n'en fait pas partie. */
function lotsDe(journal, partie) {
  const ev = journal.events.filter(e => instant(e) !== null).sort((a, b) => instant(a) - instant(b));
  const departs = ev.filter(e => e.type === 'batch-started' && e.batch && e.batch.id);
  let i = departs.length - 1;
  while (i >= 0 && !(departs[i].identity && departs[i].identity.part === partie)) i--;
  if (i < 0) return null;
  const run = [departs[i]];
  while (i > 0 && departs[i - 1].identity && departs[i - 1].identity.part === partie && departs[i - 1].batch.id !== departs[i].batch.id) run.unshift(departs[--i]);
  const lots = run.map(mien => {
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
    return { ev, B, t0, fin, cutDepart: mien.identity && Number.isInteger(mien.identity.cut) ? mien.identity.cut : null };
  });
  return { ev, lots, B: lots[lots.length - 1].B, t0: lots[0].t0 };
}

function ciblesDe(lot, partie) {
  const cibles = new Set();
  for (const e of lot.ev) if (e.type === 'gcv1-shadow-observed' && e.batchId === lot.B && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut)) cibles.add(e.identity.cut);
  for (const e of lot.ev) {
    if (e.type === 'capture-abandoned' && e.reason === 'depart-sur-vert' && e.identity && e.identity.part === partie
      && instant(e) >= lot.t0 && instant(e) <= lot.t0 + DEPART_VERT_S * 1000) cibles.delete(e.identity.cut);
    /* Versions où le départ sur vert ne journalise que l'arrêt du lot (motif « depart-sur-vert », 4.9.5.27) : le cut de départ. */
    if (e.type === 'batch-stopped-at-end' && e.reason === 'depart-sur-vert' && lot.cutDepart !== null
      && instant(e) >= lot.t0 && instant(e) <= lot.t0 + DEPART_VERT_S * 1000) cibles.delete(lot.cutDepart);
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

function ciblesPosesDe(run, partie) {
  const cibles = new Set(), poses = new Set();
  for (const lot of run.lots) {
    const c = ciblesDe(lot, partie);
    for (const x of c) cibles.add(x);
    for (const x of posesDe(lot, c)) poses.add(x);
  }
  return { cibles, poses };
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
/* Geste de l'opérateur sur un posé jugé (D-269) : acceptation = regardé et non touché (contrôlé, bon) ; sinon, d'après l'écart
 * en mm : fine (au plus 10), moyenne (plus de 10 à 50), faute (plus de 50). L'écart est arrondi au micromètre (bruit de calcul). */
function geste(mm, controle) {
  if (controle) return 'acceptation';
  if (!fini(mm)) return null;
  const v = Math.round(mm * 1000) / 1000;
  return v <= FINE_MM ? 'fine' : v <= MOYENNE_MM ? 'moyenne' : 'faute';
}
const GESTES = ['acceptation', 'fine', 'moyenne', 'faute'];
/* Répartition des gestes sur une série de {controle, mm} ; n = effectif de l'axe, chaque part avec son intervalle de Wilson. */
function repartition(serie) {
  const g = serie.map(x => geste(x.mm, x.controle)).filter(Boolean);
  const r = { n: g.length };
  for (const k of GESTES) r[k] = Poses.wilson(g.filter(x => x === k).length, g.length);
  return r;
}
/* Gestes d'une liste de jugés {controle, mm, lat, vert} : pire rail 3D, latéral, vertical (pire des deux rails), « sous 5 mm ». */
function gestesDe(ev) {
  const axe = (cle) => repartition(ev.filter(e => e.controle || fini(e[cle])).map(e => ({ controle: e.controle, mm: e[cle] })));
  const mm = ev.map(e => e.mm).filter(fini);
  return { juges: ev.length, seuilsMm: { fine: FINE_MM, moyenne: MOYENNE_MM }, pireRail3d: axe('mm'), lateral: axe('lat'), vertical: axe('vert'),
    sous5mm: Poses.wilson(mm.filter(x => Math.round(x * 1000) / 1000 <= SOUS_MM).length, ev.length) };
}
/* Budget D-223 : fautes (plus de 50 mm, pire rail 3D) sur les POSÉS. Les posés non jugés ne sont ni bons ni mauvais :
 *   plancher = fautes connues sur tous les posés (non jugés supposés sans faute) ; pire cas = tous les non jugés fautifs ;
 *   siSemblables = taux des jugés (SUPPOSÉ : les non jugés leur ressemblent). Le plafond n'est « tenu » que si la borne haute
 *   de Wilson du pire cas l'est ; `tranche` dit si les jugés suffisent à conclure dans un sens. */
function budgetDe(ev, poses, nonJuges) {
  const jug = ev.length, f = ev.filter(e => geste(e.mm, e.controle) === 'faute').length;
  const sem = Poses.wilson(f, jug);
  const pire = Poses.wilson(f + nonJuges, poses), plancher = Poses.wilson(f, poses);
  return { seuilMm: MOYENNE_MM, plafond: PLAFOND_D223, poses, juges: jug, nonJuges, fautesJugees: f,
    couverture: Poses.wilson(jug, poses), plancher, pireCas: pire,
    siSemblables: { ...sem, qualification: 'SUPPOSÉ' },
    tenuSurPlancher: (plancher.bas === null ? 0 : plancher.part) <= PLAFOND_D223,
    tenuPireCas: poses ? pire.haut <= PLAFOND_D223 : null,
    tranche: !!poses && (plancher.bas > PLAFOND_D223 || pire.haut <= PLAFOND_D223) };
}

/* Etat d'un posé : sans-echo | corrige | controle | non-juge | repere (non calibré). */
function etatPose(ligne) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  if (ligne.referenceHumaine !== 'observee') return { etat: 'non-juge' };
  if (ligne.regleVisiteBon) return { etat: 'controle', mm: 0, lat: 0, vert: 0 };
  if (typeof ligne.base !== 'string' || !ligne.base.startsWith('ariane')) return { etat: 'repere' };
  const mm = ligne.ecartHumain && ligne.ecartHumain.maxDist3dMm;
  if (!fini(mm)) return { etat: 'non-juge' };
  const lats = ['gauche', 'droite'].map(c => coteLat(ligne.ecartHumain[c])).filter(fini);
  const verts = ['gauche', 'droite'].map(c => ligne.ecartHumain[c] && ligne.ecartHumain[c].repere === 'profil' && fini(ligne.ecartHumain[c].verticalMm) ? Math.abs(ligne.ecartHumain[c].verticalMm) : null).filter(fini);
  return { etat: 'corrige', mm, lat: lats.length ? Math.max(...lats) : null, vert: verts.length ? Math.max(...verts) : null };
}
function etatOmbre(ligne, decal) {
  if (!ligne || !ligne.dansEcho) return { etat: 'sans-echo' };
  if (ligne.referenceHumaine !== 'observee' || ligne.regleVisiteBon) return { etat: 'non-juge' };
  const mm = Voie.ecartPose(decal, J.micDepuisDepart(ligne));
  return fini(mm) ? { etat: 'juge', mm } : { etat: 'non-juge' };
}

function ombreDe(lot, partie, lignes) {
  const derniers = new Map(), batchs = new Set(lot.lots.map(l => l.B));
  for (const e of lot.ev) {
    if (e.type !== 'passe-differes-ombre' || e.passe !== 1 || !e.identity || e.identity.part !== partie) continue;
    if (e.batchId ? !batchs.has(e.batchId) : instant(e) < lot.t0) continue;
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
  const lot = lotsDe(journal, partie);
  const base = { partie, version: entree.version || journal.version || null, lotTrouve: !!lot };
  if (!lot) {
    return { ...base, cibles: 0, poses: 0, differes: 0, sansEcho: 0, nonJuges: 0, repereNonCalibre: 0, juges: 0, dontCorriges: 0, dontControles: 0,
      plusDe20mm: 0, plusDe50mm: 0, mauvaiseVoie: 0, precision: Poses.compter([], { graine }),
      ombre: { passe1: 0, poserait: 0, rien: 0, refusGarde: 0, juges: 0, sansEcho: 0, nonJuges: 0, plusDe20mm: 0, plusDe50mm: 0, precision: Poses.compter([], { graine }) },
      gestes: gestesDe([]), budgetD223: budgetDe([], 0, 0), _mm: [], _mmO: [], _ev: [] };
  }
  const { cibles, poses } = ciblesPosesDe(lot, partie);
  const lignes = indexLignes(journal, echo, partie);
  const r = { ...base, cibles: cibles.size, poses: poses.size, differes: cibles.size - poses.size, sansEcho: 0, nonJuges: 0, repereNonCalibre: 0,
    juges: 0, dontCorriges: 0, dontControles: 0, plusDe20mm: 0, plusDe50mm: 0, mauvaiseVoie: 0 };
  const mm = [], evJ = [];
  for (const cut of poses) {
    const et = etatPose(lignes.get(cut));
    if (et.etat === 'sans-echo') r.sansEcho++;
    else if (et.etat === 'non-juge') r.nonJuges++;
    else if (et.etat === 'repere') { r.repereNonCalibre++; r.nonJuges++; }
    else {
      r.juges++; mm.push(et.mm);
      evJ.push({ controle: et.etat === 'controle', mm: et.mm, lat: et.lat, vert: et.vert });
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
  return { ...r, precision: Poses.compter(mm, { graine }), ombre: o,
    gestes: gestesDe(evJ), budgetD223: budgetDe(evJ, r.poses, r.poses - r.juges), _mm: mm, _mmO: mmO, _ev: evJ };
}

const SOMMES = ['cibles', 'poses', 'differes', 'sansEcho', 'nonJuges', 'repereNonCalibre', 'juges', 'dontCorriges', 'dontControles', 'plusDe20mm', 'plusDe50mm', 'mauvaiseVoie'];
const SOMMES_O = ['passe1', 'poserait', 'rien', 'refusGarde', 'juges', 'sansEcho', 'nonJuges', 'plusDe20mm', 'plusDe50mm'];

function juger(entrees, options = {}) {
  const graine = options.graine || GRAINE;
  const parties = entrees.map(e => analyser(e, graine));
  const total = { parties: parties.map(p => p.partie) };
  for (const k of SOMMES) total[k] = parties.reduce((a, p) => a + p[k], 0);
  total.precision = Poses.compter(parties.flatMap(p => p._mm), { graine });
  const evTous = parties.flatMap(p => p._ev);
  total.gestes = gestesDe(evTous);
  total.budgetD223 = budgetDe(evTous, total.poses, total.poses - total.juges);
  total.ombre = {};
  for (const k of SOMMES_O) total.ombre[k] = parties.reduce((a, p) => a + p.ombre[k], 0);
  total.ombre.precision = Poses.compter(parties.flatMap(p => p._mmO), { graine: graine + 1 });
  const pub = ({ _mm, _mmO, _ev, ...reste }) => reste;
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
  L.push(...blocGestes(p));
  return L;
}
const pw = (w) => w.n ? `${w.k}/${w.n} (${virgule(arr(100 * w.part, 1))} % [${virgule(arr(100 * w.bas, 1))} ; ${virgule(arr(100 * w.haut, 1))}])` : '0/0';
function blocGestes(p) {
  const g = p.gestes, b = p.budgetD223, L = [];
  L.push(`  gestes (CH-030, intervalles de Wilson à 95 %), sur ${g.juges} jugés : acceptation = regardé et non touché ; fine = au plus ${FINE_MM} mm ; moyenne = plus de ${FINE_MM} à ${MOYENNE_MM} mm ; faute = plus de ${MOYENNE_MM} mm`);
  for (const [nom, cle] of [['pire rail 3D', 'pireRail3d'], ['latéral', 'lateral'], ['vertical', 'vertical']]) {
    const a = g[cle];
    L.push(`    ${nom} (sur ${a.n}) : acceptation ${pw(a.acceptation)}, fine ${pw(a.fine)}, moyenne ${pw(a.moyenne)}, faute ${pw(a.faute)}`);
  }
  L.push(`    sous 5 mm (indicateur, pire rail 3D, sur ${g.juges} jugés) : ${pw(g.sous5mm)}`);
  L.push(`  budget D-223 (fautes > ${b.seuilMm} mm au plus ${virgule(100 * b.plafond)} % des posés), sur ${b.poses} posés : jugés ${b.juges}, couverture ${pw(b.couverture)}, non jugés ou sans Écho ${b.nonJuges} (ni bons ni mauvais)`);
  if (!b.poses) L.push('    aucun posé : budget non évaluable');
  else {
    L.push(`    fautes jugées ${b.fautesJugees} : plancher (non jugés sans faute) ${pw(b.plancher)} ; pire cas (tous les non jugés fautifs) ${pw(b.pireCas)}`);
    L.push(`    si les non jugés ressemblent aux jugés (SUPPOSÉ) : ${b.siSemblables.n ? pw(b.siSemblables) : 'aucun jugé'}`);
    L.push(`    ${b.tranche ? (b.tenuPireCas ? 'plafond tenu même au pire cas' : 'plafond dépassé même au plancher') : 'ni tenu ni dépassé de façon certaine : les jugés ne suffisent pas à trancher'}`);
  }
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
module.exports = { analyser, juger, partiesDuJournal, lireEcho: Poses.lireEcho, lireArguments, dossiersEcho, executer, texte, geste, gestesDe, budgetDe, FORMAT };
