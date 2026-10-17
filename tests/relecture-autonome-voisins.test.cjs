'use strict';
/* 5.0 (D-170, chantier P7) — RELECTURE AUTONOME, OPTION « VOISINS SÛRS POUR LES DIFFÉRÉS » (tools/relecture-autonome.cjs,
 * src/voisins-surs-differes.js, fiches/P7_VOISINS_SURS_DIFFERES.md). L'option est COUPÉE par défaut : sans elle, l'extraction et l'étude
 * rendent exactement ce qu'elles rendaient. Avec elle :
 *  - l'extraction ajoute `chaineVoisins` aux seuls cuts différés par le lot que la chaîne diffère (la reprise n'est jamais un appui) ;
 *  - l'étude prend cette pose pour la variante en chaîne d'un cut différé par le lot, et la grille de la règle prudente gagne un choix :
 *    agir sur un différé SEULEMENT s'il vient de la reprise (`differes: 'voisins'`), décidé en validation croisée comme le reste.
 * Données synthétiques, plus le cut de corpus des essais de la décision. Aucune coordonnée en sortie. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const T = require('../tools/relecture-autonome.cjs');
const L = require('../src/lot-decision.js'), O = require('../src/continuity-observer.js'), Shadow = require('../src/gcv1-shadow.js');
const { K, base } = require('./fixtures.cjs');
const SIDES = ['left', 'right'];
const v = (lat, z) => ({ left: [0, lat, z], right: [0, lat, z] });

/* ------------------------------------------------------------------ données synthétiques */
const rails = (pose, conf = 80) => Object.fromEntries(SIDES.map(s => [s, { statut: 'candidate', confiance: conf, pose: pose ? pose[s] : null, hauteurMm: 0 }]));
function cas({ cut, mic, pose = null, stage = 'first-pass', voisins = undefined }) {
  const ch = { stage: pose ? stage : 'deferred', ecartementPoseMm: 1437, rails: rails(pose) };
  const a = { etat: 'calcule', stage: pose ? stage : 'deferred', ecartementDepartMm: 1437, ecartementPoseMm: 1437, rails: rails(pose), chaine: ch,
    surface: { flushPct: 0, quadMin: 0, sidePoints: 900, coeurPN: false, advRails: 0 } };
  if (voisins !== undefined) a.chaineVoisins = voisins === null ? { post: 'voisins-surs', stage: 'deferred', reason: 'trop-peu-de-voisins', voisins: 1, gardes: [], pose: false, rails: rails(null) }
    : { post: 'voisins-surs', stage: 'window', voisins: 4, gardes: [1, 2, 3], pose: true, ecartementPoseMm: 1437, rails: rails(voisins) };
  return { format: T.FORMAT, projet: 9, partie: 1, cut, mic: { ref: 'validation', rails: mic }, ariane: a };
}
/* Une partie : verts justes 100–130, un lot de trois différés en grappe (110–112) que Mic déplace de 120 mm ; la chaîne les diffère, la
 * reprise des voisins sûrs les pose à 1 mm de Mic. Le cut 113 est un différé que la chaîne pose seule (jamais touché, même avec l'option). */
function partie() {
  const c = [], cuts = [];
  for (let i = 100; i <= 130; i++) {
    const differe = i >= 110 && i <= 113;
    if (i === 113) c.push(cas({ cut: i, mic: v(120, 0), pose: v(121, 0), stage: 'window' }));
    else if (differe) c.push(cas({ cut: i, mic: v(120, 0), voisins: v(119, 1) }));
    else c.push(cas({ cut: i, mic: v(0, 0), pose: v(0, 1) }));
    cuts.push({ i, classe: differe ? 'differee' : 'hors-journal', mm: differe ? 120 : 0, dureeS: 2, visites: 1, bords: { left: [i, 0.7175, 0], right: [i, -0.7175, 0] } });
  }
  return { cas: c, table: { format: 'ariane-verts-table-v1', projet: 9, partie: 1, lot: [110, 111, 112, 113].map(cut => ({ cut, differe: true })), zonesPN: [], zonesADV: [], cuts } };
}

test('option coupée : la reprise est ignorée, les différés restent des abstentions', () => {
  const { cas: c, table } = partie(), r = T.lignes({ cas: c, table, designation: '9:1' });
  for (const cut of [110, 111, 112]) { const l = r.lignes.find(x => x.cut === cut); assert.equal(l.genre, 'differe'); assert.equal(l.var['chaine+h'].d, null); }
});

test('option active : la variante en chaîne d\'un différé du lot prend la pose reprise, marquée ; jamais un vert, jamais la pose seule', () => {
  const p = partie(), r = T.lignes({ cas: p.cas, table: p.table, designation: '9:1', voisinsSurs: true });
  const l = r.lignes.find(x => x.cut === 110);
  assert.equal(l.var['chaine+h'].post, 'voisins-surs'); assert.equal(l.var['chaine'].post, 'voisins-surs');
  assert.ok(l.var['chaine+h'].d > 100); assert.ok(l.var['chaine+h'].e < 2);
  assert.equal(l.var['seul+h'].d, null, 'la pose seule n\'est pas reprise');
  assert.equal(l.grappe, true, 'grappe de différés repérée');
  /* Un vert qui porterait une reprise (impossible à l'extraction) : ignorée. */
  const vert = cas({ cut: 120, mic: v(0, 0), voisins: v(50, 0) }); vert.ariane.chaine = { stage: 'deferred', rails: rails(null) };
  const r2 = T.lignes({ cas: [vert], table: p.table, designation: '9:1', voisinsSurs: true });
  assert.equal(r2.lignes[0].var['chaine+h'].d, null);
  /* Reprise tentée sans pose : abstention. */
  const sans = cas({ cut: 111, mic: v(120, 0), voisins: null });
  assert.equal(T.lignes({ cas: [sans], table: p.table, designation: '9:1', voisinsSurs: true }).lignes[0].var['chaine+h'].d, null);
});

test('règle : un différé n\'est touché que par la reprise, et alors sans les seuils des verts ; jamais avec differes:false', () => {
  const p = partie(), r = T.lignes({ cas: p.cas, table: p.table, designation: '9:1', voisinsSurs: true });
  const R = { variante: 'chaine+h', X: 8, Y: 0, D: 45, C: 100, G: 15, stages: ['first-pass'], differes: 'voisins', poses: false };
  const repris = r.lignes.find(x => x.cut === 110), chaineSeule = r.lignes.find(x => x.cut === 113);
  assert.equal(T.agit(repris, R), true, 'reprise : agit malgré D 45 mm et l\'étape window');
  assert.equal(T.agit(repris, { ...R, differes: false }), false);
  assert.equal(T.agit(chaineSeule, R), false, 'différé posé par la chaîne seule : jamais (ce serait une autre hypothèse)');
  const vert = r.lignes.find(x => x.cut === 105);
  assert.equal(T.agit(vert, R), T.agit(vert, { ...R, differes: false }), 'les verts ne dépendent pas du choix sur les différés');
});

test('règle de service (sobre) : les différés repris, qui ne dépendent pas du seuil X, ne comptent pas dans les 90 % gardés', () => {
  /* Verts : 5 corrections justes à 9 mm (perdues dès X = 10) et 5 à 20 mm ; 50 différés repris justes. Si les reprises comptaient, le
   * seuil monterait à 20 mm (55 justes ≥ 90 % de 60) et la règle perdrait la moitié des corrections des verts sans rien gagner. */
  const ligneV = (cut, pire) => ({ partie: '9:1', cut, zone: 'abords', genre: 'vert', ref: true, etat: 'calcule', mic: 12, conf: 80,
    var: { 'chaine+h': { stage: 'first-pass', post: null, d: pire, e: 1, pire, latMax: 5, coh: 0, dg: 1 } } });
  const ligneD = cut => ({ partie: '9:1', cut, zone: 'adv', genre: 'differe', ref: true, etat: 'calcule', mic: 100, conf: 80,
    var: { 'chaine+h': { stage: 'window', post: 'voisins-surs', d: 100, e: 2, pire: 100, latMax: 100, coh: 0, dg: 1 } } });
  const verts = [...[1, 2, 3, 4, 5].map(c => ligneV(c, 9)), ...[6, 7, 8, 9, 10].map(c => ligneV(c, 20))];
  const ls = [...verts, ...Array.from({ length: 50 }, (_, i) => ligneD(100 + i))];
  const R = { variante: 'chaine+h', X: 8, Y: 0, D: 45, C: 100, G: 15, stages: null, differes: 'voisins', poses: false };
  assert.equal(T.bilan(ls, R).corrigesJustes, 60);
  assert.equal(T.sobre(R, ls).X, 8, 'seuil des verts inchangé par les reprises');
  assert.equal(T.sobre({ ...R, differes: false }, verts).X, 8, 'même seuil que sans l\'option');
  assert.equal(T.sobre({ ...R, differes: false }, ls).X, 8, 'sans l\'option : les différés n\'agissent pas, rien ne change');
});

test('grille : le choix sur les différés n\'existe qu\'avec l\'option', () => {
  assert.deepEqual(T.grilleDe().differes, [false]);
  assert.deepEqual(T.grilleDe({ voisinsSurs: true }).differes, [false, 'voisins']);
  assert.equal(T.grilleDe(), T.GRILLE, 'sans option : la grille livrée, inchangée');
});

test('étude en validation croisée : sans option, chiffres inchangés ; avec option, les trois différés repris comptent, aucun dégât', () => {
  const p1 = partie(), p2 = partie();
  const parties = () => [{ designation: '9:1', ...p1 }, { designation: '9:2', ...p2 }];
  const g = { variante: ['chaine+h'], X: [8], Y: [0], G: [15], D: [45], C: [100], stages: [null], differes: [false], poses: [false] };
  const sans = T.etudier(parties(), { grille: g }), avec = T.etudier(parties(), { grille: g, voisinsSurs: true });
  assert.equal(sans.totalCroisee.corrigesJustes, 0);
  assert.equal(avec.totalCroisee.corrigesJustes, 6, 'trois différés repris par partie');
  assert.equal(avec.totalCroisee.mauvaiseVoie, 0); assert.equal(avec.totalCroisee.degats, 0);
  for (const c of avec.croisee) assert.equal(c.regle.differes, 'voisins');
  assert.equal(avec.parTypeCroiseeSobre.abords.corrigesJustes, 6, 'par type de zone, tous genres');
  assert.equal(avec.grappeCroiseeSobre.corrigesJustes, 6);
  assert.equal(avec.central[0].chaine.corrigesJustes, 4, 'sans règle : les trois reprises et le différé posé par la chaîne');
  assert.equal(sans.central[0].chaine.corrigesJustes, 1);
  assert.equal(avec.voisinsSurs, true); assert.equal(sans.voisinsSurs, false);
  assert.match(T.texte(avec), /Par partie et type de zone/);
  assert.ok(!/positionSceneRelative|"bords"/.test(JSON.stringify(avec)));
});

test('greffe : la reprise n\'est reportée sur un cas ancien que si la chaîne nouvelle rend la même décision', () => {
  const anciens = [cas({ cut: 1, mic: v(120, 0) }), cas({ cut: 2, mic: v(120, 0) }), cas({ cut: 3, mic: v(120, 0) }), cas({ cut: 4, mic: v(0, 0), pose: v(0, 1) })];
  const nouveaux = [cas({ cut: 1, mic: v(120, 0), voisins: v(119, 0) }), cas({ cut: 2, mic: v(120, 0), pose: v(30, 0), stage: 'window', voisins: v(119, 0) }), cas({ cut: 4, mic: v(0, 0), pose: v(0, 1) })];
  const differe = new Set([1, 2, 3]);
  const g = T.greffeCas(anciens, nouveaux, { differe, champ: 'chaineVoisins' });
  assert.ok(g.cas[0].ariane.chaineVoisins, 'cut 1 : même chaîne, reprise greffée');
  assert.equal(g.cas[1].ariane.chaineVoisins, undefined, 'cut 2 : chaîne différente, rien');
  assert.equal(g.cas[2].ariane.chaineVoisins, undefined, 'cut 3 : absent de la nouvelle extraction');
  assert.deepEqual(g.bilan, { cuts: 4, visees: 3, greffes: 1, chaineDifferente: 1, absents: 1, chainesComparees: 3, chainesIdentiques: 2 });
  assert.equal(anciens[0].ariane.chaineVoisins, undefined, 'les cas anciens ne sont pas modifiés');
});

/* ------------------------------------------------------------------ extraction : le vrai moteur, la vraie décision */
const capture = r => ({ identity: { part: 23, cut: 105, frameId: null }, rails: r, pointsSceneRelative: base.pointsSceneRelative, visibleByClipBoxes: base.pointsSceneRelative.map(() => true) });
const science0 = Shadow.scientificProposeBoth(capture(base.rails));
const truth = Object.fromEntries(SIDES.map(side => { const r = base.rails[side], P = r.profileLocalToSceneRelative, d = science0.rails[side].next.delta;
  const w = K.C.point(P, d), o = K.C.point(P, [0, 0, 0]); return [side, O.translated(r, w.map((x, i) => x - o[i]))]; }));
function shifted(r0, mm) { return Object.fromEntries(SIDES.map(side => { const r = r0[side], P = r.profileLocalToSceneRelative, o = K.C.point(r.sceneRelativeToProfileLocal, r.positionSceneRelative);
  const a = K.C.point(P, o), b = K.C.point(P, [o[0], o[1] + mm / 1000, o[2]]); return [side, O.translated(r, [b[0] - a[0], b[1] - a[1], b[2] - a[2]])]; })); }
const pos = r => Object.fromEntries(SIDES.map(s => [s, r[s].positionSceneRelative.slice()]));
const entree = () => ({ identity: { part: 23, cut: 105, frameId: null }, rails: shifted(truth, 150), points: base.pointsSceneRelative, visible: base.pointsSceneRelative.map(() => true) });

test('extraction (poseAriane) : sans option, aucune reprise ; avec option, le différé du lot est repris sur la voie des voisins, jamais appui', () => {
  const poses = [103, 104, 106].map(cut => ({ cut, positions: pos(truth), differe: false }));
  const sans = T.poseAriane(entree(), { appuis: { liste: [] } });
  assert.equal(sans.chaine.stage, 'deferred'); assert.equal(sans.chaineVoisins, undefined);
  const vert = T.poseAriane(entree(), { appuis: { liste: [] }, voisins: { actif: true, differe: false, poses } });
  assert.equal(vert.chaineVoisins, undefined, 'un vert n\'est jamais repris');
  const appuis = { liste: [] }, avec = T.poseAriane(entree(), { appuis, voisins: { actif: true, differe: true, poses } });
  assert.equal(avec.chaine.stage, 'deferred', 'la chaîne elle-même est inchangée');
  const cv = avec.chaineVoisins;
  assert.equal(cv.post, 'voisins-surs'); assert.equal(cv.pose, true); assert.deepEqual(cv.gardes, [103, 104, 106]); assert.equal(cv.voisins, 3);
  for (const s of SIDES) assert.ok(Math.abs(Math.abs(cv.rails[s].pose[1]) - 150) < 10, `rail ${s} repris à ~150 mm en travers : ${cv.rails[s].pose[1]}`);
  assert.deepEqual(appuis.liste, [], 'la reprise ne devient pas un appui de la chaîne');
  assert.ok(!/positionSceneRelative/.test(JSON.stringify(avec)), 'décalages seulement, aucune coordonnée');
  /* Deux voisins sûrs seulement (un différé du lot, une pose fictive à 1 500 mm écartés) : tentative consignée, pas de pose. */
  const p2 = pos(truth), dir = [0, 1, 2].map(i => p2.right[i] - p2.left[i]), n = Math.hypot(...dir);
  const fict = { left: p2.left, right: [0, 1, 2].map(i => p2.left[i] + dir[i] / n * 1.5) };
  const peu = T.poseAriane(entree(), { appuis: { liste: [] }, voisins: { actif: true, differe: true, poses: [poses[0], { ...poses[1], differe: true }, { cut: 106, positions: fict, differe: false }, { cut: 107, positions: pos(truth), differe: false }] } });
  assert.equal(peu.chaineVoisins.pose, false); assert.equal(peu.chaineVoisins.voisins, 2); assert.equal(peu.chaineVoisins.reason, 'trop-peu-de-voisins');
  assert.ok(L.DEFAULTS.validatedMinInliers === 3);
});
