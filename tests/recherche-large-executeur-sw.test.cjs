'use strict';
/* CH-041 — EXÉCUTEUR PARALLÈLE de la recherche large, branché dans le service worker (background.js : `rlPrecalculer` à la capture AVANT, `rlRelancesPrecalculees`
 * à la commande). Service worker réel en VM (tests/helpers/perf-production.cjs), ESV simulé (cuts 111 et 112), `chrome.offscreen` SIMULÉ : le document hors
 * écran est un port qui calcule les relances avec le module pur du même contexte et répond. La décision du module est FORCÉE (comme tests/recherche-large-sw.test.cjs)
 * pour éprouver la plomberie : ce qui part, ce qui revient, ce qui est attendu, le repli. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {decisions,SCOPE,EsvVue}=require('./helpers/deplacer-vue-lot.cjs');
const {production}=require('./helpers/perf-production.cjs'),{base,K}=require('./fixtures.cjs');
const S=require('../src/settings.js');
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const j=v=>JSON.parse(JSON.stringify(v));

/* Montage : réglage allumé, décision forcée `garde` qui NOTE ce qu'elle reçoit (`relances`), document hors écran simulé (`mode` : 'nominal' répond les relances
 * calculées par le module du contexte ; 'erreur' répond une erreur ; 'muet' ne répond jamais), ou absent (`sansOffscreen`). */
async function lot({sansOffscreen=false,mode='nominal',porteFermee=false,delaiMs=20000}={}){
 const adapter=new EsvVue([112]),recus=[],creations=[],appels=[];let port=null;
 const offscreen=sansOffscreen?null:{createDocument:async o=>{creations.push(o);
  port={name:'banane-recherche-large',sender:{id:'test'},_msg:null,_disc:null,onMessage:{addListener:f=>{port._msg=f;}},onDisconnect:{addListener:f=>{port._disc=f;}},
   postMessage:m=>{recus.push(j({...m,capture:{points:m.capture?.pointsSceneRelative?.length??null}}));if(mode==='muet')return;
    setTimeout(()=>{if(mode==='erreur')return port._msg({type:'erreur',id:m.id,message:'panne simulée'});
     const RL=b.ctx.BananeRechercheLarge,relances=[];for(const g of m.graines){const r=RL.relance(m.capture,g,null);relances.push({graine:g,left:r?r.left:[],right:r?r.right:[]});}
     port._msg({type:'resultat',id:m.id,relances,ms:3,fils:2});},5);}};
  setTimeout(()=>b.connect(port),1);}};
 const b=production({adapter,offscreen});
 b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},deplacerVue:{...S.deplacerVue,actif:false,deplacement:{...S.deplacerVue.deplacement,actif:false}},
  lot:{...S.lot,profil:'actuel',gardeApresDiffere:false,rechercheLarge:{...S.lot.rechercheLarge,actif:true}}};
 b.get('RL_EXEC').DELAI_MS=delaiMs;
 const RL=b.ctx.BananeRechercheLarge;
 const garde={version:'essai',etat:'garde',motif:'pose-unique',mode:'differer',ms:1,cellules:{left:1,right:1,relances:0},nPaires:1,paireLot:null,meilleure:null,concurrente:null,positions:null};
 b.ctx.BananeRechercheLarge={...RL,decider:a=>{appels.push({cut:a.capture?.identity?.cut??null,relances:a.relances&&typeof a.relances.get==='function'?[...a.relances.keys()]:null});return garde;},
  ...(porteFermee?{porte:()=>({ouverte:false,seuil:60,max:0,rails:{}})}:{})};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:112,...SCOPE});await b.settle();await attendre(30);
 return {b,recus,creations,appels,evs:j(ev(b,'recherche-large')),valides:j((b.get('engine').s.batch.processed||[]).map(p=>p.cut??p.identity?.cut))};
}

test('nominal : les relances partent à la capture AVANT (graines choisies, capture, configuration du moteur), la commande les attend et les passe au module ; journal',async()=>{
 const x=await lot();
 assert.equal(x.creations.length,1);assert.deepEqual(j(x.creations[0].reasons),['WORKERS']);assert.equal(x.creations[0].url,'offscreen-recherche-large.html','0 fil demandé = adresse nue, le document choisit (cœurs moins un)');
 assert.ok(x.recus.length>=1,'au moins une demande de calcul');const d=x.recus[0];
 assert.equal(d.type,'calculer');assert.ok(Array.isArray(d.graines)&&d.graines.includes(0));assert.ok(d.capture.points>0,'la capture part avec ses points');
 assert.ok(d.moteur&&typeof d.moteur.partialFlank==='boolean'&&typeof d.moteur.convention==='boolean','configuration du moteur transmise');
 const a=x.appels.find(a=>a.cut===111);assert.ok(a,'le module est appelé sur le 111');
 assert.deepEqual(j(a.relances),j(d.graines),'les relances reçues sont passées au module, une par graine demandée');
 const e=x.evs.find(e=>e.identity.cut===111);assert.ok(e&&e.executeur,'journal : exécuteur');
 assert.equal(e.executeur.precalcule,true);assert.ok(Number.isFinite(e.executeur.attenteMs)&&Number.isFinite(e.executeur.cacheMs)&&e.executeur.cacheMs>=0);
 assert.equal(e.executeur.fils,2);assert.equal(e.executeur.graines,d.graines.length);
 assert.ok(x.valides.includes(111),'le cut est posé (décision garde)');
 assert.equal(JSON.stringify(x.evs).includes('positionSceneRelative'),false,'aucune coordonnée au journal');
});
test('panne du document hors écran : repli sur place (module appelé sans relances), journal `erreur`, même commande',async()=>{
 const x=await lot({mode:'erreur'});
 const a=x.appels.find(a=>a.cut===111);assert.ok(a);assert.equal(a.relances,null,'sans relances précalculées : le module relance sur place');
 const e=x.evs.find(e=>e.identity.cut===111);assert.equal(e.executeur.precalcule,false);assert.match(e.executeur.erreur,/panne simulée/);
 assert.ok(x.valides.includes(111));
});
test('document muet : délai dépassé puis repli sur place',async()=>{
 const x=await lot({mode:'muet',delaiMs:60});
 const a=x.appels.find(a=>a.cut===111);assert.ok(a);assert.equal(a.relances,null);
 const e=x.evs.find(e=>e.identity.cut===111);assert.equal(e.executeur.precalcule,false);assert.match(e.executeur.erreur,/délai|muet/);
});
test('porte fermée à la commande : les relances précalculées ne sont pas attendues (journal `porteFermee`)',async()=>{
 const x=await lot({porteFermee:true});
 assert.ok(x.recus.length>=1,'la demande est tout de même partie à la capture (la pose n\'est pas connue alors)');
 const e=x.evs.find(e=>e.identity.cut===111);assert.equal(e.executeur.precalcule,false);assert.equal(e.executeur.porteFermee,true);
 const a=x.appels.find(a=>a.cut===111);assert.equal(a.relances,null);
});
test('sans permission offscreen (chrome.offscreen absent) : rien ne part, calcul sur place, journal sans exécuteur',async()=>{
 const x=await lot({sansOffscreen:true});
 assert.equal(x.recus.length,0);assert.equal(x.creations.length,0);
 const a=x.appels.find(a=>a.cut===111);assert.ok(a);assert.equal(a.relances,null);
 const e=x.evs.find(e=>e.identity.cut===111);assert.equal(e.executeur,undefined);
});
test('éteinte (livré) : rien ne part, même avec chrome.offscreen',async()=>{
 const adapter=new EsvVue([112]),creations=[];const b=production({adapter,offscreen:{createDocument:async o=>{creations.push(o);}}});
 assert.equal(S.lot.rechercheLarge.actif,false);
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:112,...SCOPE});await b.settle();await attendre(20);
 assert.equal(creations.length,0);assert.equal(ev(b,'recherche-large').length,0);
});
