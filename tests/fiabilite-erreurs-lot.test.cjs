'use strict';
/* H16 (audit P-5 des lots de la test 6, C5) — CHAQUE ERREUR PORTE LE LOT ET L'HEURE DE SA DEMANDE.
 *
 * Constat : un `cancel` dont l'attente de 45 005 ms a expiré en plein lot L3 était rangé sur un cut de L3 (identité du moment de la réponse),
 * alors qu'il avait été demandé environ 22,5 s avant le départ de L3 ; et les deux `batch-error` de L2 n'avaient pas de `batchId`. Une lecture
 * automatique des lots les rangeait donc au mauvais lot, ou à aucun.
 * Règle : `adapter-result` porte le lot ouvert à la DEMANDE de la commande (`batchId`), l'heure de la demande (`demandeA`) et l'identité du
 * moment de la demande ; `batch-error` porte le lot qui passe en erreur (`batchId`) et, quand l'erreur vient d'une commande à ESV, l'heure de
 * sa demande (`demandeA`) et son nom (`commande`). Journal seulement : la commande envoyée est identique (vérifié ici, et dans
 * tests/fiabilite-lot-commandes.test.cjs). ESV simulé, données fabriquées. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,L}=require('./helpers/esv-lent.cjs');
const COUPE='Could not establish connection. Receiving end does not exist.';
const MUET='Adaptateur ESV sans réponse. Clique sur Connecter ; après une mise à jour, recharge ESV.';
const plat=x=>JSON.parse(JSON.stringify(x));
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
const fin=async b=>{let v;for(let i=0;i<400&&((v=await b.api('view')).busy||v.batch?.state==='RUNNING');i++)await attendre(5);return v;};

/* L2 : lot 100–103, la page ESV disparaît pendant la capture du cut 101 (F5 de l'opérateur, ou ESV qui quitte la partie). */
async function lotEnPause(){
 const r=await pilote(L,{start:100,end:103,esv:esv=>{const capture=esv.capture.bind(esv);
  esv.capture=async(...a)=>{if(esv.identity.cut===101)throw Error(COUPE);return capture(...a);};}});
 const vue=await fin(r.b);return {...r,vue};
}

test('batch-error : le lot qui passe en erreur, l\'heure de la demande de la commande en cause et son nom',async()=>{
 const {b,vue}=await lotEnPause();
 assert.equal(vue.batch.state,'PAUSED_ADAPTER_UNRESPONSIVE');
 const erreurs=b.store.events.filter(e=>e.type==='batch-error').map(plat);
 assert.equal(erreurs.length,1);const e=erreurs[0];
 assert.equal(e.batchId,vue.batch.id,'le lot');
 assert.equal(e.commande,'capture');
 assert.match(String(e.demandeA),/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/,'heure de la demande');
 assert.ok(Date.parse(e.demandeA)<=Date.parse(e.timestamp)&&Date.parse(e.demandeA)>=Date.parse(vue.batch.startedAt),'demandée pendant le lot, avant l\'erreur');
 assert.equal(e.identity.cut,101);
});

test('adapter-result en retard : rangé au lot et à l\'heure de sa DEMANDE, pas au lot qui tourne quand la réponse arrive',async()=>{
 const {b,vue}=await lotEnPause();const lotL2=vue.batch.id,e=b.fonction('engine');
 /* Un `cancel` demandé pendant la pause de L2 ; la page ne répond qu'après le départ de L3 (attente expirée côté page). */
 const envoi=b.ctx.chrome.tabs.sendMessage;let repondre,envoye=null;
 b.ctx.chrome.tabs.sendMessage=async(id,m)=>{if(m.action!=='cancel')return envoi(id,m);envoye=m;return new Promise(r=>{repondre=r;});};
 const avant=Date.now(),demande=b.fonction('call')('cancel').catch(x=>x);await attendre(5);const apres=Date.now();
 assert.deepEqual(plat([envoye.kind,envoye.action,envoye.args]),['page-command','cancel',[]],'la commande part telle quelle');
 await attendre(30);
 /* L3 démarre sur une autre partie, sur un autre cut. */
 e.s.batch={...e.s.batch,id:'lot-L3',state:'RUNNING',startedAt:new Date().toISOString(),scope:{...e.s.batch.scope,part:24,start:40,end:60}};
 e.s.current={...e.s.current,identity:{...e.s.current.identity,part:24,cut:51}};e.s.before={...e.s.before,identity:{...e.s.before.identity,part:24,cut:51}};
 repondre({error:MUET,diagnostic:{requestId:'r-cancel',action:'cancel',elapsedMs:45005,acknowledged:false,lastStage:'sent',lastDetail:null}});
 const err=await demande;assert.match(String(err?.message),/sans réponse/);
 const r=plat(b.store.events.filter(x=>x.type==='adapter-result'&&x.action==='cancel').at(-1));
 assert.equal(r.error,MUET);assert.equal(r.elapsedMs,45005);
 assert.equal(r.batchId,lotL2,'le lot ouvert à la demande (L2), pas L3');
 assert.ok(Date.parse(r.demandeA)>=avant-1&&Date.parse(r.demandeA)<=apres,'l\'heure de la demande, avant le départ de L3');
 assert.deepEqual([r.identity.part,r.identity.cut],[23,101],'l\'identité du moment de la demande, pas le cut de L3');
});

test('une commande qui réussit porte aussi son lot et l\'heure de sa demande ; la commande envoyée ne change pas',async()=>{
 const {b,vue}=await lotEnPause();const envoi=b.ctx.chrome.tabs.sendMessage,envoyes=[];
 b.ctx.chrome.tabs.sendMessage=async(id,m)=>{if(m.action!=='restore')return envoi(id,m);envoyes.push(m);return {result:{ok:true},diagnostic:{requestId:'r-ok',action:'restore',elapsedMs:12,acknowledged:true,lastStage:'done',lastDetail:null}};};
 await b.fonction('call')('restore',{essai:1});
 assert.deepEqual(plat(envoyes),[{kind:'page-command',action:'restore',args:[{essai:1}]}],'message à la page inchangé (sans trace de mesure dans ce banc)');
 const r=plat(b.store.events.filter(x=>x.type==='adapter-result'&&x.action==='restore').at(-1));
 assert.equal(r.batchId,vue.batch.id);assert.equal(r.error,null);assert.match(String(r.demandeA),/Z$/);
});

/* ---------- analyse automatique des lots (tools/perf-lot.cjs) : une erreur qui porte son lot y est rangée ---------- */
const {measure}=require('../tools/perf-lot.cjs');
function journalDeuxLots(){const t=s=>new Date(Date.UTC(2026,9,17,8,0,0)+s*1000).toISOString(),id=(part,cut)=>({part,cut}),lot=(b,part)=>({id:b,scope:{part,start:0}});
 const ev=[{type:'batch-started',timestamp:t(0),batch:lot('L2',8)},{type:'cut-target-changed',timestamp:t(1),identity:id(8,90)},
  {type:'batch-error',timestamp:t(5),identity:id(8,91),message:'Adaptateur ESV sans réponse : page ESV rechargée ou fermée (essai).',step:'capture',batchId:'L2',demandeA:t(4.2),commande:'capture'},
  {type:'batch-state',timestamp:t(5),state:'PAUSED_ADAPTER_UNRESPONSIVE'},
  {type:'batch-started',timestamp:t(30),batch:lot('L3',9)},{type:'cut-target-changed',timestamp:t(31),identity:id(9,40)},{type:'cut-target-changed',timestamp:t(40),identity:id(9,41)},
  /* Réponse en retard d'un `cancel` demandé pendant la pause de L2 (attente de 45 s expirée), arrivée en plein L3. */
  {type:'adapter-result',timestamp:t(53),identity:id(8,91),action:'cancel',elapsedMs:45005,error:'Adaptateur ESV sans réponse.',batchId:'L2',demandeA:t(8)},
  {type:'cut-target-changed',timestamp:t(55),identity:id(9,42)}];
 return {format:'banane-test-journal-v4',version:'4.9.5.6',state:{batch:{id:'L3',state:'STOPPED',scope:{part:9}}},events:ev};}

test('perf-lot : l\'erreur en retard reste au lot de sa demande (L2), avec l\'heure de la demande ; L3 n\'en a aucune',()=>{
 const tous=measure(journalDeuxLots(),{tous:true});
 assert.deepEqual(tous.lots.map(l=>[l.lot,l.erreurs,l.erreursDeLot]),[['L2',1,1],['L3',0,0]]);
 const seulL3=measure(journalDeuxLots());assert.equal(seulL3.source.lot,'L3');assert.deepEqual(Object.keys(seulL3.erreurs),[],'le lot exporté L3 ne reçoit pas l\'erreur de L2');
 assert.deepEqual(plat(tous.erreurs.cancel),[{cut:91,at:'2026-10-17T08:00:53.000Z',message:'Adaptateur ESV sans réponse.',demandeA:'2026-10-17T08:00:08.000Z',lot:'L2'}]);
});
