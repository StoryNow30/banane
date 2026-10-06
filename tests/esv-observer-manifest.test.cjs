'use strict';
/* V1 (test 2) : injection de l'observateur passif par le manifeste (D-078) :
 * entrée content_scripts seulement ; aucune permission de plus ; réglage actif
 * par défaut ; l'observateur n'a pas accès à chrome.* (monde principal). */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),manifest=require('../manifest.json'),S=require('../src/settings.js');
const HOST='https://esv.lidar.altametris.xyz/rails_validation/*';
test('manifeste : une entrée, monde MAIN, document_start, même hôte, fichier présent ; rien d’autre ne change',()=>{
 const e=manifest.content_scripts.filter(c=>c.js.includes('src/esv-observer.js'));assert.equal(e.length,1);
 assert.deepEqual(e[0],{matches:[HOST],js:['src/esv-observer.js'],run_at:'document_start',world:'MAIN'});assert.equal('all_frames' in e[0],false,'cadre principal seulement');
 assert.ok(fs.existsSync(path.join(root,'src/esv-observer.js')));
 assert.deepEqual(manifest.permissions,['storage','unlimitedStorage','scripting','downloads'],'aucune permission de plus');assert.deepEqual(manifest.host_permissions,[HOST],'aucun hôte de plus');
 const autres=manifest.content_scripts.filter(c=>!c.js.includes('src/esv-observer.js'));
 assert.deepEqual(autres.map(c=>[c.js[0],c.run_at,c.world]),[['src/early-input.js','document_start',undefined],['src/bridge.js','document_idle',undefined]],'les deux autres scripts inchangés, dans le monde isolé');
});
test('réglage observateurPassif : gelé, actif par défaut dans cette version de test, bornes sans seuil de décision',()=>{
 assert.equal(Object.isFrozen(S.observateurPassif),true);assert.equal(S.observateurPassif.actif,true);
 assert.deepEqual(Object.keys(S.observateurPassif).sort(),['actif','caracteresParEntree','entreesParSeanceMax']);
 assert.ok(!JSON.stringify(S.observateurPassif).match(/searchY|minTop|minFace|maxResidual|minConfidence/));
});
test('monde isolé (navigateur trop ancien pour world:MAIN) : l’observateur s’abstient, aucune enveloppe',()=>{
 const {install}=require('../src/esv-observer.js');const proto={open(){return 1;},send(){return 2;}};
 const win={XMLHttpRequest:{prototype:proto},chrome:{runtime:{id:'extension'}},location:{origin:'https://x',href:'https://x/'},performance:{now:()=>1,timeOrigin:1},postMessage(){},addEventListener(){}};
 const open=proto.open,send=proto.send;assert.equal(install(win),null);assert.equal(proto.open,open);assert.equal(proto.send,send);
 const page={XMLHttpRequest:{prototype:{open(){},send(){}}},chrome:undefined,location:{origin:'https://x',href:'https://x/'},performance:{now:()=>1,timeOrigin:1},postMessage(){},addEventListener(){}};
 assert.notEqual(install(page),null,'monde principal : installé');
});
test('fichier de l’observateur : se charge sans chrome, sans DOM ni jQuery au chargement (document_start)',()=>{
 const win={XMLHttpRequest:{prototype:{open(){},send(){}}},location:{origin:'https://x',href:'https://x/'},performance:{now:()=>1,timeOrigin:1},postMessage(){},addEventListener(){}};
 win.self=win;const ctx=vm.createContext({...win,globalThis:undefined});ctx.globalThis=ctx;ctx.window=ctx;
 assert.doesNotThrow(()=>vm.runInContext(fs.readFileSync(path.join(root,'src/esv-observer.js'),'utf8'),ctx,{filename:'esv-observer.js'}));
 assert.equal(ctx.__banane5ObserverInstalled,true);
});
