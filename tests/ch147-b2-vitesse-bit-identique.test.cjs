'use strict';
/* CH-147 (Lot B2) — Accélération géométrique au bit près :
 *  1. le patch `geometrie-elaguee-v46` de CH-065 est actif dans `src/geometry.js` (et `lidar-direct` reste absent) ;
 *  2. `src/gcv1-shadow.js` met en cache `V46.propose` et `scientificRail` par capture/rail (0 recalcul sur la même capture,
 *     y compris entre `proposeBoth` et `scientificProposeBothAvecReservoir`), sans aucune dérive au bit près (`Object.is`) et
 *     sans corruption si l'appelant mute l'objet retourné ;
 *  3. `src/placement-convention.js` mémoïse `template(rail)` et les points projetés de `bandOffsets` par `WeakMap`, sans re-projeter
 *     les points 3D sur les appels répétés et avec une sortie identique au bit près (`Object.is`). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const H = require('./helpers/ch065.cjs');
const C = require('../vendor/capture-core.js');
const Gauge = require('../src/gauge.js');
const Cand = require('../src/geometry-candidate-v1.js');
const Conv = require('../src/placement-convention.js');
const ShadowMod = require('../src/gcv1-shadow.js');

const RACINE = path.resolve(__dirname, '..');

/* Versions non cachées de référence compilées depuis les sources d'origine (test 8 / CH-065 origine) pour prouver l'identité au bit. */
function referenceSansCache() {
  const G0 = H.compiler(H.A.versions(RACINE, 'src/geometry.js').origine, 'src/geometry.js');
  const Cand0 = H.compiler(H.A.versions(RACINE, 'src/geometry-candidate-v1.js').origine, 'src/geometry-candidate-v1.js');
  const Brain0 = H.compiler(fs.readFileSync(path.join(RACINE, 'src/geometry-brain.js'), 'utf8'), 'src/geometry-brain.js', { './geometry.js': G0 });
  return { G0, Cand0, Brain0 };
}

test('CH-147 : geometrie-elaguee-v46 est présent dans src/geometry.js et lidar-direct reste absent', () => {
  const vGeo = H.A.versions(RACINE, 'src/geometry.js');
  const vLid = H.A.versions(RACINE, 'vendor/lidar.js');
  assert.equal(fs.readFileSync(path.join(RACINE, 'src/geometry.js'), 'utf8'), vGeo.patche, 'geometrie-elaguee-v46 doit être appliqué à src/geometry.js');
  assert.equal(fs.readFileSync(path.join(RACINE, 'vendor/lidar.js'), 'utf8'), vLid.origine, 'lidar-direct doit rester absent de vendor/lidar.js');
});

test('CH-147 : gcv1-shadow met en cache V46.propose et scientificRail sans recalcul sur la même capture, sorties identiques au bit', () => {
  const { G0 } = referenceSansCache();
  let appelsV46 = 0, appelsCand = 0;
  const runtimeEspion = {
    proposeBoth: (cap, opts) => G0.proposeBoth(cap, opts),
    frozen: {
      propose: (cap, side, opts) => { appelsV46++; return G0.propose(cap, side, opts); },
    },
  };
  const candEspion = {
    ...Cand,
    propose: (cap, side, opts) => { appelsCand++; return Cand.propose(cap, side, opts); },
  };
  const S = ShadowMod._createForTest(runtimeEspion, candEspion, C, Gauge, Conv);
  const c = H.captures()[0];

  /* 1er passage : geometry.proposeBoth armé en pilote actif -> calcule gauche et droite une fois. */
  S.armOnce('active-pilot-test');
  const r1 = S.geometry.proposeBoth(c);
  const obs1 = S.consumeLast();
  assert.equal(appelsV46, 2, '1er passage : V46.propose appelé 1 fois par rail');
  assert.equal(appelsCand, 2, '1er passage : Candidate.propose appelé 1 fois par rail');

  /* 2e passage : scientificProposeBothAvecReservoir sur la MÊME capture (cas de l1CommandeCoeur) -> 0 recalcul ! */
  const sciRes1 = S.scientificProposeBothAvecReservoir(c);
  assert.equal(appelsV46, 2, 'scientificProposeBothAvecReservoir réutilise le cache V46 (0 appel ajouté)');
  assert.equal(appelsCand, 2, 'scientificProposeBothAvecReservoir réutilise le cache scientificRail (0 appel ajouté)');
  assert.ok(sciRes1.rails.left._reservoir && sciRes1.rails.right._reservoir, 'le réservoir est bien présent quand demandé');

  /* 3e passage : scientificProposeBoth sans réservoir -> pas de fuite de _reservoir, et 0 recalcul ! */
  const sciSans = S.scientificProposeBoth(c);
  assert.equal(appelsV46, 2);
  assert.equal(appelsCand, 2);
  assert.equal(sciSans.rails.left._reservoir, undefined, 'aucun _reservoir hors scientificProposeBothAvecReservoir');
  assert.equal(sciSans.rails.right._reservoir, undefined);

  /* Résistance à la mutation par l'appelant : muter sciRes1 et r1 ne doit jamais altérer un appel ultérieur. */
  if (r1.left?.delta) r1.left.delta[1] = 999;
  sciRes1.rails.left._reservoir.pool.length = 0;
  if (sciSans.rails.left.next?.delta) sciSans.rails.left.next.delta[1] = -999;

  /* Vérification d'identité au bit contre une instance neuve sur une copie fraîche de la capture. */
  const cCopie = JSON.parse(JSON.stringify(c));
  const SRef = ShadowMod._createForTest({ proposeBoth: (x, o) => G0.proposeBoth(x, o), frozen: G0 }, Cand, C, Gauge, Conv);
  const attenduSans = SRef.scientificProposeBoth(cCopie);
  const attenduAvec = SRef.scientificProposeBothAvecReservoir(JSON.parse(JSON.stringify(c)));
  assert.equal(H.canon(S.scientificProposeBoth(c)), H.canon(attenduSans), 'scientificProposeBoth identique au bit après mutation externe');
  assert.equal(H.canon(S.scientificProposeBothAvecReservoir(c)), H.canon(attenduAvec), 'scientificProposeBothAvecReservoir identique au bit après mutation externe');
  assert.ok(obs1 && obs1.rails, 'journal d’observation produit');

  /* Invalidation automatique quand un rail est translaté (cas de seededRails / rechercheRecentree) : V46 et Cand doivent recalculer ! */
  const railLeftTranslate = {
    ...c.rails.left,
    sceneRelativeToProfileLocal: c.rails.left.sceneRelativeToProfileLocal.map((v, i) => i === 13 ? v + 0.015 : v),
  };
  const cTranslate = { ...c, rails: { left: railLeftTranslate, right: c.rails.right } };
  S.scientificProposeBoth(cTranslate);
  assert.equal(appelsV46, 3, 'seul le rail translaté (left) recalcule V46 ; le rail droit inchangé reste servi par le cache');
  assert.equal(appelsCand, 3, 'seul le rail translaté (left) recalcule Candidate ; le rail droit inchangé reste servi par le cache');
});

test('CH-147 : placement-convention mémoïse la projection 3D et le gabarit sans recalculer C.point, sortie identique au bit', () => {
  let appelsPoint = 0;
  const CEspion = {
    ...C,
    point: (m, p) => { appelsPoint++; return C.point(m, p); },
  };
  const texteActuel = fs.readFileSync(path.join(RACINE, 'src/placement-convention.js'), 'utf8');
  const ConvEspion = H.compiler(texteActuel, 'src/placement-convention.js', { '../vendor/capture-core.js': CEspion });

  const c = H.captures()[0];
  const deltas = [[0, 0, 0], [0, 0.005, -0.002], [0, -0.012, 0.004], [0, 0.025, -0.008], [0, -0.03, 0.01]];

  const premier = ConvEspion.calibrate(c, 'left', deltas[0]);
  const appelsPremier = appelsPoint;
  assert.ok(appelsPremier > 50, '1er appel projette le contour et les points LiDAR');

  for (let k = 1; k < deltas.length; k++) {
    const res = ConvEspion.calibrate(c, 'left', deltas[k]);
    /* Compare à une copie fraîche pour forcer un calcul sans cache. */
    const frais = Conv.calibrate(JSON.parse(JSON.stringify(c)), 'left', deltas[k]);
    assert.equal(H.canon(res), H.canon(frais), 'calibrate identique au bit au delta ' + k);
  }
  assert.equal(appelsPoint, appelsPremier, '0 appel supplémentaire à C.point sur les deltas suivants du même (points, rail)');
  assert.equal(H.canon(premier), H.canon(Conv.calibrate(JSON.parse(JSON.stringify(c)), 'left', deltas[0])));
});
