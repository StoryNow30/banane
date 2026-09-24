'use strict';
/* Rapport d'acceptation : décision sur le lot (lotObservation 4.7.8), rejeu hors
 * ligne et ligne de commande. Données synthétiques (`tests/helpers/acceptance-lot.cjs`). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const A=require('../tools/acceptance-report.cjs');
const {pair,positions,pilotCut,pilotLot,visit,relecture}=require('./helpers/acceptance-lot.cjs');
const P=23,T=[10,20,0];
const choice=(p,stage='choice')=>({version:'lot-decision-v1',stage,positions:positions(p),anchor:stage==='first-pass',applied:false,displayed:false});

function scenario(){
  const cuts=[
    pilotCut(P,200,{lotObservation:choice(pair(200),'first-pass')}),                        // Pilote juste, lot identique
    pilotCut(P,201,{outcome:'deferred',lotObservation:choice(pair(201,{left:[2,0]}))}),     // gagné, juste
    pilotCut(P,202,{outcome:'deferred',lotObservation:choice(pair(202,{right:[15,0]}))}),   // gagné, FAUX : le Pilote ne l'a pas fait
    pilotCut(P,203,{lotObservation:choice(pair(203),'first-pass')}),                        // Pilote faux, lot faux aussi
    pilotCut(P,204,{outcome:'deferred',lotObservation:{version:'lot-decision-v1',stage:'deferred',reason:'no-anchor',applied:false}}),
  ];
  const lot=pilotLot(P,cuts),start=c=>pair(c,{},T,1500);
  const records=[visit(P,200,{before:pair(200,{},T),final:pair(200,{},T)}),
    visit(P,201,{before:start(201),final:pair(201,{},T)}),visit(P,202,{before:start(202),final:pair(202,{},T)}),
    visit(P,203,{before:pair(203,{},T),final:pair(203,{left:[12,0]},T)}),visit(P,204,{before:start(204),final:pair(204,{},T)})];
  return {label:'lot',...lot,corpus:null,relecture:relecture(records)};
}

test('décision sur le lot : couverture et faux jugés comme le Pilote ; faux nouveaux isolés',()=>{
  const r=A.report([scenario()]),d=r.total.lotDecision;
  assert.equal(r.lots[0].lotDecisionSource,'observation');
  assert.equal(d.wouldApply,4);assert.equal(d.coveragePct,80);assert.equal(d.judged,4);assert.equal(d.wrong,2);
  assert.deepEqual(d.newWrong,[202],'203 était déjà faux dans le Pilote');
  assert.deepEqual(d.gained.map(g=>[g.cut,g.worstMm]),[[201,2],[202,15]]);assert.deepEqual(d.lost,[]);
  assert.deepEqual(d.byStage,{'first-pass':2,choice:2,deferred:1});
  // C1 à C4 du Pilote restent ceux du Pilote.
  assert.equal(r.total.c1.applied,2);assert.deepEqual(r.total.c4.wrongCuts.map(w=>w.cut),[203]);
  assert.match(A.toMarkdown(r),/faux que le Pilote n’a pas faits : 202/);
});

test('exports antérieurs à la 4.7.8 : la décision sur le lot est dite absente',()=>{
  const lot=pilotLot(P,[pilotCut(P,200)]),r=A.report([{label:'ancien',...lot,relecture:null}]);
  assert.equal(r.lots[0].lotDecisionSource,'absent');assert.equal(r.total.lotDecision,null);
  assert.match(A.toMarkdown(r),/Décision sur le lot \| absente/);
});

test('rejeu : ordre du lot, ancres cumulées et plafonnées, entrée sans aucune donnée humaine',()=>{
  const cuts=[pilotCut(P,302),pilotCut(P,300),pilotCut(P,301,{outcome:'deferred'})],lot=pilotLot(P,cuts);
  const clouds=cuts.map(c=>({captureId:c.observation.lidar.captureId,identity:c.id,rails:c.before,pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true],attributes:{}}));
  const seen=[],L={decideCut(args){seen.push({cut:args.capture.identity.cut,anchors:args.anchors.map(a=>a.identity.cut),keys:Object.keys(args.capture).sort(),science:args.science});
    return {stage:'first-pass',positions:positions(args.capture.rails),anchor:true};}};
  const out=A.replayLot(lot.diagnostic.observations,{clouds},{L,Shadow:{},maxAnchors:1});
  assert.deepEqual(seen.map(s=>s.cut),[300,301,302],'ordre chronologique des observations');
  assert.deepEqual(seen.map(s=>s.anchors),[[],[300],[301]],'ancres plafonnées à maxAnchors');
  for(const s of seen){assert.deepEqual(s.keys,['identity','pointsSceneRelative','rails','visibleByClipBoxes']);assert.ok(s.science.rails.left&&s.science.summary);}
  assert.ok(out.every(x=>x.decision.applied===false));
});

test('rejeu et observation présents : parité mesurée',()=>{
  const s=scenario(),clouds=s.diagnostic.observations.map(o=>({captureId:o.lidar.captureId,identity:o.identity,rails:pair(o.identity.cut),pointsSceneRelative:[[0,0,0]],visibleByClipBoxes:[true]}));
  const recorded=new Map(s.diagnostic.observations.map(o=>[o.identity.cut,o.lotObservation]));
  const L={decideCut:({capture})=>recorded.get(capture.identity.cut)};
  const lot=A.report([{...s,corpus:{clouds}}],{replay:true,replayDeps:{L,Shadow:{},maxAnchors:40}}).lots[0];
  assert.deepEqual(lot.lotDecisionParity,{compared:5,identical:5});
});

test('ligne de commande : dossier de lot, relecture fusionnée, P2, configuration, JSON et Markdown',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acceptance-')),s=scenario(),w=(f,o)=>fs.writeFileSync(path.join(dir,f),JSON.stringify(o));
  try{
    fs.mkdirSync(path.join(dir,'lot'));
    w('lot/diagnostic.json',s.diagnostic);w('lot/journal.json',s.journal);
    // Relecture en deux segments : la fusion garde l'union des visites.
    const all=s.relecture.records;
    w('lot/relecture-seg01.json',{...relecture(all.slice(0,2)),segment:{stamp:'2026-10-01T08-10-00',index:1}});
    w('lot/relecture-seg02.json',{...relecture(all),segment:{stamp:'2026-10-01T08-20-00',index:1}});
    w('p2.json',{operators:1,cuts:30,lateralMm:{median:1,p90:2},verticalMm:{median:0.5,p90:1}});w('config.json',{tuningParts:[19,20]});
    const args=['--lot',path.join(dir,'lot')+'=essai','--p2',path.join(dir,'p2.json'),'--config',path.join(dir,'config.json'),
      '--json',path.join(dir,'r.json'),'--md',path.join(dir,'r.md')];
    const log=console.log;console.log=()=>{};let result;try{result=A.run(args);}finally{console.log=log;}
    const json=JSON.parse(fs.readFileSync(path.join(dir,'r.json'),'utf8')),md=fs.readFileSync(path.join(dir,'r.md'),'utf8');
    assert.equal(json.lots[0].relecture.records,5);assert.equal(json.lots[0].relecture.segments,2);
    assert.equal(json.parts[0].holdout,'tenue à l’écart');assert.equal(json.total.c2.floor.label,'P2 (un opérateur)');
    assert.deepEqual(json.lots[0].inputs.map(i=>i.kind).sort(),['diagnostic','journal','relecture','relecture']);
    assert.ok(json.lots[0].inputs.every(i=>/^[0-9a-f]{64}$/.test(i.sha256)));
    assert.match(md,/## Lot « essai »/);assert.match(md,/C4 — faux \| \*\*1 faux sur 2 appliqués jugés/);
    // Mêmes fichiers, même relevé.
    console.log=()=>{};try{A.run(args);}finally{console.log=log;}
    assert.equal(fs.readFileSync(path.join(dir,'r.json'),'utf8'),JSON.stringify(result,null,1)+'\n');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

/* 4.7.10 (D-042) : les cuts appliqués par la décision sur le lot sont comptés à
 * part des poses du moteur — c'est là que se lit la règle de la direction. */
test('4.7.10 : faux des cuts appliqués par la décision sur le lot, à part',()=>{
  const commanded=(p,stage,anchors)=>({...choice(p,stage),anchorsUsed:anchors,command:{action:'lot',reason:stage},applied:true});
  const cuts=[
    pilotCut(P,300,{lotObservation:{...choice(pair(300),'first-pass'),command:{action:'engine',reason:'first-pass'}}}),
    pilotCut(P,301,{applied:pair(301,{left:[2,0]}),lotObservation:commanded(pair(301,{left:[2,0]}),'window',[300,299])}),
    pilotCut(P,302,{applied:pair(302,{right:[15,0]}),lotObservation:commanded(pair(302,{right:[15,0]}),'choice',[300])}),
  ];
  const records=[visit(P,300,{before:pair(300,{},T),final:pair(300,{},T)}),
    visit(P,301,{before:pair(301,{left:[2,0]},T),final:pair(301,{},T)}),visit(P,302,{before:pair(302,{right:[15,0]},T),final:pair(302,{},T)})];
  const r=A.report([{label:'lot 4.7.10',...pilotLot(P,cuts),corpus:null,relecture:relecture(records)}]),c=r.total.c4;
  assert.equal(r.total.c1.applied,3);assert.equal(c.wrong,1);
  assert.deepEqual(c.byLotCommand,{applied:2,judged:2,wrong:1,byStage:{window:1,choice:1},wrongCuts:[{cut:302,stage:'choice',anchors:1,worstMm:15}]});
  assert.match(A.toMarkdown(r),/dont appliqués par la décision sur le lot : 1 faux sur 2 jugés/);
  assert.equal(A.report([scenario()]).total.c4.byLotCommand,null,'lot 4.7.8/4.7.9 : rien de commandé');
});

/* Export du corpus en segments (lot 4.7.10 de la partie 33 : seg01 + seg02) :
 * réunis sans doublon ; deux corpus d'exports différents restent refusés. */
test('corpus exporté en segments : captures réunies, complétude vérifiée ; bilans ignorés quand le journal est là',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'acceptance-seg-')),w=(f,o)=>fs.writeFileSync(path.join(dir,f),JSON.stringify(o));
  const seg=(index,ids,declared,extra={})=>({format:'banane-gcv1-lidar-corpus-v1',version:'4.7.10',sessionId:'session-a',
    segment:{index,stamp:'2026-09-24T10-31-16',objects:ids.length,format:'banane-native-export-segment-v1'},
    exportTrace:{cloudObjects:declared,allRequestedObjectsPresent:index===2},clouds:ids.map(captureId=>({captureId})),...extra});
  w('diag.json',{format:'banane-gcv1-diagnostic-v1',version:'4.7.10',observations:[]});
  w('journal.json',{format:'banane-test-journal-v4',version:'4.7.10',state:{},events:[]});
  w('bilan-seg01.json',{format:'banane-test-dataset-v4',state:{batch:{}}});w('bilan-seg02.json',{format:'banane-test-dataset-v4',state:{batch:{}}});
  w('corpus-seg02.json',seg(2,['c','d'],4));w('corpus-seg01.json',seg(1,['a','b'],2));
  const lot=A.loadLot(dir,'segments');
  assert.deepEqual(lot.corpus.clouds.map(c=>c.captureId),['a','b','c','d']);
  assert.deepEqual(lot.corpusSegments,{segments:2,clouds:4,declared:4,allRequestedObjectsPresent:true});
  assert.equal(lot.inputs.filter(i=>i.role==='ignoré (journal présent)').length,2);
  w('corpus-seg02.json',seg(2,['c'],4));assert.throws(()=>A.loadLot(dir,'x'),/3 captures sur 4/);
  w('corpus-seg02.json',{...seg(2,['c','d'],4),sessionId:'session-b'});assert.throws(()=>A.loadLot(dir,'x'),/pas deux segments d'un même export/);
  fs.rmSync(path.join(dir,'journal.json'));w('corpus-seg02.json',seg(2,['c','d'],4));assert.throws(()=>A.loadLot(dir,'x'),/aucun journal/);
});

/* Le rejeu suit les règles de la version du lot : la garde de paire (D-044)
 * n'existe qu'à partir de la 4.7.12 (lot 4.7.11 de la partie 34 : parité 96/96
 * avec ses règles, 93/96 avec celles de la 4.7.12). */
test('règles du rejeu selon la version du lot ; --regles-actuelles les impose',()=>{
  assert.equal(A.versionAtLeast('4.7.12','4.7.12'),true);assert.equal(A.versionAtLeast('4.7.13','4.7.12'),true);assert.equal(A.versionAtLeast('4.8.0','4.7.12'),true);
  assert.equal(A.versionAtLeast('4.7.11','4.7.12'),false);assert.equal(A.versionAtLeast('4.7.9','4.7.12'),false);assert.equal(A.versionAtLeast(null,'4.7.12'),false);
  assert.deepEqual(A.rulesFor('4.7.11'),{pairGuard:false,chainMm:10});assert.deepEqual(A.rulesFor('4.7.12'),{pairGuard:true,chainMm:10});
  assert.deepEqual(A.rulesFor('4.7.11',true),{pairGuard:true,chainMm:15});assert.deepEqual(A.rulesFor('4.7.15'),{pairGuard:true,chainMm:15});
});

/* Relecture 4.7.12 : la version de l'export peut être postérieure au lot ; les
 * règles consignées par la décision (4.7.14) font foi. */
test('règles du rejeu : consignées par le lot d\'abord, version de l\'export en dernier recours',()=>{
  const obs=lo=>[{lotObservation:lo}];
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v2',pairGuard:false}),'4.7.14'),{pairGuard:false,chainMm:10,source:'lot'});
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v2'}),'4.7.11'),{pairGuard:true,chainMm:10,source:'lot'});
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v1'}),'4.7.12'),{pairGuard:true,chainMm:10,source:'export'});
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v1'}),'4.7.11'),{pairGuard:false,chainMm:10,source:'export'});
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v2',pairGuard:false}),'4.7.14',true),{pairGuard:true,chainMm:15,source:'actuelles'});
});

/* 4.7.15 (D-047) : `chainMm` consigné par la décision ; un lot antérieur exporté
 * par une version plus récente garde ses 10 mm. */
test('règles du rejeu : chainMm consigné, 10 mm pour tout lot antérieur à la 4.7.15',()=>{
  const obs=lo=>[{lotObservation:lo}];
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v3',pairGuard:true,chainMm:15}),'4.7.15'),{pairGuard:true,chainMm:15,source:'lot'});
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v3',pairGuard:true,chainMm:12}),'4.7.15'),{pairGuard:true,chainMm:12,source:'lot'});
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v3'}),'4.7.15'),{pairGuard:true,chainMm:15,source:'lot'});
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v1'}),'4.7.15'),{pairGuard:true,chainMm:10,source:'export'});
  assert.deepEqual(A.lotRules(obs({version:'lot-decision-v2',pairGuard:true}),'4.7.15'),{pairGuard:true,chainMm:10,source:'lot'});
  assert.deepEqual(A.lotRules([],'4.7.15'),{pairGuard:true,chainMm:15,source:'export'});
  assert.deepEqual(A.lotRules([],'4.7.6'),{pairGuard:false,chainMm:10,source:'export'});
});
