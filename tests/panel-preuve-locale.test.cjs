/* Libellé de la preuve « serveur » de la dernière commande (relecture indépendante E, décision de Mic).
 * Le moteur pose validationProof:'server-confirmed' dès que le compteur d'ESV a avancé : c'est une acceptation
 * LOCALE, pas une confirmation du serveur. Seul le texte affiché change ; ni le moteur ni la valeur de la preuve.
 * Même banc que panel-ligne-suite.test.cjs : panel.js réel dans une VM, DOM et API Chrome simulés. */
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
const lot=(racine={})=>({...racine,batch:{state:'RUNNING',scope:{part:23,start:100,end:120,unresolvedPolicy:'defer',lotDecision:'apply'},
  processed:[{cut:100},{cut:101}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],
  sequence:[],activeIdentity:{part:23,cut:102},lotCommands:{}}});
const preuve=extra=>({operatorDecision:'VALIDATE',commandSent:true,afterObserved:true,navigationObserved:true,beforeNavigationIdentity:{part:23,cut:101},...extra});

test('preuve server-confirmed du moteur : affichée « Acceptée par ESV (compteur local) », jamais « Serveur : confirmé »',async()=>{
  const $=await panneau(lot({lastActionEvidence:preuve({serverConfirmed:true,validationProof:'server-confirmed'})}));
  const h=$('lot-cmd-etapes').innerHTML;
  assert.match(h,/class="step seen"[^>]*><i><\/i>Acceptée par ESV \(compteur local\)/);
  assert.match(h,/title="[^"]*pas une confirmation du serveur[^"]*"/);
  assert.doesNotMatch(h,/Serveur : confirmé/);
});
test('sans preuve du compteur : « Serveur : non disponible » inchangé, aucune acceptation affichée',async()=>{
  const $=await panneau(lot({lastActionEvidence:preuve({serverConfirmed:false,validationProof:'navigation-only'})}));
  const h=$('lot-cmd-etapes').innerHTML;
  assert.match(h,/class="step na"><i><\/i>Serveur : non disponible/);assert.doesNotMatch(h,/Acceptée par ESV|Serveur : confirmé/);
});
test('le texte « Serveur : confirmé » n’existe plus dans le panneau ; la valeur de preuve du moteur reste inchangée',()=>{
  assert.doesNotMatch(SOURCE,/Serveur : confirmé/);
  const moteur=fs.readFileSync(path.join(__dirname,'../src/engine.js'),'utf8');
  assert.match(moteur,/evidence\.serverConfirmed===true\?'server-confirmed'/);
});
