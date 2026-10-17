'use strict';
/* Test 7 (retour de Mic) — PARTIE SANS ROUGE. « Quand je relance un lot sur une partie où il ne reste aucun rouge, Ariane passe à
 * la suite sans rien dire. » Comportement constaté au banc (service worker réel, ESV simulé) : le lot pose et valide le cut
 * affiché, ESV charge la partie suivante, le lot se clôt sur « ESV est passé dans la partie P+1 ». La navigation d'ESV et ce qui
 * lui est envoyé NE CHANGENT PAS ; seul l'avis le dit d'abord, et le panneau l'écrit dans « Résultats du dernier lot ».
 * Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {pilote,avecReleve}=require('./helpers/dernier-cut.cjs'),L=require('../src/lot-decision.js');
const {panneau}=require('../tools/audit-qualite-480.cjs'),Settings=require('../src/settings.js');
const AVIS='Partie 23 : plus aucun cut rouge à traiter. Le lot s’arrête ici.';

/* Lot « jusqu'à la fin de la partie » au cut 50 de la partie 23 ; ESV charge la partie 24 après la validation. */
async function lotSur(mesure){
 const r=await pilote(L,{start:50,end:0,endMode:'partie',esv:(e,b)=>{e.identity.cut=50;avecReleve(mesure)(e,b);
  e.next=async function(){this.calls.push('next');this.identity={...this.identity,part:24,cut:1};return this.state();};}});
 return {r,view:await r.b.settle()};}

test('service worker : compteur complet (N = M) : l’avis de fin de lot dit d’abord que la partie n’a plus de rouge ; ESV reçoit les mêmes commandes',async()=>{
 const sans=await lotSur({total:101,traites:101}),avec=await lotSur({total:101,traites:90});
 assert.equal(sans.view.batch.state,'STOPPED');assert.equal(sans.view.batch.stoppedAtEnd.reason,'navigation-other-part');
 assert.ok(sans.view.notice.startsWith(AVIS+' Fin du lot : après la validation du cut 50, ESV est passé dans la partie 24'),sans.view.notice);
 assert.doesNotMatch(avec.view.notice,/plus aucun cut rouge/,'il reste des rouges : avis inchangé');
 assert.deepEqual([...sans.r.b.adapter.calls],[...avec.r.b.adapter.calls],'mêmes commandes envoyées à ESV dans les deux cas');
});

const lot=(etat,extra={})=>({current:{identity:{part:24,cut:1}},batch:{id:'lot-9',state:etat,scope:{part:23,start:50,end:999999,endMode:'partie'},processed:[],deferred:[],skipped:[],
 manuallyCompleted:[],paused:[],interrupted:[],sequence:[],activeIdentity:{part:23,cut:50},...extra}});
const releve=(traites,part=23)=>({totalReleve:{part,cut:50,total:101,totalSource:'compteur',traites,at:'2026-10-17T08:00:00Z'}});
const ouvrir=(s,fiches=[])=>panneau(s,{globals:{BananeSettings:Settings},reponses:{'fiches-depart':{fiches}}});

test('panneau : lot clos sur une partie sans rouge (compteur ou départ à 0 invalide) : « Partie N : plus aucun cut rouge à traiter. Le lot s’arrête ici. »',async()=>{
 let p=await ouvrir(lot('STOPPED',releve(101)));
 assert.equal(p.$('lot-fin-partie').hidden,false);assert.equal(p.$('lot-fin-partie').textContent,AVIS);
 assert.equal(p.$('resultats-titre').textContent,'Résultats du dernier lot');
 /* Fiche de départ de CE lot à 0 invalide (compteur absent). */
 p=await ouvrir(lot('COMPLETED'),[{partie:23,batchId:'lot-9',valides:101,invalides:0,total:101,at:'2026-10-17T08:00:00Z'}]);await p.attendre();
 assert.equal(p.$('lot-fin-partie').hidden,false);assert.equal(p.$('lot-fin-partie').textContent,AVIS);
});

test('panneau : lot clos sans commande par le service worker (partie complète au premier cut) : la ligne le dit, « Rien n’a été envoyé à ESV »',async()=>{
 const p=await ouvrir(lot('STOPPED',{...releve(101),stoppedAtEnd:{cut:50,reason:'partie-sans-rouge',issue:'partie-sans-rouge',target:null,total:101,applied:false,at:'2026-10-17T08:00:01Z'}}));
 assert.equal(p.$('lot-fin-partie').hidden,false);assert.equal(p.$('lot-fin-partie').textContent,AVIS+' Rien n’a été envoyé à ESV.');
 assert.match(p.$('batch').textContent,/— partie 23 sans cut rouge : le cut 50, déjà traité, n’a reçu aucune commande$/);
 assert.doesNotMatch(p.$('batch').textContent,/non résolu|posé, non validé/);
});

test('panneau : départ sur un cut vert, rouges restants derrière : la ligne les nomme ; la ligne d’état du lot aussi',async()=>{
 const p=await ouvrir(lot('STOPPED',{...releve(99),stoppedAtEnd:{cut:50,reason:'depart-sur-vert',issue:'depart-sur-vert',motif:'rouges-derriere',derriere:[1,7],target:null,total:101,applied:false,at:'2026-10-17T08:00:01Z'}}));
 assert.equal(p.$('lot-fin-partie').hidden,false);
 assert.equal(p.$('lot-fin-partie').textContent,'Partie 23 : plus aucun cut rouge après le cut 50. Il reste 2 cuts rouges derrière : 1, 7. Rien n’a été envoyé à ESV.');
 assert.match(p.$('batch').textContent,/— départ sur le cut 50, déjà validé : rien n’y a été écrit ; cuts rouges restants derrière : 1, 7$/);
});

test('panneau : rien n’est dit s’il reste des rouges, si le relevé est d’une autre partie, si la fiche est d’un autre lot, ou pendant un lot',async()=>{
 for(const [nom,s,fiches] of [['rouges restants',lot('STOPPED',releve(90)),[]],['autre partie',lot('STOPPED',releve(101,24)),[]],
   ['fiche d’un autre lot',lot('STOPPED'),[{partie:23,batchId:'lot-8',invalides:0}]],['lot en cours',lot('RUNNING',releve(101)),[]]]){
  const p=await ouvrir(s,fiches);await p.attendre();
  assert.equal(p.$('lot-fin-partie').hidden,true,nom);assert.equal(p.$('lot-fin-partie').textContent,'',nom);}
 const p=await ouvrir(lot('RUNNING'));assert.equal(p.$('resultats-titre').textContent,'Résultats du lot en cours');
});
