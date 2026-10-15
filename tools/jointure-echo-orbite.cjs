#!/usr/bin/env node
'use strict';
/*
 * jointure-echo-orbite.cjs — joint, cut par cut, un export Écho (observation des corrections humaines,
 * `banane-native-session-v2`/v3 compact, en plusieurs segments) et le journal Orbite (`ariane-journal-v4-*.json`,
 * lot automatique) de la même partie. Chantier S3 du plan 5.0 (audit Écho, ligne C-03) : juger Ariane sur la
 * vérité terrain sans jointure manuelle. Outil hors ligne, lecture seule, aucune dépendance.
 *
 *   node tools/jointure-echo-orbite.cjs --echo <dossier ou fichiers…> --journal <fichier>
 *        [--partie N] [--base auto|premiere|derniere] [--sortie table.json] [--csv table.csv] [--sans-poses]
 *
 * Clé de jointure : (partie, cut) — et le projet si les deux identités en portent un (`projectId` ; absent des
 * exports actuels). Par cut, la table donne :
 *  - la classe Ariane : « posee » (validation ou pose vérifiée au journal), « differee » (cut différé et jamais
 *    posé), « autre » (vu au journal sans issue : capture abandonnée…), « hors-journal » ;
 *  - le motif de différé (par rail : motif du moteur et raison) ;
 *  - la pose d'Ariane (bords gauche/droit, scène du journal) et son déplacement dans le repère profil ;
 *  - la pose humaine finale (bords, scène de l'Écho) : celle de la DERNIÈRE validation observée, toutes visites
 *    confondues (comme la 4.9.0.20) ; un cut sans validation observée est « sans-reference » ;
 *  - l'écart humain par rail : latéral, vertical, longitudinal (mm, repère profil du rail) et distance 3D ;
 *    sans matrice de repère profil, la distance 3D seule (« repere: "3D" ») ;
 *  - l'étiquette Écho (VALIDATE_NO_MOVEMENT, VALIDATE_CORRECTED_*…) ;
 *  - la décision B1 en ombre (dernier événement `b1-ombre` du cut) et la proposition du moteur par rail.
 *
 * ÉCART HUMAIN = pose finale humaine − pose de base, dans le repère profil de la base.
 * Base (`--base`) :
 *  - « auto » (défaut) : la pose d'Ariane si le cut est posé et le repère de scène est calibré, sinon la pose
 *    initiale de la PREMIÈRE visite de l'Écho ;
 *  - « premiere » : toujours la pose initiale de la première visite ;
 *  - « derniere » : la pose initiale de la visite qui porte la référence (lecture du prototype cmp.cjs).
 *
 * REPÈRE DE SCÈNE. L'Écho et le journal n'ont pas la même origine de scène : l'écart entre la pose posée par
 * Ariane (journal) et la pose initiale vue par l'Écho est une translation constante. L'outil l'estime (médiane
 * par axe sur les cuts posés des deux côtés), la consigne dans le résumé avec sa dispersion, et marque
 * « repere-incoherent » (retour à la première visite) tout cut qui s'en écarte de plus de 20 mm.
 */
const fs = require('node:fs');
const path = require('node:path');
const X = require('../src/native-export.js');
const V = require('./lire-volumes.cjs');

const COTES = [['gauche', 'left'], ['droite', 'right']];
const SEUIL_REPERE_MM = 20;
const SEUILS_MM = [5, 10];
const BASES = ['auto', 'premiere', 'derniere'];

/* ------------------------------------------------------------------ outils numériques */
const fini = v => Number.isFinite(v);
const vec3 = v => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(fini) ? v.slice(0, 3) : null;
const mat16 = m => Array.isArray(m) && m.length === 16 && m.every(fini) ? m : null;
const arrondi = (v, d = 3) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const mm = v => v === null ? null : arrondi(v * 1000, 3);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norme = d => Math.hypot(d[0], d[1], d[2]);
/* Quantile à interpolation linéaire (comme tools/native-offline-evaluate.cjs). */
function quantile(valeurs, p) {
  const v = valeurs.filter(fini).sort((a, b) => a - b);
  if (!v.length) return null;
  const at = (v.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return v[lo] + (v[hi] - v[lo]) * (at - lo);
}
const mediane = valeurs => quantile(valeurs, .5);
function stat(valeurs) {
  const v = valeurs.filter(fini);
  return { n: v.length, medianeMm: arrondi(quantile(v, .5), 2), p90Mm: arrondi(quantile(v, .9), 2), maxMm: v.length ? arrondi(Math.max(...v), 2) : null };
}
/* Vecteur de scène → repère profil (colonnes de la matrice 4×4 : partie rotation seule, c'est un écart). */
function versProfil(m, d) {
  return [0, 1, 2].map(i => m[i] * d[0] + m[4 + i] * d[1] + m[8 + i] * d[2]);
}

/* ------------------------------------------------------------------ lecture */
const cleCut = (partie, cut) => `${partie}|${cut}`;
const identiteDe = o => o && o.identity ? o.identity : (o && Number.isInteger(o.cut) ? o : null);

/* Fichiers Écho : un dossier (JSON et volumes zip, seuls les exports natifs sont retenus par leur nom),
 * ou des fichiers donnés tels quels. */
function entreesEcho(entrees) {
  const out = [];
  for (const e of entrees) {
    const dossier = fs.existsSync(e) && fs.statSync(e).isDirectory();
    for (const x of V.entrees(e)) {
      if (dossier && !/^(ariane|banane)-native-v\d+-/.test(x.nom)) continue;
      out.push(x);
    }
  }
  return out;
}

/* Les records d'un Écho, tous segments : union par recordId, le segment le plus récent l'emporte (chaque segment
 * porte un instantané complet des records au moment du vidage, comme dans tools/merge-segments.cjs). Le segment
 * est relu, ses records dépliés, puis libéré : on ne garde jamais les nuages. */
function lireEcho(entrees, { journal = () => {} } = {}) {
  const liste = entreesEcho(entrees);
  if (!liste.length) throw Error('Aucun export Écho (ariane-native-v4-*.json, banane-native-v4-*.json) trouvé.');
  const segments = [];
  for (const e of liste) {
    const doc = JSON.parse(e.lire().toString('utf8'));
    if (!/^banane-native-session-/.test(doc.format || '')) { journal(`ignoré (pas un export Écho) : ${e.nom}`); continue; }
    const records = (doc.format === X.FORMAT ? X.unfoldRefs({ records: doc.records || [] }, doc.dictionaries || {}) : doc).records || [];
    const seg = doc.segment || {};
    segments.push({ nom: e.nom, stamp: String(seg.stamp || ''), index: seg.index || 0, records });
  }
  if (!segments.length) throw Error('Aucun des fichiers donnés n\'est un export Écho (banane-native-session-*).');
  segments.sort((a, b) => a.stamp.localeCompare(b.stamp) || a.index - b.index || a.nom.localeCompare(b.nom));
  const records = new Map();
  for (const s of segments) for (const r of s.records) records.set(r.recordId || r.id || `${s.nom}#${records.size}`, r);
  return { records: [...records.values()], segments: segments.map(s => ({ fichier: s.nom, stamp: s.stamp || null, index: s.index, records: s.records.length })) };
}

/* Le journal Orbite : événements et records (un journal compact est déplié). */
function lireJournal(fichier) {
  let doc = JSON.parse(V.lire(fichier).toString('utf8'));
  if (doc.dictionaries) doc = X.unfoldRefs(doc, doc.dictionaries);
  if (!Array.isArray(doc.events)) throw Error('Journal Orbite illisible : pas de liste « events ».');
  return { events: doc.events, records: doc.records || [], format: doc.format || null, version: doc.version || null };
}

/* ------------------------------------------------------------------ côté Écho */
const positionsDe = etat => {
  const p = {};
  for (const [, en] of COTES) { const r = etat && etat.rails && etat.rails[en]; p[en] = r && vec3(r.positionSceneRelative) ? r : null; }
  return p;
};
const aDesRails = etat => !!etat && COTES.some(([, en]) => etat.rails && etat.rails[en] && vec3(etat.rails[en].positionSceneRelative));
const visiteOrdre = (a, b) => (a.visitIndex ?? 0) - (b.visitIndex ?? 0) || String(a.startedAt || '').localeCompare(String(b.startedAt || ''));

/* Regroupe les records de l'Écho par (partie, cut). */
function echoParCut(records) {
  const par = new Map();
  for (const r of records) {
    const id = identiteDe(r);
    if (!id || !Number.isInteger(id.part) || !Number.isInteger(id.cut)) continue;
    const k = cleCut(id.part, id.cut);
    if (!par.has(k)) par.set(k, { partie: id.part, cut: id.cut, projet: id.projectId ?? null, visites: [] });
    par.get(k).visites.push(r);
  }
  for (const c of par.values()) c.visites.sort(visiteOrdre);
  return par;
}
/* Dernière validation observée : la visite la plus tardive qui porte une référence humaine à rails. */
function referenceHumaine(visites) {
  for (let i = visites.length - 1; i >= 0; i--) {
    const h = visites[i].humanFinalReference;
    if (h && aDesRails(h.state)) return { visite: visites[i], etat: h.state, rang: i };
  }
  return null;
}

/* ------------------------------------------------------------------ côté journal */
const TYPES_VUS = new Set(['proposed', 'before-captured', 'applied-verified', 'after-captured', 'validation-intent', 'validation-observation',
  'validation-accepted', 'defer-intent', 'defer-finalized', 'capture-abandoned', 'capture-stale', 'b1-ombre']);

function journalParCut(journal) {
  const par = new Map(), get = (id) => {
    const k = cleCut(id.part, id.cut);
    if (!par.has(k)) par.set(k, { partie: id.part, cut: id.cut, projet: id.projectId ?? null, vu: false, posee: false, differee: false, appliedVerified: null, deferFinalise: null, b1: null, propose: null });
    return par.get(k);
  };
  for (const e of journal.events) {
    const id = identiteDe(e);
    if (!id || !Number.isInteger(id.part) || !Number.isInteger(id.cut)) continue;
    if (!TYPES_VUS.has(e.type)) continue;
    const c = get(id);
    c.vu = true;
    if (e.type === 'validation-accepted') c.posee = true;
    else if (e.type === 'applied-verified') { c.posee = true; c.appliedVerified = e; }
    else if (e.type === 'defer-finalized') { c.differee = true; c.deferFinalise = e; }
    else if (e.type === 'b1-ombre') c.b1 = e;
    else if (e.type === 'proposed') c.propose = e;
  }
  /* Records du journal : un par pose ; le plus récent (capturedAt) de chaque cut. */
  const recs = new Map();
  for (const r of journal.records) {
    const id = identiteDe(r);
    if (!id || !Number.isInteger(id.part) || !Number.isInteger(id.cut)) continue;
    const k = cleCut(id.part, id.cut), ancien = recs.get(k);
    if (!ancien || String(r.capturedAt || '') >= String(ancien.capturedAt || '')) recs.set(k, r);
  }
  for (const [k, r] of recs) if (par.has(k)) par.get(k).record = r;
  return par;
}
const classeDe = c => !c || !c.vu ? 'hors-journal' : c.posee ? 'posee' : c.differee ? 'differee' : 'autre';

/* Pose d'Ariane : les rails du record du journal (état corrigé = pose posée), à défaut ceux de l'événement
 * « applied-verified ». Rend { source, initial, posee } par côté, en rails { positionSceneRelative, sceneRelativeToProfileLocal… }. */
function poseAriane(c) {
  if (!c || !c.posee) return null;
  const out = { source: null, initial: {}, posee: {} };
  const r = c.record && c.record.rails;
  if (r && COTES.some(([, en]) => r[en] && vec3(r[en].corrected && r[en].corrected.positionSceneRelative))) {
    out.source = 'record';
    for (const [, en] of COTES) { out.posee[en] = r[en] && r[en].corrected || null; out.initial[en] = r[en] && r[en].initial || null; }
    return out;
  }
  const o = c.appliedVerified && c.appliedVerified.observed;
  if (o && o.rails && COTES.some(([, en]) => o.rails[en] && vec3(o.rails[en].positionSceneRelative))) {
    out.source = 'applied-verified';
    for (const [, en] of COTES) { out.posee[en] = o.rails[en] || null; out.initial[en] = null; }
    return out;
  }
  return null;
}

/* Motif de différé : par rail, le motif du moteur et le début de la raison. */
function motifDiffere(c) {
  const e = c && c.deferFinalise;
  if (!e) return null;
  const m = { statut: e.status || null, transition: e.transition || null, railsNonResolus: (e.unresolvedRails || []).map(s => s === 'left' ? 'gauche' : s === 'right' ? 'droite' : s) };
  for (const [fr, en] of COTES) {
    const r = e.rails && e.rails[en];
    m[fr] = r ? { statut: r.status || null, motif: r.gcv1 && r.gcv1.motif || null, raison: r.reasons && r.reasons.length ? String(r.reasons.join(' ')).slice(0, 160) : null } : null;
  }
  return m;
}
/* Proposition du moteur par rail pour un cut posé (motif, statut, convention appliquée). */
function propositionMoteur(c) {
  const p = c && c.propose && c.propose.proposal && c.propose.proposal.rails;
  if (!p) return null;
  const out = {};
  for (const [fr, en] of COTES) {
    const r = p[en];
    out[fr] = r ? { statut: r.status || null, motif: r.gcv1 && r.gcv1.motif || null, convention: r.gcv1 && r.gcv1.convention ? !!r.gcv1.convention.applied : null, confiance: arrondi(r.confidence, 3) } : null;
  }
  return out;
}
/* Décision B1 en ombre : le dernier événement b1-ombre du cut. */
function decisionB1(c) {
  const e = c && c.b1;
  if (!e) return null;
  return {
    etat: e.etat ?? null, regle: e.regle ?? null, changement: e.changement ?? null,
    reel: e.reel ? { stage: e.reel.stage ?? null, reason: e.reel.reason ?? null } : null,
    hypothese: e.hypothese ? { stage: e.hypothese.stage ?? null, reason: e.hypothese.reason ?? null, appuis: (e.hypothese.anchorsUsed || []).length, ecartPrevisionMm: e.hypothese.fromPredictionMm ?? null } : null,
    ecartPoseMm: e.ecartPoseMm ?? null,
  };
}

/* ------------------------------------------------------------------ repère de scène (Écho ↔ journal) */
/* Translation constante entre la scène du journal et celle de l'Écho : médiane par axe de
 * (pose initiale vue par l'Écho, première visite) − (pose posée par Ariane), sur les rails des cuts posés des deux côtés. */
function calibrerRepere(echo, jr) {
  const dx = [[], [], []], paires = [];
  for (const [k, c] of echo) {
    const j = jr.get(k), a = poseAriane(j);
    if (!a) continue;
    const ini = c.visites[0] && c.visites[0].initialObserved;
    for (const [, en] of COTES) {
      const pe = ini && ini.rails && vec3(ini.rails[en] && ini.rails[en].positionSceneRelative), pa = a.posee[en] && vec3(a.posee[en].positionSceneRelative);
      if (pe && pa) { const d = moins(pe, pa); paires.push(d); for (let i = 0; i < 3; i++) dx[i].push(d[i]); }
    }
  }
  if (!paires.length) return { calibre: false, paires: 0, decalage: null, residuMedianMm: null, residuP90Mm: null };
  const decalage = dx.map(mediane);
  const residus = paires.map(d => 1000 * norme(moins(d, decalage)));
  return { calibre: true, paires: paires.length, decalage, residuMedianMm: arrondi(quantile(residus, .5), 3), residuP90Mm: arrondi(quantile(residus, .9), 3) };
}

/* ------------------------------------------------------------------ écart d'un rail */
/* Écart entre la pose finale `fin` et la pose de base `base` ({positionSceneRelative, sceneRelativeToProfileLocal}),
 * en mm, dans le repère profil de la base (à défaut celui de la pose finale), sinon en 3D seule. */
function ecartRail(base, fin) {
  const pb = base && vec3(base.positionSceneRelative), pf = fin && vec3(fin.positionSceneRelative);
  if (!pb || !pf) return null;
  const d = moins(pf, pb), m = mat16(base.sceneRelativeToProfileLocal) || mat16(fin.sceneRelativeToProfileLocal);
  const dist3dMm = mm(norme(d));
  if (!m) return { repere: '3D', lateralMm: null, verticalMm: null, longitudinalMm: null, dist3dMm };
  const l = versProfil(m, d);
  return { repere: 'profil', longitudinalMm: mm(l[0]), lateralMm: mm(l[1]), verticalMm: mm(l[2]), dist3dMm };
}
const sansPose = (r) => r && r.positionSceneRelative ? { x: arrondi(r.positionSceneRelative[0], 3), y: arrondi(r.positionSceneRelative[1], 3), z: arrondi(r.positionSceneRelative[2], 3) } : null;

/* ------------------------------------------------------------------ jointure */
/* `records` : records de l'Écho ; `journal` : { events, records } ; options : { partie, base, poses }. */
function joindre(records, journal, options = {}) {
  const base = options.base || 'auto';
  if (!BASES.includes(base)) throw Error(`--base inconnue : ${base} (auto, premiere, derniere).`);
  const poses = options.poses !== false;
  let echo = echoParCut(records);
  let jr = journalParCut(journal);
  const partiesJournal = new Set([...jr.values()].map(c => c.partie));
  const retenue = options.partie !== undefined && options.partie !== null ? new Set([options.partie]) : partiesJournal;
  const partiesEchoIgnorees = new Set();
  for (const [k, c] of [...echo]) if (!retenue.has(c.partie)) { partiesEchoIgnorees.add(c.partie); echo.delete(k); }
  for (const [k, c] of [...jr]) if (!retenue.has(c.partie)) jr.delete(k);
  /* Projet : si les deux identités en portent un et qu'ils diffèrent, ce n'est pas le même cut. */
  let projetsDifferents = 0;
  for (const [k, c] of echo) { const j = jr.get(k); if (j && c.projet && j.projet && c.projet !== j.projet) { jr.delete(k); projetsDifferents++; } }

  const repere = calibrerRepere(echo, jr);
  const decalage = repere.calibre ? repere.decalage : null;
  const lignes = [];
  const cles = new Set([...echo.keys(), ...jr.keys()]);
  for (const k of [...cles].sort((a, b) => { const [pa, ca] = a.split('|').map(Number), [pb, cb] = b.split('|').map(Number); return pa - pb || ca - cb; })) {
    const c = echo.get(k) || null, j = jr.get(k) || null, classe = classeDe(j);
    const ligne = {
      partie: (c || j).partie, cut: (c || j).cut, classe,
      dansEcho: !!c, dansJournal: !!(j && j.vu), visitesEcho: c ? c.visites.length : 0,
      motifDiffere: motifDiffere(j), propositionMoteur: propositionMoteur(j), b1Ombre: decisionB1(j),
    };
    const a = poseAriane(j);
    ligne.pose = { source: a ? a.source : null };
    if (a) {
      ligne.arianeDeplacement = {};
      for (const [fr, en] of COTES) ligne.arianeDeplacement[fr] = a.initial[en] ? ecartRail(a.initial[en], a.posee[en]) : null;
    }
    if (!c) { ligne.referenceHumaine = 'absent-de-l-echo'; ligne.etiquetteEcho = null; ligne.base = null; lignes.push(ligne); continue; }

    const ref = referenceHumaine(c.visites), derniere = c.visites[c.visites.length - 1];
    const etiquette = (ref ? ref.visite : derniere).observedLabelCandidate ?? null;
    ligne.etiquetteEcho = etiquette;
    ligne.statutEcho = (ref ? ref.visite : derniere).status ?? null;
    if (!ref) { ligne.referenceHumaine = 'sans-reference'; ligne.base = null; lignes.push(ligne); continue; }
    ligne.referenceHumaine = 'observee';
    ligne.visiteReference = ref.rang + 1;
    ligne.validationsDeLaVisite = (ref.visite.humanFinalReferences || []).length || 1;

    /* Pose de base. */
    const premiere = c.visites[0].initialObserved || c.visites[0].firstObserved;
    const propre = ref.visite.initialObserved || ref.visite.firstObserved;
    let choix = base === 'derniere' ? 'derniere-visite' : 'premiere-visite', rails = base === 'derniere' ? propre : premiere, baseRails = {};
    if (rails && rails.rails) for (const [, en] of COTES) baseRails[en] = rails.rails[en] || null;
    let coherence = null;
    if (base === 'auto' && a && decalage) {
      const ariane = {};
      let ecartMax = 0;
      for (const [, en] of COTES) {
        const p = a.posee[en], pe = premiere && premiere.rails && premiere.rails[en] && vec3(premiere.rails[en].positionSceneRelative);
        if (!p || !vec3(p.positionSceneRelative)) continue;
        ariane[en] = { ...p, positionSceneRelative: [0, 1, 2].map(i => p.positionSceneRelative[i] + decalage[i]) };
        if (pe) ecartMax = Math.max(ecartMax, 1000 * norme(moins(pe, ariane[en].positionSceneRelative)));
      }
      coherence = Object.keys(ariane).length ? arrondi(ecartMax, 3) : null;
      if (coherence !== null && coherence <= SEUIL_REPERE_MM) { choix = 'ariane'; baseRails = ariane; }
      else if (coherence !== null) choix = 'premiere-visite (repere-incoherent)';
    }
    ligne.base = choix;
    if (coherence !== null) ligne.controleRepereMm = coherence;
    ligne.ecartHumain = {};
    const finaux = positionsDe(ref.etat);
    for (const [fr, en] of COTES) ligne.ecartHumain[fr] = ecartRail(baseRails[en], finaux[en]);
    const dists = COTES.map(([fr]) => ligne.ecartHumain[fr] && ligne.ecartHumain[fr].dist3dMm).filter(fini);
    ligne.ecartHumain.maxDist3dMm = dists.length ? Math.max(...dists) : null;
    if (poses) {
      ligne.poseAriane = a ? { gauche: sansPose(a.posee.left), droite: sansPose(a.posee.right) } : null;
      ligne.poseHumaineFinale = { gauche: sansPose(finaux.left), droite: sansPose(finaux.right) };
    }
    lignes.push(ligne);
  }

  return { table: lignes, resume: resumer(lignes, { base, repere, partiesEchoIgnorees: [...partiesEchoIgnorees].sort((x, y) => x - y), projetsDifferents }) };
}

/* ------------------------------------------------------------------ résumé */
const CLASSES = ['posee', 'differee', 'autre', 'hors-journal'];
function resumer(lignes, meta = {}) {
  const resume = {
    base: meta.base || null,
    repereScene: meta.repere ? { calibre: meta.repere.calibre, paires: meta.repere.paires, residuMedianMm: meta.repere.residuMedianMm, residuP90Mm: meta.repere.residuP90Mm } : null,
    partiesEchoIgnorees: meta.partiesEchoIgnorees || [], projetsDifferents: meta.projetsDifferents || 0,
    cutsEcho: lignes.filter(l => l.dansEcho).length, cutsJournal: lignes.filter(l => l.dansJournal).length,
    cutsJoints: lignes.filter(l => l.dansEcho && l.dansJournal).length,
    cutsJournalAbsentsDeLEcho: lignes.filter(l => !l.dansEcho).length,
    reperes: { profil: 0, '3D': 0 }, bases: {}, cutsParClasse: {}, parClasse: {},
  };
  for (const l of lignes) {
    if (l.dansJournal) resume.cutsParClasse[l.classe] = (resume.cutsParClasse[l.classe] || 0) + 1;
    if (l.base) resume.bases[l.base] = (resume.bases[l.base] || 0) + 1;
    for (const [fr] of COTES) { const e = l.ecartHumain && l.ecartHumain[fr]; if (e) resume.reperes[e.repere]++; }
  }
  for (const classe of CLASSES) {
    const cl = lignes.filter(l => l.classe === classe && l.dansEcho);
    if (!cl.length && classe !== 'posee' && classe !== 'differee') continue;
    const avec = cl.filter(l => l.referenceHumaine === 'observee'), etiq = {};
    for (const l of cl) { const k = l.etiquetteEcho || 'sans-etiquette'; etiq[k] = (etiq[k] || 0) + 1; }
    const rail = fr => avec.map(l => l.ecartHumain[fr]).filter(Boolean);
    const dist = rows => rows.map(r => r.dist3dMm);
    const tous = [...rail('gauche'), ...rail('droite')];
    const cuts = avec.map(l => l.ecartHumain.maxDist3dMm).filter(fini);
    resume.parClasse[classe] = {
      cuts: cl.length, avecReference: avec.length, sansReference: cl.length - avec.length, etiquettesEcho: etiq,
      ecart3dMm: { gauche: stat(dist(rail('gauche'))), droite: stat(dist(rail('droite'))), rails: stat(dist(tous)), parCut: stat(cuts) },
      ecartLateralAbsMm: stat(tous.map(r => r.lateralMm === null ? NaN : Math.abs(r.lateralMm))),
      ecartVerticalAbsMm: stat(tous.map(r => r.verticalMm === null ? NaN : Math.abs(r.verticalMm))),
      corrections: Object.fromEntries(SEUILS_MM.map(s => [`sup${s}mm`, { cuts: cuts.filter(v => v > s).length, rails: dist(tous).filter(v => v > s).length }])),
    };
  }
  const motifs = {};
  for (const l of lignes) if (l.classe === 'differee' && l.motifDiffere) for (const [fr] of COTES) { const m = l.motifDiffere[fr]; if (m) { const k = m.motif || '-'; motifs[k] = (motifs[k] || 0) + 1; } }
  resume.motifsDeDiffere = motifs;
  return resume;
}

/* ------------------------------------------------------------------ sorties */
function enCsv(table) {
  const cols = ['partie', 'cut', 'classe', 'motifGauche', 'motifDroite', 'visitesEcho', 'referenceHumaine', 'etiquetteEcho', 'base',
    'gaucheLateralMm', 'gaucheVerticalMm', 'gaucheLongitudinalMm', 'gaucheDist3dMm', 'droiteLateralMm', 'droiteVerticalMm', 'droiteLongitudinalMm', 'droiteDist3dMm',
    'maxDist3dMm', 'repere', 'b1Etat', 'b1ReelStage', 'b1HypotheseStage', 'b1HypotheseRaison', 'b1Changement', 'b1Appuis'];
  const cel = v => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lignes = [cols.join(',')];
  for (const l of table) {
    const e = l.ecartHumain || {}, g = e.gauche || {}, d = e.droite || {}, b = l.b1Ombre || {}, md = l.motifDiffere || {};
    lignes.push([l.partie, l.cut, l.classe, md.gauche && md.gauche.motif, md.droite && md.droite.motif, l.visitesEcho, l.referenceHumaine, l.etiquetteEcho, l.base,
      g.lateralMm, g.verticalMm, g.longitudinalMm, g.dist3dMm, d.lateralMm, d.verticalMm, d.longitudinalMm, d.dist3dMm,
      e.maxDist3dMm, g.repere || d.repere, b.etat, b.reel && b.reel.stage, b.hypothese && b.hypothese.stage, b.hypothese && b.hypothese.reason, b.changement, b.hypothese && b.hypothese.appuis].map(cel).join(','));
  }
  return lignes.join('\n') + '\n';
}
const f1 = v => v === null || v === undefined ? '—' : (Math.round(v * 10) / 10).toFixed(1);
const st = s => s.n ? `n=${s.n} méd ${f1(s.medianeMm)} P90 ${f1(s.p90Mm)} max ${f1(s.maxMm)} mm` : 'n=0';
function texte(resume, entete = []) {
  const L = [...entete];
  L.push(`Jointure Écho ↔ Orbite : ${resume.cutsEcho} cuts en Écho, ${resume.cutsJournal} au journal, ${resume.cutsJoints} joints`
    + (resume.cutsJournalAbsentsDeLEcho ? `, ${resume.cutsJournalAbsentsDeLEcho} du journal absents de l'Écho` : '') + '.');
  if (resume.partiesEchoIgnorees.length) L.push(`Parties de l'Écho absentes du journal, ignorées : ${resume.partiesEchoIgnorees.join(', ')}.`);
  if (resume.projetsDifferents) L.push(`Cuts écartés (projets différents) : ${resume.projetsDifferents}.`);
  L.push(`Classes Ariane au journal : ${Object.entries(resume.cutsParClasse).map(([k, v]) => `${k} ${v}`).join(', ') || 'aucune'} (tous les cuts du journal, joints ou non).`);
  const r = resume.repereScene;
  L.push(r && r.calibre ? `Repère de scène : translation constante Écho − journal estimée sur ${r.paires} rails ; résidu médian ${f1(r.residuMedianMm)} mm, P90 ${f1(r.residuP90Mm)} mm.`
    : 'Repère de scène : non calibré (aucun cut posé des deux côtés) ; la base est la première visite de l\'Écho.');
  L.push(`Base de l'écart humain (--base ${resume.base}) : ${Object.entries(resume.bases).map(([k, v]) => `${k} ${v}`).join(', ') || 'aucune'}.`);
  L.push(`Repère de l'écart : profil pour ${resume.reperes.profil} rails, distance 3D seule pour ${resume.reperes['3D']} rails.`);
  for (const [classe, c] of Object.entries(resume.parClasse)) {
    L.push('', `Classe « ${classe} » : ${c.cuts} cuts en Écho (${c.avecReference} avec référence humaine, ${c.sansReference} sans référence).`);
    L.push(`  étiquettes Écho : ${Object.entries(c.etiquettesEcho).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
    L.push(`  écart 3D gauche : ${st(c.ecart3dMm.gauche)}`, `  écart 3D droit  : ${st(c.ecart3dMm.droite)}`, `  écart 3D rails  : ${st(c.ecart3dMm.rails)}`, `  écart 3D par cut (plus grand des deux rails) : ${st(c.ecart3dMm.parCut)}`);
    L.push(`  latéral |.| : ${st(c.ecartLateralAbsMm)}`, `  vertical |.| : ${st(c.ecartVerticalAbsMm)}`);
    L.push(`  corrections > 5 mm : ${c.corrections.sup5mm.cuts} cuts (${c.corrections.sup5mm.rails} rails) ; > 10 mm : ${c.corrections.sup10mm.cuts} cuts (${c.corrections.sup10mm.rails} rails)`);
  }
  if (Object.keys(resume.motifsDeDiffere).length) L.push('', `Motifs de différé (par rail, tous les cuts différés du journal) : ${Object.entries(resume.motifsDeDiffere).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  return L.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
function lireArguments(argv) {
  const a = { echo: [], journal: null, partie: null, sortie: null, csv: null, base: 'auto', poses: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--echo') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) a.echo.push(argv[++i]); }
    else if (k === '--journal') a.journal = argv[++i];
    else if (k === '--partie') { a.partie = Number(argv[++i]); if (!Number.isInteger(a.partie)) throw Error('--partie attend un entier.'); }
    else if (k === '--sortie') a.sortie = argv[++i];
    else if (k === '--csv') a.csv = argv[++i];
    else if (k === '--base') a.base = argv[++i];
    else if (k === '--sans-poses') a.poses = false;
    else throw Error(`Argument inconnu : ${k}`);
  }
  if (!a.echo.length || !a.journal) throw Error('Usage : node tools/jointure-echo-orbite.cjs --echo <dossier ou fichiers…> --journal <fichier> [--partie N] [--base auto|premiere|derniere] [--sortie table.json] [--csv table.csv] [--sans-poses]');
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv), avis = [];
  const echo = lireEcho(a.echo, { journal: m => avis.push(m) });
  const journal = lireJournal(a.journal);
  const { table, resume } = joindre(echo.records, journal, { partie: a.partie, base: a.base, poses: a.poses });
  resume.sources = { segmentsEcho: echo.segments.length, recordsEcho: echo.records.length, evenementsJournal: journal.events.length, recordsJournal: journal.records.length };
  const sortieJson = { format: 'ariane-jointure-echo-orbite-v1', creeLe: new Date().toISOString(), options: { partie: a.partie, base: a.base, poses: a.poses }, resume, table };
  if (a.sortie) { fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true }); fs.writeFileSync(a.sortie, JSON.stringify(sortieJson, null, 1)); }
  if (a.csv) { fs.mkdirSync(path.dirname(path.resolve(a.csv)), { recursive: true }); fs.writeFileSync(a.csv, enCsv(table)); }
  sortie(texte(resume, [`Sources : ${echo.segments.length} segment(s) Écho (${echo.records.length} records), journal de ${journal.events.length} événements.`, ...avis]));
  return sortieJson;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { joindre, resumer, lireEcho, lireJournal, lireArguments, executer, enCsv, texte, ecartRail, calibrerRepere, quantile, stat };
