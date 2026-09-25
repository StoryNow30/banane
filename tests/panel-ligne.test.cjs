/* « LA LIGNE » (chantier B, D-045) — la voie du lot et la hiérarchie des
 * boutons. `panel.js` est chargé tel quel dans un contexte `vm`, comme dans
 * `panel-policies.test.cjs` : DOM et API Chrome simulés, code du panneau réel. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',
  classList:{toggle(){}},dataset:{},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},
  addEventListener(){},set onchange(_){},set oninput(_){},set onclick(_){}});
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
const lot=(extra={})=>({batch:{state:'RUNNING',scope:{part:23,start:100,end:120,unresolvedPolicy:'defer',lotDecision:'apply'},
  processed:[{cut:100},{cut:101}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[{cut:102}],
  sequence:seq([100,101,102,103]),activeIdentity:{part:23,cut:103},lotCommands:{101:{cut:101,action:'lot',stage:'window'},102:{cut:102,action:'engine'}},...extra}});

test('la voie : une traverse par cut, sa forme dit son état ; les compteurs suivent',async()=>{
  const $=await panneau(lot());
  const svg=$('voie').innerHTML;assert.equal($('voie').hidden,false);
  for(const k of ['t moteur','t voie-l','t differe','t actuel'])assert.ok(svg.includes(`class="${k}"`),k);
  assert.equal((svg.match(/class="t avenir"/g)||[]).length,4,'quatre traverses à venir');
  assert.match(svg,/>103</,'le cut affiché porte son numéro');
  const c=$('lot-compteurs').innerHTML;
  /* 4.7.20 (piste H) : les compteurs sont des tuiles — posés, différés, couverture. */
  assert.match(c,/Posés<\/span><b>2<\/b><small>dont 1 par la voie/);assert.match(c,/Différés<\/span><b class="amber">1<\/b>/);
  assert.match(c,/Couverture<\/span><b>67 %<\/b><small>2 sur 3/);
  assert.equal($('lot-etat').textContent,'En cours');assert.equal($('lot-cut').textContent,'103');
  assert.match($('batch').textContent,/Différés : 1/,'le compteur historique reste fidèle');
});

test('un bouton plein par état : Pause en cours, constater l\'incertain, télécharger en fin de lot',async()=>{
  let $=await panneau(lot());
  assert.equal($('pause').className,'primary ink');assert.equal($('stop').className,'link danger');assert.equal($('start-batch').className,'link');
  $=await panneau({...lot({state:'ERROR',error:{message:'Position proposée hors de la vue'}}),reconcileRequired:true});
  assert.equal($('close-uncertain').className,'primary ink');assert.equal($('lot-etat').className,'eyebrow red');
  assert.match($('voie').innerHTML,/class="t incertain"/);assert.match($('voie').innerHTML,/>103 \?</);
  $=await panneau(lot({state:'FINISHED_WITH_UNCONFIRMED_ACTIONS'}));
  assert.equal($('dataset').className,'primary');assert.equal($('start-batch').className,'link');
  $=await panneau({});
  assert.equal($('start-batch').className,'primary');assert.equal($('voie').hidden,true);assert.equal($('lot-etat').textContent,'Aucun lot');
});

test('rien d\'autre que des entiers n\'est écrit dans la voie',async()=>{
  const $=await panneau(lot({sequence:[...seq([100,101]),{cutId:'x',identity:{cut:'<img src=x onerror=alert(1)>'}}],activeIdentity:{cut:'<b>'}}));
  assert.doesNotMatch($('voie').innerHTML,/<img|onerror|<b>/);assert.equal($('lot-cut').textContent,'—');
});

test('profil en long : l\'écart de chaque cut à la voie, la bande de garde, un point rouge au-delà de 30 mm',async()=>{
  const $=await panneau(lot({lotCommands:{100:{cut:100,stage:'first-pass',ecartMm:3.1},101:{cut:101,action:'lot',stage:'window',ecartMm:4.2},102:{cut:102,stage:'deferred',ecartMm:37}}}));
  const svg=$('voie').innerHTML;
  /* 4.7.20 (piste H) : la garde est une ligne tiretée rouge à 30 mm, la courbe relie les écarts. */
  assert.match(svg,/class="garde"/);assert.match(svg,/garde 30 mm/);assert.match(svg,/class="courbe"/);assert.match(svg,/Écart à la voie/);
  assert.equal((svg.match(/<circle /g)||[]).length,3);assert.match(svg,/class="p hors"/);assert.match(svg,/class="p voie-l"/);
  const sans=await panneau(lot({lotCommands:{}}));assert.doesNotMatch(sans('voie').innerHTML,/garde/,'sans écart consigné, pas de profil');
});
