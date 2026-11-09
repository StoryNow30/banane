'use strict';
/* CH-079 (D-308) — partie L1-e de tests/ch079-ombre-sw.test.cjs, séparée pour tenir sous la limite de 20 s par fichier du verify (Vision 6) : même montage, même essai. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV,base,K}=require('./fixtures.cjs');
const S=require('../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
const evs=(b,type)=>b.store.events.filter(e=>e.type===type);
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
/* Chemin L1-e : le cut 112 est différé par le lot puis posé et validé par la décision de la GCV2 (forcée : le modèle réel est essayé ailleurs) ; le serrage consigne alors la pose desserrée. */
const H=require('./helpers/lot-profil.cjs');
async function lotL1e(ombres){
 const adapter=new H.EsvTrou([]),b=H.production({adapter});
 const lotR={...S.lot,profil:'L1-se',gardeApresDiffere:undefined,...(ombres?{gardeVoieOmbre:{...S.lot.gardeVoieOmbre,voisinesMin:1},serrageLotOmbre:{...S.lot.serrageLotOmbre,voisinesMin:1}}:{gardeVoieOmbre:{...S.lot.gardeVoieOmbre,actif:false},serrageLotOmbre:{...S.lot.serrageLotOmbre,actif:false}})};
 b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:{...S.voiePrediteOmbre,actif:false},deplacerVue:{...S.deplacerVue,actif:false},lot:lotR};
 const G=b.ctx.BananeGcv2L1;
 b.ctx.BananeGcv2L1={...G,deciderDiffere:a=>{const r=G.deciderDiffere(a);if(a.capture.identity.cut!==112)return r;
  const p0=b.store.events.find(e=>e.type==='gcv1-shadow-observed'&&e.identity?.cut===111)?.lotObservation?.positions;
  const paire={left:{decal:G.decalage(a.capture.rails.left,p0.left)},right:{decal:G.decalage(a.capture.rails.right,p0.right)}};
  return {...r,decision:{...r.decision,etat:'valider',motif:null,p:0.9,paire,hypothese:'H1',ecartDepartMm:0},positions:G.positionsDe(a.capture,paire)};}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);adapter.ajuster();
 await b.api('start',{part:23,start:111,end:113,...SCOPE});await b.settle();await new Promise(r=>setTimeout(r,30));
 return {b,adapter};
}
test('L1-e : la pose du 112 par la GCV2 est validée ; le serrage est consigné, la pose et les commandes sont celles du lot sans ombre',async()=>{
 const sans=await lotL1e(false),avec=await lotL1e(true);
 const d=decisions(avec.b).find(([c])=>c===112)[1];assert.equal(d.command.reason,'gcv2-l1','le 112 est posé par L1-e');
 deq(neutre(avec.b.commands),neutre(sans.b.commands));deq(avec.adapter.calls,sans.adapter.calls);deq(neutre(avec.adapter.rails),neutre(sans.adapter.rails));
 const sansMs=x=>JSON.parse(JSON.stringify(neutre(decisions(x)),(k,v)=>k==='ms'?undefined:v));
 deq(sansMs(avec.b),sansMs(sans.b),'décisions identiques (hors la durée `l1.ms`, mesurée à l\'horloge)');
 assert.equal(evs(sans.b,'serrage-lot-ombre').length,0);
 const s=evs(avec.b,'serrage-lot-ombre');deq(s.map(x=>x.identity.cut),[112],'un événement, pour la seule pose de L1-e');
 const x=s[0];assert.equal(x.version,'serrage-lot-ombre-v1');for(const k of ['referenceMm','ecartAvantMm','ecartApresMm','deltaGaucheMm','deltaDroiteMm'])assert.ok(Number.isFinite(x[k]),k);
 assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(x)));
 assert.ok(evs(avec.b,'garde-voie-ombre').some(g=>g.identity.cut===112),'la garde juge aussi la pose de L1-e');
});
