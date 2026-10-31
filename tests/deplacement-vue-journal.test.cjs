'use strict';
/* CH-031 — JOURNAL DE LA REMISE DE LA VUE. Deux étages : (1) les fonctions pures de src/deplacement-vue.js (détail des événements,
 * lecture du texte d'échec, bilan sans numéro de cut) ; (2) le service worker réel en VM (même montage que deplacer-vue-sw-actif) :
 * un `deplacement-vue` par côté amené, un `deplacement-vue-remise` par pose, un `deplacement-vue-bilan` à la clôture du lot, et
 * AUCUN changement des commandes envoyées à la page (comparées au cas sans rapport). Données synthétiques. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const DV=require('../src/deplacement-vue.js'),S=require('../src/settings.js');
const {lot,EsvVue}=require('./helpers/deplacer-vue-lot.cjs');
const ev=(b,type)=>b.store.events.filter(e=>e.type===type);

const COTE={cote:'left',ok:true,raison:null,ndcAvant:[1.34,0.1],ndcApres:[0.9,0.1],pixelMm:{avant:.5,apres:.7},dureeMs:812,
 gestes:[{type:'molette',crans:3,zoom:1.352,camera:null,ndcAvant:[1.34,0.1],ndcApres:[0.9,0.1],dureeMs:790,deplacement:{geste:'clic-droit',ok:true,tentatives:2,raison:null}}]};

test('detailDeplacement : geste, tentatives, caméra avant / après, durée ; aucune position',()=>{
 const d=DV.detailDeplacement(COTE,{phase:'pose',geste:'molette'});
 assert.equal(d.cote,'left');assert.equal(d.geste,'clic-droit');assert.equal(d.tentatives,2);assert.equal(d.ok,true);
 assert.deepEqual(d.ndcAvant,[1.34,0.1]);assert.deepEqual(d.ndcApres,[0.9,0.1]);assert.equal(d.dureeMs,812);assert.equal(d.gestes[0].zoom,1.352);
 assert.ok(!/position|cible/i.test(JSON.stringify(d)));assert.equal(DV.detailDeplacement(null),null);
});

test('detailRemise : faite, échec rapporté, échec lu dans le texte de la page, erreur inconnue',()=>{
 const f=DV.detailRemise({ok:true,crans:3,recentre:false,ecartEchelle:0.000002,dureeMs:410},null,{phase:'pose',dureeApplyMs:5200,cransMax:5});
 assert.equal(f.resultat,'faite');assert.equal(f.ecartEchelle,0.000002);assert.equal(f.tentative,1);assert.equal(f.dureeMs,410);assert.equal(f.dureeApplyMs,5200);assert.equal(f.source,'rapport');
 const e=DV.detailRemise({ok:false,crans:2,ecartEchelle:0.05},null,{phase:'pose'});assert.equal(e.resultat,'echec');assert.equal(e.raison,'vue-non-restituee');
 const m=DV.detailRemise(null,'Vue ESV non restituée après le déplacement de vue (échelle à 2,5 % de la vue habituelle) : les deux rails sont posés.',{phase:'pose'});
 assert.equal(m.resultat,'echec');assert.equal(m.ecartEchelle,0.025);assert.equal(m.source,'message');
 const x=DV.detailRemise(null,'Action interrompue.',{phase:'pose'});assert.equal(x.resultat,'inconnu');assert.equal(x.ecartEchelle,null);assert.match(x.raison,/^erreur:/);
});

test('Bilan : comptes et temps ajouté, jamais de numéro de cut',()=>{
 const b=new DV.Bilan();b.noterDeplacement(DV.detailDeplacement(COTE,{phase:'pose'}));
 b.noterRemise(DV.detailRemise({ok:true,crans:3,ecartEchelle:0,dureeMs:100},null,{phase:'pose'}));
 b.noterDeplacement(DV.detailDeplacement({...COTE,ok:false,raison:'camera-immobile'},{phase:'pose'}));
 b.noterRemise(DV.detailRemise(null,'Vue ESV non restituée après le déplacement de vue (échelle à 4,0 % de la vue habituelle)',{phase:'pose'}));
 const r=b.resume();assert.equal(r.deplacements,2);assert.equal(r.deplacementsReussis,1);assert.equal(r.remises,2);assert.equal(r.remisesFaites,1);assert.equal(r.echecs,2);
 assert.equal(r.tempsAjouteMs,812*2+100);assert.equal(r.ecartRemiseMax,0.04);assert.ok(!/cut|identity|part/i.test(JSON.stringify(r)));
 assert.equal(new DV.Bilan().vide(),true);
});

/* ---- service worker réel ---- */
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

test('lot : la pose avec déplacement journalise le côté, la remise faite et le bilan à la clôture ; la même suite de commandes qu\'avant',async()=>{
 const sans=await lot({reglage:{...S.deplacerVue,actif:true}}),avec=await lotRapport({rapport:{version:'x',cotes:[COTE],remise:{ok:true,crans:3,recentre:false,ecartEchelle:0,dureeMs:300}}});
 assert.deepEqual(avec.adapter.calls,sans.adapter.calls,'mêmes commandes envoyées à la page');assert.deepEqual(avec.adapter.applyArgs,sans.adapter.applyArgs);
 const {b}=avec,d=ev(b,'deplacement-vue').filter(x=>x.phase==='pose'),r=ev(b,'deplacement-vue-remise');
 assert.ok(ev(b,'deplacement-vue').some(x=>x.phase==='pre-vol'));
 assert.equal(d.length,1);assert.equal(d[0].phase,'pose');assert.equal(d[0].identity.cut,112);assert.equal(d[0].geste,'clic-droit');
 const rp=r.filter(x=>x.phase==='pose');assert.equal(rp.length,1);assert.equal(rp[0].resultat,'faite');assert.equal(rp[0].identity.cut,112);assert.ok(Number.isFinite(rp[0].dureeApplyMs));
 assert.ok(r.some(x=>x.phase==='pre-vol'),'le pré-vol (essai de la page) est journalisé aussi');
 const bl=ev(b,'deplacement-vue-bilan');assert.equal(bl.length,1,'un bilan');assert.ok(bl[0].deplacements>=1);assert.equal(bl[0].identity,undefined);assert.ok(!/"cut"/.test(JSON.stringify(bl[0])));
});

test('lot : remise en échec (la page lève) : l\'écart est lu, le résultat est « echec » et l\'erreur d\'origine traverse',async()=>{
 const {b}=await lotRapport({echec:'Vue ESV non restituée après le déplacement de vue (échelle à 3,5 % de la vue habituelle) : les deux rails sont posés.'});
 const r=ev(b,'deplacement-vue-remise').filter(x=>x.phase==='pose');assert.equal(r.length,1);assert.equal(r[0].resultat,'echec');assert.equal(r[0].ecartEchelle,0.035);
 assert.ok(ev(b,'deplacer-vue').some(e=>e.phase==='pose'&&/non restituée/.test(e.erreur)),'l\'événement existant est inchangé');
});

test('réglage coupé : aucun événement nouveau',async()=>{
 const {b}=await lot({});
 for(const t of ['deplacement-vue','deplacement-vue-remise','deplacement-vue-bilan'])assert.equal(ev(b,t).length,0,t);
});
