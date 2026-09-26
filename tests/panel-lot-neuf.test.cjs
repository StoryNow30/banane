'use strict';
/* 4.7.21 — un nouveau lot après un lot « Arrêté », réglages fixes, Assisté retiré.
 *
 * Terrain du 26/09 (partie 11) : après un lot arrêté, « Nouveau lot » gardait
 * les bornes de l'ancien (premier cut 556, ESV sur 715) ; le moteur refusait,
 * « Ouvre le premier cut du lot dans ESV », et seule une réinstallation de
 * l'extension en sortait. `panel.js` est chargé tel quel dans un contexte `vm`,
 * DOM et API Chrome simulés ; les gestionnaires de clic sont conservés et les
 * appels au service worker enregistrés. */
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
const ident=cut=>({pageId:'p',part:11,cut,shape:'U50',frameId:'f'});
const arrete=(cut=715)=>({current:{identity:ident(cut)},batch:{state:'STOPPED',scope:{part:11,start:556,end:8146,unresolvedPolicy:'defer',lotDecision:'apply'},
  processed:[{cut:556}],skipped:[],paused:[],interrupted:[],manuallyCompleted:[],deferred:[],sequence:[],activeIdentity:ident(712)}});

test('lot arrêté puis « Nouveau lot » : le premier cut est celui qu\'ESV affiche, la fin de l\'ancien lot est gardée',async()=>{
  const {$,appels,attendre}=await panneau(arrete());
  assert.equal($('lot-bornes').hidden,true,'lot arrêté : bornes cachées tant que « Nouveau lot » n\'est pas choisi');
  $('new-batch').onclick();
  assert.equal($('lot-bornes').hidden,false);assert.equal($('start').value,715,'plus 556 : le cut affiché');assert.equal($('end').value,8146);
  assert.equal($('start-batch').className,'primary','« Démarrer » devient le bouton plein');assert.equal($('resume').className,'link');
  $('start-batch').onclick();await attendre();
  const start=appels.find(a=>a.action==='start');assert.ok(start,'le lot est demandé');
  assert.equal(start.args.start,715);assert.equal(start.args.end,8146);assert.equal(start.args.part,11);
});

test('réglages fixes : différer, appliquer, tenter, moteur GCV1 ; aucun sélecteur ni seuil n\'est lu',async()=>{
  const {$,appels,attendre}=await panneau({current:{identity:ident(40)}});
  $('end').value=900;$('end').oninput();$('start-batch').onclick();await attendre();
  const start=appels.find(a=>a.action==='start');
  assert.deepEqual({lowConfidence:start.args.lowConfidence,unresolvedPolicy:start.args.unresolvedPolicy,lotDecision:start.args.lotDecision,geometryEngine:start.args.geometryEngine},
    {lowConfidence:'attempt',unresolvedPolicy:'defer',lotDecision:'apply',geometryEngine:'geometry-candidate-v1'});
  assert.equal(start.args.start,40);assert.equal(start.args.end,900);
  assert.equal(JSON.stringify(appels.find(a=>a.action==='settings').args),JSON.stringify({mode:'automatic-test'}),'aucun seuil de confiance envoyé');
  const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
  for(const id of ['unresolved-policy','lot-decision','confidence','brain-toggle','brain-sanspause'])assert.doesNotMatch(html,new RegExp(`id="${id}"`),id);
  assert.doesNotMatch(html,/<select id="policy"/);assert.match(html,/<input type="hidden" id="policy" value="attempt">/,'politique du lot : fixe, jamais un choix');
  assert.match(html,/id="lot-reglages"/);
});

test('premier cut saisi à la main : respecté ; autre partie : la fin part du cut affiché',async()=>{
  const {$,appels,attendre}=await panneau({...arrete(),current:{identity:{...ident(30),part:12}}});
  $('new-batch').onclick();assert.equal($('start').value,30);assert.equal($('end').value,'','autre partie : pas de fin héritée, « fin de partie »');
  $('start').value=35;$('start').oninput();$('end').value=8144;$('end').oninput();$('start-batch').onclick();await attendre();
  const start=appels.find(a=>a.action==='start');assert.equal(start.args.start,35);assert.equal(start.args.end,8144);assert.equal(start.args.part,12);
});

test('Assisté retiré : un ancien lien « #assisted » ramène à l\'accueil ; aucun onglet ni section',async()=>{
  const {body}=await panneau({},'#assisted');assert.equal(body.dataset.window,'home');
  const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');
  assert.doesNotMatch(html,/data-view="assisted"|data-vue="assisted"|id="tab-assisted"|id="analyze"/);
});

test('bornes remplies par Banane : fin retenue pour la partie, sinon « fin de partie » (champ vide)',async()=>{
  /* Rien de retenu : champ vide, le lot part « jusqu'à la fin de la partie ». */
  let {$,appels,attendre}=await panneau({current:{identity:ident(40)}});
  assert.equal($('start').value,40);assert.equal($('end').value,'');assert.match($('bornes-note').textContent,/fin de la partie/);
  $('start-batch').onclick();await attendre();let start=appels.find(a=>a.action==='start');
  assert.equal(start.args.endMode,'partie');assert.equal(start.args.end,999999);assert.equal(start.args.start,40);
  /* Fin retenue par le service worker pour la partie 11 : proposée, modifiable. */
  ({$,appels,attendre}=await panneau({current:{identity:ident(40)}},'#automatic',{'bornes-partie':{part:11,last:8146,source:'fin constatée'}}));
  assert.ok(appels.some(a=>a.action==='bornes-partie'&&a.args.part===11),'la fin retenue est demandée pour la partie affichée');
  assert.equal($('end').value,8146);assert.match($('bornes-note').textContent,/ESV a quitté la partie après ce cut/);
  /* Dernier cut avant le premier : refusé en clair. */
  $('end').value=10;$('end').oninput();$('start-batch').onclick();await attendre();
  assert.equal(appels.some(a=>a.action==='start'),false);assert.match($('notice').textContent,/Dernier cut : un numéro égal ou après le premier cut/);
});
