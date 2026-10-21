#!/usr/bin/env node
'use strict';
/*
 * banc-differes.cjs — BANC CONJOINT DES DIFFÉRÉS (cap « différés −90 % », D-217 ; candidate L1, D-219 ; fiches/L1_DIFFERES.md). Étude HORS LIGNE :
 * rien n'est commandé dans ESV ; on rejoue les lots Orbite archivés avec le code du dépôt.
 *
 *   node tools/banc-differes.cjs rejouer  --partie P:N --journal J.json --corpus C.json [--corpus …] --lot ID --sortie R.jsonl
 *                                         [--profils base,L1,L1-v,L1-s,L1-se] [--parametres datasets/gcv2-parametres-h6.json] [--liste LISTE.json]
 *                                         [--juger-partie-reservee]
 *   node tools/banc-differes.cjs predire  (mêmes arguments que rejouer ; imprime le SHA-256 du fichier, exige --juger-partie-reservee pour une
 *                                         partie réservée ; aucune entrée humaine, aucun Écho)
 *   node tools/banc-differes.cjs agreger  --rejeu R.jsonl [--rejeu …] [--juges CUTS.jsonl …] [--inventaire INV.json] [--json S.json] [--md S.md]
 *   node tools/banc-differes.cjs resumer  --prediction R.jsonl [--json S.json]   (comparatif sans vérité : différés par zone, poses du lot, vues déplacées)
 *   node tools/banc-differes.cjs comparer --prediction R.jsonl --echo DOSSIER [--echo …] [--json C.json]   (à l'arrivée de l'Écho seulement)
 *
 * REJEU CONJOINT (et non union de contrefactuels). Pour un lot, les cuts sont repris dans l'ordre du lot. Pour chaque cut et chaque PROFIL :
 *   - la science du cut (moteur d'aujourd'hui, avec son réservoir) ; la décision du lot (`L.decideCut`) avec les appuis QUE CE PROFIL a posés avant ;
 *   - la commande (`L.commandRails`) : posé si la commande est celle du lot, ou celle du moteur aux deux rails résolus ; règle « grappe » du lot ;
 *   - profils L1 et L1-v : options du lot de L1 (garde de paire éteinte, appuis à 10 cuts), cible hors de la vue amenée par la vue élargie, puis,
 *     pour un cut que la chaîne ne pose pas, la décision L1 de `src/gcv2-l1.js` (le code de la test 13) ;
 *   - une pose validée devient appui (si la règle « appui = cut posé » le dit, ou pose validée de la GCV2) et voisin des cuts suivants.
 * Profils : « base » (le code d'aujourd'hui sans L1 : fidélité du rejeu), « L1 », « L1-v ». Le sort RÉEL du cut (journal) est joint à chaque ligne.
 * Sortie JSON lignes HORS DÉPÔT : des millimètres dans le repère profil de la pose de départ, des numéros de cut, des comptes.
 *
 * AGRÉGER. Taux de différés (différés / cuts traités) par lot, partie, projet, total ; posés validés, posés non validés (approchés), différés restants ;
 * contre Mic (différés RÉELS jugés par le diagnostic, `--juges` : fichiers cuts-*.jsonl de tools/diag-differes.cjs) : écart de la pose L1 contre écart
 * de la pose de départ, gain par cut (médiane, quartiles), parts à 10 et 20 mm, poses à plus de 50 mm, rappel ; motifs de ce qui reste.
 */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const C = require('../vendor/capture-core.js');
const K = require('../src/core.js');
const L = require('../src/lot-decision.js');
const Sh = require('../src/gcv1-shadow.js');
const M = require('../src/regles-metier.js');
const VR = require('../src/voie-recentree.js');
const L1 = require('../src/gcv2-l1.js');
const EL = require('../src/gcv2-l1e.js');
const D = require('./diag-differes.cjs');

const FORMAT = 'ariane-banc-differes-rejeu-v1', FORMAT_SYNTHESE = 'ariane-banc-differes-synthese-v1', FORMAT_COMPARAISON = 'ariane-banc-differes-comparaison-v1';
const VERSION = 'banc-differes-1';
const SIDES = ['left', 'right'];
const PROFILS = Object.freeze(['base', 'L1', 'L1-v', 'L1-s', 'L1-se']);
/* L1-se (test 14, fiches/L1_APPRENTISSAGE.md) : la chaîne et les verts de L1-s (D-221), la décision des différés de L1-e (src/gcv2-l1e.js). */
const estL1s = p => p === 'L1-s' || p === 'L1-se';
/* D-221 : « L1-s » = la chaîne de la 4.9.5.9 intacte ; L1 seulement sur les cuts qu'elle ne pose pas, sans jamais en faire un appui ni un voisin. */
const CHAINE_ACTUELLE = p => p === 'base' || estL1s(p);
const PARAMETRES = path.join(__dirname, '..', 'datasets', 'gcv2-parametres-h6.json');
const MAX_APPUIS = 40;
const ZONES_OMBRE = (process.env.BANC_OMBRE_VERTS || '').split(',').filter(Boolean);
const fini = v => typeof v === 'number' && Number.isFinite(v);
const arrondi = (v, d = 1) => fini(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
const t = x => Date.parse(x || '');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const norme = v => Math.hypot(v[0], v[1], v[2]);
const moins = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const med = a => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const quantile = (a, q) => { const s = a.filter(fini).sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, b = Math.floor(i); return s[b] + (s[Math.min(b + 1, s.length - 1)] - s[b]) * (i - b); };
const part = (k, n) => n ? arrondi(100 * k / n, 1) : null;

/* ------------------------------------------------------------------ captures (rails, points, visibilité, caméras) */
function chargerCaptures(fichiers, ids) {
  const out = new Map(), voulu = new Set(ids);
  for (const f of fichiers) {
    let doc = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const c of doc.clouds || []) if (c && voulu.has(c.captureId) && c.rails && Array.isArray(c.pointsSceneRelative))
      out.set(c.captureId, { rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: Array.isArray(c.visibleByClipBoxes) ? c.visibleByClipBoxes : c.pointsSceneRelative.map(() => true),
        camera: c.camera || null, viewCaptures: Array.isArray(c.viewCaptures) ? c.viewCaptures : [] });
    doc = null;
  }
  return out;
}
const avecNuage = cap => !!(cap && cap.pointsSceneRelative.length && SIDES.every(s => cap.rails[s] && Array.isArray(cap.rails[s].positionSceneRelative) && Array.isArray(cap.rails[s].sceneRelativeToProfileLocal)
  && Array.isArray(cap.rails[s].profileContours) && cap.rails[s].profileContours.length));

/* ------------------------------------------------------------------ le lot réel (journal) */
/* Le lot : ses cuts dans l'ordre (dernière décision de chaque cut, avant la relecture qui le suit), leur sort réel, la pose réelle des cuts posés,
 * les appuis de départ d'un lot « Reprise », ses réglages. */
function lotReel(journal, partie, lotId) {
  const lots = D.lotsDuJournal(journal).filter(x => x.partie === partie && x.id.startsWith(lotId));
  if (lots.length !== 1) throw Error(`lot ${lotId} de la partie ${partie} : ${lots.length} lot(s) trouvé(s) dans le journal`);
  const lot = lots[0], ev = Array.isArray(journal.events) ? journal.events : [];
  const debut = ev.find(e => e && e.type === 'batch-started' && e.batch && e.batch.id === lot.id);
  const scope = debut ? debut.batch.scope || {} : {};
  const seeds = (scope.lotReprise && Array.isArray(scope.lotReprise.anchors) ? scope.lotReprise.anchors : [])
    .filter(a => a && a.identity && Number.isInteger(a.identity.cut) && a.positions && SIDES.every(s => Array.isArray(a.positions[s])))
    .map(a => ({ identity: { part: partie, cut: a.identity.cut, frameId: null }, positions: { left: a.positions.left.slice(0, 3), right: a.positions.right.slice(0, 3) }, stage: a.stage || 'first-pass' }));
  /* Décision réelle (drapeaux d'appui) de chaque cut : la dernière du lot. */
  const decisions = new Map();
  for (const e of ev) if (e && e.type === 'gcv1-shadow-observed' && e.batchId === lot.id && e.identity && e.identity.part === partie && e.lotObservation && t(e.timestamp) <= Math.max(...lot.cuts.map(c => c.t))) decisions.set(e.identity.cut, e.lotObservation);
  /* Pose réelle d'un cut posé : l'enregistrement de la validation (pose de départ et pose corrigée), le premier après la décision. */
  const records = Array.isArray(journal.records) ? journal.records : [];
  const poseReelle = new Map();
  for (const c of lot.cuts.filter(x => x.pose)) {
    const cands = records.filter(r => r && r.rails && (r.identity || r).cut === c.cut && ((r.identity && r.identity.part) ?? r.part) === partie && t(r.capturedAt || r.startedAt) >= c.t - 120000
      && SIDES.every(s => r.rails[s] && r.rails[s].initial && Array.isArray(r.rails[s].initial.positionSceneRelative) && r.rails[s].corrected && Array.isArray(r.rails[s].corrected.positionSceneRelative)))
      .sort((a, b) => Math.abs(t(a.capturedAt || a.startedAt) - c.t) - Math.abs(t(b.capturedAt || b.startedAt) - c.t));
    const r = cands[0];
    if (r) poseReelle.set(c.cut, { initiale: Object.fromEntries(SIDES.map(s => [s, r.rails[s].initial])), corrigee: Object.fromEntries(SIDES.map(s => [s, r.rails[s].corrected.positionSceneRelative.slice(0, 3)])) });
  }
  return { lot, scope, seeds, decisions, poseReelle, regleGrappe: !!scope.regleGrappeDifferes };
}

/* ------------------------------------------------------------------ rejeu conjoint d'un lot */
const decalPose = (rails, positions) => positions ? Object.fromEntries(SIDES.map(s => [s, L1.decalage(rails[s], positions[s])])) : null;
const optionsDe = profil => CHAINE_ACTUELLE(profil) ? {} : { ...L1.REGLE.lotOptions };
const regleDe = profil => profil === 'L1-v' ? L1.REGLE_V : profil === 'L1-se' ? L1.REGLE_E : L1.REGLE;
const optionsGcv2 = () => ({ ...L1.REGLE.lotOptions });
function plagesDe(mem, e) {
  const P = M.DEFAULTS.pn, A = M.DEFAULTS.adv;
  const pn = mem.zones.map(z => [z.debut - P.margeAvant, z.fin + P.margeApres]), adv = (mem.zonesADV || []).map(z => [Math.max(0, z.debut - A.margeAvant), z.fin + A.margeApres]);
  if (e && e.zone.pnControle) pn.push(e.zone.pnControle);
  if (e && e.zone.advControle) adv.push(e.zone.advControle);
  return { pn, adv };
}
const dans = (plages, c) => plages.some(([a, b]) => c >= a && c <= b);

function rejouerLot({ journal, captures, projet, partie, lotId, parametres, profils = PROFILS, journalTexte = () => {}, liste = null }) {
  const R = lotReel(journal, partie, lotId), lot = R.lot, modele = L1.modeleFige(parametres, 'lot');
  /* L1-se : référence d'écartement de chaque cut, lue dans l'instantané de la liste d'ESV du départ de partie (décompacté) ; sans liste : aucune. */
  const referenceDe = cut => liste ? EL.referenceEcartement(liste, cut) : null;
  /* Mesure seulement : leviers de la décision L1-e changés par la variable d'environnement BANC_LEVIERS (JSON), consignés dans l'en-tête. */
  const leviers = L1.reglerLeviers(process.env.BANC_LEVIERS ? JSON.parse(process.env.BANC_LEVIERS) : null);
  const cuts = lot.cuts.slice().sort((a, b) => a.t - b.t);
  const zoneMem = M.creerMemoire('zones-' + lot.id);
  const etats = Object.fromEntries(profils.map(p => [p, { anchors: R.seeds.map(a => ({ ...a, identity: { ...a.identity }, positions: { left: a.positions.left.slice(), right: a.positions.right.slice() } })),
    valides: [], grappe: M.creerMemoire('grappe-' + p), max: MAX_APPUIS + R.seeds.length }]));
  const lignes = [], restes = [];
  const t0 = Date.now();
  for (const c of cuts) {
    const identity = { part: partie, cut: c.cut, frameId: null }, cap = c.captureId ? captures.get(c.captureId) : null;
    const reelDecision = R.decisions.get(c.cut) || null, pr = R.poseReelle.get(c.cut) || null;
    const ligne = { type: 'cut', partie: `${projet}:${partie}`, projet, lot: lot.id.slice(0, 8), cut: c.cut,
      reel: { pose: !!c.pose, etage: c.stage, motif: c.motif ? c.motif.code : null, decal: pr ? decalPose(pr.initiale, pr.corrigee) : null }, nuage: avecNuage(cap), points: cap ? cap.pointsSceneRelative.length : 0, profils: {} };
    if (cap && SIDES.every(s => cap.rails[s] && Array.isArray(cap.rails[s].positionSceneRelative))) ligne.ecartDepartMm = arrondi(1000 * C.distance(cap.rails.left.positionSceneRelative, cap.rails.right.positionSceneRelative), 1);
    if (!ligne.nuage) {
      /* Sans nuage : rien à calculer ; le sort réel est gardé dans tous les profils. Un cut réellement posé reste voisin (et appui s'il l'était). */
      let surf = null;
      for (const p of profils) {
        const E = etats[p];
        ligne.profils[p] = { etat: c.pose ? 'pose' : 'differe', source: 'reel-sans-nuage' };
        if (c.pose && pr) {
          E.valides.push({ identity, positions: pr.corrigee, rails: pr.initiale });
          if (reelDecision && reelDecision.anchor === true && reelDecision.anchorHeld !== false) L.rememberAnchor(E.anchors, { identity, positions: pr.corrigee, stage: reelDecision.stage || 'first-pass' }, E.max);
        }
        M.noter(E.grappe, M.resumer({ identity: { part: null, cut: c.cut }, decision: { stage: c.stage, reason: null }, action: null, valide: !!c.pose, surface: surf }), { differe: !c.pose });
      }
      M.noter(zoneMem, M.resumer({ identity: { part: null, cut: c.cut }, decision: { stage: c.stage, reason: null }, action: null, valide: !!c.pose, surface: null }), { differe: !c.pose });
      lignes.push(ligne); continue;
    }
    const capture = { identity, rails: cap.rails, pointsSceneRelative: cap.pointsSceneRelative, visibleByClipBoxes: cap.visibleByClipBoxes };
    let science = null, erreur = null;
    try { science = Sh.scientificProposeBothAvecReservoir(capture); } catch (e) { erreur = String(e && e.message || e).slice(0, 120); }
    let surface = null; try { surface = M.surface(cap); } catch { surface = null; }
    /* Zone à l'instant de la décision : mémoire des zones évaluée avant le cut (ne dépend que des captures). */
    const r0 = M.resumer({ identity: { part: null, cut: c.cut }, decision: { stage: c.stage, reason: null }, action: null, valide: false, surface });
    const ez = M.evaluer(zoneMem, r0), plages = plagesDe(zoneMem, ez), zone = dans(plages.pn, c.cut) ? 'pn' : dans(plages.adv, c.cut) ? 'adv' : 'abords';
    ligne.zone = zone;
    if (!science) { for (const p of profils) ligne.profils[p] = { etat: c.pose ? 'pose' : 'differe', source: 'erreur-moteur', erreur }; M.noter(zoneMem, r0, { differe: !c.pose }); lignes.push(ligne); continue; }
    const runtimeRails = Sh.toRuntimeRails(science), before = capture.rails;
    const cameras = L.viewCameras(cap), camerasLarges = VR.camerasLarges(cap);
    /* Cache du cut : deux profils au même état (mêmes options, mêmes appuis, mêmes voisins) ont la même décision et les mêmes hypothèses. */
    const cache = new Map();
    const signe = E => E.anchors.map(a => `${a.identity.cut}:${SIDES.map(s => a.positions[s].map(v => v.toFixed(7)).join(',')).join(';')}`).join('|') + '#' + E.valides.map(v => `${v.identity.cut}:${v.positions.left[1].toFixed(7)}`).join('|');
    for (const p of profils) {
      const E = etats[p], opts = optionsDe(p), sig = JSON.stringify(opts) + signe(E);
      const d = cache.has('d' + sig) ? cache.get('d' + sig) : (() => { const x = L.decideCut({ capture, science, anchors: E.anchors, Shadow: Sh, options: opts }); cache.set('d' + sig, x); return x; })();
      let cmd = L.commandRails({ decision: d, runtimeRails, before, expectedPoses: K.expectedPoses, cameras });
      let vue = null;
      if (!CHAINE_ACTUELLE(p) && cmd.action !== 'lot' && /(^|-)hors-vue-(left|right)$/.test(cmd.reason || '')) {
        const large = L.commandRails({ decision: d, runtimeRails, before, expectedPoses: K.expectedPoses, cameras: camerasLarges });
        if (large.action === 'lot') { cmd = large; vue = 'deplacee'; }
      }
      let pose = cmd.action === 'lot' || (cmd.action === 'engine' && SIDES.every(s => cmd.rails && cmd.rails[s] && cmd.rails[s].status === 'candidate'));
      let positions = null;
      if (pose) positions = cmd.action === 'lot' ? d.positions : (() => { const x = K.expectedPoses({ rails: before }, cmd.rails); return Object.fromEntries(SIDES.map(s => [s, x[s].positionSceneRelative.slice(0, 3)])); })();
      const grappeBloque = (dd = d) => { if (!R.regleGrappe) return false; const e = M.evaluer(E.grappe, M.resumer({ identity: { part: null, cut: c.cut }, decision: { stage: dd.stage, reason: dd.reason }, action: 'lot', valide: true, surface })); return e.regles.includes('grappe-differes'); };
      let posesL1s = false;
      let out;
      if (pose && grappeBloque()) { pose = false; out = { etat: 'differe', source: 'regle-grappe', etage: d.stage }; }
      else if (pose) {
        /* Mesure seulement (BANC_OMBRE_VERTS, zones séparées par des virgules) : la GCV2 refaite en ombre sur la pose de la chaîne, avec l'état d'avant ce cut ; la décision et les voisins ne changent pas. */
        let ombre = null;
        if (p === 'L1-se' && ZONES_OMBRE.includes(zone)) {
          try {
            const transport = leviers.transport && E.validesL1 && E.validesL1.length;
            ombre = L1.resumer(L1.deciderDiffere({ capture, science, appuis: E.anchors.slice(), options: optionsGcv2(), voisins: E.valides, voisinsTransport: transport ? E.validesL1 : null, zone, plagesADV: plages.adv, modele, regle: regleDe(p),
              reference: referenceDe(c.cut), voieListe: liste ? L1.voieDeListe(liste, c.cut, capture, { ...L1.VOIE_LISTE, fenetre: leviers.voieListeFenetre }) : null }));
          } catch (e) { ombre = { erreur: String(e && e.message || e).slice(0, 120) }; }
        }
        E.valides.push({ identity, positions, rails: before });
        if (L.commandsPositions(d, cmd)) L.rememberAnchor(E.anchors, { identity, positions: d.positions, stage: d.stage }, E.max);
        out = { etat: 'pose', source: 'lot', etage: d.stage, commande: cmd.action, vue, decal: decalPose(before, positions), ...(ombre ? { ombre } : {}) };
      } else if (estL1s(p) && (() => {
        /* a. Cible de la chaîne hors de la vue : vue élargie, pose de la chaîne, validée, jamais appui ni voisin. */
        if (/(^|-)hors-vue-(left|right)$/.test(cmd.reason || '')) {
          const large = L.commandRails({ decision: d, runtimeRails, before, expectedPoses: K.expectedPoses, cameras: camerasLarges });
          if (large.action === 'lot') { out = grappeBloque() ? { etat: 'differe', source: 'regle-grappe', etage: d.stage } : { etat: 'pose', source: 'l1s-vue', etage: d.stage, commande: 'lot', vue: 'deplacee', decal: decalPose(before, d.positions) }; return true; }
        }
        /* b. La décision du lot refaite avec les options de L1 (garde de paire éteinte, appuis à 10 cuts), mêmes appuis. */
        const o2 = optionsGcv2(), sig2 = JSON.stringify(o2) + signe(E);
        const d2 = cache.has('d' + sig2) ? cache.get('d' + sig2) : (() => { const x = L.decideCut({ capture, science, anchors: E.anchors, Shadow: Sh, options: o2 }); cache.set('d' + sig2, x); return x; })();
        let c2 = L.commandRails({ decision: d2, runtimeRails, before, expectedPoses: K.expectedPoses, cameras }), vue2 = null;
        if (c2.action !== 'lot' && /(^|-)hors-vue-(left|right)$/.test(c2.reason || '')) { const l2 = L.commandRails({ decision: d2, runtimeRails, before, expectedPoses: K.expectedPoses, cameras: camerasLarges }); if (l2.action === 'lot') { c2 = l2; vue2 = 'deplacee'; } }
        /* Comme l'extension (background.js, `l1Commande`) : la décision refaite pose seulement par une commande du lot ; une commande « engine »
         * (les deux rails candidats du moteur) n'est pas envoyée, le cut passe à la GCV2 (parité vérifiée par tools/parite-l1se-sw.cjs). */
        if (c2.action !== 'lot') return false;
        const pos2 = d2.positions;
        out = grappeBloque(d2) ? { etat: 'differe', source: 'regle-grappe', etage: d2.stage } : { etat: 'pose', source: 'l1s-chaine', etage: d2.stage, commande: c2.action, vue: vue2, decal: decalPose(before, pos2) };
        return true;
      })()) {
        posesL1s = out.etat === 'pose';
        /* 4.9.5.15 (fiches/L1_CAP5.md) : sous L1-se, la pose refaite de la chaîne passe par la même correction d'écartement que la GCV2. */
        if (p === 'L1-se' && out.etat === 'pose' && out.decal) { const cc = L1.corrigerPoseChaine(capture, out.decal, referenceDe(c.cut)); out.decal = cc.decal; out.correction = cc.correction;
          if (leviers.transport) (E.validesL1 = E.validesL1 || []).push({ identity, positions: Object.fromEntries(SIDES.map(s => [s, L.positionOf(before[s], out.decal[s].map(v => v / 1000))])), rails: before }); }
      } else if (p === 'base') {
        out = { etat: 'differe', source: 'lot', etage: d.stage, raison: d.reason != null ? String(d.reason).slice(0, 80) : null, commande: cmd.action === 'engine' ? 'engine' : `${cmd.action}:${cmd.reason}` };
      } else {
        /* La GCV2 (L1) sur un cut que la chaîne du lot ne pose pas. */
        const base = { source: 'gcv2', etage: d.stage, raison: d.reason != null ? String(d.reason).slice(0, 80) : null };
        try {
          let g = cache.get('g' + sig);
          const transport = p === 'L1-se' && leviers.transport && E.validesL1 && E.validesL1.length;
          if (!g || transport) { g = L1.deciderDiffere({ capture, science, appuis: E.anchors.slice(), options: estL1s(p) ? optionsGcv2() : opts, voisins: E.valides, voisinsTransport: transport ? E.validesL1 : null, zone, plagesADV: plages.adv, modele, regle: regleDe(p), reference: p === 'L1-se' ? referenceDe(c.cut) : null, voieListe: p === 'L1-se' && liste ? L1.voieDeListe(liste, c.cut, capture, { ...L1.VOIE_LISTE, fenetre: leviers.voieListeFenetre }) : null }); if (!transport) cache.set('g' + sig, g); }
          else { const dd = p === 'L1-se' ? L1.deciderL1e(g.cas, modele, referenceDe(c.cut), capture, g.decision.probas) : L1.deciderL1(g.cas, modele, regleDe(p), g.decision.probas); g = { ...g, decision: dd, positions: dd.paire && dd.etat !== 'rien' ? L1.positionsDe(capture, dd.paire) : null }; }
          const dec = g.decision, l1 = L1.resumer(g);
          if (dec.etat === 'rien') out = { ...base, etat: 'differe', l1 };
          else {
            const valider = dec.etat === 'valider';
            const cg = L1.commander({ positions: g.positions, runtimeRails, before, expectedPoses: K.expectedPoses, cameras, camerasLarges, valider });
            if (cg.action !== 'lot') out = { ...base, etat: 'differe', l1: { ...l1, refusCommande: cg.reason } };
            else if (valider && grappeBloque()) out = { ...base, etat: 'differe', l1: { ...l1, refusCommande: 'regle-grappe' } };
            else if (valider) {
              /* D-221 : sous L1-s, une pose de la GCV2 n'est ni appui ni voisin. */
              if (!estL1s(p)) { E.valides.push({ identity, positions: g.positions, rails: before }); L.rememberAnchor(E.anchors, { identity, positions: g.positions, stage: 'gcv2-l1' }, E.max); }
              /* Cap 5, levier « transport » : sous L1-se, une pose de la GCV2 devient voisine de la GCV2 (jamais appui de la chaîne ni voisine de sa décision). */
              else if (p === 'L1-se' && leviers.transport) (E.validesL1 = E.validesL1 || []).push({ identity, positions: g.positions, rails: before });
              out = { ...base, etat: 'pose', vue: cg.vue === 'deplacer' ? 'deplacee' : null, decal: decalPose(before, g.positions), l1, aControler: dec.aControler === true };
            } else out = { ...base, etat: 'pose-non-validee', vue: cg.vue === 'deplacer' ? 'deplacee' : null, decal: decalPose(before, g.positions), l1 };
          }
        } catch (e) { out = { ...base, etat: 'differe', erreur: String(e && e.message || e).slice(0, 120) }; journalTexte(`cut ${c.cut} (${p}) : ${out.erreur}`); }
      }
      ligne.profils[p] = out;
      /* Cap 5 : un différé de L1-se est gardé pour la deuxième passe (fin de lot), avec ce qu'il faut pour le redécider. */
      if (p === 'L1-se' && leviers.deuxiemePasse && out.etat === 'differe' && (out.source === 'gcv2' || out.source === 'lot'))
        restes.push({ ligne, capture, science, zone, plagesADV: plages.adv, runtimeRails, before, cameras, camerasLarges, identity, cut: c.cut });
      /* L1-s : la mémoire de la règle « grappe » voit le lot de la 4.9.5.9 (une pose L1-s y reste un différé). */
      const valideChaine = out.etat === 'pose' && !(estL1s(p) && (posesL1s || out.source === 'gcv2'));
      M.noter(E.grappe, M.resumer({ identity: { part: null, cut: c.cut }, decision: { stage: d.stage, reason: d.reason }, action: null, valide: valideChaine, surface }), { differe: !valideChaine });
    }
    M.noter(zoneMem, r0, { differe: !c.pose });
    lignes.push(ligne);
  }
  /* Cap 5 — DEUXIÈME PASSE en fin de lot (levier `deuxiemePasse` : nombre maximal de passes, arrêt dès qu'une passe ne pose plus rien) : chaque différé de L1-se est redécidé par la GCV2 avec tout
   * ce que le lot a posé, avant ET après lui (chaîne : voisins et appuis ; poses L1 : transport). Leviers propres à la passe : `passe2Leviers`. */
  if (profils.includes('L1-se') && leviers.deuxiemePasse) {
    const E = etats['L1-se'], avant = leviers;
    if (leviers.passe2Leviers) L1.reglerLeviers({ ...leviers, ...leviers.passe2Leviers });
    try {
      for (let passe = 1; passe <= leviers.deuxiemePasse; passe++) {
        let poses = 0;
        /* Levier `passesAlternees` : sens alterné d'une passe à l'autre (une pose se propage vers l'avant, puis vers l'arrière) ; sinon toujours vers l'avant. */
        for (const r of passe % 2 || !leviers.passesAlternees ? restes : restes.slice().reverse()) {
          if (r.ligne.profils['L1-se'].etat !== 'differe') continue;
          try {
            const g = L1.deciderDiffere({ capture: r.capture, science: r.science, appuis: E.anchors.slice(), options: optionsGcv2(), voisins: E.valides, voisinsTransport: leviers.transport ? (E.validesL1 || []) : null,
              zone: r.zone, plagesADV: r.plagesADV, modele, regle: L1.REGLE_E, reference: referenceDe(r.cut), voieListe: liste ? L1.voieDeListe(liste, r.cut, r.capture, { ...L1.VOIE_LISTE, fenetre: leviers.voieListeFenetre }) : null });
            if (g.decision.etat !== 'valider') { r.ligne.profils['L1-se'] = { ...r.ligne.profils['L1-se'], passe2: { passe, motif: g.decision.motif ?? null, ...(leviers.diag ? { l1: L1.resumer(g) } : {}) } }; continue; }
            const cg = L1.commander({ positions: g.positions, runtimeRails: r.runtimeRails, before: r.before, expectedPoses: K.expectedPoses, cameras: r.cameras, camerasLarges: r.camerasLarges, valider: true });
            if (cg.action !== 'lot') continue;
            if (leviers.transport) (E.validesL1 = E.validesL1 || []).push({ identity: r.identity, positions: g.positions, rails: r.before });
            r.ligne.profils['L1-se'] = { source: 'gcv2', passe2: { passe }, etage: 'deferred', etat: 'pose', vue: cg.vue === 'deplacer' ? 'deplacee' : null, decal: decalPose(r.before, g.positions), l1: L1.resumer(g) };
            poses++;
          } catch (e) { journalTexte(`deuxième passe, cut ${r.cut} : ${String(e && e.message || e).slice(0, 120)}`); }
        }
        journalTexte(`deuxième passe ${passe} : ${poses} pose(s)`);
        if (!poses) break;
      }
    } finally { L1.reglerLeviers(avant); }
  }
  const entete = { type: 'entete', format: FORMAT, version: VERSION, partie: `${projet}:${partie}`, projet, lot: lot.id.slice(0, 8), version_lot: lot.version, reprise: R.seeds.length,
    regleGrappe: R.regleGrappe, profils, regle: { L1: L1.REGLE, 'L1-v': L1.REGLE_V }, moduleL1: L1.VERSION, ...(profils.includes('L1-se') ? { l1e: { version: EL.VERSION, reglage: EL.REGLAGE, leviers, liste: liste ? { partie: liste.partie ?? null, at: liste.at ?? null, lignes: liste.n } : null } } : {}),
    parametres: { version: parametres.version, date: parametres.date, seuils: modele.seuils },
    note: 'Banc HORS DÉPÔT : décalages [long, lat, vert] en mm dans le repère profil de la pose de départ ; aucune coordonnée absolue, aucun identifiant de projet ; aucune pose humaine en entrée.',
    traites: cuts.length, posesReelles: cuts.filter(c => c.pose).length, differesReels: cuts.filter(c => !c.pose).length, dureeS: Math.round((Date.now() - t0) / 1000) };
  return [entete, ...lignes];
}

/* ------------------------------------------------------------------ agrégation */
function lireJsonl(texte) { return texte.split('\n').filter(l => l.trim()).map(l => JSON.parse(l)); }
function lireRejeux(textes) {
  const entetes = [], lignes = [];
  for (const x of textes) for (const o of lireJsonl(x)) { if (o.type === 'entete') { if (o.format !== FORMAT) throw Error(`format ${FORMAT} attendu`); entetes.push(o); } else if (o.type === 'cut') lignes.push(o); }
  return { entetes, lignes };
}
/* Différés réels jugés contre Mic (fichiers du diagnostic) : Map « partie|lot|cut » → { depart (mm), mic: { left, right }, memeSeance }.
 * `D.juge` : pose de départ vérifiée à 2 mm, nuage, cut que nul autre lot n'a posé ensuite. `memeSeance` : Écho de la même séance (règle de la
 * fiche, § 2.16). D-220 (Mic : chaque changement de pose est définitif dans ESV) : un différé est jugeable quel que soit le délai tant qu'aucune
 * autre écriture n'a touché le cut ; les jugés d'une autre séance sont donc gardés, marqués, et comptés à part. */
/* Parties à prédiction scellée (2:17, 2:18) : aucune vérité n'y est jointe, même si un fichier de jugés est donné (aucun Écho de ces parties n'est lu). */
const SANS_VERITE = Object.freeze(['2:17', '2:18']);
function lireJuges(textes) {
  const out = new Map();
  for (const x of textes) for (const o of lireJsonl(x)) {
    if (o.type !== 'differe' || SANS_VERITE.includes(o.partie) || !D.juge(o) || o.temoin) continue;
    out.set(`${o.partie}|${o.lot}|${o.cut}`, { depart: Math.max(...SIDES.map(s => norme(o.mic.rails[s]))), mic: o.mic.rails, motif: o.motif ? o.motif.code : null, zone: o.zone, memeSeance: o.echoMemeSeance !== false });
  }
  return out;
}
const ETATS = ['pose', 'pose-non-validee', 'differe'];
function compter(lignes, profil) {
  const n = lignes.length, c = e => lignes.filter(l => (profil === 'reel' ? (l.reel.pose ? 'pose' : 'differe') : l.profils[profil] && l.profils[profil].etat) === e).length;
  const pose = c('pose'), approche = c('pose-non-validee'), differe = c('differe');
  return { traites: n, poses: pose, posesNonValidees: approche, differesSansPose: differe, differes: approche + differe, taux: part(approche + differe, n) };
}
function stats(liste) {
  const n = liste.length;
  const g = liste.map(x => x.depart - x.e);
  return { n, departMedianMm: arrondi(med(liste.map(x => x.depart)), 1), erreurMedianeMm: arrondi(med(liste.map(x => x.e)), 1),
    gainMedianMm: arrondi(med(g), 1), gainQ1Mm: arrondi(quantile(g, 0.25), 1), gainQ3Mm: arrondi(quantile(g, 0.75), 1),
    a10: liste.filter(x => x.e <= 10).length, a20: liste.filter(x => x.e <= 20).length, plus50: liste.filter(x => x.e > 50).length,
    pire: liste.filter(x => x.e > x.depart + 0.5).length, ameliore: liste.filter(x => x.e < x.depart - 0.5).length,
    rappel: (() => { const gros = liste.filter(x => x.depart > 10); return { n: gros.length, k: gros.filter(x => x.e <= 10).length, part: part(gros.filter(x => x.e <= 10).length, gros.length) }; })() };
}
/* Écart à Mic de ce que le profil laisse sur le cut (pose, approchée ou non, sinon la pose de départ). `juge` : { depart, mic }. */
function erreurProfil(l, profil, j) {
  const o = profil === 'reel' ? null : l.profils[profil];
  if (!o || !o.decal || !(o.etat === 'pose' || o.etat === 'pose-non-validee')) return { e: j.depart, depart: j.depart, pose: false };
  return { e: Math.max(...SIDES.map(s => norme(moins(o.decal[s], j.mic[s])))), depart: j.depart, pose: true, etat: o.etat };
}
function agreger({ entetes, lignes }, juges = new Map(), inventaire = null) {
  const profils = [...new Set(entetes.flatMap(e => e.profils))];
  const groupes = { total: lignes };
  for (const l of lignes) { (groupes[`projet ${l.projet}`] = groupes[`projet ${l.projet}`] || []).push(l); }
  const parLot = new Map(), parPartie = new Map();
  for (const l of lignes) { const k = `${l.partie} ${l.lot}`; if (!parLot.has(k)) parLot.set(k, []); parLot.get(k).push(l); if (!parPartie.has(l.partie)) parPartie.set(l.partie, []); parPartie.get(l.partie).push(l); }
  const tableau = liste => Object.fromEntries(['reel', ...profils].map(p => [p, compter(liste, p)]));
  const moyenneLots = (liste, p) => { const lots = [...new Set(liste.map(l => `${l.partie} ${l.lot}`))].map(k => compter(parLot.get(k), p)); return { lots: lots.length, tauxMoyen: lots.length ? arrondi(lots.reduce((s, x) => s + x.taux, 0) / lots.length, 1) : null, differesParLot: lots.length ? arrondi(lots.reduce((s, x) => s + x.differes, 0) / lots.length, 1) : null }; };
  const groupesOut = Object.fromEntries(Object.entries(groupes).map(([k, v]) => [k, { comptes: tableau(v), parLot: Object.fromEntries(['reel', ...profils].map(p => [p, moyenneLots(v, p)])) }]));
  /* Contre Mic : différés réels jugés (même séance : règle de la fiche ; toutes séances : D-220). */
  const jugesT = lignes.map(l => ({ l, j: juges.get(`${l.partie}|${l.lot}|${l.cut}`) })).filter(x => x.j && !x.l.reel.pose);
  const jugesL = jugesT.filter(x => x.j.memeSeance !== false);
  const contreMic = J => Object.fromEntries(profils.map(p => [p, (() => {
    const e = J.map(x => ({ ...erreurProfil(x.l, p, x.j), partie: x.l.partie, projet: x.l.projet }));
    const parGroupe = {};
    for (const [nom, f] of [['total', () => true], ['projet 1', x => x.projet === 1], ['projet 2', x => x.projet === 2], ['2:1', x => x.partie === '2:1'], ['hors 2:1', x => x.partie !== '2:1'],
      ['hors échantillon (2:6, 2:7)', x => ['2:6', '2:7'].includes(x.partie)]]) parGroupe[nom] = { ...stats(e.filter(f)), poses: e.filter(f).filter(x => x.pose).length, posesValidees: e.filter(f).filter(x => x.etat === 'pose').length };
    return parGroupe;
  })()]));
  const mic = contreMic(jugesL), micToutesSeances = contreMic(jugesT);
  /* Poses à plus de 50 mm de Mic (comptées et publiées) : partie, lot, cut, état, écart (mm), pour chaque profil L1. */
  const plus50 = Object.fromEntries(profils.filter(p => p !== 'base').map(p => [p, jugesT.map(x => ({ x, r: erreurProfil(x.l, p, x.j) })).filter(({ r }) => r.pose && r.e > 50)
    .map(({ x, r }) => ({ partie: x.l.partie, lot: x.l.lot, cut: x.l.cut, etat: r.etat, memeSeance: x.j.memeSeance !== false, departMm: arrondi(r.depart, 1), erreurMm: arrondi(r.e, 1),
      hypothese: x.l.profils[p].l1 ? x.l.profils[p].l1.hypothese : null, source: x.l.profils[p].source }))]));
  /* Où se perd le reste : différés restants (non validés) par motif réel et par raison L1. */
  const reste = Object.fromEntries(profils.filter(p => p !== 'base').map(p => {
    const r = lignes.filter(l => l.profils[p] && l.profils[p].etat !== 'pose');
    const cle = l => { const o = l.profils[p]; if (o.etat === 'pose-non-validee') return 'pose-sans-valider (sous τ)'; if (o.source === 'reel-sans-nuage') return 'sans-nuage'; if (o.source === 'regle-grappe') return 'regle-grappe';
      if (o.erreur) return 'erreur'; if (o.l1 && o.l1.refusCommande) return `commande-refusee:${o.l1.refusCommande}`; return o.l1 ? `L1-rien:${o.l1.motif}` : 'autre'; };
    const motifs = new Map();
    for (const l of r) { const k = `${l.reel.pose ? 'posé-au-réel' : (l.reel.motif || '?')} → ${cle(l)}`; motifs.set(k, (motifs.get(k) || 0) + 1); }
    const parRaison = new Map(); for (const l of r) { const k = cle(l); parRaison.set(k, (parRaison.get(k) || 0) + 1); }
    const parMotifReel = new Map(); for (const l of lignes.filter(l => !l.reel.pose)) { const k = l.reel.motif || '?'; const x = parMotifReel.get(k) || { reels: 0, restants: 0, approches: 0 }; x.reels++; if (l.profils[p].etat !== 'pose') x.restants++; if (l.profils[p].etat === 'pose-non-validee') x.approches++; parMotifReel.set(k, x); }
    return [p, { restants: r.length, parRaison: Object.fromEntries([...parRaison].sort((a, b) => b[1] - a[1])), parMotifReel: Object.fromEntries([...parMotifReel].sort((a, b) => b[1].reels - a[1].reels)),
      croise: Object.fromEntries([...motifs].sort((a, b) => b[1] - a[1]).slice(0, 30)) }];
  }));
  /* Effets sur les cuts que le lot réel posait : rendus différés, ou posés ailleurs (> 1 mm). Et sources des poses nouvelles. */
  const effets = Object.fromEntries(profils.map(p => {
    const posesReelles = lignes.filter(l => l.reel.pose && l.nuage && l.profils[p]);
    const perdus = posesReelles.filter(l => l.profils[p].etat !== 'pose').length;
    const deplaces = posesReelles.filter(l => l.profils[p].etat === 'pose' && l.reel.decal && l.profils[p].decal && Math.max(...SIDES.map(s => norme(moins(l.reel.decal[s], l.profils[p].decal[s])))) > 1);
    const nouveaux = lignes.filter(l => !l.reel.pose && l.profils[p] && l.profils[p].etat === 'pose');
    const src = new Map(); for (const l of nouveaux) { const o = l.profils[p], k = o.source === 'gcv2' ? (o.aControler ? 'gcv2 sous τ (à contrôler)' : 'gcv2') : `lot:${o.etage}${o.vue ? ' (vue déplacée)' : ''}`; src.set(k, (src.get(k) || 0) + 1); }
    const vues = lignes.filter(l => l.profils[p] && l.profils[p].vue === 'deplacee').length;
    const hyp = new Map(); for (const l of lignes.filter(l => l.profils[p] && l.profils[p].source === 'gcv2' && l.profils[p].etat !== 'differe')) { const k = (l.profils[p].l1 && l.profils[p].l1.hypothese) || '?'; hyp.set(k, (hyp.get(k) || 0) + 1); }
    /* D-221 : cuts que la base rejouée pose (la chaîne d'aujourd'hui) et que le profil ne pose pas à l'identique (état ou pose à plus de 0,001 mm). */
    const parBase = lignes.filter(l => l.profils.base && l.profils.base.etat === 'pose' && l.profils[p]);
    const differentsDeLaBase = parBase.filter(l => { const a = l.profils.base, b = l.profils[p]; if (b.etat !== 'pose') return true; if (!a.decal || !b.decal) return !!a.decal !== !!b.decal;
      return Math.max(...SIDES.map(s => norme(moins(a.decal[s], b.decal[s])))) > 0.001; }).length;
    return [p, { posesDeLaBase: parBase.length, differentsDeLaBase, posesReellesPerdues: perdus, posesReellesDeplaceesPlus1mm: deplaces.length, deplacementMedianMm: arrondi(med(deplaces.map(l => Math.max(...SIDES.map(s => norme(moins(l.reel.decal[s], l.profils[p].decal[s])))))), 1),
      nouvellesPoses: nouveaux.length, sources: Object.fromEntries([...src].sort((a, b) => b[1] - a[1])), vuesDeplacees: vues, hypotheses: Object.fromEntries([...hyp].sort((a, b) => b[1] - a[1]).slice(0, 12)) }];
  }));
  const lots = [...parLot].map(([k, v]) => ({ lot: k, ...Object.fromEntries(['reel', ...profils].map(p => [p, compter(v, p)])) })).sort((a, b) => a.lot.localeCompare(b.lot, 'fr', { numeric: true }));
  const parties = [...parPartie].map(([k, v]) => ({ partie: k, ...Object.fromEntries(['reel', ...profils].map(p => [p, compter(v, p)])) })).sort((a, b) => a.partie.localeCompare(b.partie, 'fr', { numeric: true }));
  /* Contrôle : la base du banc (sort réel) contre l'inventaire du diagnostic. */
  const controle = inventaire ? (() => { const B = inventaire.lots.filter(x => x.dansLaBase); const vus = new Set(lots.map(x => x.lot)); const manquants = B.filter(x => !vus.has(`${x.projet}:${x.partie} ${x.id.slice(0, 8)}`)).map(x => `${x.projet}:${x.partie} ${x.id.slice(0, 8)}`);
    return { lotsBase: B.length, lotsRejoues: lots.length, manquants, differesInventaire: B.filter(x => vus.has(`${x.projet}:${x.partie} ${x.id.slice(0, 8)}`)).reduce((s, x) => s + x.differes, 0), differesReelsBanc: compter(lignes, 'reel').differes }; })() : null;
  return { format: FORMAT_SYNTHESE, version: VERSION, profils, lots: lots.length, groupes: groupesOut, mic, jugesN: jugesL.length, micToutesSeances, jugesToutesSeancesN: jugesT.length, plus50,
    reste, effets, parLot: lots, parPartie: parties, controle };
}
const fmt = v => v == null ? '—' : typeof v === 'number' ? String(v).replace('.', ',') : String(v);
const pc = v => v == null ? '—' : `${fmt(v)} %`;
function table(entetes, lignes) { return [`| ${entetes.join(' | ')} |`, `|${entetes.map((_, i) => i ? '--:' : '---').join('|')}|`, ...lignes.map(l => `| ${l.map(fmt).join(' | ')} |`)].join('\n'); }
function syntheseMd(S) {
  const P = ['reel', ...S.profils], nom = p => ({ reel: 'base (réel)', base: 'base rejouée', L1: 'L1', 'L1-v': 'L1-v', 'L1-s': 'L1-s', 'L1-se': 'L1-se' })[p] || p;
  const out = [];
  out.push('### Taux de différés', '', table(['Groupe', 'Profil', 'Lots', 'Traités', 'Posés validés', 'Posés non validés', 'Différés (non validés)', 'Taux pondéré', 'Taux moyen par lot', 'Différés par lot', 'Réduction'],
    Object.entries(S.groupes).flatMap(([g, x]) => P.map(p => { const c = x.comptes[p], r = x.comptes.reel; return [g, nom(p), x.parLot[p].lots, c.traites, c.poses, c.posesNonValidees, c.differes, pc(c.taux), pc(x.parLot[p].tauxMoyen), x.parLot[p].differesParLot, p === 'reel' ? '—' : pc(part(r.differes - c.differes, r.differes))]; }))));
  const tMic = M => table(['Groupe', 'Profil', 'Jugés', 'Posés (dont validés)', 'Départ médian (mm)', 'Erreur médiane (mm)', 'Gain médian (mm)', 'Gain Q1–Q3 (mm)', '≤ 10 mm', '≤ 20 mm', 'Écart final > 50 mm (posé ou laissé)', 'Pire que le départ', 'Rappel (> 10 mm au départ)'],
    S.profils.flatMap(p => Object.entries(M[p]).filter(([, x]) => x.n).map(([g, x]) => [g, nom(p), x.n, `${x.poses} (${x.posesValidees})`, x.departMedianMm, x.erreurMedianeMm, x.gainMedianMm, `${fmt(x.gainQ1Mm)} – ${fmt(x.gainQ3Mm)}`, `${x.a10} (${pc(part(x.a10, x.n))})`, `${x.a20} (${pc(part(x.a20, x.n))})`, x.plus50, x.pire, `${x.rappel.k}/${x.rappel.n} (${pc(x.rappel.part)})`])));
  out.push('', `### Contre Mic, Écho de la même séance (règle de la fiche ; différés réels jugés : ${S.jugesN})`, '', tMic(S.mic));
  if (S.micToutesSeances) out.push('', `### Contre Mic, toutes séances sans autre écriture sur le cut (D-220 ; différés réels jugés : ${S.jugesToutesSeancesN})`, '', tMic(S.micToutesSeances));
  if (S.plus50) for (const [p, liste] of Object.entries(S.plus50)) out.push('', `### Poses ${nom(p)} à plus de 50 mm de Mic (${liste.length})`, '',
    liste.length ? table(['Partie', 'Lot', 'Cut', 'État', 'Même séance', 'Départ (mm)', 'Pose L1 → Mic (mm)', 'Hypothèse'], liste.map(x => [x.partie, x.lot, x.cut, x.etat, x.memeSeance ? 'oui' : 'non', x.departMm, x.erreurMm, x.hypothese])) : 'Aucune.');
  for (const [p, r] of Object.entries(S.reste)) {
    out.push('', `### Ce qui reste différé sous ${nom(p)} (${r.restants})`, '', table(['Raison', 'Cuts'], Object.entries(r.parRaison)), '', table(['Motif réel du différé', 'Différés réels', 'Restent différés', 'dont approchés'], Object.entries(r.parMotifReel).map(([k, v]) => [k, v.reels, v.restants, v.approches])));
  }
  out.push('', '### Effets du rejeu conjoint', '', table(['Profil', 'Cuts posés par la base rejouée, posés autrement', 'Poses réelles perdues', 'Poses réelles déplacées de plus de 1 mm (médiane)', 'Nouvelles poses validées', 'Sources', 'Vues déplacées', 'Hypothèses retenues (GCV2)'],
    S.profils.map(p => { const e = S.effets[p]; return [nom(p), `${e.differentsDeLaBase} / ${e.posesDeLaBase}`, e.posesReellesPerdues, `${e.posesReellesDeplaceesPlus1mm} (${fmt(e.deplacementMedianMm)} mm)`, e.nouvellesPoses, Object.entries(e.sources).map(([k, v]) => `${k} ${v}`).join(', '), e.vuesDeplacees, Object.entries(e.hypotheses).map(([k, v]) => `${k} ${v}`).join(', ')]; })));
  out.push('', '### Par lot', '', table(['Lot', 'Traités', ...P.map(p => `Différés ${nom(p)}`), ...S.profils.filter(p => p !== 'base').map(p => `dont approchés ${nom(p)}`)],
    S.parLot.map(x => [x.lot, x.reel.traites, ...P.map(p => `${x[p].differes} (${pc(x[p].taux)})`), ...S.profils.filter(p => p !== 'base').map(p => x[p].posesNonValidees)])));
  if (S.controle) out.push('', `Contrôle : ${S.controle.lotsRejoues} lots rejoués sur ${S.controle.lotsBase} de la base${S.controle.manquants.length ? ` (manquants : ${S.controle.manquants.join(', ')})` : ''} ; différés réels ${S.controle.differesReelsBanc} au banc, ${S.controle.differesInventaire} à l'inventaire.`);
  return out.join('\n');
}

/* ------------------------------------------------------------------ prédiction scellée et comparaison (à l'arrivée de l'Écho) */
/* Résumé publiable sans vérité : différés réels, ce que chaque profil en ferait, par zone. */
function resumePrediction(lignes, profils) {
  const differes = lignes.filter(l => !l.reel.pose);
  const zones = [...new Set(lignes.map(l => l.zone || 'sans-nuage'))];
  const par = (liste, p) => ({ valides: liste.filter(l => l.profils[p].etat === 'pose').length, nonValides: liste.filter(l => l.profils[p].etat === 'pose-non-validee').length, rien: liste.filter(l => l.profils[p].etat === 'differe').length });
  return { traites: lignes.length, differesReels: differes.length, parProfil: Object.fromEntries(profils.map(p => [p, { ...compter(lignes, p), surDifferesReels: par(differes, p),
    parZone: Object.fromEntries(zones.map(z => [z, { differesReels: differes.filter(l => (l.zone || 'sans-nuage') === z).length, ...par(differes.filter(l => (l.zone || 'sans-nuage') === z), p) }])) }])) };
}
/* Comparatif SANS VÉRITÉ d'un lot scellé (demande du 19/10, partie 19) : (a) les différés réels : posés validés, posés sans validation, laissés, par
 * profil et par zone ; (b) les cuts posés par le lot réel : même pose à 2, 5, 10 mm (pire rail, 3D), poses différentes (distribution, 10 plus grands
 * écarts avec cut et zone), cuts laissés ; (c) les cuts où le profil déplace la vue. Aucune entrée humaine. */
function comparatifSansVerite(lignes, profils) {
  const P = profils.filter(p => p !== 'base'), differes = lignes.filter(l => !l.reel.pose), poses = lignes.filter(l => l.reel.pose);
  const zoneDe = l => l.zone || 'sans-nuage', zones = [...new Set(lignes.map(zoneDe))].sort();
  const sort = (liste, p) => ({ n: liste.length, valides: liste.filter(l => l.profils[p].etat === 'pose').length, nonValides: liste.filter(l => l.profils[p].etat === 'pose-non-validee').length,
    laisses: liste.filter(l => l.profils[p].etat === 'differe').length });
  const ecartReel = (l, p) => { const o = l.profils[p]; if (!o || !o.decal || !l.reel.decal) return null; return Math.max(...SIDES.map(s => norme(moins(o.decal[s], l.reel.decal[s])))); };
  const out = { traites: lignes.length, differesReels: differes.length, posesReelles: poses.length, posesReellesSansDecal: poses.filter(l => !l.reel.decal).length, profils: {} };
  for (const p of P) {
    const a = { total: sort(differes, p), parZone: Object.fromEntries(zones.map(z => [z, sort(differes.filter(l => zoneDe(l) === z), p)])),
      hypotheses: (() => { const m = new Map(); for (const l of differes) { const o = l.profils[p]; if (o.etat === 'differe' || !o.l1) continue; m.set(o.l1.hypothese || '?', (m.get(o.l1.hypothese || '?') || 0) + 1); } return Object.fromEntries([...m].sort((x, y) => y[1] - x[1])); })(),
      motifsLaisses: (() => { const m = new Map(); for (const l of differes) { const o = l.profils[p]; if (o.etat !== 'differe') continue; const k = o.source === 'reel-sans-nuage' ? 'sans-nuage' : o.l1 ? (o.l1.refusCommande ? 'commande-refusee:' + o.l1.refusCommande : 'L1-rien:' + o.l1.motif) : (o.source || '?'); m.set(k, (m.get(k) || 0) + 1); } return Object.fromEntries([...m].sort((x, y) => y[1] - x[1])); })() };
    const avec = poses.map(l => ({ l, e: l.profils[p].etat === 'pose' ? ecartReel(l, p) : null })), comp = avec.filter(x => fini(x.e)), es = comp.map(x => x.e);
    const b = { comparables: comp.length, a2: es.filter(e => e <= 2).length, a5: es.filter(e => e <= 5).length, a10: es.filter(e => e <= 10).length, plus10: es.filter(e => e > 10).length,
      laisses: poses.filter(l => l.profils[p].etat !== 'pose').length, nonValides: poses.filter(l => l.profils[p].etat === 'pose-non-validee').length,
      ecartMedianMm: arrondi(med(es), 2), ecartQ3Mm: arrondi(quantile(es, 0.75), 2), ecartQ90Mm: arrondi(quantile(es, 0.9), 2), ecartMaxMm: arrondi(Math.max(...es, 0), 1),
      tranches: { '0–2': es.filter(e => e <= 2).length, '2–5': es.filter(e => e > 2 && e <= 5).length, '5–10': es.filter(e => e > 5 && e <= 10).length, '10–20': es.filter(e => e > 10 && e <= 20).length, '20–50': es.filter(e => e > 20 && e <= 50).length, '> 50': es.filter(e => e > 50).length },
      plusGrands: comp.slice().sort((x, y) => y.e - x.e).slice(0, 10).map(x => ({ cut: x.l.cut, zone: zoneDe(x.l), ecartMm: arrondi(x.e, 1), etage: x.l.profils[p].etage || null, etageReel: x.l.reel.etage || null })) };
    const vues = lignes.filter(l => l.profils[p] && l.profils[p].vue === 'deplacee');
    const c = { n: vues.length, surDifferesReels: vues.filter(l => !l.reel.pose).length, surPosesReelles: vues.filter(l => l.reel.pose).length, valides: vues.filter(l => l.profils[p].etat === 'pose').length,
      nonValides: vues.filter(l => l.profils[p].etat === 'pose-non-validee').length, cuts: vues.map(l => ({ cut: l.cut, zone: zoneDe(l), etat: l.profils[p].etat, source: l.profils[p].source })) };
    out.profils[p] = { differes: a, posesReelles: b, vueDeplacee: c };
  }
  return out;
}
/* Comparaison pure : lignes scellées contre poses de Mic (Map cut → { rails: {left,right} décalages mm depuis la pose de départ de l'Écho, ecartDepartMm }).
 * Jugé : différé réel, pose de Mic connue, pose de départ de l'Écho à 2 mm de celle du lot (écartement). */
function comparer(entete, lignes, micParCut) {
  const profils = entete.profils.filter(p => p !== 'base'), J = [];
  const nonJuges = { sansMic: 0, departDifferent: 0, sansNuage: 0 };
  for (const l of lignes.filter(x => !x.reel.pose)) {
    const m = micParCut.get(l.cut);
    if (!m || !m.rails) { nonJuges.sansMic++; continue; }
    if (!l.nuage) { nonJuges.sansNuage++; continue; }
    if (fini(m.ecartDepartMm) && fini(l.ecartDepartMm) && Math.abs(m.ecartDepartMm - l.ecartDepartMm) > 2) { nonJuges.departDifferent++; continue; }
    J.push({ l, j: { depart: Math.max(...SIDES.map(s => norme(m.rails[s]))), mic: m.rails } });
  }
  const parProfil = Object.fromEntries(profils.map(p => [p, (() => { const e = J.map(x => ({ ...erreurProfil(x.l, p, x.j), zone: x.l.zone }));
    return { ...stats(e), poses: e.filter(x => x.pose).length, posesValidees: e.filter(x => x.etat === 'pose').length,
      parZone: Object.fromEntries([...new Set(e.map(x => x.zone))].map(z => [z, stats(e.filter(x => x.zone === z))])) }; })()]));
  const detail = J.map(x => ({ cut: x.l.cut, zone: x.l.zone, departMm: arrondi(x.j.depart, 1), ...Object.fromEntries(profils.map(p => { const r = erreurProfil(x.l, p, x.j); return [p, { etat: x.l.profils[p].etat, erreurMm: arrondi(r.e, 1) }]; })) }));
  return { format: FORMAT_COMPARAISON, partie: entete.partie, lot: entete.lot, juges: J.length, nonJuges, parProfil, detail };
}

/* ------------------------------------------------------------------ ligne de commande */
function args(argv) {
  const o = { mode: argv[0], corpus: [], rejeu: [], juges: [], echo: [], profils: PROFILS.slice(), jugerReservee: false };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--partie') { const m = /^([1-9]\d*):(0|[1-9]\d*)$/.exec(val()); if (!m) throw Error('--partie PROJET:PARTIE'); o.projet = Number(m[1]); o.partie = Number(m[2]); }
    else if (k === '--journal') o.journal = val(); else if (k === '--corpus') o.corpus.push(val()); else if (k === '--lot') o.lot = val(); else if (k === '--sortie') o.sortie = val();
    else if (k === '--profils') o.profils = val().split(',').filter(Boolean); else if (k === '--parametres') o.parametres = val(); else if (k === '--liste') o.liste = val();
    else if (k === '--rejeu') o.rejeu.push(val()); else if (k === '--juges') o.juges.push(val()); else if (k === '--inventaire') o.inventaire = val();
    else if (k === '--json') o.json = val(); else if (k === '--md') o.md = val(); else if (k === '--prediction') o.prediction = val(); else if (k === '--echo') o.echo.push(val());
    else if (k === '--juger-partie-reservee') o.jugerReservee = true;
    else throw Error('argument inconnu : ' + k);
  }
  if (o.profils.some(p => !PROFILS.includes(p))) throw Error(`profils : ${PROFILS.join(', ')}`);
  return o;
}
const ecrire = (f, texte) => { fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true }); fs.writeFileSync(f, texte); };
function main(argv) {
  const a = args(argv), journalTexte = m => process.stderr.write(m + '\n');
  if (a.mode === 'rejouer' || a.mode === 'predire') {
    if (!Number.isInteger(a.partie) || !a.journal || !a.corpus.length || !a.lot || !a.sortie) throw Error(`${a.mode} --partie P:N --journal J.json --corpus C.json [--corpus …] --lot ID --sortie R.jsonl`);
    if (a.mode === 'predire') { const Mf = require('./manifeste-parties.cjs'), c = Mf.controler(Mf.lire(), [{ projet: a.projet, partie: a.partie }], { outil: 'banc-differes', jugerReservee: a.jugerReservee }); if (c.avis) journalTexte(c.avis); }
    const fP = a.parametres || PARAMETRES, bufP = fs.readFileSync(fP), parametres = JSON.parse(bufP.toString('utf8'));
    const j = JSON.parse(fs.readFileSync(a.journal, 'utf8')), R = lotReel(j, a.partie, a.lot), ids = R.lot.cuts.map(c => c.captureId).filter(Boolean);
    const t0 = Date.now(), captures = chargerCaptures(a.corpus, ids);
    journalTexte(`captures retrouvées : ${captures.size}/${ids.length} (${Math.round((Date.now() - t0) / 1000)} s)`);
    const lignes = rejouerLot({ journal: j, captures, projet: a.projet, partie: a.partie, lotId: a.lot, parametres, profils: a.profils, journalTexte, liste: a.liste ? require('../src/liste-memoire.js').decompacter(JSON.parse(fs.readFileSync(a.liste, 'utf8'))) : null });
    lignes[0].parametres.sha256 = sha256(bufP);
    const texte = lignes.map(l => JSON.stringify(l)).join('\n') + '\n';
    ecrire(a.sortie, texte);
    const L = lignes.slice(1), c = p => compter(L, p);
    process.stdout.write(`partie ${a.projet}:${a.partie} lot ${a.lot} : ${L.length} cuts, différés réels ${c('reel').differes}${a.profils.map(p => ` ; ${p} : ${c(p).differes} différés (${c(p).posesNonValidees} approchés)`).join('')} ; ${lignes[0].dureeS} s\n`);
    if (a.mode === 'predire') {
      const R2 = resumePrediction(L, a.profils);
      process.stdout.write(JSON.stringify(R2) + '\n');
      process.stdout.write(`SHA-256 ${sha256(Buffer.from(texte, 'utf8'))}  ${a.sortie}\n`);
    }
  } else if (a.mode === 'agreger') {
    if (!a.rejeu.length) throw Error('agreger --rejeu R.jsonl [--rejeu …] [--juges CUTS.jsonl …] [--inventaire INV.json] [--json S.json] [--md S.md]');
    const R = lireRejeux(a.rejeu.map(f => fs.readFileSync(f, 'utf8'))), juges = lireJuges(a.juges.map(f => fs.readFileSync(f, 'utf8')));
    const S = agreger(R, juges, a.inventaire ? JSON.parse(fs.readFileSync(a.inventaire, 'utf8')) : null), md = syntheseMd(S);
    if (a.json) ecrire(a.json, JSON.stringify(S, null, 1) + '\n');
    if (a.md) ecrire(a.md, md + '\n');
    process.stdout.write(md + '\n');
  } else if (a.mode === 'resumer') {
    if (!a.prediction) throw Error('resumer --prediction R.jsonl [--json S.json]   (comparatif sans vérité d\'un lot scellé)');
    const buf = fs.readFileSync(a.prediction), R = lireRejeux([buf.toString('utf8')]), e = R.entetes[0];
    const out = { format: 'ariane-banc-differes-sans-verite-v1', partie: e.partie, lot: e.lot, sha256: sha256(buf), ...comparatifSansVerite(R.lignes, e.profils) };
    if (a.json) ecrire(a.json, JSON.stringify(out, null, 1) + '\n');
    process.stdout.write(JSON.stringify(out, null, 1) + '\n');
  } else if (a.mode === 'comparer') {
    if (!a.prediction || !a.echo.length) throw Error('comparer --prediction R.jsonl --echo DOSSIER [--echo …] [--json C.json]');
    const buf = fs.readFileSync(a.prediction), R = lireRejeux([buf.toString('utf8')]), e = R.entetes[0], P = require('./gcv2-predire-differes.cjs');
    const m = /^(\d+):(\d+)$/.exec(e.partie), mic = P.micDepuisEcho(a.echo, Number(m[2]), R.lignes.filter(l => !l.reel.pose).map(l => l.cut));
    const out = comparer(e, R.lignes, mic);
    if (a.json) ecrire(a.json, JSON.stringify(out, null, 1) + '\n');
    process.stdout.write(`Comparaison — partie ${out.partie}, lot ${out.lot}, fichier scellé SHA-256 ${sha256(buf)} : ${out.juges} jugés ; non jugés ${JSON.stringify(out.nonJuges)}\n`
      + Object.entries(out.parProfil).map(([p, x]) => `  ${p} : ${x.poses} posés (${x.posesValidees} validés), erreur médiane ${fmt(x.erreurMedianeMm)} mm contre ${fmt(x.departMedianMm)} au départ, gain médian ${fmt(x.gainMedianMm)} mm, ≤ 10 mm ${x.a10}, > 50 mm ${x.plus50}, rappel ${x.rappel.k}/${x.rappel.n}`).join('\n') + '\n');
  } else throw Error('mode : rejouer | predire | agreger | resumer | comparer');
}

module.exports = { SANS_VERITE, FORMAT, FORMAT_SYNTHESE, FORMAT_COMPARAISON, VERSION, PROFILS, chargerCaptures, avecNuage, lotReel, rejouerLot, lireRejeux, lireJuges, compter, stats, erreurProfil, agreger, syntheseMd,
  resumePrediction, comparatifSansVerite, comparer, args, main };

if (require.main === module) { try { main(process.argv.slice(2)); } catch (e) { process.stderr.write(`banc-differes : ${e.message}\n`); process.exitCode = 1; } }
