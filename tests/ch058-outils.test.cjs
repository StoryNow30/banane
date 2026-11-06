'use strict';
/* CH-058 — essais des outils de mesure (sans navigateur, sans données terrain, sous 20 s).
 *   node --test tests/ch058-outils.test.cjs */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/ch058-temps-journee.cjs'),B=require('../tools/ch058-banc-etat.cjs');
const UUID=/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

test('statistiques : médiane, intervalle des rangs, pente',()=>{
  const r=T.resume([5,1,3,2,4,6,7,8,9,10]);
  assert.equal(r.n,10);assert.equal(r.mediane,5.5);assert.equal(r.max,10);assert.ok(r.ic95[0]<=5.5&&r.ic95[1]>=5.5);
  assert.equal(T.resume([1,2,3]).ic95,null,'pas d’intervalle sous 6 valeurs');
  assert.deepEqual(T.resume([]),{n:0});
  const p=T.pente([[0,1],[1,3],[2,5],[3,7]]);assert.ok(Math.abs(p.pente-2)<1e-9);assert.ok(p.marge95<1e-6);
});

/* Un journal minimal : deux validations par partie, une relecture, une ouverture de correction, un changement de partie. */
function journal(){const t=s=>new Date(Date.parse('2026-01-01T08:00:00Z')+s*1000).toISOString();
  const id=(p,c)=>`page|${p}|${c}|U50|cadre|not-observed`;
  const ev=[
    {type:'validation-accepted',timestamp:t(0),batchId:'L',cutId:id(8,1)},{type:'validation-accepted',timestamp:t(3),batchId:'L',cutId:id(8,2)},
    {type:'validation-accepted',timestamp:t(6),batchId:'L',cutId:id(8,3)},{type:'validation-accepted',timestamp:t(200),batchId:'L',cutId:id(8,4)},
    {type:'relecture-ombre',timestamp:t(10),lotId:'L',identity:{part:8}},{type:'relecture-ombre',timestamp:t(11.5),lotId:'L',identity:{part:8},poseEsv:{left:[1,2,3]}},
    {type:'goto-cut',timestamp:t(20),dureeMs:22,dureePageMs:10},{type:'correction-ouvrir',timestamp:t(21)},{type:'correction-ouvrir',timestamp:t(35)},
    {type:'file-parties-changement',timestamp:t(40),issue:'ok',de:{part:8},vers:9,dureeMs:11000,jalons:{rechargee:70,chargee:1600,partieLue:11000}},
    {type:'adapter-progress',timestamp:t(1)},{type:'capture-abandoned',timestamp:t(2)}];
  return {format:'banane-test-journal-v4',version:'5',events:ev,machine:{memoireJsMo:{utilisee:100},coeurs:4,memoireGo:8},
    state:{batch:{processed:new Array(400).fill({cut:1,statut:'valid'})},native:{visits:[{visitId:'v'}],cloudIds:['a','b'],exportState:{exportedCloudIds:['a'],releasedCloudIds:['a']},observationPeriods:[]}}};}

test('journal : phases, pauses écartées, sauvegardes comptées, rien de recopié',()=>{
  const r=T.analyserJournal(journal(),'essai');
  assert.equal(r.phases.lot[8].travail.n,2,'deux écarts de 3 s');assert.equal(r.phases.lot[8].travail.mediane,3);assert.equal(r.phases.lot[8].pauses,1,'194 s = pause');
  assert.equal(r.phases.relecture[8].travail.mediane,1.5);
  assert.equal(r.phases.correction.gotoCutMs.mediane,22);assert.equal(r.phases.correction.entreOuverturesS.mediane,14);
  assert.equal(r.phases.changementPartie[0].dureeS,11);
  assert.equal(r.sauvegardes.validations,4);assert.equal(r.sauvegardes.evenementsAvecSauvegarde,5,'4 validations + 1 abandon ; adapter-progress, relecture, goto-cut sans sauvegarde');
  assert.equal(r.etatFinal.native.cloudIds,2);assert.equal(r.machine.memoireJsMo.utilisee,100);
  const txt=JSON.stringify(r);assert.ok(!txt.includes('poseEsv')&&!txt.includes('cadre'),'ni pose ni identifiant recopiés');
});

test('Écho : retard page → service worker, par taille de session, dédoublonné',()=>{
  const seg=(exp,visites,evts)=>({nom:'seg',j:{exportedAt:exp,session:{visits:new Array(visites).fill({}),cloudIds:[],exportState:{exportedCloudIds:[],releasedCloudIds:[]},observationPeriods:[]},events:evts}});
  const e=(id,page,sw)=>({eventId:id,type:'native-operator-event',timestamp:sw,event:{observedAt:page},collectorMetrics:{queueDepth:3}});
  const a=seg('2026-01-01T08:00:00Z',10,[e('1','2026-01-01T08:00:01.000Z','2026-01-01T08:00:01.100Z')]);
  const b=seg('2026-01-01T08:10:00Z',500,[e('1','2026-01-01T08:00:01.000Z','2026-01-01T08:00:01.100Z'),e('2','2026-01-01T08:10:05.000Z','2026-01-01T08:10:13.000Z')]);
  const r=T.analyserEcho([a,b]);
  assert.equal(r.evenements,2,'le même événement dans deux segments compte une fois');
  assert.equal(r.retardSwParType['native-operator-event'].n,2);
  assert.equal(r.retardSelonTaille.length,2);assert.equal(r.retardSelonTaille[1].mediane,8);assert.equal(r.retardSelonTaille[1].partPlus5s,1);
  assert.equal(T.heurePage({chunk:{capturedAt:'x'}}),'x');
});

test('banc : session Écho synthétique aux proportions mesurées, sans donnée terrain',()=>{
  const s=B.sessionEcho(1000);
  assert.equal(s.visits.length,1000);assert.ok(s.cloudIds.length>=6000&&s.cloudIds.length<=7000,'6,4 nuages par visite');
  assert.deepEqual(s.exportState.exportedCloudIds,s.cloudIds);
  const mo=B.mo(s);assert.ok(mo>1.0&&mo<1.6,'≈1,2 Mo pour 1 000 visites (terrain : 1,5 Mo pour 1 152) : '+mo);
  assert.deepEqual(B.sessionEcho(50,3),B.sessionEcho(50,3),'déterministe');
  const v=B.visitesPour(1);assert.ok(Math.abs(B.mo(B.sessionEcho(v))-1)<0.02,'dichotomie à 2 % près');
  assert.equal(JSON.stringify(B.evenementLot(5)).length,860,'événement de lot au poids moyen mesuré');
  assert.ok(!UUID.test(JSON.stringify(B.evenementLot(5))));
  const o=B.args(['--tailles','0.4,2','--export','0,1000','--seulement-export']);assert.deepEqual(o.tailles,[0.4,2]);assert.deepEqual(o.export,[0,1000]);assert.equal(o.seulementExport,true);
  assert.throws(()=>B.args(['--inconnu']));
});
