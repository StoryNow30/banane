'use strict';
/* 5.0 (D-170, chantier P7) — COMBINAISON DES OPTIONS DE LA RELECTURE AUTONOME (tools/relecture-autonome.cjs ; fiche
 * fiches/P7_COMBINAISON.md). Les trois façons d'admettre un cut DIFFÉRÉ par le lot se combinent en un seul choix de la grille :
 *  - posé par la chaîne avec au moins `appuisMin` appuis (src/differes-en-chaine.js), jugé sans les limites D et G des verts ;
 *  - repris par les voisins sûrs (src/voisins-surs-differes.js), sans les seuils des verts ;
 *  - posé par la graine d'écartement sur pose fictive (src/graine-ecartement-fictive.js), sans les seuils des verts.
 * Quand les deux post-traitements posent, la reprise des voisins passe d'abord (ordre du banc du catalogue) ; une règle qui n'admet que la
 * graine lit alors la pose de la graine. Toutes les options restent COUPÉES par défaut. Données synthétiques ; aucune coordonnée en sortie. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const T = require('../tools/relecture-autonome.cjs');
const DC = require('../src/differes-en-chaine.js');
const SIDES = ['left', 'right'];
const v = (lat, z) => ({ left: [0, lat, z], right: [0, lat, z] });
const rails = (pose, conf = 80) => Object.fromEntries(SIDES.map(s => [s, { statut: 'candidate', confiance: conf, pose: pose ? pose[s] : null, hauteurMm: 0 }]));

/* Un cas : `chaine` = { pose, stage, appuis } (absent : la chaîne diffère) ; `voisins`, `graine` : pose du post-traitement. */
function cas({ cut, mic, chaine = null, voisins = null, graine = null, fictive = false }) {
  const g = fictive ? 1500 : 1437;
  const ch = chaine ? { stage: chaine.stage || 'window', appuis: chaine.appuis ?? 1, ecartementPoseMm: 1437, rails: rails(chaine.pose) } : { stage: 'deferred', appuis: 0, ecartementPoseMm: null, rails: rails(null) };
  const a = { etat: 'calcule', stage: ch.stage, ecartementDepartMm: g, ecartementPoseMm: 1437, rails: rails(chaine ? chaine.pose : null), chaine: ch,
    surface: { flushPct: 0, quadMin: 0, sidePoints: 900, coeurPN: false, advRails: 0 } };
  if (voisins) a.chaineVoisins = { post: 'voisins-surs', stage: 'window', appuis: 0, voisins: 4, gardes: [1, 2, 3], pose: true, ecartementPoseMm: 1437, rails: rails(voisins) };
  if (graine) a.chaineGraine = { post: 'graine', stage: 'graine-ecartement', appuis: 0, pose: true, ecartementPoseMm: 1437, rails: rails(graine) };
  return { format: T.FORMAT, projet: 9, partie: 1, cut, mic: { ref: 'validation', rails: mic }, ariane: a };
}
/* Une partie : verts justes 100–140 ; différés du lot 110–114, que Mic déplace de 150 mm :
 *  110 posé par la chaîne (fenêtre, 1 appui) ; 111 repris par les voisins ; 112 posé par la graine (pose de départ fictive) ;
 *  113 repris par les voisins ET posé par la graine ; 114 posé par la chaîne sans appui (jamais admis). */
const DIFFERES = [110, 111, 112, 113, 114];
function partie() {
  const c = [], cuts = [];
  for (let i = 100; i <= 140; i++) {
    const mic = DIFFERES.includes(i) ? v(150, 0) : v(0, 0);
    if (i === 110) c.push(cas({ cut: i, mic, chaine: { pose: v(151, 0), appuis: 1 } }));
    else if (i === 111) c.push(cas({ cut: i, mic, voisins: v(149, 1) }));
    else if (i === 112) c.push(cas({ cut: i, mic, graine: v(150, 1), fictive: true }));
    else if (i === 113) c.push(cas({ cut: i, mic, voisins: v(149, 0), graine: v(151, 0), fictive: true }));
    else if (i === 114) c.push(cas({ cut: i, mic, chaine: { pose: v(150, 0), stage: 'first-pass', appuis: 0 } }));
    else c.push(cas({ cut: i, mic, chaine: { pose: v(0, 1), stage: 'first-pass', appuis: 2 } }));
    cuts.push({ i, classe: DIFFERES.includes(i) ? 'differee' : 'hors-journal', mm: DIFFERES.includes(i) ? 150 : 0, dureeS: 2, visites: 1, bords: { left: [i, 0.7175, 0], right: [i, -0.7175, 0] } });
  }
  return { cas: c, table: { format: 'ariane-verts-table-v1', projet: 9, partie: 1, lot: DIFFERES.map(cut => ({ cut, differe: true })), zonesPN: [], zonesADV: [], cuts } };
}
const R0 = { variante: 'chaine+h', X: 8, Y: 0, D: 45, C: 100, G: 15, stages: null, poses: false };
const agissent = (ls, R) => ls.filter(l => T.agit(l, R)).map(l => l.cut).filter(c => DIFFERES.includes(c));

test('valeur combinée : les trois façons d\'admettre un différé, réglages des différés en chaîne validés', () => {
  const d = T.combiDifferes({ chaine: true, appuisMin: 2, voisins: true, graine: true });
  assert.deepEqual(d, { combi: true, chaine: DC.reglages({ actif: true, appuisMin: 2 }), voisins: true, graine: true });
  assert.deepEqual(T.combiDifferes({ voisins: true, graine: true }), { combi: true, chaine: null, voisins: true, graine: true });
});

test('règle combinée : chaîne avec appui, reprise des voisins et graine admises ; chaîne sans appui jamais ; une seule façon : son seul effet', () => {
  const p = partie(), ls = T.lignes({ cas: p.cas, table: p.table, designation: '9:1', voisinsSurs: true, graine: true }).lignes;
  const l113 = ls.find(l => l.cut === 113);
  assert.equal(l113.var['chaine+h'].post, 'voisins-surs', 'les deux posent : la reprise des voisins d\'abord');
  const tout = { ...R0, differes: T.combiDifferes({ chaine: true, appuisMin: 1, voisins: true, graine: true }) };
  assert.deepEqual(agissent(ls, tout), [110, 111, 112, 113]);
  assert.deepEqual(agissent(ls, { ...R0, differes: T.combiDifferes({ chaine: true, appuisMin: 2, voisins: true, graine: true }) }), [111, 112, 113], '2 appuis exigés : 110 refusé');
  assert.deepEqual(agissent(ls, { ...R0, differes: T.combiDifferes({ graine: true }) }), [112, 113], 'graine seule : 113 lit la pose de la graine');
  assert.ok(T.varDe(l113, { ...R0, differes: T.combiDifferes({ graine: true }) }).post === 'graine');
  assert.deepEqual(agissent(ls, { ...R0, differes: 'voisins' }), [111, 113]);
  assert.deepEqual(agissent(ls, { ...R0, differes: DC.reglages({ actif: true, appuisMin: 1 }) }), [110]);
  assert.deepEqual(agissent(ls, { ...R0, differes: false }), []);
  /* Les verts ne dépendent pas du choix sur les différés. */
  const verts = ls.filter(l => l.genre === 'vert');
  assert.deepEqual(verts.map(l => T.agit(l, tout)), verts.map(l => T.agit(l, { ...R0, differes: false })));
});

test('grille : un seul choix combiné (1 ou 2 appuis) dès que deux façons sont demandées ; une seule : la grille de son option', () => {
  const c = T.grilleDe({ chaine: true, voisinsSurs: true, graine: true });
  assert.deepEqual(c.differes, [false, T.combiDifferes({ chaine: true, appuisMin: 1, voisins: true, graine: true }), T.combiDifferes({ chaine: true, appuisMin: 2, voisins: true, graine: true })]);
  assert.deepEqual(T.grilleDe({ voisinsSurs: true, graine: true }).differes, [false, T.combiDifferes({ voisins: true, graine: true })]);
  assert.equal(T.grilleDe({ voisinsSurs: true }), T.GRILLE_VOISINS);
  assert.deepEqual(T.grilleDe({ chaine: true }).differes, T.grilleDifferesEnChaine().differes);
  const g4 = T.grilleDe({ chaine: true, voisinsSurs: true, graine: true, gardePaire: true });
  assert.equal(g4.gardePaire.length, 7); assert.equal(g4.differes.length, 3);
  assert.equal(T.grilleDe(), T.GRILLE);
});

test('règle de service (sobre) : avec la valeur combinée, les différés ne comptent pas dans les 90 % gardés', () => {
  const ligneV = (cut, pire) => ({ partie: '9:1', cut, zone: 'abords', genre: 'vert', ref: true, etat: 'calcule', mic: 12, conf: 80,
    var: { 'chaine+h': { stage: 'first-pass', d: pire, e: 1, pire, latMax: 5, coh: 0, dg: 1 } } });
  const ligneD = cut => ({ partie: '9:1', cut, zone: 'adv', genre: 'differe', ref: true, etat: 'calcule', mic: 100, conf: 80,
    var: { 'chaine+h': { stage: 'window', appuis: 1, d: 100, e: 2, pire: 100, latMax: 100, coh: 0, dg: 1 } } });
  const ls = [...[1, 2, 3, 4, 5].map(c => ligneV(c, 9)), ...[6, 7, 8, 9, 10].map(c => ligneV(c, 20)), ...Array.from({ length: 50 }, (_, i) => ligneD(100 + i))];
  const R = { ...R0, differes: T.combiDifferes({ chaine: true, appuisMin: 1, voisins: true, graine: true }) };
  assert.equal(T.bilan(ls, R).corrigesJustes, 60);
  assert.equal(T.sobre(R, ls).X, 8, 'seuil des verts inchangé par les différés admis');
  assert.equal(T.sobre({ ...R, differes: DC.reglages({ actif: true, appuisMin: 1 }) }, ls).X, 20, 'H1 seule (outil de sa branche) : le seuil monte, comme mesuré');
});

test('étude : sans option, rien ne change ; combinée, les quatre différés admis comptent dans chaque pli ; mode léger : même validation croisée', () => {
  const p1 = partie(), p2 = partie();
  const parties = () => [{ designation: '9:1', ...p1 }, { designation: '9:2', ...p2 }];
  const g = { variante: ['chaine+h'], X: [8], Y: [0], G: [15], D: [45], C: [100], stages: [null], differes: [false], poses: [false] };
  const sans = T.etudier(parties(), { grille: g });
  const gc = { ...g, differes: T.grilleDe({ chaine: true, voisinsSurs: true, graine: true }).differes };
  const avec = T.etudier(parties(), { grille: gc, voisinsSurs: true, graine: true });
  assert.equal(sans.totalCroisee.corrigesJustes, 0);
  assert.equal(avec.totalCroisee.corrigesJustes, 8, 'quatre différés admis par partie');
  assert.equal(avec.totalCroisee.degats, 0); assert.equal(avec.totalCroisee.mauvaiseVoie, 0);
  for (const c of avec.croisee) assert.equal(c.regle.differes.combi, true);
  assert.deepEqual(avec.croisee.map(c => c.regle.differes.chaine.appuisMin), [1, 1], '2 appuis perdraient le cut 110 : chaque pli retient 1 appui');
  assert.match(T.texte(avec), /différés : chaîne \(1 appui au moins, sans limites D et G\), voisins sûrs, graine/);
  const leger = T.etudier(parties(), { grille: gc, voisinsSurs: true, graine: true, leger: true });
  assert.equal(JSON.stringify(leger.croisee), JSON.stringify(avec.croisee));
  assert.equal(leger.croiseeLettre, null); assert.equal(leger.figeType, null); assert.equal(leger.leger, true);
  assert.ok(T.texte(leger).length > 0);
  assert.equal(JSON.stringify(T.etudier(parties(), { grille: g, leger: false })), JSON.stringify(sans), 'léger coupé : sortie inchangée');
});

test('réglages proposés : le bloc des différés combinés est écrit et relu ; un lecteur qui l\'ignore garde « jamais un différé »', () => {
  const p1 = partie(), p2 = partie();
  const g = { variante: ['chaine+h'], X: [8], Y: [0], G: [15], D: [45], C: [100], stages: [null], poses: [false], differes: T.grilleDe({ chaine: true, voisinsSurs: true, graine: true }).differes };
  const o = T.etudier([{ designation: '9:1', ...p1 }, { designation: '9:2', ...p2 }], { grille: g, voisinsSurs: true, graine: true });
  const r = T.reglagesProposes(o, { date: '2026-10-17' });
  assert.deepEqual(r.jamais, ['cut différé par le lot', 'cut posé par le lot']);
  assert.equal(r.differesCombines.actif, true); assert.equal(r.differesCombines.voisins, true); assert.equal(r.differesCombines.graine, true);
  assert.equal(r.differesCombines.chaine.appuisMin, 1);
  assert.deepEqual(T.regleDuReglage(r).regle.differes, T.combiDifferes({ chaine: true, appuisMin: 1, voisins: true, graine: true }));
  assert.equal(T.regleDuReglage({ ...r, differesCombines: { ...r.differesCombines, actif: false } }).regle.differes, false);
});

test('greffe à la lettre combinée : la règle de service de chaque pli plus les trois façons, sans rien apprendre', () => {
  const p1 = partie(), p2 = partie(), parties = [{ designation: '9:1', ...p1 }, { designation: '9:2', ...p2 }];
  const g = { variante: ['chaine+h'], X: [8], Y: [0], G: [15], D: [45], C: [100], stages: [null], differes: [false], poses: [false] };
  const ref = T.etudier(parties, { grille: g });
  const d = T.combiDifferes({ chaine: true, appuisMin: 1, voisins: true, graine: true });
  const gr = T.greffer(parties, ref, { differes: d });
  assert.equal(gr.totalCroiseeSobre.corrigesJustes, 8); assert.deepEqual(gr.differes, d);
  const h1 = T.greffer(parties, ref);
  assert.equal(h1.totalCroiseeSobre.corrigesJustes, 2, 'sans autre réglage : H1 seule, comme dans sa branche');
  assert.deepEqual(h1.differesEnChaine, DC.reglages({ actif: true, appuisMin: 1 }));
});
