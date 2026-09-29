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
