'use strict';
/* 5.0 (audit 5.0, I8 (1)) — ORBITE : UN ÉVÉNEMENT `voie-predite-ombre` PAR CUT DIFFÉRÉ, SERVICE WORKER RÉEL EN VM (moteur et GCV1
 * réels, ESV simulé). L'ombre consigne ce qu'aurait fait la règle prudente D-147 (moteur recentré sur la voie du lot, vue
 * déplacée) : étage, confiance, écart à la voie, geste de vue nécessaire, profondeur de chaîne, verdict. ELLE NE POSE RIEN :
 * mêmes commandes à ESV, mêmes poses, mêmes enregistrements, mêmes décisions (octet pour octet) avec et sans elle, et une
 * panne de l'ombre ne change rien. Données synthétiques : les cuts 112 et 113 ont leur pose de départ à 230 mm de la voie. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV,base,K}=require('./fixtures.cjs');
const O=require('../src/continuity-observer.js'),S=require('../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const SIDES=['left','right'];
/* Identifiants (opérations, captures) et horloges diffèrent d'une exécution à l'autre : ils sont neutralisés, rien d'autre. */
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
const decale=mm=>Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
/* ESV simulé dont les cuts de `loin` ont leur pose de départ à 230 mm de la voie (hors de la fenêtre du moteur). */
class EsvDecale extends SimulatedESV{
 constructor(loin){super();this.loin=new Set(loin);}
 ajuster(){if(this.loin.has(this.identity.cut))this.rails=K.clone(decale(230));}
 async next(){const r=await super.next();this.ajuster();return this.state();}
 async nextWithoutDecision(...a){const r=await super.nextWithoutDecision(...a);this.ajuster();return r;}
}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
async function lot(reglage,{panne=false}={}){
 const adapter=new EsvDecale([112,113]),b=production({adapter});
 if(reglage!==undefined)b.ctx.BananeSettings={...b.ctx.BananeSettings,voiePrediteOmbre:reglage};
 if(panne)b.ctx.BananeVoieRecentree={...b.ctx.BananeVoieRecentree,evaluerDiffere:()=>{throw Error('panne simulée de l\'ombre');}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=110;adapter.rails=K.clone(base.rails);
 await b.api('start',{part:23,start:110,end:113,...SCOPE});await b.settle();
 await attendre(30);try{b.get('voieOmbreVider')();}catch{}await attendre(30);
 return {b,adapter};
}
const ombres=b=>b.store.events.filter(e=>e.type==='voie-predite-ombre');
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
const metier=b=>b.store.events.filter(e=>!['voie-predite-ombre','b1-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);
let coupe,active,panne;
before(async()=>{coupe=await lot({...S.voiePrediteOmbre,actif:false});active=await lot(undefined);panne=await lot(undefined,{panne:true});},{timeout:180000});

test('le réglage existe, actif par défaut en OMBRE, seuils de D-147 ; le panneau dit qu\'il ne fait que consigner',()=>{
 const v=S.voiePrediteOmbre;assert.ok(Object.isFrozen(v));
 deq({...v,etages:[...v.etages]},{actif:true,etages:['window'],confianceMin:55,ecartementVoisinMm:10,profondeurMax:10,fenetreMm:30,dezoomMax:1.5,glissementPxMax:250});
 const ligne=S.describe().find(l=>/Voie prédite en ombre/.test(l.nom));assert.ok(ligne);assert.match(ligne.valeur,/consign/i);assert.match(ligne.pourquoi,/jamais pos/i);
});

test('LA POSE NE CHANGE PAS : mêmes commandes ESV, mêmes rails, mêmes enregistrements, mêmes événements métier, décisions identiques octet pour octet',()=>{
 for(const [nom,x] of [['ombre active',active],['ombre en panne',panne]]){
  deq(neutre(x.b.commands),neutre(coupe.b.commands),nom+' : mêmes commandes ESV, même ordre');
  deq(neutre(x.adapter.rails),neutre(coupe.adapter.rails),nom);deq(x.adapter.calls,coupe.adapter.calls,nom);
  const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(x.b),rec(coupe.b),nom);
  deq(metier(x.b),metier(coupe.b),nom+' : mêmes événements métier');
  assert.equal(JSON.stringify(neutre(decisions(x.b))),JSON.stringify(neutre(decisions(coupe.b))),nom+' : décisions du lot identiques, octet pour octet');
 }
 /* Le lot a bien posé 110 et 111 et différé 112 et 113 (sinon l'essai ne prouverait rien). */
 const d=decisions(coupe.b);deq(d.map(([c,x])=>[c,x.command?.action]),[[110,'engine'],[111,'engine'],[112,'defer'],[113,'defer']]);
 assert.equal(coupe.adapter.calls.filter(c=>c==='validate').length,2);
});

test('un événement par cut différé, et seulement si le réglage est actif ; aucune commande de plus',()=>{
 assert.equal(ombres(coupe.b).length,0,'réglage coupé : rien');
 const e=ombres(active.b);
 deq(e.map(x=>x.identity.cut),[112,113],'un par différé, aucun pour les cuts posés');
 for(const x of e){
  assert.equal(x.version,'voie-predite-ombre-v1');assert.ok(x.batchId);assert.equal(typeof x.verdict.posable,'boolean');assert.ok(x.verdict.posable||typeof x.verdict.raison==='string');
  assert.ok('etage' in x&&'confiance' in x&&'ecartVoieMm' in x&&'profondeur' in x&&'vue' in x,'étage, confiance, écart, profondeur, vue');
  assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(x)),'aucune position de scène');
 }
 /* Le premier événement du lot porte les seuils lus dans les réglages ; les suivants non (poids). */
 deq(e[0].seuils,{...S.voiePrediteOmbre,etages:[...S.voiePrediteOmbre.etages]});assert.equal(e[1].seuils,undefined);
 /* Reprise depuis la voie trouvée par la décision réelle (112), refusée par la commande : l'ombre relance le moteur. */
 assert.equal(e[0].reel.stage,'window');assert.equal(e[0].recalcule,true);assert.equal(e[0].etage,'window');assert.ok(Number.isFinite(e[0].ecartVoieMm));
});

test('une panne de l\'ombre ne change rien et ne laisse qu\'une trace',()=>{
 const e=ombres(panne.b);deq(e.map(x=>x.identity.cut),[112,113]);
 for(const x of e){assert.equal(x.etat,'erreur');assert.match(x.message,/panne simulée/);}
});

test('aucun chemin de pose ne lit l\'ombre : seul le service worker l\'appelle, et seulement après la commande',()=>{
 const fs=require('node:fs'),path=require('node:path'),racine=path.resolve(__dirname,'..');
 const bg=fs.readFileSync(path.join(racine,'background.js'),'utf8');
 assert.match(bg,/'src\/voie-recentree\.js'/,'chargé par le service worker');
 for(const f of fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')&&x!=='voie-recentree.js')){
  const t=fs.readFileSync(path.join(racine,'src',f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  if(f==='native-session.js')continue;   // l'ombre de l'Écho, essayée à part
  assert.ok(!/BananeVoieRecentree|voie-recentree/.test(t),f+' ne lit pas le module');
 }
 assert.ok(!/BananeVoieRecentree|voiePrediteOmbre/.test(fs.readFileSync(path.join(racine,'src','engine.js'),'utf8')));
});
