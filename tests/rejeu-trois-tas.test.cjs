'use strict';
/* Essais de tools/rejeu-trois-tas.cjs. Journal et jointure fictifs : aucune donnée de terrain. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const T = require('../tools/rejeu-trois-tas.cjs');

const T0 = Date.parse('2026-10-26T08:00:00Z');
const iso = s => new Date(T0 + s * 1000).toISOString();
const rail = (status, motif) => ({ next: { status, motif: motif || null } });

function decision(lot, part, cut, s, shadow) {
  return { type: 'gcv1-shadow-observed', timestamp: iso(s), eventId: `d-${cut}`, batchId: lot,
    identity: { part, cut }, lotObservation: { stage: 'deferred', reason: 'no-anchor', command: { action: 'engine', reason: 'deferred' } }, shadow };
}
const valide = (lot, part, cut, s) => ({ type: 'validation-accepted', timestamp: iso(s), batchId: lot, identity: { part, cut } });
const debut = (lot, part, s, version) => ({ type: 'batch-started', timestamp: iso(s), batch: { id: lot, scope: { part, start: 0, end: 999999, extensionVersion: version } } });
const passe = (part, cut, s, decisionP, motif, l1) => ({ type: 'passe-differes-ombre', timestamp: iso(s), identity: { part, cut }, passe: 1, decision: decisionP, motif: motif || null, l1: l1 || null });

test('les trois tas excluent ce que la passe poserait, et un fragment', () => {
  const lot = 'lot-fictif', part = 7, version = '4.9.5.22';
  const cand = rail('candidate', null);
  const events = [
    debut(lot, part, 0, version),
    decision(lot, part, 1, 1, { rails: { left: cand, right: cand }, summary: {} }),
    valide(lot, part, 1, 2),
    decision(lot, part, 2, 3, { rails: { left: cand, right: cand }, summary: {} }),
    valide(lot, part, 2, 4),
    decision(lot, part, 3, 5, { rails: { left: cand, right: cand }, summary: {} }),
    valide(lot, part, 3, 6),
    decision(lot, part, 4, 7, { rails: { left: cand, right: cand }, summary: {} }),
    valide(lot, part, 4, 8),
    decision(lot, part, 11, 9, { rails: { left: rail('unresolved', 'ambiguity'), right: cand }, summary: {} }),
    passe(part, 11, 10, 'rien', 'depart-le-plus-probable', { p: 0.01, test13: { etat: 'rien', paire: null } }),
    decision(lot, part, 12, 11, { rails: { left: rail('unresolved', 'minTop'), right: cand }, summary: {} }),
    passe(part, 12, 12, 'rien', 'sans-approche', { p: 0.2, test13: { etat: 'poser-sans-valider', paire: { left: [0, 10, 0], right: [0, -4, 1] } } }),
    decision(lot, part, 13, 13, { rails: { left: rail('unresolved', 'gauge-out-of-contract'), right: rail('unresolved', 'gauge-out-of-contract') }, summary: { pairGaugeRejected: true } }),
    passe(part, 13, 14, 'rien', 'sans-approche', { p: 0.04, test13: { etat: 'poser-sans-valider', paire: { left: [0, 40, 0], right: [0, 3, 0] } } }),
    decision(lot, part, 14, 15, { rails: { left: rail('unresolved', 'minTop'), right: cand }, summary: {} }),
    passe(part, 14, 16, 'poserait', null, { p: 0.8, test13: { etat: 'valider', paire: { left: [0, 1, 0], right: [0, 1, 0] } } }),
    debut('fragment', 8, 30, version),
    decision('fragment', 8, 1, 31, { rails: { left: rail('unresolved', 'minTop'), right: cand }, summary: {} }),
  ];
  const R = T.coupesDesJournaux([{ journal: { events } }]);
  assert.deepEqual(R.coupes.map(c => c.cut).sort((a, b) => a - b), [11, 12, 13]);
  const par = Object.fromEntries(R.coupes.map(c => [c.cut, c.cause]));
  assert.equal(par[11], 'ambiguite');
  assert.equal(par[12], 'dessus-insuffisant');
  assert.equal(par[13], 'ecartement-hors-contrat');
  assert.equal(R.coupes.find(c => c.cut === 12).p, 0.2);
  assert.equal(R.texte.includes('lot-fictif'), false);
});

test('le seuil se règle sur une version et se mesure sur les autres', () => {
  const coupes = [
    { version: '4.9.5.21', partie: 1, cut: 1, cause: 'ecartement-hors-contrat', p: 0.9, eMm: 10 },
    { version: '4.9.5.21', partie: 1, cut: 2, cause: 'dessus-insuffisant', p: 0.2, eMm: 80 },
    { version: '4.9.5.21', partie: 1, cut: 3, cause: 'ambiguite', p: 0.99, eMm: 4 },
    { version: '4.9.5.22', partie: 2, cut: 4, cause: 'ecartement-hors-contrat', p: 0.95, eMm: 60 },
    { version: '4.9.5.22', partie: 2, cut: 5, cause: 'dessus-insuffisant', p: 0.5, eMm: 5 },
  ];
  const R = T.seuilHorsEchantillon(coupes, ['4.9.5.21']);
  assert.equal(R.seuil, 0.9);
  assert.equal(R.reglage.poses, 1);
  assert.equal(R.reglage.plus50, 0);
  assert.equal(R.examen.poses, 1);
  assert.equal(R.examen.plus50, 1);
  assert.equal(R.examen.cuts[0].cut, 4);
  assert.equal(R.ambiguiteEcartees, 1);
});

test('si toutes les poses du réglage sont sous 50 mm, le seuil le plus bas est retenu, et l\'examen n\'est pas relu', () => {
  const coupes = [
    { version: '4.9.5.21', partie: 1, cut: 1, cause: 'ecartement-hors-contrat', p: 0.02, eMm: 5 },
    { version: '4.9.5.21', partie: 1, cut: 2, cause: 'dessus-insuffisant', p: 0.2, eMm: 40 },
    { version: '4.9.5.22', partie: 2, cut: 3, cause: 'dessus-insuffisant', p: 0.05, eMm: 90 },
  ];
  const R = T.seuilHorsEchantillon(coupes, ['4.9.5.21']);
  assert.equal(R.seuil, 0.02);
  assert.equal(R.reglage.poses, 2);
  assert.equal(R.reglage.plus50, 0);
  assert.equal(R.examen.poses, 1);
  assert.equal(R.examen.plus50, 1);
});

test('l\'erreur d\'une paire journalisée se mesure dans le repère profil, pire rail', () => {
  const e = T.erreurPaire(
    { left: [0, 10, 0], right: [0, 0, 0] },
    { gauche: { repere: 'profil', longitudinalMm: 0, lateralMm: 0, verticalMm: 0 }, droite: { repere: 'profil', longitudinalMm: 0, lateralMm: 0, verticalMm: 0 } });
  assert.equal(e, 10);
  assert.equal(T.erreurPaire(null, {}), null);
});

test('la ligne de commande lit les chemins donnés et sépare réglage et examen', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rejeu-trois-tas-'));
  const journal = path.join(dir, 'journal.json');
  const jointure = path.join(dir, 'jointure.json');
  const lot = 'lot-cli', part = 3;
  const cand = rail('candidate', null);
  const events = [debut(lot, part, 0, '4.9.5.21')];
  for (let cut = 1; cut <= 4; cut++) {
    events.push(decision(lot, part, cut, cut, { rails: { left: cand, right: cand }, summary: {} }));
    events.push(valide(lot, part, cut, cut + 0.1));
  }
  events.push(decision(lot, part, 9, 10, { rails: { left: rail('unresolved', 'minTop'), right: cand }, summary: {} }));
  events.push(passe(part, 9, 11, 'rien', 'sans-approche', { p: 0.4, zone: 'adv', tau: 0.49, test13: { etat: 'poser-sans-valider', paire: { left: [0, 3, 0], right: [0, 0, 0] } } }));
  fs.writeFileSync(journal, JSON.stringify({ events }));
  fs.writeFileSync(jointure, JSON.stringify({ table: [{ partie: part, cut: 9, referenceHumaine: 'observee', classe: 'differee',
    ecartHumain: { maxDist3dMm: 12, gauche: { repere: 'profil', longitudinalMm: 0, lateralMm: 0, verticalMm: 0 }, droite: { repere: 'profil', longitudinalMm: 0, lateralMm: 0, verticalMm: 0 } } }] }));
  const texte = T.lancer(['seuil', '--journal', journal, '--jointure', jointure, '--reglage', '4.9.5.21']);
  assert.match(texte, /Seuil de probabilité retenu/);
  assert.match(texte, /examen 0/);
  assert.equal(texte.includes(lot), false);
});
