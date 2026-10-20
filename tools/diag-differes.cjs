#!/usr/bin/env node
'use strict';
/*
 * diag-differes.cjs — DIAGNOSTIC EXHAUSTIF DES DIFFÉRÉS du lot Orbite (cap « différés −90 % », D-217). Étude HORS LIGNE, LECTURE SEULE :
 * rien n'est changé à l'extension, aucun réglage n'est modifié, aucune action dans ESV. On mesure où naissent les différés, ce qui les
 * cause, ce que chaque garde-fou coûte, et quelle pose aurait été possible.
 *
 *   node tools/diag-differes.cjs inventaire --journal J.json [--journal …] [--plan PLAN.json] [--json R.json] [--md R.md]
 *   node tools/diag-differes.cjs extraire   --partie P:N --journal J.json --corpus C.json [--corpus …] [--echo DOSSIER …] [--lot ID] --sortie CUTS.jsonl
 *                                           [--temoin] [--parametres datasets/gcv2-parametres-h6.json]
 *   node tools/diag-differes.cjs motifs     --cuts CUTS.jsonl [--cuts …] [--json R.json] [--md R.md]
 *   node tools/diag-differes.cjs gains      --cuts CUTS.jsonl [--cuts …] [--json R.json] [--md R.md]
 *   node tools/diag-differes.cjs gardes     --cuts CUTS.jsonl [--cuts …] [--json R.json] [--md R.md]
 *   node tools/diag-differes.cjs pistes     --cuts CUTS.jsonl [--cuts …] [--json R.json] [--md R.md]
 *
 * DÉFINITIONS (fiches/DIAG_DIFFERES.md § 1).
 *  - Un LOT est une exécution d'Orbite (`batchId`) sur une partie. Un journal exporté peut contenir plusieurs lots, et le même lot peut se
 *    trouver dans plusieurs exports : on garde la copie qui a le plus de décisions.
 *  - CUTS TRAITÉS : cuts distincts décidés par le lot (`gcv1-shadow-observed` du lot, avant la relecture qui suit le lot).
 *  - POSÉ : la dernière décision du lot sur ce cut est suivie d'une validation du lot (`validation-accepted` du même lot, ou validation en
 *    place du dernier invalide). DIFFÉRÉ : traité et non posé. Taux de différés = différés / traités.
 *  - Lot REMPLACÉ : un lot dont tous les cuts sont décidés à nouveau par un lot suivant de la même partie (lot arrêté puis relancé) ; il
 *    est compté à part et n'entre pas dans la base.
 *  - MOTIF d'un différé : lu dans la décision du lot (`lotObservation` : étage, raison, commande) et dans la science du moteur (statut et
 *    motif de chaque rail, garde d'écartement de paire). Il dit l'ÉTAGE qui a refusé (moteur, chaîne du lot, commande, validation, règle
 *    métier) et la GARDE.
 *
 * EXTRAIRE (calcul lourd, une partie à la fois). Réutilise `tools/gcv2-predire-differes.cjs` (état du lot avant la relecture, zones à l'instant
 * de la décision, hypothèses H0 à H6 de `tools/gcv2-jeu.cjs`, voie de référence de la série) et ajoute, pour chaque différé :
 *  - le REJEU CONTREFACTUEL de la décision du lot, une garde éteinte à la fois (même capture, mêmes appuis, `L.decideCut` avec ses options) ;
 *  - la GCV2 (paramètres figés) sous plusieurs jeux de garde-fous (V1+ tel que déclaré, sans preuve de voie, sans support, sans 45 mm, sans τ,
 *    sans δ…), sans rien apprendre ;
 *  - avec un Écho (`--echo`) : la pose finale de l'opérateur expert (même lecture que `gcv2-predire-differes comparer`), la pose de départ contrôlée
 *    (écartement à 2 mm), l'écart de chaque hypothèse et de chaque contrefactuel à cette pose.
 * Sortie JSON lignes HORS DÉPÔT : des millimètres dans le repère profil de la pose de départ, des numéros de cut, des comptes ; aucune
 * coordonnée absolue, aucun identifiant de projet.
 *
 * MOTIFS, GAINS, GARDES, PISTES : agrégations pures des fichiers d'EXTRAIRE (tables markdown et JSON).
 */
const fs = require('node:fs'), path = require('node:path');

const FORMAT_INVENTAIRE = 'ariane-diag-differes-inventaire-v1', FORMAT_CUTS = 'ariane-diag-differes-cuts-v1';
const VERSION = 'diag-differes-1';
const SIDES = ['left', 'right'];
const ZONES = Object.freeze(['pn', 'adv', 'abords', 'hors']);
const SEUILS = Object.freeze({ a10: 10, a20: 20, a50: 50, departEcartementMm: 2, defautEsvMm: 1500, defautToleranceMm: 0.5 });
const TYPES_RELECTURE = Object.freeze(['relecture-debut', 'relecture-ombre', 'relecture-fin']);
const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const t = x => Date.parse(x || '');
const med = a => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const part = (k, n) => n ? arrondi(100 * k / n, 1) : null;
const parse = x => { if (typeof x !== 'string') return x; try { return JSON.parse(x); } catch { return null; } };

/* ================================================================== 1. lots d'un journal */
/* Motif d'un différé, depuis la dernière décision du lot sur le cut et la science du moteur consignée avec elle.
 * Rend { etage, garde, code, detail, moteur: { resolus, paireHorsContrat, motifs: { left, right } } }. */
function classerMotif(lo, shadow, { regleMetier = false } = {}) {
  const sr = shadow && shadow.rails, sum = shadow && shadow.summary;
  const motifs = {}, statuts = {};
  for (const s of SIDES) { const n = sr && sr[s] && sr[s].next; statuts[s] = n ? n.status || null : null; motifs[s] = n ? (n.motif || n.status || null) : null; }
  const resolus = SIDES.filter(s => statuts[s] === 'candidate').length;
  const paireHorsContrat = !!(sum && sum.pairGaugeRejected);
  const moteur = { resolus, paireHorsContrat, motifs, applicable: resolus === 2 && !paireHorsContrat };
  const stage = lo && lo.stage, reason = lo && lo.reason != null ? String(lo.reason) : '', cmd = (lo && lo.command) || {};
  const out = (etage, garde, code, detail = null) => ({ etage, garde, code, detail, moteur });
  if (regleMetier || cmd.action === 'defer' && cmd.reason === 'regles-metier') return out('regle-metier', 'grappe-de-differes', 'regle-grappe');
  if (stage === 'deferred') {
    if (reason === 'first-pass-low-gauge') return out('chaine', 'ecartement-bas', 'ecartement-bas', lo.gaugeMm != null ? `${lo.gaugeMm} mm` : null);
    if (reason === 'pair-guard') return out('chaine', 'garde-de-paire', 'garde-de-paire');
    if (reason === 'gauge-guard') return out('chaine', 'ecartement-voisin', 'ecartement-voisin', lo.gaugeJumpMm != null ? `${lo.gaugeJumpMm} mm` : null);
    if (reason === 'no-anchor') return out(moteur.applicable ? 'chaine' : 'moteur', 'sans-appui', 'sans-appui', moteur.paireHorsContrat ? 'paire hors contrat' : `${resolus} rail(s) résolu(s)`);
    if (/^gauge-/.test(reason)) return out('chaine', 'contrat-ecartement', 'choix-hors-contrat', reason.slice(6));
    if (lo.guardDeferred && !reason) return out('chaine', 'continuite', 'garde-continuite');
    const parts = reason.split(/\s+/).filter(Boolean);
    if (parts.length && parts.every(p => /^(left|right):/.test(p))) {
      const r = parts.map(p => p.split(':')[1]);
      const code = r.includes('several-minima-near-prediction') ? 'reprise-plusieurs-minima' : r.includes('no-qualified-minimum-near-prediction') ? 'reprise-sans-minimum'
        : r.every(x => x === 'frame' || x === 'rsf') ? 'reprise-repere' : r.some(x => /^gauge-choice/.test(x)) ? 'reprise-plusieurs-minima' : 'reprise-autre';
      return out('chaine', 'reprise-et-choix', code, parts.map(p => p.replace('left:', 'G:').replace('right:', 'D:')).join(' '));
    }
    if (/^gauge-choice/.test(reason)) return out('chaine', 'reprise-et-choix', 'reprise-plusieurs-minima', reason);
    return out('chaine', 'autre', 'chaine-autre', reason || null);
  }
  /* Le lot avait une pose (premier passage, reprise, choix, ornière) : elle n'a pas été commandée ou pas validée. */
  if (cmd.action === 'defer') {
    if (/hors-vue/.test(cmd.reason || '')) return out('commande', 'hors-de-la-vue', 'hors-vue', `${stage} ; ${cmd.reason}`);
    if (cmd.reason === 'pair-guard') return out('chaine', 'garde-de-paire', 'garde-de-paire');
    if (cmd.reason === 'gauge-guard') return out('chaine', 'ecartement-voisin', 'ecartement-voisin');
    if (cmd.reason === 'guard') return out('chaine', 'continuite', 'garde-continuite');
    return out('commande', 'autre', 'commande-autre', `${stage} ; ${cmd.reason}`);
  }
  if (cmd.action === 'engine' && /hors-vue/.test(cmd.reason || '')) return out('commande', 'hors-de-la-vue', 'hors-vue', `${stage} ; ${cmd.reason}`);
  if (cmd.action === 'engine' && cmd.reason && cmd.reason !== 'first-pass' && cmd.reason !== stage) return out('commande', 'autre', 'commande-autre', `${stage} ; ${cmd.reason}`);
  return out('validation', 'validation', 'pose-non-validee', stage || null);
}

/* Lots d'un journal : pour chaque `batchId`, ses décisions, ses validations, sa coupure (premier événement de relecture du lot), son
 * périmètre (choix du lot) et, pour chaque cut traité, sa dernière décision et son sort. Rien d'autre n'est lu. */
function lotsDuJournal(journal) {
  const ev = Array.isArray(journal && journal.events) ? journal.events : [];
  const fiches = parse(journal && journal.fichesDepart) || [];
  const lots = new Map();
  const lot = id => { if (!lots.has(id)) lots.set(id, { id, debut: null, scope: null, decisions: [], validations: [], enPlace: [], relecture: [], regles: [], b1: [] }); return lots.get(id); };
  for (const e of ev) {
    if (!e || !fini(t(e.timestamp))) continue;
    if (e.type === 'batch-started' && e.batch && e.batch.id) { const L = lot(e.batch.id); L.debut = t(e.timestamp); L.scope = e.batch.scope || null; }
    else if (e.type === 'gcv1-shadow-observed' && e.batchId && e.lotObservation && e.identity && Number.isInteger(e.identity.cut)) lot(e.batchId).decisions.push(e);
    else if (e.type === 'validation-accepted' && e.batchId && e.identity && Number.isInteger(e.identity.cut)) lot(e.batchId).validations.push({ cut: e.identity.cut, part: e.identity.part, t: t(e.timestamp) });
    else if (TYPES_RELECTURE.includes(e.type) && e.batchId) lot(e.batchId).relecture.push(e);
    else if (e.type === 'regles-metier-ombre' && e.batchId && e.actif && e.actif.applique) lot(e.batchId).regles.push({ cut: e.identity && e.identity.cut, t: t(e.timestamp) });
    /* B1 (voisins validés de la liste d'ESV comme appuis), en ombre : la décision qu'il aurait prise. */
    else if (e.type === 'b1-ombre' && e.batchId && e.identity && Number.isInteger(e.identity.cut)) lot(e.batchId).b1.push({ cut: e.identity.cut, t: t(e.timestamp), etat: e.etat || null, regle: e.regle || null,
      stage: e.hypothese ? e.hypothese.stage || null : null, raison: e.hypothese && e.hypothese.reason != null ? String(e.hypothese.reason).slice(0, 60) : null, candidats: Array.isArray(e.candidats) ? e.candidats.length : null,
      gardes: Array.isArray(e.gardes) ? e.gardes.length : null, ecartPoseMm: fini(e.ecartPoseMm) ? arrondi(e.ecartPoseMm, 1) : null });
  }
  /* Validation en place du dernier invalide (ctrl-entrée) : sans identifiant de lot, rattachée au lot dont la fenêtre de temps la contient. */
  const enPlace = ev.filter(e => e && e.type === 'validation-en-place' && Number.isInteger(e.cut) && fini(t(e.timestamp)));
  const out = [];
  for (const L of lots.values()) {
    const ordre = (a, b) => t(a.timestamp) - t(b.timestamp) || String(a.eventId || '').localeCompare(String(b.eventId || ''));
    const coupure = L.relecture.length ? Math.min(...L.relecture.map(e => t(e.timestamp))) : Infinity;
    const dec = L.decisions.filter(e => t(e.timestamp) < coupure).sort(ordre);
    const partie = L.scope && Number.isInteger(L.scope.part) ? L.scope.part : dec.length ? dec[0].identity.part : null;
    if (!dec.length && !L.scope) continue;
    const t0 = L.debut ?? (dec.length ? t(dec[0].timestamp) : null), t1 = dec.length ? t(dec[dec.length - 1].timestamp) : t0;
    const vals = L.validations.filter(v => v.t < coupure && (v.part == null || v.part === partie));
    for (const e of enPlace) if (e.part === partie && t(e.timestamp) >= t0 && t(e.timestamp) <= t1 + 60000 && t(e.timestamp) < coupure) vals.push({ cut: e.cut, part: e.part, t: t(e.timestamp), enPlace: true });
    const derniere = new Map();
    for (const e of dec) derniere.set(e.identity.cut, e);
    const regles = new Set(L.regles.map(r => r.cut));
    const cuts = [...derniere.values()].map(e => {
      const v = vals.find(x => x.cut === e.identity.cut && x.t >= t(e.timestamp));
      const lo = e.lotObservation, cmd = lo.command || null;
      const c = { cut: e.identity.cut, t: t(e.timestamp), stage: lo.stage || null, reason: lo.reason != null ? String(lo.reason).slice(0, 120) : null,
        commande: cmd ? { action: cmd.action || null, raison: cmd.reason != null ? String(cmd.reason).slice(0, 60) : null } : null, pose: !!v, captureId: e.lidarCaptureId || null,
        decisions: dec.filter(x => x.identity.cut === e.identity.cut).length };
      if (!v) {
        c.motif = classerMotif(lo, e.shadow, { regleMetier: regles.has(c.cut) && cmd && cmd.action === 'defer' });
        const b = L.b1.filter(x => x.cut === c.cut && x.t >= t(e.timestamp)).sort((a, b2) => a.t - b2.t)[0];
        if (b) c.b1 = { etat: b.etat, regle: b.regle, stage: b.stage, raison: b.raison, candidats: b.candidats, gardes: b.gardes };
      }
      return c;
    }).sort((a, b) => a.t - b.t);
    /* Relecture après le lot : ce qu'elle a touché parmi les différés du lot. */
    const differes = new Set(cuts.filter(c => !c.pose).map(c => c.cut));
    const ombres = L.relecture.filter(e => e.type === 'relecture-ombre' && e.identity && Number.isInteger(e.identity.cut));
    const debutR = L.relecture.find(e => e.type === 'relecture-debut'), finR = L.relecture.find(e => e.type === 'relecture-fin');
    const relecture = debutR || ombres.length ? { mode: debutR ? debutR.mode || null : null, relus: new Set(ombres.map(e => e.identity.cut)).size,
      corriges: finR && fini(finR.corriges) ? finR.corriges : null, differesTouches: [...new Set(ombres.filter(e => differes.has(e.identity.cut)).map(e => e.identity.cut))].sort((a, b) => a - b),
      differesCorriges: [...new Set(ombres.filter(e => differes.has(e.identity.cut) && e.action === 'corrige').map(e => e.identity.cut))].sort((a, b) => a - b),
      refusSurDifferes: Object.fromEntries([...ombres.filter(e => differes.has(e.identity.cut) && e.action !== 'corrige').reduce((m, e) => { const k = (e.critere && e.critere.regle) || e.verdict || '?'; m.set(k, (m.get(k) || 0) + 1); return m; }, new Map())]),
      rolesTouches: [...new Set(ombres.map(e => e.role).filter(Boolean))].sort() } : null;
    const sc = L.scope || {};
    const fiche = fiches.filter(f => f && f.batchId === L.id).sort((a, b) => t(a.at) - t(b.at))[0] || null;
    out.push({ id: L.id, partie, debut: fini(t0) ? new Date(t0).toISOString() : null, dureeMin: fini(t0) && fini(t1) ? arrondi((t1 - t0) / 60000, 1) : null,
      version: sc.extensionVersion || (journal && journal.version) || null, sansDebut: !L.scope,
      reglages: { clic: sc.clicHumain || null, relecture: sc.relecture || null, regleGrappe: sc.regleGrappeDifferes ?? null, reprise: sc.lotReprise ? { depuis: String(sc.lotReprise.fromBatchId || '').slice(0, 8) || null, differes: sc.lotReprise.deferredCuts ?? null } : null, decisionLot: sc.lotDecision || null,
        nonResolus: sc.unresolvedPolicy || null, debutCut: sc.start ?? null, finCut: sc.end ?? null, finMode: sc.endMode || null },
      invalidesAuDepart: fiche ? fiche.invalides ?? null : null, totalPartie: fiche ? fiche.total ?? null : null,
      decisions: dec.length, traites: cuts.length, poses: cuts.filter(c => c.pose).length, differes: cuts.filter(c => !c.pose).length, relecture, cuts });
  }
  return out.sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
}

/* ================================================================== 2. inventaire (plusieurs journaux, plan des lots) */
/* `entrees` : [{ fichier, journal } ou { fichier, lotsPrets }] ; `plan` : { lots: [{ journal: nom de fichier, collection, projet, note }] } (facultatif).
 * Fusionne les copies d'un même lot (la plus complète), marque les lots remplacés, rend les lignes par lot et la base. */
function inventaire(entrees, plan = null) {
  const parId = new Map();
  for (const { fichier, journal, lotsPrets } of entrees) {
    const p = plan && (plan.journaux || []).find(x => x.journal === path.basename(fichier));
    for (const L of lotsPrets || lotsDuJournal(journal)) {
      /* Fichiers de lots plus anciens : le choix « Reprise » complet (avec ses appuis) est réduit à son origine et à son compte. */
      const rp = L.reglages && L.reglages.reprise;
      if (rp && rp.fromBatchId) L.reglages.reprise = { depuis: String(rp.fromBatchId).slice(0, 8), differes: rp.deferredCuts ?? null };
      const k = { ...L, journal: path.basename(fichier), collection: p ? p.collection : null, projet: p ? (p.projetParPartie && p.projetParPartie[String(L.partie)]) || p.projet || null : null,
        projetConfirme: p ? !(p.nonConfirmees || []).includes(L.partie) : null };
      const old = parId.get(L.id);
      if (!old || k.decisions > old.decisions || (k.decisions === old.decisions && old.sansDebut && !k.sansDebut)) parId.set(L.id, k);
    }
  }
  const lots = [...parId.values()].filter(L => L.decisions > 0).sort((a, b) => String(a.debut).localeCompare(String(b.debut)));
  /* Lot remplacé : tous ses cuts sont décidés à nouveau par un lot suivant de la même partie et du même projet. */
  for (const L of lots) {
    const apres = lots.filter(M => M !== L && M.partie === L.partie && M.projet === L.projet && String(M.debut) > String(L.debut));
    const cutsApres = new Set(apres.flatMap(M => M.cuts.map(c => c.cut)));
    L.remplace = L.cuts.length > 0 && apres.length > 0 && L.cuts.every(c => cutsApres.has(c.cut)) && L.poses === 0;
    /* Lot de reprise : déclaré comme tel (« Reprise »), ou la moitié au moins de ses cuts étaient des différés d'un lot précédent de la partie. */
    const avant = lots.filter(M => M !== L && M.partie === L.partie && M.projet === L.projet && String(M.debut) < String(L.debut));
    const differesAvant = new Set(avant.flatMap(M => M.cuts.filter(c => !c.pose).map(c => c.cut)));
    L.reprise = !L.remplace && (!!L.reglages.reprise || (avant.length > 0 && L.cuts.filter(c => differesAvant.has(c.cut)).length >= L.cuts.length / 2));
    /* Fragment : moins de 5 cuts traités, ou lot sans début dans aucune copie (reste d'un journal tronqué). */
    L.fragment = L.traites < 5 || L.sansDebut;
    L.dansLaBase = !L.remplace && !L.fragment;
    L.taux = L.traites ? arrondi(100 * L.differes / L.traites, 1) : null;
  }
  /* Net par partie : tous les lots non remplacés des parties qui ont au moins un lot dans la base (une partie faite d'un seul fragment n'y est pas). */
  const partiesDeBase = new Set(lots.filter(L => L.dansLaBase).map(L => `${L.projet}:${L.partie}`));
  const base = baseDesTaux(lots.filter(L => L.dansLaBase), lots.filter(L => !L.remplace && partiesDeBase.has(`${L.projet}:${L.partie}`)));
  return { format: FORMAT_INVENTAIRE, version: VERSION, lots, base };
}
/* Taux moyen de différés : non pondéré (moyenne des taux des lots) et pondéré (somme des différés / somme des traités), au total, par projet,
 * par version, et en net par partie (après les lots de reprise, fragments compris : un cut différé puis posé par une reprise est posé). */
function baseDesTaux(lots, tousLots = lots) {
  const groupe = liste => {
    const n = liste.length, traites = liste.reduce((s, L) => s + L.traites, 0), differes = liste.reduce((s, L) => s + L.differes, 0);
    return { lots: n, traites, differes, poses: traites - differes, tauxPondere: part(differes, traites), tauxMoyen: n ? arrondi(liste.reduce((s, L) => s + 100 * L.differes / L.traites, 0) / n, 1) : null,
      tauxMedian: arrondi(med(liste.map(L => 100 * L.differes / L.traites)), 1), differesMoyensParLot: n ? arrondi(differes / n, 1) : null };
  };
  const par = (cle) => { const m = new Map(); for (const L of lots) { const k = cle(L); if (!m.has(k)) m.set(k, []); m.get(k).push(L); } return Object.fromEntries([...m].sort().map(([k, v]) => [k, groupe(v)])); };
  /* Net par partie : dernier sort de chaque cut sur l'ensemble des lots de la partie. */
  const parties = new Map();
  for (const L of tousLots) {
    const k = `${L.projet ?? '?'}:${L.partie}`; if (!parties.has(k)) parties.set(k, new Map());
    const m = parties.get(k); for (const c of L.cuts) { const o = m.get(c.cut); if (!o || c.t >= o.t) m.set(c.cut, c); }
  }
  const net = [...parties].map(([k, m]) => { const v = [...m.values()]; return { partie: k, traites: v.length, differes: v.filter(c => !c.pose).length, taux: part(v.filter(c => !c.pose).length, v.length) }; })
    .sort((a, b) => a.partie.localeCompare(b.partie, 'fr', { numeric: true }));
  return { total: groupe(lots), parProjet: par(L => `projet ${L.projet ?? '?'}`), parVersion: par(L => L.version || '?'),
    parFamille: par(L => /^4\.9\.0\./.test(L.version || '') ? '4.9.0.x' : /^4\.9\.5\./.test(L.version || '') ? '4.9.5.x' : 'autre'),
    parProjetEtFamille: par(L => `projet ${L.projet ?? '?'}, ${/^4\.9\.0\./.test(L.version || '') ? '4.9.0.x' : '4.9.5.x'}`),
    premiersLots: groupe(lots.filter(L => !L.reprise)), reprises: groupe(lots.filter(L => L.reprise)),
    netParPartie: { parties: net, ...(() => { const tr = net.reduce((s, x) => s + x.traites, 0), d = net.reduce((s, x) => s + x.differes, 0); return { traites: tr, differes: d, tauxPondere: part(d, tr), tauxMoyen: net.length ? arrondi(net.reduce((s, x) => s + x.taux, 0) / net.length, 1) : null }; })() } };
}
const fmt = v => v == null ? '—' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
const pc = v => v == null ? '—' : `${fmt(v)} %`;
function tableMd(entetes, lignes) {
  return [`| ${entetes.join(' | ')} |`, `|${entetes.map((_, i) => i ? '--:' : '---').join('|')}|`, ...lignes.map(l => `| ${l.map(fmt).join(' | ')} |`)].join('\n');
}
function inventaireMd(R) {
  const L = R.lots.map(l => [`${l.projet ?? '?'}:${l.partie}${l.projetConfirme === false ? ' (projet non confirmé)' : ''}`, l.version, (l.debut || '').slice(0, 16).replace('T', ' '), l.id.slice(0, 8),
    l.remplace ? 'remplacé' : l.fragment ? 'fragment' : l.reprise ? 'reprise' : 'premier', l.reglages.clic || 'standard', l.reglages.relecture || '—', l.reglages.regleGrappe ? 'grappe active' : '—',
    l.invalidesAuDepart, l.traites, l.poses, l.differes, pc(l.taux)]);
  const g = (nom, x) => [nom, x.lots, x.traites, x.poses, x.differes, pc(x.tauxMoyen), pc(x.tauxMedian), pc(x.tauxPondere), x.differesMoyensParLot];
  const B = R.base;
  const lignesBase = [g('Base : tous les lots (hors remplacés et fragments)', B.total), g('Premiers lots d\'une partie', B.premiersLots), g('Lots de reprise', B.reprises),
    ...Object.entries(B.parProjet).map(([k, x]) => g(k, x)), ...Object.entries(B.parFamille).map(([k, x]) => g(k, x)), ...Object.entries(B.parProjetEtFamille).map(([k, x]) => g(k, x)),
    ...Object.entries(B.parVersion).map(([k, x]) => g(`version ${k}`, x))];
  return [`### Lots (${R.lots.length})`, '', tableMd(['Partie', 'Version', 'Début (UTC)', 'Lot', 'Rôle', 'Clic', 'Relecture', 'Règle', 'Invalides au départ', 'Traités', 'Posés', 'Différés', 'Taux'], L), '',
    '### Base des taux de différés', '', tableMd(['Groupe', 'Lots', 'Traités', 'Posés', 'Différés', 'Taux moyen (non pondéré)', 'Taux médian', 'Taux pondéré', 'Différés par lot'], lignesBase), '',
    `Net par partie (après reprises) : ${B.netParPartie.differes} différés sur ${B.netParPartie.traites} cuts traités, ${pc(B.netParPartie.tauxPondere)} (moyenne des parties ${pc(B.netParPartie.tauxMoyen)}).`].join('\n');
}

/* ================================================================== 3. extraire (rejeu causal d'une partie, une ligne par différé) */
/* Chargés à la demande : l'inventaire et les agrégations n'en ont pas besoin. */
let _m = null;
function modules() {
  if (_m) return _m;
  _m = { P: require('./gcv2-predire-differes.cjs'), G: require('./gcv2-jeu.cjs'), A: require('./gcv2-apprendre.cjs'), RA: require('./relecture-autonome.cjs'),
    L: require('../src/lot-decision.js'), Shadow: require('../src/gcv1-shadow.js'), C: require('../vendor/capture-core.js') };
  return _m;
}
const PARAMETRES = path.join(__dirname, '..', 'datasets', 'gcv2-parametres-h6.json');
const norme = v => Math.hypot(v[0], v[1], v[2]);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const r1v = v => Array.isArray(v) ? v.map(x => arrondi(x, 1)) : null;

/* État du lot avant la relecture, comme `gcv2-predire-differes.etatDuLot`, mais la coupure est celle des lots DE LA PARTIE : un export qui contient
 * une autre partie relue avant (2:10 puis 2:11 dans le même journal) ne coupe pas celle-ci. */
function etatPartie(journal, partie) {
  const { P } = modules();
  const ev = Array.isArray(journal && journal.events) ? journal.events : [];
  const lotsPartie = new Set(ev.filter(e => e && e.type === 'gcv1-shadow-observed' && e.identity && e.identity.part === partie && e.batchId).map(e => e.batchId));
  const tr = ev.filter(e => e && TYPES_RELECTURE.includes(e.type) && lotsPartie.has(e.batchId) && fini(t(e.timestamp))).map(e => t(e.timestamp));
  const coupure = tr.length ? Math.min(...tr) : Infinity;
  /* On réutilise etatDuLot sur un journal dont les seuls événements de relecture sont ceux des lots de la partie. */
  const filtre = { ...journal, events: ev.filter(e => !(e && TYPES_RELECTURE.includes(e.type)) || lotsPartie.has(e.batchId)) };
  const etat = P.etatDuLot(filtre, partie);
  const lots = [];
  for (const e of ev) if (e && e.type === 'gcv1-shadow-observed' && e.identity && e.identity.part === partie && e.lotObservation && fini(t(e.timestamp)) && t(e.timestamp) < coupure) { const b = String(e.batchId || ''); if (!lots.includes(b)) lots.push(b); }
  return { ...etat, coupureMs: coupure, lotIds: lots };
}

/* Science du moteur sans la garde d'écartement de paire (contrat 1 420–1 470 mm) : un rail retiré par cette seule garde reprend sa proposition
 * d'avant la garde. Copie : la science d'origine n'est pas touchée. */
function scienceSansContrat(science) {
  if (!science || !science.rails || !(science.summary && science.summary.pairGaugeRejected)) return null;
  const rails = {};
  for (const s of SIDES) {
    const r = science.rails[s]; rails[s] = r;
    if (!r || !r.ok || !r.next || r.next.status === 'candidate') continue;
    const avant = r.pairGauge && r.pairGauge.publishedBeforeGate && Array.isArray(r.pairGauge.publishedBeforeGate.delta) ? r.pairGauge.publishedBeforeGate.delta : Array.isArray(r.next.rawDelta) ? r.next.rawDelta : null;
    if (r.next.motif === 'gauge-out-of-contract' && avant) rails[s] = { ...r, next: { ...r.next, status: 'candidate', delta: avant.slice(0, 3) } };
  }
  return { ...science, rails, summary: { ...science.summary, pairGaugeRejected: false } };
}
/* Contrefactuels de la décision du lot : une garde éteinte à la fois (même capture, même science, mêmes appuis), puis toutes. */
const CONTREFACTUELS = Object.freeze({
  base: {}, gardeDePaire: { pairGuard: false }, ecartementVoisin: { gaugeGuardMm: null }, ecartementBas: { lowGaugeGuardMm: null },
  continuite: { guardMm: 1e9 }, voieEncadree: { framed: false }, choixSeuilPoints: { minTop: 0, minFace: 0 }, choixFenetre: { chooseMm: 45, maxDzMm: 45 },
  orniere: { crossing: false }, appuisLarges: { gap: 10 }, contratMoteur: { _contrat: true },
  toutes: { _contrat: true, pairGuard: false, gaugeGuardMm: null, lowGaugeGuardMm: null, guardMm: 1e9, minTop: 0, minFace: 0, chooseMm: 45, maxDzMm: 45, gap: 10 },
});
function contrefactuels(capture, science, appuis) {
  const { L, Shadow, RA } = modules(), out = {};
  for (const [nom, o] of Object.entries(CONTREFACTUELS)) {
    const { _contrat, ...options } = o;
    const sc = _contrat ? scienceSansContrat(science) : science;
    if (_contrat && !sc && nom !== 'toutes') { out[nom] = null; continue; }
    try {
      const d = L.decideCut({ capture, science: sc || science, anchors: appuis.slice(), Shadow, options });
      const pose = d.positions ? Object.fromEntries(SIDES.map(s => [s, r1v(RA.decalage(capture.rails[s], d.positions[s]))])) : null;
      out[nom] = { stage: d.stage, raison: d.reason != null ? String(d.reason).slice(0, 80) : null, pose };
    } catch (e) { out[nom] = { erreur: String(e && e.message || e).slice(0, 80) }; }
  }
  return out;
}

/* GCV2 sous plusieurs jeux de garde-fous (paramètres figés, rien n'est appris). `k` : le cas de `casDuDiffere` (garde « voie ») ; `p` : probabilités
 * calibrées p(10 mm) par rail et par hypothèse. Couloirs : « voie » (V1+ déclaré : voie de la série sûre, rails à 45 mm d'elle), « voie-sans-preuve »
 * (la voie de la série dès qu'elle existe, sans ses preuves), « voie-sans-support » (toutes les preuves sauf le support local des deux rails),
 * « depart » (45 mm depuis la pose de départ, comme pour les verts : la règle « jamais les différés » levée), « aucun ». Puis τ, δ et l'écartement
 * allumés ou éteints. Rend { cle: [etat, i, j] } avec cle = couloir|τ|δ|écartement (1 allumé, 0 éteint). */
const COULOIRS = Object.freeze(['voie', 'voie-sans-preuve', 'voie-sans-support', 'depart', 'aucun']);
function gcv2Variantes(k, p, seuils) {
  const { A } = modules(), G = A.GARDES, out = {};
  const L = k.rails.left.hyps, R = k.rails.right.hyps, i0 = k.i0.left, j0 = k.i0.right, r = k.voieRef;
  const motifsSauf = (sauf) => r ? (r.motifs || []).filter(m => !sauf.includes(m)) : ['aucune-voie'];
  const sure = { voie: !!(r && r.sure), 'voie-sans-preuve': !!r, 'voie-sans-support': !!r && !motifsSauf(['sans-support-local']).length };
  const lat = (s, h, couloir) => couloir.startsWith('voie') ? h.decal[1] - r[s][0] : h.decal[1];
  const zone = seuils[k.zone] || seuils.hors || { actif: false };
  for (const couloir of COULOIRS) {
    const permis = [];
    const voie = couloir.startsWith('voie');
    if (voie && !sure[couloir]) { /* sans voie sûre : aucune paire */ }
    else for (let i = 0; i < L.length; i++) for (let j = 0; j < R.length; j++) {
      if (i === i0 && j === j0) continue;
      const hl = L[i], hr = R[j];
      let okCouloir = true;
      if (couloir !== 'aucun') {
        if (Math.abs(lat('left', hl, couloir)) > G.lateralMaxMm || Math.abs(lat('right', hr, couloir)) > G.lateralMaxMm) okCouloir = false;
        const dev = voie ? (hl.decal[2] - hr.decal[2]) - (r.left[1] - r.right[1]) : hl.decal[2] - hr.decal[2];
        if (Math.abs(dev) > G.deversMaxMm) okCouloir = false;
      }
      if (!okCouloir) continue;
      const g = A.ecartementPaire(k, hl, hr);
      const okEcart = fini(g) && ((fini(k.gMed) && Math.abs(g - k.gMed) <= G.ecartementMedianeMm) || (g >= G.contratMm[0] && g <= G.contratMm[1]));
      permis.push({ i, j, ecart: Math.max(Math.abs(hl.decal[1]), Math.abs(hl.decal[2]), Math.abs(hr.decal[1]), Math.abs(hr.decal[2])), okEcart, v: p.left[i] * p.right[j] });
    }
    for (const e of [1, 0]) {
      const liste = permis.filter(q => !e || q.okEcart);
      let best = { i: i0, j: j0, v: p.left[i0] * p.right[j0], ecart: 0, h0: true };
      for (const q of liste) if (q.v > best.v) best = { ...q, h0: false };
      for (const tau of [1, 0]) for (const delta of [1, 0]) {
        let etat = 'laisse';
        const actif = tau ? zone.actif : true;
        if (!best.h0 && actif && (!delta || best.ecart >= zone.delta)) etat = !tau || best.v >= zone.tau ? 'agit' : 'abstient';
        out[`${couloir}|${tau}|${delta}|${e}`] = [etat, best.i, best.j, arrondi(best.v, 4)];
      }
    }
  }
  return out;
}

/* Une partie : tous les différés des lots de la partie présents dans le journal (ou du seul lot `--lot`). `captures` : Map captureId → capture ;
 * `mic` : Map cut → pose finale de l'opérateur (micDepuisEcho), facultatif ; `parametres` : objet de gcv2-parametres(-h6).json. */
function extrairePartie({ journal, captures, parametres, projet, partie, mic = null, lot = null, temoin = false, echoMeme = true, journalTexte = () => {} }) {
  const { P, G, A, RA } = modules();
  const designation = `${projet}:${partie}`, mod = P.modeleFige(parametres, 'lot');
  const etat = etatPartie(journal, partie), cutsTous = P.cutsDuLot(etat), Z = P.zonesCausales(cutsTous, etat.decisions, captures);
  const lotsJ = lotsDuJournal(journal).filter(Lx => Lx.partie === partie && (!lot || Lx.id.startsWith(lot)));
  const moteur = G.moteurAvecReservoir();
  const poseDe = new Map(etat.poses.map(x => [x.cut, x]));
  const valides = cutsTous.filter(c => c.valide && poseDe.has(c.cut)).sort((a, b) => a.tValide - b.tValide || a.cut - b.cut);
  const lignes = [];
  for (const Lx of lotsJ) {
    for (const cj of Lx.cuts.filter(c => !c.pose)) {
      /* La décision correspondante dans l'état (même cut, même instant). */
      const d = etat.decisions.find(x => x.cut === cj.cut && x.t === cj.t);
      if (!d) continue;
      const z = Z.parDecision.get(d.ordre), zone = P.zoneDe(z, d.cut), zFin = Z.finDeLot.get(d.lot);
      const avant = valides.filter(v => v.tValide < d.t);
      const appuis = [];
      for (const v of avant) if (v.appui) modules().L.rememberAnchor(appuis, { identity: { part: partie, cut: v.cut, frameId: null }, positions: { left: poseDe.get(v.cut).corrigee.left.slice(), right: poseDe.get(v.cut).corrigee.right.slice() }, stage: v.stage || 'first-pass' }, 40);
      const voisins = avant.map(v => { const q = poseDe.get(v.cut); return { identity: { part: partie, cut: v.cut, frameId: null }, positions: { left: q.corrigee.left.slice(), right: q.corrigee.right.slice() }, stage: 'verifie', source: 'lot',
        decalage: G.decalageDepuisEsv(q.initiale, q.corrigee, 'depart') }; });
      const gs = avant.map(v => { const q = poseDe.get(v.cut); return 1000 * modules().C.distance(q.corrigee.left, q.corrigee.right); }).filter(x => fini(x) && Math.abs(x - 1500) > 0.05), gMed = med(gs);
      /* Sort final du cut sur la partie : posé plus tard par un autre lot (reprise) ? */
      const final = cutsTous.find(c => c.cut === d.cut);
      const ligne = { type: 'differe', partie: designation, projet, temoin, echoMemeSeance: echoMeme, lot: Lx.id.slice(0, 8), version: Lx.version, cut: d.cut,
        lotJournal: { etage: cj.stage, raison: cj.reason, commande: cj.commande, appuis: d.appuis, decisions: cj.decisions },
        motif: cj.motif, zone, zoneDetail: { pn: z.pn, adv: z.adv }, zoneFinDeLot: zFin ? (P.zoneDe({ plagesPN: zFin.pn, plagesADV: zFin.adv }, d.cut)) : null,
        poseParUnAutreLot: !!(final && final.valide && final.t > d.t),
        contexte: { validesAvant: avant.length, voisinsA10Cuts: avant.filter(v => Math.abs(v.cut - d.cut) <= G.H6.fenetreCuts).length, appuisDeChaine: appuis.length, gMedMm: arrondi(gMed, 1) } };
      const cap = d.captureId ? captures.get(d.captureId) : null;
      ligne.nuage = P.avecNuage(cap);
      if (mic) ligne.mic = mic.get(d.cut) || { ref: null, raison: 'absent-de-l-echo' };
      if (!ligne.nuage) { ligne.etat = 'sans-nuage'; lignes.push(ligne); continue; }
      try {
        const entree = { identity: { part: partie, cut: d.cut, frameId: null }, rails: cap.rails, points: cap.pointsSceneRelative, visible: cap.visibleByClipBoxes };
        let brut = null;
        RA.poseAriane(entree, { appuis: { liste: appuis.slice() }, rappel: b => { brut = b; } });
        const science = moteur.scientificProposeBoth(brut.capture);
        const hyp = G.hypothesesDuCut({ capture: brut.capture, science, seul: brut.seul, chaine: brut.chaine, appuisAvant: brut.appuisAvant, voisins, gMed, voisinsLot: voisins, departEsv: null });
        const ancres = (hyp.voieH6 && hyp.voieH6.lot && hyp.voieH6.lot.ancres || []).map(a => a.cut), bornes = [d.cut, ...ancres], zmap = new Map();
        for (let x = Math.min(...bornes); x <= Math.max(...bornes); x++) zmap.set(x, { zone: z.plagesADV.some(([a, b]) => x >= a && x <= b) ? 'adv' : 'autre' });
        const voieRef = hyp.voieH6 ? G.avecRupture(hyp.voieH6.lot, d.cut, zmap) : null;
        const k = P.casDuDiffere({ designation, cut: d.cut, zone, hyp, gMed, voieRef });
        const pr = {}; for (const s of SIDES) pr[s] = Float64Array.from(k.rails[s].hyps.map(h => P.probas(mod, h.x).p10));
        const depart = hyp.cut.ecartDepartMm;
        ligne.etat = 'calcule';
        ligne.depart = { ecartementMm: arrondi(depart, 1), defautEsv: fini(depart) && Math.abs(depart - SEUILS.defautEsvMm) <= SEUILS.defautToleranceMm };
        ligne.rejeu = { etage: brut.chaine ? brut.chaine.decision.stage : brut.seul.decision.stage, raison: (brut.chaine ? brut.chaine.decision.reason : brut.seul.decision.reason) ?? null };
        ligne.rejeu.identiqueAuLot = ligne.rejeu.etage === cj.stage;
        ligne.voieSerie = voieRef ? { sure: !!voieRef.sure, motifs: voieRef.motifs, lat: { left: arrondi(voieRef.left[0], 1), right: arrondi(voieRef.right[0], 1) },
          latMaxMm: arrondi(Math.max(Math.abs(voieRef.left[0]), Math.abs(voieRef.right[0])), 1), n: voieRef.n, ancres: voieRef.ancres.map(a => a.cut) } : null;
        ligne.hyps = Object.fromEntries(SIDES.map(s => [s, k.rails[s].hyps.map((h, i) => ({ d: r1v(h.decal), o: h.origines.join('+'), h: h.hauteur ? 1 : 0, p: arrondi(pr[s][i], 4) }))]));
        ligne.i0 = k.i0;
        ligne.gcv2 = gcv2Variantes(k, pr, mod.seuils);
        ligne.contrefactuels = contrefactuels(brut.capture, brut.science, brut.appuisAvant);
      } catch (e) { ligne.etat = 'erreur'; ligne.erreur = String(e && e.message || e).slice(0, 160); journalTexte(`cut ${d.cut} : ${ligne.erreur}`); }
      lignes.push(ligne);
    }
  }
  const entete = { type: 'entete', format: FORMAT_CUTS, version: VERSION, partie: designation, temoin, echoMemeSeance: echoMeme,
    note: 'Diagnostic HORS DÉPÔT : décalages [long, lat, vert] en mm dans le repère profil de la pose de départ ; aucune coordonnée absolue, aucun identifiant de projet.',
    parametres: { version: parametres.version, date: parametres.date, seuils: mod.seuils }, coupureRelecture: Number.isFinite(etat.coupureMs), lots: lotsJ.map(x => ({ id: x.id.slice(0, 8), traites: x.traites, differes: x.differes })),
    avecEcho: !!mic, differes: lignes.length };
  return [entete, ...lignes];
}

/* ================================================================== 4. agrégations (pures : fichiers d'EXTRAIRE, inventaire) */
function lireCuts(textes) {
  const entetes = [], lignes = [];
  for (const texte of textes) for (const l of texte.split('\n')) {
    if (!l.trim()) continue; const o = JSON.parse(l);
    if (o.type === 'entete') { if (o.format !== FORMAT_CUTS) throw Error(`format ${FORMAT_CUTS} attendu`); entetes.push(o); } else if (o.type === 'differe') lignes.push(o);
  }
  return { entetes, lignes };
}
const erreurPose = (pose, mic) => Math.max(...SIDES.map(s => norme(moins(pose[s], mic[s]))));
const micMax = l => Math.max(...SIDES.map(s => norme(l.mic.rails[s])));
/* Un différé est JUGÉ quand l'opérateur a une pose finale, que le cut a été calculé, que la pose de départ de l'Écho est celle du lot (écartement à
 * 2 mm) et que le cut n'a pas été posé ensuite par un autre lot (sa pose de départ à l'Écho serait alors celle du lot). */
const departOk = l => !!(l.mic && l.mic.rails && l.depart && fini(l.mic.ecartDepartMm) && fini(l.depart.ecartementMm) && Math.abs(l.mic.ecartDepartMm - l.depart.ecartementMm) <= SEUILS.departEcartementMm);
const juge = l => l.etat === 'calcule' && !l.poseParUnAutreLot && departOk(l);
const poseHyp = (l, i, j) => ({ left: l.hyps.left[i].d, right: l.hyps.right[j].d });
/* Meilleure hypothèse (oracle, rappel atteignable) : chaque rail prend son hypothèse la plus proche de l'opérateur. */
function oracle(l) {
  const r = {};
  for (const s of SIDES) { let best = null; l.hyps[s].forEach((h, i) => { const e = norme(moins(h.d, l.mic.rails[s])); if (!best || e < best.e) best = { e, i, o: h.o }; }); r[s] = best; }
  return { e: Math.max(r.left.e, r.right.e), i: r.left.i, j: r.right.i, origines: { left: r.left.o, right: r.right.o }, pire: r.left.e >= r.right.e ? 'left' : 'right' };
}
const classe = e => !fini(e) ? null : e <= SEUILS.a10 ? 'a10' : e <= SEUILS.a20 ? 'a20' : e <= SEUILS.a50 ? 'a50' : 'plus50';
const CLE_TOUT = 'aucun|0|0|0';
/* Pose d'une variante de la GCV2 (null si elle laisse ou s'abstient). */
function poseGcv2(l, cle) { const v = l.gcv2 && l.gcv2[cle]; if (!v || v[0] !== 'agit') return null; return poseHyp(l, v[1], v[2]); }
/* La meilleure paire selon la GCV2, sans garde-fou ni seuil (null si c'est la pose de départ). */
function meilleureGcv2(l) { const v = l.gcv2 && l.gcv2[CLE_TOUT]; if (!v || (v[1] === l.i0.left && v[2] === l.i0.right)) return null; return poseHyp(l, v[1], v[2]); }

function stats(liste) {
  const n = liste.length, c = k => liste.filter(k).length;
  return { n, a10: c(x => x.e <= 10), a20: c(x => x.e <= 20), a50: c(x => x.e <= 50), plus50: c(x => x.e > 50), ameliore: c(x => x.e < x.depart - 0.5), pire: c(x => x.e > x.depart + 0.5),
    medianeMm: arrondi(med(liste.map(x => x.e)), 1), gainMedianMm: arrondi(med(liste.map(x => x.depart - x.e)), 1), departMedianMm: arrondi(med(liste.map(x => x.depart)), 1) };
}
const grouper = (lignes, cle) => { const m = new Map(); for (const l of lignes) { const k = cle(l); if (!m.has(k)) m.set(k, []); m.get(k).push(l); } return [...m].sort((a, b) => b[1].length - a[1].length || String(a[0]).localeCompare(String(b[0]))); };
const projetDe = l => `projet ${l.projet}`;

/* ---- MOTIFS (étape 2) */
function motifs(lignes, inv = null) {
  const out = { differes: lignes.length, calcules: lignes.filter(l => l.etat === 'calcule').length, sansNuage: lignes.filter(l => l.etat === 'sans-nuage').length, erreurs: lignes.filter(l => l.etat === 'erreur').length };
  const c = lignes.filter(l => l.etat === 'calcule');
  out.rejeuIdentique = c.filter(l => l.rejeu && l.rejeu.identiqueAuLot).length;
  const parMotif = (liste) => grouper(liste, l => l.motif ? l.motif.code : '?').map(([k, v]) => ({ motif: k, n: v.length, ...Object.fromEntries(['pn', 'adv', 'abords'].map(z => [z, v.filter(l => l.zone === z).length])),
    sansNuage: v.filter(l => l.etat === 'sans-nuage').length }));
  out.parMotif = parMotif(lignes);
  out.parProjet = Object.fromEntries(grouper(lignes, projetDe).map(([k, v]) => [k, { n: v.length, parMotif: parMotif(v), parZone: Object.fromEntries(['pn', 'adv', 'abords'].map(z => [z, v.filter(l => l.zone === z).length])) }]));
  out.parEtage = Object.fromEntries(grouper(lignes, l => l.motif ? l.motif.etage : '?').map(([k, v]) => [k, v.length]));
  out.parZone = Object.fromEntries(grouper(lignes, l => l.zone).map(([k, v]) => [k, v.length]));
  out.parZoneFinDeLot = Object.fromEntries(grouper(lignes, l => l.zoneFinDeLot || '?').map(([k, v]) => [k, v.length]));
  /* Motifs du moteur sous « sans appui » et rails résolus. */
  out.moteur = { resolus: Object.fromEntries(grouper(lignes, l => l.motif ? l.motif.moteur.resolus : '?').map(([k, v]) => [k, v.length])),
    paireHorsContrat: lignes.filter(l => l.motif && l.motif.moteur.paireHorsContrat).length,
    motifsRails: Object.fromEntries(grouper(lignes.flatMap(l => l.motif ? SIDES.map(s => l.motif.moteur.motifs[s] || '?') : []), x => x).map(([k, v]) => [k, v.length])) };
  out.depart = { defautEsv: c.filter(l => l.depart && l.depart.defautEsv).length, autre: c.filter(l => l.depart && !l.depart.defautEsv).length,
    ecartementMedianHorsDefautMm: arrondi(med(c.filter(l => l.depart && !l.depart.defautEsv).map(l => l.depart.ecartementMm)), 1) };
  const vs = c.filter(l => l.voieSerie);
  out.voieSerie = { existe: vs.length, sure: vs.filter(l => l.voieSerie.sure).length, absente: c.length - vs.length,
    latMedianeMm: arrondi(med(vs.map(l => l.voieSerie.latMaxMm)), 1), latPlus45: vs.filter(l => l.voieSerie.latMaxMm > 45).length, latPlus100: vs.filter(l => l.voieSerie.latMaxMm > 100).length,
    motifs: Object.fromEntries(grouper(vs.flatMap(l => l.voieSerie.motifs), x => x).map(([k, v]) => [k, v.length])) };
  const orig = l => new Set(SIDES.flatMap(s => l.hyps[s].flatMap(h => h.o.split('+'))));
  out.hypotheses = Object.fromEntries(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].map(h => [h, c.filter(l => orig(l).has(h)).length]));
  out.hypotheses.aucuneHorsH0 = c.filter(l => SIDES.some(s => l.hyps[s].every(h => h.o === 'H0'))).length;
  out.hypotheses.medianeParRail = arrondi(med(c.flatMap(l => SIDES.map(s => l.hyps[s].length))), 1);
  out.contexte = { sansValideA10Cuts: c.filter(l => l.contexte.voisinsA10Cuts === 0).length, sansAppuiDeChaine: c.filter(l => l.contexte.appuisDeChaine === 0).length };
  out.relecture = inv ? (() => { const L = inv.lots.filter(x => x.dansLaBase && x.relecture), som = f => L.reduce((a, x) => a + f(x.relecture), 0);
    return { lotsRelus: L.length, differesVisites: som(r => r.differesTouches.length), differesCorriges: som(r => (r.differesCorriges || []).length),
      differesDesLotsRelus: L.reduce((a, x) => a + x.differes, 0) }; })() : null;
  /* Base complète (inventaire) : motifs de TOUS les différés des lots de la base, calculés ou non (2:18 compris). */
  if (inv) {
    const tous = inv.lots.filter(x => x.dansLaBase).flatMap(x => x.cuts.filter(k => !k.pose).map(k => ({ ...k, projet: x.projet })));
    out.base = { n: tous.length, parMotif: grouper(tous, k => k.motif.code).map(([k, v]) => ({ motif: k, n: v.length, projet1: v.filter(x => x.projet === 1).length, projet2: v.filter(x => x.projet === 2).length })),
      parEtage: Object.fromEntries(grouper(tous, k => k.motif.etage).map(([k, v]) => [k, v.length])),
      b1: { consigne: tous.filter(k => k.b1).length, calcule: tous.filter(k => k.b1 && k.b1.etat === 'calcule').length,
        poserait: tous.filter(k => k.b1 && k.b1.stage && k.b1.stage !== 'deferred').length,
        parStage: Object.fromEntries(grouper(tous.filter(k => k.b1), k => `${k.b1.etat}|${k.b1.regle}|${k.b1.stage}`).map(([k, v]) => [k, v.length])),
        parMotif: Object.fromEntries(grouper(tous.filter(k => k.b1 && k.b1.stage && k.b1.stage !== 'deferred'), k => k.motif.code).map(([k, v]) => [k, v.length])) },
      sansAppuiParMoteur: Object.fromEntries(grouper(tous.filter(k => k.motif.code === 'sans-appui'), k => k.motif.moteur.paireHorsContrat ? 'paire hors contrat' : `${k.motif.moteur.resolus} rail(s) résolu(s)`).map(([k, v]) => [k, v.length])) };
  }
  return out;
}

/* ---- GAINS (étape 3) */
const HORS_ECHANTILLON = Object.freeze(['2:6', '2:7', '2:13']);
function gains(lignes) {
  const avecMic = lignes.filter(l => l.mic && l.mic.rails);
  const J = lignes.filter(juge);
  const nonJuges = { sansNuage: avecMic.filter(l => l.etat === 'sans-nuage').length, poseParUnAutreLot: avecMic.filter(l => l.etat === 'calcule' && l.poseParUnAutreLot).length,
    departDifferent: avecMic.filter(l => l.etat === 'calcule' && !l.poseParUnAutreLot && !departOk(l)).length, sansReferenceMic: lignes.filter(l => l.mic && !l.mic.rails).length };
  const detail = J.map(l => {
    const depart = micMax(l), o = oracle(l), g = meilleureGcv2(l), eg = g ? erreurPose(g, l.mic.rails) : depart;
    const v1p = poseGcv2(l, 'voie|1|1|1');
    return { partie: l.partie, lot: l.lot, cut: l.cut, projet: l.projet, temoin: !!l.temoin, memeSeance: l.echoMemeSeance !== false, motif: l.motif.code, zone: l.zone, depart: arrondi(depart, 1),
      oracle: arrondi(o.e, 1), origines: o.origines, gcv2: arrondi(eg, 1), gcv2Pose: !!g, v1p: v1p ? arrondi(erreurPose(v1p, l.mic.rails), 1) : null, h6Present: SIDES.some(s => l.hyps[s].some(h => /H6/.test(h.o))) };
  });
  const bloc = liste => {
    const o = stats(liste.map(x => ({ e: x.oracle, depart: x.depart }))), g = stats(liste.map(x => ({ e: x.gcv2, depart: x.depart })));
    return { n: liste.length, departMedianMm: o.departMedianMm, departPlus10: liste.filter(x => x.depart > 10).length, departA10: liste.filter(x => x.depart <= 10).length,
      rappel10: o.a10, rappel20: o.a20, rappel50: o.a50, oracleAmeliore: o.ameliore, perdusDAvance: o.plus50, oracleGainMedianMm: o.gainMedianMm,
      gcv2: { pose: liste.filter(x => x.gcv2Pose).length, a10: g.a10, a20: g.a20, plus50: g.plus50, ameliore: g.ameliore, pire: g.pire, medianeMm: g.medianeMm, gainMedianMm: g.gainMedianMm },
      v1p: { agit: liste.filter(x => x.v1p != null).length, a10: liste.filter(x => x.v1p != null && x.v1p <= 10).length, plus50: liste.filter(x => x.v1p != null && x.v1p > 50).length } };
  };
  const principal = detail.filter(x => x.memeSeance && !x.temoin);
  const origines = Object.fromEntries(grouper(principal.flatMap(x => SIDES.map(s => x.origines[s].split('+').sort().join('+'))), x => x).map(([k, v]) => [k, v.length]));
  return { avecMic: avecMic.length, juges: J.length, nonJuges,
    principal: { ...bloc(principal), parMotif: grouper(principal, x => x.motif).map(([k, v]) => ({ motif: k, ...bloc(v) })), parZone: grouper(principal, x => x.zone).map(([k, v]) => ({ zone: k, ...bloc(v) })),
      parProjet: grouper(principal, x => `projet ${x.projet}`).map(([k, v]) => ({ projet: k, ...bloc(v) })), parPartie: grouper(principal, x => x.partie).map(([k, v]) => ({ partie: k, ...bloc(v) })),
      originesDeLaMeilleure: origines, h6Present: principal.filter(x => x.h6Present).length },
    /* Parties sur lesquelles les paramètres de la GCV2 n'ont pas été appris (le choix de la GCV2 y est hors échantillon). */
    horsEchantillon: bloc(principal.filter(x => HORS_ECHANTILLON.includes(x.partie))), dansEchantillon: bloc(principal.filter(x => !HORS_ECHANTILLON.includes(x.partie))),
    autreSeance: { ...bloc(detail.filter(x => !x.memeSeance && !x.temoin)), parPartie: grouper(detail.filter(x => !x.memeSeance && !x.temoin), x => x.partie).map(([k, v]) => ({ partie: k, n: v.length })) },
    temoins: bloc(detail.filter(x => x.temoin)), detail };
}

/* ---- GARDES (étape 4) */
const GARDES_LOT = Object.freeze([
  { cf: 'contratMoteur', nom: 'contrat d\'écartement du moteur (1 420–1 470 mm, paire hors contrat)', premier: l => l.motif.moteur.paireHorsContrat && ['sans-appui', 'reprise-sans-minimum', 'reprise-plusieurs-minima', 'reprise-repere', 'choix-hors-contrat'].includes(l.motif.code) },
  { cf: 'appuisLarges', nom: 'appuis à 3 cuts au plus (« sans appui » : pas de reprise depuis la voie)', premier: l => l.motif.code === 'sans-appui' && !l.motif.moteur.paireHorsContrat },
  { cf: 'gardeDePaire', nom: 'garde de paire (rail repêché par S1 et calage hors domaine, D-044)', premier: l => l.motif.code === 'garde-de-paire' },
  { cf: 'continuite', nom: 'garde de continuité (30 mm de la voie)', premier: l => l.motif.code === 'garde-continuite' },
  { cf: 'ecartementVoisin', nom: 'garde d\'écartement voisin (20 mm)', premier: l => l.motif.code === 'ecartement-voisin' },
  { cf: 'ecartementBas', nom: 'garde d\'écartement bas (1 420 mm, D-060)', premier: l => l.motif.code === 'ecartement-bas' },
  { cf: 'choixSeuilPoints', nom: 'seuil de points du minimum choisi (paire sous le seuil : 5 dessus, 3 flanc)', premier: l => l.motif.code === 'reprise-sans-minimum' && !l.motif.moteur.paireHorsContrat },
  { cf: 'choixFenetre', nom: 'fenêtre du choix (15 mm en travers, 20 mm en hauteur, minimum unique)', premier: l => l.motif.code === 'reprise-plusieurs-minima' && !l.motif.moteur.paireHorsContrat },
  { cf: 'voieEncadree', nom: 'voie encadrée (appuis des deux côtés)', premier: () => false },
  { cf: 'orniere', nom: 'lecture de l\'ornière au PN (dernier recours)', premier: () => false },
]);
const GARDES_COMMANDE = Object.freeze([
  { code: 'hors-vue', nom: 'cible hors de la vue d\'ESV (commande)' }, { code: 'regle-grappe', nom: 'règle métier « grappe de différés »' }, { code: 'pose-non-validee', nom: 'pose commandée, validation non constatée' },
  { code: 'commande-autre', nom: 'commande non relue (autre)' },
]);
/* GCV2 sur les différés : un garde-fou levé à la fois depuis V1+ (« seul »), et ce qu'il refuse quand tout le reste est ouvert (« refuse »). */
const GARDES_GCV2 = Object.freeze([
  { nom: 'règle « jamais les différés » (V1) : les différés traités comme les verts (45 mm depuis le départ)', strict: 'voie|1|1|1', leve: 'depart|1|1|1', ouvert: null },
  { nom: 'preuve de voie de série (H6 : appuis, accord, proximité, support, concurrente, rupture)', strict: 'voie|1|1|1', leve: 'voie-sans-preuve|1|1|1', ouvert: null },
  { nom: 'support local des deux rails (preuve de voie)', strict: 'voie|1|1|1', leve: 'voie-sans-support|1|1|1', ouvert: null },
  { nom: '45 mm en travers depuis la pose de départ (couloir des verts)', strict: 'depart|1|1|1', leve: 'aucun|1|1|1', ouvert: ['aucun|0|0|0', 'depart|0|0|0'] },
  { nom: 'τ (seuil de probabilité par zone)', strict: 'depart|1|1|1', leve: 'depart|0|1|1', ouvert: ['aucun|0|0|0', 'aucun|1|0|0'] },
  { nom: 'δ (déplacement minimal par zone)', strict: 'depart|1|1|1', leve: 'depart|1|0|1', ouvert: ['aucun|0|0|0', 'aucun|0|1|0'] },
  { nom: 'écartement de la paire (médiane ± 15 mm ou contrat)', strict: 'depart|1|1|1', leve: 'depart|1|1|0', ouvert: ['aucun|0|0|0', 'aucun|0|0|1'] },
]);
function gardes(lignes, inv = null) {
  const c = lignes.filter(l => l.etat === 'calcule' && l.contrefactuels);
  const judge = (l, pose) => juge(l) && l.echoMemeSeance !== false && !l.temoin && pose ? erreurPose(pose, l.mic.rails) : null;
  const bilan = (liste, poseDe) => { const e = liste.map(l => ({ l, e: judge(l, poseDe(l)) })).filter(x => x.e != null);
    return { juges: e.length, a10: e.filter(x => x.e <= 10).length, a20: e.filter(x => x.e <= 20).length, plus50: e.filter(x => x.e > 50).length, ameliore: e.filter(x => x.e < micMax(x.l) - 0.5).length,
      gainMedianMm: arrondi(med(e.map(x => micMax(x.l) - x.e)), 1) }; };
  const pose = (l, cf) => { const x = l.contrefactuels[cf]; return x && x.pose && x.stage !== 'deferred' ? x.pose : null; };
  const lot = GARDES_LOT.map(G => {
    const premier = c.filter(l => G.premier(l)), seul = c.filter(l => pose(l, G.cf) && !pose(l, 'base'));
    return { garde: G.nom, cf: G.cf, premier: premier.length, seul: seul.length, seulEtPremier: seul.filter(l => G.premier(l)).length, refusJuges: bilan(seul, l => pose(l, G.cf)) };
  });
  /* « Seul » : éteindre cette garde seule fait poser un cut que la décision rejouée (« base ») ne pose pas. Un cut que la décision rejouée pose
   * déjà (cible hors de la vue, validation non constatée, rejeu différent du lot) relève de la commande, pas d'une garde du lot. */
  const toutes = c.filter(l => pose(l, 'toutes') && !pose(l, 'base'));
  const basePose = c.filter(l => pose(l, 'base'));
  const commande = GARDES_COMMANDE.map(G => { const v = c.filter(l => l.motif.code === G.code); return { garde: G.nom, code: G.code, premier: v.length, avecPose: v.filter(l => pose(l, 'base')).length, refusJuges: bilan(v, l => pose(l, 'base')) }; });
  const g2 = GARDES_GCV2.map(G => {
    const seul = c.filter(l => poseGcv2(l, G.leve) && !poseGcv2(l, G.strict));
    const refuse = G.ouvert ? c.filter(l => poseGcv2(l, G.ouvert[0]) && !poseGcv2(l, G.ouvert[1])) : [];
    return { garde: G.nom, strict: G.strict, leve: G.leve, seul: seul.length, seulJuges: bilan(seul, l => poseGcv2(l, G.leve)), refuseQuandToutEstOuvert: refuse.length, refuseJuges: G.ouvert ? bilan(refuse, l => poseGcv2(l, G.ouvert[0])) : null };
  });
  /* Classement : poses justes (≤ 10 mm) évitées, puis rapport « justes évitées / mauvaises (> 50 mm) évitées ». */
  const cle = x => { const j = x.refusJuges || x.seulJuges; return [j.a10, j.a10 / Math.max(1, j.plus50)]; };
  const classement = [...lot.map(x => ({ etage: 'lot', ...x })), ...commande.map(x => ({ etage: 'commande', ...x })), ...g2.map(x => ({ etage: 'GCV2', ...x, refusJuges: x.seulJuges, premier: null }))]
    .sort((a, b) => cle(b)[0] - cle(a)[0] || cle(b)[1] - cle(a)[1]);
  const relecture = inv ? inv.lots.filter(x => x.dansLaBase && x.relecture).map(x => ({ partie: `${x.projet}:${x.partie}`, lot: x.id.slice(0, 8), mode: x.relecture.mode, relus: x.relecture.relus, differes: x.differes,
    differesTouches: x.relecture.differesTouches.length, differesCorriges: (x.relecture.differesCorriges || []).length, refus: x.relecture.refusSurDifferes || null })) : null;
  return { calcules: c.length, lot, toutesLesGardesDuLot: { poses: toutes.length, juges: bilan(toutes, l => pose(l, 'toutes')) }, rejeuQuiPose: { n: basePose.length, parMotif: Object.fromEntries(grouper(basePose, l => l.motif.code).map(([k, v]) => [k, v.length])) }, commande, gcv2: g2, classement, relecture };
}

/* ---- PISTES (étape 5) */
function pistes(lignes, baseDifferes) {
  const c = lignes.filter(l => l.etat === 'calcule');
  const groupeJuge = l => l.partie === '2:1' ? '2:1' : HORS_ECHANTILLON.includes(l.partie) ? 'hors échantillon (2:6, 2:7)' : `projet ${l.projet}${l.projet === 2 ? ' sans 2:1' : ''}`;
  const evalue = (nom, poseDe, { valide = true, note = '' } = {}) => {
    const posees = c.filter(l => poseDe(l));
    const jl = posees.filter(l => juge(l) && l.echoMemeSeance !== false && !l.temoin);
    const j = jl.map(l => ({ e: erreurPose(poseDe(l), l.mic.rails), depart: micMax(l), g: groupeJuge(l) }));
    const st = stats(j);
    return { piste: nom, valide, note, poses: posees.length, partDeLaBase: part(valide ? posees.length : 0, baseDifferes), partDesCalcules: part(posees.length, c.length), juges: st.n,
      a10: st.a10, a20: st.a20, plus50: st.plus50, partPlus50: part(st.plus50, st.n), ameliore: st.ameliore, pire: st.pire, gainMedianMm: st.gainMedianMm, erreurMedianeMm: st.medianeMm,
      parGroupe: Object.fromEntries(grouper(j, x => x.g).map(([k, v]) => [k, stats(v)])) };
  };
  /* Contrefactuel du lot : seulement les poses NOUVELLES (un cut que la décision rejouée pose déjà relève de la commande, piste d). */
  const cf = nom => l => { const x = l.contrefactuels && l.contrefactuels[nom], b = l.contrefactuels && l.contrefactuels.base;
    return x && x.pose && x.stage !== 'deferred' && !(b && b.pose && b.stage !== 'deferred') ? x.pose : null; };
  const cfBase = l => { const b = l.contrefactuels && l.contrefactuels.base; return b && b.pose && b.stage !== 'deferred' ? b.pose : null; };
  const out = [
    evalue('(a) poser sans valider : meilleure hypothèse de la GCV2, sans garde-fou ni seuil, cut laissé invalide', meilleureGcv2, { valide: false, note: 'le différé reste, sa pose de départ est remplacée' }),
    evalue('(b) valider et inscrire aux verts à contrôler : même pose, validée', meilleureGcv2),
    evalue('(b\') idem, écartement de paire gardé', l => poseGcv2(l, 'aucun|0|0|1')),
    evalue('(b\'\') idem, couloir de 45 mm depuis le départ et écartement gardés, sans τ ni δ', l => poseGcv2(l, 'depart|0|0|1')),
    evalue('GCV2 V1+ telle que déclarée (voie de série sûre, τ, δ)', l => poseGcv2(l, 'voie|1|1|1')),
    evalue('GCV2 V1+ sans preuve de voie (τ, δ gardés)', l => poseGcv2(l, 'voie-sans-preuve|1|1|1')),
    evalue('GCV2 aux règles des verts (45 mm, τ, δ, écartement)', l => poseGcv2(l, 'depart|1|1|1')),
    evalue('GCV2 sans couloir de 45 mm, τ, δ et écartement gardés', l => poseGcv2(l, 'aucun|1|1|1')),
    ...GARDES_LOT.filter(G => !['voieEncadree', 'orniere'].includes(G.cf)).map(G => evalue(`(c) lot : ${G.nom} éteinte seule`, cf(G.cf))),
    evalue('(c) lot : toutes les gardes du lot éteintes ensemble', cf('toutes')),
    evalue('(c+) toutes les gardes du lot éteintes, puis la GCV2 sans garde-fou sur le reste', l => cf('toutes')(l) || meilleureGcv2(l)),
    evalue('(d) rails hors de la vue : la pose du lot, si la caméra est déplacée', l => l.motif.code === 'hors-vue' ? cfBase(l) : null),
    evalue('(d\') toute pose déjà décidée par le lot mais non commandée ou non validée', cfBase),
  ];
  /* Combinaisons (approchées : l'union des contrefactuels pris un à un, pas leur rejeu conjoint) : les gardes du lot qui ne posent jamais à plus de
   * 50 mm sur les jugés (choisies d'après ce diagnostic, donc à confirmer sur des parties neuves), puis la commande, puis la GCV2. */
  const SURES = ['gardeDePaire', 'appuisLarges', 'ecartementVoisin', 'choixFenetre'];
  const lotSur = l => { for (const n of SURES) { const x = cf(n)(l); if (x) return x; } return null; };
  const gcvEcart = l => poseGcv2(l, 'aucun|0|0|1');
  out.push(evalue(`(c*) lot : union des gardes ${SURES.join(', ')} éteintes une à une`, lotSur));
  out.push(evalue('(f) combinaison : (c*), puis la pose déjà décidée (caméra déplacée), puis la meilleure paire de la GCV2 (écartement gardé), validée et inscrite aux verts à contrôler', l => lotSur(l) || cfBase(l) || gcvEcart(l)));
  const gcvTau = l => poseGcv2(l, 'aucun|1|1|1');
  out.push(evalue('(g) combinaison prudente : GCV2 sans couloir (τ, δ, écartement gardés), sinon (c*), sinon la pose déjà décidée (caméra déplacée)', l => gcvTau(l) || lotSur(l) || cfBase(l)));
  out.push(evalue('(g+) (g), puis la meilleure paire de la GCV2 (écartement gardé) sur le reste, validée et inscrite aux verts à contrôler', l => gcvTau(l) || lotSur(l) || cfBase(l) || gcvEcart(l)));
  out.push(evalue('(f, sans 2:1) même combinaison, hors partie 2:1', l => l.partie === '2:1' ? null : (lotSur(l) || cfBase(l) || gcvEcart(l))));
  /* Courbe : la meilleure paire de la GCV2 (écartement gardé), validée seulement au-dessus d'un seuil de score ; seuil pris au quantile du score
   * sur tous les différés calculés (couverture visée), jugée sur les différés jugés. En dessous du seuil : pose approchée laissée invalide. */
  const cle = 'aucun|0|0|1', sc = l => { const v = l.gcv2 && l.gcv2[cle]; return v && v[0] === 'agit' ? v[3] : null; };
  const scores = c.map(sc).filter(fini).sort((a, b) => b - a);
  const courbe = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map(q => {
    const n = Math.round(q * baseDifferes), seuil = scores[Math.min(scores.length, n) - 1];
    const sel = l => fini(sc(l)) && sc(l) >= seuil;
    const ev = evalue(`couverture ${Math.round(q * 100)} %`, l => sel(l) ? poseGcv2(l, cle) : null);
    return { couvertureVisee: q, seuilScore: arrondi(seuil, 4), ...ev };
  });
  const sansNuage = lignes.filter(l => l.etat === 'sans-nuage');
  out.push({ piste: `(e) cuts sans nuage (${sansNuage.length}, soit ${fmt(part(sansNuage.length, baseDifferes))} % de la base) : rien à calculer`, valide: true, note: 'aucune hypothèse calculable sans capture ; à traiter par les voisins (H4/H6 sans nuage) ou par une capture refaite', poses: 0, partDeLaBase: 0, partSansNuage: part(sansNuage.length, baseDifferes), partDesCalcules: null,
    juges: sansNuage.filter(l => l.mic && l.mic.rails).length, sansNuage: sansNuage.length });
  return { baseDifferes, calcules: c.length, pistes: out, courbe };
}

/* ---- tables markdown */
const ligneBloc = (nom, b) => [nom, b.n, b.departMedianMm, pc(part(b.rappel10, b.n)), pc(part(b.rappel20, b.n)), pc(part(b.rappel50, b.n)), pc(part(b.oracleAmeliore, b.n)), pc(part(b.perdusDAvance, b.n)),
  pc(part(b.gcv2.ameliore, b.n)), pc(part(b.gcv2.a10, b.n)), pc(part(b.gcv2.plus50, b.n)), b.gcv2.gainMedianMm];
const ENTETES_GAINS = ['Groupe', 'Jugés', 'Départ (médiane, mm)', 'Rappel 10 mm', 'Rappel 20 mm', 'Rappel 50 mm', 'Meilleure hyp. améliore le départ', 'Toutes > 50 mm', 'GCV2 seule améliore', 'GCV2 seule ≤ 10 mm', 'GCV2 seule > 50 mm', 'Gain médian GCV2 (mm)'];
function motifsMd(R) {
  const out = [];
  if (R.base) out.push(`#### Base complète (inventaire, ${R.base.n} différés)`, '', tableMd(['Motif', 'Différés', 'Projet 1', 'Projet 2', 'Part'], R.base.parMotif.map(x => [x.motif, x.n, x.projet1, x.projet2, pc(part(x.n, R.base.n))])), '',
    `B1 en ombre (voisins validés de la liste d'ESV comme appuis) : consigné pour ${R.base.b1.consigne} différés, calculé pour ${R.base.b1.calcule}, il en aurait posé ${R.base.b1.poserait} (${Object.entries(R.base.b1.parMotif).map(([k, v]) => `${k} ${v}`).join(', ')}).`,
    `Étage : ${Object.entries(R.base.parEtage).map(([k, v]) => `${k} ${v}`).join(', ')}. « Sans appui » selon le moteur : ${Object.entries(R.base.sansAppuiParMoteur).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '');
  out.push(`#### Différés calculés (${R.differes} : ${R.calcules} avec nuage, ${R.sansNuage} sans nuage, ${R.erreurs} erreurs ; rejeu au même étage que le lot : ${R.rejeuIdentique}/${R.calcules})`, '',
    tableMd(['Motif', 'Différés', 'PN', 'ADV', 'Abords', 'Sans nuage'], R.parMotif.map(x => [x.motif, x.n, x.pn, x.adv, x.abords, x.sansNuage])), '');
  for (const [k, v] of Object.entries(R.parProjet)) out.push(`##### ${k} (${v.n})`, '', tableMd(['Motif', 'Différés', 'PN', 'ADV', 'Abords'], v.parMotif.map(x => [x.motif, x.n, x.pn, x.adv, x.abords])), '');
  out.push(`Zone à l'instant de la décision : ${Object.entries(R.parZone).map(([k, v]) => `${k} ${v}`).join(', ')} ; zone connue en fin de lot : ${Object.entries(R.parZoneFinDeLot).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `Moteur : rails résolus ${Object.entries(R.moteur.resolus).map(([k, v]) => `${k} → ${v}`).join(', ')} ; paire hors contrat ${R.moteur.paireHorsContrat} ; motifs des rails ${Object.entries(R.moteur.motifsRails).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `Pose de départ : ${R.depart.defautEsv} à l'écartement par défaut d'ESV (1 500 mm), ${R.depart.autre} autres (médiane ${fmt(R.depart.ecartementMedianHorsDefautMm)} mm).`,
    `Voie de série : existe pour ${R.voieSerie.existe}, sûre pour ${R.voieSerie.sure}, absente pour ${R.voieSerie.absente} ; écart latéral du départ à la voie : médiane ${fmt(R.voieSerie.latMedianeMm)} mm, ${R.voieSerie.latPlus45} au-delà de 45 mm, ${R.voieSerie.latPlus100} au-delà de 100 mm ; motifs ${Object.entries(R.voieSerie.motifs).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `Hypothèses présentes (au moins un rail) : ${Object.entries(R.hypotheses).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
    `Contexte : ${R.contexte.sansValideA10Cuts} sans aucun cut validé à 10 cuts au plus, ${R.contexte.sansAppuiDeChaine} sans appui de chaîne.`);
  if (R.relecture) out.push(`Relecture après le lot : ${R.relecture.lotsRelus} lots relus (${R.relecture.differesDesLotsRelus} différés) ; différés visités par la relecture : ${R.relecture.differesVisites}, corrigés : ${R.relecture.differesCorriges}.`);
  return out.join('\n');
}
function gainsMd(R) {
  const P = R.principal;
  return [`Différés avec une pose de l'opérateur : ${R.avecMic} ; jugés (pose de départ vérifiée, cut calculé) : ${R.juges} ; non jugés : ${Object.entries(R.nonJuges).map(([k, v]) => `${k} ${v}`).join(', ')}.`, '',
    tableMd(ENTETES_GAINS, [ligneBloc('**Échos de la même séance**', P), ...P.parMotif.map(x => ligneBloc(`motif ${x.motif}`, x)), ...P.parZone.map(x => ligneBloc(`zone ${x.zone}`, x)),
      ...P.parProjet.map(x => ligneBloc(x.projet, x)), ...P.parPartie.map(x => ligneBloc(`partie ${x.partie}`, x)), ligneBloc('GCV2 hors échantillon (2:6, 2:7, 2:13)', R.horsEchantillon), ligneBloc('GCV2 dans l\'échantillon', R.dansEchantillon), ligneBloc('Échos d\'une autre séance (1:13, 1:15)', R.autreSeance), ligneBloc('Témoin 1:25', R.temoins)]), '',
    `Origine de l'hypothèse la plus proche de l'opérateur (par rail) : ${Object.entries(P.originesDeLaMeilleure).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', ')}. H6 présente pour ${P.h6Present} des ${P.n} différés jugés.`,
    `V1+ telle que déclarée agit sur ${P.v1p.agit} des ${P.n} différés jugés (${P.v1p.a10} à 10 mm, ${P.v1p.plus50} à plus de 50 mm).`].join('\n');
}
const ligneJ = j => j ? [j.juges, j.a10, j.a20, j.plus50, j.ameliore, j.gainMedianMm] : ['—', '—', '—', '—', '—', '—'];
function gardesMd(R) {
  const E = ['Jugés', '≤ 10 mm', '≤ 20 mm', '> 50 mm', 'Améliore le départ', 'Gain médian (mm)'];
  return ['Lot (chaîne de décision rejouée, une garde éteinte à la fois ; « premier » : garde qui a refusé dans le journal ; « seul » : l\'éteindre seule suffit à poser) :', '',
    tableMd(['Garde', 'Premier', 'Seul', 'Seul et premier', ...E], R.lot.map(x => [x.garde, x.premier, x.seul, x.seulEtPremier, ...ligneJ(x.refusJuges)])), '',
    `Différés que la décision rejouée pose déjà (la commande ou la validation a manqué, ou le rejeu diffère du lot) : ${R.rejeuQuiPose.n} (${Object.entries(R.rejeuQuiPose.parMotif).map(([k, v]) => `${k} ${v}`).join(', ')}).`,
    `Toutes les gardes du lot éteintes ensemble : ${R.toutesLesGardesDuLot.poses} poses de plus ; jugées ${R.toutesLesGardesDuLot.juges.juges}, ${R.toutesLesGardesDuLot.juges.a10} à 10 mm, ${R.toutesLesGardesDuLot.juges.plus50} à plus de 50 mm.`, '',
    'Commande et validation (la pose existait) :', '', tableMd(['Garde', 'Différés', 'Avec pose rejouée', ...E], R.commande.map(x => [x.garde, x.premier, x.avecPose, ...ligneJ(x.refusJuges)])), '',
    'GCV2 sur les différés (« seul » : levé seul depuis la variante stricte ; « refuse » : ce qu\'il retire quand tout le reste est ouvert) :', '',
    tableMd(['Garde-fou', 'Seul', ...E, 'Refuse (tout ouvert)', 'dont ≤ 10 mm', 'dont > 50 mm'], R.gcv2.map(x => [x.garde, x.seul, ...ligneJ(x.seulJuges), x.refuseQuandToutEstOuvert, x.refuseJuges ? x.refuseJuges.a10 : '—', x.refuseJuges ? x.refuseJuges.plus50 : '—'])), '',
    'Classement par poses justes évitées (≤ 10 mm de l\'opérateur), puis par rapport « justes évitées / mauvaises (> 50 mm) évitées » :', '',
    tableMd(['Rang', 'Étage', 'Garde', 'Justes évitées', 'Mauvaises évitées', 'Différés concernés'], R.classement.map((x, i) => { const j = x.refusJuges; return [i + 1, x.etage, x.garde, j.a10, j.plus50, x.seul ?? x.premier]; })),
    R.relecture ? `\nRelecture après le lot (elle ne touche jamais un différé) : ${R.relecture.map(x => `${x.partie} (${x.mode}, ${x.relus} relus, ${x.differesTouches} des ${x.differes} différés visités, ${x.differesCorriges} corrigés${x.refus && Object.keys(x.refus).length ? ' ; refus : ' + Object.entries(x.refus).map(([k, v]) => `${k} ${v}`).join(', ') : ''})`).join(' ; ')}.` : ''].join('\n');
}
const GROUPES_JUGES = Object.freeze(['projet 1', '2:1', 'projet 2 sans 2:1', 'hors échantillon (2:6, 2:7)']);
function pistesMd(R) {
  return [`Base : ${R.baseDifferes} différés ; calculés avec nuage : ${R.calcules}.`, '',
    tableMd(['Piste', 'Poses', 'Différés évités (% de la base)', 'Jugés', '≤ 10 mm', '≤ 20 mm', '> 50 mm', 'Améliore le départ', 'Pire que le départ', 'Gain médian (mm)'],
      R.pistes.map(x => [x.piste, x.poses, x.valide ? pc(x.partDeLaBase) : `0 % (${pc(part(x.poses, R.baseDifferes))} approchés)`, x.juges, x.a10 ?? '—', x.a20 ?? '—', x.plus50 != null ? `${x.plus50} (${pc(x.partPlus50)})` : '—', x.ameliore ?? '—', x.pire ?? '—', x.gainMedianMm ?? '—'])), '',
    'Par groupe de parties jugées (≤ 10 mm / > 50 mm / améliore / jugés) :', '',
    tableMd(['Piste', ...GROUPES_JUGES], R.pistes.filter(x => x.parGroupe).map(x => [x.piste, ...GROUPES_JUGES.map(g => { const v = x.parGroupe[g]; return v ? `${v.a10} / ${v.plus50} / ${v.ameliore} / ${v.n}` : '—'; })])), '',
    'Courbe : meilleure paire de la GCV2 (écartement gardé) validée au-dessus d\'un seuil de score ; en dessous, pose approchée laissée invalide :', '',
    tableMd(['Couverture visée', 'Seuil de score', 'Validés (% de la base)', 'Jugés', '≤ 10 mm', '≤ 20 mm', '> 50 mm', 'Pire que le départ', 'Gain médian (mm)'],
      R.courbe.map(x => [pc(100 * x.couvertureVisee), x.seuilScore, pc(x.partDeLaBase), x.juges, x.a10, x.a20, `${x.plus50} (${pc(x.partPlus50)})`, x.pire, x.gainMedianMm]))].join('\n');
}

/* ================================================================== ligne de commande */
const FORMAT_LOTS = 'ariane-diag-differes-lots-v1';
const PLAN = path.join(__dirname, '..', 'datasets', 'diag-differes-plan.json');
function args(argv) {
  const o = { mode: argv[0], journal: [], lots: [], corpus: [], echo: [], cuts: [], temoin: false };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--journal') o.journal.push(val()); else if (k === '--lots') o.lots.push(val()); else if (k === '--corpus') o.corpus.push(val());
    else if (k === '--echo') o.echo.push(val()); else if (k === '--cuts') o.cuts.push(val()); else if (k === '--plan') o.plan = val();
    else if (k === '--json') o.json = val(); else if (k === '--md') o.md = val(); else if (k === '--sortie') o.sortie = val(); else if (k === '--lot') o.lot = val();
    else if (k === '--parametres') o.parametres = val(); else if (k === '--temoin') o.temoin = true; else if (k === '--echo-autre-seance') o.echoAutre = true;
    else if (k === '--inventaire') o.inventaire = val(); else if (k === '--mic') o.mic = val();
    else if (k === '--partie') { const m = /^([1-9]\d*):([1-9]\d*)$/.exec(val()); if (!m) throw Error('--partie PROJET:PARTIE'); o.projet = Number(m[1]); o.partie = Number(m[2]); }
    else throw Error('argument inconnu : ' + k);
  }
  return o;
}
const ecrire = (f, texte) => { fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true }); fs.writeFileSync(f, texte); };
function main(argv) {
  const a = args(argv);
  if (a.mode === 'lots') {
    /* Étape légère : les lots d'un journal, sans les événements (pour ne pas garder le journal extrait). */
    if (a.journal.length !== 1 || !a.sortie) throw Error('lots --journal J.json --sortie L.json');
    const j = JSON.parse(fs.readFileSync(a.journal[0], 'utf8'));
    ecrire(a.sortie, JSON.stringify({ format: FORMAT_LOTS, fichier: path.basename(a.journal[0]), version: j.version || null, lots: lotsDuJournal(j) }) + '\n');
    process.stdout.write(`${path.basename(a.journal[0])} : ${lotsDuJournal(j).length} lot(s)\n`);
  } else if (a.mode === 'inventaire') {
    if (!a.journal.length && !a.lots.length) throw Error('inventaire --journal J.json [--journal …] | --lots L.json [--lots …] [--plan PLAN.json] [--json R.json] [--md R.md]');
    const plan = JSON.parse(fs.readFileSync(a.plan || PLAN, 'utf8'));
    const entrees = [...a.journal.map(f => ({ fichier: f, journal: JSON.parse(fs.readFileSync(f, 'utf8')) })),
      ...a.lots.map(f => { const x = JSON.parse(fs.readFileSync(f, 'utf8')); if (x.format !== FORMAT_LOTS) throw Error(`${f} : format ${FORMAT_LOTS} attendu`); return { fichier: x.fichier, lotsPrets: x.lots }; })];
    const R = inventaire(entrees, plan);
    if (a.json) ecrire(a.json, JSON.stringify(R, null, 1) + '\n');
    const md = inventaireMd(R);
    if (a.md) ecrire(a.md, md + '\n');
    process.stdout.write(md + '\n');
  } else if (a.mode === 'mic') {
    /* Étape séparée (mémoire) : les poses finales de l'opérateur pour les différés d'une partie, lues dans l'Écho, dans un petit fichier HORS DÉPÔT. */
    if (!a.partie || a.journal.length !== 1 || !a.echo.length || !a.sortie) throw Error('mic --partie P:N --journal J.json --echo DOSSIER [--echo …] --sortie MIC.json');
    const { P } = modules(), j = JSON.parse(fs.readFileSync(a.journal[0], 'utf8'));
    const cuts = [...new Set(lotsDuJournal(j).filter(x => x.partie === a.partie).flatMap(x => x.cuts.filter(c => !c.pose).map(c => c.cut)))];
    const m = P.micDepuisEcho(a.echo, a.partie, cuts);
    ecrire(a.sortie, JSON.stringify({ format: 'ariane-diag-differes-mic-v1', partie: `${a.projet}:${a.partie}`, poses: [...m].map(([cut, mic]) => ({ cut, mic })) }) + '\n');
    process.stdout.write(`partie ${a.projet}:${a.partie} : ${m.size} différés lus dans l'Écho, ${[...m.values()].filter(x => x.rails).length} avec une pose de l'opérateur\n`);
  } else if (a.mode === 'joindre-mic') {
    /* Ajoute après coup la pose de l'opérateur (fichier de `mic`) aux lignes d'un fichier d'EXTRAIRE : la pose de Mic n'entre dans aucun calcul. */
    if (a.cuts.length !== 1 || !a.mic || !a.sortie) throw Error('joindre-mic --cuts CUTS.jsonl --mic MIC.json [--echo-autre-seance] --sortie CUTS2.jsonl');
    const m = new Map(JSON.parse(fs.readFileSync(a.mic, 'utf8')).poses.map(x => [x.cut, x.mic]));
    const lignes = fs.readFileSync(a.cuts[0], 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)).map(o => o.type === 'entete' ? { ...o, avecEcho: true, echoMemeSeance: !a.echoAutre }
      : { ...o, echoMemeSeance: !a.echoAutre, mic: m.get(o.cut) || { ref: null, raison: 'absent-de-l-echo' } });
    ecrire(a.sortie, lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
    process.stdout.write(`${lignes.length - 1} différés, ${lignes.filter(l => l.mic && l.mic.rails).length} avec une pose de l'opérateur\n`);
  } else if (a.mode === 'extraire') {
    if (!a.partie || a.journal.length !== 1 || !a.corpus.length || !a.sortie) throw Error('extraire --partie P:N --journal J.json --corpus C.json [--corpus …] [--echo DOSSIER …] [--echo-autre-seance] [--lot ID] [--temoin] --sortie CUTS.jsonl');
    const { P } = modules(), journalTexte = m => process.stderr.write(m + '\n'), t0 = Date.now();
    const parametres = JSON.parse(fs.readFileSync(a.parametres || PARAMETRES, 'utf8'));
    const j = JSON.parse(fs.readFileSync(a.journal[0], 'utf8')), etat = etatPartie(j, a.partie), ids = [...new Set(etat.decisions.map(d => d.captureId).filter(Boolean))];
    /* L'Écho d'abord (sa lecture est lourde, son résultat petit), puis les captures. */
    let mic = null;
    if (a.mic) mic = new Map(JSON.parse(fs.readFileSync(a.mic, 'utf8')).poses.map(x => [x.cut, x.mic]));
    else if (a.echo.length) { const cuts = lotsDuJournal(j).filter(x => x.partie === a.partie).flatMap(x => x.cuts.filter(c => !c.pose).map(c => c.cut)); try { mic = P.micDepuisEcho(a.echo, a.partie, [...new Set(cuts)]); } catch (e) { journalTexte(`Écho illisible (${e.message}) : pas de pose de l'opérateur`); mic = null; } }
    const captures = P.capturesDuCorpus(a.corpus, ids);
    journalTexte(`captures retrouvées : ${captures.size}/${ids.length}`);
    const lignes = extrairePartie({ journal: j, captures, parametres, projet: a.projet, partie: a.partie, mic, lot: a.lot, temoin: a.temoin, echoMeme: !a.echoAutre, journalTexte });
    ecrire(a.sortie, lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
    const L1 = lignes.slice(1);
    process.stdout.write(`partie ${a.projet}:${a.partie} : ${L1.length} différés, calculés ${L1.filter(l => l.etat === 'calcule').length}, sans nuage ${L1.filter(l => l.etat === 'sans-nuage').length}, erreurs ${L1.filter(l => l.etat === 'erreur').length}, rejeu identique ${L1.filter(l => l.rejeu && l.rejeu.identiqueAuLot).length}, avec Mic ${L1.filter(l => l.mic && l.mic.rails).length} ; ${Math.round((Date.now() - t0) / 1000)} s\n`);
  } else if (['motifs', 'gains', 'gardes', 'pistes'].includes(a.mode)) {
    if (!a.cuts.length) throw Error(`${a.mode} --cuts CUTS.jsonl [--cuts …] [--inventaire INV.json] [--json R.json] [--md R.md]`);
    const { lignes } = lireCuts(a.cuts.map(f => fs.readFileSync(f, 'utf8')));
    const inv = a.inventaire ? JSON.parse(fs.readFileSync(a.inventaire, 'utf8')) : null;
    const baseDifferes = inv ? inv.base.total.differes : lignes.length;
    const R = a.mode === 'motifs' ? motifs(lignes, inv) : a.mode === 'gains' ? gains(lignes) : a.mode === 'gardes' ? gardes(lignes, inv) : pistes(lignes, baseDifferes);
    const md = a.mode === 'motifs' ? motifsMd(R) : a.mode === 'gains' ? gainsMd(R) : a.mode === 'gardes' ? gardesMd(R) : pistesMd(R);
    if (a.json) ecrire(a.json, JSON.stringify(R, null, 1) + '\n');
    if (a.md) ecrire(a.md, md + '\n');
    process.stdout.write(md + '\n');
  } else throw Error('mode : lots | inventaire | extraire | motifs | gains | gardes | pistes');
}

module.exports = { lireCuts, juge, departOk, oracle, meilleureGcv2, poseGcv2, motifs, gains, gardes, pistes, motifsMd, gainsMd, gardesMd, pistesMd, GARDES_LOT, GARDES_GCV2, etatPartie, scienceSansContrat, CONTREFACTUELS, contrefactuels, COULOIRS, gcv2Variantes, extrairePartie, FORMAT_LOTS, PLAN, args, main, FORMAT_INVENTAIRE, FORMAT_CUTS, VERSION, SEUILS, ZONES, classerMotif, lotsDuJournal, inventaire, baseDesTaux, inventaireMd, tableMd, fmt, pc, med, arrondi, part };

if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`diag-differes : ${e.message}\n`); process.exitCode = 1; } }
