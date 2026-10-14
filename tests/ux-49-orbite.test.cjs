/* Chantier UX 4.9 (variante A retenue par Mic, 13–14/10). La politique
 * effective quitte la vue principale pour « Détails du lot » : elle y reste
 * écrite (D-045) ; si elle n'est pas celle par défaut, une pastille le dit sur
 * la vue. `panel.js` réel dans un contexte `vm`, comme panel-ligne.test.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',
  classList:{toggle(){}},dataset:{},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},
  addEventListener(){},set onchange(_){},set oninput(_){},set onclick(_){}});
async function panneau(state){
  const elements=new Map();
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?[]:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},console};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
  return id=>document.getElementById(id);
}
const lot=scope=>({batch:{state:'RUNNING',scope:{part:23,start:100,end:120,...scope},processed:[{cut:100}],skipped:[],paused:[],interrupted:[],
  manuallyCompleted:[],deferred:[],sequence:[{sequenceIndex:0,cutId:'p|23|100',identity:{part:23,cut:100}}],activeIdentity:{part:23,cut:101},lotCommands:{}}});

test('politique par défaut : aucune pastille ; la politique effective reste écrite dans « Détails du lot »',async()=>{
  const $=await panneau(lot({unresolvedPolicy:'defer',lotDecision:'apply',lowConfidence:'attempt'}));
  assert.equal($('lot-politique-pastille').hidden,true);
  assert.equal($('unresolved-policy-effective').hidden,false);assert.match($('unresolved-policy-effective').textContent,/continuer et différer/);
  assert.match($('lot-decision-effective').textContent,/appliquée/);assert.match($('policy-effective').textContent,/tenter la proposition expérimentale/);
});

test('politique hors défaut : une pastille courte la nomme, sans rien retirer du détail',async()=>{
  const $=await panneau(lot({unresolvedPolicy:'pause',lotDecision:'observe',lowConfidence:'attempt'}));
  assert.equal($('lot-politique-pastille').hidden,false);
  assert.equal($('lot-politique-pastille').textContent,'Politique : rail non résolu : pause · décision sur le lot : observée');
  assert.match($('unresolved-policy-effective').textContent,/mettre le lot en pause/);assert.match($('lot-decision-effective').textContent,/observée seulement/);
});

test('sans lot : pas de pastille',async()=>{
  const $=await panneau({});assert.equal($('lot-politique-pastille').hidden,true);
});

test('panel.html : la politique effective est dans « Détails du lot », fermé par défaut ; la pastille existe',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
  const tiroir=html.match(/<div id="lot-details" class="tiroir" hidden>[\s\S]*?<input type="hidden" id="policy" value="attempt">\s*<\/div>/)?.[0];
  assert.ok(tiroir,'tiroir « Détails du lot » fermé dans le HTML');
  for(const id of ['lot-decision-effective','unresolved-policy-effective','policy-effective','lot-reglages','departs-liste','journal','dataset'])assert.match(tiroir,new RegExp(`id="${id}"`),id);
  assert.match(html,/<p id="lot-politique-pastille" class="pastille" hidden><\/p>/);
  assert.match(html,/id="lot-details-toggle" class="pill details-toggle" aria-expanded="false"[^>]*>Détails du lot</);
});
