'use strict';
/* V5 (D-089) : la sauvegarde de l'état ne doit pas grossir avec l'historique.
 *
 * Mesure dans un vrai Chromium (13 octobre) : `chrome.storage.local.set` coûte environ 50 ms par Mo,
 * et l'état était réécrit en entier à chaque événement (une trentaine par cut). Il gardait toutes les
 * visites depuis le début de la session, MÊME après « Vider le cache des exports » : 235 visites font
 * déjà 1,6 Mo, soit environ 120 ms par sauvegarde ; après quelques lots, plusieurs secondes par cut.
 * Constat terrain de Mic : « au bout de quelques lots, Ariane devenait affreusement long à poser ».
 *
 * Désormais les visites (records) et captures abandonnées (incomplete), déjà écrites une à une dans
 * IndexedDB, ne sont plus recopiées dans l'état sauvegardé : seuls leurs identifiants le sont, dans
 * l'ordre, et le moteur les relit au redémarrage. Les événements d'information (étapes de la page,
 * diagnostics du pont), déjà écrits dans IndexedDB, ne déclenchent plus de sauvegarde. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {Engine}=require('../src/engine.js'),{MemoryStore,SimulatedESV,K}=require('./fixtures.cjs');

async function app(store=new MemoryStore()){const adapter=new SimulatedESV(),engine=new Engine(adapter,store);await engine.init();return {adapter,store,engine};}
const visite=i=>({recordId:'rec-'+i,identity:{pageId:'p',part:23,cut:100+i,shape:'U50',frameId:'f',projectId:null},rails:{left:{m:Array.from({length:16},(_,k)=>k+i/7)},right:{m:Array.from({length:16},(_,k)=>k-i/3)}},
 proposal:{rails:{left:{delta:[i,1,2]},right:{delta:[2,1,i]}}},status:'validated',notes:'x'.repeat(3000)});
async function avecVisites(n,store){const a=await app(store);for(let i=0;i<n;i++){const r=visite(i);await a.store.putRecord(r);a.engine.s.records.push(r);}await a.engine.save();return a;}
const taille=s=>Buffer.byteLength(JSON.stringify(s));

test('la sauvegarde garde une taille constante, quel que soit le nombre de visites',async()=>{
 const zero=await avecVisites(0),mille=await avecVisites(1000);
 const t0=taille(zero.store.state),t1=taille(mille.store.state);
 assert.ok(t1-t0<1000*40,`état sauvegardé : ${t0} octets sans visite, ${t1} avec 1 000 visites`);
 assert.deepEqual([mille.store.state.records,mille.store.state.incomplete],[[],[]],'ni visites ni captures abandonnées recopiées');
 assert.equal(mille.store.state.recordIds.length,1000);assert.equal(mille.engine.s.records.length,1000,'le moteur les garde en mémoire');
});

test('redémarrage : les visites sont relues dans IndexedDB, dans le même ordre, avec leurs dernières modifications',async()=>{
 const a=await avecVisites(30);
 /* Une visite modifiée après coup (validation) est réécrite dans IndexedDB, comme le fait le moteur. */
 const r=a.engine.s.records[7];Object.assign(r,{status:'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED',commandSent:true});await a.store.putRecord(r);
 const item={id:'abandon-1',status:'incomplete-no-after',identity:{pageId:'p',part:23,cut:9}};await a.store.putRecord(item);a.engine.s.incomplete.push(item);await a.engine.save();
 const b=await app(a.store);
 assert.deepEqual(b.engine.s.records.map(x=>x.recordId),a.engine.s.records.map(x=>x.recordId));
 assert.equal(b.engine.s.records[7].status,'AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED');assert.equal(b.engine.s.records[7].commandSent,true);
 assert.deepEqual(b.engine.s.incomplete.map(x=>x.id),['abandon-1']);
 assert.ok(!('recordIds' in b.engine.s)&&!('incompleteIds' in b.engine.s),'les identifiants ne restent pas dans l\'état en mémoire');
});

test('ancien format (visites recopiées dans l\'état, même vidées) : seules les visites encore dans IndexedDB restent, puis nouveau format',async()=>{
 const store=new MemoryStore(),anciennes=[visite(0),visite(1),visite(2)];
 /* rec-0 a été vidé après export : la 4.9.0.7 le gardait dans l'état, pas dans IndexedDB. */
 for(const r of anciennes.slice(1))await store.putRecord(r);
 store.state={schemaVersion:4,version:'4.9.0.7',sessionId:'s',mode:'observation',collection:'IDLE',records:anciennes,incomplete:[],events:[],batch:null};
 const a=await app(store);assert.deepEqual(a.engine.s.records.map(r=>r.recordId),['rec-1','rec-2']);assert.equal(a.engine.s.recordsAbsentsAuRedemarrage,0);
 await a.engine.save();assert.deepEqual(store.state.recordIds,['rec-1','rec-2']);assert.deepEqual(store.state.records,[]);
 assert.deepEqual(store.records.map(r=>r.recordId).sort(),['rec-1','rec-2'],'rien de vidé ne revient dans le cache des exports');
 assert.deepEqual(store.archive.map(r=>r.recordId),['rec-0'],'la visite vidée est archivée une fois, hors de l\'état');assert.equal(a.engine.s.visitesArchivees,1);
 const b=await app(store);assert.deepEqual(b.engine.s.records.map(r=>r.recordId),['rec-1','rec-2']);
});

test('visite absente d\'IndexedDB (vidée après export) : retirée au redémarrage et comptée ; visite sans identifiant : gardée dans l\'état',async()=>{
 const a=await avecVisites(3);const sansId={identity:{pageId:'p',part:23,cut:1},status:'x'};a.engine.s.records.push(sansId);await a.engine.save();
 a.store.records=a.store.records.filter(r=>r.recordId!=='rec-1');
 const b=await app(a.store);
 assert.deepEqual(b.engine.s.records.map(r=>r.recordId??'sans-id'),['rec-0','rec-2','sans-id']);
 assert.equal(b.engine.s.recordsAbsentsAuRedemarrage,1);
});

test('événements d\'information : écrits dans le journal, sans réécrire l\'état ; les autres sauvegardent toujours',async()=>{
 const a=await app();let ecritures=0;a.store.onSetState=()=>{ecritures++;};
 await a.engine.event('adapter-progress',{requestId:'r',action:'capture',lastStage:'capture-wait'});
 await a.engine.event('adapter-result',{requestId:'r',action:'capture',error:null});
 assert.equal(ecritures,0);assert.equal(a.store.events.length,2);assert.equal(a.engine.s.events.length,2,'gardés en mémoire');
 await a.engine.event('validation-accepted',{identity:{pageId:'p',part:23,cut:100}});
 assert.equal(ecritures,1);assert.deepEqual(a.store.state.events.map(e=>e.type),['adapter-progress','adapter-result','validation-accepted'],'emportés par la sauvegarde suivante');
});

test('visite pas encore confirmée dans IndexedDB (écriture échouée) : recopiée dans l\'état, rien n\'est perdu au redémarrage',async()=>{
 const a=await app();const r=visite(5);a.engine.s.records.push(r);await a.engine.save();
 assert.equal(typeof a.store.state.recordIds[0],'object','recopiée');
 const b=await app(a.store);assert.deepEqual(b.engine.s.records.map(x=>x.recordId),['rec-5']);
 await b.store.putRecord(b.engine.s.records[0]);await b.engine.save();assert.equal(b.store.state.recordIds[0],'rec-5','confirmée ensuite : identifiant seul');
});

test('ancien format sans archive possible : les visites absentes d\'IndexedDB restent dans l\'état, comme avant',async()=>{
 const store=new MemoryStore();store.archiverVisites=async()=>{throw Error('quota');};
 store.state={schemaVersion:4,version:'4.9.0.7',sessionId:'s',mode:'observation',collection:'IDLE',records:[visite(0)],incomplete:[],events:[],batch:null};
 const a=await app(store);assert.deepEqual(a.engine.s.records.map(r=>r.recordId),['rec-0']);await a.engine.save();assert.equal(typeof store.state.recordIds[0],'object');
});

/* Relecture indépendante de V5 (13 octobre) : pannes d'IndexedDB et retour arrière. */
test('IndexedDB illisible au démarrage : rien n\'est retiré de l\'état ; une sauvegarde de secours réécrit les listes telles quelles',async()=>{
 const a=await avecVisites(2);const r=visite(9);a.engine.s.records.push(r);await a.engine.save();
 const avant=JSON.parse(JSON.stringify(a.store.state.recordIds));
 /* KI-070 : le magasin de panne écrit dans l'état du vrai magasin (un `Object.create` écrivait sur l'objet dérivé : l'essai ne prouvait rien). */
 const panne={getState:()=>a.store.getState(),setState:s=>a.store.setState(s),all:async()=>{throw Error('IndexedDB illisible');},putRecord:r=>a.store.putRecord(r)};
 const e=new Engine(new SimulatedESV(),panne);await assert.rejects(e.init(),/IndexedDB illisible/);
 const etatCharge=JSON.parse(JSON.stringify(a.store.state));await e.save();assert.notEqual(a.store.state,etatCharge,'la sauvegarde de secours a bien écrit');
 assert.deepEqual(a.store.state.recordIds,avant,'le gestionnaire d\'erreur du service worker sauvegarde : identifiants et entrée recopiée gardés');
 const b=await app(a.store);assert.deepEqual(b.engine.s.records.map(x=>x.recordId),['rec-0','rec-1','rec-9']);
});

test('réécriture IndexedDB échouée après une première réussie : la version modifiée reste recopiée et survit au redémarrage',async()=>{
 const a=await avecVisites(1);const r=a.engine.s.records[0];
 Object.assign(r,{commandSent:true,status:'validated-after-change'});
 /* L'écriture sous-jacente échoue ; l'enveloppe du moteur reste en place. */
 a.store.panneEcriture='quota';await assert.rejects(a.store.putRecord(r),/quota/);a.store.panneEcriture=null;
 await a.engine.save();assert.equal(typeof a.store.state.recordIds[0],'object');
 const b=await app(a.store);assert.equal(b.engine.s.records[0].commandSent,true);assert.equal(b.engine.s.records[0].status,'validated-after-change');
 const c=await app(a.store);assert.equal(c.engine.s.records[0].commandSent,true,'toujours la version modifiée au second redémarrage');
});

test('retour arrière : l\'état sauvegardé garde des listes vides lisibles par une version antérieure ; ses ajouts sont repris à la remise à jour',async()=>{
 const a=await avecVisites(2);
 assert.deepEqual([a.store.state.records,a.store.state.incomplete],[[],[]]);
 /* Une version antérieure relit l'état, ajoute une visite à `records` (et dans IndexedDB), sauvegarde tout. */
 const ancien=K.clone(a.store.state),v=visite(7);ancien.records.push(v);await a.store.putRecord(v);a.store.state=ancien;
 const b=await app(a.store);assert.deepEqual(b.engine.s.records.map(x=>x.recordId),['rec-0','rec-1','rec-7']);
});

test('archive sans doublon quand un démarrage interrompu recommence la migration',async()=>{
 const store=new MemoryStore();const ancien={schemaVersion:4,version:'4.9.0.7',sessionId:'s',mode:'observation',collection:'IDLE',records:[visite(0)],incomplete:[],events:[],batch:null};
 store.state=K.clone(ancien);await app(store);store.state=K.clone(ancien);await app(store);
 assert.deepEqual(store.archive.map(r=>r.recordId),['rec-0']);
});

test('ancien format relu de chrome.storage (clés triées) : une visite identique à IndexedDB est confirmée malgré l\'ordre des clés',async()=>{
 const store=new MemoryStore(),r=visite(1);await store.putRecord(r);
 const trie=x=>Array.isArray(x)?x.map(trie):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,trie(x[k])])):x;
 store.state={schemaVersion:4,version:'4.9.0.7',sessionId:'s',mode:'observation',collection:'IDLE',records:[trie(r)],incomplete:[],events:[],batch:null};
 const a=await app(store);await a.engine.save();assert.deepEqual(store.state.recordIds,['rec-1']);
});
