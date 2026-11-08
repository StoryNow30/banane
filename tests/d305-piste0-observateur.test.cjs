'use strict';
/* D-305, piste 0 (lecture seule) : pour les nœuds ept-data téléchargés par ESV, l'observateur passif compte les réponses servies par
 * le cache du navigateur (transferSize 0, corps non vide) et sépare l'attente du serveur (début → premier octet) du transfert
 * (premier → dernier octet). Jamais d'adresse : les mêmes champs numériques que les autres relevés de ressources. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {world,tick,ORIGIN}=require('./helpers/fake-page.cjs');require('../src/esv-observer.js');
const ept=(n,o={})=>({name:ORIGIN+'/data/ept-data/'+n+'.bin',startTime:100,responseStart:130,responseEnd:140,duration:40,transferSize:1000,decodedBodySize:1000,responseStatus:200,initiatorType:'xmlhttprequest',...o});
const fenetre=async w=>{w.runTimers();await tick();};

test('cache du navigateur, attente du serveur et transfert, par fenêtre ; aucune adresse dans le relevé',async()=>{
 const w=world();
 w.po().emit([ept('0-0-0-0'),ept('1-0-0-0',{startTime:200,responseStart:260,responseEnd:300}),ept('1-1-0-0',{transferSize:0,decodedBodySize:5000,startTime:400,responseStart:401,responseEnd:402})]);
 await fenetre(w);
 const r=w.observed().filter(x=>x.kind==='resource').at(-1);
 assert.deepEqual([r.ept,r.depuisCache,r.attenteServeurMs,r.transfertMs],[3,1,30+60+1,10+40+1]);
 assert.ok(!JSON.stringify(r).includes('ept-data'),'aucun chemin ni adresse');
});
test('sans réponse du cache ni premier octet connu : champs absents, rien d’inventé',async()=>{
 const w=world();
 w.po().emit([ept('0-0-0-0',{responseStart:undefined})]);await fenetre(w);
 const r=w.observed().filter(x=>x.kind==='resource').at(-1);
 assert.equal(r.ept,1);assert.ok(!('depuisCache' in r));assert.ok(!('attenteServeurMs' in r));assert.ok(!('transfertMs' in r));
});

/* Vision 3 (08/11) : les trois relevés étaient mesurés dans la page mais retirés par la revalidation du service worker (background.js,
 * liste de champs connus) ; le journal du lot du 08/11 n'en portait aucun. Essai de bout en bout, écrit ROUGE avant le correctif. */
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x));
const {production}=require('./helpers/perf-production.cjs');
test('service worker : depuisCache, attenteServeurMs et transfertMs arrivent au journal, bornés ; une valeur invalide est écartée',async()=>{
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');e.s.batch={id:'lot-p0',state:'RUNNING',scope:{part:23,start:100,end:101}};r.syncBatch(true);r.ensureVisit(b.adapter.identity);
 b.raw({kind:'esv-observation',observer:'obs-p0',entries:[
  {seq:1,kind:'resource',class:'point-resource',n:3,bytes:900,startedEpochMs:1e12,endedEpochMs:1e12+50,windowMs:250,ept:3,statuts:{200:3},sansStatut:0,echecs:0,echecsCumules:0,dureeTotMs:120,dureeMaxMs:60,depuisCache:1,attenteServeurMs:91,transfertMs:51},
  {seq:2,kind:'resource',class:'point-resource',n:1,bytes:9,startedEpochMs:1e12+60,endedEpochMs:1e12+70,windowMs:250,ept:1,statuts:{200:1},sansStatut:0,echecs:0,echecsCumules:0,dureeTotMs:10,dureeMaxMs:10,depuisCache:'x',attenteServeurMs:-5,transfertMs:'y'}]});
 await new Promise(r=>setTimeout(r,50));
 const ev=b.store.events.filter(x=>x.type==='esv-observation'&&x.kind==='resource');
 assert.equal(ev.length,2,'deux fenêtres au journal');
 assert.deepEqual(plat([ev[0].depuisCache,ev[0].attenteServeurMs,ev[0].transfertMs]),[1,91,51]);
 assert.ok(!('depuisCache' in ev[1])||ev[1].depuisCache===null,'valeur non numérique écartée');
});
