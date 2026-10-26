'use strict';
/* Garde A (fiches/GARDE_PASSE_A.md) : montage commun des essais du branchement dans le service worker (tests/passe-differes-garde-appuis-*-sw.test.cjs). */
const { lotPasse, relancer, ev } = require('./passe-differes.cjs');
const j = x => JSON.parse(JSON.stringify(x));
/* Marque des cuts du lot comme poses de L1 (GCV2 dans le lot), au moment où la passe décide un cut forcé. */
const marquerL1 = cuts => b => { const lc = b.get('engine').s.batch.lotCommands; for (const c of cuts) lc[c] = { ...lc[c], l1: true }; };
const decisions = b => ev(b, 'passe-differes-ombre').map(e => [e.identity.cut, e.passe, e.decision, e.motif ?? null]);
module.exports = { lotPasse, relancer, ev, j, marquerL1, decisions };
