#!/usr/bin/env node
'use strict';
/*
 * marges-zones.cjs — marges de zone de la relecture (RM-2, 5.0) : jusqu'où élargir les zones de PN et d'ADV (et les abords du lot) pour que les
 * grosses corrections de Mic (plus de 10 mm) tombent dans la sélection, sans doubler le nombre de cuts à relire ?
 * Étude HORS LIGNE (fiches/RM2_MARGES.md). Rien n'est changé à l'extension : `src/regles-metier.js`, `datasets/reglages-figes.json` et le
 * comportement par défaut de `tools/relecture-autonome.cjs` restent tels quels ; les marges sont une PROPOSITION dans un fichier à part.
 *
 *   node tools/marges-zones.cjs etudier --partie P:N --cas CAS.jsonl --table TABLE.json [--partie …] [--prix 200] [--plafond 1.75] [--avec-pn-ignore] [--fixer adv.trou=30 --fixer adv.gap=40]
 *                                        [--json S.json] [--proposition datasets/marges-zones-proposees.json --date AAAA-MM-JJ]
 *   node tools/marges-zones.cjs juger    --proposition PROP.json --partie P:N --cas … --table … --juger-partie-reservee [--json S.json]
 *   node tools/marges-zones.cjs notes    --proposition PROP.json --partie P:N --cas … --table … [--notes datasets/marges-zones-notes-de-mic.json]
 *   node tools/marges-zones.cjs essai
 *
 * LES ZONES ET LEURS MARGES. Une zone naît d'un signal du nuage lu par les règles métier (src/regles-metier.js), sur les cuts du lot (ou sur tous
 * les cuts visités pour une partie sans lot) :
 *  - PN : deux cœurs de chaussée à 3 cuts au plus ouvrent la zone ; marge de `pn.avant` cuts avant, `pn.apres` après (livré : 4 et 6) ;
 *    `pn.seule` : un cœur seul, non confirmé, ouvre aussi une zone (mêmes marges) ;
 *  - ADV : deux alertes « rail de plus » à 3 cuts au plus ouvrent la zone, qui grandit tant que les alertes se suivent à `adv.trou` cuts au
 *    plus (livré : 10) ; marge de `adv.avant` cuts avant la première alerte, `adv.apres` après la dernière (livré : 30 et 30) ;
 *    `adv.seule` : une alerte seule ouvre aussi une zone ; `adv.gap` : deux zones séparées de `gap` cuts au plus (marges comprises) sont reliées
 *    (chaînage ; livré : 0, elles ne fusionnent que si leurs marges se touchent) ; `adv.ignorePN` : une alerte à ce nombre de cuts au plus d'une
 *    zone de PN (marges de PN comprises) est ignorée, parce que la chaussée du PN peut lever l'alerte (livré : -1, aucune ignorée) ;
 *  - liste « À contrôler » (src/verts-a-controler.js) : `liste.marge` cuts de part et d'autre de chaque vert listé (livré : 0, le vert seul ;
 *    Mic : « tu as oublié de contrôler l'avant et l'après de cet isolé ») ;
 *  - abords du lot (tools/relecture-autonome.cjs, `SELECTION`) : marges autour des rouges (grappe, isolé, différé) et trou toléré dans une grappe.
 * Les zones sont relevées au fil des cuts SANS le plafond de 8 zones de la mémoire de l'ombre (`mem.zones`, `mem.zonesADV`), qui ne sert qu'à la
 * liste de fin de lot : les tables de RM-4 (`table`) l'avaient subi (1:16 : 4 PN perdus ; 2:1 : 5 zones d'ADV).
 *
 * LE COÛT. Cuts à relire = cuts de la sélection qui ne sont pas des rouges du lot : verts jamais passés par le lot + cuts posés par le lot à revoir
 * (`verts` + `revisites` de `selection`). Les rouges (différés) sont à corriger de toute façon : ils ne comptent pas.
 *
 * AJUSTER (parties d'apprentissage seulement : le manifeste refuse les autres). Les marges ne peuvent QUE grandir par rapport au livré (une
 * marge plus petite ferait perdre ce qui est couvert aujourd'hui) ; `adv.ignorePN` est la seule règle qui retire des alertes : le critère la juge. Elles se choisissent groupe par groupe (ADV, PN, PN pris pour ADV, liste, abords : toutes les
 * combinaisons du groupe, les autres groupes tenus), deux tours, en minimisant
 *      grosses corrections hors sélection + cuts à relire / prix + 1000 × Σ parties max(0, cuts après / cuts avant − plafond)
 * `prix` : nombre de cuts de plus qu'on accepte de relire pour rattraper une grosse correction ; `plafond` : jamais plus de `plafond` fois les
 * cuts à relire d'avant sur une partie (la mission : ne pas doubler). VALIDATION CROISÉE : même procédure sans la partie k, mesurée sur k.
 * NOTES : confronte les zones notées par Mic (datasets/marges-zones-notes-de-mic.json : parties 1:15, 1:16 et 2:11) aux plages livrées et proposées.
 * JUGER : applique une proposition figée à des parties réservées (témoins), sans rien régler.
 */
const fs = require('node:fs'), path = require('node:path');
const RA = require('./relecture-autonome.cjs');
const M = require('../src/regles-metier.js');
const Manifeste = require('./manifeste-parties.cjs');

const FORMAT_PROPOSITION = 'ariane-marges-zones-proposees-v1', FORMAT_ETUDE = 'ariane-marges-zones-etude-v1';
const fini = v => typeof v === 'number' && Number.isFinite(v);
const r2 = v => fini(v) ? Math.round(v * 100) / 100 : null;
const clone = o => JSON.parse(JSON.stringify(o));
const SIDES = ['left', 'right'];

/* Marges livrées (src/regles-metier.js et SELECTION de la relecture autonome), dans la forme de l'étude. */
const LIVRE = Object.freeze({
  pn: Object.freeze({ avant: M.DEFAULTS.pn.margeAvant, apres: M.DEFAULTS.pn.margeApres, seule: false }),
  adv: Object.freeze({ avant: M.DEFAULTS.adv.margeAvant, apres: M.DEFAULTS.adv.margeApres, trou: M.DEFAULTS.adv.trouCuts, gap: 0, seule: false,
    confirmation: M.DEFAULTS.adv.confirmation, ecart: M.DEFAULTS.adv.confirmationEcartCuts, ignorePN: -1 }),
  liste: Object.freeze({ marge: 0 }),
  abords: Object.freeze({ ...RA.SELECTION }),
});
/* Valeurs essayées (toutes au moins égales au livré : une marge ne rétrécit pas). */
const DOMAINES = Object.freeze({
  adv: Object.freeze({ 'adv.avant': [30, 35, 40, 45, 50, 60, 70, 80], 'adv.apres': [30, 35, 40, 45, 50, 60, 70, 80], 'adv.seule': [false, true], 'adv.gap': [0, 20, 40, 60], 'adv.trou': [10, 15, 20, 30] }),
  pn: Object.freeze({ 'pn.avant': [4, 6, 8, 10], 'pn.apres': [6, 8, 10, 12], 'pn.seule': [false, true] }),
  pnadv: Object.freeze({ 'adv.ignorePN': [-1, 0, 5, 10, 20, 30] }),
  liste: Object.freeze({ 'liste.marge': [0, 1, 2, 3, 4, 5, 7, 10, 15, 20] }),
  abords: Object.freeze({ 'abords.margeIsole': [1, 2, 3, 4, 5, 7], 'abords.margeDiffere': [2, 3, 4, 5, 7, 10], 'abords.margeGrappe': [3, 4, 5, 7, 10], 'abords.trouCuts': [5, 6, 8, 10, 15] }),
});
const GROUPES = Object.freeze(['adv', 'pn', 'pnadv', 'liste', 'abords']);
const CLES = Object.freeze(GROUPES.flatMap(g => Object.keys(DOMAINES[g])));
const lire = (P, k) => { const [a, b] = k.split('.'); return P[a][b]; };
const poser = (P, k, v) => { const [a, b] = k.split('.'); P[a][b] = v; return P; };
const avec = (P, modifs) => { const Q = clone(P); for (const [k, v] of Object.entries(modifs)) poser(Q, k, v); return Q; };
const parDefaut = () => clone(LIVRE);

/* ------------------------------------------------------------------ zones brutes d'une partie */
/* `cas` : cas de la relecture autonome ; `table` : table de la partie (lot, cuts). Relève, dans l'ordre des cuts, les zones de PN (sans plafond
 * de mémoire), les cuts d'alerte d'ADV et les cœurs de chaussée ; mémorise la correction de Mic de chaque cut visité avec référence. */
function preparer({ designation, cas, table }) {
  const sansLot = !(table.lot && table.lot.length), lot = new Set((table.lot || []).map(x => x.cut));
  const cs = cas.filter(c => c.ariane && c.ariane.surface && (sansLot || lot.has(c.cut))).sort((a, b) => a.cut - b.cut);
  const mem = M.creerMemoire('relecture'), tous = new Map();
  for (const c of cs) {
    const s = c.ariane.surface;
    /* Les alertes d'ADV sont relevées à part (`advRails: 0` ici) : la zone d'ADV est refaite plus bas avec des marges variables. */
    const r = M.resumer({ identity: { part: c.partie, cut: c.cut }, decision: null, action: null, valide: null, surface: { flushPct: s.flushPct, quadMin: s.quadMin, coeurPN: s.coeurPN, advRails: 0 } });
    M.evaluer(mem, r); M.noter(mem, r, { differe: false });
    const z = mem.zones.at(-1); if (z) tous.set(z.debut, z.fin);
  }
  const norme = v => Math.hypot(v[0], v[1], v[2]);
  const micCuts = cas.filter(c => c.mic && c.mic.ref && c.mic.rails).map(c => ({ cut: c.cut, mic: Math.max(...SIDES.map(s => norme(c.mic.rails[s]))) }));
  const p = { designation, table, sansLot, micCuts, pnBrutes: [...tous].map(([a, b]) => [a, b]).sort((a, b) => a[0] - b[0]),
    alertes: cs.filter(c => c.ariane.surface.advRails > 0).map(c => c.cut), coeurs: cs.filter(c => c.ariane.surface.coeurPN).map(c => c.cut), avecSurface: cs.length };
  /* Liste « À contrôler » des verts (src/verts-a-controler.js) : tenue fixe, calculée avec les marges livrées. */
  const T0 = construireTable(p, LIVRE);
  p.liste = RA.listeAControler({ ...table, zonesPN: T0.zonesPN, zonesADV: T0.zonesADV }).cuts;
  return p;
}

/* Zones d'ADV : même règle que `zoneADV` de src/regles-metier.js (confirmation, extension à `trou`), plus les alertes seules en option. */
function zonesADV(alertes, A) {
  const zs = [], seules = [], vues = [];
  for (const c of alertes) {
    const d = zs.at(-1);
    if (d && c >= d.debut && c - d.fin <= A.trou) { d.fin = Math.max(d.fin, c); vues.push(c); continue; }
    const avant = vues.filter(x => x < c && c - x <= A.ecart && !(d && x <= d.fin));
    if (avant.length + 1 >= A.confirmation) zs.push({ debut: Math.min(c, ...avant), fin: c });
    else seules.push(c);
    vues.push(c);
  }
  return { zs, seules };
}
/* Zones de PN : les zones confirmées, plus (option) chaque cœur isolé qui n'est ni dans une zone ni dans sa marge d'après. */
function zonesPN(p, P) {
  const z = p.pnBrutes.map(x => x.slice());
  if (P.pn.seule) for (const c of p.coeurs) if (!z.some(([a, b]) => c >= a && c <= b + M.DEFAULTS.pn.margeApres)) z.push([c, c]);
  return z.sort((a, b) => a[0] - b[0]);
}
/* Table de zones de la partie pour `selection` : zones de PN (avec `controle`), plages d'ADV (marges comprises, reliées si `gap`). */
function construireTable(p, P) {
  const pn = zonesPN(p, P).map(([a, b]) => ({ debut: a, fin: b, controle: [Math.max(0, a - P.pn.avant), b + P.pn.apres] }));
  /* `adv.ignorePN` ≥ 0 : une alerte d'ADV à `ignorePN` cuts au plus d'une zone de PN (marges de PN comprises) est ignorée : c'est la chaussée du PN
   * (ou son bord) qui a levé l'alerte, pas une aiguille. -1 (livré) : aucune alerte ignorée. */
  const alertes = P.adv.ignorePN >= 0 ? p.alertes.filter(c => !pn.some(z => c >= z.controle[0] - P.adv.ignorePN && c <= z.controle[1] + P.adv.ignorePN)) : p.alertes;
  const { zs, seules } = zonesADV(alertes, P.adv);
  const rg = zs.map(z => [Math.max(0, z.debut - P.adv.avant), z.fin + P.adv.apres]);
  if (P.adv.seule) for (const c of seules) rg.push([Math.max(0, c - P.adv.avant), c + P.adv.apres]);
  rg.sort((a, b) => a[0] - b[0]);
  const adv = []; for (const r of rg) { const d = adv.at(-1); if (d && r[0] <= d[1] + 1 + P.adv.gap) d[1] = Math.max(d[1], r[1]); else adv.push(r.slice()); }
  return { lot: p.table.lot || [], cuts: p.table.cuts || [], zonesADV: adv, zonesPN: pn };
}

/* ------------------------------------------------------------------ évaluation d'un jeu de marges */
/* Les verts listés avec `marge` cuts de part et d'autre (ils prennent le type « liste » s'ils ne sont dans aucune autre zone). */
function listeElargie(liste, marge) {
  if (!(marge > 0)) return liste;
  const s = new Set(); for (const c of liste) for (let i = Math.max(0, c - marge); i <= c + marge; i++) s.add(i);
  return [...s];
}
/* Grosses corrections de Mic (plus de 10 mm, avec référence) hors de la sélection, et cuts à relire. */
function selectionDe(p, P) { const T = construireTable(p, P); return { T, S: RA.selection(T, { liste: listeElargie(p.liste, P.liste.marge), cfg: P.abords }) }; }
function evaluer(p, P) {
  const { S } = selectionDe(p, P);
  const grosses = p.micCuts.filter(c => c.mic > 10), hors = grosses.filter(c => !S.type.has(c.cut)).map(c => c.cut);
  const verts = RA.TYPES.reduce((a, k) => a + S.verts[k], 0);
  return { grosses: grosses.length, hors, nhors: hors.length, cuts: verts + S.revisites, verts, revisites: S.revisites, compte: S.compte };
}
/* Les mêmes mesures avec la table telle que l'avait rendue l'extraction (plafond de 8 zones de la mémoire compris) : la colonne « tables de RM-4 ». */
function evaluerTable(p) {
  const S = RA.selection(p.table, { liste: RA.listeAControler(p.table).cuts });
  const grosses = p.micCuts.filter(c => c.mic > 10), hors = grosses.filter(c => !S.type.has(c.cut)).map(c => c.cut);
  return { nhors: hors.length, hors, cuts: RA.TYPES.reduce((a, k) => a + S.verts[k], 0) + S.revisites };
}

/* ------------------------------------------------------------------ ajustement et validation croisée */
function Etude(parties) {
  const memo = new Map(), ref = new Map();
  const ev = (p, P) => { const k = p.designation + '|' + JSON.stringify(P); let r = memo.get(k); if (!r) { r = evaluer(p, P); memo.set(k, r); } return r; };
  const avant = p => { let r = ref.get(p.designation); if (!r) { r = ev(p, LIVRE); ref.set(p.designation, r); } return r; };
  return { parties, ev, avant };
}
function critere(E, train, P, prix, plafond) {
  let h = 0, c = 0, exces = 0;
  for (const p of train) { const r = E.ev(p, P), b = E.avant(p); h += r.nhors; c += r.cuts; exces += Math.max(0, r.cuts / Math.max(1, b.cuts) - plafond); }
  return h + c / prix + 1000 * exces;
}
function combinaisons(dom) { let out = [{}]; for (const k of Object.keys(dom)) { const n = []; for (const o of out) for (const v of dom[k]) n.push({ ...o, [k]: v }); out = n; } return out; }
const COMBI = Object.fromEntries(GROUPES.map(g => [g, combinaisons(DOMAINES[g])]));
/* Le groupe `pnadv` (alertes d'ADV ignorées près d'un PN) n'est choisi que si on le demande (`pnIgnore`) : l'essai l'a écarté (fiche § 6). */
/* `fixes` : marges tenues à une valeur imposée (par exemple le chaînage lu dans les notes de Mic), que la recherche ne touche pas. */
function ajuster(E, train, { prix = 200, plafond = 1.75, tours = 2, pnIgnore = false, fixes = {} } = {}) {
  let P = avec(parDefaut(), fixes);
  for (let t = 0; t < tours; t++) for (const g of GROUPES.filter(g => pnIgnore || g !== 'pnadv')) {
    let meilleur = null, bj = Infinity;
    for (const c of COMBI[g].filter(c => Object.entries(fixes).every(([k, v]) => !(k in c) || c[k] === v))) { const Q = avec(P, c), j = critere(E, train, Q, prix, plafond); if (j < bj - 1e-9) { bj = j; meilleur = Q; } }
    P = meilleur;
  }
  return P;
}
function totaux(E, ps, P) {
  const o = { grosses: 0, horsAvant: 0, hors: 0, cutsAvant: 0, cuts: 0, pireRapport: 0 };
  for (const p of ps) { const r = E.ev(p, P), b = E.avant(p); o.grosses += r.grosses; o.horsAvant += b.nhors; o.hors += r.nhors; o.cutsAvant += b.cuts; o.cuts += r.cuts; o.pireRapport = Math.max(o.pireRapport, r.cuts / Math.max(1, b.cuts)); }
  o.rapport = o.cutsAvant ? o.cuts / o.cutsAvant : null;
  return o;
}
const ligne = (E, p, P) => { const r = E.ev(p, P), b = E.avant(p); return { partie: p.designation, grosses: r.grosses, horsAvant: b.nhors, hors: r.nhors, horsCuts: r.hors, cutsAvant: b.cuts, cuts: r.cuts, vertsAvant: b.verts, verts: r.verts, rapport: b.cuts ? r2(r.cuts / b.cuts) : null }; };

function etudier(parties, { prix = 200, plafond = 1.75, pnIgnore = false, fixes = {} } = {}) {
  const ps = parties.map(x => preparer(x)), E = Etude(ps);
  const P = ajuster(E, ps, { prix, plafond, pnIgnore, fixes });
  const parPartie = ps.map(p => ({ ...ligne(E, p, P), horsTables: evaluerTable(p).nhors, cutsTables: evaluerTable(p).cuts, zones: { pn: p.pnBrutes.length, adv: zonesADV(p.alertes, LIVRE.adv).zs.length, coeursSeuls: p.coeurs.filter(c => !p.pnBrutes.some(([a, b]) => c >= a && c <= b + M.DEFAULTS.pn.margeApres)).length } }));
  const croisee = ps.map(k => { const Pk = ajuster(E, ps.filter(p => p !== k), { prix, plafond, pnIgnore, fixes }); return { ...ligne(E, k, Pk), marges: Pk }; });
  const somme = ls => ({ grosses: ls.reduce((a, l) => a + l.grosses, 0), horsAvant: ls.reduce((a, l) => a + l.horsAvant, 0), hors: ls.reduce((a, l) => a + l.hors, 0),
    cutsAvant: ls.reduce((a, l) => a + l.cutsAvant, 0), cuts: ls.reduce((a, l) => a + l.cuts, 0), pireRapport: Math.max(...ls.map(l => l.rapport || 0)) });
  /* Un seul réglage à la fois, à partir des marges proposées : où va chaque marge, et ce qu'elle coûte. */
  const unAUn = CLES.map(k => ({ cle: k, propose: lire(P, k), livre: lire(LIVRE, k), valeurs: DOMAINES[GROUPES.find(g => k in DOMAINES[g])][k].map(v => { const t = totaux(E, ps, avec(P, { [k]: v })); return { valeur: v, hors: t.hors, cuts: t.cuts }; }) }));
  const retraits = CLES.filter(k => lire(P, k) !== lire(LIVRE, k)).map(k => { const t = totaux(E, ps, avec(P, { [k]: lire(LIVRE, k) })); return { cle: k, propose: lire(P, k), livre: lire(LIVRE, k), hors: t.hors, cuts: t.cuts }; });
  const parGroupe = GROUPES.map(g => { const Q = clone(LIVRE); for (const k of Object.keys(DOMAINES[g])) poser(Q, k, lire(P, k)); const t = totaux(E, ps, Q); return { groupe: g, hors: t.hors, cuts: t.cuts }; });
  const plafonds = [1.25, 1.5, 1.75, 1.9].map(pl => { const Q = ajuster(E, ps, { prix, plafond: pl, pnIgnore, fixes }), t = totaux(E, ps, Q); return { plafond: pl, hors: t.hors, cuts: t.cuts, rapport: r2(t.rapport), pire: r2(t.pireRapport), marges: Q }; });
  const t = totaux(E, ps, P);
  return { format: FORMAT_ETUDE, parties: ps.map(p => p.designation), prix, plafond, pnIgnore, fixes, marges: P, livre: LIVRE, total: { ...t, horsTables: parPartie.reduce((a, l) => a + l.horsTables, 0), cutsTables: parPartie.reduce((a, l) => a + l.cutsTables, 0) },
    parPartie, croisee, totalCroisee: somme(croisee), unAUn, retraits, parGroupe, plafonds,
    restent: parPartie.filter(l => l.hors).map(l => ({ partie: l.partie, cuts: l.horsCuts })) };
}

/* ------------------------------------------------------------------ proposition (fichier à part) et jugement */
function proposer(o, { date }) {
  const P = o.marges;
  return { format: FORMAT_PROPOSITION, date, etat: 'proposées, non figées',
    regle: 'Choisies sur les parties d\'apprentissage seulement (D-195, datasets/manifeste-parties.json). Les témoins ne règlent rien : ils se lisent une fois, marges figées.',
    fiche: 'fiches/RM2_MARGES.md', outil: 'tools/marges-zones.cjs',
    procedure: { prix: o.prix, plafond: o.plafond, alertesIgnoreesAutourDuPNChoisies: !!o.pnIgnore, margesImposees: o.fixes || {}, parties: o.parties, note: 'prix : cuts de plus acceptés par grosse correction rattrapée ; plafond : rapport maximal des cuts à relire après/avant sur une partie' },
    livre: { pn: { margeAvant: LIVRE.pn.avant, margeApres: LIVRE.pn.apres }, adv: { margeAvant: LIVRE.adv.avant, margeApres: LIVRE.adv.apres, trouCuts: LIVRE.adv.trou, ignorerAlertesAutourDuPN: LIVRE.adv.ignorePN }, liste: { margeCuts: LIVRE.liste.marge }, abords: { ...LIVRE.abords } },
    marges: { pn: { margeAvant: P.pn.avant, margeApres: P.pn.apres, noyauSeul: P.pn.seule },
      adv: { margeAvant: P.adv.avant, margeApres: P.adv.apres, alerteSeule: P.adv.seule, trouCuts: P.adv.trou, relierSiEcartDeCuts: P.adv.gap, ignorerAlertesAutourDuPN: P.adv.ignorePN },
      liste: { margeCuts: P.liste.marge },
      abords: { grappeMin: P.abords.grappeMin, trouCuts: P.abords.trouCuts, margeGrappe: P.abords.margeGrappe, margeIsole: P.abords.margeIsole, margeDiffere: P.abords.margeDiffere } },
    mesure: { grossesCorrectionsHorsSelectionAvant: o.total.horsAvant, grossesCorrectionsHorsSelectionApres: o.total.hors, cutsARelireAvant: o.total.cutsAvant, cutsARelireApres: o.total.cuts,
      horsSelectionValidationCroisee: o.totalCroisee.hors },
    ombre: 'Rien n\'est branché : ni src/regles-metier.js, ni datasets/reglages-figes.json, ni tools/relecture-autonome.cjs ne lisent ce fichier.' };
}
function margesDeProposition(prop) {
  if (!prop || prop.format !== FORMAT_PROPOSITION) throw Error(`proposition : format ${FORMAT_PROPOSITION} attendu`);
  const m = prop.marges, P = parDefaut();
  P.pn = { avant: m.pn.margeAvant, apres: m.pn.margeApres, seule: !!m.pn.noyauSeul };
  P.adv = { ...P.adv, avant: m.adv.margeAvant, apres: m.adv.margeApres, seule: !!m.adv.alerteSeule, trou: m.adv.trouCuts, gap: m.adv.relierSiEcartDeCuts, ignorePN: m.adv.ignorerAlertesAutourDuPN };
  P.liste = { marge: m.liste.margeCuts };
  P.abords = { ...P.abords, ...m.abords };
  for (const k of CLES) if (!(lire(P, k) >= lire(LIVRE, k)) && typeof lire(P, k) !== 'boolean') throw Error(`proposition : ${k} plus petit que le livré`);
  return P;
}
function juger(parties, P) {
  const ps = parties.map(x => preparer(x)), E = Etude(ps);
  const l = ps.map(p => ligne(E, p, P));
  return { format: FORMAT_ETUDE + '-jugement', marges: P, parties: l, total: { ...totaux(E, ps, P) } };
}

/* ------------------------------------------------------------------ zones notées par Mic */
const FORMAT_NOTES = 'ariane-notes-zones-de-mic-v1', NOTES = path.join(__dirname, '..', 'datasets', 'marges-zones-notes-de-mic.json');
/* Pour chaque zone que Mic a notée (début et fin, marges de Mic comprises) : les cuts de la zone qui sont dans la sélection (livré et proposé), et les
 * plages d'ADV ou de PN qui la recouvrent (début et fin, avec l'écart au début et à la fin de Mic : négatif = la zone commence avant / finit avant). */
function zonesDeMic(parties, P, notes) {
  if (!notes || notes.format !== FORMAT_NOTES) throw Error(`notes : format ${FORMAT_NOTES} attendu`);
  const out = [];
  for (const x of parties) {
    const p = preparer(x), cuts = (p.table.cuts || []).map(c => c.i).filter(Number.isInteger);
    const av = selectionDe(p, LIVRE), ap = selectionDe(p, P);
    for (const z of notes.zones.filter(z => z.partie === x.designation)) {
      const dans = cuts.filter(c => c >= z.debut && c <= z.fin);
      const plages = T => (z.genre === 'PN' ? T.zonesPN.map(q => q.controle) : T.zonesADV).filter(([a, b]) => b >= z.debut && a <= z.fin);
      const decrit = T => plages(T).map(([a, b]) => ({ debut: a, fin: b, ecartDebut: a - z.debut, ecartFin: b - z.fin }));
      out.push({ partie: x.designation, genre: z.genre, debut: z.debut, fin: z.fin, aiguilles: z.aiguilles || [], cuts: dans.length,
        couvertsAvant: dans.filter(c => av.S.type.has(c)).length, couvertsApres: dans.filter(c => ap.S.type.has(c)).length, plagesAvant: decrit(av.T), plagesApres: decrit(ap.T) });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ texte */
const pc = (a, b) => b ? `${(100 * a / b).toFixed(1).replace('.', ',')} %` : '—';
function texte(o) {
  const L = [];
  if (o.format === FORMAT_ETUDE) {
    L.push(`Marges de zone (prix ${o.prix} cuts par grosse correction, plafond ×${o.plafond})`, `Parties : ${o.parties.join(', ')}`, '');
    L.push('Marges proposées (livré entre parenthèses) :');
    for (const k of CLES) L.push(`  ${k} = ${lire(o.marges, k)} (${lire(o.livre, k)})`);
    L.push('', 'partie | grosses | hors (tables RM-4) | hors avant | hors après | cuts avant | cuts après | rapport | validation croisée : hors, cuts, rapport');
    o.parPartie.forEach((l, i) => { const c = o.croisee[i]; L.push(`${l.partie} | ${l.grosses} | ${l.horsTables} | ${l.horsAvant} | ${l.hors} | ${l.cutsAvant} | ${l.cuts} | ×${l.rapport} | ${c.hors}, ${c.cuts}, ×${c.rapport}`); });
    const t = o.total, c = o.totalCroisee;
    L.push(`total | ${t.grosses} | ${t.horsTables} | ${t.horsAvant} | ${t.hors} | ${t.cutsAvant} | ${t.cuts} | ×${r2(t.rapport)} (pire partie ×${r2(t.pireRapport)}) | ${c.hors}, ${c.cuts}, ×${r2(c.cuts / c.cutsAvant)} (pire ×${r2(c.pireRapport)})`);
    L.push('', 'Restent hors sélection :', ...o.restent.map(r => `  ${r.partie} : ${r.cuts.join(', ')}`));
  } else {
    L.push('Jugement de marges figées (aucun réglage)', 'partie | grosses | hors avant | hors après | cuts avant | cuts après | rapport');
    for (const l of o.parties) L.push(`${l.partie} | ${l.grosses} | ${l.horsAvant} | ${l.hors} | ${l.cutsAvant} | ${l.cuts} | ×${l.rapport}`);
    const t = o.total; L.push(`total | ${t.grosses} | ${t.horsAvant} | ${t.hors} | ${t.cutsAvant} | ${t.cuts} | ×${r2(t.rapport)}`);
  }
  return L.join('\n');
}

const plage = l => l.length ? l.map(q => `${q.debut}-${q.fin} (${q.ecartDebut >= 0 ? '+' : ''}${q.ecartDebut} / ${q.ecartFin >= 0 ? '+' : ''}${q.ecartFin})`).join(', ') : 'aucune';
function texteNotes(zs) {
  const L = ['Zones notées par Mic : cuts couverts par la sélection (livré > proposé) et plages recouvrantes, début et fin (écart au début / à la fin de Mic)'];
  for (const z of zs) L.push(`${z.partie} ${z.genre} ${z.debut}-${z.fin}${z.aiguilles.length ? ' (aiguilles ' + z.aiguilles.join(', ') + ')' : ''} | ${z.cuts} cuts | couverts ${z.couvertsAvant} > ${z.couvertsApres} | livré : ${plage(z.plagesAvant)} | proposé : ${plage(z.plagesApres)}`);
  return L.join('\n');
}

/* ------------------------------------------------------------------ essai synthétique */
/* Une partie inventée de 300 cuts, sans lot : un PN (cuts 50–56) et un cœur seul (cut 90), deux alertes d'ADV (150, 151) et une alerte seule
 * (250). Les grosses corrections de Mic tombent à 3 cuts avant le PN, à 40 cuts avant l'ADV, à 1 cut du cœur seul et à 8 cuts avant l'alerte
 * seule. Rien n'est lu sur le disque. */
function casSynthetiques() {
  const cas = [], cuts = [], grosses = new Set([47, 110, 91, 242]);
  for (let c = 0; c < 300; c++) {
    const pn = c >= 50 && c <= 56 || c === 90, adv = c === 150 || c === 151 || c === 250, mic = grosses.has(c) ? 15 : 0;
    const surface = { flushPct: pn ? 80 : 0, quadMin: pn ? 70 : 0, sidePoints: 900, coeurPN: pn, advRails: adv ? 1 : 0 };
    cas.push({ format: RA.FORMAT, projet: 9, partie: 1, cut: c, mic: { ref: 'validation', rails: { left: [0, 0, mic], right: [0, 0, mic] } }, ariane: { etat: 'calcule', surface } });
    cuts.push({ i: c, classe: 'hors-journal', mm: mic, dureeS: 2, visites: 1, bords: { left: [c, 0.7175, 0], right: [c, -0.7175, 0] } });
  }
  return { cas, table: { format: 'ariane-verts-table-v1', projet: 9, partie: 1, lot: [], zonesPN: [], zonesADV: [], cuts }, grosses: [...grosses] };
}
function essai() { const s = casSynthetiques(); return { designation: '9:1', cas: s.cas, table: s.table, grosses: s.grosses }; }

module.exports = { FORMAT_NOTES, NOTES, zonesDeMic, selectionDe, FORMAT_PROPOSITION, FORMAT_ETUDE, LIVRE, DOMAINES, GROUPES, CLES, lire, poser, avec, parDefaut, preparer, zonesADV, zonesPN, construireTable, evaluer, evaluerTable,
  Etude, critere, ajuster, totaux, etudier, proposer, margesDeProposition, juger, texte, essai };

/* ------------------------------------------------------------------ ligne de commande */
const lireJsonl = f => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
function args(argv) {
  const o = { mode: argv[0], parties: [], prix: 200, plafond: 1.75 };
  const courante = () => { if (!o.parties.length) throw Error('--partie d\'abord'); return o.parties.at(-1); };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw Error('valeur manquante après ' + k); return v; };
    if (k === '--partie') { const [p, n] = val().split(':').map(Number); if (!Number.isInteger(p) || !Number.isInteger(n)) throw Error('--partie PROJET:PARTIE'); o.parties.push({ projet: p, partie: n, designation: `${p}:${n}` }); }
    else if (k === '--cas') courante().cas = val(); else if (k === '--table') courante().table = val();
    else if (k === '--prix') o.prix = Number(val()); else if (k === '--plafond') o.plafond = Number(val());
    else if (k === '--json') o.json = val(); else if (k === '--notes') o.notes = val(); else if (k === '--proposition') o.proposition = val(); else if (k === '--date') o.date = val();
    else if (k === '--juger-partie-reservee') o.jugerReservee = true; else if (k === '--avec-pn-ignore') o.pnIgnore = true;
    else if (k === '--fixer') { const [c, v] = val().split('='); if (!CLES.includes(c)) throw Error('--fixer : clé inconnue ' + c); (o.fixes = o.fixes || {})[c] = JSON.parse(v); }
    else throw Error('argument inconnu : ' + k);
  }
  return o;
}
function chargerParties(a, outil) {
  const m = Manifeste.lire();
  const { avis } = Manifeste.controler(m, a.parties.map(p => ({ projet: p.projet, partie: p.partie })), { outil, jugerReservee: !!a.jugerReservee });
  if (avis) console.error(avis);
  if (!a.jugerReservee && a.parties.some(p => Manifeste.estTemoin(m, p.projet, p.partie))) throw Error('un témoin ne règle rien : il se juge avec `juger --juger-partie-reservee`');
  return a.parties.map(p => {
    if (!p.cas || !p.table) throw Error(`partie ${p.designation} : --cas et --table attendus`);
    const cas = lireJsonl(p.cas), table = JSON.parse(fs.readFileSync(p.table, 'utf8'));
    if (cas.some(c => c.format !== RA.FORMAT || c.partie !== p.partie)) throw Error(`${p.cas} : cas d'une autre partie ou d'un autre format`);
    if (table.partie !== p.partie) throw Error(`${p.table} : table d'une autre partie`);
    return { designation: p.designation, cas, table };
  });
}
if (require.main === module) {
  try {
    const a = args(process.argv.slice(2));
    if (a.mode === 'etudier') {
      if (!a.parties.length) throw Error('etudier --partie P:N --cas CAS.jsonl --table TABLE.json [--partie …] [--prix N] [--plafond X] [--json S.json] [--proposition F.json --date AAAA-MM-JJ]');
      const o = etudier(chargerParties(a, 'marges-zones'), { prix: a.prix, plafond: a.plafond, pnIgnore: a.pnIgnore, fixes: a.fixes || {} });
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(o, null, 1));
      if (a.proposition) fs.writeFileSync(a.proposition, JSON.stringify(proposer(o, { date: a.date || new Date().toISOString().slice(0, 10) }), null, 2) + '\n');
      console.log(texte(o));
    } else if (a.mode === 'juger') {
      if (!a.proposition) throw Error('juger --proposition F.json --partie P:N --cas … --table … --juger-partie-reservee');
      const o = juger(chargerParties(a, 'marges-zones (jugement)'), margesDeProposition(JSON.parse(fs.readFileSync(a.proposition, 'utf8'))));
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(o, null, 1));
      console.log(texte(o));
    } else if (a.mode === 'notes') {
      if (!a.proposition) throw Error('notes --proposition F.json --partie P:N --cas … --table … [--notes N.json] [--json S.json]');
      const z = zonesDeMic(chargerParties(a, 'marges-zones (notes de Mic)'), margesDeProposition(JSON.parse(fs.readFileSync(a.proposition, 'utf8'))), JSON.parse(fs.readFileSync(a.notes || NOTES, 'utf8')));
      if (a.json) fs.writeFileSync(a.json, JSON.stringify(z, null, 1));
      console.log(texteNotes(z));
    } else if (a.mode === 'essai') {
      const s = essai(), o = etudier([s, { ...s, designation: '9:2' }], { prix: 200, plafond: 1.75 });
      console.log(texte(o));
    } else throw Error('mode : etudier | juger | notes | essai');
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
