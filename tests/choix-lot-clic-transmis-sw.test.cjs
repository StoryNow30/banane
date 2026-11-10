'use strict';
/* 4.9.5 test 6 (D-157, D-164) — CHAQUE CHOIX DU CLIC EST TRANSMIS À LA PAGE ET CONSIGNÉ. Service worker réel en VM
 * (tests/helpers/choix-lot.cjs). Un choix corrigé gardé part avec chaque `apply` du lot (`{clicHumain}`), et seulement lui ; les
 * types de commandes restent ceux de la base ; le lot le porte (scope, `batch-started`, état rendu au panneau et exporté).
 * Hors d'un lot en cours, rien n'est envoyé. Actions du panneau : lecture, écriture, refus d'une valeur inconnue, stockage illisible. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lotClic,CLE_CLIC}=require('./helpers/choix-lot.cjs');
const {GOLDEN,j,scopeDe,debutsDeLot}=require('./helpers/choix-lot-essais.cjs');
const lots={};

test('chaque choix corrigé est transmis à la page avec chaque apply du lot, et consigné dans le lot',async()=>{
 for(const mode of ['gauche-recentre','tout-recentre']){
  const x=lots[mode]=await lotClic({choix:{[CLE_CLIC]:mode}});
  assert.deepEqual(j(x.options),[[{clicHumain:mode}],[{clicHumain:mode}]],mode);
  assert.deepEqual(x.commandes.map(c=>c.action??null),GOLDEN.clic.actions,mode+' : mêmes types de commandes, dans le même ordre');
  assert.equal(scopeDe(x.b).clicHumain,mode);assert.deepEqual(debutsDeLot(x.b).map(s=>s.clicHumain),[mode],'événement de début de lot');
  const vue=await x.b.api('view');assert.equal(vue.batch.scope.clicHumain,mode,'état rendu au panneau et exporté');
 }
});

test('hors d\'un lot en cours, rien n\'est envoyé ; actions du panneau : lecture, écriture, refus d\'une valeur inconnue',async()=>{
 const x=lots['tout-recentre']||await lotClic({choix:{[CLE_CLIC]:'tout-recentre'}}),b=x.b,engine=b.get('engine');
 assert.notEqual(engine.s.batch.state,'RUNNING');
 assert.equal(b.get('clicHumainDuLot')(),null,'lot clos : aucune option');
 engine.s.batch.state='RUNNING';assert.equal(b.get('clicHumainDuLot')(),'tout-recentre');engine.s.batch.state='STOPPED';
 assert.deepEqual(j(await b.api('choix-lot-etat')),{clicHumain:'tout-recentre',regleGrappeDifferes:false,passeDifferes:true,aurorePassage:true});
 assert.deepEqual(j(await b.api('choix-lot',{regleGrappeDifferes:true})),{clicHumain:'tout-recentre',regleGrappeDifferes:true,passeDifferes:true,aurorePassage:true});
 await assert.rejects(b.api('choix-lot',{clicHumain:'vite'}),/Clic du mode rapide inconnu/);
 await assert.rejects(b.api('choix-lot',{regleGrappeDifferes:'oui'}),/oui ou non/);
 assert.deepEqual(j(await b.api('choix-lot-etat')),{clicHumain:'tout-recentre',regleGrappeDifferes:true,passeDifferes:true,aurorePassage:true},'un refus ne change rien');
 /* Valeur inconnue déjà gardée, ou stockage illisible : le défaut. */
 b.local.m[CLE_CLIC]='vite';assert.deepEqual(j(await b.api('choix-lot-etat')),{clicHumain:'tel-quel',regleGrappeDifferes:true,passeDifferes:true,aurorePassage:true});
 b.ctx.chrome.storage.local.get=async()=>{throw Error('stockage illisible');};
 assert.deepEqual(j(await b.api('choix-lot-etat')),{clicHumain:'tel-quel',regleGrappeDifferes:false,passeDifferes:false,aurorePassage:true},'stockage illisible : deuxième passe coupée');
});
