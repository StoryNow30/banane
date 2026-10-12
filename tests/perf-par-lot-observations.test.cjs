'use strict';
/* F3 (relecture du test 3) : en mode `perf-lot --par-lot`, toMarkdown(m,{batchId}) ne filtrait que l'attribution ; la
 * section « Observateur passif » gardait les écritures de TOUT le fichier sans le dire (lot de la partie 10 annonçant les
 * 473 écritures des 4 lots). Les écritures sont maintenant filtrées par lot, et la section dit que les autres comptes
 * portent sur tout le fichier. Données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const V1=require('../tools/perf-phases.cjs'),{journal}=require('./helpers/perf-phases.cjs'),PL=require('../tools/perf-lot.cjs');
const write=(batchId,t,id)=>({type:'esv-observation',schema:1,eventId:id,kind:'write',timeOrigin:1000,ms:t-1000,sessionId:'S',batchId,observer:{id:'obs-1',seq:1},
 status:204,outcome:'done',attempt:1,railPairId:'r-'+batchId,bodyKeys:1,body:{a:1},startedEpochMs:t,endedEpochMs:t+100,durationMs:100});
function deuxLots(){const a=journal(),b=journal();
 const c=b.events.map(e=>({...e,eventId:'C'+e.eventId,batchId:'C',visitId:e.visitId?'visitC':e.visitId,ms:e.ms+10000,...(Number.isFinite(e.fromMs)?{fromMs:e.fromMs+10000,toMs:e.toMs+10000}:{}),...(Number.isFinite(e.navigationMs)?{navigationMs:e.navigationMs+10000}:{})}));
 return {...a,events:[...a.events,...c,write('B',1000+400,'wB'),write('C',1000+10400,'wC1'),write('C',1000+10500,'wC2')]};}
test('par lot : écritures du lot seulement, section titrée ; ensemble : toutes les écritures',()=>{
 const m=V1.measure(deuxLots(),{tous:true});assert.equal(m.lots.length,2);assert.equal(m.observations.writes.n,3);
 const tout=V1.toMarkdown(m,{coupes:false}),lotB=V1.toMarkdown(m,{coupes:false,batchId:'B'}),lotC=V1.toMarkdown(m,{coupes:false,batchId:'C'});
 assert.match(tout,/Écritures : 3 dont 3 acquittée/);
 assert.match(lotB,/Écritures : 1 dont 1 acquittée/,'lot B : sa seule écriture');assert.doesNotMatch(lotB,/r-C/,'aucune écriture de C dans le rapport de B');
 assert.match(lotC,/Écritures : 2 dont 2 acquittée/);assert.doesNotMatch(lotC,/\| r-B \|/);
 assert.match(lotB,/## Observateur passif \(journalisation seule\) — lot B/);
 assert.match(lotB,/autres comptes .*tout le fichier/,'ce qui n’est pas filtré est dit');
});
test('perf-lot --par-lot : chaque fichier de lot ne liste que ses écritures',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ariane-parlot-'));
 try{const f=path.join(dir,'j.json');const j=deuxLots();j.events.forEach(e=>{e.timestamp=new Date(1.79e12+e.ms).toISOString();});fs.writeFileSync(f,JSON.stringify(j));const out=path.join(dir,'lots');
  const md=path.join(dir,'tout.md');PL.run([f,'--tous','--par-lot',out,'--md',md]);
  assert.match(fs.readFileSync(path.join(out,'lot-B.md'),'utf8'),/Écritures : 1 dont 1/);
  assert.match(fs.readFileSync(path.join(out,'lot-C.md'),'utf8'),/Écritures : 2 dont 2/);
  assert.match(fs.readFileSync(md,'utf8'),/Écritures : 3 dont 3/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
