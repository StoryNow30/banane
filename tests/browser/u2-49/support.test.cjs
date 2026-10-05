'use strict';
// Contrôles d'infrastructure uniquement. Ne prouvent AUCUN comportement UI.
const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {fixture,installer}=require('./backend.cjs');
const {run,options,matrix,suite,blockedRows,RESEAU_ARGS}=require('../../../tools/navigateur-panneau-49.cjs');
test('double backend : commandes synthétiques et erreurs ne traversent jamais sendMessage réel',async()=>{
 let real=0;const c={chrome:{runtime:{id:'extension-synthétique',sendMessage(){real++;}}}};vm.createContext(c);
 const initial=fixture('idle');initial.__running=fixture('running').batch;
 c.options={initial,trace:false,fault:null};vm.runInContext('('+installer.toString()+')(options)',c);
 const send=c.chrome.runtime.sendMessage;
 await send({kind:'panel',action:'start'});assert.equal(c.__u2.state.batch.state,'RUNNING');
 await send({kind:'panel',action:'pause'});assert.equal(c.__u2.state.batch.state,'PAUSED');
 c.__u2.fail('resume','refus synthétique');assert.equal((await send({kind:'panel',action:'resume'})).error,'refus synthétique');
 assert.equal(c.__u2.state.batch.state,'PAUSED');
 assert.match((await send({kind:'panel',action:'validateAndNext'})).error,/non simulée/);
 await assert.rejects(send({kind:'adapter',action:'apply'}),/aucun message/);
 assert.equal(real,0);assert.equal(c.__u2.calls.filter(c=>c.action==='pause').length,1);
});
test('sans origine extension, installation du double refusée',()=>{
 const c={};vm.createContext(c);assert.throws(()=>vm.runInContext('('+installer.toString()+')({})',c),/origine extension absente/);
});
test('sélection inconnue et options ambiguës sont refusées',async()=>{
 assert.throws(()=>options(['.', '--scenario']),/Option invalide/);
 assert.throws(()=>options(['.', '--skip']),/Option invalide/);
 await assert.rejects(run('.', {scenario:'inexistant'}),/Scénario inconnu/);
 assert.equal(new Set(matrix.map(x=>x.id)).size,matrix.length);
 assert.throws(()=>suite('inconnue'),/Suite inconnue/);
 const u1=suite('u1-resume');assert.equal(new Set(u1.map(x=>x.id)).size,u1.length);
 assert.ok(u1.every(s=>s.requires==='partSummary'),'suite U1 : sans objet sur une cible sans résumé');
 assert.equal(blockedRows(matrix,'absent').every(r=>!r.executed&&r.status==='BLOCKED'&&r.durationMs===null),true);
});
test('Chromium absent : zéro réussite, chaque scénario bloqué, cible intacte, aucune extension déclarée chargée',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'u2-support-'));
 const before=process.env.CHROMIUM;process.env.CHROMIUM=path.join(root,'chromium-absent');
 try{
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({manifest_version:3,name:'U2',version:'0.0.0'}));
  for(const f of ['panel.html','panel.js','panel.css'])fs.writeFileSync(path.join(root,f),'synthétique');
  const r=await run(root);assert.equal(r.counts.pass,0);assert.equal(r.counts.executed,0);assert.equal(r.counts.blocked,matrix.length);
  assert.equal(r.extension.loaded,false);assert.equal(r.executedScopeGate,'NOT_PASSED');assert.equal(r.targetUnchanged,true);
 }finally{if(before===undefined)delete process.env.CHROMIUM;else process.env.CHROMIUM=before;fs.rmSync(root,{recursive:true,force:true});}
});
test('refus réseau déclaré : mandataire local fermé, boucle locale non exemptée',()=>{
 assert.ok(RESEAU_ARGS.includes('--proxy-server=http://127.0.0.1:9'));assert.ok(RESEAU_ARGS.includes('--proxy-bypass-list=<-loopback>'));
});
test('chaque scénario déclare attendu, source, vue et une fonction run',()=>{
 for(const s of [...matrix,...suite('u1-resume')]){assert.ok(s.id&&s.expected&&s.source&&s.view,s.id);assert.equal(typeof s.run,'function',s.id);}
});
