'use strict';
/* CH-062 — SIGNAL D'ESV ÉTEINT PENDANT LE LOT : les moments qui ne sont PAS un point sûr. Règle pure (`lotSignalRefus`), puis un lot dont
 * l'écriture de validation n'est jamais vue par l'observateur : aucun rechargement, un seul refus consigné, le lot va à sa borne.
 * Montage : tests/helpers/lot-signal.cjs. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {REGLAGE,lotSignal,ev,etapes,valides,attendreLot,attendre}=require('./helpers/lot-signal.cjs');
const {production}=require('./helpers/perf-production.cjs');

test('point sûr : refusé pendant une relecture, la deuxième passe, Écho, un différé, une pose à réconcilier, hors partie, à la borne, sans navigation',()=>{
 const refus=production().get('lotSignalRefus');
 const ok={etat:'RUNNING',onglet:1,relecture:false,passe:false,echo:false,manuel:false,differe:false,intent:false,reconcile:false,part:23,fin:200,cut:113,
  evidence:{commandSent:true,navigationObserved:true,nextReady:true,nextIdentity:{part:23,cut:114}}};
 assert.equal(refus(ok),null,'validation prouvée, cut suivant affiché dans la partie : point sûr');
 const cas=[[{etat:'PAUSED'},/pas en cours/],[{onglet:null},/onglet/],[{relecture:true},/relecture/],[{passe:true},/deuxième passe/],[{echo:true},/Écho/],
  [{manuel:true},/Mes corrections/],[{differe:true},/différé/],[{intent:true},/réconcilier/],[{reconcile:true},/réconcilier/],
  [{evidence:{...ok.evidence,navigationObserved:false}},/non prouvée/],[{evidence:{...ok.evidence,commandSent:false}},/non prouvée/],
  [{evidence:{...ok.evidence,nextReady:false}},/pas prêt/],[{evidence:{...ok.evidence,nextIdentity:{part:24,cut:1}}},/hors de la partie/],
  [{evidence:{...ok.evidence,nextIdentity:null}},/hors de la partie/],[{fin:113},/fin du lot/],[{evidence:{...ok.evidence,nextIdentity:{part:23,cut:113}}},/inchangé/]];
 for(const [m,re] of cas)assert.match(String(refus({...ok,...m})),re,JSON.stringify(m));
});

test('allumé, écriture de validation jamais vue : aucun rechargement, un refus consigné une fois, mêmes cuts validés',async()=>{
 const {b,adapter}=await lotSignal({reglage:{...REGLAGE,lectures:2,preuveMs:150},esv:{preuve:false},end:114});
 const v=await attendreLot(b);
 assert.equal(adapter.rechargements,0);assert.deepEqual(etapes(b),['detecte','refus']);
 assert.match(ev(b,'lot-signal-eteint')[1].motif,/non vue dans 150 ms/);
 assert.equal(v.batch.stoppedAtEnd?.cut,114);assert.deepEqual(valides(b),[111,112,113]);
});
