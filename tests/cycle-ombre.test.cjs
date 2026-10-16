'use strict';
/* Outil de mesure `tools/cycle-ombre.cjs` (de combien l'ombre de la voie prédite allonge le cycle d'un lot Orbite) : son arithmétique sur
 * des données synthétiques, et un petit lot réel dans le service worker (deux cuts, moteur et GCV1 réels, ESV simulé), avec et sans ombre.
 * L'essai ne mesure rien d'utile sur le temps : il vérifie que l'outil tourne, que les deux bras jouent les mêmes décisions et les mêmes
 * commandes, et que les relevés (cycle, retard de la réponse, écart à la commande suivante) ont la forme attendue. Aucune donnée réelle. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const T=require('../tools/cycle-ombre.cjs');
const plat=x=>JSON.parse(JSON.stringify(x));

test('statistiques : médiane, P90, max, total, sans les valeurs absentes',()=>{
  const s=T.stats([10,20,30,40,50,null,undefined,NaN]);
  assert.deepEqual(plat(s),{n:5,mediane:30,p90:46,max:50,min:10,moyenne:30,total:150});
  assert.deepEqual(plat(T.stats([])),{n:0});
  assert.equal(T.quantile([1,2,3,4],.5),2.5);
});

test('retard ajouté = max(0, calcul − capture) ; absent si l\'un des deux manque',()=>{
  assert.equal(T.retardAjoute(1200,700),500);
  assert.equal(T.retardAjoute(300,700),0);
  assert.equal(T.retardAjoute(700,700),0);
  assert.equal(T.retardAjoute(null,700),null);
  assert.equal(T.retardAjoute(300,undefined),null);
  const r=T.resumeRetards([{retardMs:500},{retardMs:0},{retardMs:200},{retardMs:null}]);
  assert.equal(r.differes,4);assert.equal(r.avecSuivant,3);assert.equal(r.retardes,2);assert.equal(r.sommeMs,700);assert.equal(r.partRetardes,.667);
  assert.equal(r.surLesRetardes.mediane,350);assert.equal(r.tous.max,500);
});

/* Un journal minimal : trois visites, la deuxième est différée. */
const visite=(cut,open,capture,differe)=>({type:'phase-timing-pli',batchId:'b',ctx:{identity:{cut}},rows:[[1,1,open,0,'x','observed-target','open']],
  r:{s:{'command:capture':[1,capture],'facade-total':[1,200],...(differe?{'command:nextWithoutDecision':[1,12]}:{'command:apply':[1,3]})}}});
const journal={state:{batch:{id:'b'}},events:[visite(12,3000,900,false),visite(10,0,500,false),visite(11,1500,700,true),{type:'phase-timing-pli',batchId:'autre',ctx:{identity:{cut:99}},rows:[[1,1,1,0]],r:{s:{'command:capture':[1,5]}}}]};

test('journal : visites du lot exporté seul, dans l\'ordre d\'ouverture, avec la capture et le différé',()=>{
  const v=T.visitesDuJournal(journal);
  assert.deepEqual(v.map(x=>[x.cut,x.captureMs,x.differe,x.moteurMs]),[[10,500,false,200],[11,700,true,200],[12,900,false,200]]);
  const c=T.cyclesDuTerrain(v);
  assert.deepEqual(plat(c),[{cut:10,cycleMs:1500,apresDiffere:false},{cut:11,cycleMs:1500,apresDiffere:false}]);
  /* le cycle du cut 12 suit le différé 11 : l'ombre de 11 a tourné pendant la capture de 12 */
  assert.deepEqual(plat(T.cyclesDuTerrain([...v,{cut:13,ouvertureMs:4500,differe:false}]).at(-1)),{cut:12,cycleMs:1500,apresDiffere:true});
});

/* Deux bras fabriqués à la main : le cut 11 est différé, la réponse du cut 12 arrive 400 ms après qu'elle était prête quand l'ombre est active. */
const bras=(nom,retard,dureeMs)=>({bras:nom,dureeMs,differes:[11],decisions:[[10,'first-pass','engine',null],[11,'deferred','engine','x'],[12,'first-pass','engine',null]],commandes:['capture','apply','capture','nextWithoutDecision','capture','apply'],
  parCut:[{cut:10,envoi:0,pret:500,recue:500,commande:700,action:'apply'},{cut:11,envoi:1000,pret:1700,recue:1700,commande:1800,action:'nextWithoutDecision'},
    {cut:12,envoi:2500,pret:3400,recue:3400+retard,commande:3600+retard,action:'apply'}],
  ombre:{evenements:nom==='actif'?1:0,recalcule:0,etats:{},recalcules:0,posables:0,msEvenement:[]},
  chrono:{evaluer:nom==='actif'?[{cut:11,debut:2500,ms:retard+900,recalcule:true,posable:false}]:[],noterMs:[1,2],planifierMs:[0,1]}});

test('lecture d\'un bras : cycle, retard de la réponse, écart à la commande suivante, classes « après un différé » / « après une pose »',()=>{
  const c=T.lireBras(bras('actif',400,5000));
  assert.deepEqual(c.map(x=>[x.cut,x.apresDiffere,x.differe,x.cycleMs]),[[10,false,false,1000],[11,false,true,1500],[12,true,false,null]]);
  assert.deepEqual(c.map(x=>x.retardReponseMs),[0,0,400]);
  assert.deepEqual(c.map(x=>x.reponseVersCommandeMs),[200,100,600]);
});

test('comparaison : mêmes décisions et commandes, écarts appariés actif − coupé, durée du lot',()=>{
  const r=T.comparer([bras('coupe',0,5000),bras('actif',400,5600),bras('actif',500,5700),bras('coupe',0,5100)]);
  assert.equal(r.memesDecisionsEtCommandes,true);
  assert.equal(r.lot.medianeCoupeMs,5050);assert.equal(r.lot.medianeActifMs,5650);assert.equal(r.lot.ecartMedianMs,600);
  assert.equal(r.ecartsApparies.retardReponseMs.apresDiffere.mediane,450);
  assert.equal(r.ecartsApparies.reponseVersCommandeMs.apresDiffere.mediane,450);
  assert.equal(r.ecartsApparies.retardReponseMs.apresPose.mediane,0);
  assert.equal(r.differes,1);assert.equal(r.calculOmbreRecalculesMs.n,2);
  /* une décision différente d'un bras à l'autre est signalée */
  const autre=bras('actif',0,5000);autre.decisions[1]=[11,'first-pass','engine',null];
  assert.equal(T.comparer([bras('coupe',0,5000),autre]).memesDecisionsEtCommandes,false);
});

/* Petit lot réel : deux cuts du banc d'essai (111 posé, 112 à 230 mm de la voie, donc différé), nuages et poses de la maquette. */
test('lot réel de deux cuts, ombre coupée puis active : mêmes décisions, mêmes commandes, un événement d\'ombre pour le différé',async()=>{
  const {base,K}=require('./fixtures.cjs'),O=require('../src/continuity-observer.js');
  const decale=mm=>Object.fromEntries(['left','right'].map(side=>{const r=base.rails[side],P=r.profileLocalToSceneRelative,o=K.C.point(r.sceneRelativeToProfileLocal,r.positionSceneRelative);
    const a=K.C.point(P,o),b=K.C.point(P,[o[0],o[1]+mm/1000,o[2]]);return [side,O.translated(r,[b[0]-a[0],b[1]-a[1],b[2]-a[2]])];}));
  const nuage=(cut,rails)=>({...K.clone(base),cut,part:23,identity:{...K.clone(base.identity||{}),pageId:'fixture-page',part:23,cut,shape:'U50',frameId:'fixture-frame',projectId:null},rails:K.clone(rails),captureId:'cap-'+cut});
  const dossier=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'cycle-ombre-')),f=path.join(dossier,'corpus.json');
  fs.writeFileSync(f,JSON.stringify({clouds:[nuage(111,base.rails),nuage(112,decale(230))]}));
  const j={state:{batch:{id:'b'}},events:[visite(111,0,5,false),visite(112,100,5,false)]};
  const fj=path.join(dossier,'journal.json');fs.writeFileSync(fj,JSON.stringify(j));
  /* Chaque bras dans son processus, par la ligne de commande de l'outil (service worker dans le contexte principal, comme pour la mesure). */
  const jouer=nom=>{const sortie=path.join(dossier,nom+'.json'),r=require('node:child_process').spawnSync(process.execPath,[require.resolve('../tools/cycle-ombre.cjs'),'bras','--bras',nom,'--journal',fj,'--corpus',f,'--sortie',sortie],{encoding:'utf8'});
    assert.equal(r.status,0,r.stderr);return JSON.parse(fs.readFileSync(sortie,'utf8'));};
  const coupe=jouer('coupe'),actif=jouer('actif');
  fs.rmSync(dossier,{recursive:true,force:true});
  assert.deepEqual(plat(actif.decisions),plat(coupe.decisions),'mêmes décisions du lot');
  assert.deepEqual(actif.commandes,coupe.commandes,'mêmes commandes à ESV');
  assert.deepEqual(actif.differes,[112]);assert.deepEqual(coupe.differes,[112]);
  assert.equal(coupe.ombre.evenements,0);assert.equal(actif.ombre.evenements,1);
  assert.equal(actif.chrono.evaluer.length,1);assert.equal(coupe.chrono.evaluer.length,0);
  assert.equal(actif.parCut.length,2);
  const r=T.comparer([coupe,actif]);
  assert.equal(r.memesDecisionsEtCommandes,true);assert.equal(r.differes,1);
  assert.ok(Number.isFinite(r.lot.ecartMedianMs));
});
