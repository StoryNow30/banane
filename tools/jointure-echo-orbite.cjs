#!/usr/bin/env node
'use strict';
/*
 * jointure-echo-orbite.cjs — joint, cut par cut, un export Écho (observation des corrections humaines,
 * `banane-native-session-v2`/v3 compact, en plusieurs segments) et le journal Orbite (`ariane-journal-v4-*.json`,
 * lot automatique) de la même partie. Chantier S3 du plan 5.0 (audit Écho, ligne C-03) : juger Ariane sur la
 * vérité terrain sans jointure manuelle. Outil hors ligne, lecture seule, aucune dépendance.
 *
 *   node tools/jointure-echo-orbite.cjs --echo <dossier ou fichiers…> (--journal <fichier> | --sans-journal)
 *        [--partie N] [--base auto|premiere|derniere] [--sortie table.json] [--csv table.csv] [--sans-poses]
 *        [--visite-sans-action-bonne [durée minimale en s, 0,8 par défaut]]
 *
 * Clé de jointure : (partie, cut) — et le projet si les deux identités en portent un (`projectId` ; absent des
 * exports actuels). Clé de visite : (session Écho, `visitIndex`) : `visitIndex` repart de 0 à chaque session, il ne
 * suffit donc jamais seul. Les visites d'un cut, toutes sessions confondues, sont rangées dans l'ordre du temps
 * (`startedAt`, puis rang de la session, puis `visitIndex`). Par cut, la table donne :
 *  - la classe Ariane : « posee » (validation ou pose vérifiée au journal), « differee » (cut différé et jamais
 *    posé), « autre » (vu au journal sans issue : capture abandonnée…), « hors-journal » ;
 *  - le motif de différé (par rail : motif du moteur et raison) ;
 *  - la pose d'Ariane (bords gauche/droit, scène du journal) et son déplacement dans le repère profil ;
 *  - la pose humaine finale (bords, scène de l'Écho) : celle de la DERNIÈRE validation observée, toutes visites
 *    confondues, dans l'ordre du temps (comme la 4.9.0.20) ; un cut sans validation observée est « sans-reference »
 *    (sauf avec `--visite-sans-action-bonne`, voir plus bas) ;
 *    RÉFÉRENCE CORRIGÉE PAR L'ÉCRITURE SERVEUR (D-143). La référence que l'Écho fige à la touche de validation est périmée
 *    quand ESV applique le déplacement d'un rail APRÈS la touche (clic sur un rail quelques ms avant). L'écriture de
 *    validation de la ligne (PUT 2xx, rattachée à la visite par numéro de ligne, dernière de la visite) porte la bonne pose :
 *    si ses rails diffèrent de plus de 1 mm de la référence, celle-ci est remplacée (dernier état observé s'il concorde avec
 *    l'écriture à 1 mm près, sinon positions de l'écriture), comme le fait l'Écho depuis ce correctif
 *    (`src/native-session.js`, `referenceParEcriture`). Les cuts concernés sont comptés et listés dans le résumé
 *    (`referencesCorrigees`), avec les écartements de la référence hors 1 420–1 470 mm (`ecartementsReferenceHorsPlage`) ;
 *  - l'écart humain par rail : latéral, vertical, longitudinal (mm, repère profil du rail) et distance 3D ;
 *    sans matrice de repère profil, la distance 3D seule (« repere: "3D" ») ;
 *  - l'étiquette Écho (VALIDATE_NO_MOVEMENT, VALIDATE_CORRECTED_*…) ;
 *  - la décision B1 en ombre (dernier événement `b1-ombre` du cut) et la proposition du moteur par rail ;
 *  - LES OMBRES DE LA 5.0 (audit 5.0, I8), jugées d'un même format (module commun src/voie-recentree.js) : `voie-predite-ombre` (journal
 *    Orbite, un par cut différé) et `memoire-differes-ombre` (export Écho, première visite d'un différé). Chacune porte une pose en
 *    décalages (mm, repère profil de la pose de départ d'ESV) et un verdict ; contre la pose finale de l'opérateur (pire des deux rails,
 *    en 3D) : juste à 5 mm, juste à 10 mm, fausse (> 10 mm), mauvaise voie (> 50 mm). Une ombre non posable est « abstenue » ; si elle
 *    avait une pose, `jugementSiPosee` dit ce que la règle a évité ou perdu. Le résumé (`ombres`) a la même forme pour les deux.
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
 *
 * ÉCHO SEUL (`--sans-journal`). Pas de journal : tous les cuts de l'Écho (de la partie `--partie`, sinon de toutes
 * les parties) sont de classe « sans-journal », sans repère de scène, et l'écart se mesure à la pose initiale de la
 * PREMIÈRE visite. Sert à juger des corrections humaines hors d'un lot Ariane (poses d'un opérateur, par exemple).
 *
 * RÈGLE « VISITÉ SANS ACTION = BON » (`--visite-sans-action-bonne [s]`, coupée par défaut). Un cut visité sans
 * validation observée, dont aucun rail n'a bougé de 0,5 mm ou plus entre la pose initiale et la dernière pose
 * observée d'une visite, et dont la plus longue visite dure au moins `s` secondes (0,8 par défaut ; 0 = toutes), compte
 * pour une correction nulle (référence « observee », `regleVisiteBon: true`). Ces cuts sont comptés à part dans le
 * résumé. Un cut déplacé sans validation, trop court ou sans mesure reste « sans-reference ».
 */
const fs = require('node:fs');
const path = require('node:path');
const X = require('../src/native-export.js');
const V = require('./lire-volumes.cjs');
const { referenceParEcriture } = require('../src/native-session.js');
const Voie = require('../src/voie-recentree.js');
const TYPES_OMBRES_ECHO = new Set(['memoire-differes-ombre']);

const COTES = [['gauche', 'left'], ['droite', 'right']];
const SEUIL_REPERE_MM = 20;
const SEUILS_MM = [5, 10];
const BASES = ['auto', 'premiere', 'derniere'];
/* Règle « visité sans action = bon » : durée minimale par défaut de la plus longue visite (s) et déplacement
 * d'un rail (mm) à partir duquel le cut est considéré comme modifié. */
const DUREE_VISITE_DEFAUT_S = 0.8;
const DEPLACEMENT_MODIFIE_MM = 0.5;
/* Écartement attendu entre les deux rails de la pose de référence (mm) : en dehors, la référence est suspecte (D-143). */
const ECARTEMENT_MIN_MM = 1420, ECARTEMENT_MAX_MM = 1470;
const SEUIL_DEPLACEMENT_ETIQUETTE_MM = 1;

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

/* Fichiers Écho : un dossier (JSON et volumes zip, seuls les exports Écho sont retenus par leur nom :
 * `ariane-echo-*` depuis la 4.9.5, `ariane-native-v4-*` et `banane-native-v4-*` avant), ou des fichiers donnés tels quels. */
const NOM_EXPORT_ECHO = /^(ariane|banane)-(native-v\d+|echo)-/;
function entreesEcho(entrees) {
  const out = [];
  for (const e of entrees) {
    const dossier = fs.existsSync(e) && fs.statSync(e).isDirectory();
    for (const x of V.entrees(e)) {
      if (dossier && !NOM_EXPORT_ECHO.test(x.nom)) continue;
      out.push(x);
    }
  }
  return out;
}

/* Les records d'un Écho, tous segments : union par recordId, le segment le plus récent l'emporte (chaque segment
 * porte un instantané complet des records au moment du vidage, comme dans tools/merge-segments.cjs). Le segment
 * est relu, ses records dépliés, puis libéré : on ne garde jamais les nuages.
 * Chaque record garde sa session (`nativeSessionId`, à défaut l'identifiant de la session du segment) : plusieurs
 * sessions Écho peuvent couvrir une même partie, et `visitIndex` repart de 0 dans chacune. Sans recordId, la clé de
 * visite (session, visitIndex) sert de repli pour l'union. */
function lireEcho(entrees, { journal = () => {} } = {}) {
  const liste = entreesEcho(entrees);
  if (!liste.length) throw Error('Aucun export Écho (ariane-echo-*.json, ariane-native-v4-*.json, banane-native-v4-*.json) trouvé.');
  const segments = [], evenements = [];
  for (const e of liste) {
    const doc = JSON.parse(e.lire().toString('utf8'));
    if (!/^banane-native-session-/.test(doc.format || '')) { journal(`ignoré (pas un export Écho) : ${e.nom}`); continue; }
    const records = (doc.format === X.FORMAT ? X.unfoldRefs({ records: doc.records || [] }, doc.dictionaries || {}) : doc).records || [];
    /* Ombres de l'Écho (5.0) : seuls ces événements sont gardés ; les autres restent dans le fichier. */
    const ombres = (doc.events || []).filter(ev => ev && TYPES_OMBRES_ECHO.has(ev.type));
    for (const ev of doc.format === X.FORMAT ? X.unfoldRefs(ombres, doc.dictionaries || {}) : ombres) evenements.push(ev);
    const seg = doc.segment || {}, session = doc.session && doc.session.id || null;
    for (const r of records) if (r && !r.nativeSessionId && session) r.nativeSessionId = session;
    segments.push({ nom: e.nom, stamp: String(seg.stamp || ''), index: seg.index || 0, records, session, debutSession: doc.session && doc.session.startedAt || null });
  }
  if (!segments.length) throw Error('Aucun des fichiers donnés n\'est un export Écho (banane-native-session-*).');
  segments.sort((a, b) => a.stamp.localeCompare(b.stamp) || a.index - b.index || a.nom.localeCompare(b.nom));
  const records = new Map();
  for (const s of segments) for (const r of s.records) records.set(r.recordId || r.id || (Number.isInteger(r.visitIndex) ? cleVisite(r) : `${s.nom}#${records.size}`), r);
  /* Sessions, dans l'ordre du temps : début déclaré par le segment, à défaut la plus ancienne visite. */
  const debuts = new Map();
  const noter = (id, t) => { if (!debuts.has(id) || (t && (!debuts.get(id) || t < debuts.get(id)))) debuts.set(id, t ? String(t) : ''); };
  for (const s of segments) if (s.session) noter(s.session, s.debutSession);
  for (const r of records.values()) noter(sessionDe(r), r.startedAt);
  const sessions = [...debuts].sort((a, b) => String(a[1]).localeCompare(String(b[1])) || a[0].localeCompare(b[0])).map(([id, debut], rang) => ({ id, debut, rang }));
  /* Une ombre par (session, visite, type) : le segment le plus récent l'emporte, comme pour les records. */
  const ombres = new Map();
  for (const ev of evenements) ombres.set(ev.eventId || `${ev.nativeSessionId}|${ev.visitId}|${ev.type}`, ev);
  return { records: [...records.values()], evenements: [...ombres.values()], sessions, segments: segments.map(s => ({ fichier: s.nom, stamp: s.stamp || null, index: s.index, session: s.session, records: s.records.length })) };
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
/* Clé de visite : (session, visitIndex). `visitIndex` repart de 0 à chaque session Écho. */
const sessionDe = r => r && r.nativeSessionId || '';
const cleVisite = r => `${sessionDe(r)}#${r.visitIndex ?? ''}`;

/* Regroupe les records de l'Écho par (partie, cut). Les visites d'un cut, toutes sessions confondues, sont rangées dans
 * l'ordre du temps : début de la visite, puis rang de la session, puis `visitIndex`. Trier par `visitIndex` seul
 * placerait une visite de la seconde session avant celles de la première. `sessions` : les sessions de `lireEcho`
 * ({ id, rang }) ; sans elles, toutes les sessions ont le même rang et l'identifiant départage. */
function echoParCut(records, sessions = []) {
  const rang = new Map(sessions.map(s => [s.id, s.rang]));
  const rangDe = r => rang.has(sessionDe(r)) ? rang.get(sessionDe(r)) : 0;
  const visiteOrdre = (a, b) => String(a.startedAt || '').localeCompare(String(b.startedAt || '')) || rangDe(a) - rangDe(b)
    || sessionDe(a).localeCompare(sessionDe(b)) || (a.visitIndex ?? 0) - (b.visitIndex ?? 0);
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
/* Règle « visité sans action = bon » pour un cut sans validation observée. Rend { appliquee, raison, visites,
 * dwellMaxS, deplacementMaxMm } : appliquee quand aucun rail n'a bougé de DEPLACEMENT_MODIFIE_MM ou plus (pose
 * initiale → dernière pose observée, dans chaque visite) et que la plus longue visite dure au moins `seuilS`.
 * Raisons de refus : « hors-cut » (cut 0 : artefact d'un rechargement de page), « sans-mesure » (aucun rail
 * mesurable des deux côtés), « deplace-sans-validation », « trop-court ». */
function visiteSansAction(c, seuilS) {
  const mesures = [];
  let dwellMaxS = 0;
  for (const v of c.visites) {
    const ini = v.initialObserved || v.firstObserved, fin = v.lastObserved;
    for (const [, en] of COTES) {
      const a = ini && ini.rails && vec3(ini.rails[en] && ini.rails[en].positionSceneRelative), b = fin && fin.rails && vec3(fin.rails[en] && fin.rails[en].positionSceneRelative);
      if (a && b) mesures.push(1000 * norme(moins(b, a)));
    }
    const dt = (Date.parse(v.endedAt) - Date.parse(v.startedAt)) / 1000;
    if (fini(dt) && dt > dwellMaxS) dwellMaxS = dt;
  }
  const r = { appliquee: false, raison: null, visites: c.visites.length, dwellMaxS: arrondi(dwellMaxS, 1), deplacementMaxMm: mesures.length ? arrondi(Math.max(...mesures), 1) : null };
  if (!(c.cut > 0)) r.raison = 'hors-cut';
  else if (!mesures.length) r.raison = 'sans-mesure';
  else if (Math.max(...mesures) >= DEPLACEMENT_MODIFIE_MM) r.raison = 'deplace-sans-validation';
  else if (dwellMaxS < seuilS) r.raison = 'trop-court';
  else r.appliquee = true;
  return r;
}

/* D-143 : la référence d'une visite corrigée par l'écriture serveur de validation. Seule compte une validation réussie
 * (statut 2xx), rattachée à la visite par NUMÉRO DE LIGNE (`joinMethod: 'row-index'`) et au cut de la visite, postérieure à
 * l'intention de validation ; la dernière de la visite fait foi. `kind` manque dans les exports anciens : la validation se
 * reconnaît alors à son corps. Rend null (rien à corriger) ou { par, ecartMaxMm, poseDe, etat?, sides?, diffMm? } :
 * `par: 'outil'` (corrigée ici, `etat` est la nouvelle référence) ou `par: 'echo'` (déjà corrigée par l'Écho). */
const estValidationReussie = (w, cut) => {
  const b = w && w.body, ok = Number.isInteger(w && w.status) && w.status >= 200 && w.status < 300;
  const validation = w && (w.kind ? w.kind === 'validation' : !!b && b.ExtractionStatus === 'valid' && b.TreatedByOperator === true);
  return !!validation && ok && w.joinMethod === 'row-index' && w.rowIndex === cut;
};
function corrigerParEcriture(visite, h) {
  const cut = visite.identity && visite.identity.cut;
  const t0 = Date.parse(h.observedAt || '');
  const ecritures = (visite.serverWrites || []).filter(w => estValidationReussie(w, cut) && !(fini(t0) && Date.parse(w.at || '') < t0));
  if (h.source === 'validation-write' && h.replacedByWrite) {
    const r = h.replacedByWrite;
    return { par: 'echo', ecartMaxMm: fini(r.maxDiffMm) ? r.maxDiffMm : null, poseDe: r.poseFrom || null };
  }
  if (!ecritures.length) return null;
  const fix = referenceParEcriture(h.state, visite.lastObserved || visite.finalObserved || null, ecritures[ecritures.length - 1].body);
  return fix ? { par: 'outil', etat: fix.state, ecartMaxMm: fix.maxDiffMm, poseDe: fix.poseFrom, sides: fix.sides, diffMm: fix.diffMm } : null;
}

/* Dernière validation observée : la visite la plus tardive qui porte une référence humaine à rails ; `correction` : la
 * correction par l'écriture serveur (D-143), `etat` est alors l'état corrigé. */
function referenceHumaine(visites) {
  for (let i = visites.length - 1; i >= 0; i--) {
    const h = visites[i].humanFinalReference;
    if (h && aDesRails(h.state)) {
      const correction = corrigerParEcriture(visites[i], h);
      return { visite: visites[i], etat: correction && correction.etat ? correction.etat : h.state, rang: i, correction };
    }
  }
  return null;
}
/* Écartement entre les deux rails d'une pose (mm, distance 3D), ou null. */
function ecartementDe(etat) {
  const p = positionsDe(etat), g = p.left && vec3(p.left.positionSceneRelative), d = p.right && vec3(p.right.positionSceneRelative);
  return g && d ? arrondi(1000 * norme(moins(g, d)), 1) : null;
}
/* Étiquette qu'aurait donnée l'Écho avec la référence corrigée : départ (pose de départ, à défaut la pose initiale de la
 * visite) contre référence, seuil de 1 mm par rail. */
function etiquetteCorrigee(visite, etat) {
  const depart = visite.startPose && visite.startPose.rails ? visite.startPose : (visite.initialObserved || visite.firstObserved);
  const bouge = en => {
    const a = depart && depart.rails && vec3(depart.rails[en] && depart.rails[en].positionSceneRelative), b = etat && etat.rails && vec3(etat.rails[en] && etat.rails[en].positionSceneRelative);
    return !!a && !!b && 1000 * norme(moins(b, a)) > SEUIL_DEPLACEMENT_ETIQUETTE_MM;
  };
  const g = bouge('left'), d = bouge('right');
  return g && d ? 'VALIDATE_CORRECTED_BOTH' : g ? 'VALIDATE_CORRECTED_LEFT_ONLY' : d ? 'VALIDATE_CORRECTED_RIGHT_ONLY' : 'VALIDATE_NO_MOVEMENT';
}

/* ------------------------------------------------------------------ côté journal */
const TYPES_VUS = new Set(['proposed', 'before-captured', 'applied-verified', 'after-captured', 'validation-intent', 'validation-observation',
  'validation-accepted', 'defer-intent', 'defer-finalized', 'capture-abandoned', 'capture-stale', 'b1-ombre']);

function journalParCut(journal) {
  const ombresSansCut = [];
  const par = new Map(), get = (id) => {
    const k = cleCut(id.part, id.cut);
    if (!par.has(k)) par.set(k, { partie: id.part, cut: id.cut, projet: id.projectId ?? null, vu: false, posee: false, differee: false, appliedVerified: null, deferFinalise: null, b1: null, propose: null });
    return par.get(k);
  };
  for (const e of journal.events) {
    const id = identiteDe(e);
    if (!id || !Number.isInteger(id.part) || !Number.isInteger(id.cut)) continue;
    /* Ombre d'Orbite (5.0) : la dernière du cut ; elle ne change ni la classe ni le « vu » du cut. */
    if (e.type === 'voie-predite-ombre') { const c = par.get(cleCut(id.part, id.cut)); if (c) c.voieOmbre = e; else ombresSansCut.push(e); continue; }
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
  for (const e of ombresSansCut) { const id = identiteDe(e), c = par.get(cleCut(id.part, id.cut)); if (c) c.voieOmbre = e; }
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

/* ------------------------------------------------------------------ ombres (5.0) */
/* Pose finale de l'opérateur en décalages depuis la pose de DÉPART d'ESV (repère profil, mm, [long, lat, vert] par rail) : l'écart
 * humain si la base est une visite de l'Écho ; s'il est mesuré depuis la pose d'Ariane, on y ajoute le déplacement d'Ariane. */
function micDepuisDepart(ligne) {
  const e = ligne.ecartHumain;
  if (!e || !ligne.base) return null;
  const out = {};
  for (const [fr, en] of COTES) {
    const r = e[fr];
    if (!r || r.repere !== 'profil') return null;
    let v = [r.longitudinalMm, r.lateralMm, r.verticalMm];
    if (ligne.base === 'ariane') { const a = ligne.arianeDeplacement && ligne.arianeDeplacement[fr]; if (!a || a.repere !== 'profil') return null; v = [v[0] + a.longitudinalMm, v[1] + a.lateralMm, v[2] + a.verticalMm]; }
    out[en] = v;
  }
  return out;
}
/* Une ombre jugée : { posable, raison, ecartMm, jugement[, jugementSiPosee] } (format commun aux deux ombres). */
function jugerOmbre(ev, mic) {
  if (!ev) return null;
  const v = ev.verdict || {}, posable = v.posable === true;
  const ecart = ev.poseMm && mic ? Voie.ecartPose(ev.poseMm, mic) : null, ecartMm = ecart === null ? null : arrondi(ecart, 1);
  const out = { posable, raison: posable ? null : (v.raison ?? ev.etat ?? null), ecartMm };
  if (posable) out.jugement = Voie.juger(ecartMm);
  else { out.jugement = 'abstenue'; if (ecartMm !== null) out.jugementSiPosee = Voie.juger(ecartMm); }
  return out;
}
/* Résumé d'une ombre (même forme pour Orbite et l'Écho). `juste10` compte aussi les `juste5`. */
function resumerOmbre(jugees) {
  const r = { evenements: jugees.length, posables: 0, juste5: 0, juste10: 0, fausse: 0, mauvaiseVoie: 0, nonJugees: 0, abstenues: 0,
    refuseesAvecPose: { n: 0, juste10: 0, fausse: 0, mauvaiseVoie: 0 }, parRaison: {}, seuils: { ...Voie.JUGEMENT } };
  for (const j of jugees) {
    if (!j.posable) {
      r.abstenues++; const k = String(j.raison || '?').split(':')[0]; r.parRaison[k] = (r.parRaison[k] || 0) + 1;
      if (j.jugementSiPosee) { const s = r.refuseesAvecPose; s.n++; if (j.jugementSiPosee === 'juste5' || j.jugementSiPosee === 'juste10') s.juste10++; else if (j.jugementSiPosee === 'fausse') s.fausse++; else if (j.jugementSiPosee === 'mauvaise-voie') s.mauvaiseVoie++; }
      continue;
    }
    r.posables++;
    if (j.jugement === 'juste5') { r.juste5++; r.juste10++; } else if (j.jugement === 'juste10') r.juste10++; else if (j.jugement === 'fausse') r.fausse++;
    else if (j.jugement === 'mauvaise-voie') r.mauvaiseVoie++; else r.nonJugees++;
  }
  return r;
}

/* ------------------------------------------------------------------ jointure */
/* `records` : records de l'Écho ; `journal` : { events, records } ; options : { partie, base, poses, sessions,
 * sansJournal, visiteSansActionBonne }. `sansJournal` : Écho seul, le journal est ignoré (voir l'en-tête). */
function joindre(records, journal, options = {}) {
  const base = options.base || 'auto';
  if (!BASES.includes(base)) throw Error(`--base inconnue : ${base} (auto, premiere, derniere).`);
  const poses = options.poses !== false;
  let echo = echoParCut(records, options.sessions);
  let jr = journalParCut(journal);
  const sansJournal = options.sansJournal === true;
  if (sansJournal) jr = new Map();
  const partiesJournal = sansJournal ? new Set([...echo.values()].map(c => c.partie)) : new Set([...jr.values()].map(c => c.partie));
  const retenue = options.partie !== undefined && options.partie !== null ? new Set([options.partie]) : partiesJournal;
  const partiesEchoIgnorees = new Set();
  for (const [k, c] of [...echo]) if (!retenue.has(c.partie)) { partiesEchoIgnorees.add(c.partie); echo.delete(k); }
  for (const [k, c] of [...jr]) if (!retenue.has(c.partie)) jr.delete(k);
  /* Projet : si les deux identités en portent un et qu'ils diffèrent, ce n'est pas le même cut. */
  let projetsDifferents = 0;
  for (const [k, c] of echo) { const j = jr.get(k); if (j && c.projet && j.projet && c.projet !== j.projet) { jr.delete(k); projetsDifferents++; } }

  const seuilVisite = options.visiteSansActionBonne === undefined || options.visiteSansActionBonne === null || options.visiteSansActionBonne === false ? null
    : options.visiteSansActionBonne === true ? DUREE_VISITE_DEFAUT_S : options.visiteSansActionBonne;
  if (seuilVisite !== null && !(fini(seuilVisite) && seuilVisite >= 0)) throw Error('--visite-sans-action-bonne attend une durée en secondes, positive ou nulle.');
  const regle = seuilVisite === null ? null : { seuilS: seuilVisite, cuts: 0, parClasse: {}, refus: { 'deplace-sans-validation': 0, 'trop-court': 0, 'sans-mesure': 0, 'hors-cut': 0 } };
  const repere = calibrerRepere(echo, jr);
  const decalage = repere.calibre ? repere.decalage : null;
  const lignes = [], ecartements = [];
  /* Ombres de l'Écho (5.0) : la dernière par cut. */
  const ombresEcho = new Map();
  for (const ev of (options.evenementsEcho || []).slice().sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || '')))) {
    const id = identiteDe(ev); if (id && Number.isInteger(id.part) && Number.isInteger(id.cut) && retenue.has(id.part) && ev.etat !== 'differes-inconnus') ombresEcho.set(cleCut(id.part, id.cut), ev);
  }
  const cles = new Set([...echo.keys(), ...jr.keys()]);
  for (const k of [...cles].sort((a, b) => { const [pa, ca] = a.split('|').map(Number), [pb, cb] = b.split('|').map(Number); return pa - pb || ca - cb; })) {
    const c = echo.get(k) || null, j = jr.get(k) || null, classe = sansJournal ? 'sans-journal' : classeDe(j);
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
    let sansAction = null;
    if (!ref && regle) {
      sansAction = visiteSansAction(c, regle.seuilS);
      ligne.visiteSansAction = sansAction;
      if (sansAction.appliquee) { regle.cuts++; regle.parClasse[classe] = (regle.parClasse[classe] || 0) + 1; }
      else regle.refus[sansAction.raison]++;
    }
    if (!ref && !(sansAction && sansAction.appliquee)) { ligne.referenceHumaine = 'sans-reference'; ligne.base = null; lignes.push(ligne); continue; }
    if (!ref) {
      /* Visité sans action : correction nulle, sans pose humaine finale. */
      ligne.referenceHumaine = 'observee';
      ligne.regleVisiteBon = true;
      ligne.base = base === 'derniere' ? 'derniere-visite' : base === 'auto' && a && decalage ? 'ariane' : 'premiere-visite';
      const zero = () => ({ repere: 'profil', longitudinalMm: 0, lateralMm: 0, verticalMm: 0, dist3dMm: 0 });
      ligne.ecartHumain = { gauche: zero(), droite: zero(), maxDist3dMm: 0 };
      lignes.push(ligne);
      continue;
    }
    ligne.referenceHumaine = 'observee';
    ligne.visiteReference = ref.rang + 1;
    ligne.validationsDeLaVisite = (ref.visite.humanFinalReferences || []).filter(h => !h.supersededBy).length || 1;
    if (ref.correction) {
      ligne.referenceCorrigeeParEcriture = { par: ref.correction.par, poseDe: ref.correction.poseDe, ecartMaxMm: ref.correction.ecartMaxMm };
      if (ref.correction.par === 'outil') ligne.etiquetteEchoApresCorrection = etiquetteCorrigee(ref.visite, ref.etat);
    }
    ecartements.push({ partie: ligne.partie, cut: ligne.cut, ecartementMm: ecartementDe(ref.etat) });

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

  /* Ombres : jugées contre la pose finale de l'opérateur, dans la même grille. */
  const jugeesVoie = [], jugeesMemoire = [];
  for (const l of lignes) {
    const k = cleCut(l.partie, l.cut), ev = jr.get(k) && jr.get(k).voieOmbre, em = ombresEcho.get(k);
    if (!ev && !em) continue;
    const mic = micDepuisDepart(l);
    l.ombres = {};
    if (ev) { l.ombres.voie = jugerOmbre(ev, mic); jugeesVoie.push(l.ombres.voie); }
    if (em) { l.ombres.memoire = jugerOmbre(em, mic); jugeesMemoire.push(l.ombres.memoire); }
  }
  const ombres = jugeesVoie.length || jugeesMemoire.length ? { voie: resumerOmbre(jugeesVoie), memoire: resumerOmbre(jugeesMemoire) } : null;
  const cutsMultiSessions = [...echo.values()].filter(c => new Set(c.visites.map(sessionDe)).size > 1).length;
  const resume = resumer(lignes, { base: sansJournal && base === 'auto' ? 'premiere' : base, sansJournal, repere, partiesEchoIgnorees: [...partiesEchoIgnorees].sort((x, y) => x - y), projetsDifferents, cutsMultiSessions, regle, ecartements });
  if (ombres) resume.ombres = ombres;
  return { table: lignes, resume };
}

/* ------------------------------------------------------------------ résumé */
const CLASSES = ['posee', 'differee', 'autre', 'hors-journal', 'sans-journal'];
function resumer(lignes, meta = {}) {
  const resume = {
    base: meta.base || null, sansJournal: !!meta.sansJournal,
    repereScene: meta.repere ? { calibre: meta.repere.calibre, paires: meta.repere.paires, residuMedianMm: meta.repere.residuMedianMm, residuP90Mm: meta.repere.residuP90Mm } : null,
    partiesEchoIgnorees: meta.partiesEchoIgnorees || [], projetsDifferents: meta.projetsDifferents || 0,
    cutsVusDansPlusieursSessions: meta.cutsMultiSessions || 0,
    visiteSansActionBonne: meta.regle ? { dureeMinimaleS: meta.regle.seuilS, deplacementModifieMm: DEPLACEMENT_MODIFIE_MM, cuts: meta.regle.cuts, parClasse: meta.regle.parClasse,
      refus: meta.regle.refus } : null,
    cutsEcho: lignes.filter(l => l.dansEcho).length, cutsJournal: lignes.filter(l => l.dansJournal).length,
    cutsJoints: lignes.filter(l => l.dansEcho && l.dansJournal).length,
    cutsJournalAbsentsDeLEcho: lignes.filter(l => !l.dansEcho).length,
    reperes: { profil: 0, '3D': 0 }, bases: {}, cutsParClasse: {}, parClasse: {},
    /* D-143 : références humaines corrigées par l'écriture serveur de validation (par cet outil, ou déjà par l'Écho), et
     * cuts dont la pose de référence a un écartement hors de la plage attendue (la référence corrigée est celle mesurée). */
    referencesCorrigees: { cuts: 0, parLOutil: 0, parLEcho: 0, liste: [] },
    ecartementsReferenceHorsPlage: { minMm: ECARTEMENT_MIN_MM, maxMm: ECARTEMENT_MAX_MM, cuts: 0, liste: [] },
  };
  for (const l of lignes) {
    const c = l.referenceCorrigeeParEcriture;
    if (!c) continue;
    resume.referencesCorrigees.cuts++;
    resume.referencesCorrigees[c.par === 'echo' ? 'parLEcho' : 'parLOutil']++;
    resume.referencesCorrigees.liste.push({ partie: l.partie, cut: l.cut, par: c.par, poseDe: c.poseDe, ecartMaxMm: c.ecartMaxMm, ...(l.etiquetteEchoApresCorrection ? { etiquetteApres: l.etiquetteEchoApresCorrection, etiquetteAvant: l.etiquetteEcho } : {}) });
  }
  for (const e of meta.ecartements || []) {
    if (e.ecartementMm !== null && e.ecartementMm >= ECARTEMENT_MIN_MM && e.ecartementMm <= ECARTEMENT_MAX_MM) continue;
    resume.ecartementsReferenceHorsPlage.liste.push(e);
  }
  resume.ecartementsReferenceHorsPlage.cuts = resume.ecartementsReferenceHorsPlage.liste.length;
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
      ...(meta.regle ? { dontVisiteSansAction: avec.filter(l => l.regleVisiteBon).length, avecValidationObservee: avec.filter(l => !l.regleVisiteBon).length } : {}),
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
  if (resume.sansJournal) L.push(`Écho seul (sans journal) : ${resume.cutsEcho} cuts en Écho.`);
  else L.push(`Jointure Écho ↔ Orbite : ${resume.cutsEcho} cuts en Écho, ${resume.cutsJournal} au journal, ${resume.cutsJoints} joints`
    + (resume.cutsJournalAbsentsDeLEcho ? `, ${resume.cutsJournalAbsentsDeLEcho} du journal absents de l'Écho` : '') + '.');
  if (resume.partiesEchoIgnorees.length) L.push(`Parties de l'Écho absentes du journal, ignorées : ${resume.partiesEchoIgnorees.join(', ')}.`);
  if (resume.projetsDifferents) L.push(`Cuts écartés (projets différents) : ${resume.projetsDifferents}.`);
  if (resume.cutsVusDansPlusieursSessions) L.push(`Cuts vus dans plusieurs sessions Écho : ${resume.cutsVusDansPlusieursSessions} (visites rangées dans l'ordre du temps).`);
  if (!resume.sansJournal) L.push(`Classes Ariane au journal : ${Object.entries(resume.cutsParClasse).map(([k, v]) => `${k} ${v}`).join(', ') || 'aucune'} (tous les cuts du journal, joints ou non).`);
  const r = resume.repereScene;
  if (resume.sansJournal) L.push('Repère de scène : sans objet (pas de journal) ; l\'écart se mesure à la pose initiale de la première visite de chaque cut.');
  else L.push(r && r.calibre ? `Repère de scène : translation constante Écho − journal estimée sur ${r.paires} rails ; résidu médian ${f1(r.residuMedianMm)} mm, P90 ${f1(r.residuP90Mm)} mm.`
    : 'Repère de scène : non calibré (aucun cut posé des deux côtés) ; la base est la première visite de l\'Écho.');
  L.push(`Base de l'écart humain (--base ${resume.base}) : ${Object.entries(resume.bases).map(([k, v]) => `${k} ${v}`).join(', ') || 'aucune'}.`);
  L.push(`Repère de l'écart : profil pour ${resume.reperes.profil} rails, distance 3D seule pour ${resume.reperes['3D']} rails.`);
  const rg = resume.visiteSansActionBonne;
  if (rg) {
    L.push(`Règle « visité sans action = bon » (visite d'au moins ${rg.dureeMinimaleS} s, aucun rail déplacé de ${rg.deplacementModifieMm} mm ou plus) : ${rg.cuts} cuts comptés à correction nulle`
      + `${Object.keys(rg.parClasse).length ? ` (${Object.entries(rg.parClasse).map(([k, v]) => `${k} ${v}`).join(', ')})` : ''} ; restent sans référence : ${rg.refus['deplace-sans-validation']} déplacés sans validation, ${rg.refus['trop-court']} trop courts, ${rg.refus['sans-mesure']} sans mesure, ${rg.refus['hors-cut']} hors cut.`);
  }
  const rc = resume.referencesCorrigees;
  if (rc) {
    L.push(`Références humaines corrigées par l'écriture serveur : ${rc.cuts} cut${rc.cuts > 1 ? 's' : ''}`
      + (rc.cuts ? ` (par cet outil ${rc.parLOutil}, déjà par l'Écho ${rc.parLEcho}) : ${rc.liste.map(x => `${x.partie}/${x.cut} (${f1(x.ecartMaxMm)} mm)`).join(', ')}` : '') + '.');
    const eh = resume.ecartementsReferenceHorsPlage;
    L.push(`Écartements de la référence hors ${eh.minMm}–${eh.maxMm} mm : ${eh.cuts} cut${eh.cuts > 1 ? 's' : ''}`
      + (eh.cuts ? ` : ${eh.liste.map(x => `${x.partie}/${x.cut} (${f1(x.ecartementMm)} mm)`).join(', ')}` : '') + '.');
  }
  for (const [classe, c] of Object.entries(resume.parClasse)) {
    L.push('', `Classe « ${classe} » : ${c.cuts} cuts en Écho (${c.avecReference} avec référence humaine, ${c.sansReference} sans référence).`
      + (rg ? ` Parmi les références : ${c.avecValidationObservee} validations observées, ${c.dontVisiteSansAction} visités sans action.` : ''));
    L.push(`  étiquettes Écho : ${Object.entries(c.etiquettesEcho).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '—'}`);
    L.push(`  écart 3D gauche : ${st(c.ecart3dMm.gauche)}`, `  écart 3D droit  : ${st(c.ecart3dMm.droite)}`, `  écart 3D rails  : ${st(c.ecart3dMm.rails)}`, `  écart 3D par cut (plus grand des deux rails) : ${st(c.ecart3dMm.parCut)}`);
    L.push(`  latéral |.| : ${st(c.ecartLateralAbsMm)}`, `  vertical |.| : ${st(c.ecartVerticalAbsMm)}`);
    L.push(`  corrections > 5 mm : ${c.corrections.sup5mm.cuts} cuts (${c.corrections.sup5mm.rails} rails) ; > 10 mm : ${c.corrections.sup10mm.cuts} cuts (${c.corrections.sup10mm.rails} rails)`);
  }
  if (resume.ombres) for (const [k, titre] of [['voie', 'Ombre voie prédite (Orbite)'], ['memoire', 'Ombre mémoire des différés (Écho)']]) {
    const o = resume.ombres[k];
    L.push('', `${titre} : ${o.evenements} événement(s), ${o.posables} posable(s) — juste à 5 mm ${o.juste5}, à 10 mm ${o.juste10}, fausses ${o.fausse}, mauvaise voie (> ${o.seuils.mauvaiseVoieMm} mm) ${o.mauvaiseVoie}, non jugées ${o.nonJugees} ; abstenues ${o.abstenues}`
      + (o.refuseesAvecPose.n ? ` (dont ${o.refuseesAvecPose.n} avec une pose : ${o.refuseesAvecPose.juste10} juste(s), ${o.refuseesAvecPose.fausse} fausse(s), ${o.refuseesAvecPose.mauvaiseVoie} mauvaise voie)` : '')
      + (Object.keys(o.parRaison).length ? ` ; raisons : ${Object.entries(o.parRaison).sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r} ${n}`).join(', ')}` : '') + '.');
  }
  if (Object.keys(resume.motifsDeDiffere).length) L.push('', `Motifs de différé (par rail, tous les cuts différés du journal) : ${Object.entries(resume.motifsDeDiffere).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  return L.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
const USAGE = 'Usage : node tools/jointure-echo-orbite.cjs --echo <dossier ou fichiers…> (--journal <fichier> | --sans-journal) [--partie N] [--base auto|premiere|derniere] [--sortie table.json] [--csv table.csv] [--sans-poses] [--visite-sans-action-bonne [durée minimale en s, 0,8 par défaut]]';
function lireArguments(argv) {
  const a = { echo: [], journal: null, sansJournal: false, visiteSansActionBonne: null, partie: null, sortie: null, csv: null, base: 'auto', poses: true };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--echo') { while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) a.echo.push(argv[++i]); }
    else if (k === '--journal') a.journal = argv[++i];
    else if (k === '--sans-journal') a.sansJournal = true;
    else if (k === '--visite-sans-action-bonne') {
      /* Valeur facultative : une durée en secondes ; sans elle, DUREE_VISITE_DEFAUT_S. */
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        const v = Number(argv[++i]);
        if (!fini(v) || v < 0) throw Error('--visite-sans-action-bonne attend une durée en secondes, positive ou nulle.');
        a.visiteSansActionBonne = v;
      } else a.visiteSansActionBonne = DUREE_VISITE_DEFAUT_S;
    }
    else if (k === '--partie') { a.partie = Number(argv[++i]); if (!Number.isInteger(a.partie)) throw Error('--partie attend un entier.'); }
    else if (k === '--sortie') a.sortie = argv[++i];
    else if (k === '--csv') a.csv = argv[++i];
    else if (k === '--base') a.base = argv[++i];
    else if (k === '--sans-poses') a.poses = false;
    else throw Error(`Argument inconnu : ${k}`);
  }
  if (a.sansJournal && a.journal) throw Error('--journal et --sans-journal s\'excluent : un Écho seul n\'a pas de journal.');
  if (!a.echo.length || (!a.journal && !a.sansJournal)) throw Error(USAGE);
  return a;
}
function executer(argv, sortie = console.log) {
  const a = lireArguments(argv), avis = [];
  const echo = lireEcho(a.echo, { journal: m => avis.push(m) });
  const journal = a.sansJournal ? { events: [], records: [], format: null, version: null } : lireJournal(a.journal);
  const { table, resume } = joindre(echo.records, journal, { partie: a.partie, base: a.base, poses: a.poses, sessions: echo.sessions, sansJournal: a.sansJournal, visiteSansActionBonne: a.visiteSansActionBonne, evenementsEcho: echo.evenements });
  resume.sources = { segmentsEcho: echo.segments.length, sessionsEcho: echo.sessions.length, recordsEcho: echo.records.length, evenementsJournal: journal.events.length, recordsJournal: journal.records.length };
  const sortieJson = { format: 'ariane-jointure-echo-orbite-v1', creeLe: new Date().toISOString(), options: { partie: a.partie, base: a.base, poses: a.poses, sansJournal: a.sansJournal, visiteSansActionBonne: a.visiteSansActionBonne }, resume, table };
  if (a.sortie) { fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true }); fs.writeFileSync(a.sortie, JSON.stringify(sortieJson, null, 1)); }
  if (a.csv) { fs.mkdirSync(path.dirname(path.resolve(a.csv)), { recursive: true }); fs.writeFileSync(a.csv, enCsv(table)); }
  sortie(texte(resume, [`Sources : ${echo.segments.length} segment(s) Écho (${echo.records.length} records, ${echo.sessions.length} session(s)), ${a.sansJournal ? 'sans journal' : `journal de ${journal.events.length} événements`}.`, ...avis]));
  return sortieJson;
}
if (require.main === module) {
  try { executer(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { jugerOmbre, resumerOmbre, micDepuisDepart, DUREE_VISITE_DEFAUT_S, ECARTEMENT_MIN_MM, ECARTEMENT_MAX_MM, corrigerParEcriture, visiteSansAction, echoParCut, journalParCut, poseAriane, joindre, resumer, lireEcho, lireJournal, lireArguments, executer, enCsv, texte, ecartRail, calibrerRepere, quantile, stat };
