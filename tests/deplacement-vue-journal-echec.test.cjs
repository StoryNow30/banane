'use strict';
/* CH-031 — JOURNAL DE LA REMISE DE LA VUE, suite de tests/deplacement-vue-journal.test.cjs (séparée le 06/11 : le fichier frôlait les 20 s par fichier du verify). Remise en échec et réglage coupé, service worker réel en VM. Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const DV=require('../src/deplacement-vue.js'),S=require('../src/settings.js');
const {lot,EsvVue}=require('./helpers/deplacer-vue-lot.cjs');
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);

class EsvRapport extends EsvVue{
 constructor(...a){super(...a);this.rapport=null;this.echec=null;}
 async apply(before,proposals,...reste){const r=await super.apply(before,proposals,...reste);
  if(reste[0]?.deplacerVue){if(this.echec)throw Error(this.echec);if(this.rapport)return {...r,deplacerVue:JSON.parse(JSON.stringify(this.rapport))};}return r;}
}
async function lotRapport({rapport,echec}){
 const {production}=require('./helpers/perf-production.cjs');
 const {lot:l}=require('./helpers/deplacer-vue-lot.cjs');void production;
 const res=await l({reglage:{...S.deplacerVue,actif:true},adapterClasse:EsvRapport,rapport,echec});return res;
}

test('lot : remise en échec (la page lève) : l\'écart est lu, le résultat est « echec » et l\'erreur d\'origine traverse',async()=>{
 const {b}=await lotRapport({echec:'Vue ESV non restituée après le déplacement de vue (échelle à 3,5 % de la vue habituelle) : les deux rails sont posés.'});
 const r=ev(b,'deplacement-vue-remise').filter(x=>x.phase==='pose');assert.equal(r.length,1);assert.equal(r[0].resultat,'echec');assert.equal(r[0].ecartEchelle,0.035);
 assert.ok(ev(b,'deplacer-vue').some(e=>e.phase==='pose'&&/non restituée/.test(e.erreur)),'l\'événement existant est inchangé');
});

test('réglage coupé : aucun événement nouveau',async()=>{
 const {b}=await lot({});
 for(const t of ['deplacement-vue','deplacement-vue-remise','deplacement-vue-bilan'])assert.equal(ev(b,t).length,0,t);
});
