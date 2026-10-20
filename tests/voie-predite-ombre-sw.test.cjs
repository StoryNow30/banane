'use strict';
/* 5.0 (audit 5.0, I8 (1)) — ORBITE : UN ÉVÉNEMENT `voie-predite-ombre` PAR CUT DIFFÉRÉ, SERVICE WORKER RÉEL EN VM (moteur et GCV1
 * réels, ESV simulé). L'ombre consigne ce qu'aurait fait la règle prudente D-147 (moteur recentré sur la voie du lot, vue
 * déplacée) : étage, confiance, écart à la voie, geste de vue nécessaire, profondeur de chaîne, verdict. ELLE NE POSE RIEN :
 * mêmes commandes à ESV, mêmes poses, mêmes enregistrements, mêmes décisions (octet pour octet) avec et sans elle, et une
 * panne de l'ombre ne change rien. Données synthétiques : le cut 111 est posé ; le cut 112 a sa pose de départ à 230 mm de la voie.
 * Le délai de verify est de 20 s par fichier (moteur réel, environ 1,5 s par cut) : la panne est essayée dans
 * tests/voie-predite-ombre-sw-panne.test.cjs ; la chaîne de l'ombre sur plusieurs différés, dans tests/voie-recentree.test.cjs. */
const {test,before}=require('node:test'),assert=require('node:assert/strict');
const {lot,neutre,decisions,metier,ombres,deq}=require('./helpers/voie-ombre-lot.cjs'),S=require('../src/settings.js');
let coupe,active;
before(async()=>{coupe=await lot({...S.voiePrediteOmbre,actif:false});active=await lot(undefined);});

test('le réglage existe, actif par défaut en OMBRE, seuils de D-147 ; le panneau dit qu\'il ne fait que consigner',()=>{
 const v=S.voiePrediteOmbre;assert.ok(Object.isFrozen(v));
 deq({...v,etages:[...v.etages]},{actif:true,etages:['window'],confianceMin:55,ecartementVoisinMm:10,profondeurMax:10,fenetreMm:30,dezoomMax:1.5,glissementPxMax:250});
 const ligne=S.describe().find(l=>/Voie prédite en ombre/.test(l.nom));assert.ok(ligne);assert.match(ligne.valeur,/consign/i);assert.match(ligne.pourquoi,/jamais pos/i);
});

test('LA POSE NE CHANGE PAS : mêmes commandes ESV, mêmes rails, mêmes enregistrements, mêmes événements métier, décisions identiques octet pour octet',()=>{
 for(const [nom,x] of [['ombre active',active]]){
  deq(neutre(x.b.commands),neutre(coupe.b.commands),nom+' : mêmes commandes ESV, même ordre');
  deq(neutre(x.adapter.rails),neutre(coupe.adapter.rails),nom);deq(x.adapter.calls,coupe.adapter.calls,nom);
  const rec=b=>b.store.records.map(r=>[r.identity?.cut,r.status,r.validationProof??null,r.commandSent??null]);deq(rec(x.b),rec(coupe.b),nom);
  deq(metier(x.b),metier(coupe.b),nom+' : mêmes événements métier');
  assert.equal(JSON.stringify(neutre(decisions(x.b))),JSON.stringify(neutre(decisions(coupe.b))),nom+' : décisions du lot identiques, octet pour octet');
 }
 /* Le lot a bien posé 111 et différé 112 (sinon l'essai ne prouverait rien). */
 const d=decisions(coupe.b);deq(d.map(([c,x])=>[c,x.command?.action]),[[111,'engine'],[112,'defer']]);
 assert.equal(coupe.adapter.calls.filter(c=>c==='validate').length,1);
});

test('un événement par cut différé, et seulement si le réglage est actif ; aucune commande de plus',()=>{
 assert.equal(ombres(coupe.b).length,0,'réglage coupé : rien');
 const e=ombres(active.b);
 deq(e.map(x=>x.identity.cut),[112],'un par différé, aucun pour le cut posé');
 for(const x of e){
  assert.equal(x.version,'voie-predite-ombre-v1');assert.ok(x.batchId);assert.equal(typeof x.verdict.posable,'boolean');assert.ok(x.verdict.posable||typeof x.verdict.raison==='string');
  assert.ok('etage' in x&&'confiance' in x&&'ecartVoieMm' in x&&'profondeur' in x&&'vue' in x,'étage, confiance, écart, profondeur, vue');
  assert.ok(!/positionSceneRelative|"positions"/.test(JSON.stringify(x)),'aucune position de scène');
 }
 /* Le premier événement du lot porte les seuils lus dans les réglages (les suivants non : poids). */
 deq(e[0].seuils,{...S.voiePrediteOmbre,etages:[...S.voiePrediteOmbre.etages]});
 /* Reprise depuis la voie trouvée par la décision réelle (112), refusée par la commande : l'ombre relance le moteur. */
 assert.equal(e[0].reel.stage,'window');assert.equal(e[0].recalcule,true);assert.equal(e[0].etage,'window');assert.ok(Number.isFinite(e[0].ecartVoieMm));
});

test('aucun chemin de pose ne lit l\'ombre : seul le service worker l\'appelle, et seulement après la commande',()=>{
 const fs=require('node:fs'),path=require('node:path'),racine=path.resolve(__dirname,'..');
 const bg=fs.readFileSync(path.join(racine,'background.js'),'utf8');
 assert.match(bg,/'src\/voie-recentree\.js'/,'chargé par le service worker');
 for(const f of fs.readdirSync(path.join(racine,'src')).filter(x=>x.endsWith('.js')&&x!=='voie-recentree.js')){
  const t=fs.readFileSync(path.join(racine,'src',f),'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
  if(f==='native-session.js')continue;   // l'ombre de l'Écho, essayée à part
  if(f==='gcv2-l1.js'||f==='gcv2-l1e.js')continue;   // 4.9.5.13 : la GCV2 des différés (L1), appelée par le service worker après la décision du lot ; 4.9.5.14 : sa décision L1-e
  assert.ok(!/BananeVoieRecentree|voie-recentree/.test(t),f+' ne lit pas le module');
 }
 assert.ok(!/BananeVoieRecentree|voiePrediteOmbre/.test(fs.readFileSync(path.join(racine,'src','engine.js'),'utf8')));
});
