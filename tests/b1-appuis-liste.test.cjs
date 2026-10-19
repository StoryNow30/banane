'use strict';
/* B1 (D-095) : voisins validés lus dans la liste des coupes d'ESV — module du service
 * worker (src/appuis-liste.js) et son emploi par la décision sur le lot. Données
 * SYNTHÉTIQUES (voie droite, repère identité) : aucune donnée d'ESV. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const B=require('../src/appuis-liste.js'),L=require('../src/lot-decision.js');
const C=require('../vendor/capture-core.js');
const rail=(x,y)=>{const P=C.translation([x,y,0]);return {positionSceneRelative:[x,y,0],profileOriginSceneRelative:[x,y,0],profileLocalToSceneRelative:P,railLocalToSceneRelative:P,sceneRelativeToProfileLocal:C.inverse(P)};};
const T=[650000.25,6800000.5,120.125];
const monde=p=>p.map((v,i)=>v+T[i]);

test('repère : T = écriture − pose corrigée, mêmes deux rails ; non rigide refusé ; T contrôlée, jamais consignée',()=>{
  const corr={left:[1,2,3],right:[1,3.435,3]},corps=c=>({XLeftEdge:c.left[0]+T[0],YLeftEdge:c.left[1]+T[1],ZLeftEdge:c.left[2]+T[2],XRightEdge:c.right[0]+T[0],YRightEdge:c.right[1]+T[1],ZRightEdge:c.right[2]+T[2]});
  const m=B.mesurerT(B.bordsCorps(corps(corr)),corr);
  assert.ok(m.ok);assert.ok(m.rigideMm<1e-3);m.T.forEach((v,i)=>assert.ok(Math.abs(v-T[i])<1e-6));
  assert.equal(B.bordsCorps({XLeftEdge:1}),null,'corps incomplet : rien');assert.equal(B.bordsCorps({...corps(corr),ZRightEdge:'x'}),null);
  const tordu=B.mesurerT(B.bordsCorps(corps({left:corr.left,right:[1,3.44,3]})),corr);assert.equal(tordu.ok,false,'les deux rails ne donnent pas la même translation (5 mm) : refusé');
  let R=B.noterRepere(null,'f',tordu);assert.deepEqual([R.etat,R.T,R.refusees],['sans-mesure',null,1],'aucune mesure rigide : pas de T');
  R=B.noterRepere(R,'f',m);assert.deepEqual([R.etat,R.paires,R.refusees],['calibre',1,1]);
  R=B.noterRepere(R,'f',{...m,T:m.T.map((v,i)=>i===0?v+0.004:v)});assert.deepEqual([R.etat,R.paires],['calibre',2],'4 mm : contrôle passé');
  R=B.noterRepere(R,'f',{...m,T:m.T.map((v,i)=>i===1?v+0.006:v)});assert.equal(R.etat,'instable','6 mm : repère instable, plus de voisins');
  assert.equal(B.noterRepere(R,'g',m).etat,'calibre','autre page (autre scène) : recalibrée');
  const resume=JSON.stringify(B.resumeRepere(R));assert.ok(!resume.includes('650000')&&!resume.includes('6800000'),'le journal ne garde jamais T');
});

test('réponse de la page (non fiable) : relue champ par champ, bornée à la fenêtre ; accord indice / géométrie exigé',()=>{
  assert.deepEqual(B.lireReponse(null,{cut:10}),{ok:false,reason:'sans-reponse'});
  assert.deepEqual(B.lireReponse({ok:false,reason:'coupe'},{cut:10}),{ok:false,reason:'coupe'});
  assert.deepEqual(B.lireReponse({ok:false,reason:'<script>'},{cut:10}),{ok:false,reason:'refus'});
  const e=[1,2,3,4,5,6];
  const r=B.lireReponse({ok:true,table:{lignes:7000,pages:7,fraiches:2,debut:true,rompue:false,tables:1,extra:'x'},geo:{index:10,mm:0.2,secondMm:951},
    rows:[{i:4,s:'valid',e},{i:5,s:'valid',t:true,e},{i:5,s:'valid',e},{i:10,s:'invalid',e},{i:12,s:'pirate',e},{i:13,s:'valid',e:[1,2,NaN,4,5,6]},{i:'14',s:'valid',e},{i:16,s:'valid',e},
     ...Array.from({length:30},(_,k)=>({i:6+k%3,s:'valid',e}))]},{cut:10,fenetre:5});
  assert.equal(r.ok,true);assert.deepEqual(r.rows.map(x=>x.i),[5,10,12,13,6,7,8],'hors fenêtre, doublon, indice non entier : écartés ; seules les 2×5+1 premières lignes sont lues');
  assert.deepEqual([r.rows[0].operateur,r.rows[2].statut,r.rows[3].bords],[true,'autre',null]);
  assert.equal(r.table.extra,undefined);assert.deepEqual([r.table.lignes,r.table.debut],[7000,true]);
  assert.deepEqual(B.accord(r,10),{ok:true,raison:null,indiceGeo:10,ecartIndice:0,geoMm:0.2,secondMm:951});
  assert.equal(B.accord(r,11).raison,'indice-different','la ligne la plus proche n’est pas la ligne N : aucun voisin');
  assert.equal(B.accord({...r,geo:{...r.geo,mm:25}},10).raison,'trop-loin');
  assert.equal(B.accord({...r,table:{...r.table,debut:false}},10).raison,'debut-non-vu','table sans première page : indice non fiable');
  assert.equal(B.accord({...r,table:{...r.table,rompue:true}},10).raison,'table-rompue');
  assert.equal(B.accord({...r,geo:null},10).raison,'sans-geometrie');
});

test('appuis : lignes « valid » de la fenêtre, cut décidé exclu, ramenées en scène (− T), au format de consistentValidated',()=>{
  const ligne=(i,s,y=0)=>({i,statut:s,operateur:false,vu:false,fraiche:false,bords:{left:monde([i,y,0]),right:monde([i,y+1.435,0])}});
  const rows=[ligne(7,'valid'),ligne(8,'skipped'),ligne(9,'invalid'),ligne(10,'valid'),ligne(11,'valid'),{...ligne(12,'valid'),bords:null},ligne(13,'autre')];
  const a=B.appuis(rows,T,{part:20,cut:10,frameId:'f'});
  assert.deepEqual(a.map(x=>x.identity.cut),[7,11]);
  assert.deepEqual(a[0].identity,{part:20,cut:7,frameId:'f'});a[0].positions.left.forEach((v,k)=>assert.ok(Math.abs(v-[7,0,0][k])<1e-6));
  assert.equal(a[0].stage,'list-validated');assert.deepEqual(B.appuis(rows,null,{part:20,cut:10}),[],'sans T : aucun voisin');
  assert.deepEqual(B.compter(rows,10),{lignes:6,valid:3,invalid:1,skipped:1,autre:1,operateur:0,fraiches:0,sansBords:1});
});

/* Un premier passage SANS APPUI, paire décalée de 160 mm (cas de 398 et 402, partie 20, posés à tort sous la 4.8.6). */
const shadowKo={scientificProposeBoth:()=>({rails:{left:{ok:false},right:{ok:false}},summary:{}})};
const shadowOk=mm=>({scientificProposeBoth:()=>({rails:{left:{ok:true,next:{status:'candidate',delta:[0,mm/1000,0]}},right:{ok:true,next:{status:'candidate',delta:[0,mm/1000,0]}}},summary:{}})});
function cas({mm=160,applicable=true,Shadow=shadowKo,anchors=[]}={}){
  const capture={identity:{part:20,cut:398,frameId:'f'},rails:{left:rail(0,0),right:rail(0,1.435)},pointsSceneRelative:[],visibleByClipBoxes:[]};
  const science={rails:{left:{ok:applicable,next:{status:'candidate',delta:[0,mm/1000,0]}},right:{ok:true,next:{status:'candidate',delta:[0,mm/1000,0]}}},summary:{}};
  return {args:{capture,science,anchors,Shadow}};
}
const voie=(y=0,cuts=[393,394,395,396,397,399,400,401,402,403])=>cuts.map(c=>({identity:{part:20,cut:c,frameId:'f'},positions:{left:[c-398,y,0],right:[c-398,y+1.435,0]},stage:'list-validated'}));

test('règle d’emploi : garde de continuité d’un premier passage sans voie ; dernier recours d’un différé ; ailleurs inchangé',()=>{
  assert.equal(B.regle({stage:'first-pass',guardMm:null}),'garde-premier-passage');
  assert.equal(B.regle({stage:'first-pass',guardMm:3.1}),'inchange','premier passage déjà gardé par la voie du lot');
  assert.equal(B.regle({stage:'deferred',reason:'no-anchor'}),'dernier-recours');
  for(const stage of ['window','choice','crossing'])assert.equal(B.regle({stage}),'inchange');
  const d0={stage:'deferred'};assert.equal(B.politique(d0,[],()=>{throw Error('jamais appelé');}).decision,d0,'aucun voisin : décision inchangée');
});

test('398 en hypothèse : premier passage à 160 mm de la voie des voisins validés → retiré par la garde (différé) ; décision réelle inchangée',()=>{
  const {args}=cas(),d0=L.decideCut(args);
  assert.deepEqual([d0.stage,d0.guardMm,d0.anchorsUsed.length],['first-pass',null,0],'aujourd’hui : posé sans appui');
  const p=B.politique(d0,voie(),v=>L.decideCut({...args,validated:v}));
  assert.equal(p.regle,'garde-premier-passage');assert.equal(p.decision.stage,'deferred');assert.equal(p.decision.guardDeferred,true);
  assert.equal(p.decision.guardMm,160);assert.equal(p.decision.validatedAnchors.length,10);assert.equal(p.decision.positions,undefined,'aucune pose cherchée à la place');
  assert.deepEqual(B.comparer(d0,p.decision),{changement:'pose-retiree',ecartPoseMm:null});
  assert.equal(L.commandRails({decision:p.decision,runtimeRails:{left:{status:'candidate'},right:{status:'candidate'}},before:{left:{},right:{}}}).action,'defer');
  /* Même cut, voisins sur la vraie voie et pose juste : rien ne change. */
  const juste=cas({mm:2}),dj=L.decideCut(juste.args),pj=B.politique(dj,voie(),v=>L.decideCut({...juste.args,validated:v}));
  assert.deepEqual([pj.decision.stage,pj.decision.guardMm],['first-pass',2]);assert.deepEqual(B.comparer(dj,pj.decision),{changement:'aucun',ecartPoseMm:0});
  /* Un voisin faux et isolé (SKIP à 45 mm) est écarté par la garde de cohérence (D-054) sans rien changer. */
  const v=voie();v[2]={...v[2],positions:{left:[-3,0.045,0],right:[-3,1.48,0]}};
  assert.deepEqual(L.consistentValidated({part:20,cut:398,frameId:'f'},args.capture.rails,v).map(a=>a.identity.cut),[393,394,396,397,399,400,401,402,403]);
});

test('dernier recours : un cut différé faute d’appui est repris depuis la voie des voisins validés (hypothèse)',()=>{
  const {args}=cas({applicable:false,Shadow:shadowOk(2)}),d0=L.decideCut(args);
  assert.deepEqual([d0.stage,d0.reason],['deferred','no-anchor']);
  const p=B.politique(d0,voie(),v=>L.decideCut({...args,validated:v}));
  assert.equal(p.regle,'dernier-recours');assert.equal(p.decision.stage,'window');assert.equal(p.decision.fromPredictionMm,2);
  assert.equal(B.comparer(d0,p.decision).changement,'pose-ajoutee');
  /* Moins de trois voisins cohérents : aucun appui validé, le différé reste. */
  const q=B.politique(d0,voie(0,[396,397]),v=>L.decideCut({...args,validated:v}));
  assert.deepEqual([q.decision.stage,q.decision.validatedAnchors],['deferred',[]]);
});

test('un cut à la fois ligne validée et appui posé du lot ne compte qu’une fois',()=>{
  const posed=voie(0,[397]).map(a=>({...a,stage:'first-pass'}));
  const {args}=cas({mm:2,anchors:posed});
  const d=L.decideCut({...args,validated:voie()});
  assert.deepEqual(d.anchorsUsed,[397,399],'les deux plus proches, sans doublon de 397');
  assert.equal(L.decideCut({...args}).anchorsUsed.join(),'397','sans voisins validés : inchangé');
});
