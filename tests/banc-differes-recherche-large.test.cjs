'use strict';
/* CH-034 — la RECHERCHE LARGE (src/recherche-large.js) branchée dans le banc des différés (tools/banc-differes.cjs, option `rechercheLarge` ou
 * BANC_RECHERCHE_LARGE) : sur chaque pose qu'un profil s'apprête à faire (chaîne, L1-s, GCV2, deuxième passe), la décision du module s'applique comme dans
 * le service worker (`rechercheLargeCommande`, `passeDiffRechercheLarge`). Sans l'option : le rejeu est inchangé, octet pour octet. Lot synthétique du
 * banc (partie 91), décision du module FORCÉE par cut (le module pur a ses propres essais). Aucune donnée de terrain. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const B = require('../tools/banc-differes.cjs');
const RL = require('../src/recherche-large.js');
const L = require('../src/lot-decision.js');
const L1 = require('../src/gcv2-l1.js');
const VR = require('../src/voie-recentree.js');
const F = require('./helpers/gcv2-jeu-fixture.cjs');
const SIDES = ['left', 'right'];
const PARAMS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'datasets', 'gcv2-parametres-h6.json'), 'utf8'));
const T0 = Date.UTC(2031, 4, 1, 8, 0, 0), iso = s => new Date(T0 + s * 1000).toISOString();
const ORIGINE = [458559.4, 6699187.6, 24.0];
const CUTS = [1, 2, 3, 4, 5, 6], VALIDES = [1, 2, 3, 6];
const capDe = cut => { const c = F.capture({ cut, graine: 10 + cut, origine: [ORIGINE[0] + cut, ORIGINE[1], ORIGINE[2]] });
  const pts = [4, 5].includes(cut) ? c.pointsSceneRelative.filter(p => Math.abs(p[1] - ORIGINE[1]) < 0.5) : c.pointsSceneRelative;
  return { rails: c.rails, pointsSceneRelative: pts, visibleByClipBoxes: pts.map(() => true), camera: null, viewCaptures: [] }; };
const CAPTURES = new Map(CUTS.map(c => [`cap-${c}`, capDe(c)]));
function journal() {
  const events = [{ eventId: 'b0', timestamp: iso(1), type: 'batch-started', batch: { id: 'lot-a-0000', scope: { part: 91, start: 1, end: 6, extensionVersion: '9.9.9' } } }], records = [];
  for (const cut of CUTS) {
    const valide = VALIDES.includes(cut), t = 10 * cut;
    events.push({ eventId: `d-${cut}`, timestamp: iso(t), type: 'gcv1-shadow-observed', identity: { part: 91, cut, frameId: 'cadre' }, batchId: 'lot-a-0000', lidarCaptureId: `cap-${cut}`,
      lotObservation: { stage: valide ? 'first-pass' : 'deferred', reason: valide ? null : 'no-anchor', anchorsUsed: [], anchor: valide, anchorHeld: valide, command: { action: 'engine', reason: valide ? 'first-pass' : 'deferred' } } });
    if (!valide) continue;
    events.push({ eventId: `v-${cut}`, timestamp: iso(t + 2), type: 'validation-accepted', batchId: 'lot-a-0000', identity: { part: 91, cut } });
    const cap = CAPTURES.get(`cap-${cut}`);
    records.push({ identity: { part: 91, cut }, capturedAt: iso(t + 1), rails: Object.fromEntries(SIDES.map(s => [s, { initial: cap.rails[s], corrected: { positionSceneRelative: cap.rails[s].positionSceneRelative.map((v, i) => i === 1 ? v + 0.003 : v) } }])) });
  }
  return { events, records };
}
const GARDE = { version: 'essai', etat: 'garde', motif: 'pose-unique', mode: 'differer', ms: 1, cellules: { left: 1, right: 1, relances: 7, grainesSautees: 0 }, nPaires: 1, paireLot: null, meilleure: null, concurrente: null, positions: null };
/* Rejeu avec l'option ; `forcer(cut, args)` rend la décision du module (ou null = garde). Les leviers de L1-se : deuxième passe et transport. Les captures
 * synthétiques n'ont pas de caméra : `vue` simule une vue qui contient tout (sinon toute cible est « hors vue ») ; `passe` force la GCV2 de la passe à
 * valider le cut donné (comme tests/banc-differes-garde-appuis.test.cjs), pour que la pose de la passe soit confrontée à la recherche large. */
const PAIRE = { left: { decal: [0, 10, 0] }, right: { decal: [0, 10, 0] } };
function rejouer({ rechercheLarge, forcer, profils = ['base', 'L1-se'], vue = false, passe = null } = {}) {
  const sauve = { decider: RL.decider, env: process.env.BANC_LEVIERS, cams: L.viewCameras, camsLarges: VR.camerasLarges, inView: L.inView, deciderDiffere: L1.deciderDiffere, commander: L1.commander };
  process.env.BANC_LEVIERS = JSON.stringify({ deuxiemePasse: 2, transport: true });
  if (forcer) RL.decider = a => forcer(a.capture && a.capture.identity ? a.capture.identity.cut : null, a) || GARDE;
  if (vue) { L.viewCameras = () => ({ left: {}, right: {} }); VR.camerasLarges = () => ({ left: {}, right: {} }); L.inView = () => ({ inView: true, ndc: [0, 0, 0] }); }
  let force = false;
  if (passe !== null) {
    L1.commander = o => { const c = sauve.commander(o); if (!force) return c; force = false; return { ...c, action: 'lot', vue: null }; };
    L1.deciderDiffere = a => { const r = sauve.deciderDiffere(a); if (a.capture.identity.cut !== passe) return r; force = true;
      return { ...r, decision: { ...r.decision, etat: 'valider', motif: null, p: 0.9, paire: PAIRE, hypothese: 'H1', ecartDepartMm: 10 }, positions: L1.positionsDe(a.capture, PAIRE) }; };
  }
  try { return B.rejouerLot({ journal: journal(), captures: CAPTURES, projet: 9, partie: 91, lotId: 'lot-a', parametres: PARAMS, profils, rechercheLarge }); }
  finally { RL.decider = sauve.decider; L.viewCameras = sauve.cams; VR.camerasLarges = sauve.camsLarges; L.inView = sauve.inView; L1.deciderDiffere = sauve.deciderDiffere; L1.commander = sauve.commander; if (sauve.env === undefined) delete process.env.BANC_LEVIERS; else process.env.BANC_LEVIERS = sauve.env; }
}
const texte = L => L.slice(1).map(l => JSON.stringify(l)).join('\n');

test('sans l\'option (ou `false`) : rejeu inchangé octet pour octet, en-tête sans recherche large, le module n\'est jamais appelé ; réglage illisible : erreur', () => {
  let appels = 0;
  const sans = rejouer(), faux = rejouer({ rechercheLarge: false, forcer: () => { appels++; return null; } });
  assert.equal(texte(faux), texte(sans)); assert.equal(appels, 0);
  assert.ok(!('rechercheLarge' in sans[0]) && !('rechercheLarge' in faux[0]));
  assert.ok(!texte(sans).includes('rechercheLarge'));
  assert.throws(() => rejouer({ rechercheLarge: { actif: true, mode: 'autre' } }), /recherche large/);
});

test('« différer » forcé sur le 2 : différé (source recherche-large) dans la chaîne et sous L1-se, repris par la deuxième passe que la même recherche garde ; les autres poses gardées, à l\'identique', () => {
  const sans = rejouer({ passe: 2 });
  const appels = [];
  const avec = rejouer({ rechercheLarge: { actif: true }, passe: 2, forcer: (cut, a) => { appels.push([cut, a.R.mode]); return cut === 2 ? { ...GARDE, etat: 'differer', motif: 'concurrence', nPaires: 2 } : null; } });
  assert.deepEqual(avec[0].rechercheLarge, RL.reglage({ actif: true }));
  const l2 = avec.find(l => l.cut === 2), s2 = sans.find(l => l.cut === 2);
  assert.equal(s2.profils.base.etat, 'pose');
  for (const p of ['base', 'L1-se']) { assert.equal(l2.profils[p].etat, 'differe', p); assert.equal(l2.profils[p].source, 'recherche-large'); assert.equal(l2.profils[p].rechercheLarge.motif, 'concurrence'); }
  assert.ok(l2.profils['L1-se'].passe2, 'repris par la deuxième passe');
  assert.equal(l2.profils['L1-se'].passe2.motif, 'recherche-large', JSON.stringify(l2.profils['L1-se'].passe2));
  assert.equal(l2.profils['L1-se'].passe2.rechercheLarge.etat, 'differer');
  assert.ok(appels.some(([c, m]) => c === 2 && m === 'differer'), 'la passe appelle le module en mode différer');
  /* `passe:false` : la passe n'est plus gardée, le cut 2 y est posé. */
  const libre = rejouer({ rechercheLarge: { actif: true, passe: false }, passe: 2, forcer: cut => cut === 2 ? { ...GARDE, etat: 'differer', motif: 'concurrence', nPaires: 2 } : null });
  assert.equal(libre.find(l => l.cut === 2).profils['L1-se'].etat, 'pose'); assert.equal(libre.find(l => l.cut === 2).profils['L1-se'].etage, 'deferred');
  for (const l of avec.slice(1).filter(l => l.cut !== 2 && l.profils.base.etat === 'pose')) {
    const s = sans.find(x => x.cut === l.cut);
    assert.deepEqual(l.profils.base.decal, s.profils.base.decal, `${l.cut}`); assert.equal(l.profils.base.rechercheLarge.etat, 'garde');
  }
  assert.ok(!texte(avec).includes('positionSceneRelative') && !texte(avec).includes('458559'), 'aucune coordonnée');
});

test('« remplacer » forcé sur le 2 (paire à 5 mm en travers) : posé par la recherche large, décalage déplacé de 5 mm, dans la chaîne et sous L1-se', () => {
  const sans = rejouer({ vue: true });
  const sansVue = rejouer({ rechercheLarge: { actif: true, mode: 'choisir-sur' }, forcer: (cut, a) => cut === 2 ? { ...GARDE, mode: 'choisir-sur', etat: 'remplacer', motif: 'meilleure-unique', positions: a.positions } : null });
  assert.equal(sansVue.find(l => l.cut === 2).profils.base.etat, 'differe', 'cible hors de la vue (aucune caméra) : différé');
  assert.equal(sansVue.find(l => l.cut === 2).profils.base.rechercheLarge.motifFinal, 'remplacer-hors-vue');
  const avec = rejouer({ vue: true, rechercheLarge: { actif: true, mode: 'choisir-sur' }, forcer: (cut, a) => {
    if (cut !== 2) return null;
    const positions = Object.fromEntries(SIDES.map(s => { const r = a.capture.rails[s], dec = RL.decalage(r, a.positions[s]); return [s, L.positionOf(r, [dec[0] / 1000, (dec[1] + 5) / 1000, dec[2] / 1000])]; }));
    return { ...GARDE, mode: 'choisir-sur', etat: 'remplacer', motif: 'meilleure-unique', nPaires: 1, positions }; } });
  const l2 = avec.find(l => l.cut === 2), s2 = sans.find(l => l.cut === 2);
  for (const p of ['base', 'L1-se']) {
    assert.equal(l2.profils[p].etat, 'pose', p); assert.equal(l2.profils[p].source, 'recherche-large'); assert.equal(l2.profils[p].rechercheLarge.etat, 'remplacer');
    for (const s of SIDES) assert.ok(Math.abs(l2.profils[p].decal[s][1] - s2.profils.base.decal[s][1] - 5) < 0.05, `${p} ${s} : ${l2.profils[p].decal[s][1]} contre ${s2.profils.base.decal[s][1]}`);
  }
});
