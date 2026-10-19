'use strict';
/* G1-a — jeu d'hypothèses de la GCV2 (tools/gcv2-jeu.cjs, fiches/G1A_HYPOTHESES.md), sur une capture SYNTHÉTIQUE (tests/helpers/gcv2-jeu-fixture.cjs :
 * valeurs inventées, coordonnées de scène fabriquées, aucune donnée de terrain). Deux familles d'essais :
 *  - ANTI-FUITE : aucun trait ne lit la référence de l'opérateur. Changer sa pose finale sur le cut ne change aucun trait ; une pose voisine validée
 *    APRÈS la première visite du cut ne change rien non plus ; une pose voisine validée AVANT change l'interpolation (le canal existe, il est causal).
 *  - FORME : origines H0 à H4, borne de douze poses par rail, variantes « avec hauteur », étiquettes, aucune coordonnée absolue, rappel atteignable,
 *    manifeste (témoins et parties réservées refusés sans l'option). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const F = require('./helpers/gcv2-jeu-fixture.cjs');
const G = require('../tools/gcv2-jeu.cjs');
const RA = require('../tools/relecture-autonome.cjs');
const Shadow = require('../src/gcv1-shadow.js');
const L = require('../src/lot-decision.js');

const SIDES = ['left', 'right'];
const ORIGINE_ABS = [458559.4, 6699187.6, 24.0];            // « coordonnées de scène » inventées : ne doivent jamais ressortir
const json = x => JSON.stringify(x);

/* Un cut synthétique et ses objets bruts, comme `extraire` les donne à l'observateur : capture, science, décisions seul et en chaîne, appuis. */
function brutDuCut({ cut = 5, appuis = [], origine = ORIGINE_ABS } = {}) {
  const cap = F.capture({ cut, origine });
  const entree = { identity: cap.identity, rails: cap.rails, points: cap.pointsSceneRelative, visible: cap.visibleByClipBoxes };
  let brut = null;
  RA.poseAriane(entree, { appuis: { liste: appuis.slice() }, rappel: b => { brut = b; } });
  return { entree, brut };
}
/* Appuis de la chaîne : poses des deux cuts d'avant, décalées de quelques millimètres (poses d'Ariane, non vérifiées). */
function appuisChaine(cap, cut) {
  return [1, 2].map(k => ({ identity: { part: 91, cut: cut - k, frameId: null }, stage: 'first-pass',
    positions: Object.fromEntries(SIDES.map(s => [s, cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v + 0.004 : i === 2 ? v + 0.001 : v)])) }));
}
/* Un voisin vérifié : pose du rail à (lat, vert) mm de la pose de départ du cut de l'essai. */
function voisinA(cap, cut, lat, vert, source = 'humain') {
  return { identity: { part: 91, cut, frameId: null }, stage: 'verifie', source,
    positions: Object.fromEntries(SIDES.map(s => [s, cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v + lat / 1000 : i === 2 ? v + vert / 1000 : v)])) };
}
const moteur = G.moteurAvecReservoir();
function hypotheses({ cut = 5, chaine = true, voisins = [], gMed = 1450 } = {}) {
  const base = F.capture({ cut, origine: ORIGINE_ABS });
  const { brut } = brutDuCut({ cut, appuis: chaine ? appuisChaine(base, cut) : [] });
  const science = moteur.scientificProposeBoth(brut.capture);
  return G.hypothesesDuCut({ capture: brut.capture, science, seul: brut.seul, chaine: brut.chaine, appuisAvant: brut.appuisAvant, voisins, gMed });
}

test('la copie du moteur donne la même science que le module livré, plus le réservoir', () => {
  const cap = F.capture({ origine: ORIGINE_ABS });
  const livre = Shadow.scientificProposeBoth(cap), copie = moteur.scientificProposeBoth(cap);
  const sans = x => JSON.parse(JSON.stringify(x, (k, v) => k === '_reservoir' ? undefined : v));
  assert.deepEqual(sans(copie), sans(livre), 'mêmes rails, mêmes publications, même écartement');
  for (const s of SIDES) {
    const r = copie.rails[s]._reservoir;
    assert.ok(r && r.pool.length > 5, 'le réservoir est rendu');
    assert.ok(r.pool.some(c => (c.tags || []).includes('astar-published')), 'la cellule A* y est');
    assert.equal(r.pool.length, livre.rails[s].competitive.nPool, 'autant de cellules que le moteur en compte');
    assert.equal(r.lmin, livre.rails[s].competitive.lmin);
  }
  assert.equal('_reservoir' in livre.rails.left, false, 'le module livré ne change pas');
});

test('hypothèses : H0 à H4, douze poses au plus par rail, variantes avec hauteur, écarts à la voie et aux voisins', () => {
  const cap = F.capture({ cut: 5, origine: ORIGINE_ABS });
  const h = hypotheses({ cut: 5, voisins: [voisinA(cap, 4, 3, 1), voisinA(cap, 3, 2.5, 0.8), voisinA(cap, 7, 4.5, 1.5)] });
  for (const s of SIDES) {
    const base = h.rails[s].filter(x => !x.hauteur), toutes = new Set(base.flatMap(x => x.origines));
    assert.ok(base.length <= G.MAX_HYP, `${s} : ${base.length} poses de base au plus ${G.MAX_HYP}`);
    for (const o of G.ORIGINES) assert.ok(toutes.has(o), `${s} : origine ${o} présente`);
    const h0 = base.find(x => x.origines.includes('H0'));
    assert.deepEqual(h0.decal, [0, 0, 0], 'H0 est la pose de départ');
    assert.ok(base.some(x => x.sousOrigines.includes('astar')), 'H1 : la cellule A*');
    assert.ok(base.some(x => x.sousOrigines.includes('chaine')) && base.some(x => x.sousOrigines.includes('voie')), 'H3 : pose de la chaîne et voie prédite');
    assert.ok(base.some(x => x.sousOrigines.some(o => o.startsWith('comp') || o === 'strong-ecartee')), 'H2 : une cellule compétitive ou une STRONG écartée');
    for (const x of h.rails[s]) {
      assert.ok(x.decal.every(Number.isFinite) && x.decal.every(v => Math.abs(v) < 1000), 'décalages en mm, pas des coordonnées');
      if (x.hauteur) { const b = base.find(y => y.rang === x.rang); assert.ok(x.traits.hauteurMm && Math.abs(x.decal[2] - (b.decal[2] + x.traits.hauteurMm)) < 0.02, 'variante avec hauteur : base + correction'); }
    }
    for (const x of base) {
      if (x.origines.includes('H4')) assert.equal(x.traits.ecartVoisinsMm !== null && x.traits.ecartVoisinsMm < 0.8, true, 'H4 est à l\'interpolation des voisins');
      assert.ok(x.traits.ecartVoieMm !== null && x.traits.ecartVoisinsMm !== null, 'écart à la voie prédite et aux voisins sûrs consignés');
      assert.ok('ecartPaireMedMm' in x.traits && 'ecartMedAutreH0Mm' in x.traits, 'écartement de la paire contre la médiane de la partie');
    }
    const strong = base.filter(x => x.sousOrigines.includes('comp-strong'));
    assert.ok(strong.every(x => x.traits.strong === true && x.traits.ratioPerte <= 1.5 + 1e-9), 'H2 compétitive STRONG : ratio de perte au plus 1,5');
  }
  assert.ok(h.cut.voisins.n >= 2 && h.cut.voisins.humains === h.cut.voisins.n, 'voisins sûrs comptés');
  assert.equal(h.cut.etageChaine, 'first-pass', 'la chaîne a des appuis (premier passage gardé par la voie) : sa pose est celle du moteur');
  assert.ok(h.cut.appuisChaine >= 2);
});

test('hypothèses : sans chaîne ni voisins, il reste H0, H1, H2 et H5 ; la liste est stable d\'un appel à l\'autre', () => {
  const a = hypotheses({ chaine: false }), b = hypotheses({ chaine: false });
  assert.equal(json(a), json(b), 'déterministe');
  for (const s of SIDES) {
    const o = new Set(a.rails[s].flatMap(x => x.origines));
    assert.deepEqual([...o].sort(), ['H0', 'H1', 'H2', 'H5'], 'H5 : le rail complété par l\'écartement médian, à partir du rail sûr');
    assert.ok(a.rails[s].every(x => x.traits.ecartVoieMm === null && x.traits.ecartVoisinsMm === null));
  }
});

test('H5 : le rail complété donne à la paire l\'écartement médian de la partie, avec le rail sûr du moteur', () => {
  const cap = F.capture({ origine: ORIGINE_ABS }), base = brutDuCut({ cut: 5, appuis: [] }).brut, science = moteur.scientificProposeBoth(base.capture);
  const gMed = 1446;
  const h = G.hypothesesDuCut({ capture: base.capture, science, seul: base.seul, chaine: null, appuisAvant: [], voisins: [], gMed });
  for (const s of SIDES) {
    const autre = SIDES.find(x => x !== s), x = h.rails[s].find(y => y.origines.includes('H5') && !y.hauteur);
    assert.ok(x, `${s} : H5 présent`);
    const pos = L.positionOf(base.capture.rails[s], x.decal.map(v => v / 1000)), posSur = L.positionOf(base.capture.rails[autre], science.rails[autre].next.delta);
    assert.ok(Math.abs(1000 * require('../vendor/capture-core.js').distance(pos, posSur) - gMed) < 0.6, 'écartement de la paire = médiane à 0,6 mm près');
    assert.ok(Math.abs(x.decal[2] - 1000 * science.rails[autre].next.delta[2]) < 0.02, 'hauteur du rail sûr');
  }
  const sans = G.hypothesesDuCut({ capture: base.capture, science, seul: base.seul, chaine: null, appuisAvant: [], voisins: [], gMed: null });
  assert.equal(sans.rails.left.some(y => y.origines.includes('H5')), false, 'sans médiane de partie, pas de H5');
});

test('aucune coordonnée absolue ne sort : décalages, comptes et drapeaux seulement', () => {
  const cap = F.capture({ origine: ORIGINE_ABS });
  const h = hypotheses({ voisins: [voisinA(cap, 4, 3, 1), voisinA(cap, 3, 2.5, 0.8)] });
  const texte = json(h);
  for (const interdit of ['458559', '6699187', '6699188', '"positions"', 'positionSceneRelative', 'profileContours']) assert.equal(texte.includes(interdit), false, interdit);
  const nombres = texte.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi).map(Number);
  assert.ok(nombres.every(n => Math.abs(n) < 5000), 'aucun nombre de la taille d\'une coordonnée de scène (l\'écartement, 1 450 mm, est le plus grand)');
});

test('étiquettes : écart 3D à la pose finale, classes ≤ 5, ≤ 10, ≤ 50, > 50 ; posées après les traits', () => {
  const h = hypotheses({ chaine: false });
  const h1 = s => h.rails[s].find(x => x.sousOrigines.includes('astar')).decal;
  const mic = { left: h1('left').map(v => v + 1), right: h1('right').map(v => v - 1) };   // l'opérateur est à √3 mm de la proposition A*
  const et = G.etiqueter(h, mic);
  for (const s of SIDES) {
    h.rails[s].forEach((x, i) => {
      const e = Math.hypot(...x.decal.map((v, k) => v - mic[s][k]));
      assert.ok(Math.abs(et[s][i].ecartMm - e) < 0.01 + 1e-9);
      assert.equal(et[s][i].classe, e <= 5 ? '<=5' : e <= 10 ? '<=10' : e <= 50 ? '<=50' : '>50');
    });
    assert.ok(et[s].some(x => x.classe === '<=5'), `${s} : l'hypothèse A* est à 5 mm de la pose finale inventée`);
  }
  assert.deepEqual(G.etiqueter(h, null).left.every(x => x === null), true, 'sans référence, pas d\'étiquette');
  assert.equal(G.classeDe(5), '<=5'); assert.equal(G.classeDe(5.01), '<=10'); assert.equal(G.classeDe(10), '<=10'); assert.equal(G.classeDe(10.01), '<=50'); assert.equal(G.classeDe(50.01), '>50');
});

test('ANTI-FUITE : la fonction des traits ne reçoit ni ne nomme la référence ; l\'étiquette ne change aucun trait', () => {
  const src = G.hypothesesDuCut.toString();
  for (const mot of ['humanFinalReference', 'referenceHumaine', 'etiquette', 'ecartMm', 'micRail', 'classeDe', 'finalState', 'operatorIntent', 'serverWrites'])
    assert.equal(src.includes(mot), false, `hypothesesDuCut ne mentionne pas « ${mot} »`);
  assert.deepEqual(Object.keys(G.hypothesesDuCut.length ? {} : {}), []);
  const h = hypotheses({ chaine: true });
  const avant = json(h);
  const a = G.etiqueter(h, { left: [0, 5, 5], right: [0, -5, 5] }), b = G.etiqueter(h, { left: [0, 40, -20], right: [0, 30, 10] });
  assert.equal(json(h), avant, 'étiqueter ne touche pas les hypothèses');
  assert.notEqual(json(a), json(b), 'deux références donnent deux étiquettes');
  assert.equal(json(h.rails.left.map(x => x.traits)), json(hypotheses({ chaine: true }).rails.left.map(x => x.traits)), 'les traits sont ceux d\'un second calcul');
});

/* Un Écho minimal : trois cuts consécutifs d'une partie, chacun avec sa pose de départ, sa validation et ses instants. */
function echoSynthetique({ refCut = [5, 5], refAvant = [3, 1], refApres = [6, 2], tAvant = '2026-01-01T10:00:20Z', tApres = '2026-01-01T10:05:00Z' } = {}) {
  const cap = F.capture({ cut: 5, origine: ORIGINE_ABS });
  const etat = (lat, vert) => ({ rails: Object.fromEntries(SIDES.map(s => [s, { positionSceneRelative: cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v + lat[s] / 1000 : i === 2 ? v + vert[s] / 1000 : v) }])) });
  const depart = () => ({ rails: { left: cap.rails.left, right: cap.rails.right } });
  const visite = (cut, t0, t1, ref) => ({ visitId: 'v' + cut, identity: { part: 91, cut }, startedAt: t0, endedAt: t1, beforeEstablished: depart(),
    initialObserved: depart(), lastObserved: ref ? etat(ref, ref) : depart(), humanFinalReference: ref ? { state: etat({ left: ref[0], right: ref[0] }, { left: ref[1], right: ref[1] }) } : null, serverWrites: [] });
  const cuts = [
    { partie: 91, cut: 4, visites: [visite(4, '2026-01-01T10:00:00Z', tAvant, refAvant)] },
    { partie: 91, cut: 5, visites: [visite(5, '2026-01-01T10:01:00Z', '2026-01-01T10:02:00Z', refCut)] },
    { partie: 91, cut: 6, visites: [visite(6, '2026-01-01T10:04:00Z', tApres, refApres)] },
  ];
  return { cuts, cap };
}
const vois = (verifiees, cut, t0) => G.voisinsSursA(verifiees, 91, cut, t0);
const verifier = parCut => G.posesVerifiees(parCut, { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine });

test('ANTI-FUITE (voisins) : la pose finale du cut lui-même n\'entre pas ; un voisin validé après la première visite n\'entre pas ; avant, il entre', () => {
  const t0 = Date.parse('2026-01-01T10:01:00Z');
  const A = echoSynthetique({ refCut: [8, -3], refAvant: [3, 1], refApres: [6, 2] }), B = echoSynthetique({ refCut: [-40, 20], refAvant: [3, 1], refApres: [6, 2] });
  const va = vois(verifier(A.cuts), 5, t0), vb = vois(verifier(B.cuts), 5, t0);
  assert.equal(json(va), json(vb), 'la référence du cut ne change pas ses voisins sûrs');
  assert.deepEqual(va.map(a => a.identity.cut), [4], 'cut 4 validé à 10:00:20 (avant 10:01:00) ; cut 6 validé à 10:05 (après) exclu ; le cut lui-même exclu');
  const C = echoSynthetique({ refCut: [8, -3], refAvant: [3, 1], refApres: [-99, 50] });
  assert.equal(json(vois(verifier(C.cuts), 5, t0)), json(va), 'changer la pose d\'un voisin validé APRÈS la première visite ne change rien');
  const D = echoSynthetique({ refCut: [8, -3], refAvant: [11, 7], refApres: [6, 2] });
  assert.notEqual(json(vois(verifier(D.cuts), 5, t0)), json(va), 'changer la pose d\'un voisin validé AVANT change l\'appui');
  /* Le lot : une pose de départ validée par le lot compte, quel que soit le moment ; l'humain avant l'emporte, après il s'efface. */
  const lot = G.posesVerifiees(B.cuts, { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine, lotValide: new Set([6]) });
  const v6 = vois(lot, 5, t0).find(a => a.identity.cut === 6);
  assert.ok(v6 && v6.source === 'lot', 'cut 6 : validé par le lot, pose de départ');
  assert.deepEqual(v6.positions.left, B.cap.rails.left.positionSceneRelative, 'la pose du lot est la pose de départ, pas la validation de l\'opérateur');
  assert.equal(vois(lot, 5, t0).find(a => a.identity.cut === 4).source, 'humain');
});

test('ANTI-FUITE (de bout en bout) : l\'observateur donne les mêmes hypothèses quelle que soit la pose finale du cut ; les lignes ne diffèrent que par l\'étiquette', () => {
  const sortie = (refCut) => {
    const E = echoSynthetique({ refCut });
    const obs = G.creerObservateur({ partie: 91, moteur });
    obs.debut({ parCut: E.cuts, ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine });
    const { entree, brut } = brutDuCut({ cut: 5, appuis: appuisChaine(E.cap, 5) });
    const o = { partie: 91, cut: 5, visites: 1, ariane: { etat: 'calcule' }, mic: { ref: 'validation', rails: { left: [0, refCut[0], 0], right: [0, refCut[1], 0] } } };
    obs.cut({ c: E.cuts[1], v0: E.cuts[1].visites[0], o, entree, brut });
    const lignes = G.lignesDuJeu({ designation: '9:91', jeu: 'apprentissage', observateur: obs, cas: [o], zones: new Map([[5, { zone: 'pn', genre: 'vert' }]]) });
    return { obs, lignes };
  };
  const a = sortie([8, -3]), b = sortie([-40, 20]);
  assert.equal(a.obs.etat.erreurs, 0);
  assert.ok(a.obs.etat.cuts[0].hyp, 'des hypothèses sont calculées');
  const sansEtiquette = ls => ls.map(l => { const { etiquette, micRailMm, ...reste } = l; return reste; });
  assert.equal(json(sansEtiquette(a.lignes)), json(sansEtiquette(b.lignes)), 'toutes les lignes, étiquettes retirées, sont identiques : traits, origines, décalages, rôle, zone');
  const hypA = a.lignes.filter(l => l.type === 'hyp'), hypB = b.lignes.filter(l => l.type === 'hyp');
  assert.ok(hypA.length >= 8, `${hypA.length} hypothèses`);
  assert.notEqual(json(hypA.map(l => l.etiquette)), json(hypB.map(l => l.etiquette)), 'seules les étiquettes changent');
  const cut = a.lignes.find(l => l.type === 'cut');
  assert.equal(cut.zone, 'pn'); assert.equal(cut.role, 'vert'); assert.equal(cut.etiquette.grosse, false);
  assert.equal(a.lignes[0].type, 'entete'); assert.equal(a.lignes[0].jeu, 'apprentissage');
  assert.equal(json(a.lignes).includes('458559'), false, 'pas de coordonnée absolue dans le jeu');
  /* Les voisins vus par ce cut sont ceux d'avant sa première visite (cut 4 seulement). */
  assert.equal(hypA.find(l => l.origine === 'H4' || l.origines.includes('H4')) !== undefined, true);
  assert.equal(cut.contexte.voisins.n, 1);
});

test('rappel atteignable : paire à 10 et à 5 mm, par zone et par origine, abstentions rattrapées', () => {
  const hyp = (cut, rail, o, d, hauteur = false, sous = null) => ({ type: 'hyp', partie: '9:1', cut, rail, origine: o, sous: sous || o, origines: [o], sousOrigines: [sous || o], hauteur, decal: [0, 0, 0], etiquette: { ecartMm: d, classe: '' } });
  const cut = (c, zone, mic, abstenu, nh = true) => ({ type: 'cut', partie: '9:1', cut: c, zone, role: 'vert', etat: 'calcule', etiquette: { mic: { left: [0, mic, 0], right: [0, 0, 0] }, micMaxMm: mic }, moteur: { abstenu, ecartementRejete: false },
    nHyp: nh ? { left: 3, right: 1 } : null, tronques: null, tronquesPoses: null });
  const lignes = [
    cut(1, 'pn', 30, false), hyp(1, 'left', 'H1', 2), hyp(1, 'left', 'H0', 30), hyp(1, 'right', 'H0', 0),                                  // atteint par H1
    cut(2, 'pn', 30, true), hyp(2, 'left', 'H2', 4, false, 'strong-ecartee'), hyp(2, 'right', 'H0', 0),                                       // abstention rattrapée par H2 STRONG écartée
    cut(3, 'adv', 30, false), hyp(3, 'left', 'H3', 12), hyp(3, 'left', 'H2', 11, true, 'comp'), hyp(3, 'right', 'H0', 0),                     // hors de 10 mm (la hauteur n'y change rien)
    cut(4, 'adv', 30, false), hyp(4, 'left', 'H2', 20, false, 'comp'), hyp(4, 'left', 'H2', 8, true, 'comp'), hyp(4, 'right', 'H0', 0),      // atteint seulement avec la hauteur
    cut(5, 'abords', 3, false), hyp(5, 'left', 'H0', 3), hyp(5, 'right', 'H0', 0),                                                          // correction de 3 mm : ne compte pas
    { ...cut(6, 'abords', 40, false, false), etat: 'sans-nuage' },                                                                          // grosse correction sans nuage : perdue, comptée dans le brut
  ];
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const f = path.join(os.tmpdir(), `gcv2-jeu-rappel-${process.pid}.jsonl`);
  fs.writeFileSync(f, lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
  const R = G.rappel(G.lireJeux([f])); fs.unlinkSync(f);
  assert.equal(R.comptes.grosses, 4);
  assert.equal(R.sansNuage.grosses, 1); assert.deepEqual([R.brut['plus-de-10-mm'].a10.k, R.brut['plus-de-10-mm'].a10.n], [3, 5], 'brut : le cut sans nuage reste au dénominateur');
  assert.deepEqual([R.global['plus-de-10-mm'].paire.a10.k, R.global['plus-de-10-mm'].paire.a10.n], [3, 4], 'cuts 1, 2 et 4 atteints');
  assert.deepEqual([R.global['plus-de-10-mm'].paire.a5.k, R.global['plus-de-10-mm'].paire.a5.n], [2, 4], 'à 5 mm : cuts 1 et 2');
  assert.deepEqual([R.parZone.pn['plus-de-10-mm'].paire.a10.k, R.parZone.pn['plus-de-10-mm'].paire.a10.n], [2, 2]);
  assert.deepEqual([R.parZone.adv['plus-de-10-mm'].paire.a10.k, R.parZone.adv['plus-de-10-mm'].paire.a10.n], [1, 2]);
  assert.equal(R.parOrigine['H0 + H1 (A* du moteur)']['plus-de-10-mm'].global.a10.k, 1);
  assert.equal(R.parOrigine['H0 + H2 STRONG écartées']['plus-de-10-mm'].global.a10.k, 1);
  assert.equal(R.apportMarginal['plus-de-10-mm']['sans hauteur apprise'].apport, 1, 'la hauteur apprise ajoute le cut 4');
  assert.equal(R.apportMarginal['plus-de-10-mm']['sans H2 STRONG écartées'].apport, 1, 'les STRONG écartées ajoutent le cut 2');
  assert.equal(R.abstentions.grosses, 1); assert.equal(R.abstentions.rattrapees['H0 + H2 STRONG écartées'].a10.k, 1);
});

test('manifeste : un jeu d\'apprentissage refuse les témoins et les parties réservées ; le jeu de jugement ne prend que des parties réservées', () => {
  assert.throws(() => G.controlerManifeste({ projet: 1, partie: 11, jugerReservee: false }), /réservée/);
  assert.throws(() => G.controlerManifeste({ projet: 1, partie: 25, jugerReservee: false }), /réservée/);
  assert.throws(() => G.controlerManifeste({ projet: 1, partie: 999, jugerReservee: false }), /réservée/);
  const ok = G.controlerManifeste({ projet: 1, partie: 14, jugerReservee: false });
  assert.equal(ok.jeu, 'apprentissage'); assert.equal(ok.temoin, false);
  const j = G.controlerManifeste({ projet: 1, partie: 11, jugerReservee: true });
  assert.equal(j.jeu, 'jugement'); assert.equal(j.temoin, true); assert.match(j.avis, /sans réglage/);
  assert.throws(() => G.controlerManifeste({ projet: 1, partie: 14, jugerReservee: true }), /en apprentissage/, 'pas de mélange des deux jeux');
});

test('chaîne de lecture : le moteur change, l\'outil refuse (ancre unique)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'gcv1-shadow.js'), 'utf8');
  assert.equal(src.split('return {ok:true,side,').length, 2, 'l\'ancre du réservoir est unique dans src/gcv1-shadow.js');
  const { decideCut } = L; assert.equal(typeof decideCut, 'function');
});

test('ligne de commande : les témoins 1:11 et 1:25 et une partie inconnue sont refusés avant toute lecture, sans l\'option', () => {
  const { spawnSync } = require('node:child_process'), path = require('node:path');
  const outil = path.join(__dirname, '..', 'tools', 'gcv2-jeu.cjs');
  for (const partie of ['1:11', '1:25', '1:998', '3:1']) {
    const r = spawnSync(process.execPath, [outil, 'construire', '--partie', partie, '--echo', '/dossier/qui/nexiste/pas', '--sans-lot', '--sortie', '/tmp/ne-doit-pas-exister.jsonl'], { encoding: 'utf8' });
    assert.equal(r.status, 1, partie);
    assert.match(r.stderr, /réservée/, partie);
    assert.equal(require('node:fs').existsSync('/tmp/ne-doit-pas-exister.jsonl'), false);
  }
  const r = spawnSync(process.execPath, [outil, 'construire', '--partie', '1:14', '--echo', '/dossier/qui/nexiste/pas', '--sans-lot', '--sortie', '/tmp/ne-doit-pas-exister.jsonl', '--juger-partie-reservee'], { encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /en apprentissage/, 'le jeu de jugement refuse une partie d\'apprentissage');
});
