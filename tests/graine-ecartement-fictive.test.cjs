'use strict';
/* 5.0 (D-170, chantier P7, hypothèse « graine d'écartement sur pose fictive ») — src/graine-ecartement-fictive.js, sur un monde
 * SYNTHÉTIQUE : rails alignés sur les axes de la scène (latéral = y), moteur remplacé par un monde qui ne voit un rail que dans sa fenêtre
 * (±80 mm), comme le moteur livré. Les fonctions livrées de la décision (`positionOf`, `minimalCapture`) et de l'observateur
 * (`translated`) sont les vraies. Aucune donnée de terrain. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const C = require('../vendor/capture-core.js');
const G = require('../src/graine-ecartement-fictive.js');
const SIDES = ['left', 'right'];

/* Un rail de départ à l'ordonnée y (m) : repère profil = repère scène translaté. */
function rail(y, x = 0) {
  const p = [x, y, 0], M = C.translation(p);
  return { positionSceneRelative: p.slice(), profileOriginSceneRelative: p.slice(), profileLocalToSceneRelative: M, railLocalToSceneRelative: M.slice(),
    sceneRelativeToProfileLocal: C.inverse(M), profileContours: [] };
}
const captureDe = (yL, yR) => ({ identity: { part: 9, cut: 105, frameId: null }, rails: { left: rail(yL), right: rail(yR) }, pointsSceneRelative: [[0, 0, 0]], visibleByClipBoxes: [true] });
/* Le monde : pour chaque côté, les structures (ordonnées, m) que le moteur peut prendre pour ce rail ; il rend la plus proche de la pose
 * du rail si elle est dans la fenêtre, sinon un rail non résolu (flanc). */
function monde({ left = [], right = [], fenetre = 0.08 } = {}) {
  const st = { left, right }, appels = [];
  return {
    appels,
    scientificProposeBoth(capture) {
      appels.push(SIDES.map(s => capture.rails[s].positionSceneRelative[1]));
      const rails = {};
      for (const s of SIDES) {
        const y0 = capture.rails[s].positionSceneRelative[1];
        const y = st[s].slice().sort((a, b) => Math.abs(a - y0) - Math.abs(b - y0))[0];
        rails[s] = y !== undefined && Math.abs(y - y0) <= fenetre + 1e-12 ? { ok: true, next: { status: 'candidate', delta: [0, y - y0, 0] } }
          : { ok: true, next: { status: 'unresolved', motif: 'flank' } };
      }
      return { rails };
    },
  };
}
const differe = { stage: 'deferred', positions: null, reason: 'no-anchor' };
const yDe = d => SIDES.map(s => Math.round(d.positions[s][1] * 1e4) / 1e4);
const proche = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

/* Le cas type du catalogue (« hors de portée ») : la voie vraie est à 200 mm de la pose d'ESV ; la pose de départ est FICTIVE (1 500 mm) ;
 * le moteur trouve le rail gauche (30 mm), le droit est à 95 mm de sa pose de départ, hors de la fenêtre. */
const vraiG = 0.9175, vraiD = vraiG - 1.435;
const depart = () => captureDe(vraiG - 0.03, vraiG - 0.03 - 1.5);
const posesVoisins = (g = 1.435) => [103, 104, 106, 107].map(cut => ({ identity: { part: 9, cut, frameId: null }, positions: { left: [0, 0.7, 0], right: [0, 0.7 - g, 0] }, differe: false }));

test('pose fictive : écartement de 1 500 mm à 0,5 mm près, et rien d\'autre', () => {
  const p = d => ({ left: [0, 0, 0], right: [0, -d / 1000, 0] });
  assert.equal(G.estFictive(p(1500)), true);
  assert.equal(G.estFictive(p(1500.4)), true);
  assert.equal(G.estFictive(p(1500.6)), false);
  assert.equal(G.estFictive(p(1437)), false);
  assert.equal(G.estFictive(null), false);
  assert.equal(G.estFictive({ left: [0, 0, 0] }), false);
});

test('écartement de référence : médiane des poses actuelles des voisins sûrs, sinon médiane de la partie, sinon rien', () => {
  const id = { part: 9, cut: 105, frameId: null };
  const pose = (cut, g, o = {}) => ({ identity: { part: 9, cut, frameId: null, ...(o.identity || {}) }, positions: { left: [0, 0.7, 0], right: [0, 0.7 - g / 1000, 0] }, differe: false, ...o });
  const r = G.ecartementReference({ identity: id, poses: [pose(103, 1433), pose(104, 1437), pose(106, 1441), pose(105, 1400), pose(111, 1400), pose(102, 1400, { differe: true }),
    pose(107, 1500), pose(108, 1400, { identity: { part: 8 } }), pose(109, 1400, { identity: { frameId: 'autre' } }), pose(101, 1400, { differe: undefined })], gPartie: 1430 });
  assert.equal(r.source, 'voisins'); assert.equal(r.n, 3); assert.ok(proche(r.mm, 1437, 1e-6), String(r.mm));
  const p = G.ecartementReference({ identity: id, poses: [pose(102, 1400, { differe: true })], gPartie: 1430 });
  assert.deepEqual(p, { mm: 1430, source: 'partie', n: 0 });
  assert.deepEqual(G.ecartementReference({ identity: id, poses: [], gPartie: null }), { mm: null, source: null, n: 0 });
});

test('coupée par défaut : la décision de la chaîne est rendue telle quelle, le moteur n\'est pas relancé', () => {
  const w = monde({ left: [vraiG], right: [vraiD] }), cap = depart(), science = w.scientificProposeBoth(cap); w.appels.length = 0;
  const r = G.reprendre({ decision: differe, capture: cap, science, poses: posesVoisins(), gPartie: 1435, Shadow: w });
  assert.equal(r.decision, differe); assert.equal(r.tentative, null); assert.equal(w.appels.length, 0);
  assert.equal(G.DEFAUTS.actif, false);
});

test('ne s\'applique pas : chaîne qui pose, ou pose de départ NON fictive (garde contre les mauvaises voies)', () => {
  const w = monde({ left: [vraiG], right: [vraiD] }), cap = depart(), science = w.scientificProposeBoth(cap); w.appels.length = 0;
  const pose = { stage: 'window', positions: { left: [0, 1, 0], right: [0, -0.4, 0] } };
  const a = G.reprendre({ decision: pose, capture: cap, science, poses: posesVoisins(), gPartie: 1435, Shadow: w, options: { actif: true } });
  assert.equal(a.decision, pose); assert.equal(a.tentative, null);
  /* Même scène, pose de départ dans le contrat (1 437 mm) mais sur la mauvaise voie : jamais de graine. */
  const cap2 = captureDe(vraiG - 0.03, vraiG - 0.03 - 1.437), sc2 = w.scientificProposeBoth(cap2); w.appels.length = 0;
  const b = G.reprendre({ decision: differe, capture: cap2, science: sc2, poses: posesVoisins(), gPartie: 1435, Shadow: w, options: { actif: true } });
  assert.equal(b.decision, differe); assert.equal(b.tentative, null); assert.equal(w.appels.length, 0, 'moteur non relancé');
});

test('hors de portée : un rail trouvé, l\'autre replacé à l\'écartement des voisins ; le moteur relancé le trouve ; paire gardée, jamais appui', () => {
  const w = monde({ left: [vraiG], right: [vraiD] }), cap = depart(), science = w.scientificProposeBoth(cap);
  assert.equal(science.rails.left.next.status, 'candidate'); assert.equal(science.rails.right.next.status, 'unresolved', 'le rail droit est hors de la fenêtre');
  w.appels.length = 0;
  const avant = JSON.stringify({ cap, science });
  const r = G.reprendre({ decision: differe, capture: cap, science, poses: posesVoisins(), gPartie: 1430, Shadow: w, options: { actif: true } });
  assert.equal(w.appels.length, 1, 'une seule graine (un seul rail trouvé), une relance');
  assert.ok(proche(w.appels[0][1], vraiD, 1e-9), `graine du rail droit à l'écartement des voisins : ${w.appels[0][1]}`);
  assert.deepEqual(yDe(r.decision), [vraiG, Math.round(vraiD * 1e4) / 1e4]);
  assert.equal(r.decision.stage, G.ETAGE); assert.equal(r.decision.anchor, false, 'jamais un appui'); assert.equal(r.decision.post, G.POST);
  assert.equal(r.tentative.pose, true); assert.equal(r.tentative.reference.source, 'voisins'); assert.ok(proche(r.tentative.reference.mm, 1435, 1e-6));
  assert.deepEqual(r.tentative.essais.map(e => [e.depuis, e.garde]), [['left', 'ok']]);
  assert.ok(proche(r.tentative.essais[0].ecartementMm, 1435, 0.05));
  assert.equal(JSON.stringify({ cap, science }), avant, 'entrées non modifiées');
});

test('graine sans suite : le moteur relancé ne trouve pas l\'autre rail (hors de la capture) → la chaîne diffère toujours', () => {
  const w = monde({ left: [vraiG], right: [] }), cap = depart(), science = w.scientificProposeBoth(cap);
  const r = G.reprendre({ decision: differe, capture: cap, science, poses: posesVoisins(), gPartie: 1435, Shadow: w, options: { actif: true } });
  assert.equal(r.decision, differe); assert.equal(r.tentative.pose, false); assert.equal(r.tentative.reason, 'aucune-paire');
  assert.deepEqual(r.tentative.essais.map(e => e.garde), ['autre-rail-non-candidat']);
});

test('gardes de la paire : écartement dans le contrat et à 20 mm au plus de la référence', () => {
  const essai = (yD, gRefVoisins = 1.435) => {
    const w = monde({ left: [vraiG], right: [yD] }), cap = depart(), science = w.scientificProposeBoth(cap);
    return G.reprendre({ decision: differe, capture: cap, science, poses: posesVoisins(gRefVoisins), gPartie: 1435, Shadow: w, options: { actif: true } });
  };
  assert.equal(essai(vraiG - 1.450).tentative.pose, true, '1 450 mm : 15 mm de la référence, gardée');
  const loin = essai(vraiG - 1.460);
  assert.equal(loin.tentative.pose, false); assert.equal(loin.tentative.essais[0].garde, 'loin-de-la-reference');
  const hors = essai(vraiG - 1.475, 1.462);
  assert.equal(hors.tentative.pose, false); assert.equal(hors.tentative.essais[0].garde, 'hors-contrat', '1 475 mm : hors contrat même à 13 mm de la référence');
  /* Réglage de la garde (validation croisée seulement) : 10 mm. */
  const w = monde({ left: [vraiG], right: [vraiG - 1.450] }), cap = depart(), sc = w.scientificProposeBoth(cap);
  assert.equal(G.reprendre({ decision: differe, capture: cap, science: sc, poses: posesVoisins(), gPartie: 1435, Shadow: w, options: { actif: true, ecartRefMaxMm: 10 } }).tentative.pose, false);
});

test('deux graines : gardées seulement si elles s\'accordent à 10 mm près ; la première (rail gauche) est rendue', () => {
  /* Les deux rails sont trouvés au premier passage (le rail droit sur une face à 14 mm, ou 5 mm, de la vraie) ; la chaîne a différé. */
  const run = decalageFaceMm => {
    const yFace = vraiD + decalageFaceMm / 1000;
    const w = monde({ left: [vraiG], right: [vraiD, yFace] });
    const cap = captureDe(vraiG - 0.03, vraiG - 0.03 - 1.5);
    const science = { rails: { left: { ok: true, next: { status: 'candidate', delta: [0, 0.03, 0] } }, right: { ok: true, next: { status: 'candidate', delta: [0, yFace - cap.rails.right.positionSceneRelative[1], 0] } } } };
    return { w, r: G.reprendre({ decision: differe, capture: cap, science, poses: posesVoisins(), gPartie: 1435, Shadow: w, options: { actif: true } }) };
  };
  const des = run(14);
  assert.equal(des.w.appels.length, 2, 'deux graines, deux relances');
  assert.equal(des.r.tentative.pose, false); assert.equal(des.r.tentative.reason, 'graines-en-desaccord'); assert.ok(des.r.tentative.accordMm > 10);
  const acc = run(5);
  assert.equal(acc.r.tentative.pose, true); assert.ok(acc.r.tentative.accordMm <= 10);
  assert.deepEqual(yDe(acc.r.decision), [vraiG, Math.round(vraiD * 1e4) / 1e4], 'la paire de la graine gauche');
});

test('aucun rail trouvé, aucune référence, moteur en panne : la décision de la chaîne, motif consigné', () => {
  const w = monde({ left: [], right: [] }), cap = depart(), science = w.scientificProposeBoth(cap); w.appels.length = 0;
  const a = G.reprendre({ decision: differe, capture: cap, science, poses: posesVoisins(), gPartie: 1435, Shadow: w, options: { actif: true } });
  assert.equal(a.decision, differe); assert.equal(a.tentative.reason, 'aucun-rail-trouve'); assert.equal(w.appels.length, 0);
  const w2 = monde({ left: [vraiG], right: [vraiD] }), sc2 = w2.scientificProposeBoth(cap);
  const b = G.reprendre({ decision: differe, capture: cap, science: sc2, poses: [], gPartie: null, Shadow: w2, options: { actif: true } });
  assert.equal(b.decision, differe); assert.equal(b.tentative.reason, 'sans-reference');
  const w3 = monde({ left: [vraiG], right: [vraiD] }), sc3 = w3.scientificProposeBoth(cap), w3p = { scientificProposeBoth() { throw Error('panne'); } };
  const c = G.reprendre({ decision: differe, capture: cap, science: sc3, poses: posesVoisins(), gPartie: 1435, Shadow: w3p, options: { actif: true } });
  assert.equal(c.decision, differe); assert.equal(c.tentative.pose, false); assert.deepEqual(c.tentative.essais.map(e => e.garde), ['panne']);
});
