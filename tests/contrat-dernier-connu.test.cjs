'use strict';
/* 5.0 (audit 5.0, U1) — EMPREINTE DU CONTRAT ESV : LA DERNIÈRE CONNUE SURVIT AU REDÉMARRAGE DU NAVIGATEUR.
 *
 * Depuis la 4.9.5.4 (D-139), l'empreinte précédente est rangée PAR ONGLET dans chrome.storage.session : elle disparaît quand le
 * navigateur redémarre, et un vrai changement d'ESV survenu entre deux jours passait inaperçu au premier « Connecter ». En plus de
 * l'empreinte par onglet, la DERNIÈRE empreinte connue, tous onglets confondus, est gardée dans chrome.storage.local. Quand l'onglet
 * n'a pas d'empreinte propre, l'événement `contrat-esv` consigne « différente de la dernière connue », SANS avis bloquant (deux
 * fenêtres dans deux états restent possibles : seul l'onglet lui-même fait foi pour l'avis). Lecture seule ; données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs'),{SimulatedESV}=require('./fixtures.cjs');
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const stored=(b,t)=>b.store.events.filter(e=>e.type===t);
const DETAIL=(extra={})=>({boutons:['a','b'],ecouteurs:{loading:true,newPart:true},jquery:'3.6.0',potree:'1.8',rails:['btn','btn'],...extra});

/* Une « vie » du navigateur : storage.session neuf à chaque fois (il ne survit pas au redémarrage), storage.local partagé. */
function navigateur(local,etat){
 const session=memoire(),adapter=new SimulatedESV();let courant=null;const ping=adapter.ping.bind(adapter);
 adapter.ping=async o=>({...await ping(),...(o&&o.contrat===true?{contrat:etat[courant]}:{})});
 const b=production({adapter,local,session});
 const envoi=b.ctx.chrome.tabs.sendMessage;b.ctx.chrome.tabs.sendMessage=async(id,m)=>{courant=id;return envoi(id,m);};
 return {b,session,connecter:async id=>{await b.api('connect',{tabId:id});await attendre(25);}};
}

test('redémarrage du navigateur : un changement d\'ESV entre deux jours est consigné au premier « Connecter », sans avis',async()=>{
 const local=memoire();
 const jour1=navigateur(local,{1:{hash:'aaaaaaaa',detail:DETAIL()}});await jour1.connecter(1);
 assert.equal(local.m.banane50ContratDernier.hash,'aaaaaaaa','la dernière empreinte est gardée dans storage.local');
 assert.ok(!('version' in local.m.banane50ContratDernier)||typeof local.m.banane50ContratDernier.version==='string');
 /* Jour 2 : storage.session est vide (nouveau navigateur) ; ESV a changé. */
 const jour2=navigateur(local,{7:{hash:'cccccccc',detail:DETAIL({jquery:'3.7.1'})}});await jour2.connecter(7);
 const c=stored(jour2.b,'contrat-esv').at(-1);
 assert.equal(c.precedent,null,'l\'onglet n\'a pas d\'empreinte propre');assert.equal(c.change,false,'pas de changement « de l\'onglet »');
 assert.deepEqual(c.dernierConnu,{hash:'aaaaaaaa',different:true,changements:['jquery']},'consigné : différente de la dernière connue');
 assert.equal(stored(jour2.b,'avis-contrat-esv').length,0,'aucun avis bloquant');
 assert.equal(JSON.parse(JSON.stringify(await jour2.b.api('view'))).avisContrat,undefined);
 assert.equal(local.m.banane50ContratDernier.hash,'cccccccc','la dernière connue est mise à jour');
});

test('même empreinte que la dernière connue : consigné « identique » ; un onglet qui a la sienne garde la règle par onglet',async()=>{
 const local=memoire();
 await navigateur(local,{1:{hash:'aaaaaaaa',detail:DETAIL()}}).connecter(1);
 const n=navigateur(local,{1:{hash:'aaaaaaaa',detail:DETAIL()},2:{hash:'bbbbbbbb',detail:DETAIL({potree:'1.9'})}});
 await n.connecter(1);
 assert.deepEqual(stored(n.b,'contrat-esv').at(-1).dernierConnu,{hash:'aaaaaaaa',different:false,changements:[]});
 /* L'onglet 1 a maintenant son empreinte : la comparaison par onglet seule s'applique, sans champ « dernière connue ». */
 await n.connecter(1);assert.equal(stored(n.b,'contrat-esv').at(-1).dernierConnu,undefined);assert.equal(stored(n.b,'contrat-esv').at(-1).precedent,'aaaaaaaa');
 /* Un second onglet, nouveau, dans un autre état : consigné différent de la dernière connue (celle de l'onglet 1), pas d'avis. */
 await n.connecter(2);const c=stored(n.b,'contrat-esv').at(-1);
 assert.deepEqual([c.precedent,c.change,c.dernierConnu.hash,c.dernierConnu.different],[null,false,'aaaaaaaa',true]);
 assert.equal(stored(n.b,'avis-contrat-esv').length,0);
});

test('une dernière connue illisible ou d\'une autre forme est ignorée, sans erreur',async()=>{
 const local=memoire();await local.set({banane50ContratDernier:'n\'importe quoi'});
 const n=navigateur(local,{1:{hash:'aaaaaaaa',detail:DETAIL()}});await n.connecter(1);
 const c=stored(n.b,'contrat-esv').at(-1);assert.equal(c.dernierConnu,null);assert.equal(local.m.banane50ContratDernier.hash,'aaaaaaaa');
 assert.deepEqual(n.b.commands.filter(x=>!['ping','state','nativeSnapshot'].includes(x.action)),[],'lecture seule');
});
