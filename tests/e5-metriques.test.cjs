'use strict';
/* E5 (plan 5.0) : jeu d'apprentissage et métriques de version, sur une jointure SYNTHÉTIQUE (partie 99, cuts
 * inventés, valeurs choisies pour tomber sur des seuils exacts). Aucune donnée de terrain.
 *
 * Cuts posés avec référence (101 à 108), distance 3D par rail (gauche, droite) en mm :
 *   101 (0, 0)   102 (3, 0)   103 (6, 0)   104 (6, 8)   105 (12, 5)   106 (20, 0)   107 (10, 0)   108 (5, 0)
 * donc corrigés > 5 mm : 103, 104, 105, 106, 107 (5 cuts ; 108 à 5,0 exactement ne compte pas) ;
 *      corrigés > 10 mm : 105, 106 (2 cuts ; 107 à 10,0 exactement ne compte pas).
 * 109 posé sans validation observée ; 110 posé absent de l'Écho ; 111, 112 différés ; 113 « autre » ;
 * 121 à 124 hors journal (121 à 123 avec référence dont 122 > 10 mm, 124 sans). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const J = require('../tools/jeu-apprentissage.cjs');
const M = require('../tools/metriques-version.cjs');

const OUTIL_JEU = path.join(__dirname, '..', 'tools', 'jeu-apprentissage.cjs');
const OUTIL_MET = path.join(__dirname, '..', 'tools', 'metriques-version.cjs');
const proche = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);

const rail = (lat, vert) => ({ repere: 'profil', longitudinalMm: 0, lateralMm: lat, verticalMm: vert, dist3dMm: Math.hypot(lat, vert) });
const ecart = (g, d) => ({ gauche: g, droite: d, maxDist3dMm: Math.max(g.dist3dMm, d.dist3dMm) });
const POSES = { gauche: { x: 123456.5, y: 765432.25, z: 500.125 }, droite: { x: 123457.5, y: 765432.25, z: 500.125 } };
const proposition = { gauche: { statut: 'candidate', motif: 'candidate', convention: true, confiance: 70 }, droite: { statut: 'candidate', motif: 'candidate', convention: false, confiance: 60 } };

function ligne(cut, classe, extra = {}) {
  const dansJournal = classe !== 'hors-journal';
  return { partie: 99, cut, classe, dansEcho: true, dansJournal, visitesEcho: 1, motifDiffere: null, propositionMoteur: dansJournal ? proposition : null, b1Ombre: null,
    pose: { source: null }, etiquetteEcho: 'VALIDATE_CORRECTED_BOTH', statutEcho: 'complete', referenceHumaine: 'observee', base: 'ariane', ...extra };
}
function posee(cut, g, d) {
  return ligne(cut, 'posee', { ecartHumain: ecart(rail(...g), rail(...d)), poseAriane: POSES, poseHumaineFinale: POSES, arianeDeplacement: { gauche: rail(1, 1), droite: rail(-1, 0) }, visiteReference: 1, validationsDeLaVisite: 1 });
}
function table() {
  const lignes = [
    posee(101, [0, 0], [0, 0]), posee(102, [3, 0], [0, 0]), posee(103, [0, 6], [0, 0]), posee(104, [0, 6], [8, 0]),
    posee(105, [12, 0], [0, 5]), posee(106, [0, -20], [0, 0]), posee(107, [0, 10], [0, 0]), posee(108, [5, 0], [0, 0]),
    ligne(109, 'posee', { referenceHumaine: 'sans-reference', etiquetteEcho: 'PASS_NO_DECISION', statutEcho: 'partial' }),
    ligne(110, 'posee', { dansEcho: false, referenceHumaine: 'absent-de-l-echo', etiquetteEcho: undefined, statutEcho: undefined }),
    ligne(111, 'differee', { motifDiffere: { statut: 'DEFERRED_UNRESOLVED', gauche: { statut: 'unresolved', motif: 'slope' }, droite: { statut: 'candidate', motif: 'candidate' } }, base: 'premiere-visite', ecartHumain: ecart(rail(40, 0), rail(0, 4)) }),
    ligne(112, 'differee', { motifDiffere: { statut: 'DEFERRED_UNRESOLVED', gauche: { statut: 'unresolved', motif: 'rsf' }, droite: { statut: 'unresolved', motif: 'rsf' } }, base: 'premiere-visite', ecartHumain: ecart(rail(60, 0), rail(0, 0)) }),
    ligne(113, 'autre', { base: 'premiere-visite', ecartHumain: ecart(rail(90, 0), rail(0, 0)) }),
    ligne(121, 'hors-journal', { base: 'premiere-visite', ecartHumain: ecart(rail(2, 0), rail(0, 0)) }),
    ligne(122, 'hors-journal', { base: 'premiere-visite', ecartHumain: ecart(rail(0, 15), rail(0, 0)) }),
    ligne(123, 'hors-journal', { base: 'premiere-visite', ecartHumain: ecart(rail(0, 0), rail(0, 0)) }),
    ligne(124, 'hors-journal', { referenceHumaine: 'sans-reference', etiquetteEcho: 'PASS_NO_DECISION' }),
  ];
  return { format: 'ariane-jointure-echo-orbite-v1', options: { base: 'auto', poses: true }, resume: { cutsJoints: 12 }, table: lignes };
}
const evt = (type, t, cut, part = 99) => ({ type, timestamp: new Date(Date.UTC(2026, 0, 1, 8, 0, 0) + t * 1000).toISOString(), identity: { part, cut } });
function journal() {
  return { version: '9.9.9.9', events: [evt('validation-accepted', 0, 101), evt('validation-accepted', 10, 102), evt('defer-finalized', 20, 111),
    evt('validation-accepted', 5, 102), /* doublon plus ancien : ignoré */ evt('validation-accepted', 620, 103), evt('validation-accepted', 630, 104),
    evt('validation-accepted', 15, 555, 98), /* autre partie */ evt('phase-timing', 700, 105)] };
}
const m = () => M.metriques([{ nom: 'synthetique.json', table: table(), journal: journal() }], {});

test('jeu : seuls les cuts joints, étiquettes et seuils stricts, aucune coordonnée par défaut', () => {
  const { entete, cuts } = J.construire(table());
  assert.equal(entete.format, 'ariane-jeu-apprentissage-v1');
  assert.deepEqual(cuts.map(c => c.cut), [101, 102, 103, 104, 105, 106, 107, 108, 109, 111, 112, 113]);
  assert.equal(entete.cuts, 12);
  assert.equal(entete.avecReference, 11);
  assert.deepEqual(entete.parClasse, { autre: 1, differee: 2, posee: 9 });
  const par = n => cuts.find(c => c.cut === n);
  assert.equal(par(107).etiquette.corrige5mm, true);
  assert.equal(par(107).etiquette.corrige10mm, false); /* 10,0 exactement : pas strictement supérieur */
  assert.equal(par(108).etiquette.corrige5mm, false);
  assert.equal(par(105).etiquette.fauxVert, true);
  assert.equal(par(101).etiquette.fauxVert, false);
  assert.equal(par(111).etiquette.fauxVert, null); /* un différé n'est pas un vert */
  assert.equal(par(111).etiquette.differe, true);
  assert.equal(par(109).etiquette.corrige5mm, null); /* sans référence : on ne devine pas */
  assert.equal(par(109).etiquette.correctionMm, null);
  proche(par(106).etiquette.correctionMm.gauche.verticalMm, -20);
  proche(par(106).etiquette.correctionMm.maxDist3dMm, 20);
  assert.equal(par(101).poses, undefined);
  const texte = J.enJsonLignes({ entete, cuts });
  assert.ok(!texte.includes('123456') && !/poseAriane|poseHumaine/.test(texte), 'aucune coordonnée absolue');
  assert.equal(texte.trim().split('\n').length, 13);
});

test('jeu : traits d\'Ariane sans grandeur de la référence ; voisinage sur les numéros inférieurs ; option hors journal', () => {
  const { cuts } = J.construire(table(), { fenetre: 3 });
  const par = n => cuts.find(c => c.cut === n);
  assert.deepEqual(par(104).traits.voisinage, { fenetre: 3, posesAvant: 3, differesAvant: 0, autresAvant: 0, plusProche: { ecart: 1, classe: 'posee' } });
  assert.equal(par(101).traits.voisinage.plusProche, null);
  assert.deepEqual(par(112).traits.voisinage.differesAvant, 1);
  assert.equal(par(101).traits.propositionMoteur.droite.convention, false);
  proche(par(101).traits.deplacementAriane.gauche.dist3dMm, Math.SQRT2, 0.01);
  assert.equal(par(111).traits.differe.gauche.motif, 'slope');
  assert.ok(!JSON.stringify(par(105).traits).includes('ecartHumain'));
  const tout = J.construire(table(), { horsJournal: true });
  assert.deepEqual(tout.cuts.map(c => c.cut).slice(-4), [121, 122, 123, 124]);
  assert.equal(tout.cuts.find(c => c.cut === 122).traits, null);
  assert.equal(tout.cuts.find(c => c.cut === 122).joint, false);
  const avec = J.construire(table(), { poses: true });
  assert.equal(avec.cuts[0].poses.ariane.gauche.x, 123456.5); /* option explicite seulement */
  assert.throws(() => J.construire({ format: 'autre', table: [] }), /jointure/);
});

test('métriques : écarts par rail et par cut, quantiles à interpolation linéaire', () => {
  const p = m().tables[0].posees;
  assert.equal(p.cutsAuJournal, 10);
  assert.equal(p.avecReference, 8);
  assert.equal(p.sansReference, 1);
  assert.equal(p.absentsDeLEcho, 1);
  /* 16 rails : sept 0, puis 3, 5, 5, 6, 6, 8, 10, 12, 20 */
  assert.deepEqual(p.ecart3dParRail, { n: 16, medianeMm: 4, p90Mm: 11, maxMm: 20 });
  /* 8 cuts : 0, 3, 5, 6, 8, 10, 12, 20 */
  assert.deepEqual(p.ecart3dParCut, { n: 8, medianeMm: 7, p90Mm: 14.4, maxMm: 20 });
  assert.deepEqual(p.verticalAbsParRail, { n: 16, medianeMm: 0, p90Mm: 8, maxMm: 20 });
  assert.deepEqual(p.lateralAbsParRail, { n: 16, medianeMm: 0, p90Mm: 6.5, maxMm: 12 });
  assert.deepEqual(p.biaisMoyenMm, { lateral: 1.8, vertical: 0.4 });
});

test('métriques : seuils 5 et 10 mm stricts, faux verts, différés par cause, hors journal', () => {
  const t = m().tables[0];
  assert.deepEqual(t.posees.corriges.sup5mm, { n: 5, sur: 8, pct: 62.5 });
  assert.deepEqual(t.posees.corriges.sup10mm, { n: 2, sur: 8, pct: 25 });
  assert.equal(t.posees.corriges.railsSup5mm, 6);
  assert.equal(t.posees.corriges.railsSup10mm, 2);
  assert.deepEqual(t.fauxVerts.parRapportAuxPosesAvecReference, { n: 2, sur: 8, pct: 25 });
  assert.deepEqual(t.fauxVerts.borneBasseSurTousLesPoses, { n: 2, sur: 10, pct: 20 });
  /* journal : 10 posés + 2 différés + 1 autre = 13 cuts ; un différé compte une fois par motif de rail non résolu. */
  assert.deepEqual(t.differes.differes, { n: 2, sur: 13, pct: 15.4 });
  assert.deepEqual(t.differes.parMotifDeRail, { rsf: 1, slope: 1 });
  assert.equal(t.differesEcartHumain.avecReference, 2);
  assert.equal(t.horsJournal.avecReference, 3);
  assert.deepEqual(t.horsJournal.corriges.sup10mm, { n: 1, sur: 3, pct: 33.3 });
  assert.deepEqual(t.parties, [99]);
  assert.equal(m().version, '9.9.9.9');
});

test('métriques : cuts par heure, pause retirée, doublon et autre partie ignorés', () => {
  const d = m().tables[0].debit;
  /* décisions : 101 à t=0, 102 à 10 (le doublon à 5 est plus ancien), 111 à 20, 103 à 620, 104 à 630 ; 5 cuts, 630 s. */
  assert.equal(d.disponible, true);
  assert.equal(d.cutsDecides, 5);
  assert.equal(d.pauses, 1);
  proche(d.dureeTotaleMin, 10.5, 0.05);
  proche(d.dureeActiveMin, 0.5, 0.05);
  proche(d.cutsParHeureActif, 480, 0.1);
  proche(d.cutsParHeureBrut, 22.9, 0.1);
  const sans = M.metriques([{ nom: 'x', table: table(), journal: null }], {}).tables[0].debit;
  assert.equal(sans.disponible, false);
  assert.equal(M.debitJournal({ events: [evt('validation-accepted', 0, 1)] }, 99, 120).disponible, false);
});

test('métriques : plusieurs jointures, version imposée, texte lisible', () => {
  const t = table();
  const deux = M.metriques([{ nom: 'a', table: t, journal: null }, { nom: 'b', table: t, journal: null }], { version: 'V-essai' });
  assert.equal(deux.version, 'V-essai');
  assert.equal(deux.ensemble.posees.avecReference, 16);
  assert.deepEqual(deux.ensemble.posees.corriges.sup10mm, { n: 4, sur: 16, pct: 25 });
  const txt = M.texte(m());
  assert.match(txt, /corrigés > 10 mm   : 2\/8 \(25,0 %\)/);
  assert.match(txt, /écart 3D par rail  : n=16 médiane 4,0 P90 11,0 max 20,0 mm/);
  assert.match(txt, /Différés : 2\/13 \(15,4 %\)/);
});

test('métriques : journal seul (sans Écho) par partie, versions différentes sans total', () => {
  const ev = [evt('proposed', 0, 1), evt('validation-accepted', 1, 1), evt('proposed', 2, 2), evt('defer-finalized', 3, 2), evt('proposed', 4, 3),
    evt('applied-verified', 5, 4), evt('proposed', 6, 7, 98), evt('validation-accepted', 7, 7, 98)];
  const tables = M.tablesDuJournal({ events: ev });
  assert.deepEqual(tables.map(t => t.table[0].partie), [98, 99]);
  assert.deepEqual(tables[1].table.map(l => [l.cut, l.classe]), [[1, 'posee'], [2, 'differee'], [3, 'autre'], [4, 'posee']]);
  const entrees = tables.map((table, i) => ({ nom: `j${i}`, table, journal: { version: i ? 'A' : 'B', events: ev }, seul: true }));
  const r = M.metriques(entrees, {});
  assert.equal(r.tables[1].sansVeriteTerrain, true);
  assert.equal(r.tables[1].posees.avecReference, 0);
  assert.deepEqual(r.tables[1].differes.differes, { n: 1, sur: 4, pct: 25 });
  assert.equal(r.ensemble, undefined);
  assert.match(r.ensembleOmis, /versions différentes/);
  assert.match(M.texte(r), /Journal seul, sans Écho : 2 cuts posés/);
  const memes = M.metriques(entrees.map(e => ({ ...e, journal: { ...e.journal, version: 'A' } })), {});
  assert.equal(memes.ensemble.differes.differes.sur, 5);
});

test('quantile : interpolation linéaire, tableau vide, valeurs non finies ignorées', () => {
  assert.equal(M.quantile([], .5), null);
  assert.equal(M.quantile([5], .9), 5);
  assert.equal(M.quantile([1, 2, 3, 4], .5), 2.5);
  assert.equal(M.quantile([4, NaN, 1, 2, 3], .5), 2.5);
});

test('lignes de commande : sortie JSON lignes et JSON de métriques, erreurs d\'usage', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'e5-'));
  try {
    const tb = path.join(dossier, 'table.json'), jn = path.join(dossier, 'journal.json');
    fs.writeFileSync(tb, JSON.stringify(table())); fs.writeFileSync(jn, JSON.stringify(journal()));
    const sortieJeu = path.join(dossier, 'jeu.jsonl'), sortieMet = path.join(dossier, 'met.json');
    const a = cp.execFileSync('node', [OUTIL_JEU, '--jointure', tb, '--sortie', sortieJeu], { encoding: 'utf8' });
    assert.match(a, /12 cuts/);
    assert.match(a, /aucune \(--sans-poses\)/);
    const lignes = fs.readFileSync(sortieJeu, 'utf8').trim().split('\n').map(x => JSON.parse(x));
    assert.equal(lignes[0].type, 'entete');
    assert.equal(lignes.length, 13);
    assert.ok(!fs.readFileSync(sortieJeu, 'utf8').includes('123456'));
    const b = cp.execFileSync('node', [OUTIL_MET, '--jointure', tb, '--journal', jn, '--json', sortieMet], { encoding: 'utf8' });
    assert.match(b, /version 9\.9\.9\.9/);
    assert.equal(JSON.parse(fs.readFileSync(sortieMet, 'utf8')).tables[0].fauxVerts.parRapportAuxPosesAvecReference.n, 2);
    for (const [outil, args] of [[OUTIL_JEU, []], [OUTIL_MET, []], [OUTIL_MET, ['--journal', jn]], [OUTIL_JEU, ['--bidon']]]) {
      const r = cp.spawnSync('node', [outil, ...args], { encoding: 'utf8' });
      assert.equal(r.status, 2, `${path.basename(outil)} ${args.join(' ')}`);
    }
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});
