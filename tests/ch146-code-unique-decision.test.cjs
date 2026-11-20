'use strict';
/* CH-146 (Lot B1, D-357, D-378, D-380, D-381) — UN SEUL CODE DE DÉCISION PARTAGÉ ENTRE LE BANC ET LE SERVICE WORKER (0 décision changée).
 * Vérifie :
 *  1. que `src/decision-lot-partagee.js` est chargeable en Node (CommonJS) et en navigateur/VM (`globalThis.BananeDecisionLotPartagee`),
 *     présent dans `importScripts` de `background.js`, et expose les fonctions pures partagées (`deciderCutL1se`, `deciderRestePasse`,
 *     `corrigerChaine`, `confronterRechercheLarge`, `jugerGardeApresDiffere`, `ajusterPoseFin`, `jugerAncre`) ;
 *  2. que le module pur reproduit exactement la chaîne, la reprise hors-vue `l1s-vue`, la reprise `l1s-chaine` + correction d'écartement,
 *     la GCV2, la recherche large, la garde après un différé, l'ajustement fin, le refus d'ancre sans ricochet et la 2e passe ;
 *  3. que `tools/banc-differes.cjs` et `background.js` délèguent tous deux leur décision `L1-se` à `BananeDecisionLotPartagee.deciderCutL1se`
 *     et leur décision de 2e passe à `BananeDecisionLotPartagee.deciderRestePasse` (vérifié par compteur d'appels + égalité des sorties).
 * Aucune donnée de terrain. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const L = require('../src/lot-decision.js');
const L1 = require('../src/gcv2-l1.js');
const ANC = require('../src/ancre-trajectoire.js');
const LM = require('../src/liste-memoire.js');
const { base, K } = require('./fixtures.cjs');
const F = require('./helpers/gcv2-jeu-fixture.cjs');
const { production, memoire, EsvTrou, SCOPE, attendre, decisions, ev } = require('./helpers/lot-profil.cjs');

const SIDES = ['left', 'right'];
const PARAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'gcv2-parametres-h6.json'), 'utf8'));

test('CH-146 : src/decision-lot-partagee.js expose l\'API UMD partagée et est chargé par background.js', () => {
  const D = require('../src/decision-lot-partagee.js');
  assert.ok(D && typeof D.VERSION === 'string');
  for (const fn of ['deciderCutL1se', 'deciderRestePasse', 'corrigerChaine', 'confronterRechercheLarge', 'jugerGardeApresDiffere', 'ajusterPoseFin', 'jugerAncre']) {
    assert.equal(typeof D[fn], 'function', `fonction ${fn} exposée`);
  }
  const ctx = {};
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'decision-lot-partagee.js'), 'utf8'), ctx);
  assert.ok(ctx.BananeDecisionLotPartagee && typeof ctx.BananeDecisionLotPartagee.deciderCutL1se === 'function');
  const bg = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');
  const liste = bg.match(/importScripts\(([^)]*)\)/s)[1];
  assert.ok(liste.includes("'src/decision-lot-partagee.js'"), 'chargé par importScripts dans background.js');
});

test('CH-146 : fonctions pures de décision L1-se (chaîne, hors-vue, GCV2, ajustementFin, refus d\'ancre sans ricochet et 2e passe)', () => {
  const D = require('../src/decision-lot-partagee.js');
  const Sh = require('../src/gcv1-shadow.js');
  const VR = require('../src/voie-recentree.js');
  const { withCameras } = require('./helpers/navigateur.cjs');
  const { decale, camerasParRail } = require('./helpers/deplacer-vue-lot.cjs');
  const modele = L1.modeleFige(PARAMS, 'lot');

  /* 1. Pose de la chaîne dans la vue : devient voisin et appui. */
  const cap1 = withCameras({ ...base, identity: { part: 23, cut: 101, frameId: null } }, 0.5);
  const sc1 = Sh.scientificProposeBothAvecReservoir(cap1), rr1 = Sh.toRuntimeRails(sc1);
  const E = { anchors: [], valides: [], validesL1: [], max: 40 };
  const r1 = D.deciderCutL1se({
    capture: cap1, nuage: cap1, science: sc1, runtimeRails: rr1, before: cap1.rails,
    cameras: L.viewCameras(cap1), camerasLarges: VR.camerasLarges(cap1),
    anchors: E.anchors, voisins: E.valides, voisinsTransport: E.validesL1,
    zone: 'abords', plagesADV: [], modele, reference: { mm: 1435 },
    etatProfil: E, identity: cap1.identity, leviers: L1.LEVIERS_LIVRES,
  });
  assert.equal(r1.out.etat, 'pose');
  assert.equal(r1.out.source, 'lot');
  assert.equal(E.valides.length, 1);
  assert.equal(E.anchors.length, 1);

  /* 2. Cible de la chaîne hors de la vue courante (rails décalés de 230 mm) mais dans camerasLarges → l1s-vue, corrigée et transportée, jamais appui ni voisin. */
  const rails2 = decale(230);
  const cap2 = { ...base, rails: rails2, viewCaptures: camerasParRail(rails2), identity: { part: 23, cut: 102, frameId: null } };
  const sc2 = Sh.scientificProposeBothAvecReservoir(cap2), rr2 = Sh.toRuntimeRails(sc2);
  const r2 = D.deciderCutL1se({
    capture: cap2, nuage: cap2, science: sc2, runtimeRails: rr2, before: cap2.rails,
    cameras: L.viewCameras(cap2), camerasLarges: VR.camerasLarges(cap2),
    anchors: E.anchors, voisins: E.valides, voisinsTransport: E.validesL1,
    zone: 'abords', plagesADV: [], modele, reference: { mm: 1470 },
    etatProfil: E, identity: cap2.identity, leviers: L1.LEVIERS_LIVRES,
  });
  assert.equal(r2.out.etat, 'pose');
  assert.equal(r2.out.source, 'l1s-vue');
  assert.equal(r2.out.vue, 'deplacee');
  assert.ok(r2.out.correction);
  assert.equal(E.valides.length, 1, 'l1s-vue n\'ajoute pas de voisin de chaîne');
  assert.equal(E.anchors.length, 1, 'l1s-vue n\'ajoute pas d\'appui');
  assert.equal(E.validesL1.length, 1, 'l1s-vue alimente le transport L1-se');

  /* 3. Refus d'ancre sans ricochet : une pose à plus de θ de l'axe devient différée (source ancre) mais garde son voisin et ne part pas en 2e passe. */
  const cap3 = { ...cap1, identity: { part: 23, cut: 102, frameId: null } };
  const fausseAncre = {
    modele: { ok: true },
    reglage: { thetaMm: 75 },
  };
  const origJuger = ANC.juger;
  ANC.juger = () => ({ refus: true, ecartMm: 120, axeMm: 0, poseMm: 120, thetaMm: 75 });
  try {
    const r3 = D.deciderCutL1se({
      capture: cap3, nuage: cap3, science: sc1, runtimeRails: rr1, before: cap3.rails,
      cameras: L.viewCameras(cap3), camerasLarges: VR.camerasLarges(cap3),
      anchors: E.anchors, voisins: E.valides, voisinsTransport: E.validesL1,
      zone: 'abords', plagesADV: [], modele, reference: { mm: 1435 },
      etatAncre: fausseAncre, etatProfil: E, identity: cap3.identity, leviers: L1.LEVIERS_LIVRES,
    });
    assert.equal(r3.out.etat, 'differe');
    assert.equal(r3.out.source, 'ancre');
    assert.equal(r3.out.origine, 'lot');
    assert.equal(r3.restePasse, false, 'un refus d\'ancre n\'est pas donné à la 2e passe');
    assert.equal(E.valides.length, 2, 'sans ricochet : la pose refusée par l\'ancre reste voisine');
  } finally {
    ANC.juger = origJuger;
  }

  /* 4. Ajustement fin (ajusterPoseFin) et décision d'un reste en 2e passe (deciderRestePasse). */
  const af = D.ajusterPoseFin({
    capture: cap1, before: cap1.rails, runtimeRails: rr1, cameras: L.viewCameras(cap1),
    decal: r1.out.decal, source: 'lot', vue: null,
    reglage: { seulChaine: true, voisinsDecision: true },
    ajuster: (c, dec) => ({ ajuste: true, decal: { left: [dec.left[0], dec.left[1], dec.left[2] + 1.5], right: dec.right.slice() }, info: { essai: true } }),
  });
  assert.ok(af && af.ajuste === true);
  assert.ok(Math.abs(af.decal.left[2] - (r1.out.decal.left[2] + 1.5)) < 0.05);

  const transportPasse = [];
  const rp = D.deciderRestePasse({
    capture: cap1, science: sc1, runtimeRails: rr1, before: cap1.rails,
    cameras: L.viewCameras(cap1), camerasLarges: VR.camerasLarges(cap1),
    appuis: E.anchors, voisins: E.valides, voisinsTransport: E.validesL1,
    zone: 'abords', plagesADV: [], modele, reference: { mm: 1435 },
    gardeAppuis: { ok: true, actif: true, deplacementMaxMm: 100, appuiNormalMaxCuts: 4 },
    transport: transportPasse, transporter: true, passe: 1,
  });
  assert.ok(['rien', 'poserait'].includes(rp.decision));
  assert.ok(rp.l1 && typeof rp.l1.version === 'string');
});

test('CH-146 : tools/banc-differes.cjs délègue chaque cut L1-se et chaque reste de 2e passe à BananeDecisionLotPartagee', () => {
  const B = require('../tools/banc-differes.cjs');
  const D = require('../src/decision-lot-partagee.js');
  const T0 = Date.UTC(2031, 4, 1, 8, 0, 0), iso = s => new Date(T0 + s * 1000).toISOString();
  const ORIGINE = [100.0, 200.0, 10.0];
  const CUTS = [1, 2, 3, 4, 5, 6], VALIDES = [1, 2, 3, 6];
  const capDe = cut => {
    const c = F.capture({ cut, graine: 10 + cut, origine: [ORIGINE[0] + cut, ORIGINE[1], ORIGINE[2]] });
    const pts = [4, 5].includes(cut) ? c.pointsSceneRelative.filter(p => Math.abs(p[1] - ORIGINE[1]) < 0.5) : c.pointsSceneRelative;
    return { rails: c.rails, pointsSceneRelative: pts, visibleByClipBoxes: pts.map(() => true), camera: null, viewCaptures: [] };
  };
  const captures = new Map(CUTS.map(c => [`cap-${c}`, capDe(c)]));
  const events = [{ eventId: 'b0', timestamp: iso(1), type: 'batch-started', batch: { id: 'lot-a-0000', scope: { part: 91, start: 1, end: 6, extensionVersion: '9.9.9' } } }], records = [];
  for (const cut of CUTS) {
    const valide = VALIDES.includes(cut), t = 10 * cut;
    events.push({ eventId: `d-${cut}`, timestamp: iso(t), type: 'gcv1-shadow-observed', identity: { part: 91, cut, frameId: 'cadre' }, batchId: 'lot-a-0000', lidarCaptureId: `cap-${cut}`,
      lotObservation: { stage: valide ? 'first-pass' : 'deferred', reason: valide ? null : 'no-anchor', anchorsUsed: [], anchor: valide, anchorHeld: valide, command: { action: 'engine', reason: valide ? 'first-pass' : 'deferred' } } });
    if (!valide) continue;
    events.push({ eventId: `v-${cut}`, timestamp: iso(t + 2), type: 'validation-accepted', batchId: 'lot-a-0000', identity: { part: 91, cut } });
    const cap = captures.get(`cap-${cut}`);
    records.push({ identity: { part: 91, cut }, capturedAt: iso(t + 1), rails: Object.fromEntries(SIDES.map(s => [s, { initial: cap.rails[s], corrected: { positionSceneRelative: cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v + 0.003 : v) } }])) });
  }
  const journal = { events, records };

  const origCut = D.deciderCutL1se, origPasse = D.deciderRestePasse;
  const appelsCut = [], appelsPasse = [];
  const env0 = process.env.BANC_LEVIERS;
  process.env.BANC_LEVIERS = JSON.stringify({ deuxiemePasse: 2, transport: true });
  D.deciderCutL1se = args => { appelsCut.push(args.identity.cut); return origCut(args); };
  D.deciderRestePasse = args => { appelsPasse.push([args.passe, args.capture.identity.cut]); return origPasse(args); };
  try {
    const lignes = B.rejouerLot({ journal, captures, projet: 9, partie: 91, lotId: 'lot-a', parametres: PARAMS, profils: ['base', 'L1-se'] });
    assert.deepEqual(appelsCut, CUTS, 'chaque cut L1-se du banc passe par BananeDecisionLotPartagee.deciderCutL1se');
    assert.ok(appelsPasse.length >= 2, 'la 2e passe du banc passe par BananeDecisionLotPartagee.deciderRestePasse');
    assert.equal(lignes.length, 1 + CUTS.length);
  } finally {
    D.deciderCutL1se = origCut;
    D.deciderRestePasse = origPasse;
    if (env0 === undefined) delete process.env.BANC_LEVIERS; else process.env.BANC_LEVIERS = env0;
  }
});

test('CH-146 : background.js délègue chaque cut L1-se et chaque reste de 2e passe à BananeDecisionLotPartagee', async () => {
  const local = memoire();
  const st = [], fl = [], ed = [];
  for (let i = 0; i < 200; i++) { st.push(i >= 111 && i <= 113 ? 1 : 0); fl.push(0); ed.push(i * 10000, 0, 0, i * 10000, 14350, 0); }
  local.m[LM.PRE_INST + 23] = LM.compacter({ st, fl, ed }, { partie: 23, at: '2026-10-20T00:00:00Z', cle: 'essai' });

  const adapter = new EsvTrou([]), b = production({ adapter, local });
  const S = b.ctx.BananeSettings;
  b.ctx.BananeSettings = {
    ...S,
    voiePrediteOmbre: { ...S.voiePrediteOmbre, actif: false },
    deplacerVue: { ...S.deplacerVue, actif: false },
    lot: { ...S.lot, gardeApresDiffere: false, passeDifferes: { ...S.lot.passeDifferes, ombre: true, ecriture: false, passes: 1 } },
  };
  const G = b.ctx.BananeGcv2L1, appelsGcv2 = [];
  b.ctx.BananeGcv2L1 = {
    ...G,
    deciderDiffere: a => {
      const cut = a.capture.identity.cut;
      appelsGcv2.push(cut);
      if (cut === 112 && appelsGcv2.filter(c => c === 112).length < 2) throw Error('différé au 1er passage pour tester la 2e passe');
      return G.deciderDiffere(a);
    },
  };
  const D = b.ctx.BananeDecisionLotPartagee;
  assert.ok(D, 'BananeDecisionLotPartagee est chargé dans le service worker');
  const appelsCut = [], appelsPasse = [];
  const origCut = D.deciderCutL1se, origPasse = D.deciderRestePasse;
  b.ctx.BananeDecisionLotPartagee = {
    ...D,
    deciderCutL1se: args => { appelsCut.push(args.identity?.cut); return origCut(args); },
    deciderRestePasse: args => { appelsPasse.push(args.capture?.identity?.cut); return origPasse(args); },
  };

  await b.api('connect', { tabId: 1 });
  await b.api('settings', { mode: 'automatic-test' });
  adapter.identity.cut = 111;
  adapter.rails = K.clone(base.rails);
  adapter.ajuster();
  await b.api('start', { part: 23, start: 111, end: 114, ...SCOPE });
  await b.settle();
  await attendre(30);
  const cours = b.get('passeDiff')?.cours;
  if (cours) await cours;
  await attendre(30);

  assert.deepEqual(appelsCut, [111, 112, 113, 114], 'chaque cut du lot L1-se dans background.js passe par BananeDecisionLotPartagee.deciderCutL1se');
  assert.deepEqual(appelsPasse, [112], 'le différé 112 en 2e passe dans background.js passe par BananeDecisionLotPartagee.deciderRestePasse');
  const decs = decisions(b);
  assert.ok(['lot', 'engine'].includes(decs.find(([c]) => c === 111)[1].command.action));
  assert.equal(decs.find(([c]) => c === 112)[1].command.reason, 'deferred');
  assert.equal(decs.find(([c]) => c === 112)[1].applied, false);
  assert.ok(['lot', 'engine'].includes(decs.find(([c]) => c === 113)[1].command.action));
  assert.equal(ev(b, 'passe-differes-ombre').length, 1);
  assert.equal(ev(b, 'passe-differes-ombre')[0].identity.cut, 112);
});
