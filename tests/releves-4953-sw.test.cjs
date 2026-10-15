'use strict';
/* 4.9.5.3 (S6) — relevés en LECTURE SEULE du service worker (production en VM) : entrées de l'observateur revalidées, avis `fetch-rails`,
 * empreinte du contrat à « Connecter », audit des validés côté serveur au rechargement de la liste. Rien n'est envoyé à ESV, rien ne change
 * dans la pose, la validation ni la navigation. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const {production,memoire}=require('./helpers/perf-production.cjs'),{SimulatedESV}=require('./fixtures.cjs');
const send=(b,entries,observer='obs-1')=>b.raw({kind:'esv-observation',observer,entries});
const stored=(b,t='esv-observation')=>b.store.events.filter(e=>e.type===t);
async function seance(opts={}){const b=production(opts);await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');e.s.batch={id:'lot-r',state:'RUNNING',scope:{part:23,start:100,end:101}};r.syncBatch(true);r.ensureVisit(b.adapter.identity);return b;}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));

test('entrées de l\'observateur : statut des ressources, inventaire des champs, écouteurs et compteur bloqué rangés en liste blanche', async () => {
 const b=await seance();
 const r=send(b,[{seq:1,kind:'resource',class:'point-resource',n:5,bytes:900,startedEpochMs:1e12,endedEpochMs:1e12+50,windowMs:250,ept:5,statuts:{200:3,404:1,0:1,'x<':9,1234:2},sansStatut:0,echecs:2,echecsCumules:7,dureeTotMs:123.4,dureeMaxMs:80,url:'https://esv.test/secret'},
  {seq:2,kind:'list-fields',listKey:'p-key',rows:60,champs:5,noms:['RailSpacing','RowKey','mauvais nom!','Success_ok'],gardes:{RailSpacing:{n:60,min:1.4,max:1.5},TrajAzimuth:{n:0},RailType:{n:60,valeurs:{U50:30,'x y':1}},PK:{n:60},Success:{SuccessLeft:{n:60,vrai:45}}},extra:'x'},
  {seq:3,kind:'esv-event',nom:'railPairSelected',args:['23',5,{a:1},'x'.repeat(40)],pageMs:12.5,perdus:2},{seq:4,kind:'esv-event',nom:'inconnu',args:[]},
  {seq:5,kind:'diag-compteur-bloque',valeur:3,cuts:3,cut:77,pageMs:9}]).out;
 deq(r,{accept:true,stored:5});const e=stored(b);deq(e.map(x=>x.kind),['resource','list-fields','esv-event','diag-compteur-bloque','gap']);
 deq([e[4].reason,e[4].lost],['rejected',1]);   // le nom d'événement inconnu est refusé et dit
 deq([e[0].ept,e[0].statuts,e[0].sansStatut,e[0].echecs,e[0].echecsCumules,e[0].dureeTotMs,e[0].dureeMaxMs],[5,{200:3,404:1,0:1,1234:2},0,2,7,123.4,80].map((v,i)=>i===1?{200:3,404:1,0:1}:v));
 assert.ok(!JSON.stringify(e).includes('secret'));
 deq([e[1].listKey,e[1].rows,e[1].noms,e[1].gardes.RailType.valeurs,e[1].gardes.Success],['p-key',60,['RailSpacing','RowKey','Success_ok'],{U50:30},{SuccessLeft:{n:60,vrai:45}}]);assert.ok(!('extra' in e[1]));
 deq([e[2].nom,e[2].args,e[2].pageMs,e[2].perdus],['railPairSelected',['23',5,null,null],12.5,2]);
 deq([e[3].valeur,e[3].cuts,e[3].cut,e[3].pageMs],[3,3,77,9]);
 /* Une ressource d'un ancien observateur (sans les champs de statut) reste lisible. */
 send(b,[{seq:9,kind:'resource',class:'point-resource',n:2,bytes:10,startedEpochMs:1e12,endedEpochMs:1e12+1,windowMs:250}]);const ancien=stored(b).at(-1);assert.ok(!('ept' in ancien)&&!('statuts' in ancien));
});

test('réglages : les relevés de la page coupés sont rendus au pont (relevesOff) ; tous actifs par défaut', async () => {
 const b=await seance();assert.ok(!('relevesOff' in send(b,[{seq:1,kind:'gap',lost:1,reason:'ring-overflow'}]).out),'rien à couper par défaut');
 const S=b.ctx.BananeSettings;b.ctx.BananeSettings={...S,releves:{...S.releves,ressources:false,champsListe:false,compteurBloque:{actif:false,cuts:3}},esvEvents:{...S.esvEvents,ombre:false}};
 deq(send(b,[{seq:2,kind:'gap',lost:1,reason:'ring-overflow'}]).out.relevesOff,['ressources','champsListe','compteurBloque','esvEvents']);
});

test('avis fetch-rails : une ligne au panneau et un événement avis-contrat-esv quand le compteur devient non nul, une fois', async () => {
 const b=await seance();
 send(b,[{seq:1,kind:'fetch-rails',n:0,startedEpochMs:1e12,endedEpochMs:1e12+1,windowMs:250}]);
 assert.equal(stored(b,'avis-contrat-esv').length,0,'compteur à zéro : aucun avis');assert.equal(plat(await b.api('view')).avisContrat,undefined);
 send(b,[{seq:2,kind:'fetch-rails',n:3,startedEpochMs:1e12,endedEpochMs:1e12+40,windowMs:250}]);
 const a=stored(b,'avis-contrat-esv');assert.equal(a.length,1);deq([a[0].motif,a[0].n,a[0].batchId],['fetch-rails',3,'lot-r']);assert.match(a[0].texte,/fetch/);
 const v=plat(await b.api('view'));assert.equal(v.avisContrat.length,1);assert.match(v.avisContrat[0],/passent par « fetch »/);
 send(b,[{seq:3,kind:'fetch-rails',n:5,startedEpochMs:1e12,endedEpochMs:1e12+40,windowMs:250}]);assert.equal(stored(b,'avis-contrat-esv').length,1,'une seule fois');
 /* Réglage coupé : pas d'avis. */
 const c=await seance();c.ctx.BananeSettings={...c.ctx.BananeSettings,releves:{...c.ctx.BananeSettings.releves,avisFetch:false}};
 send(c,[{seq:1,kind:'fetch-rails',n:3,startedEpochMs:1e12,endedEpochMs:1e12+40,windowMs:250}]);assert.equal(stored(c,'avis-contrat-esv').length,0);
 /* Rien n'a été envoyé à ESV par ce relevé. */
 assert.deepEqual(b.commands.filter(x=>!['ping','state','nativeSnapshot'].includes(x.action)),[]);
});

test('empreinte du contrat à « Connecter » : consignée, comparée à la précédente, avis si elle change ; aucune action sur ESV', async () => {
 const local=memoire(),adapter=new SimulatedESV();let hash='aaaaaaaa',detail={jquery:'3.6.0',ecouteurs:{loading:1,newPart:2},boutons:[['a','A']]};
 const ping=adapter.ping.bind(adapter);adapter.ping=async(o)=>({...await ping(),...(o&&o.contrat===true?{contrat:{hash,detail}}:{})});
 const b=production({adapter,local});await b.api('connect',{tabId:1});await attendre(20);
 let c=stored(b,'contrat-esv');assert.equal(c.length,1);deq([c[0].hash,c[0].precedent,c[0].change],['aaaaaaaa',null,false]);assert.equal(stored(b,'avis-contrat-esv').length,0,'première connexion : rien à comparer');
 assert.equal(local.m.banane53Contrat.hash,'aaaaaaaa');
 await b.api('connect',{tabId:1});await attendre(20);assert.equal(stored(b,'contrat-esv').at(-1).change,false,'même empreinte : pas de changement');assert.equal(stored(b,'avis-contrat-esv').length,0);
 hash='bbbbbbbb';detail={jquery:'3.7.1',ecouteurs:{loading:1,newPart:3},boutons:[['a','A']]};
 await b.api('connect',{tabId:1});await attendre(20);
 c=stored(b,'contrat-esv').at(-1);deq([c.hash,c.precedent,c.change],['bbbbbbbb','aaaaaaaa',true]);deq(c.changements.sort(),['ecouteurs.newPart','jquery']);
 const a=stored(b,'avis-contrat-esv');assert.equal(a.length,1);assert.equal(a[0].motif,'empreinte:bbbbbbbb');assert.match(a[0].texte,/aaaaaaaa.*bbbbbbbb/);
 assert.match(plat(await b.api('view')).avisContrat[0],/n’a plus le même contrat/);
 /* Nouvelle connexion, contrat stable depuis : l'avis tombe. */
 await b.api('connect',{tabId:1});await attendre(20);assert.equal(plat(await b.api('view')).avisContrat,undefined);
 assert.deepEqual(b.commands.filter(x=>!['ping','state','nativeSnapshot'].includes(x.action)),[],'aucune action sur ESV');
 /* Empreinte illisible ou réglage coupé : rien. */
 const adapter2=new SimulatedESV();adapter2.ping=async(o)=>({version:require('../src/core.js').VERSION,pageId:'p',proprietaire:'test',...(o&&o.contrat===true?{contrat:{hash:'pas-un-hash',detail:{}}}:{})});
 const d=production({adapter:adapter2,local:memoire()});await d.api('connect',{tabId:1});await attendre(20);assert.equal(stored(d,'contrat-esv').length,0);
 const e=production({adapter:new SimulatedESV(),local:memoire()});e.ctx.BananeSettings={...e.ctx.BananeSettings,releves:{...e.ctx.BananeSettings.releves,empreinte:false}};await e.api('connect',{tabId:1});await attendre(20);
 assert.equal(e.commands.filter(x=>x.action==='ping').length,1,'relevé coupé : pas de second ping');
});

test('audit serveur : validés côté serveur au rechargement de la liste contre les validations d\'Ariane depuis la lecture précédente', async () => {
 const local=memoire(),b=await seance({local});
 b.ctx.BananeSettings={...b.ctx.BananeSettings,releves:{...b.ctx.BananeSettings.releves,auditSilenceMs:5}};
 b.get('engine').s.batch.scope.part=23;
 const t0=Date.now()-60000,iso=t=>new Date(t).toISOString();
 const resume=(valid)=>({seq:1,kind:'list-summary',listKey:'p-key',pages:3,okPages:3,rows:2000,chars:1,counts:{valid,invalid:2000-valid,skipped:0},firstStartedEpochMs:t0-500,lastEndedEpochMs:t0,durationMs:500,beforeSession:true});
 send(b,[resume(1500)],'obs-A');await attendre(20);assert.equal(stored(b,'audit-serveur').length,0,'première lecture : rien à comparer');
 assert.equal(local.m.banane53Lectures['p-key'].valid,1500);
 /* Ariane valide 3 cuts de la partie 23 (et un d'une autre partie) entre les deux lectures. */
 for(const [dt,part] of [[10000,23],[20000,23],[30000,23],[35000,24]])await b.store.putEvent({eventId:'v'+dt,timestamp:iso(t0+dt),type:'validation-accepted',identity:{part,cut:dt}});
 const page=(valid,fin,rows)=>({seq:9,kind:'list-page',listKey:'p-key',status:200,outcome:'done',rows,counts:{valid,invalid:rows-valid,skipped:0},startedEpochMs:fin-300,endedEpochMs:fin,durationMs:300,chars:5});
 send(b,[page(800,t0+50000,1000),page(703,t0+50400,1000)],'obs-B');await attendre(60);
 const a=stored(b,'audit-serveur');assert.equal(a.length,1);
 deq([a[0].partie,a[0].validesAvant,a[0].validesApres,a[0].attendus,a[0].constates,a[0].ecart,a[0].avantSeance,a[0].pages],[23,1500,1503,3,3,0,false,2]);
 assert.ok(Date.parse(a[0].depuis)===t0&&Date.parse(a[0].jusqua)===t0+50400);
 /* Un humain valide 4 cuts de plus : l'écart le dit, sans conclure. */
 send(b,[page(1507,t0+90000,2000)],'obs-C');await attendre(60);
 const d=stored(b,'audit-serveur').at(-1);deq([d.validesAvant,d.validesApres,d.attendus,d.constates,d.ecart],[1503,1507,0,4,4]);
 /* La question « y a-t-il des invalides ? » (clé undefined, une ligne) n'est jamais une lecture de liste. */
 send(b,[{...page(0,t0+95000,1),listKey:'undefined'}],'obs-D');await attendre(60);assert.equal(stored(b,'audit-serveur').length,2);
 /* Réglage coupé. */
 const c=await seance();c.ctx.BananeSettings={...c.ctx.BananeSettings,releves:{...c.ctx.BananeSettings.releves,auditSilenceMs:5,auditServeur:false}};
 send(c,[resume(10)],'x');send(c,[page(20,t0+1,1000)],'y');await attendre(40);assert.equal(stored(c,'audit-serveur').length,0);
 assert.deepEqual(b.commands.filter(x=>!['ping','state','nativeSnapshot'].includes(x.action)),[]);
});
