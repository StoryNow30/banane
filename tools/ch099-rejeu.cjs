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
 *       `--garde-reelle` : au lieu des posés, les cuts que la garde « après un différé », ALORS ACTIVE (lots des 04 et 05/11), a retenus : la décision de la
 *       recherche large sur la pose que le lot allait valider (pose CONTREFACTUELLE, jamais écrite telle quelle), jugée contre la pose finale de l'opérateur.
 *   node tools/ch099-rejeu.cjs juges --lot DOSSIER [--echo DOSSIER]… --etiquette NOM --sortie F.jsonl
 *       L'état de chaque posé selon le juge commun de l'étude (tools/juge-poses-faux.cjs, CH-100) à côté de celui de ce script : contrôle de concordance.
 *       Avec `--verites`, écrit aussi la pose finale de l'opérateur des cuts DIFFÉRÉS ou écrits par la deuxième passe (mm depuis la pose de départ).
 *   node tools/ch099-rejeu.cjs seconde-chance --temoin BANC.jsonl --rl BANC.jsonl --etiquette NOM [--decisions F.jsonl]… [--verites F.jsonl]… [--sortie F.jsonl]
 *       Plan M4 et M5 : deux rejeux conjoints de tools/banc-differes.cjs (profils base et L1-se, deuxième passe livrée), sans et avec le levier ; ce que deviennent
 *       les cuts que le levier diffère (reposés par la passe ou la GCV2, restés différés), jugés contre la pose finale de l'opérateur ; fidélité du rejeu.
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
  const a = { temoin: null, rl: null, verites: [], ecrireVerites: null, gardeReelle: false, lot: null, echo: [], parties: [], cuts: null, tranche: null, etiquette: null, sortie: null, decisions: [], json: null, cmd: argv[0] };
  for (let i = 1; i < argv.length; i++) { const k = argv[i], v = argv[i + 1];
    if (k === '--lot') { a.lot = v; i++; } else if (k === '--echo') { a.echo.push(v); i++; } else if (k === '--partie') { a.parties.push(+v); i++; }
    else if (k === '--cuts') { a.cuts = new Set(v.split(',').map(Number)); i++; } else if (k === '--tranche') { a.tranche = v.split('/').map(Number); i++; }
    else if (k === '--etiquette') { a.etiquette = v; i++; } else if (k === '--sortie') { a.sortie = v; i++; } else if (k === '--decisions') { a.decisions.push(v); i++; } else if (k === '--json') { a.json = v; i++; }
    else if (k === '--garde-reelle') a.gardeReelle = true;
    else if (k === '--temoin') { a.temoin = v; i++; } else if (k === '--rl') { a.rl = v; i++; } else if (k === '--verites') { a.verites.push(v); i++; } else if (k === '--ecrire-verites') { a.ecrireVerites = v; i++; }
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
    const obsGarde = new Map(), passeDecal = new Map(), obs = new Map(), r3 = new Map(), r3reel = new Set(), grappe = new Map(), voie = new Map(), passe = new Set();
    for (const e of journal.events) { const id = e.identity; if (!id || id.part !== partie || !Number.isInteger(id.cut)) continue;
      if (e.type === 'gcv1-shadow-observed' && lotsB.has(e.batchId)) { obs.set(id.cut, e); if (e.lotObservation && e.lotObservation.command && e.lotObservation.command.reason === 'garde-apres-differe') obsGarde.set(id.cut, e); }
      else if (e.type === 'garde-apres-differe-ombre' && lotsB.has(e.batchId)) r3.set(id.cut, e);
      else if (e.type === 'garde-apres-differe' && lotsB.has(e.batchId)) r3reel.add(id.cut);
      else if (e.type === 'regles-metier-ombre' && lotsB.has(e.batchId) && e.portee === 'cut') grappe.set(id.cut, e);
      else if (e.type === 'garde-voie-ombre' && lotsB.has(e.batchId)) voie.set(id.cut, e);
      else if (e.type === 'passe-differes-ecriture' && e.resultat === 'ecrit') { passe.add(id.cut); if (e.decal) passeDecal.set(id.cut, e.decal); } }
    const gardeReglee = journal.events.some(e => e.type === 'garde-apres-differe-ombre' && lotsB.has(e.batchId)) ? 'ombre' : journal.events.some(e => e.type === 'garde-apres-differe' && lotsB.has(e.batchId)) ? 'active' : 'inconnue';
    let table = null; const fl = fs.readdirSync(a.lot).filter(n => new RegExp('^ariane-liste-partie' + partie + '-').test(n)).sort().pop();
    if (fl) try { table = LM.decompacter(JSON.parse(fs.readFileSync(path.join(a.lot, fl)))); } catch { table = null; }
    let sansCapture = 0, sansPose = 0;
    /* Garde alors active : la pose que le lot allait valider (`lotObservation.positions` de la décision retenue par la garde), jugée contre la pose finale de
     * l'opérateur. Celle-ci est connue par l'Écho depuis la pose vue à sa première visite : la pose de départ si le cut est resté différé, la pose écrite par la
     * deuxième passe (décalage consigné par `passe-differes-ecriture`) si elle l'a écrit. */
    if (a.gardeReelle) for (const [cut, e] of [...obsGarde].sort((x, y) => x[0] - y[0])) {
      if (a.cuts && !a.cuts.has(cut)) continue;
      const lo = e.lotObservation, P = lo.positions, l = lignes.get(cut);
      if (!P || !SIDES.every(s => Array.isArray(P[s])) || !e.lidarCaptureId) { sansPose++; continue; }
      const eh = l && l.dansEcho && l.referenceHumaine === 'observee' && l.base === 'premiere-visite' && l.ecartHumain && SIDES.every(s => l.ecartHumain[FR[s]] && l.ecartHumain[FR[s]].repere === 'profil') ? l.ecartHumain : null;
      const dp = passeDecal.get(cut) || null, rm = grappe.get(cut);
      travail.set(e.lidarCaptureId, { partie, cut, positions: Object.fromEntries(SIDES.map(s => [s, P[s].slice(0, 3)])), contrefactuel: eh ? { eh, passe: dp } : { eh: null },
        sortie: { format: FORMAT, lot: a.etiquette, partie, cut, contrefactuel: 'garde-reelle', etage: lo.stage ?? null, l1: null, passeEcrite: passe.has(cut), pose: poses.has(cut), dureeS: l ? l.dureeVisiteS ?? null : null,
          gardes: { r3: { signale: true, source: 'active-au-lot' }, grappe: { signale: !!(rm && Array.isArray(rm.regles) && rm.regles.includes('grappe-differes')), source: rm ? 'journal' : 'absente' }, voie: { signale: null, source: 'non-evaluee' } } } });
    }
    for (const cut of a.gardeReelle ? [] : [...poses].sort((x, y) => x - y)) {
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
      const eh = w.ligne && w.ligne.ecartHumain, j = w.sortie.juge || {};
      try {
        if (w.contrefactuel) {
          const k = w.contrefactuel;
          if (k.eh) { verite = {}; for (const s of SIDES) { const b = k.passe ? k.passe[s] : [0, 0, 0]; verite[s] = { lat: b[1] + k.eh[FR[s]].lateralMm, vert: b[2] + k.eh[FR[s]].verticalMm }; }
            const mm = Math.max(...SIDES.map(s => { const p = RL.decalage(capture.rails[s], w.positions[s]); return Math.hypot(p[1] - verite[s].lat, p[2] - verite[s].vert); }));
            w.sortie.juge = { etat: 'contrefactuel', mm: Math.round(mm * 100) / 100, classe: classe(mm), base: k.passe ? 'pose-de-la-passe' : 'pose-de-depart', ecartee: false }; }
          else w.sortie.juge = { etat: 'sans-verite', mm: null, classe: null, ecartee: false };
        }
        else if (j.etat === 'corrige' && eh && SIDES.every(s => eh[FR[s]] && eh[FR[s]].repere === 'profil')) { verite = {}; for (const s of SIDES) { const p = RL.decalage(capture.rails[s], w.positions[s]); verite[s] = { lat: p[1] + eh[FR[s]].lateralMm, vert: p[2] + eh[FR[s]].verticalMm }; } }
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

function juges(a) {
  const J = require('./jointure-echo-orbite.cjs'), Poses = require('./precision-poses.cjs'), JL = require('./juger-lot.cjs'), JF = require('./juge-poses-faux.cjs');
  const journal = Poses.lireJournalDir(a.lot), echo = a.echo.length ? Poses.lireEcho(JL.dossiersEcho(a.echo)) : null, out = [], verites = [];
  for (const partie of a.parties.length ? a.parties : JL.partiesDuJournal(journal)) {
    const run = lotsDe(journal, partie); if (!run) continue;
    const poses = new Set(), cibles = new Set(), lotsB = new Set(run.lots.map(l => l.B)), passe = new Set(), passeDecal = new Map(), lignes = new Map();
    for (const lot of run.lots) { const c = ciblesDe(lot, partie); for (const x of c) cibles.add(x); for (const x of posesDe(lot, c)) poses.add(x); }
    for (const e of journal.events) if (e.type === 'passe-differes-ecriture' && e.resultat === 'ecrit' && lotsB.has(e.batchId) && e.identity && e.identity.part === partie) { passe.add(e.identity.cut); if (e.decal) passeDecal.set(e.identity.cut, e.decal); }
    if (echo) { const { table } = J.joindre(echo.records, journal, { partie, base: 'auto', poses: false, visiteSansActionBonne: true, sessions: echo.sessions || [], pagesPerdues: echo.pagesPerdues || [], capturesParVisite: echo.capturesParVisite || {}, evenementsEcho: echo.evenements || [] });
      for (const l of table) if (l.partie === partie) lignes.set(l.cut, l); }
    for (const cut of [...poses].sort((x, y) => x - y)) { const l = lignes.get(cut), m = etatPose(l), c = JF.etatDe(l, passe.has(cut));
      out.push({ lot: a.etiquette, partie, cut, passeEcrite: passe.has(cut), mien: { etat: m.etat, mm: fini(m.mm) ? Math.round(m.mm * 100) / 100 : null, ecartee: ecartee(m), classe: m.etat === 'controle' ? 'juste' : m.etat === 'corrige' ? classe(m.mm) : null },
        ch100: { etat: c.etat, mm: c.mm ?? null, classe: c.etat === 'valide' ? JF.classeDe(c.mm) : c.etat === 'visite-sans-action' ? 'juste' : null } }); }
    /* Pose finale de l'opérateur d'un cut que l'Écho a trouvé différé (pose de départ) ou écrit par la passe (décalage consigné) : mm depuis la pose de départ. */
    for (const cut of [...cibles].sort((x, y) => x - y)) { const l = lignes.get(cut), dp = passeDecal.get(cut) || null;
      if (poses.has(cut) && !dp) continue;
      if (!l || !l.dansEcho || l.referenceHumaine !== 'observee' || l.base !== 'premiere-visite' || !l.ecartHumain || !SIDES.every(s => l.ecartHumain[FR[s]] && l.ecartHumain[FR[s]].repere === 'profil')) continue;
      const mouv = l.ecartHumain.maxDist3dMm;
      verites.push({ lot: a.etiquette, partie, cut, base: dp ? 'pose-de-la-passe' : 'pose-de-depart', correctionMm: fini(mouv) ? Math.round(mouv * 100) / 100 : null, dureeS: l.dureeVisiteS ?? null,
        veriteMm: Object.fromEntries(SIDES.map(s => { const b = dp ? dp[s] : [0, 0, 0], e = l.ecartHumain[FR[s]]; return [s, [r1(b[1] + e.lateralMm), r1(b[2] + e.verticalMm)]]; })) }); }
  }
  if (a.ecrireVerites) fs.writeFileSync(a.ecrireVerites, verites.map(o => JSON.stringify(o)).join('\n') + (verites.length ? '\n' : ''));
  fs.writeFileSync(a.sortie, out.map(o => JSON.stringify(o)).join('\n') + '\n');
  /* Concordance : mêmes cuts jugés, mêmes classes ? (« 10-50 » de CH-100 = « moyenne » ici.) */
  const cl = c => c === '10-50' ? 'moyenne' : c, mJ = o => (o.mien.etat === 'corrige' || o.mien.etat === 'controle') && !o.mien.ecartee, cJ = o => o.ch100.etat === 'valide' || o.ch100.etat === 'visite-sans-action';
  const des = out.filter(o => mJ(o) !== cJ(o) || (mJ(o) && o.mien.classe !== cl(o.ch100.classe)));
  console.log(JSON.stringify({ etiquette: a.etiquette, poses: out.length, jugesIci: out.filter(mJ).length, jugesCH100: out.filter(cJ).length, fautesIci: out.filter(o => mJ(o) && o.mien.classe === 'faute').length, fautesCH100: out.filter(o => cJ(o) && o.ch100.classe === 'faute').length,
    desaccords: des.map(o => ({ partie: o.partie, cut: o.cut, passeEcrite: o.passeEcrite, mien: o.mien, ch100: o.ch100 })) }));
}
/* ---------- seconde chance (plan M4, M5) : lecture de deux rejeux conjoints du banc ---------- */
const contient = (o, pred) => { if (!o || typeof o !== 'object') return false; if (pred(o)) return true; return Object.values(o).some(v => contient(v, pred)); };
const erreurMm = (decal, v) => decal && v ? Math.round(100 * Math.max(...SIDES.map(s => Math.hypot(decal[s][1] - v[s][0], decal[s][2] - v[s][1])))) / 100 : null;
function secondeChance(a) {
  const lire = f => { const L = fs.readFileSync(f, 'utf8').split('\n').filter(x => x.trim()).map(x => JSON.parse(x)); return { entete: L[0], cuts: new Map(L.slice(1).map(l => [l.cut, l])) }; };
  const T = lire(a.temoin), R = lire(a.rl), partie = Number(String(T.entete.partie).split(':')[1]), P = 'L1-se';
  const V = new Map();
  for (const l of lireDecisions(a.decisions)) if (l.lot === a.etiquette && l.partie === partie && !l.contrefactuel && l.veriteMm && (l.juge.etat === 'corrige' || l.juge.etat === 'controle') && !l.juge.ecartee) V.set(l.cut, { v: l.veriteMm, controle: l.juge.etat === 'controle', source: 'pose' });
  for (const l of lireDecisions(a.verites)) if (l.lot === a.etiquette && l.partie === partie && !V.has(l.cut)) V.set(l.cut, { v: l.veriteMm, controle: false, source: l.base });
  const lignes = [], fid = [], bilan = p => ({ cuts: 0, poses: 0, differes: 0, parPasse: 0, juges: 0, justes: 0, moyennes: 0, fautes: 0, jugesDifferes: 0, sansControle: { juges: 0, justes: 0, moyennes: 0, fautes: 0, jugesDifferes: 0 } });
  const B = { temoin: bilan(), rl: bilan() }, levier = { differesParLevier: 0, reposesPasse: 0, reposesAutre: 0, restes: 0, juges: 0, justes: 0, moyennes: 0, fautes: 0, restesJuges: 0, sansControle: { juges: 0, justes: 0, moyennes: 0, fautes: 0 } }, collateral = { changes: 0, juges: 0, mieux: 0, pire: 0, nouvellesFautes: 0 };
  for (const [cut, t] of [...T.cuts].sort((x, y) => x[0] - y[0])) {
    const r = R.cuts.get(cut); if (!r) continue;
    const pt = t.profils[P] || {}, pr = r.profils[P] || {}, v = V.get(cut), et = pt.etat === 'pose' ? erreurMm(pt.decal, v && v.v) : null, er = pr.etat === 'pose' ? erreurMm(pr.decal, v && v.v) : null;
    /* Différé par le levier à un moment du rejeu : à l'étage de la chaîne (le profil « base » a la même chaîne et en garde la trace quand la passe a reposé le cut
     * ensuite), à la pose de la GCV2 ou à celle de la passe. Un cut qui change sans cela est un effet INDIRECT (ses appuis ou ses voisins ont changé). */
    const parLevier = contient(pr, o => o.rechercheLarge && o.rechercheLarge.etat === 'differer') || contient(r.profils.base || {}, o => o.rechercheLarge && o.rechercheLarge.etat === 'differer');
    for (const [nom, p, e] of [['temoin', pt, et], ['rl', pr, er]]) { const b = B[nom]; b.cuts++; if (p.etat === 'pose') { b.poses++; if (p.passe2) b.parPasse++; } else b.differes++;
      if (v) for (const x of v.controle ? [b] : [b, b.sansControle]) { if (p.etat === 'pose' && e !== null) { x.juges++; x[classe(e) === 'juste' ? 'justes' : classe(e) === 'moyenne' ? 'moyennes' : 'fautes']++; } else x.jugesDifferes++; } }
    /* Fidélité (M5) : le profil « base » du témoin contre la pose réelle du lot, quand les deux posent. */
    const pb = t.profils.base || {};
    if (t.reel && t.reel.pose && t.reel.decal && pb.etat === 'pose' && pb.decal) fid.push(Math.max(...SIDES.map(s => Math.hypot(pb.decal[s][1] - t.reel.decal[s][1], pb.decal[s][2] - t.reel.decal[s][2]))));
    let role = null;
    if (parLevier) { role = 'levier'; levier.differesParLevier++;
      if (pr.etat === 'pose') { if (pr.passe2) levier.reposesPasse++; else levier.reposesAutre++;
        if (er !== null) { const c = classe(er) === 'juste' ? 'justes' : classe(er) === 'moyenne' ? 'moyennes' : 'fautes'; levier.juges++; levier[c]++; if (!v.controle) { levier.sansControle.juges++; levier.sansControle[c]++; } } }
      else { levier.restes++; if (v) levier.restesJuges++; } }
    else if (JSON.stringify([pt.etat, pt.decal || null]) !== JSON.stringify([pr.etat, pr.decal || null])) { role = 'indirect'; collateral.changes++;
      if (v && (et !== null || er !== null)) { collateral.juges++; if (et !== null && er !== null) { if (er < et - 2) collateral.mieux++; else if (er > et + 2) collateral.pire++; } if (er !== null && er > FAUTE_MM && !(et !== null && et > FAUTE_MM)) collateral.nouvellesFautes++; } }
    if (role || v || (pt.passe2 && pt.etat === 'pose') || (pr.passe2 && pr.etat === 'pose')) lignes.push({ lot: a.etiquette, partie, cut, role, reelPose: !!(t.reel && t.reel.pose), verite: v ? v.source : null, controle: v ? v.controle : null,
      temoin: { etat: pt.etat, source: pt.source ?? null, passe: pt.passe2 && pt.etat === 'pose' ? pt.passe2.passe ?? true : null, erreurMm: et }, rl: { etat: pr.etat, source: pr.source ?? null, passe: pr.passe2 && pr.etat === 'pose' ? pr.passe2.passe ?? true : null, motifPasse: pr.passe2 && pr.etat !== 'pose' ? pr.passe2.motif ?? null : null, erreurMm: er } });
  }
  /* Plafond d'écriture de la deuxième passe (D-259 : 10 cuts par lot) : rang de chaque pose de la passe, passe 1 puis passe 2, dans l'ordre des cuts. */
  for (const nom of ['temoin', 'rl']) { const Lp = lignes.filter(l => l[nom].etat === 'pose' && l[nom].passe).sort((x, y) => x[nom].passe - y[nom].passe || x.cut - y.cut); Lp.forEach((l, i) => { l[nom].rangPasse = i + 1; }); B[nom].passeAuDelaDuPlafond = Math.max(0, B[nom].parPasse - 10); }
  fid.sort((x, y) => x - y);
  const q = p => fid.length ? Math.round(100 * fid[Math.min(fid.length - 1, Math.floor(p * fid.length))]) / 100 : null;
  const res = { etiquette: a.etiquette, partie, lot: T.entete.lot, profil: P, verites: V.size, temoin: B.temoin, rl: B.rl, levier, collateral, fidelite: { n: fid.length, medianeMm: q(0.5), p95Mm: q(0.95), maxMm: fid.length ? Math.round(100 * fid[fid.length - 1]) / 100 : null, plusDe2mm: fid.filter(x => x > 2).length } };
  if (a.sortie) fs.writeFileSync(a.sortie, lignes.map(o => JSON.stringify(o)).join('\n') + '\n');
  console.log(JSON.stringify(res));
  return res;
}
function lireDecisions(fichiers) { const L = []; for (const f of fichiers) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l.trim()) L.push(JSON.parse(l)); return L; }
/* Synthèse (plan § 5, M1 à M3). `sansControle` : les lignes « visité sans action » retirées des jugés. Les validations écartées (D-285) ne sont jamais des jugés. */
function synthese(Ltout) {
  const L = Ltout.filter(l => !l.contrefactuel), K = Ltout.filter(l => l.contrefactuel);
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
  /* Poses contrefactuelles (garde alors active, lots des 04 et 05/11) : à part, jamais additionnées aux posés. */
  out.contrefactuels = { n: K.length, juges: K.filter(l => l.juge && l.juge.etat === 'contrefactuel').length, parClasse: {}, cuts: K.filter(l => l.juge && l.juge.etat === 'contrefactuel' && l.juge.classe !== 'juste').map(l => ({ lot: l.lot, partie: l.partie, cut: l.cut, mm: l.juge.mm, classe: l.juge.classe, base: l.juge.base, etage: l.etage, rl: Object.fromEntries(V.map(v => [v, l.rl ? l.rl[v].etat + ':' + l.rl[v].motif : 'erreur'])), meilleureAVeriteMm: l.meilleureAVeriteMm ?? null, paireVerite: l.paireVerite ?? null })) };
  for (const c of ['faute', 'moyenne', 'juste']) { const S = K.filter(l => l.juge && l.juge.classe === c); out.contrefactuels.parClasse[c] = { n: S.length, ...Object.fromEntries(V.map(v => [v, S.filter(l => differe(l, v)).length])) }; }
  out.varianteDuVerdict = VARIANTE_VERDICT;
  return out;
}

module.exports = { FORMAT, REGLE, VARIANTES, VARIANTE_VERDICT, wilson, classe, ecartee, series, couverture, verdict, deciderCut, synthese, lotsDe, ciblesDe, posesDe, etatPose };
if (require.main === module) {
  try {
    const a = lireArgs(process.argv.slice(2));
    if (a.cmd === 'decisions') { if (!a.lot || !a.sortie || !a.etiquette) throw Error('decisions : --lot, --etiquette et --sortie sont requis'); decisions(a); }
    else if (a.cmd === 'juges') { if (!a.lot || !a.sortie || !a.etiquette) throw Error('juges : --lot, --etiquette et --sortie sont requis'); juges(a); }
    else if (a.cmd === 'seconde-chance') { if (!a.temoin || !a.rl || !a.etiquette) throw Error('seconde-chance : --temoin, --rl et --etiquette sont requis'); secondeChance(a); }
    else if (a.cmd === 'synthese') { const s = synthese(lireDecisions(a.decisions)); if (a.json) fs.writeFileSync(a.json, JSON.stringify(s, null, 1)); console.log(JSON.stringify(s, null, 1)); }
    else throw Error('commande inconnue (decisions, juges, seconde-chance, synthese)');
  } catch (e) { console.error(e.stack || e.message); process.exitCode = 1; }
}
