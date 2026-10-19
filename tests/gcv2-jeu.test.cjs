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
/* Un voisin vérifié : pose du rail à (lat, vert) mm de la pose de départ du cut de l'essai ; son décalage depuis la pose d'ESV (H6) est (lat, vert),
 * ou `decalage` s'il est donné ({ left: [lat, vert], right: [lat, vert] }). */
function voisinA(cap, cut, lat, vert, source = 'humain', decalage = null) {
  return { identity: { part: 91, cut, frameId: null }, stage: 'verifie', source,
    positions: Object.fromEntries(SIDES.map(s => [s, cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v + lat / 1000 : i === 2 ? v + vert / 1000 : v)])),
    decalage: decalage || { left: [lat, vert], right: [lat, vert] } };
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

/* ------------------------------------------------------------------ H6 « voie décalée » (D-207) */
const h6De = (h, s, sous) => h.rails[s].find(x => !x.hauteur && x.sousOrigines.includes(sous));

test('H6 : la pose d\'ESV translatée du décalage du voisin sûr le plus proche, et de la médiane des voisins ; rail par rail et paire ; source marquée', () => {
  const cap = F.capture({ cut: 5, origine: ORIGINE_ABS });
  /* Trois voisins humains : cut 4 (140, 10 | 120, 12), cut 7 (150, 8 | 130, 6), cut 2 (160, 9 | 100, 9) ; un voisin du lot au cut 9 (90, 0 | 90, 0). */
  const v = [voisinA(cap, 4, 0, 0, 'humain', { left: [140, 10], right: [120, 12] }), voisinA(cap, 7, 0, 0, 'humain', { left: [150, 8], right: [130, 6] }),
    voisinA(cap, 2, 0, 0, 'humain', { left: [160, 9], right: [100, 9] }), voisinA(cap, 9, 0, 0, 'lot', { left: [90, 0], right: [90, 0] })];
  const h = hypotheses({ cut: 5, voisins: v });
  const eq = (x, y, m) => assert.deepEqual(x.map(n => Math.round(n * 100) / 100), y, m);
  eq(h6De(h, 'left', 'h6-humain-proche-rail').decal, [0, 140, 10], 'voisin le plus proche (cut 4), rail gauche');
  eq(h6De(h, 'right', 'h6-humain-proche-rail').decal, [0, 120, 12], 'rail droit : son propre décalage');
  eq(h6De(h, 'left', 'h6-humain-proche-paire').decal, [0, 130, 11], 'paire : la moyenne des deux rails du voisin, aux deux rails');
  eq(h6De(h, 'right', 'h6-humain-proche-paire').decal, [0, 130, 11]);
  eq(h6De(h, 'left', 'h6-humain-mediane-rail').decal, [0, 145, 8.5], 'médiane des quatre voisins à 10 cuts au plus (lot compris)');
  eq(h6De(h, 'left', 'h6-lot-proche-rail').decal, [0, 90, 0], 'famille du lot : le seul voisin du lot');
  assert.equal(h.rails.left.some(x => x.sousOrigines.includes('h6-lot-mediane-rail')), false, 'un seul voisin du lot : pas de médiane');
  const x = h6De(h, 'left', 'h6-humain-proche-rail');
  assert.equal(x.origine === 'H6' || x.origines.includes('H6'), true);
  assert.equal(x.traits.h6DistCuts, 1); assert.equal(x.traits.h6NVoisins, 1); assert.equal(x.traits.h6AmpleurMm, Math.round(Math.hypot(140, 10) * 100) / 100);
  assert.equal(x.traits.h6DispersionMm, 70, 'accord entre voisins : étendue du latéral gauche des quatre voisins (90 à 160)');
  assert.equal(x.traits.h6DansReservoir, false, 'à 140 mm, pas de cellule du réservoir : perte et lignes inconnues');
  assert.equal(x.traits.h6Perte, null); assert.equal(x.traits.h6LignesSommet, null);
  for (const s of SIDES) assert.ok(h.rails[s].filter(y => !y.hauteur).length <= G.MAX_HYP, 'plafond de 12 poses par rail');
  /* Voie de référence de la série : médiane rail par rail, sûre si l'étendue latérale tient en 50 mm. */
  assert.equal(h.voieH6.tous.n, 4); assert.deepEqual(h.voieH6.tous.left, [145, 8.5]); assert.equal(h.voieH6.tous.sure, false, 'étendue de 70 mm à gauche : référence non sûre');
  assert.equal(h.voieH6.lot, null, 'un seul voisin du lot : pas de référence');
  /* Hors de la fenêtre de 10 cuts : rien. */
  const loin = hypotheses({ cut: 5, voisins: [voisinA(cap, 16, 0, 0, 'humain', { left: [140, 10], right: [120, 12] })] });
  assert.equal(loin.rails.left.some(y => y.origines.includes('H6')), false, 'voisin à 11 cuts : pas de H6');
});

test('H6 : sûreté de la référence, pose de départ posée par le lot, pose d\'ESV inconnue, mesures sur la capture translatée', () => {
  const cap = F.capture({ cut: 5, origine: ORIGINE_ABS }), base = brutDuCut({ cut: 5, appuis: [] }).brut, science = moteur.scientificProposeBoth(base.capture);
  const v = [voisinA(cap, 4, 0, 0, 'lot', { left: [140, 10], right: [120, 12] }), voisinA(cap, 6, 0, 0, 'lot', { left: [160, 8], right: [140, 6] })];
  const appel = departEsv => G.hypothesesDuCut({ capture: base.capture, science, seul: base.seul, chaine: null, appuisAvant: [], voisins: v, gMed: 1450, departEsv });
  const a = appel(null);
  assert.deepEqual(a.voieH6.lot.left, [150, 9], 'médiane des deux appuis');
  assert.equal(a.voieH6.lot.sure, false, 'la capture n\'a aucun rail à 150 mm : pas de support local, référence non sûre');
  assert.ok(a.voieH6.lot.motifs.includes('sans-support-local') && a.voieH6.lot.motifs.includes('voie-concurrente-au-depart'), a.voieH6.lot.motifs.join());
  assert.deepEqual(a.voieH6.tous, a.voieH6.lot, 'sans voisin humain, les deux familles sont les mêmes');
  assert.equal(a.rails.left.some(y => y.sousOrigines.some(o => o.startsWith('h6-humain'))), false, 'aucune H6 humaine sans voisin humain');
  /* Le lot a posé ce cut : la pose d'ESV d'origine est à (−30, 2) mm de sa pose de départ ; H6 part de là. */
  const b = appel({ left: [0, -30, 2], right: [0, -30, 2] });
  assert.deepEqual(h6De(b, 'left', 'h6-lot-proche-rail').decal, [0, 110, 12], 'pose d\'ESV d\'origine + décalage du voisin');
  assert.deepEqual(b.voieH6.lot.left, [120, 11]); assert.equal(b.voieH6.departLot, true);
  const c = appel(false);
  assert.equal(c.rails.left.some(y => y.origines.includes('H6')), false, 'pose d\'ESV inconnue : pas de H6'); assert.equal(c.voieH6, null);
  /* Mesures : un rail réel à 212 mm n'est pas vu par la bande de ±180 mm autour du départ ; il l'est sur la capture translatée. */
  const capLoin = F.capture({ cut: 5 }), rnd = F.alea(3), y0 = capLoin.rails.left.positionSceneRelative[1];
  const pts = []; for (let i = 0; i < 40; i++) pts.push([0, y0 + 0.212 + 0.015 + i * 0.035 / 39, -0.004 + (rnd() - 0.5) * 0.0008]);
  for (let i = 0; i < 11; i++) pts.push([0, y0 + 0.212 + (rnd() - 0.5) * 0.0008, -0.016 - i * 0.002]);
  const capT = { ...capLoin, pointsSceneRelative: pts, visibleByClipBoxes: pts.map(() => true) };
  const H = require('../src/hauteur-apprise.js'), direct = H.signalRail(capT, { rails: { left: { conventionCalibration: null } } }, 'left', L.positionOf(capT.rails.left, [0, 0.212, -0.004]));
  const tr = G.mesuresTranslatees(capT, 'left', [0, 212, -4], null);
  assert.ok(!(direct.pointsDessus > 0), 'mesure directe : rien à 212 mm');
  assert.ok(tr.sig.pointsDessus >= 30 && tr.sig.pointsFlanc >= 8, `capture translatée : ${tr.sig.pointsDessus} points du dessus, ${tr.sig.pointsFlanc} du flanc`);
  const pres = G.mesuresTranslatees(capT, 'left', [0, 3, -1], null), pres0 = H.signalRail(capT, { rails: { left: { conventionCalibration: null } } }, 'left', L.positionOf(capT.rails.left, [0, 0.003, -0.001]));
  assert.deepEqual([pres.sig.pointsDessus, pres.sig.pointsFlanc], [pres0.pointsDessus, pres0.pointsFlanc], 'près du départ, les deux mesures sont les mêmes');
});

test('H6 : le décalage d\'un voisin se lit depuis la pose d\'ESV d\'origine (journal du lot pour un cut posé par le lot)', () => {
  const E = echoSynthetique({ refAvant: [140, 10] });
  const sans = G.posesVerifiees(E.cuts, { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine });
  assert.deepEqual(sans.find(p => p.cut === 4).decalage, { left: [140, 10], right: [140, 10] }, 'cut 4 (vert) : pose finale − pose de départ');
  /* Le lot a posé le cut 4 ; la pose d'ESV d'origine était 25 mm plus à gauche et 3 mm plus bas que sa pose de départ (celle du lot). */
  const ini = Object.fromEntries(SIDES.map(s => [s, E.cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v - 0.025 : i === 2 ? v - 0.003 : v)]));
  const lot = G.posesVerifiees(E.cuts, { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine, lotValide: new Set([4]), initialesLot: new Map([[4, ini]]) });
  assert.deepEqual(lot.filter(p => p.cut === 4).map(p => [p.source, p.decalage.left]), [['humain', [165, 13]], ['lot', [25, 3]]], 'humain : finale − ESV ; lot : pose du lot − ESV');
  const inconnu = G.posesVerifiees(E.cuts, { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine, lotValide: new Set([4]) });
  assert.ok(inconnu.filter(p => p.cut === 4).every(p => p.decalage === null), 'cut posé par le lot sans pose d\'ESV connue : aucun décalage');
});

/* Lignes du jeu pour le cut 5 de l'Écho synthétique (observateur de bout en bout). */
function lignesH6(opts, { lotValide = new Set(), initialesLot = new Map(), usage = 'relecture', retirerHumains = false } = {}) {
  const E = echoSynthetique(opts);
  /* Supprimer tous les appuis humains : les autres cuts n'ont plus aucune validation de l'opérateur. */
  if (retirerHumains) for (const c of E.cuts) if (c.cut !== 5) for (const v of c.visites) { v.humanFinalReference = null; v.lastObserved = v.beforeEstablished; }
  const obs = G.creerObservateur({ partie: 91, moteur, lotValide, initialesLot });
  obs.debut({ parCut: E.cuts, ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine });
  const { entree, brut } = brutDuCut({ cut: 5, appuis: appuisChaine(E.cap, 5) });
  const ref = opts.refCut || [5, 5];
  const o = { partie: 91, cut: 5, visites: 1, ariane: { etat: 'calcule' }, mic: { ref: 'validation', rails: { left: [0, ref[0], ref[1]], right: [0, ref[0], ref[1]] } } };
  obs.cut({ c: E.cuts[1], v0: E.cuts[1].visites[0], o, entree, brut });
  assert.equal(obs.etat.erreurs, 0);
  return G.lignesDuJeu({ designation: '9:91', jeu: 'apprentissage', observateur: obs, cas: [o], zones: new Map([[5, { zone: 'abords', genre: 'differe' }]]), usage });
}
const sansEtiq = ls => ls.map(l => { const { etiquette, micRailMm, ...reste } = l; return reste; });
const lignesH6Seules = ls => ls.filter(l => l.type === 'hyp' && l.origines.includes('H6'));

test('ANTI-FUITE H6 (1) : changer la pose finale du cut ne change aucune ligne H6, étiquette mise à part', () => {
  const a = lignesH6({ refCut: [150, 12], refAvant: [140, 10] }), b = lignesH6({ refCut: [-60, -20], refAvant: [140, 10] });
  const ha = lignesH6Seules(a), hb = lignesH6Seules(b);
  assert.ok(ha.length >= 2, `${ha.length} lignes H6 (une par rail au moins)`);
  assert.ok(ha.some(l => l.decal[1] === 140 && l.sousOrigines.includes('h6-humain-proche-rail')), 'H6 = décalage du cut 4, validé avant');
  assert.equal(json(sansEtiq(ha)), json(sansEtiq(hb)), 'lignes H6 identiques, étiquettes retirées');
  assert.equal(json(sansEtiq(a)), json(sansEtiq(b)), 'et toutes les lignes du cut aussi');
  assert.notEqual(json(ha.map(l => l.etiquette)), json(hb.map(l => l.etiquette)), 'seules les étiquettes changent');
  const cut = a.find(l => l.type === 'cut');
  assert.equal(cut.contexte.voieH6.tous, null, 'un seul voisin sûr : pas de voie de référence');
  assert.equal(json(a).includes('458559'), false, 'pas de coordonnée absolue');
});

test('ANTI-FUITE H6 (2) : un voisin validé APRÈS la première visite du cut ne change rien', () => {
  const a = lignesH6({ refAvant: [140, 10], refApres: [150, 9] }), b = lignesH6({ refAvant: [140, 10], refApres: [-220, 40] });
  assert.ok(lignesH6Seules(a).length >= 2);
  assert.equal(json(sansEtiq(a)), json(sansEtiq(b)), 'cut 6, validé à 10:05 (après 10:01) : aucune ligne ne change');
  /* Même règle quand le voisin d'après est validé plus tôt : il entre (il est alors un voisin sûr), ce qui prouve que l'essai n'est pas vide. */
  const c = lignesH6({ refAvant: [140, 10], refApres: [-220, 40], tApres: '2026-01-01T10:00:40Z' });
  assert.notEqual(json(sansEtiq(c)), json(sansEtiq(a)), 'validé avant la première visite, le cut 6 entre');
});

test('ANTI-FUITE H6 (3) : un voisin validé AVANT la première visite change H6 ; un voisin du lot compte toujours', () => {
  const a = lignesH6({ refAvant: [140, 10] }), b = lignesH6({ refAvant: [175, 4] });
  const da = lignesH6Seules(a).filter(l => !l.hauteur && l.rail === 'left' && l.sousOrigines.includes('h6-humain-proche-rail')).map(l => l.decal);
  const db = lignesH6Seules(b).filter(l => !l.hauteur && l.rail === 'left' && l.sousOrigines.includes('h6-humain-proche-rail')).map(l => l.decal);
  assert.deepEqual([da, db], [[[0, 140, 10]], [[0, 175, 4]]], 'le décalage du cut 4 passe dans H6');
  /* Le cut 6 validé par le lot (pose d'ESV d'origine 120 mm à droite de sa pose de départ) : la famille du lot existe, quel que soit l'instant. */
  const E = echoSynthetique({});
  const ini = Object.fromEntries(SIDES.map(s => [s, E.cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v - 0.120 : v)]));
  const l = lignesH6({ refAvant: [140, 10] }, { lotValide: new Set([6]), initialesLot: new Map([[6, ini]]) });
  const lot = lignesH6Seules(l).filter(x => !x.hauteur && x.rail === 'left' && x.sousOrigines.includes('h6-lot-proche-rail'));
  assert.deepEqual(lot.map(x => x.decal), [[0, 120, 0]], 'famille du lot : pose du lot − pose d\'ESV du cut 6');
  assert.ok(lignesH6Seules(l).some(x => x.sousOrigines.includes('h6-humain-mediane-rail')), 'famille « tous » : médiane des cuts 4 (humain) et 6 (lot)');
  const ref = l.find(x => x.type === 'cut').contexte.voieH6;
  assert.equal(ref.lot, null, 'un seul voisin du lot : pas de référence du lot'); assert.deepEqual(ref.tous.left, [130, 5]);
  assert.deepEqual(ref.tous.ancres, [{ cut: 4, source: 'humain' }, { cut: 6, source: 'lot' }], 'appuis datés et identifiés');
});

test('rappel : H6 avant et après, usage lot sans voisins humains, sélections nommées', () => {
  const hyp = (cut, rail, o, d, sous = o) => ({ type: 'hyp', partie: '2:1', cut, rail, origine: o, sous, origines: [o], sousOrigines: [sous], hauteur: false, decal: [0, 0, 0], etiquette: { ecartMm: d, classe: '' } });
  const cut = (c, zone) => ({ type: 'cut', partie: '2:1', cut: c, zone, role: 'differe', etat: 'calcule', etiquette: { mic: { left: [0, 150, 0], right: [0, 150, 0] }, micMaxMm: 150 }, moteur: { abstenu: true, ecartementRejete: false },
    nHyp: { left: 2, right: 2 }, tronques: null, tronquesPoses: null });
  const lignes = [
    cut(300, 'abords'), hyp(300, 'left', 'H0', 150), hyp(300, 'left', 'H6', 4, 'h6-lot-proche-rail'), hyp(300, 'right', 'H0', 150), hyp(300, 'right', 'H6', 6, 'h6-lot-proche-rail'),
    cut(301, 'abords'), hyp(301, 'left', 'H0', 150), hyp(301, 'left', 'H6', 4, 'h6-humain-proche-rail'), hyp(301, 'right', 'H0', 150), hyp(301, 'right', 'H6', 6, 'h6-humain-proche-rail'),
    cut(302, 'adv'), hyp(302, 'left', 'H0', 150), hyp(302, 'left', 'H4', 3, 'voisins-humains'), hyp(302, 'right', 'H0', 150), hyp(302, 'right', 'H4', 3, 'voisins-humains'),
  ];
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const f = path.join(os.tmpdir(), `gcv2-jeu-h6-${process.pid}.jsonl`);
  fs.writeFileSync(f, lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
  const R = G.rappel(G.lireJeux([f]), { selections: { zone2: G.lireSelection('2:1:300-301') } }); fs.unlinkSync(f);
  const g = R.avantApres.global;
  assert.deepEqual([g.avant.k, g.apres.k, g.lotAvant.k, g.lotApres.k, g.n], [1, 3, 0, 1, 3], 'avant : H4 humain seul ; après : + deux H6 ; au lot : la H6 du lot seule');
  assert.deepEqual([R.avantApres.selections.zone2.grosses.avant.k, R.avantApres.selections.zone2.grosses.apres.k, R.avantApres.selections.zone2.cutsJugeables], [0, 2, 2]);
  assert.equal(R.parOrigine['H0 + H6 voisins du lot seuls']['plus-de-10-mm'].global.a10.k, 1);
  assert.equal(R.apportMarginal['plus-de-10-mm']['sans H6'].apport, 2);
  assert.throws(() => G.lireSelection('2:1:a-b'), /illisible/);
});

/* ------------------------------------------------------------------ audit F3 et H1 : jeu « lot » sans appui humain ; garde de série, essais adverses */
test('ANTI-FUITE lot (audit F3) : modifier ou supprimer tous les appuis humains ne change aucune ligne du jeu « lot »', () => {
  const E0 = echoSynthetique({});
  const ini = Object.fromEntries(SIDES.map(s => [s, E0.cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v - 0.120 : v)]));
  const opt = extra => ({ lotValide: new Set([6]), initialesLot: new Map([[6, ini]]), ...extra });
  const base = lignesH6({ refAvant: [140, 10] }, opt({ usage: 'lot' }));
  const variantes = [lignesH6({ refAvant: [-30, 25] }, opt({ usage: 'lot' })), lignesH6({ refAvant: [140, 10], refApres: [5, -60], tApres: '2026-01-01T10:00:40Z' }, opt({ usage: 'lot' })),
    lignesH6({ refAvant: [140, 10] }, opt({ usage: 'lot', retirerHumains: true }))];
  for (const v of variantes) assert.equal(json(sansEtiq(v)), json(sansEtiq(base)), 'jeu lot : mêmes lignes, octet pour octet, étiquettes retirées');
  assert.equal(base[0].usage, 'lot');
  const hyp = base.filter(l => l.type === 'hyp');
  assert.ok(hyp.some(l => l.sousOrigines.includes('h6-lot-proche-rail')), 'la H6 du lot est là');
  assert.equal(hyp.some(l => l.sousOrigines.some(x => x === 'voisins-humains' || x.startsWith('h6-humain-'))), false, 'aucune origine humaine');
  /* L'essai n'est pas vide : le jeu de relecture, lui, change avec l'appui humain d'avant. */
  assert.notEqual(json(sansEtiq(lignesH6({ refAvant: [140, 10] }, opt({})))), json(sansEtiq(lignesH6({ refAvant: [-30, 25] }, opt({})))));
});

/* Capture dont les deux rails réels sont à `mm` (latéral) de la pose de départ ; `double` : rails réels au départ ET à `mm` (deux voies). */
function captureDecalee(mm, { double = false } = {}) {
  const cap = F.capture({ cut: 5, origine: ORIGINE_ABS }), dep = cap.pointsSceneRelative.map(p => [p[0], p[1] + mm / 1000, p[2]]);
  const pts = double ? [...cap.pointsSceneRelative, ...dep] : dep;
  return { ...cap, pointsSceneRelative: pts, visibleByClipBoxes: pts.map(() => true) };
}
function voieDe(cap, voisins, { appuis = [] } = {}) {
  const entree = { identity: cap.identity, rails: cap.rails, points: cap.pointsSceneRelative, visible: cap.visibleByClipBoxes };
  let brut = null; RA.poseAriane(entree, { appuis: { liste: appuis.slice() }, rappel: b => { brut = b; } });
  return G.hypothesesDuCut({ capture: brut.capture, science: moteur.scientificProposeBoth(brut.capture), seul: brut.seul, chaine: brut.chaine, appuisAvant: brut.appuisAvant, voisins, gMed: 1450 });
}
const ancre = (cut, lat, source = 'lot') => voisinA(F.capture({ cut: 5, origine: ORIGINE_ABS }), cut, 0, 0, source, { left: [lat, 0], right: [lat, 0] });

test('garde de série (audit H1) : une référence sûre exige deux appuis concordants, proches, et le support local des deux rails', () => {
  const v = voieDe(captureDecalee(150), [ancre(4, 148), ancre(6, 152)]).voieH6.lot;
  assert.deepEqual(v.motifs, [], 'voie réellement décalée de 150 mm, deux appuis à 148 et 152 mm : sûre'); assert.equal(v.sure, true);
  assert.ok(v.support.reference.every(x => x.dessus >= G.H6.supportDessus && x.flanc >= G.H6.supportFlanc));
  assert.ok(v.support.depart.every(x => x.dessus < G.H6.supportDessus), 'rien au départ : pas de voie concurrente');
});

test('garde de série, essais adverses : mauvaise branche, voie concurrente, appuis contradictoires, premier cut sans ancre, fin du décalage, propagation longue, rupture', () => {
  const motifs = (cap, v) => { const r = voieDe(cap, v).voieH6.lot; return r ? (r.sure ? [] : r.motifs) : null; };
  /* Appui sur la mauvaise branche : deux appuis concordants à 150 mm, mais la voie réelle de ce cut n'a pas bougé. */
  assert.ok(motifs(captureDecalee(0), [ancre(4, 150), ancre(6, 150)]).includes('sans-support-local'), 'mauvaise branche : pas de rail à la référence');
  /* Voie concurrente : une voie au départ ET une à 150 mm. */
  assert.deepEqual(motifs(captureDecalee(150, { double: true }), [ancre(4, 150), ancre(6, 150)]), ['voie-concurrente-au-depart']);
  /* Appuis contradictoires : 150 mm et 20 mm. */
  assert.ok(motifs(captureDecalee(150), [ancre(4, 150), ancre(6, 20)]).includes('appuis-contradictoires'));
  /* Premier cut sans ancre, ou un seul appui : pas de référence sûre. */
  assert.equal(voieDe(captureDecalee(150), []).voieH6.lot, null, 'aucun appui : pas de référence');
  assert.equal(voieDe(captureDecalee(150), [ancre(4, 150)]).voieH6.lot, null, 'un seul appui : pas de médiane, pas de référence');
  /* Fin du décalage : les appuis d'amont sont à 150 mm, la voie de ce cut est revenue au départ. */
  assert.ok(motifs(captureDecalee(0), [ancre(3, 150), ancre(4, 150)]).includes('sans-support-local'), 'fin du décalage : abstention');
  /* Propagation longue : le plus proche appui est à 6 cuts. */
  assert.ok(motifs(captureDecalee(150), [ancre(11, 150), ancre(12, 150)]).includes('appui-trop-loin'));
  /* Rupture de série : une ADV entre l'appui et le cut. */
  const v = voieDe(captureDecalee(150), [ancre(3, 150), ancre(4, 150)]).voieH6.lot;
  assert.equal(v.sure, true);
  const z = new Map([[3, { zone: 'abords' }], [4, { zone: 'adv' }], [5, { zone: 'abords' }]]);
  assert.deepEqual([G.avecRupture(v, 5, z).sure, G.avecRupture(v, 5, z).motifs], [false, ['rupture-de-serie']]);
  assert.equal(G.avecRupture(v, 5, new Map([[3, { zone: 'abords' }], [4, { zone: 'abords' }], [5, { zone: 'abords' }]])).sure, true, 'sans ADV entre eux : pas de rupture');
});

test('garde de série : jamais une pose d\'Ariane comme appui (pas d\'auto-validation) ; les appuis sont ceux des poses vérifiées', () => {
  const cap = captureDecalee(150), voisins = [ancre(4, 148), ancre(6, 152)];
  /* Les poses que la chaîne d'Ariane vient de donner aux cuts d'avant (non vérifiées) ne changent pas la voie de référence. */
  const chaine = appuisChaine(cap, 5), autre = appuisChaine(cap, 5).map(a => ({ ...a, positions: Object.fromEntries(SIDES.map(s => [s, a.positions[s].map((x, i) => i === 1 ? x + 0.3 : x)])) }));
  const a = voieDe(cap, voisins, { appuis: chaine }).voieH6, b = voieDe(cap, voisins, { appuis: autre }).voieH6;
  assert.equal(json(a), json(b), 'la chaîne d\'Ariane n\'entre pas dans la voie de référence');
  assert.deepEqual(a.lot.ancres.map(x => x.cut), [4, 6], 'les appuis sont les poses vérifiées données');
  /* posesVerifiees ne connaît que les validations de l'opérateur et les poses validées par le lot. */
  const E = echoSynthetique({}), p = G.posesVerifiees(E.cuts, { ctx: { pagesPerdues: [], capturesParVisite: {} }, referenceHumaine: RA.referenceHumaine, lotValide: new Set([6]) });
  assert.ok(p.every(x => x.source === 'humain' || x.source === 'lot'));
});
