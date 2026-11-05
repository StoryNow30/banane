#!/usr/bin/env node
'use strict';
/*
 * rejeu-ecart-humain.cjs — CH-049-F. MESURE hors ligne, lecture seule : rejoue le moteur d'Ariane (GCV1, `scientificProposeBoth`)
 * sur les nuages LiDAR des parties en apprentissage et le compare, cut par cut et rail par rail, à la pose humaine finale.
 * Aucun module de décision n'est modifié ; aucune règle ni aucun réglage n'est proposé : ce script chiffre.
 *
 *   node chantiers/CH-049/rejeu-ecart-humain.cjs --lot DOSSIER_LOT --jointures DOSSIER --echo SESSION.json [--echo S2.json]
 *        --sortie AGREGATS.json [--detail DETAIL.json] [--parties 10,13,14,15]
 *
 *  - DOSSIER_LOT : lot Orbite extrait (corpus GCV1 `ariane-gcv1-corpus-*.json` + journal `ariane-journal-v4-*.json`).
 *  - DOSSIER des jointures : `table<partie>.json` (tools/jointure-echo-orbite.cjs) ; la pose humaine est celle de `ecartHumain`.
 *  - SESSION.json : session Écho fusionnée (tools/merge-segments.cjs, union des segments).
 * Source du nuage d'un cut : d'abord le corpus du lot (ce que le lot a vu), sinon un nuage de l'Écho (première visite dont la paire est
 * `comparable-candidate`, même construction que tools/native-offline-evaluate.cjs). Le nuage ne reçoit jamais la pose humaine.
 * Écart = position du moteur − position humaine, repère profil de la pose de départ, en mm : [longitudinal, latéral, vertical].
 * Le candidat REJETÉ (garde d'écartement) est lu dans `rail.pairGauge.publishedBeforeGate`, puis, sinon, dans le A* brut.
 * `--detail` (par cut, avec numéros) reste HORS du dépôt ; `--sortie` ne contient que des agrégats.
 */
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const Shadow = require(ROOT + '/src/gcv1-shadow.js');
const Gauge = require(ROOT + '/src/gauge.js');
const C = require(ROOT + '/vendor/capture-core.js');
const Native = require(ROOT + '/tools/native-offline-evaluate.cjs');
const SIDES = ['left', 'right'];
const FR = { left: 'gauche', right: 'droite' };

const arg = (n, multi) => { const a = process.argv.slice(2), o = []; for (let i = 0; i < a.length; i++) if (a[i] === n) o.push(a[++i]); return multi ? o : o[0]; };
const med = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), i = b.length >> 1; return b.length % 2 ? b[i] : (b[i - 1] + b[i]) / 2; };
const q = (a, p) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), at = (b.length - 1) * p, lo = Math.floor(at), hi = Math.ceil(at); return b[lo] + (b[hi] - b[lo]) * (at - lo); };
const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
const stats = a => { a = a.filter(Number.isFinite); return { n: a.length, mediane: r1(med(a)), p90: r1(q(a, .9)), max: r1(a.length ? Math.max(...a) : NaN) }; };
const CLASSES = [['<=5', 5], ['5-10', 10], ['10-20', 20], ['20-50', 50], ['>50', Infinity]];
const classe = v => CLASSES.find(([, s]) => v <= s)[0];
const repartition = a => { const o = Object.fromEntries(CLASSES.map(([k]) => [k, 0])); for (const v of a) if (Number.isFinite(v)) o[classe(v)]++; return o; };

/* ---------- lecture ---------- */
function lireRefs(dossier, parties) {
  const refs = new Map();
  for (const p of parties) {
    const J = JSON.parse(fs.readFileSync(path.join(dossier, `table${p}.json`), 'utf8'));
    for (const r of J.table) {
      if (!r.ecartHumain) continue;
      const mic = {}, ariane = {}; let ok = true;
      for (const s of SIDES) {
        const e = r.ecartHumain[FR[s]], d = r.arianeDeplacement?.[FR[s]];
        if (!e || e.repere !== 'profil') { ok = false; break; }
        let v = [e.longitudinalMm, e.lateralMm, e.verticalMm];
        if (r.base === 'ariane') { if (!d) { ok = false; break; } v = [v[0] + d.longitudinalMm, v[1] + d.lateralMm, v[2] + d.verticalMm]; }
        mic[s] = v;
        if (d && d.repere === 'profil') ariane[s] = [d.longitudinalMm, d.lateralMm, d.verticalMm];
      }
      if (!ok) continue;
      const m = r.motifDiffere || {};
      refs.set(`${p}/${r.cut}`, { partie: p, cut: r.cut, classe: r.classe, mic, ariane: SIDES.every(s => ariane[s]) ? ariane : null, base: r.base,
        motif: SIDES.map(s => m[FR[s]]?.motif || null), reasonB1: r.b1Ombre?.reel?.reason ?? null, dureeVisiteS: r.dureeVisiteS ?? null });
    }
  }
  return refs;
}
function capturesLot(dossier, refs) {
  const out = new Map();
  for (const f of fs.readdirSync(dossier).filter(f => /gcv1-corpus.*seg\d+\.json$/.test(f)).sort()) {
    const j = JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8'));
    for (const c of j.clouds || []) {
      const k = `${c.identity?.part}/${c.identity?.cut}`;
      if (!refs.has(k) || !c.rails?.left || !c.rails?.right || !(c.pointsSceneRelative?.length > 0)) continue;
      out.set(k, { identity: c.identity, rails: c.rails, pointsSceneRelative: c.pointsSceneRelative, visibleByClipBoxes: c.visibleByClipBoxes, points: c.pointsSceneRelative.length });
    }
  }
  return out;
}
function capturesEcho(fichiers, refs) {
  const out = new Map();
  for (const f of fichiers) {
    const s = JSON.parse(fs.readFileSync(f, 'utf8')), clouds = new Map((s.clouds || []).map(c => [c.chunkId || c.captureId, c]));
    const recs = (s.records || []).slice().sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
    const premiere = new Map();
    for (const r of recs) { const k = `${r.identity?.part}/${r.identity?.cut}`; if (!premiere.has(k)) premiere.set(k, r); }
    for (const r of recs) {
      const k = `${r.identity?.part}/${r.identity?.cut}`;
      if (!refs.has(k) || out.has(k) || r.geometryEligibility?.pair?.status !== 'comparable-candidate') continue;
      const inp = {};
      for (const side of SIDES) inp[side] = Native.buildEngineInput({ identity: r.identity, side, initialRail: r.beforeEstablished?.rails?.[side] || null, eligibility: r.geometryEligibility?.[side] || null }, clouds);
      const pair = Native.buildPairInput(inp.left, inp.right);
      if (pair.status !== 'ready') continue;
      /* Pose humaine : celle de CETTE visite si elle la porte, sinon la table seulement si c'est la visite de base (première). */
      const final = r.humanFinalReference?.state?.rails || null; let micVisite = null;
      if (final) { const d = {}; let ok = true; for (const side of SIDES) { const h = Native.humanDelta(r.beforeEstablished?.rails?.[side], final[side]); if (!h) { ok = false; break; } d[side] = [h[0] * 1000, h[1] * 1000, h[2] * 1000]; } if (ok) micVisite = d; }
      out.set(k, { identity: r.identity, rails: pair.capture.rails, pointsSceneRelative: pair.capture.pointsSceneRelative, visibleByClipBoxes: pair.capture.visibleByClipBoxes,
        points: pair.points, estPremiereVisite: premiere.get(k) === r, micVisite });
    }
  }
  return out;
}
function lireJournal(dossier) {
  const f = fs.readdirSync(dossier).find(f => /^ariane-journal-v4-.*\.json$/.test(f)); const cascade = new Set();
  if (!f) return cascade;
  for (const e of JSON.parse(fs.readFileSync(path.join(dossier, f), 'utf8')).events || [])
    if ((e.type === 'garde-apres-differe' || e.type === 'garde-apres-differe-suivant') && Number.isInteger(e.identity?.cut)) cascade.add(`${e.identity.part}/${e.identity.cut}`);
  return cascade;
}

/* ---------- rejeu d'un cut ---------- */
const errMm = (delta, mic) => { const e = [0, 1, 2].map(i => delta[i] * 1000 - mic[i]); return { long: e[0], lat: e[1], vert: e[2], d3: Math.hypot(...e) }; };
function candidatBrut(rail) {
  if (!rail || rail.ok !== true) return { delta: null, origine: rail?.error ? 'erreur' : 'absent' };
  if (rail.next?.status === 'candidate' && Array.isArray(rail.next.delta)) return { delta: rail.next.delta, origine: 'publie' };
  const g = rail.pairGauge?.publishedBeforeGate?.delta;
  if (Array.isArray(g)) return { delta: g, origine: 'avant-garde-ecartement' };
  if (rail.astar?.status === 'candidate' && Array.isArray(rail.astar.delta)) return { delta: rail.astar.delta, origine: 'astar-brut' };
  if (rail.v46?.status === 'candidate' && Array.isArray(rail.v46.delta)) return { delta: rail.v46.delta, origine: 'v46-brut' };
  return { delta: null, origine: 'aucun' };
}
function rejouer(cap, ref, mic, ariane) {
  const sc = Shadow.scientificProposeBoth({ identity: cap.identity, rails: cap.rails, pointsSceneRelative: cap.pointsSceneRelative, visibleByClipBoxes: cap.visibleByClipBoxes });
  const rails = {}, deltas = {};
  for (const s of SIDES) {
    const r = sc.rails[s], b = candidatBrut(r);
    rails[s] = { erreur: r?.error ? String(r.error).slice(0, 60) : null, statut: r?.next?.status ?? 'erreur', motif: r?.next?.motif ?? null, origine: b.origine, brut: b.delta ? errMm(b.delta, mic[s]) : null,
      publie: r?.next?.status === 'candidate' ? errMm(r.next.delta, mic[s]) : null,
      vsAriane: ariane && r?.next?.status === 'candidate' ? errMm(r.next.delta, ariane[s]).d3 : null,
      confiance: r?.next?.confidence ?? r?.astar?.confidence ?? null,
      /* Seconde solution du moteur (A* : [latéral, vertical] m, décalée d'une largeur de gabarit) : écart à l'humain, seulement mesuré. */
      alternative: Array.isArray(r?.astar?.alternative) ? errMm([0, r.astar.alternative[0], r.astar.alternative[1]], mic[s]).d3 : null };
    deltas[s] = b.delta;
  }
  const g = d => (d.left && d.right) ? Gauge.predictedGaugeMm(cap.rails, d, C) : null;
  const humain = g({ left: mic.left.map(v => v / 1000), right: mic.right.map(v => v / 1000) });
  const moteur = g(deltas), depart = Gauge.gaugeMmOf(cap.rails, C);
  return { rails, gaugeMoteurMm: moteur, gaugeHumainMm: humain, gaugeDepartMm: depart, gaugeMotifLot: sc.summary.pairGaugeRejected,
    pairePubliee: SIDES.every(s => rails[s].statut === 'candidate') && !sc.summary.pairGaugeRejected, nextCandidates: sc.summary.nextCandidates };
}

/* ---------- agrégats ---------- */
const pire = (r, cle) => SIDES.every(s => r.rails[s][cle]) ? Math.max(...SIDES.map(s => r.rails[s][cle].d3)) : null;
function agreger(lignes) {
  const o = { cuts: lignes.length };
  const bruts = lignes.map(l => pire(l, 'brut')), pub = lignes.map(l => pire(l, 'publie'));
  o.candidatBrutParCut = { n: bruts.filter(Number.isFinite).length, pireRail3d: stats(bruts), repartition: repartition(bruts) };
  o.paireMoteurPubliee = { n: pub.filter(Number.isFinite).length, pireRail3d: stats(pub), repartition: repartition(pub) };
  o.parRail = {};
  for (const s of SIDES) { const b = lignes.map(l => l.rails[s].brut).filter(Boolean);
    o.parRail[s] = { n: b.length, d3: stats(b.map(x => x.d3)), latAbs: stats(b.map(x => Math.abs(x.lat))), vertAbs: stats(b.map(x => Math.abs(x.vert))), longAbs: stats(b.map(x => Math.abs(x.long))) }; }
  return o;
}
const par2 = (lignes, f) => { const o = {}; for (const l of lignes) for (const sd of SIDES) { const k = f(l), m = l.rails[sd].statut === 'candidate' ? 'candidate' : (l.rails[sd].motif || l.rails[sd].erreur || 'sans-motif'); o[k] = o[k] || {}; o[k][m] = (o[k][m] || 0) + 1; } return o; };
/* Scénarios (mesures, pas de règle proposée) sur les cuts que le lot n'a pas posés. */
function scenarios(lignes) {
  const sc = {};
  const def = {
    differes_paire_publiee: l => l.classe === 'differee' && l.pairePubliee,
    differes_paire_brute_toute: l => l.classe === 'differee' && pire(l, 'brut') != null,
    non_poses_paire_publiee: l => l.classe !== 'posee' && l.pairePubliee,
    differes_total: l => l.classe === 'differee',
    horsjournal_paire_publiee: l => l.classe === 'hors-journal' && l.pairePubliee,
    horsjournal_total: l => l.classe === 'hors-journal',
  };
  for (const [k, f] of Object.entries(def)) {
    const sel = lignes.filter(f), cle = k.includes('brute') ? 'brut' : 'publie', e = sel.map(l => pire(l, cle)).filter(Number.isFinite);
    const n = e.length, sup50 = e.filter(v => v > 50).length;
    /* Borne haute de Wilson à 95 % de la part au-delà de 50 mm. */
    const z = 1.96, p = n ? sup50 / n : 0, w = n ? (p + z * z / (2 * n) + z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / (1 + z * z / n) : null;
    sc[k] = { cuts: sel.length, avecEcart: n, repartition: repartition(e), sup50, partSup50: n ? Math.round(1000 * p) / 10 : null, wilsonHaute95: w == null ? null : Math.round(1000 * w) / 10,
      jusqua10mm: e.filter(v => v <= 10).length, budget3pcPermet: Math.floor(0.03 * n) };
  }
  return sc;
}
function main() {
  const lot = arg('--lot'), jt = arg('--jointures'), echo = arg('--echo', true), sortie = arg('--sortie'), detail = arg('--detail');
  const parties = (arg('--parties') || '10,13,14,15').split(',').map(Number);
  if (!lot || !jt || !echo.length || !sortie) throw Error('Usage : --lot D --jointures D --echo S.json [--echo S2.json] --sortie A.json [--detail D.json]');
  const refs = lireRefs(jt, parties), cascade = lireJournal(lot);
  const cl = capturesLot(lot, refs), ce = capturesEcho(echo, refs);
  const lignes = [], sansNuage = [];
  for (const [k, ref] of refs) {
    let cap = cl.get(k), source = 'lot', mic = ref.mic;
    if (!cap) {
      cap = ce.get(k); source = 'echo';
      if (cap) { if (cap.micVisite) mic = cap.micVisite; else if (!cap.estPremiereVisite) { sansNuage.push({ k, raison: 'pose-humaine-de-base-inapplicable' }); continue; } }
    }
    if (!cap) { sansNuage.push({ k, raison: 'aucun-nuage-exploitable' }); continue; }
    const res = rejouer(cap, ref, mic, source === 'lot' ? ref.ariane : null);
    lignes.push({ k, partie: ref.partie, cut: ref.cut, classe: ref.classe, motif: ref.motif, cascade: cascade.has(k), source, points: cap.points,
      ecartMicVsTable: source === 'echo' && cap.micVisite ? Math.max(...SIDES.map(s => Math.hypot(...[0, 1, 2].map(i => cap.micVisite[s][i] - ref.mic[s][i])))) : null, ...res });
  }
  if (detail) fs.writeFileSync(detail, JSON.stringify({ lignes, sansNuage }, null, 1));
  /* Agrégats sans identifiant de cut. */
  const A = { format: 'ch049f-agregats-v1', parties, refs: refs.size, avecNuage: lignes.length, sansNuage: sansNuage.length,
    sansNuageRaisons: sansNuage.reduce((o, x) => (o[x.raison] = (o[x.raison] || 0) + 1, o), {}), sources: lignes.reduce((o, l) => (o[l.source] = (o[l.source] || 0) + 1, o), {}) };
  const par = (f) => { const o = {}; for (const l of lignes) { const k = f(l); (o[k] = o[k] || []).push(l); } return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, agreger(v)])); };
  A.global = agreger(lignes);
  A.parPartie = par(l => 'p' + l.partie);
  A.parClasse = par(l => l.classe);
  A.parSource = par(l => l.source);
  A.parMotifDiffere = par(l => l.classe === 'differee' ? l.motif.join('+') : 'non-differe');
  A.cascade = agreger(lignes.filter(l => l.cascade));
  const vs = lignes.filter(l => l.classe === 'posee').flatMap(l => SIDES.map(s => l.rails[s].vsAriane));
  A.fidelite = { railsRejouesVsPoseAriane3dMm: stats(vs), sup2mm: vs.filter(v => v > 2).length,
    micEchoVsTable: stats(lignes.filter(l => l.ecartMicVsTable != null).map(l => l.ecartMicVsTable)) };
  A.motifsMoteur = par2(lignes, l => l.classe);
  A.scenarios = scenarios(lignes);
  A.cascadeDetail = { cuts: lignes.filter(l => l.cascade).length, sources: lignes.filter(l => l.cascade).map(l => l.source),
    paireMoteurPubliee: lignes.filter(l => l.cascade && l.pairePubliee).length, pire3dPubliee: lignes.filter(l => l.cascade && l.pairePubliee).map(l => r1(pire(l, 'publie'))) };
  const horsContrat = lignes.filter(l => Number.isFinite(l.gaugeHumainMm) && (l.gaugeHumainMm < 1420 || l.gaugeHumainMm > 1470));
  const mauvais = lignes.filter(l => pire(l, 'brut') > 50);
  A.referenceHumaine = { cutsEcartementHumainHorsContrat: horsContrat.length, parmiLesCutsAPlusDe50mm: mauvais.filter(l => horsContrat.includes(l)).length, cutsAPlusDe50mm: mauvais.length };
  const rails50 = lignes.flatMap(l => SIDES.map(s => l.rails[s])).filter(r => r.brut && r.brut.d3 > 20);
  A.secondeSolution = { railsAPlusDe20mm: rails50.length, avecAlternative: rails50.filter(r => r.alternative != null).length,
    alternativeA10mm: rails50.filter(r => r.alternative != null && r.alternative <= 10).length, alternativeA5mm: rails50.filter(r => r.alternative != null && r.alternative <= 5).length };
  const ecartements = lignes.filter(l => l.motif.some(m => m === 'gauge-out-of-contract'));
  A.ecartementHorsContrat = { cuts: ecartements.length,
    gaugeMoteurMm: ecartements.map(l => r1(l.gaugeMoteurMm)), gaugeHumainMm: ecartements.map(l => r1(l.gaugeHumainMm)),
    railQuiDevie: ecartements.map(l => { const d = SIDES.map(s => l.rails[s].brut?.d3); return d.every(Number.isFinite) ? (d[0] > d[1] ? 'gauche' : 'droite') : null; }) .reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {}),
    erreurParRail: SIDES.map(s => ecartements.map(l => l.rails[s].brut && { lat: r1(l.rails[s].brut.lat), vert: r1(l.rails[s].brut.vert), d3: r1(l.rails[s].brut.d3) })) };
  fs.mkdirSync(path.dirname(path.resolve(sortie)), { recursive: true });
  fs.writeFileSync(sortie, JSON.stringify(A, null, 1));
  console.log(JSON.stringify({ refs: A.refs, avecNuage: A.avecNuage, sansNuage: A.sansNuageRaisons, sources: A.sources, global: A.global.candidatBrutParCut }, null, 1));
}
if (require.main === module) main();
module.exports = { candidatBrut, errMm, stats, repartition };
