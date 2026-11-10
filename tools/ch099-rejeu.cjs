#!/usr/bin/env node
'use strict';
/*
 * ch099-rejeu.cjs — CH-099 (D-322) : la « recherche large » de CH-034 rejouée HORS LIGNE, telle quelle, sur les poses réelles des lots récents.
 * Lecture seule : rien n'est commandé, aucun fichier de l'extension n'est modifié, `src/recherche-large.js` est appelé sans changement.
 * Plan fermé : chantiers/CH-099/plan.md (3 variantes : soutien du dessus 0, 60, 90 ; aucun autre seuil).
 *
 *   node tools/ch099-rejeu.cjs decisions --lot DOSSIER [--echo DOSSIER]… [--partie N]… [--cuts a,b,…] [--tranche i/n] --etiquette NOM --sortie F.jsonl
 *       Pour chaque cut POSÉ par le lot (définition de tools/juger-lot.cjs : écriture de validation 2xx pendant le lot) : la décision de la recherche
 *       large sur la pose réellement écrite et le nuage du cut, par variante ; le jugement de l'Écho ; les trois gardes en ombre (événement du journal,
 *       sinon module rejoué) ; la couverture en travers de la capture. `--tranche i/n` : un segment de corpus sur n (rejeu réparti sur plusieurs processus).
 *   node tools/ch099-rejeu.cjs synthese --decisions F.jsonl [--decisions …] [--json S.json]
 *
 * Sorties HORS DÉPÔT : numéros de cut et millimètres (repère profil de la pose de départ) seulement ; aucun identifiant, aucune coordonnée de scène.
 */
const fs = require('node:fs'), path = require('node:path');
const C = require('../vendor/capture-core.js');
const RL = require('../src/recherche-large.js');
const Sh = require('../src/gcv1-shadow.js');
const GV = require('../src/garde-voie-ombre.js');
const LM = require('../src/liste-memoire.js');

const FORMAT = 'ch099-decisions-v1';
const SIDES = ['left', 'right'], FR = { left: 'gauche', right: 'droite' };
const fini = v => typeof v === 'number' && Number.isFinite(v);
const r1 = v => fini(v) ? Math.round(v * 10) / 10 : null;
/* Plan § 2 : la règle de CH-034 en mode « différer », telle quelle ; seul `soutienTop` distingue les trois variantes. */
const REGLE = Object.freeze({ actif: true, mode: 'differer', porteeMm: 400, pasMm: 120, loinMm: 50, rapport: 1.5, presMm: 15, cellulesMax: 12, zones: null, passe: true, sansPaireLoin: true, soutienFace: 0, grainesMode: 'grille' });
const VARIANTES = Object.freeze(Object.fromEntries([['S0', 0], ['S60', 60], ['S90', 90]].map(([k, s]) => [k, Object.freeze(RL.reglage({ ...REGLE, soutienTop: s }))])));
const VARIANTE_VERDICT = 'S60';
const FAUTE_MM = 50, JUSTE_MM = 10, SERIE_TROU = 2, SANS_MOUVEMENT_MM = 0.5, VISITE_COURTE_S = 1.5, COUVERTURE_MM = 400;

function wilson(k, n) {
  if (!n) return { k: 0, n: 0, part: null, bas: null, haut: null };
  const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  const a = v => Math.round(v * 1e4) / 1e4;
  return { k, n, part: a(p), bas: a(Math.max(0, (c - m) / d)), haut: a(Math.min(1, (c + m) / d)) };
}
/* Plan § 4. */
const classe = mm => !fini(mm) ? null : mm > FAUTE_MM ? 'faute' : mm > JUSTE_MM ? 'moyenne' : 'juste';
const ecartee = j => !!j && j.etat === 'corrige' && fini(j.mm) && j.mm < SANS_MOUVEMENT_MM && fini(j.dureeS) && j.dureeS < VISITE_COURTE_S;
function series(fautes) {
  const par = new Map();
  for (const f of fautes) { const k = f.lot + '|' + f.partie; if (!par.has(k)) par.set(k, []); par.get(k).push(f); }
  const out = [];
  for (const k of [...par.keys()].sort((a, b) => { const [la, pa] = a.split('|'), [lb, pb] = b.split('|'); return la < lb ? -1 : la > lb ? 1 : pa - pb; })) {
    let cur = null;
    for (const f of par.get(k).sort((a, b) => a.cut - b.cut)) { if (cur && f.cut - cur[cur.length - 1].cut <= SERIE_TROU + 1) cur.push(f); else out.push(cur = [f]); }
  }
  return out;
}
/* Étendue en travers (mm, repère profil du rail de départ) des points de la capture autour de chaque rail, masque de découpe respecté, dans la bande
 * longitudinale que le moteur lit (±500 mm) : `min`/`max` à toutes les hauteurs (c'est la zone capturée), `bandeMin`/`bandeMax` dans la bande verticale du
 * moteur (±100 mm : ce qui s'y trouve dépend des objets, pas de la zone capturée). `couvre400` : chaque rail a des points de −400 à +400 mm (à 20 mm près). */
function couverture(capture) {
  const out = {};
  for (const s of SIDES) {
    const rail = capture.rails[s], M = rail.sceneRelativeToProfileLocal, o = C.point(M, rail.positionSceneRelative), pts = capture.pointsSceneRelative, vis = capture.visibleByClipBoxes;
    let n = 0, nb = 0, min = Infinity, max = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      if (vis && vis[i] === false) continue; const p = pts[i]; if (!Array.isArray(p) || p.length < 3) continue;
      const q = C.point(M, p); if (Math.abs(q[0] - o[0]) > .5) continue;
      const y = 1000 * (q[1] - o[1]); n++; if (y < min) min = y; if (y > max) max = y;
      if (Math.abs(q[2] - o[2]) <= .1) { nb++; if (y < bmin) bmin = y; if (y > bmax) bmax = y; }
    }
    out[s] = { n, min: n ? Math.round(min) : null, max: n ? Math.round(max) : null, nBande: nb, bandeMin: nb ? Math.round(bmin) : null, bandeMax: nb ? Math.round(bmax) : null };
  }
  out.couvre400 = SIDES.every(s => out[s].n > 0 && out[s].min <= -(COUVERTURE_MM - 20) && out[s].max >= COUVERTURE_MM - 20);
  return out;
}
/* Plan § 6. */
function verdict({ series: nSeries, fautes, differees, poses, posesDifferes, sansPaire }) {
  const base = { series: nSeries, fautes: wilson(differees, fautes), cout: wilson(posesDifferes, poses), sansPaire };
  if (nSeries < 3) return { ...base, verdict: 'non concluable', raison: 'moins de 3 séries rejouables' };
  const raisons = [];
  if (fautes && differees < fautes / 2) raisons.push('moins de la moitié des fautes différées');
  if (poses && posesDifferes / poses > 0.08) raisons.push('plus de 8 % des posés différés');
  if (fautes && sansPaire > fautes / 2) raisons.push('nuages trop pauvres');
  if (raisons.length) return { ...base, verdict: 'abandon', raison: raisons.join(' ; ') };
  if (fautes && differees / fautes >= 0.7 && posesDifferes / poses < 0.08) return { ...base, verdict: 'candidat pour l\'ombre', raison: null };
  return { ...base, verdict: 'ni candidat ni abandon', raison: null };
}

/* ---------- lecture d'un lot (logique de tools/juger-lot.cjs, qui n'exporte pas ces fonctions : reprise à l'identique, contrôlée par les mêmes comptes) ---------- */
const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
const DEPART_VERT_S = 30, FIN_APRES_ARRET_S = 5;
function lotsDe(journal, partie) {
  const ev = journal.events.filter(e => instant(e) !== null).sort((a, b) => instant(a) - instant(b));
  const departs = ev.filter(e => e.type === 'batch-started' && e.batch && e.batch.id);
  let i = departs.length - 1;
  while (i >= 0 && !(departs[i].identity && departs[i].identity.part === partie)) i--;
  if (i < 0) return null;
  const run = [departs[i]];
  while (i > 0 && departs[i - 1].identity && departs[i - 1].identity.part === partie && departs[i - 1].batch.id !== departs[i].batch.id) run.unshift(departs[--i]);
  const lots = run.map(mien => {
    const B = mien.batch.id, t0 = instant(mien); let fin = Infinity;
    const suivant = departs.find(e => instant(e) > t0 && e.batch.id !== B); if (suivant) fin = instant(suivant);
    const arret = ev.find(e => e.type === 'batch-stopped-at-end' && instant(e) > t0);
    if (arret) fin = Math.min(fin, instant(arret) + FIN_APRES_ARRET_S * 1000);
    else { const rel = ev.find(e => e.type === 'relecture-debut' && e.batchId === B); if (rel) fin = Math.min(fin, instant(rel)); }
    return { ev, B, t0, fin, cutDepart: mien.identity && Number.isInteger(mien.identity.cut) ? mien.identity.cut : null };
  });
  return { ev, lots };
}
function ciblesDe(lot, partie) {
  const cibles = new Set();
  for (const e of lot.ev) if (e.type === 'gcv1-shadow-observed' && e.batchId === lot.B && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut)) cibles.add(e.identity.cut);
  for (const e of lot.ev) {
    if (e.type === 'capture-abandoned' && e.reason === 'depart-sur-vert' && e.identity && e.identity.part === partie && instant(e) >= lot.t0 && instant(e) <= lot.t0 + DEPART_VERT_S * 1000) cibles.delete(e.identity.cut);
    if (e.type === 'batch-stopped-at-end' && e.reason === 'depart-sur-vert' && lot.cutDepart !== null && instant(e) >= lot.t0 && instant(e) <= lot.t0 + DEPART_VERT_S * 1000) cibles.delete(lot.cutDepart);
  }
  return cibles;
}
function posesDe(lot, cibles) {
  const poses = new Set();
  for (const e of lot.ev) {
    if (e.type !== 'esv-observation' || e.kind !== 'write') continue;
    const t = instant(e); if (t < lot.t0 || t >= lot.fin) continue;
    if (Number.isInteger(e.status) && e.status >= 200 && e.status < 300 && e.body && e.body.ExtractionStatus === 'valid' && e.body.TreatedByOperator === true && cibles.has(e.rowIndex)) poses.add(e.rowIndex);
  }
  return poses;
}
const coteLat = c => c && c.repere === 'profil' && fini(c.lateralMm) ? Math.abs(c.lateralMm) : null;
function etatPose(l) {
  if (!l || !l.dansEcho) return { etat: 'sans-echo' };
  if (l.referenceHumaine !== 'observee') return { etat: 'non-juge' };
  const durees = { dureeS: l.dureeVisiteS ?? null, gesteS: l.gesteValidationS ?? null };
  if (l.regleVisiteBon) return { etat: 'controle', mm: 0, lat: 0, ...durees };
  if (typeof l.base !== 'string' || !l.base.startsWith('ariane')) return { etat: 'repere' };
  const mm = l.ecartHumain && l.ecartHumain.maxDist3dMm; if (!fini(mm)) return { etat: 'non-juge' };
  const lats = ['gauche', 'droite'].map(c => coteLat(l.ecartHumain[c])).filter(fini);
  return { etat: 'corrige', mm, lat: lats.length ? Math.max(...lats) : null, ...durees };
}

/* ---------- la recherche large, module inchangé ; le moteur gelé n'est relancé qu'une fois par graine et par cut pour les trois variantes ---------- */
function avecCache(fn) {
  const origine = Sh.scientificProposeBothAvecReservoir, cache = new Map();
  Sh.scientificProposeBothAvecReservoir = cap => { const k = SIDES.map(s => cap.rails[s].positionSceneRelative.join(',')).join('|'); if (!cache.has(k)) { let v, err = null; try { v = origine(cap); } catch (e) { err = e; } cache.set(k, { v, err }); } const c = cache.get(k); if (c.err) throw c.err; return c.v; };
  try { return fn(); } finally { Sh.scientificProposeBothAvecReservoir = origine; }
}
const paireMm = p => p ? { left: [r1(p.left.lat), r1(p.left.vert)], right: [r1(p.right.lat), r1(p.right.vert)], g: r1(p.gaugeMm), prod: Number(p.prod.toPrecision(4)), top: [p.left.top, p.right.top], face: [p.left.face, p.right.face] } : null;
const ecartPaire = (p, q) => Math.max(...SIDES.map(s => Math.hypot(p[s].lat - q[s].lat, p[s].vert - q[s].vert)));
/* `capture` : { rails, pointsSceneRelative, visibleByClipBoxes } ; `positions` : la pose écrite, repère scène ; `verite` (facultatif) : { left:{lat,vert}, right } en mm depuis le départ. */
function deciderCut(capture, positions, verite) {
  return avecCache(() => {
    const out = { rl: {} };
    for (const [nom, R] of Object.entries(VARIANTES)) {
      const d = RL.decider({ capture, positions, R });
      out.rl[nom] = { etat: d.etat, motif: d.motif };
      if (nom === 'S0') Object.assign(out, { nPaires: d.nPaires, cellules: [d.cellules.left, d.cellules.right], paireLot: paireMm(d.paireLot), meilleure: paireMm(d.meilleure), _best: d.meilleure });
      if (d.concurrente) out.rl[nom].concurrente = paireMm(d.concurrente);
    }
    const pose = {}; for (const s of SIDES) { const dd = RL.decalage(capture.rails[s], positions[s]); pose[s] = { lat: dd[1], vert: dd[2] }; }
    out.poseMm = { left: [r1(pose.left.lat), r1(pose.left.vert)], right: [r1(pose.right.lat), r1(pose.right.vert)] };
    out.meilleureAPoseMm = out._best ? r1(ecartPaire(out._best, pose)) : null;
    if (verite) {
      out.veriteMm = { left: [r1(verite.left.lat), r1(verite.left.vert)], right: [r1(verite.right.lat), r1(verite.right.vert)] };
      out.meilleureAVeriteMm = out._best ? r1(ecartPaire(out._best, verite)) : null;
      const P = RL.paires(capture, RL.cellules(capture, VARIANTES.S0), VARIANTES.S0);
      let pres = null; for (const p of P) { const e = ecartPaire(p, verite); if (!pres || e < pres.e) pres = { e, p }; }
      out.paireVerite = pres ? { ecartMm: r1(pres.e), rang: P.indexOf(pres.p) + 1, top: [pres.p.left.top, pres.p.right.top], prod: Number(pres.p.prod.toPrecision(4)) } : null;
    }
    delete out._best; return out;
  });
}

function lireArgs(argv) {
  const a = { lot: null, echo: [], parties: [], cuts: null, tranche: null, etiquette: null, sortie: null, decisions: [], json: null, cmd: argv[0] };
  for (let i = 1; i < argv.length; i++) { const k = argv[i], v = argv[i + 1];
    if (k === '--lot') { a.lot = v; i++; } else if (k === '--echo') { a.echo.push(v); i++; } else if (k === '--partie') { a.parties.push(+v); i++; }
    else if (k === '--cuts') { a.cuts = new Set(v.split(',').map(Number)); i++; } else if (k === '--tranche') { a.tranche = v.split('/').map(Number); i++; }
    else if (k === '--etiquette') { a.etiquette = v; i++; } else if (k === '--sortie') { a.sortie = v; i++; } else if (k === '--decisions') { a.decisions.push(v); i++; } else if (k === '--json') { a.json = v; i++; }
    else throw Error('argument inconnu : ' + k); }
  return a;
}
function decisions(a) {
  const J = require('./jointure-echo-orbite.cjs'), Poses = require('./precision-poses.cjs'), JL = require('./juger-lot.cjs');
  const journal = Poses.lireJournalDir(a.lot), echo = a.echo.length ? Poses.lireEcho(JL.dossiersEcho(a.echo)) : null;
  const parties = a.parties.length ? a.parties : JL.partiesDuJournal(journal), par = J.journalParCut(journal);
  const travail = new Map(), bilan = [];
  for (const partie of parties) {
    const run = lotsDe(journal, partie); if (!run) continue;
    const cibles = new Set(), poses = new Set(), lotsB = new Set(run.lots.map(l => l.B));
    for (const lot of run.lots) { const c = ciblesDe(lot, partie); for (const x of c) cibles.add(x); for (const x of posesDe(lot, c)) poses.add(x); }
    const lignes = new Map();
    if (echo) { const { table } = J.joindre(echo.records, journal, { partie, base: 'auto', poses: false, visiteSansActionBonne: true, sessions: echo.sessions || [], pagesPerdues: echo.pagesPerdues || [], capturesParVisite: echo.capturesParVisite || {}, evenementsEcho: echo.evenements || [] });
      for (const l of table) if (l.partie === partie) lignes.set(l.cut, l); }
    const obs = new Map(), r3 = new Map(), r3reel = new Set(), grappe = new Map(), voie = new Map(), passe = new Set();
    for (const e of journal.events) { const id = e.identity; if (!id || id.part !== partie || !Number.isInteger(id.cut)) continue;
      if (e.type === 'gcv1-shadow-observed' && lotsB.has(e.batchId)) obs.set(id.cut, e);
      else if (e.type === 'garde-apres-differe-ombre' && lotsB.has(e.batchId)) r3.set(id.cut, e);
      else if (e.type === 'garde-apres-differe' && lotsB.has(e.batchId)) r3reel.add(id.cut);
      else if (e.type === 'regles-metier-ombre' && lotsB.has(e.batchId) && e.portee === 'cut') grappe.set(id.cut, e);
      else if (e.type === 'garde-voie-ombre' && lotsB.has(e.batchId)) voie.set(id.cut, e);
      else if (e.type === 'passe-differes-ecriture' && e.resultat === 'ecrit') passe.add(id.cut); }
    const gardeReglee = journal.events.some(e => e.type === 'garde-apres-differe-ombre' && lotsB.has(e.batchId)) ? 'ombre' : journal.events.some(e => e.type === 'garde-apres-differe' && lotsB.has(e.batchId)) ? 'active' : 'inconnue';
    let table = null; const fl = fs.readdirSync(a.lot).filter(n => new RegExp('^ariane-liste-partie' + partie + '-').test(n)).sort().pop();
    if (fl) try { table = LM.decompacter(JSON.parse(fs.readFileSync(path.join(a.lot, fl)))); } catch { table = null; }
    let sansCapture = 0, sansPose = 0;
    for (const cut of [...poses].sort((x, y) => x - y)) {
      if (a.cuts && !a.cuts.has(cut)) continue;
      const e = obs.get(cut), x = par.get(partie + '|' + cut), ar = x && J.poseAriane(x);
      if (!ar || !SIDES.every(s => ar.posee[s] && Array.isArray(ar.posee[s].positionSceneRelative))) { sansPose++; continue; }
      if (!e || !e.lidarCaptureId) { sansCapture++; continue; }
      const positions = Object.fromEntries(SIDES.map(s => [s, ar.posee[s].positionSceneRelative.slice(0, 3)])), l = lignes.get(cut), juge = etatPose(l), lo = e.lotObservation || {};
      const gv = voie.get(cut), gvr = gv ? null : GV.evaluer({ cut, positions, table, valide: true, reglage: { seuilMm: 15, fenetre: 20, voisinesMin: 5, avantSeulement: true } }), rm = grappe.get(cut), g3 = r3.get(cut);
      travail.set(e.lidarCaptureId, { partie, cut, positions, ligne: l, sortie: { format: FORMAT, lot: a.etiquette, partie, cut, etage: lo.stage ?? null, l1: lo.l1 ? (lo.l1.etat ?? null) : null, passeEcrite: passe.has(cut),
        juge: { etat: juge.etat, mm: fini(juge.mm) ? Math.round(juge.mm * 100) / 100 : null, lat: r1(juge.lat), dureeS: juge.dureeS ?? null, gesteS: juge.gesteS ?? null, classe: juge.etat === 'controle' ? 'juste' : juge.etat === 'corrige' ? classe(juge.mm) : null, ecartee: ecartee(juge) },
        gardes: { r3: { signale: !!g3, source: gardeReglee === 'ombre' ? 'journal' : gardeReglee === 'active' ? 'active-au-lot' : 'absente', appuis: g3 ? g3.appuis ?? null : null },
          grappe: { signale: !!(rm && Array.isArray(rm.regles) && rm.regles.includes('grappe-differes')), source: rm ? 'journal' : 'absente', regles: rm ? rm.regles || [] : null, zonePn: rm && rm.zone ? rm.zone.pn ?? null : null, zoneAdv: rm && rm.zone ? !!rm.zone.adv : null },
          voie: gv ? { signale: !!gv.auraitPause, source: 'journal', ecartAuVoisinageMm: gv.ecartAuVoisinageMm ?? null } : { signale: !!gvr.auraitPause, source: 'rejouee', ecartAuVoisinageMm: gvr.ecartAuVoisinageMm, motif: gvr.motif } } } });
    }
    bilan.push({ partie, cibles: cibles.size, poses: poses.size, sansCapture, sansPose, r3reel: r3reel.size, garde: gardeReglee });
  }
  /* Les nuages : un segment de corpus à la fois (mémoire), une tranche de segments par processus. */
  const segs = fs.readdirSync(a.lot).filter(n => /gcv1-corpus/.test(n)).sort(), out = fs.createWriteStream(a.sortie), vus = new Set();
  let ecrits = 0;
  segs.forEach((n, i) => {
    if (a.tranche && i % a.tranche[1] !== a.tranche[0]) return;
    const doc = JSON.parse(fs.readFileSync(path.join(a.lot, n), 'utf8'));
    for (const c of doc.clouds || []) {
      const w = c.captureId && travail.get(c.captureId); if (!w || !c.rails || !c.pointsSceneRelative || vus.has(c.captureId)) continue; vus.add(c.captureId);
      const capture = { identity: null, rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: c.visibleByClipBoxes };
      const t0 = Date.now(); let verite = null, d;
      const eh = w.ligne && w.ligne.ecartHumain, j = w.sortie.juge;
      try {
        if (j.etat === 'corrige' && eh && SIDES.every(s => eh[FR[s]] && eh[FR[s]].repere === 'profil')) { verite = {}; for (const s of SIDES) { const p = RL.decalage(capture.rails[s], w.positions[s]); verite[s] = { lat: p[1] + eh[FR[s]].lateralMm, vert: p[2] + eh[FR[s]].verticalMm }; } }
        else if (j.etat === 'controle') { verite = {}; for (const s of SIDES) { const p = RL.decalage(capture.rails[s], w.positions[s]); verite[s] = { lat: p[1], vert: p[2] }; } }
        d = deciderCut(capture, w.positions, verite);
      } catch (err) { d = { erreur: String(err && err.message || err).slice(0, 120) }; }
      out.write(JSON.stringify({ ...w.sortie, couverture: couverture(capture), ...d, ms: Date.now() - t0 }) + '\n'); ecrits++;
    }
  });
  out.end();
  const absents = a.tranche ? null : [...travail.keys()].filter(k => !vus.has(k)).length;
  console.log(JSON.stringify({ etiquette: a.etiquette, tranche: a.tranche, bilan, aRejouer: travail.size, ecrits, nuageAbsent: absents }));
}

function lireDecisions(fichiers) { const L = []; for (const f of fichiers) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l.trim()) L.push(JSON.parse(l)); return L; }
/* Synthèse (plan § 5, M1 à M3). `sansControle` : les lignes « visité sans action » retirées des jugés. Les validations écartées (D-285) ne sont jamais des jugés. */
function synthese(L) {
  const juges = l => (l.juge.etat === 'corrige' || l.juge.etat === 'controle') && !l.juge.ecartee;
  const differe = (l, v) => !!(l.rl && l.rl[v] && l.rl[v].etat === 'differer');
  const lots = [...new Set(L.map(l => l.lot))].sort(), V = Object.keys(VARIANTES), out = { format: 'ch099-synthese-v1', variantes: V, lots: {}, fautes: [], series: [], verdict: {} };
  const compte = (S, v) => ({ n: S.length, differes: S.filter(l => differe(l, v)).length });
  for (const lot of [...lots, 'TOUS']) {
    const S = L.filter(l => lot === 'TOUS' || l.lot === lot), J_ = S.filter(juges), o = { poses: S.length, erreurs: S.filter(l => l.erreur).length, juges: J_.length, controles: J_.filter(l => l.juge.etat === 'controle').length, ecartees: S.filter(l => l.juge.ecartee).length,
      fautes: J_.filter(l => l.juge.classe === 'faute').length, moyennes: J_.filter(l => l.juge.classe === 'moyenne').length, justes: J_.filter(l => l.juge.classe === 'juste').length, couvre400: S.filter(l => l.couverture && l.couverture.couvre400).length, parVariante: {} };
    for (const v of V) {
      const w = (k, n) => wilson(k, n), d = l => differe(l, v);
      const justes = J_.filter(l => l.juge.classe === 'juste'), justesSC = justes.filter(l => l.juge.etat !== 'controle');
      o.parVariante[v] = { posesDifferes: w(S.filter(d).length, S.length), fautesDifferees: w(J_.filter(l => l.juge.classe === 'faute' && d(l)).length, o.fautes), moyennesDifferees: w(J_.filter(l => l.juge.classe === 'moyenne' && d(l)).length, o.moyennes),
        justesDifferees: w(justes.filter(d).length, justes.length), justesDiffereesSansControle: w(justesSC.filter(d).length, justesSC.length),
        motifs: S.reduce((m, l) => { const k = l.rl && l.rl[v] ? l.rl[v].etat + ':' + l.rl[v].motif : 'erreur'; m[k] = (m[k] || 0) + 1; return m; }, {}) };
    }
    out.lots[lot] = o;
  }
  const F = L.filter(l => juges(l) && l.juge.classe === 'faute');
  const g = l => ({ r3: l.gardes.r3.signale, grappe: l.gardes.grappe.signale, voie: l.gardes.voie.signale });
  out.fautes = F.map(l => ({ lot: l.lot, partie: l.partie, cut: l.cut, mm: l.juge.mm, etage: l.etage, l1: l.l1, couvre400: !!(l.couverture && l.couverture.couvre400), rl: Object.fromEntries(V.map(v => [v, l.rl ? l.rl[v].etat + ':' + l.rl[v].motif : 'erreur'])),
    meilleureAVeriteMm: l.meilleureAVeriteMm ?? null, paireVerite: l.paireVerite ?? null, nPaires: l.nPaires ?? null, gardes: g(l), sources: { r3: l.gardes.r3.source, grappe: l.gardes.grappe.source, voie: l.gardes.voie.source } }));
  const S_ = series(F);
  out.series = S_.map(s => { const rej = s.filter(l => !l.erreur && l.couverture && l.couverture.couvre400);
    return { lot: s[0].lot, partie: s[0].partie, cuts: s.map(l => l.cut), rejouable: rej.length > 0, differee: Object.fromEntries(V.map(v => [v, rej.length > 0 && rej.every(l => differe(l, v))])),
      gardes: { r3: s.every(l => l.gardes.r3.signale), grappe: s.every(l => l.gardes.grappe.signale), voie: s.every(l => l.gardes.voie.signale) } }; });
  const Frej = F.filter(l => !l.erreur && l.couverture && l.couverture.couvre400), nonErr = L.filter(l => !l.erreur);
  for (const v of V) out.verdict[v] = verdict({ series: out.series.filter(s => s.rejouable).length, fautes: Frej.length, differees: Frej.filter(l => differe(l, v)).length, poses: nonErr.length, posesDifferes: nonErr.filter(l => differe(l, v)).length, sansPaire: Frej.filter(l => l.rl[v].motif === 'aucune-paire-forte').length });
  /* M2 : gardes seules, union, apport propre, sur les fautes et sur les jugés justes. */
  const U = (l, v) => differe(l, v) || l.gardes.r3.signale || l.gardes.grappe.signale || l.gardes.voie.signale, JJ = L.filter(l => juges(l) && l.juge.classe === 'juste');
  out.gardes = {};
  for (const [nom, S] of [['fautes', F], ['justes', JJ], ['poses', L]]) { const o = { n: S.length, r3: S.filter(l => l.gardes.r3.signale).length, grappe: S.filter(l => l.gardes.grappe.signale).length, voie: S.filter(l => l.gardes.voie.signale).length, troisGardes: S.filter(l => g(l).r3 || g(l).grappe || g(l).voie).length, parVariante: {} };
    for (const v of V) o.parVariante[v] = { rl: S.filter(l => differe(l, v)).length, union: S.filter(l => U(l, v)).length, rlSeule: S.filter(l => differe(l, v) && !(g(l).r3 || g(l).grappe || g(l).voie)).length };
    out.gardes[nom] = o; }
  out.varianteDuVerdict = VARIANTE_VERDICT;
  return out;
}

module.exports = { FORMAT, REGLE, VARIANTES, VARIANTE_VERDICT, wilson, classe, ecartee, series, couverture, verdict, deciderCut, synthese, lotsDe, ciblesDe, posesDe, etatPose };
if (require.main === module) {
  try {
    const a = lireArgs(process.argv.slice(2));
    if (a.cmd === 'decisions') { if (!a.lot || !a.sortie || !a.etiquette) throw Error('decisions : --lot, --etiquette et --sortie sont requis'); decisions(a); }
    else if (a.cmd === 'synthese') { const s = synthese(lireDecisions(a.decisions)); if (a.json) fs.writeFileSync(a.json, JSON.stringify(s, null, 1)); console.log(JSON.stringify(s, null, 1)); }
    else throw Error('commande inconnue (decisions, synthese)');
  } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
