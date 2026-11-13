#!/usr/bin/env node
'use strict';
/* CH-122 : apprentissage de la puce en validation croisée « un lot dehors » (hors ligne).
 *   node chantiers/CH-122/outils/apprendre.cjs --rejeu jeu-livre --sortie DOSSIER [--version v1]
 * Pour chaque lot réglable L : modèle (coefficients, λ, seuil) appris sur les 5 autres lots réglables seulement ; examen 0511 : appris sur les 6.
 * λ et seuil : choisis par validation croisée INTERNE (un lot dehors parmi les lots d'apprentissage), coût du banc 100·(>50) + 10·(10–50) + 1·(différé)
 * sur les cuts jugés passés à la GCV2. Écrit un modèle JSON par pli (format lu par `pucePredire` de src/gcv2-l1.js) et le bilan simulé hors pli. */
const fs = require('node:fs'), path = require('node:path');
const P = require('./puce-lib.cjs');
const { LOTS, cle, travail } = require('../../CH-116/outils/lots.cjs');
const REGLABLES = ['0411', '0611', '0811a', '0811b', '1111', '1211'], EXAMEN = '0511';
let TYPE = 'logistique';
const LAMBDAS = [0.3, 1, 3, 10, 30], NARBRES = [60, 150, 300];
const DELTA = { adv: 8, abords: 2, pn: 3 };
const SEUILS = Array.from({ length: 60 }, (_, i) => 0.3 + i * 0.0115); const SEUILS_BAS = [0, ...Array.from({ length: 30 }, (_, i) => 0.02 + i * 0.02)];
const COUT = { plus50: 100, d1050: 10, differe: 1 };
/* Critère du seuil (choisi sur les lots d'apprentissage seulement) : A = le moins de fautes (10·(10–50) + 100·(>50)) à différés au plus ceux du livré ;
 * B = le plus de posés justes à fautes (10–50 et > 50) au plus celles du livré ; cout = coût du banc (100, 10, 1). */
let CRITERE = 'A', DIFF_TOUS = false;
function coutCritere(b, ref) {
  if (CRITERE === 'cout') return b.cout;
  if (CRITERE === 'A') return (b.differes > ref.differes ? 1e6 + b.differes : 0) + 100 * b.plus50 + 10 * b.d1050 - 0.01 * b.juste;
  return (b.plus50 > ref.plus50 || b.d1050 + b.plus50 > ref.d1050 + ref.plus50 ? 1e6 + 100 * b.plus50 + 10 * b.d1050 : 0) - b.juste;
}

function args(a) { const o = { version: 'v1' }; for (let i = 0; i < a.length; i++) { const k = a[i], v = () => a[++i];
  if (k === '--rejeu') o.rejeu = v(); else if (k === '--sortie') o.sortie = v(); else if (k === '--version') o.version = v(); else if (k === '--corpus') o.corpus = v(); else if (k === '--critere') o.critere = v(); else if (k === '--type') o.type = v(); else if (k === '--prof') o.prof = Number(v()); else if (k === '--sans-examen') o.sansExamen = true; else if (k === '--log') o.log = true; else if (k === '--gardes') o.gardes = true; else if (k === '--imbrique') o.imbrique = true; else if (k === '--differes-tous') o.diffTous = true; else if (k === '--relatif') o.relatif = true; else if (k === '--sans-veto') o.sansVeto = true; else if (k === '--oblig') o.oblig = true; else if (k === '--complet') o.complet = true; else throw Error('option ' + k); } return o; }

/* Transformations figées dans le modèle (appliquées aussi par src/gcv2-l1.js) : log1p des distances ; gardes de voie livrées sur les candidats. */
const LOG1P = ['dgRef', 'dgMed', 'dvProche', 'dzProche', 'dvFit', 'vaResidu', 'dvListe', 'dvVoie', 'dvGeo', 'depl', 'latMax', 'vertMax'];
let AVEC_LOG = false, GARDES = null, TI = null, VARIANTES = [{ log: false, gardes: false }];
const GARDES_LIVREES = { voieAbsMm: 100, residuMm: 40, voieMm: 45, procheMaxCuts: 6 };
function appliquerVariante(v) { AVEC_LOG = v.log; GARDES = v.gardes ? GARDES_LIVREES : null; }
const brut = t => AVEC_LOG ? t.map((v, j) => TI.log.has(j) && Number.isFinite(v) ? Math.log1p(Math.abs(v)) : v) : t;
const remplir = (t, moy) => brut(t).map((v, j) => v === null || !Number.isFinite(v) ? moy[j] : v);
/* garde de voie livrée (vetoVoieAbsMm 100, voieIncoherenteMm 40 à rechProcheMaxCuts 6 ; vetoVoieMm 45 sur la voie sûre) : candidat refusé */
const GOBL = { voieAbsMm: 100, residuMm: 40, voieMm: 45, procheMaxCuts: 6 };
let OBLIG = false;
const nouveau = t => !(t[TI.livreValide] === 1 || (TI.chainePose !== undefined && t[TI.chainePose] === 1));
const voieObl = t => t[TI.vaManque] === 0 && t[TI.vaDist] <= GOBL.procheMaxCuts && t[TI.vaResidu] <= GOBL.residuMm && t[TI.dvFit] <= GOBL.voieAbsMm;
const refuseObl = t => OBLIG && nouveau(t) && !voieObl(t);
const refuse = t => refuseObl(t) || (GARDES && ((t[TI.vaManque] === 0 && t[TI.vaDist] <= GARDES.procheMaxCuts && (t[TI.dvFit] > GARDES.voieAbsMm || t[TI.vaResidu] > GARDES.residuMm)) || (t[TI.voieManque] === 0 && t[TI.dvVoie] > GARDES.voieMm)));
function lignes(cuts) { const X = [], y = []; for (const c of cuts) for (const x of c.cands.filter(x => !refuse(x.t))) { X.push(x.t); y.push(x.mm <= 10 ? 1 : 0); } return { X, y }; }
function ajuster(cuts, lambda) {
  if (TYPE === 'arbres') {
    const { X, y } = lignes(cuts), moy = X[0].map((_, j) => { const v = X.map(x => x[j]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
    const w = []; for (const c of cuts) for (let i = 0; i < c.cands.length; i++) w.push(1 / c.cands.length * 10);
    return { ...P.arbres(X.map(x => remplir(x, moy)), y, w, { n: lambda, prof: PROF }), moy };
  }
  const { X, y } = lignes(cuts), moy0 = X[0].map((_, j) => { const v = X.map(x => x[j]).filter(Number.isFinite); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; });
  const Xf = X.map(x => remplir(x, moy0)), N = P.normaliser(Xf), Z = Xf.map(x => P.zst(N, x));
  /* poids : chaque cut pèse autant, quel que soit son nombre de candidats */
  const w = []; for (const c of cuts) for (let i = 0; i < c.cands.length; i++) w.push(1 / c.cands.length * 10);
  const m = P.logistique(Z, y, lambda, w);
  return { moy: N.moy, sd: N.sd, coef: m.coef, intercept: m.intercept };
}
let PROF = 3;
const scorer = (M, t) => M.type === 'arbres' ? P.predireArbres(M, remplir(t, M.moy)) : P.predire(M, P.zst(M, remplir(t, M.moy)));
/* décision simulée d'un cut. Mode absolu : meilleur candidat posé si q ≥ seuil. Mode relatif (`RELATIF`) : la décision de référence (paire retenue par
 * les règles livrées si elles valident, ou pose de la chaîne) est gardée si q ≥ seuil bas (veto sinon) ; un autre candidat la remplace (ou est posé
 * quand la référence ne pose rien) s'il atteint le seuil haut et dépasse la référence. Rend { q, mm, depart, chaine, qRef, mmRef, refPose, alt }. */
let RELATIF = false;
function decision(M, c) {
  let b = null, ref = null; const iL = TI.livreValide, iC = TI.chainePose;
  for (const x of c.cands) { const q = scorer(M, x.t), ok = !refuse(x.t);
    const estRef = c.contexte === 'chaine' ? (iC !== undefined && x.t[iC] === 1) : x.t[iL] === 1;
    if (estRef) ref = { x, q, ok };
    if (ok && (!b || q > b.q)) b = { x, q }; }
  const dep = x => Math.max(...P.SIDES.map(s => Math.max(Math.abs(x.decal[s][1]), Math.abs(x.decal[s][2])))) < (DELTA[c.zone] ?? 2);
  if (!b && !ref) return null;
  const d = { chaine: c.contexte === 'chaine' };
  if (b) Object.assign(d, { q: b.q, mm: b.x.mm, depart: dep(b.x) && !(iC !== undefined && b.x.t[iC] === 1) });
  if (ref) Object.assign(d, { qRef: ref.ok ? ref.q : -1, mmRef: ref.x.mm, refPose: true, altEstRef: b && b.x === ref.x });
  return d;
}
function bilan(decs, seuil, seuilC = seuil, haut = null) { const r = { poses: 0, juste: 0, d1050: 0, plus50: 0, differes: 0 };
  const compter = mm => { r.poses++; if (mm === null) return; if (mm <= 10) r.juste++; else if (mm <= 50) r.d1050++; else r.plus50++; };
  for (const d of decs) {
    if (!d) { r.differes++; continue; }
    const s = d.chaine ? seuilC : seuil;
    if (!RELATIF) { if (d.q !== undefined && !d.depart && d.q >= s) compter(d.mm); else r.differes++; continue; }
    /* relatif : `s` = seuil bas (veto de la référence), `haut` = seuil de remplacement */
    if (d.q !== undefined && !d.depart && !d.altEstRef && d.q >= haut && (!d.refPose || d.q > d.qRef)) compter(d.mm);
    else if (d.refPose && d.qRef >= s) compter(d.mmRef);
    else r.differes++;
  }
  r.cout = COUT.plus50 * r.plus50 + COUT.d1050 * r.d1050 + COUT.differe * r.differes; return r; }
function bilanLivre(cuts) { const r = { poses: 0, juste: 0, d1050: 0, plus50: 0, differes: 0 };
  for (const c of cuts) { if (c.etatLivre === 'pose' && c.mmLivre !== null) { r.poses++; if (c.mmLivre <= 10) r.juste++; else if (c.mmLivre <= 50) r.d1050++; else r.plus50++; } else if (c.etatLivre === 'pose') r.poses++; else r.differes++; }
  r.cout = COUT.plus50 * r.plus50 + COUT.d1050 * r.d1050 + COUT.differe * r.differes; return r; }
/* Apprentissage d'un pli : λ et seuil par validation croisée interne sur les lots d'apprentissage. */
function pli(cutsApp, lotsApp) {
  const juges = cutsApp.filter(c => c.verite && c.cands.length);
  let meilleur = null;
  for (const lambda of (TYPE === 'arbres' ? NARBRES : LAMBDAS)) {
    const oof = [];
    for (const L of lotsApp) { const a = juges.filter(c => c.lot !== L), t = (DIFF_TOUS ? cutsApp : juges).filter(c => c.lot === L); if (!t.length || !a.length) continue;
      const M = ajuster(a, lambda); for (const c of t) oof.push(decision(M, c)); }
    const ref = bilanLivre((DIFF_TOUS ? cutsApp : juges).filter(c => lotsApp.includes(c.lot)));
    const avecChaine = juges.some(c => c.contexte === 'chaine');
    const BAS = RELATIF ? SEUILS_BAS : SEUILS;
    for (const s of BAS) for (const sc of (avecChaine ? BAS : [s])) for (const h of (RELATIF ? SEUILS : [null])) {
      const b = bilan(oof, s, sc, h); b.cout = coutCritere(b, ref); if (!meilleur || b.cout < meilleur.b.cout) meilleur = { lambda, seuil: s, seuilC: sc, haut: h, b }; }
  }
  const M = ajuster(juges, meilleur.lambda);
  return { M, lambda: meilleur.lambda, seuil: meilleur.seuil, seuilC: meilleur.seuilC, haut: meilleur.haut, interne: meilleur.b };
}
function main() {
  const o = args(process.argv.slice(2)), W = travail(); if (o.critere) CRITERE = o.critere; if (o.diffTous) DIFF_TOUS = true; if (o.relatif) RELATIF = true; if (o.sansVeto) SEUILS_BAS.splice(1); if (o.oblig) OBLIG = true; if (o.type) TYPE = o.type; if (o.prof) PROF = o.prof;
  if (o.log || o.gardes) VARIANTES = [{ log: !!o.log, gardes: !!o.gardes }];
  if (o.imbrique) VARIANTES = [{ log: false, gardes: false }, { log: true, gardes: false }, { log: false, gardes: true }, { log: true, gardes: true }];
  const cles = LOTS.map(cle), traits = null;
  const tous = P.jeu(path.join(W, 'rejeux', o.rejeu), o.corpus || process.env.CH116_CORPUS || path.join(W, 'corpus.jsonl'), cles);
  fs.mkdirSync(o.sortie, { recursive: true });
  const T = tous.find(c => c.traits).traits, rapport = [];
  TI = Object.fromEntries(T.map((n, j) => [n, j])); TI.log = new Set(LOG1P.map(n => T.indexOf(n)));
  rapport.push(`# Puce ${o.version} : apprentissage un lot dehors (simulation sur le jeu « ${o.rejeu} », cuts passés à la GCV2)`, '',
    `Cuts au jeu : ${tous.length} ; jugés : ${tous.filter(c => c.verite).length} ; candidats : ${tous.reduce((a, c) => a + c.cands.length, 0)}.`, '',
    '| pli (lot jugé) | λ | seuil | jugés | puce : posés / ≤10 / 10–50 / >50 / différés | livré : posés / ≤10 / 10–50 / >50 / différés | bonne paire présente | différés tous cuts puce / livré |', '|---|---|---|---|---|---|---|---|');
  const TOUS = [...REGLABLES, EXAMEN];
  const plis = o.complet ? [{ dehors: [], app: TOUS, nom: 'complet' }] : [...REGLABLES.map(L => ({ dehors: [L], app: REGLABLES.filter(x => x !== L) })), { dehors: [EXAMEN], app: REGLABLES }];
  const tot = { p: bilan([], 1), l: bilan([], 1) }, totR = { p: bilan([], 1), l: bilan([], 1) };
  for (const f of plis) {
    const app = tous.filter(c => f.app.includes(c.lot)), test = tous.filter(c => f.dehors.includes(c.lot) && c.verite);
    if (o.complet && !test.length) { let rr=null; for (const v of VARIANTES){ appliquerVariante(v); const x=pli(app,f.app); x.variante=v; if(!rr||x.interne.cout<rr.interne.cout) rr=x;} appliquerVariante(rr.variante);
      const M2={format:'ariane-puce-v1',version:o.version,pli:'complet',appris:f.app,traits:T,moy:rr.M.moy,...(AVEC_LOG?{log1p:LOG1P}:{}),...(GARDES?{gardes:GARDES}:{}),...(OBLIG?{gardeObligatoire:GOBL}:{}),...(rr.M.type==='arbres'?{type:'arbres',base:rr.M.base,arbres:rr.M.arbres}:{sd:rr.M.sd,coef:rr.M.coef,intercept:rr.M.intercept}),seuils:{adv:rr.seuil,abords:rr.seuil,pn:rr.seuil,...(tous.some(c=>c.contexte==='chaine')?{chaine:rr.seuilC}:{})},deltaMm:DELTA,lambda:rr.lambda,...(RELATIF?{mode:'relatif',seuilHaut:rr.haut}:{})};
      fs.writeFileSync(path.join(o.sortie,`puce-${o.version}-complet.json`),JSON.stringify(M2)); process.stdout.write('modèle complet écrit : λ '+rr.lambda+' seuil '+rr.seuil.toFixed(3)+(rr.seuilC!==rr.seuil?' chaine '+rr.seuilC.toFixed(3):'')+' '+JSON.stringify(rr.variante)+'\n'); return; }
    let r = null;
    for (const v of VARIANTES) { appliquerVariante(v); const x = pli(app, f.app); x.variante = v;
      if (!r || x.interne.cout < r.interne.cout) r = x; }
    appliquerVariante(r.variante);
    const modele = { format: 'ariane-puce-v1', version: o.version, pli: f.nom || f.dehors[0], appris: f.app, traits: T, moy: r.M.moy, ...(AVEC_LOG ? { log1p: LOG1P } : {}), ...(GARDES ? { gardes: GARDES } : {}), ...(OBLIG ? { gardeObligatoire: GOBL } : {}), ...(r.M.type === 'arbres' ? { type: 'arbres', base: r.M.base, arbres: r.M.arbres } : { sd: r.M.sd, coef: r.M.coef, intercept: r.M.intercept }),
      seuils: { adv: r.seuil, abords: r.seuil, pn: r.seuil, ...(tous.some(c => c.contexte === 'chaine') ? { chaine: r.seuilC } : {}) }, ...(RELATIF ? { mode: 'relatif', seuilHaut: r.haut } : {}), deltaMm: DELTA, lambda: r.lambda };
    fs.writeFileSync(path.join(o.sortie, `puce-${o.version}-${f.nom || f.dehors[0]}.json`), JSON.stringify(modele));
    const toutT = tous.filter(c => f.dehors.includes(c.lot)), dT = bilan(toutT.map(c => decision(r.M, c)), r.seuil, r.seuilC, r.haut).differes, dL = bilanLivre(toutT).differes;
    const bp = bilan(test.map(c => decision(r.M, c)), r.seuil, r.seuilC, r.haut), bl = bilanLivre(test), present = test.filter(c => c.cands.some(x => x.mm <= 10)).length;
    for (const k of ['poses', 'juste', 'd1050', 'plus50', 'differes']) { tot.p[k] += bp[k]; tot.l[k] += bl[k]; if (f.dehors[0] !== EXAMEN) { totR.p[k] += bp[k]; totR.l[k] += bl[k]; } }
    const f5 = b => `${b.poses} / ${b.juste} / ${b.d1050} / ${b.plus50} / ${b.differes}`;
    rapport.push(`| ${f.dehors[0]} | ${r.lambda}${r.variante.log ? ' log' : ''}${r.variante.gardes ? ' gardes' : ''} | ${r.haut !== null && r.haut !== undefined ? r.haut.toFixed(2) + '↑ ' : ''}${r.seuil.toFixed(3)}${r.seuilC !== r.seuil ? ' / ' + r.seuilC.toFixed(3) : ''} | ${test.length} | ${f5(bp)} | ${f5(bl)} | ${present} | ${dT} / ${dL} |`);
  }
  const f5 = b => `${b.poses} / ${b.juste} / ${b.d1050} / ${b.plus50} / ${b.differes}`;
  rapport.push(`| total réglables | | | | ${f5(totR.p)} | ${f5(totR.l)} | |`, `| **total** | | | | ${f5(tot.p)} | ${f5(tot.l)} | |`);
  /* importance : modèle appris sur les 6 lots réglables (celui de l'examen) */
  if (TYPE === 'arbres' || o.sansExamen) { const rr = o.sansExamen ? rapport.filter(l => !l.startsWith('| 0511') && !l.startsWith('| **total')) : rapport; fs.writeFileSync(path.join(o.sortie, `apprentissage-${o.version}.md`), rapport.join('\n') + '\n'); process.stdout.write(rr.join('\n') + '\n'); return; }
  const M = JSON.parse(fs.readFileSync(path.join(o.sortie, `puce-${o.version}-${EXAMEN}.json`), 'utf8'));
  rapport.push('', 'Coefficients du modèle de l\'examen (traits normalisés), par importance :', '', T.map((n, j) => [n, M.coef[j]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([n, c]) => `${n} ${c.toFixed(2)}`).join(' · '));
  fs.writeFileSync(path.join(o.sortie, `apprentissage-${o.version}.md`), rapport.join('\n') + '\n');
  process.stdout.write(rapport.join('\n') + '\n');
}
main();
