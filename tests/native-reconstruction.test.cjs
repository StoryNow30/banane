'use strict';
/* CH-053-C — définition assouplie de l'état initial (src/native-reconstruction.js). Enregistrements SYNTHÉTIQUES de forme réelle
 * (champs lus par chooseGeometry), aucune donnée de terrain. Chaque relâchement est essayé seul, puis l'ACCORD d'étiquettes. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const R=require('../src/native-reconstruction.js');

const ID={pageId:'p',part:90,cut:1,shape:'U50',frameId:'f',projectId:null};
const mat=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1], inv=(x,y,z)=>mat(-x,-y,-z);
const rail=(x,y=0,z=0)=>({positionSceneRelative:[x,y,z],railLocalToSceneRelative:mat(x,y,z),profileLocalToSceneRelative:mat(x,y,z),sceneRelativeToProfileLocal:inv(x,y,z)});
const T0=Date.UTC(2031,4,1,8,0,0),iso=s=>new Date(T0+s*1000).toISOString();
const qual=(side,id,r,o={})=>({format:'banane-native-rail-snapshot-v1',snapshotId:id,captureId:id.split(':')[0],side,identity:{...ID},chunkIds:[id],rail:r,
  viewObservation:{viewEpochId:'e'},coordinateSystem:{name:'scene-relative',units:'metres-observed-not-independently-calibrated',frameId:'f'},
  acquisitionStartedAt:iso(o.debut??1),acquiredThroughAt:iso(o.fin??1.5),emittedAt:iso(o.fin??1.5),storedAt:iso(o.fin??1.5),sourceStatus:'reference-version-and-matrix-stable-through-checkpoint',
  clipStatus:o.clip||'verified-classifiable',transform:{valid:true},associationStatus:'same-target-and-rail-pose',criteriaVersion:'native-visible-roi-v1',
  coverage:{status:'qualified-candidate',pointsInRoi:300},qualificationStatus:'qualified-candidate',exclusionReasons:[],receiptEventSeq:7});
/* Une visite : état initial à x0, rails à gauche (0) et droite (1,435). `snaps` : {left:[…],right:[…]}. */
function visite({snaps,intentAt=3,depart=null,final=[0.004,0,0]}={}){
  const l0=rail(0),r0=rail(1.435);
  return {version:'4.9.0.18',recordId:'v',identity:{...ID},beforeEstablished:{identity:{...ID},rails:{left:l0,right:r0}},
    startPose:depart,operatorIntents:[{intent:'VALIDATE',observedAt:iso(intentAt)}],
    humanFinalReference:{state:{rails:{left:rail(...final),right:rail(1.435+final[0],0,0)}}},railSnapshots:snaps};
}
/* Nuage d'un bloc : points en repère scène répartis sur 1 m le long de x autour de `centre`. */
const nuage=(id,centre,n=400)=>({chunkId:id,pointsSceneRelative:Array.from({length:n},(_,i)=>[centre[0]-.5+i/n,centre[1]+((i*7)%11)/200-.025,centre[2]-.01-(i%3)*.01]),
  visibleByClipBoxes:Array(n).fill(true)});

test('stricte : un instantané à la pose initiale, avant le geste, est qualifié par la voie stricte',()=>{
  const v=visite({snaps:{left:[qual('left','cA:left:0',rail(0))],right:[qual('right','cA:right:0',rail(1.435))]}});
  const r=R.reconstruireCut(v);assert.equal(r.qualifie,true);assert.equal(r.stricte,true);assert.equal(r.rails.left.voie,'stricte');
});
test('aucun instantané : non qualifié, sans reconstruction',()=>{
  const r=R.reconstruireCut(visite({snaps:{left:[],right:[]}}));assert.equal(r.qualifie,false);assert.deepEqual(r.rails.left.raisons,['qualified-stored-snapshot-missing']);
});
test('relâchement « intention » : instantané à la même pose acquis après le geste',()=>{
  const v=visite({intentAt:1,snaps:{left:[qual('left','cB:left:0',rail(0),{fin:2})],right:[qual('right','cB:right:0',rail(1.435),{fin:2})]}});
  const r=R.reconstruireCut(v);assert.equal(r.qualifie,true);assert.equal(r.rails.left.voie,'instantane-meme-pose');assert.equal(r.rails.left.apresIntention,true);
  assert.equal(r.stricte,false);
});
test('relâchement « découpe » : bloc reclassé accepté, bloc de découpe non vérifiée refusé',()=>{
  const mk=clip=>visite({snaps:{left:[qual('left','cC:left:0',rail(0),{clip})],right:[qual('right','cC:right:0',rail(1.435),{clip})]}});
  assert.equal(R.reconstruireCut(mk('reclassified-to-current-clip')).rails.left.voie,'reclasse-decoupe');
  assert.equal(R.reconstruireCut(mk('unverified')).qualifie,false);
});
test('relâchement « pose » : rail déplacé de 20 mm — refusé sans points, accepté si les points couvrent le repère initial',()=>{
  const v=visite({snaps:{left:[qual('left','cD:left:0',rail(.02))],right:[qual('right','cD:right:0',rail(1.435))]}});
  assert.equal(R.reconstruireRail(v,'left').qualifie,false);
  assert.deepEqual(R.reconstruireRail(v,'left').raisons,['pose-differente-points-absents']);
  const nuages=new Map([['cD:left:0',nuage('cD:left:0',[0.02,0,0])]]);
  const ok=R.reconstruireRail(v,'left',{nuages});assert.equal(ok.qualifie,true);assert.equal(ok.voie,'instantane-pose-differente');assert.ok(Math.abs(ok.ecartPoseMm-20)<1e-6);
  const loin=new Map([['cD:left:0',nuage('cD:left:0',[3,0,0])]]);   // points loin du rail initial : couverture nulle dans son repère
  assert.equal(R.reconstruireRail(v,'left',{nuages:loin}).qualifie,false);
  assert.deepEqual(R.reconstruireRail(v,'left',{nuages:loin}).raisons,['couverture-repere-initial-insuffisante']);
});
test('couverture non qualifiée à la source : jamais rattrapée par la reconstruction',()=>{
  const s=qual('left','cE:left:0',rail(0));s.qualificationStatus='insufficient';s.coverage={status:'insufficient'};
  assert.equal(R.reconstruireRail(visite({snaps:{left:[s],right:[]}}),'left').qualifie,false);
});
test('étiquette : pose de départ ≠ état initial (geste avant la capture) — non reconstruit, l\'étiquette changerait',()=>{
  const v=visite({depart:{rails:{left:rail(.01),right:rail(1.445)}},snaps:{left:[qual('left','cF:left:0',rail(.01))],right:[]}});
  const r=R.reconstruireRail(v,'left');assert.equal(r.qualifie,false);assert.deepEqual(r.raisons,['pose-de-depart-etiquette-differente-de-etat-initial']);
});

/* ACCORD : sur les cuts qui satisfont les deux définitions, mêmes étiquettes (pose finale, correction) à ±1 mm. */
test('accord d\'étiquettes sur les cuts stricts : l\'étiquette ne dépend pas de la voie',()=>{
  let n=0;
  for(const dx of [0,.0004,.003,-.012,.05]){
    const v=visite({final:[dx,0,0],snaps:{left:[qual('left','cG:left:0',rail(0))],right:[qual('right','cG:right:0',rail(1.435))]}});
    const r=R.reconstruireCut(v);assert.equal(r.stricte,true);
    for(const side of ['left','right']){
      const strict=R.etiquette(v,side,v.startPose?.rails?.[side]||v.beforeEstablished.rails[side]);
      const assoupli=R.etiquette(v,side,v.beforeEstablished.rails[side]);   // base de la voie assouplie : l'état initial
      assert.ok(R.memeEtiquette(strict,assoupli));n++;}
  }
  assert.equal(n,10);
});
test('accord : une étiquette qui diffère de plus de 1 mm est détectée',()=>{
  const v=visite({});const a=R.etiquette(v,'left',rail(0)),b=R.etiquette(v,'left',rail(.0025));
  assert.equal(R.memeEtiquette(a,b),false);assert.equal(R.memeEtiquette(a,R.etiquette(v,'left',rail(.0005))),true);
});
