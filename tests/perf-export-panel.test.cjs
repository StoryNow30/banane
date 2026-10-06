'use strict';
/* V1, correction proposée (1) : cohérence de l'export du panneau (diagnostic
 * partie 23). Le panneau lisait `events`/`records` dans IndexedDB en même temps
 * que le service worker ajoutait sa dernière santé V1 (`…-meta` → flush) :
 * métadonnée et événements venaient de deux instants. Ici : les VRAIES
 * fonctions d'export du panneau (panel.js) chargées dans une VM, la vraie API
 * du service worker (background.js, ESV simulé) et un stockage dont `all`
 * rend un INSTANTANÉ au moment de l'appel, comme `getAll` d'IndexedDB.
 * Aucune commande ESV, aucune écriture métier : on ne lit que le journal. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {production,normalize}=require('./helpers/perf-production.cjs'),{measure}=require('../tools/perf-phases.cjs');
const SOURCE=fs.readFileSync(path.join(__dirname,'../panel.js'),'utf8');
const START=SOURCE.indexOf('async function lireStore('),END=SOURCE.indexOf("on('gcv1-diagnostic-export'");
assert.ok(START>0&&END>START,'fonctions d’export du panneau introuvables');
const PANEL=SOURCE.slice(START,END);

/* Panneau réel + service worker réel. `readStore` règle ce que voit le panneau. */
function panneau(b,{readStore}={}){
 const sorties=[],statuts=[],snapshot=n=>structuredClone(b.store[n]);
 const magasin=readStore||{all:async n=>snapshot(n)};
 const ctx={api:b.api,store:()=>magasin,Blob,Date,globalThis:{},
  saveBlob:async(blob,name)=>{sorties.push({name,document:JSON.parse(await blob.text())});return {name,confirme:true,etat:'complete'};},
  nonEnregistres:()=>[],direFichiers:()=>'',statutExport:(t,erreur)=>statuts.push({t,erreur:!!erreur})};
 vm.createContext(ctx);vm.runInContext(PANEL,ctx,{filename:'panel.js(export)'});
 return {bilan:()=>vm.runInContext('bilanPilote()',ctx),journal:async()=>{await vm.runInContext('exporterJournal()',ctx);return sorties.at(-1).document;},statuts};
}
async function lotFerme(options={}){
 const b=production();await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 const e=b.get('engine'),r=b.get('timing');if(options.budget)r.flushTimeoutMs=options.budget;
 e.s.batch={id:'lot-1',state:'STOPPED',scope:{part:23,start:100,end:101}};r.syncBatch(true);r.ensureVisit(b.adapter.identity);r.batch.closed=true;
 await Promise.allSettled([...r.pending]);return b;
}
const sante=(doc,batchId)=>doc.events.filter(e=>e.type==='phase-timing'&&e.kind==='health'&&(!batchId||e.batchId===batchId));
const annoncee=(doc,i=0)=>doc.v1TimingExport.lots[i].healthSeq;
const presente=(doc,i=0)=>doc.events.some(e=>e.kind==='health'&&e.batchSeq===annoncee(doc,i)&&e.batchId===doc.v1TimingExport.lots[i].batchId);

test('bilan et journal : la santé annoncée par la métadonnée est dans les événements du même fichier',async()=>{
 const b=await lotFerme(),p=panneau(b),commands=normalize(b.commands),records=normalize(b.store.records);
 const bilan=await p.bilan();assert.equal(bilan.v1TimingExport.lots[0].complete,true);
 assert.equal(presente(bilan),true,'la santé annoncée doit figurer dans les événements du bilan');
 const journal=await p.journal();assert.equal(presente(journal),true,'idem pour le journal');
 assert.deepEqual(measure(journal,{tous:true}).lots[0].coverage.exportTiming.complete,true);
 assert.equal(bilan.v1TimingExport.snapshot.coherent,true);assert.equal(journal.v1TimingExport.snapshot.coherent,true);
 // Passif : aucune commande ESV de plus, rien d'écrit côté métier, budget 250 ms intact.
 assert.deepEqual(normalize(b.commands),commands);assert.deepEqual(normalize(b.store.records),records);
 assert.equal(b.get('timing').flushTimeoutMs,250);assert.equal(b.get('timing').flushWaiters.size,0);
});
test('exports répétés : chaque fichier cohérent avec sa propre métadonnée',async()=>{
 const b=await lotFerme(),p=panneau(b),seqs=[];
 for(let i=0;i<3;i++){const doc=i%2?await p.journal():await p.bilan();assert.equal(presente(doc),true,'export '+i);seqs.push(annoncee(doc));}
 assert.ok(seqs[0]<seqs[1]&&seqs[1]<seqs[2],'une santé neuve par export, toutes présentes : '+seqs);
});
test('instantané en retard : santé annoncée absente = export déclaré incomplet, rien de supprimé ni inventé',async()=>{
 const b=await lotFerme(),commands=normalize(b.commands);
 // Stockage qui ne montre pas la dernière santé (transaction plus ancienne que la métadonnée).
 const enRetard={all:async n=>{const x=structuredClone(b.store[n]);return n==='events'?x.filter(e=>!(e.kind==='health'&&e.batchSeq===Math.max(...b.store.events.filter(h=>h.kind==='health').map(h=>h.batchSeq)))):x;}};
 const p=panneau(b,{readStore:enRetard}),bilan=await p.bilan(),t=bilan.v1TimingExport;
 assert.equal(presente(bilan),false);assert.equal(t.status,'snapshot-incomplete');assert.equal(t.flushComplete,false);assert.equal(t.lots[0].complete,false);
 assert.deepEqual([t.snapshot.coherent,t.snapshot.missing.length,t.snapshot.missing[0].healthSeq],[false,1,annoncee(bilan)]);
 assert.equal(measure(bilan,{tous:true}).lots[0].coverage.exportTiming.complete,false);
 const journal=await p.journal();assert.equal(journal.v1TimingExport.snapshot.coherent,false);
 assert.ok(p.statuts.some(s=>s.erreur&&/mesure V1 est incompl/i.test(s.t)),'le panneau le dit à l’opérateur : '+JSON.stringify(p.statuts));
 assert.equal(journal.events.length,b.store.events.length-1,'tout ce qui a été lu est conservé (seule la santé masquée manque)');assert.deepEqual(normalize(b.commands),commands);
});
test('écriture de mesure bloquée (budget 250 ms, ici 25) : incomplet déclaré, mesures toujours pendantes',async()=>{
 const b=await lotFerme({budget:25}),put=b.store.putEvent.bind(b.store);b.store.putEvent=x=>x.type==='phase-timing'?new Promise(()=>{}):put(x);
 const r=b.get('timing');r.point('test');const pending=r.pending.size,p=panneau(b),bilan=await p.bilan(),t=bilan.v1TimingExport;
 assert.equal(t.status,'timeout');assert.equal(t.lots[0].complete,false);assert.equal(t.lots[0].healthStored,false);assert.ok(t.pendingWrites>0);
 assert.equal(r.pending.size>=pending,true,'rien n’est jeté');assert.equal(measure(bilan,{tous:true}).lots[0].coverage.exportTiming.complete,false);
});
test('santé rejetée par le stockage : perte déclarée, jamais présentée comme stockée',async()=>{
 const b=await lotFerme(),put=b.store.putEvent.bind(b.store);b.store.putEvent=x=>x.kind==='health'?Promise.reject(Error('disque')):put(x);
 const doc=await panneau(b).journal(),t=doc.v1TimingExport;
 assert.notEqual(t.status,'flushed');assert.equal(t.lots[0].complete,false);assert.equal(t.lots[0].healthStored,false);assert.equal(t.lots[0].healthState,'rejected');
 assert.equal(sante(doc).filter(e=>e.batchSeq===annoncee(doc)).length,0);
});
test('stockage direct illisible : repli sur l’API du service worker, même contrôle',async()=>{
 const b=await lotFerme(),illisible={all:async()=>{throw Error('IndexedDB indisponible');}},p=panneau(b,{readStore:illisible});
 const bilan=await p.bilan(),journal=await p.journal();
 for(const doc of [bilan,journal]){assert.equal(presente(doc),true);assert.equal(doc.v1TimingExport.lots[0].complete,true);}
});
test('deux lots dont un rouvert : la preuve du second ne rend pas le premier complet',async()=>{
 const b=await lotFerme(),e=b.get('engine'),r=b.get('timing');
 r.batch.closed=false;                      // premier lot rouvert, sans fin connue
 e.s.batch={id:'lot-2',state:'STOPPED',scope:{part:23,start:102,end:103}};r.syncBatch(true);r.ensureVisit({...b.adapter.identity,cut:102});r.batch.closed=true;
 await Promise.allSettled([...r.pending]);
 const doc=await panneau(b).bilan(),rows=Object.fromEntries(doc.v1TimingExport.lots.map(l=>[l.batchId,l]));
 assert.equal(rows['lot-1'].complete,false);assert.equal(rows['lot-2'].complete,true);
 assert.equal(doc.v1TimingExport.snapshot.coherent,true);
 for(const [i] of doc.v1TimingExport.lots.entries())assert.equal(presente(doc,i),true);
 for(const l of measure(doc,{tous:true}).lots)assert.equal(l.coverage.exportTiming.complete,l.batchId==='lot-2');
});
test('gros journal : l’instantané lu une seule fois reste celui dont la santé est vérifiée',async()=>{
 const b=await lotFerme(),r=b.get('timing');
 for(let k=0;k<8;k++){for(let i=0;i<400;i++)r.point('synthetic',{n:k*400+i});await Promise.allSettled([...r.pending]);}   // file bornée à 512 écritures : par paquets
 const p=panneau(b),doc=await p.journal();
 assert.ok(doc.events.length>3000);assert.equal(presente(doc),true);assert.equal(doc.v1TimingExport.snapshot.coherent,true);
 assert.equal(doc.events.filter(e=>e.kind==='health'&&e.batchSeq===annoncee(doc)).length,1);
});
