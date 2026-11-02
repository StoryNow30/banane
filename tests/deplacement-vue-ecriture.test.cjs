'use strict';
/* CH-038 : quand une pose avec déplacement de vue échoue, le service worker relit ESV et DIT si quelque chose a été écrit.
 * Service worker réel en VM, moteur réel, ESV simulé (montage de tests/helpers/deplacer-vue-lot.cjs). La page lève soit APRÈS
 * avoir posé les rails (le cas du cut 115 du 02/11 : « Vue ESV non recentrée sur le rail right. »), soit AVANT toute pose.
 * Attendu : l'événement `deplacer-vue` (phase pose) porte `ecriture` ('faite' | 'aucune' | 'inconnue') ; le message du lot
 * (Signal, `batch-error`) dit ce qui est écrit ; la remise est classée `echec` (et non `inconnu`). Aucune commande nouvelle :
 * jamais de SKIP, jamais de validation. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const {lot,EsvVue}=require('./helpers/deplacer-vue-lot.cjs'),S=require('../src/settings.js'),DV=require('../src/deplacement-vue.js');
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);
class EsvPanne extends EsvVue{
 async apply(before,proposals,...reste){
  if(!reste[0]?.deplacerVue)return super.apply(before,proposals,...reste);
  if(this.echec?.avant)throw Error(this.echec.message);
  await super.apply(before,proposals,...reste);throw Error(this.echec.message);}
}
async function lotPanne(echec){return lot({reglage:{...S.deplacerVue,actif:true},adapterClasse:EsvPanne,echec});}

test('detailRemise : « Vue ESV non recentrée » (page d\'avant CH-038) est un échec de remise, plus « inconnu »',()=>{
 const d=DV.detailRemise(null,'Vue ESV non recentrée sur le rail right.',{phase:'pose'});
 assert.equal(d.resultat,'echec');assert.equal(d.raison,'recentrage-impossible');assert.equal(d.source,'message');assert.equal(d.ecartEchelle,null);
 assert.equal(DV.detailRemise(null,'Autre panne.',{phase:'pose'}).resultat,'inconnu','une autre erreur reste inconnue');
});

test('échec APRÈS écriture (cut 115) : ecriture « faite », le lot s\'arrête avec une raison claire, remise « echec », aucune validation',async()=>{
 const {b,adapter}=await lotPanne({message:'Vue ESV non recentrée sur le rail right.'});
 const p=ev(b,'deplacer-vue').filter(e=>e.phase==='pose');assert.equal(p.length,1);assert.equal(p[0].ecriture,'faite');
 const err=ev(b,'batch-error');assert.equal(err.length,1);
 assert.match(err[0].message,/^Vue ESV non recentrée sur le rail right\. Déplacement de vue : les rails sont écrits dans ESV, rien n’est validé ; contrôle le cut\.$/);
 const r=ev(b,'deplacement-vue-remise').filter(x=>x.phase==='pose');assert.equal(r[0].resultat,'echec');
 assert.ok(!adapter.calls.includes('skip'),'jamais de SKIP');assert.equal(adapter.calls.filter(c=>c==='validate').length,1,'seule la validation du cut 111, avant');
});

test('échec AVANT écriture : ecriture « aucune », le message le dit ; aucune commande de plus',async()=>{
 const {b,adapter}=await lotPanne({avant:true,message:'Vue ESV non amenée sur la cible du rail droit (camera-immobile) : rien n’a été posé.'});
 const p=ev(b,'deplacer-vue').filter(e=>e.phase==='pose');assert.equal(p[0].ecriture,'aucune');
 assert.match(ev(b,'batch-error')[0].message,/rien n’a été posé\. Déplacement de vue : aucun rail n’a bougé dans ESV\.$/);
 assert.ok(!adapter.calls.includes('skip'));assert.equal(adapter.calls.filter(c=>c==='validate').length,1);
});
