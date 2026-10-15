'use strict';
/* U1 — résumé de partie dans le panneau (panel.js réel, VM Node, DOM et
 * stockage simulés). Les 9 premiers essais sont ceux de la livraison U1
 * d'origine, mêmes scénarios et mêmes données ; leurs attentes de libellés
 * suivent les libellés réécrits (rapport mission G, tableau des adaptations).
 * Les essais « G : » couvrent les défauts relevés par la mission G. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8'),MODULE=fs.readFileSync(path.join(__dirname,'../src/part-summary-49.js'),'utf8');
const element=()=>({hidden:false,disabled:false,textContent:'',innerHTML:'',value:'',checked:false,open:false,className:'',style:{},dataset:{},
 classList:{toggle(){},add(){}},setAttribute(){},removeAttribute(){},replaceChildren(){},append(){},addEventListener(){}});
const id=cut=>({pageId:'p',frameId:'f',shape:'U50',projectId:null,part:23,cut});
const event=(type,cut,time,extra={})=>({type,eventId:type+time,identity:id(cut),timestamp:'2026-10-02T08:00:0'+time+'.000Z',...extra});
const events=[event('batch-started',1,0,{batch:{id:'a',startedAt:'2026-10-02T08:00:00.000Z'}}),event('defer-finalized',1,1,{batchId:'a',deferredConfirmed:true,rails:{left:{gcv1:{motif:'input'}}}}),event('batch-started',1,2,{batch:{id:'b',startedAt:'2026-10-02T08:00:02.000Z'}}),event('validation-accepted',1,3,{batchId:'b',action:'VALIDATE'})];
/* `bloquerApres` : à partir de la n-ième ouverture, le stockage ne répond plus (lecture en cours). */
async function panel({fail=false,history=events,current=id(1),statePatch={},bloquerApres=Infinity,espion=false}={}){
 const elements=new Map(),calls=[],transactions=[],intervals=[];let ouvertures=0;
 const state={sessionId:'s',current:{identity:current},batch:{id:'b',state:'STOPPED',scope:{part:23,pageId:'p',start:1,end:1},activeIdentity:id(1),processed:[{identity:id(1)}],skipped:[],deferred:[],sequence:[],interrupted:[]},events:[]};
 Object.assign(state,statePatch);
 const document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:element,getElementById(k){if(!elements.has(k))elements.set(k,element());return elements.get(k);}};
 class Storage{async open(){if(fail)throw Error('stockage indisponible');if(++ouvertures>bloquerApres)return new Promise(()=>{});
   return {transaction(name,mode){transactions.push({name,mode});const tx={};tx.objectStore=()=>({openCursor(range){const req={};let i=range?range.lo+1:0;const next=()=>setImmediate(()=>{let continued=false;req.result=i<history.length?{key:i,value:history[i++],continue(){continued=true;next();}}:null;req.onsuccess();if(!continued)tx.oncomplete?.();});next();return req;}});return tx;}};}}
 const ctx={document,BananeStorage3:Storage,IDBKeyRange:{lowerBound:lo=>({lo})},chrome:{runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendMessage:async({action,args})=>{calls.push({action,args});return {result:action==='view'?state:action==='list-tabs'?[]:{}};}}},location:{hash:'#automatic'},addEventListener(){},setInterval(fn){intervals.push(fn);},setTimeout(){},clearTimeout(){},console,Date};
 vm.createContext(ctx);vm.runInContext(MODULE,ctx);
 const appels={n:0};if(espion){const R=ctx.ArianePartSummary49,f=R.summarize;R.summarize=(...a)=>{appels.n++;return f(...a);};}
 vm.runInContext(SOURCE,ctx);
 const wait=async()=>{for(let i=0;i<35;i++)await new Promise(r=>setImmediate(r));};await wait();
 return {$:k=>document.getElementById(k),calls,transactions,state,intervals,wait,appels};
}
test('résumé visible : historique multi-lots dédupliqué, différé résolu, lecture seule',async()=>{
 const p=await panel();assert.equal(p.$('part-summary').hidden,false);assert.match(p.$('part-summary-counts').innerHTML,/>Lots</);assert.match(p.$('part-summary-counts').innerHTML,/>2<\/b>/);
 assert.match(p.$('part-summary-deferred').textContent,/Aucun différé restant/);assert.match(p.$('part-summary-note').textContent,/projet non identifié/i);
 assert.ok(p.transactions.length);assert.ok(p.transactions.every(t=>t.name==='events'&&t.mode==='readonly'));
 assert.ok(!p.calls.some(c=>['start','resume','stop','apply','validate','skip','next','journal','dataset'].includes(c.action)));
});
test('stockage refusé : historique inconnu visible, aucune erreur des commandes',async()=>{
 const p=await panel({fail:true});assert.match(p.$('part-summary-note').textContent,/Historique indisponible/);assert.match(p.$('part-summary-note').textContent,/Nombre total de coupes de la partie : inconnu/);
 assert.match(p.$('part-summary-counts').innerHTML,/au moins 1/);assert.equal(p.$('start-batch').disabled,false);
});
test('changement de partie pendant la lecture : aucun ancien compte affiché',async()=>{
 /* Sans lot, le résumé suit ESV (le cas avec lot est l'essai « G : » plus bas). */
 const p=await panel({current:{...id(1),part:24},statePatch:{batch:null}});assert.match(p.$('part-summary-title').textContent,/24/);assert.doesNotMatch(p.$('part-summary-lots').innerHTML,/>a|>b|\ba ·|\bb ·/);
 assert.equal(p.$('part-summary-lots').innerHTML,'');
});
test('HTML : module chargé avant le panneau et aucun bouton de commande dans le résumé',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8');assert.ok(html.indexOf('src/part-summary-49.js')<html.indexOf('src="panel.js"'));
 const block=html.match(/<section id="part-summary"[\s\S]*?<\/section>/)?.[0];assert.ok(block);assert.doesNotMatch(block,/<button|onclick|onchange/);
});
test('long historique : transactions de lecture bornées et aucun balayage à chaque seconde',async()=>{
 const p=await panel({history:[...events,...Array.from({length:300},(_,i)=>({eventId:'echo-'+i,type:'native-capture',nativeSessionId:'echo'}))]});
 for(let i=0;i<12;i++)await p.wait();assert.equal(p.transactions.length,3);
 const reads=p.transactions.length;for(let i=0;i<7;i++){p.intervals[0]();await p.wait();}
 assert.equal(p.transactions.length,reads);assert.match(p.$('part-summary-lots-title').textContent,/2/);
});
test('U1 correction : historique indisponible, tous les zéros historiques sont inconnus',async()=>{
 const p=await panel({fail:true});
 assert.match(p.$('part-summary-counts').innerHTML,/inconnu moteur · inconnu écartement · inconnu sans points · inconnu motif inconnu/);
 assert.match(p.$('part-summary-unknown').textContent,/Issue inconnue : inconnu/);
 assert.match(p.$('part-summary-unknown').textContent,/Événements sans identité complète : inconnu/);
 assert.match(p.$('part-summary-unknown').textContent,/En cours maintenant : aucun cut/);
 assert.equal(p.$('part-summary-deferred').textContent,'Différés restants : inconnu (aucun dans ce qui a été lu).');
 assert.match(p.$('part-summary-lots-title').textContent,/au moins 1/);
 assert.match(p.$('part-summary-lots').innerHTML,/coupes au moins 1 · posées au moins 1 · différées inconnu · issue inconnue inconnu/);
});
test('U1 correction : historique lu mais incomplet, positifs en minimums et liste partielle',async()=>{
 const history=[event('defer-finalized',2,4,{batchId:'debut-perdu',deferredConfirmed:true,rails:{left:{gcv1:{motif:'input'}}}}),event('before-captured',3,5,{batchId:'debut-perdu'})];
 const p=await panel({history});assert.match(p.$('part-summary-note').textContent,/Historique incomplet/);
 assert.match(p.$('part-summary-counts').innerHTML,/inconnu moteur · inconnu écartement · au moins 1 sans points · inconnu motif inconnu/);
 assert.match(p.$('part-summary-unknown').textContent,/Issue inconnue : au moins 1/);
 assert.match(p.$('part-summary-lots').innerHTML,/coupes au moins 2 · posées inconnu · différées au moins 1 · issue inconnue au moins 1/);
 assert.equal(p.$('part-summary-deferred').textContent,'Différés restants connus : 2 (liste peut-être incomplète).');
});
test('U1 correction : historique complet disponible, les vrais zéros restent zéro',async()=>{
 const p=await panel();assert.match(p.$('part-summary-counts').innerHTML,/0 moteur · 0 écartement · 0 sans points · 0 motif inconnu/);
 assert.equal(p.$('part-summary-deferred').textContent,'Aucun différé restant.');
 assert.equal(p.$('part-summary-unknown').textContent,'Issue inconnue : 0 · En cours maintenant : aucun cut · Événements sans identité complète : 0.');
 assert.equal(p.$('part-summary-lots-title').textContent,'Lots de la partie (2)');
 assert.match(p.$('part-summary-lots').innerHTML,/coupes 1 · posées 1 · différées 0 · issue inconnue 0/);
});
test('U1 correction : état en cours actuel distinct des inconnus historiques',async()=>{
 const batch={id:'b',state:'RUNNING',activeIdentity:id(4),processed:[],deferred:[],skipped:[],interrupted:[]};
 const p=await panel({fail:true,current:id(4),statePatch:{batch}});
 assert.match(p.$('part-summary-unknown').textContent,/Issue inconnue : inconnu · En cours maintenant : cut 4/);
 assert.doesNotMatch(p.$('part-summary-unknown').textContent,/au moins 1 en cours|inconnu en cours/);
});

/* ---- Mission G ---- */
test('G : ESV affiche une autre partie, le résumé reste sur la partie du lot (comme le titre)',async()=>{
 const p=await panel({current:{...id(1),part:24}});
 assert.match(p.$('part-summary-title').textContent,/partie 23/);assert.match(p.$('part-summary-counts').innerHTML,/>2<\/b>/);
 assert.equal(p.$('part-summary-lots-title').textContent,'Lots de la partie (2)');
});
test('G : nouveau lot pendant que l’historique se relit : comptes partiels, jamais l’ancien « complet »',async()=>{
 const p=await panel({bloquerApres:1});assert.match(p.$('part-summary-counts').innerHTML,/>2<\/b>/);assert.doesNotMatch(p.$('part-summary-counts').innerHTML,/au moins/);
 p.state.batch={id:'c',state:'RUNNING',scope:{part:23,pageId:'p'},startedAt:'2026-10-02T08:00:08.000Z',activeIdentity:id(2),processed:[],deferred:[],skipped:[],interrupted:[]};
 p.intervals[0]();await p.wait();
 assert.match(p.$('part-summary-counts').innerHTML,/au moins/);assert.match(p.$('part-summary-note').textContent,/Lecture de l’historique en cours/);
});
test('G : le résumé n’est recalculé que si ses entrées changent',async()=>{
 const p=await panel({espion:true});const avant=p.appels.n;assert.ok(avant>=1);
 for(let i=0;i<5;i++){p.intervals[0]();await p.wait();}
 assert.equal(p.appels.n,avant);
 p.state.batch={...p.state.batch,processed:[...p.state.batch.processed,{identity:id(2)}]};p.intervals[0]();await p.wait();
 assert.equal(p.appels.n,avant+1);assert.match(p.$('part-summary-counts').innerHTML,/Coupes traitées<\/span><b>2<\/b>/);
});
test('G : panneau sans module de résumé : bloc masqué, reste du panneau inchangé',async()=>{
 /* Comme panel.html : le bloc part masqué (attribut hidden). */
 const elements=new Map([['part-summary',{...element(),hidden:true}]]),document={body:{dataset:{}},activeElement:null,querySelectorAll:()=>[],createElement:element,getElementById(k){if(!elements.has(k))elements.set(k,element());return elements.get(k);}};
 const ctx={document,chrome:{runtime:{connect:()=>({onMessage:{addListener(){}},onDisconnect:{addListener(){}}}),sendMessage:async({action})=>({result:action==='view'?{sessionId:'s',current:{identity:id(1)},batch:null,events:[]}:action==='list-tabs'?[]:{}})}},location:{hash:'#automatic'},addEventListener(){},setInterval(){},setTimeout(){},clearTimeout(){},console,Date};
 vm.createContext(ctx);vm.runInContext(SOURCE,ctx);for(let i=0;i<20;i++)await new Promise(r=>setImmediate(r));
 assert.equal(document.getElementById('part-summary').hidden,true);assert.equal(document.getElementById('start-batch').disabled,false);
});

/* ---- Après relecture : bloc replié par défaut, une ligne de comptes toujours visible ---- */
test('G : bloc replié par défaut, la ligne de comptes est hors du repli (bornes et exports restent en haut)',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../panel.html'),'utf8'),block=html.match(/<section id="part-summary"[\s\S]*?<\/section>/)?.[0];assert.ok(block);
 const repli=block.match(/<details id="part-summary-details"(?<attrs>[^>]*)>/);assert.ok(repli,'repli du détail');assert.doesNotMatch(repli.groups.attrs,/\bopen\b/);
 const avant=block.slice(0,repli.index);
 assert.match(avant,/id="part-summary-title"/);assert.match(avant,/id="part-summary-line"/);
 for(const k of ['part-summary-counts','part-summary-deferred','part-summary-unknown','part-summary-note','part-summary-lots'])assert.ok(block.indexOf(`id="${k}"`)>repli.index,k+' dans le repli');
});
test('G : ligne de comptes : exacte si complet, « au moins » et « inconnu » sinon, jamais un zéro inventé',async()=>{
 let p=await panel();assert.equal(p.$('part-summary-line').textContent,'Coupes traitées 1 · Posées 1 · Différés restants 0');
 p=await panel({fail:true});assert.equal(p.$('part-summary-line').textContent,'Coupes traitées au moins 1 · Posées au moins 1 · Différés restants inconnu');
 p=await panel({statePatch:{batch:null,sessionId:null}});assert.equal(p.$('part-summary-line').textContent,'Partie non identifiée : résumé inconnu.');
});
