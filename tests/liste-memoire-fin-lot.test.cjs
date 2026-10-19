'use strict';
/* D-211 (4.9.5 test 9) — « Cuts d'Ariane mémorisés » après la fin du lot. `listeNoterEcriture` (background.js) ne notait une écriture de validation dans la mémoire de la
 * liste d'ESV que si le lot était `RUNNING` : le dernier cut validé quelques dixièmes de seconde après le passage à `STOPPED`, et les corrections de la relecture « corriger »
 * (lot `STOPPED`), n'étaient jamais mémorisés (18 au lieu de 29 sur la partie 13 du projet 2, fiches/EXAMEN_2-13.md). Maintenant : lot en cours, OU fenêtre de grâce qui suit
 * la fin du lot (`dansGrace`), OU relecture en cours ; toujours avec la partie du lot ; jamais en Écho, jamais un lot clos depuis longtemps. Aucun effet sur la pose
 * (mémoire locale en lecture seule, aucune requête vers ESV). Service worker réel en VM, stockage en mémoire, données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {production,memoire}=require('./helpers/perf-production.cjs'),LM=require('../src/liste-memoire.js');
const TABLE='traj__synthetique',ID=i=>TABLE+'/RK-'+String(i).padStart(8,'0');
const EDGES=['XLeftEdge','YLeftEdge','ZLeftEdge','XRightEdge','YRightEdge','ZRightEdge'];
const corps=i=>({ExtractionStatus:'valid',TreatedByOperator:true,...Object.fromEntries(EDGES.map((k,j)=>[k,[700000+i,6600000,150,700000+i,6601.435+6600000,150][j]]))});
const ecriture=(i,o={})=>({kind:'write',status:204,rowIndex:i,railPairId:ID(i),body:corps(i),...o});
async function monter(batch,{passe=null,echo=false}={}){
 const local=memoire(),b=production({local});await b.api('connect',{tabId:1});
 const engine=b.get('engine');engine.s.batch=batch;if(passe)b.get('relecture').passe=passe;
 const noter=(i)=>{b.get('listeNoterEcriture')(ecriture(i),echo?'echo-1':undefined);};
 const memorises=async partie=>{for(let k=0;k<20;k++)await new Promise(r=>setImmediate(r));return (await LM.resume(local,partie)).memorises;};
 return {b,local,noter,memorises};
}
const lot=(state,extra={})=>({id:'L1',state,scope:{part:7},...extra});
const ilYa=ms=>new Date(Date.now()-ms).toISOString();

test('lot en cours : l\'écriture est mémorisée (comme avant)',async()=>{
 const m=await monter(lot('RUNNING'));m.noter(2);assert.equal(await m.memorises(7),1);
});
test('lot passé à STOPPED depuis 0,4 s (fenêtre de grâce) : le dernier cut validé est mémorisé, dans la partie du lot',async()=>{
 const m=await monter(lot('STOPPED',{stoppedAtEnd:{at:ilYa(400),cause:'dernier-cut'}}));m.noter(9);assert.equal(await m.memorises(7),1);assert.equal(await m.memorises(8),0);
});
test('lot clos depuis longtemps, sans relecture : rien n\'est mémorisé',async()=>{
 const m=await monter(lot('STOPPED',{stoppedAtEnd:{at:ilYa(600000),cause:'dernier-cut'}}));m.noter(9);assert.equal(await m.memorises(7),0);
 const n=await monter(lot('COMPLETED'));n.noter(9);assert.equal(await n.memorises(7),0,'lot clos sans heure de fin lisible : jamais deviné');
});
test('relecture « corriger » en cours (lot STOPPED depuis longtemps) : ses écritures sont mémorisées ; relecture finie, plus',async()=>{
 const clos=lot('STOPPED',{stoppedAtEnd:{at:ilYa(600000),cause:'dernier-cut'}});
 const m=await monter(clos,{passe:{etat:'en-cours',lotId:'L1'}});for(const i of [3,4,5])m.noter(i);assert.equal(await m.memorises(7),3);
 const f=await monter(clos,{passe:{etat:'finie',lotId:'L1'}});f.noter(3);assert.equal(await f.memorises(7),0);
 const p=await monter(clos,{passe:{etat:'preparation',lotId:'L1'}});p.noter(3);assert.equal(await p.memorises(7),0,'en préparation, la passe n\'écrit rien encore');
});
test('Écho, ou aucun lot : rien n\'est mémorisé ; une écriture refusée (4xx) non plus',async()=>{
 const e=await monter(lot('RUNNING'),{echo:true});e.noter(2);assert.equal(await e.memorises(7),0);
 const s=await monter(null);s.noter(2);assert.equal(await s.memorises(7),0);
 const r=await monter(lot('RUNNING'));r.b.get('listeNoterEcriture')(ecriture(2,{status:403}));assert.equal(await r.memorises(7),0);
});
test('sans effet sur la pose : le lot envoie les mêmes commandes, la mémoire n\'est qu\'un relevé local (aucune commande vers ESV, aucun message de plus)',async()=>{
 const m=await monter(lot('STOPPED',{stoppedAtEnd:{at:ilYa(400),cause:'dernier-cut'}}));const avant=m.b.commands.length;m.noter(9);await m.memorises(7);
 assert.equal(m.b.commands.length,avant,'rien n\'est envoyé à la page ESV');
});
