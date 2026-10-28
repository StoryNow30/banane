#!/usr/bin/env node
'use strict';
/*
 * gcv2-predire-differes.cjs — PRÉDICTION SCELLÉE de la GCV2 (variante V1+, D-207, D-214) sur les cuts DIFFÉRÉS d'un lot Orbite, AVANT tout Écho
 * de l'opérateur expert, puis comparaison quand l'Écho arrive. Étude HORS LIGNE : rien n'est changé à l'extension, aucune action dans ESV, rien
 * n'est appris ni réglé ici (paramètres figés de `datasets/gcv2-parametres.json`, usage « lot »).
 *
 *   node tools/gcv2-predire-differes.cjs predire  --partie P:N --journal J.json --corpus C.json [--corpus …] --sortie PRED.jsonl
 *                                                 [--juger-partie-reservee] [--projet-non-confirme] [--parametres datasets/gcv2-parametres.json]
 *   node tools/gcv2-predire-differes.cjs comparer --predictions PRED.jsonl --echo DOSSIER [--echo …] [--json R.json]
 *
 * PRÉDIRE. Lit l'ÉTAT DU LOT AVANT LA RELECTURE (`etatDuLot`) : décisions du lot (`gcv1-shadow-observed`), validations du lot
 * (`validation-accepted`) et poses validées (`records`, pose corrigée), toutes antérieures au premier événement de relecture (`relecture-debut`,
 * `relecture-ombre`). Tout ce qui vient après (relecture « corriger », validations Maj+Espace, poses d'un humain) est IGNORÉ par construction ;
 * l'Écho n'est pas une entrée. Un cut DIFFÉRÉ est un cut que le lot a décidé et n'a pas validé (dernière décision du cut sans validation après
 * elle) : différé par le moteur (`deferred`) ou pose proposée mais non commandée (hors de la vue, garde de continuité…).
 * Pour chaque différé, à l'INSTANT DE LA DÉCISION DU LOT (horodatage de sa dernière décision) et avec cela seulement (CAUSAL) :
 *  - les voisins sûrs : les cuts que le lot a validés AVANT cet instant (poses corrigées du lot, jamais une pose humaine) ; la chaîne d'appuis :
 *    ceux d'entre eux que le lot tenait pour appuis (drapeau `anchor` de sa décision : un choix n'est jamais appui) ;
 *  - la médiane d'écartement : celle des poses validées par le lot avant cet instant (rien sinon) ;
 *  - la zone : le moteur de zones du dépôt (`src/regles-metier.js`) rejoué sur les captures du lot dans l'ordre du lot, mémoire par lot,
 *    ce qu'il sait à l'instant du cut (PN avec ses marges, puis ADV avec ses marges, sinon « abords » : un différé est toujours aux abords) ;
 *  - les hypothèses H0 à H6 de `tools/gcv2-jeu.cjs` (`hypothesesDuCut`, famille « lot » seulement, aucun appui humain), la voie de référence de la
 *    série et son garde-fou (rupture de série d'après les zones d'ADV connues à l'instant) ;
 *  - le score de justesse et la décision de paire de la GCV2 entraînée (modèle, calibrage, τ et δ de l'usage « lot », lus tels quels), sous le
 *    garde-fou de voie des différés (V1+ : chaque rail à 45 mm au plus de la voie de référence de la série, sans référence sûre : aucune action).
 * Sortie (JSON lignes, HORS DÉPÔT, scellée par son SHA-256 imprimé) : une ligne `entete`, une ligne `differe` par différé (zone, drapeaux, pose
 * proposée ou abstention, probabilité, hypothèse retenue, écart à la pose de départ, écart latéral à la voie de la série, toutes les hypothèses et
 * leurs probabilités pour le rappel atteignable). Des millimètres dans le repère profil de la pose de départ, des numéros de cut, des comptes :
 * aucune coordonnée absolue, aucun identifiant. Même entrée, mêmes octets (aucune date de calcul dans le fichier).
 *
 * COMPARER (à lancer seulement quand l'Écho de l'opérateur expert est archivé) : relit le fichier scellé (et recalcule son SHA-256), lit dans
 * l'Écho la pose finale de l'opérateur pour chaque différé (dernière validation, D-143 compris, ou « visité sans action = bon »), vérifie que la
 * pose de départ de l'Écho est bien celle de la prédiction (écartement de départ à 2 mm), puis donne par zone et au total : actions, justes,
 * abîmés, mauvaises voies (erreur finale > 50 mm ou rail déplacé de plus de 45 mm en travers depuis la pose de départ, et, à part, sortie du
 * corridor de la série : audit H2), erreurs, abstentions, grosses laissées fausses, rappel atteignable, et la pose de départ du lot en face.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const G = require('./gcv2-jeu.cjs');
const A = require('./gcv2-apprendre.cjs');
const RA = require('./relecture-autonome.cjs');
const J = require('./jointure-echo-orbite.cjs');
const Manifeste = require('./manifeste-parties.cjs');
const L = require('../src/lot-decision.js');
const M = require('../src/regles-metier.js');
const C = require('../vendor/capture-core.js');

const FORMAT = 'ariane-gcv2-prediction-differes-v1', FORMAT_COMPARAISON = 'ariane-gcv2-comparaison-differes-v1';
const VERSION = 'predire-differes-1';
const USAGE = 'lot', VARIANTE = 'V1+';
const SIDES = ['left', 'right'];
const ZONES = Object.freeze(['pn', 'adv', 'abords', 'liste', 'hors']);
const SEUILS = Object.freeze({ juste5: 5, juste10: 10, mauvaiseVoie: 50, lateralMaxMm: 45, departEcartementMm: 2 });
const PARAMETRES = path.join(__dirname, '..', 'datasets', 'gcv2-parametres.json');
const MAX_APPUIS = 40;
const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const norme = v => Math.hypot(v[0], v[1], v[2]);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const med = a => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const vec3 = v => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(fini) ? v.slice(0, 3) : null;
const t = x => Date.parse(x || '');
const gaugeMm = (a, b) => 1000 * C.distance(a, b);

/* ------------------------------------------------------------------ état du lot avant la relecture (entrée causale) */
const TYPES_RELECTURE = Object.freeze(['relecture-debut', 'relecture-ombre', 'relecture-fin']);
/* Rail réduit à ce qui sert : position et matrice du repère profil (rien d'autre ne sort du journal). */
const railMin = r => r && vec3(r.positionSceneRelative) && Array.isArray(r.sceneRelativeToProfileLocal) && r.sceneRelativeToProfileLocal.length === 16
  ? { positionSceneRelative: r.positionSceneRelative.slice(0, 3), sceneRelativeToProfileLocal: r.sceneRelativeToProfileLocal.slice() } : null;
function etatDuLot(journal, partie) {
  const ev = Array.isArray(journal && journal.events) ? journal.events : [];
  /* Coupure : le premier événement de la relecture d'après le lot. Rien de ce qui vient à cet instant ou après n'entre. */
  const tr = ev.filter(e => e && TYPES_RELECTURE.includes(e.type) && fini(t(e.timestamp))).map(e => t(e.timestamp));
  const coupure = tr.length ? Math.min(...tr) : Infinity;
  const avant = e => e && fini(t(e.timestamp)) && t(e.timestamp) < coupure;
  const ordre = (a, b) => t(a.timestamp) - t(b.timestamp) || String(a.eventId || '').localeCompare(String(b.eventId || ''));
  const lots = [];
  const decisions = ev.filter(e => e.type === 'gcv1-shadow-observed' && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut) && e.lotObservation && avant(e)).sort(ordre)
    .map((e, i) => {
      const b = String(e.batchId || ''); if (!lots.includes(b)) lots.push(b);
      const lo = e.lotObservation, cmd = lo.command || null, sr = e.shadow && e.shadow.rails;
      /* Ce que le moteur a publié au lot (contrôle de fidélité du rejeu seulement) : statut et décalage brut par rail, en mm. */
      const moteur = sr ? Object.fromEntries(SIDES.map(s => { const n = sr[s] && sr[s].next; const dl = n && (n.rawDelta || n.delta); return [s, n ? { statut: n.status || null, delta: Array.isArray(dl) ? dl.map(v => arrondi(1000 * v, 1)) : null } : null]; })) : null;
      return { ordre: i, cut: e.identity.cut, lot: lots.indexOf(b), t: t(e.timestamp), captureId: e.lidarCaptureId || null, stage: lo.stage || null, reason: lo.reason != null ? String(lo.reason).slice(0, 60) : null,
        commande: cmd ? { action: cmd.action || null, raison: cmd.reason != null ? String(cmd.reason).slice(0, 60) : null } : null, appuis: Array.isArray(lo.anchorsUsed) ? lo.anchorsUsed.filter(Number.isInteger) : [],
        /* Le cut peut-il servir d'appui à la chaîne du lot s'il est validé ? Règle du lot (« appui = cut posé », un choix n'est jamais appui) :
         * drapeau `anchor` de la décision, et pas retiré ensuite (`anchorHeld`). */
        appui: lo.anchor === true && lo.anchorHeld !== false, moteur };
    });
  const validations = ev.filter(e => e.type === 'validation-accepted' && e.identity && e.identity.part === partie && Number.isInteger(e.identity.cut) && avant(e)).sort(ordre)
    .map(e => ({ cut: e.identity.cut, t: t(e.timestamp) }));
  const poses = new Map();
  for (const r of Array.isArray(journal && journal.records) ? journal.records : []) {
    const id = r && (r.identity || r), cut = id && id.cut, tr0 = t(r && (r.capturedAt || r.startedAt));
    if (!r || (id.part ?? r.part) !== partie || !Number.isInteger(cut) || !fini(tr0) || !(tr0 < coupure) || !r.rails) continue;
    const ini = {}, cor = {};
    for (const s of SIDES) { const x = r.rails[s]; ini[s] = x && railMin(x.initial); cor[s] = x && x.corrected && vec3(x.corrected.positionSceneRelative); }
    if (!SIDES.every(s => ini[s] && cor[s])) continue;
    const p = poses.get(cut);
    if (!p || tr0 >= p.t) poses.set(cut, { cut, t: tr0, initiale: ini, corrigee: cor });
  }
  return { partie, coupure: Number.isFinite(coupure), decisions, validations, poses: [...poses.values()].sort((a, b) => a.cut - b.cut) };
}
/* Empreinte de l'entrée causale : ce que `predire` lit du journal, rien d'autre (les instants sont rapportés au premier). */
function empreinteEtat(etat) {
  const t0 = etat.decisions.length ? etat.decisions[0].t : 0;
  return sha256(JSON.stringify({ ...etat, decisions: etat.decisions.map(d => ({ ...d, t: d.t - t0 })), validations: etat.validations.map(v => ({ ...v, t: v.t - t0 })), poses: etat.poses.map(p => ({ ...p, t: p.t - t0 })) }));
}
/* Dernière décision de chaque cut ; validé si une validation suit cette décision ; différé sinon. */
function cutsDuLot(etat) {
  const derniere = new Map();
  for (const d of etat.decisions) derniere.set(d.cut, d);
  const out = [];
  for (const d of [...derniere.values()].sort((a, b) => a.ordre - b.ordre)) {
    const v = etat.validations.find(x => x.cut === d.cut && x.t >= d.t);
    out.push({ ...d, valide: !!v, tValide: v ? v.t : null });
  }
  return out;
}

/* ------------------------------------------------------------------ captures du corpus (lecture bornée aux captures utiles) */
function capturesDuCorpus(fichiers, ids) {
  const out = new Map(), voulu = new Set(ids);
  for (const f of fichiers) {
    let doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const c of doc.clouds || []) if (c && voulu.has(c.captureId) && c.rails && Array.isArray(c.pointsSceneRelative)) out.set(c.captureId, capturePourMoteur(c));
    doc = null;
  }
  return out;
}
const capturePourMoteur = c => ({ rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: Array.isArray(c.visibleByClipBoxes) ? c.visibleByClipBoxes : c.pointsSceneRelative.map(() => true) });
const avecNuage = cap => !!(cap && cap.pointsSceneRelative.length && SIDES.every(s => cap.rails[s] && vec3(cap.rails[s].positionSceneRelative) && Array.isArray(cap.rails[s].sceneRelativeToProfileLocal)
  && Array.isArray(cap.rails[s].profileContours) && cap.rails[s].profileContours.length));

/* ------------------------------------------------------------------ zones à l'instant de la décision (moteur de zones du dépôt) */
/* Rejoue `src/regles-metier.js` sur les décisions du lot, dans l'ordre, une mémoire par lot (comme l'extension). Pour chaque décision : la zone
 * évaluée AVANT de noter le cut (ce que l'ombre consigne), et les plages PN et ADV connues à cet instant. Rend Map ordre → { pn, adv, plagesPN, plagesADV }
 * et les plages de fin de lot (pour information seulement : elles ne servent à aucune décision). */
function zonesCausales(cuts, decisions, captures) {
  const P = M.DEFAULTS.pn, Ad = M.DEFAULTS.adv, mems = new Map(), out = new Map(), valide = new Map(cuts.map(c => [c.ordre, c.valide]));
  const plages = mem => ({ pn: mem.zones.map(z => [z.debut - P.margeAvant, z.fin + P.margeApres]), adv: (mem.zonesADV || []).map(z => [Math.max(0, z.debut - Ad.margeAvant), z.fin + Ad.margeApres]) });
  for (const d of decisions) {
    if (!mems.has(d.lot)) mems.set(d.lot, M.creerMemoire('lot-' + d.lot));
    const mem = mems.get(d.lot), cap = d.captureId ? captures.get(d.captureId) : null;
    let s = null;
    if (cap && cap.rails && cap.rails.left && cap.rails.right) { try { s = M.surface(cap); } catch { s = null; } }
    const ok = valide.has(d.ordre) ? valide.get(d.ordre) : false;
    const r = M.resumer({ identity: { part: null, cut: d.cut }, decision: { stage: d.stage, reason: d.reason }, action: d.commande ? d.commande.action : null, valide: ok, surface: s });
    const e = M.evaluer(mem, r), p = plages(mem);
    if (e.zone.pnControle) p.pn.push(e.zone.pnControle);
    if (e.zone.advControle) p.adv.push(e.zone.advControle);
    out.set(d.ordre, { pn: e.zone.pn, adv: e.zone.adv, plagesPN: p.pn, plagesADV: p.adv, surface: !!s });
    M.noter(mem, r, { differe: !ok });
  }
  const fin = new Map([...mems].map(([k, m]) => [k, plages(m)]));
  return { parDecision: out, finDeLot: fin };
}
const dans = (plages, c) => plages.some(([a, b]) => c >= a && c <= b);
/* Zone d'un différé (sélection « méthode de l'opérateur », relecture-autonome.cjs) : PN avec marges, puis ADV avec marges, sinon abords (un différé et ses
 * deux voisins de part et d'autre sont des abords). La liste « À contrôler » et « hors » ne peuvent pas contenir un différé. */
const zoneDe = (z, c) => dans(z.plagesPN, c) ? 'pn' : dans(z.plagesADV, c) ? 'adv' : 'abords';

/* ------------------------------------------------------------------ paramètres figés de la GCV2 */
/* Reconstruit le codage et les modèles d'un usage depuis le fichier exporté, sans rien apprendre. Les colonnes reconstruites doivent être
 * exactement celles du fichier (sinon refus) : même liste blanche, même ordre, mêmes vocabulaires. */
function modeleFige(params, usage = USAGE) {
  if (!params || params.format !== A.FORMAT_PARAMS) throw Error(`paramètres : format ${A.FORMAT_PARAMS} attendu`);
  const u = params.usages && params.usages[usage];
  if (!u) throw Error(`paramètres : usage « ${usage} » absent`);
  const norm = new Map((u.normalisation || []).map(x => [x.nom, x]));
  const accord = params.accord !== false;
  const num = A.NUM.map(T => { const x = norm.get(T.nom); return x ? { moy: x.moyenne, sd: x.ecartType, constant: false, manque: !!x.manque } : null; });
  const noms = [];
  num.forEach((f, i) => { if (f) { noms.push(A.NUM[i].nom); if (f.manque) noms.push(A.NUM[i].nom + ':manque'); } });
  const cat = A.CAT.map(T => (u.categories[T.nom] || []).slice());
  cat.forEach((vals, c) => { if (vals.length > 1) for (const v of vals) noms.push(`${A.CAT[c].nom}=${v}`); });
  const multi = A.MULTI.map(T => (u.categories[T.nom] || []).slice());
  multi.forEach((vals, c) => { for (const v of vals) noms.push(`${A.MULTI[c].nom}∋${v}`); });
  if (JSON.stringify(noms) !== JSON.stringify(u.colonnes)) throw Error(`paramètres : les colonnes reconstruites (${noms.length}) ne sont pas celles du fichier (${u.colonnes.length}) : liste blanche ou codage changés, refus`);
  const fit = { num, cat, multi, noms, p: noms.length, accord };
  for (const k of ['modele10', 'modele5']) if (u[k].coefficients.length !== fit.p) throw Error(`paramètres : ${k} n'a pas ${fit.p} coefficients`);
  return { usage, fit, m10: { coef: Float64Array.from(u.modele10.coefficients), intercept: u.modele10.intercept }, m5: { coef: Float64Array.from(u.modele5.coefficients), intercept: u.modele5.intercept },
    cal10: { a: u.calibrage10.a, b: u.calibrage10.b }, cal5: { a: u.calibrage5.a, b: u.calibrage5.b }, seuils: JSON.parse(JSON.stringify(u.seuils)) };
}
/* Probabilités calibrées (10 mm, 5 mm) d'une hypothèse, depuis ses traits bruts `x` (`A.brut`). */
function probas(mod, x) {
  const v = A.coder(mod.fit, x), lin = m => { let s = m.intercept; for (let j = 0; j < v.length; j++) s += v[j] * m.coef[j]; return s; };
  return { p10: A.appliquerPlatt(mod.cal10, lin(mod.m10)), p5: A.appliquerPlatt(mod.cal5, lin(mod.m5)) };
}

/* ------------------------------------------------------------------ un différé */
/* Le cas (même forme que `construireCas` de gcv2-apprendre, sans étiquette) : traits bruts par la liste blanche, garde-fou de voie des différés. */
function casDuDiffere({ designation, cut, zone, hyp, gMed, voieRef }) {
  const G0 = hyp.cut.ecartDepartMm, v = hyp.cut.voisins || {};
  const ctx = { zone, role: 'differe', etageChaine: hyp.cut.etageChaine, appuisChaine: hyp.cut.appuisChaine, voisinsN: v.n ?? null, voisinsHumains: v.humains ?? null, voisinsLot: v.lot ?? null,
    voisinsEncadre: v.encadre ?? null, voisinsCoupMin: v.coupMin ?? null, ecartDepartMedMm: fini(G0) && fini(gMed) ? G0 - gMed : null };
  const k = { partie: designation, cut, zone, role: 'differe', gMed: fini(gMed) ? arrondi(gMed, 1) : null, G0, chaineDifferee: ctx.etageChaine === 'deferred', rails: {}, garde: 'voie', voieRef: voieRef || null };
  for (const s of SIDES) {
    const liste = hyp.rails[s].map(h => ({ ...h, traits: { ...h.traits, zone, role: 'differe' } })), acc = A.accords(liste);
    k.rails[s] = { confiance: hyp.rail[s] ? hyp.rail[s].confianceAstar : null, hyps: liste.map((h, i) => ({ rang: h.rang, hauteur: !!h.hauteur, origines: h.origines, sousOrigines: h.sousOrigines,
      decal: h.decal, g: h.traits.ecartementAutreH0Mm, x: A.brut(h, hyp.rail[s], ctx, acc[i]), h6: h.origines.includes('H6') })) };
  }
  k.i0 = {}; for (const s of SIDES) { k.i0[s] = k.rails[s].hyps.findIndex(h => !h.hauteur && h.origines.includes('H0')); if (k.i0[s] < 0) k.i0[s] = k.rails[s].hyps.findIndex(h => !h.hauteur && h.decal.every(x => Math.abs(x) < 0.75)); }
  k.paires = SIDES.every(s => k.i0[s] >= 0) ? A.pairesPermises(k) : [];
  return k;
}
const resumeHyp = h => ({ decal: h.decal, origines: h.origines, sous: h.sousOrigines, hauteur: h.hauteur });
/* Décision et sortie d'un différé calculé. */
function deciderDiffere(k, mod) {
  const p = {}, p5 = {};
  for (const s of SIDES) { const v = k.rails[s].hyps.map(h => probas(mod, h.x)); p[s] = Float64Array.from(v, x => x.p10); p5[s] = Float64Array.from(v, x => x.p5); }
  const d = A.decider(k, p, mod.seuils), r = k.voieRef, sure = !!(r && r.sure);
  const hl = k.rails.left.hyps[d.i], hr = k.rails.right.hyps[d.j];
  const latSerie = (h, s) => r ? arrondi(h.decal[1] - r[s][0], 2) : null;
  const pose = { left: resumeHyp(hl), right: resumeHyp(hr) };
  const z = mod.seuils[k.zone] || mod.seuils.hors || { actif: false };
  const motif = d.etat === 'agit' ? null : !(r && r.sure) ? 'garde-voie-sans-reference-sure' : !k.paires.length ? 'aucune-paire-permise' : !z.actif ? 'zone-inactive'
    : (d.i === k.i0.left && d.j === k.i0.right) ? 'depart-le-plus-probable' : d.ecart < z.delta ? 'sous-delta' : 'sous-tau';
  const out = { etat: d.etat, motifNonAction: motif, p: arrondi(d.p, 4), ecartDepartMm: arrondi(Math.max(norme(hl.decal), norme(hr.decal)), 2), paire: d.etat === 'laisse' && d.i === k.i0.left && d.j === k.i0.right ? null : pose,
    latDepartMm: { left: arrondi(hl.decal[1], 2), right: arrondi(hr.decal[1], 2) }, latSerieMm: { left: latSerie(hl, 'left'), right: latSerie(hr, 'right') },
    h6Retenue: hl.h6 || hr.h6, alternatives: d.alternatives.map(a => ({ p: arrondi(a.p, 4), h0: a.h0, left: resumeHyp(k.rails.left.hyps[a.i]), right: resumeHyp(k.rails.right.hyps[a.j]) })) };
  const drapeaux = [];
  if (!r) drapeaux.push('aucune-voie-de-serie'); else if (!sure) drapeaux.push(...r.motifs.map(m => 'voie-' + m));
  if (r && SIDES.some(s => Math.abs(0 - r[s][0]) > SEUILS.lateralMaxMm)) drapeaux.push('depart-hors-corridor-de-serie');
  if (!k.paires.length) drapeaux.push('aucune-paire-permise');
  if (!(mod.seuils[k.zone] && mod.seuils[k.zone].actif)) drapeaux.push('zone-inactive');
  if (d.etat === 'agit' && SIDES.some(s => Math.abs(out.latDepartMm[s]) > SEUILS.lateralMaxMm)) drapeaux.push('action-plus-de-45-mm-du-depart');
  const hyps = Object.fromEntries(SIDES.map(s => [s, k.rails[s].hyps.map((h, i) => ({ ...resumeHyp(h), p10: arrondi(p[s][i], 4), p5: arrondi(p5[s][i], 4) }))]));
  return { decision: out, drapeaux, paires: k.paires.length, hyps };
}

/* ------------------------------------------------------------------ prédiction d'une partie */
/* `journal` : objet du journal Orbite ; `captures` : Map captureId → capture (rails, points, visibilité) ; `parametres` : objet de
 * datasets/gcv2-parametres.json. Rend { lignes, resume }. Rien d'autre n'est lu. */
function predire({ journal, captures, parametres, projet, partie, projetConfirme = true, empreinteParametres = null, journalTexte = () => {} }) {
  const designation = `${projet}:${partie}`, mod = modeleFige(parametres, USAGE);
  const etat = etatDuLot(journal, partie), cuts = cutsDuLot(etat), Z = zonesCausales(cuts, etat.decisions, captures);
  const moteur = G.moteurAvecReservoir();
  const poseDe = new Map(etat.poses.map(p => [p.cut, p]));
  const valides = cuts.filter(c => c.valide && poseDe.has(c.cut)).sort((a, b) => a.tValide - b.tValide || a.cut - b.cut);
  const differes = cuts.filter(c => !c.valide);
  const lignes = [], comptes = { differes: differes.length, avecNuage: 0, calcules: 0, erreurs: 0, agit: 0, laisse: 0, abstient: 0, sansNuage: 0, candidatsH6: 0, h6Retenue: 0, voieSure: 0, drapeauxVoie: 0,
    departHorsCorridor: 0, parZone: Object.fromEntries(ZONES.map(z => [z, 0])), motifsNonAction: {}, etageRejeuIdentique: 0, appuisRejeuIdentiques: 0, moteurIdentique: 0 };
  for (const c of differes) {
    const z = Z.parDecision.get(c.ordre), zone = zoneDe(z, c.cut), zFin = Z.finDeLot.get(c.lot);
    comptes.parZone[zone]++;
    const avant = valides.filter(v => v.tValide < c.t);
    const appuis = [];
    for (const v of avant) if (v.appui) L.rememberAnchor(appuis, { identity: { part: partie, cut: v.cut, frameId: null }, positions: { left: poseDe.get(v.cut).corrigee.left.slice(), right: poseDe.get(v.cut).corrigee.right.slice() }, stage: v.stage || 'first-pass' }, MAX_APPUIS);
    const voisins = avant.map(v => { const p = poseDe.get(v.cut); return { identity: { part: partie, cut: v.cut, frameId: null }, positions: { left: p.corrigee.left.slice(), right: p.corrigee.right.slice() }, stage: 'verifie', source: 'lot',
      decalage: G.decalageDepuisEsv(p.initiale, p.corrigee, 'depart') }; });
    const g = avant.map(v => { const p = poseDe.get(v.cut); return gaugeMm(p.corrigee.left, p.corrigee.right); }).filter(x => fini(x) && Math.abs(x - 1500) > 0.05), gMed = med(g);
    const cap = c.captureId ? captures.get(c.captureId) : null;
    const ligne = { type: 'differe', partie: designation, cut: c.cut, ordreLot: c.ordre, lot: { etage: c.stage, raison: c.reason, commande: c.commande, appuis: c.appuis },
      zone, zoneDetail: { pn: z.pn, adv: z.adv }, zoneFinDeLot: zFin ? (dans(zFin.pn, c.cut) ? 'pn' : dans(zFin.adv, c.cut) ? 'adv' : 'abords') : null,
      contexte: { validesAvant: avant.length, voisinsA10Cuts: avant.filter(v => Math.abs(v.cut - c.cut) <= G.H6.fenetreCuts).length, gMedMm: arrondi(gMed, 1), gMedN: g.length },
      nuage: avecNuage(cap) };
    if (!ligne.nuage) { comptes.sansNuage++; lignes.push({ ...ligne, etat: 'sans-nuage', decision: { etat: 'sans-nuage' } }); continue; }
    comptes.avecNuage++;
    try {
      const entree = { identity: { part: partie, cut: c.cut, frameId: null }, rails: cap.rails, points: cap.pointsSceneRelative, visible: cap.visibleByClipBoxes };
      let brut = null;
      RA.poseAriane(entree, { appuis: { liste: appuis.slice() }, rappel: b => { brut = b; } });
      const science = moteur.scientificProposeBoth(brut.capture);
      const hyp = G.hypothesesDuCut({ capture: brut.capture, science, seul: brut.seul, chaine: brut.chaine, appuisAvant: brut.appuisAvant, voisins, gMed, voisinsLot: voisins, departEsv: null });
      /* Rupture de série : statut ADV des cuts entre les appuis et le cut, d'après les plages d'ADV connues à l'instant. */
      const ancres = (hyp.voieH6 && hyp.voieH6.lot && hyp.voieH6.lot.ancres || []).map(a => a.cut), bornes = [c.cut, ...ancres], zmap = new Map();
      for (let x = Math.min(...bornes); x <= Math.max(...bornes); x++) zmap.set(x, { zone: dans(z.plagesADV, x) ? 'adv' : 'autre' });
      const voieRef = hyp.voieH6 ? G.avecRupture(hyp.voieH6.lot, c.cut, zmap) : null;
      const k = casDuDiffere({ designation, cut: c.cut, zone, hyp, gMed, voieRef });
      const D = deciderDiffere(k, mod);
      comptes.calcules++; comptes[D.decision.etat]++;
      if (D.decision.motifNonAction) comptes.motifsNonAction[D.decision.motifNonAction] = (comptes.motifsNonAction[D.decision.motifNonAction] || 0) + 1;
      const nH6 = SIDES.map(s => k.rails[s].hyps.filter(h => h.h6 && !h.hauteur).length);
      if (nH6.some(n => n > 0)) comptes.candidatsH6++;
      if (D.decision.etat === 'agit' && D.decision.h6Retenue) comptes.h6Retenue++;
      if (voieRef && voieRef.sure) comptes.voieSure++;
      if (D.drapeaux.some(x => x.startsWith('voie-') || x === 'aucune-voie-de-serie')) comptes.drapeauxVoie++;
      if (D.drapeaux.includes('depart-hors-corridor-de-serie')) comptes.departHorsCorridor++;
      /* Fidélité du rejeu au lot réel (contrôle, sans effet) : étage de la chaîne et appuis rejoués contre le journal. */
      const etageRejeu = brut.chaine ? brut.chaine.decision.stage : brut.seul.decision.stage, appuisRejeu = brut.chaine ? (brut.chaine.decision.anchorsUsed || []).slice() : [];
      if (etageRejeu === c.stage) comptes.etageRejeuIdentique++;
      if (JSON.stringify(appuisRejeu) === JSON.stringify(c.appuis)) comptes.appuisRejeuIdentiques++;
      const moteurRejeu = Object.fromEntries(SIDES.map(s => { const n = brut.science.rails[s] && brut.science.rails[s].next; const dl = n && (n.rawDelta || n.delta); return [s, n ? { statut: n.status || null, delta: Array.isArray(dl) ? dl.map(v => arrondi(1000 * v, 1)) : null } : null]; }));
      if (c.moteur && JSON.stringify(moteurRejeu) === JSON.stringify(c.moteur)) comptes.moteurIdentique++;
      lignes.push({ ...ligne, etat: 'calcule', rejeu: { etageSeul: brut.seul.decision.stage, etageChaine: etageRejeu, appuisChaine: appuisRejeu },
        departEcartementMm: hyp.cut.ecartDepartMm, moteur: { abstenu: hyp.cut.abstenu, etage: hyp.cut.etage, ecartementMm: hyp.cut.ecartementMm },
        voieSerie: voieRef ? { sure: !!voieRef.sure, motifs: voieRef.motifs, left: voieRef.left, right: voieRef.right, n: voieRef.n, distMin: voieRef.distMin, distMax: voieRef.distMax, dispersionMm: voieRef.dispersionMm,
          ancres: voieRef.ancres.map(a => a.cut) } : null,
        candidatsH6: { left: nH6[0], right: nH6[1] }, paires: D.paires, decision: D.decision, drapeaux: D.drapeaux, hyps: D.hyps });
    } catch (e) { comptes.erreurs++; journalTexte(`cut ${c.cut} : ${e && e.message}`); lignes.push({ ...ligne, etat: 'erreur', erreur: String(e && e.message || e).slice(0, 160), decision: { etat: 'erreur' } }); }
  }
  const entete = { type: 'entete', format: FORMAT, version: VERSION, partie: designation, projetConfirme, usage: USAGE, variante: VARIANTE,
    note: 'Prédiction scellée HORS DÉPÔT : décalages en mm dans le repère profil de la pose de départ, aucune coordonnée absolue ; aucune pose humaine en entrée.',
    parametres: { version: parametres.version, date: parametres.date, sha256: empreinteParametres, seuils: mod.seuils, parties: (parametres.parties || []).map(p => p.partie) },
    entreeCausale: { sha256: empreinteEtat(etat), coupureRelecture: etat.coupure, decisions: etat.decisions.length, cutsDuLot: cuts.length, validesParLeLot: cuts.filter(c => c.valide).length, posesValidees: etat.poses.length },
    seuilsMm: SEUILS, h6: { ...G.H6 }, comptes };
  return { lignes: [entete, ...lignes], resume: comptes, etat, cuts };
}
const enJsonl = lignes => lignes.map(l => JSON.stringify(l)).join('\n') + '\n';

/* ------------------------------------------------------------------ comparaison (quand l'Écho arrive) */
function lirePredictions(texte) {
  const lignes = texte.split('\n').filter(l => l.trim()).map(l => JSON.parse(l)), entete = lignes[0];
  if (!entete || entete.type !== 'entete' || entete.format !== FORMAT) throw Error(`prédictions : format ${FORMAT} attendu`);
  return { entete, differes: lignes.filter(l => l.type === 'differe') };
}
/* Pose finale de l'opérateur pour les cuts demandés, dans le repère profil de la pose de départ de sa première visite (mm). Rend Map cut →
 * { ref: 'validation' | 'visite-bon' | null, rails: { left, right } | null, ecartDepartMm, raison }. */
function micDepuisEcho(dossiers, partie, cuts) {
  const e = J.lireEcho(dossiers), par = J.echoParCut(e.records, e.sessions), ctx = { pagesPerdues: e.pagesPerdues, capturesParVisite: e.capturesParVisite }, voulu = new Set(cuts), out = new Map();
  for (const c of par.values()) {
    if (c.partie !== partie || !voulu.has(c.cut)) continue;
    const v0 = c.visites[0], dep = (v0.beforeEstablished && v0.beforeEstablished.rails) || ((v0.initialObserved || v0.firstObserved) || {}).rails;
    if (!dep || !SIDES.every(s => dep[s] && vec3(dep[s].positionSceneRelative))) { out.set(c.cut, { ref: null, rails: null, ecartDepartMm: null, raison: 'sans-pose-de-depart' }); continue; }
    const ecartDepartMm = arrondi(gaugeMm(dep.left.positionSceneRelative, dep.right.positionSceneRelative), 1), ref = RA.referenceHumaine(c.visites);
    if (ref) {
      const rails = Object.fromEntries(SIDES.map(s => [s, RA.decalage(dep[s], ref.etat.rails && ref.etat.rails[s] && ref.etat.rails[s].positionSceneRelative)]));
      out.set(c.cut, SIDES.every(s => rails[s]) ? { ref: 'validation', rails, ecartDepartMm, raison: null } : { ref: null, rails: null, ecartDepartMm, raison: 'validation-incomplete' });
    } else {
      const sa = J.visiteSansAction(c, J.DUREE_VISITE_DEFAUT_S, ctx);
      out.set(c.cut, sa.appliquee ? { ref: 'visite-bon', rails: { left: [0, 0, 0], right: [0, 0, 0] }, ecartDepartMm, raison: null } : { ref: null, rails: null, ecartDepartMm, raison: sa.raison });
    }
  }
  return out;
}
/* Comparaison pure : prédictions scellées contre poses de l'opérateur. Rend un rapport par zone et au total, avec le détail par cut. */
function comparerPredictions(pred, micParCut) {
  const rs = [], detail = [], rappel = { n: 0, k: 0, nGrosses: 0, kGrosses: 0 }, depart = [], actions = [];
  const nonJuges = { sansReferenceMic: 0, departDifferent: 0, sansNuage: 0, absentsEcho: 0 };
  for (const d of pred.differes) {
    const m = micParCut.get(d.cut);
    if (!m) { nonJuges.absentsEcho++; detail.push({ cut: d.cut, zone: d.zone, statut: 'absent-de-l-echo' }); continue; }
    if (!m.rails) { nonJuges.sansReferenceMic++; detail.push({ cut: d.cut, zone: d.zone, statut: 'sans-reference', raison: m.raison }); continue; }
    if (d.etat !== 'calcule') { nonJuges.sansNuage++; detail.push({ cut: d.cut, zone: d.zone, statut: d.etat, micMaxMm: arrondi(Math.max(...SIDES.map(s => norme(m.rails[s]))), 2) }); continue; }
    if (fini(d.departEcartementMm) && fini(m.ecartDepartMm) && Math.abs(d.departEcartementMm - m.ecartDepartMm) > SEUILS.departEcartementMm) {
      nonJuges.departDifferent++; detail.push({ cut: d.cut, zone: d.zone, statut: 'depart-different', ecartDepartLotMm: d.departEcartementMm, ecartDepartEchoMm: m.ecartDepartMm }); continue;
    }
    const mic = Math.max(...SIDES.map(s => norme(m.rails[s])));
    const err = (pose, s) => norme(moins(pose[s].decal, m.rails[s]));
    const atteint = SIDES.every(s => (d.hyps[s] || []).some(h => norme(moins(h.decal, m.rails[s])) <= SEUILS.juste10));
    rappel.n++; if (atteint) rappel.k++;
    if (mic > SEUILS.juste10) { rappel.nGrosses++; if (atteint) rappel.kGrosses++; }
    depart.push(mic);
    const r = { partie: d.partie, cut: d.cut, zone: d.zone, role: 'differe', mic, etat: d.decision.etat === 'agit' ? 'agit' : d.decision.etat === 'abstient' ? 'abstient' : 'laisse', e: null, lat: null };
    const ligne = { cut: d.cut, zone: d.zone, statut: 'juge', ref: m.ref, micMaxMm: arrondi(mic, 2), etat: r.etat, atteint };
    if (r.etat === 'agit') {
      const P = d.decision.paire;
      r.e = Math.max(err(P, 'left'), err(P, 'right'));
      r.lat = Math.max(...SIDES.map(s => Math.abs(P[s].decal[1])));
      const ls = SIDES.map(s => d.decision.latSerieMm[s]).filter(fini);
      r.latGarde = ls.length === 2 ? Math.max(...ls.map(Math.abs)) : r.lat;
      actions.push(r.e);
      Object.assign(ligne, { erreurMm: arrondi(r.e, 2), latDepartMm: arrondi(r.lat, 2), latSerieMm: arrondi(r.latGarde, 2), gainMm: arrondi(mic - r.e, 2), h6: !!d.decision.h6Retenue,
        classe: r.e <= SEUILS.juste5 ? 'juste-5' : r.e <= SEUILS.juste10 ? 'juste-10' : r.e <= SEUILS.mauvaiseVoie ? 'faux' : 'mauvaise-voie' });
    }
    rs.push(r); detail.push(ligne);
  }
  const S = A.synthese(rs), Wilson = b => { const w = A.wilson(b.erreurs, b.agit); return w.haut == null ? null : arrondi(w.haut, 4); };
  const parZone = Object.fromEntries(ZONES.map(z => { const l = rs.filter(r => r.zone === z), at = detail.filter(x => x.statut === 'juge' && x.zone === z);
    return [z, { ...S.parZone[z], erreurWilsonHaute: Wilson(S.parZone[z]), rappel10: { n: at.length, k: at.filter(x => x.atteint).length }, departMedianMm: arrondi(med(l.map(r => r.mic)), 2),
      actionMedianeMm: arrondi(med(l.filter(r => r.etat === 'agit').map(r => r.e)), 2) }]; }));
  return { format: FORMAT_COMPARAISON, partie: pred.entete.partie, differes: pred.differes.length, nonJuges, total: { ...S.total, erreurWilsonHaute: Wilson(S.total) }, parZone,
    rappel: { paireA10: rappel, part: rappel.n ? arrondi(rappel.k / rappel.n, 4) : null, partGrosses: rappel.nGrosses ? arrondi(rappel.kGrosses / rappel.nGrosses, 4) : null },
    departDuLot: { juges: depart.length, medianeMm: arrondi(med(depart), 2), plus10: depart.filter(x => x > SEUILS.juste10).length, a10: depart.filter(x => x <= SEUILS.juste10).length },
    actions: { n: actions.length, erreurMedianeMm: arrondi(med(actions), 2) }, detail: detail.sort((a, b) => a.cut - b.cut) };
}
function texteComparaison(R, sceau) {
  const b = x => `${x.agit} actions, ${x.justes} justes (${x.justes5} à 5 mm), ${x.abimes} abîmés, ${x.mauvaiseVoie} mauvaises voies (erreur > 50 mm : ${x.erreur50} ; > 45 mm en travers depuis le départ : ${x.amplitude45} ; hors du corridor de la série : ${x.horsCorridor}), ${x.erreurs} erreurs, ${x.abstentions} abstentions, ${x.laisseFaux} grosses laissées fausses`;
  const L1 = [`Comparaison des différés — partie ${R.partie} — fichier scellé SHA-256 ${sceau}`, `${R.differes} différés prédits ; non jugés : ${JSON.stringify(R.nonJuges)}`,
    `Total (${R.total.visites} jugés, ${R.total.micSup10} corrigés de plus de 10 mm) : ${b(R.total)} ; borne haute de Wilson de l'erreur : ${R.total.erreurWilsonHaute ?? '—'}`];
  for (const z of ZONES) if (R.parZone[z].visites) L1.push(`  ${z} (${R.parZone[z].visites}) : ${b(R.parZone[z])} ; rappel à 10 mm ${R.parZone[z].rappel10.k}/${R.parZone[z].rappel10.n} ; départ médian ${R.parZone[z].departMedianMm ?? '—'} mm, action médiane ${R.parZone[z].actionMedianeMm ?? '—'} mm`);
  L1.push(`Rappel atteignable (paire à 10 mm) : ${R.rappel.paireA10.k}/${R.rappel.paireA10.n}, sur les > 10 mm : ${R.rappel.paireA10.kGrosses}/${R.rappel.paireA10.nGrosses}`);
  L1.push(`Pose de départ du lot : ${R.departDuLot.a10} à 10 mm de l'opérateur, ${R.departDuLot.plus10} à plus de 10 mm, médiane ${R.departDuLot.medianeMm ?? '—'} mm ; actions de la GCV2 : erreur médiane ${R.actions.erreurMedianeMm ?? '—'} mm`);
  return L1.join('\n');
}

/* ------------------------------------------------------------------ ligne de commande */
function args(argv) {
  const o = { mode: argv[0], corpus: [], echo: [], jugerReservee: false, projetConfirme: true };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--partie') { const m = /^([1-9]\d*):([1-9]\d*)$/.exec(val()); if (!m) throw Error('--partie PROJET:PARTIE'); o.projet = Number(m[1]); o.partie = Number(m[2]); }
    else if (k === '--journal') o.journal = val(); else if (k === '--corpus') o.corpus.push(val()); else if (k === '--sortie') o.sortie = val();
    else if (k === '--parametres') o.parametres = val(); else if (k === '--predictions') o.predictions = val(); else if (k === '--echo') o.echo.push(val()); else if (k === '--json') o.json = val();
    else if (k === '--juger-partie-reservee') o.jugerReservee = true; else if (k === '--projet-non-confirme') o.projetConfirme = false;
    else throw Error('argument inconnu : ' + k);
  }
  return o;
}
function main(argv) {
  const a = args(argv), journal = m => process.stderr.write(m + '\n');
  if (a.mode === 'predire') {
    if (!a.partie || !a.journal || !a.corpus.length || !a.sortie) throw Error('predire --partie P:N --journal J.json --corpus C.json [--corpus …] --sortie PRED.jsonl [--juger-partie-reservee] [--projet-non-confirme]');
    const m = Manifeste.lire(), c = Manifeste.controler(m, [{ projet: a.projet, partie: a.partie }], { outil: 'gcv2-predire-differes', jugerReservee: a.jugerReservee });
    if (c.avis) journal(c.avis);
    const fParams = a.parametres || PARAMETRES, bufParams = fs.readFileSync(fParams), parametres = JSON.parse(bufParams.toString('utf8'));
    const j = JSON.parse(fs.readFileSync(a.journal, 'utf8')), etat = etatDuLot(j, a.partie), ids = [...new Set(etat.decisions.map(d => d.captureId).filter(Boolean))];
    const t0 = Date.now(), captures = capturesDuCorpus(a.corpus, ids);
    journal(`captures du lot retrouvées dans le corpus : ${captures.size}/${ids.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
    const r = predire({ journal: j, captures, parametres, projet: a.projet, partie: a.partie, projetConfirme: a.projetConfirme, empreinteParametres: sha256(bufParams), journalTexte: journal });
    const texte = enJsonl(r.lignes);
    fs.mkdirSync(path.dirname(path.resolve(a.sortie)), { recursive: true });
    fs.writeFileSync(a.sortie, texte);
    const R = r.resume;
    process.stdout.write(`partie ${a.projet}:${a.partie} : ${R.differes} différés (${R.avecNuage} avec nuage, ${R.sansNuage} sans), calculés ${R.calcules}, erreurs ${R.erreurs} ; GCV2 V1+ : agit ${R.agit}, laisse ${R.laisse}, s'abstient ${R.abstient} ; `
      + `candidats H6 ${R.candidatsH6}, H6 retenue ${R.h6Retenue} ; voie de série sûre ${R.voieSure}, drapeaux de voie ${R.drapeauxVoie}, départ hors du corridor de la série ${R.departHorsCorridor} ; zones ${JSON.stringify(R.parZone)} ; `
      + `rejeu : étage identique au lot ${R.etageRejeuIdentique}/${R.calcules}, appuis identiques ${R.appuisRejeuIdentiques}/${R.calcules} ; ${Math.round((Date.now() - t0) / 1000)} s\n`);
    process.stdout.write(`SHA-256 ${sha256(Buffer.from(texte, 'utf8'))}  ${a.sortie}\n`);
  } else if (a.mode === 'comparer') {
    if (!a.predictions || !a.echo.length) throw Error('comparer --predictions PRED.jsonl --echo DOSSIER [--echo …] [--json R.json]');
    const buf = fs.readFileSync(a.predictions), pred = lirePredictions(buf.toString('utf8')), m = /^(\d+):(\d+)$/.exec(pred.entete.partie);
    const R = comparerPredictions(pred, micDepuisEcho(a.echo, Number(m[2]), pred.differes.map(d => d.cut)));
    if (a.json) fs.writeFileSync(a.json, JSON.stringify(R, null, 1) + '\n');
    process.stdout.write(texteComparaison(R, sha256(buf)) + '\n');
  } else throw Error('mode : predire | comparer');
}

module.exports = { FORMAT, FORMAT_COMPARAISON, VERSION, USAGE, VARIANTE, SEUILS, etatDuLot, empreinteEtat, cutsDuLot, capturesDuCorpus, capturePourMoteur, avecNuage, zonesCausales, zoneDe,
  modeleFige, probas, casDuDiffere, deciderDiffere, predire, enJsonl, lirePredictions, micDepuisEcho, comparerPredictions, texteComparaison, args, sha256 };

if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`gcv2-predire-differes : ${e.message}\n`); process.exitCode = 1; } }
