'use strict';
/* CH-049-D : essais de tools/taux-apprenables.cjs sur des sessions Écho SYNTHÉTIQUES (parties et cuts inventés, rien du terrain). */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { mesurer, rapport, entreesEcho } = require('../tools/taux-apprenables.cjs');

const T0 = Date.UTC(2031, 4, 1, 8, 0, 0);
const iso = s => new Date(T0 + s * 1000).toISOString();
const rail = () => ({ positionSceneRelative: [0, 0, 0] });
/* Une visite. opts : captures {left,right} (id ou null), ref (bool), intents (['VALIDATE']), debut/fin en s. */
function visite(cut, index, o = {}) {
  const cap = o.captures || { left: `cap-${cut}-${index}-L`, right: `cap-${cut}-${index}-R` };
  const ge = s => cap[s] ? { status: 'comparable-candidate', captureId: cap[s], chunkIds: [cap[s]], reasons: [] } : { status: 'excluded', captureId: null, chunkIds: [], reasons: ['initial-rail-state-missing'] };
  return { recordId: `v${cut}-${index}`, visitId: `v${cut}-${index}`, visitIndex: index, nativeSessionId: 's1', identity: { part: 90, cut },
    startedAt: iso(o.debut ?? index * 10), endedAt: iso(o.fin ?? index * 10 + 4),
    operatorIntents: (o.intents || ['VALIDATE']).map(intent => ({ intent })),
    humanFinalReference: o.ref === false ? null : { state: { rails: { left: rail(), right: rail() } } },
    geometryEligibility: { left: ge('left'), right: ge('right') } };
}
const nuage = (id, d = 2) => ({ captureId: id, startedAt: iso(0), completedAt: iso(d), termination: { code: 'DONE' } });
/* Un segment Écho (format v2 clair). declares : ids déclarés par la session. */
function segment({ index, stamp = 's', records = [], clouds = [], declares = [] }) {
  return { format: 'banane-native-session-v2', session: { id: 's1', cloudIds: declares }, segment: { index, stamp }, records, clouds };
}
function ecrire(segs) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'taux-'));
  segs.forEach((s, i) => fs.writeFileSync(path.join(d, `ariane-echo-seg0${i + 1}.json`), JSON.stringify(s)));
  return d;
}
const mesure = (segs, o) => mesurer(entreesEcho([ecrire(segs)]), o);
const ids = (cut, i = 0) => [`cap-${cut}-${i}-L`, `cap-${cut}-${i}-R`];

test('cut complet : apprenable', () => {
  const r = mesure([segment({ index: 1, records: [visite(1, 0)], clouds: ids(1).map(id => nuage(id, 3)), declares: ids(1) })]);
  assert.equal(r.cutsValides, 1); assert.equal(r.cutsApprenables, 1); assert.equal(r.tauxApprenablesPct, 100);
  assert.equal(r.exportPartiel, false); assert.equal(r.duree.captureParCut.medianeS, 3); assert.equal(r.duree.visiteParCut.medianeS, 4);
});

test('union de segments : nuage retrouvable seulement sur l\'union', () => {
  const rec = [visite(1, 0), visite(2, 1)];
  const s1 = segment({ index: 1, records: rec, clouds: ids(1).map(id => nuage(id)), declares: [...ids(1), ...ids(2, 1)] });
  const s2 = segment({ index: 2, records: rec, clouds: ids(2, 1).map(id => nuage(id)), declares: [...ids(1), ...ids(2, 1)] });
  assert.equal(mesure([s1, s2]).cutsApprenables, 2);
  const seul = mesure([s1]); // un segment seul : nuage du cut 2 déclaré mais absent
  assert.equal(seul.cutsApprenables, 1); assert.equal(seul.exportPartiel, true);
  assert.equal(seul.causesNuageIntrouvable['declare-absent-segments-manquants'], 1);
  assert.match(seul.qualification, /PROBABLE/); assert.match(rapport(seul), /PARTIEL/);
});

test('nuage jamais déposé : distinct d\'un segment manquant', () => {
  const r = mesure([segment({ index: 1, records: [visite(1, 0)], clouds: [nuage(ids(1)[0])], declares: [ids(1)[0]] })]);
  assert.equal(r.cutsApprenables, 0); assert.equal(r.pertesCascade['nuage-introuvable'], 1);
  assert.equal(r.causesNuageIntrouvable['jamais-depose-ou-libere'], 1); assert.equal(r.exportPartiel, false);
});

test('état initial non qualifié, pose humaine absente, ventilation en cascade et indépendante', () => {
  const recs = [visite(1, 0, { captures: { left: null, right: 'cap-1-0-R' }, ref: false }), visite(2, 1, { ref: false }), visite(3, 2)];
  const clouds = ['cap-1-0-R', ...ids(2, 1), ...ids(3, 2)].map(id => nuage(id));
  const r = mesure([segment({ index: 1, records: recs, clouds, declares: clouds.map(c => c.captureId) })]);
  assert.equal(r.cutsValides, 3); assert.equal(r.cutsApprenables, 1);
  assert.deepEqual(r.pertesCascade, { 'etat-initial-non-qualifie': 1, 'pose-humaine-absente': 1, 'nuage-introuvable': 0, 'intention-ambigue': 0 });
  assert.equal(r.echecsIndependants.c1, 1); assert.equal(r.echecsIndependants.c2, 2);
});

test('intention ambiguë : natures mêlées, ou décision ultérieure différente', () => {
  const recs = [visite(1, 0, { intents: ['VALIDATE', 'SKIP'] }), visite(2, 1), { ...visite(2, 2, { intents: ['SKIP'] }) }, visite(3, 3, { intents: ['VALIDATE', 'VALIDATE'] })];
  const clouds = [...ids(1), ...ids(2, 1), ...ids(2, 2), ...ids(3, 3)].map(id => nuage(id));
  const r = mesure([segment({ index: 1, records: recs, clouds, declares: clouds.map(c => c.captureId) })]);
  assert.equal(r.cutsValides, 3); assert.equal(r.cutsApprenables, 1);
  assert.equal(r.causesIntentionAmbigue['natures-melangees'], 1); assert.equal(r.causesIntentionAmbigue['decision-ulterieure-differente'], 1);
});

test('cut jamais validé : hors dénominateur', () => {
  const r = mesure([segment({ index: 1, records: [visite(1, 0, { intents: [] }), visite(2, 1, { intents: ['SKIP'] })] })]);
  assert.equal(r.cutsValides, 0); assert.equal(r.tauxApprenablesPct, null);
});

test('journal Orbite : recoupement minimal, partie filtrable, poids', () => {
  const recs = [visite(1, 0), visite(2, 1, { ref: false })];
  const clouds = [...ids(1), ...ids(2, 1)].map(id => nuage(id));
  const seg = segment({ index: 1, records: recs, clouds, declares: clouds.map(c => c.captureId) });
  const jr = { events: [{ type: 'validation-accepted', identity: { part: 90, cut: 1 } }] };
  const r = mesure([seg], { journal: jr });
  assert.deepEqual(r.orbite.valides, { poseAuJournal: 1, horsJournal: 1 });
  assert.deepEqual(r.orbite.apprenables, { poseAuJournal: 1, horsJournal: 0 });
  assert.ok(r.poids.octets > 0 && r.poids.octetsParCutValide > 0);
  assert.equal(mesure([seg], { partie: 91 }).cutsValides, 0);
});
