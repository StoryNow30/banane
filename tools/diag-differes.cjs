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
  const lot = id => { if (!lots.has(id)) lots.set(id, { id, debut: null, scope: null, decisions: [], validations: [], enPlace: [], relecture: [], regles: [] }); return lots.get(id); };
  for (const e of ev) {
    if (!e || !fini(t(e.timestamp))) continue;
    if (e.type === 'batch-started' && e.batch && e.batch.id) { const L = lot(e.batch.id); L.debut = t(e.timestamp); L.scope = e.batch.scope || null; }
    else if (e.type === 'gcv1-shadow-observed' && e.batchId && e.lotObservation && e.identity && Number.isInteger(e.identity.cut)) lot(e.batchId).decisions.push(e);
    else if (e.type === 'validation-accepted' && e.batchId && e.identity && Number.isInteger(e.identity.cut)) lot(e.batchId).validations.push({ cut: e.identity.cut, part: e.identity.part, t: t(e.timestamp) });
    else if (TYPES_RELECTURE.includes(e.type) && e.batchId) lot(e.batchId).relecture.push(e);
    else if (e.type === 'regles-metier-ombre' && e.batchId && e.actif && e.actif.applique) lot(e.batchId).regles.push({ cut: e.identity && e.identity.cut, t: t(e.timestamp) });
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
      if (!v) c.motif = classerMotif(lo, e.shadow, { regleMetier: regles.has(c.cut) && cmd && cmd.action === 'defer' });
      return c;
    }).sort((a, b) => a.t - b.t);
    /* Relecture après le lot : ce qu'elle a touché parmi les différés du lot. */
    const differes = new Set(cuts.filter(c => !c.pose).map(c => c.cut));
    const ombres = L.relecture.filter(e => e.type === 'relecture-ombre' && e.identity && Number.isInteger(e.identity.cut));
    const debutR = L.relecture.find(e => e.type === 'relecture-debut'), finR = L.relecture.find(e => e.type === 'relecture-fin');
    const relecture = debutR || ombres.length ? { mode: debutR ? debutR.mode || null : null, relus: new Set(ombres.map(e => e.identity.cut)).size,
      corriges: finR && fini(finR.corriges) ? finR.corriges : null, differesTouches: [...new Set(ombres.filter(e => differes.has(e.identity.cut)).map(e => e.identity.cut))].sort((a, b) => a - b),
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
    else if (k === '--parametres') o.parametres = val(); else if (k === '--temoin') o.temoin = true;
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
  } else throw Error('mode : lots | inventaire | extraire | motifs | gains | gardes | pistes');
}

module.exports = { FORMAT_LOTS, PLAN, args, main, FORMAT_INVENTAIRE, FORMAT_CUTS, VERSION, SEUILS, ZONES, classerMotif, lotsDuJournal, inventaire, baseDesTaux, inventaireMd, tableMd, fmt, pc, med, arrondi, part };

if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`diag-differes : ${e.message}\n`); process.exitCode = 1; } }
