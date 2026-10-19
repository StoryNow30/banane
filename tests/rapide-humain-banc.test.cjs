'use strict';
/* D-157 — banc des trois modes du clic de pose rapide (tools/rapide-humain.cjs) : le vrai service worker, le vrai code de page,
 * un ESV simulé portant les caméras de la capture. Données SYNTHÉTIQUES (le nuage des essais, deux cuts rapides) : l'outil compte
 * les clics hors vue (tel-quel : un par cut, le rail gauche), les rend au service worker (compteur et bilan du lot), et les poses
 * des modes corrigés sont celles de tel-quel à 1 mm près, avec les mêmes décisions. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../tools/rapide-humain.cjs'),{base,K}=require('./fixtures.cjs');
/* Une caméra par rail : celle de la capture des essais, translatée sur le rail (comme ESV après le bouton du rail). */
function cameras(rails){const c=base.camera,p0=c.cameraToSceneRelative.slice(12,15);
 return ['left','right'].map(s=>{const p=rails[s].positionSceneRelative,M=c.cameraToSceneRelative.slice(),ax=[M[0],M[1],M[2]],ay=[M[4],M[5],M[6]];
  const d=p.map((v,i)=>v-p0[i]),u=ax.reduce((a,x,i)=>a+x*d[i],0),w=ay.reduce((a,x,i)=>a+x*d[i],0);for(let i=0;i<3;i++)M[12+i]=p0[i]+ax[i]*u+ay[i]*w;
  return {camera:{type:'OrthographicCamera',cameraToSceneRelative:M,sceneRelativeToCamera:K.C.inverse(M),projection:[5,0,0,0, 0,5*800/600,0,0, 0,0,-1e-4,0, 0,0,0,1],viewport:{left:0,top:0,width:800,height:600}}};});}
function lotSynthetique(cuts){
 const clouds=cuts.map(cut=>{const c=K.clone(base);c.identity={pageId:'fixture-page',part:23,cut,shape:'U50',frameId:'fixture-frame',projectId:null};c.cut=cut;c.part=23;c.viewCaptures=cameras(c.rails);c.camera=c.viewCaptures[1].camera;
  c.readStrategy={lecture:'rapide'};return c;});
 const events=cuts.map((cut,i)=>({type:'phase-timing-pli',batchId:'lot',ctx:{identity:{part:23,cut}},rows:[[0,0,1000*i]],r:{s:{'command:capture':[0,5]}}}));
 return {corpus:[{clouds}],journal:{state:{batch:{id:'lot',scope:{part:23}}},events}};}

test('vues de la capture : le rôle des deux caméras, et la vue active (la dernière caméra, celle du rail droit)',()=>{
 const {corpus}=lotSynthetique([100]),cap=corpus[0].clouds[0],v=T.vuesDeCapture(cap);
 assert.equal(v.active,'right');assert.equal(v.left,cap.viewCaptures[0].camera);assert.equal(v.right,cap.viewCaptures[1].camera);
 assert.equal(T.vuesDeCapture({...cap,viewCaptures:[cap.viewCaptures[0]]}),null,'une seule caméra : pas de simulation');
});

test('banc : tel-quel compte un clic hors vue par cut rapide (rail gauche) ; gauche-recentre aucun, mêmes poses à 1 mm, mêmes décisions',async()=>{
 const {corpus,journal}=lotSynthetique([100,101]);
 const bras=[];for(const mode of ['tel-quel','gauche-recentre'])bras.push(await T.jouerLot({mode,corpus,journal,echelle:.05,vm:true}));
 const [a,b]=T.comparer(bras);
 assert.ok(a.applications>=1,'au moins une pose');
 assert.equal(a.clicsHorsVue,a.applications,'tel-quel : un clic hors vue par application');assert.deepEqual(a.clicsHorsVueParCote,{left:a.applications,right:0});
 assert.equal(a.relevesHorsVue,a.applications,'la page les a relevés');
 assert.equal(a.journal.compteur.total,a.applications,'compteur du lot dans le service worker');
 assert.equal(a.journal.bilan.at(-1)?.total,a.applications,'bilan de fin de lot');
 assert.equal(b.clicsHorsVue,0);assert.equal(b.relevesHorsVue,0);assert.equal(b.journal.bilan.length,0);
 assert.equal(b.comparaisonTelQuel.identiquesA1mm,b.comparaisonTelQuel.posesComparees);assert.ok(b.comparaisonTelQuel.posesComparees>=1);
 assert.equal(b.comparaisonTelQuel.memesDecisions,true);assert.deepEqual(b.comparaisonTelQuel.differesEnPlus,[]);
 assert.equal(a.posesAPlusDe1mm+b.posesAPlusDe1mm,0);
 assert.ok(b.applicationTerrainMs.rapides.mediane>a.applicationTerrainMs.rapides.mediane,'le recentrage du rail gauche prend du temps');
 assert.deepEqual(a.vueActive,{right:a.applications});
});
