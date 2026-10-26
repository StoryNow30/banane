'use strict';
/* T21a : tableau de bord B-min (tools/tableau-bord.cjs), contrôle a posteriori de la deuxième passe (tools/controle-passe.cjs) et lecture des
 * archives (tools/exports-lots.cjs). Données FABRIQUÉES : journal synthétique (partie 91, cuts 1 à 6), aucune valeur de terrain.
 * Preuve d'écriture (fiche H) : l'écriture de validation 2xx observée, jamais `serverConfirmed`. */
const { test } = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const TB = require('../tools/tableau-bord.cjs'), CP = require('../tools/controle-passe.cjs'), X = require('../tools/exports-lots.cjs'), Z = require('../src/zip-writer.js');

const T0 = Date.UTC(2031, 2, 3, 8, 0, 0), iso = s => new Date(T0 + s * 1000).toISOString();
const LOT = 'aaaabbbb-lot-synthetique';
function journal({ version = '4.9.5.19', passe = true, preuve = true, serverConfirmedSeul = false, faussesPreuves = false } = {}) {
  const ev = [{ type: 'batch-started', timestamp: iso(0), batch: { id: LOT, scope: { part: 91, extensionVersion: version } } }];
  for (let c = 1; c <= 6; c++) {
    ev.push({ type: 'cut-target-changed', timestamp: iso(10 * c - 1), identity: { part: 91, cut: c - 1 }, nextIdentity: { part: 91, cut: c } });
    ev.push({ type: 'gcv1-shadow-observed', timestamp: iso(10 * c), batchId: LOT, identity: { part: 91, cut: c }, lotObservation: { stage: c <= 3 ? 'first-pass' : 'deferred', reason: c <= 3 ? null : 'no-anchor', command: { action: c <= 3 ? 'lot' : 'defer' } } });
    if (c <= 3) ev.push({ type: 'validation-accepted', timestamp: iso(10 * c + 2), batchId: LOT, identity: { part: 91, cut: c } });
  }
  if (passe) {
    ev.push({ type: 'passe-differes-ombre', timestamp: iso(100), batchId: LOT, identity: { part: 91, cut: 4 }, decision: 'poserait' });
    ev.push({ type: 'passe-differes-ombre', timestamp: iso(100), batchId: LOT, identity: { part: 91, cut: 5 }, decision: 'poserait' });
    ev.push({ type: 'passe-differes-ombre', timestamp: iso(100), batchId: LOT, identity: { part: 91, cut: 6 }, decision: 'rien' });
    ev.push({ type: 'passe-differes-ombre-fin', timestamp: iso(101), batchId: LOT, lotId: LOT, mode: 'ecriture', differes: 3, posees: 2 });
    if (preuve) ev.push({ type: 'esv-observation', timestamp: iso(109), kind: 'write', method: 'PUT', status: 204, rowIndex: 4, body: { ExtractionStatus: 'valid', TreatedByOperator: true, SeenByOperator: true } });
    if (faussesPreuves) ev.push({ type: 'esv-observation', timestamp: iso(108), kind: 'write', method: 'PUT', status: 204, rowIndex: 4, body: { SeenByOperator: true } },
      { type: 'esv-observation', timestamp: iso(109), kind: 'write', method: 'PUT', status: 500, rowIndex: 4, body: { ExtractionStatus: 'valid', TreatedByOperator: true } },
      { type: 'esv-observation', timestamp: iso(109), kind: 'write', method: 'PUT', status: 204, rowIndex: 3, body: { ExtractionStatus: 'valid', TreatedByOperator: true } },
      { type: 'esv-observation', timestamp: iso(300), kind: 'write', method: 'PUT', status: 204, rowIndex: 4, body: { ExtractionStatus: 'valid', TreatedByOperator: true } });
    ev.push({ type: 'validation-accepted', timestamp: iso(110), batchId: LOT, identity: { part: 91, cut: 4 }, ...(serverConfirmedSeul ? { serverConfirmed: true } : {}) });
    ev.push({ type: 'passe-differes-ecriture', timestamp: iso(110), batchId: LOT, identity: { part: 91, cut: 4 }, passe: 1, resultat: 'ecrit', ms: 5000, ...(serverConfirmedSeul ? { serverConfirmed: true } : {}) });
    ev.push({ type: 'passe-differes-ecriture', timestamp: iso(115), batchId: LOT, identity: { part: 91, cut: 5 }, passe: 1, resultat: 'refuse', raison: 'cible hors de la vue' });
    ev.push({ type: 'passe-differes-ecriture-fin', timestamp: iso(115), batchId: LOT, lotId: LOT, issue: 'refuse', ecrites: 1, demandees: 2, decidees: 2 });
  }
  return { version, machine: { plateforme: 'Windows', coeurs: 8, memoireGo: 16, gpu: { rendu: 'synthetique' } }, events: ev, records: [] };
}

test('passe : un cut « ecrit » n’est prouvé que par l’écriture de validation 2xx observée (jamais par serverConfirmed)', () => {
  const [l] = CP.ecrituresPasse(journal());
  assert.equal(l.source, 'evenements'); assert.equal(l.ecrits, 1); assert.equal(l.ecritsProuves, 1);
  assert.equal(l.cuts.find(c => c.cut === 4).preuveEcriture.statut, 204);
  assert.equal(l.ombre.poserait, 2); assert.equal(l.ecriture.fin.issue, 'refuse');
  const [s] = CP.ecrituresPasse(journal({ preuve: false, serverConfirmedSeul: true }));
  assert.equal(s.ecrits, 1); assert.equal(s.ecritsProuves, 0, 'serverConfirmed seul ne prouve rien'); assert.deepEqual(s.ecritsSansPreuve, [4]);
  const [f] = CP.ecrituresPasse(journal({ preuve: false, faussesPreuves: true }));
  assert.equal(f.ecritsProuves, 0, '« vu » seul, statut 500, autre ligne, écriture hors fenêtre : aucune n’est une preuve');
});

test('passe : preuve par la liste d’ESV postérieure ; source « manquant » (version qui écrit, aucun événement) et « sans-objet » (avant 4.9.5.18)', () => {
  const st = new Array(10).fill(1); st[4] = 0;
  const [l] = CP.ecrituresPasse(journal({ preuve: false }), { listes: [{ partie: 91, at: iso(200), st }, { partie: 91, at: iso(50), st: new Array(10).fill(1) }] });
  assert.equal(l.ecritsProuves, 1); assert.equal(l.cuts.find(c => c.cut === 4).preuveListe.valide, true);
  assert.equal(CP.ecrituresPasse(journal({ passe: false }))[0].source, 'manquant');
  assert.equal(CP.ecrituresPasse(journal({ passe: false, version: '4.9.5.3' }))[0].source, 'sans-objet');
  assert.ok(CP.versionAuMoins('4.9.5.18') && CP.versionAuMoins('4.9.6.1') && !CP.versionAuMoins('4.9.5.9'));
});

test('contrôle : moins de 60 cuts disponibles, « contrôle non fait : N » ; au-delà, échantillon de 60 reproductible', () => {
  const lots = CP.ecrituresPasse(journal());
  const r = CP.controler(lots);
  assert.equal(r.statut, 'controle-non-fait'); assert.match(r.message, /^contrôle non fait : 1 cut\(s\) disponible\(s\)/);
  assert.match(CP.markdown(r), /contrôle non fait/); assert.doesNotMatch(CP.markdown(r), /contrôle fait/);
  const beaucoup = [{ lotId: 'x', partie: 91, version: '4.9.5.19', source: 'evenements', ombre: { decisions: 0 }, ecriture: {}, ecrits: 70, ecritsProuves: 70, ecritsSansPreuve: [],
    cuts: Array.from({ length: 70 }, (_, i) => ({ cut: i + 1, partie: 91, resultat: 'ecrit', preuveEcriture: { statut: 204 } })) }];
  const a = CP.controler(beaucoup, { graine: 7 }), b = CP.controler(beaucoup, { graine: 7 });
  assert.equal(a.statut, 'echantillon-pret'); assert.equal(a.echantillon.length, 60); assert.deepEqual(a.echantillon, b.echantillon);
  assert.equal(a.borneWilson95SiZeroErreur, 5.2, 'zéro erreur sur 70 : borne haute de Wilson');
});

test('B-min : posés par le lot hors passe, écrits par la passe comptés à part, différés de l’état du lot, sans pose = différés − écrits', () => {
  const [l] = TB.lignesDuJournal(journal(), { populations: { reglage: ['ffff'] } });
  assert.equal(l.cuts, 6); assert.equal(l.posesLot, 3, 'la validation de la passe porte le numéro du lot : retirée des posés du lot');
  assert.equal(l.passeEcrits.n, 1); assert.equal(l.passeEcrits.source, 'evenements');
  assert.equal(l.differesLot, 3); assert.equal(l.sansPose.n, 2); assert.equal(l.population, 'terrain');
  assert.match(l.poste, /^poste-[0-9a-f]{6}$/); assert.equal(l.lot, 'aaaabbbb');
  assert.ok(l.vitesseLot && l.vitesseLot.cycles >= 1, 'temps par cut mesurés');
  const [r] = TB.lignesDuJournal(journal(), { populations: { reglage: ['aaaabbbb'] } }); assert.equal(r.population, 'reglage');
  const fv = TB.parVersion([l], { date: '2031-03-03', commitOutil: null });
  assert.equal(fv[0].version, '4.9.5.19'); assert.equal(fv[0].populations.terrain.avecEcho, null);
  assert.equal(fv[0].populations.terrain.sansEcho.passeEcrits.n, 1); assert.equal(fv[0].populations.terrain.sansEcho.skipOmbre, null);
  const md = TB.markdown([l], fv, { date: '2031-03-03' });
  assert.match(md, /avec Écho : non produit/); assert.match(md, /aaaabbbb/);
  assert.deepEqual(TB.wilson95(0, 60), [0, 6]);
});

test('archives : zip et zip découpé en volumes .zip.001/.002 lus sans extraction ; 7z listé comme illisible', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'exports-lots-')), c = path.join(dir, 'collecte'); fs.mkdirSync(c);
  try {
    const z = Z.createZip({ date: new Date(Date.UTC(2031, 2, 3)), methode: 'deflate' });
    await z.ajouter('ariane-journal-v4-1234567890.json', new Blob([JSON.stringify(journal())]));
    const buf = Buffer.from(await z.terminer().arrayBuffer()), mi = Math.floor(buf.length / 2);
    fs.writeFileSync(path.join(c, 'lot.zip.001'), buf.subarray(0, mi)); fs.writeFileSync(path.join(c, 'lot.zip.002'), buf.subarray(mi));
    fs.writeFileSync(path.join(c, 'entier.zip'), buf); fs.writeFileSync(path.join(c, 'vieux.7z'), 'x');
    const inv = X.inventaire(dir);
    assert.equal(inv.lisibles.filter(x => x.type === 'journal').length, 2);
    assert.equal(inv.illisibles.length, 1); assert.match(inv.illisibles[0].raison, /7z/);
    for (const j of X.journaux(dir)) assert.equal(JSON.parse(j.lire().toString('utf8')).events[0].batch.id, LOT);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
