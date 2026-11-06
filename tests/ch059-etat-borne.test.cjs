'use strict';
/* CH-059 — L'ÉTAT SAUVEGARDÉ GARDE UNE TAILLE BORNÉE, QUELLE QUE SOIT LA JOURNÉE.
 * Constat (06/11, ÉTABLI) : l'état réécrit à chaque événement passait de 0,39 Mo à 2,1 Mo dans la journée, surtout la session Écho
 * (`native.visits`, `cloudIds`, `exportState.exportedCloudIds`/`releasedCloudIds`, `observationPeriods`) ; environ 50 ms par Mo (D-089).
 * Une journée simulée : plusieurs parties, des centaines de visites Écho, des vidages d'export. L'octet écrit par sauvegarde ne doit pas
 * monter avec la journée ; l'état relu après redémarrage est identique à l'état en mémoire. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const J=require('./helpers/journee-etat.cjs');

async function journee(fc,{parties=3,visitesParPartie=80,vidageToutes=30}={}){const a=await J.ouvrir(fc);await a.sessions.start();
 const mesures=[];let total=0;
 for(let p=0;p<parties;p++)for(let i=0;i<visitesParPartie;i++){await J.visite(a,i,8+p);total++;
  if(total%vidageToutes===0)await J.vidage(a);
  if(total===20||total===parties*visitesParPartie)mesures.push({visites:total,octets:await J.octetsSauvegarde(a,fc),etat:J.tailleEtat(fc)});}
 return {a,mesures};}

test('journée simulée : l\'octet écrit par sauvegarde reste borné (début et fin de journée)',async()=>{
 const fc=J.fauxChrome(),{a,mesures}=await journee(fc);const [debut,fin]=mesures;
 assert.equal(a.engine.s.native.visits.length,240);assert.ok(a.engine.s.native.cloudIds.length>=900,'des milliers d\'identifiants de nuages');
 assert.ok(a.engine.s.native.exportState.releasedCloudIds.length>=800,'vidages faits');
 /* Borne : la fin de journée n'écrit pas plus de 40 Ko de plus que le début, et l'état lui-même ne grossit pas. */
 assert.ok(fin.octets-debut.octets<40_000,`octets écrits par sauvegarde : ${debut.octets} après ${debut.visites} visites, ${fin.octets} après ${fin.visites}`);
 assert.ok(fin.etat-debut.etat<20_000,`état écrit : ${debut.etat} puis ${fin.etat} octets`);
});

test('redémarrage du service worker en pleine session Écho : l\'état relu est celui de la mémoire, la session reprend sans perte',async()=>{
 const fc=J.fauxChrome(),{a}=await journee(fc,{parties:2,visitesParPartie:40,vidageToutes:25});
 await a.engine.save();const memoire=JSON.stringify(a.engine.s.native);
 const b=await J.ouvrir(fc,a.store.tables);
 const relu=b.engine.s.native;assert.equal(relu.status,'PAUSED','reprise après redémarrage : en pause, comme avant');
 assert.equal(relu.visits.length,80);assert.deepEqual(relu.cloudIds,JSON.parse(memoire).cloudIds);
 assert.deepEqual(relu.exportState,JSON.parse(memoire).exportState);assert.deepEqual(relu.visits,JSON.parse(memoire).visits);
 assert.ok(!('__morceaux' in relu),'la référence ne reste pas en mémoire');
 /* La session repart : nouvelle visite à la suite, index continu. */
 await b.sessions.resume();await J.visite(b,500,20);assert.equal(b.engine.s.native.visits.length,81);assert.equal(b.engine.s.native.visits.at(-1).visitIndex,80);
});

/* CH-058 (relais de l'intégrateur, PROBABLE) : une session Écho fermée reste dans l'état (FINISHED) ; un lot lancé ensuite réécrivait
 * toute la session à chacune de ses sauvegardes (8,3 par cut). Ici : Écho de 120 visites fermée, puis un lot de 200 cuts. */
test('lot après une Écho fermée : chaque sauvegarde du lot reste petite, la session fermée n\'est pas réécrite',async()=>{
 const fc=J.fauxChrome(),{a}=await journee(fc,{parties:2,visitesParPartie:60,vidageToutes:30});await a.sessions.close({dataset:false});assert.equal(a.engine.s.native.status,'FINISHED');
 a.engine.s.batch={id:'lot-apres-echo',state:'RUNNING',step:'capture',scope:{part:20},processed:[],skipped:[],paused:[],interrupted:[],sequence:[],deferred:[],startedAt:new Date().toISOString()};
 const octets=[];for(let c=0;c<200;c++){a.engine.s.batch.processed.push({key:`p/20/${c}`,identity:{pageId:'p',part:20,cut:c},cut:c,evidence:{commandSent:true,accepted:true}});
  a.engine.s.batch.sequence.push({cutId:`p/20/${c}`,sequenceIndex:c});if(c%20===0||c===199)octets.push(await J.octetsSauvegarde(a,fc));}
 assert.ok(Math.max(...octets)<20_000,`octets écrits par sauvegarde pendant le lot : ${octets.join(', ')}`);
 const b=await J.ouvrir(fc,a.store.tables);assert.equal(b.engine.s.native.visits.length,120,'la session fermée est relue entière');
 assert.equal(b.engine.s.batch.processed.length,200);
});
