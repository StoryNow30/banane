#!/usr/bin/env node
'use strict';
/*
 * CH-042 : table par cut POSÉ et JUGÉ d'un couple lot + vérité (Écho joint, ou vérité scellée de la garde GCV2). Lecture seule.
 *   node extraire-table.cjs --nom ETIQUETTE --partie N --lot <dossier d'archives> [--lot …] (--echo <dossier> [--echo …] | --verite V.json) --sortie T.jsonl
 * Définitions de tools/juger-lot.cjs (cible, posé, jugé, geste) recopiées sans les modifier (fonctions non exportées).
 * Chaque ligne : le cut, son geste, l'ERREUR SIGNÉE de la pose du lot (vérité − pose, mm, repère profil de la pose de départ d'ESV :
 * [longitudinal, latéral, vertical] par rail), le déplacement de la pose depuis le départ, et les signaux consignés par la décision du lot
 * (étage, appuis, candidats, hauteur apprise, faux vert, écartement). La sortie porte des numéros de cut : elle reste HORS du dépôt.
 */
const fs = require('node:fs'), path = require('node:path');
const R = path.join(__dirname, '..', '..', '..', 'tools') + path.sep;
const J = require(R + 'jointure-echo-orbite.cjs');
const Poses = require(R + 'precision-poses.cjs');
const JL = require(R + 'juger-lot.cjs');
const V = require(R + 'lire-volumes.cjs');
const C = require(path.join(__dirname, '..', '..', '..', 'vendor', 'capture-core.js'));
const EL = require(path.join(__dirname, '..', '..', '..', 'src', 'gcv2-l1e.js'));
const LM = require(path.join(__dirname, '..', '..', '..', 'src', 'liste-memoire.js'));

const a = { lot: [], echo: [] }; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i += 2) { const k = av[i].replace(/^--/, ''); if (k === 'lot' || k === 'echo') a[k].push(av[i + 1]); else a[k] = av[i + 1]; }
const partie = Number(a.partie);
const fini = v => Number.isFinite(v);
const instant = e => { const t = Date.parse(e && e.timestamp || ''); return fini(t) ? t : null; };
const DEPART_VERT_S = 30, FIN_APRES_ARRET_S = 5;

/* --- copie conforme de juger-lot (lotsDe, ciblesDe, posesDe) --- */
function lotsDe(journal) {
  const ev = journal.events.filter(e => instant(e) !== null).sort((x, y) => instant(x) - instant(y));
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
    const arret = ev.find(e => e.type === 'batch-stopped-at-end' && instant(e) > t0);
    if (arret) fin = Math.min(fin, instant(arret) + FIN_APRES_ARRET_S * 1000);
    else { const rel = ev.find(e => e.type === 'relecture-debut' && e.batchId === B); if (rel) fin = Math.min(fin, instant(rel)); }
    return { ev, B, t0, fin, cutDepart: mien.identity && Number.isInteger(mien.identity.cut) ? mien.identity.cut : null };
  });
  return { ev, lots, B: lots[lots.length - 1].B, t0: lots[0].t0 };
}
function ciblesDe(lot) {
  const cibles = new Set();
  for (const e of lot.ev) if (e.type === 'gcv1-shadow-observed' && e.batchId === lot.B && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut)) cibles.add(e.identity.cut);
  for (const e of lot.ev) {
    if (e.type === 'capture-abandoned' && e.reason === 'depart-sur-vert' && e.identity && e.identity.part === partie && instant(e) >= lot.t0 && instant(e) <= lot.t0 + DEPART_VERT_S * 1000) cibles.delete(e.identity.cut);
    if (e.type === 'batch-stopped-at-end' && e.reason === 'depart-sur-vert' && lot.cutDepart !== null && instant(e) >= lot.t0 && instant(e) <= lot.t0 + DEPART_VERT_S * 1000) cibles.delete(lot.cutDepart);
  }
  return cibles;
}
function posesDe(lot, cibles, tPose) {
  const poses = new Set();
  for (const e of lot.ev) {
    if (e.type !== 'esv-observation' || e.kind !== 'write') continue;
    const t = instant(e); if (t < lot.t0 || t >= lot.fin) continue;
    const ok = Number.isInteger(e.status) && e.status >= 200 && e.status < 300;
    const valide = e.body && e.body.ExtractionStatus === 'valid' && e.body.TreatedByOperator === true;
    if (ok && valide && cibles.has(e.rowIndex)) { poses.add(e.rowIndex); if (!tPose.has(e.rowIndex)) tPose.set(e.rowIndex, t); }
  }
  return poses;
}
function etatPose(l) {
  if (!l || !l.dansEcho) return { etat: 'sans-echo' };
  if (l.referenceHumaine !== 'observee') return { etat: 'non-juge' };
  if (l.regleVisiteBon) return { etat: 'controle', mm: 0, err: { left: [0, 0, 0], right: [0, 0, 0] } };
  if (typeof l.base !== 'string' || !l.base.startsWith('ariane')) return { etat: 'repere' };
  const mm = l.ecartHumain && l.ecartHumain.maxDist3dMm;
  if (!fini(mm)) return { etat: 'non-juge' };
  const g = l.ecartHumain.gauche, d = l.ecartHumain.droite;
  if (!g || !d || g.repere !== 'profil' || d.repere !== 'profil') return { etat: 'non-juge' };
  return { etat: 'corrige', mm, err: { left: [g.longitudinalMm, g.lateralMm, g.verticalMm], right: [d.longitudinalMm, d.lateralMm, d.verticalMm] } };
}
const r2 = v => fini(v) ? Math.round(v * 100) / 100 : null;

/* --- lecture --- */
let journal = null, liste = null;
for (const d of a.lot) { const j = Poses.lireJournalDir(d); if (!journal) journal = j; else { journal.events.push(...j.events); journal.records.push(...(j.records || [])); }
  /* Instantané de la liste d'ESV de la partie (référence d'écartement des lignes valides non touchées, comme L1-e) : le plus récent. */
  for (const e of V.entrees(d)) if (new RegExp('^ariane-liste-partie' + partie + '-').test(e.nom)) { try { const snap = JSON.parse(e.lire()); if (!liste || String(snap.at) > String(liste.at)) liste = snap; } catch {} }
}
const table = liste ? LM.decompacter(liste) : null;
const refListe = cut => { const r = table ? EL.referenceEcartement(table, cut) : null; return r ? { mm: r.mm, n: r.n, distMax: r.distMax } : null; };
/* Écartement (mm) de deux positions de scène ; point de scène d'un décalage [long, lat, vert] (mm) dans le repère profil du rail de départ. */
const ecart = (p, q) => p && q ? 1000 * Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) : null;
const depuisDecal = (rail, d) => { const o = C.point(rail.sceneRelativeToProfileLocal, rail.positionSceneRelative); return C.point(rail.profileLocalToSceneRelative, [o[0] + d[0] / 1000, o[1] + d[1] / 1000, o[2] + d[2] / 1000]); };
/* Sens de l'axe latéral du repère profil de chaque rail par rapport à l'écartement : +1 si un décalage latéral positif ÉLARGIT la paire. */
const sensLat = (rails) => { const out = {}; for (const s of ['left', 'right']) { const o = s === 'left' ? 'right' : 'left'; const p0 = depuisDecal(rails[s], [0, 0, 0]), p1 = depuisDecal(rails[s], [0, 1, 0]); out[s] = ecart(p1, rails[o].positionSceneRelative) > ecart(p0, rails[o].positionSceneRelative) ? 1 : -1; } return out; };
const run = lotsDe(journal);
if (!run) { console.error(`${a.nom} : aucun lot de la partie ${partie}`); process.exit(1); }
const tPose = new Map(), cibles = new Set(), poses = new Set();
for (const lot of run.lots) { const c = ciblesDe(lot); for (const x of c) cibles.add(x); for (const x of posesDe(lot, c, tPose)) poses.add(x); }
const batchs = new Set(run.lots.map(l => l.B));
/* Dernière décision du lot pour chaque cut (dans la fenêtre du lot). */
const decisions = new Map(), releves = new Map();
for (const e of run.ev) {
  if (e.type === 'gcv1-shadow-observed' && batchs.has(e.batchId) && e.identity && e.identity.part === partie && e.lotObservation) decisions.set(e.identity.cut, e);
  if (e.type === 'regles-metier-ombre' && e.identity && e.identity.part === partie && instant(e) >= run.t0) releves.set(e.identity.cut, e);
}
const jr = J.journalParCut(journal);
const ligneDe = cut => jr.get(`${partie}|${cut}`) || null;

/* Vérité : Écho joint, ou vérité scellée (mic depuis le départ). */
let lignes = new Map(), verite = null;
if (a.echo.length) {
  const echo = Poses.lireEcho(JL.dossiersEcho(a.echo));
  const { table } = J.joindre(echo.records, journal, { partie, base: 'auto', poses: true, visiteSansActionBonne: true, sessions: echo.sessions || [],
    pagesPerdues: echo.pagesPerdues || [], capturesParVisite: echo.capturesParVisite || {}, evenementsEcho: echo.evenements || [] });
  for (const l of table) if (l.partie === partie) lignes.set(l.cut, l);
} else if (a.verite) verite = JSON.parse(fs.readFileSync(a.verite, 'utf8'));
else { console.error('--echo ou --verite'); process.exit(1); }

const out = [];
let n = { poses: poses.size, juges: 0, controles: 0, sansDecision: 0, sansDeplacement: 0 };
for (const cut of [...poses].sort((x, y) => x - y)) {
  const jc = ligneDe(cut), pa = J.poseAriane(jc);
  const dep = pa && pa.initial.left && pa.initial.right ? { left: J.ecartRail(pa.initial.left, pa.posee.left), right: J.ecartRail(pa.initial.right, pa.posee.right) } : null;
  const depOk = dep && dep.left && dep.right && dep.left.repere === 'profil' && dep.right.repere === 'profil';
  const deplacement = depOk ? { left: [dep.left.longitudinalMm, dep.left.lateralMm, dep.left.verticalMm], right: [dep.right.longitudinalMm, dep.right.lateralMm, dep.right.verticalMm] } : null;
  if (!deplacement) n.sansDeplacement++;
  let et;
  if (verite) {
    const v = verite[cut];
    if (!v || !v.mic) et = { etat: 'sans-echo' };
    else if (!deplacement) et = { etat: 'non-juge' };
    else {
      const err = { left: [0, 1, 2].map(i => v.mic.left[i] - deplacement.left[i]), right: [0, 1, 2].map(i => v.mic.right[i] - deplacement.right[i]) };
      const mm = Math.max(Math.hypot(...err.left), Math.hypot(...err.right));
      const controle = mm < 0.05 && v.src !== 'echo-pose-reelle' ? false : false;
      et = { etat: 'corrige', mm, err, src: v.src };
    }
  } else et = etatPose(lignes.get(cut));
  const e = decisions.get(cut), o = e && e.lotObservation;
  if (!o) n.sansDecision++;
  /* Écartements : départ (pose d'ESV), pose du lot, vérité ; sens de l'axe latéral de chaque rail. */
  let gauges = null, sens = null, scene = null;
  if (pa && pa.initial.left && pa.initial.right && pa.initial.left.sceneRelativeToProfileLocal && pa.initial.right.sceneRelativeToProfileLocal) {
    const I = pa.initial, P = pa.posee;
    gauges = { depart: ecart(I.left.positionSceneRelative, I.right.positionSceneRelative), pose: ecart(P.left.positionSceneRelative, P.right.positionSceneRelative), verite: null };
    try { sens = sensLat(I); } catch { sens = null; }
    if (verite && verite[cut] && verite[cut].mic) { try { gauges.verite = ecart(depuisDecal(I.left, verite[cut].mic.left), depuisDecal(I.right, verite[cut].mic.right)); } catch {} }
    else { const lg = lignes.get(cut), h = lg && lg.poseHumaineFinale; if (h && h.gauche && h.droite) gauges.verite = ecart([h.gauche.x, h.gauche.y, h.gauche.z], [h.droite.x, h.droite.y, h.droite.z]); else if (et.etat === 'controle') gauges.verite = gauges.pose; }
    for (const k in gauges) gauges[k] = r2(gauges[k]);
    /* Positions de scène (mm) du départ, de la pose et de la vérité (vérité = départ + déplacement + erreur, repère profil du départ). */
    try {
      const mm3 = p => p.map(v => Math.round(v * 1000 * 100) / 100);
      scene = { depart: { left: mm3(I.left.positionSceneRelative), right: mm3(I.right.positionSceneRelative) }, pose: { left: mm3(P.left.positionSceneRelative), right: mm3(P.right.positionSceneRelative) }, verite: null };
      if (et.err && deplacement) scene.verite = Object.fromEntries(['left', 'right'].map(s => [s, mm3(depuisDecal(I[s], [0, 1, 2].map(i => deplacement[s][i] + et.err[s][i])))]));
    } catch { scene = null; }
  }
  /* Voisinage dans la liste d'ESV (lignes à ±40 cuts) : [écart d'indice, statut, drapeaux, six bords en mm (monde)] ; seules les lignes complètes. */
  let voisinage = null;
  if (table) {
    voisinage = [];
    for (let i = Math.max(0, cut - 40); i <= Math.min(table.n - 1, cut + 40); i++) {
      const e = table.ed.slice(6 * i, 6 * i + 6);
      if (e.length < 6 || !e.every(fini)) continue;
      voisinage.push([i - cut, table.st[i], table.fl[i], ...e.map(v => Math.round(v * 10) / 100)]);
    }
  }
  const geste = et.etat === 'controle' ? 'acceptation' : et.etat === 'corrige' ? JL.geste(et.mm, false) : null;
  if (geste) { n.juges++; if (geste === 'acceptation') n.controles++; }
  const rm = releves.get(cut);
  const ha = o && o.hauteurApprise, fv = o && o.fauxVertOmbre;
  const sig = s => ({
    groupe: ha ? ha.rails[s].groupe : null, calage: fv ? fv.rails[s].calage : (ha ? ha.rails[s].calage : null),
    dzMm: fv ? fv.rails[s].dzMm : (ha ? ha.rails[s].dzMm : null), epaisseurMm: fv ? fv.rails[s].epaisseurDessusMm : (ha ? ha.rails[s].epaisseurDessusMm : null),
    pointsDessus: fv ? fv.rails[s].pointsDessus : (ha ? ha.rails[s].pointsDessus : null), pointsFlanc: fv ? fv.rails[s].pointsFlanc : null,
    haMm: ha ? ha.rails[s].correctionMm : null, haAbstention: ha ? ha.rails[s].abstention : null,
    cand: o && o.candidates && o.candidates[s] ? o.candidates[s].slice(0, 6).map(c => [c.uMm, c.zMm, c.loss, c.top, c.face]) : null,
    chosen: o && o.chosen && o.chosen[s] ? { fromPredictionMm: o.chosen[s].fromPredictionMm, rank: o.chosen[s].rank, top: o.chosen[s].top, face: o.chosen[s].face, lossRatio: o.chosen[s].lossRatio } : null,
  });
  out.push({ nom: a.nom, partie, cut, rang: tPose.has(cut) ? tPose.get(cut) - run.t0 : null, etat: et.etat, geste, mm: r2(et.mm), src: et.src || null,
    err: et.err ? { left: et.err.left.map(r2), right: et.err.right.map(r2) } : null, deplacement: deplacement ? { left: deplacement.left.map(r2), right: deplacement.right.map(r2) } : null,
    etage: o ? o.stage : null, commande: o && o.command ? o.command.action + ':' + (o.command.reason || '') : null, appuis: o && o.anchorsUsed ? o.anchorsUsed.length : null,
    appuiDistance: o && o.anchorsUsed && o.anchorsUsed.length ? Math.min(...o.anchorsUsed.map(x => Math.abs(x - cut))) : null,
    appui: o ? o.anchor : null, gaugeMm: o ? o.gaugeMm : null, gaugeRefMm: o && o.gaugeReference ? o.gaugeReference.mm : null, flushPct: o ? o.flushPct : null,
    pn: o && o.levelCrossing ? !!o.levelCrossing.read : null, l1: o && o.l1 ? { etat: o.l1.etat, hypothese: o.l1.hypothese || null, p: o.l1.p ?? null } : null,
    zone: rm ? (rm.zone || rm.regles || null) : null, gauges, sensLat: sens, refListe: refListe(cut), captureId: e ? e.lidarCaptureId || null : null, scene, voisinage, engineMs: o ? o.engineMs : null, version: journal.version || null,
    rails: { left: sig('left'), right: sig('right') } });
}
fs.writeFileSync(a.sortie, out.map(x => JSON.stringify(x)).join('\n') + '\n');
console.log(`${a.nom} partie ${partie} : cibles ${cibles.size}, posés ${n.poses}, jugés ${n.juges} (acceptations ${n.controles}), sans décision ${n.sansDecision}, sans déplacement ${n.sansDeplacement}`);
