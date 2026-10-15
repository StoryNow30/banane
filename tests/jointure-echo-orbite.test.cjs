'use strict';
/* S3 (plan 5.0) : jointure Écho ↔ Orbite, sur une fixture synthétique (partie 99, quatre cuts inventés, aucune
 * donnée de terrain). La fixture a deux segments d'Écho (un v2 clair, un v3 compact) et un journal :
 *  - 1001 posée : première visite validée, seconde visite validée à nouveau (la dernière validation fait foi) ;
 *  - 1002 différée : repère profil tourné de 90° (longitudinal, latéral et vertical distincts), décision B1 en ombre ;
 *  - 1003 hors journal, sans mouvement ; 1005 hors journal, sans validation observée ;
 *  - 1004 au journal seulement ; 1006 posée sans matrice de repère profil (distance 3D seule) ;
 *  - une autre partie (98) à l'Écho, ignorée. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const J = require('../tools/jointure-echo-orbite.cjs');

const DOSSIER = path.join(__dirname, 'fixtures', 'jointure');
const JOURNAL = path.join(DOSSIER, 'ariane-journal-v4-synthetique.json');
const proche = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const joindre = (options = {}) => {
  const echo = J.lireEcho([DOSSIER]);
  return { echo, ...J.joindre(echo.records, J.lireJournal(JOURNAL), options) };
};
const ligne = (table, cut) => table.find(l => l.cut === cut);

test('lecture : deux segments (v2 clair et v3 compact) en union, le segment récent l\'emporte', () => {
  const { echo } = joindre();
  assert.equal(echo.segments.length, 2);
  /* r1001a existe dans les deux segments : une seule fois, avec la référence du segment 2. */
  assert.equal(echo.records.filter(r => r.recordId === 'r1001a').length, 1);
  assert.ok(echo.records.find(r => r.recordId === 'r1001a').humanFinalReference);
  assert.equal(echo.records.length, 7);
});

test('classes Ariane, cuts joints, partie ignorée, cut du journal absent de l\'Écho', () => {
  const { table, resume } = joindre();
  assert.deepEqual(table.map(l => [l.cut, l.classe]), [[1001, 'posee'], [1002, 'differee'], [1003, 'hors-journal'], [1004, 'posee'], [1005, 'hors-journal'], [1006, 'posee']]);
  assert.equal(resume.cutsEcho, 5);
  assert.equal(resume.cutsJournal, 4);
  assert.equal(resume.cutsJoints, 3);
  assert.equal(resume.cutsJournalAbsentsDeLEcho, 1);
  assert.deepEqual(resume.partiesEchoIgnorees, [98]);
  assert.equal(ligne(table, 1004).referenceHumaine, 'absent-de-l-echo');
  assert.equal(resume.parClasse.posee.cuts, 2);
});

test('visites multiples : la dernière validation est la référence ; l\'écart se mesure à la pose d\'Ariane', () => {
  const { table, resume } = joindre();
  const l = ligne(table, 1001);
  assert.equal(l.visitesEcho, 2);
  assert.equal(l.visiteReference, 2);
  assert.equal(l.base, 'ariane');
  assert.equal(l.etiquetteEcho, 'VALIDATE_CORRECTED_LEFT_ONLY');
  assert.equal(l.ecartHumain.gauche.repere, 'profil');
  proche(l.ecartHumain.gauche.lateralMm, 3); proche(l.ecartHumain.gauche.verticalMm, -2); proche(l.ecartHumain.gauche.longitudinalMm, 0);
  proche(l.ecartHumain.gauche.dist3dMm, Math.hypot(3, 2));
  proche(l.ecartHumain.droite.dist3dMm, 0);
  /* Repère de scène : la translation inventée (1000, 2000, 30) est retrouvée, sans résidu. */
  assert.ok(resume.repereScene.calibre);
  proche(resume.repereScene.residuP90Mm, 0, 0.001);
  /* Le déplacement d'Ariane (journal) est donné dans le repère profil : (0,002 ; 0,001 ; 0) m, gauche. */
  proche(l.arianeDeplacement.gauche.dist3dMm, Math.hypot(2, 1));
});

test('option --base : première visite et visite finale (lecture du prototype)', () => {
  const premiere = ligne(joindre({ base: 'premiere' }).table, 1001);
  assert.equal(premiere.base, 'premiere-visite');
  proche(premiere.ecartHumain.gauche.dist3dMm, Math.hypot(3, 2));
  const derniere = ligne(joindre({ base: 'derniere' }).table, 1001);
  assert.equal(derniere.base, 'derniere-visite');
  /* La seconde visite repart de la pose déjà corrigée : seul le dernier geste (2 mm vertical) reste. */
  proche(derniere.ecartHumain.gauche.dist3dMm, 2);
  assert.throws(() => joindre({ base: 'x' }), /--base inconnue/);
});

test('repère profil tourné : longitudinal, latéral, vertical ; cut différé, motif et décision B1', () => {
  const l = ligne(joindre().table, 1002);
  assert.equal(l.classe, 'differee');
  assert.equal(l.base, 'premiere-visite');
  /* écart de scène (-10, 20, 5) mm ; repère tourné : x' = y, y' = -x, z' = z. */
  proche(l.ecartHumain.gauche.longitudinalMm, 20); proche(l.ecartHumain.gauche.lateralMm, 10); proche(l.ecartHumain.gauche.verticalMm, 5);
  proche(l.ecartHumain.gauche.dist3dMm, Math.hypot(20, 10, 5));
  assert.equal(l.motifDiffere.gauche.motif, 'minTop');
  assert.equal(l.motifDiffere.droite.motif, 'rsf');
  assert.equal(l.motifDiffere.statut, 'DEFERRED_UNRESOLVED');
  assert.equal(l.b1Ombre.changement, 'pose-ajoutee');
  assert.equal(l.b1Ombre.reel.reason, 'no-anchor');
  assert.equal(l.b1Ombre.hypothese.appuis, 2);
});

test('sans référence humaine, sans mouvement, sans matrice de repère', () => {
  const { table } = joindre();
  assert.equal(ligne(table, 1005).referenceHumaine, 'sans-reference');
  assert.equal(ligne(table, 1005).ecartHumain, undefined);
  assert.equal(ligne(table, 1003).etiquetteEcho, 'VALIDATE_NO_MOVEMENT');
  assert.equal(ligne(table, 1003).ecartHumain.maxDist3dMm, 0);
  const l = ligne(table, 1006);
  assert.equal(l.ecartHumain.gauche.repere, '3D');
  assert.equal(l.ecartHumain.gauche.lateralMm, null);
  proche(l.ecartHumain.gauche.dist3dMm, Math.hypot(3, 5));
});

test('résumé : médiane, P90, maximum, corrections > 5 mm et > 10 mm par classe', () => {
  const { resume } = joindre();
  const p = resume.parClasse.posee, d = resume.parClasse.differee, h = resume.parClasse['hors-journal'];
  assert.equal(p.avecReference, 2);
  assert.equal(p.ecart3dMm.gauche.n, 2);
  proche(p.ecart3dMm.gauche.maxMm, Math.hypot(3, 5));
  assert.equal(p.corrections.sup5mm.cuts, 1);      // 1006 : 5,83 mm ; 1001 : 3,61 mm
  assert.equal(p.corrections.sup10mm.cuts, 0);
  assert.equal(d.corrections.sup10mm.cuts, 1);
  assert.equal(d.ecartVerticalAbsMm.n, 2);
  assert.equal(h.sansReference, 1);
  assert.equal(h.avecReference, 1);
  assert.deepEqual(resume.motifsDeDiffere, { minTop: 1, rsf: 1 });
  assert.deepEqual(resume.reperes, { profil: 6, '3D': 2 });
});

test('--partie : filtre ; --sans-poses : aucune coordonnée dans la table', () => {
  assert.equal(joindre({ partie: 99 }).table.length, 6);
  assert.equal(joindre({ partie: 98 }).table.length, 1);
  const avec = ligne(joindre().table, 1001), sans = ligne(joindre({ poses: false }).table, 1001);
  assert.ok(avec.poseHumaineFinale.gauche.x > 1000);
  assert.equal(sans.poseHumaineFinale, undefined);
  assert.equal(sans.poseAriane, undefined);
});

test('ligne de commande : sorties JSON et CSV, résumé lisible', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jointure-'));
  try {
    const json = path.join(tmp, 't.json'), csv = path.join(tmp, 't.csv');
    const r = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'jointure-echo-orbite.cjs'), '--echo', DOSSIER, '--journal', JOURNAL, '--sortie', json, '--csv', csv], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /5 cuts en Écho, 4 au journal, 3 joints/);
    assert.match(r.stdout, /Classe « posee »/);
    const doc = JSON.parse(fs.readFileSync(json, 'utf8'));
    assert.equal(doc.format, 'ariane-jointure-echo-orbite-v1');
    assert.equal(doc.table.length, 6);
    const lignes = fs.readFileSync(csv, 'utf8').trim().split('\n');
    assert.equal(lignes.length, 7);
    assert.match(lignes[0], /^partie,cut,classe,/);
    const mauvais = cp.spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'jointure-echo-orbite.cjs'), '--echo', DOSSIER], { encoding: 'utf8' });
    assert.equal(mauvais.status, 1);
    assert.match(mauvais.stderr, /Usage/);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
