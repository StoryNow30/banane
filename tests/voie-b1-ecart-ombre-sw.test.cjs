'use strict';
/* CH-055 — ORBITE : UN ÉVÉNEMENT `voie-b1-ecart-ombre` PAR CUT DIFFÉRÉ, SERVICE WORKER RÉEL EN VM (moteur et GCV1 réels, ESV simulé). L'ombre
 * consigne ce qu'aurait posé la règle « b1-ecart » (src/voie-b1-ecart.js : chaîne de l'ombre, lignes valides de la liste d'ESV, complément par
 * l'écartement). ELLE NE POSE RIEN : mêmes commandes à ESV, mêmes poses, mêmes enregistrements, mêmes décisions (octet pour octet) avec et sans
 * elle, et une panne de l'ombre ne change rien. Données synthétiques (montage de tests/helpers/voie-ombre-lot.cjs : le cut 111 est posé, le
 * cut 112 a sa pose de départ à 230 mm de la voie). Le calcul lourd est différé (file de l'ombre, vidée à la capture suivante ou 4 s). */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {production,normalize}=require('./helpers/perf-production.cjs'),{SimulatedESV,base,K}=require('./fixtures.cjs');
const O=require('../src/continuity-observer.js'),S=require('../src/settings.js');
const SCOPE={testConfirmed:true,allowNavigationEvidence:true,lowConfidence:'attempt',geometryEngine:'geometry-candidate-v1',lotDecision:'apply'};
const plat=x=>JSON.parse(JSON.stringify(x===undefined?null:x)),deq=(a,b,m)=>assert.deepEqual(plat(a),plat(b),m);
const SIDES=['left','right'];
const neutre=x=>JSON.parse(JSON.stringify(normalize(x)).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,'<id>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z/g,'<heure>'));
const decale=mm=>Object.fromEntries(SIDES.map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
  const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
class EsvDecale extends SimulatedESV{
 constructor(loin,mm=230){super();this.loin=new Set(loin);this.mm=mm;}
 ajuster(){if(this.loin.has(this.identity.cut))this.rails=K.clone(decale(this.mm));}
 async next(){await super.next();this.ajuster();return this.state();}
 async nextWithoutDecision(...a){const r=await super.nextWithoutDecision(...a);this.ajuster();return r;}
}
const attendre=ms=>new Promise(r=>setTimeout(r,ms));
/* Instantané compact de la liste d'ESV (src/liste-memoire.js) dans le stockage local du service worker : lignes VALIDES à la vraie pose (la pose de
 * base de la fixture) pour les cuts `valides`, lignes invalides à la pose de départ décalée pour `loin`, monde = scène + T0. */
const LM=require('../src/liste-memoire.js'),T0=[1234.5,2345.25,3.125];
function instantane(part,valides,loin,mm=230){
 const n=120,st=new Array(n).fill(3),fl=new Array(n).fill(0),ed=new Array(6*n).fill(null);
 const pose=(cut,rails)=>{st[cut]=valides.includes(cut)?0:1;SIDES.forEach((s,k)=>rails[s].positionSceneRelative.forEach((v,i)=>{ed[6*cut+3*k+i]=Math.round((v+T0[i])*1e4);}));};
 for(const c of valides)pose(c,base.rails);
 for(const c of loin)pose(c,decale(mm));
 return {['banane5ListeInstantane:'+part]:LM.compacter({st,fl,ed},{partie:part,at:'2026-01-01T00:00:00.000Z',version:'5',cle:'essai'})};
}
async function lot(reglage,{panne=false,loin=[112],liste=null,mm=230}={}){
 const {memoire}=require('./helpers/perf-production.cjs');
 const local=memoire();if(liste)await local.set(liste);
 const adapter=new EsvDecale(loin,mm),b=production({adapter,local});
 const lotReglage={...S.lot,profil:'actuel',...(reglage!==undefined?{voieB1EcartOmbre:reglage}:{})};
 b.ctx.BananeSettings={...b.ctx.BananeSettings,lot:lotReglage};
 if(panne)b.ctx.BananeVoieB1Ecart={...b.ctx.BananeVoieB1Ecart,evaluer:()=>{throw Error('panne simulée de l\'ombre');}};
 await b.api('connect',{tabId:1});await b.api('settings',{mode:'automatic-test'});
 adapter.identity.cut=111;adapter.rails=K.clone(loin.includes(111)?decale(mm):base.rails);
 await b.api('start',{part:23,start:111,end:112,...SCOPE});await b.settle();
 await attendre(30);try{b.get('voieOmbreVider')();}catch{}await attendre(200);
 return {b,adapter};
}
const ombres=b=>b.store.events.filter(e=>e.type==='voie-b1-ecart-ombre');
const decisions=b=>b.store.events.filter(e=>e.type==='gcv1-shadow-observed').map(e=>{const {engineMs,...d}=e.lotObservation||{};return [e.identity?.cut,d];});
const metier=b=>b.store.events.filter(e=>!['voie-b1-ecart-ombre','voie-predite-ombre','b1-ombre','garde-voie-ombre','serrage-lot-ombre','esv-observation','phase-timing'].includes(e.type)).map(e=>e.type);
let coupe,active,enPanne;
before(async()=>{coupe=await lot({...S.lot.voieB1EcartOmbre,actif:false});active=await lot(undefined);enPanne=await lot(undefined,{panne:true});});

test('le réglage existe, actif par défaut en OMBRE ; le panneau dit qu\'il ne fait que consigner',()=>{
 const v=S.lot.voieB1EcartOmbre;assert.ok(Object.isFrozen(v));
 deq({...v},{actif:true,fenetreListe:5,fenetreMm:30,choixMm:15,accordMm:20,gRefDefautMm:1435,essaisMax:4});
 const ligne=S.describe().find(l=>/B1-écart en ombre/.test(l.nom));assert.ok(ligne);assert.match(ligne.valeur,/consign/i);assert.match(ligne.pourquoi,/jamais pos/i);
});

test('LA POSE NE CHANGE PAS : mêmes commandes ESV, mêmes rails, mêmes enregistrements, mêmes événements métier, décisions identiques octet pour octet, avec et sans l\'ombre, et en panne',()=>{
 for(const [nom,x] of [['ombre active',active],['ombre en panne',enPanne]]){
  deq(neutre(x.b.commands),neutre(coupe.b.commands),nom+' : mêmes commandes ESV, même ordre');
  deq(neutre(x.adapter.rails),neutre(coupe.adapter.rails),nom);deq(x.adapter.calls,coupe.adapter.calls,nom);
  const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(x.b),rec(coupe.b),nom);
  deq(metier(x.b),metier(coupe.b),nom+' : mêmes événements métier');
  assert.equal(JSON.stringify(neutre(decisions(x.b))),JSON.stringify(neutre(decisions(coupe.b))),nom+' : décisions du lot identiques, octet pour octet');
 }
 const d=decisions(coupe.b);deq(d.map(([c,x])=>[c,x.command?.action]),[[111,'engine'],[112,'defer']]);
 assert.equal(coupe.adapter.calls.filter(c=>c==='validate').length,1);
});

test('un événement compact par cut différé, seulement si le réglage est actif ; aucune position de scène ; en panne, un événement « erreur »',()=>{
 assert.equal(ombres(coupe.b).length,0,'réglage coupé : rien');
 const e=ombres(active.b);
 deq(e.map(x=>x.identity.cut),[112],'un par différé, aucun pour le cut posé');
 const x=e[0];
 assert.equal(x.version,'voie-b1-ecart-ombre-v1');assert.ok(x.batchId);assert.equal(x.etat,'calcule');
 assert.equal(typeof x.verdict.posable,'boolean');assert.ok(x.verdict.posable||typeof x.verdict.raison==='string');
 for(const k of ['source','etage','appuis','gRef','essais','confiance','poseMm','ms','reel'])assert.ok(k in x,'champ '+k);
 assert.ok(['lot','serie','b1','ecart',null].includes(x.source));assert.ok(Number.isFinite(x.ms)&&x.ms>=0);
 assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(x)),'aucune position de scène');
 assert.ok(JSON.stringify(x).length<2500,'événement compact : '+JSON.stringify(x).length+' octets');
 deq(x.seuils,{...S.lot.voieB1EcartOmbre},'le premier événement du lot porte le réglage');
 /* Le cut 112 : le lot avait une reprise depuis la voie (111 est appui), refusée par la commande (vue) ; la pose de la règle existe (chaîne réelle ou complément). */
 assert.equal(x.reel.stage,'window');
 assert.equal(x.verdict.posable,true,'la reprise depuis la voie de 111 (refusée par la vue) est la pose de la règle : '+JSON.stringify(x.verdict));assert.equal(x.source,'lot');assert.equal(x.etage,'window');
 assert.ok(x.poseMm&&SIDES.every(s=>x.poseMm[s].length===3));
 /* La voie entière est à 230 mm ; les repères profil des deux rails de la fixture ne sont pas parallèles : la moyenne des deux latéraux le dit, à 30 mm près. */
 const lat=(x.poseMm.left[1]+x.poseMm.right[1])/2;assert.ok(Math.abs(lat+230)<30,'latéral moyen proche de −230 mm : '+lat);
 const p=ombres(enPanne.b);deq(p.map(y=>y.identity.cut),[112]);assert.equal(p[0].etat,'erreur');assert.equal(p[0].verdict.posable,false);assert.match(p[0].message,/panne simulée/);
});

test('aucun chemin de pose ne lit l\'ombre : seul le service worker l\'appelle, après la commande, dans la file différée',()=>{
 const fs=require('node:fs'),path=require('node:path'),racine=path.resolve(__dirname,'..');
 const bg=fs.readFileSync(path.join(racine,'background.js'),'utf8');
 assert.match(bg,/'src\/voie-b1-ecart\.js'/,'chargé par le service worker');
 assert.match(bg,/voieOmbrePousser\(\(\)=>\{void b1EcartEvaluer/,'calcul dans la file différée de l\'ombre');
 for(const f of fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')&&x!=='voie-b1-ecart.js')){
  const t=fs.readFileSync(path.join(racine,'src',f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!/BananeVoieB1Ecart|voie-b1-ecart/.test(t),f+' ne lit pas le module');
 }
 const m=fs.readFileSync(path.join(racine,'src/voie-b1-ecart.js'),'utf8');
 assert.ok(!/chrome\.|fetch\(|sendMessage|Date\.now|putEvent/.test(m),'module pur : ni ESV, ni stockage, ni horloge, ni journal');
});
