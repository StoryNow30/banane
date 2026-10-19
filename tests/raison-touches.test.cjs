'use strict';
/* RM-11 (test 9, fiches/RM11_RAISON_CORRECTION.md, essai 3) — les touches de raison ne sont NI retenues NI envoyées à ESV.
 *  - la garde d'entrée (`src/early-input.js`, chargée en VM comme dans tests/u3-raccourcis.test.cjs) laisse passer tous les chiffres 0 à 6, en toutes
 *    phases : aucun `preventDefault`, aucun arrêt de propagation ; ESV les reçoit comme avant ; le fichier n'a pas changé ;
 *  - aucune touche déjà prise par ESV ou par Ariane n'est un chiffre ;
 *  - l'observateur de la page relève le chiffre de raison comme événement ESSENTIEL (il ne cède pas sous charge) quand la lecture est allumée, et
 *    seulement alors ; rien d'autre ne change ;
 *  - la session n'envoie rien à ESV en lisant ni en consignant une raison : seuls démarrer, mettre en pause et reprendre l'observation passent. */
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const jouer=require('./helpers/echo-scenario.cjs');
const {Observer}=require('../src/native-page.js'),{K,base}=require('./fixtures.cjs');
const lire=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

function fixture(){const handlers=new Map(),messages=[];const ctx={window:null,location:{origin:'https://esv.lidar.altametris.xyz'},
 addEventListener:(type,fn)=>{if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);},postMessage:m=>messages.push(m)};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(lire('src/early-input.js'),ctx);
 let natif=0,empeche=0;for(const t of ['keydown','keyup','click','pointerdown','mousedown'])ctx.addEventListener(t,()=>natif++);
 function emit(extra={}){let arrete=false;const event={type:'keydown',isTrusted:true,code:'KeyD',key:'d',shiftKey:false,ctrlKey:false,altKey:false,metaKey:false,target:{closest:s=>s==='canvas'},
   preventDefault(){empeche++;},stopImmediatePropagation(){arrete=true;},...extra};
  for(const fn of handlers.get(event.type)||[]){fn(event);if(arrete)break;}return arrete;}
 return {ctx,messages,emit,natif:()=>natif,empeche:()=>empeche};}
const CHIFFRES=[];for(let i=0;i<=6;i++)CHIFFRES.push('Digit'+i,'Numpad'+i);
const VARIANTES=[{},{shiftKey:true},{altKey:true},{type:'keyup'},{repeat:true}];

test('la garde d\'entrée ne retient jamais un chiffre de raison : ESV le reçoit, aucun preventDefault, en observation d\'Écho comme pendant un lot ou une reprise manuelle',()=>{
 const phases=[['natif',f=>Object.assign(f.ctx.__banane4NativeGate,{active:true,channel:'natif'})],['sans garde',()=>{}],
  ...['READY','PREPARING','SAVING','AWAITING_NAV','ERROR'].map(p=>['séance '+p,f=>Object.assign(f.ctx.__banane4InputGate,{active:true,phase:p,channel:'canal'})])];
 for(const [nom,regler] of phases){
  const f=fixture();regler(f);let n=0;
  for(const code of CHIFFRES)for(const v of VARIANTES){n++;assert.equal(f.emit({code,key:code.slice(-1),...v}),false,`${nom} ${code} ${JSON.stringify(v)} : retenu`);}
  assert.equal(f.empeche(),0,nom+' : preventDefault appelé');assert.equal(f.natif(),n,nom+' : ESV reçoit tout');
 }
});
test('observation d\'Écho : un chiffre n\'est relevé qu\'en lecture seule (un message vers l\'extension, rien vers ESV), comme toute autre touche',()=>{
 const f=fixture();Object.assign(f.ctx.__banane4NativeGate,{active:true,channel:'natif'});
 f.emit({code:'Digit3',key:'"'});f.emit({code:'KeyD',key:'d'});
 assert.deepEqual(f.messages.map(m=>[m.kind,m.input.code]),[['banane4:native-input','Digit3'],['banane4:native-input','KeyD']]);
 assert.equal(f.messages[0].input.key,'"','la touche telle qu\'elle est (le code physique est ce qui compte)');
 f.emit({code:'Digit3',key:'3',target:{closest:s=>s.startsWith('input')}});
 assert.equal(f.messages[2].input.code,null,'dans un champ de texte, le code est masqué : jamais lu comme une raison');assert.equal(f.messages[2].input.editable,true);
});
test('la garde d\'entrée n\'a pas changé (empreinte de la test 8) et ne cite aucun chiffre',()=>{
 const src=lire('src/early-input.js');
 assert.ok(!/Digit|Numpad/.test(src),'aucune règle sur les chiffres');
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../src/early-input.js'))).digest('hex'),'a3d90c794f9a82977218844f84baaf3c90b134e2f58067758d90d1a80a7344e8');
});

test('aucune touche déjà prise par ESV ou par Ariane n\'est un chiffre',()=>{
 const src=lire('src/early-input.js');
 const editing=[...src.match(/editingKeys=new Set\(\[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.deepEqual(editing,['d','a','q','s','g','arrowleft','arrowright','arrowup','arrowdown']);
 assert.ok(editing.every(k=>!/^\d$/.test(k)),'touches d\'édition d\'ESV : aucun chiffre');
 /* Les touches que l'adaptateur de page rejoue pour le lot : Retour arrière, Entrée, et le gabarit de Maj+Espace. */
 const adapter=lire('src/adapter-page.js');
 const emises=[...adapter.matchAll(/const init=\{key:'([^']+)',(?:code:'([^']+)')?/g)].map(m=>m[2]||m[1]);
 assert.ok(emises.every(k=>!/^\d$|Digit|Numpad/.test(k)),'touches émises par Ariane : '+emises);
 assert.ok(!/Digit|Numpad/.test(adapter),'l\'adaptateur ne cite aucun chiffre');
 const fiche=lire('fiches/FICHE_U3_RACCOURCIS.md');
 assert.ok(!/\b(?:Digit|Numpad)\d\b/.test(fiche),'le relevé des raccourcis ne cite aucun chiffre');
});

function page(options){const appels=[];let handler=null;
 const state={identity:{pageId:'p1',part:23,cut:100,shape:'U50',frameId:'f1',projectId:null},rails:K.clone(base.rails),capturedAt:new Date().toISOString(),status:'complete',partialReasons:[]};
 const api={snapshot:()=>K.clone(state),capture:async()=>{throw Error('passive-lidar-read-cancelled');},send:async()=>({saved:true}),now:()=>0,performanceNow:()=>0,interval:()=>1,clearInterval(){},
  defer:fn=>queueMicrotask(fn),install:fn=>{handler=fn;},uninstall(){},editable:t=>t?.kind==='input',targetKind:t=>t?.kind||'other',signalFailure(){}};
 const o=new Observer(api),vrai=o.enqueue.bind(o);o.enqueue=(type,payload,essentiel)=>{if(type==='operator-event')appels.push({code:payload.event.code,type:payload.event.type,essentiel});return vrai(type,payload,essentiel);};
 return {appels,key:init=>handler({type:'keydown',isTrusted:true,target:{kind:'canvas'},...init}),start:()=>o.start({sessionId:'s',observationPeriodId:'p',...options})};}

test('observateur de page : avec la lecture allumée, le chiffre de raison (0 à 6, rangée du haut ou pavé) est un événement essentiel ; sans, rien ne change',async()=>{
 const f=page({raison:true});await f.start();
 for(const code of ['Digit0','Digit3','Digit6','Numpad2'])f.key({code,key:'x'});
 for(const code of ['Digit7','Digit9','KeyD','Space'])f.key({code,key:'x'});
 f.key({code:'Digit4',key:'x',repeat:true});f.key({code:'Digit4',key:'x',type:'keyup'});f.key({code:'Digit4',key:'x',target:{kind:'input'}});
 assert.deepEqual(f.appels.map(a=>[a.code,a.essentiel]),[['Digit0',true],['Digit3',true],['Digit6',true],['Numpad2',true],['Digit7',false],['Digit9',false],['KeyD',false],['Space',false],
  ['Digit4',false],['Digit4',false],[null,false]],'seule une frappe non tenue, hors champ de texte, est essentielle');
 const g=page({});await g.start();g.key({code:'Digit3',key:'x'});g.key({code:'Digit0',key:'x'});
 assert.deepEqual(g.appels.map(a=>a.essentiel),[false,false],'lecture coupée : comme avant');
 const h=page({raison:false});await h.start();h.key({code:'Digit3',key:'x'});assert.deepEqual(h.appels.map(a=>a.essentiel),[false]);
 /* une Validation reste essentielle dans les deux cas */
 f.key({code:'Space',key:' ',shiftKey:true});g.key({code:'Space',key:' ',shiftKey:true});assert.equal(f.appels.at(-1).essentiel,true);assert.equal(g.appels.at(-1).essentiel,true);
});

test('la session n\'envoie rien à ESV en lisant ou en consignant une raison : seuls démarrer, pause et reprise de l\'observation passent',async()=>{
 const vus=[];
 await jouer({prelude:false,demarrage:{raison:{actif:true,touches:'chiffres'}},
  envelopper:adapter=>new Proxy(adapter,{get:(cible,nom)=>typeof cible[nom]==='function'?(...a)=>{vus.push(String(nom));return cible[nom](...a);}:cible[nom]}),
  frappes:async f=>{
   const a=await f.open('v1',100);
   for(const c of [2,2,0,3,5,1,4,6]){f.avancer(150);await f.touche('v1',a,{code:'Digit'+c,key:'character'});}
   await f.touche('v1',a,{code:'Space',key:' ',shiftKey:true,intent:'VALIDATE',decisionKey:'Shift+Space'});f.avancer(100);await f.fermer('v1',a,101);
   f.avancer(100);const b=await f.open('v2',101);await f.touche('v2',b,{code:'Digit3',key:'character'});
   await f.sessions.pause();await f.sessions.resume();
   assert.equal(f.engine.s.native.raison.poses>0,true);
  }});
 assert.deepEqual([...new Set(vus)].sort(),['nativeFinish','nativePause','nativeResume','nativeStart'],'rien d\'autre vers la page ESV : '+vus);
});
