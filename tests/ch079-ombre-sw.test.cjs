'use strict';
/* CH-079 (D-308) — GARDE DE VOIE ET SERRAGE DU LOT EN OMBRE, SERVICE WORKER RÉEL EN VM (moteur et GCV1 réels, ESV simulé ; montage de tests/helpers/perf-production.cjs).
 * Les deux ombres NE POSENT RIEN : mêmes commandes à ESV, mêmes poses, mêmes enregistrements, mêmes décisions (octet pour octet) avec et sans elles, et en panne.
 * Un événement `garde-voie-ombre` par cut VALIDÉ par le lot, rien pour un différé ; `serrage-lot-ombre` seulement pour une pose de la décision L1-e (absente d'un profil « actuel »). */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV,base,K}=require('./fixtures.cjs');
const S=require('../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
async function lot({garde,serrage,panne=false}={}){
 const adapter=new SimulatedESV(),b=production({adapter});
 const lotReglage={...S.lot,profil:'actuel',...(garde!==undefined?{gardeVoieOmbre:garde}:{}),...(serrage!==undefined?{serrageLotOmbre:serrage}:{})};
 b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:lotReglage};
 if(panne)b.ctx.BananeGardeVoieOmbre={...b.ctx.BananeGardeVoieOmbre,evaluer:()=>{throw Error('panne simulée de la garde');}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:111,end:114,...SCOPE});await b.settle();
 return {b,adapter};
}
const evs=(b,type)=>b.store.events.filter(e=>e.type===type);
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
const metier=b=>b.store.events.filter(e=>!['garde-voie-ombre','serrage-lot-ombre','voie-b1-ecart-ombre','voie-predite-ombre','b1-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);
let coupe,active,enPanne;
before(async()=>{
 const eteint={actif:false};
 coupe=await lot({garde:{...S.lot.gardeVoieOmbre,actif:false},serrage:{...S.lot.serrageLotOmbre,actif:false}});
 active=await lot({garde:{...S.lot.gardeVoieOmbre,voisinesMin:1}});
 enPanne=await lot({garde:{...S.lot.gardeVoieOmbre,voisinesMin:1},panne:true});
});
test('les réglages existent, figés, allumés en OMBRE ; seuil 15 mm, fenêtre 20 cuts',()=>{
 for(const k of ['gardeVoieOmbre','serrageLotOmbre'])assert.ok(Object.isFrozen(S.lot[k]),k);
 deq({...S.lot.gardeVoieOmbre},{actif:true,seuilMm:15,fenetre:20,voisinesMin:5});deq({...S.lot.serrageLotOmbre},{actif:true,plafondMm:20,fenetre:20,voisinesMin:5});
});
test('LA POSE NE CHANGE PAS : mêmes commandes ESV, mêmes rails, mêmes enregistrements, décisions identiques octet pour octet, avec, sans et en panne',()=>{
 for(const [nom,x] of [['ombres actives',active],['garde en panne',enPanne]]){
  deq(neutre(x.b.commands),neutre(coupe.b.commands),nom+' : mêmes commandes ESV');deq(neutre(x.adapter.rails),neutre(coupe.adapter.rails),nom);deq(x.adapter.calls,coupe.adapter.calls,nom);
  const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(x.b),rec(coupe.b),nom);
  deq(metier(x.b),metier(coupe.b),nom+' : mêmes événements métier');
  assert.equal(JSON.stringify(neutre(decisions(x.b))),JSON.stringify(neutre(decisions(coupe.b))),nom+' : décisions du lot identiques, octet pour octet');
 }
 assert.ok(coupe.adapter.calls.filter(c=>c==='validate').length>=2,'le lot pose et valide plusieurs cuts');
});
test('un événement compact par cut validé, rien réglage coupé ; aucune position de scène ; en panne, aucun événement et le lot continue',()=>{
 assert.equal(evs(coupe.b,'garde-voie-ombre').length,0);assert.equal(evs(coupe.b,'serrage-lot-ombre').length,0);
 const g=evs(active.b,'garde-voie-ombre');assert.ok(g.length>=2,'un événement par cut validé : '+g.length);
 for(const x of g){assert.equal(x.version,'garde-voie-ombre-v1');assert.ok(x.batchId&&Number.isInteger(x.identity.cut));
  for(const k of ['ecartMm','referenceMm','ecartAuVoisinageMm','auraitPause','motif','ms'])assert.ok(k in x,'champ '+k);
  assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(x)));assert.ok(JSON.stringify(x).length<600);}
 /* Les cuts suivants se comparent à ceux que le lot a déjà validés (mémoire du lot), le premier n'a aucun voisin. */
 assert.match(g[0].motif,/sans-voisins/);assert.equal(g[0].auraitPause,false);assert.ok(g.slice(1).every(x=>x.referenceMm>1000&&x.motif!=='sans-voisins'));
 assert.equal(evs(active.b,'serrage-lot-ombre').length,0,'profil « actuel » : aucune pose de L1-e, aucun serrage');
 assert.equal(evs(enPanne.b,'garde-voie-ombre').length,0);
});
test('seul le service worker appelle les modules, après la commande ; ils ne sont lus par aucun chemin de pose',()=>{
 const fs=require('node:fs'),path=require('node:path'),racine=path.resolve(__dirname,'..');
 const bg=fs.readFileSync(path.join(racine,'background.js'),'utf8');
 assert.match(bg,/'src\/garde-voie-ombre\.js','src\/serrage-lot-ombre\.js'/);assert.match(bg,/gardeSerrageOmbre\(lotObservation,proposal\)/);
 assert.ok(bg.indexOf('b1EcartPlanifier(lotObservation,proposal)')<bg.indexOf('gardeSerrageOmbre(lotObservation,proposal)'),'après la décision et la commande');
 for(const f of fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith(".js")&&!/^(garde-voie-ombre|serrage-lot-ombre|settings)\.js$/.test(x))){
  assert.doesNotMatch(fs.readFileSync(path.join(racine,'src',f),'utf8'),/BananeGardeVoieOmbre|BananeSerrageLotOmbre|garde-voie-ombre|serrage-lot-ombre/,f+' ne lit pas les ombres');}
});

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
