/* « LA LIGNE », suite (chantier B) : la dernière commande en trois étapes,
 * les pastilles des onglets, « Nouveau lot » et le tiroir « Détails »
 * (l'Assisté est retiré en 4.7.21). Même banc que `panel-ligne.test.cjs` : panel.js réel
 * dans un contexte `vm`, DOM et API Chrome simulés ; les gestionnaires de
 * clic sont conservés pour être déclenchés. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',onclick:null,
  attrs:{},classList:{toggle(){}},dataset:{},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},replaceChildren(){},append(){},
  addEventListener(){},set onchange(_){},set oninput(_){}});
async function panneau(state,hash='#automatic'){
  const elements=new Map();
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?[]:{}})}};
  const context={document,chrome,location:{hash},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},console};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
  return id=>document.getElementById(id);
}
const seq=cuts=>cuts.map((cut,i)=>({sequenceIndex:i,cutId:'p|23|'+cut,identity:{part:23,cut}}));
const lot=(extra={},racine={})=>({...racine,batch:{state:'RUNNING',scope:{part:23,start:100,end:120,unresolvedPolicy:'defer',lotDecision:'apply'},
  processed:[{cut:100},{cut:101}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],
  sequence:seq([100,101,102]),activeIdentity:{part:23,cut:102},lotCommands:{},...extra}});

test('dernière commande : émise, navigation observée, serveur non disponible ; jamais de vert sans effet observé',async()=>{
  let $=await panneau(lot({},{lastActionEvidence:{operatorDecision:'VALIDATE',commandSent:true,afterObserved:false,navigationObserved:true,serverConfirmed:false,
    beforeNavigationIdentity:{part:23,cut:101}}}));
  assert.equal($('lot-commande').hidden,false);assert.equal($('lot-cmd-nom').textContent,'Valider et passer au suivant');assert.equal($('lot-cmd-cut').textContent,'cut 101');
  const h=$('lot-cmd-etapes').innerHTML;
  assert.match(h,/class="step done"><i><\/i>Émise/);assert.match(h,/title="État final non relu[^"]*"><i><\/i>Navigation observée/);assert.match(h,/class="step na"><i><\/i>Serveur : non disponible/);
  assert.doesNotMatch(h,/step seen/,'aucun vert : l\'état final n\'est pas relu');
  $=await panneau(lot({},{lastActionEvidence:{operatorDecision:'SKIP',commandSent:true,afterObserved:true,navigationObserved:true,beforeNavigationIdentity:{cut:101}}}));
  assert.match($('lot-cmd-etapes').innerHTML,/class="step seen"><i><\/i>Effet observé/);
});

test('navigation différée incertaine : « Émise ? » en rouge, avec son cut ; rien d\'écrit de l\'état tel quel',async()=>{
  let $=await panneau(lot({state:'PAUSED_DEFER_NAVIGATION_UNCERTAIN'},{deferIntent:{phase:'INVOKED',identity:{cut:102}}}));
  assert.equal($('lot-cmd-nom').textContent,'Suivant sans décision');assert.equal($('lot-cmd-cut').textContent,'cut 102');
  assert.match($('lot-cmd-etapes').innerHTML,/class="step unk"><i><\/i>Émise \?/);assert.match($('lot-cmd-etapes').innerHTML,/Effet non observé/);
  $=await panneau(lot({},{deferIntent:{phase:'PREPARED',commandInvoked:false,identity:{cut:'<img src=x onerror=alert(1)>'}}}));
  assert.match($('lot-cmd-etapes').innerHTML,/Non émise/);assert.equal($('lot-cmd-cut').textContent,'');
  assert.doesNotMatch($('lot-cmd-etapes').innerHTML,/<img|onerror/);
  $=await panneau({});assert.equal($('lot-commande').hidden,true,'sans lot, pas de commande');
});

test('pastilles des onglets : lot en cours, résultat à contrôler, collecte en cours',async()=>{
  let $=await panneau(lot());assert.equal($('tab-automatic').dataset.etat,'vert');assert.equal($('tab-automatic').attrs.title,'Lot en cours');
  $=await panneau(lot({state:'PAUSED'}));assert.equal($('tab-automatic').dataset.etat,'ambre');
  $=await panneau(lot({state:'ERROR'},{reconcileRequired:true}));assert.equal($('tab-automatic').dataset.etat,'rouge');assert.equal($('tab-automatic').attrs.title,'Résultat à contrôler');
  $=await panneau({native:{status:'RUNNING',visits:[],incomplete:[]}});assert.equal($('tab-native').dataset.etat,'vert');assert.equal($('tab-automatic').dataset.etat,undefined);
});

test('fin de lot : télécharger d\'abord ; « Nouveau lot » rouvre les bornes sans rien lancer',async()=>{
  const $=await panneau(lot({state:'COMPLETED'}));
  assert.equal($('dataset').className,'primary');assert.equal($('new-batch').hidden,false);assert.equal($('new-batch').className,'link');
  assert.equal($('start-batch').hidden,true);assert.equal($('lot-bornes').hidden,true);
  $('new-batch').onclick();
  assert.equal($('start-batch').hidden,false);assert.equal($('start-batch').className,'primary');assert.equal($('lot-bornes').hidden,false);
  assert.equal($('new-batch').hidden,true);assert.equal($('dataset').className,'link');
});

test('« Détails » : ouverts par défaut (4.7.21), se referment et se rouvrent sans toucher au lot',async()=>{
  const $=await panneau(lot());
  assert.equal($('lot-details').hidden,false);assert.equal($('lot-details-toggle').textContent,'Masquer');assert.equal($('lot-details-toggle').attrs['aria-expanded'],'true');
  $('lot-details-toggle').onclick();assert.equal($('lot-details').hidden,true);assert.equal($('lot-details-toggle').textContent,'Détails ›');
  $('lot-details-toggle').onclick();assert.equal($('lot-details').hidden,false);
  assert.equal($('native-details').hidden,false);
});
