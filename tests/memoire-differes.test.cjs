'use strict';
/* G1 (plan 5.0) : mémoire des différés, sur des données SYNTHÉTIQUES (parties 91 à 95, cuts et valeurs inventés,
 * générateur pseudo-aléatoire de graine fixe). Aucune donnée de terrain, aucune coordonnée absolue.
 *
 *  - construction : une capture fabriquée (champignon rectangulaire, repère profil = repère de scène, rails séparés de
 *    1,44 m) rejoue le vrai moteur ; Mic pose le rail à un décalage connu ; le cas doit retrouver ce décalage dans son
 *    pool et ne jamais recopier la réponse de Mic dans le contexte ;
 *  - jugement : cinq parties de cas fabriqués. (a) le bon candidat est « fort » et de faible perte ; (b) les séries ont un
 *    décalage constant par rapport au départ ; (c) le contexte annonce le rang du bon candidat ;
 *  - garde-fous : jamais la même partie des deux côtés, la pose d'un cut ne dépend pas de sa propre réponse, seuils
 *    choisis sans regarder la partie jugée, porte (0 mauvaise voie, moins de 5 % de fausses). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const G = require('../tools/memoire-differes.cjs');
const OUTIL = path.join(__dirname, '..', 'tools', 'memoire-differes.cjs');
/* Cas fabriqués partagés avec tests/memoire-differes-jugement.test.cjs (le jugement complet y est joué : limite de 20 s par fichier). */
const { alea, r2, partieFabriquee, parties, partieDe } = require('./helpers/memoire-differes-fixture.cjs');

const I16 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const trans = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];   // colonne par colonne

/* ---------------------------------------------------------------- construction : capture fabriquée */
/* Un rail : départ en (x, y0, 0) ; champignon (dessus de 64 mm, flanc de 40 mm) posé par l'opérateur à (dla, dve) du
 * départ, dans le repère du rail (sign = +1 : le champignon s'étend vers +y ; −1 : vers −y). */
function rail(x, y0, sign, dla, dve) {
  const contour = [];
  for (let y = 0; y <= 0.064 + 1e-12; y += 0.001) contour.push([x, y0 + sign * y, 0]);
  for (let z = -0.001; z >= -0.04 - 1e-12; z -= 0.001) contour.push([x, y0, z]);
  return { positionSceneRelative: [x, y0, 0], profileOriginSceneRelative: [x, y0, 0], sceneRelativeToProfileLocal: trans(-x, -y0, 0), profileLocalToSceneRelative: trans(x, y0, 0),
    railLocalToSceneRelative: trans(x, y0, 0), profileContours: [{ type: 'Line', verticesSceneRelative: contour }], _vrai: { sign, dla, dve } };
}
function pointsRail(x, y0, sign, dla, dve, rnd) {
  const pts = [], bu = dla / 1000, bz = dve / 1000;
  for (let i = 0; i < 60; i++) { const u = 0.015 + i * (0.035 / 59); pts.push([x + (rnd() - 0.5) * 0.05, y0 + bu + sign * u, bz + (rnd() - 0.5) * 0.004]); }
  for (let i = 0; i < 20; i++) { const z = -0.012 - i * (0.02 / 19); pts.push([x + (rnd() - 0.5) * 0.05, y0 + bu + sign * (rnd() - 0.5) * 0.004, bz + z]); }
  return pts;
}
function captureFabriquee(cut, frameId, mic, rnd) {
  const x = 10 * cut, L = rail(x, 0, 1, mic.gauche[1], mic.gauche[2]), R = rail(x, 1.44, -1, mic.droite[1], mic.droite[2]);
  const points = [...pointsRail(x, 0, 1, mic.gauche[1], mic.gauche[2], rnd), ...pointsRail(x, 1.44, -1, mic.droite[1], mic.droite[2], rnd)];
  for (const r of [L, R]) delete r._vrai;
  return { cut, part: 91, identity: { part: 91, cut, frameId }, rails: { left: L, right: R }, pointsSceneRelative: points, visibleByClipBoxes: points.map(() => true) };
}
const railJ = (lat, vert, lon = 0) => ({ repere: 'profil', longitudinalMm: lon, lateralMm: lat, verticalMm: vert, dist3dMm: r2(Math.hypot(lon, lat, vert)) });

test('construction : le cas retrouve la pose de Mic dans le pool du moteur, et le contexte ne contient pas la réponse', () => {
  const rnd = alea(7), frameId = 'cadre-synthetique';
  const cuts = [101, 102, 103, 104];
  const mics = { 101: { gauche: [0, 12, -3], droite: [0, -14, 2] }, 102: { gauche: [0, 13, -3], droite: [0, -13, 2] }, 103: { gauche: [0, 15, -4], droite: [0, -12, 3] },
    104: { gauche: [0, 230, 6], droite: [0, 215, -5] } };   // le cut 104 est hors de la fenêtre du moteur (±180 mm)
  const captures = cuts.map(c => captureFabriquee(c, frameId, mics[c], rnd));
  const jeu = [{ type: 'entete', format: 'ariane-jeu-apprentissage-v1' },
    ...cuts.map(c => ({ type: 'cut', partie: 91, cut: c, classe: 'differee', traits: { b1Ombre: { regle: 'dernier-recours', reel: { stage: 'deferred', reason: 'no-anchor' }, hypothese: { stage: 'deferred', appuis: 0 } },
      differe: { railsNonResolus: ['gauche', 'droite'], gauche: { motif: 'ambiguity' }, droite: { motif: 'flank' } }, voisinage: { posesAvant: 0, differesAvant: c - 101 }, s6: { flushPct: 4, tDepartEtat: 'calibre' } },
      etiquette: { correctionMm: 'SECRET-DE-MIC', maxDist3dMm: 999 }, contexte: { ecartementInitialMm: 1440, deniveleLocalMm: 2 } }))];
  const table = cuts.map(c => ({ partie: 91, cut: c, classe: 'differee', referenceHumaine: 'observee', base: 'premiere-visite',
    ecartHumain: { gauche: railJ(mics[c].gauche[1], mics[c].gauche[2]), droite: railJ(mics[c].droite[1], mics[c].droite[2]) } }));
  const { entete, cas } = G.construireCas({ partie: 91, jeu, jointure: { table }, corpus: cb => captures.forEach(cb) });
  assert.equal(entete.cas, 4); assert.equal(cas.length, 4); assert.equal(entete.series, 1, 'trois différés consécutifs = une série');
  assert.deepEqual(cas.map(c => c.serie.rang), [0, 1, 2, 3]);
  for (const c of cas.slice(0, 3)) {
    for (const cote of ['gauche', 'droite']) {
      const rep = c.reponse.pool[cote];
      assert.ok(rep.moteur && rep.moteur.distMm <= 5, `cut ${c.cut} ${cote} : le pool du moteur contient la pose de Mic à ${rep.moteur && rep.moteur.distMm} mm`);
      assert.ok(c.rails[cote].pool.length > 3 && c.rails[cote].pool.every(p => Math.abs(p.fla) < 500 && Math.abs(p.fve) < 500), 'décalages relatifs seulement');
      assert.ok(c.rails[cote].pool.some(p => p.moteur === 1), 'pool du moteur marqué');
    }
    assert.ok(Math.abs(c.reponse.ecartementMicMm - (1440 + c.reponse.mic.droite[1] - c.reponse.mic.gauche[1])) < 0.2, `écartement de Mic cohérent : ${c.reponse.ecartementMicMm}`);
    const texteCas = JSON.stringify({ contexte: c.contexte, rails: c.rails, geometrie: c.geometrie });
    assert.ok(!texteCas.includes('SECRET-DE-MIC'), 'la réponse de Mic ne passe pas dans le contexte');
  }
  // cut 104 : la pose de Mic est hors de la fenêtre du moteur, le pool élargi (fenêtre décalée) la retrouve
  const lointain = cas[3];
  for (const cote of ['gauche', 'droite']) {
    const rep = lointain.reponse.pool[cote];
    assert.ok(!rep.moteur || rep.moteur.distMm > 5, `hors du pool du moteur : ${JSON.stringify(rep.moteur)}`);
    assert.ok(rep.elargi && rep.elargi.distMm <= 5, `le pool élargi la retrouve à ${rep.elargi && rep.elargi.distMm} mm`);
    assert.ok(lointain.rails[cote].pool.some(p => p.moteur === 0), 'candidats hors du pool du moteur');
  }
  assert.equal(cas[1].voisinsMic.length, 3, 'les poses de Mic des autres cuts sont consignées en décalages relatifs');
  assert.ok(cas[1].voisinsMic.filter(v => v.cut !== 104).every(v => Math.abs(v.mic.gauche[0]) < 25000 && Math.abs(v.mic.gauche[1]) < 100), 'relatives au cut');
  // la pose de Mic (cut voisin) vue depuis ce cut : même latéral à quelques mm près
  const v = cas[1].voisinsMic.find(w => w.cut === 101);
  assert.ok(Math.abs(v.mic.gauche[1] - 12) < 0.1 && Math.abs(v.mic.gauche[0] - (-10000)) < 0.5, `voisin vu depuis le cut ${JSON.stringify(v.mic.gauche)}`);
});


test('le générateur fabrique des cas cohérents (le bon candidat est dans le pool, à moins de 2 mm)', () => {
  for (const [, cas] of parties()) for (const c of cas) for (const cote of ['gauche', 'droite']) assert.ok(c.reponse.pool[cote].moteur.distMm < 2.5);
});

test('mesure : seuils exacts (≤ 5 compte juste, > 10 faux, > 50 mauvaise voie), porte', () => {
  const cas = partieFabriquee(91, 1).slice(0, 5);
  const posePrecise = (c, d) => ({ gauche: [c.reponse.mic.gauche[1] + d, c.reponse.mic.gauche[2]], droite: [c.reponse.mic.droite[1], c.reponse.mic.droite[2]] });
  const m = G.mesurer([{ cas: cas[0], pose: posePrecise(cas[0], 5) }, { cas: cas[1], pose: posePrecise(cas[1], 10) }, { cas: cas[2], pose: posePrecise(cas[2], 10.01) }, { cas: cas[3], pose: posePrecise(cas[3], 51) }, { cas: cas[4], pose: null }]);
  assert.equal(m.poses, 4); assert.equal(m.juste5, 1); assert.equal(m.juste10, 2); assert.equal(m.faux, 2); assert.equal(m.mauvaiseVoie, 1); assert.equal(m.abstentions, 1); assert.equal(m.porte, false);
  const ok = G.mesurer([{ cas: cas[0], pose: posePrecise(cas[0], 1) }]);
  assert.equal(ok.porte, true); assert.equal(ok.faux, 0);
  assert.ok(Math.abs(G.wilsonHaut(0, 20) - 0.161) < 0.01, '0 fausse sur 20 ne prouve pas moins de 5 %');
});

test('séries : des différés qui se suivent à 10 cuts près forment une série', () => {
  const s = G.numeroterSeries([5, 6, 7, 40, 41, 52, 100]);
  assert.deepEqual(s.get(5), { id: 5, rang: 0, longueur: 3 }); assert.deepEqual(s.get(7), { id: 5, rang: 2, longueur: 3 });
  assert.deepEqual(s.get(41), { id: 40, rang: 1, longueur: 2 }, '52 suit 41 à 11 cuts : nouvelle série');
  assert.equal(s.get(52).longueur, 1);
  assert.equal(s.get(100).longueur, 1);
});

test('(b) mémoire de voie : décalage constant par rapport au départ, appris sur les premiers cuts de la série, réutilisé sur les suivants', () => {
  const cas = partieFabriquee(91, 5, { series: [6], decalage: 40 });
  const p = { base: 'D', K: 2, porteDisp: 6, mode: 'moteur', tol: 15, minMemoire: 1 };
  const res = G.simulerB(p, cas);
  assert.equal(res[0].pose, null, 'le premier cut de la série n\'a pas de mémoire : abstention');
  const m = G.mesurer(res.slice(1));
  assert.ok(m.juste10 >= 4 && m.faux === 0, `les cuts suivants sont posés à moins de 10 mm : ${JSON.stringify(m)}`);
  const fige = G.mesurer(G.simulerB(p, cas, 1));
  assert.equal(fige.cas, 5, 'mémoire figée au premier cut : les 5 suivants sont jugés');
  assert.ok(fige.juste10 >= 4);
  // série instable : le décalage change, la porte de dispersion refuse
  const instable = partieFabriquee(91, 5, { series: [6], decalage: 40 });
  instable.forEach((c, i) => { c.reponse.mic.gauche[1] += i * 30; c.reponse.mic.droite[1] += i * 30; });
  const r = G.simulerB({ ...p, porteDisp: 6 }, instable);
  assert.ok(r.slice(2).every(x => x.pose === null), 'dispersion trop forte : aucune pose');
});

test('(b) avec propagation, un cut posé entre dans la mémoire tel qu\'Ariane l\'a posé (faux compris) ; sans propagation, tel que Mic l\'a corrigé', () => {
  const cas = partieFabriquee(91, 5, { series: [4], decalage: 40 });
  cas[1].reponse.mic.gauche[1] += 8; cas[1].reponse.mic.droite[1] -= 8;      // Mic corrige le cut 2 de 8 mm de plus que le cut 1
  const p = { base: 'D', K: 1, porteDisp: 50, mode: 'brut', tol: 0, minMemoire: 1, nBack: 0 };
  const ideal = G.simulerB(p, cas), prop = G.simulerB(p, cas, null, true);
  assert.deepEqual(prop[1].pose, ideal[1].pose, 'le deuxième cut est posé pareil : sa mémoire est le premier cut, corrigé par Mic dans les deux cas');
  assert.ok(Math.abs(ideal[2].pose.gauche[0] - cas[1].reponse.mic.gauche[1]) < 1e-9, 'idéal : le troisième cut reprend la pose de Mic du deuxième');
  assert.ok(Math.abs(prop[2].pose.gauche[0] - prop[1].pose.gauche[0]) < 1e-9, 'propagation : le troisième cut reprend la pose qu\'Ariane a posée au deuxième');
  assert.ok(Math.abs(prop[2].pose.gauche[0] - ideal[2].pose.gauche[0]) > 7, 'et l\'erreur de 8 mm se propage');
});

test('(b) la pose d\'un cut ne dépend pas de sa propre réponse (seulement de celles des cuts plus anciens)', () => {
  const cas = partieFabriquee(91, 5, { series: [5] });
  const p = { base: 'D', K: 2, porteDisp: 8, mode: 'brut', tol: 0, minMemoire: 1 };
  const avant = G.simulerB(p, cas).map(r => r.pose);
  const copie = JSON.parse(JSON.stringify(cas));
  copie[3].reponse.mic = { gauche: [0, 999, 999], droite: [0, -999, -999] };
  const apres = G.simulerB(p, copie).map(r => r.pose);
  assert.deepEqual(apres.slice(0, 4), avant.slice(0, 4), 'les cuts jusqu\'au quatrième (compris) ne changent pas');
});

test('(a) choix dans le pool : le modèle appris sur d\'autres parties retrouve le bon candidat, sans pose fausse', () => {
  const p = parties(), test_ = p.get(95), app = new Map([...p].filter(([k]) => k !== 95));
  const opt = { elargi: false };
  const a = G.apprendreA(app, opt, 'a');
  assert.ok(a.positifs > 20, 'des candidats justes à apprendre');
  assert.ok(a.seuils, 'des seuils sûrs existent sur les parties d\'apprentissage');
  const m = G.mesurer(test_.map(c => ({ cas: c, pose: G.poserA(a.modele, a.seuils, c, opt).pose })));
  assert.ok(m.juste10 >= 8, `des différés posés : ${JSON.stringify(m)}`);
  assert.equal(m.mauvaiseVoie, 0);
  assert.ok(m.faux / Math.max(1, m.poses) < 0.05, 'moins de 5 % de fausses');
});

test('(a) la pose d\'un cas ne dépend pas de la réponse de Mic sur la partie jugée', () => {
  const p = parties(), app = new Map([...p].filter(([k]) => k !== 95)), opt = { elargi: false };
  const a = G.apprendreA(app, opt, 'a');
  const avant = p.get(95).map(c => JSON.stringify(G.poserA(a.modele, a.seuils, c, opt).pose));
  const copie = JSON.parse(JSON.stringify(p.get(95)));
  for (const c of copie) c.reponse.mic = { gauche: [0, 500, 500], droite: [0, -500, -500] };
  const apres = copie.map(c => JSON.stringify(G.poserA(a.modele, a.seuils, c, opt).pose));
  assert.deepEqual(apres, avant);
});

test('(c) voisin le plus proche : le descripteur ne contient aucune grandeur issue de Mic', () => {
  const cas = partieFabriquee(91, 3).slice(0, 3);
  const d0 = cas.map(c => G.descripteur(c));
  const copie = JSON.parse(JSON.stringify(cas));
  for (const c of copie) { c.reponse = { mic: { gauche: [0, 70, 70], droite: [0, 70, 70] }, ecartementMicMm: 1, pool: c.reponse.pool }; }
  assert.deepEqual(copie.map(c => G.descripteur(c)), d0);
});

test('ligne de commande : construire puis juger, sans coordonnée absolue dans la sortie', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-')), fichiers = [];
  try {
    for (const [pn, cas] of [...parties()].slice(0, 3)) {
      const f = path.join(tmp, `cas-${pn}.jsonl`);
      fs.writeFileSync(f, [{ type: 'entete', format: G.FORMAT_CAS, partie: pn }, ...cas].map(l => JSON.stringify(l)).join('\n') + '\n'); fichiers.push(f);
    }
    const sortie = path.join(tmp, 'rapport.json');
    const r = cp.spawnSync(process.execPath, [OUTIL, 'juger', ...fichiers.flatMap(f => ['--cas', f]), '--json', sortie], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /MÉMOIRE DES DIFFÉRÉS/); assert.match(r.stdout, /\(a\) choix dans le pool du moteur/); assert.match(r.stdout, /porte/);
    const j = JSON.parse(fs.readFileSync(sortie, 'utf8'));
    assert.equal(j.format, G.FORMAT_RAPPORT);
    const mauvais = cp.spawnSync(process.execPath, [OUTIL, 'juger', '--cas', fichiers[0]], { encoding: 'utf8' });
    assert.equal(mauvais.status, 2); assert.match(mauvais.stderr, /au moins deux parties/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

/* ---------------------------------------------------------------- B1 : parties réservées (manifeste des parties) */

test('B1 juger : une partie réservée est jugée mais n\'entre dans aucun apprentissage', () => {
  const brouille = cas => cas.map(c => ({ ...c, reponse: { ...c.reponse, mic: { gauche: [0, 123, 45], droite: [0, -123, 45] } } }));
  const construire = changer => new Map([91, 92, 93, 94, 95].map((p, i) => [p, changer && p === 95 ? brouille(partieDe(p, i)) : partieDe(p, i)]));
  const base = G.juger(construire(false), { reservees: [95] }), autre = G.juger(construire(true), { reservees: [95] });
  for (const p of [91, 92, 93, 94]) {
    for (const id of ['a-pool', 'b-serie', 'c-voisin']) assert.deepEqual(autre.methodes[id].modeles[p], base.methodes[id].modeles[p], `${id} appris hors partie ${p}, sans la partie réservée`);
    assert.deepEqual(autre.bParSerie.parPartie[p], base.bParSerie.parPartie[p], `(b) série par série, partie ${p}`);
  }
  assert.ok(base.methodes['a-pool'].parPartie[95], 'la partie réservée est bien jugée');
  assert.deepEqual(base.reservees, [95]);
  assert.ok(G.texte(base).includes('réservée'));
  assert.deepEqual(G.juger(construire(false)).reservees, [], 'sans partie réservée, rien ne change');
});

test('B1 juger : un en-tête qui porte projet et partie est contrôlé contre le manifeste', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'g1-manif-'));
  try {
    /* Le fichier du 91 déclare une partie réservée ; les deux autres déclarent des parties d'apprentissage du manifeste. */
    const declare = { 91: 91, 92: 17, 93: 24 };
    const fichiers = [91, 92, 93].map((pn, i) => {
      const f = path.join(tmp, `cas-${pn}.jsonl`);
      fs.writeFileSync(f, [{ type: 'entete', format: G.FORMAT_CAS, partie: declare[pn], projet: 1 }, ...partieDe(pn, i)].map(l => JSON.stringify(l)).join('\n') + '\n');
      return f;
    });
    const cas = fichiers.flatMap(f => ['--cas', f]);
    const refus = cp.spawnSync(process.execPath, [OUTIL, 'juger', ...cas, '--silencieux'], { encoding: 'utf8' });
    assert.equal(refus.status, 2); assert.match(refus.stderr, /la partie 91 du projet 1 est réservée/);
    const permis = cp.spawnSync(process.execPath, [OUTIL, 'juger', ...cas, '--juger-partie-reservee'], { encoding: 'utf8' });
    assert.equal(permis.status, 0, permis.stderr);
    assert.match(permis.stderr, /partie 91 du projet 1 réservée, jugée sans réglage/);
    assert.match(permis.stdout, /Parties réservées, jugées sans réglage \(elles n'apprennent rien\) : 91/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
