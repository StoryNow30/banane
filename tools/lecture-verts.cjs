#!/usr/bin/env node
'use strict';
/*
 * lecture-verts.cjs — RM-12 (5.0) : et si le lot lisait aussi un vert sur N, sans rien y poser, pour nourrir les détecteurs de PN et d'ADV ?
 * Étude HORS LIGNE (fiches/RM12_LECTURE_VERTS.md). Rien n'est changé à l'extension : `src/`, `datasets/reglages-figes.json` et le lot restent tels quels.
 *
 *   node tools/lecture-verts.cjs simuler --partie P:N --cas CAS.jsonl --table TABLE.json [--surfaces-lot F.jsonl] [--surfaces-echo F.jsonl] [--partie …] [--n 2,3,5,10]
 *                                         [--zones datasets/lecture-verts-zones-de-mic.json] [--marges PROPOSITION.json] [--juger-partie-reservee] [--json S.json]
 *                                         [--trous T1,T2 --cout COUT.json]   (variante ciblée RM-12b : ne lire un vert sur N que dans les trous de lecture du lot)
 *   node tools/lecture-verts.cjs cout     --journal J.json --partie N [--total CUTS] [--lot CUTS] [--minutes-lot MIN] [--journal …] [--n 2,3,5,10] [--json S.json]
 *   node tools/lecture-verts.cjs essai
 *
 * SIMULER. Le lot ne lit que les cuts invalides (`table.lot`). On y ajoute un vert sur N, c'est-à-dire un cut sur N parmi les cuts qui ne sont pas du lot
 * (rang parmi les verts modulo N, N phases essayées), mais seulement parmi les verts que Mic a visités avec un nuage dans l'Écho (les cas portent leur
 * `ariane.surface`) : c'est la LIMITE de l'étude, les nuages des verts non visités n'existent pas. Les zones sont relevées dans l'ordre des cuts par le
 * module des règles métier (`src/regles-metier.js`), avec deux détecteurs :
 *   - `fige`   : celui de l'extension (deux cœurs de chaussée ou deux alertes d'ADV à 3 cuts au plus ouvrent une zone) ;
 *   - `adapte` : l'écart de confirmation est porté à max(3, N), ADV et PN (à 3 cuts, deux lectures espacées de N ≥ 4 ne se confirment jamais).
 * Les cuts du lot prennent leur surface dans `--surfaces-lot` (une ligne `{"cut":…,"surface":{…}}` par cut, tirée de la capture du lot) ; sans ce fichier, la
 * surface de l'Écho du même cut, comme dans tools/marges-zones.cjs (les lots dont le cut n'a pas de nuage dans l'Écho n'y lisent alors rien : à dire).
 * `--surfaces-echo` (même forme) remplace ou complète les surfaces des cas pour les verts, quand l'Écho a été relu avec tous les points de la capture.
 * Mesures, par N, phase et détecteur : zones de Mic retrouvées (ADV et PN d'après `--zones`), cuts de ces zones dans la sélection, grosses corrections de Mic
 * (plus de 10 mm) hors zone + marge, cuts à relire (sélection de tools/relecture-autonome.cjs, marges livrées ou celles de `--marges`), plages « fausses »
 * (cœur sans zone de Mic à 10 cuts près ; seulement pour les parties qui ont une liste de zones). Repères : « lot » (aujourd'hui) et « écho » (N = 1 : tous les
 * verts à nuage, le plafond).
 *
 * TROUS (--trous, option ; sans elle rien ne change). Variante ciblée : le lot lit ce qu'il lit, et quand T cuts consécutifs passent sans aucune lecture (entre deux
 * cuts du lot, ou depuis le cut 0 jusqu'au premier ; pas après le dernier, où le lot est fini), il lit ensuite un vert sur N jusqu'au cut du lot suivant : lectures
 * aux cuts a+T+1+ph, a+T+1+ph+N, … (a : dernier cut lu, ph : phase de 0 à N−1). Détecteur adapté (écart de confirmation = max(3, N)). Chaque configuration
 * donne en plus le nombre de lectures faites dans les trous (tous les cuts lus, avec ou sans nuage dans l'Écho) ; avec `--cout` (sortie JSON du mode cout), les
 * minutes ajoutées = lectures × secondes « centre » de la lecture à N cuts de distance, comme dans la projection de RM-12.
 *
 * COUT. Lit des journaux de lot (même format que tools/perf-lot.cjs) : une ligne par cut lu, avec ses phases (navigation → capture reçue, analyse, décision,
 * pose, après pose) et la distance au cut quitté ; temps d'une lecture sans pose (navigation → capture, plus le calcul d'une relecture) selon la distance
 * parcourue (N cuts), temps d'un cut posé, et projection : lectures = (cuts de la partie − cuts du lot) / N, minutes ajoutées (bas : médiane de navigation →
 * capture ; centre : moyenne + calcul d'une relecture ; haut : moyenne + analyse et décision du lot), part du lot actuel. Les options `--total`, `--lot` et
 * `--minutes-lot` se rapportent au dernier `--journal`. Les coûts par distance sont ceux de tous les journaux réunis ; chaque partie garde ses cuts et son lot.
 */
const fs = require('node:fs'), path = require('node:path');
const RA = require('./relecture-autonome.cjs');
const MZ = require('./marges-zones.cjs');
const M = require('../src/regles-metier.js');
const Manifeste = require('./manifeste-parties.cjs');

const FORMAT_ZONES = 'ariane-lecture-verts-zones-v1', ZONES = path.join(__dirname, '..', 'datasets', 'lecture-verts-zones-de-mic.json');
const FORMAT_SIM = 'ariane-lecture-verts-simulation-v1', FORMAT_COUT = 'ariane-lecture-verts-cout-v1';
const DETECTEURS = Object.freeze(['fige', 'adapte']);
const NS_DEFAUT = Object.freeze([2, 3, 5, 10]);
const r1 = v => Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
const clone = o => JSON.parse(JSON.stringify(o));

/* ------------------------------------------------------------------ lectures d'une partie */
/* X : { designation, partie, cas, table, surfacesLot? (Map cut → surface) }. Le lot lit ses cuts ; un vert sur N est lu en plus s'il a un nuage dans l'Écho. */
function surfacesEcho(cas, plus) {
  const m = new Map(cas.filter(c => c.ariane && c.ariane.surface).map(c => [c.cut, c.ariane.surface]));
  if (plus) for (const [c, s] of plus) m.set(c, s);
  return m;
}
function preparerPartie(X) {
  const lot = new Set((X.table.lot || []).map(x => x.cut)), echo = surfacesEcho(X.cas, X.surfacesEcho), tri = [...lot].sort((a, b) => a - b);
  const rang = c => { let k = 0; while (k < tri.length && tri[k] < c) k++; return c - k; };
  const lotLus = tri.map(cut => ({ cut, s: (X.surfacesLot && X.surfacesLot.get(cut)) || echo.get(cut) })).filter(x => x.s);
  const verts = [...echo.keys()].filter(c => !lot.has(c)).sort((a, b) => a - b).map(cut => ({ cut, s: echo.get(cut), rang: rang(cut) }));
  return { ...X, lot, lotLus, verts };
}
const lectures = (Y, n, phase) => [...Y.lotLus, ...(n === 1 ? Y.verts : Y.verts.filter(v => v.rang % n === phase))].sort((a, b) => a.cut - b.cut);

/* Variante ciblée : lectures des verts dans les trous du lot. Un trou va du cut lu a (−1 au début de la partie) au cut du lot suivant b ; après T cuts passés sans
 * lecture, les cuts a+T+1+phase, +N, +2N… (tant que < b) sont lus. Renvoie les lectures avec nuage (lot + verts de l'Écho) et le nombre total de lectures faites. */
function lecturesTrous(Y, T, n, phase) {
  const tri = [...Y.lot].sort((a, b) => a - b), bornes = [];
  let a = -1; for (const c of tri) { bornes.push([a, c]); a = c; }
  let lectures = 0; for (const [d, f] of bornes) { const p = d + T + 1 + phase; if (p < f) lectures += Math.floor((f - 1 - p) / n) + 1; }
  const verts = []; let k = 0;
  for (const v of Y.verts) {
    while (k < bornes.length && bornes[k][1] < v.cut) k++;
    if (k >= bornes.length) break;
    const [d, f] = bornes[k], p = d + T + 1 + phase;
    if (v.cut > d && v.cut < f && v.cut >= p && (v.cut - p) % n === 0) verts.push(v);
  }
  return { lect: [...Y.lotLus, ...verts].sort((x, y) => x.cut - y.cut), lectures, verts: verts.length };
}

/* Prépare la partie pour la sélection : mêmes champs que `preparer` de tools/marges-zones.cjs, à partir d'une liste de lectures. */
function preparerLectures(Y, lect, { pnEcart = 3, P = MZ.parDefaut() } = {}) {
  const opts = { pn: { confirmationEcartCuts: pnEcart } }, mem = M.creerMemoire('relecture'), tous = new Map();
  for (const { cut, s } of lect) {
    const r = M.resumer({ identity: { part: Y.partie, cut }, decision: null, action: null, valide: null, surface: { flushPct: s.flushPct, quadMin: s.quadMin, coeurPN: s.coeurPN, advRails: 0 } });
    M.evaluer(mem, r, opts); M.noter(mem, r, { differe: false }, opts);
    const z = mem.zones.at(-1); if (z) tous.set(z.debut, z.fin);
  }
  const norme = v => Math.hypot(v[0], v[1], v[2]);
  const micCuts = Y.cas.filter(c => c.mic && c.mic.ref && c.mic.rails).map(c => ({ cut: c.cut, mic: Math.max(...['left', 'right'].map(s => norme(c.mic.rails[s]))) }));
  const p = { designation: Y.designation, table: Y.table, sansLot: false, micCuts, pnBrutes: [...tous].map(([a, b]) => [a, b]).sort((a, b) => a[0] - b[0]),
    alertes: lect.filter(x => x.s.advRails > 0).map(x => x.cut), coeurs: lect.filter(x => x.s.coeurPN).map(x => x.cut), avecSurface: lect.length };
  const T0 = MZ.construireTable(p, P);
  p.liste = RA.listeAControler({ ...Y.table, zonesPN: T0.zonesPN, zonesADV: T0.zonesADV }).cuts;
  return p;
}
const chevauche = (a, b, c, d) => a <= d && c <= b;

/* Mesures d'une partie préparée sous des marges P. `vrai` : { adv: [[début, fin]…], pn: […], liste: bool } (zones de Mic) ou null. */
function mesurer(p, P, vrai) {
  const { T, S } = MZ.selectionDe(p, P), V = vrai || { adv: [], pn: [], liste: false };
  const grosses = p.micCuts.filter(c => c.mic > 10), hors = grosses.filter(c => !S.type.has(c.cut)).map(c => c.cut);
  const verts = RA.TYPES.reduce((a, k) => a + S.verts[k], 0);
  const advVu = V.adv.map(([a, b]) => T.zonesADV.some(r => chevauche(r[0], r[1], a, b)));
  const pnVu = V.pn.map(([a, b]) => T.zonesPN.some(z => chevauche(z.controle[0], z.controle[1], a, b)));
  let zc = 0, zt = 0;
  for (const [a, b] of [...V.adv, ...V.pn]) for (let c = a; c <= b; c++) { zt++; if (S.type.has(c)) zc++; }
  const cA = MZ.zonesADV(p.alertes, P.adv), coresADV = cA.zs.map(z => [z.debut, z.fin]).concat(P.adv.seule ? cA.seules.map(c => [c, c]) : []);
  const coresPN = MZ.zonesPN(p, P).map(z => z.slice()), toutes = [...V.adv, ...V.pn];
  const fausse = z => !toutes.some(([a, b]) => chevauche(z[0] - 10, z[1] + 10, a, b));
  return { grosses: grosses.length, hors: hors.length, horsCuts: hors, cuts: verts + S.revisites,
    advTotal: V.adv.length, advVu: advVu.filter(Boolean).length, pnTotal: V.pn.length, pnVu: pnVu.filter(Boolean).length,
    advManques: V.adv.filter((_, i) => !advVu[i]).map(z => z.join('-')), pnManques: V.pn.filter((_, i) => !pnVu[i]).map(z => z.join('-')),
    zoneCuts: zt, zoneCouverts: zc, plagesADV: coresADV.length, plagesPN: coresPN.length,
    fausses: V.liste ? coresADV.filter(fausse).length + coresPN.filter(fausse).length : 0, nonJugees: V.liste ? 0 : coresADV.length + coresPN.length };
}
const avecEcart = (P, e) => { const Q = clone(P); Q.adv.ecart = e; return Q; };

/* Une partie : lot seul, écho complet (N = 1) et, par détecteur et par N, une mesure par phase. */
function simulerPartie(X, { ns = NS_DEFAUT, P = MZ.parDefaut(), vrai = null, trous = null } = {}) {
  const Y = preparerPartie(X), un = (lect, e) => mesurer(preparerLectures(Y, lect, { pnEcart: e, P: avecEcart(P, e) }), avecEcart(P, e), vrai);
  const o = { partie: X.designation, cutsLot: Y.lot.size, vertsAvecNuage: Y.verts.length, lot: un(Y.lotLus, 3), echo: { ...un(lectures(Y, 1, 0), 3), verts: Y.verts.length }, n: {} };
  for (const det of DETECTEURS) for (const n of ns) {
    const e = det === 'fige' ? 3 : Math.max(3, n);
    o.n[`${det}|${n}`] = Array.from({ length: n }, (_, ph) => ({ ...un(lectures(Y, n, ph), e), verts: Y.verts.filter(v => v.rang % n === ph).length }));
  }
  if (trous) {
    o.t = {};
    for (const T of trous) for (const n of ns) {
      const e = Math.max(3, n);
      o.t[`${T}|${n}`] = Array.from({ length: n }, (_, ph) => { const r = lecturesTrous(Y, T, n, ph); return { ...un(r.lect, e), lectures: r.lectures, verts: r.verts }; });
    }
  }
  return o;
}
const NUM = ['grosses', 'hors', 'cuts', 'advTotal', 'advVu', 'pnTotal', 'pnVu', 'zoneCuts', 'zoneCouverts', 'plagesADV', 'plagesPN', 'fausses', 'nonJugees', 'verts'];
const NUM_T = [...NUM, 'lectures'];
const somme = (ls, noms = NUM) => Object.fromEntries(noms.map(k => [k, ls.reduce((a, l) => a + (l[k] || 0), 0)]));
/* Toutes les parties : somme par phase, puis moyenne, minimum et maximum sur les phases. */
function agreger(parties) {
  const o = { lot: somme(parties.map(p => p.lot)), echo: somme(parties.map(p => p.echo)), n: {} };
  for (const k of Object.keys(parties[0].n)) {
    const nb = parties[0].n[k].length, ph = Array.from({ length: nb }, (_, i) => somme(parties.map(p => p.n[k][i]))), r = {};
    for (const c of NUM) { const v = ph.map(x => x[c]); r[c] = { moy: r1(v.reduce((a, b) => a + b, 0) / nb), min: Math.min(...v), max: Math.max(...v) }; }
    r.phases = nb; o.n[k] = r;
  }
  if (parties[0].t) {
    o.t = {};
    for (const k of Object.keys(parties[0].t)) {
      const nb = parties[0].t[k].length, ph = Array.from({ length: nb }, (_, i) => somme(parties.map(p => p.t[k][i]), NUM_T)), r = {};
      for (const c of NUM_T) { const v = ph.map(x => x[c]); r[c] = { moy: r1(v.reduce((a, b) => a + b, 0) / nb), min: Math.min(...v), max: Math.max(...v) }; }
      r.phases = nb; o.t[k] = r;
    }
  }
  return o;
}
function simuler(parties, opts = {}) {
  const ps = parties.map(x => simulerPartie(x, { ...opts, vrai: opts.zones ? zonesDe(opts.zones, x.designation) : null }));
  const o = { format: FORMAT_SIM, ns: opts.ns || NS_DEFAUT, marges: opts.P ? 'proposées' : 'livrées', parties: ps, total: agreger(ps) };
  if (opts.trous) { o.trous = opts.trous; if (opts.cout) ajouterMinutes(o, opts.cout); }
  return o;
}
/* Secondes d'une lecture sans pose à N cuts de distance : « centre » de la projection d'ensemble du mode cout (minutes × 60 / lectures). */
function secondesLecture(coutJson, n) {
  const p = coutJson && coutJson.ensemble && coutJson.ensemble.projection.find(x => x.n === n);
  if (!p || !p.minutes || !p.lectures) throw Error(`--cout : pas de coût pour N = ${n} (relancer cout avec --n ${n})`);
  return p.minutes.centre * 60 / p.lectures;
}
/* Minutes ajoutées par les lectures des trous : par partie et phase, puis en moyenne par partie (somme sur les parties / nombre de parties). */
function ajouterMinutes(o, coutJson) {
  const k = o.parties.length;
  for (const cle of Object.keys(o.total.t)) {
    const n = Number(cle.split('|')[1]), sec = secondesLecture(coutJson, n);
    for (const p of o.parties) for (const ph of p.t[cle]) ph.minutes = r1(ph.lectures * sec / 60);
    const par = o.parties.map(p => { const m = p.t[cle].map(ph => ph.lectures * sec / 60); return m.reduce((a, b) => a + b, 0) / m.length; });
    const r = o.total.t[cle]; r.secondesParLecture = r1(sec); r.minutesParPartie = r1(par.reduce((a, b) => a + b, 0) / k);
    r.minutesParPartieDetail = Object.fromEntries(o.parties.map((p, i) => [p.partie, r1(par[i])]));
  }
}
function zonesDe(zones, designation) {
  if (!zones || zones.format !== FORMAT_ZONES) throw Error(`zones : format ${FORMAT_ZONES} attendu`);
  const z = zones.parties[designation];
  return z ? { adv: z.adv || [], pn: z.pn || [], liste: z.liste !== false } : { adv: [], pn: [], liste: false };
}

/* ------------------------------------------------------------------ coût : lecture des journaux de lot */
const ms = e => Date.parse(e.timestamp);
function evenements(data) {
  const V1 = require('./perf-phases.cjs');
  let ev = data.events || [];
  if (data.dictionaries && Array.isArray(ev)) ev = V1.resolveRefs(ev, data.dictionaries).value;
  return ev.filter(e => Number.isFinite(ms(e))).sort((a, b) => ms(a) - ms(b));
}
/* Une ligne par cut lu par le lot (capture reçue) : durée de chaque phase, distance au cut quitté (positive : vers l'avant), pose ou non. */
function visites(ev, partie) {
  const out = []; let nav = null, cur = null;
  const cloture = () => { if (cur) out.push(cur); cur = null; };
  for (const e of ev) {
    if (e.type === 'cut-target-changed') { cloture(); nav = e.nextIdentity && Number.isInteger(e.nextIdentity.cut) ? { at: ms(e), de: e.identity && e.identity.cut, vers: e.nextIdentity.cut } : null; continue; }
    if (!e.identity || e.identity.part !== partie) continue;
    const c = e.identity.cut;
    if (e.type === 'before-captured') { cloture(); const ok = nav && nav.vers === c; cur = { cut: c, de: ok ? nav.de : null, navAt: ok ? nav.at : null, cap: ms(e) }; continue; }
    if (!cur || c !== cur.cut) continue;
    if (e.type === 'proposed') cur.prop = ms(e); else if (e.type === 'gcv1-shadow-observed') cur.dec = ms(e); else if (e.type === 'applied-verified') cur.app = ms(e);
    else if (e.type === 'validation-accepted') cur.acc = ms(e); else if (e.type === 'defer-finalized' || e.type === 'capture-abandoned') cur.differe = true;
  }
  cloture();
  const d = (a, b) => Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  return out.map(v => ({ cut: v.cut, delta: v.de == null ? null : v.cut - v.de, navMs: d(v.cap, v.navAt), analyseMs: d(v.prop, v.cap), decisionMs: d(v.dec, v.prop),
    poseMs: d(v.app, v.dec), apresMs: d(v.acc, v.app), pose: v.app != null, differe: !!v.differe && v.app == null }));
}
/* Lectures sans pose de la relecture après le lot (événements `relecture-ombre`, action « visite »), durées mesurées par la page. */
function lecturesRelecture(ev, partie) {
  return ev.filter(e => e.type === 'relecture-ombre' && e.action === 'visite' && e.durees && e.identity && e.identity.part === partie).map(e => ({ cut: e.identity && e.identity.cut, ...e.durees }));
}
const trier = a => a.filter(Number.isFinite).sort((x, y) => x - y);
const quant = (a, p) => { const s = trier(a); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : null; };
const moy = a => { const s = trier(a); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const stat = a => ({ n: trier(a).length, mediane: quant(a, 0.5), moyenne: moy(a), p90: quant(a, 0.9) });
/* Seau de distance (cuts avancés) qui correspond à une lecture tous les N verts. */
const SEAUX = Object.freeze({ 1: [1, 1], 2: [2, 2], 3: [3, 3], 4: [4, 5], 5: [4, 5], 10: [6, 10] });
const seau = n => SEAUX[n] || [Math.max(1, Math.ceil(n * 0.6)), n];
const CALCUL_RELECTURE_MS = 110;
function resumerCout(vis) {
  const fw = vis.filter(v => v.delta != null && v.delta > 0), posees = vis.filter(v => v.pose);
  const cycle = v => v.navMs + v.analyseMs + v.decisionMs + v.poseMs + v.apresMs;
  return { visites: vis.length, posees: posees.length, differes: vis.filter(v => v.differe).length,
    cutPose: stat(posees.map(cycle)), lectureCheminDuLot: stat(posees.map(v => v.navMs + v.analyseMs + v.decisionMs)), navigationCapture: stat(vis.map(v => v.navMs)),
    parDistance: [[1, 1], [2, 2], [3, 3], [4, 5], [6, 10], [11, 30], [31, 100], [101, Infinity]].map(([a, b]) => ({ de: a, a: b === Infinity ? null : b, ...stat(fw.filter(v => v.delta >= a && v.delta <= b).map(v => v.navMs)) })),
    analyse: stat(vis.map(v => v.analyseMs)), decision: stat(vis.map(v => v.decisionMs)) };
}
/* Projection pour une partie de `total` cuts dont le lot décide `lot` cuts, en minutes : bas = médiane de navigation → capture ; centre = moyenne + calcul d'une
 * relecture ; haut = moyenne + analyse et décision du lot (le chemin du lot sans la pose). Économie : les sauts longs du lot deviennent des sauts de N cuts. */
function projeter(vis, { total, lot, ns = NS_DEFAUT, minutesLot = null, propres = null }) {
  const fw = vis.filter(v => v.delta != null && v.delta > 0), an = moy(vis.map(v => v.analyseMs)) || 0, de = moy(vis.map(v => v.decisionMs)) || 0;
  return ns.map(n => {
    const [a, b] = seau(n), nav = fw.filter(v => v.delta >= a && v.delta <= b).map(v => v.navMs), lectures = Math.round((total - lot) / n);
    const m = quant(nav, 0.5), mo = moy(nav);
    if (m == null) return { n, lectures, minutes: null, note: 'aucune visite à cette distance' };
    const min = t => r1(lectures * t / 60000), eco = (propres || vis).filter(v => v.delta != null && Math.abs(v.delta) > n).reduce((s, v) => s + Math.max(0, v.navMs - mo), 0) / 60000;
    return { n, lectures, secondes: { bas: r1(m / 1000), centre: r1((mo + CALCUL_RELECTURE_MS) / 1000), haut: r1((mo + an + de) / 1000) },
      minutes: { bas: min(m), centre: min(mo + CALCUL_RELECTURE_MS), haut: min(mo + an + de) }, economieSautsLongs: r1(eco),
      partDuLot: minutesLot ? r1(100 * lectures * (mo + CALCUL_RELECTURE_MS) / 60000 / minutesLot) : null };
  });
}
/* Les coûts par distance sont ceux de TOUS les journaux réunis (un seul journal donne trop peu de sauts de chaque longueur) ; chaque partie garde ses propres
 * cuts, ses cuts de lot et la durée de son lot. */
function cout(journaux, { total = 9800, ns = NS_DEFAUT } = {}) {
  const pr = journaux.map(j => { const ev = evenements(j.data), vis = visites(ev, j.partie); return { ...j, vis, rel: lecturesRelecture(ev, j.partie).filter(r => Number.isFinite(r.totalMs)) }; });
  const toutes = pr.flatMap(p => p.vis), rel = pr.flatMap(p => p.rel);
  const parties = pr.map(p => ({ partie: p.partie, ...resumerCout(p.vis), relectureSansPose: stat(p.rel.map(r => r.totalMs)),
    projection: projeter(toutes, { total: p.total || total, lot: p.lot == null ? p.vis.length : p.lot, ns, minutesLot: p.minutesLot || null, propres: p.vis }) }));
  const ensemble = { ...resumerCout(toutes), relectureSansPose: { ...stat(rel.map(r => r.totalMs)), capture: stat(rel.map(r => r.captureMs)), calcul: stat(rel.map(r => r.calculMs)) },
    projection: ns.map((n, i) => {
      const ls = parties.map(p => p.projection[i]).filter(x => x.minutes), minutesLot = pr.reduce((a, p) => a + (p.minutesLot || 0), 0), t = k => r1(ls.reduce((a, x) => a + x.minutes[k], 0));
      return { n, lectures: ls.reduce((a, x) => a + x.lectures, 0), minutes: { bas: t('bas'), centre: t('centre'), haut: t('haut') }, economieSautsLongs: r1(ls.reduce((a, x) => a + x.economieSautsLongs, 0)),
        minutesLot: r1(minutesLot), partDuLot: minutesLot ? r1(100 * t('centre') / minutesLot) : null };
    }) };
  return { format: FORMAT_COUT, total, parties, ensemble };
}

/* ------------------------------------------------------------------ texte */
function texteSimulation(o) {
  const t = o.total, f = (x, c) => `${x[c].moy}${x[c].min === x[c].max ? '' : ` [${x[c].min}-${x[c].max}]`}`;
  const L = [`Lecture de verts au lot (marges ${o.marges}) : ${o.parties.map(p => p.partie).join(', ')}`, 'configuration | zones ADV | zones PN | cuts de zone | grosses hors zone | cuts à relire | plages fausses | verts lus (échantillon)'];
  const ligne = (nom, x) => L.push(`${nom} | ${x.advVu}/${x.advTotal} | ${x.pnVu}/${x.pnTotal} | ${x.zoneCouverts}/${x.zoneCuts} | ${x.hors}/${x.grosses} | ${x.cuts} | ${x.fausses} (+${x.nonJugees} non jugées) | ${x.verts || 0}`);
  ligne('lot seul', t.lot);
  for (const det of DETECTEURS) for (const n of o.ns) {
    const x = t.n[`${det}|${n}`]; L.push(`1 vert sur ${n} (${det}) | ${f(x, 'advVu')}/${t.lot.advTotal} | ${f(x, 'pnVu')}/${t.lot.pnTotal} | ${f(x, 'zoneCouverts')}/${t.lot.zoneCuts} | ${f(x, 'hors')}/${t.lot.grosses} | ${f(x, 'cuts')} | ${f(x, 'fausses')} (+${f(x, 'nonJugees')} non jugées) | ${f(x, 'verts')}`);
  }
  ligne('écho complet', { ...t.echo, verts: t.echo.verts });
  if (t.t) for (const cle of Object.keys(t.t)) {
    const [T, n] = cle.split('|'), x = t.t[cle];
    L.push(`trous T = ${T}, 1 vert sur ${n} | ${f(x, 'advVu')}/${t.lot.advTotal} | ${f(x, 'pnVu')}/${t.lot.pnTotal} | ${f(x, 'zoneCouverts')}/${t.lot.zoneCuts} | ${f(x, 'hors')}/${t.lot.grosses} | ${f(x, 'cuts')} | ${f(x, 'fausses')} (+${f(x, 'nonJugees')} non jugées) | ${f(x, 'verts')} verts avec nuage | ${r1(x.lectures.moy / o.parties.length)} lectures par partie${x.minutesParPartie == null ? '' : ` | +${x.minutesParPartie} min par partie`}`);
  }
  return L.join('\n');
}
function texteCout(o) {
  const s = x => x == null ? '—' : `${r1(x / 1000)} s`, L = [`Coût d'une lecture de vert (projection pour ${o.total} cuts par partie)`];
  const resume = (nom, p) => {
    L.push(`${nom} : ${p.visites} cuts lus (${p.posees} posés, ${p.differes} différés)`,
      `  cut posé : médiane ${s(p.cutPose.mediane)}, moyenne ${s(p.cutPose.moyenne)} | lecture sans pose (chemin du lot) : médiane ${s(p.lectureCheminDuLot.mediane)}, moyenne ${s(p.lectureCheminDuLot.moyenne)}`);
    if (p.relectureSansPose.n) L.push(`  lectures sans pose de la relecture : ${p.relectureSansPose.n}, médiane ${s(p.relectureSansPose.mediane)}, moyenne ${s(p.relectureSansPose.moyenne)}`);
    for (const d of (p.parDistance || []).filter(d => d.n)) L.push(`  navigation → capture, ${d.a == null ? `${d.de} cuts et plus` : d.de === d.a ? `${d.de} cut` : `${d.de} à ${d.a} cuts`} en avant : ${d.n} visites, médiane ${s(d.mediane)}, moyenne ${s(d.moyenne)}`);
    for (const j of p.projection) L.push(j.minutes ? `  1 vert sur ${j.n} : ${j.lectures} lectures, ${j.minutes.bas} / ${j.minutes.centre} / ${j.minutes.haut} min (bas / centre / haut)${j.partDuLot == null ? '' : `, ${j.partDuLot} % du lot${j.minutesLot ? ` (${j.minutesLot} min)` : ''}`}` : `  1 vert sur ${j.n} : ${j.note}`);
  };
  for (const p of o.parties) resume(`partie ${p.partie}`, p);
  if (o.parties.length > 1) resume('ensemble', o.ensemble);
  return L.join('\n');
}

/* ------------------------------------------------------------------ essai synthétique */
/* Une partie de 400 cuts : le lot lit les cuts 200 à 209 (aucun signal) ; un PN de 20 cuts (300–319) est posé entièrement en vert par ESV, avec un cœur de
 * chaussée à chaque cut ; Mic corrige de plus de 10 mm les cuts 305 et 310 (dans le PN) et 50 (loin de tout). Les verts 280 à 340 ont un nuage. */
function essai() {
  const cas = [], lotCuts = [];
  for (let c = 200; c < 210; c++) lotCuts.push({ cut: c, differe: false });
  const rien = { flushPct: 0, quadMin: 0, sidePoints: 900, coeurPN: false, advRails: 0 }, coeur = { flushPct: 90, quadMin: 80, sidePoints: 900, coeurPN: true, advRails: 0 };
  for (let c = 0; c < 400; c++) {
    const mic = c === 305 || c === 310 || c === 50 ? 15 : 0, nuage = c >= 200 && c < 210 || c >= 280 && c <= 340;
    cas.push({ format: RA.FORMAT, projet: 9, partie: 1, cut: c, mic: { ref: 'validation', rails: { left: [0, 0, mic], right: [0, 0, mic] } }, ariane: { etat: 'calcule', surface: nuage ? (c >= 300 && c < 320 ? coeur : rien) : null } });
  }
  const cuts = cas.map(c => ({ i: c.cut, classe: 'hors-journal', mm: 0, dureeS: 2, visites: 1, bords: { left: [c.cut, 0.7175, 0], right: [c.cut, -0.7175, 0] } }));
  return { designation: '9:1', partie: 1, cas, table: { format: 'ariane-verts-table-v1', projet: 9, partie: 1, lot: lotCuts, zonesPN: [], zonesADV: [], cuts }, vrai: { adv: [], pn: [[300, 319]], liste: true } };
}
/* Variante ciblée : la même partie, mais le lot lit aussi les cuts 390 à 399. Le PN (300–319) est alors dans un trou de 180 cuts, entre les cuts 209 et 390. */
function essaiTrous() {
  const s = essai(); s.table = { ...s.table, lot: [...s.table.lot, ...Array.from({ length: 10 }, (_, i) => ({ cut: 390 + i, differe: false }))] };
  return s;
}
/* Un journal de lot inventé : trois cuts lus (1 → 2 en pas à pas, puis un saut de 10 cuts), le dernier différé. */
function journalEssai() {
  let t = Date.parse('2026-01-01T00:00:00Z'); const ev = [], id = c => ({ part: 1, cut: c });
  const e = (type, extra, dt) => { t += dt; ev.push({ type, timestamp: new Date(t).toISOString(), ...extra }); };
  const cycle = (de, vers, nav, an, dec, pose) => {
    e('cut-target-changed', { identity: id(de), nextIdentity: id(vers) }, 5);
    e('before-captured', { identity: id(vers) }, nav); e('proposed', { identity: id(vers) }, an); e('gcv1-shadow-observed', { identity: id(vers) }, dec);
    if (pose) { e('applied-verified', { identity: id(vers) }, pose); e('validation-accepted', { identity: id(vers) }, 100); }
  };
  cycle(0, 1, 1000, 300, 50, 700); cycle(1, 2, 800, 300, 50, 700); cycle(2, 12, 3000, 300, 50, 700); cycle(12, 13, 900, 300, 50, 0);
  e('capture-abandoned', { identity: id(13) }, 1);
  e('relecture-ombre', { identity: id(40), action: 'visite', durees: { navigationMs: 10, captureMs: 700, calculMs: 100, totalMs: 810 } }, 1);
  return { events: ev };
}

module.exports = { FORMAT_ZONES, FORMAT_SIM, FORMAT_COUT, ZONES, DETECTEURS, NS_DEFAUT, preparerPartie, lectures, preparerLectures, lecturesTrous, secondesLecture, mesurer, simulerPartie, agreger, simuler, zonesDe,
  evenements, visites, lecturesRelecture, resumerCout, projeter, cout, texteSimulation, texteCout, essai, essaiTrous, journalEssai, seau };

/* ------------------------------------------------------------------ ligne de commande */
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
function args(argv) {
  const o = { mode: argv[0], parties: [], journaux: [], ns: [...NS_DEFAUT] };
  const courante = () => { if (!o.parties.length) throw Error('--partie d\'abord'); return o.parties.at(-1); };
  const dernier = () => { if (!o.journaux.length) throw Error('--journal d\'abord'); return o.journaux.at(-1); };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--partie') {
      if (o.mode === 'cout') { const n = Number(val()); if (!Number.isInteger(n) || n < 0) throw Error('--partie NUMERO'); (o.journaux.at(-1) || (() => { throw Error('--journal d\'abord'); })()).partie = n; }
      else { const [p, n] = val().split(':').map(Number); if (!Number.isInteger(p) || !Number.isInteger(n)) throw Error('--partie PROJET:PARTIE'); o.parties.push({ projet: p, partie: n, designation: `${p}:${n}` }); }
    } else if (k === '--cas') courante().cas = val(); else if (k === '--table') courante().table = val(); else if (k === '--surfaces-lot') courante().surfacesLot = val(); else if (k === '--surfaces-echo') courante().surfacesEcho = val();
    else if (k === '--journal') o.journaux.push({ fichier: val(), partie: null });
    else if (k === '--n') { o.ns = val().split(',').map(Number); if (o.ns.some(n => !Number.isInteger(n) || n < 2)) throw Error('--n 2,3,5,10 (entiers à partir de 2)'); }
    else if (k === '--trous') { o.trous = val().split(',').map(Number); if (o.trous.some(t => !Number.isInteger(t) || t < 1)) throw Error('--trous T1,T2 (entiers à partir de 1)'); }
    else if (k === '--cout') o.cout = val(); else if (k === '--zones') o.zones = val(); else if (k === '--marges') o.marges = val(); else if (k === '--total') dernier().total = Number(val()); else if (k === '--lot') dernier().lot = Number(val());
    else if (k === '--minutes-lot') dernier().minutesLot = Number(val()); else if (k === '--json') o.json = val(); else if (k === '--juger-partie-reservee') o.jugerReservee = true;
    else throw Error('argument inconnu : ' + k);
  }
  return o;
}
function chargerParties(a) {
  const m = Manifeste.lire();
  const { avis } = Manifeste.controler(m, a.parties.map(p => ({ projet: p.projet, partie: p.partie })), { outil: 'lecture-verts', jugerReservee: !!a.jugerReservee });
  if (avis) console.error(avis);
  if (!a.jugerReservee && a.parties.some(p => Manifeste.estTemoin(m, p.projet, p.partie))) throw Error('un témoin ne règle rien : il se juge avec --juger-partie-reservee');
  return a.parties.map(p => {
    if (!p.cas || !p.table) throw Error(`partie ${p.designation} : --cas et --table attendus`);
    const cas = lireJsonl(p.cas), table = JSON.parse(fs.readFileSync(p.table, 'utf8'));
    if (cas.some(c => c.format !== RA.FORMAT || c.partie !== p.partie)) throw Error(`${p.cas} : cas d'une autre partie ou d'un autre format`);
    if (table.partie !== p.partie) throw Error(`${p.table} : table d'une autre partie`);
    const X = { designation: p.designation, partie: p.partie, cas, table };
    if (p.surfacesLot) X.surfacesLot = new Map(lireJsonl(p.surfacesLot).map(l => [l.cut, l.surface]));
    if (p.surfacesEcho) X.surfacesEcho = new Map(lireJsonl(p.surfacesEcho).map(l => [l.cut, l.surface]));
    return X;
  });
}
if (require.main === module) {
  try {
    const a = args(process.argv.slice(2));
    if (a.mode === 'simuler') {
      if (!a.parties.length) throw Error('simuler --partie P:N --cas CAS.jsonl --table TABLE.json [--surfaces-lot F.jsonl] [--n 2,3,5,10] [--zones Z.json] [--marges PROPOSITION.json] [--json S.json]');
      const zones = a.zones ? JSON.parse(fs.readFileSync(a.zones, 'utf8')) : null;
      const P = a.marges ? MZ.margesDeProposition(JSON.parse(fs.readFileSync(a.marges, 'utf8'))) : undefined;
      const cout = a.cout ? JSON.parse(fs.readFileSync(a.cout, 'utf8')) : null;
      if (cout && !a.trous) throw Error('--cout ne sert qu\'avec --trous');
      const o = simuler(chargerParties(a), { ns: a.ns, zones, P, trous: a.trous, cout });
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(o, null, 1));
      console.log(texteSimulation(o));
    } else if (a.mode === 'cout') {
      if (!a.journaux.length || a.journaux.some(j => j.partie == null)) throw Error('cout --journal J.json --partie NUMERO [--total CUTS] [--lot CUTS] [--minutes-lot MIN] [--journal …] [--n 2,3,5,10] [--json S.json]');
      const o = cout(a.journaux.map(j => ({ data: JSON.parse(fs.readFileSync(j.fichier, 'utf8')), partie: j.partie, total: j.total, lot: j.lot, minutesLot: j.minutesLot })), { ns: a.ns });
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(o, null, 1));
      console.log(texteCout(o));
    } else if (a.mode === 'essai') {
      const s = essai(), o = simuler([s], { ns: [2, 5], zones: { format: FORMAT_ZONES, parties: { '9:1': s.vrai } } });
      console.log(texteSimulation(o));
      console.log(texteCout(cout([{ data: journalEssai(), partie: 1, lot: 4, minutesLot: 0.1 }], { total: 400, ns: [2, 10] })));
    } else throw Error('mode : simuler | cout | essai');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
