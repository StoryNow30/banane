'use strict';
/* Réducteur d'exports (tools/reducteur-exports-core.js, page tools/navigateur/reducteur-exports.html) :
 * il retire ce qui ne change aucun chiffre du rapport d'acceptation, et seulement cela. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const R=require('../tools/reducteur-exports-core.js'),A=require('../tools/acceptance-report.cjs'),X=require('../src/native-export.js');
const {pair,pilotCut,pilotLot,visit,relecture}=require('./helpers/acceptance-lot.cjs');

test('classer : le format, première clé de l’export, dit de quoi il s’agit',()=>{
  const c=f=>R.classer(`{"format":"${f}","version":"4.8.5.2","state":{}}`);
  assert.equal(c('banane-test-journal-v4'),'journal');assert.equal(c('banane-gcv1-diagnostic-v1'),'diagnostic');
  assert.equal(c('banane-gcv1-lidar-corpus-v1'),'corpus');assert.equal(c('banane-test-dataset-v4'),'bilan');
  assert.equal(c('banane-native-session-v2'),'relecture');assert.equal(c('banane-native-session-v3-compact'),'relecture');
  assert.equal(c('autre-chose'),'autre');assert.equal(R.classer('pas du json'),'autre');
});

const lourde=r=>({...r,railSnapshots:{left:[{x:1}],right:[]},geometryObservations:[{p:new Array(20).fill(1)}],geometryCaptures:[{q:2}]});

test('alléger une visite : les trois champs lourds partent, le reste est intact',()=>{
  const v=lourde(visit(7,10,{before:pair(10)})),l=R.alleger(v);
  for(const k of R.LOURDS)assert.equal(k in l,false,k);
  assert.deepEqual(l.humanFinalReference,v.humanFinalReference);assert.equal('railSnapshots' in v,true,'l’original n’est pas modifié');
});

test('relecture en segments compacts : dictionnaires enchaînés, visite la plus récente, événements et nuages écartés',()=>{
  const v1=lourde(visit(7,10,{before:pair(10)})),v2=lourde(visit(7,11,{before:pair(11)}));
  const doc=(records,exportedAt,index)=>({...relecture(records),version:'4.8.5.2',exportedAt,segment:{format:'banane-native-export-segment-v1',stamp:'S',index},events:[{eventId:'e'}]});
  const s1=X.compact(doc([v1],'2026-09-29T10:00:00Z',1)),s2=X.compact(doc([{...v1,visitIndex:9},v2],'2026-09-29T10:05:00Z',2));
  const rel=new R.Relecture();rel.ajouter(s1);rel.ajouter(s2);
  assert.equal(rel.records.size,2);assert.equal(rel.visitesLues,3);assert.deepEqual(rel.parties(),[7]);
  const [d]=rel.documents(),v=d.records.find(r=>r.recordId===v1.recordId);
  assert.equal(v.visitIndex,9,'la plus récente l’emporte');assert.equal('railSnapshots' in v,false);
  assert.deepEqual(d.events,[]);assert.deepEqual(d.clouds,[]);assert.equal(d.format,'ariane-relecture-reduite-v1');
  assert.deepEqual(d.reduction.retire,[...R.LOURDS,'events','clouds']);
});

test('documents : au-delà de la taille maximale, les visites sont réparties, la fusion en fait l’union',()=>{
  const rel=new R.Relecture();
  rel.ajouter({...relecture([1,2,3,4].map(c=>visit(7,c,{before:pair(c)}))),version:'x',exportedAt:'2026'});
  const un=rel.documents(),plusieurs=rel.documents(JSON.stringify(un[0].records[0]).length*1.5);
  assert.equal(un.length,1);assert.equal(plusieurs.length,4);assert.deepEqual(plusieurs.map(d=>d.reduction.partie),[1,2,3,4]);
  assert.equal(plusieurs.flatMap(d=>d.records).length,4);
});

test('rapport d’acceptation : mêmes résultats avec la relecture allégée',()=>{
  const P=41,T=[10,20,0],cuts=[pilotCut(P,100),pilotCut(P,101),pilotCut(P,102)],lot=pilotLot(P,cuts);
  const records=[visit(P,100,{before:pair(100,{},T),final:pair(100,{},T)}),visit(P,101,{before:pair(101,{},T),final:pair(101,{left:[12,0]},T)}),
    visit(P,102,{before:pair(102,{},T),final:pair(102,{},T)})].map(lourde);
  const rel=new R.Relecture();rel.ajouter(relecture(records));
  const plein=JSON.parse(JSON.stringify(A.report([{label:'l',...lot,corpus:null,relecture:relecture(records)}]))),
    leger=JSON.parse(JSON.stringify(A.report([{label:'l',...lot,corpus:null,relecture:rel.documents()[0]}])));
  for(const l of [...plein.lots,...leger.lots])delete l.relecture;
  assert.deepEqual(leger,plein);
  assert.ok(plein.total.c4.judgedApplied>0,'le cas jugé existe');
});

test('page : un seul fichier, sans dépendance externe, avec les trois sources dans l’ordre',()=>{
  const {execFileSync}=require('node:child_process'),tmp=path.join(require('node:os').tmpdir(),'reducteur-'+process.pid+'.html');
  execFileSync('python3',[path.join(__dirname,'..','tools','navigateur','construire-reducteur.py'),'--output',tmp],{stdio:'pipe'});
  const h=fs.readFileSync(tmp,'utf8');fs.rmSync(tmp);
  assert.doesNotMatch(h,/<script[^>]+src=|<link[^>]+href=|https?:\/\//,'aucune ressource externe');
  const i=k=>h.indexOf(k);assert.ok(i('root.BananeCaptureCore')>=0&&i('root.BananeCaptureCore')<i('root.BananeCore3=api')&&i('root.BananeCore3=api')<i('root.BananeNativeExport')&&i('root.BananeNativeExport')<i('root.ArianeReducteur'));
  assert.doesNotMatch(h,/\/\*(CAPTURE|CORE|NATIF|COEUR)\*\//);
});
