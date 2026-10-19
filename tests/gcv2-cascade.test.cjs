'use strict';
/* Lecture seule du jeu causal : cascade des pertes des grosses corrections, banc des différés (D-214), diagnostic d'une décision de la GCV2, retrait de H6
 * (« GCV2 seule »), médiane de l'instant lue par cut dans un jeu causal. Données SYNTHÉTIQUES (résultats et cas inventés). Rien n'est réglé par ces outils. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const A = require('../tools/gcv2-apprendre.cjs');
const E = require('../tools/gcv2-evaluer.cjs');
const F = require('./helpers/gcv2-apprendre-fixture.cjs');

/* Un cas minimal : deux rails, hypothèses données par [décalage latéral, écart à Mic] ; H0 en tête. */
function cas({ zone = 'pn', role = 'vert', gauche, droit, gMed = 1450, garde = null, voieRef = null }) {
  const hyp = l => l.map(([lat, e], i) => ({ rang: i, hauteur: false, origines: [i ? 'H1' : 'H0'], sousOrigines: [i ? 'astar' : 'depart'], decal: [0, lat, 0], g: 1450 + lat, y: { ecartMm: e } }));
  const k = { partie: '9:1', cut: 7, zone, role, gMed, G0: 1450, rails: { left: { hyps: hyp(gauche) }, right: { hyps: hyp(droit) } }, etiq: { micMaxMm: 30 }, i0: { left: 0, right: 0 }, garde, voieRef };
  k.paires = A.pairesPermises(k);
  return k;
}
const seuils = { pn: { actif: true, tau: 0.5, delta: 3 }, adv: { actif: false }, abords: { actif: false }, liste: { actif: false }, hors: { actif: false } };

test('diagnostic : paire juste bloquée par le garde-fou de 45 mm, zone inactive, meilleure paire « ne rien faire », sous τ', () => {
  const loin = cas({ gauche: [[0, 60], [60, 4]], droit: [[0, 60], [-60, 5]] });
  const d1 = A.diagnostic(loin, A.decider(loin, { left: [0.9, 0.9], right: [0.9, 0.9] }, seuils), seuils);
  assert.equal(d1.atteignable, true); assert.equal(d1.bonnePermise, false); assert.deepEqual(d1.gardes, ['lateral-45']);
  const ok = cas({ gauche: [[0, 30], [20, 3]], droit: [[0, 30], [-18, 2]] });
  assert.equal(A.diagnostic(ok, A.decider(ok, { left: [0.1, 0.9], right: [0.1, 0.9] }, seuils), seuils).etat, 'agit');
  const tau = A.diagnostic(ok, A.decider(ok, { left: [0.1, 0.6], right: [0.1, 0.6] }, seuils), seuils);
  assert.equal(tau.sousTau, true); assert.equal(tau.etat, 'abstient');
  const h0 = A.diagnostic(ok, A.decider(ok, { left: [0.9, 0.2], right: [0.9, 0.2] }, seuils), seuils);
  assert.equal(h0.meilleureH0, true);
  const adv = cas({ zone: 'adv', gauche: [[0, 30], [20, 3]], droit: [[0, 30], [-18, 2]] });
  assert.equal(A.diagnostic(adv, A.decider(adv, { left: [0.1, 0.9], right: [0.1, 0.9] }, seuils), seuils).zoneActive, false);
  const ecart = cas({ gauche: [[0, 30], [20, 3]], droit: [[0, 30], [20, 2]], gMed: 1400 });
  assert.deepEqual(A.diagnostic(ecart, A.decider(ecart, { left: [0.1, 0.9], right: [0.1, 0.9] }, seuils), seuils).gardes, ['ecartement'], 'écartement de la paire 1 490 mm : à 90 mm de la médiane et hors du contrat 1 420–1 470');
  const voie = cas({ role: 'differe', gauche: [[0, 30], [20, 3]], droit: [[0, 30], [-18, 2]], garde: 'voie', voieRef: null });
  assert.deepEqual(A.diagnostic(voie, A.decider(voie, { left: [0.1, 0.9], right: [0.1, 0.9] }, seuils), seuils).gardes, ['preuve-de-voie']);
  const loin2 = cas({ gauche: [[0, 30], [9, 25]], droit: [[0, 30], [9, 22]] });
  assert.equal(A.diagnostic(loin2, A.decider(loin2, { left: [0.1, 0.9], right: [0.1, 0.9] }, seuils), seuils).atteignable, false, 'aucune hypothèse à 10 mm');
});

test('cascade des pertes : chaque grosse correction dans une case, dans l\'ordre ; par zone et par projet ; une seule case par cut', () => {
  const c = (cut, mic, etat = 'calcule', zone = 'pn') => ({ cut, projet: 9, partie: 1, mic: { ref: 'validation', rails: { left: [0, mic, 0], right: [0, 0, 0] } }, ariane: { etat }, zoneCausale: zone });
  const casParPartie = { '9:1': [c(1, 30, 'sans-nuage'), c(2, 30), c(3, 30), c(4, 30, 'calcule', 'hors'), c(5, 30), c(6, 4), c(7, 30, 'calcule', 'abords'), c(8, 30), { cut: 9, projet: 9, partie: 1, mic: { ref: null, raison: 'reference-incertaine' }, ariane: { etat: 'reference-incertaine' } }] };
  const r = (cut, zone, role, etat, e = null) => ({ partie: '9:1', cut, zone, role, mic: 30, etat, e, lat: 3 });
  const candidat = [r(2, 'pn', 'vert', 'laisse'), r(3, 'pn', 'vert', 'agit', 4), r(4, 'hors', 'vert', 'laisse'), r(5, 'pn', 'vert', 'abstient'), r(6, 'pn', 'vert', 'laisse'), r(7, 'abords', 'vert', 'laisse'), r(8, 'pn', 'differe', 'laisse')];
  const d = (cut, x) => ({ partie: '9:1', cut, atteignable: true, bonnePermise: true, zoneActive: true, meilleureH0: false, sousDelta: false, sousTau: false, garde: null, ...x });
  const diagnostics = [d(2, { atteignable: false }), d(3), d(4), d(5, { sousTau: true }), d(6), d(7), d(8)];
  const K = E.cascade({ candidat, diagnostics, casParPartie, defs: { gcv2: { zones: ['pn', 'adv'], roles: ['vert'] }, prudente: { zones: ['abords'], roles: ['vert'] } } });
  const t = K.total;
  assert.deepEqual([t.grosses, t.sansNuage, t.sansHypothese, t.traitees, t.justes, t.zoneHorsListe, t.sousTau, t.prudenteNAgitPas, t.differeJamais], [7, 1, 1, 1, 1, 1, 1, 1, 1]);
  const cases = K.etapes.filter(k => !['grosses', 'justes', 'fausses'].includes(k)).reduce((a, k) => a + t[k], 0);
  assert.equal(cases, t.grosses, 'chaque grosse correction tombe dans une seule case');
  assert.equal(K.parZone.pn.grosses, 5); assert.equal(K.parProjet['projet 9'].grosses, 7); assert.equal(K.parZone.hors.zoneHorsListe, 1);
  assert.ok(E.rapportCascade(K).includes('rappel manquant'));
});

test('banc des différés : effectif, atteignables, actions, justes, mauvaises voies (définition du protocole), médianes ; par partie et par projet', () => {
  const r = (partie, cut, etat, e, lat, mic = 40) => ({ partie, cut, zone: 'abords', role: 'differe', mic, etat, e, lat });
  const resultats = [r('1:1', 1, 'agit', 6, 30), r('1:1', 2, 'agit', 12, 50), r('1:1', 3, 'laisse', null, null), r('2:4', 4, 'agit', 60, 10), r('2:4', 5, 'agit', 3, 2, 4), { ...r('2:4', 6, 'agit', 3, 2), role: 'vert' }];
  const diagnostics = resultats.map(x => ({ partie: x.partie, cut: x.cut, atteignable: x.cut !== 3 }));
  const casParPartie = { '1:1': [{ cut: 9, genreLot: 'differe', mic: { ref: 'validation' }, ariane: { etat: 'sans-nuage' } }], '2:4': [] };
  const B = E.bancDifferes({ resultats, diagnostics, casParPartie });
  assert.deepEqual([B.total.differes, B.total.actions, B.total.justes, B.total.mauvaiseVoie, B.total.atteignables, B.total.sansNuage], [5, 4, 2, 2, 4, 1]);
  assert.deepEqual([B.parProjet['projet 1'].mauvaiseVoie, B.parProjet['projet 2'].mauvaiseVoie], [1, 1], 'rail déplacé de 50 mm (> 45) et erreur de 60 mm (> 50)');
  assert.equal(B.parPartie['1:1'].erreurMedianeActions, 9); assert.equal(B.total.abimes, 0);
  assert.ok(E.rapportDifferes(B, 'essai').includes('**projet 2**'));
});

test('« GCV2 seule » : les hypothèses qui ne viennent que de H6 partent, l\'origine H6 quitte les hypothèses mixtes', () => {
  const hs = [{ origines: ['H0'], sousOrigines: ['depart'], traits: { a: 1 } }, { origines: ['H6'], sousOrigines: ['h6-lot-proche-rail'], traits: { h6AmpleurMm: 3 } },
    { origines: ['H1', 'H6'], sousOrigines: ['astar', 'h6-humain-mediane-rail'], traits: { perte: 1, h6AmpleurMm: 9, h6DistCuts: 2 } }];
  const out = A.retirerH6(hs);
  assert.equal(out.length, 2); assert.deepEqual(out[1].origines, ['H1']); assert.deepEqual(out[1].sousOrigines, ['astar']); assert.equal('h6AmpleurMm' in out[1].traits, false); assert.equal(out[1].traits.perte, 1);
});

test('jeu causal : la médiane de l\'instant (contexte du cut) remplace la médiane de partie ; null tant qu\'aucun cut n\'est connu', () => {
  const lignes = F.jeuSynthetique({ partie: '9:1', graine: 1, cuts: 20 });
  const ent = lignes.find(l => l.type === 'entete'); ent.causal = { version: 'causal-1' }; ent.gMedMm = null;
  let n = 0; for (const l of lignes) if (l.type === 'cut' && l.contexte) { l.contexte.gMedMm = n++ === 0 ? null : 1440 + n; }
  const ks = A.construireCas(A.jeuDeLignes(lignes), 'relecture');
  assert.ok(ks.length > 3);
  assert.ok(ks.some(k => k.gMed === null), 'premier cut : aucune médiane');
  assert.ok(ks.filter(k => k.gMed !== null).every(k => k.gMed > 1440 && k.gMed < 1470), 'la médiane du cut est celle de son contexte');
  assert.equal(new Set(ks.map(k => k.gMed)).size > 2, true, 'elle change d\'un cut à l\'autre');
});
