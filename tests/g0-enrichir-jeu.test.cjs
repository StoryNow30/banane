'use strict';
/* G0 (plan 5.0) : enrichissement d'un jeu d'apprentissage par l'extension « g0-traits-v1 », sur la fixture SYNTHÉTIQUE de la
 * jointure (partie 99, cuts 1001 à 1006 inventés) à laquelle l'essai ajoute deux observations GCV1 inventées. Aucune donnée
 * de terrain. Cuts du journal : 1001, 1002, 1004, 1006 (une seule grappe : trous de 1, 2 et 2 cuts). */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), cp = require('node:child_process');
const J = require('../tools/jointure-echo-orbite.cjs');
const JA = require('../tools/jeu-apprentissage.cjs');
const E = require('../tools/g0-enrichir-jeu.cjs');
const G = require('../tools/apprentissage-g0.cjs');

const DOSSIER = path.join(__dirname, 'fixtures', 'jointure');
const JOURNAL = path.join(DOSSIER, 'ariane-journal-v4-synthetique.json');
const OUTIL = path.join(__dirname, '..', 'tools', 'g0-enrichir-jeu.cjs');

const rail = (applique, dz) => ({ ok: true, v46: { topRows: 30, faceCount: 8, lossRatio: 3 }, astar: { lossRatio: 4.5, slopeLimited: false },
  next: { topRows: 31, faceCount: 9, nClusters: 2, nStrongCompetitive: 3, slopeLimited: false }, competitive: { nPool: 50, nStrongCompetitive: 3, nClusters: 2 },
  partialFlankUsed: false, s1Changed: false, conventionCalibration: { applied: applique, duMm: -1.5, dzMm: dz }, pairGauge: { predictedMm: 1431.2, gaugeClass: 'NOMINAL' } });
const ombre = (cut, g, d) => ({ eventId: 'shadow-' + cut, timestamp: '2030-01-01T09:05:00.000Z', type: 'gcv1-shadow-observed', identity: { part: 99, cut }, shadow: { rails: { left: g, right: d } } });

function fixture() {
  const journal = J.lireJournal(JOURNAL);
  journal.events.push(ombre(1001, rail(false, 7.5), rail(true, 2.25)), ombre(1002, rail(true, 1), rail(true, 0.5)));
  const echo = J.lireEcho([DOSSIER]);
  const { table, resume } = J.joindre(echo.records, journal, {});
  const jeu = JA.construire({ format: 'ariane-jointure-echo-orbite-v1', options: {}, resume, table }, { horsJournal: true });
  const lignes = [{ ...jeu.entete, partie: 99 }, ...jeu.cuts];
  return { journal, echo, lignes };
}
const m6 = { table: [{ cut: 1001, ecartementMm: 1437.25, ecartVoisinsMm: 4.5, sansVoisins: false, horsBandeMm: 0, score: 0.7 }, { cut: 1006, ecartementMm: 1440, ecartVoisinsMm: null, sansVoisins: true, horsBandeMm: 3.5, score: 0.2 }] };
const cutDe = (sortie, c) => sortie.find(l => l.type === 'cut' && l.cut === c);

test('traits GCV1 en ombre, grappes de rouges et table M6 sont posés sur les cuts du journal', () => {
  const { journal, echo, lignes } = fixture();
  const sortie = E.enrichir(lignes, { partie: 99, journal, m6, echo });
  const c = cutDe(sortie, 1001).traits.g0;
  assert.equal(c.version, 'g0-traits-v1');
  assert.equal(c.rails.gauche.dzMm, 7.5); assert.equal(c.rails.gauche.conventionAppliquee, false); assert.equal(c.rails.droite.conventionAppliquee, true);
  assert.equal(c.rails.gauche.lossRatio, 4.5); assert.equal(c.rails.gauche.topRows, 31); assert.equal(c.rails.gauche.nStrongCompetitive, 3); assert.equal(c.rails.gauche.ecartementPrevuMm, 1431.2);
  assert.equal(c.distRougeMin, 1); assert.equal(c.distRougeAvant, null); assert.equal(c.distRougeApres, 1);
  assert.equal(c.groupeTaille, 4); assert.equal(c.groupeRang, 0); assert.equal(c.groupeDistBord, 0);
  assert.equal(c.ecartementPoseMm, 1437.25); assert.equal(c.ecartVoisinsMm, 4.5); assert.equal(c.sansVoisins, false); assert.equal(c.scoreM6, 0.7);
  const d = cutDe(sortie, 1006).traits.g0;
  assert.equal(d.rails, null, 'pas d\'observation GCV1 pour ce cut'); assert.equal(d.groupeRang, 3); assert.equal(d.groupeDistBord, 0); assert.equal(d.sansVoisins, true); assert.equal(d.horsBandeMm, 3.5);
  assert.equal(cutDe(sortie, 1002).traits.g0.groupeDistBord, 1);
  assert.equal(sortie[0].extensionG0.cutsEnrichis, 3, 'trois cuts joints portent des traits (le 1004 n\'est pas à l\'Écho)'); assert.equal(sortie[0].extensionG0.rougesAuJournal, 4);
});

test('pose de départ à l\'Écho : écartement et dénivelé local, pour tous les cuts de l\'Écho', () => {
  const { journal, echo, lignes } = fixture();
  const sortie = E.enrichir(lignes, { partie: 99, journal, m6, echo });
  for (const c of [1001, 1002, 1003, 1005, 1006]) {
    const l = cutDe(sortie, c);
    assert.equal(l.contexte.ecartementInitialMm, 1420, `cut ${c}`);
    assert.equal(l.contexte.deniveleLocalMm, 0);
  }
  // Un rail dont la hauteur saute de 40 mm sort de la médiane de ses voisins.
  const echoSaut = J.lireEcho([DOSSIER]);
  const par = J.echoParCut(echoSaut.records, echoSaut.sessions);
  const v = par.get(Array.from(par.keys()).find(k => /1003$/.test(k))).visites[0];
  (v.initialObserved || v.firstObserved).rails.left.positionSceneRelative[2] += 0.040;
  const s2 = E.enrichir(lignes, { partie: 99, journal, echo: echoSaut });
  assert.equal(cutDe(s2, 1003).contexte.deniveleLocalMm, 40);
  assert.ok(cutDe(s2, 1003).contexte.ecartementInitialMm > 1420);
});

test('frontière anti-fuite et pas de coordonnée : l\'enrichissement ne lit rien de la référence humaine et ne sort que des mm', () => {
  const { journal, echo, lignes } = fixture();
  const sortie = E.enrichir(lignes, { partie: 99, journal, m6, echo });
  const brut = JSON.stringify(sortie.filter(l => l.type === 'cut'));
  assert.ok(!/"(poses|position[A-Za-z]*|poseAriane|poseHumaine[A-Za-z]*)"\s*:/i.test(brut));
  // Les étiquettes (référence de Mic) sont inchangées.
  assert.deepEqual(sortie.filter(l => l.type === 'cut').map(l => l.etiquette), lignes.filter(l => l.type === 'cut').map(l => l.etiquette));
  // Les traits enrichis ne dépendent pas de l'étiquette : on casse toutes les références et on compare.
  const casse = lignes.map(l => l.type === 'cut' ? { ...l, etiquette: { ...l.etiquette, correctionMm: null, referenceHumaine: 'sans-reference' } } : l);
  const s2 = E.enrichir(casse, { partie: 99, journal, m6, echo });
  assert.deepEqual(s2.filter(l => l.type === 'cut').map(l => l.traits), sortie.filter(l => l.type === 'cut').map(l => l.traits));
});

test('le jeu enrichi est lu par l\'outil d\'apprentissage (dzMax, grappe, pose de départ)', () => {
  const { journal, echo, lignes } = fixture();
  const sortie = E.enrichir(lignes, { partie: 99, journal, m6, echo });
  const lu = G.lireTexte(sortie.map(l => JSON.stringify(l)).join('\n'));
  const p = G.poserTraits(G.normaliserPartie(99, [lu], {}));
  const r = p.recs.find(x => x.cut === 1001);
  assert.equal(r.t.dzMax, 7.5); assert.equal(r.t.grappeTaille, 4); assert.equal(r.t.conventionRefusee, 1); assert.equal(r.t.ecartVoisins, 4.5);
  assert.equal(p.recs.find(x => x.cut === 1003).ctx.ecartementInitialMm, 1420);
});

test('ligne de commande', () => {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'g0e-'));
  try {
    const { journal, echo, lignes } = fixture();
    const jeu = path.join(dossier, 'jeu.jsonl'), jr = path.join(dossier, 'journal.json'), out = path.join(dossier, 'sortie.jsonl'), m = path.join(dossier, 'm6.json');
    fs.writeFileSync(jeu, lignes.map(l => JSON.stringify(l)).join('\n') + '\n');
    fs.writeFileSync(jr, JSON.stringify({ format: 'ariane-journal-v4', version: '9.9.9.9', events: journal.events }));
    fs.writeFileSync(m, JSON.stringify(m6));
    const txt = cp.execFileSync(process.execPath, [OUTIL, '--partie', '99', '--jeu', jeu, '--journal', jr, '--m6', m, '--echo', DOSSIER, '--sortie', out], { encoding: 'utf8' });
    assert.match(txt, /partie 99 : 3 cuts enrichis/);
    const rows = fs.readFileSync(out, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(rows[0].extensionG0.version, 'g0-traits-v1');
    assert.equal(rows.find(l => l.cut === 1001).traits.g0.rails.gauche.dzMm, 7.5);
    assert.equal(cp.spawnSync(process.execPath, [OUTIL, '--partie', '99'], { encoding: 'utf8' }).status, 2);
    assert.equal(cp.spawnSync(process.execPath, [OUTIL, '--bidon'], { encoding: 'utf8' }).status, 2);
  } finally { fs.rmSync(dossier, { recursive: true, force: true }); }
});
