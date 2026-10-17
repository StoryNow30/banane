'use strict';
/* 5.0 (D-170, chantier P7) — RELECTURE AUTONOME, option `--garde-paire-confirmee` (tools/relecture-autonome.cjs, src/garde-paire-confirmee.js,
 * fiches/P7_GARDE_PAIRE_CONFIRMEE.md), sur données SYNTHÉTIQUES : la proposition levée n'est lue que si l'option est passée et que la voie
 * la confirme au seuil de la règle ; sans l'option, rien ne change ; le seuil se règle en validation croisée ; les réglages proposés le
 * portent et `regleDuReglage` le relit ; la greffe ne touche aucun cut sans garde de paire. Aucune donnée de terrain. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const T = require('../tools/relecture-autonome.cjs');
const GP = require('../src/garde-paire-confirmee.js');

const v = (lat, z) => ({ left: [0, lat, z], right: [0, lat, z] });
const rails = (pose, conf = 70) => ({ left: { statut: 'candidate', confiance: conf, pose: pose ? pose.left : null, hauteurMm: 0 }, right: { statut: 'candidate', confiance: conf, pose: pose ? pose.right : null, hauteurMm: 0 } });
/* Un cas : `pose` (la chaîne pose) ou une garde de paire (`garde`: { pose levée, voies }). */
function cas(partie, cut, { mic, pose = null, garde = null }) {
  const r = rails(pose), chaine = pose ? { stage: 'first-pass', reason: null, appuis: 1, ecartementPoseMm: 1437, rails: r }
    : { stage: 'deferred', reason: garde ? 'pair-guard' : 'no-anchor', appuis: 1, ecartementPoseMm: null, rails: rails(null) };
  const a = { etat: 'calcule', stage: chaine.stage, reason: chaine.reason, ecartementDepartMm: 1437, ecartementPoseMm: chaine.ecartementPoseMm, rails: r, chaine };
  if (garde) a.chaineGardePaire = { stage: 'first-pass', reason: null, appuis: 1, ecartementPoseMm: 1437, rails: rails(garde.pose), post: 'garde-paire-confirmee', motif: null, voies: garde.voies };
  return { format: T.FORMAT, projet: 9, partie, cut, mic: { ref: 'validation', rails: mic }, ariane: a };
}
const VOIE_HAUTE = { chaine: { appuis: [1], encadree: false, lat: [1, 1], vert: [2, 2] }, voisins: null };
const VOIE_BASSE = { chaine: { appuis: [1], encadree: false, lat: [1, 1], vert: [15, 15] }, voisins: null };
/* Une partie : 10 verts justes déjà (Mic 0, Ariane 1 mm), 2 gardes de paire que Mic abaisse de 20 mm (levée à 19 mm, voie qui confirme en
 * latéral et vertical), 1 garde de paire que Mic laisse (levée à 15 mm sous la voie : un cut abîmé si on lève sans regarder la hauteur). */
function partie(n) {
  const cs = [];
  for (let c = 10; c < 20; c++) cs.push(cas(n, c, { mic: v(0, 0), pose: v(0, 1) }));
  cs.push(cas(n, 20, { mic: v(0, -20), garde: { pose: v(0, -19), voies: VOIE_HAUTE } }));
  cs.push(cas(n, 21, { mic: v(0, -20), garde: { pose: v(0, -19), voies: VOIE_HAUTE } }));
  cs.push(cas(n, 22, { mic: v(0, 0), garde: { pose: v(0, -15), voies: VOIE_BASSE } }));
  const table = { format: 'ariane-verts-table-v1', projet: 9, partie: n, lot: [], zonesPN: [], zonesADV: [[0, 40]],
    cuts: cs.map(c => ({ i: c.cut, classe: 'hors-journal', mm: 0, dureeS: 2, visites: 1, bords: { left: [c.cut, 0.7175, 0], right: [c.cut, -0.7175, 0] } })) };
  return { designation: `9:${n}`, cas: cs, table };
}
const PETITE = Object.freeze({ variante: ['chaine+h'], X: [3, 8], Y: [0], D: [45], C: [100], G: [100], stages: [null], differes: [false], poses: [true] });

test('proposition : la paire levée seulement avec l\'option, et seulement si la voie confirme au seuil (axes l ou lv)', () => {
  const c = cas(1, 20, { mic: v(0, -20), garde: { pose: v(0, -19), voies: VOIE_BASSE } });
  assert.equal(T.proposition(c, 'chaine+h'), null, 'sans l\'option : la garde de paire diffère');
  assert.equal(T.proposition(c, 'chaine+h', { gardePaire: { nMm: 10, axes: 'lv' } }), null, 'voie à 15 mm en vertical : non confirmée');
  const l = T.proposition(c, 'chaine+h', { gardePaire: { nMm: 10, axes: 'l' } });
  assert.equal(l.post, 'garde-paire-confirmee'); assert.deepEqual(l.rails.left, [0, 0, -19]); assert.equal(l.stage, 'first-pass');
  assert.equal(T.proposition(c, 'chaine+h', { gardePaire: { nMm: 20, axes: 'lv' } }).post, 'garde-paire-confirmee');
  assert.equal(T.proposition(c, 'seul+h', { gardePaire: { nMm: 20, axes: 'l' } }), null, 'la variante seule n\'est jamais levée');
  const autre = cas(1, 30, { mic: v(0, 0) }); autre.ariane.chaineGardePaire = c.ariane.chaineGardePaire;
  assert.equal(T.proposition(autre, 'chaine+h', { gardePaire: { nMm: 20, axes: 'l' } }), null, 'jamais sur un différé d\'un autre motif');
});

test('règle et bilan : la proposition levée n\'est lue que par une règle qui porte le seuil', () => {
  const p = partie(1), r = T.lignes(p, { gardes: GP.GRILLE }), ls = r.lignes;
  const base = { variante: 'chaine+h', X: 8, Y: 0, D: 45, C: null, G: null, stages: null, differes: false, poses: true };
  const sans = T.bilan(ls, base), lv10 = T.bilan(ls, { ...base, gardePaire: { nMm: 10, axes: 'lv' } }), l10 = T.bilan(ls, { ...base, gardePaire: { nMm: 10, axes: 'l' } });
  assert.deepEqual([sans.agit, sans.corrigesJustes, sans.abime, sans.abstention], [0, 0, 0, 3]);
  assert.deepEqual([lv10.agit, lv10.corrigesJustes, lv10.abime, lv10.abstention], [2, 2, 0, 1]);
  assert.deepEqual([l10.agit, l10.corrigesJustes, l10.abime, l10.abstention], [3, 2, 1, 0]);
  /* Sans l'option, les lignes sont les mêmes qu'avant (aucune proposition levée). */
  const r0 = T.lignes(p); assert.equal(r0.lignes.some(l => l.varGP || l.gardePaire), false);
  assert.deepEqual(T.bilan(r0.lignes, { ...base, gardePaire: { nMm: 10, axes: 'lv' } }), sans);
  const d = T.detailGardePaire(ls.filter(l => l.zone !== 'hors'), { ...base, gardePaire: { nMm: 10, axes: 'lv' } });
  assert.deepEqual(d.map(x => [x.cut, x.confirmee, x.agit, x.issue]), [[20, true, true, 'reproduit5'], [21, true, true, 'reproduit5'], [22, false, false, 'laisse-juste']]);
  assert.deepEqual(d[2].chaine, [1, 15]); assert.equal(d[2].ecartLeve, 15);
});

test('étude sans l\'option : chiffres identiques à ceux d\'une extraction sans levée ; grille inchangée', () => {
  const ps = [partie(1), partie(2), partie(3)];
  const nues = ps.map(p => ({ ...p, cas: p.cas.map(c => { const a = { ...c.ariane }; delete a.chaineGardePaire; return { ...c, ariane: a }; }) }));
  const a = T.etudier(ps, { grille: PETITE }), b = T.etudier(nues, { grille: PETITE });
  assert.deepEqual(a.totalCroiseeSobre, b.totalCroiseeSobre); assert.deepEqual(a.parTypeCroiseeSobre, b.parTypeCroiseeSobre);
  assert.equal(a.gardePaire, false); assert.equal(a.sensibiliteGP, null);
  assert.ok(a.croisee.every(c => !('gardePaire' in c.regleSobre)), 'sans l\'option, la règle ne porte pas de seuil');
});

test('étude avec l\'option : le seuil est appris sans la partie jugée ; latéral et vertical, le plus strict à gain égal', () => {
  const ps = [partie(1), partie(2), partie(3)];
  const o = T.etudier(ps, { grille: PETITE, gardePaire: true });
  assert.equal(o.gardePaire, true);
  for (const c of o.croisee) {
    assert.deepEqual(c.regleSobre.gardePaire, { nMm: 5, axes: 'lv' }, 'plus strict à gain égal');
    assert.equal(c.bilanSobre.corrigesJustes, 2); assert.equal(c.bilanSobre.abime + c.bilanSobre.aggrave, 0); assert.equal(c.bilanSobre.mauvaiseVoie, 0);
  }
  /* Sensibilité : en latéral seul, la garde de paire levée abîme un cut par partie. */
  const l20 = o.sensibiliteGP.find(s => s.gardePaire && s.gardePaire.nMm === 20 && s.gardePaire.axes === 'l');
  assert.deepEqual([l20.total.corrigesJustes, l20.total.abime], [6, 3]);
  assert.deepEqual(o.sensibiliteGP[0].gardePaire, null); assert.equal(o.sensibiliteGP[0].total.corrigesJustes, 0);
  assert.match(T.texte(o), /Garde de paire confirmée/);
  /* Comparaison avec la référence (même étude sans l'option). */
  const ref = T.etudier(ps, { grille: PETITE }), cmp = T.comparer(ref, o), tot = cmp.total.find(t => t.groupe === 'toutes zones');
  assert.deepEqual([tot.ecart.justes, tot.ecart.abimes, tot.ecart.mauvaiseVoie, tot.ecart.net], [6, 0, 0, 6]);
  assert.match(T.texteComparaison(cmp), /zone adv/);
});

test('réglages proposés : le bloc de la garde de paire n\'apparaît que si la règle de service la lève, et regleDuReglage le relit', () => {
  const ps = [partie(1), partie(2), partie(3)];
  const g = T.reglagesProposes(T.etudier(ps, { grille: PETITE, gardePaire: true }), { date: '2026-10-17' });
  assert.deepEqual([g.gardePaireConfirmee.actif, g.gardePaireConfirmee.nMm, g.gardePaireConfirmee.axes], [true, 5, 'lv']);
  assert.deepEqual(T.regleDuReglage(g).regle.gardePaire, { nMm: 5, axes: 'lv' });
  const sans = T.reglagesProposes(T.etudier(ps, { grille: PETITE }), { date: '2026-10-17' });
  assert.equal('gardePaireConfirmee' in sans, false); assert.equal('gardePaire' in T.regleDuReglage(sans).regle, false);
});

test('greffe : sans garde de paire en chaîne, le fichier est rendu tel quel et l\'Écho n\'est pas lue', () => {
  const cs = partie(1).cas.filter(c => c.ariane.chaine.reason !== 'pair-guard');
  const g = T.greffeGardePaire({ partie: 1, echo: ['/dossier/absent'], cas: cs, table: null });
  assert.equal(g.cas, cs); assert.equal(g.bilan.cibles, 0);
});

test('voisinage actuel : pose de départ de la première visite, ±5 cuts, différés du lot marqués, jamais le cut lui-même', () => {
  const visite = (cut, x) => ({ cut, visites: [{ beforeEstablished: { rails: { left: { positionSceneRelative: [x, 0.7, 0] }, right: { positionSceneRelative: [x, -0.7, 0] } } } }] });
  const f = T.voisinageActuel([visite(100, 1), visite(101, 2), visite(103, 3), visite(106, 4), visite(110, 5)], { table: { lot: [{ cut: 101, differe: true }, { cut: 103, differe: false }] } });
  const r = f(105);
  assert.equal(r.actif, true);
  assert.deepEqual(r.poses.map(p => [p.cut, p.differe]), [[100, false], [101, true], [103, false], [106, false], [110, false]]);
  assert.deepEqual(f(101).poses.map(p => p.cut), [100, 103, 106], 'jamais le cut lui-même');
});
