'use strict';
/* tools/bruit-reference.cjs sur données SYNTHÉTIQUES (tests/helpers/jointure-synthetique.cjs, parties 97 et 98, cuts et
 * coordonnées inventés, poses en mètres, repère profil confondu avec la scène : longitudinal x, latéral y, vertical z).
 * Les bruits injectés sont connus : l'outil doit les retrouver, et ne rien inventer là où il n'y en a pas.
 *  - plancher du pixel (formules) ;
 *  - validations multiples : même visite, deux visites, deux sessions, validation identique ;
 *  - revues : aucune action, validation sans mouvement, validation avec mouvement, rupture de continuité ;
 *  - départ contre référence d'un jeu « débutant » ;
 *  - cohérence entre voisins : bruit latéral injecté retrouvé, vertical nul, géométrie lisse (courbe) absorbée ;
 *  - sensibilité des seuils ; statistiques (Wilson, bootstrap reproductible) ; ligne de commande et reprise. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const B = require('../tools/bruit-reference.cjs');
const S = require('./helpers/jointure-synthetique.cjs');

const proche = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (tolérance ${tol})`);
const m = (minutes, secondes = 0) => ({ minutes, secondes });
const G0 = [100, 200, 10], D0 = [101.435, 200, 10];
const mmSur = (pos, dy = 0, dz = 0) => S.decaler(pos, 0, dy / 1000, dz / 1000);

function dossierAvec(exports) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bruit-ref-'));
  exports.forEach((doc, i) => S.ecrire(d, `ariane-echo-2031-06-01T1${i}-00-00-seg01.json`, doc));
  return d;
}
function analyser(exports, options = {}) {
  const d = dossierAvec(exports);
  try { return B.analyserJeu('essai', [d], options); } finally { fs.rmSync(d, { recursive: true, force: true }); }
}
const exportEcho = (session, debut, records, stamp) => S.exportEcho({ session, debutSession: debut, stamp: stamp || '2031-06-01T10-00-00', records });
const visite = o => S.visite({ partie: 97, derniere: o.validation, ...o });

/* Partie 97 : quatre cuts validés plusieurs fois, deux sessions.
 *  7001 : deux visites de la session A ; la seconde valide 3 mm en latéral et −2 mm en vertical sur le rail droit ;
 *  7002 : deux validations dans la MÊME visite (humanFinalReferences), à 6 mm l'une de l'autre en vertical (rail gauche) ;
 *  7003 : validé une seule fois ; revu en session B sans action ;
 *  7004 : validé en session A puis en session B, à l'identique. */
function fixtureValidations() {
  const g = (k) => S.decaler(G0, k), d = (k) => S.decaler(D0, k);
  const sessA = [
    visite({ session: 'A', index: 0, cut: 7001, debut: m(1), fin: m(1, 20), initiale: [g(1), d(1)], validation: [g(1), d(1)] }),
    visite({ session: 'A', index: 1, cut: 7002, debut: m(2), fin: m(2, 30), initiale: [g(2), d(2)], validation: [g(2), d(2)] }),
    visite({ session: 'A', index: 2, cut: 7003, debut: m(3), fin: m(3, 10), initiale: [g(3), d(3)], validation: [g(3), mmSur(d(3), 1, 0)] }),
    visite({ session: 'A', index: 3, cut: 7004, debut: m(4), fin: m(4, 10), initiale: [g(4), d(4)], validation: [mmSur(g(4), 2, 0), d(4)] }),
    visite({ session: 'A', index: 4, cut: 7001, debut: m(5), fin: m(5, 20), initiale: [g(1), d(1)], validation: [g(1), mmSur(d(1), 3, -2)] }),
  ];
  /* 7002 : seconde validation de la même visite, 6 mm plus bas que la première. */
  sessA[1].humanFinalReferences = [
    { status: 'candidate-observed', state: S.etat(7002, [mmSur(g(2), 0, 6), d(2)], 97), observedAt: S.horodatage(2, 10), decisionKey: 'Shift+Space' },
    { status: 'candidate-observed', state: sessA[1].humanFinalReference.state, observedAt: S.horodatage(2, 20), decisionKey: 'Shift+Space' },
  ];
  const sessB = [
    visite({ session: 'B', index: 0, cut: 7003, debut: m(30), fin: m(30, 10), initiale: [g(3), mmSur(d(3), 1, 0)] }),
    visite({ session: 'B', index: 1, cut: 7004, debut: m(31), fin: m(31, 10), initiale: [mmSur(g(4), 2, 0), d(4)], validation: [mmSur(g(4), 2, 0), d(4)] }),
    /* 7001 revu en B : la pose de départ n'est PAS celle où la session A l'a laissé (rupture de continuité). */
    visite({ session: 'B', index: 2, cut: 7001, debut: m(32), fin: m(32, 10), initiale: [g(1), mmSur(d(1), 3, -2)], validation: [g(1), mmSur(d(1), 3, -2)] }),
  ];
  return [exportEcho('A', m(0), sessA, '2031-06-01T10-00-00'), exportEcho('B', m(29), sessB, '2031-06-01T11-00-00')];
}

test('plancher du pixel : formules de la quantification uniforme', () => {
  const p = B.plancherPixel(0.38);
  proche(p.ecartTypeParAxeMm, 0.38 / Math.sqrt(12), 0.001);
  proche(p.erreurMaxParAxeMm, 0.19, 0.001);
  proche(p.efficaceParRailMm, 0.38 / Math.sqrt(6), 0.001);
  proche(p.deuxClicsParRailMm, 0.38 / Math.sqrt(3), 0.001);
  assert.ok(p.rapportAuSeuil5 > 20 && p.rapportAuSeuil10 > 2 * p.rapportAuSeuil5 - 2, 'les seuils valent des dizaines de fois le grain');
  proche(B.plancherPixel(0.76).ecartTypeParAxeMm, 2 * p.ecartTypeParAxeMm, 0.002);
});

test('Wilson et bootstrap : bornes sensées, bootstrap reproductible avec la même graine', () => {
  const w = B.wilson(5, 20);
  proche(w.part, 0.25, 1e-6);
  assert.ok(w.bas < 0.25 && w.haut > 0.25 && w.bas > 0.09 && w.haut < 0.5);
  assert.equal(B.wilson(0, 0).part, null);
  assert.equal(B.wilson(0, 10).bas, 0);
  const grappes = Array.from({ length: 30 }, (_, i) => [i % 7, (i * 3) % 11]);
  const med = x => x.slice().sort((a, b) => a - b)[Math.floor(x.length / 2)];
  assert.deepEqual(B.bootstrap(grappes, med, 7), B.bootstrap(grappes, med, 7));
  assert.deepEqual(B.bootstrap([[1]], med, 1), [null, null], 'une seule grappe : pas d\'intervalle');
});

test('1. validations multiples : même visite, même session, deux sessions, validation identique', () => {
  const j = analyser(fixtureValidations());
  const paires = j.echantillons.validations;
  assert.equal(paires.length, 4, '7001 (1 paire), 7002 (1), 7004 (1), 7003 une seule validation en A et aucune en B ; 7001 revue en B (1 de plus)');
  const par = c => paires.filter(p => p.cut === c);
  /* 7001 : A0 = pose du départ, A1 : +3 mm latéral, −2 mm vertical sur le rail droit ; B2 reprend A1 à l'identique. */
  const p1 = par(7001).find(p => p.type === 'meme-session');
  proche(p1.d.lat, 3, 0.01); proche(p1.d.vert, -2, 0.01); proche(p1.g.lat, 0, 0.01); proche(p1.max3d, Math.hypot(3, 2), 0.01);
  const p1b = par(7001).find(p => p.type === 'sessions-differentes');
  proche(p1b.max3d, 0, 0.001);
  /* 7002 : deux validations dans la même visite, 6 mm de vertical sur le rail gauche. */
  assert.equal(par(7002)[0].type, 'meme-visite');
  proche(Math.abs(par(7002)[0].g.vert), 6, 0.01);
  /* 7004 : validé en A et en B à l'identique. */
  assert.equal(par(7004)[0].type, 'sessions-differentes');
  proche(par(7004)[0].max3d, 0, 0.001);
  assert.equal(par(7003).length, 0, 'une seule validation : aucune paire');
  const r = B.resumerJeu(j);
  assert.equal(r.validationsMultiples.cutsConcernes, 3);
  assert.equal(r.validationsMultiples.tous.classes.identique.k, 2);
  proche(r.validationsMultiples.tous.classes.de5a10.k, 1, 0);
  assert.equal(r.validationsMultiples.parType['meme-visite'].paires, 1);
});

test('2. revues : catégories, sessions, rupture de continuité', () => {
  const j = analyser(fixtureValidations());
  const r = j.echantillons.revues;
  const cat = (cut, session) => r.lignes.filter(l => l.cut === cut && l.autreSession === session).map(l => l.categorie);
  assert.deepEqual(cat(7003, true), ['aucune-action'], '7003 : validé en A, revu en B sans rien faire');
  assert.deepEqual(cat(7004, true), ['validation-sans-mouvement'], '7004 : revalidé tel quel en B');
  assert.ok(cat(7001, false).includes('validation-avec-mouvement'), '7001 : la seconde visite de A déplace le rail droit de 3 mm');
  assert.ok(r.lignes.filter(l => l.cut === 7001 && l.categorie === 'validation-avec-mouvement').every(l => l.mouvementMm > 3.5 && l.mouvementMm < 3.7));
  /* La visite B de 7001 s'ouvre sur la pose où A l'a laissé : aucune rupture. Une rupture est fabriquée plus bas. */
  assert.equal(r.ruptures.length, 0);
  const rupture = fixtureValidations();
  rupture[1].records[2].initialObserved = S.etat(7001, [S.decaler(G0, 1), mmSur(S.decaler(D0, 1), 9, 0)], 97);
  rupture[1].records[2].firstObserved = rupture[1].records[2].initialObserved;
  const j2 = analyser(rupture);
  assert.equal(j2.echantillons.revues.ruptures.length, 1);
  assert.equal(j2.echantillons.revues.ruptures[0].cut, 7001);
  assert.equal(j2.echantillons.revues.ruptures[0].sessionsDifferentes, true);
  const res = B.resumerRevues(j.echantillons.revues);
  assert.ok(res.autreSession.revisites >= 2 && res.apresCorrection.revisites >= 1);
});

test('3. départ contre référence : un jeu débutant, classes et rails bougés', () => {
  /* Dix cuts : 4 non touchés, 3 retouchés de 2 mm en vertical, 2 de 7 mm en latéral, 1 mauvais objet de 30 mm en latéral. */
  const decalages = [0, 0, 0, 0, 2, 2, 2, 7, 7, 30];
  const records = decalages.map((dy, k) => {
    const cut = 7100 + k, g = S.decaler(G0, k), d = S.decaler(D0, k);
    const fin = k >= 4 && k < 7 ? [g, mmSur(d, 0, 2)] : [g, mmSur(d, dy, 0)];
    return visite({ session: 'C', index: k, cut, debut: m(k + 1), fin: m(k + 1, 20), initiale: [g, d], validation: fin });
  });
  const j = analyser([exportEcho('C', m(0), records)], { debutant: true });
  const r = B.resumerJeu(j).departContreReference.resume;
  assert.equal(r.cuts, 10);
  assert.equal(r.classes.identique.k, 4);
  assert.equal(r.classes.de1a5.k, 3);
  assert.equal(r.classes.de5a10.k, 2);
  assert.equal(r.classes.plus25.k, 1);
  assert.equal(r.sup10.k, 1);
  assert.equal(r.railsBouges.d3.n, 6, 'six rails bougés (les autres rails ne bougent pas)');
  assert.equal(B.resumerJeu(j).debutant, true);
});

/* Une voie de `n` cuts espacés de 1 m (le long de x), bruit latéral gaussien de `sigmaMm` sur chaque rail, bruit vertical de
 * `sigmaVertMm`, courbure optionnelle (rayon `rayon` m, en plan). Les poses de départ sont décalées de 5 mm : tout est « touché ». */
function voie({ n = 80, sigmaMm = 0, sigmaVertMm = 0, rayon = null, graine = 11, depart = 5 }) {
  const alea = B.aleatoire(graine), gauss = () => Math.sqrt(-2 * Math.log(1 - alea())) * Math.cos(2 * Math.PI * alea());
  const records = [];
  for (let k = 0; k < n; k++) {
    const x = 100 + k;
    const yc = rayon ? rayon - Math.sqrt(rayon * rayon - k * k) : 0;                        // arc de cercle lisse
    const g = [x, 200 + yc, 10], d = [x, 200 + yc + 1.435, 10];
    const fin = [mmSur(g, sigmaMm * gauss(), sigmaVertMm * gauss()), mmSur(d, sigmaMm * gauss(), sigmaVertMm * gauss())];
    records.push(visite({ session: 'V', index: k, cut: 9000 + k, partie: 98, debut: m(k + 1), fin: m(k + 1, 5), initiale: [mmSur(fin[0], depart, 0), mmSur(fin[1], depart, 0)], validation: fin }));
  }
  return [S.exportEcho({ session: 'V', debutSession: m(0), stamp: '2031-06-01T10-00-00', records })];
}

test('5. voisins : le bruit latéral injecté est retrouvé, le vertical nul reste nul', () => {
  const j = analyser(voie({ n: 400, sigmaMm: 1.5, sigmaVertMm: 0 }), { partie: 98 });
  const r = B.resumerJeu(j).voisins;
  assert.ok(r.fenetres >= 380, `fenêtres : ${r.fenetres}`);
  const lat = r.polynome.tous.lat, vert = r.polynome.tous.vert;
  assert.ok(lat.sigmaRobusteMm > 1.1 && lat.sigmaRobusteMm < 1.9, `latéral robuste ${lat.sigmaRobusteMm}`);
  assert.ok(lat.sigmaQuadratiqueMm > 1.3 && lat.sigmaQuadratiqueMm < 1.7, `latéral quadratique ${lat.sigmaQuadratiqueMm}`);
  assert.ok(lat.icQuadratique[0] <= 1.55 && lat.icQuadratique[1] >= 1.45, `l'intervalle encadre la valeur injectée : ${lat.icQuadratique}`);
  assert.ok(vert.sigmaQuadratiqueMm < 0.01, `vertical ${vert.sigmaQuadratiqueMm}`);
  /* Le milieu des deux rails a un bruit divisé par √2 (rails indépendants). */
  const mil = r.polynome.milieuDesRails.lat.sigmaQuadratiqueMm;
  assert.ok(mil > 0.9 && mil < 1.25, `milieu ${mil}`);
  /* Voie droite reconnue ; tous les rails sont touchés (départ décalé de 5 mm). */
  assert.ok(r.voieDroite.fenetres >= 300);
  assert.ok(r.parStrate['tous-touches'].fenetres >= 380);
  assert.ok(r.voieDroite.droite.lat.sigmaQuadratiqueMm > 1.3 && r.voieDroite.droite.lat.sigmaQuadratiqueMm < 1.7);
});

test('5. voisins : sans bruit, une voie lisse (droite ou en courbe) donne un résidu nul ; la courbe n\'est pas « voie droite »', () => {
  const droite = B.resumerJeu(analyser(voie({ sigmaMm: 0 }), { partie: 98 })).voisins;
  assert.ok(droite.polynome.tous.lat.sigmaQuadratiqueMm < 0.01 && droite.polynome.tous.vert.sigmaQuadratiqueMm < 0.01);
  assert.ok(droite.voieDroite.fenetres > 50);
  const courbe = B.resumerJeu(analyser(voie({ sigmaMm: 0, rayon: 150, n: 60 }), { partie: 98 })).voisins;
  assert.ok(courbe.polynome.tous.lat.sigmaQuadratiqueMm < 0.05, `la géométrie lisse est absorbée : ${courbe.polynome.tous.lat.sigmaQuadratiqueMm}`);
  assert.equal(courbe.voieDroite.fenetres, 0, 'un rayon de 150 m n\'est pas une voie droite');
});

test('5. voisins : une marche isolée de 10 mm est vue, une suite de cuts non consécutifs ne fait aucune fenêtre', () => {
  const records = [];
  for (let k = 0; k < 40; k++) {
    const cut = 9500 + 2 * k, g = [100 + 2 * k, 200, 10], d = [100 + 2 * k, 201.435, 10];     // un cut sur deux
    records.push(visite({ session: 'V', index: k, cut, partie: 98, debut: m(k + 1), fin: m(k + 1, 5), initiale: [g, d], validation: [g, d] }));
  }
  const j = analyser([S.exportEcho({ session: 'V', debutSession: m(0), stamp: '2031-06-01T10-00-00', records })], { partie: 98 });
  assert.equal(j.echantillons.voisins.length, 0);
  const avecMarche = voie({ n: 40, sigmaMm: 0 });
  const r = avecMarche[0].records[20];
  r.humanFinalReference.state.rails.left.positionSceneRelative[1] += 0.010;
  const v = B.resumerJeu(analyser(avecMarche, { partie: 98 })).voisins;
  assert.ok(v.polynome.tous.lat.sigmaQuadratiqueMm > 0.3, `la marche est visible : ${v.polynome.tous.lat.sigmaQuadratiqueMm}`);
});

/* Une visite par rail réglé : la pose de départ, puis `pas` clics. Le premier clic tombe n'importe où (4,17 mm de la pose de départ) ;
 * les suivants sont séparés d'un nombre entier de pixels de `pixelMm` (latéral y, vertical z). */
function visitesAvecClics({ n = 60, pixelMm = 0.386 }) {
  const alea = B.aleatoire(21), records = [];
  for (let k = 0; k < n; k++) {
    const g = S.decaler(G0, k), d = S.decaler(D0, k);
    const q = pixelMm / 1000, entrees = [];
    let y = d[1] + 0.00417, z = d[2] - 0.0031;
    const pas = 1 + Math.floor(alea() * 3), dernier = [];
    entrees.push([y, z]);
    for (let j = 0; j < pas; j++) {
      y += q * (Math.floor(alea() * 6) - 3 || 2); z += q * (Math.floor(alea() * 6) - 3 || 1);
      entrees.push([y, z]); dernier.push([y, z]);
    }
    const r = visite({ session: 'K', index: k, cut: 9300 + k, partie: 99, debut: m(k + 1), fin: m(k + 1, 20), initiale: [g, d], validation: [g, [d[0], y, z]] });
    r.railPoseHistory = entrees.map(([yy, zz], i) => ({ observedAt: S.horodatage(k + 1, i), eventSeq: i, afterGesture: true,
      rails: { left: { positionSceneRelative: g }, right: { positionSceneRelative: [d[0], yy, zz] } } }));
    r.initialObserved.rails.right.sceneRelativeToProfileLocal = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    records.push(r);
  }
  return [S.exportEcho({ session: 'K', debutSession: m(0), stamp: '2031-06-01T10-00-00', records })];
}

test('6. cascade des clics : le grain du pixel est retrouvé sur le réseau des pas, le dernier pas est mesuré', () => {
  const j = analyser(visitesAvecClics({ pixelMm: 0.386 }), { partie: 99 });
  const r = B.resumerJeu(j).clics;
  assert.equal(r.railsAvecGeste, 60);
  assert.ok(r.grain.deuxAxes.n > 100);
  proche(r.grain.deuxAxes.q, 0.386, 0.006);
  assert.ok(r.grain.deuxAxes.R > 0.9, `concentration ${r.grain.deuxAxes.R}`);
  assert.ok(r.grain.deuxAxes.pValeur < 1e-6);
  assert.ok(r.grain.deuxAxes.icQ[0] <= 0.386 + 0.006 && r.grain.deuxAxes.icQ[1] >= 0.386 - 0.006);
  /* Dernier pas des rails réglés en au moins deux gestes : entre 1 et 3 pixels sur chaque axe, soit 0,39 à 1,6 mm en 3D. */
  assert.ok(r.dernierPas.d3.n > 10 && r.dernierPas.d3.max < 1.7 && r.dernierPas.d3.mediane > 0.3);
  /* Un autre grain (vue plus large) donne un autre réseau. */
  const large = B.resumerJeu(analyser(visitesAvecClics({ pixelMm: 0.52 }), { partie: 99 })).clics.grain.deuxAxes;
  proche(large.q, 0.52, 0.008);
  /* Des pas sans réseau (bruit continu) : concentration de l'ordre de 1/√N, pas de grain. */
  const alea = B.aleatoire(5), bruit = Array.from({ length: 400 }, () => 0.2 + 7.5 * alea());
  assert.ok(B.meilleurGrain(bruit).R < 0.2, 'sans réseau, R reste faible');
  assert.equal(B.clics(B.preparerCuts([], [], null)).length, 0);
});

test('sensibilité des seuils : sans bruit rien ne bouge, plus de bruit éloigne les taux, la zone grise grandit', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bruit-jeu-'));
  try {
    const lignes = [{ type: 'entete', format: 'ariane-jeu-apprentissage-v1' }];
    const mesures = [0.5, 1, 2, 3, 4, 4.8, 5.2, 6, 8, 9.5, 10.5, 14];
    mesures.forEach((v, k) => lignes.push({ type: 'cut', partie: 97, cut: k, classe: 'posee', etiquette: { referenceHumaine: 'observee', correctionMm: {
      gauche: { longitudinalMm: 0, lateralMm: v, verticalMm: 0, dist3dMm: v }, droite: { longitudinalMm: 0, lateralMm: 0, verticalMm: 0.2, dist3dMm: 0.2 } } } }));
    lignes.push({ type: 'cut', partie: 97, cut: 99, classe: 'differee', etiquette: { referenceHumaine: 'sans-reference' } });
    const f = path.join(dir, 'jeu.jsonl');
    fs.writeFileSync(f, lignes.map(l => JSON.stringify(l)).join('\n'));
    const cuts = B.lireJeu(f);
    assert.equal(cuts.length, 12, 'le cut sans référence est écarté');
    const s = B.sensibilite(cuts, [0, 0.5, 2], 3);
    assert.equal(s.observe.juste5, 6 / 12);
    assert.equal(s.parSigma[0].ecartJuste5, 0);
    assert.ok(Math.abs(s.parSigma[1].ecartJuste5) < Math.abs(s.parSigma[2].ecartJuste5) + 0.02);
    assert.ok(s.parSigma[2].cutsZoneGrise5 >= s.parSigma[1].cutsZoneGrise5);
    assert.deepEqual(B.sensibilite(cuts, [1], 3), B.sensibilite(cuts, [1], 3), 'reproductible');
    /* Le bruit ne touche que les rails déplacés : un rail laissé tel quel garde sa pose. Seuls les rails gauches (0,5 à 14 mm) sont
     * déplacés ici ; le rail droit bouge de 0,2 mm, donc pas. */
    assert.equal(s.railsBouges.k, 12);
    assert.equal(s.railsBouges.n, 24);
    const sur = B.sensibilite(cuts, [3], 3, 200, { tous: true });
    assert.equal(sur.bruitSurTousLesRails, true);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('ligne de commande : jeux, jeu débutant, sortie JSON sans coordonnées, reprise sans relire les Échos', () => {
  const d1 = dossierAvec(fixtureValidations()), d2 = dossierAvec(voie({ n: 30, sigmaMm: 1 }));
  const sortie = path.join(d1, 'bruit.json'), lignes = [];
  try {
    const res = B.executer(['--jeu', `expert=${d1}`, '--jeu', `debut=${d2}`, '--debutant', 'debut', '--sortie', sortie, '--graine', '5'], l => lignes.push(l));
    assert.equal(res.jeux.length, 2);
    assert.equal(res.jeux[1].debutant, true);
    const txt = lignes.join('\n');
    assert.match(txt, /4\. Plancher du pixel/);
    assert.match(txt, /1\. Validations multiples : 3 cuts/);
    const brut = fs.readFileSync(sortie, 'utf8');
    assert.ok(!/positionSceneRelative|pageId|frameId/.test(brut), 'aucune coordonnée absolue ni identifiant dans la sortie');
    const doc = JSON.parse(brut);
    assert.equal(doc.format, B.FORMAT);
    assert.equal(doc.echantillons.length, 2);
    const reprise = B.executer(['--reprendre', sortie, '--graine', '5'], () => {});
    assert.deepEqual(reprise.jeux, res.jeux, 'la reprise redonne les mêmes statistiques');
    assert.throws(() => B.lireArguments(['--debutant', 'x', '--jeu', 'y=z']), /aucun jeu/);
    assert.throws(() => B.lireArguments([]), /Usage/);
    assert.throws(() => B.lireArguments(['--jeu', 'sans-egal']), /étiquette=chemin/);
  } finally { fs.rmSync(d1, { recursive: true, force: true }); fs.rmSync(d2, { recursive: true, force: true }); }
});
