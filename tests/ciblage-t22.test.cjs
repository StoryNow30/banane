'use strict';
/* Ciblage T22 (fiches/CIBLAGE_T22.md) — l'écran En cours de Signal avait, en test 21, « N traités sur M ciblés », les graduations du rail et le temps
 * restant ; en test 22, plus rien de cela. Cause : M (`cibles`) ne venait que de `travailDuLot` (panel.js), réservé à un lot « du cut 0 ou 1 jusqu'à la
 * FIN DE PARTIE » ; en test 21, le panneau restait sur son accueil et `#end` n'était jamais rempli (lot toujours « fin de partie ») ; en test 22, l'entrée
 * dans Orbite fait proposer la fin retenue pour la partie (`bornes-partie`), le lot part avec un dernier cut numéroté, et M devenait inconnu.
 * Ici :
 *  - M = invalides compris dans les bornes du lot, d'après la fiche de départ de CE lot et, quand les bornes ne couvrent pas toute la partie, l'instantané
 *    de la liste d'ESV (src/liste-memoire.js) pris dans le même état que la fiche (mêmes lignes, même nombre d'invalides) ; sinon inconnu, et dit ;
 *  - Signal rappelle les bornes du lot pendant le lot, et dit la fin « hors du lot » (ESV passé après le dernier cut du lot) ;
 *  - panel.js : la note « Dernier cut retenu pour la partie… » seulement si une fin est vraiment retenue.
 * Aucune borne envoyée ne change. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=require('../src/signal-rendu.js'),LM=require('../src/liste-memoire.js');
const {monter}=require('./helpers/ui5-page.cjs');

/* Une partie de 10 000 cuts, 74 invalides aux cuts 10, 130, …, 8770. */
const N=10000,INVALIDES=Array.from({length:74},(_,i)=>10+i*120);
const liste=(inv=INVALIDES,n=N)=>{const st=new Array(n).fill(0);for(const c of inv)st[c]=1;return {n,st,partie:23};};
const instantane=(inv=INVALIDES,n=N,partie=23)=>{const st=new Array(n).fill(0);for(const c of inv)st[c]=1;return LM.compacter({st,fl:new Array(n).fill(0),ed:new Array(6*n).fill(null)},{partie,at:'2026-10-26T09:00:00.000Z',cle:'k'});};
const fiche=(x={})=>({batchId:'LNEW',partie:23,valides:N-74,invalides:74,ignores:0,total:N,at:'2026-10-26T09:00:00.000Z',...x});

test('M : toute la partie (départ 0 ou 1, fin de partie OU dernier cut ≥ dernière ligne) : les invalides de la fiche de départ',()=>{
 assert.equal(S.ciblesBornes({part:23,start:0,end:999999,endMode:'partie'},fiche(),null),74);
 assert.equal(S.ciblesBornes({part:23,start:1,end:9999},fiche(),null),74,'dernier cut retenu = dernière ligne de la liste : toute la partie');
 assert.equal(S.ciblesBornes({part:23,start:0,end:12000},fiche(),null),74);
});
test('M : bornes qui ne couvrent pas toute la partie : compté dans l’instantané de la liste pris dans le même état que la fiche',()=>{
 assert.equal(S.ciblesBornes({part:23,start:0,end:8770},fiche(),liste()),74,'fin « constatée » = dernier invalide traité par un lot précédent');
 assert.equal(S.ciblesBornes({part:23,start:0,end:5000},fiche(),liste()),42,'fin saisie plus courte : seulement les invalides du lot (10…4930)');
 assert.equal(S.ciblesBornes({part:23,start:400,end:999999,endMode:'partie'},fiche(),liste()),70,'départ au cut 400 (490…8770)');
 assert.equal(S.ciblesBornes({part:23,start:400,end:999999,endMode:'partie'},fiche(),null),null,'sans instantané : inconnu');
 assert.equal(S.ciblesBornes({part:23,start:400,end:999999,endMode:'partie'},fiche(),liste(INVALIDES.slice(1))),null,'instantané d’un autre état (73 invalides) : inconnu');
 assert.equal(S.ciblesBornes({part:23,start:400,end:999999,endMode:'partie'},fiche(),liste(INVALIDES,N+1)),null,'autre nombre de lignes : inconnu');
 assert.equal(S.ciblesBornes({part:23,start:400,end:999999,endMode:'partie'},fiche(),{...liste(),partie:24}),null,'autre partie : inconnu');
 assert.equal(S.ciblesBornes({part:23,start:9000,end:999999,endMode:'partie'},fiche(),liste()),null,'aucun invalide dans les bornes : pas de « sur 0 »');
 assert.equal(S.ciblesBornes({part:23,start:0,end:999999,endMode:'partie'},fiche({partie:24}),liste()),null,'fiche d’une autre partie');
 assert.equal(S.ciblesBornes({part:23,start:0,end:999999,endMode:'partie'},fiche({invalides:0}),liste([])),null,'fiche sans invalide');
 assert.equal(S.ciblesBornes(null,fiche(),liste()),null);assert.equal(S.ciblesBornes({part:23,start:0,end:9999},null,liste()),null);
});

const b=(id,texte,role='link',actif=true)=>({id,texte,role,actif});
const snap=(ar,x={})=>({variante:'signal',mode:'automatic',notice:{texte:'',erreur:false},boutonsOrbite:[b('pause','Pause','primary'),b('stop','Arrêter le lot','danger')],boutonsEcho:[],onglets:[{valeur:'12',texte:'ESV'}],ongletChoisi:'12',
 reglages:{},echo:{visites:'0',corriges:0},echoRows:[],ar:{etat:'cours',etatTexte:'',horsLigne:false,partie:23,cutEsv:418,cibles:null,poses:13,differes:0,traites:13,restants:null,cours:418,dernier:400,
  bornes:{debut:0,fin:8770},differesListe:[],verts:[],vertsNombre:0,vertsLigne:'',aExaminer:0,lotOuvert:true,passe2:null,cache:{actif:false},connexionBloquee:false,echoEtat:'',alerte:'',esv:'ok',pause:{actif:true},reprendre:null,...ar},
 sig:{activite:'orbite',statuts:Array(13).fill('pose'),allure:{mediane:2.8,parMinute:60/2.8,debutCut:1,depuisS:1,pauseS:null},echo:{},connexion:{statut:'ready',tabId:'12',nomme:true,reconnect:null},onglet:'ESV',historique:null,goto:{},examines:[],theme:'sombre',taille:'normal'},...x});

test('Signal : bornes du lot rappelées pendant le lot (cours, pause demandée, pause, incident) et à la fin',()=>{
 for(const etat of ['cours','dem','pause','alerte']){
  const h=S.rendre(snap({etat}),{});
  assert.match(h,/class="sg-lot-bornes">Lot du cut <span class="sg-mono">0<\/span> au cut <span class="sg-mono">8770<\/span></,etat);}
 assert.match(S.rendre(snap({bornes:{debut:400,fin:null}}),{}),/class="sg-lot-bornes">Lot du cut <span class="sg-mono">400<\/span> jusqu’à la fin de la partie</);
 const f=S.rendre(snap({etat:'fini',lotOuvert:false}),{});assert.match(f,/<dt>Bornes<\/dt><dd>du cut <span class="sg-mono">0<\/span> au cut <span class="sg-mono">8770<\/span><\/dd>/);
 assert.doesNotMatch(S.rendre(snap({etat:'pret',lotOuvert:false}),{}),/sg-lot-bornes/,'au repos : les bornes du prochain lot, pas celles d’un lot');
});
test('Signal : total inconnu dit tel quel (« N traités · total inconnu »), sans graduations ni temps restant',()=>{
 const h=S.rendre(snap({}),{});
 assert.match(h,/class="sg-chiffre">13<\/span><span class="sg-suite">traités · total inconnu<\/span>/);assert.match(h,/data-total="inconnu"/);
 assert.doesNotMatch(h,/sg-rail-num|restantes|ciblés/);
 const k=S.rendre(snap({cibles:74,restants:61}),{});assert.match(k,/traités sur 74 ciblés/);assert.match(k,/environ <b>2 min 51<\/b> restantes/);assert.equal((k.match(/sg-rail-num/g)||[]).length,3);
});
test('Signal : fin « hors du lot » (ESV passé après le dernier cut du lot) dite dans l’écran de fin',()=>{
 const h=S.rendre(snap({etat:'fini',lotOuvert:false,horsLot:{cut:8770,vers:9120,fin:8770}}),{});
 assert.match(h,/<dt>Fin du lot<\/dt><dd>après le cut <span class="sg-mono">8770<\/span>, ESV est passé au cut <span class="sg-mono">9120<\/span>, hors du lot : rien après le cut <span class="sg-mono">8770<\/span> n’est traité par ce lot<\/dd>/);
 assert.doesNotMatch(S.rendre(snap({etat:'fini',lotOuvert:false}),{}),/Fin du lot/);
});

/* src/ui5.js : M lu dans chrome.storage.local (fiche de départ de CE lot, instantané de la liste de la partie), une fois par lot ; `horsLot` d'après
 * `batch.stoppedAtEnd` (navigation au-delà de la fin du lot, même partie). */
const lot=(scope,x={})=>({batch:{id:'LNEW',state:'RUNNING',scope,activeIdentity:{part:23,cut:418},cutStartedAt:new Date().toISOString(),processed:[],deferred:[],skipped:[],manuallyCompleted:[],paused:[],interrupted:[],sequence:[],lotCommands:{},...x},
 current:{identity:{part:23,cut:418}},connection:{status:'ready',tabId:12}});
async function page(stockage){const p=await monter({stockage});vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/liste-memoire.js'),'utf8'),p.ctx);p.els.tabs.options=[{value:'12',textContent:'ESV'}];p.els.tabs.value='12';return p;}
test('ui5 : lot « du cut 0 au cut 8770 » (fin retenue) : M = 74 d’après la fiche et l’instantané ; les bornes envoyées ne sont pas lues ici',async()=>{
 const p=await page({banane3FichesDepart:[fiche({batchId:'AUTRE',invalides:5}),fiche()],'banane5ListeInstantane:23':instantane()});
 p.rendu(lot({part:23,start:0,end:8770}));await p.attendre(60);p.rendu(lot({part:23,start:0,end:8770}));
 const a=p.ui.instantane(p.ctx.etatPanneau).ar;assert.equal(a.cibles,74);
 assert.match(p.hote.innerHTML,/traités sur 74 ciblés/);assert.match(p.hote.innerHTML,/Lot du cut <span class="sg-mono">0<\/span> au cut <span class="sg-mono">8770</);
 assert.deepEqual(p.envoyes,[],'aucun message au service worker');
});
test('ui5 : instantané d’un autre état que la fiche : M inconnu, « total inconnu »',async()=>{
 const p=await page({banane3FichesDepart:[fiche()],'banane5ListeInstantane:23':instantane(INVALIDES.slice(3))});
 p.rendu(lot({part:23,start:400,end:999999,endMode:'partie'}));await p.attendre(60);p.rendu(lot({part:23,start:400,end:999999,endMode:'partie'}));
 assert.equal(p.ui.instantane(p.ctx.etatPanneau).ar.cibles,null);assert.match(p.hote.innerHTML,/total inconnu/);
});
test('ui5 : lot clos par une navigation au-delà de son dernier cut : « hors du lot »',async()=>{
 const p=await page({});
 const s=lot({part:23,start:0,end:8770},{state:'STOPPED',activeIdentity:null,stoppedAtEnd:{cut:8770,reason:'navigation-beyond-end',issue:'sortie',target:{part:23,cut:9120},at:'t',applied:true}});
 p.rendu(s);const a=p.ui.instantane(s).ar;
 assert.deepEqual(JSON.parse(JSON.stringify(a.horsLot)),{cut:8770,vers:9120,fin:8770});assert.match(p.hote.innerHTML,/ESV est passé au cut <span class="sg-mono">9120<\/span>, hors du lot/);
 const autre=lot({part:23,start:0,end:999999,endMode:'partie'},{state:'STOPPED',activeIdentity:null,stoppedAtEnd:{cut:8770,reason:'navigation-other-part',issue:'sortie',target:{part:24,cut:3},at:'t'}});
 assert.equal(p.ui.instantane(autre).ar.horsLot,null,'changement de partie : la fin de la partie, pas « hors du lot »');
});

/* panel.js, l.623 : `bornes-partie` répond null (aucune fin retenue) ; ESV au cut 0, `null >= 0` valait vrai et la note disait « Dernier cut retenu… ». */
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',onclick:null,oninput:null,attrs:{},style:{},classList:{toggle(){},add(){}},dataset:{},
 setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];},replaceChildren(){},append(){},addEventListener(){},set onchange(_){}});
async function panneau(state,reponses){
 const elements=new Map(),appels=[];
 const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:()=>element(),getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
 const chrome={runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendMessage:async({action,args})=>{appels.push({action,args});return {result:action in reponses?reponses[action]:action==='view'||action==='start'?state:action==='list-tabs'?[]:{}};}}};
 const context={document,chrome,location:{hash:'#automatic'},addEventListener:()=>{},setInterval:()=>{},setTimeout:()=>{},clearTimeout:()=>{},console,Date};
 vm.createContext(context);vm.runInContext(SOURCE,context);for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 return {$:id=>document.getElementById(id),appels};
}
test('panel.js : aucune fin retenue pour la partie : note par défaut et dernier cut vide ; une fin retenue : la note la dit',async()=>{
 const s={current:{identity:{part:23,cut:0}}};
 const sans=await panneau(s,{'bornes-partie':null});
 assert.ok(sans.appels.some(a=>a.action==='bornes-partie'),'la fin retenue est demandée');
 assert.equal(sans.$('end').value,'');assert.match(sans.$('bornes-note').textContent,/^Dernier cut vide : le lot va jusqu’à la fin de la partie/);
 const avec=await panneau(s,{'bornes-partie':{part:23,last:8770,source:'fin constatée',at:'t'}});
 assert.equal(String(avec.$('end').value),'8770');assert.match(avec.$('bornes-note').textContent,/^Dernier cut retenu pour la partie 23 \(ESV a quitté la partie après ce cut\)/);
});
