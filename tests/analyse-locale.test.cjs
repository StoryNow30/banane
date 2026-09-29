'use strict';
/* Analyse locale (tools/analyse-locale.cjs) et mode léger (--leger) : aucun chiffre ne change,
 * seuls les points bruts sont écartés. Données synthétiques (`tests/helpers/acceptance-lot.cjs`). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const A=require('../tools/acceptance-report.cjs'),S=require('../tools/merge-segments.cjs'),L=require('../tools/analyse-locale.cjs');
const {pilotCut,pilotLot}=require('./helpers/acceptance-lot.cjs');
const tmp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'ariane-al-'));
const ecrire=(dir,nom,doc)=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,nom),JSON.stringify(doc));};

test('alléger un nuage : points bruts écartés, rails et identité gardés, original intact',()=>{
  const c={captureId:'c1',identity:{part:1,cut:2},rails:{left:{x:1}},nodes:[1],pointsSceneRelative:[1,2],pointsProfileLocal:[3],pointSources:[4],visibleByClipBoxes:[5],attributes:[6]};
  const l=S.alleger(c);
  for(const k of S.POIDS_LOURDS)assert.equal(k in l,false,k);
  assert.deepEqual(l.rails,c.rails);assert.equal(l.captureId,'c1');assert.equal(l.allege,true);
  assert.equal('nodes' in c,true,'l’original n’est pas modifié');
});

test('mode léger : même rapport que le mode complet, corpus sans points',()=>{
  const P=31,lot=pilotLot(P,[pilotCut(P,10),pilotCut(P,11,{outcome:'deferred'}),pilotCut(P,12)]),dir=tmp();
  ecrire(dir,'ariane-gcv1-diagnostic-1.json',lot.diagnostic);ecrire(dir,'ariane-journal-v4-1.json',lot.journal);
  ecrire(dir,'ariane-gcv1-corpus-2026-seg01.json',{format:'banane-gcv1-lidar-corpus-v1',version:'4.8.5.2',sessionId:'s',clouds:[10,11,12].map(cut=>({captureId:`capture-${cut}`,pointsSceneRelative:new Array(50).fill(cut),nodes:[{}]}))});
  const plein=A.loadLot(dir,'x'),leger=A.loadLot(dir,'x',null,true);
  assert.equal(plein.corpus.clouds[0].pointsSceneRelative.length,50);
  assert.equal(leger.corpus.clouds.length,3);assert.equal('pointsSceneRelative' in leger.corpus.clouds[0],false);assert.equal(leger.leger,true);
  const a=JSON.parse(JSON.stringify(A.report([plein]))),b=JSON.parse(JSON.stringify(A.report([leger])));
  for(const l of b.lots)delete l.leger;
  assert.deepEqual(b,a);
  assert.throws(()=>A.run(['--leger','--rejeu-lot','--lot',dir]),/rejeu hors ligne est impossible/);
});

test('découverte des dossiers : lots, relectures, imbriqués, ignorés',()=>{
  const r=tmp(),j={format:'x'};
  ecrire(path.join(r,'lot 20'),'a.json',j);ecrire(path.join(r,'Écho 20'),'a.json',j);ecrire(path.join(r,'Lot 21','LOT 21'),'a.json',j);
  ecrire(path.join(r,'relecture-22'),'a.json',j);ecrire(path.join(r,'sans numero'),'a.json',j);ecrire(path.join(r,'resultats'),'a.json',j);
  fs.mkdirSync(path.join(r,'vide'));fs.mkdirSync(path.join(r,'zips'));fs.writeFileSync(path.join(r,'zips','LOT.7z.part001'),'x');
  const d=L.decouvrir(r);
  assert.deepEqual(d.lots.map(l=>[l.part,l.nom]),[[20,'lot 20'],[21,'Lot 21']]);
  assert.equal(d.lots[1].dir,path.join(r,'Lot 21','LOT 21'));
  assert.deepEqual([...d.relectures].map(([p,x])=>[p,x.map(y=>y.nom)]),[[20,['Écho 20']],[22,['relecture-22']]]);
  const raisons=Object.fromEntries(d.ignores.map(i=>[i.dossier,i.raison]));
  assert.match(raisons['sans numero'],/numéro de partie/);assert.match(raisons.vide,/aucun fichier/);assert.match(raisons.zips,/décompresser|aucun fichier/);
  assert.equal('resultats' in raisons,false);
});

test('extraits du journal : relevé, fin de lot, erreurs, événements rares',()=>{
  const ev=[{type:'esv-releve',timestamp:'2026-09-29T10:00:02Z',at:'2026-09-29T10:00:02Z',identity:{part:5,cut:9},compteur:{traites:10,total:100},cutsAffiches:100},
    {type:'esv-releve',timestamp:'2026-09-29T10:00:01Z',at:'2026-09-29T10:00:01Z',identity:{part:5,cut:8},compteur:{traites:9,total:100}},
    {type:'adapter-result',timestamp:'2026-09-29T10:00:03Z',error:'boum'},{type:'fin-partie-depart',timestamp:'2026-09-29T10:00:04Z',cut:99,total:100,dernier:true},
    {type:'batch-state',timestamp:'2026-09-29T10:00:05Z',batch:{state:'PAUSED',pauseReason:'x'}}];
  const e=L.extraits({version:'4.8.5.2',events:ev,state:{batch:{state:'PAUSED',processed:[1,2],deferred:[3],error:{message:'m'},stoppedAtEnd:{cut:99}}},closureSummary:{status:'PAUSED',deferredCuts:['a','b']}});
  assert.deepEqual(e.releve.totaux,{100:2});assert.deepEqual(e.releve.cutsAffiches,{100:1});
  assert.equal(e.releve.premier.cut,8,'trié par horodatage');assert.equal(e.releve.dernier.cut,9);
  assert.deepEqual(e.erreursCommandes,{boum:1});assert.deepEqual(e.evenementsRares.map(x=>x.type),['fin-partie-depart','batch-state']);
  assert.equal(e.pauses[0].etat,'PAUSED');assert.equal(e.lot.traites,2);assert.equal(e.cloture.deferredCutsCount,2);assert.equal(e.lot.finDePartie.cut,99);
});

test('de bout en bout : un lot synthétique donne un fichier de résultats lisible',()=>{
  const P=32,lot=pilotLot(P,[pilotCut(P,1),pilotCut(P,2)]),racine=tmp();
  ecrire(path.join(racine,'lot 32'),'ariane-gcv1-diagnostic-1.json',lot.diagnostic);ecrire(path.join(racine,'lot 32'),'ariane-journal-v4-1.json',lot.journal);
  const zlib=require('node:zlib'),log=console.log;console.log=()=>{};
  try{L.main([racine,'--memoire','1024']);}finally{console.log=log;}
  const f=fs.readdirSync(path.join(racine,'resultats')).find(n=>n.endsWith('.json.gz')),d=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(racine,'resultats',f))));
  assert.equal(d.format,'ariane-analyse-locale-v1');assert.equal(d.lots.length,1);
  assert.equal(d.lots[0].acceptation.rapport.total.c1.applied,2);assert.ok(d.lots[0].extraits);
  assert.match(fs.readFileSync(path.join(racine,'resultats','RESUME.md'),'utf8'),/\| p32 \| 2 \| 2 \|/);
});

test('regrouper en vrac : le contenu, pas le nom, range journal, diagnostic et relecture par partie',()=>{
  const zlib=require('node:zlib'),G=require('../tools/regrouper-reduits.cjs'),R=require('../tools/reducteur-exports-core.js');
  const {pair,visit,relecture}=require('./helpers/acceptance-lot.cjs');
  const vrac=tmp(),racine=path.join(tmp(),'racine'),gz=(nom,doc)=>fs.writeFileSync(path.join(vrac,nom),zlib.gzipSync(JSON.stringify(doc)));
  const journal=(part,session)=>({format:'banane-test-journal-v4',version:'4.8.5.2',state:{sessionId:session,batch:{scope:{part}}},events:[],records:[]});
  gz('a.json.gz',journal(33,'s33'));gz('b.json.gz',{format:'banane-gcv1-diagnostic-v1',sessionId:'s33',observations:[]});
  gz('c.json.gz',journal(33,'s33bis'));gz('d.json.gz',journal(20,'s20'));
  const rel=new R.Relecture();rel.ajouter({...relecture([visit(20,5,{before:pair(5)})]),version:'x',exportedAt:'2026'});
  gz('e.json.gz',rel.documents()[0]);gz('f.json.gz',{format:'banane-gcv1-lidar-corpus-v1'});gz('g.json.gz',{format:'inconnu'});
  const r=G.regrouper(vrac,racine);
  assert.deepEqual(fs.readdirSync(racine).sort(),['echo 20','lot 20','lot 33','lot 33 (2)']);
  assert.deepEqual(fs.readdirSync(path.join(racine,'lot 33')).sort(),['a.json','b.json'],'le diagnostic suit son journal (sessionId)');
  assert.deepEqual(r.inconnus.map(i=>i.fichier).sort(),['f.json.gz','g.json.gz']);assert.equal(r.relectures[0].parties[0],20);
  const {lots}=L.decouvrir(racine);assert.deepEqual(lots.map(l=>l.part).sort(),[20,33,33]);
});

test('filtrer le journal : les événements et visites d’Écho partent, ceux du lot restent, sortie identique sinon',async()=>{
  const F=require('../tools/filtrer-journal.cjs'),dir=tmp(),ent=path.join(dir,'j.json'),sor=path.join(dir,'s.json');
  const orbite={format:'banane-test-journal-v4',version:'4.8.5.1',state:{batch:{id:'b',scope:{part:33}}},stateOmits:[],closureSummary:{completed:1},
    events:[{eventId:'1',type:'proposed',note:'a"b,{c}'},{eventId:'2',type:'validation-accepted'}],records:[{identity:{part:33,cut:1},before:{rails:null}}]};
  fs.writeFileSync(ent,JSON.stringify(orbite));
  let st=await F.filtrer(ent,sor);assert.deepEqual(JSON.parse(fs.readFileSync(sor,'utf8')),orbite,'un journal sans Écho sort identique');assert.equal(st.events.gardes,2);
  const mixte={...orbite,events:[...orbite.events,{type:'native-state-observed',nativeSessionId:'n',blob:'x'.repeat(50)},{type:'native-operator-event',observationPeriodId:'p'}],
    records:[...orbite.records,{recordId:'r',visitId:'v',railSnapshots:{left:[1]}}]};
  fs.writeFileSync(ent,JSON.stringify(mixte));
  st=await F.filtrer(ent,sor);const s=JSON.parse(fs.readFileSync(sor,'utf8'));
  assert.deepEqual(s.events.map(e=>e.eventId),['1','2']);assert.equal(s.records.length,1);assert.deepEqual(s.state,orbite.state);assert.deepEqual(s.closureSummary,orbite.closureSummary);
  assert.deepEqual([st.events.lus,st.events.gardes,st.records.lus,st.records.gardes],[4,2,2,1]);
  fs.writeFileSync(ent+'.gz',require('node:zlib').gzipSync(JSON.stringify(mixte)));
  await F.filtrer(ent+'.gz',sor);assert.equal(JSON.parse(fs.readFileSync(sor,'utf8')).events.length,2,'lit aussi les .gz');
});

test('regrouper : le diagnostic cumulatif de la session va au journal le plus proche dans le temps',()=>{
  const zlib=require('node:zlib'),G=require('../tools/regrouper-reduits.cjs'),vrac=tmp(),racine=path.join(tmp(),'racine');
  const gz=(nom,doc)=>fs.writeFileSync(path.join(vrac,nom),zlib.gzipSync(JSON.stringify(doc)));
  const journal=part=>({format:'banane-test-journal-v4',version:'4.8.0',state:{sessionId:'S',batch:{scope:{part}}},events:[],records:[]}),diag={format:'banane-gcv1-diagnostic-v1',sessionId:'S',observations:[]};
  gz('ariane-journal-v4-1790668357663.json.gz',journal(20));gz('ariane-gcv1-diagnostic-1790668359501.json.gz',diag);
  gz('ariane-journal-v4-1790670925402.json.gz',journal(21));gz('ariane-gcv1-diagnostic-1790670933990.json.gz',diag);
  G.regrouper(vrac,racine);
  assert.deepEqual(fs.readdirSync(path.join(racine,'lot 20')).sort(),['ariane-gcv1-diagnostic-1790668359501.json','ariane-journal-v4-1790668357663.json']);
  assert.deepEqual(fs.readdirSync(path.join(racine,'lot 21')).sort(),['ariane-gcv1-diagnostic-1790670933990.json','ariane-journal-v4-1790670925402.json']);
});
