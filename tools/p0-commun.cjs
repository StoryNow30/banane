'use strict';
/*
 * p0-commun.cjs — socle des trois mesures P0 du plan 5.0 (hors ligne, lecture seule, rien sous src/).
 *
 * Une « ligne » = un rail d'une visite, rejoué : on refait tourner le moteur d'ombre (`gcv1-shadow`, donc
 * `Candidate.propose`, S1, calage de convention et garde d'écartement) sur le nuage de la visite, puis on
 * lit la pose humaine finale seulement APRÈS le calcul (même discipline que `tools/convention-fit.cjs`).
 * Toutes les grandeurs sont dans le repère profil du rail à sa pose de départ, en millimètres :
 * jamais de coordonnée absolue dans une ligne.
 *
 *   lectureSession(chemins)      → session fusionnée (segments d'Écho en dossier, fichiers ou volumes zip)
 *   rejeuCapture(capture, ref)   → { gauche, droite, paire } pour une capture déjà assemblée (testable)
 *   rejeuSession(session, opts)  → lignes de tous les rails de toutes les visites d'un Écho
 *   lignesDepuisJournal(journal) → lignes de ce qu'Ariane a réellement fait (journal d'Orbite), avec la pose de l'opérateur de la table de jointure
 *
 * Les mesures (p0a, p0b, p0c) lisent des lignes, soit rejouées à la volée (--echo), soit déjà extraites
 * (--lignes FICHIER.json, produit par `node tools/p0-commun.cjs --echo DOSSIER --sortie lignes.json`), soit lues au journal d'Orbite (--journal).
 */
const fs = require('node:fs');

const COTES = ['left', 'right'];
const NOM_COTE = { left: 'gauche', right: 'droite' };
const MAUVAISE_POSE_MM = 10;

/* ------------------------------------------------------------------ outils numériques */
const fini = v => Number.isFinite(v);
const arrondi = (v, d = 2) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
function quantile(valeurs, p) {
  const v = valeurs.filter(fini).sort((a, b) => a - b);
  if (!v.length) return null;
  const at = (v.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return v[lo] + (v[hi] - v[lo]) * (at - lo);
}
const mediane = valeurs => quantile(valeurs, .5);
const compte = (valeurs, seuil) => valeurs.filter(v => fini(v) && v > seuil).length;


/* ------------------------------------------------------------------ statistiques de comparaison (déterministes) */
/* Générateur pseudo-aléatoire à graine fixe : un rapport se reproduit à l'identique. */
function prng(graine = 20261015) {
  let a = graine >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* Intervalle à 95 % de la médiane, par rééchantillonnage. */
function icMediane(valeurs, { B = 2000, graine = 20261015 } = {}) {
  const v = valeurs.filter(fini);
  if (v.length < 5) return null;
  const rnd = prng(graine), meds = [];
  for (let b = 0; b < B; b++) { const e = new Array(v.length); for (let i = 0; i < v.length; i++) e[i] = v[Math.floor(rnd() * v.length)]; meds.push(quantile(e, .5)); }
  return [arrondi(quantile(meds, .025)), arrondi(quantile(meds, .975))];
}
/* Test des signes exact (bilatéral) sur des différences appariées : gagne = différence < −tolérance. */
function testeSignes(differences, tolerance = 0) {
  const d = differences.filter(fini);
  const gagne = d.filter(x => x < -tolerance).length, perd = d.filter(x => x > tolerance).length, egal = d.length - gagne - perd;
  const n = gagne + perd, k = Math.min(gagne, perd);
  let p = 1;
  if (n > 0) {
    let acc = 0, c = 1; // c = C(n, i)
    for (let i = 0; i <= k; i++) { if (i > 0) c = c * (n - i + 1) / i; acc += c; }
    p = Math.min(1, 2 * acc / 2 ** n);
  }
  return { gagne, perd, egal, p: n ? Math.round(p * 1000) / 1000 : null };
}
/* Aire sous la courbe ROC du score pour prédire l'étiquette vraie (rangs, égalités à demi). */
function auc(scores, etiquettes) {
  const pos = [], neg = [];
  scores.forEach((s, i) => { if (!fini(s)) return; (etiquettes[i] ? pos : neg).push(s); });
  if (!pos.length || !neg.length) return null;
  let acc = 0;
  for (const a of pos) for (const b of neg) acc += a > b ? 1 : a === b ? .5 : 0;
  return arrondi(acc / (pos.length * neg.length), 3);
}

/* ------------------------------------------------------------------ rejeu d'une capture */
let _modules = null;
function modules() {
  if (!_modules) {
    _modules = {
      Shadow: require('../src/gcv1-shadow.js'),
      Candidate: require('../src/geometry-candidate-v1.js'),
    };
  }
  return _modules;
}
const mm3 = d => Array.isArray(d) ? d.map(x => arrondi(x * 1000, 3)) : null;

/* Pente brute du flanc recalculée sur une bande de profondeur [lo, hi] mètres sous le plan de roulement
 * (même construction que `Candidate.propose`, qui prend 9 à 34 mm). Sert au parallèle « pente sur la seule
 * bande 14 à 30 mm » de l'idée 5. Rend { pente, lignes } ou null. */
function penteFlancBande(capture, cote, p, sign, lo, hi) {
  const { Candidate } = modules();
  const C = require('../vendor/capture-core.js');
  const rail = capture.rails && capture.rails[cote];
  if (!rail || !p.top || !p.metrics || !fini(sign)) return null;
  const u0 = sign * p.metrics.seed[0], band = Candidate.DEFAULTS.faceBand, rows = [];
  const pts = capture.pointsSceneRelative || [];
  for (let i = 0; i < pts.length; i++) {
    if (capture.visibleByClipBoxes && capture.visibleByClipBoxes[i] === false) continue;
    const src = pts[i];
    if (!Array.isArray(src) || !src.every(fini)) continue;
    const q = C.point(rail.sceneRelativeToProfileLocal, src);
    if (!q.every(fini) || !(Math.abs(q[0]) <= .5 && Math.abs(q[1]) < .18 && Math.abs(q[2]) < .10)) continue;
    const u = sign * q[1], z = q[2], drop = p.top.slope * u + p.top.intercept - z;
    if (drop > lo && drop < hi && Math.abs(u - u0) < band) rows.push([z, u]);
  }
  const line = Candidate.robustLine(rows);
  return line ? { pente: arrondi(line.rawSlope, 4), lignes: rows.length } : { pente: null, lignes: rows.length };
}

/* Grandeurs de l'estimateur « graine / intersection » : un appel de `Candidate.propose` avec la même
 * configuration que l'ombre (graine médiane des points, fenêtre recentrée, flanc partiel gardé). Les
 * métriques existent même quand le rail est refusé pour manque d'appui ; elles manquent seulement quand
 * le plan de roulement ou l'intersection sont inestimables. */
function mesuresPropose(capture, cote, uSeed, sign) {
  const { Candidate } = modules();
  let p;
  try { p = Candidate.propose(capture, cote, { lab: { uSeeds: [uSeed], replaceOrigin: false, recenterWindow: true, partialFaceKeep: true } }); }
  catch (e) { return { statut: 'erreur', raison: String(e.message || e).slice(0, 80) }; }
  const m = p.metrics;
  const out = { statut: p.status, motif: null };
  if (!m) { out.metriques = false; out.raison = (p.reasons || []).join(' ').slice(0, 80); return out; }
  out.metriques = true;
  out.graineMm = [arrondi(m.seed[0] * 1000, 3), arrondi(m.seed[1] * 1000, 3)];
  out.interMm = [arrondi(m.surfaceIntersection[0] * 1000, 3), arrondi(m.surfaceIntersection[1] * 1000, 3)];
  out.pointsDessus = m.topCount; out.pointsFlanc = m.faceCount;
  out.penteDessus = p.top ? arrondi(p.top.rawSlope, 4) : null;
  out.penteFlanc = p.face ? arrondi(p.face.rawSlope, 4) : null;
  out.penteDessusLimitee = !!(p.top && p.top.slopeLimited);
  out.penteFlancLimitee = !!(p.face && p.face.slopeLimited);
  out.raison = p.status === 'candidate' ? null : (p.reasons || []).join(' ').slice(0, 80);
  const bande = penteFlancBande(capture, cote, p, sign, .014, .030);
  out.penteFlancBande14_30 = bande ? bande.pente : null;
  out.lignesFlancBande14_30 = bande ? bande.lignes : null;
  return out;
}

/* Une ligne depuis un rail « scientifique » (sortie de `scientificProposeBoth`, ou son enregistrement dans
 * l'événement `gcv1-shadow-observed` du journal Orbite : mêmes champs). */
function ligneDepuisRail(r, cote, id = {}) {
  const ligne = { ...id, cote, ok: !!(r && r.ok) };
  if (!r || !r.ok) { ligne.raison = String(r && (r.reason || r.error) || 'rail-absent').slice(0, 80); return ligne; }
  const brut = r.next.rawDelta || r.next.delta;
  ligne.signe = r.frame.sign;
  ligne.moteur = {
    v46: r.v46 ? { statut: r.v46.status, motif: r.v46.motif || null } : null,
    astar: r.astar ? { statut: r.astar.status, motif: r.astar.motif || null, deltaMm: mm3(r.astar.delta), pointsFlanc: r.astar.faceCount ?? null, pointsDessus: r.astar.topRows ?? null, penteLimitee: !!r.astar.slopeLimited } : null,
    statut: r.next.status, motif: r.next.motif || null, deltaBrutMm: r.next.status === 'candidate' ? mm3(brut) : null,
    deltaPublieMm: r.next.status === 'candidate' ? mm3(r.next.delta) : null,
    repeche: !!(r.next.changed || r.s1Changed), s1Active: !!(r.next.activated || r.s1Activated),
    pointsFlanc: r.next.faceCount ?? null, pointsDessus: r.next.topRows ?? null, penteLimitee: !!r.next.slopeLimited,
  };
  const c = r.conventionCalibration;
  ligne.convention = c ? { appliquee: !!c.applied, raison: c.reason || null, duMm: arrondi(c.duMm, 3), dzMm: arrondi(c.dzMm, 3), pointsDessus: c.topN ?? null, pointsFlanc: c.faceN ?? null, modeFlanc: c.faceMode || null } : null;
  ligne.ecartement = r.pairGauge ? { classe: r.pairGauge.gaugeClass || null, rejete: !!r.pairGauge.rejected, mesurable: !!r.pairGauge.measurable, predit: arrondi(r.pairGauge.predictedMm, 2), avant: arrondi(r.pairGauge.beforeMm, 2) } : null;
  return ligne;
}

/* capture : { rails:{left,right}, pointsSceneRelative, visibleByClipBoxes, identity? }
 * reference : { left:[dx,dy,dz], right:[…] } en mètres, repère profil de la pose de départ (ou null).
 * Rend { gauche, droite, paire } ; chaque côté est une ligne (voir l'en-tête). */
function rejeuCapture(capture, reference = null, { id = {} } = {}) {
  const { Shadow } = modules();
  const prev = Shadow.state().convention;
  Shadow.configure({ convention: true });
  let science;
  try { science = Shadow.scientificProposeBoth(capture); } finally { Shadow.configure({ convention: prev }); }
  const out = { paire: { ecartementRejete: !!(science.summary && science.summary.pairGaugeRejected), ecartementMm: arrondi(science.summary && science.summary.pairGaugeMm, 1) } };
  for (const cote of COTES) {
    const ligne = ligneDepuisRail(science.rails[cote], cote, id);
    if (ligne.ok) ligne.propose = mesuresPropose(capture, cote, science.rails[cote].frame.uSeed, science.rails[cote].frame.sign);
    const h = reference && reference[cote];
    ligne.humainMm = Array.isArray(h) && h.every(fini) ? mm3(h) : null;
    out[NOM_COTE[cote]] = ligne;
  }
  return out;
}

/* ------------------------------------------------------------------ rejeu d'une session (Écho ou Orbite natif) */
function observationsParVisite(session) {
  const map = new Map();
  for (const e of session.events || []) if (e.visitId && ['native-visit-started', 'native-state-observed'].includes(e.type)) {
    const rows = map.get(e.visitId) || [];
    rows.push({ type: e.type, eventSeq: e.eventSeq, state: e.type === 'native-visit-started' ? e.initialObserved : e.state });
    map.set(e.visitId, rows);
  }
  for (const rows of map.values()) rows.sort((a, b) => a.eventSeq - b.eventSeq);
  return map;
}

function rejeuSession(session, { etiquette = 'session', journal = () => {}, limite = Infinity } = {}) {
  const Lab = require('./placement-lab.cjs');
  const clouds = new Map((session.clouds || []).map(c => [c.chunkId || c.captureId, c]));
  const obs = observationsParVisite(session);
  const lignes = [], refus = {};
  let n = 0;
  for (const record of session.records || []) {
    if (n++ >= limite) break;
    let prepared;
    try { prepared = Lab.prepareVisit(record, clouds, obs.get(record.visitId) || []); } catch (e) { refus['preparation'] = (refus['preparation'] || 0) + 1; continue; }
    if (prepared.pair?.status !== 'ready') {
      const k = (prepared.pair?.reasons || ['pas-de-paire']).join('+').slice(0, 60);
      refus[k] = (refus[k] || 0) + 1; continue;
    }
    const reference = {};
    let etatRef = null;
    for (const cote of COTES) {
      const input = prepared.rails[cote];
      const ref = Lab.referenceFor(record, cote, input.initialRail, input.snapshotAcquiredThroughAt);
      etatRef = etatRef || ref.status;
      reference[cote] = ref.status === 'candidate' ? ref.deltaLocal : null;
    }
    const id = { etiquette, partie: record.identity?.part ?? null, cut: record.identity?.cut ?? null, visite: record.visitIndex ?? null, etiquetteEcho: record.observedLabelCandidate || null };
    let res;
    try { res = rejeuCapture(prepared.pair.capture, reference, { id }); } catch (e) { refus['moteur: ' + String(e.message).slice(0, 40)] = (refus['moteur: ' + String(e.message).slice(0, 40)] || 0) + 1; continue; }
    for (const cote of COTES) {
      const l = res[NOM_COTE[cote]];
      l.paire = res.paire;
      lignes.push(l);
    }
    if (n % 100 === 0) journal(`${etiquette} : ${n} visites rejouées, ${lignes.length} rails`);
  }
  return { lignes, refus, visites: n };
}

/* ------------------------------------------------------------------ route « journal » : ce qu'Ariane a réellement fait */
/* Référence humaine d'un cut de la table de jointure (`jointure-echo-orbite.cjs`), en mm, dans le repère
 * profil de la POSE DE DÉPART du cut (celle qu'ESV présente avant Ariane) :
 *  - cut posé : déplacement d'Ariane (départ → pose) + écart humain (pose d'Ariane → pose finale de l'opérateur) ;
 *  - cut différé ou autre : écart humain mesuré à la première visite, qui est la pose de départ.
 * Rend null si la référence manque, si le repère profil manque ou si la base n'est pas celle qu'il faut. */
function referenceDepuisTable(t, cote) {
  if (!t || t.referenceHumaine !== 'observee') return null;
  const fr = NOM_COTE[cote];
  const eh = t.ecartHumain && t.ecartHumain[fr];
  if (!eh || eh.repere !== 'profil' || ![eh.longitudinalMm, eh.lateralMm, eh.verticalMm].every(fini)) return null;
  if (t.classe === 'posee') {
    const ad = t.arianeDeplacement && t.arianeDeplacement[fr];
    if (t.base !== 'ariane' || !ad || ad.repere !== 'profil') return null;
    return [eh.longitudinalMm + ad.longitudinalMm, eh.lateralMm + ad.lateralMm, eh.verticalMm + ad.verticalMm].map(v => arrondi(v, 3));
  }
  if (t.base === 'ariane') return null;
  return [eh.longitudinalMm, eh.lateralMm, eh.verticalMm].map(v => arrondi(v, 3));
}

/* Nuages d'un corpus GCV1 d'Orbite (`ariane-gcv1-corpus-*.json`) : captureId → capture (rails, points, découpe). */
function chargerCorpus(entrees) {
  const V = require('./lire-volumes.cjs');
  const map = new Map();
  for (const e of entrees) {
    const dossier = fs.existsSync(e) && fs.statSync(e).isDirectory();
    for (const x of V.entrees(e)) {
      if (dossier && !/gcv1-corpus/.test(x.nom)) continue;
      const doc = JSON.parse(x.lire().toString('utf8'));
      for (const c of doc.clouds || []) if (c.captureId && c.rails && c.pointsSceneRelative) map.set(c.captureId, c);
    }
  }
  return map;
}

/* Une ligne par rail de chaque cut du journal (dernier événement `gcv1-shadow-observed` du cut), avec :
 *  - ce que le moteur a publié, la convention (appliquée ou refusée, avec ses décalages), la décision du lot ;
 *  - la classe Ariane et la référence humaine, si la table de jointure est donnée ;
 *  - les mesures `Candidate.propose` (graine, intersection, pentes brutes), si le corpus est donné. */
function lignesDepuisJournal(journal, { table = null, corpus = null, etiquette = 'orbite', partie = null } = {}) {
  const dernier = new Map();
  for (const e of journal.events || []) {
    if (e.type !== 'gcv1-shadow-observed' || !e.shadow || !e.identity) continue;
    if (partie !== null && e.identity.part !== partie) continue;
    dernier.set(`${e.identity.part}|${e.identity.cut}`, e);
  }
  const parCut = new Map();
  for (const t of table || []) parCut.set(`${t.partie}|${t.cut}`, t);
  const lignes = [];
  for (const [k, e] of dernier) {
    const t = parCut.get(k) || null;
    const lot = e.lotObservation || null;
    const decision = lot ? { etage: lot.stage || null, raison: lot.reason || null, garde: !!lot.pairGuarded, ecartVoisinsMm: fini(lot.guardMm) ? lot.guardMm : null } : null;
    const classeJournal = !lot ? null : lot.stage === 'deferred' ? 'differee' : 'posee';
    const capture = corpus && e.lidarCaptureId ? corpus.get(e.lidarCaptureId) : null;
    for (const cote of COTES) {
      const r = e.shadow.rails && e.shadow.rails[cote];
      const id = { etiquette, partie: e.identity.part, cut: e.identity.cut, visite: 0, classe: t ? t.classe : classeJournal, decision };
      const ligne = ligneDepuisRail(r, cote, id);
      ligne.paire = { ecartementRejete: !!(e.shadow.summary && e.shadow.summary.pairGaugeRejected), ecartementMm: arrondi(e.shadow.summary && e.shadow.summary.pairGaugeMm, 1) };
      if (ligne.ok && capture) ligne.propose = mesuresPropose(capture, cote, r.frame.uSeed, r.frame.sign);
      ligne.humainMm = referenceDepuisTable(t, cote);
      lignes.push(ligne);
    }
  }
  return lignes;
}

/* ------------------------------------------------------------------ lecture d'une session */
function lectureSession(entrees, { filtreNom = /^(ariane|banane)-native-v\d+-/ } = {}) {
  const V = require('./lire-volumes.cjs');
  const Seg = require('./merge-segments.cjs');
  const liste = [];
  for (const e of entrees) {
    const dossier = fs.existsSync(e) && fs.statSync(e).isDirectory();
    for (const x of V.entrees(e)) { if (dossier && !filtreNom.test(x.nom)) continue; liste.push(x); }
  }
  if (!liste.length) throw Error('Aucun export natif trouvé dans : ' + entrees.join(' '));
  return Seg.mergeFiles(liste).merged;
}

/* ------------------------------------------------------------------ erreurs d'une ligne contre l'humain */
/* Erreur d'un delta [x,y,z] (mm) contre l'humain : latérale, verticale, 3D. Le signe latéral est celui du repère
 * profil (y) ; pour parler de « côté champignon », multiplier par `signe`. */
function erreurDelta(deltaMm, humainMm) {
  if (!deltaMm || !humainMm) return null;
  const d = [deltaMm[0] - humainMm[0], deltaMm[1] - humainMm[1], deltaMm[2] - humainMm[2]];
  return { lat: d[1], vert: d[2], long: d[0], d3: Math.hypot(d[0], d[1], d[2]) };
}

/* ------------------------------------------------------------------ ligne de commande : extraction */
function lireArgs(argv) {
  const o = { echo: [], journal: null, jointure: null, corpus: [], lignes: [], sortie: null, etiquette: 'lot', limite: Infinity, partie: null };
  const liste = (cible) => { while (argv[i + 1] && !argv[i + 1].startsWith('--')) cible.push(argv[++i]); };
  let i = 0;
  for (; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--echo') liste(o.echo);
    else if (a === '--corpus') liste(o.corpus);
    else if (a === '--lignes') liste(o.lignes);
    else if (a === '--journal') o.journal = argv[++i];
    else if (a === '--jointure') o.jointure = argv[++i];
    else if (a === '--sortie') o.sortie = argv[++i];
    else if (a === '--etiquette') o.etiquette = argv[++i];
    else if (a === '--partie') o.partie = Number(argv[++i]);
    else if (a === '--limite') o.limite = Number(argv[++i]);
    else throw Error('Argument inconnu : ' + a);
  }
  return o;
}
/* Lignes déjà extraites (--lignes), rejouées sur un Écho (--echo) ou lues au journal d'Orbite (--journal,
 * avec --jointure pour la référence humaine et --corpus pour les mesures de `Candidate.propose`) :
 * point d'entrée commun des trois outils. */
function chargerLignes(opt, journal = () => {}) {
  const lignes = [];
  for (const f of opt.lignes || []) {
    const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const l of doc.lignes) lignes.push(l);
  }
  if ((opt.echo || []).length) {
    const session = lectureSession(opt.echo);
    const r = rejeuSession(session, { etiquette: opt.etiquette || 'echo', journal, limite: opt.limite });
    for (const l of r.lignes) lignes.push(l);
  }
  if (opt.journal) {
    const J = require('./jointure-echo-orbite.cjs');
    const j = J.lireJournal(opt.journal);
    const table = opt.jointure ? JSON.parse(fs.readFileSync(opt.jointure, 'utf8')).table : null;
    const corpus = (opt.corpus || []).length ? chargerCorpus(opt.corpus) : null;
    for (const l of lignesDepuisJournal(j, { table, corpus, etiquette: opt.etiquette || 'orbite', partie: Number.isInteger(opt.partie) ? opt.partie : null })) lignes.push(l);
  }
  return lignes;
}
function main() {
  const o = lireArgs(process.argv.slice(2));
  if (!o.echo.length && !o.journal) {
    console.error('Usage : node tools/p0-commun.cjs (--echo DOSSIER… | --journal J [--jointure table.json] [--corpus DOSSIER…]) [--etiquette NOM] [--partie N] [--sortie lignes.json]');
    process.exit(1);
  }
  const t = Date.now();
  const lignes = chargerLignes(o, m => console.error(m));
  const avecRef = lignes.filter(l => l.humainMm).length;
  console.error(`${lignes.length} rails (${avecRef} avec référence humaine), ${Math.round((Date.now() - t) / 1000)} s`);
  const doc = { format: 'ariane-p0-lignes-v1', creeLe: new Date().toISOString(), etiquette: o.etiquette, lignes };
  if (o.sortie) fs.writeFileSync(o.sortie, JSON.stringify(doc));
}
if (require.main === module) try { main(); } catch (e) { console.error(e.message); process.exit(1); }

module.exports = {
  COTES, NOM_COTE, MAUVAISE_POSE_MM,
  fini, arrondi, quantile, mediane, compte, prng, icMediane, testeSignes, auc,
  rejeuCapture, rejeuSession, lectureSession, chargerLignes, erreurDelta, mesuresPropose, penteFlancBande,
  ligneDepuisRail, lignesDepuisJournal, chargerCorpus, referenceDepuisTable, lireArgs,
};
