'use strict';
/* 4.8.0 — panneau : « Reprendre » après « adaptateur sans réponse » (lot Orbite
 * seulement), et texte d'une fin de lot par sortie d'ESV. Harnais repris de
 * tests/panel-lot-neuf.test.cjs.
 */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',onclick:null,oninput:null,
  attrs:{},style:{},classList:{toggle(){},add(){}},dataset:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},
  replaceChildren(){},append(){},addEventListener(){},set onchange(_){}});
async function panneau(state,hash='#automatic',reponses={}){
  const elements=new Map(),appels=[];
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action,args})=>{appels.push({action,args});return {result:action in reponses?reponses[action]:action==='view'||action==='start'?state:action==='list-tabs'?[]:{}};}}};
  const context={document,chrome,location:{hash},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  const attendre=async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>setImmediate(resolve));};
  await attendre();
  return {$:id=>document.getElementById(id),appels,attendre,body:document.body};
}
const ident=cut=>({pageId:'p',part:13,cut,shape:'U50',frameId:'f'});
const lot=(state,extra={})=>({current:{identity:ident(6630)},batch:{state,scope:{part:13,start:101,end:999999,endMode:'partie',geometryEngine:'geometry-candidate-v1'},
  processed:[{cut:6629}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],sequence:[],activeIdentity:ident(6629),...extra}});

test('« sans réponse » : Reprendre proposé pour un lot Orbite, pas pour un autre moteur ni une réconciliation',async()=>{
  let {$}=await panneau(lot('PAUSED_ADAPTER_UNRESPONSIVE'));assert.equal($('resume').hidden,false);
  ({$}=await panneau({...lot('PAUSED_ADAPTER_UNRESPONSIVE'),batch:{...lot('PAUSED_ADAPTER_UNRESPONSIVE').batch,scope:{part:13,start:101,end:200}}}));assert.equal($('resume').hidden,true);
  ({$}=await panneau({...lot('PAUSED_ADAPTER_UNRESPONSIVE'),reconcileRequired:true}));assert.equal($('resume').hidden,true);
});

test('fin de lot par une sortie d\'ESV : le cut nommé est le dernier validé, pas un cut « posé, non validé »',async()=>{
  const {$}=await panneau(lot('STOPPED',{stoppedAtEnd:{cut:6629,reason:'navigation-other-part',applied:true}}));
  assert.match($('batch').textContent,/lot clos après le cut 6629 : ESV a quitté la partie/);assert.doesNotMatch($('batch').textContent,/posé, non validé/);
});

test('ancienne fin muette enregistrée sans « issue » (applied:false) : pas présentée comme un cut traité',async()=>{
  const {$}=await panneau(lot('STOPPED',{stoppedAtEnd:{cut:102,reason:'adapter-lost-after-navigation',applied:false}}));
  assert.doesNotMatch($('batch').textContent,/lot clos après le cut 102/);assert.match($('batch').textContent,/dernier cut 102/);
});
