#!/usr/bin/env node
'use strict';
/*
 * p1-plafond.cjs — rejeu hors ligne d'un lot du Pilote, réglage `conventionPlafond` ACTIVÉ contre DÉSACTIVÉ
 * (plan 5.0, P1 ; D-129). Lecture seule : rien n'est écrit ailleurs que la sortie demandée.
 *
 *   node --max-old-space-size=6000 tools/p1-plafond.cjs --lot DOSSIER[=libellé] [--jointure table.json] [--json sortie.json]
 *   node tools/p1-plafond.cjs --fusion sortie-A.json sortie-B.json … [--json total.json]
 *
 * Méthode. `tools/acceptance-report.cjs` sait rejouer la décision sur le lot d'un lot de Pilote (journal, diagnostic GCV1
 * et corpus de nuages) : même ordre, mêmes appuis, mêmes règles que le Pilote qui l'a produit. Le rejeu est fait deux
 * fois, sur les mêmes observations :
 *   - DÉSACTIVÉ : la science GCV1 consignée dans le diagnostic, telle quelle. Contrôle : la décision rejouée retombe sur
 *     la décision consignée par le Pilote (parité) ;
 *   - ACTIVÉ : pour chaque observation où un rail avait un calage de convention refusé, le moteur d'ombre est relancé sur
 *     le nuage du corpus avec le plafond (rail, puis écartement de la paire, tels que le Pilote les aurait publiés), et
 *     la décision sur le lot est rejouée avec ces rails, plafond actif aussi dans la reprise depuis la voie. Contrôle :
 *     le même relancement SANS plafond redonne la science consignée.
 * Les cuts sont comparés un à un sur leur DERNIÈRE observation : posé ou différé, motif, pose. Les cuts dont la décision
 * ou la pose change sont rangés selon qu'ils portent eux-mêmes un rail refusé ou non (ricochet par les appuis).
 *
 * Avec `--jointure` (table de `tools/jointure-echo-orbite.cjs`, qui porte la pose finale de Mic lue à l'Écho), les cuts
 * posés au premier passage et vus par Mic aux deux rails sont jugés : erreur 3D du pire rail à la pose de Mic, avant
 * et après (corrections de plus de 5 et de plus de 10 mm). Cette référence n'entre dans aucun calcul du moteur.
 *
 * Aucune donnée brute n'est écrite : la sortie ne contient que des comptes, des millimètres et des numéros de partie
 * et de cut.
 */
const fs = require('node:fs'), path = require('node:path');
const AR = require('./acceptance-report.cjs');
const P = require('./p0-commun.cjs');
const Shadow = require('../src/gcv1-shadow.js');
const Settings = require('../src/settings.js');
const K = require('../src/core.js');
const Capture = require('../vendor/capture-core.js');

const SIDES = ['left', 'right'];
const APPLYING = new Set(['first-pass', 'window', 'choice', 'crossing']);
const REFUSE = 'shift-out-of-domain';
const { fini, arrondi, quantile } = P;
const TOL = 1e-9;

/* ------------------------------------------------------------------ le réglage, comme le service worker le voit */
function poserReglage(actif) {
  if (actif) globalThis.BananeSettings = { ...Settings, conventionPlafond: true };
  else delete globalThis.BananeSettings;
}
function avecReglage(actif, fn) {
  poserReglage(actif);
  try { return fn(); } finally { poserReglage(false); }
}

/* ------------------------------------------------------------------ petits outils */
const cle = (part, cut) => `${part}|${cut}`;
const railRefuse = o => SIDES.some(s => o && o.rails && o.rails[s] && o.rails[s].scientificRail && o.rails[s].scientificRail.conventionCalibration
  && o.rails[s].scientificRail.conventionCalibration.reason === REFUSE);
const classe = d => !d ? 'aucune' : d.stage === 'deferred' ? 'differe' : APPLYING.has(d.stage) ? 'pose' : d.stage;
function memePositions(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return SIDES.every(s => a[s].every((v, i) => Math.abs(v - b[s][i]) <= TOL));
}
function memeDecision(a, b) { return !!a && !!b && a.stage === b.stage && memePositions(a.positions, b.positions); }
/* Déplacement (mm) de la pose d'un cut entre deux décisions, pire rail. Unités de scène × 1000. */
function deplacementMm(a, b) {
  if (!a || !b || !a.positions || !b.positions) return null;
  return Math.max(...SIDES.map(s => 1000 * Math.hypot(...a.positions[s].map((v, i) => v - b.positions[s][i]))));
}
const mm3 = v => v.map(x => x * 1000);
const distance3 = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

/* ------------------------------------------------------------------ rejeu d'un lot */
function captureDe(o, corpus) {
  const c = corpus.get(o.lidar && o.lidar.captureId);
  if (!c || !c.rails || !c.rails.left || !c.rails.right || !Array.isArray(c.pointsSceneRelative)) return null;
  return { identity: K.completeIdentity(c.identity || o.identity || {}), rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: c.visibleByClipBoxes };
}
const empreinteRail = r => r && r.ok ? JSON.stringify([r.next && r.next.delta, r.next && r.next.rawDelta, r.conventionCalibration && [r.conventionCalibration.applied, r.conventionCalibration.reason, r.conventionCalibration.duMm, r.conventionCalibration.dzMm],
  r.pairGauge && [r.pairGauge.predictedMm, r.pairGauge.rejected]]) : JSON.stringify(r && r.ok);

function rejouerLot(lot, { jointure = null, journal = () => {} } = {}) {
  const ctx = AR.lotCuts(lot.diagnostic, lot.journal, lot.batchFilter || null);
  const toutes = ctx.cuts.flatMap(c => c.observations);
  const regles = AR.lotRules(toutes, ctx.batch && ctx.batch.scope && ctx.batch.scope.extensionVersion || lot.diagnostic && lot.diagnostic.version || lot.journal && lot.journal.version, false);
  const mode = ctx.batch && ctx.batch.scope && ctx.batch.scope.lotDecision === 'apply' ? 'apply' : 'observe';
  const deps = () => ({ validatedKeys: ctx.processed, mode, options: { pairGuard: regles.pairGuard, chainMm: regles.chainMm, gaugeGuardMm: regles.gaugeGuardMm, lowGaugeGuardMm: regles.lowGaugeGuardMm,
    minTop: regles.minTop, anchorRule: regles.anchorRule, crossing: regles.crossing, framed: regles.framed } });
  const corpus = new Map(((lot.corpus && lot.corpus.clouds) || []).map(c => [c.captureId, c]));

  /* 1. Science avec plafond pour chaque observation qui a un rail refusé ; contrôle sans plafond. */
  const controle = { observations: 0, identiques: 0, sansNuage: 0 };
  const sciencePlafond = new Map(), scienceBrute = new Map(), rails = [];
  let n = 0;
  for (const o of toutes) {
    if (o.error || !o.rails || !railRefuse(o)) continue;
    const capture = captureDe(o, corpus);
    if (!capture) { controle.sansNuage++; continue; }
    controle.observations++;
    const sans = avecReglage(false, () => Shadow.scientificProposeBoth(capture));
    const avec = avecReglage(true, () => Shadow.scientificProposeBoth(capture));
    if (SIDES.every(s => empreinteRail(sans.rails[s]) === empreinteRail(o.rails[s].scientificRail))) controle.identiques++;
    sciencePlafond.set(o.observationEventId, avec);
    scienceBrute.set(o.observationEventId, sans);
    for (const s of SIDES) {
      const a = o.rails[s].scientificRail, b = avec.rails[s];
      const cc = b && b.conventionCalibration;
      if (a && a.conventionCalibration && a.conventionCalibration.reason === REFUSE && b && b.ok && b.next && b.next.delta && a.next && a.next.delta)
        rails.push({ plafonne: !!(cc && cc.capped), dzMm: a.conventionCalibration.dzMm, duMm: a.conventionCalibration.duMm, restDzMm: cc && cc.restDzMm, restDuMm: cc && cc.restDuMm,
          deplacementMm: distance3(mm3(a.next.delta), mm3(b.next.delta)) });
    }
    if (++n % 100 === 0) journal(`${lot.label} : ${n} observations relancées`);
  }
  const substituer = o => {
    const sci = sciencePlafond.get(o.observationEventId);
    if (!sci) return o;
    return { ...o, rails: Object.fromEntries(SIDES.map(s => [s, { ...o.rails[s], scientificRail: sci.rails[s] }])), summary: sci.summary };
  };
  const observationsPlafond = toutes.map(substituer);

  /* 2. Les deux rejeux. */
  const decisions = { off: new Map(), on: new Map() };
  for (const x of AR.replayLot(toutes, lot.corpus, deps())) decisions.off.set(x.observationEventId, x.decision);
  avecReglage(true, () => { for (const x of AR.replayLot(observationsPlafond, lot.corpus, deps())) decisions.on.set(x.observationEventId, x.decision); });

  /* 3. Parité du rejeu sans plafond avec la décision consignée par le Pilote. */
  const parite = { comparees: 0, identiques: 0 };
  for (const o of toutes) if (o.lotObservation) { parite.comparees++; if (memeDecision(o.lotObservation, decisions.off.get(o.observationEventId))) parite.identiques++; }

  /* 4. Cut par cut, dernière observation. */
  const cuts = [], refusParCut = new Set(), obsLast = new Map();
  for (const c of ctx.cuts) {
    const o = c.observations.at(-1);
    if (!o) continue;
    obsLast.set(c.key, o);
    if (c.observations.some(railRefuse)) refusParCut.add(c.key);
    const off = decisions.off.get(o.observationEventId) || null, on = decisions.on.get(o.observationEventId) || null;
    cuts.push({ cle: c.key, partie: c.part, cut: c.cut, refuse: refusParCut.has(c.key), refuseDernier: railRefuse(o), off, on });
  }
  const transitions = {}, chg = { poses: [], perdus: [], deplaces: [], stades: [], motifs: [] };
  const comptes = { cuts: cuts.length, off: {}, on: {}, gardePaire: { off: 0, on: 0 }, ecartementRejete: { off: 0, on: 0 } };
  for (const c of cuts) {
    const a = classe(c.off), b = classe(c.on);
    comptes.off[a] = (comptes.off[a] || 0) + 1; comptes.on[b] = (comptes.on[b] || 0) + 1;
    const k = `${a} > ${b}`; transitions[k] = (transitions[k] || 0) + 1;
    if (c.off && c.off.reason === 'pair-guard') comptes.gardePaire.off++;
    if (c.on && c.on.reason === 'pair-guard') comptes.gardePaire.on++;
    const oo = obsLast.get(c.cle);
    if (oo && oo.summary && oo.summary.pairGaugeRejected) comptes.ecartementRejete.off++;
    const sci = sciencePlafond.get(oo && oo.observationEventId);
    if (sci ? sci.summary && sci.summary.pairGaugeRejected : oo && oo.summary && oo.summary.pairGaugeRejected) comptes.ecartementRejete.on++;
    const fiche = { partie: c.partie, cut: c.cut, de: a + (c.off && c.off.stage && a !== 'differe' ? `:${c.off.stage}` : ''), a: b + (c.on && c.on.stage && b !== 'differe' ? `:${c.on.stage}` : ''),
      motifOff: c.off && c.off.reason || null, motifOn: c.on && c.on.reason || null, railRefuse: c.refuse, railRefuseDernier: c.refuseDernier };
    if (a === 'differe' && b === 'pose') chg.poses.push(fiche);
    else if (a === 'pose' && b === 'differe') chg.perdus.push(fiche);
    else if (a === 'pose' && b === 'pose' && !memePositions(c.off.positions, c.on.positions)) chg.deplaces.push({ ...fiche, deplacementMm: arrondi(deplacementMm(c.off, c.on)), memeStade: c.off.stage === c.on.stage });
    else if (a === 'differe' && b === 'differe' && c.off.reason !== c.on.reason) chg.motifs.push(fiche);
    else if (a !== b) chg.stades.push(fiche);
  }
  const part = (liste, f) => liste.filter(f).length;
  const resume = {
    nouveauxPoses: { n: chg.poses.length, avecRailRefuse: part(chg.poses, x => x.railRefuse), sansRailRefuse: part(chg.poses, x => !x.railRefuse), avecRailRefuseDernier: part(chg.poses, x => x.railRefuseDernier) },
    posesPerdus: { n: chg.perdus.length, avecRailRefuse: part(chg.perdus, x => x.railRefuse), sansRailRefuse: part(chg.perdus, x => !x.railRefuse) },
    posesDeplaces: { n: chg.deplaces.length, avecRailRefuse: part(chg.deplaces, x => x.railRefuse), sansRailRefuse: part(chg.deplaces, x => !x.railRefuse),
      deplacementMedianMm: arrondi(quantile(chg.deplaces.map(x => x.deplacementMm), .5)), deplacementMaxMm: chg.deplaces.length ? arrondi(Math.max(...chg.deplaces.map(x => x.deplacementMm))) : null },
    differesMotifChange: chg.motifs.length, autresChangementsDeStade: chg.stades.length,
  };
  const out = {
    format: 'ariane-p1-plafond-v1', etiquette: lot.label, regles: { pairGuard: regles.pairGuard, chainMm: regles.chainMm, gaugeGuardMm: regles.gaugeGuardMm, source: regles.source }, mode,
    observations: toutes.length, controle, parite, comptes, transitions, resume, changements: chg,
    cutsAvecRailRefuse: refusParCut.size,
    rails: { refuses: rails.length, plafonnes: rails.filter(r => r.plafonne).length,
      restDzMm: quantile(rails.filter(r => r.plafonne).map(r => Math.abs(r.restDzMm)), .5) === null ? null : arrondi(quantile(rails.filter(r => r.plafonne).map(r => Math.abs(r.restDzMm)), .5)),
      deplacementMedianMm: arrondi(quantile(rails.map(r => r.deplacementMm), .5)), deplacementMaxMm: rails.length ? arrondi(Math.max(...rails.map(r => r.deplacementMm))) : null },
  };

  /* 5. Jugement à la pose de Mic. Pose d'un cut = positions de sa décision, ramenées au repère profil de la pose de départ
   * (celui de la table de jointure) ; erreur du cut = erreur 3D du pire rail. */
  if (jointure) {
    const table = new Map(jointure.map(t => [cle(t.partie, t.cut), t]));
    const reference = c => { const t = table.get(c.cle); const r = t && SIDES.map(s => P.referenceDepuisTable(t, s)); return r && r.every(Boolean) ? r : null; };
    const erreurCut = (c, d, ref) => {
      const o = obsLast.get(c.cle), cap = o && corpus.get(o.lidar && o.lidar.captureId);
      if (!cap || !d || !d.positions) return null;
      const e = SIDES.map((s, i) => {
        const M = cap.rails[s].sceneRelativeToProfileLocal, q = Capture.point(M, d.positions[s]), o0 = Capture.point(M, cap.rails[s].positionSceneRelative);
        return P.erreurDelta(mm3([q[0] - o0[0], q[1] - o0[1], q[2] - o0[2]]), ref[i]).d3;
      });
      return e.every(fini) ? Math.max(...e) : null;
    };
    const stat = v => ({ n: v.length, medianeMm: arrondi(quantile(v, .5)), p90Mm: arrondi(quantile(v, .9)), plus5: P.compte(v, 5), plus10: P.compte(v, 10) });
    const compare = lignes => {
      const gp = t => lignes.filter(l => l.off <= t && l.on > t).length, gg = t => lignes.filter(l => l.off > t && l.on <= t).length;
      return { cuts: lignes.length, avant: stat(lignes.map(l => l.off)), apres: stat(lignes.map(l => l.on)), gagnes5: gg(5), perdus5: gp(5), gagnes10: gg(10), perdus10: gp(10) };
    };
    const lignes = [], tous = [];
    for (const c of cuts) {
      const ref = reference(c);
      if (!ref || classe(c.off) !== 'pose' || classe(c.on) !== 'pose') continue;
      const off = erreurCut(c, c.off, ref), on = erreurCut(c, c.on, ref);
      if (off === null || on === null) continue;
      const l = { partie: c.partie, cut: c.cut, off, on, railRefuse: c.refuseDernier, stade: c.off.stage };
      tous.push(l);
      if (c.off.stage === 'first-pass' && c.on.stage === 'first-pass') lignes.push(l);
    }
    /* Les cuts posés au premier passage, avant et après : le chiffre de la mesure P0 (partie 17 : 188 cuts, 47 -> 25 au-delà de 10 mm). */
    out.mic = { ...compare(lignes), cutsAvecRailRefuse: lignes.filter(l => l.railRefuse).length,
      lignes: lignes.map(l => ({ partie: l.partie, cut: l.cut, offMm: arrondi(l.off), onMm: arrondi(l.on), railRefuse: l.railRefuse })) };
    /* Tous les cuts posés des deux côtés (tous étages), quand Mic les a vus aux deux rails. */
    out.mic.tousEtages = compare(tous);
    /* Cuts posés en plus ou en moins, jugés quand la pose de Mic existe. */
    const jug = (liste, cote) => {
      const r = liste.map(f => { const c = cuts.find(x => x.cle === cle(f.partie, f.cut)); const ref = reference(c); return { partie: f.partie, cut: f.cut, stade: f.a, erreurMm: ref ? arrondi(erreurCut(c, cote === 'on' ? c.on : c.off, ref)) : null }; });
      const j = r.filter(x => x.erreurMm !== null);
      return { n: r.length, jugeables: j.length, plus5: j.filter(x => x.erreurMm > 5).length, plus10: j.filter(x => x.erreurMm > 10).length, liste: r };
    };
    out.mic.nouveauxPoses = jug(chg.poses, 'on');
    out.mic.posesPerdus = jug(chg.perdus, 'off');
  }
  return out;
}

/* ------------------------------------------------------------------ somme de plusieurs lots */
function ajouter(a, b) { for (const [k, v] of Object.entries(b)) a[k] = (a[k] || 0) + v; return a; }
function fusion(sorties) {
  const t = { format: 'ariane-p1-plafond-total-v1', lots: sorties.map(s => s.etiquette), cuts: 0, off: {}, on: {}, transitions: {}, gardePaire: { off: 0, on: 0 }, ecartementRejete: { off: 0, on: 0 },
    parite: { comparees: 0, identiques: 0 }, controle: { observations: 0, identiques: 0, sansNuage: 0 }, cutsAvecRailRefuse: 0,
    resume: { nouveauxPoses: { n: 0, avecRailRefuse: 0, sansRailRefuse: 0 }, posesPerdus: { n: 0, avecRailRefuse: 0, sansRailRefuse: 0 }, posesDeplaces: { n: 0, avecRailRefuse: 0, sansRailRefuse: 0 }, differesMotifChange: 0, autresChangementsDeStade: 0 },
    rails: { refuses: 0, plafonnes: 0 } };
  for (const s of sorties) {
    t.cuts += s.comptes.cuts; ajouter(t.off, s.comptes.off); ajouter(t.on, s.comptes.on); ajouter(t.transitions, s.transitions);
    ajouter(t.gardePaire, s.comptes.gardePaire); ajouter(t.ecartementRejete, s.comptes.ecartementRejete); ajouter(t.parite, s.parite); ajouter(t.controle, s.controle);
    t.cutsAvecRailRefuse += s.cutsAvecRailRefuse;
    for (const k of ['nouveauxPoses', 'posesPerdus', 'posesDeplaces']) for (const f of ['n', 'avecRailRefuse', 'sansRailRefuse']) t.resume[k][f] += s.resume[k][f];
    t.resume.differesMotifChange += s.resume.differesMotifChange; t.resume.autresChangementsDeStade += s.resume.autresChangementsDeStade;
    t.rails.refuses += s.rails.refuses; t.rails.plafonnes += s.rails.plafonnes;
  }
  return t;
}

/* ------------------------------------------------------------------ texte */
function ligneComptes(c) { return Object.entries(c).sort().map(([k, v]) => `${k} ${v}`).join(', '); }
function texte(s) {
  const L = [];
  const titre = s.etiquette || `total (${(s.lots || []).join(', ')})`;
  L.push(`== ${titre}`);
  const c = s.comptes || { cuts: s.cuts, off: s.off, on: s.on, gardePaire: s.gardePaire, ecartementRejete: s.ecartementRejete };
  L.push(`cuts ${c.cuts} (dont ${s.cutsAvecRailRefuse} avec un rail refusé) ; parité du rejeu sans plafond avec le Pilote : ${s.parite.identiques}/${s.parite.comparees} ; relancement sans plafond = science consignée : ${s.controle.identiques}/${s.controle.observations}`);
  L.push(`désactivé : ${ligneComptes(c.off)}`);
  L.push(`activé    : ${ligneComptes(c.on)}`);
  L.push(`garde de paire (différés pair-guard) : ${c.gardePaire.off} -> ${c.gardePaire.on} ; écartement refusé (dernière observation) : ${c.ecartementRejete.off} -> ${c.ecartementRejete.on}`);
  L.push(`transitions : ${ligneComptes(s.transitions)}`);
  const r = s.resume;
  L.push(`nouveaux posés ${r.nouveauxPoses.n} (rail refusé ${r.nouveauxPoses.avecRailRefuse}, sans ${r.nouveauxPoses.sansRailRefuse}) ; posés perdus ${r.posesPerdus.n} (rail refusé ${r.posesPerdus.avecRailRefuse}, sans ${r.posesPerdus.sansRailRefuse}) ; posés déplacés ${r.posesDeplaces.n} (rail refusé ${r.posesDeplaces.avecRailRefuse}, sans ${r.posesDeplaces.sansRailRefuse}) ; différés au motif changé ${r.differesMotifChange} ; autres ${r.autresChangementsDeStade}`);
  if (s.rails) L.push(`rails refusés ${s.rails.refuses}, plafonnés ${s.rails.plafonnes}` + (s.rails.deplacementMedianMm != null ? ` ; déplacement médian ${s.rails.deplacementMedianMm} mm, maximum ${s.rails.deplacementMaxMm} mm` : ''));
  if (s.mic) {
    const m = s.mic;
    L.push(`pose de Mic, cuts posés au premier passage vus aux deux rails : ${m.cuts} ; > 5 mm ${m.avant.plus5} -> ${m.apres.plus5} ; > 10 mm ${m.avant.plus10} -> ${m.apres.plus10} (gagnés ${m.gagnes10}, perdus ${m.perdus10}) ; médiane ${m.avant.medianeMm} -> ${m.apres.medianeMm} mm ; P90 ${m.avant.p90Mm} -> ${m.apres.p90Mm} mm`);
    if (m.tousEtages) L.push(`tous étages (posés des deux côtés) : ${m.tousEtages.cuts} ; > 5 mm ${m.tousEtages.avant.plus5} -> ${m.tousEtages.apres.plus5} ; > 10 mm ${m.tousEtages.avant.plus10} -> ${m.tousEtages.apres.plus10} (gagnés ${m.tousEtages.gagnes10}, perdus ${m.tousEtages.perdus10})`);
    if (m.nouveauxPoses) L.push(`posés en plus jugeables : ${m.nouveauxPoses.jugeables}/${m.nouveauxPoses.n}, à plus de 10 mm : ${m.nouveauxPoses.plus10} ; posés en moins jugeables : ${m.posesPerdus.jugeables}/${m.posesPerdus.n}`);
  }
  return L.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
function lireArgs(argv) {
  const o = { lots: [], jointure: null, json: null, fusion: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lot') { const [d, l] = argv[++i].split('='); o.lots.push({ dir: d, label: l || path.basename(d) }); }
    else if (a === '--jointure') o.jointure = argv[++i];
    else if (a === '--json') o.json = argv[++i];
    else if (a === '--fusion') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) o.fusion.push(argv[++i]); }
    else throw Error('Argument inconnu : ' + a);
  }
  return o;
}
function main() {
  const o = lireArgs(process.argv.slice(2));
  if (o.fusion.length) {
    const sorties = o.fusion.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
    const t = fusion(sorties);
    for (const s of sorties) console.log(texte(s) + '\n');
    console.log(texte(t));
    if (o.json) fs.writeFileSync(o.json, JSON.stringify(t, null, 1));
    return;
  }
  if (!o.lots.length) { console.error('Usage : node tools/p1-plafond.cjs --lot DOSSIER[=libellé] [--jointure table.json] [--json sortie.json] | --fusion A.json B.json …'); process.exit(1); }
  const jointure = o.jointure ? JSON.parse(fs.readFileSync(o.jointure, 'utf8')).table : null;
  const sorties = [];
  for (const l of o.lots) {
    const t0 = Date.now();
    const lot = AR.loadLot(l.dir, l.label);
    const s = rejouerLot(lot, { jointure, journal: m => console.error(m) });
    console.error(`${l.label} : ${Math.round((Date.now() - t0) / 1000)} s`);
    console.log(texte(s));
    sorties.push(s);
  }
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(sorties.length === 1 ? sorties[0] : sorties, null, 1));
}
if (require.main === module) try { main(); } catch (e) { console.error(e.stack || e.message); process.exit(1); }

module.exports = { rejouerLot, fusion, texte, classe, memePositions, memeDecision, railRefuse, avecReglage, lireArgs };
