'use strict';
/* B1 (D-095), service worker réel en VM (montage : tests/helpers/b1-montage.cjs) : page muette,
 * réponse non fiable, repère instable, réglage coupé — aucun voisin, et la décision réelle reste
 * celle d'aujourd'hui. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {montage,lot,evts,prerégler,deq}=require('./helpers/b1-montage.cjs');

test('page muette, repère instable, réponse non fiable : aucun voisin, décision réelle intacte',{timeout:60000},async()=>{
  const s=montage();await lot(s,100,100);prerégler(s,{left:[0,0,0],right:[0,1.435,0]});
  const envoyer=s.b.ctx.chrome.tabs.sendMessage;
  s.b.ctx.chrome.tabs.sendMessage=async(id,m)=>m.kind==='b1-voisins'?new Promise(()=>{}):envoyer(id,m);await lot(s,103,103);await new Promise(r=>setTimeout(r,700));s.b.get('b1Vider')();
  deq(evts(s.b).filter(x=>x.identity.cut===103).map(x=>[x.etat,x.raison]),[['page','delai']],'délai de 600 ms, sans attendre plus');
  s.b.ctx.chrome.tabs.sendMessage=async(id,m)=>m.kind==='b1-voisins'?{ok:true,geo:{index:'x'},rows:[{i:1e9,s:'valid',e:[1,2,3,4,5,6]}],table:{debut:true}}:envoyer(id,m);await lot(s,105,105);
  deq(evts(s.b).filter(x=>x.identity.cut===105).map(x=>[x.etat,x.appariement.raison,x.candidats]),[['desaccord','sans-geometrie',[]]]);
  s.b.get('b1').repere.etat='instable';await lot(s,106,106);assert.equal(evts(s.b).find(x=>x.identity.cut===106).etat,'repere-instable');
  const l=s.b.store.events.filter(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut>=103).map(e=>e.lotObservation.stage);assert.ok(l.length===3&&l.every(x=>x==='first-pass'),'décisions réelles : '+l);
  s.b.ctx.BananeSettings={...s.b.ctx.BananeSettings,appuisListe:'off'};const n=evts(s.b).length;await lot(s,107,107);assert.equal(evts(s.b).length,n,'réglage coupé : rien');
  deq(s.b.raw({kind:'esv-observation',observer:'o',entries:[]}).out.tableListe,false,'le pont est prié de faire oublier la table à la page');
});
