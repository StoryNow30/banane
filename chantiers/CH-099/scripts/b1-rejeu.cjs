#!/usr/bin/env node
'use strict';
/*
 * b1-rejeu.cjs — CH-099, étude HORS LIGNE. Rejeu de la règle en ombre « B1-écart » (src/voie-b1-ecart.js, `evaluer`) :
 *   étape 1 (fidélité)     : sur les cuts RÉELLEMENT différés qui ont un événement `voie-b1-ecart-ombre` sans `passe`, comparé à l'événement ;
 *   étape 2 (contrefactuel) : sur les cuts de cuts-s60.json (posés en réalité), comme s'ils avaient été différés ; V1 = appuis sans les
 *                             contrefactuels, V2 = appuis réels tels quels.
 * Rien n'est écrit dans le dépôt ; les sorties ne portent ni identifiant ni coordonnée (numéros de cut, millimètres, comptes).
 *
 *   node --max-old-space-size=4096 b1-rejeu.cjs [--science journal|recalcul] [--table debut|fin] [--sortie DOSSIER] [--seulement CLE]
 *
 * Reconstruction de l'appel du service worker (background.js : b1EcartNoter, b1EcartPlanifier, b1EcartEvaluer) :
 *   capture    : nuage du corpus dont `captureId` = `lidarCaptureId` de la décision (`gcv1-shadow-observed`) ; identité = celle de l'événement ;
 *   science    : `shadow.rails` et `shadow.summary` de l'événement de décision (ce que le service worker avait), ou recalculée (`--science recalcul`) ;
 *   appuis     : rejeu de `holdAnchor` / `promoteAnchors` : décisions précédentes du lot à `anchorHeld:true`, positions `lotObservation.positions`,
 *                promues quand `validation-accepted` du cut précède la décision courante ; 40 au plus ;
 *   table      : l'instantané exporté (fin de lot) ramené à l'état du DÉBUT du lot (le service worker lit l'instantané une fois par lot,
 *                `l1eTable`) : toute ligne écrite (écriture observée `ExtractionStatus`) depuis le début du lot reprend son état d'avant ;
 *   mémoire    : une par lot (`creerMemoire`), dans l'ordre des décisions ;
 *   réglage    : `seuils` consignés par le premier événement du lot (sinon `lot.voieB1EcartOmbre` de src/settings.js).
 */
const fs = require('node:fs'), path = require('node:path');
const REPO = path.resolve(__dirname, '..', '..', '..');
const M = require(REPO + '/src/voie-b1-ecart.js');
const L = require(REPO + '/src/lot-decision.js');
const Sh = require(REPO + '/src/gcv1-shadow.js');
const LM = require(REPO + '/src/liste-memoire.js');
const SETTINGS = require(REPO + '/src/settings.js');
const V = require(REPO + '/src/voie-recentree.js');

const ICI = __dirname;
const arg = (nom, def) => { const i = process.argv.indexOf('--' + nom); return i >= 0 ? process.argv[i + 1] : def; };
const SCIENCE = arg('science', 'journal'), TABLE = arg('table', 'debut'), SORTIE = arg('sortie', ICI), SEULEMENT = arg('seulement', null);
const SIDES = ['left', 'right'];
const t = e => Date.parse(e && e.timestamp || '');
const fini = Number.isFinite;
const copie = x => x == null ? x : JSON.parse(JSON.stringify(x));
const med = a => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = v => fini(v) ? Math.round(v * 100) / 100 : null;
const memeListe = (a, b) => JSON.stringify(a || []) === JSON.stringify(b || []);

/* Écart de pose (mm) entre deux `poseMm` : maximum des composantes, deux rails. */
function ecartPose(a, b) {
  if (!a || !b) return null;
  let m = 0;
  for (const s of SIDES) for (let i = 0; i < 3; i++) m = Math.max(m, Math.abs((a[s][i] ?? 0) - (b[s][i] ?? 0)));
  return m;
}
const resume = ev => ({ posable: !!(ev.verdict && ev.verdict.posable), source: ev.source ?? null, etage: ev.etage ?? null,
  raison: ev.etat === 'erreur' ? 'erreur:' + String(ev.message || '').slice(0, 80) : ev.verdict && ev.verdict.posable ? ev.raison ?? null : ev.verdict ? ev.verdict.raison : null, poseMm: ev.poseMm ?? null });

/* ------------------------------------------------------------------ nuages (un segment à la fois) */
function chargerCaptures(dossier, ids) {
  const voulu = new Set(ids), out = new Map();
  const segs = fs.readdirSync(dossier).filter(f => /^ariane-gcv1-corpus-.*-seg\d+\.json$/.test(f)).sort();
  for (const f of segs) {
    if (out.size === voulu.size) break;
    let doc = JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8'));
    for (const c of doc.clouds || []) if (c && voulu.has(c.captureId) && c.rails && Array.isArray(c.pointsSceneRelative))
      out.set(c.captureId, { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: c.visibleByClipBoxes, allege: c.exportLightening ?? null });
    doc = null;
  }
  return out;
}

/* ------------------------------------------------------------------ table de la liste à l'état du début d'un lot */
/* `ecritures` : écritures de validation observées de la liste de la partie ({ row, at, ed (dixièmes de mm) }), triées par heure. Rend une copie de
 * `fin` où chaque ligne écrite à partir de `depuis` reprend son état d'avant : la dernière écriture antérieure, sinon « invalide », bords inchangés
 * (la pose de départ y est remise à part, par `remettreDepart`). */
function tableAu(fin, ecritures, depuis) {
  const tab = { ...fin, st: fin.st.slice(), fl: fin.fl.slice(), ed: fin.ed.slice() }, revenues = new Set();
  const parLigne = new Map();
  for (const w of ecritures) { if (!parLigne.has(w.row)) parLigne.set(w.row, []); parLigne.get(w.row).push(w); }
  for (const [row, ws] of parLigne) {
    if (!ws.some(w => w.at >= depuis && w.at <= fin.atMs)) continue;
    const avant = ws.filter(w => w.at < depuis).pop();
    if (avant) { tab.st[row] = 0; for (let k = 0; k < 6; k++) tab.ed[6 * row + k] = avant.ed[k]; }
    else { tab.st[row] = 1; revenues.add(row); }
  }
  return { tab, revenues };
}
/* Remet la pose de départ (scène → monde, au dixième de mm) sur la ligne `cut`. */
function remettreDepart(tab, cut, rails, T) {
  const e = [...rails.left.positionSceneRelative.slice(0, 3).map((v, i) => v + T[i]), ...rails.right.positionSceneRelative.slice(0, 3).map((v, i) => v + T[i])];
  for (let k = 0; k < 6; k++) tab.ed[6 * cut + k] = Math.round(e[k] * 1e4);
}

/* ------------------------------------------------------------------ un jour (un dossier de lot) */
function traiter(cle, dossier, parties, lignes, bilan) {
  const fj = fs.readdirSync(dossier).find(f => f.startsWith('ariane-journal-v4'));
  let journal = JSON.parse(fs.readFileSync(path.join(dossier, fj), 'utf8'));
  const ev = journal.events.filter(e => e && fini(t(e))).sort((a, b) => t(a) - t(b));
  const records = journal.records || [];
  journal = null;
  const lotsTous = ev.filter(e => e.type === 'batch-started' && e.batch && e.batch.id).map(e => ({ id: e.batch.id, debut: t(e), partie: e.batch.scope ? e.batch.scope.part : null, profil: e.batch.scope ? e.batch.scope.lotProfil ?? null : null, reprise: !!(e.batch.scope && e.batch.scope.lotReprise) }));

  for (const [pTxt, cutsCF] of Object.entries(parties)) {
    const partie = Number(pTxt), CF = new Set(cutsCF), lots = lotsTous.filter(l => l.partie === partie);
    /* --- liste de fin de lot et écritures observées de cette liste */
    const fl = fs.readdirSync(dossier).filter(f => f.startsWith(`ariane-liste-partie${partie}-`)).sort().pop();
    const snap = JSON.parse(fs.readFileSync(path.join(dossier, fl), 'utf8')), fin = LM.decompacter(snap);
    fin.atMs = Date.parse(snap.at);
    const idsLots = new Set(lots.map(l => l.id));
    const ecrituresToutes = ev.filter(e => e.type === 'esv-observation' && e.kind === 'write' && e.status >= 200 && e.status < 300 && Number.isInteger(e.rowIndex) && e.body && typeof e.body.ExtractionStatus === 'string');
    const prefixe = e => { const s = typeof e.railPairId === 'string' ? e.railPairId : '', k = s.lastIndexOf('/'); return k > 0 ? s.slice(0, k) : null; };
    const prefixes = new Set(ecrituresToutes.filter(e => idsLots.has(e.batchId)).map(prefixe));
    const ecritures = ecrituresToutes.filter(e => prefixes.has(prefixe(e)) && e.body.ExtractionStatus === 'valid' && LM.EDGES.every(k => fini(e.body[k])))
      .map(e => ({ row: e.rowIndex, at: fini(e.endedEpochMs) ? e.endedEpochMs : t(e), ed: LM.EDGES.map(k => Math.round(e.body[k] * 1e4)), monde: LM.EDGES.map(k => e.body[k]) })).sort((a, b) => a.at - b.at);
    /* Contrôle : l'instantané porte la dernière écriture antérieure à son heure. */
    let ctrlN = 0, ctrlKo = 0;
    { const der = new Map(); for (const w of ecritures) if (w.at <= fin.atMs) der.set(w.row, w);
      for (const [row, w] of der) { ctrlN++; if (fin.st[row] !== 0 || w.ed.some((v, k) => Math.abs(v - fin.ed[6 * row + k]) > 1)) ctrlKo++; } }

    /* --- translation monde − scène par cadre : écriture (monde) − pose corrigée de l'enregistrement (scène) */
    const recsPartie = records.filter(r => r && r.rails && ((r.identity && r.identity.part) ?? r.part) === partie && SIDES.every(s => r.rails[s] && r.rails[s].initial && Array.isArray(r.rails[s].initial.positionSceneRelative)));
    const Tcadre = new Map(), Tcut = new Map(), mesuresT = [];
    for (const r of recsPartie) {
      if (!SIDES.every(s => r.rails[s].corrected && Array.isArray(r.rails[s].corrected.positionSceneRelative))) continue;
      const cut = (r.identity || r).cut, cadre = (r.identity || r).frameId ?? null, tr = Date.parse(r.capturedAt || r.startedAt || '');
      const w = ecritures.filter(x => x.row === cut && x.at >= tr - 2000).sort((a, b) => a.at - b.at)[0];
      if (!w || w.at - tr > 60000) continue;
      const dl = [0, 1, 2].map(i => w.monde[i] - r.rails.left.corrected.positionSceneRelative[i]), dr = [0, 1, 2].map(i => w.monde[3 + i] - r.rails.right.corrected.positionSceneRelative[i]);
      const rigide = Math.hypot(dl[0] - dr[0], dl[1] - dr[1], dl[2] - dr[2]) * 1000;
      if (rigide > 2) continue;
      const T = [0, 1, 2].map(i => (dl[i] + dr[i]) / 2);
      mesuresT.push({ cadre, cut, T }); Tcut.set(cadre + '|' + cut, T);
    }
    for (const cadre of new Set(mesuresT.map(m => m.cadre))) { const l = mesuresT.filter(m => m.cadre === cadre); Tcadre.set(cadre, [0, 1, 2].map(i => med(l.map(m => m.T[i])))); }
    const dispT = Math.max(0, ...mesuresT.map(m => Math.hypot(...[0, 1, 2].map(i => m.T[i] - Tcadre.get(m.cadre)[i])) * 1000));

    let rangLot = 0;
    for (const lot of lots) {
      rangLot++;
      const nomLot = `${cle}/p${partie}/lot${rangLot}`;
      const coupure = Math.min(Infinity, ...ev.filter(e => e.type === 'relecture-debut' && (e.batchId === lot.id || e.lotId === lot.id)).map(t));
      const decisions = ev.filter(e => e.type === 'gcv1-shadow-observed' && e.batchId === lot.id && e.lotObservation && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut) && t(e) < coupure);
      const validations = ev.filter(e => e.type === 'validation-accepted' && e.batchId === lot.id && e.identity && Number.isInteger(e.identity.cut));
      const b1 = ev.filter(e => e.type === 'voie-b1-ecart-ombre' && e.batchId === lot.id && e.passe == null && e.identity && e.identity.part === partie);
      const b1Passe = ev.filter(e => e.type === 'voie-b1-ecart-ombre' && e.batchId === lot.id && e.passe != null).length;
      const seuils = (b1.find(e => e.seuils) || {}).seuils || null;
      const reglage = seuils || SETTINGS.lot.voieB1EcartOmbre;
      /* Événement de l'ombre d'une décision : le premier du cut entre cette décision et la suivante du même cut. */
      const b1De = new Map();
      for (const e of b1) {
        const ds = decisions.filter(d => d.identity.cut === e.identity.cut && t(d) <= t(e));
        const d = ds[ds.length - 1];
        if (d && !b1De.has(d)) b1De.set(d, e);
      }
      const b1Orphelins = b1.length - b1De.size;
      const aEvaluer = decisions.filter(d => b1De.has(d) || CF.has(d.identity.cut));
      const captures = chargerCaptures(dossier, aEvaluer.map(d => d.lidarCaptureId).filter(Boolean));

      /* --- table du début du lot (ou de fin, `--table fin`, pour mesurer la sensibilité) */
      const { tab, revenues } = TABLE === 'fin' ? { tab: { ...fin, st: fin.st.slice(), fl: fin.fl.slice(), ed: fin.ed.slice() }, revenues: new Set() } : tableAu(fin, ecritures, lot.debut);
      /* Lignes revenues à « invalide » : la pose de départ, là où on la connaît (capture du cut ; sinon l'enregistrement de la validation). */
      let remisesCapture = 0, remisesRecord = 0, sansDepart = 0, ecartTligne = 0;
      const departConnu = new Set();
      for (const d of aEvaluer) {
        const cut = d.identity.cut, cap = captures.get(d.lidarCaptureId), cadre = d.identity.frameId ?? null;
        if (!cap || !revenues.has(cut) || departConnu.has(cut)) continue;
        const Tl = Tcut.get(cadre + '|' + cut) || null, Tc = Tcadre.get(cadre) || null, T = Tl || Tc;
        if (!T) continue;
        if (Tl && Tc) ecartTligne = Math.max(ecartTligne, Math.hypot(...[0, 1, 2].map(i => Tl[i] - Tc[i])) * 1000);
        remettreDepart(tab, cut, cap.rails, T); departConnu.add(cut); remisesCapture++;
      }
      for (const row of revenues) {
        if (departConnu.has(row)) continue;
        const r = recsPartie.filter(x => (x.identity || x).cut === row && Date.parse(x.capturedAt || x.startedAt || '') >= lot.debut - 1000)[0];
        const cadre = r ? (r.identity || r).frameId ?? null : null, T = r ? Tcut.get(cadre + '|' + row) || Tcadre.get(cadre) : null;
        if (r && T) { remettreDepart(tab, row, { left: r.rails.left.initial, right: r.rails.right.initial }, T); departConnu.add(row); remisesRecord++; }
        else sansDepart++;
      }
      /* Contrôle de la translation sur les cuts réellement différés dont la ligne n'a pas été écrite : ligne − (pose de départ + T du cadre). */
      const ctrlT = [];
      for (const d of aEvaluer) {
        const cut = d.identity.cut, cap = captures.get(d.lidarCaptureId), Tc = Tcadre.get(d.identity.frameId ?? null);
        if (!cap || revenues.has(cut) || !Tc || fin.st[cut] !== 1) continue;
        const e = fin.ed.slice(6 * cut, 6 * cut + 6).map(v => v / 1e4);
        ctrlT.push(Math.max(Math.hypot(...[0, 1, 2].map(i => e[i] - cap.rails.left.positionSceneRelative[i] - Tc[i])), Math.hypot(...[0, 1, 2].map(i => e[3 + i] - cap.rails.right.positionSceneRelative[i] - Tc[i]))) * 1000);
      }

      /* --- boucle ordonnée du lot */
      const etat = { anchors: [], pending: [] }, etatV1 = { anchors: [], pending: [] };
      const mem0 = M.creerMemoire('fidele'), memV1 = M.creerMemoire('v1'), memV2 = M.creerMemoire('v2');
      const valides = []; let iv = 0;
      const F = { lot: nomLot, profil: lot.profil, decisions: decisions.length, b1: b1.length, b1Passe, b1Orphelins, compares: 0, verdictOk: 0, sourceOk: 0, etageOk: 0, lignesOk: 0, repereOk: 0, gRefOk: 0, appuisOk: 0, reelOk: 0,
        ecarts: [], desaccords: [], sansNuage: [], scienceDiff: [], appuisIncoherents: 0, appuisControles: 0, cfEvalues: 0, cfAvecEvenement: [], cfMultiples: [],
        table: { mode: TABLE, lignesRevenues: revenues.size, departCapture: remisesCapture, departEnregistrement: remisesRecord, sansDepart, ecartTligneCadreMm: r2(ecartTligne), controleTmm: { n: ctrlT.length, max: r2(Math.max(0, ...ctrlT)) } },
        reglage: seuils ? 'seuils du journal' : 'src/settings.js', reglageDiffere: seuils ? JSON.stringify(seuils) !== JSON.stringify({ ...SETTINGS.lot.voieB1EcartOmbre }) : null };
      const cfVus = new Map();
      for (const d of decisions) {
        while (iv < validations.length && t(validations[iv]) < t(d)) valides.push(validations[iv++].identity);
        L.promoteAnchors(etat, valides, 40); L.promoteAnchors(etatV1, valides, 40);
        const lo = d.lotObservation, cut = d.identity.cut, identite = { part: partie, cut, frameId: d.identity.frameId ?? null };
        /* Contrôle des appuis : tout appui employé par la décision réelle doit être dans la liste reconstruite. */
        if (Array.isArray(lo.anchorsUsed) && lo.anchorsUsed.length && !lo.validatedAnchors) { F.appuisControles++; if (!lo.anchorsUsed.every(c => etat.anchors.some(a => a.identity.cut === c))) F.appuisIncoherents++; }
        const jb = b1De.get(d) || null, estCF = CF.has(cut);
        if (jb || estCF) {
          const cap = captures.get(d.lidarCaptureId);
          if (estCF) cfVus.set(cut, (cfVus.get(cut) || 0) + 1);
          if (!cap) F.sansNuage.push(cut);
          else {
            const capture = () => ({ identity: copie(d.identity), rails: copie(cap.rails), pointsSceneRelative: cap.pointsSceneRelative, visibleByClipBoxes: cap.visibleByClipBoxes });
            let recalc = null; try { recalc = Sh.scientificProposeBoth(capture()); } catch { recalc = null; }
            const sciJ = d.shadow && d.shadow.rails ? { rails: d.shadow.rails, summary: d.shadow.summary } : null;
            /* Écart entre la science du journal et la science recalculée sur le nuage du corpus (mm, décalage publié ou A*). */
            if (sciJ && recalc) {
              let dm = 0, statut = true;
              for (const s of SIDES) { const a = sciJ.rails[s], b = recalc.rails[s];
                if (!!(a && a.ok) !== !!(b && b.ok)) { statut = false; continue; }
                if (!a || !a.ok) continue;
                if (a.next.status !== b.next.status) statut = false;
                for (const k of ['next', 'astar']) if (Array.isArray(a[k] && a[k].delta) && Array.isArray(b[k] && b[k].delta)) dm = Math.max(dm, ...[0, 1, 2].map(i => Math.abs(a[k].delta[i] - b[k].delta[i]) * 1000)); }
              if (!statut || dm > 0.05) F.scienceDiff.push({ cut, statut, mm: r2(dm) });
            }
            const science = SCIENCE === 'recalcul' ? recalc : sciJ || recalc;
            const commande = lo.command ? { action: lo.command.action, reason: lo.command.reason ?? null } : null;
            const evalue = (mem, ancres, cmd) => science ? M.evaluer({ mem, capture: capture(), science: copie({ rails: science.rails, summary: science.summary }), Shadow: Sh, table: tab, ancresReelles: copie(ancres),
              decisionReelle: copie(lo), commandeReelle: cmd, reglage }).evenement : { etat: 'erreur', message: 'sans science', verdict: { posable: false, raison: 'erreur' } };
            const ancresV1 = etatV1.anchors;
            const ligne = { lot: nomLot, partie, cut, type: estCF ? 'contrefactuel' : 'reel', journal: null };
            if (jb && !estCF) {
              const f = evalue(mem0, etat.anchors, commande), rf = resume(f), rj = resume(jb);
              ligne.journal = { posable: rj.posable, source: rj.source, poseMm: rj.poseMm };
              ligne.fidele = rf;
              F.compares++;
              const e = ecartPose(rj.poseMm, rf.poseMm);
              const ok = { verdict: rj.posable === rf.posable, source: rj.source === rf.source, etage: rj.etage === rf.etage, lignes: memeListe(jb.lignesValides, f.lignesValides), repere: jb.repere === f.repere,
                gRef: !!(jb.gRef && f.gRef) && jb.gRef.source === f.gRef.source && Math.abs(jb.gRef.mm - f.gRef.mm) <= 0.011, appuis: memeListe(jb.appuis, f.appuis), reel: !!(jb.reel && f.reel) && jb.reel.stage === f.reel.stage && jb.reel.reason === f.reel.reason };
              if (ok.verdict) F.verdictOk++; if (ok.source) F.sourceOk++; if (ok.etage) F.etageOk++; if (ok.lignes) F.lignesOk++; if (ok.repere) F.repereOk++; if (ok.gRef) F.gRefOk++; if (ok.appuis) F.appuisOk++; if (ok.reel) F.reelOk++;
              if (e != null) F.ecarts.push(e);
              if (!ok.verdict || !ok.source || (e != null && e > 2) || !ok.lignes || !ok.repere || !ok.gRef || !ok.appuis || !ok.etage)
                F.desaccords.push({ cut, quoi: Object.entries(ok).filter(x => !x[1]).map(x => x[0]).concat(e != null && e > 2 ? ['pose'] : []), ecartPoseMm: r2(e),
                  journal: { posable: rj.posable, source: rj.source, etage: rj.etage, raison: rj.raison, lignesValides: jb.lignesValides, repere: jb.repere, gRef: jb.gRef, appuis: jb.appuis, essais: jb.essais, reel: jb.reel },
                  rejeu: { posable: rf.posable, source: rf.source, etage: rf.etage, raison: rf.raison, lignesValides: f.lignesValides, repere: f.repere, gRef: f.gRef, appuis: f.appuis, essais: f.essais, reel: f.reel, message: f.message } });
            }
            if (estCF) F.cfEvalues++;
            /* Mondes contrefactuels : V1 (appuis sans les contrefactuels), V2 (appuis réels). Les différés réels y sont évalués aussi : leur mémoire avance. */
            ligne.rejeu = resume(evalue(memV1, ancresV1, estCF ? null : commande));
            ligne.rejeuV2 = resume(evalue(memV2, etat.anchors, estCF ? null : commande));
            if (estCF) {
              const rec = recsPartie.filter(x => (x.identity || x).cut === cut && SIDES.every(s => x.rails[s].corrected && Array.isArray(x.rails[s].corrected.positionSceneRelative)) && Date.parse(x.capturedAt || x.startedAt || '') >= t(d) - 5000)[0];
              const poseLot = rec ? V.poseMm({ rails: cap.rails }, { left: rec.rails.left.corrected.positionSceneRelative, right: rec.rails.right.corrected.positionSceneRelative }) : null;
              ligne.reel = { etage: lo.stage ?? null, commande: lo.command ? `${lo.command.action}:${lo.command.reason ?? ''}`.slice(0, 40) : null, poseLotMm: poseLot, appuisV2: etat.anchors.length, appuisV1: ancresV1.length };
              ligne.ecartAuLotMm = { v1: r2(ecartPose(ligne.rejeu.poseMm, poseLot)), v2: r2(ecartPose(ligne.rejeuV2.poseMm, poseLot)) };
              if (jb) F.cfAvecEvenement.push(cut);
            }
            lignes.push(ligne);
          }
        }
        if (lo.anchorHeld === true && lo.positions && SIDES.every(s => Array.isArray(lo.positions[s]))) {
          const entree = { identity: identite, positions: { left: lo.positions.left.slice(0, 3), right: lo.positions.right.slice(0, 3) }, stage: lo.stage };
          L.holdAnchor(etat, entree); if (!CF.has(cut)) L.holdAnchor(etatV1, copie(entree));
        }
      }
      for (const c of cutsCF) { const n = cfVus.get(c) || 0; if (n > 1) F.cfMultiples.push(c); }
      F.cfDansCeLot = [...cfVus.keys()];
      F.ecartPose = { n: F.ecarts.length, mediane: r2(med(F.ecarts)), max: r2(F.ecarts.length ? Math.max(...F.ecarts) : null) };
      bilan.lots.push(F);
    }
    const vus = new Set(bilan.lots.filter(f => f.lot.startsWith(`${cle}/p${partie}/`)).flatMap(f => f.cfDansCeLot));
    bilan.parties.push({ partie: `${cle}/p${partie}`, lots: lots.length, liste: { lignes: fin.n, ecrituresControlees: ctrlN, ecrituresAbsentesDeLInstantane: ctrlKo }, translation: { mesures: mesuresT.length, cadres: Tcadre.size, dispersionMaxMm: r2(dispT) },
      cfDemandes: cutsCF.length, cfAbsents: cutsCF.filter(c => !vus.has(c)) });
  }
}

/* ------------------------------------------------------------------ principal */
const entree = JSON.parse(fs.readFileSync(path.join(ICI, 'cuts-s60.json'), 'utf8'));
const lignes = [], bilan = { science: SCIENCE, table: TABLE, lots: [], parties: [] };
for (const [cle, v] of Object.entries(entree)) { if (SEULEMENT && cle !== SEULEMENT) continue; traiter(cle, v.dossier, v.parties, lignes, bilan); }
fs.mkdirSync(SORTIE, { recursive: true });
fs.writeFileSync(path.join(SORTIE, 'b1-rejeu.jsonl'), lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
const tot = { compares: 0, verdictOk: 0, sourceOk: 0, etageOk: 0, lignesOk: 0, repereOk: 0, gRefOk: 0, appuisOk: 0, reelOk: 0, ecarts: [] };
for (const f of bilan.lots) { for (const k of Object.keys(tot)) if (k !== 'ecarts') tot[k] += f[k]; tot.ecarts.push(...f.ecarts); }
bilan.total = { ...tot, ecarts: undefined, ecartPose: { n: tot.ecarts.length, mediane: r2(med(tot.ecarts)), max: r2(tot.ecarts.length ? Math.max(...tot.ecarts) : null), auPlus2mm: tot.ecarts.filter(e => e <= 2).length } };
for (const f of bilan.lots) delete f.ecarts;
fs.writeFileSync(path.join(SORTIE, 'b1-bilan.json'), JSON.stringify(bilan, null, 1));
console.log(JSON.stringify(bilan, null, 1));
