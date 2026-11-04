#!/usr/bin/env node
'use strict';
/*
 * taux-apprenables.cjs — CH-049-D : mesure le taux de cuts apprenables d'un export Écho (+ journal Orbite si présent).
 * Outil hors ligne, lecture seule, aucune dépendance. Ne rapporte que du compté sur l'export.
 *
 *   node tools/taux-apprenables.cjs --echo <dossier|fichier.json|volume.zip …> [--journal ariane-journal-v4-….json]
 *        [--partie N] [--json sortie.json]
 *
 * DÉFINITION (chantiers/CH-049.md) — un cut est apprenable si l'export contient, pour lui :
 *   (1) l'état initial qualifié des DEUX rails  : la visite retenue a, pour chaque rail, un instantané de départ
 *       qualifié (`geometryEligibility[rail].captureId` non nul : la qualification de `chooseGeometry`, qui exige
 *       l'état initial établi et un instantané qualifié pris avant le premier geste) ;
 *   (2) la pose humaine finale                  : `humanFinalReference.state.rails` porte les deux rails ;
 *   (3) le nuage LiDAR retrouvable              : l'identifiant de capture de chaque rail existe dans l'UNION des
 *       nuages de TOUS les segments donnés (décodage de tools/merge-segments.cjs) ;
 *   (4) aucune ambiguïté d'intention            : la visite retenue n'a qu'une nature d'intention (VALIDATE, répétée
 *       ou non), et la dernière visite du cut qui porte une intention n'est pas une autre décision (SKIP…) venue après une validation.
 * Taux = cuts apprenables / cuts validés par l'opérateur. Cut validé = au moins une visite du cut porte une intention
 * VALIDATE. Visite retenue = la dernière visite du cut qui porte une intention (celle qui fait foi).
 *
 * VENTILATION : (a) en cascade — chaque cut non apprenable est compté une fois, au premier critère qui échoue dans
 * l'ordre 1, 2, 3, 4 ; (b) indépendante — combien de cuts échouent à chaque critère, un cut pouvant échouer à plusieurs.
 * Le critère 3 distingue : nuage déclaré par la session mais absent de l'union (segments manquants : export PARTIEL),
 * et nuage jamais déposé ou libéré avant export.
 *
 * EXPORT PARTIEL. Si des identifiants déclarés manquent dans l'union (segments absents), le critère 3 est sous-estimé :
 * le rapport l'écrit en tête et qualifie le taux PROBABLE (borne basse), jamais ÉTABLI.
 */
const fs = require('node:fs');
const path = require('node:path');
const V = require('./lire-volumes.cjs');
const { mergeFiles } = require('./merge-segments.cjs');

const NOM_EXPORT_ECHO = /^(ariane|banane)-(native-v\d+|echo)-/;
const COTES = ['left', 'right'];

const fini = v => Number.isFinite(v);
const quantile = (vals, p) => {
  const v = vals.filter(fini).sort((a, b) => a - b);
  if (!v.length) return null;
  const at = (v.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at);
  return v[lo] + (v[hi] - v[lo]) * (at - lo);
};
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const stat = vals => { const v = vals.filter(fini); return { n: v.length, medianeS: arrondi(quantile(v, .5)), p90S: arrondi(quantile(v, .9)), maxS: v.length ? arrondi(Math.max(...v)) : null }; };
const pct = (a, b) => b ? arrondi(a / b * 100) : null;
const ms = t => { const x = Date.parse(t || ''); return Number.isFinite(x) ? x : null; };

/* Entrées d'export : un dossier ne retient que les exports Écho (par le nom), comme tools/jointure-echo-orbite.cjs. */
function entreesEcho(chemins) {
  const out = [];
  for (const c of chemins) {
    const dossier = fs.existsSync(c) && fs.statSync(c).isDirectory();
    for (const e of V.entrees(c)) { if (dossier && !NOM_EXPORT_ECHO.test(e.nom)) continue; out.push(e); }
  }
  return out;
}
/* Poids sur disque : un fichier ou un volume zip compte une fois (taille du fichier du disque). */
function poidsDisque(entrees) {
  const vus = new Set(); let octets = 0, fichiers = 0;
  for (const e of entrees) {
    const f = e.dansZip || e.chemin;
    if (vus.has(f)) continue; vus.add(f);
    try { octets += fs.statSync(f).size; fichiers++; } catch { /* entrée en mémoire */ }
  }
  return { fichiers, octets };
}

const intentionsDe = r => (r.operatorIntents || []).map(i => i && i.intent).filter(Boolean);
const rangVisite = r => `${r.startedAt || ''}|${String(r.visitIndex ?? 0).padStart(8, '0')}`;
const ecritureValidation = r => (r.serverWrites || []).some(w => w && w.kind === 'validation' && w.status >= 200 && w.status < 300);

function mesurer(entrees, { partie = null, journal = null } = {}) {
  const { merged, missing, totalPoints } = mergeFiles(entrees, { leger: true });
  const manquantsDeclares = new Set(missing);
  const nuages = new Map();
  for (const c of merged.clouds || []) for (const id of [c.captureId, c.chunkId]) if (id) nuages.set(id, c);

  const parCut = new Map();
  for (const r of merged.records || []) {
    const id = r.identity || {};
    if (!Number.isInteger(id.cut)) continue;
    if (partie !== null && id.part !== partie) continue;
    const k = `${id.part ?? '?'}|${id.cut}`;
    (parCut.get(k) || parCut.set(k, []).get(k)).push(r);
  }

  const cuts = [];
  for (const [cle, visites] of parCut) {
    visites.sort((a, b) => rangVisite(a).localeCompare(rangVisite(b)));
    const valide = visites.some(r => intentionsDe(r).includes('VALIDATE'));
    if (!valide) continue;
    const avecIntention = visites.filter(r => intentionsDe(r).length);
    const v = avecIntention.at(-1);
    const natures = [...new Set(intentionsDe(v))];
    const ge = v.geometryEligibility || {};
    const ids = {};
    for (const s of COTES) ids[s] = ge[s] && ge[s].captureId || null;
    const refRails = v.humanFinalReference && v.humanFinalReference.state && v.humanFinalReference.state.rails || {};

    const c1 = COTES.every(s => ids[s]);
    const c2 = COTES.every(s => refRails[s]);
    let c3 = c1, c3cause = c1 ? null : 'sans-identifiant-de-capture';
    if (c1) for (const s of COTES) {
      const id = ids[s], chunks = ge[s].chunkIds || [];
      const ok = nuages.has(id) || (chunks.length > 0 && chunks.every(x => nuages.has(x)));
      if (!ok) { c3 = false; c3cause = manquantsDeclares.has(id) || chunks.some(x => manquantsDeclares.has(x)) ? 'declare-absent-segments-manquants' : 'jamais-depose-ou-libere'; break; }
    }
    const c4 = natures.length === 1 && natures[0] === 'VALIDATE';
    const c4cause = c4 ? null : natures.length > 1 ? 'natures-melangees' : 'decision-ulterieure-differente';

    /* Durées : la visite (horodatages) et la capture (début → fin des nuages retenus). */
    const dVisite = ms(v.endedAt) !== null && ms(v.startedAt) !== null ? (ms(v.endedAt) - ms(v.startedAt)) / 1000 : null;
    const bornes = COTES.map(s => nuages.get(ids[s])).filter(Boolean);
    const debuts = bornes.map(c => ms(c.startedAt)).filter(fini), fins = bornes.map(c => ms(c.completedAt)).filter(fini);
    const dCapture = debuts.length && fins.length ? (Math.max(...fins) - Math.min(...debuts)) / 1000 : null;
    const [part, cut] = cle.split('|');
    cuts.push({ part, cut: Number(cut), visites: visites.length, visiteRetenue: v.visitIndex ?? null, c1, c2, c3, c4, c3cause, c4cause,
      apprenable: c1 && c2 && c3 && c4, dureeVisiteS: dVisite, dureeCaptureS: dCapture, ecritureValidation: ecritureValidation(v) });
  }

  const n = cuts.length, ok = cuts.filter(c => c.apprenable).length;
  const cascade = { 'etat-initial-non-qualifie': 0, 'pose-humaine-absente': 0, 'nuage-introuvable': 0, 'intention-ambigue': 0 };
  for (const c of cuts) if (!c.apprenable) cascade[!c.c1 ? 'etat-initial-non-qualifie' : !c.c2 ? 'pose-humaine-absente' : !c.c3 ? 'nuage-introuvable' : 'intention-ambigue']++;
  const echecs = { c1: cuts.filter(c => !c.c1).length, c2: cuts.filter(c => !c.c2).length, c3: cuts.filter(c => !c.c3).length, c4: cuts.filter(c => !c.c4).length };
  const causes3 = {}; for (const c of cuts) if (c.c1 && !c.c3) causes3[c.c3cause] = (causes3[c.c3cause] || 0) + 1;
  const causes4 = {}; for (const c of cuts) if (!c.c4) causes4[c.c4cause] = (causes4[c.c4cause] || 0) + 1;

  const fins = {};
  for (const c of merged.clouds || []) { const k = c.termination && c.termination.code || (c.status === 'reading' ? 'NOT_REPORTED' : 'NONE'); fins[k] = (fins[k] || 0) + 1; }

  const poids = poidsDisque(entrees);
  const partiel = missing.length > 0;
  const res = {
    outil: 'taux-apprenables.cjs', critere: 'chantiers/CH-049.md',
    exportPartiel: partiel,
    qualification: partiel ? 'PROBABLE (borne basse : des nuages déclarés manquent dans l\'union, segments absents)' : 'ÉTABLI (compté sur l\'union des segments donnés ; voir « ce que la métrique ne mesure pas »)',
    segments: (merged.mergeTrace.segments || []).length, nuagesUnion: (merged.clouds || []).length, nuagesDeclares: merged.mergeTrace.declaredCloudIds, nuagesDeclaresManquants: missing.length, points: totalPoints,
    records: (merged.records || []).length,
    cutsValides: n, cutsApprenables: ok, tauxApprenablesPct: pct(ok, n),
    pertesCascade: cascade, pertesCascadePct: Object.fromEntries(Object.entries(cascade).map(([k, x]) => [k, pct(x, n)])),
    echecsIndependants: echecs, causesNuageIntrouvable: causes3, causesIntentionAmbigue: causes4,
    fins: fins,
    duree: { visiteParCut: stat(cuts.map(c => c.dureeVisiteS)), captureParCut: stat(cuts.map(c => c.dureeCaptureS)),
      captureParCutApprenable: stat(cuts.filter(c => c.apprenable).map(c => c.dureeCaptureS)) },
    poids: { ...poids, octetsParCutValide: n ? Math.round(poids.octets / n) : null, octetsParCutApprenable: ok ? Math.round(poids.octets / ok) : null },
    cuts,
  };
  if (journal) res.orbite = croiserJournal(journal, cuts);
  return res;
}

/* Journal Orbite (lot automatique) : un cut est « posé au journal » s'il porte un événement validation-accepted. Lecture
 * volontairement minimale (la jointure fine est dans tools/jointure-echo-orbite.cjs) ; qualifiée PROBABLE. */
function croiserJournal(doc, cuts) {
  const poses = new Set();
  for (const e of doc.events || []) {
    const id = e && e.identity;
    if (e && e.type === 'validation-accepted' && id && Number.isInteger(id.cut)) poses.add(`${id.part ?? '?'}|${id.cut}`);
  }
  const dans = cuts.filter(c => poses.has(`${c.part}|${c.cut}`)), hors = cuts.filter(c => !poses.has(`${c.part}|${c.cut}`));
  return { qualification: 'PROBABLE (lecture minimale des événements validation-accepted)', cutsPosesAuJournal: poses.size,
    valides: { poseAuJournal: dans.length, horsJournal: hors.length },
    apprenables: { poseAuJournal: dans.filter(c => c.apprenable).length, horsJournal: hors.filter(c => c.apprenable).length } };
}

function rapport(r) {
  const L = [];
  L.push(`Taux de cuts apprenables : ${r.cutsApprenables} / ${r.cutsValides} = ${r.tauxApprenablesPct ?? 'n/a'} %   [${r.qualification}]`);
  if (r.exportPartiel) L.push(`ATTENTION export PARTIEL : ${r.nuagesDeclaresManquants} nuage(s) déclaré(s) absent(s) de l'union (${r.nuagesUnion} présents sur ${r.nuagesDeclares} déclarés). Ne pas présenter ce taux comme définitif.`);
  L.push(`Source : ${r.segments} segment(s), ${r.records} records, ${r.nuagesUnion} nuages (union), ${r.points} points.`);
  L.push('Pertes en cascade (premier critère en échec) :');
  for (const [k, x] of Object.entries(r.pertesCascade)) L.push(`   ${k.padEnd(28)} ${String(x).padStart(5)}  ${r.pertesCascadePct[k] ?? 'n/a'} %`);
  L.push(`Échecs indépendants (un cut peut échouer à plusieurs) : état initial ${r.echecsIndependants.c1}, pose humaine ${r.echecsIndependants.c2}, nuage ${r.echecsIndependants.c3}, intention ${r.echecsIndependants.c4}`);
  if (Object.keys(r.causesNuageIntrouvable).length) L.push('   nuage introuvable (état initial qualifié) : ' + JSON.stringify(r.causesNuageIntrouvable));
  if (Object.keys(r.causesIntentionAmbigue).length) L.push('   intention ambiguë : ' + JSON.stringify(r.causesIntentionAmbigue));
  L.push('Fins de capture (nuages de l\'union) : ' + JSON.stringify(r.fins));
  const d = r.duree;
  L.push(`Durée de la visite par cut (s) : n=${d.visiteParCut.n} médiane ${d.visiteParCut.medianeS} p90 ${d.visiteParCut.p90S} max ${d.visiteParCut.maxS}`);
  L.push(`Durée de capture par cut (s)   : n=${d.captureParCut.n} médiane ${d.captureParCut.medianeS} p90 ${d.captureParCut.p90S} max ${d.captureParCut.maxS}`);
  L.push(`Poids de l'export : ${r.poids.fichiers} fichier(s), ${(r.poids.octets / 1e6).toFixed(1)} Mo ; ${r.poids.octetsParCutValide === null ? 'n/a' : (r.poids.octetsParCutValide / 1e6).toFixed(2)} Mo par cut validé, ${r.poids.octetsParCutApprenable === null ? 'n/a' : (r.poids.octetsParCutApprenable / 1e6).toFixed(2)} Mo par cut apprenable`);
  if (r.orbite) L.push(`Orbite : ${r.orbite.cutsPosesAuJournal} cut(s) posé(s) au journal ; validés ${JSON.stringify(r.orbite.valides)} ; apprenables ${JSON.stringify(r.orbite.apprenables)}   [${r.orbite.qualification}]`);
  L.push('Ce que la métrique ne mesure PAS : (a) la qualité de la pose humaine (une validation par réflexe compte comme apprenable) ; (b) les cuts non validés (SKIP, non visités, laissés à Ariane) : ils sont hors dénominateur ; (c) la représentativité des cuts validés ; (d) l\'exactitude du nuage (présent ≠ utile) ; (e) l\'utilité d\'apprentissage d\'un cut (un cut sans correction est « apprenable » comme un cut corrigé) ; (f) un export partiel donne une borne basse.');
  return L.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const iE = argv.indexOf('--echo');
  const chemins = [];
  if (iE >= 0) for (let i = iE + 1; i < argv.length && !argv[i].startsWith('--'); i++) chemins.push(argv[i]);
  if (!chemins.length) { console.error('Usage : --echo <dossier|fichiers|volumes zip …> [--journal fichier.json] [--partie N] [--json sortie.json]'); process.exit(1); }
  const entrees = entreesEcho(chemins);
  if (!entrees.length) { console.error('Aucun export Écho trouvé.'); process.exit(1); }
  const journal = opt('--journal') ? JSON.parse(fs.readFileSync(opt('--journal'), 'utf8')) : null;
  const partie = opt('--partie') !== undefined ? Number(opt('--partie')) : null;
  const res = mesurer(entrees, { partie, journal });
  console.log(rapport(res));
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(res, null, 1));
}
if (require.main === module) main();
module.exports = { mesurer, rapport, entreesEcho };
