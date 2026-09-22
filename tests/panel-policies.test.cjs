/* INTERFACE MINIMALE 4.7 — CE QUE LE PANNEAU DIT DE LA POLITIQUE APPLIQUÉE.
 *
 * Le cahier 4.7 (§10) demande trois choses au panneau : afficher la politique
 * EFFECTIVE du lot, afficher « Différés : N », et ne compter ce N que sur une
 * finalisation durable. Rien de tout cela n'était couvert par un test : seule
 * la présence du panneau l'était (`panel-presence.test.cjs`).
 *
 * S'y ajoute KI-033, constaté sur le lot terrain du 21 septembre. Un lot Pilote
 * GCV1 NEUTRALISE la question de faible confiance : `background.js` force
 * `lowConfidence` à « tenter » et ne conserve le choix de l'opérateur que dans
 * `scope.requestedLowConfidence`. Le lot réel portait `requestedLowConfidence:
 * "pause"` et `lowConfidence: "attempt"`, et aucun de ses 74 cuts n'a été mis en
 * pause pour faible confiance. La neutralisation est voulue et n'est PAS
 * modifiée ici ; ce qui est vérifié, c'est que le panneau cesse d'afficher un
 * réglage qui ne s'applique pas.
 *
 * `panel.js` est chargé tel quel dans un contexte `vm`, comme le fait déjà
 * `panel-presence.test.cjs` : le DOM et les API Chrome sont simulés, le code du
 * panneau ne l'est pas.
 */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');

/* Élément DOM minimal : il retient ce que le panneau y écrit. */
const element=()=>({hidden:false,disabled:false,textContent:'',value:'',checked:false,open:false,
  classList:{toggle(){}},dataset:{},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},
  addEventListener(){},set onchange(_){},set oninput(_){},set onclick(_){}});

/* Charge le panneau sur la vue « automatic » avec l'état rendu par `view`, puis
 * laisse la chaîne `discover() → refresh() → render()` se dérouler réellement. */
async function panneau(state){
  const elements=new Map(),tabs=[];
  const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],
    createElement:()=>element(),
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const chrome={runtime:{
    connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),
    sendMessage:async({action})=>({result:action==='view'?state:action==='list-tabs'?tabs:{}})}};
  const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},
    setInterval:()=>{},setTimeout:()=>{},console};
  vm.createContext(context);vm.runInContext(SOURCE,context);
  // `discover()` puis `refresh()` : deux promesses enchaînées avant le rendu.
  for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
  return id=>document.getElementById(id);
}

const lot=(scope,extra={})=>({batch:{state:'RUNNING',scope,processed:[],skipped:[],paused:[],
  interrupted:[],manuallyCompleted:[],deferred:[],...extra}});

test('lot Pilote GCV1 : le panneau annonce la politique appliquée ET nomme le choix neutralisé',async()=>{
 // Exactement la configuration du lot terrain du 21 septembre (KI-033).
 const $=await panneau(lot({requestedLowConfidence:'pause',lowConfidence:'attempt',
   unresolvedPolicy:'defer',geometryEngine:'geometry-candidate-v1'}));
 assert.equal($('policy-effective').hidden,false,'la ligne doit être visible pendant un lot');
 const texte=$('policy-effective').textContent;
 assert.match(texte,/Politique effective de ce lot : tenter la proposition expérimentale\./);
 assert.match(texte,/ne repasse pas ses candidates dans le seuil de confiance V4\.6/);
 assert.match(texte,/« mettre le lot en pause » ne s’y applique pas/,
   'le choix demandé doit être nommé, sinon l’opérateur ne sait pas lequel est ignoré');
 /* Le réglage affiché suit la politique du lot, pas le choix sans effet. */
 assert.equal($('policy').value,'attempt');
});

test('choix demandé et appliqué identiques : la politique est annoncée sans clause de neutralisation',async()=>{
 const $=await panneau(lot({requestedLowConfidence:'attempt',lowConfidence:'attempt',
   unresolvedPolicy:'defer',geometryEngine:'geometry-candidate-v1'}));
 assert.equal($('policy-effective').hidden,false);
 assert.equal($('policy-effective').textContent,
   'Politique effective de ce lot : tenter la proposition expérimentale.');
});

test('lot V4.6 sans neutralisation : la politique choisie est bien celle annoncée',async()=>{
 // Hors Pilote GCV1, `requestedLowConfidence` n'existe pas : aucune clause.
 const $=await panneau(lot({lowConfidence:'pause',geometryEngine:'v4.6'}));
 assert.equal($('policy-effective').textContent,
   'Politique effective de ce lot : mettre le lot en pause.');
 /* §10 : la politique des rails non résolus reste annoncée elle aussi, et un
  * lot sans le champ garde la pause historique. */
 assert.equal($('unresolved-policy-effective').textContent,
   'Politique effective de ce lot : mettre le lot en pause.');
});

test('aucun lot en cours : aucune politique effective n’est affichée',async()=>{
 const $=await panneau({batch:null});
 assert.equal($('policy-effective').hidden,true);
 assert.equal($('policy-effective').textContent,'');
 assert.equal($('unresolved-policy-effective').hidden,true);
});

test('§10 · « Différés : N » suit les finalisations durables, jamais une intention en cours',async()=>{
 /* Deux entrées deferred durables, plus une intention encore en vol : le
  * compteur doit afficher 2. Une tentative commencée n'est pas un différé. */
 const $=await panneau({...lot({unresolvedPolicy:'defer',lowConfidence:'attempt',
     geometryEngine:'geometry-candidate-v1'},
   {deferred:[{cut:549},{cut:2400}],processed:[{cut:700}],skipped:[]}),
   deferIntent:{phase:'COMMAND_MAY_HAVE_BEEN_SENT',identity:{cut:9452},commandInvoked:'unknown'}});
 assert.match($('batch').textContent,/Différés : 2/);
 assert.match($('batch').textContent,/1 cuts traités · 0 ignorés/);
 /* L'incertitude reste visible AVEC son cut, et n'est jamais comptée. */
 assert.match($('notice').textContent,/Cut 9452 .*n’est compté comme différé tant que la progression n’est pas acceptée/s);
});
