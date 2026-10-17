'use strict';
/* 5.0 (D-170, chantier P7) — RELECTURE AUTONOME, OPTION « GRAINE D'ÉCARTEMENT SUR POSE FICTIVE » (tools/relecture-autonome.cjs,
 * src/graine-ecartement-fictive.js, fiches/P7_GRAINE_ECARTEMENT_FICTIVE.md). L'option est COUPÉE par défaut : sans elle, l'extraction et
 * l'étude rendent ce qu'elles rendaient. Avec elle :
 *  - l'extraction ajoute `chaineGraine` aux cuts que la chaîne diffère et dont la pose de départ est fictive (jamais un appui) ;
 *  - l'étude prend cette pose pour la variante en chaîne d'un cut DIFFÉRÉ PAR LE LOT, et la grille de la règle prudente gagne un choix :
 *    agir sur un différé SEULEMENT s'il vient de la graine (`differes: 'graine'`), décidé en validation croisée comme le reste.
 * Données synthétiques, plus le cut de corpus des essais de la décision. Aucune coordonnée en sortie. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const T = require('../tools/relecture-autonome.cjs');
const L = require('../src/lot-decision.js'), O = require('../src/continuity-observer.js'), Shadow = require('../src/gcv1-shadow.js');
const { K, base } = require('./fixtures.cjs');
const SIDES = ['left', 'right'];
const v = (lat, z) => ({ left: [0, lat, z], right: [0, lat, z] });

/* ------------------------------------------------------------------ données synthétiques */
const rails = (pose, conf = 80) => Object.fromEntries(SIDES.map(s => [s, { statut: 'candidate', confiance: conf, pose: pose ? pose[s] : null, hauteurMm: 0 }]));
function cas({ cut, mic, pose = null, stage = 'first-pass', graine = undefined, fictive = false }) {
  const ch = { stage: pose ? stage : 'deferred', ecartementPoseMm: 1437, rails: rails(pose) };
  const a = { etat: 'calcule', stage: pose ? stage : 'deferred', ecartementDepartMm: fictive ? 1500 : 1437, ecartementPoseMm: 1437, rails: rails(pose), chaine: ch,
    surface: { flushPct: 0, quadMin: 0, sidePoints: 900, coeurPN: false, advRails: 0 } };
  if (graine !== undefined) a.chaineGraine = graine === null ? { post: 'graine', stage: 'deferred', reason: 'aucune-paire', pose: false, essais: [], rails: rails(null) }
    : { post: 'graine', stage: 'graine-ecartement', reason: null, pose: true, ecartementPoseMm: 1436, essais: [{ depuis: 'left', garde: 'ok' }], rails: rails(graine) };
  return { format: T.FORMAT, projet: 9, partie: 1, cut, mic: { ref: 'validation', rails: mic }, ariane: a };
}
/* Une partie : verts justes 100–130, un lot de trois différés en grappe (110–112), pose de départ fictive, que Mic déplace de 200 mm ; la
 * chaîne les diffère, la graine les pose à 1 mm de Mic. Le cut 113 est un différé que la chaîne pose seule (jamais touché, même avec l'option). */
function partie() {
  const c = [], cuts = [];
  for (let i = 100; i <= 130; i++) {
    const differe = i >= 110 && i <= 113;
    if (i === 113) c.push(cas({ cut: i, mic: v(120, 0), pose: v(121, 0), stage: 'window' }));
    else if (differe) c.push(cas({ cut: i, mic: v(200, 0), graine: v(199, 1), fictive: true }));
    else c.push(cas({ cut: i, mic: v(0, 0), pose: v(0, 1) }));
    cuts.push({ i, classe: differe ? 'differee' : 'hors-journal', mm: differe ? 200 : 0, dureeS: 2, visites: 1, bords: { left: [i, 0.7175, 0], right: [i, -0.7175, 0] } });
  }
  return { cas: c, table: { format: 'ariane-verts-table-v1', projet: 9, partie: 1, lot: [110, 111, 112, 113].map(cut => ({ cut, differe: true })), zonesPN: [], zonesADV: [], cuts } };
}

test('option coupée : la graine est ignorée, les différés restent des abstentions', () => {
  const { cas: c, table } = partie(), r = T.lignes({ cas: c, table, designation: '9:1' });
  for (const cut of [110, 111, 112]) { const l = r.lignes.find(x => x.cut === cut); assert.equal(l.genre, 'differe'); assert.equal(l.var['chaine+h'].d, null); }
});

test('option active : la variante en chaîne d\'un différé du lot prend la pose de la graine, marquée ; jamais un vert, jamais la pose seule', () => {
  const p = partie(), r = T.lignes({ cas: p.cas, table: p.table, designation: '9:1', graine: true });
  const l = r.lignes.find(x => x.cut === 110);
  assert.equal(l.var['chaine+h'].post, 'graine'); assert.equal(l.var['chaine'].post, 'graine');
  assert.ok(l.var['chaine+h'].d > 190); assert.ok(l.var['chaine+h'].e < 2);
  assert.equal(l.var['seul+h'].d, null, 'la pose seule n\'est pas reprise');
  assert.equal(l.grappe, true, 'grappe de différés repérée');
  /* Un vert qui porterait une graine (aucun vert n'a de pose fictive dans les données) : ignorée. */
  const vert = cas({ cut: 120, mic: v(0, 0), graine: v(50, 0), fictive: true });
  assert.equal(T.lignes({ cas: [vert], table: p.table, designation: '9:1', graine: true }).lignes[0].var['chaine+h'].d, null);
  /* Graine tentée sans pose : abstention. */
  const sans = cas({ cut: 111, mic: v(200, 0), graine: null, fictive: true });
  assert.equal(T.lignes({ cas: [sans], table: p.table, designation: '9:1', graine: true }).lignes[0].var['chaine+h'].d, null);
});

test('règle : un différé n\'est touché que par la graine, et alors sans les seuils des verts ; jamais avec differes:false', () => {
  const p = partie(), r = T.lignes({ cas: p.cas, table: p.table, designation: '9:1', graine: true });
  const R = { variante: 'chaine+h', X: 8, Y: 0, D: 45, C: 100, G: 15, stages: ['first-pass'], differes: 'graine', poses: false };
  const graine = r.lignes.find(x => x.cut === 110), chaineSeule = r.lignes.find(x => x.cut === 113);
  assert.equal(T.agit(graine, R), true, 'graine : agit malgré D 45 mm et l\'étape graine-ecartement');
  assert.equal(T.agit(graine, { ...R, differes: false }), false);
  assert.equal(T.agit(chaineSeule, R), false, 'différé posé par la chaîne seule : jamais (ce serait une autre hypothèse)');
  const vert = r.lignes.find(x => x.cut === 105);
  assert.equal(T.agit(vert, R), T.agit(vert, { ...R, differes: false }), 'les verts ne dépendent pas du choix sur les différés');
});

test('règle de service (sobre) : les différés posés par la graine, qui ne dépendent pas du seuil X, ne comptent pas dans les 90 % gardés', () => {
  const ligneV = (cut, pire) => ({ partie: '9:1', cut, zone: 'abords', genre: 'vert', ref: true, etat: 'calcule', mic: 12, conf: 80,
    var: { 'chaine+h': { stage: 'first-pass', post: null, d: pire, e: 1, pire, latMax: 5, coh: 0, dg: 1 } } });
  const ligneD = cut => ({ partie: '9:1', cut, zone: 'adv', genre: 'differe', ref: true, etat: 'calcule', mic: 200, conf: 80,
    var: { 'chaine+h': { stage: 'graine-ecartement', post: 'graine', d: 200, e: 2, pire: 200, latMax: 200, coh: 0, dg: 1 } } });
  const verts = [...[1, 2, 3, 4, 5].map(c => ligneV(c, 9)), ...[6, 7, 8, 9, 10].map(c => ligneV(c, 20))];
  const ls = [...verts, ...Array.from({ length: 50 }, (_, i) => ligneD(100 + i))];
  const R = { variante: 'chaine+h', X: 8, Y: 0, D: 45, C: 100, G: 15, stages: null, differes: 'graine', poses: false };
  assert.equal(T.bilan(ls, R).corrigesJustes, 60);
  assert.equal(T.sobre(R, ls).X, 8, 'seuil des verts inchangé par les graines');
  assert.equal(T.sobre({ ...R, differes: false }, ls).X, 8, 'sans l\'option : les différés n\'agissent pas, rien ne change');
});

test('grille : le choix sur les différés n\'existe qu\'avec l\'option', () => {
  assert.deepEqual(T.grilleDe().differes, [false]);
  assert.deepEqual(T.grilleDe({ graine: true }).differes, [false, 'graine']);
  assert.equal(T.grilleDe(), T.GRILLE, 'sans option : la grille livrée, inchangée');
});

test('étude en validation croisée : sans option, chiffres inchangés ; avec option, les trois différés posés par la graine comptent, aucun dégât', () => {
  const p1 = partie(), p2 = partie();
  const parties = () => [{ designation: '9:1', ...p1 }, { designation: '9:2', ...p2 }];
  const g = { variante: ['chaine+h'], X: [8], Y: [0], G: [15], D: [45], C: [100], stages: [null], differes: [false], poses: [false] };
  const sans = T.etudier(parties(), { grille: g }), avec = T.etudier(parties(), { grille: g, graine: true });
  assert.equal(sans.totalCroisee.corrigesJustes, 0);
  assert.equal(avec.totalCroisee.corrigesJustes, 6, 'trois différés posés par partie');
  assert.equal(avec.totalCroisee.mauvaiseVoie, 0); assert.equal(avec.totalCroisee.degats, 0);
  for (const c of avec.croisee) assert.equal(c.regle.differes, 'graine');
  assert.equal(avec.parTypeCroiseeSobre.abords.corrigesJustes, 6, 'par type de zone, tous genres');
  assert.equal(avec.grappeCroiseeSobre.corrigesJustes, 6);
  assert.equal(avec.central[0].chaine.corrigesJustes, 4, 'sans règle : les trois graines et le différé posé par la chaîne');
  assert.equal(sans.central[0].chaine.corrigesJustes, 1);
  assert.equal(avec.graine, true); assert.equal(sans.graine, false);
  assert.match(T.texte(avec), /Par partie et type de zone/);
  assert.ok(!/positionSceneRelative|"bords"/.test(JSON.stringify(avec)));
  /* Sans option, les cas qui portent une graine rendent la même étude que des cas qui n'en portent pas. */
  const nus = () => [p1, p2].map((p, i) => ({ designation: `9:${i + 1}`, table: p.table, cas: p.cas.map(c => { const a = { ...c.ariane }; delete a.chaineGraine; return { ...c, ariane: a }; }) }));
  assert.equal(JSON.stringify(T.etudier(nus(), { grille: g })), JSON.stringify(sans));
});

test('greffe : la graine n\'est reportée sur un cas ancien que si la chaîne nouvelle rend la même décision', () => {
  const anciens = [cas({ cut: 1, mic: v(200, 0), fictive: true }), cas({ cut: 2, mic: v(200, 0), fictive: true }), cas({ cut: 3, mic: v(200, 0), fictive: true }), cas({ cut: 4, mic: v(0, 0), pose: v(0, 1) })];
  const nouveaux = [cas({ cut: 1, mic: v(200, 0), graine: v(199, 0), fictive: true }), cas({ cut: 2, mic: v(200, 0), pose: v(30, 0), stage: 'window', graine: v(199, 0), fictive: true }), cas({ cut: 4, mic: v(0, 0), pose: v(0, 1) })];
  const g = T.greffeCas(anciens, nouveaux, { differe: new Set([1, 2, 3]), champ: 'chaineGraine' });
  assert.ok(g.cas[0].ariane.chaineGraine, 'cut 1 : même chaîne, graine greffée');
  assert.equal(g.cas[1].ariane.chaineGraine, undefined, 'cut 2 : chaîne différente, rien');
  assert.equal(g.cas[2].ariane.chaineGraine, undefined, 'cut 3 : absent de la nouvelle extraction');
  assert.deepEqual(g.bilan, { cuts: 4, visees: 3, greffes: 1, chaineDifferente: 1, absents: 1, chainesComparees: 3, chainesIdentiques: 2 });
  assert.equal(anciens[0].ariane.chaineGraine, undefined, 'les cas anciens ne sont pas modifiés');
});

test('réglages proposés : l\'exception « graine » est écrite et relue ; sans elle, la règle prudente (jamais un différé)', () => {
  const R = { variante: 'chaine+h', X: 8, Y: 0, D: 45, C: 100, G: 15, stages: null, differes: 'graine', poses: false };
  const g = { zones: { pn: { corriger: true, seuilMm: 8, confianceMin: 0 } }, voie: { lateralMaxMm: 45 }, coherence: { diffLateraleMaxMm: 100, ecartementMaxMm: 15 }, jamais: ['cut différé par le lot', 'cut posé par le lot'] };
  assert.equal(T.regleDuReglage(g).regle.differes, false);
  assert.equal(T.regleDuReglage({ ...g, exceptionDifferes: T.EXCEPTION_GRAINE }).regle.differes, 'graine');
  assert.match(T.EXCEPTION_GRAINE, /^graine-ecartement-fictive/);
  assert.ok(R);
});

/* ------------------------------------------------------------------ extraction : le vrai moteur, la vraie décision */
const capture = r => ({ identity: { part: 23, cut: 105, frameId: null }, rails: r, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.pointsSceneRelative.map(() => true) });
const science0 = Shadow.scientificProposeBoth(capture(base.rails));
const truth = Object.fromEntries(SIDES.map(side => { const r = base.rails[side], P = r.profileLocalToSceneRelative, d = science0.rails[side].next.delta;
  const w = K.C.point(P, d), o = K.C.point(P, [0, 0, 0]); return [side, O.translated(r, w.map((x, i) => x - o[i]))]; }));
const pos = r => Object.fromEntries(SIDES.map(s => [s, r[s].positionSceneRelative.slice()]));
/* Pose de départ : rail gauche décalé de `aMm` le long de la direction gauche → droite, rail droit à `gMm` du gauche dans cette direction. */
function depart(aMm, gMm) {
  const pl = truth.left.positionSceneRelative, pr = truth.right.positionSceneRelative, u = [0, 1, 2].map(i => pr[i] - pl[i]), n = Math.hypot(...u), uu = u.map(x => x / n);
  const L0 = O.translated(truth.left, uu.map(x => x * aMm / 1000)), cible = [0, 1, 2].map(i => L0.positionSceneRelative[i] + uu[i] * gMm / 1000);
  return { left: L0, right: O.translated(truth.right, [0, 1, 2].map(i => cible[i] - pr[i])) };
}
const entree = r => ({ identity: { part: 23, cut: 105, frameId: null }, rails: r, points: base.pointsSceneRelative, visible: base.pointsSceneRelative.map(() => true) });
const voisins = () => [103, 104, 106].map(cut => ({ cut, positions: pos(truth), differe: false }));

test('extraction (poseAriane) : pose fictive, un rail trouvé, la chaîne diffère ; avec l\'option, la graine pose la voie vraie, jamais appui', () => {
  const r0 = depart(-120, 1500);
  const sans = T.poseAriane(entree(r0), { appuis: { liste: [] } });
  assert.equal(sans.chaine.stage, 'deferred'); assert.equal(sans.chaineGraine, undefined);
  assert.equal(sans.ecartementDepartMm, 1500);
  const appuis = { liste: [] }, avec = T.poseAriane(entree(r0), { appuis, graine: { actif: true, poses: voisins(), gPartie: 1435 } });
  assert.equal(avec.chaine.stage, 'deferred', 'la chaîne elle-même est inchangée');
  const cg = avec.chaineGraine;
  assert.equal(cg.post, 'graine'); assert.equal(cg.pose, true); assert.equal(cg.stage, 'graine-ecartement');
  assert.equal(cg.reference.source, 'voisins'); assert.deepEqual(cg.trouves, ['right']);
  /* La voie vraie est à 120 mm de la pose de départ du rail gauche. */
  assert.ok(Math.abs(Math.abs(cg.rails.left.pose[1]) - 120) < 10, `rail gauche posé à ~120 mm en travers : ${cg.rails.left.pose[1]}`);
  assert.ok(Math.abs(cg.ecartementPoseMm - 1436) < 5, String(cg.ecartementPoseMm));
  for (const s of SIDES) assert.equal(cg.rails[s].hauteurMm, 0, 'pas de hauteur apprise sur une graine (étage hors de son domaine)');
  assert.deepEqual(appuis.liste, [], 'la graine ne devient pas un appui de la chaîne');
  assert.ok(!/positionSceneRelative/.test(JSON.stringify(avec)), 'décalages seulement, aucune coordonnée');
});

test('extraction : pose de départ dans le contrat (1 437 mm), même scène : aucune graine (garde « pose fictive »)', () => {
  const r0 = depart(-120, 1437);
  const avec = T.poseAriane(entree(r0), { appuis: { liste: [] }, graine: { actif: true, poses: voisins(), gPartie: 1435 } });
  assert.equal(avec.chaineGraine, undefined);
  assert.ok(L.DEFAULTS);
});
